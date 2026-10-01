import type { ZodType } from 'zod';
import { fieldErrors } from '@/lib/schemas';
import type { ApiErrorBody } from '@/lib/types';
import { getLimiter } from './auth/rate-limit';
import { checkSameOrigin, clientIp, csrfTokenMatches } from './auth/request';
import { readSessionToken, sessionCookieHeader } from './auth/session-cookie';
import { resolveSession, type SessionInfo } from './auth/sessions';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
    readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) => new ApiError(400, 'bad_request', message, fields);
export const unauthorized = (message = 'Please sign in.') => new ApiError(401, 'unauthorized', message);
export const forbidden = (message: string, code = 'forbidden') => new ApiError(403, code, message);
export const notFound = (message = 'Not found.') => new ApiError(404, 'not_found', message);
export const conflict = (message: string) => new ApiError(409, 'conflict', message);

export const DEFAULT_BODY_LIMIT = 64 * 1024;
export const IMPORT_BODY_LIMIT = 5 * 1024 * 1024;

export interface RateLimitSpec {
  /** Limiter name; requests sharing a name share counters. */
  name: string;
  limit: number;
  windowMs: number;
  /** What a counter is keyed on. `session` falls back to the IP for unauthenticated routes. */
  by?: 'ip' | 'session';
}

export interface RouteOptions {
  /** Require a valid session (default true). */
  auth?: boolean;
  /** Require the CSRF header. Default: on for state-changing methods of authenticated routes. */
  csrf?: boolean;
  limit?: RateLimitSpec;
  /** Body size cap for `ctx.json` (default 64 KiB). */
  bodyLimit?: number;
}

export interface Ctx<P> {
  req: Request;
  url: URL;
  params: P;
  session: SessionInfo | null;
  ip: string;
  /** Reads, size-checks and validates the JSON body. */
  json: <T>(schema: ZodType<T>) => Promise<T>;
  /** Reads the JSON body without a schema (for hand-validated payloads such as imports). */
  rawJson: () => Promise<unknown>;
}

type HandlerResult = Response | object | null | undefined;

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

async function readJsonBody(req: Request, maxBytes: number): Promise<unknown> {
  const type = req.headers.get('content-type')?.toLowerCase() ?? '';
  if (!type.includes('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Send the body as JSON with Content-Type: application/json.');
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new ApiError(413, 'payload_too_large', 'The request body is too large.');
  const text = await req.text();
  if (text.length > maxBytes) throw new ApiError(413, 'payload_too_large', 'The request body is too large.');
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest('The request body is not valid JSON.');
  }
}

function errorResponse(error: ApiError): Response {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) },
  };
  return Response.json(body, { status: error.status, headers: { 'Cache-Control': 'no-store', ...error.headers } });
}

/**
 * Wraps a route handler with the cross-cutting API rules, in this order:
 * same-origin check (state-changing methods) -> session -> CSRF -> rate limit -> handler,
 * then maps thrown `ApiError`s / zod failures to a uniform JSON error body.
 */
export function defineRoute<P = Record<string, never>>(
  options: RouteOptions,
  handler: (ctx: Ctx<P>) => Promise<HandlerResult>,
): (req: Request, context: { params: Promise<P> }) => Promise<Response> {
  const { auth = true, bodyLimit = DEFAULT_BODY_LIMIT } = options;

  return async (req, context) => {
    try {
      const method = req.method.toUpperCase();
      const mutating = MUTATING.has(method);

      if (mutating) {
        const origin = checkSameOrigin(req);
        if (!origin.ok) throw forbidden(origin.message, 'bad_origin');
      }

      const session = resolveSession(readSessionToken(req));
      if (auth && !session) throw unauthorized();

      const needsCsrf = options.csrf ?? (auth && mutating);
      if (needsCsrf && session && !csrfTokenMatches(req.headers.get('x-csrf-token'), session.csrfToken)) {
        throw forbidden('Your session needs to be refreshed. Reload the page and try again.', 'bad_csrf');
      }

      const ip = clientIp(req);
      if (options.limit) {
        const spec = options.limit;
        const key = spec.by === 'session' && session ? `s:${session.id}` : `ip:${ip}`;
        const result = getLimiter(spec.name, spec.limit, spec.windowMs).take(key);
        if (!result.allowed) {
          throw new ApiError(
            429,
            'rate_limited',
            `Too many requests. Try again in ${result.retryAfterSec} second${result.retryAfterSec === 1 ? '' : 's'}.`,
            undefined,
            { 'Retry-After': String(result.retryAfterSec) },
          );
        }
      }

      const ctx: Ctx<P> = {
        req,
        url: new URL(req.url),
        params: (await (context?.params ?? Promise.resolve({}))) as P,
        session,
        ip,
        rawJson: () => readJsonBody(req, bodyLimit),
        json: async <T>(schema: ZodType<T>) => {
          const parsed = schema.safeParse(await readJsonBody(req, bodyLimit));
          if (!parsed.success) {
            throw new ApiError(400, 'validation_error', 'Please check the highlighted fields.', fieldErrors(parsed.error));
          }
          return parsed.data;
        },
      };

      const result = await handler(ctx);
      const response =
        result instanceof Response
          ? result
          : result === undefined || result === null
            ? new Response(null, { status: 204 })
            : Response.json(result);

      // Slide the cookie together with the stored expiry.
      if (session?.renewed) {
        const token = readSessionToken(req);
        if (token) response.headers.append('Set-Cookie', sessionCookieHeader(req, token));
      }
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      console.error('[connectwol] unhandled API error:', error);
      return errorResponse(new ApiError(500, 'internal_error', 'Something went wrong on the server.'));
    }
  };
}

/** JSON response with extra `Set-Cookie` headers. */
export function jsonWithCookies(data: unknown, cookies: string[], init: ResponseInit = {}): Response {
  const response = Response.json(data, init);
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  return response;
}
