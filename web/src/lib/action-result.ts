/**
 * Discriminated result type returned by every Server Action.
 * Actions never throw to the client; failures are encoded as `{ ok: false }`.
 */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function success<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function failure<T = never>(error: string): ActionResult<T> {
  return { ok: false, error };
}

/** Convert an unknown thrown value into a safe, user-presentable message. */
export function toErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof Error && err.message) {
    // Never leak stack traces or internal URLs to the client.
    const msg = err.message;
    if (msg.length < 300 && !msg.includes("http://") && !msg.includes("https://")) {
      return msg;
    }
  }
  return fallback;
}
