import type { ApiErrorBody, SessionDto } from './types';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export type ApiFn = <T = unknown>(path: string, options?: ApiOptions) => Promise<T>;

interface ApiDeps {
  getCsrf: () => string;
  setCsrf: (token: string) => void;
  onUnauthorized: () => void;
}

/**
 * Small fetch wrapper for the ConnectWOL API: JSON in/out, CSRF header on mutations, one automatic
 * retry after refreshing a stale CSRF token, and typed errors with per-field messages.
 */
export function createApi({ getCsrf, setCsrf, onUnauthorized }: ApiDeps): ApiFn {
  async function request<T>(path: string, options: ApiOptions = {}, refreshedToken?: string): Promise<T> {
    const method = options.method ?? 'GET';
    const mutating = method !== 'GET';

    let response: Response;
    try {
      response = await fetch(path, {
        method,
        credentials: 'same-origin',
        cache: 'no-store',
        signal: options.signal,
        headers: mutating ? { 'Content-Type': 'application/json', 'X-CSRF-Token': refreshedToken ?? getCsrf() } : undefined,
        body: mutating ? JSON.stringify(options.body ?? {}) : undefined,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiClientError(0, 'network', 'Could not reach the ConnectWOL server. Check that it is running and that you are online.');
    }

    if (response.status === 204) return undefined as T;
    const data: unknown = await response.json().catch(() => null);
    if (response.ok) return data as T;

    const error = (data as Partial<ApiErrorBody> | null)?.error;
    if (response.status === 403 && error?.code === 'bad_csrf' && refreshedToken === undefined) {
      const session = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' })
        .then((r) => (r.ok ? (r.json() as Promise<SessionDto>) : null))
        .catch(() => null);
      if (session?.authenticated && session.csrfToken) {
        setCsrf(session.csrfToken);
        return request<T>(path, options, session.csrfToken);
      }
    }
    if (response.status === 401 && error?.code === 'unauthorized') onUnauthorized();

    throw new ApiClientError(response.status, error?.code ?? 'error', error?.message ?? `The request failed (${response.status}).`, error?.fields);
  }
  return request;
}

/** Human-friendly message for any thrown value. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong.';
}
