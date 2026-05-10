import { z } from "zod";
import type { ClosingFolderSummary } from "./closing-folders";
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  requestJson,
  type Fetcher
} from "./http";
import type { ActiveTenant } from "./me";

const uploadedDocumentMediaTypes = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
] as const;

const closingFolderStatusSchema = z.enum(["DRAFT", "ARCHIVED"]);
const workpaperReadinessSchema = z.enum(["READY", "BLOCKED"]);
const workpaperStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "REVIEWED"
]);
const makerWorkpaperStatusSchema = z.enum(["DRAFT", "READY_FOR_REVIEW"]);
const uploadedDocumentMediaTypeSchema = z.enum(uploadedDocumentMediaTypes);

const documentVerificationStatusSchema = z.enum(["UNVERIFIED", "VERIFIED", "REJECTED"]);
const documentVerificationDecisionSchema = z.enum(["VERIFIED", "REJECTED"]);

const uuidSchema = z.string().uuid();
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)));
const checksumSha256Schema = z.string().regex(/^[0-9a-f]{64}$/);

const forbiddenWorkpapersPayloadKeys = new Set([
  ".env",
  "credential",
  "dsn",
  "gcspath",
  "gcs_path",
  "objectkey",
  "object_key",
  "objectpath",
  "object_path",
  "privatepath",
  "private_path",
  "secret",
  "signedurl",
  "signed_url",
  "sourcefingerprint",
  "source_fingerprint",
  "storagebackend",
  "storage_backend",
  "storageobjectkey",
  "storage_object_key",
  "storagepath",
  "storage_path",
  "token",
  "x-amz-credential",
  "x-amz-signature",
  "x-goog-credential",
  "x-goog-signature"
]);

const summaryCountsSchema = z
  .object({
    totalCurrentAnchors: z.number().int().nonnegative(),
    withWorkpaperCount: z.number().int().nonnegative(),
    readyForReviewCount: z.number().int().nonnegative(),
    reviewedCount: z.number().int().nonnegative(),
    staleCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative()
  })
  .strict();

const workpaperBlockerSchema = z
  .object({
    code: z.string(),
    message: z.string()
  })
  .strict();

const workpaperNextActionSchema = z
  .object({
    code: z.string(),
    path: z.string(),
    actionable: z.boolean()
  })
  .strict();

const documentSummaryMetadataSchema = {
  id: z.unknown().optional(),
  fileName: z.string(),
  mediaType: z.string(),
  byteSize: z.number().int().positive().max(25 * 1024 * 1024).optional(),
  checksumSha256: checksumSha256Schema.optional(),
  sourceLabel: z.string(),
  documentDate: isoDateSchema.nullable().optional(),
  createdAt: isoDateTimeSchema.optional(),
  createdByUserId: uuidSchema.optional(),
  verificationStatus: documentVerificationStatusSchema,
  reviewComment: z.string().nullable(),
  reviewedAt: isoDateTimeSchema.nullable().optional(),
  reviewedByUserId: uuidSchema.nullable().optional()
};

const workpaperDocumentSchema = z.object(documentSummaryMetadataSchema).strict();

const documentVerificationSummarySchema = z
  .object({
    documentsCount: z.number().int().nonnegative(),
    unverifiedCount: z.number().int().nonnegative(),
    verifiedCount: z.number().int().nonnegative(),
    rejectedCount: z.number().int().nonnegative()
  })
  .strict();

const workpaperEvidenceSchema = z
  .object({
    id: uuidSchema.optional(),
    position: z.number().int().positive(),
    fileName: z.string(),
    mediaType: z.string(),
    documentDate: isoDateSchema.nullable(),
    sourceLabel: z.string(),
    verificationStatus: documentVerificationStatusSchema,
    externalReference: z.string().nullable(),
    checksumSha256: z.string().nullable()
  })
  .strict();

const workpaperDetailsSchema = z
  .object({
    id: uuidSchema.optional(),
    status: workpaperStatusSchema,
    noteText: z.string(),
    reviewComment: z.string().nullable().optional(),
    basisImportVersion: z.number().int().positive().optional(),
    basisTaxonomyVersion: z.number().int().positive().optional(),
    createdAt: isoDateTimeSchema.optional(),
    createdByUserId: uuidSchema.optional(),
    updatedAt: isoDateTimeSchema.optional(),
    updatedByUserId: uuidSchema.optional(),
    reviewedAt: isoDateTimeSchema.nullable().optional(),
    reviewedByUserId: uuidSchema.nullable().optional(),
    evidences: z.array(workpaperEvidenceSchema)
  })
  .strict();

const workpaperItemSchema = z
  .object({
    anchorCode: z.string(),
    anchorLabel: z.string(),
    summaryBucketCode: z.string().optional(),
    statementKind: z.enum(["BALANCE_SHEET", "INCOME_STATEMENT"]),
    breakdownType: z.enum(["SECTION", "LEGACY_BUCKET_FALLBACK"]),
    isCurrentStructure: z.boolean(),
    workpaper: workpaperDetailsSchema.nullable(),
    documents: z.array(workpaperDocumentSchema),
    documentVerificationSummary: documentVerificationSummarySchema.nullable()
  })
  .strict();

const closingWorkpapersSchema = z
  .object({
    closingFolderId: uuidSchema,
    closingFolderStatus: closingFolderStatusSchema,
    readiness: workpaperReadinessSchema,
    latestImportVersion: z.number().int().positive().nullable().optional(),
    blockers: z.array(workpaperBlockerSchema).optional(),
    nextAction: workpaperNextActionSchema.nullable().optional(),
    summaryCounts: summaryCountsSchema,
    items: z.array(workpaperItemSchema),
    staleWorkpapers: z.array(workpaperItemSchema)
  })
  .strict();

const workpaperMutationSuccessSchema = z
  .object({
    anchorCode: z.string(),
    anchorLabel: z.string().optional(),
    summaryBucketCode: z.string().optional(),
    statementKind: z.enum(["BALANCE_SHEET", "INCOME_STATEMENT"]).optional(),
    breakdownType: z.enum(["SECTION", "LEGACY_BUCKET_FALLBACK"]).optional(),
    isCurrentStructure: z.boolean(),
    workpaper: workpaperDetailsSchema.extend({
      status: makerWorkpaperStatusSchema
    }),
    documents: z.array(workpaperDocumentSchema).optional(),
    documentVerificationSummary: documentVerificationSummarySchema.nullable().optional()
  })
  .strict();

const documentUploadSuccessSchema = z
  .object({
    id: uuidSchema,
    fileName: z.string().min(1),
    mediaType: uploadedDocumentMediaTypeSchema,
    byteSize: z.number().int().positive().max(25 * 1024 * 1024),
    checksumSha256: checksumSha256Schema,
    sourceLabel: z.string(),
    documentDate: isoDateSchema.nullable(),
    createdAt: isoDateTimeSchema,
    createdByUserId: uuidSchema,
    verificationStatus: z.literal("UNVERIFIED"),
    reviewComment: z.null(),
    reviewedAt: z.null(),
    reviewedByUserId: z.null()
  })
  .strict();

const documentVerificationDecisionSuccessSchema = z
  .object({
    ...documentSummaryMetadataSchema,
    id: uuidSchema,
    mediaType: uploadedDocumentMediaTypeSchema.optional(),
    verificationStatus: documentVerificationDecisionSchema
  })
  .strict();

const workpaperReviewDecisionSuccessSchema = z
  .object({
    anchorCode: z.string(),
    anchorLabel: z.string().optional(),
    summaryBucketCode: z.string().optional(),
    statementKind: z.enum(["BALANCE_SHEET", "INCOME_STATEMENT"]).optional(),
    breakdownType: z.enum(["SECTION", "LEGACY_BUCKET_FALLBACK"]).optional(),
    isCurrentStructure: z.boolean(),
    workpaper: workpaperDetailsSchema.extend({
      status: workpaperStatusSchema,
      reviewComment: z.string().nullable()
    }),
    documents: z.array(workpaperDocumentSchema).optional(),
    documentVerificationSummary: documentVerificationSummarySchema.nullable().optional()
  })
  .strict();

export const DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES = uploadedDocumentMediaTypes;
export const DOCUMENT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export type ClosingFolderWorkpaperStatus = z.infer<typeof closingFolderStatusSchema>;
export type WorkpaperReadiness = z.infer<typeof workpaperReadinessSchema>;
export type WorkpaperStatus = z.infer<typeof workpaperStatusSchema>;
export type MakerWorkpaperStatus = z.infer<typeof makerWorkpaperStatusSchema>;
export type DocumentVerificationStatus = z.infer<typeof documentVerificationStatusSchema>;
export type DocumentVerificationDecision = z.infer<typeof documentVerificationDecisionSchema>;
export type WorkpaperReviewDecision = "REVIEWED" | "CHANGES_REQUESTED";
export type WorkpaperSummaryCounts = z.infer<typeof summaryCountsSchema>;
export type WorkpaperDocument = z.infer<typeof workpaperDocumentSchema>;
export type DocumentVerificationSummary = z.infer<typeof documentVerificationSummarySchema>;
export type WorkpaperEvidence = z.infer<typeof workpaperEvidenceSchema>;
export type WorkpaperDetails = z.infer<typeof workpaperDetailsSchema>;
export type WorkpaperReadModelItem = z.infer<typeof workpaperItemSchema>;
export type ClosingWorkpapersReadModel = z.infer<typeof closingWorkpapersSchema>;
export type UpsertWorkpaperRequest = {
  anchorCode: string;
  noteText: string;
  status: MakerWorkpaperStatus;
  evidences: WorkpaperEvidence[];
};
export type UploadWorkpaperDocumentRequest = {
  anchorCode: string;
  file: File;
  sourceLabel: string;
  documentDate: string | null;
};
export type DownloadWorkpaperDocumentRequest = {
  documentId: string;
};
export type ReviewDocumentVerificationDecisionRequest =
  | {
      documentId: string;
      decision: "VERIFIED";
    }
  | {
      documentId: string;
      decision: "REJECTED";
      comment: string;
    };
export type ReviewWorkpaperDecisionRequest =
  | {
      anchorCode: string;
      decision: "REVIEWED";
    }
  | {
      anchorCode: string;
      decision: "CHANGES_REQUESTED";
      comment: string;
    };

export type WorkpapersShellState =
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
  | { kind: "ready"; workpapers: ClosingWorkpapersReadModel };

export type UpsertWorkpaperState =
  | { kind: "success" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_not_ready" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export type UploadWorkpaperDocumentState =
  | { kind: "success" }
  | { kind: "bad_request" }
  | { kind: "bad_request_invalid_media_type" }
  | { kind: "bad_request_empty_file" }
  | { kind: "bad_request_source_required" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_not_ready" }
  | { kind: "conflict_stale" }
  | { kind: "conflict_workpaper_read_only" }
  | { kind: "conflict_other" }
  | { kind: "payload_too_large" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export type DownloadWorkpaperDocumentState =
  | {
      kind: "success";
      blob: Blob;
      contentDisposition: string | null;
      contentType: string | null;
    }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "unexpected" };

export type ReviewDocumentVerificationDecisionState =
  | { kind: "success" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_not_ready" }
  | { kind: "conflict_stale" }
  | { kind: "conflict_workpaper_status" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export type ReviewWorkpaperDecisionState =
  | { kind: "success" }
  | { kind: "comment_required" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export async function loadWorkpapersShellState(
  closingFolderId: string,
  closingFolder: ClosingFolderSummary,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<WorkpapersShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/workpapers`,
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

    if (payload === undefined || containsForbiddenWorkpapersPayloadLeak(payload)) {
      return { kind: "invalid_payload" };
    }

    const parsed = closingWorkpapersSchema.safeParse(payload);

    if (!parsed.success || !isClosingWorkpapersCoherent(parsed.data, closingFolderId, closingFolder)) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      workpapers: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

export async function upsertWorkpaper(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  request: UpsertWorkpaperRequest,
  fetcher: Fetcher = fetch
): Promise<UpsertWorkpaperState> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/workpapers/${encodeURIComponent(request.anchorCode)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": activeTenant.tenantId
        },
        body: JSON.stringify({
          noteText: request.noteText,
          status: request.status,
          evidences: request.evidences
        })
      },
      fetcher
    );

    if (response.status === 200 || response.status === 201) {
      const payload = await readJsonBody(response);

      if (payload === undefined || containsForbiddenWorkpapersPayloadLeak(payload)) {
        return { kind: "invalid_payload" };
      }

      const parsed = workpaperMutationSuccessSchema.safeParse(payload);

      if (
        !parsed.success ||
        !isUpsertWorkpaperSuccessCoherent(parsed.data, request)
      ) {
        return { kind: "invalid_payload" };
      }

      return { kind: "success" };
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
      return refineConflictForUpsert(await readErrorMessage(response));
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

export async function uploadWorkpaperDocument(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  request: UploadWorkpaperDocumentRequest,
  fetcher: Fetcher = fetch
): Promise<UploadWorkpaperDocumentState> {
  try {
    const formData = new FormData();
    formData.append("file", request.file);
    formData.append("sourceLabel", request.sourceLabel);
    if (request.documentDate !== null) {
      formData.append("documentDate", request.documentDate);
    }

    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/workpapers/${encodeURIComponent(request.anchorCode)}/documents`,
      {
        method: "POST",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        },
        body: formData
      },
      fetcher
    );

    if (response.status === 201) {
      const payload = await readJsonBody(response);

      if (payload === undefined || containsForbiddenWorkpapersPayloadLeak(payload)) {
        return { kind: "invalid_payload" };
      }

      const parsed = documentUploadSuccessSchema.safeParse(payload);

      if (!parsed.success || !isUploadedDocumentCoherent(parsed.data, request)) {
        return { kind: "invalid_payload" };
      }

      return { kind: "success" };
    }

    if (response.status === 400) {
      return refineBadRequestForUpload(await readErrorMessage(response));
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
      return refineConflictForUpload(await readErrorMessage(response));
    }

    if (response.status === 413) {
      return { kind: "payload_too_large" };
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

export async function downloadWorkpaperDocument(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  request: DownloadWorkpaperDocumentRequest,
  fetcher: Fetcher = fetch
): Promise<DownloadWorkpaperDocumentState> {
  const controller = new AbortController();
  let timeoutId = 0;

  try {
    const response = await Promise.race([
      fetcher(
        `/api/closing-folders/${encodeURIComponent(closingFolderId)}/documents/${encodeURIComponent(request.documentId)}/content`,
        {
          method: "GET",
          headers: {
            "X-Tenant-Id": activeTenant.tenantId
          },
          signal: controller.signal
        }
      ),
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => {
          controller.abort();
          reject(new Error("timeout"));
        }, DEFAULT_REQUEST_TIMEOUT_MS);
      })
    ]);

    if (response.status === 200) {
      try {
        const blob = await response.blob();

        return {
          kind: "success",
          blob,
          contentDisposition: normalizeOptionalHeaderValue(
            response.headers.get("Content-Disposition")
          ),
          contentType: normalizeOptionalHeaderValue(response.headers.get("Content-Type"))
        };
      } catch {
        return { kind: "unexpected" };
      }
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

    return { kind: "unexpected" };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function reviewDocumentVerificationDecision(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  request: ReviewDocumentVerificationDecisionRequest,
  fetcher: Fetcher = fetch
): Promise<ReviewDocumentVerificationDecisionState> {
  const body =
    request.decision === "VERIFIED"
      ? { decision: "VERIFIED" as const }
      : { decision: "REJECTED" as const, comment: request.comment.trim() };

  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/documents/${encodeURIComponent(request.documentId)}/verification-decision`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": activeTenant.tenantId
        },
        body: JSON.stringify(body)
      },
      fetcher
    );

    if (response.status === 200) {
      const payload = await readJsonBody(response);

      if (payload === undefined || containsForbiddenWorkpapersPayloadLeak(payload)) {
        return { kind: "invalid_payload" };
      }

      const parsed = documentVerificationDecisionSuccessSchema.safeParse(payload);

      if (
        !parsed.success ||
        !isDocumentVerificationDecisionSuccessCoherent(parsed.data, request)
      ) {
        return { kind: "invalid_payload" };
      }

      return { kind: "success" };
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
      return refineConflictForDocumentVerification(await readErrorMessage(response));
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

export async function reviewWorkpaperDecision(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  request: ReviewWorkpaperDecisionRequest,
  fetcher: Fetcher = fetch
): Promise<ReviewWorkpaperDecisionState> {
  let body:
    | { decision: "REVIEWED" }
    | { decision: "CHANGES_REQUESTED"; comment: string };

  if (request.decision === "CHANGES_REQUESTED") {
    const trimmedComment = request.comment.trim();

    if (trimmedComment.length === 0) {
      return { kind: "comment_required" };
    }

    body = { decision: "CHANGES_REQUESTED", comment: trimmedComment };
  } else {
    body = { decision: "REVIEWED" };
  }

  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/workpapers/${encodeURIComponent(request.anchorCode)}/review-decision`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": activeTenant.tenantId
        },
        body: JSON.stringify(body)
      },
      fetcher
    );

    if (response.status === 200) {
      const payload = await readJsonBody(response);

      if (payload === undefined || containsForbiddenWorkpapersPayloadLeak(payload)) {
        return { kind: "invalid_payload" };
      }

      const parsed = workpaperReviewDecisionSuccessSchema.safeParse(payload);

      if (!parsed.success || !isWorkpaperReviewDecisionSuccessCoherent(parsed.data, request)) {
        return { kind: "invalid_payload" };
      }

      return { kind: "success" };
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
      return { kind: "conflict_other" };
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

function isClosingWorkpapersCoherent(
  workpapers: ClosingWorkpapersReadModel,
  closingFolderId: string,
  closingFolder: ClosingFolderSummary
) {
  if (
    workpapers.closingFolderId !== closingFolderId ||
    workpapers.closingFolderId !== closingFolder.id
  ) {
    return false;
  }

  if (workpapers.summaryCounts.totalCurrentAnchors !== workpapers.items.length) {
    return false;
  }

  if (
    workpapers.summaryCounts.withWorkpaperCount !==
    workpapers.items.filter((item) => item.workpaper !== null).length
  ) {
    return false;
  }

  if (
    workpapers.summaryCounts.missingCount !==
    workpapers.items.filter((item) => item.workpaper === null).length
  ) {
    return false;
  }

  if (workpapers.summaryCounts.staleCount !== workpapers.staleWorkpapers.length) {
    return false;
  }

  if (
    workpapers.summaryCounts.readyForReviewCount !==
    workpapers.items.filter((item) => item.workpaper?.status === "READY_FOR_REVIEW").length
  ) {
    return false;
  }

  if (
    workpapers.summaryCounts.reviewedCount !==
    workpapers.items.filter((item) => item.workpaper?.status === "REVIEWED").length
  ) {
    return false;
  }

  if (!workpapers.items.every((item) => isWorkpaperItemCoherent(item, true))) {
    return false;
  }

  if (!workpapers.staleWorkpapers.every((item) => isWorkpaperItemCoherent(item, false))) {
    return false;
  }

  return true;
}

function isUpsertWorkpaperSuccessCoherent(
  payload: z.infer<typeof workpaperMutationSuccessSchema>,
  request: UpsertWorkpaperRequest
) {
  return (
    payload.anchorCode === request.anchorCode &&
    payload.isCurrentStructure &&
    payload.workpaper.status === request.status &&
    payload.workpaper.noteText === request.noteText &&
    areWorkpaperEvidenceListsEqual(payload.workpaper.evidences, request.evidences)
  );
}

function isUploadedDocumentCoherent(
  payload: z.infer<typeof documentUploadSuccessSchema>,
  request: UploadWorkpaperDocumentRequest
) {
  const normalizedFileType = normalizeUploadedDocumentMediaType(request.file.type);

  return (
    payload.byteSize === request.file.size &&
    payload.sourceLabel === request.sourceLabel &&
    payload.documentDate === request.documentDate &&
    (normalizedFileType === null || payload.mediaType === normalizedFileType) &&
    isDateTimeString(payload.createdAt)
  );
}

function isDocumentVerificationDecisionSuccessCoherent(
  payload: z.infer<typeof documentVerificationDecisionSuccessSchema>,
  request: ReviewDocumentVerificationDecisionRequest
) {
  if (payload.id !== request.documentId || payload.verificationStatus !== request.decision) {
    return false;
  }

  if (request.decision === "VERIFIED") {
    return payload.reviewComment === null;
  }

  return payload.reviewComment === request.comment.trim();
}

function isWorkpaperReviewDecisionSuccessCoherent(
  payload: z.infer<typeof workpaperReviewDecisionSuccessSchema>,
  request: ReviewWorkpaperDecisionRequest
) {
  if (
    payload.anchorCode !== request.anchorCode ||
    !payload.isCurrentStructure ||
    payload.workpaper.status !== request.decision
  ) {
    return false;
  }

  if (request.decision === "REVIEWED") {
    return payload.workpaper.reviewComment === null;
  }

  return payload.workpaper.reviewComment === request.comment.trim();
}

function isWorkpaperItemCoherent(item: WorkpaperReadModelItem, isCurrentStructure: boolean) {
  if (item.isCurrentStructure !== isCurrentStructure) {
    return false;
  }

  if (item.workpaper === null) {
    return (
      isCurrentStructure &&
      item.documents.length === 0 &&
      item.documentVerificationSummary === null
    );
  }

  if (item.documentVerificationSummary === null) {
    return false;
  }

  return isDocumentVerificationSummaryCoherent(item.documents, item.documentVerificationSummary);
}

function areWorkpaperEvidenceListsEqual(
  left: WorkpaperEvidence[],
  right: WorkpaperEvidence[]
) {
  return (
    left.length === right.length &&
    left.every((evidence, index) => {
      const compared = right[index];

      return (
        compared !== undefined &&
        evidence.position === compared.position &&
        evidence.fileName === compared.fileName &&
        evidence.mediaType === compared.mediaType &&
        evidence.documentDate === compared.documentDate &&
        evidence.sourceLabel === compared.sourceLabel &&
        evidence.verificationStatus === compared.verificationStatus &&
        evidence.externalReference === compared.externalReference &&
        evidence.checksumSha256 === compared.checksumSha256
      );
    })
  );
}

function isDocumentVerificationSummaryCoherent(
  documents: WorkpaperDocument[],
  summary: DocumentVerificationSummary
) {
  const unverifiedCount = documents.filter(
    (document) => document.verificationStatus === "UNVERIFIED"
  ).length;
  const verifiedCount = documents.filter(
    (document) => document.verificationStatus === "VERIFIED"
  ).length;
  const rejectedCount = documents.filter(
    (document) => document.verificationStatus === "REJECTED"
  ).length;
  const documentsCount = documents.length;

  return (
    summary.documentsCount === documentsCount &&
    summary.documentsCount ===
      summary.unverifiedCount + summary.verifiedCount + summary.rejectedCount &&
    summary.unverifiedCount === unverifiedCount &&
    summary.verifiedCount === verifiedCount &&
    summary.rejectedCount === rejectedCount
  );
}

function containsForbiddenWorkpapersPayloadLeak(value: unknown): boolean {
  if (typeof value === "string") {
    return isLikelyPrivateWorkpapersReference(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenWorkpapersPayloadLeak(item));
  }

  if (value !== null && typeof value === "object") {
    return Object.entries(value).some(([key, nestedValue]) => {
      if (isForbiddenWorkpapersPayloadKey(key)) {
        return true;
      }

      return containsForbiddenWorkpapersPayloadLeak(nestedValue);
    });
  }

  return false;
}

function isForbiddenWorkpapersPayloadKey(key: string) {
  return forbiddenWorkpapersPayloadKeys.has(key.trim().toLowerCase());
}

function isLikelyPrivateWorkpapersReference(value: string) {
  const lower = value.trim().toLowerCase();

  return (
    lower.includes("gs://") ||
    lower.includes("s3://") ||
    lower.includes("storage.googleapis.com") ||
    lower.includes("x-goog-signature") ||
    lower.includes(".env") ||
    /(^|[^a-z0-9])(secret|token|credential|dsn)([^a-z0-9]|$)/i.test(value)
  );
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function refineConflictForUpsert(message: string | undefined): UpsertWorkpaperState {
  if (message === "Closing folder is archived and workpapers cannot be modified.") {
    return { kind: "conflict_archived" };
  }

  if (message === "Workpapers can only be modified when controls.readiness is READY.") {
    return { kind: "conflict_not_ready" };
  }

  return { kind: "conflict_other" };
}

function refineBadRequestForUpload(message: string | undefined): UploadWorkpaperDocumentState {
  if (message === "file.mediaType is not allowed.") {
    return { kind: "bad_request_invalid_media_type" };
  }

  if (message === "file must not be empty.") {
    return { kind: "bad_request_empty_file" };
  }

  if (message === "sourceLabel must not be blank.") {
    return { kind: "bad_request_source_required" };
  }

  return { kind: "bad_request" };
}

function refineConflictForUpload(message: string | undefined): UploadWorkpaperDocumentState {
  if (message === "Closing folder is archived and documents cannot be modified.") {
    return { kind: "conflict_archived" };
  }

  if (message === "Documents can only be modified when controls.readiness is READY.") {
    return { kind: "conflict_not_ready" };
  }

  if (message === "anchorCode is not part of the current structure.") {
    return { kind: "conflict_stale" };
  }

  if (message === "workpaper status does not allow document uploads.") {
    return { kind: "conflict_workpaper_read_only" };
  }

  return { kind: "conflict_other" };
}

function refineConflictForDocumentVerification(
  message: string | undefined
): ReviewDocumentVerificationDecisionState {
  if (message === "Closing folder is archived and documents cannot be modified.") {
    return { kind: "conflict_archived" };
  }

  if (message === "Documents can only be modified when controls.readiness is READY.") {
    return { kind: "conflict_not_ready" };
  }

  if (message === "document belongs to a stale workpaper.") {
    return { kind: "conflict_stale" };
  }

  if (message === "document verification requires a workpaper in READY_FOR_REVIEW.") {
    return { kind: "conflict_workpaper_status" };
  }

  return { kind: "conflict_other" };
}

async function readErrorMessage(response: Response) {
  const payload = await readJsonBody(response);
  const parsed = z.object({ message: z.string().min(1) }).safeParse(payload);
  return parsed.success ? parsed.data.message : undefined;
}

function normalizeUploadedDocumentMediaType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.split(";")[0]?.trim() ?? null;
}

function isDateTimeString(value: string) {
  return !Number.isNaN(Date.parse(value));
}

function normalizeOptionalHeaderValue(value: string | null) {
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
