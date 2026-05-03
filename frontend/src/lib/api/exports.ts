import { z } from "zod";
import type { ActiveTenant } from "./me";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  requestJson,
  type Fetcher
} from "./http";

const forbiddenExportPayloadKeys = new Set([
  "gcsPath",
  "gcs_path",
  "objectKey",
  "object_key",
  "objectPath",
  "object_path",
  "privatePath",
  "private_path",
  "signedUrl",
  "signed_url",
  "sourceFingerprint",
  "source_fingerprint",
  "storageBackend",
  "storage_backend",
  "storageObjectKey",
  "storage_object_key",
  "storagePath",
  "storage_path"
]);

const isoDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)));

const exportPackSchema = z
  .object({
    exportPackId: z.string().uuid(),
    closingFolderId: z.string().uuid(),
    fileName: z.string().min(1).refine(isSafeExportMetadataFileName),
    mediaType: z.literal("application/zip"),
    byteSize: z.number().int().positive(),
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
    basisImportVersion: z.number().int().positive(),
    basisTaxonomyVersion: z.number().int().positive(),
    createdAt: isoDateTimeSchema,
    createdByUserId: z.string().uuid()
  })
  .strict();

const exportPackListSchema = z
  .object({
    items: z.array(exportPackSchema)
  })
  .strict();

export type ExportPack = z.infer<typeof exportPackSchema>;

export type ExportPackListState =
  | { kind: "loading" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" }
  | { kind: "ready"; exportPacks: ExportPack[] };

export type ExportPackReadState =
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" }
  | { kind: "success"; exportPack: ExportPack };

export type CreateExportPackState =
  | { kind: "success"; exportPack: ExportPack; replayed: boolean }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export type DownloadExportPackState =
  | {
      kind: "success";
      blob: Blob;
      contentDisposition: string | null;
      contentType: string | null;
    }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "unexpected" };

export async function loadExportPacksShellState(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<ExportPackListState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/export-packs`,
      {
        method: "GET",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 400) {
      return { kind: "bad_request" };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    if (response.status !== 200) {
      return { kind: "unexpected" };
    }

    const payload = await readJsonBody(response);
    const exportPacks = parseExportPackListPayload(payload, closingFolderId);

    if (exportPacks === null) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      exportPacks
    };
  } catch (error) {
    return mapCaughtError(error);
  }
}

export async function getExportPack(
  closingFolderId: string,
  exportPackId: string,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<ExportPackReadState> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/export-packs/${encodeURIComponent(exportPackId)}`,
      {
        method: "GET",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 400) {
      return { kind: "bad_request" };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    if (response.status !== 200) {
      return { kind: "unexpected" };
    }

    const payload = await readJsonBody(response);
    const exportPack = parseExportPackPayload(payload, closingFolderId, exportPackId);

    if (exportPack === null) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "success",
      exportPack
    };
  } catch (error) {
    return mapCaughtError(error);
  }
}

export async function createExportPack(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  idempotencyKey: string,
  fetcher: Fetcher = fetch
): Promise<CreateExportPackState> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/export-packs`,
      {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 201 || response.status === 200) {
      const payload = await readJsonBody(response);
      const exportPack = parseExportPackPayload(payload, closingFolderId);

      if (exportPack === null) {
        return { kind: "invalid_payload" };
      }

      return {
        kind: "success",
        exportPack,
        replayed: response.status === 200
      };
    }

    if (response.status === 400) {
      return { kind: "bad_request" };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status === 409) {
      return { kind: "conflict_other" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    return { kind: "unexpected" };
  } catch (error) {
    return mapCaughtError(error);
  }
}

export async function downloadExportPackContent(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  exportPackId: string,
  fetcher: Fetcher = fetch
): Promise<DownloadExportPackState> {
  const controller = new AbortController();
  let timeoutId = 0;

  try {
    const response = await Promise.race([
      fetcher(
        `/api/closing-folders/${encodeURIComponent(closingFolderId)}/export-packs/${encodeURIComponent(exportPackId)}/content`,
        {
          method: "GET",
          headers: {
            "X-Tenant-Id": activeTenant.tenantId
          },
          signal: controller.signal
        }
      ),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, DEFAULT_REQUEST_TIMEOUT_MS);
      })
    ]);

    if (response.status === 200) {
      try {
        const blob = await response.blob();

        return {
          kind: "success",
          blob,
          contentDisposition: normalizeOptionalHeaderValue(
            response.headers.get("Content-Disposition")
          ),
          contentType: normalizeOptionalHeaderValue(response.headers.get("Content-Type"))
        };
      } catch {
        return { kind: "unexpected" };
      }
    }

    if (response.status === 400) {
      return { kind: "bad_request" };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    return { kind: "unexpected" };
  } catch (error) {
    return mapCaughtError(error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function generateExportPackIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const randomBytes = new Uint8Array(16);

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let index = 0; index < randomBytes.length; index += 1) {
      randomBytes[index] = Math.floor(Math.random() * 256);
    }
  }

  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;

  const hex = [...randomBytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function resolveExportPackDownloadFileName(
  contentDisposition: string | null,
  fallbackFileName: string | null,
  exportPackId: string
) {
  const parsedFileName =
    parseContentDispositionFilenameStar(contentDisposition) ??
    parseContentDispositionFilename(contentDisposition);
  const safeParsedFileName = sanitizeExportPackFileName(parsedFileName);

  if (safeParsedFileName !== null) {
    return safeParsedFileName;
  }

  const safeFallbackFileName = sanitizeExportPackFileName(fallbackFileName);

  if (safeFallbackFileName !== null) {
    return safeFallbackFileName;
  }

  return `audit-ready-export-pack-${exportPackId}.zip`;
}

export function parseContentDispositionFilenameStar(value: string | null) {
  if (value === null) {
    return null;
  }

  const match = value.match(/filename\*\s*=\s*([^;]+)/i);

  if (match?.[1] === undefined) {
    return null;
  }

  const rawValue = stripWrappedQuotes(match[1].trim());
  const separatorIndex = rawValue.indexOf("''");

  if (separatorIndex < 0) {
    return null;
  }

  const encodedFileName = rawValue.slice(separatorIndex + 2);

  try {
    return decodeURIComponent(encodedFileName);
  } catch {
    return null;
  }
}

export function parseContentDispositionFilename(value: string | null) {
  if (value === null) {
    return null;
  }

  const match = value.match(/filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i);

  if (match?.[1] === undefined) {
    return null;
  }

  return unescapeQuotedString(stripWrappedQuotes(match[1].trim()));
}

export function sanitizeExportPackFileName(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const withoutControlCharacters = stripControlCharacters(value).trim();

  if (withoutControlCharacters.length === 0) {
    return null;
  }

  const leafSegments = withoutControlCharacters.split(/[\\/]+/).filter(Boolean);
  const leaf = (leafSegments[leafSegments.length - 1] ?? withoutControlCharacters)
    .replace(/[<>:"|?*]/g, "-")
    .trim();

  if (leaf.length === 0 || leaf === "." || leaf === "..") {
    return null;
  }

  if (leaf.includes("/") || leaf.includes("\\")) {
    return null;
  }

  return leaf;
}

export function stripWrappedQuotes(value: string) {
  if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) {
    return value.slice(1, -1);
  }

  return value;
}

export function unescapeQuotedString(value: string) {
  return value.replace(/\\(.)/g, "$1");
}

function parseExportPackListPayload(payload: unknown, closingFolderId: string) {
  if (payload === undefined || containsForbiddenExportPayloadLeak(payload)) {
    return null;
  }

  const parsed = exportPackListSchema.safeParse(payload);

  if (!parsed.success) {
    return null;
  }

  if (!parsed.data.items.every((item) => isExportPackCoherent(item, closingFolderId))) {
    return null;
  }

  return parsed.data.items;
}

function parseExportPackPayload(
  payload: unknown,
  closingFolderId: string,
  exportPackId?: string
) {
  if (payload === undefined || containsForbiddenExportPayloadLeak(payload)) {
    return null;
  }

  const parsed = exportPackSchema.safeParse(payload);

  if (!parsed.success || !isExportPackCoherent(parsed.data, closingFolderId)) {
    return null;
  }

  if (exportPackId !== undefined && parsed.data.exportPackId !== exportPackId) {
    return null;
  }

  return parsed.data;
}

function isExportPackCoherent(exportPack: ExportPack, closingFolderId: string) {
  return exportPack.closingFolderId === closingFolderId;
}

function containsForbiddenExportPayloadLeak(value: unknown): boolean {
  if (typeof value === "string") {
    return isLikelyPrivateStoragePath(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenExportPayloadLeak(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, nestedValue]) => {
      if (forbiddenExportPayloadKeys.has(key)) {
        return true;
      }

      return containsForbiddenExportPayloadLeak(nestedValue);
    });
  }

  return false;
}

function isSafeExportMetadataFileName(value: string) {
  const safeFileName = sanitizeExportPackFileName(value);
  return safeFileName !== null && safeFileName === value.trim();
}

function isLikelyPrivateStoragePath(value: string) {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  return (
    lower.startsWith("gs://") ||
    lower.startsWith("s3://") ||
    lower.startsWith("file:") ||
    lower.includes("storage.googleapis.com") ||
    /^[a-z]:[\\/]/i.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\\\")
  );
}

function stripControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join("");
}

function mapCaughtError<T extends { kind: "network_error" } | { kind: "timeout" }>(
  error: unknown
): T {
  if (error instanceof Error && error.message === "timeout") {
    return { kind: "timeout" } as T;
  }

  return { kind: "network_error" } as T;
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function normalizeOptionalHeaderValue(value: string | null) {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
