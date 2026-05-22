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

const localDateTimeFormatter = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

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
            Previsualisation en lecture seule
          </h3>
          <p className="text-sm text-muted-foreground">
            Previsualisation non statutaire. Preparee pour revue humaine. Revue humaine requise.
            Pas un livrable statutaire final. Ne pas utiliser pour un depot officiel.
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
  const stateLabel = minimalAnnex.annexState;

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border bg-background/80 p-4">
        <dl className="grid gap-4 md:grid-cols-2">
          <MetricItem label="etat annexe" value={stateLabel} />
          <MetricItem label="etat de preparation" value={minimalAnnex.readiness} />
          <MetricItem label="type de previsualisation" value={minimalAnnex.presentationType} />
          <MetricItem label="revue humaine" value="requise" />
        </dl>
      </div>

      <ReadonlyBlock title="Limites non statutaires">
        <ReadonlyLineList
          lines={[
            "Previsualisation en lecture seule.",
            "Preparee pour revue humaine.",
            "Revue humaine requise.",
            "Pas un livrable statutaire final.",
            "Ne pas utiliser pour un depot officiel."
          ]}
        />
      </ReadonlyBlock>

      <IssueList issues={minimalAnnex.blockers} title="Blocages" />
      <IssueList issues={minimalAnnex.warnings} title="Alertes" />

      <ReadonlyBlock title="Base de calcul">
        <ReadonlyLineList lines={formatBasisLines(minimalAnnex.basis)} />
      </ReadonlyBlock>

      {minimalAnnex.annex !== null ? (
        <ReadonlyBlock title="Synthese des preuves">
          <ReadonlyLineList
            lines={formatEvidenceSummaryLines(minimalAnnex.annex.evidenceSummary)}
          />
        </ReadonlyBlock>
      ) : (
        <ReadonlyBlock title="Synthese des preuves">
          <p className="text-sm font-medium text-foreground">
            Synthese des preuves indisponible tant que la previsualisation est bloquee.
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
      <ul className="grid gap-3">
        {issues.map((issue, index) => (
          <li
            className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground"
            key={`${issue.code}-${issue.source}-${index}`}
          >
            <div className="grid gap-2">
              <p>
                {issue.code} / {issue.source}
              </p>
              <p className="text-muted-foreground">{formatIssueMessage(issue.message)}</p>
              {issue.target !== null ? (
                <p className="text-muted-foreground">
                  Cible: {issue.target.type}
                  {issue.target.code !== null ? ` / ${issue.target.code}` : ""}
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
      ? ["base pack export : absente"]
      : [
          "base pack export : presente",
          `pack export cree le : ${formatDateTime(basis.exportPack.createdAt)}`,
          `version import du pack : ${basis.exportPack.basisImportVersion}`,
          `version taxonomie du pack : ${basis.exportPack.basisTaxonomyVersion}`
        ];

  return [
    `readiness controles : ${basis.controlsReadiness ?? "aucune"}`,
    `derniere version import : ${basis.latestImportVersion ?? "aucune"}`,
    `version taxonomie : ${basis.taxonomyVersion ?? "aucune"}`,
    `etat previsualisation structuree : ${basis.structuredStatementState ?? "aucun"}`,
    `type presentation structuree : ${basis.structuredPresentationType ?? "aucun"}`,
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

  return "previsualisation annexe minimale indisponible";
}

function formatIssueMessage(message: string) {
  if (containsForbiddenUiWording(message)) {
    return "Message masque pour revue humaine.";
  }

  return message;
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
