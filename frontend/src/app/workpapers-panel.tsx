import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import type { ClosingFolderSummary } from "../lib/api/closing-folders";
import type { ActiveTenant, EffectiveRolesHint } from "../lib/api/me";
import {
  downloadWorkpaperDocument,
  loadWorkpapersShellState,
  reviewDocumentVerificationDecision,
  uploadWorkpaperDocument,
  upsertWorkpaper,
  type WorkpapersShellState
} from "../lib/api/workpapers";
import {
  getFallbackDocumentFileName,
  getFallbackDocumentMediaType,
  resolveDocumentDownloadFileName,
  resolveDocumentDownloadMediaType,
  triggerDocumentDownload
} from "./workpapers-panel/download";
import {
  clearDocumentDecisionStateForDocument,
  clearDocumentUploadStateForAnchor,
  createDocumentDecisionDrafts,
  createDocumentUploadDrafts,
  createWorkpaperDrafts,
  createWorkpaperEvidencePayload,
  findCurrentDocumentInWorkpapers,
  findDocumentInWorkpapers,
  getDocumentDecisionDraft,
  getDocumentUploadDraft,
  getReadableDocumentId,
  getWorkpaperDraft,
  hasDocumentReadableRole,
  hasDocumentReviewerRole,
  hasWorkpaperDraftChanges,
  hasWorkpaperWritableRole,
  isDocumentVerificationDecision,
  isMakerWorkpaperStatus,
  isWorkpaperDocumentUploadEditable,
  isWorkpaperMakerEditable,
  validateDocumentUploadDraft
} from "./workpapers-panel/model";
import {
  mapDocumentDecisionResult,
  mapDocumentDownloadResult,
  mapDocumentUploadResult,
  mapWorkpaperMutationResult
} from "./workpapers-panel/status-lines";
import type {
  DocumentDecisionDraft,
  DocumentDecisionState,
  DocumentDownloadState,
  DocumentUploadDraft,
  DocumentUploadState,
  WorkpaperDraft,
  WorkpaperMutationState
} from "./workpapers-panel/types";
import { WorkpapersSlot } from "./workpapers-panel/view";

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

    const draft = getDocumentDecisionDraft(documentDecisionDrafts, resolvedDocument.document);

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
          onDocumentDecisionSave={handleSaveDocumentDecision}
          onDocumentDownload={handleDocumentDownload}
          onDocumentFileChange={handleDocumentUploadFileChange}
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
