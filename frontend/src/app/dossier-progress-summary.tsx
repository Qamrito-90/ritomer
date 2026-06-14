import type { ControlsShellState } from "../lib/api/controls";
import type { FinancialSummaryShellState } from "../lib/api/financial-summary";
import type { FinancialStatementsStructuredShellState } from "../lib/api/financial-statements-structured";
import type { ManualMappingShellState } from "../lib/api/manual-mapping";
import type { WorkpapersShellState } from "../lib/api/workpapers";

type DossierProgressSummaryProps = {
  controlsState: ControlsShellState;
  financialStatementsStructuredState: FinancialStatementsStructuredShellState;
  financialSummaryState: FinancialSummaryShellState;
  manualMappingState: ManualMappingShellState;
  workpapersState: WorkpapersShellState;
};

type ProgressStatus =
  | "blocked"
  | "done"
  | "empty"
  | "error"
  | "incomplete"
  | "loading"
  | "missing"
  | "ready"
  | "review-ready"
  | "uploaded"
  | "verified"
  | "rejected";

type ProgressItem = {
  detail: string;
  label: string;
  status: ProgressStatus;
};

const statusLabels: Record<ProgressStatus, string> = {
  blocked: "bloque",
  done: "fait",
  empty: "vide",
  error: "erreur",
  incomplete: "incomplet",
  loading: "chargement",
  missing: "manquant",
  ready: "pret",
  "review-ready": "pret pour revue",
  uploaded: "depose",
  verified: "verifie",
  rejected: "rejete"
};

export function DossierProgressSummary({
  controlsState,
  financialStatementsStructuredState,
  financialSummaryState,
  manualMappingState,
  workpapersState
}: DossierProgressSummaryProps) {
  const items = createProgressItems({
    controlsState,
    financialStatementsStructuredState,
    financialSummaryState,
    manualMappingState,
    workpapersState
  });

  return (
    <section className="panel p-6" aria-labelledby="dossier-progress-summary-title">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <p className="label-eyebrow">Progression dossier</p>
          <h3
            className="text-xl font-semibold text-foreground"
            id="dossier-progress-summary-title"
          >
            Synthese du dossier
          </h3>
          <p className="text-sm text-muted-foreground">
            Previsualisation non statutaire. Etat indicatif, revue humaine obligatoire, pas un
            export final ni un document CO.
          </p>
        </div>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-label="progression dossier">
          {items.map((item) => (
            <li className="rounded-lg border bg-background/80 p-4" key={item.label}>
              <div className="grid gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <ProgressStatusBadge status={item.status} />
                </div>
                <p className="text-sm text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function createProgressItems({
  controlsState,
  financialStatementsStructuredState,
  financialSummaryState,
  manualMappingState,
  workpapersState
}: DossierProgressSummaryProps): ProgressItem[] {
  return [
    createImportProgressItem(controlsState),
    createMappingProgressItem(manualMappingState),
    createControlsProgressItem(controlsState),
    createFinancialPreviewsProgressItem(financialSummaryState, financialStatementsStructuredState),
    createWorkpapersProgressItem(workpapersState),
    createEvidenceProgressItem(workpapersState),
    createReviewProgressItem(workpapersState)
  ];
}

function createImportProgressItem(controlsState: ControlsShellState): ProgressItem {
  const label = "Import balance";

  if (controlsState.kind === "loading") {
    return createLoadingItem(label);
  }

  if (controlsState.kind !== "ready") {
    return createErrorItem(label, "etat import indisponible");
  }

  if (!controlsState.controls.latestImportPresent) {
    return {
      label,
      status: "missing",
      detail: "aucun import valide"
    };
  }

  return {
    label,
    status: "done",
    detail: `version ${controlsState.controls.latestImportVersion ?? "inconnue"}`
  };
}

function createMappingProgressItem(manualMappingState: ManualMappingShellState): ProgressItem {
  if (manualMappingState.kind === "loading") {
    return createLoadingItem("Mapping");
  }

  if (manualMappingState.kind !== "ready") {
    return createErrorItem("Mapping", "etat mapping indisponible");
  }

  const { projection } = manualMappingState;

  if (projection.latestImportVersion === null) {
    return {
      label: "Mapping",
      status: "missing",
      detail: "balance import manquant"
    };
  }

  if (projection.summary.total === 0) {
    return {
      label: "Mapping",
      status: "empty",
      detail: "aucun compte a mapper"
    };
  }

  if (projection.summary.unmapped === 0) {
    return {
      label: "Mapping",
      status: "ready",
      detail: `${projection.summary.mapped}/${projection.summary.total} comptes mappes`
    };
  }

  return {
    label: "Mapping",
    status: "incomplete",
    detail: `${projection.summary.unmapped} compte(s) non mappes`
  };
}

function createControlsProgressItem(controlsState: ControlsShellState): ProgressItem {
  if (controlsState.kind === "loading") {
    return createLoadingItem("Etat de preparation");
  }

  if (controlsState.kind !== "ready") {
    return createErrorItem("Etat de preparation", "etat de preparation indisponible");
  }

  if (controlsState.controls.readiness === "READY") {
    return {
      label: "Etat de preparation",
      status: "ready",
      detail: "etat de preparation pret"
    };
  }

  return {
    label: "Etat de preparation",
    status: "blocked",
    detail: "etat de preparation bloque par controles"
  };
}

function createFinancialPreviewsProgressItem(
  financialSummaryState: FinancialSummaryShellState,
  financialStatementsStructuredState: FinancialStatementsStructuredShellState
): ProgressItem {
  const label = "Previsualisations financieres";

  if (
    financialSummaryState.kind === "loading" ||
    financialStatementsStructuredState.kind === "loading"
  ) {
    return createLoadingItem(label);
  }

  if (
    financialSummaryState.kind !== "ready" ||
    financialStatementsStructuredState.kind !== "ready"
  ) {
    return createErrorItem(label, "previsualisations indisponibles");
  }

  const summaryState = financialSummaryState.summary.statementState;
  const structuredState = financialStatementsStructuredState.financialStatements.statementState;

  if (summaryState === "NO_DATA" && structuredState === "NO_DATA") {
    return {
      label,
      status: "missing",
      detail: "aucune previsualisation disponible"
    };
  }

  if (summaryState === "PREVIEW_READY" && structuredState === "PREVIEW_READY") {
    return {
      label,
      status: "ready",
      detail: "previsualisations non statutaires disponibles"
    };
  }

  return {
    label,
    status: "blocked",
    detail: "previsualisation bloquee ou partielle"
  };
}

function createWorkpapersProgressItem(workpapersState: WorkpapersShellState): ProgressItem {
  const label = "Couverture justifications";

  if (workpapersState.kind === "loading") {
    return createLoadingItem(label);
  }

  if (workpapersState.kind !== "ready") {
    return createErrorItem(label, "justifications indisponibles");
  }

  const { summaryCounts } = workpapersState.workpapers;

  if (summaryCounts.totalCurrentAnchors === 0) {
    return {
      label,
      status: "empty",
      detail: "aucune rubrique a documenter"
    };
  }

  if (summaryCounts.missingCount > 0 || summaryCounts.staleCount > 0) {
    return {
      label,
      status: "incomplete",
      detail: `${summaryCounts.withWorkpaperCount} courant(s), ${summaryCounts.missingCount} manquant(s), ${summaryCounts.staleCount} ancien(s)`
    };
  }

  return {
    label,
    status: "ready",
    detail: `${summaryCounts.withWorkpaperCount} courant(s), ${summaryCounts.missingCount} manquant(s), ${summaryCounts.staleCount} ancien(s)`
  };
}

function createEvidenceProgressItem(workpapersState: WorkpapersShellState): ProgressItem {
  if (workpapersState.kind === "loading") {
    return createLoadingItem("Pieces justificatives");
  }

  if (workpapersState.kind !== "ready") {
    return createErrorItem("Pieces justificatives", "preuves indisponibles");
  }

  const counts = getCurrentDocumentCounts(workpapersState.workpapers.items);

  if (workpapersState.workpapers.summaryCounts.withWorkpaperCount === 0) {
    return {
      label: "Pieces justificatives",
      status: "missing",
      detail: "justifications requises avant preuves"
    };
  }

  if (counts.documentsCount === 0) {
    return {
      label: "Pieces justificatives",
      status: "missing",
      detail: "aucune preuve"
    };
  }

  const detail = `${counts.documentsCount} deposee(s), ${counts.verifiedCount} verifiee(s), ${counts.rejectedCount} rejetee(s), ${counts.unverifiedCount} a verifier`;

  if (counts.unverifiedCount > 0) {
    return {
      label: "Pieces justificatives",
      status: "blocked",
      detail
    };
  }

  if (counts.rejectedCount > 0) {
    return {
      label: "Pieces justificatives",
      status: "rejected",
      detail
    };
  }

  if (counts.verifiedCount > 0) {
    return {
      label: "Pieces justificatives",
      status: "verified",
      detail
    };
  }

  return {
    label: "Pieces justificatives",
    status: "uploaded",
    detail
  };
}

function createReviewProgressItem(workpapersState: WorkpapersShellState): ProgressItem {
  if (workpapersState.kind === "loading") {
    return createLoadingItem("Revue");
  }

  if (workpapersState.kind !== "ready") {
    return createErrorItem("Revue", "revue indisponible");
  }

  const { summaryCounts } = workpapersState.workpapers;

  if (summaryCounts.withWorkpaperCount === 0 || summaryCounts.missingCount > 0) {
    return {
      label: "Revue",
      status: "blocked",
      detail: "justifications incompletes"
    };
  }

  if (summaryCounts.reviewedCount === summaryCounts.withWorkpaperCount) {
    return {
      label: "Revue",
      status: "ready",
      detail: `${summaryCounts.reviewedCount} revu(s)`
    };
  }

  if (summaryCounts.readyForReviewCount > 0) {
    return {
      label: "Revue",
      status: "review-ready",
      detail: `${summaryCounts.readyForReviewCount} pret(s) pour revue, ${summaryCounts.reviewedCount} revu(s)`
    };
  }

  return {
    label: "Revue",
    status: "blocked",
    detail: "aucune justification prete pour revue"
  };
}

function getCurrentDocumentCounts(
  items: Extract<WorkpapersShellState, { kind: "ready" }>["workpapers"]["items"]
) {
  return items.reduce(
    (counts, item) => {
      for (const document of item.documents) {
        counts.documentsCount += 1;

        if (document.verificationStatus === "VERIFIED") {
          counts.verifiedCount += 1;
        } else if (document.verificationStatus === "REJECTED") {
          counts.rejectedCount += 1;
        } else {
          counts.unverifiedCount += 1;
        }
      }

      return counts;
    },
    {
      documentsCount: 0,
      rejectedCount: 0,
      unverifiedCount: 0,
      verifiedCount: 0
    }
  );
}

function createLoadingItem(label: string): ProgressItem {
  return {
    label,
    status: "loading",
    detail: "chargement"
  };
}

function createErrorItem(label: string, detail: string): ProgressItem {
  return {
    label,
    status: "error",
    detail
  };
}

function ProgressStatusBadge({ status }: { status: ProgressStatus }) {
  const className =
    status === "ready" ||
    status === "done" ||
    status === "verified" ||
    status === "review-ready"
      ? "border-success/25 bg-success/10 text-success"
      : status === "blocked" || status === "error" || status === "rejected"
        ? "border-error/25 bg-error/10 text-error"
        : status === "loading" || status === "empty" || status === "missing"
          ? "border-border bg-background text-muted-foreground"
          : "border-warning/25 bg-warning/10 text-warning";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {statusLabels[status]}
    </span>
  );
}
