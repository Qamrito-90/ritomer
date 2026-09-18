export const DEFAULT_REQUEST_TIMEOUT_MS = 5000;

export type Fetcher = typeof fetch;

export class SessionInvalidatedError extends Error {
  constructor() {
    super("session_invalidated");
  }
}

export class RequestBlobBodyError extends Error {
  constructor() {
    super("blob_body_error");
  }
}

/** Installed by the router's coordinator, never by importing an API client. */
export interface SessionRequestPolicy {
  generation(): number;
  prepare(init: RequestInit): RequestInit;
  observe(response: Response, isRequestCurrent: () => boolean): Promise<void>;
  onInvalidate(listener: () => void): () => void;
}

let sessionPolicy: SessionRequestPolicy | null = null;
let policyInstallation = 0;

export function installSessionPolicy(policy: SessionRequestPolicy): () => void {
  sessionPolicy = policy;
  policyInstallation += 1;
  return () => {
    if (sessionPolicy === policy) {
      sessionPolicy = null;
      policyInstallation += 1;
    }
  };
}

export function captureSessionGuard(): () => boolean {
  const capturedPolicy = sessionPolicy;
  const generation = capturedPolicy?.generation();
  const installation = policyInstallation;
  return () => policyInstallation === installation && sessionPolicy === capturedPolicy && capturedPolicy?.generation() === generation;
}

export async function requestJson(
  input: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const result = await performRequest(input, init, fetcher, timeoutMs, false, false);
  return result.response;
}

/** Session negotiation bypasses the protected-request policy to avoid recursion. */
export async function requestSessionJson(
  input: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<Response> {
  const result = await performRequest(input, init, fetcher, timeoutMs, false, true);
  return result.response;
}

export function requestBlob(
  input: string,
  init: RequestInit = {},
  fetcher: Fetcher = fetch,
  timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
): Promise<{ response: Response; blob?: Blob }> {
  return performRequest(input, init, fetcher, timeoutMs, true, false);
}

async function performRequest(
  input: string,
  init: RequestInit,
  fetcher: Fetcher,
  timeoutMs: number,
  binary: boolean,
  negotiation: boolean
): Promise<{ response: Response; blob?: Blob }> {
  const policy = negotiation ? null : sessionPolicy;
  const isCurrent = negotiation ? () => true : captureSessionGuard();
  const prepared = policy ? policy.prepare(init) : init;
  if (init.signal?.aborted) throw new SessionInvalidatedError();
  const controller = new AbortController();
  let timeoutId = 0;
  let unsubscribe = () => {};
  let removeAbort = () => {};

  try {
    return await Promise.race([
      (async () => {
        const response = await fetcher(input, {
          ...prepared,
          credentials: "same-origin",
          headers: binary ? prepared.headers : jsonHeaders(prepared.headers),
          signal: controller.signal
        });
        if (!isCurrent() || controller.signal.aborted) throw new SessionInvalidatedError();
        if (policy) await policy.observe(response, () => isCurrent() && !controller.signal.aborted);
        if (!isCurrent() || controller.signal.aborted) throw new SessionInvalidatedError();
        if (!binary || response.status !== 200) return { response };

        let blob: Blob;
        try {
          blob = await response.blob();
        } catch {
          if (!isCurrent() || controller.signal.aborted) throw new SessionInvalidatedError();
          throw new RequestBlobBodyError();
        }
        if (!isCurrent() || controller.signal.aborted) throw new SessionInvalidatedError();
        return { response, blob };
      })(),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error("timeout"));
          controller.abort();
        }, timeoutMs);
        const invalidate = () => {
          reject(new SessionInvalidatedError());
          controller.abort();
        };
        unsubscribe = policy?.onInvalidate(invalidate) ?? (() => {});
        if (init.signal) {
          init.signal.addEventListener("abort", invalidate, { once: true });
          removeAbort = () => init.signal?.removeEventListener("abort", invalidate);
          if (init.signal.aborted) invalidate();
        }
      })
    ]);
  } finally {
    window.clearTimeout(timeoutId);
    unsubscribe();
    removeAbort();
  }
}

function jsonHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const supplied = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : Array.isArray(headers) ? Object.fromEntries(headers) : headers;
  return { Accept: "application/json", ...supplied };
}
