import { z } from "zod";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const schemaVersionSchema = z.literal("mapping-suggestion-v2");
const accountCodeSchema = z.string().min(1).max(64).regex(/^[0-9A-Z._-]+$/);
const accountLabelSchema = z.string().min(1).max(300);
const targetCodeSchema = z.string().min(1).max(120);
const taxonomyHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const suggestionFingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/);

const evidenceCodeSchema = z.enum(["ACCOUNT_LABEL", "TARGET_TAXONOMY"]);
const suggestionEvidenceCodesSchema = z
  .array(evidenceCodeSchema)
  .length(2)
  .refine((items) => hasExactItems(items, ["ACCOUNT_LABEL", "TARGET_TAXONOMY"]));
const abstentionEvidenceCodesSchema = z
  .array(evidenceCodeSchema)
  .length(1)
  .refine((items) => hasExactItems(items, ["ACCOUNT_LABEL"]));

const explanationCodeSchema = z.enum(["TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE"]);
const abstentionReasonCodeSchema = z.enum([
  "OUT_OF_SCOPE",
  "CONFLICTING_SIGNALS",
  "INSUFFICIENT_EVIDENCE",
  "TAXONOMY_GAP",
  "AMBIGUOUS_TARGET"
]);
const policyBlockCodeSchema = z.enum([
  "NON_SYNTHETIC_REQUEST",
  "CROSS_TENANT_REQUEST",
  "OUTSIDE_ALLOWLIST_OR_PROVENANCE",
  "LANGUAGE_OUT_OF_COHORT",
  "GATE_INVALID",
  "PRIVACY_OR_TENANT_BOUNDARY"
]);
const accountPreconditionBlockCodeSchema = z.enum([
  "ACCOUNT_ALREADY_AFFECTED",
  "ACCOUNT_NOT_IN_LATEST_IMPORT",
  "NOT_ELIGIBLE"
]);
const requestPreconditionBlockCodeSchema = z.literal("STALE_IMPORT");
const invalidReasonCodeSchema = z.enum([
  "TARGET_UNKNOWN",
  "TARGET_DEPRECATED",
  "TARGET_NOT_SELECTABLE",
  "SECTION_OR_ROOT_PROPOSED",
  "MALFORMED_OUTPUT",
  "SCHEMA_INVALID",
  "CONTEXTUALLY_INADMISSIBLE_TARGET",
  "VERSION_PIN_MISMATCH"
]);
const invalidReasonCodesSchema = z.array(invalidReasonCodeSchema).min(1).max(8).refine(hasUniqueItems);

const suggestionSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("SUGGESTION"),
    scope: z.literal("ACCOUNT"),
    accountCode: accountCodeSchema,
    accountLabel: accountLabelSchema,
    targetCode: targetCodeSchema,
    explanationCode: explanationCodeSchema,
    evidenceCodes: suggestionEvidenceCodesSchema,
    requiresHumanReview: z.literal(true),
    suggestionFingerprint: suggestionFingerprintSchema
  })
  .strict();

const abstentionSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("ABSTENTION"),
    scope: z.literal("ACCOUNT"),
    accountCode: accountCodeSchema,
    accountLabel: accountLabelSchema,
    abstentionReasonCode: abstentionReasonCodeSchema,
    evidenceCodes: abstentionEvidenceCodesSchema
  })
  .strict();

const policyBlockSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("POLICY_BLOCK"),
    scope: z.literal("REQUEST"),
    policyBlockCode: policyBlockCodeSchema
  })
  .strict();

const accountPreconditionBlockSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("PRECONDITION_BLOCK"),
    scope: z.literal("ACCOUNT"),
    accountCode: accountCodeSchema,
    accountLabel: accountLabelSchema,
    preconditionBlockCode: accountPreconditionBlockCodeSchema
  })
  .strict();

const requestPreconditionBlockSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("PRECONDITION_BLOCK"),
    scope: z.literal("REQUEST"),
    preconditionBlockCode: requestPreconditionBlockCodeSchema
  })
  .strict();

const invalidModelOutputSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("TECHNICAL_DEGRADATION"),
    scope: z.literal("ACCOUNT"),
    accountCode: accountCodeSchema,
    accountLabel: accountLabelSchema,
    degradationCode: z.literal("INVALID_MODEL_OUTPUT"),
    invalidReasonCodes: invalidReasonCodesSchema
  })
  .strict();

const localInputInvalidSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("TECHNICAL_DEGRADATION"),
    scope: z.literal("ACCOUNT"),
    accountCode: accountCodeSchema,
    accountLabel: accountLabelSchema,
    degradationCode: z.literal("LOCAL_INPUT_INVALID")
  })
  .strict();

const requestTimeoutSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("TECHNICAL_DEGRADATION"),
    scope: z.literal("REQUEST"),
    degradationCode: z.literal("TIMEOUT")
  })
  .strict();

const batchUnavailableSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    outcome: z.literal("TECHNICAL_DEGRADATION"),
    scope: z.literal("BATCH"),
    degradationCode: z.literal("UNAVAILABLE")
  })
  .strict();

const mappingSuggestionV2Schema = z.union([
  suggestionSchema,
  abstentionSchema,
  policyBlockSchema,
  accountPreconditionBlockSchema,
  requestPreconditionBlockSchema,
  invalidModelOutputSchema,
  localInputInvalidSchema,
  requestTimeoutSchema,
  batchUnavailableSchema
]);

const mappingSuggestionsV2ReadModelSchema = z
  .object({
    schemaVersion: schemaVersionSchema,
    closingFolderId: z.string().uuid(),
    latestImportVersion: z.number().int().positive().optional(),
    taxonomyVersion: z.number().int().positive(),
    taxonomyHash: taxonomyHashSchema,
    items: z.array(mappingSuggestionV2Schema)
  })
  .strict();

export type MappingSuggestionV2 = z.infer<typeof mappingSuggestionV2Schema>;
export type MappingSuggestionsV2ReadModel = z.infer<typeof mappingSuggestionsV2ReadModelSchema>;
export type MappingSuggestionV2Outcome = MappingSuggestionV2["outcome"];
export type MappingSuggestionV2Scope = "ACCOUNT" | "REQUEST" | "BATCH";
export type MappingSuggestionV2DecisionCode = "ACCEPT" | "CORRECT" | "REJECT";
export type MappingSuggestionsV2ShellState =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "ready"; readModel: MappingSuggestionsV2ReadModel };
type MappingSuggestionV2PreconditionBlockCode =
  | z.infer<typeof accountPreconditionBlockCodeSchema>
  | z.infer<typeof requestPreconditionBlockCodeSchema>;
type MappingSuggestionV2DegradationCode =
  | "INVALID_MODEL_OUTPUT"
  | "UNAVAILABLE"
  | "TIMEOUT"
  | "LOCAL_INPUT_INVALID";

export function parseMappingSuggestionV2Payload(payload: unknown): MappingSuggestionV2 | null {
  const parsed = mappingSuggestionV2Schema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export function parseMappingSuggestionsV2ReadModelPayload(
  payload: unknown
): MappingSuggestionsV2ReadModel | null {
  const parsed = mappingSuggestionsV2ReadModelSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

export async function loadMappingSuggestionsV2ShellState(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<MappingSuggestionsV2ShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/mappings/suggestions-v2`,
      {
        method: "GET",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status !== 200) {
      return { kind: "unavailable" };
    }

    const readModel = parseMappingSuggestionsV2ReadModelPayload(await readJsonBody(response));

    if (readModel === null || readModel.closingFolderId !== closingFolderId) {
      return { kind: "unavailable" };
    }

    return {
      kind: "ready",
      readModel
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export function getMappingSuggestionV2AllowedDecisionCodes(
  item: MappingSuggestionV2
): MappingSuggestionV2DecisionCode[] {
  return item.outcome === "SUGGESTION" ? ["ACCEPT", "CORRECT", "REJECT"] : [];
}

export function deriveMappingSuggestionV2UserMessage(item: MappingSuggestionV2): string {
  switch (item.outcome) {
    case "SUGGESTION":
      return suggestionMessages[item.explanationCode];
    case "ABSTENTION":
      return abstentionMessages[item.abstentionReasonCode];
    case "POLICY_BLOCK":
      return policyBlockMessages[item.policyBlockCode];
    case "PRECONDITION_BLOCK":
      return preconditionBlockMessages[item.preconditionBlockCode];
    case "TECHNICAL_DEGRADATION":
      return technicalDegradationMessages[item.degradationCode];
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
}

const suggestionMessages: Record<z.infer<typeof explanationCodeSchema>, string> = {
  TARGET_SUPPORTED_BY_CANDIDATE_EVIDENCE: "Proposition a verifier."
};

const abstentionMessages: Record<z.infer<typeof abstentionReasonCodeSchema>, string> = {
  OUT_OF_SCOPE: "Aucune proposition: le compte est hors perimetre de l'affectation assistee.",
  CONFLICTING_SIGNALS: "Aucune proposition: les signaux disponibles sont contradictoires.",
  INSUFFICIENT_EVIDENCE: "Aucune proposition: les preuves disponibles sont insuffisantes.",
  TAXONOMY_GAP: "Aucune proposition: aucune rubrique admissible ne couvre ce concept.",
  AMBIGUOUS_TARGET: "Aucune proposition: plusieurs rubriques admissibles restent possibles."
};

const policyBlockMessages: Record<z.infer<typeof policyBlockCodeSchema>, string> = {
  NON_SYNTHETIC_REQUEST: "Cette demande n'est pas eligible a l'affectation assistee.",
  CROSS_TENANT_REQUEST: "Cette demande n'est pas eligible a l'affectation assistee.",
  OUTSIDE_ALLOWLIST_OR_PROVENANCE: "Cette demande n'est pas eligible a l'affectation assistee.",
  LANGUAGE_OUT_OF_COHORT: "Cette demande n'est pas eligible a l'affectation assistee.",
  GATE_INVALID: "Cette demande n'est pas eligible a l'affectation assistee.",
  PRIVACY_OR_TENANT_BOUNDARY: "Cette demande n'est pas eligible a l'affectation assistee."
};

const preconditionBlockMessages: Record<MappingSuggestionV2PreconditionBlockCode, string> = {
  ACCOUNT_ALREADY_AFFECTED: "Affectation manuelle conservee.",
  ACCOUNT_NOT_IN_LATEST_IMPORT: "Affectation assistee indisponible pour ce compte.",
  STALE_IMPORT: "Affectation assistee indisponible sur une balance obsolete.",
  NOT_ELIGIBLE: "Affectation assistee indisponible pour ce compte."
};

const technicalDegradationMessages: Record<MappingSuggestionV2DegradationCode, string> = {
  INVALID_MODEL_OUTPUT: "Proposition momentanement indisponible.",
  UNAVAILABLE: "Proposition momentanement indisponible.",
  TIMEOUT: "Proposition momentanement indisponible.",
  LOCAL_INPUT_INVALID: "Proposition momentanement indisponible."
};

function hasUniqueItems<T>(items: T[]) {
  return new Set(items).size === items.length;
}

function hasExactItems<T>(items: T[], expected: readonly T[]) {
  const uniqueItems = new Set(items);
  return (
    items.length === expected.length &&
    uniqueItems.size === expected.length &&
    expected.every((item) => uniqueItems.has(item))
  );
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
