export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

export type Fetcher = typeof fetch;

export async function requestJson(
  input: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  let timeoutId = 0;

  try {
    const response = await Promise.race([
      fetcher(input, {
        ...init,
        headers: {
          Accept: "application/json",
          ...(init.headers ?? {})
        },
        signal: controller.signal
      }),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, timeoutMs);
      })
    ]);

    return response;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
