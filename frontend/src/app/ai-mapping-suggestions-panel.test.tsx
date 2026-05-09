import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
      modelVersion: "not_applicable_for_stub",
      suggestionFingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ],
  errors: []
};

const REFRESHED_MAPPING_SUGGESTIONS: MappingSuggestionsReadModel = {
  ...READY_MAPPING_SUGGESTIONS,
  suggestions: []
};

const SELECTABLE_TARGETS = [
  {
    code: "BS.ASSET.CASH_AND_EQUIVALENTS",
    label: "Cash and cash equivalents",
    selectable: true
  },
  {
    code: "BS.ASSET.TRADE_RECEIVABLES",
    label: "Trade receivables",
    selectable: true
  },
  {
    code: "BS.ASSET.CURRENT_SECTION",
    label: "Current assets",
    selectable: false
  }
];

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function renderPanel({
  onManualMappingMutationConfirmed
}: {
  onManualMappingMutationConfirmed?: () => Promise<void> | void;
} = {}) {
  return render(
    <AiMappingSuggestionsPanel
      activeTenant={ACTIVE_TENANT}
      closingFolderId={CLOSING_FOLDER_ID}
      selectableTargets={SELECTABLE_TARGETS}
      onManualMappingMutationConfirmed={onManualMappingMutationConfirmed}
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

function stubRandomUUID(...values: string[]) {
  const randomUUID = vi.fn();

  values.forEach((value) => {
    randomUUID.mockReturnValueOnce(value);
  });
  vi.stubGlobal("crypto", {
    ...globalThis.crypto,
    randomUUID
  });

  return randomUUID;
}

function getSuggestionCard() {
  return screen.getByLabelText("AI mapping suggestion 1000");
}

function getAcceptButton() {
  return within(getSuggestionCard()).getByRole("button", { name: "Accept suggestion" });
}

function getCorrectButton() {
  return within(getSuggestionCard()).getByRole("button", {
    name: "Correct with another target"
  });
}

function getRejectButton() {
  return within(getSuggestionCard()).getByRole("button", { name: "Reject suggestion" });
}

function getCorrectionSelect() {
  return within(getSuggestionCard()).getByLabelText(
    "Correct with another target"
  ) as HTMLSelectElement;
}

function getReviewComment() {
  return within(getSuggestionCard()).getByLabelText(
    "Human decision reviewComment"
  ) as HTMLTextAreaElement;
}

function getRequestHeaders(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return ((fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<
    string,
    string
  >;
}

function getRequestBody(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return JSON.parse(String((fetchMock.mock.calls[index]?.[1] as RequestInit).body));
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
    expect(screen.getAllByText("Human review required. Manual mapping remains the authority.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Human decision").length).toBeGreaterThan(0);
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

    const evidenceHeading = within(card).getByText("Evidence");
    const acceptButton = within(card).getByRole("button", { name: "Accept suggestion" });
    expect(Boolean(evidenceHeading.compareDocumentPosition(acceptButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
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

  it("exposes only unit human decision controls and does not write browser storage", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const storageSetItem = vi.spyOn(Storage.prototype, "setItem");
    const storageGetItem = vi.spyOn(Storage.prototype, "getItem");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS));

    const { container } = renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    expect(screen.getByRole("button", { name: "Accept suggestion" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Correct with another target" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject suggestion" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /bulk/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("/mappings/suggestions/");
    expect(container).not.toHaveTextContent("Auto-" + "appl" + "y");
    expect(container).not.toHaveTextContent("Apply " + "automatically");
    expect(container).not.toHaveTextContent("AI-" + "approved");
    expect(container).not.toHaveTextContent("AI " + "validated");
    expect(storageSetItem).not.toHaveBeenCalled();
    expect(storageGetItem).not.toHaveBeenCalled();
  });

  it("sends ACCEPT only after a human click and refreshes suggestions after backend success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const randomUUID = stubRandomUUID("accept-key-1");
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          decision: "ACCEPT",
          accountCode: "1000",
          resultKind: "MANUAL_MAPPING_CREATED",
          appliedMapping: {
            accountCode: "1000",
            targetCode: "BS.ASSET.CASH_AND_EQUIVALENTS"
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(randomUUID).not.toHaveBeenCalled();

    await user.click(getAcceptButton());

    expect(await screen.findByText(/Human decision recorded: ACCEPT/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/mappings/suggestions/1000/decision`
    );
    expect(getRequestHeaders(fetchMock, 1)["Idempotency-Key"]).toBe("accept-key-1");
    expect(getRequestBody(fetchMock, 1)).toEqual({
      decision: "ACCEPT",
      latestImportVersion: 3,
      suggestionFingerprint:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      targetCode: "BS.ASSET.CASH_AND_EQUIVALENTS"
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/mappings/suggestions`
    );
  });

  it("keeps CORRECT accessible, blocks the suggested target, and sends another selectable target", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("correct-key-1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          decision: "CORRECT",
          accountCode: "1000",
          resultKind: "MANUAL_MAPPING_UPDATED",
          appliedMapping: {
            accountCode: "1000",
            targetCode: "BS.ASSET.TRADE_RECEIVABLES"
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    expect(getCorrectionSelect()).toBeEnabled();
    expect(getCorrectButton()).toBeDisabled();

    await user.selectOptions(getCorrectionSelect(), "BS.ASSET.CASH_AND_EQUIVALENTS");
    expect(getCorrectButton()).toBeDisabled();
    expect(
      within(getSuggestionCard()).getByText(
        "Correct with another target must differ from suggestedTargetCode."
      )
    ).toBeInTheDocument();

    await user.selectOptions(getCorrectionSelect(), "BS.ASSET.TRADE_RECEIVABLES");
    expect(getCorrectButton()).toBeEnabled();
    await user.click(getCorrectButton());

    expect(await screen.findByText(/Human decision recorded: CORRECT/)).toBeInTheDocument();
    expect(getRequestBody(fetchMock, 1)).toEqual({
      decision: "CORRECT",
      latestImportVersion: 3,
      suggestionFingerprint:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      targetCode: "BS.ASSET.TRADE_RECEIVABLES"
    });
  });

  it("sends REJECT without targetCode and records a human decision state", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("reject-key-1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          decision: "REJECT",
          accountCode: "1000",
          resultKind: "REJECT_RECORDED",
          appliedMapping: null
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    await user.type(getReviewComment(), "  reject with evidence  ");
    await user.click(getRejectButton());

    expect(await screen.findByText(/Human decision recorded: REJECT/)).toBeInTheDocument();
    expect(getRequestBody(fetchMock, 1)).toEqual({
      decision: "REJECT",
      latestImportVersion: 3,
      suggestionFingerprint:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      reviewComment: "reject with evidence"
    });
    expect(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)).not.toContain(
      "targetCode"
    );
  });

  it("blocks double-submit while a decision is pending", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("pending-key-1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockImplementationOnce(() => new Promise<Response>(() => {}));

    renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    await user.click(getAcceptButton());
    await user.click(getAcceptButton());

    expect(await screen.findByText("Human decision in progress: ACCEPT.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getAcceptButton()).toBeDisabled();
    expect(getCorrectButton()).toBeDisabled();
    expect(getRejectButton()).toBeDisabled();
  });

  it("retries the same canonical decision with the same Idempotency-Key after a network error", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const randomUUID = stubRandomUUID("retry-key-1", "retry-key-2");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          decision: "ACCEPT",
          accountCode: "1000",
          resultKind: "MANUAL_MAPPING_CREATED",
          appliedMapping: {
            accountCode: "1000",
            targetCode: "BS.ASSET.CASH_AND_EQUIVALENTS"
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    await user.click(getAcceptButton());
    expect(await screen.findByText("Human decision network error.")).toBeInTheDocument();

    await user.click(getAcceptButton());
    expect(await screen.findByText(/Human decision recorded: ACCEPT/)).toBeInTheDocument();

    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(getRequestHeaders(fetchMock, 1)["Idempotency-Key"]).toBe("retry-key-1");
    expect(getRequestHeaders(fetchMock, 2)["Idempotency-Key"]).toBe("retry-key-1");
  });

  it("starts a new decision attempt when reviewComment changes after a retryable failure", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const randomUUID = stubRandomUUID("comment-key-1", "comment-key-2");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          decision: "ACCEPT",
          accountCode: "1000",
          resultKind: "MANUAL_MAPPING_CREATED",
          appliedMapping: {
            accountCode: "1000",
            targetCode: "BS.ASSET.CASH_AND_EQUIVALENTS"
          }
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    await user.type(getReviewComment(), "first");
    await user.click(getAcceptButton());
    expect(await screen.findByText("Human decision network error.")).toBeInTheDocument();

    await user.clear(getReviewComment());
    await user.type(getReviewComment(), "second");
    await user.click(getAcceptButton());

    expect(await screen.findByText(/Human decision recorded: ACCEPT/)).toBeInTheDocument();
    expect(randomUUID).toHaveBeenCalledTimes(2);
    expect(getRequestHeaders(fetchMock, 1)["Idempotency-Key"]).toBe("comment-key-1");
    expect(getRequestHeaders(fetchMock, 2)["Idempotency-Key"]).toBe("comment-key-2");
    expect(getRequestBody(fetchMock, 2).reviewComment).toBe("second");
  });

  it("shows 409 conflicts clearly", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("conflict-key-1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockResolvedValueOnce(
        jsonResponse(409, {
          decision: "ACCEPT",
          accountCode: "1000",
          resultKind: "CONFLICT_FINGERPRINT_MISMATCH",
          appliedMapping: null
        })
      );

    renderPanel();
    await screen.findByLabelText("AI mapping suggestion 1000");

    await user.click(getAcceptButton());

    expect(
      await screen.findByText("Human decision conflict: CONFLICT_FINGERPRINT_MISMATCH.")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
