import type { EffectiveRolesHint } from "../../lib/api/me";
import {
  DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES,
  DOCUMENT_UPLOAD_MAX_BYTES,
  type ClosingWorkpapersReadModel,
  type DocumentVerificationDecision,
  type MakerWorkpaperStatus,
  type WorkpaperDocument,
  type WorkpaperEvidence,
  type WorkpaperReadModelItem,
  type WorkpaperReviewDecision
} from "../../lib/api/workpapers";
import type {
  DocumentDecisionDraft,
  DocumentDecisionState,
  DocumentUploadDraft,
  DocumentUploadState,
  WorkpaperDecisionDraft,
  WorkpaperDecisionState,
  WorkpaperDraft,
  WorkpaperMutationState
} from "./types";

const workpaperWritableRoles = new Set(["ACCOUNTANT", "MANAGER", "ADMIN"]);
const workpaperReviewerRoles = new Set(["REVIEWER", "MANAGER", "ADMIN"]);
const documentReadableRoles = new Set(["ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN"]);
const documentReviewerRoles = new Set(["REVIEWER", "MANAGER", "ADMIN"]);
const documentUploadAllowedExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".csv",
  ".xls",
  ".xlsx"
]);

export const documentUploadInputAccept = [
  ...DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES,
  ...documentUploadAllowedExtensions
].join(",");

export function createWorkpaperDrafts(workpapers: ClosingWorkpapersReadModel) {
  return Object.fromEntries(
    workpapers.items.map((item) => [item.anchorCode, createWorkpaperDraft(item)])
  ) as Record<string, WorkpaperDraft>;
}

export function createDocumentUploadDrafts(workpapers: ClosingWorkpapersReadModel) {
  return Object.fromEntries(
    workpapers.items.map((item) => [item.anchorCode, createDocumentUploadDraft()])
  ) as Record<string, DocumentUploadDraft>;
}

export function createDocumentDecisionDrafts(workpapers: ClosingWorkpapersReadModel) {
  const entries = workpapers.items.flatMap((item) =>
    item.documents.flatMap((document) => {
      const documentId = getReadableDocumentId(document);

      return documentId === null ? [] : [[documentId, createDocumentDecisionDraft(document)]];
    })
  );

  return Object.fromEntries(entries) as Record<string, DocumentDecisionDraft>;
}

export function createWorkpaperDecisionDrafts(workpapers: ClosingWorkpapersReadModel) {
  return Object.fromEntries(
    workpapers.items.map((item) => [item.anchorCode, createWorkpaperDecisionDraft(item)])
  ) as Record<string, WorkpaperDecisionDraft>;
}

export function createWorkpaperDraft(item: WorkpaperReadModelItem): WorkpaperDraft {
  if (item.workpaper === null) {
    return {
      noteText: "",
      status: "DRAFT"
    };
  }

  if (item.workpaper.status === "CHANGES_REQUESTED") {
    return {
      noteText: item.workpaper.noteText,
      status: "DRAFT"
    };
  }

  return {
    noteText: item.workpaper.noteText,
    status: item.workpaper.status === "READY_FOR_REVIEW" ? "READY_FOR_REVIEW" : "DRAFT"
  };
}

export function createDocumentUploadDraft(): DocumentUploadDraft {
  return {
    file: null,
    selectedFileCount: 0,
    sourceLabel: "",
    documentDate: ""
  };
}

export function createDocumentDecisionDraft(document: WorkpaperDocument): DocumentDecisionDraft {
  return {
    decision: document.verificationStatus === "REJECTED" ? "REJECTED" : "VERIFIED",
    comment:
      typeof document.reviewComment === "string" && document.reviewComment.length > 0
        ? document.reviewComment
        : ""
  };
}

export function createWorkpaperDecisionDraft(
  item: WorkpaperReadModelItem
): WorkpaperDecisionDraft {
  return {
    decision: item.workpaper?.status === "CHANGES_REQUESTED" ? "CHANGES_REQUESTED" : "REVIEWED",
    comment:
      typeof item.workpaper?.reviewComment === "string" && item.workpaper.reviewComment.length > 0
        ? item.workpaper.reviewComment
        : ""
  };
}

export function getWorkpaperDraft(
  drafts: Record<string, WorkpaperDraft>,
  item: WorkpaperReadModelItem
) {
  return drafts[item.anchorCode] ?? createWorkpaperDraft(item);
}

export function getDocumentUploadDraft(
  drafts: Record<string, DocumentUploadDraft>,
  item: WorkpaperReadModelItem
) {
  return drafts[item.anchorCode] ?? createDocumentUploadDraft();
}

export function getDocumentDecisionDraft(
  drafts: Record<string, DocumentDecisionDraft>,
  document: WorkpaperDocument
) {
  const documentId = getReadableDocumentId(document);

  if (documentId === null) {
    return createDocumentDecisionDraft(document);
  }

  return drafts[documentId] ?? createDocumentDecisionDraft(document);
}

export function getWorkpaperDecisionDraft(
  drafts: Record<string, WorkpaperDecisionDraft>,
  item: WorkpaperReadModelItem
) {
  return drafts[item.anchorCode] ?? createWorkpaperDecisionDraft(item);
}

export function hasWorkpaperWritableRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => workpaperWritableRoles.has(role)) ?? false;
}

export function hasDocumentReadableRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => documentReadableRoles.has(role)) ?? false;
}

export function hasDocumentReviewerRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => documentReviewerRoles.has(role)) ?? false;
}

export function hasWorkpaperReviewerRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => workpaperReviewerRoles.has(role)) ?? false;
}

export function isMakerWorkpaperStatus(value: string): value is MakerWorkpaperStatus {
  return value === "DRAFT" || value === "READY_FOR_REVIEW";
}

export function isDocumentVerificationDecision(
  value: string
): value is DocumentVerificationDecision {
  return value === "VERIFIED" || value === "REJECTED";
}

export function isWorkpaperReviewDecision(value: string): value is WorkpaperReviewDecision {
  return value === "REVIEWED" || value === "CHANGES_REQUESTED";
}

export function isWorkpaperMakerEditable(item: WorkpaperReadModelItem) {
  return (
    item.workpaper === null ||
    item.workpaper.status === "DRAFT" ||
    item.workpaper.status === "CHANGES_REQUESTED"
  );
}

export function isWorkpaperDocumentUploadEditable(item: WorkpaperReadModelItem) {
  return (
    item.isCurrentStructure &&
    item.workpaper !== null &&
    (item.workpaper.status === "DRAFT" || item.workpaper.status === "CHANGES_REQUESTED")
  );
}

export function getDocumentDecisionAvailabilityMessage(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint,
  item: WorkpaperReadModelItem,
  document: WorkpaperDocument
) {
  if (workpapers.closingFolderStatus === "ARCHIVED") {
    return "dossier archive, verification document en lecture seule";
  }

  if (workpapers.readiness !== "READY") {
    return "verification document non modifiable tant que les controles ne sont pas READY";
  }

  if (!hasDocumentReviewerRole(effectiveRoles)) {
    return "verification reviewer en lecture seule";
  }

  if (!item.isCurrentStructure) {
    return "decision document indisponible";
  }

  if (item.workpaper === null || item.workpaper.status !== "READY_FOR_REVIEW") {
    return "decision document disponible quand le workpaper est READY_FOR_REVIEW";
  }

  if (getReadableDocumentId(document) === null) {
    return "decision document indisponible";
  }

  return null;
}

export function getWorkpaperDecisionAvailabilityMessage(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint,
  item: WorkpaperReadModelItem
) {
  if (workpapers.closingFolderStatus === "ARCHIVED") {
    return "workpaper decision unavailable for this status";
  }

  if (workpapers.readiness !== "READY") {
    return "workpaper decision unavailable for this status";
  }

  if (!hasWorkpaperReviewerRole(effectiveRoles)) {
    return "workpaper decision refused";
  }

  if (!item.isCurrentStructure || item.workpaper === null) {
    return "workpaper decision unavailable for this status";
  }

  if (item.workpaper.status !== "READY_FOR_REVIEW") {
    return "workpaper decision unavailable for this status";
  }

  return null;
}

export function getWorkpapersGlobalReadOnlyMessage(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint
) {
  if (workpapers.closingFolderStatus === "ARCHIVED") {
    return "dossier archive, workpaper en lecture seule";
  }

  if (workpapers.readiness !== "READY") {
    return "workpaper non modifiable tant que les controles ne sont pas READY";
  }

  if (!hasWorkpaperWritableRole(effectiveRoles)) {
    return "lecture seule";
  }

  return null;
}

export function getCurrentWorkpaperUploadAvailabilityMessage(
  item: WorkpaperReadModelItem,
  globalReadOnlyMessage: string | null
) {
  if (globalReadOnlyMessage !== null) {
    return null;
  }

  if (item.workpaper === null) {
    return "upload disponible apres creation du workpaper";
  }

  return null;
}

export function getCurrentWorkpaperReadOnlyMessage(
  item: WorkpaperReadModelItem,
  globalReadOnlyMessage: string | null
) {
  if (globalReadOnlyMessage !== null) {
    return null;
  }

  if (
    item.workpaper !== null &&
    (item.workpaper.status === "READY_FOR_REVIEW" || item.workpaper.status === "REVIEWED")
  ) {
    return "workpaper en lecture seule";
  }

  return null;
}

export function validateDocumentUploadDraft(
  draft: DocumentUploadDraft
):
  | {
      kind: "valid";
      file: File;
      sourceLabel: string;
      documentDate: string | null;
    }
  | { kind: "invalid"; message: string } {
  if (draft.selectedFileCount > 1) {
    return { kind: "invalid", message: "un seul fichier est autorise" };
  }

  if (draft.file === null) {
    return { kind: "invalid", message: "selectionner un fichier" };
  }

  if (!isDocumentUploadFileAllowed(draft.file)) {
    return { kind: "invalid", message: "format de fichier non autorise" };
  }

  if (draft.file.size <= 0) {
    return { kind: "invalid", message: "fichier vide" };
  }

  if (draft.file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    return { kind: "invalid", message: "fichier trop volumineux (25 MiB max)" };
  }

  const trimmedSourceLabel = draft.sourceLabel.trim();

  if (trimmedSourceLabel.length === 0) {
    return { kind: "invalid", message: "source du document requise" };
  }

  if (draft.documentDate !== "" && !isIsoDateOnly(draft.documentDate)) {
    return { kind: "invalid", message: "date document invalide" };
  }

  return {
    kind: "valid",
    file: draft.file,
    sourceLabel: trimmedSourceLabel,
    documentDate: draft.documentDate === "" ? null : draft.documentDate
  };
}

export function createWorkpaperEvidencePayload(
  item: WorkpaperReadModelItem
): WorkpaperEvidence[] | null {
  if (item.workpaper === null) {
    return [];
  }

  const evidences = item.workpaper.evidences;

  if (!Array.isArray(evidences) || !evidences.every(isWorkpaperEvidencePayload)) {
    return null;
  }

  return evidences.map((evidence) => ({
    position: evidence.position,
    fileName: evidence.fileName,
    mediaType: evidence.mediaType,
    documentDate: evidence.documentDate,
    sourceLabel: evidence.sourceLabel,
    verificationStatus: evidence.verificationStatus,
    externalReference: evidence.externalReference,
    checksumSha256: evidence.checksumSha256
  }));
}

export function isWorkpaperEvidencePayload(evidence: WorkpaperEvidence) {
  return (
    Number.isInteger(evidence.position) &&
    evidence.position > 0 &&
    typeof evidence.fileName === "string" &&
    typeof evidence.mediaType === "string" &&
    (typeof evidence.documentDate === "string" || evidence.documentDate === null) &&
    typeof evidence.sourceLabel === "string" &&
    (evidence.verificationStatus === "UNVERIFIED" ||
      evidence.verificationStatus === "VERIFIED" ||
      evidence.verificationStatus === "REJECTED") &&
    (typeof evidence.externalReference === "string" || evidence.externalReference === null) &&
    (typeof evidence.checksumSha256 === "string" || evidence.checksumSha256 === null)
  );
}

export function hasWorkpaperDraftChanges(
  item: WorkpaperReadModelItem,
  draft: WorkpaperDraft
) {
  if (item.workpaper === null) {
    return true;
  }

  return (
    draft.noteText.trim() !== item.workpaper.noteText || draft.status !== item.workpaper.status
  );
}

export function canUploadDocumentItem(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint,
  item: WorkpaperReadModelItem,
  draft: DocumentUploadDraft,
  mutationState: WorkpaperMutationState,
  documentUploadState: DocumentUploadState
) {
  if (mutationState.kind === "submitting" || documentUploadState.kind === "submitting") {
    return false;
  }

  if (getWorkpapersGlobalReadOnlyMessage(workpapers, effectiveRoles) !== null) {
    return false;
  }

  if (!isWorkpaperDocumentUploadEditable(item)) {
    return false;
  }

  return validateDocumentUploadDraft(draft).kind === "valid";
}

export function canSaveWorkpaperItem(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint,
  item: WorkpaperReadModelItem,
  draft: WorkpaperDraft,
  mutationState: WorkpaperMutationState
) {
  if (mutationState.kind === "submitting") {
    return false;
  }

  if (getWorkpapersGlobalReadOnlyMessage(workpapers, effectiveRoles) !== null) {
    return false;
  }

  if (!item.isCurrentStructure || !isWorkpaperMakerEditable(item)) {
    return false;
  }

  if (!isMakerWorkpaperStatus(draft.status) || draft.noteText.trim().length === 0) {
    return false;
  }

  if (createWorkpaperEvidencePayload(item) === null) {
    return false;
  }

  if (item.workpaper !== null && !hasWorkpaperDraftChanges(item, draft)) {
    return false;
  }

  return true;
}

export function canSubmitDocumentDecision(draft: DocumentDecisionDraft) {
  if (!isDocumentVerificationDecision(draft.decision)) {
    return false;
  }

  return draft.decision !== "REJECTED" || draft.comment.trim().length > 0;
}

export function canMarkWorkpaperReviewed(item: WorkpaperReadModelItem) {
  if (item.workpaper?.status !== "READY_FOR_REVIEW" || item.documentVerificationSummary === null) {
    return false;
  }

  return (
    item.documentVerificationSummary.documentsCount === 0 ||
    (item.documentVerificationSummary.unverifiedCount === 0 &&
      item.documentVerificationSummary.verifiedCount >= 1)
  );
}

export function canSubmitWorkpaperDecision(
  item: WorkpaperReadModelItem,
  draft: WorkpaperDecisionDraft
) {
  if (!isWorkpaperReviewDecision(draft.decision)) {
    return false;
  }

  if (draft.decision === "CHANGES_REQUESTED") {
    return draft.comment.trim().length > 0;
  }

  return canMarkWorkpaperReviewed(item);
}

export function clearDocumentUploadStateForAnchor(
  state: DocumentUploadState,
  anchorCode: string
): DocumentUploadState {
  if (state.kind === "idle" || state.kind === "submitting" || state.anchorCode !== anchorCode) {
    return state;
  }

  return { kind: "idle" };
}

export function clearDocumentDecisionStateForDocument(
  state: DocumentDecisionState,
  documentId: string
): DocumentDecisionState {
  if (state.kind === "idle" || state.kind === "submitting" || state.documentId !== documentId) {
    return state;
  }

  return { kind: "idle" };
}

export function clearWorkpaperDecisionStateForAnchor(
  state: WorkpaperDecisionState,
  anchorCode: string
): WorkpaperDecisionState {
  if (state.kind === "idle" || state.kind === "submitting" || state.anchorCode !== anchorCode) {
    return state;
  }

  return { kind: "idle" };
}

export function getReadableDocumentId(document: WorkpaperDocument) {
  if (typeof document.id !== "string") {
    return null;
  }

  return isUuid(document.id) ? document.id : null;
}

export function findDocumentInWorkpapers(
  workpapers: ClosingWorkpapersReadModel,
  documentId: string
) {
  const allItems = [...workpapers.items, ...workpapers.staleWorkpapers];

  for (const item of allItems) {
    const document = item.documents.find(
      (candidate) => getReadableDocumentId(candidate) === documentId
    );

    if (document !== undefined) {
      return {
        item,
        document
      };
    }
  }

  return null;
}

export function findCurrentDocumentInWorkpapers(
  workpapers: ClosingWorkpapersReadModel,
  documentId: string
) {
  for (const item of workpapers.items) {
    const document = item.documents.find(
      (candidate) => getReadableDocumentId(candidate) === documentId
    );

    if (document !== undefined) {
      return {
        item,
        document
      };
    }
  }

  return null;
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isDocumentUploadFileAllowed(file: File) {
  const normalizedMediaType = normalizeDocumentUploadMediaType(file.type);

  if (
    normalizedMediaType !== null &&
    !DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES.some(
      (allowedMediaType) => allowedMediaType === normalizedMediaType
    )
  ) {
    return false;
  }

  if (normalizedMediaType !== null) {
    return true;
  }

  const extension = getLowercaseDocumentUploadExtension(file.name);
  return extension !== null && documentUploadAllowedExtensions.has(extension);
}

export function normalizeDocumentUploadMediaType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.split(";")[0]?.trim() ?? null;
}

export function getLowercaseDocumentUploadExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

export function isIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
