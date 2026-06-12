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
  return screen.getByLabelText("suggestion mapping 1000 a revoir");
}

function getAcceptButton() {
  return within(getSuggestionCard()).getByRole("button", { name: "Accepter" });
}

function getCorrectButton() {
  return within(getSuggestionCard()).getByRole("button", {
    name: "Corriger"
  });
}

function getRejectButton() {
  return within(getSuggestionCard()).getByRole("button", { name: "Rejeter" });
}

function getCorrectionSelect() {
  return within(getSuggestionCard()).getByLabelText(
    "Corriger avec une autre cible"
  ) as HTMLSelectElement;
}

function getReviewComment() {
  return within(getSuggestionCard()).getByLabelText(
    "Commentaire de revue"
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

function expectNoProviderJargon(container: HTMLElement) {
  expect(container).not.toHaveTextContent(/provider/i);
  expect(container).not.toHaveTextContent(/no-provider/i);
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
    expect(screen.getByText("Chargement des suggestions de mapping.")).toBeInTheDocument();
    loadingRender.unmount();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(500, {})));
    renderPanel();
    expect(
      await screen.findByText("Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.")
    ).toBeInTheDocument();

    vi.unstubAllGlobals();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("network")));
    renderPanel();
    expect(
      await screen.findByText("Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable.")
    ).toBeInTheDocument();
  });

  it.each([
    [
      "DISABLED",
      "Suggestions desactivees pour cette demo locale. Aucune suggestion n'est generee. Continuez avec le mapping manuel."
    ],
    [
      "NO_IMPORT",
      "Import balance requis avant une aide de mapping. Le mapping manuel reste disponible."
    ],
    ["PARTIAL", "Suggestions partielles a revoir. Le mapping manuel reste la reference."],
    [
      "ARCHIVED_READ_ONLY",
      "Dossier archive : suggestions consultables uniquement. Aucune decision automatique."
    ],
    [
      "UNAVAILABLE",
      "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable."
    ],
    [
      "TIMEOUT",
      "Suggestions indisponibles pour le moment. Le mapping manuel reste utilisable."
    ],
    [
      "INVALID_MODEL_OUTPUT",
      "Suggestions non exploitables pour le moment. Le mapping manuel reste utilisable."
    ],
    [
      "INSUFFICIENT_EVIDENCE",
      "Preuves insuffisantes pour preparer des suggestions. Continuez avec le mapping manuel."
    ]
  ] as const)("renders %s read-model state", async (state, expectedText) => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, readModelForState(state)));

    const { container } = renderPanel();

    expect(await screen.findByText(expectedText)).toBeInTheDocument();
    expect(screen.getByText("Suggestions de mapping a revoir")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Aucune IA reelle n'est active. Aucun service IA externe n'est appele. Le mapping manuel reste la reference."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Revue humaine obligatoire. Aucune decision automatique.")
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent(state);
    expectNoProviderJargon(container);
  });

  it("renders the disabled state without raw backend status or English message", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, readModelForState("DISABLED", {
        errors: [
          {
            code: "AI_MAPPING_SUGGESTIONS_DISABLED",
            message: "Mapping suggestions are disabled."
          }
        ]
      }))
    );

    const { container } = renderPanel();

    expect(
      await screen.findByText(
        "Suggestions desactivees pour cette demo locale. Aucune suggestion n'est generee. Continuez avec le mapping manuel."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Suggestions desactivees pour cette demo locale. Continuez avec le mapping manuel.")
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("DISABLED");
    expect(container).not.toHaveTextContent("AI_MAPPING_SUGGESTIONS_DISABLED");
    expect(container).not.toHaveTextContent("Mapping suggestions are disabled.");
    expectNoProviderJargon(container);
  });

  it("renders READY with visible suggestion details and evidence", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS));

    const { container } = renderPanel();

    const card = await screen.findByLabelText("suggestion mapping 1000 a revoir");
    expect(within(card).getByText("compte")).toBeInTheDocument();
    expect(within(card).getByText("1000")).toBeInTheDocument();
    expect(within(card).getByText("libelle compte")).toBeInTheDocument();
    expect(within(card).getAllByText("Bank CHF")).toHaveLength(2);
    expect(within(card).getByText("cible suggeree")).toBeInTheDocument();
    expect(within(card).getByText("BS.ASSET.CASH_AND_EQUIVALENTS")).toBeInTheDocument();
    expect(within(card).getByText("82 %")).toBeInTheDocument();
    expect(within(card).getAllByText("obligatoire").length).toBeGreaterThan(0);
    expect(within(card).getByText("Raison de suggestion")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Proposition a verifier avec les preuves ci-dessous avant toute decision humaine."
      )
    ).toBeInTheDocument();
    expect(within(card).getByText("Preuves")).toBeInTheDocument();
    expect(within(card).getByText("Libelle du compte")).toBeInTheDocument();
    expect(within(card).getByText("ligne de balance 1000")).toBeInTheDocument();
    expect(within(card).getByText("Taxonomie de mapping")).toBeInTheDocument();
    expect(within(card).getByText("cible BS.ASSET.CASH_AND_EQUIVALENTS")).toBeInTheDocument();
    expect(within(card).getAllByText("Cash and cash equivalents").length).toBeGreaterThan(0);
    expect(container).toHaveTextContent("Preuves");
    expect(container).not.toHaveTextContent("MEDIUM");
    expect(container).not.toHaveTextContent("ACCOUNT_LABEL");
    expect(container).not.toHaveTextContent("TARGET_TAXONOMY");
    expect(container).not.toHaveTextContent("Account label and target taxonomy are consistent with cash.");
    expect(container).not.toHaveTextContent("schemaVersion");
    expect(container).not.toHaveTextContent("promptVersion");
    expect(container).not.toHaveTextContent("modelVersion");
    expectNoProviderJargon(container);

    const evidenceHeading = within(card).getByText("Preuves");
    const acceptButton = within(card).getByRole("button", { name: "Accepter" });
    expect(Boolean(evidenceHeading.compareDocumentPosition(acceptButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it("renders READY with no suggestions as an empty read-only state", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, readModelForState("READY", { suggestions: [] }))
    );

    renderPanel();

    expect(
      await screen.findByText("Suggestions pretes pour revue humaine. Aucune decision automatique.")
    ).toBeInTheDocument();
    expect(screen.getByText("Aucune suggestion a revoir")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Aucune suggestion n'est generee. Le mapping manuel reste disponible et fait reference pour cette demo."
      )
    ).toBeInTheDocument();
  });

  it("shows backend read-model messages as user-facing review points", async () => {
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

    const { container } = renderPanel();

    expect(await screen.findByText("Points de revue")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Certaines lignes n'ont pas assez de preuves pour une suggestion. Revoyez-les dans le mapping manuel."
      )
    ).toBeInTheDocument();
    expect(container).not.toHaveTextContent("PARTIAL_SUGGESTIONS");
    expect(container).not.toHaveTextContent("One account has no sufficient evidence.");
  });

  it("exposes only unit human decision controls and does not write browser storage", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const storageSetItem = vi.spyOn(Storage.prototype, "setItem");
    const storageGetItem = vi.spyOn(Storage.prototype, "getItem");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS));

    const { container } = renderPanel();
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    expect(screen.getByRole("button", { name: "Accepter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Corriger" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejeter" })).toBeInTheDocument();
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
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(randomUUID).not.toHaveBeenCalled();

    await user.click(getAcceptButton());

    expect(
      await screen.findByText(/Decision humaine enregistree : accepter/)
    ).toBeInTheDocument();
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

  it("keeps the previous suggestions visible and warns when the post-decision suggestions refresh fails", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("reject-refresh-failure-key-1");
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
      .mockResolvedValueOnce(jsonResponse(500, {}));

    renderPanel();
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    await user.click(getRejectButton());

    expect(
      await screen.findByText(/Decision humaine enregistree : rejeter/)
    ).toBeInTheDocument();
    expect(screen.getByText("rafraichissement suggestions impossible")).toBeInTheDocument();
    expect(screen.getByLabelText("suggestion mapping 1000 a revoir")).toBeInTheDocument();
  });

  it("runs the manual mapping refresh callback only when the decision result applied mapping", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const onManualMappingMutationConfirmed = vi.fn();
    stubRandomUUID("noop-key-1", "created-key-1");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MAPPING_SUGGESTIONS))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          decision: "ACCEPT",
          accountCode: "1000",
          resultKind: "MANUAL_MAPPING_NOOP",
          appliedMapping: null
        })
      )
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

    renderPanel({ onManualMappingMutationConfirmed });
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    await user.click(getAcceptButton());
    expect(
      await screen.findByText(/Aucun changement de mapping manuel necessaire/)
    ).toBeInTheDocument();
    expect(onManualMappingMutationConfirmed).not.toHaveBeenCalled();

    await user.click(getAcceptButton());
    expect(
      await screen.findByText(/Mapping manuel cree apres validation humaine/)
    ).toBeInTheDocument();
    expect(onManualMappingMutationConfirmed).toHaveBeenCalledTimes(1);
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
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    expect(getCorrectionSelect()).toBeEnabled();
    expect(getCorrectButton()).toBeDisabled();

    await user.selectOptions(getCorrectionSelect(), "BS.ASSET.CASH_AND_EQUIVALENTS");
    expect(getCorrectButton()).toBeDisabled();
    expect(
      within(getSuggestionCard()).getByText(
        "La cible corrigee doit differer de la cible suggeree."
      )
    ).toBeInTheDocument();

    await user.selectOptions(getCorrectionSelect(), "BS.ASSET.TRADE_RECEIVABLES");
    expect(getCorrectButton()).toBeEnabled();
    await user.click(getCorrectButton());

    expect(
      await screen.findByText(/Decision humaine enregistree : corriger/)
    ).toBeInTheDocument();
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
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    await user.type(getReviewComment(), "  reject with evidence  ");
    await user.click(getRejectButton());

    expect(
      await screen.findByText(/Decision humaine enregistree : rejeter/)
    ).toBeInTheDocument();
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
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    await user.click(getAcceptButton());
    await user.click(getAcceptButton());

    expect(await screen.findByText("Decision humaine en cours : accepter.")).toBeInTheDocument();
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
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    await user.click(getAcceptButton());
    expect(
      await screen.findByText(
        "Decision humaine indisponible pour le moment. Reessayez ou continuez avec le mapping manuel."
      )
    ).toBeInTheDocument();

    await user.click(getAcceptButton());
    expect(
      await screen.findByText(/Decision humaine enregistree : accepter/)
    ).toBeInTheDocument();

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
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    await user.type(getReviewComment(), "first");
    await user.click(getAcceptButton());
    expect(
      await screen.findByText(
        "Decision humaine indisponible pour le moment. Reessayez ou continuez avec le mapping manuel."
      )
    ).toBeInTheDocument();

    await user.clear(getReviewComment());
    await user.type(getReviewComment(), "second");
    await user.click(getAcceptButton());

    expect(
      await screen.findByText(/Decision humaine enregistree : accepter/)
    ).toBeInTheDocument();
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
    await screen.findByLabelText("suggestion mapping 1000 a revoir");

    await user.click(getAcceptButton());

    expect(
      await screen.findByText("Suggestion modifiee depuis la derniere lecture")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
