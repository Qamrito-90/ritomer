import { describe, expect, it, vi } from "vitest";
import {
  createExportPack,
  downloadExportPackContent,
  getExportPack,
  loadExportPacksShellState,
  parseContentDispositionFilename,
  parseContentDispositionFilenameStar,
  resolveExportPackDownloadFileName,
  sanitizeExportPackFileName,
  type ExportPack
} from "./exports";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXPORT_PACK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const IDEMPOTENCY_KEY = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const VALID_EXPORT_PACK: ExportPack = {
  exportPackId: EXPORT_PACK_ID,
  closingFolderId: CLOSING_FOLDER_ID,
  fileName: "audit-ready-pack.zip",
  mediaType: "application/zip",
  byteSize: 512,
  checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  basisImportVersion: 2,
  basisTaxonomyVersion: 1,
  createdAt: "2026-02-01T10:00:00Z",
  createdByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function zipResponse(status = 200, blob: Blob = new Blob(["zip-content"])) {
  return new Response(blob, {
    status,
    headers: {
      "Content-Disposition": "attachment; filename*=UTF-8''audit-ready-pack.zip",
      "Content-Type": "application/zip"
    }
  });
}

function cloneExportPack(overrides: Record<string, unknown> = {}) {
  return {
    ...VALID_EXPORT_PACK,
    ...overrides
  };
}

describe("exports api", () => {
  it("loads GET /export-packs with X-Tenant-Id", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [VALID_EXPORT_PACK]
      })
    );

    await expect(
      loadExportPacksShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "ready",
      exportPacks: [VALID_EXPORT_PACK]
    });

    expect(fetcher).toHaveBeenCalledWith(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Tenant-Id": ACTIVE_TENANT.tenantId
        })
      })
    );
  });

  it.each([
    { status: 400, kind: "bad_request" },
    { status: 401, kind: "auth_required" },
    { status: 403, kind: "forbidden" },
    { status: 404, kind: "not_found" },
    { status: 500, kind: "server_error" },
    { status: 418, kind: "unexpected" }
  ])("maps GET /export-packs HTTP $status to $kind", async ({ status, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    await expect(
      loadExportPacksShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps GET /export-packs timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));

    await expect(
      loadExportPacksShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      loadExportPacksShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "closingFolderId incoherent",
      payload: () => ({
        items: [
          cloneExportPack({
            closingFolderId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
          })
        ]
      })
    },
    {
      label: "mediaType not zip",
      payload: () => ({
        items: [
          cloneExportPack({
            mediaType: "application/pdf"
          })
        ]
      })
    },
    {
      label: "path-like fileName",
      payload: () => ({
        items: [
          cloneExportPack({
            fileName: "gs://private-bucket/audit-ready-pack.zip"
          })
        ]
      })
    }
  ])("returns invalid_payload on GET /export-packs $label", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload()));

    await expect(
      loadExportPacksShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it.each([
    ["storageObjectKey", "private/object.zip"],
    ["storage_object_key", "private/object.zip"],
    ["sourceFingerprint", "fingerprint"],
    ["source_fingerprint", "fingerprint"],
    ["storageBackend", "GCS"],
    ["signedUrl", "https://storage.googleapis.com/private/object.zip"],
    ["signed_url", "https://storage.googleapis.com/private/object.zip"]
  ])("rejects sensitive export payload field %s instead of stripping it", async (field, value) => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        items: [
          {
            ...VALID_EXPORT_PACK,
            [field]: value
          }
        ]
      })
    );

    await expect(
      loadExportPacksShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("calls POST /export-packs with X-Tenant-Id, Idempotency-Key, and no body", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(201, VALID_EXPORT_PACK));

    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, fetcher)
    ).resolves.toEqual({
      kind: "success",
      exportPack: VALID_EXPORT_PACK,
      replayed: false
    });

    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(path).toBe(`/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs`);
    expect(init.method).toBe("POST");
    expect(headers).toEqual(
      expect.objectContaining({
        Accept: "application/json",
        "Idempotency-Key": IDEMPOTENCY_KEY,
        "X-Tenant-Id": ACTIVE_TENANT.tenantId
      })
    );
    expect(headers).not.toHaveProperty("Content-Type");
    expect(init.body).toBeUndefined();
  });

  it("maps POST /export-packs 201 created and 200 replay as success", async () => {
    const createdFetcher = vi.fn().mockResolvedValue(jsonResponse(201, VALID_EXPORT_PACK));
    const replayFetcher = vi.fn().mockResolvedValue(jsonResponse(200, VALID_EXPORT_PACK));

    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, createdFetcher)
    ).resolves.toEqual({
      kind: "success",
      exportPack: VALID_EXPORT_PACK,
      replayed: false
    });
    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, replayFetcher)
    ).resolves.toEqual({
      kind: "success",
      exportPack: VALID_EXPORT_PACK,
      replayed: true
    });
  });

  it.each([
    { status: 400, kind: "bad_request" },
    { status: 401, kind: "auth_required" },
    { status: 403, kind: "forbidden" },
    { status: 404, kind: "not_found" },
    { status: 409, kind: "conflict_other" },
    { status: 500, kind: "server_error" },
    { status: 418, kind: "unexpected" }
  ])("maps POST /export-packs HTTP $status to $kind", async ({ status, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps POST /export-packs timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));

    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it("returns invalid_payload on POST success when closingFolderId or sensitive fields are incoherent", async () => {
    const wrongFolderFetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        201,
        cloneExportPack({
          closingFolderId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
        })
      )
    );
    const sensitiveFetcher = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        ...VALID_EXPORT_PACK,
        storage_object_key: "private/object.zip"
      })
    );

    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, wrongFolderFetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
    await expect(
      createExportPack(CLOSING_FOLDER_ID, ACTIVE_TENANT, IDEMPOTENCY_KEY, sensitiveFetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("loads GET /export-packs/{exportPackId} metadata with tenant scope and coherence checks", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, VALID_EXPORT_PACK));

    await expect(
      getExportPack(CLOSING_FOLDER_ID, EXPORT_PACK_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "success",
      exportPack: VALID_EXPORT_PACK
    });

    expect(fetcher).toHaveBeenCalledWith(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs/${EXPORT_PACK_ID}`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Tenant-Id": ACTIVE_TENANT.tenantId
        })
      })
    );
  });

  it("calls GET /export-packs/{exportPackId}/content with X-Tenant-Id and reads blob only after 200", async () => {
    const blob = new Blob(["zip-content"]);
    const fetcher = vi.fn().mockResolvedValue(zipResponse(200, blob));

    await expect(
      downloadExportPackContent(CLOSING_FOLDER_ID, ACTIVE_TENANT, EXPORT_PACK_ID, fetcher)
    ).resolves.toMatchObject({
      kind: "success",
      contentDisposition: "attachment; filename*=UTF-8''audit-ready-pack.zip",
      contentType: "application/zip"
    });

    expect(fetcher).toHaveBeenCalledWith(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs/${EXPORT_PACK_ID}/content`,
      expect.objectContaining({
        method: "GET",
        headers: {
          "X-Tenant-Id": ACTIVE_TENANT.tenantId
        }
      })
    );
  });

  it.each([
    { status: 400, kind: "bad_request" },
    { status: 401, kind: "auth_required" },
    { status: 403, kind: "forbidden" },
    { status: 404, kind: "not_found" },
    { status: 500, kind: "server_error" },
    { status: 418, kind: "unexpected" }
  ])("maps GET /export-packs/{exportPackId}/content HTTP $status to $kind", async ({ status, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(zipResponse(status));

    await expect(
      downloadExportPackContent(CLOSING_FOLDER_ID, ACTIVE_TENANT, EXPORT_PACK_ID, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps GET /export-packs/{exportPackId}/content timeout, network, and blob failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));
    const blobFailureFetcher = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      blob: vi.fn().mockRejectedValue(new Error("blob failure"))
    } as unknown as Response);

    await expect(
      downloadExportPackContent(CLOSING_FOLDER_ID, ACTIVE_TENANT, EXPORT_PACK_ID, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      downloadExportPackContent(CLOSING_FOLDER_ID, ACTIVE_TENANT, EXPORT_PACK_ID, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
    await expect(
      downloadExportPackContent(
        CLOSING_FOLDER_ID,
        ACTIVE_TENANT,
        EXPORT_PACK_ID,
        blobFailureFetcher
      )
    ).resolves.toEqual({ kind: "unexpected" });
  });

  it("parses Content-Disposition and resolves safe fallback filenames", () => {
    expect(
      parseContentDispositionFilenameStar("attachment; filename*=UTF-8''audit%20pack.zip")
    ).toBe("audit pack.zip");
    expect(parseContentDispositionFilenameStar("attachment; filename*=UTF-8''%E0%A4%A")).toBe(
      null
    );
    expect(parseContentDispositionFilename('attachment; filename="audit \\"pack\\".zip"')).toBe(
      'audit "pack".zip'
    );
    expect(sanitizeExportPackFileName("../private/audit-pack.zip")).toBe("audit-pack.zip");
    expect(sanitizeExportPackFileName("audit\u0000-pack.zip")).toBe("audit-pack.zip");
    expect(sanitizeExportPackFileName("   ")).toBe(null);

    expect(
      resolveExportPackDownloadFileName(
        "attachment; filename*=UTF-8''..%2Fprivate%2Faudit-pack.zip",
        "fallback.zip",
        EXPORT_PACK_ID
      )
    ).toBe("audit-pack.zip");
    expect(resolveExportPackDownloadFileName(null, "../visible.zip", EXPORT_PACK_ID)).toBe(
      "visible.zip"
    );
    expect(resolveExportPackDownloadFileName(null, "   ", EXPORT_PACK_ID)).toBe(
      `audit-ready-export-pack-${EXPORT_PACK_ID}.zip`
    );
  });
});
