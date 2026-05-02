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
  blocked: "blocked",
  done: "done",
  empty: "empty",
  error: "error",
  incomplete: "incomplete",
  loading: "loading",
  missing: "missing",
  ready: "ready",
  "review-ready": "review-ready",
  uploaded: "uploaded",
  verified: "verified",
  rejected: "rejected"
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
            Summary read-only
          </h3>
          <p className="text-sm text-muted-foreground">
            Preview non statutaire. Etat indicatif, pas un export final ni un document CO.
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
  const label = "Balance import";

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
    return createLoadingItem("Controls readiness");
  }

  if (controlsState.kind !== "ready") {
    return createErrorItem("Controls readiness", "readiness indisponible");
  }

  if (controlsState.controls.readiness === "READY") {
    return {
      label: "Controls readiness",
      status: "ready",
      detail: "readiness pret"
    };
  }

  return {
    label: "Controls readiness",
    status: "blocked",
    detail: "readiness bloquee par controls"
  };
}

function createFinancialPreviewsProgressItem(
  financialSummaryState: FinancialSummaryShellState,
  financialStatementsStructuredState: FinancialStatementsStructuredShellState
): ProgressItem {
  const label = "Financial previews";

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
    return createErrorItem(label, "previews indisponibles");
  }

  const summaryState = financialSummaryState.summary.statementState;
  const structuredState = financialStatementsStructuredState.financialStatements.statementState;

  if (summaryState === "NO_DATA" && structuredState === "NO_DATA") {
    return {
      label,
      status: "missing",
      detail: "aucune preview disponible"
    };
  }

  if (summaryState === "PREVIEW_READY" && structuredState === "PREVIEW_READY") {
    return {
      label,
      status: "ready",
      detail: "previews non statutaires disponibles"
    };
  }

  return {
    label,
    status: "blocked",
    detail: "preview bloquee ou partielle"
  };
}

function createWorkpapersProgressItem(workpapersState: WorkpapersShellState): ProgressItem {
  const label = "Workpaper coverage";

  if (workpapersState.kind === "loading") {
    return createLoadingItem(label);
  }

  if (workpapersState.kind !== "ready") {
    return createErrorItem(label, "workpapers indisponibles");
  }

  const { summaryCounts } = workpapersState.workpapers;

  if (summaryCounts.totalCurrentAnchors === 0) {
    return {
      label,
      status: "empty",
      detail: "aucun anchor courant"
    };
  }

  if (summaryCounts.missingCount > 0 || summaryCounts.staleCount > 0) {
    return {
      label,
      status: "incomplete",
      detail: `${summaryCounts.withWorkpaperCount} current, ${summaryCounts.missingCount} missing, ${summaryCounts.staleCount} stale`
    };
  }

  return {
    label,
    status: "ready",
    detail: `${summaryCounts.withWorkpaperCount} current, ${summaryCounts.missingCount} missing, ${summaryCounts.staleCount} stale`
  };
}

function createEvidenceProgressItem(workpapersState: WorkpapersShellState): ProgressItem {
  if (workpapersState.kind === "loading") {
    return createLoadingItem("Evidence documents");
  }

  if (workpapersState.kind !== "ready") {
    return createErrorItem("Evidence documents", "preuves indisponibles");
  }

  const counts = getCurrentDocumentCounts(workpapersState.workpapers.items);

  if (workpapersState.workpapers.summaryCounts.withWorkpaperCount === 0) {
    return {
      label: "Evidence documents",
      status: "missing",
      detail: "workpapers requis avant preuves"
    };
  }

  if (counts.documentsCount === 0) {
    return {
      label: "Evidence documents",
      status: "missing",
      detail: "aucune preuve"
    };
  }

  const detail = `${counts.documentsCount} uploaded, ${counts.verifiedCount} verified, ${counts.rejectedCount} rejected, ${counts.unverifiedCount} unverified`;

  if (counts.unverifiedCount > 0) {
    return {
      label: "Evidence documents",
      status: "blocked",
      detail
    };
  }

  if (counts.rejectedCount > 0) {
    return {
      label: "Evidence documents",
      status: "rejected",
      detail
    };
  }

  if (counts.verifiedCount > 0) {
    return {
      label: "Evidence documents",
      status: "verified",
      detail
    };
  }

  return {
    label: "Evidence documents",
    status: "uploaded",
    detail
  };
}

function createReviewProgressItem(workpapersState: WorkpapersShellState): ProgressItem {
  if (workpapersState.kind === "loading") {
    return createLoadingItem("Review");
  }

  if (workpapersState.kind !== "ready") {
    return createErrorItem("Review", "review indisponible");
  }

  const { summaryCounts } = workpapersState.workpapers;

  if (summaryCounts.withWorkpaperCount === 0 || summaryCounts.missingCount > 0) {
    return {
      label: "Review",
      status: "blocked",
      detail: "workpapers incomplets"
    };
  }

  if (summaryCounts.reviewedCount === summaryCounts.withWorkpaperCount) {
    return {
      label: "Review",
      status: "ready",
      detail: `${summaryCounts.reviewedCount} reviewed`
    };
  }

  if (summaryCounts.readyForReviewCount > 0) {
    return {
      label: "Review",
      status: "review-ready",
      detail: `${summaryCounts.readyForReviewCount} ready for review, ${summaryCounts.reviewedCount} reviewed`
    };
  }

  return {
    label: "Review",
    status: "blocked",
    detail: "aucun workpaper ready for review"
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
