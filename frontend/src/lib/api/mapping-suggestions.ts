import { z } from "zod";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const mappingSuggestionEvidenceSchema = z
  .object({
    type: z.enum([
      "ACCOUNT_LABEL",
      "BALANCE_IMPORT_LINE",
      "TARGET_TAXONOMY",
      "HISTORICAL_MAPPING",
      "RULE_DOC",
      "NOTE_TEMPLATE"
    ]),
    ref: z.string().min(1).max(200),
    snippet: z.string().min(1).max(300)
  })
  .strict();

const mappingSuggestionSchema = z
  .object({
    accountCode: z.string().min(1).max(64),
    accountLabel: z.string().min(1).max(300),
    suggestedTargetCode: z.string().min(1).max(120),
    confidence: z.number().min(0).max(1),
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
    rationale: z.string().min(1).max(600),
    evidence: z.array(mappingSuggestionEvidenceSchema).min(1).max(8),
    requiresHumanReview: z.literal(true),
    schemaVersion: z.literal("mapping-suggestion-v1"),
    promptVersion: z.string().min(1).max(120),
    modelVersion: z.string().min(1).max(120),
    suggestionFingerprint: z.string().regex(/^[0-9a-f]{64}$/)
  })
  .strict();

const mappingSuggestionErrorSchema = z
  .object({
    code: z.enum([
      "AI_MAPPING_SUGGESTIONS_DISABLED",
      "NO_LATEST_IMPORT",
      "AI_MAPPING_UNAVAILABLE",
      "AI_MAPPING_TIMEOUT",
      "INVALID_MODEL_OUTPUT",
      "INSUFFICIENT_EVIDENCE",
      "ARCHIVED_READ_ONLY",
      "PARTIAL_SUGGESTIONS"
    ]),
    message: z.string().min(1).max(300)
  })
  .strict();

const mappingSuggestionsReadModelSchema = z
  .object({
    state: z.enum([
      "DISABLED",
      "NO_IMPORT",
      "READY",
      "PARTIAL",
      "UNAVAILABLE",
      "TIMEOUT",
      "INVALID_MODEL_OUTPUT",
      "INSUFFICIENT_EVIDENCE",
      "ARCHIVED_READ_ONLY"
    ]),
    closingFolderId: z.string().uuid(),
    latestImportVersion: z.number().int().positive().nullable(),
    taxonomyVersion: z.number().int().positive(),
    suggestions: z.array(mappingSuggestionSchema),
    errors: z.array(mappingSuggestionErrorSchema)
  })
  .strict();

export type MappingSuggestionsReadModel = z.infer<typeof mappingSuggestionsReadModelSchema>;
export type MappingSuggestion = z.infer<typeof mappingSuggestionSchema>;
export type MappingSuggestionsState = MappingSuggestionsReadModel["state"];
export type MappingSuggestionEvidence = z.infer<typeof mappingSuggestionEvidenceSchema>;
export type MappingSuggestionError = z.infer<typeof mappingSuggestionErrorSchema>;
export type MappingSuggestionDecision = "ACCEPT" | "CORRECT" | "REJECT";
export type MappingSuggestionDecisionResultKind =
  | "MANUAL_MAPPING_CREATED"
  | "MANUAL_MAPPING_UPDATED"
  | "MANUAL_MAPPING_NOOP"
  | "REJECT_RECORDED"
  | "CONFLICT_ARCHIVED"
  | "CONFLICT_NO_IMPORT"
  | "CONFLICT_FLAG_OFF"
  | "CONFLICT_NON_DECISIONABLE"
  | "CONFLICT_SUGGESTION_ABSENT"
  | "CONFLICT_FINGERPRINT_MISMATCH"
  | "CONFLICT_STALE_IMPORT"
  | "CONFLICT_ACCOUNT_ABSENT"
  | "CONFLICT_TARGET_MISMATCH"
  | "CONFLICT_TARGET_NOT_SELECTABLE";

export type MappingSuggestionDecisionRequest =
  | {
      decision: "ACCEPT";
      latestImportVersion: number;
      suggestionFingerprint: string;
      targetCode: string;
      reviewComment?: string;
    }
  | {
      decision: "CORRECT";
      latestImportVersion: number;
      suggestionFingerprint: string;
      targetCode: string;
      reviewComment?: string;
    }
  | {
      decision: "REJECT";
      latestImportVersion: number;
      suggestionFingerprint: string;
      reviewComment?: string;
    };

const appliedManualMappingSchema = z
  .object({
    accountCode: z.string().min(1).max(64),
    targetCode: z.string().min(1).max(120)
  })
  .strict();

const mappingSuggestionDecisionResultSchema = z
  .object({
    decision: z.enum(["ACCEPT", "CORRECT", "REJECT"]),
    accountCode: z.string().min(1).max(64),
    resultKind: z.enum([
      "MANUAL_MAPPING_CREATED",
      "MANUAL_MAPPING_UPDATED",
      "MANUAL_MAPPING_NOOP",
      "REJECT_RECORDED",
      "CONFLICT_ARCHIVED",
      "CONFLICT_NO_IMPORT",
      "CONFLICT_FLAG_OFF",
      "CONFLICT_NON_DECISIONABLE",
      "CONFLICT_SUGGESTION_ABSENT",
      "CONFLICT_FINGERPRINT_MISMATCH",
      "CONFLICT_STALE_IMPORT",
      "CONFLICT_ACCOUNT_ABSENT",
      "CONFLICT_TARGET_MISMATCH",
      "CONFLICT_TARGET_NOT_SELECTABLE"
    ]),
    appliedMapping: appliedManualMappingSchema.nullable()
  })
  .strict();

export type MappingSuggestionDecisionResult = z.infer<
  typeof mappingSuggestionDecisionResultSchema
>;

export type MappingSuggestionsShellState =
  | { kind: "loading" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" }
  | { kind: "ready"; readModel: MappingSuggestionsReadModel };

export type MappingSuggestionDecisionState =
  | { kind: "success"; result: MappingSuggestionDecisionResult }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict"; result: MappingSuggestionDecisionResult | null }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export async function loadMappingSuggestionsShellState(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<MappingSuggestionsShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/mappings/suggestions`,
      {
        method: "GET",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 400) {
      return { kind: "bad_request" };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    if (response.status !== 200) {
      return { kind: "unexpected" };
    }

    const payload = await readJsonBody(response);
    const readModel = parseMappingSuggestionsPayload(payload, closingFolderId);

    if (readModel === null) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      readModel
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

export async function recordMappingSuggestionDecision(
  closingFolderId: string,
  accountCode: string,
  activeTenant: ActiveTenant,
  idempotencyKey: string,
  decisionRequest: MappingSuggestionDecisionRequest,
  fetcher: Fetcher = fetch
): Promise<MappingSuggestionDecisionState> {
  const payload = serializeMappingSuggestionDecisionRequest(decisionRequest);

  if (payload === null) {
    return { kind: "bad_request" };
  }

  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/mappings/suggestions/${encodeURIComponent(accountCode)}/decision`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
          "X-Tenant-Id": activeTenant.tenantId
        },
        body: JSON.stringify(payload)
      },
      fetcher
    );

    if (response.status === 200) {
      const result = parseMappingSuggestionDecisionResult(
        await readJsonBody(response),
        accountCode,
        decisionRequest.decision
      );

      if (result === null) {
        return { kind: "invalid_payload" };
      }

      return {
        kind: "success",
        result
      };
    }

    if (response.status === 400) {
      return { kind: "bad_request" };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status === 409) {
      return {
        kind: "conflict",
        result: parseMappingSuggestionDecisionResult(
          await readJsonBody(response),
          accountCode,
          decisionRequest.decision
        )
      };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    return { kind: "unexpected" };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

export function generateMappingSuggestionDecisionIdempotencyKey() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  const randomBytes = new Uint8Array(16);

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(randomBytes);
  } else {
    for (let index = 0; index < randomBytes.length; index += 1) {
      randomBytes[index] = Math.floor(Math.random() * 256);
    }
  }

  randomBytes[6] = (randomBytes[6] & 0x0f) | 0x40;
  randomBytes[8] = (randomBytes[8] & 0x3f) | 0x80;

  const hex = [...randomBytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

function parseMappingSuggestionsPayload(payload: unknown, closingFolderId: string) {
  if (payload === undefined) {
    return null;
  }

  const parsed = mappingSuggestionsReadModelSchema.safeParse(payload);

  if (!parsed.success || parsed.data.closingFolderId !== closingFolderId) {
    return null;
  }

  return parsed.data;
}

function parseMappingSuggestionDecisionResult(
  payload: unknown,
  accountCode: string,
  decision: MappingSuggestionDecision
) {
  if (payload === undefined) {
    return null;
  }

  const parsed = mappingSuggestionDecisionResultSchema.safeParse(payload);

  if (!parsed.success || parsed.data.accountCode !== accountCode || parsed.data.decision !== decision) {
    return null;
  }

  if (
    parsed.data.appliedMapping !== null &&
    parsed.data.appliedMapping.accountCode !== parsed.data.accountCode
  ) {
    return null;
  }

  return parsed.data;
}

function serializeMappingSuggestionDecisionRequest(
  decisionRequest: MappingSuggestionDecisionRequest
) {
  const reviewComment = decisionRequest.reviewComment?.trim();

  if (reviewComment !== undefined && reviewComment.length > 600) {
    return null;
  }

  const base = {
    decision: decisionRequest.decision,
    latestImportVersion: decisionRequest.latestImportVersion,
    suggestionFingerprint: decisionRequest.suggestionFingerprint,
    ...(reviewComment === undefined || reviewComment.length === 0 ? {} : { reviewComment })
  };

  if (decisionRequest.decision === "REJECT") {
    return base;
  }

  return {
    ...base,
    targetCode: decisionRequest.targetCode
  };
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
