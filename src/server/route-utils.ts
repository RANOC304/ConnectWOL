import { notFound } from './http';

/** Parses a numeric `[id]` path segment; anything else is a 404 rather than a 500. */
export function parseId(raw: string | undefined): number {
  if (!raw || !/^\d{1,9}$/.test(raw)) throw notFound('Device not found.');
  const id = Number(raw);
  if (id < 1) throw notFound('Device not found.');
  return id;
}
