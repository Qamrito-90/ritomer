import { describe, expect, it, vi } from "vitest";
import {
  loadMinimalAnnexShellState,
  type MinimalAnnexReadModel
} from "./minimal-annex";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const READY_MINIMAL_ANNEX: MinimalAnnexReadModel = {
  closingFolderId: CLOSING_FOLDER_ID,
  closingFolderStatus: "DRAFT",
  readiness: "READY",
  annexState: "READY",
  presentationType: "MINIMAL_OPERATIONAL_ANNEX",
  isStatutory: false,
  requiresHumanReview: true,
  legalNotice: {
    title: "Annexe minimale operationnelle, non statutaire.",
    notOfficialCoAnnex: "Not a final CO deliverable.",
    noAutomaticValidation: "Aucune decision comptable automatique n'est effectuee.",
    humanReviewRequired: "Revue humaine requise avant tout usage engageant."
  },
  basis: {
    controlsReadiness: "READY",
    latestImportVersion: 3,
    taxonomyVersion: 2,
    structuredStatementState: "PREVIEW_READY",
    structuredPresentationType: "STRUCTURED_PREVIEW",
    exportPack: {
      exportPackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      createdAt: "2026-02-01T10:00:00Z",
      basisImportVersion: 3,
      basisTaxonomyVersion: 2
    }
  },
  blockers: [],
  warnings: [
    {
      code: "LEGACY_MAPPING_FALLBACK_USED",
      message: "Legacy mapping fallback is included as a review warning.",
      source: "FINANCIAL_STATEMENTS_STRUCTURED",
      target: {
        type: "WORKPAPER_ANCHOR",
        code: "BS.ASSET",
        id: null
      }
    }
  ],
  annex: {
    financialStatements: {
      presentationType: "STRUCTURED_PREVIEW",
      latestImportVersion: 3,
      taxonomyVersion: 2,
      balanceSheet: {
        groups: [
          {
            code: "BS.ASSET",
            label: "Asset",
            total: "100",
            breakdowns: [
              {
                code: "BS.ASSET.CURRENT_SECTION",
                label: "Current assets",
                breakdownType: "SECTION",
                total: "100"
              }
            ]
          }
        ],
        totals: {
          totalAssets: "100",
          totalLiabilities: "0",
          totalEquity: "0",
          currentPeriodResult: "100",
          totalLiabilitiesAndEquity: "100"
        }
      },
      incomeStatement: {
        groups: [
          {
            code: "PL.REVENUE",
            label: "Revenue",
            total: "100",
            breakdowns: [
              {
                code: "PL.REVENUE.OPERATING_SECTION",
                label: "Operating revenue",
                breakdownType: "SECTION",
                total: "100"
              }
            ]
          }
        ],
        totals: {
          totalRevenue: "100",
          totalExpenses: "0",
          netResult: "100"
        }
      }
    },
    workpapers: [
      {
        anchorCode: "BS.ASSET.CURRENT_SECTION",
        anchorLabel: "Current assets",
        summaryBucketCode: "BS.ASSET",
        statementKind: "BALANCE_SHEET",
        breakdownType: "SECTION",
        workpaperId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        noteText: "Cash tie-out reviewed.",
        reviewedAt: "2026-01-31T10:00:00Z",
        reviewedByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        documents: [
          {
            documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            fileName: "support.pdf",
            mediaType: "application/pdf",
            byteSize: 128,
            checksumSha256:
              "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            sourceLabel: "ERP",
            documentDate: "2025-12-31",
            verificationStatus: "VERIFIED",
            evidenceRole: "VERIFIED_SUPPORT"
          }
        ]
      }
    ],
    evidenceSummary: {
      currentWorkpaperCount: 1,
      attachedDocumentCount: 1,
      verifiedDocumentCount: 1,
      rejectedDocumentTraceCount: 0,
      staleWorkpaperExcludedCount: 0,
      currentWorkpaperWithoutDocumentCount: 0
    },
    preparationLimits: [
      "Read-model operationnel derive au moment de la requete.",
      "Revue humaine requise avant tout usage engageant."
    ]
  }
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function blockedMinimalAnnex(): MinimalAnnexReadModel {
  return {
    ...READY_MINIMAL_ANNEX,
    readiness: "BLOCKED",
    annexState: "BLOCKED",
    basis: {
      controlsReadiness: "BLOCKED",
      latestImportVersion: null,
      taxonomyVersion: 2,
      structuredStatementState: "NO_DATA",
      structuredPresentationType: "STRUCTURED_PREVIEW",
      exportPack: null
    },
    blockers: [
      {
        code: "CLOSING_NOT_READY",
        message: "Closing controls are not ready.",
        source: "CONTROLS",
        target: null
      },
      {
        code: "EXPORT_PACK_MISSING",
        message: "No audit-ready export pack exists for this closing folder.",
        source: "EXPORT_PACK",
        target: null
      }
    ],
    warnings: [],
    annex: null
  };
}

function cloneReadyMinimalAnnex(overrides: Record<string, unknown> = {}) {
  return {
    ...READY_MINIMAL_ANNEX,
    ...overrides
  };
}

describe("minimal annex api", () => {
  it("calls GET /minimal-annex with X-Tenant-Id and returns READY payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, READY_MINIMAL_ANNEX));

    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "ready",
      minimalAnnex: READY_MINIMAL_ANNEX
    });

    expect(fetcher).toHaveBeenCalledWith(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/minimal-annex`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Tenant-Id": ACTIVE_TENANT.tenantId
        })
      })
    );
  });

  it("encodes closingFolderId before calling the read-only endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(400, {}));

    await expect(
      loadMinimalAnnexShellState("folder id/with spaces", ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "bad_request" });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/closing-folders/folder%20id%2Fwith%20spaces/minimal-annex",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("returns BLOCKED payload without recalculating readiness in the client", async () => {
    const payload = blockedMinimalAnnex();
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload));

    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "ready",
      minimalAnnex: payload
    });
  });

  it.each([
    { status: 400, kind: "bad_request" },
    { status: 401, kind: "auth_required" },
    { status: 403, kind: "forbidden" },
    { status: 404, kind: "not_found" },
    { status: 500, kind: "server_error" },
    { status: 418, kind: "unexpected" }
  ])("maps GET /minimal-annex HTTP $status to $kind", async ({ status, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));

    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "missing payload",
      payload: () => undefined
    },
    {
      label: "unknown top-level field",
      payload: () => cloneReadyMinimalAnnex({ unexpected: "value" })
    },
    {
      label: "closingFolderId mismatch",
      payload: () =>
        cloneReadyMinimalAnnex({
          closingFolderId: "ffffffff-ffff-4fff-8fff-ffffffffffff"
        })
    },
    {
      label: "isStatutory true",
      payload: () => cloneReadyMinimalAnnex({ isStatutory: true })
    },
    {
      label: "requiresHumanReview false",
      payload: () => cloneReadyMinimalAnnex({ requiresHumanReview: false })
    },
    {
      label: "READY with null annex",
      payload: () => cloneReadyMinimalAnnex({ annex: null })
    },
    {
      label: "BLOCKED with annex content",
      payload: () => ({
        ...blockedMinimalAnnex(),
        annex: READY_MINIMAL_ANNEX.annex
      })
    }
  ])("returns invalid_payload for $label", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload()));

    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it.each([
    "storageObjectKey",
    "storage_object_key",
    "signedUrl",
    "signed_url",
    "storageBackend",
    "storage_backend",
    "sourceFingerprint",
    "source_fingerprint",
    "objectPath",
    "object_path",
    "privatePath",
    "private_path"
  ])("fails closed on sensitive field %s", async (field) => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...READY_MINIMAL_ANNEX,
        annex: {
          ...READY_MINIMAL_ANNEX.annex,
          [field]: "private/object"
        }
      })
    );

    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it.each([
    "gs://private-bucket/document.pdf",
    "s3://private-bucket/document.pdf",
    "file:///private/document.pdf",
    "/var/private/document.pdf",
    "C:\\private\\document.pdf",
    "https://storage.googleapis.com/private/document.pdf",
    "https://example.com/object?X-Goog-" + "Signature=abc"
  ])("fails closed on private storage reference %s", async (value) => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...READY_MINIMAL_ANNEX,
        blockers: [
          {
            code: "DOCUMENT_UNVERIFIED",
            message: value,
            source: "DOCUMENTS",
            target: null
          }
        ]
      })
    );

    await expect(
      loadMinimalAnnexShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });
});
