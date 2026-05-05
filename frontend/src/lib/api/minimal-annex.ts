import { z } from "zod";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const forbiddenMinimalAnnexPayloadKeys = new Set([
  "gcsPath",
  "gcs_path",
  "objectKey",
  "object_key",
  "objectPath",
  "object_path",
  "privatePath",
  "private_path",
  "signedUrl",
  "signed_url",
  "sourceFingerprint",
  "source_fingerprint",
  "storageBackend",
  "storage_backend",
  "storageObjectKey",
  "storage_object_key",
  "storagePath",
  "storage_path"
]);

const uuidSchema = z.string().uuid();

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const isoDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)));

const minimalAnnexLegalNoticeSchema = z
  .object({
    title: z.string(),
    notOfficialCoAnnex: z.string(),
    noAutomaticValidation: z.string(),
    humanReviewRequired: z.string()
  })
  .strict();

const minimalAnnexExportPackBasisSchema = z
  .object({
    exportPackId: uuidSchema,
    createdAt: isoDateTimeSchema,
    basisImportVersion: z.number().int().positive(),
    basisTaxonomyVersion: z.number().int().positive()
  })
  .strict();

const minimalAnnexBasisSchema = z
  .object({
    controlsReadiness: z.enum(["READY", "BLOCKED"]).nullable(),
    latestImportVersion: z.number().int().positive().nullable(),
    taxonomyVersion: z.number().int().positive().nullable(),
    structuredStatementState: z
      .enum(["NO_DATA", "BLOCKED", "PREVIEW_READY"])
      .nullable(),
    structuredPresentationType: z.literal("STRUCTURED_PREVIEW").nullable(),
    exportPack: minimalAnnexExportPackBasisSchema.nullable()
  })
  .strict();

const minimalAnnexIssueTargetSchema = z
  .object({
    type: z.enum(["WORKPAPER_ANCHOR", "DOCUMENT", "EXPORT_PACK"]),
    code: z.string().nullable(),
    id: z.string().nullable()
  })
  .strict();

const minimalAnnexIssueSchema = z
  .object({
    code: z.enum([
      "CLOSING_NOT_READY",
      "STRUCTURED_FINANCIAL_STATEMENTS_MISSING",
      "STRUCTURED_FINANCIAL_STATEMENTS_NOT_PREVIEW_READY",
      "STATUTORY_SOURCE_REJECTED",
      "CURRENT_WORKPAPER_MISSING",
      "CURRENT_WORKPAPER_NOT_REVIEWED",
      "DOCUMENT_UNVERIFIED",
      "EXPORT_PACK_MISSING",
      "EXPORT_PACK_BASIS_MISMATCH",
      "STALE_WORKPAPERS_EXCLUDED",
      "DOCUMENT_REJECTED_INCLUDED_AS_TRACE",
      "NO_DOCUMENT_ATTACHED",
      "LEGACY_MAPPING_FALLBACK_USED"
    ]),
    message: z.string(),
    source: z.enum([
      "CONTROLS",
      "FINANCIAL_STATEMENTS_STRUCTURED",
      "WORKPAPERS",
      "DOCUMENTS",
      "EXPORT_PACK"
    ]),
    target: minimalAnnexIssueTargetSchema.nullable()
  })
  .strict();

const structuredStatementBreakdownSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    breakdownType: z.enum(["SECTION", "LEGACY_BUCKET_FALLBACK"]),
    total: z.string()
  })
  .strict();

const structuredStatementGroupSchema = z
  .object({
    code: z.string(),
    label: z.string(),
    total: z.string(),
    breakdowns: z.array(structuredStatementBreakdownSchema)
  })
  .strict();

const structuredBalanceSheetSchema = z
  .object({
    groups: z.array(structuredStatementGroupSchema),
    totals: z
      .object({
        totalAssets: z.string(),
        totalLiabilities: z.string(),
        totalEquity: z.string(),
        currentPeriodResult: z.string(),
        totalLiabilitiesAndEquity: z.string()
      })
      .strict()
  })
  .strict();

const structuredIncomeStatementSchema = z
  .object({
    groups: z.array(structuredStatementGroupSchema),
    totals: z
      .object({
        totalRevenue: z.string(),
        totalExpenses: z.string(),
        netResult: z.string()
      })
      .strict()
  })
  .strict();

const minimalAnnexFinancialStatementsSchema = z
  .object({
    presentationType: z.literal("STRUCTURED_PREVIEW"),
    latestImportVersion: z.number().int().positive(),
    taxonomyVersion: z.number().int().positive(),
    balanceSheet: structuredBalanceSheetSchema,
    incomeStatement: structuredIncomeStatementSchema
  })
  .strict();

const minimalAnnexDocumentTraceSchema = z
  .object({
    documentId: uuidSchema,
    fileName: z.string().min(1),
    mediaType: z.string().min(1),
    byteSize: z.number().int().positive(),
    checksumSha256: z.string().regex(/^[0-9a-f]{64}$/),
    sourceLabel: z.string(),
    documentDate: isoDateSchema.nullable(),
    verificationStatus: z.enum(["VERIFIED", "REJECTED"]),
    evidenceRole: z.enum(["VERIFIED_SUPPORT", "REJECTED_TRACE"])
  })
  .strict();

const minimalAnnexWorkpaperSchema = z
  .object({
    anchorCode: z.string(),
    anchorLabel: z.string(),
    summaryBucketCode: z.string(),
    statementKind: z.enum(["BALANCE_SHEET", "INCOME_STATEMENT"]),
    breakdownType: z.enum(["SECTION", "LEGACY_BUCKET_FALLBACK"]),
    workpaperId: uuidSchema,
    noteText: z.string(),
    reviewedAt: isoDateTimeSchema.nullable(),
    reviewedByUserId: uuidSchema.nullable(),
    documents: z.array(minimalAnnexDocumentTraceSchema)
  })
  .strict();

const minimalAnnexEvidenceSummarySchema = z
  .object({
    currentWorkpaperCount: z.number().int().nonnegative(),
    attachedDocumentCount: z.number().int().nonnegative(),
    verifiedDocumentCount: z.number().int().nonnegative(),
    rejectedDocumentTraceCount: z.number().int().nonnegative(),
    staleWorkpaperExcludedCount: z.number().int().nonnegative(),
    currentWorkpaperWithoutDocumentCount: z.number().int().nonnegative()
  })
  .strict();

const minimalAnnexContentSchema = z
  .object({
    financialStatements: minimalAnnexFinancialStatementsSchema,
    workpapers: z.array(minimalAnnexWorkpaperSchema),
    evidenceSummary: minimalAnnexEvidenceSummarySchema,
    preparationLimits: z.array(z.string()).min(1)
  })
  .strict();

const minimalAnnexReadModelSchema = z
  .object({
    closingFolderId: uuidSchema,
    closingFolderStatus: z.enum(["DRAFT", "ARCHIVED"]),
    readiness: z.enum(["READY", "BLOCKED"]),
    annexState: z.enum(["READY", "BLOCKED"]),
    presentationType: z.literal("MINIMAL_OPERATIONAL_ANNEX"),
    isStatutory: z.literal(false),
    requiresHumanReview: z.literal(true),
    legalNotice: minimalAnnexLegalNoticeSchema,
    basis: minimalAnnexBasisSchema,
    blockers: z.array(minimalAnnexIssueSchema),
    warnings: z.array(minimalAnnexIssueSchema),
    annex: minimalAnnexContentSchema.nullable()
  })
  .strict();

export type MinimalAnnexReadModel = z.infer<typeof minimalAnnexReadModelSchema>;
export type MinimalAnnexBasis = z.infer<typeof minimalAnnexBasisSchema>;
export type MinimalAnnexIssue = z.infer<typeof minimalAnnexIssueSchema>;
export type MinimalAnnexEvidenceSummary = z.infer<
  typeof minimalAnnexEvidenceSummarySchema
>;

export type MinimalAnnexShellState =
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
  | { kind: "ready"; minimalAnnex: MinimalAnnexReadModel };

export async function loadMinimalAnnexShellState(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<MinimalAnnexShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/minimal-annex`,
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
    const minimalAnnex = parseMinimalAnnexPayload(payload, closingFolderId);

    if (minimalAnnex === null) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      minimalAnnex
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

function parseMinimalAnnexPayload(payload: unknown, closingFolderId: string) {
  if (payload === undefined || containsForbiddenMinimalAnnexPayloadLeak(payload)) {
    return null;
  }

  const parsed = minimalAnnexReadModelSchema.safeParse(payload);

  if (!parsed.success || !isMinimalAnnexCoherent(parsed.data, closingFolderId)) {
    return null;
  }

  return parsed.data;
}

function isMinimalAnnexCoherent(
  minimalAnnex: MinimalAnnexReadModel,
  closingFolderId: string
) {
  if (minimalAnnex.closingFolderId !== closingFolderId) {
    return false;
  }

  if (minimalAnnex.readiness !== minimalAnnex.annexState) {
    return false;
  }

  if (minimalAnnex.annexState === "READY") {
    return minimalAnnex.annex !== null;
  }

  return minimalAnnex.annex === null;
}

function containsForbiddenMinimalAnnexPayloadLeak(value: unknown): boolean {
  if (typeof value === "string") {
    return isLikelyPrivateStorageReference(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenMinimalAnnexPayloadLeak(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, nestedValue]) => {
      if (forbiddenMinimalAnnexPayloadKeys.has(key)) {
        return true;
      }

      return containsForbiddenMinimalAnnexPayloadLeak(nestedValue);
    });
  }

  return false;
}

function isLikelyPrivateStorageReference(value: string) {
  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();

  return (
    lower.startsWith("gs://") ||
    lower.startsWith("s3://") ||
    lower.startsWith("file:") ||
    lower.includes("storage.googleapis.com") ||
    lower.includes("s3.amazonaws.com") ||
    lower.includes(".s3.") ||
    lower.includes("blob.core.windows.net") ||
    lower.includes("x-amz-" + "signature=") ||
    lower.includes("x-goog-" + "signature=") ||
    lower.includes("x-goog-credential=") ||
    /^[a-z]:[\\/]/i.test(trimmed) ||
    trimmed.startsWith("/") ||
    trimmed.startsWith("\\\\")
  );
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
