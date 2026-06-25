import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  deriveMappingSuggestionV2UserMessage,
  getMappingSuggestionV2AllowedDecisionCodes,
  parseMappingSuggestionV2Payload,
  parseMappingSuggestionsV2ReadModelPayload
} from "./mapping-suggestions-v2";

type CorpusCase = {
  id: string;
  payload: Record<string, unknown>;
};

type Corpus = {
  readModelContext: {
    schemaVersion: string;
    closingFolderId: string;
    latestImportVersion: number;
    taxonomyVersion: number;
    taxonomyHash: string;
  };
  valid: CorpusCase[];
  invalid: CorpusCase[];
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const corpus = JSON.parse(
  readFileSync(resolve(repoRoot, "contracts/ai/mapping-suggestion-v2.corpus.json"), "utf8")
) as Corpus;
const openApiText = readFileSync(
  resolve(repoRoot, "contracts/openapi/mapping-suggestions-v2-api.yaml"),
  "utf8"
);

const SUGGESTION = validPayload("valid-suggestion-account-scope");
const ABSTENTION = validPayload("valid-abstention-account-scope");
const POLICY_BLOCK = validPayload("valid-policy-block-request-scope");
const PRECONDITION_ACCOUNT_BLOCK = validPayload("valid-precondition-account-scope");
const PRECONDITION_REQUEST_BLOCK = validPayload("valid-precondition-request-scope");
const INVALID_MODEL_OUTPUT = validPayload("valid-invalid-model-output-account-scope");
const REQUEST_TIMEOUT = validPayload("valid-timeout-request-scope");
const BATCH_UNAVAILABLE = validPayload("valid-unavailable-batch-scope");

describe("mapping suggestions v2 parser", () => {
  it("parses a strict suggestion without confidence or provider free text", () => {
    const parsed = parseMappingSuggestionV2Payload(SUGGESTION);

    expect(parsed).toEqual(SUGGESTION);
    if (!parsed) throw new Error("expected suggestion to parse");

    expect(parsed.scope).toBe("ACCOUNT");
    expect(getMappingSuggestionV2AllowedDecisionCodes(parsed)).toEqual([
      "ACCEPT",
      "CORRECT",
      "REJECT"
    ]);
    expect(deriveMappingSuggestionV2UserMessage(parsed)).toBe("Proposition a verifier.");
    expect(Object.keys(SUGGESTION)).not.toContain("confidence");
    expect(Object.keys(SUGGESTION)).not.toContain("rationale");
    expect(Object.keys(SUGGESTION)).not.toContain("suggestedTargetCode");
  });

  it("parses abstention as account-scoped non decisionable and without target or fingerprint", () => {
    const parsed = parseMappingSuggestionV2Payload(ABSTENTION);

    expect(parsed).toEqual(ABSTENTION);
    if (!parsed) throw new Error("expected abstention to parse");

    expect(parsed.scope).toBe("ACCOUNT");
    expect(getMappingSuggestionV2AllowedDecisionCodes(parsed)).toEqual([]);
    expect(deriveMappingSuggestionV2UserMessage(parsed)).toBe(
      "Aucune proposition: les preuves disponibles sont insuffisantes."
    );
    expect(Object.keys(ABSTENTION)).not.toContain("targetCode");
    expect(Object.keys(ABSTENTION)).not.toContain("suggestionFingerprint");
    expect(Object.keys(ABSTENTION)).not.toContain("confidence");
  });

  it.each([
    {
      label: "policy block",
      payload: POLICY_BLOCK,
      scope: "REQUEST",
      message: "Cette demande n'est pas eligible a l'affectation assistee."
    },
    {
      label: "account precondition block",
      payload: PRECONDITION_ACCOUNT_BLOCK,
      scope: "ACCOUNT",
      message: "Affectation manuelle conservee."
    },
    {
      label: "request precondition block",
      payload: PRECONDITION_REQUEST_BLOCK,
      scope: "REQUEST",
      message: "Affectation assistee indisponible sur une balance obsolete."
    },
    {
      label: "invalid model output",
      payload: INVALID_MODEL_OUTPUT,
      scope: "ACCOUNT",
      message: "Proposition momentanement indisponible."
    },
    {
      label: "request timeout",
      payload: REQUEST_TIMEOUT,
      scope: "REQUEST",
      message: "Proposition momentanement indisponible."
    },
    {
      label: "batch unavailable",
      payload: BATCH_UNAVAILABLE,
      scope: "BATCH",
      message: "Proposition momentanement indisponible."
    }
  ])("parses $label and keeps it non decisionable", ({ payload, scope, message }) => {
    const parsed = parseMappingSuggestionV2Payload(payload);

    expect(parsed).toEqual(payload);
    if (!parsed) throw new Error("expected payload to parse");

    expect(parsed.scope).toBe(scope);
    expect(getMappingSuggestionV2AllowedDecisionCodes(parsed)).toEqual([]);
    expect(deriveMappingSuggestionV2UserMessage(parsed)).toBe(message);
  });

  it("uses the shared contract corpus for valid payloads", () => {
    for (const { id, payload } of corpus.valid) {
      expect(parseMappingSuggestionV2Payload(payload), id).toEqual(payload);
    }
  });

  it("uses the shared contract corpus for invalid payloads", () => {
    for (const { id, payload } of corpus.invalid) {
      expect(parseMappingSuggestionV2Payload(payload), id).toBeNull();
    }
  });

  it.each([
    {
      label: "unknown top-level field",
      payload: { ...SUGGESTION, unexpected: "value" }
    },
    {
      label: "messageCode",
      payload: { ...SUGGESTION, messageCode: "TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE" }
    },
    {
      label: "local userMessage from payload",
      payload: { ...SUGGESTION, userMessage: "Provider-like message" }
    },
    {
      label: "provider rationale",
      payload: { ...SUGGESTION, rationale: "Provider free text" }
    },
    {
      label: "confidence",
      payload: { ...SUGGESTION, confidence: 0.9 }
    },
    {
      label: "requiresHumanReview false",
      payload: { ...SUGGESTION, requiresHumanReview: false }
    },
    {
      label: "single suggestion evidence code",
      payload: { ...SUGGESTION, evidenceCodes: ["ACCOUNT_LABEL"] }
    },
    {
      label: "duplicate evidence code",
      payload: { ...SUGGESTION, evidenceCodes: ["ACCOUNT_LABEL", "ACCOUNT_LABEL"] }
    },
    {
      label: "null account label",
      payload: { ...SUGGESTION, accountLabel: null }
    },
    {
      label: "abstention target",
      payload: { ...ABSTENTION, targetCode: "BS.ASSET.CASH_AND_EQUIVALENTS" }
    },
    {
      label: "abstention target taxonomy evidence",
      payload: { ...ABSTENTION, evidenceCodes: ["TARGET_TAXONOMY"] }
    },
    {
      label: "abstention fingerprint",
      payload: {
        ...ABSTENTION,
        suggestionFingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      }
    },
    {
      label: "policy block with account context",
      payload: { ...POLICY_BLOCK, accountCode: "1000", accountLabel: "Synthetic cash account" }
    },
    {
      label: "request precondition with account context",
      payload: { ...PRECONDITION_REQUEST_BLOCK, accountCode: "1000", accountLabel: "Synthetic cash account" }
    },
    {
      label: "batch unavailable with account context",
      payload: { ...BATCH_UNAVAILABLE, accountCode: "1000", accountLabel: "Synthetic cash account" }
    },
    {
      label: "invalidReasonCodes on non invalid model output",
      payload: { ...REQUEST_TIMEOUT, invalidReasonCodes: ["SCHEMA_INVALID"] }
    },
    {
      label: "invalid model output without invalidReasonCodes",
      payload: {
        schemaVersion: "mapping-suggestion-v2",
        outcome: "TECHNICAL_DEGRADATION",
        scope: "ACCOUNT",
        accountCode: "1000",
        accountLabel: "Synthetic cash account",
        degradationCode: "INVALID_MODEL_OUTPUT"
      }
    },
    {
      label: "v1 schema version",
      payload: { ...SUGGESTION, schemaVersion: "mapping-suggestion-v1" }
    },
    {
      label: "mismatched outcome branch",
      payload: { ...SUGGESTION, outcome: "ABSTENTION" }
    }
  ])("rejects $label", ({ payload }) => {
    expect(parseMappingSuggestionV2Payload(payload)).toBeNull();
  });

  it.each([
    ["suggestion", SUGGESTION],
    ["abstention", ABSTENTION],
    ["policy block", POLICY_BLOCK],
    ["account precondition block", PRECONDITION_ACCOUNT_BLOCK],
    ["request precondition block", PRECONDITION_REQUEST_BLOCK],
    ["invalid model output", INVALID_MODEL_OUTPUT],
    ["request timeout", REQUEST_TIMEOUT],
    ["batch unavailable", BATCH_UNAVAILABLE]
  ])("keeps %s strict without nulls or additional fields", (_, payload) => {
    expect(parseMappingSuggestionV2Payload({ ...payload, unexpected: "value" })).toBeNull();
    expect(parseMappingSuggestionV2Payload({ ...payload, schemaVersion: null })).toBeNull();
  });

  it("parses a strict v2 read model with taxonomy hash and without nullable fields", () => {
    const readModel = {
      ...corpus.readModelContext,
      items: [SUGGESTION, ABSTENTION, POLICY_BLOCK, REQUEST_TIMEOUT]
    };
    const readModelWithoutImportVersion = {
      schemaVersion: readModel.schemaVersion,
      closingFolderId: readModel.closingFolderId,
      taxonomyVersion: readModel.taxonomyVersion,
      taxonomyHash: readModel.taxonomyHash,
      items: readModel.items
    };

    expect(parseMappingSuggestionsV2ReadModelPayload(readModel)).toEqual(readModel);
    expect(parseMappingSuggestionsV2ReadModelPayload(readModelWithoutImportVersion)).toEqual(
      readModelWithoutImportVersion
    );
    expect(parseMappingSuggestionsV2ReadModelPayload({
      ...readModel,
      latestImportVersion: null
    })).toBeNull();
    expect(parseMappingSuggestionsV2ReadModelPayload({
      ...readModel,
      taxonomyHash: "not-a-sha256"
    })).toBeNull();
    expect(parseMappingSuggestionsV2ReadModelPayload({
      ...readModel,
      suggestions: readModel.items
    })).toBeNull();
  });

  it("aligns shared corpus scope branches with OpenAPI components", () => {
    expect(openApiText).toContain("/api/closing-folders/{closingFolderId}/mappings/suggestions-v2:");
    expect(openApiText).toContain("taxonomyHash");
    expect(openApiText).toContain("latestImportVersion:");
    expect(openApiText).toContain("Omitted when no eligible");
    expect(openApiReadModelRequiredBlock()).not.toContain("- latestImportVersion");
    expect(openApiReadModelLatestImportVersionBlock()).not.toContain('"null"');
    expect(openApiReadModelLatestImportVersionBlock()).not.toContain("nullable");

    for (const { payload } of corpus.valid) {
      expect(openApiText).toContain(String(payload.outcome));
      expect(openApiText).toContain(String(payload.scope));
    }

    expect(openApiComponent("MappingSuggestionV2PolicyBlock")).not.toContain("accountCode:");
    expect(openApiComponent("MappingSuggestionV2PolicyBlock")).not.toContain("accountLabel:");
    expect(openApiComponent("MappingSuggestionV2RequestPreconditionBlock")).not.toContain("accountCode:");
    expect(openApiComponent("MappingSuggestionV2RequestTimeout")).not.toContain("accountCode:");
    expect(openApiComponent("MappingSuggestionV2BatchUnavailable")).not.toContain("accountCode:");
  });
});

function validPayload(id: string): Record<string, unknown> {
  const match = corpus.valid.find((entry) => entry.id === id);
  if (!match) throw new Error(`Missing valid corpus payload ${id}`);
  return match.payload;
}

function openApiComponent(name: string): string {
  const match = openApiText.match(new RegExp(`[ ]{4}${name}:\\n([\\s\\S]*?)(?=\\n[ ]{4}MappingSuggestionV2|\\n$)`));
  if (!match) throw new Error(`Missing OpenAPI component ${name}`);
  return match[1];
}

function openApiReadModelRequiredBlock(): string {
  const component = openApiComponent("MappingSuggestionsV2ReadModel");
  const match = component.match(/required:\n([\s\S]*?)\n[ ]{6}properties:/);
  if (!match) throw new Error("Missing MappingSuggestionsV2ReadModel required block");
  return match[1];
}

function openApiReadModelLatestImportVersionBlock(): string {
  const component = openApiComponent("MappingSuggestionsV2ReadModel");
  const match = component.match(/[ ]{8}latestImportVersion:\n([\s\S]*?)\n[ ]{8}taxonomyVersion:/);
  if (!match) throw new Error("Missing MappingSuggestionsV2ReadModel latestImportVersion block");
  return match[1];
}
