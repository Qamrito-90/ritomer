import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiMappingSuggestionsPanel } from "./ai-mapping-suggestions-panel";
import type { MappingSuggestionsReadModel } from "../lib/api/mapping-suggestions";

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
      modelVersion: "not_applicable_for_stub"
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

function renderPanel() {
  return render(
    <AiMappingSuggestionsPanel
      activeTenant={ACTIVE_TENANT}
      closingFolderId={CLOSING_FOLDER_ID}
    />
  );
}

function readModelForState(
  state: MappingSuggestionsReadModel["state"],
  overrides: Partial<MappingSuggestionsReadModel> = {}
): MappingSuggestionsReadModel {
  return {
    ...READY_MAPPING_SUGGESTIONS,
    state,
    suggestions:
      state === "READY" || state === "PARTIAL" || state === "ARCHIVED_READ_ONLY"
        ? READY_MAPPING_SUGGESTIONS.suggestions
        : [],
    errors: [],
    ...overrides
  };
}

describe("AiMappingSuggestionsPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows loading and HTTP/network error states", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const loadingRender = renderPanel();
    expect(screen.getByText("loading AI mapping suggestion")).toBeInTheDocument();
    loadingRender.unmount();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(500, {})));
    renderPanel();
    expect(await screen.findByText("AI mapping suggestion unavailable.")).toBeInTheDocument();

    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network")));
    renderPanel();
    expect(await screen.findByText("AI mapping suggestion network error")).toBeInTheDocument();
  });

  it.each([
    ["DISABLED", "AI mapping suggestion disabled."],
    ["NO_IMPORT", "No balance import available for AI mapping suggestion."],
    ["PARTIAL", "Partial AI mapping suggestion coverage."],
    ["ARCHIVED_READ_ONLY", "Archived read-only suggestion."],
    ["UNAVAILABLE", "AI mapping suggestion unavailable."],
    ["TIMEOUT", "AI mapping suggestion timeout."],
    ["INVALID_MODEL_OUTPUT", "AI mapping suggestion output unavailable for review."],
    ["INSUFFICIENT_EVIDENCE", "Insufficient evidence for AI mapping suggestion."]
  ] as const)("renders %s read-model state", async (state, expectedText) => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, readModelForState(state)));

    renderPanel();

    expect(await screen.findByText(expectedText)).toBeInTheDocument();
    expect(screen.getByText(state)).toBeInTheDocument();
    expect(screen.getByText("AI mapping suggestion")).toBeInTheDocument();
    expect(screen.getByText("Prepared for human review. Human review required. Manual mapping remains the authority.")).toBeInTheDocument();
    expect(screen.getByText("Read-only suggestion")).toBeInTheDocument();
  });

  it("renders READY with visible suggestion details and evidence", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS));

    const { container } = renderPanel();

    const card = await screen.findByLabelText("AI mapping suggestion 1000");
    expect(within(card).getByText("accountCode")).toBeInTheDocument();
    expect(within(card).getByText("1000")).toBeInTheDocument();
    expect(within(card).getByText("accountLabel")).toBeInTheDocument();
    expect(within(card).getAllByText("Bank CHF")).toHaveLength(2);
    expect(within(card).getByText("suggestedTargetCode")).toBeInTheDocument();
    expect(within(card).getByText("BS.ASSET.CASH_AND_EQUIVALENTS")).toBeInTheDocument();
    expect(within(card).getByText("82 %")).toBeInTheDocument();
    expect(within(card).getByText("MEDIUM")).toBeInTheDocument();
    expect(within(card).getAllByText("Human review required")).toHaveLength(1);
    expect(
      within(card).getByText("Account label and target taxonomy are consistent with cash.")
    ).toBeInTheDocument();
    expect(within(card).getByText("Evidence")).toBeInTheDocument();
    expect(within(card).getByText("ACCOUNT_LABEL")).toBeInTheDocument();
    expect(within(card).getByText("balance_import_line:1000")).toBeInTheDocument();
    expect(within(card).getByText("TARGET_TAXONOMY")).toBeInTheDocument();
    expect(
      within(card).getByText("manual-mapping-targets-v2:BS.ASSET.CASH_AND_EQUIVALENTS")
    ).toBeInTheDocument();
    expect(within(card).getByText("Cash and cash equivalents")).toBeInTheDocument();
    expect(container).toHaveTextContent("Evidence");
  });

  it("renders READY with no suggestions as an empty read-only state", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, readModelForState("READY", { suggestions: [] }))
    );

    renderPanel();

    expect(await screen.findByText("AI mapping suggestion ready.")).toBeInTheDocument();
    expect(screen.getByText("No AI mapping suggestion prepared.")).toBeInTheDocument();
  });

  it("shows backend read-model messages", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ...readModelForState("PARTIAL"),
        errors: [
          {
            code: "PARTIAL_SUGGESTIONS",
            message: "One account has no sufficient evidence."
          }
        ]
      })
    );

    renderPanel();

    expect(await screen.findByText("Read-model messages")).toBeInTheDocument();
    expect(
      screen.getByText("PARTIAL_SUGGESTIONS: One account has no sufficient evidence.")
    ).toBeInTheDocument();
  });

  it("does not expose decision controls or browser storage writes", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const storageSetItem = vi.spyOn(Storage.prototype, "setItem");
    const storageGetItem = vi.spyOn(Storage.prototype, "getItem");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS));

    const { container } = renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("/mappings/suggestions/");
    expect(container).not.toHaveTextContent("Auto-" + "appl" + "y");
    expect(container).not.toHaveTextContent("AI-" + "approved");
    expect(storageSetItem).not.toHaveBeenCalled();
    expect(storageGetItem).not.toHaveBeenCalled();
  });
});
