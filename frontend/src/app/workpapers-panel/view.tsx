import type { ChangeEvent, ReactNode } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import type { EffectiveRolesHint } from "../../lib/api/me";
import type {
  ClosingWorkpapersReadModel,
  WorkpaperDocument,
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
  hasWorkpaperDraftChanges,
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

type FactItem = {
  detail?: ReactNode;
  label: string;
  value: ReactNode;
};

type WorkpaperRubricDisplay = {
  breakdownLabel: string;
  sourceLabel: string | null;
  statementLabel: string;
  title: string;
};

const workpaperRubricLabelsByCode: Record<string, string> = {
  "BS.ASSET": "Actifs",
  "BS.ASSET.CASH_AND_EQUIVALENTS": "Liquidités et équivalents de trésorerie",
  "BS.ASSET.CURRENT_SECTION": "Actifs circulants",
  "BS.ASSET.FINANCIAL_FIXED_ASSETS": "Immobilisations financières",
  "BS.ASSET.INTANGIBLE_FIXED_ASSETS": "Immobilisations incorporelles",
  "BS.ASSET.INVENTORIES_AND_WIP": "Stocks et travaux en cours",
  "BS.ASSET.NON_CURRENT_SECTION": "Actifs immobilises",
  "BS.ASSET.OTHER_RECEIVABLES": "Autres créances",
  "BS.ASSET.PREPAIDS_AND_OTHER_CURRENT": "Actifs de régularisation et autres actifs circulants",
  "BS.ASSET.TANGIBLE_FIXED_ASSETS": "Immobilisations corporelles",
  "BS.ASSET.TRADE_RECEIVABLES": "Créances clients",
  "BS.EQUITY": "Capitaux propres",
  "BS.EQUITY.CAPITAL_RESERVES": "Reserves de capital",
  "BS.EQUITY.CORE_SECTION": "Capitaux propres",
  "BS.EQUITY.RETAINED_EARNINGS": "Résultats reportés",
  "BS.EQUITY.SHARE_CAPITAL": "Capital social",
  "BS.LIABILITY": "Passifs",
  "BS.LIABILITY.ACCRUALS_AND_DEFERRED_INCOME": "Passifs de régularisation",
  "BS.LIABILITY.CURRENT_SECTION": "Dettes à court terme",
  "BS.LIABILITY.LONG_TERM_FINANCIAL_DEBT": "Dettes financières à long terme",
  "BS.LIABILITY.NON_CURRENT_SECTION": "Dettes à long terme",
  "BS.LIABILITY.OTHER_CURRENT_LIABILITIES": "Autres dettes à court terme",
  "BS.LIABILITY.SHORT_TERM_FINANCIAL_DEBT": "Dettes financières à court terme",
  "BS.LIABILITY.TRADE_PAYABLES": "Dettes fournisseurs",
  "PL.EXPENSE": "Charges",
  "PL.EXPENSE.COST_OF_MATERIALS_AND_SERVICES": "Charges de matériel et prestations",
  "PL.EXPENSE.DEPRECIATION_AND_AMORTISATION": "Amortissements et dépréciations",
  "PL.EXPENSE.FINANCIAL_EXPENSES": "Charges financières",
  "PL.EXPENSE.FINANCIAL_SECTION": "Charges financières",
  "PL.EXPENSE.INCOME_TAX": "Impôts sur le résultat",
  "PL.EXPENSE.OPERATING_SECTION": "Charges d'exploitation",
  "PL.EXPENSE.OTHER_OPERATING_EXPENSES": "Autres charges d'exploitation",
  "PL.EXPENSE.PERSONNEL_EXPENSES": "Charges de personnel",
  "PL.EXPENSE.TAX_SECTION": "Impôts sur le résultat",
  "PL.REVENUE": "Produits",
  "PL.REVENUE.OPERATING_REVENUE": "Produits d'exploitation",
  "PL.REVENUE.OPERATING_SECTION": "Produits d'exploitation",
  "PL.REVENUE.OTHER_REVENUE": "Autres produits",
  "PL.REVENUE.OTHER_SECTION": "Autres produits"
};

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
    return <StateMessage text="Chargement des justifications / preuves." />;
  }

  if (state.kind === "auth_required") {
    return <StateMessage text="Authentification requise pour consulter les preuves." />;
  }

  if (state.kind === "forbidden") {
    return <StateMessage text="Acces aux justifications / preuves refuse." />;
  }

  if (state.kind === "not_found") {
    return <StateMessage text="Justifications / preuves introuvables pour ce dossier." />;
  }

  if (state.kind === "server_error") {
    return <StateMessage text="Justifications / preuves indisponibles pour le moment." />;
  }

  if (state.kind === "network_error") {
    return <StateMessage text="Connexion indisponible pendant le chargement des preuves." />;
  }

  if (state.kind === "timeout") {
    return <StateMessage text="Delai depasse pendant le chargement des preuves. Reessayez avant de poursuivre la revue." />;
  }

  if (state.kind === "invalid_payload") {
    return <StateMessage text="Données de preuves incohérentes. L’écran reste bloqué par sécurité." />;
  }

  if (state.kind === "bad_request" || state.kind === "unexpected") {
    return <StateMessage text="Justifications / preuves indisponibles pour le moment." />;
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
  const documentCounts = getWorkpapersDocumentCounts(workpapers.items);
  const summaryFacts: FactItem[] = [
    {
      label: "Rubriques a documenter",
      value: workpapers.summaryCounts.totalCurrentAnchors
    },
    {
      label: "Justifications existantes",
      value: workpapers.summaryCounts.withWorkpaperCount
    },
    {
      label: "Pretes pour revue",
      value: workpapers.summaryCounts.readyForReviewCount
    },
    {
      label: "Revue terminee",
      value: workpapers.summaryCounts.reviewedCount
    },
    {
      label: "Pièces jointes",
      value: documentCounts.total
    },
    {
      detail:
        documentCounts.rejected > 0
          ? "Verifier les pieces rejetees avant de terminer la revue."
          : "Completer les pieces manquantes puis verifier les preuves rattachees.",
      label: "Prochaine action humaine",
      value:
        workpapers.summaryCounts.missingCount > 0 || documentCounts.unverified > 0
          ? "Continuer les preuves"
          : "Relire les justifications"
    }
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
        Prochaine action : completer les rubriques sans justification, joindre les pieces utiles,
        puis envoyer les preuves pretes en revue.
      </p>

      <WorkpaperMutationStatus state={mutationState} />

      <ControlsBlock title="Synthese Justifications / Preuves">
        <ReadonlyFactList facts={summaryFacts} />
      </ControlsBlock>

      {globalReadOnlyMessage !== null ? (
        <p className="text-sm font-medium text-foreground">
          {formatAvailabilityMessage(globalReadOnlyMessage)}
        </p>
      ) : null}

      {workpapers.items.length === 0 && workpapers.staleWorkpapers.length === 0 ? (
        <p className="text-sm font-medium text-foreground">Aucune rubrique à documenter</p>
      ) : null}

      <ControlsBlock id="justifications-preuves-current" title="Rubriques a documenter">
        {workpapers.items.length === 0 ? (
          <p className="text-sm font-medium text-foreground">Aucune rubrique à documenter</p>
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
        <ControlsBlock title="Anciennes rubriques">
          <p className="text-sm font-medium text-foreground">
            Ancienne rubrique en lecture seule : justification rattachée à une structure
            précédente.
          </p>
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
        </ControlsBlock>
      ) : null}
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
  const rubricDisplay = getWorkpaperRubricDisplay(item);
  const facts: FactItem[] = [
    {
      label: "Justification",
      value: formatWorkpaperStatus(item.workpaper?.status ?? null)
    },
    {
      label: "Pièces jointes",
      value: item.documents.length
    },
    {
      label: "Verification",
      value: formatVerificationSummary(item)
    }
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
  const saveDisabledReason =
    canRenderMakerForm && draft !== null
      ? getWorkpaperSaveDisabledReason(item, draft, controlsDisabled, saveDisabled)
      : null;
  const saveDisabledReasonId =
    saveDisabledReason === null ? undefined : `workpaper-save-reason-${item.anchorCode}`;
  const workpaperDecisionDisabledReason =
    canRenderWorkpaperDecision && workpaperDecisionDraft !== null
      ? getWorkpaperDecisionDisabledReason(
          item,
          workpaperDecisionDraft,
          workpaperDecisionControlsDisabled,
          workpaperDecisionStatusLines
        )
      : null;
  const workpaperDecisionDisabledReasonId =
    workpaperDecisionDisabledReason === null
      ? undefined
      : `workpaper-decision-reason-${item.anchorCode}`;
  const existingReviewerComment =
    item.workpaper?.status === "CHANGES_REQUESTED" &&
    typeof item.workpaper.reviewComment === "string" &&
    item.workpaper.reviewComment.trim().length > 0
      ? item.workpaper.reviewComment.trim()
      : null;

  return (
    <article
      aria-label={formatWorkpaperCardAriaLabel(rubricDisplay, item)}
      className="rounded-lg border bg-background/80 p-4"
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <p className="label-eyebrow">Rubrique</p>
          <p className="text-base font-semibold text-foreground">{rubricDisplay.title}</p>
          <div className="grid gap-1 text-xs text-muted-foreground">
            <p>
              Code canonique :{" "}
              <span className="break-all font-mono">{item.anchorCode}</span>
            </p>
            {rubricDisplay.sourceLabel !== null &&
            rubricDisplay.sourceLabel !== rubricDisplay.title ? (
              <p>Libellé source : {rubricDisplay.sourceLabel}</p>
            ) : null}
            <p>
              {rubricDisplay.statementLabel} - {rubricDisplay.breakdownLabel}
            </p>
            {!item.isCurrentStructure ? (
              <p className="font-medium text-foreground">Ancienne rubrique - lecture seule</p>
            ) : null}
          </div>
        </div>
        <ReadonlyFactList facts={facts} />

        {item.workpaper !== null ? (
          <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-semibold text-foreground">Justification existante</p>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {item.workpaper.noteText}
            </p>
          </div>
        ) : null}

        {!item.isCurrentStructure ? (
          <p className="text-sm font-medium text-foreground">
            Ancienne rubrique en lecture seule : justification rattachée à une structure
            précédente.
          </p>
        ) : null}

        {makerReadOnlyMessage !== null ? (
          <p className="text-sm font-medium text-foreground">
            {formatAvailabilityMessage(makerReadOnlyMessage)}
          </p>
        ) : null}

        {existingReviewerComment !== null ? (
          <div className="grid gap-2 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-sm font-semibold text-foreground">Changements demandes par la revue</p>
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
                Note de justification
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
                  Statut de justification
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
                  <option value="DRAFT">Brouillon</option>
                  <option value="READY_FOR_REVIEW">Prête pour revue</option>
                </select>
              </div>

              <Button
                aria-describedby={saveDisabledReasonId}
                disabled={controlsDisabled || saveDisabled}
                onClick={() => {
                  void onSave(item.anchorCode);
                }}
                type="button"
              >
                Enregistrer la justification
              </Button>
              {saveDisabledReason !== null ? (
                <p
                  className="text-sm font-medium text-muted-foreground"
                  id={saveDisabledReasonId}
                >
                  {saveDisabledReason}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {uploadAvailabilityMessage !== null ? (
          <p className="text-sm font-medium text-foreground">
            {formatAvailabilityMessage(uploadAvailabilityMessage)}
          </p>
        ) : null}

        {canRenderDocumentUploadSection ? (
          <ControlsBlock title="Ajouter une piece">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-document-file-${item.anchorCode}`}
                >
                  Fichier justificatif
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
                  Origine de la piece
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
                  Date de la piece
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
                  Ajouter la piece
                </Button>
              </div>
            </div>
          </ControlsBlock>
        ) : null}

        {workpapersForWorkpaperDecision !== null ? (
          <ControlsBlock title="Revue de la justification">
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
                    Revue de la justification
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
                      Revue terminée
                    </option>
                    <option value="CHANGES_REQUESTED">À reprendre</option>
                  </select>
                </div>

                {workpaperDecisionDraft.decision === "CHANGES_REQUESTED" ? (
                  <div className="grid gap-2">
                    <label
                      className="text-sm font-medium text-foreground"
                      htmlFor={`workpaper-decision-comment-${item.anchorCode}`}
                    >
                      Commentaire de revue
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
                    aria-describedby={workpaperDecisionDisabledReasonId}
                    disabled={
                      workpaperDecisionControlsDisabled ||
                      !canSubmitWorkpaperDecision(item, workpaperDecisionDraft)
                    }
                    onClick={() => {
                      void onWorkpaperDecisionSave(item.anchorCode);
                    }}
                    type="button"
                  >
                    Enregistrer la revue
                  </Button>
                  {workpaperDecisionDisabledReason !== null ? (
                    <p
                      className="text-sm font-medium text-muted-foreground"
                      id={workpaperDecisionDisabledReasonId}
                    >
                      {workpaperDecisionDisabledReason}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <p className="text-sm font-medium text-foreground">
                  {formatAvailabilityMessage(
                    workpaperDecisionAvailabilityMessage ??
                      "Revue de la justification indisponible pour ce statut"
                  )}
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

        <ControlsBlock title="Pièces justificatives">
          {item.documents.length === 0 ? (
            <p className="text-sm font-medium text-foreground">
              Aucune pièce justificative jointe
            </p>
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
                const documentDecisionDisabledReason =
                  canRenderDocumentDecision && documentDecisionDraft !== null
                    ? getDocumentDecisionDisabledReason(
                        documentDecisionDraft,
                        documentDecisionControlsDisabled,
                        documentDecisionStatusLines
                      )
                    : null;
                const documentDecisionDisabledReasonId =
                  documentDecisionDisabledReason === null
                    ? undefined
                    : `document-decision-reason-${documentId}`;

                return (
                  <li key={`${item.anchorCode}-${index}-${document.fileName}`}>
                    <div className="grid gap-3 rounded-lg border bg-background/80 p-4">
                      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,auto)] md:items-start">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-foreground">
                            {document.fileName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Origine : {document.sourceLabel}
                          </p>
                        </div>
                        <div className="grid gap-1 text-sm md:text-right">
                          <p className="font-medium text-foreground">
                            {formatDocumentVerificationStatus(document.verificationStatus)}
                          </p>
                          <p className="tabular-nums text-muted-foreground">
                            {formatDocumentDate(document.documentDate)}
                          </p>
                        </div>
                      </div>

                      {canRenderDownloadButton ? (
                        <div>
                          <Button
                            disabled={downloadControlsDisabled}
                            onClick={() => {
                              void onDocumentDownload(documentId);
                            }}
                            type="button"
                          >
                            Telecharger la piece
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
                            Verification de la piece
                          </p>

                          <div className="grid gap-2">
                            <label
                              className="text-sm font-medium text-foreground"
                              htmlFor={`document-decision-${documentId}`}
                            >
                              Statut de verification
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
                              <option value="VERIFIED">Vérifiée</option>
                              <option value="REJECTED">Rejetée</option>
                            </select>
                          </div>

                          {documentDecisionDraft.decision === "REJECTED" ? (
                            <div className="grid gap-2">
                              <label
                                className="text-sm font-medium text-foreground"
                                htmlFor={`document-decision-comment-${documentId}`}
                              >
                                Commentaire de verification
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
                              aria-describedby={documentDecisionDisabledReasonId}
                              disabled={
                                documentDecisionControlsDisabled ||
                                !canSubmitDocumentDecision(documentDecisionDraft)
                              }
                              onClick={() => {
                                void onDocumentDecisionSave(documentId);
                              }}
                              type="button"
                            >
                              Enregistrer la verification
                            </Button>
                            {documentDecisionDisabledReason !== null ? (
                              <p
                                className="text-sm font-medium text-muted-foreground"
                                id={documentDecisionDisabledReasonId}
                              >
                                {documentDecisionDisabledReason}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {documentDecisionAvailabilityMessage !== null ? (
                        <div aria-live="polite">
                          <p className="text-sm font-medium text-foreground">
                            {formatAvailabilityMessage(documentDecisionAvailabilityMessage)}
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
          <ControlsBlock title="Verification des pieces">
            <ReadonlyFactList
              facts={[
                {
                  label: "Pièces jointes",
                  value: item.documentVerificationSummary.documentsCount
                },
                {
                  label: "À vérifier",
                  value: item.documentVerificationSummary.unverifiedCount
                },
                {
                  label: "Vérifiées",
                  value: item.documentVerificationSummary.verifiedCount
                },
                {
                  label: "Rejetées",
                  value: item.documentVerificationSummary.rejectedCount
                }
              ]}
            />
          </ControlsBlock>
        ) : null}
      </div>
    </article>
  );
}

function getWorkpapersDocumentCounts(items: WorkpaperReadModelItem[]) {
  return items.reduce(
    (counts, item) => {
      for (const document of item.documents) {
        counts.total += 1;

        if (document.verificationStatus === "UNVERIFIED") {
          counts.unverified += 1;
        }

        if (document.verificationStatus === "VERIFIED") {
          counts.verified += 1;
        }

        if (document.verificationStatus === "REJECTED") {
          counts.rejected += 1;
        }
      }

      return counts;
    },
    {
      rejected: 0,
      total: 0,
      unverified: 0,
      verified: 0
    }
  );
}

function formatAvailabilityMessage(message: string) {
  if (message === "justification non modifiable tant que les controles ne sont pas READY") {
    return "justification non modifiable tant que les controles ne sont pas prets";
  }

  if (message === "verification document non modifiable tant que les controles ne sont pas READY") {
    return "verification de piece non modifiable tant que les controles ne sont pas prets";
  }

  if (message === "dossier archive, verification document en lecture seule") {
    return "dossier archive, verification de piece en lecture seule";
  }

  if (message === "verification reviewer en lecture seule") {
    return "verification de piece en lecture seule";
  }

  if (message === "decision document disponible quand la justification est READY_FOR_REVIEW") {
    return "verification disponible quand la justification est prete pour revue";
  }

  if (message === "decision document indisponible") {
    return "verification de piece indisponible";
  }

  if (message === "decision de revue refusee") {
    return "Revue indisponible pour cette rubrique.";
  }

  if (message === "decision de revue indisponible pour ce statut") {
    return "Revue de la justification indisponible pour ce statut";
  }

  return message;
}

function getWorkpaperSaveDisabledReason(
  item: WorkpaperReadModelItem,
  draft: WorkpaperDraft,
  controlsDisabled: boolean,
  saveDisabled: boolean
) {
  if (!controlsDisabled && !saveDisabled) {
    return null;
  }

  if (controlsDisabled) {
    return "Action indisponible pendant la mise a jour en cours.";
  }

  if (draft.noteText.trim().length === 0) {
    return "Ajoutez une justification avant d'enregistrer.";
  }

  if (item.workpaper !== null && !hasWorkpaperDraftChanges(item, draft)) {
    return "Aucune modification a enregistrer.";
  }

  return "Action indisponible dans l'etat actuel.";
}

function getWorkpaperDecisionDisabledReason(
  item: WorkpaperReadModelItem,
  draft: WorkpaperDecisionDraft,
  controlsDisabled: boolean,
  statusLines: string[]
) {
  if (!controlsDisabled && canSubmitWorkpaperDecision(item, draft)) {
    return null;
  }

  if (statusLines.length > 0) {
    return null;
  }

  if (controlsDisabled) {
    return "Action indisponible pendant la revue en cours.";
  }

  return "Action indisponible dans l'etat actuel.";
}

function getDocumentDecisionDisabledReason(
  draft: DocumentDecisionDraft,
  controlsDisabled: boolean,
  statusLines: string[]
) {
  if (!controlsDisabled && canSubmitDocumentDecision(draft)) {
    return null;
  }

  if (statusLines.length > 0) {
    return null;
  }

  if (controlsDisabled) {
    return "Action indisponible pendant la verification en cours.";
  }

  return "Action indisponible dans l'etat actuel.";
}

function formatWorkpaperStatus(status: string | null | undefined) {
  if (status === "DRAFT") {
    return "Brouillon";
  }

  if (status === "READY_FOR_REVIEW") {
    return "Prête pour revue";
  }

  if (status === "CHANGES_REQUESTED") {
    return "À reprendre";
  }

  if (status === "REVIEWED") {
    return "Revue terminée";
  }

  return "À documenter";
}

function formatDocumentVerificationStatus(status: WorkpaperDocument["verificationStatus"]) {
  if (status === "VERIFIED") {
    return "Vérifiée";
  }

  if (status === "REJECTED") {
    return "Rejetée";
  }

  return "À vérifier";
}

function formatVerificationSummary(item: WorkpaperReadModelItem) {
  const summary = item.documentVerificationSummary;

  if (summary === null || summary.documentsCount === 0) {
    return "Aucune pièce justificative jointe";
  }

  if (summary.rejectedCount > 0) {
    return `${summary.rejectedCount} rejetee(s)`;
  }

  if (summary.unverifiedCount > 0) {
    return `${summary.unverifiedCount} a verifier`;
  }

  return "Pièces vérifiées";
}

function getWorkpaperRubricDisplay(item: WorkpaperReadModelItem): WorkpaperRubricDisplay {
  const sourceLabel = item.anchorLabel.trim().length > 0 ? item.anchorLabel.trim() : null;

  return {
    breakdownLabel: formatBreakdownType(item.breakdownType),
    sourceLabel,
    statementLabel: formatStatementKind(item.statementKind),
    title: workpaperRubricLabelsByCode[item.anchorCode] ?? "Rubrique non reconnue"
  };
}

function formatWorkpaperCardAriaLabel(
  rubricDisplay: WorkpaperRubricDisplay,
  item: WorkpaperReadModelItem
) {
  const readOnlySuffix = item.isCurrentStructure ? "" : ", ancienne rubrique en lecture seule";
  return `${rubricDisplay.title}${readOnlySuffix}, code canonique ${item.anchorCode}`;
}

function formatStatementKind(statementKind: WorkpaperReadModelItem["statementKind"]) {
  if (statementKind === "BALANCE_SHEET") {
    return "Bilan";
  }

  return "Compte de résultat";
}

function formatBreakdownType(breakdownType: WorkpaperReadModelItem["breakdownType"]) {
  if (breakdownType === "SECTION") {
    return "Section";
  }

  return "Rubrique historique";
}

function formatDocumentDate(documentDate: WorkpaperDocument["documentDate"]) {
  if (typeof documentDate !== "string" || documentDate.length === 0) {
    return "Date non renseignee";
  }

  const [year, month, day] = documentDate.split("-");

  if (year === undefined || month === undefined || day === undefined) {
    return documentDate;
  }

  return `${day}.${month}.${year}`;
}

function WorkpaperMutationStatus({ state }: { state: WorkpaperMutationState }) {
  if (state.kind === "idle") {
    return null;
  }

  return (
    <ControlsBlock title="Etat mise a jour justification">
      {state.kind === "success" ? (
        <div aria-live="polite" className="grid gap-2">
          <p className="label-eyebrow">Etat visible</p>
          <p className="text-lg font-semibold text-foreground">
            justification enregistree avec succes
          </p>
          {state.refreshFailed ? (
            <p className="text-sm font-medium text-foreground">
              rafraichissement justifications impossible
            </p>
          ) : null}
        </div>
      ) : (
        <StateMessage text={formatWorkpaperMutationState(state)} />
      )}
    </ControlsBlock>
  );
}

function ReadonlyFactList({ facts }: { facts: FactItem[] }) {
  return (
    <ul className="grid gap-3">
      {facts.map((fact) => (
        <li className="rounded-lg border bg-background/80 p-4" key={fact.label}>
          <dl className="grid gap-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {fact.label}
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{fact.value}</dd>
            {fact.detail !== undefined ? (
              <dd className="text-sm text-muted-foreground">{fact.detail}</dd>
            ) : null}
          </dl>
        </li>
      ))}
    </ul>
  );
}

function ControlsBlock({
  children,
  id,
  title
}: {
  children: ReactNode;
  id?: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border bg-muted/20 p-4" id={id}>
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
