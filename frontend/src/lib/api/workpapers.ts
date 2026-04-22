import { z } from "zod";
import type { ClosingFolderSummary } from "./closing-folders";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const closingFolderStatusSchema = z.enum(["DRAFT", "ARCHIVED"]);
const workpaperReadinessSchema = z.enum(["READY", "BLOCKED"]);
const workpaperStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "REVIEWED"
]);
const makerWorkpaperStatusSchema = z.enum(["DRAFT", "READY_FOR_REVIEW"]);

const documentVerificationStatusSchema = z.enum(["UNVERIFIED", "VERIFIED", "REJECTED"]);

const summaryCountsSchema = z.object({
  totalCurrentAnchors: z.number().int().nonnegative(),
  withWorkpaperCount: z.number().int().nonnegative(),
  readyForReviewCount: z.number().int().nonnegative(),
  reviewedCount: z.number().int().nonnegative(),
  staleCount: z.number().int().nonnegative(),
  missingCount: z.number().int().nonnegative()
});

const workpaperDocumentSchema = z.object({
  fileName: z.string(),
  mediaType: z.string(),
  sourceLabel: z.string(),
  verificationStatus: documentVerificationStatusSchema
});

const documentVerificationSummarySchema = z.object({
  documentsCount: z.number().int().nonnegative(),
  unverifiedCount: z.number().int().nonnegative(),
  verifiedCount: z.number().int().nonnegative(),
  rejectedCount: z.number().int().nonnegative()
});

const workpaperEvidenceSchema = z.object({
  position: z.number().int().positive(),
  fileName: z.string(),
  mediaType: z.string(),
  documentDate: z.string().nullable(),
  sourceLabel: z.string(),
  verificationStatus: documentVerificationStatusSchema,
  externalReference: z.string().nullable(),
  checksumSha256: z.string().nullable()
});

const workpaperDetailsSchema = z.object({
  status: workpaperStatusSchema,
  noteText: z.string(),
  evidences: z.array(workpaperEvidenceSchema)
});

const workpaperItemSchema = z.object({
  anchorCode: z.string(),
  anchorLabel: z.string(),
  statementKind: z.enum(["BALANCE_SHEET", "INCOME_STATEMENT"]),
  breakdownType: z.enum(["SECTION", "LEGACY_BUCKET_FALLBACK"]),
  isCurrentStructure: z.boolean(),
  workpaper: workpaperDetailsSchema.nullable(),
  documents: z.array(workpaperDocumentSchema),
  documentVerificationSummary: documentVerificationSummarySchema.nullable()
});

const closingWorkpapersSchema = z.object({
  closingFolderId: z.string().uuid(),
  closingFolderStatus: closingFolderStatusSchema,
  readiness: workpaperReadinessSchema,
  summaryCounts: summaryCountsSchema,
  items: z.array(workpaperItemSchema),
  staleWorkpapers: z.array(workpaperItemSchema)
});

const workpaperMutationSuccessSchema = z.object({
  anchorCode: z.string(),
  isCurrentStructure: z.boolean(),
  workpaper: z.object({
    status: makerWorkpaperStatusSchema,
    noteText: z.string(),
    evidences: z.array(workpaperEvidenceSchema)
  })
});

export type ClosingFolderWorkpaperStatus = z.infer<typeof closingFolderStatusSchema>;
export type WorkpaperReadiness = z.infer<typeof workpaperReadinessSchema>;
export type WorkpaperStatus = z.infer<typeof workpaperStatusSchema>;
export type MakerWorkpaperStatus = z.infer<typeof makerWorkpaperStatusSchema>;
export type DocumentVerificationStatus = z.infer<typeof documentVerificationStatusSchema>;
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

    if (payload === undefined) {
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

      if (payload === undefined) {
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

async function readErrorMessage(response: Response) {
  const payload = await readJsonBody(response);
  const parsed = z.object({ message: z.string().min(1) }).safeParse(payload);
  return parsed.success ? parsed.data.message : undefined;
}
