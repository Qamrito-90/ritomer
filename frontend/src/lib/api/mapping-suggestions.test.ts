import { describe, expect, it, vi } from "vitest";
import {
  loadMappingSuggestionsShellState,
  type MappingSuggestionsReadModel
} from "./mapping-suggestions";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const READY_MAPPING_SUGGESTIONS: MappingSuggestionsReadModel = {
  state: "READY",
  closingFolderId: CLOSING_FOLDER_ID,
  latestImportVersion: 3,
  taxonomyVersion: 2,
  suggestions: [
    {
      accountCode: "1000",
      accountLabel: "Bank CHF",
      suggestedTargetCode: "BS.ASSET.CASH_AND_EQUIVALENTS",
      confidence: 0.82,
      riskLevel: "MEDIUM",
      rationale: "Account label and target taxonomy are consistent with cash.",
      evidence: [
        {
          type: "ACCOUNT_LABEL",
          ref: "balance_import_line:1000",
          snippet: "Bank CHF"
        },
        {
          type: "TARGET_TAXONOMY",
          ref: "manual-mapping-targets-v2:BS.ASSET.CASH_AND_EQUIVALENTS",
          snippet: "Cash and cash equivalents"
        }
      ],
      requiresHumanReview: true,
      schemaVersion: "mapping-suggestion-v1",
      promptVersion: "not_applicable_for_stub",
      modelVersion: "not_applicable_for_stub",
      suggestionFingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ],
  errors: []
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function cloneReadyMappingSuggestions(overrides: Record<string, unknown> = {}) {
  return {
    ...READY_MAPPING_SUGGESTIONS,
    ...overrides
  };
}

function cloneReadySuggestion(overrides: Record<string, unknown> = {}) {
  return {
    ...READY_MAPPING_SUGGESTIONS.suggestions[0],
    ...overrides
  };
}

describe("mapping suggestions api", () => {
  it("calls the exact read-only endpoint with Accept and X-Tenant-Id", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, READY_MAPPING_SUGGESTIONS));

    await expect(
      loadMappingSuggestionsShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "ready",
      readModel: READY_MAPPING_SUGGESTIONS
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/mappings/suggestions`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Tenant-Id": ACTIVE_TENANT.tenantId
        })
      })
    );

    const init = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
  });

  it("encodes closingFolderId before calling the read-only endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(400, {}));

    await expect(
      loadMappingSuggestionsShellState("folder id/with spaces", ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "bad_request" });

    expect(fetcher.mock.calls[0]?.[0]).toBe(
      "/api/closing-folders/folder%20id%2Fwith%20spaces/mappings/suggestions"
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
      loadMappingSuggestionsShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));

    await expect(
      loadMappingSuggestionsShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      loadMappingSuggestionsShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "unknown top-level field",
      payload: () => cloneReadyMappingSuggestions({ unexpected: "value" })
    },
    {
      label: "closingFolderId mismatch",
      payload: () =>
        cloneReadyMappingSuggestions({
          closingFolderId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        })
    },
    {
      label: "requiresHumanReview false",
      payload: () =>
        cloneReadyMappingSuggestions({
          suggestions: [cloneReadySuggestion({ requiresHumanReview: false })]
        })
    },
    {
      label: "empty evidence",
      payload: () =>
        cloneReadyMappingSuggestions({
          suggestions: [cloneReadySuggestion({ evidence: [] })]
        })
    },
    {
      label: "confidence below lower bound",
      payload: () =>
        cloneReadyMappingSuggestions({
          suggestions: [cloneReadySuggestion({ confidence: -0.01 })]
        })
    },
    {
      label: "confidence above upper bound",
      payload: () =>
        cloneReadyMappingSuggestions({
          suggestions: [cloneReadySuggestion({ confidence: 1.01 })]
        })
    },
    {
      label: "unknown state",
      payload: () => cloneReadyMappingSuggestions({ state: "UNKNOWN" })
    },
    {
      label: "malformed suggestion fingerprint",
      payload: () =>
        cloneReadyMappingSuggestions({
          suggestions: [cloneReadySuggestion({ suggestionFingerprint: "not-a-fingerprint" })]
        })
    }
  ])("returns invalid_payload for $label", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload()));

    await expect(
      loadMappingSuggestionsShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("accepts every documented degraded read-model state", async () => {
    const states = [
      "DISABLED",
      "NO_IMPORT",
      "PARTIAL",
      "ARCHIVED_READ_ONLY",
      "UNAVAILABLE",
      "TIMEOUT",
      "INVALID_MODEL_OUTPUT",
      "INSUFFICIENT_EVIDENCE"
    ] as const;

    for (const state of states) {
      const payload = cloneReadyMappingSuggestions({
        state,
        latestImportVersion: state === "NO_IMPORT" ? null : 3,
        suggestions: state === "PARTIAL" || state === "ARCHIVED_READ_ONLY" ? READY_MAPPING_SUGGESTIONS.suggestions : [],
        errors: [
          {
            code:
              state === "NO_IMPORT"
                ? "NO_LATEST_IMPORT"
                : state === "PARTIAL"
                  ? "PARTIAL_SUGGESTIONS"
                  : state === "ARCHIVED_READ_ONLY"
                    ? "ARCHIVED_READ_ONLY"
                    : state === "DISABLED"
                      ? "AI_MAPPING_SUGGESTIONS_DISABLED"
                      : state === "TIMEOUT"
                        ? "AI_MAPPING_TIMEOUT"
                        : state === "UNAVAILABLE"
                          ? "AI_MAPPING_UNAVAILABLE"
                          : state,
            message: `${state} state`
          }
        ]
      });
      const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload));

      await expect(
        loadMappingSuggestionsShellState(CLOSING_FOLDER_ID, ACTIVE_TENANT, fetcher)
      ).resolves.toEqual({
        kind: "ready",
        readModel: payload
      });
    }
  });
});
