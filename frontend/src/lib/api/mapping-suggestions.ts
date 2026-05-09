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
    modelVersion: z.string().min(1).max(120)
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

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
