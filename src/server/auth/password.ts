import { hash, verify } from '@node-rs/argon2';

/**
 * Argon2id with the library defaults (19 MiB memory, 2 iterations, 1 lane): the OWASP-recommended
 * minimum profile, still fast enough for a Raspberry Pi.
 */
export function hashPassword(password: string): Promise<string> {
  return hash(password);
}

/** Never throws: a malformed stored hash simply fails verification. */
export async function verifyPassword(storedHash: string, password: string): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * Burns the same CPU time as a real verification so that "unknown user" and "wrong password" are
 * indistinguishable by response time.
 */
export async function verifyDummy(password: string): Promise<void> {
  dummyHash ??= hash('connectwol-timing-equaliser');
  await verifyPassword(await dummyHash, password);
}
