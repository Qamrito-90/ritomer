import type { ChangeEvent, ReactNode } from "react";
import { useRef, useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import type { ClosingFolderSummary } from "../lib/api/closing-folders";
import type { ActiveTenant, EffectiveRolesHint } from "../lib/api/me";
import {
  DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES,
  DOCUMENT_UPLOAD_MAX_BYTES,
  downloadWorkpaperDocument,
  loadWorkpapersShellState,
  reviewDocumentVerificationDecision,
  uploadWorkpaperDocument,
  upsertWorkpaper,
  type ClosingWorkpapersReadModel,
  type DocumentVerificationDecision,
  type DownloadWorkpaperDocumentState,
  type MakerWorkpaperStatus,
  type ReviewDocumentVerificationDecisionState,
  type UploadWorkpaperDocumentState,
  type WorkpaperDocument,
  type WorkpaperEvidence,
  type WorkpaperReadModelItem,
  type WorkpapersShellState
} from "../lib/api/workpapers";

type WorkpaperDraft = {
  noteText: string;
  status: MakerWorkpaperStatus;
};

type DocumentUploadDraft = {
  file: File | null;
  selectedFileCount: number;
  sourceLabel: string;
  documentDate: string;
};

type DocumentDecisionDraft = {
  decision: DocumentVerificationDecision;
  comment: string;
};

type WorkpaperMutationState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; refreshFailed: boolean }
  | { kind: "read_only_archived" }
  | { kind: "read_only_not_ready" }
  | { kind: "read_only_role" }
  | { kind: "stale_read_only" }
  | { kind: "item_read_only" }
  | { kind: "invalid_workpaper" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_not_ready" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "invalid_workpapers_payload" }
  | { kind: "unexpected" };

type DocumentUploadState =
  | { kind: "idle" }
  | { kind: "submitting"; anchorCode: string }
  | { kind: "success"; anchorCode: string; refreshFailed: boolean }
  | { kind: "bad_request"; anchorCode: string }
  | { kind: "bad_request_invalid_media_type"; anchorCode: string }
  | { kind: "bad_request_empty_file"; anchorCode: string }
  | { kind: "bad_request_source_required"; anchorCode: string }
  | { kind: "auth_required"; anchorCode: string }
  | { kind: "forbidden"; anchorCode: string }
  | { kind: "not_found"; anchorCode: string }
  | { kind: "conflict_archived"; anchorCode: string }
  | { kind: "conflict_not_ready"; anchorCode: string }
  | { kind: "conflict_stale"; anchorCode: string }
  | { kind: "conflict_workpaper_read_only"; anchorCode: string }
  | { kind: "conflict_other"; anchorCode: string }
  | { kind: "payload_too_large"; anchorCode: string }
  | { kind: "server_error"; anchorCode: string }
  | { kind: "network_error"; anchorCode: string }
  | { kind: "timeout"; anchorCode: string }
  | { kind: "invalid_payload"; anchorCode: string }
  | { kind: "unexpected"; anchorCode: string };

type DocumentDownloadState =
  | { kind: "idle" }
  | { kind: "local_invalid"; documentId: string }
  | { kind: "submitting"; documentId: string }
  | { kind: "auth_required"; documentId: string }
  | { kind: "forbidden"; documentId: string }
  | { kind: "not_found"; documentId: string }
  | { kind: "server_error"; documentId: string }
  | { kind: "network_error"; documentId: string }
  | { kind: "timeout"; documentId: string }
  | { kind: "unexpected"; documentId: string };

type DocumentDecisionState =
  | { kind: "idle" }
  | { kind: "submitting"; documentId: string }
  | { kind: "success"; documentId: string; refreshFailed: boolean }
  | { kind: "comment_required"; documentId: string }
  | { kind: "read_only_archived"; documentId: string }
  | { kind: "read_only_not_ready"; documentId: string }
  | { kind: "read_only_role"; documentId: string }
  | { kind: "workpaper_not_ready"; documentId: string }
  | { kind: "local_invalid"; documentId: string }
  | { kind: "bad_request"; documentId: string }
  | { kind: "auth_required"; documentId: string }
  | { kind: "forbidden"; documentId: string }
  | { kind: "not_found"; documentId: string }
  | { kind: "conflict_archived"; documentId: string }
  | { kind: "conflict_not_ready"; documentId: string }
  | { kind: "conflict_stale"; documentId: string }
  | { kind: "conflict_workpaper_status"; documentId: string }
  | { kind: "conflict_other"; documentId: string }
  | { kind: "server_error"; documentId: string }
  | { kind: "network_error"; documentId: string }
  | { kind: "timeout"; documentId: string }
  | { kind: "invalid_payload"; documentId: string }
  | { kind: "unexpected"; documentId: string };

const workpaperWritableRoles = new Set(["ACCOUNTANT", "MANAGER", "ADMIN"]);
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
const documentUploadInputAccept = [
  ...DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES,
  ...documentUploadAllowedExtensions
].join(",");

type WorkpapersPanelProps = {
  activeTenant: ActiveTenant;
  closingFolder: ClosingFolderSummary;
  closingFolderId: string;
  effectiveRoles: EffectiveRolesHint;
  initialState: WorkpapersShellState;
};

export function WorkpapersPanel({
  activeTenant,
  closingFolder,
  closingFolderId,
  effectiveRoles,
  initialState
}: WorkpapersPanelProps) {
  const [workpapersStateOverride, setWorkpapersStateOverride] =
    useState<WorkpapersShellState | null>(null);
  const [workpaperDrafts, setWorkpaperDrafts] = useState<Record<string, WorkpaperDraft>>({});
  const [documentUploadDrafts, setDocumentUploadDrafts] = useState<
    Record<string, DocumentUploadDraft>
  >({});
  const [documentDecisionDrafts, setDocumentDecisionDrafts] = useState<
    Record<string, DocumentDecisionDraft>
  >({});
  const [workpaperMutationState, setWorkpaperMutationState] =
    useState<WorkpaperMutationState>({ kind: "idle" });
  const [documentUploadState, setDocumentUploadState] = useState<DocumentUploadState>({
    kind: "idle"
  });
  const [documentDownloadState, setDocumentDownloadState] = useState<DocumentDownloadState>({
    kind: "idle"
  });
  const [documentDecisionState, setDocumentDecisionState] = useState<DocumentDecisionState>({
    kind: "idle"
  });
  const workpaperMutationInFlightRef = useRef(false);
  const documentUploadInFlightRef = useRef(false);
  const documentDownloadInFlightRef = useRef(false);
  const documentDecisionInFlightRef = useRef(false);
  const workpapersState = workpapersStateOverride ?? initialState;

  function handleWorkpaperNoteChange(anchorCode: string, noteText: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    const item = workpapersState.workpapers.items.find(
      (candidate) => candidate.anchorCode === anchorCode
    );

    if (item === undefined) {
      return;
    }

    setWorkpaperDrafts((currentDrafts) => ({
      ...currentDrafts,
      [anchorCode]: {
        ...getWorkpaperDraft(currentDrafts, item),
        noteText
      }
    }));
  }

  function handleWorkpaperStatusChange(anchorCode: string, status: string) {
    if (workpapersState.kind !== "ready" || !isMakerWorkpaperStatus(status)) {
      return;
    }

    const item = workpapersState.workpapers.items.find(
      (candidate) => candidate.anchorCode === anchorCode
    );

    if (item === undefined) {
      return;
    }

    setWorkpaperDrafts((currentDrafts) => ({
      ...currentDrafts,
      [anchorCode]: {
        ...getWorkpaperDraft(currentDrafts, item),
        status
      }
    }));
  }

  function handleDocumentUploadFileChange(
    anchorCode: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    const item = workpapersState.workpapers.items.find(
      (candidate) => candidate.anchorCode === anchorCode
    );

    if (item === undefined) {
      return;
    }

    const files = event.currentTarget.files;
    const selectedFileCount = files?.length ?? 0;
    const selectedFile = selectedFileCount === 1 ? (files?.[0] ?? null) : null;

    setDocumentUploadDrafts((currentDrafts) => ({
      ...currentDrafts,
      [anchorCode]: {
        ...getDocumentUploadDraft(currentDrafts, item),
        file: selectedFile,
        selectedFileCount
      }
    }));
    setDocumentUploadState((currentState) =>
      clearDocumentUploadStateForAnchor(currentState, anchorCode)
    );
  }

  function handleDocumentUploadSourceLabelChange(anchorCode: string, sourceLabel: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    const item = workpapersState.workpapers.items.find(
      (candidate) => candidate.anchorCode === anchorCode
    );

    if (item === undefined) {
      return;
    }

    setDocumentUploadDrafts((currentDrafts) => ({
      ...currentDrafts,
      [anchorCode]: {
        ...getDocumentUploadDraft(currentDrafts, item),
        sourceLabel
      }
    }));
    setDocumentUploadState((currentState) =>
      clearDocumentUploadStateForAnchor(currentState, anchorCode)
    );
  }

  function handleDocumentUploadDateChange(anchorCode: string, documentDate: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    const item = workpapersState.workpapers.items.find(
      (candidate) => candidate.anchorCode === anchorCode
    );

    if (item === undefined) {
      return;
    }

    setDocumentUploadDrafts((currentDrafts) => ({
      ...currentDrafts,
      [anchorCode]: {
        ...getDocumentUploadDraft(currentDrafts, item),
        documentDate
      }
    }));
    setDocumentUploadState((currentState) =>
      clearDocumentUploadStateForAnchor(currentState, anchorCode)
    );
  }

  async function handleSaveWorkpaper(anchorCode: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    if (
      documentUploadInFlightRef.current ||
      documentDecisionInFlightRef.current ||
      workpaperMutationInFlightRef.current
    ) {
      return;
    }

    const workpapers = workpapersState.workpapers;

    if (workpapers.closingFolderStatus === "ARCHIVED") {
      setWorkpaperMutationState({ kind: "read_only_archived" });
      return;
    }

    if (workpapers.readiness !== "READY") {
      setWorkpaperMutationState({ kind: "read_only_not_ready" });
      return;
    }

    if (!hasWorkpaperWritableRole(effectiveRoles)) {
      setWorkpaperMutationState({ kind: "read_only_role" });
      return;
    }

    const currentItem = workpapers.items.find((item) => item.anchorCode === anchorCode);

    if (currentItem === undefined) {
      const staleItem = workpapers.staleWorkpapers.find((item) => item.anchorCode === anchorCode);
      setWorkpaperMutationState(
        staleItem === undefined ? { kind: "unexpected" } : { kind: "stale_read_only" }
      );
      return;
    }

    if (!currentItem.isCurrentStructure) {
      setWorkpaperMutationState({ kind: "stale_read_only" });
      return;
    }

    if (!isWorkpaperMakerEditable(currentItem)) {
      setWorkpaperMutationState({ kind: "item_read_only" });
      return;
    }

    const draft = getWorkpaperDraft(workpaperDrafts, currentItem);
    const trimmedNoteText = draft.noteText.trim();

    if (!isMakerWorkpaperStatus(draft.status) || trimmedNoteText.length === 0) {
      setWorkpaperMutationState({ kind: "invalid_workpaper" });
      return;
    }

    const evidences = createWorkpaperEvidencePayload(currentItem);

    if (evidences === null) {
      setWorkpaperMutationState({ kind: "invalid_workpapers_payload" });
      return;
    }

    if (currentItem.workpaper !== null && !hasWorkpaperDraftChanges(currentItem, draft)) {
      return;
    }

    workpaperMutationInFlightRef.current = true;
    setWorkpaperMutationState({ kind: "submitting" });

    const result = await upsertWorkpaper(closingFolderId, activeTenant, {
      anchorCode,
      noteText: trimmedNoteText,
      status: draft.status,
      evidences
    });

    if (result.kind === "success") {
      setWorkpaperMutationState({ kind: "success", refreshFailed: false });
      await refreshWorkpapersAfterWorkpaperMutation();
      return;
    }

    workpaperMutationInFlightRef.current = false;
    setWorkpaperMutationState(mapWorkpaperMutationResult(result));
  }

  async function handleDocumentUpload(anchorCode: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    if (
      workpaperMutationInFlightRef.current ||
      documentDecisionInFlightRef.current ||
      documentUploadInFlightRef.current
    ) {
      return;
    }

    const workpapers = workpapersState.workpapers;
    const currentItem = workpapers.items.find((item) => item.anchorCode === anchorCode);

    if (currentItem === undefined || !currentItem.isCurrentStructure) {
      setDocumentUploadState({ kind: "unexpected", anchorCode });
      return;
    }

    if (currentItem.workpaper === null) {
      return;
    }

    if (!isWorkpaperDocumentUploadEditable(currentItem)) {
      setDocumentUploadState({ kind: "conflict_workpaper_read_only", anchorCode });
      return;
    }

    const draft = getDocumentUploadDraft(documentUploadDrafts, currentItem);
    const validation = validateDocumentUploadDraft(draft);

    if (validation.kind !== "valid") {
      return;
    }

    documentUploadInFlightRef.current = true;
    setDocumentUploadState({ kind: "submitting", anchorCode });

    const result = await uploadWorkpaperDocument(closingFolderId, activeTenant, {
      anchorCode,
      file: validation.file,
      sourceLabel: validation.sourceLabel,
      documentDate: validation.documentDate
    });

    if (result.kind === "success") {
      setDocumentUploadState({ kind: "success", anchorCode, refreshFailed: false });
      await refreshWorkpapersAfterDocumentUpload(anchorCode);
      return;
    }

    documentUploadInFlightRef.current = false;
    setDocumentUploadState(mapDocumentUploadResult(result, anchorCode));
  }

  async function handleDocumentDownload(documentId: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    if (documentDownloadInFlightRef.current || documentDecisionInFlightRef.current) {
      return;
    }

    if (!hasDocumentReadableRole(effectiveRoles)) {
      setDocumentDownloadState({ kind: "local_invalid", documentId });
      return;
    }

    const resolvedDocument = findDocumentInWorkpapers(workpapersState.workpapers, documentId);

    if (resolvedDocument === null) {
      setDocumentDownloadState({ kind: "local_invalid", documentId });
      return;
    }

    documentDownloadInFlightRef.current = true;
    setDocumentDownloadState({ kind: "submitting", documentId });

    const result = await downloadWorkpaperDocument(closingFolderId, activeTenant, { documentId });

    if (result.kind === "success") {
      try {
        triggerDocumentDownload(
          result.blob,
          resolveDocumentDownloadMediaType(
            result.contentType,
            getFallbackDocumentMediaType(resolvedDocument.document)
          ),
          resolveDocumentDownloadFileName(
            result.contentDisposition,
            getFallbackDocumentFileName(resolvedDocument.document),
            documentId
          )
        );

        documentDownloadInFlightRef.current = false;
        setDocumentDownloadState({ kind: "idle" });
        return;
      } catch {
        documentDownloadInFlightRef.current = false;
        setDocumentDownloadState({ kind: "unexpected", documentId });
        return;
      }
    }

    documentDownloadInFlightRef.current = false;
    setDocumentDownloadState(mapDocumentDownloadResult(result, documentId));
  }

  function handleDocumentDecisionChange(documentId: string, decision: string) {
    if (workpapersState.kind !== "ready" || !isDocumentVerificationDecision(decision)) {
      return;
    }

    const resolvedDocument = findCurrentDocumentInWorkpapers(workpapersState.workpapers, documentId);

    if (resolvedDocument === null) {
      return;
    }

    setDocumentDecisionDrafts((currentDrafts) => ({
      ...currentDrafts,
      [documentId]: {
        ...getDocumentDecisionDraft(currentDrafts, resolvedDocument.document),
        decision
      }
    }));
    setDocumentDecisionState((currentState) =>
      clearDocumentDecisionStateForDocument(currentState, documentId)
    );
  }

  function handleDocumentDecisionCommentChange(documentId: string, comment: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    const resolvedDocument = findCurrentDocumentInWorkpapers(workpapersState.workpapers, documentId);

    if (resolvedDocument === null) {
      return;
    }

    setDocumentDecisionDrafts((currentDrafts) => ({
      ...currentDrafts,
      [documentId]: {
        ...getDocumentDecisionDraft(currentDrafts, resolvedDocument.document),
        comment
      }
    }));
    setDocumentDecisionState((currentState) =>
      clearDocumentDecisionStateForDocument(currentState, documentId)
    );
  }

  async function handleSaveDocumentDecision(documentId: string) {
    if (workpapersState.kind !== "ready") {
      return;
    }

    const workpapers = workpapersState.workpapers;

    if (workpapers.closingFolderStatus === "ARCHIVED") {
      setDocumentDecisionState({ kind: "read_only_archived", documentId });
      return;
    }

    if (workpapers.readiness !== "READY") {
      setDocumentDecisionState({ kind: "read_only_not_ready", documentId });
      return;
    }

    if (!hasDocumentReviewerRole(effectiveRoles)) {
      setDocumentDecisionState({ kind: "read_only_role", documentId });
      return;
    }

    const resolvedDocument = findCurrentDocumentInWorkpapers(workpapers, documentId);

    if (resolvedDocument === null || !resolvedDocument.item.isCurrentStructure) {
      setDocumentDecisionState({ kind: "local_invalid", documentId });
      return;
    }

    if (
      resolvedDocument.item.workpaper === null ||
      resolvedDocument.item.workpaper.status !== "READY_FOR_REVIEW"
    ) {
      setDocumentDecisionState({ kind: "workpaper_not_ready", documentId });
      return;
    }

    if (getReadableDocumentId(resolvedDocument.document) !== documentId) {
      setDocumentDecisionState({ kind: "local_invalid", documentId });
      return;
    }

    if (documentDecisionInFlightRef.current) {
      return;
    }

    const draft = getDocumentDecisionDraft(
      documentDecisionDrafts,
      resolvedDocument.document
    );

    if (!isDocumentVerificationDecision(draft.decision)) {
      setDocumentDecisionState({ kind: "unexpected", documentId });
      return;
    }

    const trimmedComment = draft.comment.trim();

    if (draft.decision === "REJECTED" && trimmedComment.length === 0) {
      setDocumentDecisionState({ kind: "comment_required", documentId });
      return;
    }

    documentDecisionInFlightRef.current = true;
    setDocumentDecisionState({ kind: "submitting", documentId });

    const result =
      draft.decision === "VERIFIED"
        ? await reviewDocumentVerificationDecision(closingFolderId, activeTenant, {
            documentId,
            decision: "VERIFIED"
          })
        : await reviewDocumentVerificationDecision(closingFolderId, activeTenant, {
            documentId,
            decision: "REJECTED",
            comment: trimmedComment
          });

    if (result.kind === "success") {
      setDocumentDecisionState({ kind: "success", documentId, refreshFailed: false });
      await refreshWorkpapersAfterDocumentDecision(documentId);
      return;
    }

    documentDecisionInFlightRef.current = false;
    setDocumentDecisionState(mapDocumentDecisionResult(result, documentId));
  }

  async function refreshWorkpapersAfterWorkpaperMutation() {
    const refreshedWorkpapersState = await loadWorkpapersShellState(
      closingFolderId,
      closingFolder,
      activeTenant
    );

    workpaperMutationInFlightRef.current = false;

    if (refreshedWorkpapersState.kind !== "ready") {
      setWorkpaperMutationState({ kind: "success", refreshFailed: true });
      return;
    }

    setWorkpapersStateOverride(refreshedWorkpapersState);
    setWorkpaperDrafts(createWorkpaperDrafts(refreshedWorkpapersState.workpapers));
    setDocumentUploadDrafts(createDocumentUploadDrafts(refreshedWorkpapersState.workpapers));
    setDocumentDecisionDrafts(createDocumentDecisionDrafts(refreshedWorkpapersState.workpapers));
    setWorkpaperMutationState({ kind: "success", refreshFailed: false });
    setDocumentUploadState({ kind: "idle" });
  }

  async function refreshWorkpapersAfterDocumentUpload(anchorCode: string) {
    const refreshedWorkpapersState = await loadWorkpapersShellState(
      closingFolderId,
      closingFolder,
      activeTenant
    );

    documentUploadInFlightRef.current = false;

    if (refreshedWorkpapersState.kind !== "ready") {
      setDocumentUploadState({ kind: "success", anchorCode, refreshFailed: true });
      return;
    }

    setWorkpapersStateOverride(refreshedWorkpapersState);
    setWorkpaperDrafts(createWorkpaperDrafts(refreshedWorkpapersState.workpapers));
    setDocumentUploadDrafts(createDocumentUploadDrafts(refreshedWorkpapersState.workpapers));
    setDocumentDecisionDrafts(createDocumentDecisionDrafts(refreshedWorkpapersState.workpapers));
    setDocumentUploadState({ kind: "success", anchorCode, refreshFailed: false });
  }

  async function refreshWorkpapersAfterDocumentDecision(documentId: string) {
    const refreshedWorkpapersState = await loadWorkpapersShellState(
      closingFolderId,
      closingFolder,
      activeTenant
    );

    documentDecisionInFlightRef.current = false;

    if (refreshedWorkpapersState.kind !== "ready") {
      setDocumentDecisionState({ kind: "success", documentId, refreshFailed: true });
      return;
    }

    setWorkpapersStateOverride(refreshedWorkpapersState);
    setWorkpaperDrafts(createWorkpaperDrafts(refreshedWorkpapersState.workpapers));
    setDocumentUploadDrafts(createDocumentUploadDrafts(refreshedWorkpapersState.workpapers));
    setDocumentDecisionDrafts(createDocumentDecisionDrafts(refreshedWorkpapersState.workpapers));
    setDocumentDecisionState({ kind: "success", documentId, refreshFailed: false });
  }

  return (
    <section className="panel p-6">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <p className="label-eyebrow">Workpapers</p>
          <h3 className="text-xl font-semibold text-foreground">Maker update unitaire</h3>
        </div>
        <WorkpapersSlot
          documentDecisionDrafts={documentDecisionDrafts}
          documentDecisionState={documentDecisionState}
          documentDownloadState={documentDownloadState}
          documentUploadDrafts={documentUploadDrafts}
          documentUploadState={documentUploadState}
          effectiveRoles={effectiveRoles}
          mutationState={workpaperMutationState}
          onDocumentDateChange={handleDocumentUploadDateChange}
          onDocumentDecisionChange={handleDocumentDecisionChange}
          onDocumentDecisionCommentChange={handleDocumentDecisionCommentChange}
          onDocumentDownload={handleDocumentDownload}
          onDocumentFileChange={handleDocumentUploadFileChange}
          onDocumentDecisionSave={handleSaveDocumentDecision}
          onDocumentUpload={handleDocumentUpload}
          onDocumentUploadSourceLabelChange={handleDocumentUploadSourceLabelChange}
          onNoteChange={handleWorkpaperNoteChange}
          onSave={handleSaveWorkpaper}
          onStatusChange={handleWorkpaperStatusChange}
          state={workpapersState}
          workpaperDrafts={workpaperDrafts}
        />
      </div>
    </section>
  );
}

function WorkpapersSlot({
  documentDecisionDrafts,
  documentDecisionState,
  documentDownloadState,
  documentUploadDrafts,
  documentUploadState,
  effectiveRoles,
  mutationState,
  onDocumentDateChange,
  onDocumentDecisionChange,
  onDocumentDecisionCommentChange,
  onDocumentDecisionSave,
  onDocumentDownload,
  onDocumentFileChange,
  onDocumentUpload,
  onDocumentUploadSourceLabelChange,
  onNoteChange,
  onSave,
  onStatusChange,
  state,
  workpaperDrafts
}: {
  documentDecisionDrafts: Record<string, DocumentDecisionDraft>;
  documentDecisionState: DocumentDecisionState;
  documentDownloadState: DocumentDownloadState;
  documentUploadDrafts: Record<string, DocumentUploadDraft>;
  documentUploadState: DocumentUploadState;
  effectiveRoles: EffectiveRolesHint;
  mutationState: WorkpaperMutationState;
  onDocumentDateChange: (anchorCode: string, documentDate: string) => void;
  onDocumentDecisionChange: (documentId: string, decision: string) => void;
  onDocumentDecisionCommentChange: (documentId: string, comment: string) => void;
  onDocumentDecisionSave: (documentId: string) => void;
  onDocumentDownload: (documentId: string) => void;
  onDocumentFileChange: (anchorCode: string, event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentUpload: (anchorCode: string) => void;
  onDocumentUploadSourceLabelChange: (anchorCode: string, sourceLabel: string) => void;
  onNoteChange: (anchorCode: string, noteText: string) => void;
  onSave: (anchorCode: string) => void;
  onStatusChange: (anchorCode: string, status: string) => void;
  state: WorkpapersShellState;
  workpaperDrafts: Record<string, WorkpaperDraft>;
}) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement workpapers" />;
  }

  if (state.kind === "auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (state.kind === "forbidden") {
    return <StateMessage text="acces workpapers refuse" />;
  }

  if (state.kind === "not_found") {
    return <StateMessage text="workpapers introuvables" />;
  }

  if (state.kind === "server_error") {
    return <StateMessage text="erreur serveur workpapers" />;
  }

  if (state.kind === "network_error") {
    return <StateMessage text="erreur reseau workpapers" />;
  }

  if (state.kind === "timeout") {
    return <StateMessage text="timeout workpapers" />;
  }

  if (state.kind === "invalid_payload") {
    return <StateMessage text="payload workpapers invalide" />;
  }

  if (state.kind === "bad_request" || state.kind === "unexpected") {
    return <StateMessage text="workpapers indisponibles" />;
  }

  return (
    <WorkpapersNominalBlocks
      documentDecisionDrafts={documentDecisionDrafts}
      documentDecisionState={documentDecisionState}
      documentDownloadState={documentDownloadState}
      documentUploadDrafts={documentUploadDrafts}
      documentUploadState={documentUploadState}
      effectiveRoles={effectiveRoles}
      mutationState={mutationState}
      onDocumentDateChange={onDocumentDateChange}
      onDocumentDecisionChange={onDocumentDecisionChange}
      onDocumentDecisionCommentChange={onDocumentDecisionCommentChange}
      onDocumentDecisionSave={onDocumentDecisionSave}
      onDocumentDownload={onDocumentDownload}
      onDocumentFileChange={onDocumentFileChange}
      onDocumentUpload={onDocumentUpload}
      onDocumentUploadSourceLabelChange={onDocumentUploadSourceLabelChange}
      onNoteChange={onNoteChange}
      onSave={onSave}
      onStatusChange={onStatusChange}
      workpaperDrafts={workpaperDrafts}
      workpapers={state.workpapers}
    />
  );
}

function WorkpapersNominalBlocks({
  documentDecisionDrafts,
  documentDecisionState,
  documentDownloadState,
  documentUploadDrafts,
  documentUploadState,
  effectiveRoles,
  mutationState,
  onDocumentDateChange,
  onDocumentDecisionChange,
  onDocumentDecisionCommentChange,
  onDocumentDecisionSave,
  onDocumentDownload,
  onDocumentFileChange,
  onDocumentUpload,
  onDocumentUploadSourceLabelChange,
  onNoteChange,
  onSave,
  onStatusChange,
  workpaperDrafts,
  workpapers
}: {
  documentDecisionDrafts: Record<string, DocumentDecisionDraft>;
  documentDecisionState: DocumentDecisionState;
  documentDownloadState: DocumentDownloadState;
  documentUploadDrafts: Record<string, DocumentUploadDraft>;
  documentUploadState: DocumentUploadState;
  effectiveRoles: EffectiveRolesHint;
  mutationState: WorkpaperMutationState;
  onDocumentDateChange: (anchorCode: string, documentDate: string) => void;
  onDocumentDecisionChange: (documentId: string, decision: string) => void;
  onDocumentDecisionCommentChange: (documentId: string, comment: string) => void;
  onDocumentDecisionSave: (documentId: string) => void;
  onDocumentDownload: (documentId: string) => void;
  onDocumentFileChange: (anchorCode: string, event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentUpload: (anchorCode: string) => void;
  onDocumentUploadSourceLabelChange: (anchorCode: string, sourceLabel: string) => void;
  onNoteChange: (anchorCode: string, noteText: string) => void;
  onSave: (anchorCode: string) => void;
  onStatusChange: (anchorCode: string, status: string) => void;
  workpaperDrafts: Record<string, WorkpaperDraft>;
  workpapers: ClosingWorkpapersReadModel;
}) {
  const summaryLines = [
    `anchors courants total : ${workpapers.summaryCounts.totalCurrentAnchors}`,
    `anchors avec workpaper : ${workpapers.summaryCounts.withWorkpaperCount}`,
    `workpapers prets pour revue : ${workpapers.summaryCounts.readyForReviewCount}`,
    `workpapers revus : ${workpapers.summaryCounts.reviewedCount}`,
    `workpapers stale : ${workpapers.summaryCounts.staleCount}`,
    `anchors sans workpaper : ${workpapers.summaryCounts.missingCount}`
  ];
  const globalReadOnlyMessage = getWorkpapersGlobalReadOnlyMessage(workpapers, effectiveRoles);
  const makerControlsDisabled =
    mutationState.kind === "submitting" ||
    documentDecisionState.kind === "submitting" ||
    documentUploadState.kind === "submitting";
  const downloadControlsDisabled =
    documentDecisionState.kind === "submitting" || documentDownloadState.kind === "submitting";
  const documentDecisionControlsDisabled = documentDecisionState.kind === "submitting";

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
        Mise a jour maker unitaire sur les workpapers courants uniquement.
      </p>

      <WorkpaperMutationStatus state={mutationState} />

      <ControlsBlock title="Resume workpapers">
        <ReadonlyLineList lines={summaryLines} />
      </ControlsBlock>

      {globalReadOnlyMessage !== null ? (
        <p className="text-sm font-medium text-foreground">{globalReadOnlyMessage}</p>
      ) : null}

      {workpapers.items.length === 0 && workpapers.staleWorkpapers.length === 0 ? (
        <p className="text-sm font-medium text-foreground">aucun workpaper disponible</p>
      ) : null}

      <ControlsBlock title="Workpapers courants">
        {workpapers.items.length === 0 ? (
          <p className="text-sm font-medium text-foreground">aucun workpaper courant</p>
        ) : (
          <ul className="grid gap-4">
            {workpapers.items.map((item) => {
              const draft = getWorkpaperDraft(workpaperDrafts, item);
              const documentUploadDraft = getDocumentUploadDraft(documentUploadDrafts, item);
              const itemReadOnlyMessage = getCurrentWorkpaperReadOnlyMessage(
                item,
                globalReadOnlyMessage
              );
              const uploadAvailabilityMessage = getCurrentWorkpaperUploadAvailabilityMessage(
                item,
                globalReadOnlyMessage
              );
              const showMakerForm =
                globalReadOnlyMessage === null && itemReadOnlyMessage === null;
              const showDocumentUploadSection =
                globalReadOnlyMessage === null && isWorkpaperDocumentUploadEditable(item);

              return (
                <li key={`${item.anchorCode}-current`}>
                  <WorkpaperCard
                    controlsDisabled={makerControlsDisabled}
                    documentDecisionControlsDisabled={documentDecisionControlsDisabled}
                    documentDecisionDrafts={documentDecisionDrafts}
                    documentDecisionState={documentDecisionState}
                    documentDownloadState={documentDownloadState}
                    documentUploadDraft={showDocumentUploadSection ? documentUploadDraft : null}
                    documentUploadState={documentUploadState}
                    downloadControlsDisabled={downloadControlsDisabled}
                    draft={showMakerForm ? draft : null}
                    effectiveRoles={effectiveRoles}
                    item={item}
                    makerReadOnlyMessage={itemReadOnlyMessage}
                    onDocumentDateChange={
                      showDocumentUploadSection ? onDocumentDateChange : undefined
                    }
                    onDocumentDecisionChange={onDocumentDecisionChange}
                    onDocumentDecisionCommentChange={onDocumentDecisionCommentChange}
                    onDocumentDecisionSave={onDocumentDecisionSave}
                    onDocumentDownload={onDocumentDownload}
                    onDocumentFileChange={
                      showDocumentUploadSection ? onDocumentFileChange : undefined
                    }
                    onDocumentUpload={showDocumentUploadSection ? onDocumentUpload : undefined}
                    onDocumentUploadSourceLabelChange={
                      showDocumentUploadSection
                        ? onDocumentUploadSourceLabelChange
                        : undefined
                    }
                    onNoteChange={showMakerForm ? onNoteChange : undefined}
                    onSave={showMakerForm ? onSave : undefined}
                    onStatusChange={showMakerForm ? onStatusChange : undefined}
                    saveDisabled={
                      !showMakerForm ||
                      !canSaveWorkpaperItem(
                        workpapers,
                        effectiveRoles,
                        item,
                        draft,
                        mutationState
                      )
                    }
                    uploadAvailabilityMessage={uploadAvailabilityMessage}
                    uploadDisabled={
                      !showDocumentUploadSection ||
                      !canUploadDocumentItem(
                        workpapers,
                        effectiveRoles,
                        item,
                        documentUploadDraft,
                        mutationState,
                        documentUploadState
                      )
                    }
                    workpapersForDocumentDecision={workpapers}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </ControlsBlock>

      {workpapers.staleWorkpapers.length > 0 ? (
        <p className="text-sm font-medium text-foreground">workpapers stale en lecture seule</p>
      ) : null}

      <ControlsBlock title="Workpapers stale">
        {workpapers.staleWorkpapers.length === 0 ? (
          <p className="text-sm font-medium text-foreground">aucun workpaper stale</p>
        ) : (
          <ul className="grid gap-4">
            {workpapers.staleWorkpapers.map((item) => (
              <li key={`${item.anchorCode}-stale`}>
                <WorkpaperCard
                  documentDownloadState={documentDownloadState}
                  downloadControlsDisabled={downloadControlsDisabled}
                  effectiveRoles={effectiveRoles}
                  item={item}
                  onDocumentDownload={onDocumentDownload}
                />
              </li>
            ))}
          </ul>
        )}
      </ControlsBlock>
    </div>
  );
}

function WorkpaperCard({
  controlsDisabled = false,
  documentDecisionControlsDisabled = false,
  documentDecisionDrafts = {},
  documentDecisionState = { kind: "idle" },
  documentDownloadState = { kind: "idle" },
  documentUploadDraft = null,
  documentUploadState = { kind: "idle" },
  downloadControlsDisabled = false,
  draft = null,
  effectiveRoles = null,
  item,
  makerReadOnlyMessage = null,
  onDocumentDateChange,
  onDocumentDecisionChange,
  onDocumentDecisionCommentChange,
  onDocumentDecisionSave,
  onDocumentDownload,
  onDocumentFileChange,
  onDocumentUpload,
  onDocumentUploadSourceLabelChange,
  onNoteChange,
  onSave,
  onStatusChange,
  saveDisabled = true,
  uploadAvailabilityMessage = null,
  uploadDisabled = true,
  workpapersForDocumentDecision = null
}: {
  controlsDisabled?: boolean;
  documentDecisionControlsDisabled?: boolean;
  documentDecisionDrafts?: Record<string, DocumentDecisionDraft>;
  documentDecisionState?: DocumentDecisionState;
  documentDownloadState?: DocumentDownloadState;
  documentUploadDraft?: DocumentUploadDraft | null;
  documentUploadState?: DocumentUploadState;
  downloadControlsDisabled?: boolean;
  draft?: WorkpaperDraft | null;
  effectiveRoles?: EffectiveRolesHint;
  item: WorkpaperReadModelItem;
  makerReadOnlyMessage?: string | null;
  onDocumentDateChange?: (anchorCode: string, documentDate: string) => void;
  onDocumentDecisionChange?: (documentId: string, decision: string) => void;
  onDocumentDecisionCommentChange?: (documentId: string, comment: string) => void;
  onDocumentDecisionSave?: (documentId: string) => void;
  onDocumentDownload?: (documentId: string) => void;
  onDocumentFileChange?: (anchorCode: string, event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentUpload?: (anchorCode: string) => void;
  onDocumentUploadSourceLabelChange?: (anchorCode: string, sourceLabel: string) => void;
  onNoteChange?: (anchorCode: string, noteText: string) => void;
  onSave?: (anchorCode: string) => void;
  onStatusChange?: (anchorCode: string, status: string) => void;
  saveDisabled?: boolean;
  uploadAvailabilityMessage?: string | null;
  uploadDisabled?: boolean;
  workpapersForDocumentDecision?: ClosingWorkpapersReadModel | null;
}) {
  const lines = [
    `anchor code : ${item.anchorCode}`,
    `statement kind : ${item.statementKind}`,
    `breakdown type : ${item.breakdownType}`,
    `etat workpaper : ${item.workpaper === null ? "aucun" : item.workpaper.status}`
  ];
  const canRenderMakerForm =
    draft !== null &&
    makerReadOnlyMessage === null &&
    onNoteChange !== undefined &&
    onSave !== undefined &&
    onStatusChange !== undefined;
  const canRenderDocumentUploadSection =
    documentUploadDraft !== null &&
    onDocumentDateChange !== undefined &&
    onDocumentFileChange !== undefined &&
    onDocumentUpload !== undefined &&
    onDocumentUploadSourceLabelChange !== undefined;
  const documentUploadStatusLines = canRenderDocumentUploadSection
    ? getDocumentUploadStatusLines(item.anchorCode, documentUploadDraft, documentUploadState)
    : [];

  if (item.workpaper !== null) {
    lines.push(`note workpaper : ${item.workpaper.noteText}`);
  }

  return (
    <article
      aria-label={`workpaper ${item.anchorCode}`}
      className="rounded-lg border bg-background/80 p-4"
    >
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-foreground">{item.anchorLabel}</p>
        <ReadonlyLineList lines={lines} />

        {makerReadOnlyMessage !== null ? (
          <p className="text-sm font-medium text-foreground">{makerReadOnlyMessage}</p>
        ) : null}

        {canRenderMakerForm ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor={`workpaper-note-${item.anchorCode}`}
              >
                Note workpaper
              </label>
              <textarea
                className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                disabled={controlsDisabled}
                id={`workpaper-note-${item.anchorCode}`}
                onChange={(event) => {
                  onNoteChange(item.anchorCode, event.currentTarget.value);
                }}
                value={draft.noteText}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-status-${item.anchorCode}`}
                >
                  Statut maker
                </label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                  disabled={controlsDisabled}
                  id={`workpaper-status-${item.anchorCode}`}
                  onChange={(event) => {
                    onStatusChange(item.anchorCode, event.currentTarget.value);
                  }}
                  value={draft.status}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                </select>
              </div>

              <Button
                disabled={controlsDisabled || saveDisabled}
                onClick={() => {
                  void onSave(item.anchorCode);
                }}
                type="button"
              >
                Enregistrer le workpaper
              </Button>
            </div>
          </div>
        ) : null}

        {uploadAvailabilityMessage !== null ? (
          <p className="text-sm font-medium text-foreground">{uploadAvailabilityMessage}</p>
        ) : null}

        {canRenderDocumentUploadSection ? (
          <ControlsBlock title="Upload document">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-document-file-${item.anchorCode}`}
                >
                  Fichier document
                </label>
                <Input
                  accept={documentUploadInputAccept}
                  disabled={controlsDisabled}
                  id={`workpaper-document-file-${item.anchorCode}`}
                  onChange={(event) => {
                    onDocumentFileChange(item.anchorCode, event);
                  }}
                  type="file"
                />
              </div>

              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-document-source-${item.anchorCode}`}
                >
                  Source document
                </label>
                <Input
                  disabled={controlsDisabled}
                  id={`workpaper-document-source-${item.anchorCode}`}
                  onChange={(event) => {
                    onDocumentUploadSourceLabelChange(item.anchorCode, event.currentTarget.value);
                  }}
                  type="text"
                  value={documentUploadDraft.sourceLabel}
                />
              </div>

              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-document-date-${item.anchorCode}`}
                >
                  Date document
                </label>
                <Input
                  disabled={controlsDisabled}
                  id={`workpaper-document-date-${item.anchorCode}`}
                  onChange={(event) => {
                    onDocumentDateChange(item.anchorCode, event.currentTarget.value);
                  }}
                  type="date"
                  value={documentUploadDraft.documentDate}
                />
              </div>

              <div aria-live="polite" className="grid gap-2">
                {documentUploadStatusLines.map((line) => (
                  <p className="text-sm font-medium text-foreground" key={`${item.anchorCode}-${line}`}>
                    {line}
                  </p>
                ))}
              </div>

              <div>
                <Button
                  disabled={controlsDisabled || uploadDisabled}
                  onClick={() => {
                    void onDocumentUpload(item.anchorCode);
                  }}
                  type="button"
                >
                  Uploader le document
                </Button>
              </div>
            </div>
          </ControlsBlock>
        ) : null}

        <ControlsBlock title="Documents inclus">
          {item.documents.length === 0 ? (
            <p className="text-sm font-medium text-foreground">aucun document inclus</p>
          ) : (
            <ul className="grid gap-3">
              {item.documents.map((document, index) => {
                const documentId = getReadableDocumentId(document);
                const canRenderDownloadButton =
                  documentId !== null &&
                  onDocumentDownload !== undefined &&
                  hasDocumentReadableRole(effectiveRoles);
                const downloadStatusLine = getDocumentDownloadStatusLine(
                  document,
                  documentDownloadState
                );
                const documentDecisionAvailabilityMessage =
                  workpapersForDocumentDecision === null
                    ? null
                    : getDocumentDecisionAvailabilityMessage(
                        workpapersForDocumentDecision,
                        effectiveRoles,
                        item,
                        document
                      );
                const canRenderDocumentDecision =
                  documentId !== null &&
                  documentDecisionAvailabilityMessage === null &&
                  onDocumentDecisionChange !== undefined &&
                  onDocumentDecisionCommentChange !== undefined &&
                  onDocumentDecisionSave !== undefined;
                const documentDecisionDraft =
                  documentId !== null
                    ? getDocumentDecisionDraft(documentDecisionDrafts, document)
                    : null;
                const documentDecisionStatusLines =
                  canRenderDocumentDecision && documentDecisionDraft !== null
                    ? getDocumentDecisionStatusLines(
                        documentId,
                        documentDecisionDraft,
                        documentDecisionState
                      )
                    : [];

                return (
                  <li key={`${item.anchorCode}-${index}-${document.fileName}`}>
                    <div className="grid gap-3 rounded-lg border bg-background/80 p-4">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {`${document.fileName} | ${document.mediaType} | ${document.sourceLabel} | verification : ${document.verificationStatus}`}
                      </p>

                      {canRenderDownloadButton ? (
                        <div>
                          <Button
                            disabled={downloadControlsDisabled}
                            onClick={() => {
                              void onDocumentDownload(documentId);
                            }}
                            type="button"
                          >
                            Telecharger le document
                          </Button>
                        </div>
                      ) : null}

                      {downloadStatusLine !== null ? (
                        <div aria-live="polite">
                          <p className="text-sm font-medium text-foreground">
                            {downloadStatusLine}
                          </p>
                        </div>
                      ) : null}

                      {canRenderDocumentDecision && documentDecisionDraft !== null ? (
                        <div className="grid gap-3">
                          <p className="text-sm font-semibold text-foreground">
                            Decision reviewer document
                          </p>

                          <div className="grid gap-2">
                            <label
                              className="text-sm font-medium text-foreground"
                              htmlFor={`document-decision-${documentId}`}
                            >
                              Decision reviewer document
                            </label>
                            <select
                              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                              disabled={documentDecisionControlsDisabled}
                              id={`document-decision-${documentId}`}
                              onChange={(event) => {
                                onDocumentDecisionChange(documentId, event.currentTarget.value);
                              }}
                              value={documentDecisionDraft.decision}
                            >
                              <option value="VERIFIED">VERIFIED</option>
                              <option value="REJECTED">REJECTED</option>
                            </select>
                          </div>

                          {documentDecisionDraft.decision === "REJECTED" ? (
                            <div className="grid gap-2">
                              <label
                                className="text-sm font-medium text-foreground"
                                htmlFor={`document-decision-comment-${documentId}`}
                              >
                                Commentaire reviewer
                              </label>
                              <textarea
                                className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                                disabled={documentDecisionControlsDisabled}
                                id={`document-decision-comment-${documentId}`}
                                onChange={(event) => {
                                  onDocumentDecisionCommentChange(
                                    documentId,
                                    event.currentTarget.value
                                  );
                                }}
                                value={documentDecisionDraft.comment}
                              />
                            </div>
                          ) : null}

                          <div>
                            <Button
                              disabled={
                                documentDecisionControlsDisabled ||
                                !canSubmitDocumentDecision(documentDecisionDraft)
                              }
                              onClick={() => {
                                void onDocumentDecisionSave(documentId);
                              }}
                              type="button"
                            >
                              Enregistrer la decision document
                            </Button>
                          </div>
                        </div>
                      ) : null}

                      {documentDecisionAvailabilityMessage !== null ? (
                        <div aria-live="polite">
                          <p className="text-sm font-medium text-foreground">
                            {documentDecisionAvailabilityMessage}
                          </p>
                        </div>
                      ) : null}

                      {documentDecisionStatusLines.length > 0 ? (
                        <div aria-live="polite" className="grid gap-2">
                          {documentDecisionStatusLines.map((line) => (
                            <p className="text-sm font-medium text-foreground" key={line}>
                              {line}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ControlsBlock>

        {item.documentVerificationSummary !== null ? (
          <ControlsBlock title="Verification documents">
            <ReadonlyLineList
              lines={[
                `documents total : ${item.documentVerificationSummary.documentsCount}`,
                `documents non verifies : ${item.documentVerificationSummary.unverifiedCount}`,
                `documents verifies : ${item.documentVerificationSummary.verifiedCount}`,
                `documents rejetes : ${item.documentVerificationSummary.rejectedCount}`
              ]}
            />
          </ControlsBlock>
        ) : null}
      </div>
    </article>
  );
}

function WorkpaperMutationStatus({ state }: { state: WorkpaperMutationState }) {
  if (state.kind === "idle") {
    return null;
  }

  return (
    <ControlsBlock title="Etat mutation workpaper">
      {state.kind === "success" ? (
        <div aria-live="polite" className="grid gap-2">
          <p className="label-eyebrow">Etat visible</p>
          <p className="text-lg font-semibold text-foreground">
            workpaper enregistre avec succes
          </p>
          {state.refreshFailed ? (
            <p className="text-sm font-medium text-foreground">
              rafraichissement workpapers impossible
            </p>
          ) : null}
        </div>
      ) : (
        <StateMessage text={formatWorkpaperMutationState(state)} />
      )}
    </ControlsBlock>
  );
}

function createWorkpaperDrafts(workpapers: ClosingWorkpapersReadModel) {
  return Object.fromEntries(
    workpapers.items.map((item) => [item.anchorCode, createWorkpaperDraft(item)])
  ) as Record<string, WorkpaperDraft>;
}

function createDocumentUploadDrafts(workpapers: ClosingWorkpapersReadModel) {
  return Object.fromEntries(
    workpapers.items.map((item) => [item.anchorCode, createDocumentUploadDraft()])
  ) as Record<string, DocumentUploadDraft>;
}

function createDocumentDecisionDrafts(workpapers: ClosingWorkpapersReadModel) {
  const entries = workpapers.items.flatMap((item) =>
    item.documents.flatMap((document) => {
      const documentId = getReadableDocumentId(document);

      return documentId === null ? [] : [[documentId, createDocumentDecisionDraft(document)]];
    })
  );

  return Object.fromEntries(entries) as Record<string, DocumentDecisionDraft>;
}

function createWorkpaperDraft(item: WorkpaperReadModelItem): WorkpaperDraft {
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

function createDocumentUploadDraft(): DocumentUploadDraft {
  return {
    file: null,
    selectedFileCount: 0,
    sourceLabel: "",
    documentDate: ""
  };
}

function createDocumentDecisionDraft(document: WorkpaperDocument): DocumentDecisionDraft {
  return {
    decision: document.verificationStatus === "REJECTED" ? "REJECTED" : "VERIFIED",
    comment:
      typeof document.reviewComment === "string" && document.reviewComment.length > 0
        ? document.reviewComment
        : ""
  };
}

function getWorkpaperDraft(
  drafts: Record<string, WorkpaperDraft>,
  item: WorkpaperReadModelItem
) {
  return drafts[item.anchorCode] ?? createWorkpaperDraft(item);
}

function getDocumentUploadDraft(
  drafts: Record<string, DocumentUploadDraft>,
  item: WorkpaperReadModelItem
) {
  return drafts[item.anchorCode] ?? createDocumentUploadDraft();
}

function getDocumentDecisionDraft(
  drafts: Record<string, DocumentDecisionDraft>,
  document: WorkpaperDocument
) {
  const documentId = getReadableDocumentId(document);

  if (documentId === null) {
    return createDocumentDecisionDraft(document);
  }

  return drafts[documentId] ?? createDocumentDecisionDraft(document);
}

function hasWorkpaperWritableRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => workpaperWritableRoles.has(role)) ?? false;
}

function hasDocumentReadableRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => documentReadableRoles.has(role)) ?? false;
}

function hasDocumentReviewerRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => documentReviewerRoles.has(role)) ?? false;
}

function isMakerWorkpaperStatus(value: string): value is MakerWorkpaperStatus {
  return value === "DRAFT" || value === "READY_FOR_REVIEW";
}

function isDocumentVerificationDecision(value: string): value is DocumentVerificationDecision {
  return value === "VERIFIED" || value === "REJECTED";
}

function isWorkpaperMakerEditable(item: WorkpaperReadModelItem) {
  return (
    item.workpaper === null ||
    item.workpaper.status === "DRAFT" ||
    item.workpaper.status === "CHANGES_REQUESTED"
  );
}

function isWorkpaperDocumentUploadEditable(item: WorkpaperReadModelItem) {
  return (
    item.isCurrentStructure &&
    item.workpaper !== null &&
    (item.workpaper.status === "DRAFT" || item.workpaper.status === "CHANGES_REQUESTED")
  );
}

function getDocumentDecisionAvailabilityMessage(
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

function getWorkpapersGlobalReadOnlyMessage(
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

function getCurrentWorkpaperUploadAvailabilityMessage(
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

function getCurrentWorkpaperReadOnlyMessage(
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

function validateDocumentUploadDraft(
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

function createWorkpaperEvidencePayload(item: WorkpaperReadModelItem): WorkpaperEvidence[] | null {
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

function isWorkpaperEvidencePayload(evidence: WorkpaperEvidence) {
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

function hasWorkpaperDraftChanges(item: WorkpaperReadModelItem, draft: WorkpaperDraft) {
  if (item.workpaper === null) {
    return true;
  }

  return (
    draft.noteText.trim() !== item.workpaper.noteText || draft.status !== item.workpaper.status
  );
}

function canUploadDocumentItem(
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

function canSaveWorkpaperItem(
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

function canSubmitDocumentDecision(draft: DocumentDecisionDraft) {
  if (!isDocumentVerificationDecision(draft.decision)) {
    return false;
  }

  return draft.decision !== "REJECTED" || draft.comment.trim().length > 0;
}

function getDocumentDownloadStatusLine(
  document: WorkpaperDocument,
  state: DocumentDownloadState
) {
  const documentId = getReadableDocumentId(document);

  if (documentId === null) {
    return "telechargement indisponible";
  }

  if (state.kind === "idle" || state.documentId !== documentId) {
    return null;
  }

  if (state.kind === "submitting") {
    return "telechargement document en cours";
  }

  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces documents refuse";
  }

  if (state.kind === "not_found") {
    return "document introuvable pour telechargement";
  }

  if (state.kind === "server_error") {
    return "erreur serveur documents";
  }

  if (state.kind === "network_error") {
    return "erreur reseau documents";
  }

  if (state.kind === "timeout") {
    return "timeout documents";
  }

  return "telechargement indisponible";
}

function getDocumentDecisionStatusLines(
  documentId: string,
  draft: DocumentDecisionDraft,
  state: DocumentDecisionState
) {
  if (state.kind !== "idle" && state.documentId === documentId) {
    if (state.kind === "submitting") {
      return ["decision document en cours"];
    }

    if (state.kind === "success") {
      return state.refreshFailed
        ? ["decision document enregistree avec succes", "rafraichissement workpapers impossible"]
        : ["decision document enregistree avec succes"];
    }

    if (state.kind === "comment_required") {
      return ["commentaire reviewer requis"];
    }

    if (state.kind === "read_only_archived") {
      return ["dossier archive, verification document en lecture seule"];
    }

    if (state.kind === "read_only_not_ready") {
      return ["verification document non modifiable tant que les controles ne sont pas READY"];
    }

    if (state.kind === "read_only_role") {
      return ["verification reviewer en lecture seule"];
    }

    if (state.kind === "workpaper_not_ready") {
      return ["decision document disponible quand le workpaper est READY_FOR_REVIEW"];
    }

    if (state.kind === "bad_request") {
      return ["decision document invalide"];
    }

    if (state.kind === "auth_required") {
      return ["authentification requise"];
    }

    if (state.kind === "forbidden") {
      return ["acces verification document refuse"];
    }

    if (state.kind === "not_found") {
      return ["document introuvable pour decision"];
    }

    if (state.kind === "conflict_archived") {
      return ["dossier archive, verification document non modifiable"];
    }

    if (state.kind === "conflict_not_ready") {
      return ["verification document non modifiable tant que les controles ne sont pas READY"];
    }

    if (state.kind === "conflict_stale") {
      return ["document indisponible sur un workpaper stale"];
    }

    if (state.kind === "conflict_workpaper_status") {
      return ["decision document disponible quand le workpaper est READY_FOR_REVIEW"];
    }

    if (state.kind === "conflict_other") {
      return ["decision document impossible"];
    }

    if (state.kind === "server_error") {
      return ["erreur serveur documents"];
    }

    if (state.kind === "network_error") {
      return ["erreur reseau documents"];
    }

    if (state.kind === "timeout") {
      return ["timeout documents"];
    }

    if (state.kind === "invalid_payload") {
      return ["payload decision document invalide"];
    }

    return ["decision document indisponible"];
  }

  if (draft.decision === "REJECTED" && draft.comment.trim().length === 0) {
    return ["commentaire reviewer requis"];
  }

  return [];
}

function getDocumentUploadStatusLines(
  anchorCode: string,
  draft: DocumentUploadDraft,
  state: DocumentUploadState
) {
  if (state.kind !== "idle" && state.anchorCode === anchorCode) {
    if (state.kind === "submitting") {
      return ["upload document en cours"];
    }

    if (state.kind === "success") {
      return state.refreshFailed
        ? ["document uploade avec succes", "rafraichissement workpapers impossible"]
        : ["document uploade avec succes"];
    }

    if (state.kind === "bad_request") {
      return ["document invalide"];
    }

    if (state.kind === "bad_request_invalid_media_type") {
      return ["format de fichier non autorise"];
    }

    if (state.kind === "bad_request_empty_file") {
      return ["fichier vide"];
    }

    if (state.kind === "bad_request_source_required") {
      return ["source du document requise"];
    }

    if (state.kind === "auth_required") {
      return ["authentification requise"];
    }

    if (state.kind === "forbidden") {
      return ["acces documents refuse"];
    }

    if (state.kind === "not_found") {
      return ["workpaper introuvable pour upload document"];
    }

    if (state.kind === "conflict_archived") {
      return ["dossier archive, document non modifiable"];
    }

    if (state.kind === "conflict_not_ready") {
      return ["document non modifiable tant que les controles ne sont pas READY"];
    }

    if (state.kind === "conflict_stale") {
      return ["document indisponible sur un workpaper stale"];
    }

    if (state.kind === "conflict_workpaper_read_only") {
      return ["document non modifiable pour ce workpaper"];
    }

    if (state.kind === "conflict_other") {
      return ["upload document impossible"];
    }

    if (state.kind === "payload_too_large") {
      return ["fichier trop volumineux (25 MiB max)"];
    }

    if (state.kind === "server_error") {
      return ["erreur serveur documents"];
    }

    if (state.kind === "network_error") {
      return ["erreur reseau documents"];
    }

    if (state.kind === "timeout") {
      return ["timeout documents"];
    }

    if (state.kind === "invalid_payload") {
      return ["payload upload document invalide"];
    }

    return ["upload document indisponible"];
  }

  const validation = validateDocumentUploadDraft(draft);
  return [validation.kind === "valid" ? "fichier pret pour upload" : validation.message];
}

function mapWorkpaperMutationResult(
  result: Exclude<Awaited<ReturnType<typeof upsertWorkpaper>>, { kind: "success" }>
): WorkpaperMutationState {
  if (result.kind === "bad_request") {
    return { kind: "invalid_workpaper" };
  }

  if (result.kind === "auth_required") {
    return { kind: "auth_required" };
  }

  if (result.kind === "forbidden") {
    return { kind: "forbidden" };
  }

  if (result.kind === "not_found") {
    return { kind: "not_found" };
  }

  if (result.kind === "conflict_archived") {
    return { kind: "conflict_archived" };
  }

  if (result.kind === "conflict_not_ready") {
    return { kind: "conflict_not_ready" };
  }

  if (result.kind === "conflict_other") {
    return { kind: "conflict_other" };
  }

  if (result.kind === "server_error") {
    return { kind: "server_error" };
  }

  if (result.kind === "network_error") {
    return { kind: "network_error" };
  }

  if (result.kind === "timeout") {
    return { kind: "timeout" };
  }

  if (result.kind === "invalid_payload") {
    return { kind: "invalid_payload" };
  }

  return { kind: "unexpected" };
}

function mapDocumentUploadResult(
  result: Exclude<UploadWorkpaperDocumentState, { kind: "success" }>,
  anchorCode: string
): DocumentUploadState {
  return {
    ...result,
    anchorCode
  };
}

function mapDocumentDownloadResult(
  result: Exclude<DownloadWorkpaperDocumentState, { kind: "success" }>,
  documentId: string
): DocumentDownloadState {
  return {
    ...result,
    documentId
  };
}

function mapDocumentDecisionResult(
  result: Exclude<ReviewDocumentVerificationDecisionState, { kind: "success" }>,
  documentId: string
): DocumentDecisionState {
  return {
    ...result,
    documentId
  };
}

function formatWorkpaperMutationState(
  state: Exclude<WorkpaperMutationState, { kind: "idle" | "success" }>
) {
  if (state.kind === "submitting") {
    return "enregistrement workpaper en cours";
  }

  if (state.kind === "read_only_archived") {
    return "dossier archive, workpaper en lecture seule";
  }

  if (state.kind === "read_only_not_ready") {
    return "workpaper non modifiable tant que les controles ne sont pas READY";
  }

  if (state.kind === "read_only_role") {
    return "lecture seule";
  }

  if (state.kind === "stale_read_only") {
    return "workpapers stale en lecture seule";
  }

  if (state.kind === "item_read_only") {
    return "workpaper en lecture seule";
  }

  if (state.kind === "invalid_workpaper") {
    return "workpaper invalide";
  }

  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces workpapers refuse";
  }

  if (state.kind === "not_found") {
    return "dossier introuvable";
  }

  if (state.kind === "conflict_archived") {
    return "dossier archive, workpaper non modifiable";
  }

  if (state.kind === "conflict_not_ready") {
    return "workpaper non modifiable tant que les controles ne sont pas READY";
  }

  if (state.kind === "conflict_other") {
    return "mise a jour workpaper impossible";
  }

  if (state.kind === "server_error") {
    return "erreur serveur workpapers";
  }

  if (state.kind === "network_error") {
    return "erreur reseau workpapers";
  }

  if (state.kind === "timeout") {
    return "timeout workpapers";
  }

  if (state.kind === "invalid_payload") {
    return "payload workpaper invalide";
  }

  if (state.kind === "invalid_workpapers_payload") {
    return "payload workpapers invalide";
  }

  return "workpaper indisponible";
}

function clearDocumentUploadStateForAnchor(
  state: DocumentUploadState,
  anchorCode: string
): DocumentUploadState {
  if (state.kind === "idle" || state.kind === "submitting" || state.anchorCode !== anchorCode) {
    return state;
  }

  return { kind: "idle" };
}

function clearDocumentDecisionStateForDocument(
  state: DocumentDecisionState,
  documentId: string
): DocumentDecisionState {
  if (state.kind === "idle" || state.kind === "submitting" || state.documentId !== documentId) {
    return state;
  }

  return { kind: "idle" };
}

function getReadableDocumentId(document: WorkpaperDocument) {
  if (typeof document.id !== "string") {
    return null;
  }

  return isUuid(document.id) ? document.id : null;
}

function findDocumentInWorkpapers(
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

function findCurrentDocumentInWorkpapers(
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

function triggerDocumentDownload(
  rawBlob: Blob,
  resolvedMediaType: string | null,
  resolvedFileName: string
) {
  const typedBlob =
    resolvedMediaType !== null && rawBlob.type === ""
      ? new Blob([rawBlob], { type: resolvedMediaType })
      : rawBlob;
  const objectUrl = URL.createObjectURL(typedBlob);
  const link = document.createElement("a");

  try {
    link.href = objectUrl;
    link.download = resolvedFileName;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

function resolveDocumentDownloadFileName(
  contentDisposition: string | null,
  fallbackFileName: string | null,
  documentId: string
) {
  const contentDispositionFileName =
    parseContentDispositionFilenameStar(contentDisposition) ??
    parseContentDispositionFilename(contentDisposition);

  if (contentDispositionFileName !== null) {
    return contentDispositionFileName;
  }

  if (fallbackFileName !== null) {
    return fallbackFileName;
  }

  return `document-${documentId}`;
}

function resolveDocumentDownloadMediaType(
  contentType: string | null,
  fallbackMediaType: string | null
) {
  return normalizeNonEmptyString(contentType) ?? normalizeNonEmptyString(fallbackMediaType);
}

function getFallbackDocumentFileName(document: WorkpaperDocument) {
  return normalizeNonEmptyString(document.fileName);
}

function getFallbackDocumentMediaType(document: WorkpaperDocument) {
  return normalizeNonEmptyString(document.mediaType);
}

function parseContentDispositionFilenameStar(value: string | null) {
  if (value === null) {
    return null;
  }

  const match = value.match(/filename\*\s*=\s*([^;]+)/i);

  if (match?.[1] === undefined) {
    return null;
  }

  const rawValue = stripWrappedQuotes(match[1].trim());
  const separatorIndex = rawValue.indexOf("''");

  if (separatorIndex < 0) {
    return null;
  }

  const encodedFileName = rawValue.slice(separatorIndex + 2);

  try {
    return normalizeNonEmptyString(decodeURIComponent(encodedFileName));
  } catch {
    return null;
  }
}

function parseContentDispositionFilename(value: string | null) {
  if (value === null) {
    return null;
  }

  const match = value.match(/filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i);

  if (match?.[1] === undefined) {
    return null;
  }

  return normalizeNonEmptyString(unescapeQuotedString(stripWrappedQuotes(match[1].trim())));
}

function stripWrappedQuotes(value: string) {
  if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) {
    return value.slice(1, -1);
  }

  return value;
}

function unescapeQuotedString(value: string) {
  return value.replace(/\\(.)/g, "$1");
}

function normalizeNonEmptyString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isDocumentUploadFileAllowed(file: File) {
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

function normalizeDocumentUploadMediaType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.split(";")[0]?.trim() ?? null;
}

function getLowercaseDocumentUploadExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

function isIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function ReadonlyLineList({ lines }: { lines: string[] }) {
  return (
    <ul className="grid gap-3">
      {lines.map((line, index) => (
        <li
          className="rounded-lg border bg-background/80 p-4 text-sm font-medium tabular-nums text-foreground"
          key={`${index}-${line}`}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function ControlsBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-3">
        <h4 className="text-lg font-semibold text-foreground">{title}</h4>
        {children}
      </div>
    </section>
  );
}

function StateMessage({ text }: { text: string }) {
  return (
    <div aria-live="polite" className="grid gap-2">
      <p className="label-eyebrow">Etat visible</p>
      <p className="text-lg font-semibold text-foreground">{text}</p>
    </div>
  );
}
