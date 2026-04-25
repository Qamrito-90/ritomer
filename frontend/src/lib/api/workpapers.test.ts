import { describe, expect, it, vi } from "vitest";
import {
  downloadWorkpaperDocument,
  loadWorkpapersShellState,
  reviewDocumentVerificationDecision,
  uploadWorkpaperDocument,
  upsertWorkpaper,
  type ClosingWorkpapersReadModel,
  type WorkpaperEvidence
} from "./workpapers";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tenantId: ACTIVE_TENANT.tenantId,
  name: "Closing FY26",
  periodStartOn: "2026-01-01",
  periodEndOn: "2026-12-31",
  externalRef: "EXT-26",
  status: "DRAFT"
};

const VALID_EVIDENCE: WorkpaperEvidence = {
  position: 1,
  fileName: "bank.csv",
  mediaType: "text/csv",
  documentDate: "2026-01-31",
  sourceLabel: "Bank portal",
  verificationStatus: "UNVERIFIED",
  externalReference: null,
  checksumSha256: null
};

const VALID_WORKPAPERS: ClosingWorkpapersReadModel = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "READY",
  summaryCounts: {
    totalCurrentAnchors: 2,
    withWorkpaperCount: 1,
    readyForReviewCount: 1,
    reviewedCount: 0,
    staleCount: 1,
    missingCount: 1
  },
  items: [
    {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      anchorLabel: "Current assets",
      statementKind: "BALANCE_SHEET",
      breakdownType: "SECTION",
      isCurrentStructure: true,
      workpaper: {
        status: "READY_FOR_REVIEW",
        noteText: "Cash tie-out",
        evidences: [VALID_EVIDENCE]
      },
      documents: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          fileName: "bank.csv",
          mediaType: "text/csv",
          sourceLabel: "Bank portal",
          verificationStatus: "UNVERIFIED",
          reviewComment: null
        }
      ],
      documentVerificationSummary: {
        documentsCount: 1,
        unverifiedCount: 1,
        verifiedCount: 0,
        rejectedCount: 0
      }
    },
    {
      anchorCode: "PL.REVENUE.CURRENT_SECTION",
      anchorLabel: "Revenue",
      statementKind: "INCOME_STATEMENT",
      breakdownType: "LEGACY_BUCKET_FALLBACK",
      isCurrentStructure: true,
      workpaper: null,
      documents: [],
      documentVerificationSummary: null
    }
  ],
  staleWorkpapers: [
    {
      anchorCode: "BS.ASSET.LEGACY_BUCKET_FALLBACK",
      anchorLabel: "Legacy bucket",
      statementKind: "BALANCE_SHEET",
      breakdownType: "LEGACY_BUCKET_FALLBACK",
      isCurrentStructure: false,
      workpaper: {
        status: "REVIEWED",
        noteText: "Legacy support",
        evidences: [VALID_EVIDENCE]
      },
      documents: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          fileName: "legacy.pdf",
          mediaType: "application/pdf",
          sourceLabel: "ERP",
          verificationStatus: "VERIFIED",
          reviewComment: null
        },
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3",
          fileName: "rejected.png",
          mediaType: "image/png",
          sourceLabel: "Scan",
          verificationStatus: "REJECTED",
          reviewComment: "Rejected support"
        }
      ],
      documentVerificationSummary: {
        documentsCount: 2,
        unverifiedCount: 0,
        verifiedCount: 1,
        rejectedCount: 1
      }
    }
  ]
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createUploadFile(
  fileName = "support.pdf",
  type = "application/pdf",
  contents = "pdf-content"
) {
  return new File([contents], fileName, { type });
}

function createDocumentUploadSuccessPayload(
  request: {
    file: File;
    sourceLabel: string;
    documentDate: string | null;
  },
  overrides: Record<string, unknown> = {}
) {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    fileName: request.file.name,
    mediaType: request.file.type,
    byteSize: request.file.size,
    checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    sourceLabel: request.sourceLabel,
    documentDate: request.documentDate,
    createdAt: "2026-02-01T10:00:00Z",
    createdByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    verificationStatus: "UNVERIFIED",
    reviewComment: null,
    reviewedAt: null,
    reviewedByUserId: null,
    ...overrides
  };
}

function createDocumentVerificationSuccessPayload({
  documentId,
  decision,
  reviewComment
}: {
  documentId: string;
  decision: "VERIFIED" | "REJECTED";
  reviewComment: string | null;
}) {
  return {
    id: documentId,
    fileName: "ignored.pdf",
    mediaType: "application/pdf",
    byteSize: 42,
    checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    sourceLabel: "ERP",
    documentDate: null,
    createdAt: "2026-02-01T10:00:00Z",
    createdByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    verificationStatus: decision,
    reviewComment,
    reviewedAt: "2026-02-02T10:00:00Z",
    reviewedByUserId: "ffffffff-ffff-4fff-8fff-ffffffffffff"
  };
}

describe("workpapers api", () => {
  it("loads the exact /workpapers path with X-Tenant-Id, returns ready, and ignores malformed non-consumed fields", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...VALID_WORKPAPERS,
        nextAction: {
          code: 42,
          path: { unexpected: true },
          actionable: "nope"
        },
        blockers: "ignored"
      })
    );

    const state = await loadWorkpapersShellState(
      CLOSING_FOLDER.id,
      CLOSING_FOLDER,
      ACTIVE_TENANT,
      fetcher
    );

    expect(state.kind).toBe("ready");
    expect(fetcher).toHaveBeenCalledWith(
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
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
  ])("maps GET HTTP $status to $kind", async ({ status, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    await expect(
      loadWorkpapersShellState(CLOSING_FOLDER.id, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps GET timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));

    await expect(
      loadWorkpapersShellState(CLOSING_FOLDER.id, CLOSING_FOLDER, ACTIVE_TENANT, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      loadWorkpapersShellState(CLOSING_FOLDER.id, CLOSING_FOLDER, ACTIVE_TENANT, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "closingFolderId incoherent",
      payload: () => ({
        ...cloneValue(VALID_WORKPAPERS),
        closingFolderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
      })
    },
    {
      label: "closingFolderStatus missing",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS) as {
          closingFolderStatus?: string;
        };
        delete payload.closingFolderStatus;
        return payload;
      }
    },
    {
      label: "readiness missing",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS) as {
          readiness?: string;
        };
        delete payload.readiness;
        return payload;
      }
    },
    {
      label: "summaryCounts.totalCurrentAnchors != items.length",
      payload: () => ({
        ...cloneValue(VALID_WORKPAPERS),
        summaryCounts: {
          ...VALID_WORKPAPERS.summaryCounts,
          totalCurrentAnchors: 9
        }
      })
    },
    {
      label: "summaryCounts.withWorkpaperCount != current count",
      payload: () => ({
        ...cloneValue(VALID_WORKPAPERS),
        summaryCounts: {
          ...VALID_WORKPAPERS.summaryCounts,
          withWorkpaperCount: 0
        }
      })
    },
    {
      label: "summaryCounts.missingCount != current missing count",
      payload: () => ({
        ...cloneValue(VALID_WORKPAPERS),
        summaryCounts: {
          ...VALID_WORKPAPERS.summaryCounts,
          missingCount: 0
        }
      })
    },
    {
      label: "summaryCounts.staleCount != staleWorkpapers.length",
      payload: () => ({
        ...cloneValue(VALID_WORKPAPERS),
        summaryCounts: {
          ...VALID_WORKPAPERS.summaryCounts,
          staleCount: 0
        }
      })
    },
    {
      label: "current item with isCurrentStructure false",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        payload.items[0].isCurrentStructure = false;
        return payload;
      }
    },
    {
      label: "stale item with isCurrentStructure true",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        payload.staleWorkpapers[0].isCurrentStructure = true;
        return payload;
      }
    },
    {
      label: "workpaper object without status",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.items[0].workpaper as { status?: string }).status;
        return payload;
      }
    },
    {
      label: "workpaper object without noteText",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.items[0].workpaper as { noteText?: string }).noteText;
        return payload;
      }
    },
    {
      label: "workpaper object without evidences",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.items[0].workpaper as { evidences?: unknown }).evidences;
        return payload;
      }
    },
    {
      label: "evidence without externalReference",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.items[0].workpaper as { evidences: Array<{ externalReference?: string | null }> }).evidences[0].externalReference;
        return payload;
      }
    },
    {
      label: "current item without documents[]",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.items[0] as { documents?: unknown }).documents;
        return payload;
      }
    },
    {
      label: "stale item without documents[]",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.staleWorkpapers[0] as { documents?: unknown }).documents;
        return payload;
      }
    },
    {
      label: "current item without documentVerificationSummary",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.items[0] as { documentVerificationSummary?: unknown })
          .documentVerificationSummary;
        return payload;
      }
    },
    {
      label: "stale item without documentVerificationSummary",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        delete (payload.staleWorkpapers[0] as { documentVerificationSummary?: unknown })
          .documentVerificationSummary;
        return payload;
      }
    },
    {
      label: "workpaper null with documents[] non empty",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        payload.items[1].documents = [
          {
            fileName: "unexpected.pdf",
            mediaType: "application/pdf",
            sourceLabel: "ERP",
            verificationStatus: "VERIFIED",
            reviewComment: null
          }
        ];
        return payload;
      }
    },
    {
      label: "current item with workpaper != null and documentVerificationSummary null",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        payload.items[0].documentVerificationSummary = null;
        return payload;
      }
    },
    {
      label: "stale item with workpaper null",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        (
          payload.staleWorkpapers[0] as {
            workpaper: { status: string; noteText: string; evidences: unknown[] } | null;
          }
        ).workpaper = null;
        return payload;
      }
    },
    {
      label: "stale item with documentVerificationSummary null",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        (
          payload.staleWorkpapers[0] as {
            documentVerificationSummary: {
              documentsCount: number;
              unverifiedCount: number;
              verifiedCount: number;
              rejectedCount: number;
            } | null;
          }
        ).documentVerificationSummary = null;
        return payload;
      }
    },
    {
      label: "documentVerificationSummary inconsistent sum",
      payload: () => {
        const payload = cloneValue(VALID_WORKPAPERS);
        (
          payload.items[0].documentVerificationSummary as {
            documentsCount: number;
          }
        ).documentsCount = 2;
        return payload;
      }
    }
  ])("returns invalid_payload on GET $label", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload()));

    await expect(
      loadWorkpapersShellState(CLOSING_FOLDER.id, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("returns invalid_payload on unreadable GET 200 bodies", async () => {
    const invalidJsonFetcher = vi.fn().mockResolvedValue(
      new Response("{", {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const plainTextFetcher = vi.fn().mockResolvedValue(
      new Response("not-json", {
        status: 200,
        headers: {
          "Content-Type": "text/plain"
        }
      })
    );

    await expect(
      loadWorkpapersShellState(
        CLOSING_FOLDER.id,
        CLOSING_FOLDER,
        ACTIVE_TENANT,
        invalidJsonFetcher
      )
    ).resolves.toEqual({ kind: "invalid_payload" });
    await expect(
      loadWorkpapersShellState(CLOSING_FOLDER.id, CLOSING_FOLDER, ACTIVE_TENANT, plainTextFetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("calls the exact PUT path with the exact headers and body and never sends evidences.id", async () => {
    const request = {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      noteText: "Cash tie-out",
      status: "READY_FOR_REVIEW" as const,
      evidences: [
        {
          position: 2,
          fileName: "support.pdf",
          mediaType: "application/pdf",
          documentDate: "2026-02-15",
          sourceLabel: "ERP",
          verificationStatus: "VERIFIED" as const,
          externalReference: "erp://support-1",
          checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
        }
      ]
    };
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        anchorCode: request.anchorCode,
        isCurrentStructure: true,
        workpaper: {
          status: request.status,
          noteText: request.noteText,
          evidences: request.evidences,
          id: "ignored-by-frontend"
        }
      })
    );

    await expect(
      upsertWorkpaper(CLOSING_FOLDER.id, ACTIVE_TENANT, request, fetcher)
    ).resolves.toEqual({ kind: "success" });

    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      noteText: string;
      status: string;
      evidences: Array<Record<string, unknown>>;
    };

    expect(path).toBe(
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers/${request.anchorCode}`
    );
    expect(init.method).toBe("PUT");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Tenant-Id": ACTIVE_TENANT.tenantId
      })
    );
    expect(Object.keys(body)).toEqual(["noteText", "status", "evidences"]);
    expect(body).toEqual({
      noteText: request.noteText,
      status: request.status,
      evidences: request.evidences
    });
    expect(body.evidences).toHaveLength(1);
    expect(Object.keys(body.evidences[0] ?? {})).toEqual([
      "position",
      "fileName",
      "mediaType",
      "documentDate",
      "sourceLabel",
      "verificationStatus",
      "externalReference",
      "checksumSha256"
    ]);
    expect(body.evidences[0]).not.toHaveProperty("id");
  });

  it.each([
    { status: 400, response: () => jsonResponse(400, {}), kind: "bad_request" },
    { status: 401, response: () => jsonResponse(401, {}), kind: "auth_required" },
    { status: 403, response: () => jsonResponse(403, {}), kind: "forbidden" },
    { status: 404, response: () => jsonResponse(404, {}), kind: "not_found" },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "Closing folder is archived and workpapers cannot be modified."
        }),
      kind: "conflict_archived"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "Workpapers can only be modified when controls.readiness is READY."
        }),
      kind: "conflict_not_ready"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "anchorCode is not part of the current structure."
        }),
      kind: "conflict_other"
    },
    { status: 500, response: () => jsonResponse(500, {}), kind: "server_error" },
    { status: 418, response: () => jsonResponse(418, {}), kind: "unexpected" }
  ])("maps PUT HTTP $status to $kind", async ({ response, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(response());

    await expect(
      upsertWorkpaper(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          anchorCode: "BS.ASSET.CURRENT_SECTION",
          noteText: "Cash tie-out",
          status: "DRAFT",
          evidences: []
        },
        fetcher
      )
    ).resolves.toEqual({ kind });
  });

  it("maps PUT timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));
    const request = {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      noteText: "Cash tie-out",
      status: "DRAFT" as const,
      evidences: []
    };

    await expect(
      upsertWorkpaper(CLOSING_FOLDER.id, ACTIVE_TENANT, request, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      upsertWorkpaper(CLOSING_FOLDER.id, ACTIVE_TENANT, request, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "anchorCode mismatch",
      payload: {
        anchorCode: "PL.REVENUE.CURRENT_SECTION",
        isCurrentStructure: true,
        workpaper: {
          status: "READY_FOR_REVIEW",
          noteText: "Cash tie-out",
          evidences: [VALID_EVIDENCE]
        }
      }
    },
    {
      label: "isCurrentStructure false",
      payload: {
        anchorCode: "BS.ASSET.CURRENT_SECTION",
        isCurrentStructure: false,
        workpaper: {
          status: "READY_FOR_REVIEW",
          noteText: "Cash tie-out",
          evidences: [VALID_EVIDENCE]
        }
      }
    },
    {
      label: "workpaper missing",
      payload: {
        anchorCode: "BS.ASSET.CURRENT_SECTION",
        isCurrentStructure: true,
        workpaper: null
      }
    },
    {
      label: "status mismatch",
      payload: {
        anchorCode: "BS.ASSET.CURRENT_SECTION",
        isCurrentStructure: true,
        workpaper: {
          status: "DRAFT",
          noteText: "Cash tie-out",
          evidences: [VALID_EVIDENCE]
        }
      }
    },
    {
      label: "noteText mismatch",
      payload: {
        anchorCode: "BS.ASSET.CURRENT_SECTION",
        isCurrentStructure: true,
        workpaper: {
          status: "READY_FOR_REVIEW",
          noteText: "Changed note",
          evidences: [VALID_EVIDENCE]
        }
      }
    },
    {
      label: "evidences mismatch",
      payload: {
        anchorCode: "BS.ASSET.CURRENT_SECTION",
        isCurrentStructure: true,
        workpaper: {
          status: "READY_FOR_REVIEW",
          noteText: "Cash tie-out",
          evidences: [
            {
              ...VALID_EVIDENCE,
              fileName: "changed.csv"
            }
          ]
        }
      }
    }
  ])("returns invalid_payload on PUT success payload $label", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload));

    await expect(
      upsertWorkpaper(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          anchorCode: "BS.ASSET.CURRENT_SECTION",
          noteText: "Cash tie-out",
          status: "READY_FOR_REVIEW",
          evidences: [VALID_EVIDENCE]
        },
        fetcher
      )
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("calls the exact POST /documents path with Accept and X-Tenant-Id, never sends Content-Type manually, and appends FormData in the exact order with date", async () => {
    const request = {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      file: createUploadFile(),
      sourceLabel: "ERP",
      documentDate: "2026-02-15"
    };
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(201, createDocumentUploadSuccessPayload(request))
    );

    await expect(
      uploadWorkpaperDocument(CLOSING_FOLDER.id, ACTIVE_TENANT, request, fetcher)
    ).resolves.toEqual({ kind: "success" });

    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const formData = init.body as FormData;
    const entries = Array.from(formData.entries());

    expect(path).toBe(
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers/${request.anchorCode}/documents`
    );
    expect(init.method).toBe("POST");
    expect(headers).toEqual(
      expect.objectContaining({
        Accept: "application/json",
        "X-Tenant-Id": ACTIVE_TENANT.tenantId
      })
    );
    expect(headers["Content-Type"]).toBeUndefined();
    expect(formData).toBeInstanceOf(FormData);
    expect(entries).toHaveLength(3);
    expect(entries.map(([key]) => key)).toEqual(["file", "sourceLabel", "documentDate"]);
    expect(entries[0]?.[1]).toBe(request.file);
    expect(entries[1]?.[1]).toBe(request.sourceLabel);
    expect(entries[2]?.[1]).toBe(request.documentDate);
  });

  it("omits documentDate from FormData when it is absent and still uses the exact request scope", async () => {
    const request = {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      file: createUploadFile("support.csv", "text/csv", "a,b"),
      sourceLabel: "Bank portal",
      documentDate: null
    };
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(201, createDocumentUploadSuccessPayload(request, { mediaType: "text/csv" }))
    );

    await expect(
      uploadWorkpaperDocument(CLOSING_FOLDER.id, ACTIVE_TENANT, request, fetcher)
    ).resolves.toEqual({ kind: "success" });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const entries = Array.from((init.body as FormData).entries());

    expect(entries).toHaveLength(2);
    expect(entries.map(([key]) => key)).toEqual(["file", "sourceLabel"]);
    expect(entries.some(([key]) => key === "documentDate")).toBe(false);
  });

  it("calls the exact GET /documents/{documentId}/content path with X-Tenant-Id only, follows the 5000 ms timeout convention, and reads response.blob() without response.json()", async () => {
    const blob = new Blob(["pdf-content"]);
    const blobSpy = vi.fn().mockResolvedValue(blob);
    const jsonSpy = vi.fn();
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers({
        "Content-Disposition": 'attachment; filename="support.pdf"',
        "Content-Type": "application/pdf"
      }),
      blob: blobSpy,
      json: jsonSpy
    } as unknown as Response);

    await expect(
      downloadWorkpaperDocument(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
        },
        fetcher
      )
    ).resolves.toEqual({
      kind: "success",
      blob,
      contentDisposition: 'attachment; filename="support.pdf"',
      contentType: "application/pdf"
    });

    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;

    expect(path).toBe(
      `/api/closing-folders/${CLOSING_FOLDER.id}/documents/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1/content`
    );
    expect(init.method).toBe("GET");
    expect(headers).toEqual({
      "X-Tenant-Id": ACTIVE_TENANT.tenantId
    });
    expect(headers.Accept).toBeUndefined();
    expect(headers["Content-Type"]).toBeUndefined();
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(blobSpy).toHaveBeenCalledTimes(1);
    expect(jsonSpy).not.toHaveBeenCalled();
  });

  it.each([
    { status: 400, response: () => jsonResponse(400, {}), kind: "unexpected" },
    { status: 401, response: () => jsonResponse(401, {}), kind: "auth_required" },
    { status: 403, response: () => jsonResponse(403, {}), kind: "forbidden" },
    { status: 404, response: () => jsonResponse(404, {}), kind: "not_found" },
    { status: 500, response: () => jsonResponse(500, {}), kind: "server_error" },
    { status: 418, response: () => jsonResponse(418, {}), kind: "unexpected" }
  ])("maps GET /documents/{documentId}/content HTTP $status to $kind", async ({ response, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(response());

    await expect(
      downloadWorkpaperDocument(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
        },
        fetcher
      )
    ).resolves.toEqual({ kind });
  });

  it("maps GET /documents/{documentId}/content timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));
    const request = {
      documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
    };

    await expect(
      downloadWorkpaperDocument(CLOSING_FOLDER.id, ACTIVE_TENANT, request, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      downloadWorkpaperDocument(CLOSING_FOLDER.id, ACTIVE_TENANT, request, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it("returns unexpected when GET /documents/{documentId}/content succeeds with 200 but response.blob() fails", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      headers: new Headers(),
      blob: vi.fn().mockRejectedValue(new Error("blob failure"))
    } as unknown as Response);

    await expect(
      downloadWorkpaperDocument(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1"
        },
        fetcher
      )
    ).resolves.toEqual({ kind: "unexpected" });
  });

  it("calls the exact POST /documents/{documentId}/verification-decision path with the VERIFIED body and JSON headers", async () => {
    const documentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        createDocumentVerificationSuccessPayload({
          documentId,
          decision: "VERIFIED",
          reviewComment: null
        })
      )
    );

    await expect(
      reviewDocumentVerificationDecision(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          documentId,
          decision: "VERIFIED"
        },
        fetcher
      )
    ).resolves.toEqual({ kind: "success" });

    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(path).toBe(
      `/api/closing-folders/${CLOSING_FOLDER.id}/documents/${documentId}/verification-decision`
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual(
      expect.objectContaining({
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Tenant-Id": ACTIVE_TENANT.tenantId
      })
    );
    expect(Object.keys(body)).toEqual(["decision"]);
    expect(body).toEqual({ decision: "VERIFIED" });
  });

  it("calls the exact POST /documents/{documentId}/verification-decision path with the trimmed REJECTED body only", async () => {
    const documentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(
        200,
        createDocumentVerificationSuccessPayload({
          documentId,
          decision: "REJECTED",
          reviewComment: "Piece illisible"
        })
      )
    );

    await expect(
      reviewDocumentVerificationDecision(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          documentId,
          decision: "REJECTED",
          comment: "  Piece illisible  "
        },
        fetcher
      )
    ).resolves.toEqual({ kind: "success" });

    const [, init] = fetcher.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;

    expect(Object.keys(body)).toEqual(["decision", "comment"]);
    expect(body).toEqual({
      decision: "REJECTED",
      comment: "Piece illisible"
    });
    expect(body).not.toHaveProperty("documentId");
    expect(body).not.toHaveProperty("anchorCode");
    expect(body).not.toHaveProperty("workpaperId");
    expect(body).not.toHaveProperty("reviewComment");
  });

  it.each([
    { status: 400, response: () => jsonResponse(400, {}), kind: "bad_request" },
    { status: 401, response: () => jsonResponse(401, {}), kind: "auth_required" },
    { status: 403, response: () => jsonResponse(403, {}), kind: "forbidden" },
    { status: 404, response: () => jsonResponse(404, {}), kind: "not_found" },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "Closing folder is archived and documents cannot be modified."
        }),
      kind: "conflict_archived"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "Documents can only be modified when controls.readiness is READY."
        }),
      kind: "conflict_not_ready"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "document belongs to a stale workpaper."
        }),
      kind: "conflict_stale"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "document verification requires a workpaper in READY_FOR_REVIEW."
        }),
      kind: "conflict_workpaper_status"
    },
    {
      status: 409,
      response: () => jsonResponse(409, { message: "other conflict" }),
      kind: "conflict_other"
    },
    { status: 500, response: () => jsonResponse(500, {}), kind: "server_error" },
    { status: 418, response: () => jsonResponse(418, {}), kind: "unexpected" }
  ])("maps POST /verification-decision HTTP $status to $kind", async ({ response, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(response());

    await expect(
      reviewDocumentVerificationDecision(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          decision: "VERIFIED"
        },
        fetcher
      )
    ).resolves.toEqual({ kind });
  });

  it("maps POST /verification-decision timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));
    const request = {
      documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
      decision: "VERIFIED" as const
    };

    await expect(
      reviewDocumentVerificationDecision(CLOSING_FOLDER.id, ACTIVE_TENANT, request, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      reviewDocumentVerificationDecision(CLOSING_FOLDER.id, ACTIVE_TENANT, request, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "id mismatch",
      payload: () =>
        createDocumentVerificationSuccessPayload({
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2",
          decision: "VERIFIED",
          reviewComment: null
        })
    },
    {
      label: "decision mismatch",
      payload: () =>
        createDocumentVerificationSuccessPayload({
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          decision: "REJECTED",
          reviewComment: "Rejected"
        })
    },
    {
      label: "verified with comment",
      payload: () =>
        createDocumentVerificationSuccessPayload({
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          decision: "VERIFIED",
          reviewComment: "Unexpected"
        })
    },
    {
      label: "rejected comment mismatch",
      request: {
        documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
        decision: "REJECTED" as const,
        comment: "Expected"
      },
      payload: () =>
        createDocumentVerificationSuccessPayload({
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          decision: "REJECTED",
          reviewComment: "Other"
        })
    }
  ])("returns invalid_payload on POST /verification-decision success payload $label", async ({ payload, request }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload()));

    await expect(
      reviewDocumentVerificationDecision(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        request ?? {
          documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
          decision: "VERIFIED"
        },
        fetcher
      )
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it.each([
    { status: 200, response: () => jsonResponse(200, {}), kind: "unexpected" },
    { status: 400, response: () => jsonResponse(400, {}), kind: "bad_request" },
    {
      status: 400,
      response: () => jsonResponse(400, { message: "file.mediaType is not allowed." }),
      kind: "bad_request_invalid_media_type"
    },
    {
      status: 400,
      response: () => jsonResponse(400, { message: "file must not be empty." }),
      kind: "bad_request_empty_file"
    },
    {
      status: 400,
      response: () => jsonResponse(400, { message: "sourceLabel must not be blank." }),
      kind: "bad_request_source_required"
    },
    { status: 401, response: () => jsonResponse(401, {}), kind: "auth_required" },
    { status: 403, response: () => jsonResponse(403, {}), kind: "forbidden" },
    { status: 404, response: () => jsonResponse(404, {}), kind: "not_found" },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "Closing folder is archived and documents cannot be modified."
        }),
      kind: "conflict_archived"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "Documents can only be modified when controls.readiness is READY."
        }),
      kind: "conflict_not_ready"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "anchorCode is not part of the current structure."
        }),
      kind: "conflict_stale"
    },
    {
      status: 409,
      response: () =>
        jsonResponse(409, {
          message: "workpaper status does not allow document uploads."
        }),
      kind: "conflict_workpaper_read_only"
    },
    {
      status: 409,
      response: () => jsonResponse(409, { message: "other conflict" }),
      kind: "conflict_other"
    },
    { status: 413, response: () => jsonResponse(413, {}), kind: "payload_too_large" },
    { status: 500, response: () => jsonResponse(500, {}), kind: "server_error" },
    { status: 418, response: () => jsonResponse(418, {}), kind: "unexpected" }
  ])("maps POST /documents HTTP $status to $kind", async ({ response, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(response());

    await expect(
      uploadWorkpaperDocument(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          anchorCode: "BS.ASSET.CURRENT_SECTION",
          file: createUploadFile(),
          sourceLabel: "ERP",
          documentDate: null
        },
        fetcher
      )
    ).resolves.toEqual({ kind });
  });

  it("maps POST /documents timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));
    const request = {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      file: createUploadFile(),
      sourceLabel: "ERP",
      documentDate: null
    };

    await expect(
      uploadWorkpaperDocument(CLOSING_FOLDER.id, ACTIVE_TENANT, request, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      uploadWorkpaperDocument(CLOSING_FOLDER.id, ACTIVE_TENANT, request, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "invalid uuid",
      payload: (request: { file: File; sourceLabel: string; documentDate: string | null }) =>
        createDocumentUploadSuccessPayload(request, { id: "not-a-uuid" })
    },
    {
      label: "mediaType mismatch",
      payload: (request: { file: File; sourceLabel: string; documentDate: string | null }) =>
        createDocumentUploadSuccessPayload(request, { mediaType: "image/png" })
    },
    {
      label: "byteSize mismatch",
      payload: (request: { file: File; sourceLabel: string; documentDate: string | null }) =>
        createDocumentUploadSuccessPayload(request, { byteSize: request.file.size + 1 })
    },
    {
      label: "sourceLabel mismatch",
      payload: (request: { file: File; sourceLabel: string; documentDate: string | null }) =>
        createDocumentUploadSuccessPayload(request, { sourceLabel: "Other source" })
    },
    {
      label: "documentDate mismatch",
      payload: (request: { file: File; sourceLabel: string; documentDate: string | null }) =>
        createDocumentUploadSuccessPayload(request, { documentDate: "2026-03-31" })
    },
    {
      label: "createdAt invalid",
      payload: (request: { file: File; sourceLabel: string; documentDate: string | null }) =>
        createDocumentUploadSuccessPayload(request, { createdAt: "not-a-date-time" })
    }
  ])("returns invalid_payload on POST /documents success payload $label", async ({ payload }) => {
    const request = {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      file: createUploadFile(),
      sourceLabel: "ERP",
      documentDate: "2026-02-15"
    };
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(201, payload(request)));

    await expect(
      uploadWorkpaperDocument(CLOSING_FOLDER.id, ACTIVE_TENANT, request, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });
});
