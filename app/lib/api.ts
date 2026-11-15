/**
 * Small client for our own JSON API routes. Adds what a bare fetch() lacks:
 *  - a timeout (plan generation can legitimately take a while, but not forever)
 *  - a readable error for non-JSON responses (a proxy/500 page used to surface as "Unexpected token <")
 *  - the server's `error` text, and its `isSafetyNotice` flag, on the thrown error
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    /** True when the server declined for a health/safety reason (not a failure of the app). */
    public readonly isSafetyNotice = false
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJson<T>(url: string, body: unknown, timeoutMs = 90_000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : null;

    if (!res.ok) {
      const message = typeof record?.error === "string" ? record.error : `The server returned an error (${res.status}).`;
      throw new ApiError(message, res.status, record?.isSafetyNotice === true);
    }
    if (!record) throw new ApiError("The server sent an unexpected response. Please try again.", res.status);
    return record as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("That took too long. Please try again.", 0);
    }
    throw new ApiError("Couldn't reach the server. Check your connection and try again.", 0);
  } finally {
    clearTimeout(timer);
  }
}
