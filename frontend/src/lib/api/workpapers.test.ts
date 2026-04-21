import { describe, expect, it, vi } from "vitest";
import { loadWorkpapersShellState } from "./workpapers";

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

const VALID_WORKPAPERS = {
  closingFolderId: CLOSING_FOLDER.id,
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
        noteText: "Cash tie-out"
      },
      documents: [
        {
          fileName: "bank.csv",
          mediaType: "text/csv",
          sourceLabel: "Bank portal",
          verificationStatus: "UNVERIFIED"
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
        noteText: "Legacy support"
      },
      documents: [
        {
          fileName: "legacy.pdf",
          mediaType: "application/pdf",
          sourceLabel: "ERP",
          verificationStatus: "VERIFIED"
        },
        {
          fileName: "rejected.png",
          mediaType: "image/png",
          sourceLabel: "Scan",
          verificationStatus: "REJECTED"
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
        readiness: 99,
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
  ])("maps HTTP $status to $kind", async ({ status, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    await expect(
      loadWorkpapersShellState(CLOSING_FOLDER.id, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps timeout and network failures", async () => {
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
            verificationStatus: "VERIFIED"
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
            workpaper: { status: string; noteText: string } | null;
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
  ])("returns invalid_payload on $label", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload()));

    await expect(
      loadWorkpapersShellState(CLOSING_FOLDER.id, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("returns invalid_payload on unreadable 200 bodies", async () => {
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
});
