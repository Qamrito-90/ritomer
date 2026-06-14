import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  loadMinimalAnnexShellState,
  type MinimalAnnexBasis,
  type MinimalAnnexEvidenceSummary,
  type MinimalAnnexIssue,
  type MinimalAnnexShellState
} from "../lib/api/minimal-annex";
import type { ActiveTenant } from "../lib/api/me";

type MinimalAnnexPanelProps = {
  activeTenant: ActiveTenant;
  closingFolderId: string;
  postExportPackRefreshRequestId?: number;
};

type ReadyMinimalAnnex = Extract<MinimalAnnexShellState, { kind: "ready" }>["minimalAnnex"];
type MinimalAnnexFinancialStatements = NonNullable<ReadyMinimalAnnex["annex"]>["financialStatements"];

const localDateTimeFormatter = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

function formatFinancialAmount(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return value;
  }

  const sign = amount < 0 ? "-" : "";
  const [integerPart = "0", fractionPart = "00"] = Math.abs(amount).toFixed(2).split(".");
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

  return `CHF ${sign}${groupedInteger}.${fractionPart}`;
}

const forbiddenUiFragments = [
  "annexe co " + "finale",
  "annexe " + "officielle",
  "etats financiers " + "officiels",
  "co-" + "ready",
  "statutory-" + "ready",
  "conforme " + "co",
  "valid" + "ated",
  "approv" + "ed",
  "automatically " + "approved",
  "final accounts " + "approved",
  "ready to " + "file",
  "pack final pret a " + "deposer",
  "sign" + "ature",
  "cert" + "ified",
  "official financial " + "statements",
  "final co " + "annex"
];

export function MinimalAnnexPanel({
  activeTenant,
  closingFolderId,
  postExportPackRefreshRequestId = 0
}: MinimalAnnexPanelProps) {
  const [state, setState] = useState<MinimalAnnexShellState>({ kind: "loading" });
  const [postExportPackRefreshFailed, setPostExportPackRefreshFailed] = useState(false);
  const loadGenerationRef = useRef(0);
  const handledPostExportPackRefreshRequestIdRef = useRef(postExportPackRefreshRequestId);

  useEffect(() => {
    let cancelled = false;
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;

    async function loadMinimalAnnex() {
      setState({ kind: "loading" });
      setPostExportPackRefreshFailed(false);

      const nextState = await loadMinimalAnnexShellState(closingFolderId, activeTenant);

      if (!cancelled && loadGeneration === loadGenerationRef.current) {
        setState(nextState);
      }
    }

    void loadMinimalAnnex();

    return () => {
      cancelled = true;
    };
  }, [activeTenant, closingFolderId]);

  useEffect(() => {
    if (
      postExportPackRefreshRequestId === handledPostExportPackRefreshRequestIdRef.current
    ) {
      return;
    }

    handledPostExportPackRefreshRequestIdRef.current = postExportPackRefreshRequestId;

    if (postExportPackRefreshRequestId <= 0) {
      setPostExportPackRefreshFailed(false);
      return;
    }

    let cancelled = false;
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;

    async function refreshMinimalAnnexAfterExportPackCreate() {
      setPostExportPackRefreshFailed(false);

      const nextState = await loadMinimalAnnexShellState(closingFolderId, activeTenant);

      if (cancelled || loadGeneration !== loadGenerationRef.current) {
        return;
      }

      if (nextState.kind === "ready") {
        setState(nextState);
        setPostExportPackRefreshFailed(false);
        return;
      }

      setPostExportPackRefreshFailed(true);
    }

    void refreshMinimalAnnexAfterExportPackCreate();

    return () => {
      cancelled = true;
    };
  }, [activeTenant, closingFolderId, postExportPackRefreshRequestId]);

  return (
    <section className="panel p-6" aria-labelledby="minimal-annex-preview-title">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <p className="label-eyebrow">Annexe minimale</p>
          <h3
            className="text-xl font-semibold text-foreground"
            id="minimal-annex-preview-title"
          >
            Annexe minimale - previsualisation
          </h3>
          <p className="text-sm text-muted-foreground">
            Previsualisation non statutaire et en lecture seule. Revue humaine obligatoire. Pas
            un livrable statutaire final. Ne pas utiliser comme depot officiel.
          </p>
        </div>

        {postExportPackRefreshFailed ? (
          <p
            aria-live="polite"
            className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground"
          >
            rafraichissement annexe minimale impossible
          </p>
        ) : null}

        <MinimalAnnexStateSlot state={state} />
      </div>
    </section>
  );
}

function MinimalAnnexStateSlot({ state }: { state: MinimalAnnexShellState }) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement previsualisation annexe minimale" />;
  }

  if (state.kind !== "ready") {
    return <StateMessage text={formatErrorState(state)} />;
  }

  const { minimalAnnex } = state;
  const statusLabel = formatAnnexStatus(minimalAnnex.annexState);
  const contentLabel = minimalAnnex.annex === null ? "Contenu manquant" : "Contenu disponible";

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-background/80 p-4">
        <dl className="grid gap-4 md:grid-cols-2">
          <MetricItem label="Statut de l'annexe" value={statusLabel} />
          <MetricItem label="Contenu" value={contentLabel} />
          <MetricItem label="Lecture seule" value="Oui - aucune modification dans ce panneau" />
          <MetricItem label="Revue humaine" value="Obligatoire avant usage engageant" />
        </dl>
      </div>

      <ReadonlyBlock title="Limites non statutaires">
        <ReadonlyLineList
          lines={[
            "Lecture seule : consultation uniquement, aucune modification d'annexe depuis ce panneau.",
            "Revue humaine obligatoire avant usage engageant.",
            "Pas un livrable statutaire final.",
            "Ne pas utiliser comme depot officiel."
          ]}
        />
      </ReadonlyBlock>

      <IssueList issues={minimalAnnex.blockers} title="Blocages" />
      <IssueList issues={minimalAnnex.warnings} title="Alertes" />

      <ReadonlyBlock title="Base de calcul">
        <ReadonlyLineList lines={formatBasisLines(minimalAnnex.basis)} />
      </ReadonlyBlock>

      {minimalAnnex.annex !== null ? (
        <>
          <ReadonlyBlock title="Montants repris de la preview">
            <FinancialStatementsSummary
              financialStatements={minimalAnnex.annex.financialStatements}
            />
          </ReadonlyBlock>

          <ReadonlyBlock title="Synthese des preuves">
            <EvidenceSummary summary={minimalAnnex.annex.evidenceSummary} />
          </ReadonlyBlock>
        </>
      ) : (
        <ReadonlyBlock title="Synthese des preuves">
          <p className="text-sm font-medium text-foreground">
            Consequence : annexe indisponible pour revue. La synthese des preuves sera disponible
            quand les blocages seront leves.
          </p>
        </ReadonlyBlock>
      )}
    </div>
  );
}

function IssueList({
  issues,
  title
}: {
  issues: MinimalAnnexIssue[];
  title: "Blocages" | "Alertes";
}) {
  if (issues.length === 0) {
    return (
      <ReadonlyBlock title={title}>
        <p className="text-sm font-medium text-foreground">Aucun element signale.</p>
      </ReadonlyBlock>
    );
  }

  return (
    <ReadonlyBlock title={title}>
      {title === "Blocages" ? (
        <p className="text-sm text-muted-foreground">
          Consequence : annexe indisponible pour revue tant que ces points ne sont pas leves.
          Action : completez les justifications, verifiez les preuves et preparez le pack de
          revue si necessaire.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {issues.map((issue, index) => (
          <li
            className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground"
            key={`${issue.code}-${issue.source}-${index}`}
          >
            <div className="grid gap-2">
              <p>{formatIssueMessage(issue.message)}</p>
              <p className="text-muted-foreground">
                Origine {formatIssueSource(issue.source)}
                <span className="block break-all text-xs">Code technique {issue.code}</span>
              </p>
              {issue.target !== null ? (
                <p className="text-muted-foreground">
                  Cible {formatIssueTargetType(issue.target.type)}
                  {issue.target.code !== null ? (
                    <span className="block break-all text-xs">
                      Reference technique {issue.target.code}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </ReadonlyBlock>
  );
}

function ReadonlyBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-3">
        <h4 className="text-lg font-semibold text-foreground">{title}</h4>
        {children}
      </div>
    </section>
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

function FinancialStatementsSummary({
  financialStatements
}: {
  financialStatements: MinimalAnnexFinancialStatements;
}) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-3" aria-label="Bilan repris de la preview">
        <h5 className="text-sm font-semibold text-foreground">Bilan</h5>
        <FinancialRows
          rows={[
            {
              label: "Total actifs",
              value: formatFinancialAmount(financialStatements.balanceSheet.totals.totalAssets)
            },
            {
              label: "Total passifs",
              value: formatFinancialAmount(
                financialStatements.balanceSheet.totals.totalLiabilities
              )
            },
            {
              label: "Total capitaux propres",
              value: formatFinancialAmount(financialStatements.balanceSheet.totals.totalEquity)
            },
            {
              label: "Resultat de la periode",
              value: formatFinancialAmount(
                financialStatements.balanceSheet.totals.currentPeriodResult
              )
            },
            {
              label: "Total passifs et capitaux propres",
              value: formatFinancialAmount(
                financialStatements.balanceSheet.totals.totalLiabilitiesAndEquity
              )
            }
          ]}
        />
      </section>

      <section className="grid gap-3" aria-label="Compte de resultat repris de la preview">
        <h5 className="text-sm font-semibold text-foreground">Compte de resultat</h5>
        <FinancialRows
          rows={[
            {
              label: "Total produits",
              value: formatFinancialAmount(financialStatements.incomeStatement.totals.totalRevenue)
            },
            {
              label: "Total charges",
              value: formatFinancialAmount(financialStatements.incomeStatement.totals.totalExpenses)
            },
            {
              label: "Resultat net",
              value: formatFinancialAmount(financialStatements.incomeStatement.totals.netResult)
            }
          ]}
        />
      </section>
    </div>
  );
}

function FinancialRows({
  rows
}: {
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <dl className="grid min-w-0 overflow-hidden rounded-lg border bg-background/80">
      {rows.map((row) => (
        <div
          className="grid min-w-0 gap-2 border-b px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(7rem,max-content)] sm:items-start"
          key={row.label}
        >
          <dt className="break-words text-sm font-medium text-foreground">{row.label}</dt>
          <dd className="break-words text-left text-sm font-semibold tabular-nums text-foreground sm:text-right">
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function EvidenceSummary({ summary }: { summary: MinimalAnnexEvidenceSummary }) {
  return (
    <div className="grid gap-4">
      <ReadonlyLineList lines={formatEvidenceSummaryLines(summary)} />
      <dl className="grid gap-3 md:grid-cols-2">
        <MetricItem
          label="Contenu disponible"
          value={`${summary.currentWorkpaperCount} justification(s), ${summary.attachedDocumentCount} document(s)`}
        />
        <MetricItem
          label="Preuves verifiees"
          value={`${summary.verifiedDocumentCount} document(s) verifie(s)`}
        />
        <MetricItem
          label="Contenu manquant"
          value={`${summary.currentWorkpaperWithoutDocumentCount} justification(s) sans document`}
        />
        <MetricItem
          label="Exclusions de revue"
          value={`${summary.staleWorkpaperExcludedCount} justification(s) obsoletes exclue(s)`}
        />
      </dl>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </div>
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

function formatBasisLines(basis: MinimalAnnexBasis) {
  const exportPackLines =
    basis.exportPack === null
      ? ["pack de revue : manquant"]
      : [
          "pack de revue : disponible",
          `pack de revue cree le : ${formatDateTime(basis.exportPack.createdAt)}`,
          `version import de base : ${basis.exportPack.basisImportVersion}`,
          `version taxonomie de base : ${basis.exportPack.basisTaxonomyVersion}`
        ];

  return [
    `controles : ${formatBasisReadiness(basis.controlsReadiness)}`,
    `derniere version import : ${basis.latestImportVersion ?? "aucune"}`,
    `version taxonomie : ${basis.taxonomyVersion ?? "aucune"}`,
    `previsualisation structuree : ${formatStructuredState(basis.structuredStatementState)}`,
    ...exportPackLines
  ];
}

function formatEvidenceSummaryLines(summary: MinimalAnnexEvidenceSummary) {
  return [
    `justifications courantes : ${summary.currentWorkpaperCount}`,
    `documents attaches : ${summary.attachedDocumentCount}`,
    `documents verifies : ${summary.verifiedDocumentCount}`,
    `traces documents rejetes : ${summary.rejectedDocumentTraceCount}`,
    `justifications obsoletes exclues : ${summary.staleWorkpaperExcludedCount}`,
    `justifications courantes sans document : ${summary.currentWorkpaperWithoutDocumentCount}`
  ];
}

function formatErrorState(
  state: Exclude<MinimalAnnexShellState, { kind: "loading" | "ready" }>
) {
  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces previsualisation annexe minimale refuse";
  }

  if (state.kind === "not_found") {
    return "dossier indisponible pour la previsualisation annexe minimale";
  }

  if (state.kind === "timeout") {
    return "timeout previsualisation annexe minimale";
  }

  if (state.kind === "network_error") {
    return "erreur reseau previsualisation annexe minimale";
  }

  return [
    "Previsualisation annexe minimale indisponible : les donnees de revue ne sont pas encore exploitables.",
    "Consequence : l'annexe ne peut pas etre consultee dans ce panneau.",
    "Action : completez les justifications, verifiez les preuves et levez les points de revue ouverts."
  ].join(" ");
}

function formatIssueMessage(message: string) {
  if (containsForbiddenUiWording(message)) {
    return "Message masque pour revue humaine.";
  }

  return message;
}

function formatAnnexStatus(status: string) {
  if (status === "READY") {
    return "Pret pour revue";
  }

  if (status === "BLOCKED") {
    return "Bloque";
  }

  return "A verifier";
}

function formatBasisReadiness(readiness: string | null) {
  if (readiness === "READY") {
    return "pret";
  }

  if (readiness === "BLOCKED") {
    return "bloque";
  }

  return "aucune";
}

function formatStructuredState(statementState: string | null) {
  if (statementState === "PREVIEW_READY") {
    return "disponible";
  }

  if (statementState === "BLOCKED") {
    return "bloquee";
  }

  if (statementState === "NO_DATA") {
    return "manquante";
  }

  return "aucune";
}

function formatIssueSource(source: string) {
  const labels: Record<string, string> = {
    CONTROLS: "controles",
    EXPORT_PACK: "pack de revue",
    FINANCIAL_STATEMENTS_STRUCTURED: "previsualisation structuree",
    WORKPAPERS: "justifications"
  };

  return labels[source] ?? source.toLowerCase().replace(/_/g, " ");
}

function formatIssueTargetType(targetType: string) {
  const labels: Record<string, string> = {
    WORKPAPER_ANCHOR: "rubrique de justification"
  };

  return labels[targetType] ?? targetType.toLowerCase().replace(/_/g, " ");
}

function containsForbiddenUiWording(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return forbiddenUiFragments.some((fragment) => normalized.includes(fragment));
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return localDateTimeFormatter.format(date);
}
