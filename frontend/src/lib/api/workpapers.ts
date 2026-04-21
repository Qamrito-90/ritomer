import { z } from "zod";
import type { ClosingFolderSummary } from "./closing-folders";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const workpaperStatusSchema = z.enum([
  "DRAFT",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "REVIEWED"
]);

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

const workpaperDetailsSchema = z.object({
  status: workpaperStatusSchema,
  noteText: z.string()
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
  summaryCounts: summaryCountsSchema,
  items: z.array(workpaperItemSchema),
  staleWorkpapers: z.array(workpaperItemSchema)
});

export type WorkpaperStatus = z.infer<typeof workpaperStatusSchema>;
export type DocumentVerificationStatus = z.infer<typeof documentVerificationStatusSchema>;
export type WorkpaperSummaryCounts = z.infer<typeof summaryCountsSchema>;
export type WorkpaperDocument = z.infer<typeof workpaperDocumentSchema>;
export type DocumentVerificationSummary = z.infer<typeof documentVerificationSummarySchema>;
export type WorkpaperDetails = z.infer<typeof workpaperDetailsSchema>;
export type WorkpaperReadModelItem = z.infer<typeof workpaperItemSchema>;
export type ClosingWorkpapersReadModel = z.infer<typeof closingWorkpapersSchema>;

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
