import type { ChangeEvent, ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { EffectiveRolesHint } from "../../lib/api/me";
import type {
  ClosingWorkpapersReadModel,
  WorkpaperReadModelItem,
  WorkpapersShellState
} from "../../lib/api/workpapers";
import {
  canMarkWorkpaperReviewed,
  canSaveWorkpaperItem,
  canSubmitDocumentDecision,
  canSubmitWorkpaperDecision,
  canUploadDocumentItem,
  documentUploadInputAccept,
  getCurrentWorkpaperReadOnlyMessage,
  getCurrentWorkpaperUploadAvailabilityMessage,
  getDocumentDecisionAvailabilityMessage,
  getDocumentDecisionDraft,
  getDocumentUploadDraft,
  getReadableDocumentId,
  getWorkpaperDecisionAvailabilityMessage,
  getWorkpaperDecisionDraft,
  getWorkpaperDraft,
  getWorkpapersGlobalReadOnlyMessage,
  hasDocumentReadableRole,
  isWorkpaperDocumentUploadEditable
} from "./model";
import {
  formatWorkpaperMutationState,
  getDocumentDecisionStatusLines,
  getDocumentDownloadStatusLine,
  getDocumentUploadStatusLines,
  getWorkpaperDecisionStatusLines
} from "./status-lines";
import type {
  DocumentDecisionDraft,
  DocumentDecisionState,
  DocumentDownloadState,
  DocumentUploadDraft,
  DocumentUploadState,
  WorkpaperDecisionDraft,
  WorkpaperDecisionState,
  WorkpaperDraft,
  WorkpaperMutationState
} from "./types";

export function WorkpapersSlot({
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
  onWorkpaperDecisionChange,
  onWorkpaperDecisionCommentChange,
  onWorkpaperDecisionSave,
  state,
  workpaperDecisionDrafts,
  workpaperDecisionState,
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
  onWorkpaperDecisionChange: (anchorCode: string, decision: string) => void;
  onWorkpaperDecisionCommentChange: (anchorCode: string, comment: string) => void;
  onWorkpaperDecisionSave: (anchorCode: string) => void;
  state: WorkpapersShellState;
  workpaperDecisionDrafts: Record<string, WorkpaperDecisionDraft>;
  workpaperDecisionState: WorkpaperDecisionState;
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
      onWorkpaperDecisionChange={onWorkpaperDecisionChange}
      onWorkpaperDecisionCommentChange={onWorkpaperDecisionCommentChange}
      onWorkpaperDecisionSave={onWorkpaperDecisionSave}
      workpaperDecisionDrafts={workpaperDecisionDrafts}
      workpaperDecisionState={workpaperDecisionState}
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
  onWorkpaperDecisionChange,
  onWorkpaperDecisionCommentChange,
  onWorkpaperDecisionSave,
  workpaperDecisionDrafts,
  workpaperDecisionState,
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
  onWorkpaperDecisionChange: (anchorCode: string, decision: string) => void;
  onWorkpaperDecisionCommentChange: (anchorCode: string, comment: string) => void;
  onWorkpaperDecisionSave: (anchorCode: string) => void;
  workpaperDecisionDrafts: Record<string, WorkpaperDecisionDraft>;
  workpaperDecisionState: WorkpaperDecisionState;
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
    documentUploadState.kind === "submitting" ||
    workpaperDecisionState.kind === "submitting";
  const downloadControlsDisabled =
    documentDecisionState.kind === "submitting" ||
    documentDownloadState.kind === "submitting" ||
    workpaperDecisionState.kind === "submitting";
  const documentDecisionControlsDisabled =
    documentDecisionState.kind === "submitting" ||
    workpaperDecisionState.kind === "submitting";
  const workpaperDecisionControlsDisabled = workpaperDecisionState.kind === "submitting";

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
                    onWorkpaperDecisionChange={onWorkpaperDecisionChange}
                    onWorkpaperDecisionCommentChange={onWorkpaperDecisionCommentChange}
                    onWorkpaperDecisionSave={onWorkpaperDecisionSave}
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
                    workpapersForWorkpaperDecision={workpapers}
                    workpaperDecisionControlsDisabled={workpaperDecisionControlsDisabled}
                    workpaperDecisionDrafts={workpaperDecisionDrafts}
                    workpaperDecisionState={workpaperDecisionState}
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
  onWorkpaperDecisionChange,
  onWorkpaperDecisionCommentChange,
  onWorkpaperDecisionSave,
  saveDisabled = true,
  uploadAvailabilityMessage = null,
  uploadDisabled = true,
  workpapersForDocumentDecision = null,
  workpapersForWorkpaperDecision = null,
  workpaperDecisionControlsDisabled = false,
  workpaperDecisionDrafts = {},
  workpaperDecisionState = { kind: "idle" }
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
  onWorkpaperDecisionChange?: (anchorCode: string, decision: string) => void;
  onWorkpaperDecisionCommentChange?: (anchorCode: string, comment: string) => void;
  onWorkpaperDecisionSave?: (anchorCode: string) => void;
  saveDisabled?: boolean;
  uploadAvailabilityMessage?: string | null;
  uploadDisabled?: boolean;
  workpapersForDocumentDecision?: ClosingWorkpapersReadModel | null;
  workpapersForWorkpaperDecision?: ClosingWorkpapersReadModel | null;
  workpaperDecisionControlsDisabled?: boolean;
  workpaperDecisionDrafts?: Record<string, WorkpaperDecisionDraft>;
  workpaperDecisionState?: WorkpaperDecisionState;
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
  const workpaperDecisionAvailabilityMessage =
    workpapersForWorkpaperDecision === null
      ? null
      : getWorkpaperDecisionAvailabilityMessage(
          workpapersForWorkpaperDecision,
          effectiveRoles,
          item
        );
  const canRenderWorkpaperDecision =
    workpapersForWorkpaperDecision !== null &&
    workpaperDecisionAvailabilityMessage === null &&
    onWorkpaperDecisionChange !== undefined &&
    onWorkpaperDecisionCommentChange !== undefined &&
    onWorkpaperDecisionSave !== undefined;
  const resolvedWorkpaperDecisionDraft =
    workpapersForWorkpaperDecision !== null
      ? getWorkpaperDecisionDraft(workpaperDecisionDrafts, item)
      : null;
  const workpaperDecisionDraft = canRenderWorkpaperDecision
    ? resolvedWorkpaperDecisionDraft
    : null;
  const shouldShowWorkpaperDecisionState =
    workpaperDecisionState.kind !== "idle" && workpaperDecisionState.anchorCode === item.anchorCode;
  const workpaperDecisionStatusLines =
    (canRenderWorkpaperDecision || shouldShowWorkpaperDecisionState) &&
    resolvedWorkpaperDecisionDraft !== null
      ? getWorkpaperDecisionStatusLines(
          item.anchorCode,
          item,
          resolvedWorkpaperDecisionDraft,
          workpaperDecisionState
        )
      : [];
  const existingReviewerComment =
    item.workpaper?.status === "CHANGES_REQUESTED" &&
    typeof item.workpaper.reviewComment === "string" &&
    item.workpaper.reviewComment.trim().length > 0
      ? item.workpaper.reviewComment.trim()
      : null;

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

        {existingReviewerComment !== null ? (
          <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-semibold text-foreground">Reviewer requested changes</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">{existingReviewerComment}</p>
          </div>
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
                  <p
                    className="text-sm font-medium text-foreground"
                    key={`${item.anchorCode}-${line}`}
                  >
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

        {workpapersForWorkpaperDecision !== null ? (
          <ControlsBlock title="Decision reviewer workpaper">
            {canRenderWorkpaperDecision && workpaperDecisionDraft !== null ? (
              <div
                aria-busy={
                  workpaperDecisionState.kind === "submitting" &&
                  workpaperDecisionState.anchorCode === item.anchorCode
                }
                className="grid gap-3"
              >
                <div className="grid gap-2">
                  <label
                    className="text-sm font-medium text-foreground"
                    htmlFor={`workpaper-decision-${item.anchorCode}`}
                  >
                    Decision reviewer workpaper
                  </label>
                  <select
                    className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                    disabled={workpaperDecisionControlsDisabled}
                    id={`workpaper-decision-${item.anchorCode}`}
                    onChange={(event) => {
                      onWorkpaperDecisionChange(item.anchorCode, event.currentTarget.value);
                    }}
                    value={workpaperDecisionDraft.decision}
                  >
                    <option disabled={!canMarkWorkpaperReviewed(item)} value="REVIEWED">
                      Mark reviewed
                    </option>
                    <option value="CHANGES_REQUESTED">Request changes</option>
                  </select>
                </div>

                {workpaperDecisionDraft.decision === "CHANGES_REQUESTED" ? (
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor={`workpaper-decision-comment-${item.anchorCode}`}
                    >
                      Reviewer comment
                    </label>
                    <textarea
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                      disabled={workpaperDecisionControlsDisabled}
                      id={`workpaper-decision-comment-${item.anchorCode}`}
                      onChange={(event) => {
                        onWorkpaperDecisionCommentChange(
                          item.anchorCode,
                          event.currentTarget.value
                        );
                      }}
                      value={workpaperDecisionDraft.comment}
                    />
                  </div>
                ) : null}

                {workpaperDecisionStatusLines.length > 0 ? (
                  <div aria-live="polite" className="grid gap-2">
                    {workpaperDecisionStatusLines.map((line) => (
                      <p className="text-sm font-medium text-foreground" key={line}>
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}

                <div>
                  <Button
                    disabled={
                      workpaperDecisionControlsDisabled ||
                      !canSubmitWorkpaperDecision(item, workpaperDecisionDraft)
                    }
                    onClick={() => {
                      void onWorkpaperDecisionSave(item.anchorCode);
                    }}
                    type="button"
                  >
                    Save reviewer decision
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <p className="text-sm font-medium text-foreground">
                  {workpaperDecisionAvailabilityMessage ??
                    "workpaper decision unavailable for this status"}
                </p>
                {workpaperDecisionStatusLines.length > 0 ? (
                  <div aria-live="polite" className="grid gap-2">
                    {workpaperDecisionStatusLines.map((line) => (
                      <p className="text-sm font-medium text-foreground" key={line}>
                        {line}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
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
