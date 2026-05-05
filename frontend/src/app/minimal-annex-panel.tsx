import type { ReactNode } from "react";
import { useEffect, useState } from "react";
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
  closingFolderId
}: MinimalAnnexPanelProps) {
  const [state, setState] = useState<MinimalAnnexShellState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadMinimalAnnex() {
      setState({ kind: "loading" });

      const nextState = await loadMinimalAnnexShellState(closingFolderId, activeTenant);

      if (!cancelled) {
        setState(nextState);
      }
    }

    void loadMinimalAnnex();

    return () => {
      cancelled = true;
    };
  }, [activeTenant, closingFolderId]);

  return (
    <section className="panel p-6" aria-labelledby="minimal-annex-preview-title">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <p className="label-eyebrow">Minimal annex preview</p>
          <h3
            className="text-xl font-semibold text-foreground"
            id="minimal-annex-preview-title"
          >
            Read-only preview
          </h3>
          <p className="text-sm text-muted-foreground">
            Preview non statutaire. Prepared for human review. Human review required.
            Not a final CO deliverable. Do not use as statutory filing.
          </p>
        </div>

        <MinimalAnnexStateSlot state={state} />
      </div>
    </section>
  );
}

function MinimalAnnexStateSlot({ state }: { state: MinimalAnnexShellState }) {
  if (state.kind === "loading") {
    return <StateMessage text="loading minimal annex preview" />;
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
          <MetricItem label="annex state" value={stateLabel} />
          <MetricItem label="readiness source" value={minimalAnnex.readiness} />
          <MetricItem label="preview type" value={minimalAnnex.presentationType} />
          <MetricItem label="human review" value="required" />
        </dl>
      </div>

      <ReadonlyBlock title="Non-statutory limits">
        <ReadonlyLineList
          lines={[
            "Read-only preview.",
            "Prepared for human review.",
            "Human review required.",
            "Not a final CO deliverable.",
            "Do not use as statutory filing."
          ]}
        />
      </ReadonlyBlock>

      <IssueList issues={minimalAnnex.blockers} title="Blockers" />
      <IssueList issues={minimalAnnex.warnings} title="Warnings" />

      <ReadonlyBlock title="Basis summary">
        <ReadonlyLineList lines={formatBasisLines(minimalAnnex.basis)} />
      </ReadonlyBlock>

      {minimalAnnex.annex !== null ? (
        <ReadonlyBlock title="Evidence summary">
          <ReadonlyLineList
            lines={formatEvidenceSummaryLines(minimalAnnex.annex.evidenceSummary)}
          />
        </ReadonlyBlock>
      ) : (
        <ReadonlyBlock title="Evidence summary">
          <p className="text-sm font-medium text-foreground">
            Evidence summary unavailable while preview is BLOCKED.
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
  title: "Blockers" | "Warnings";
}) {
  if (issues.length === 0) {
    return (
      <ReadonlyBlock title={title}>
        <p className="text-sm font-medium text-foreground">No {title.toLowerCase()} reported.</p>
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
                  Target: {issue.target.type}
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
      <p className="label-eyebrow">Visible state</p>
      <p className="text-lg font-semibold text-foreground">{text}</p>
    </div>
  );
}

function formatBasisLines(basis: MinimalAnnexBasis) {
  const exportPackLines =
    basis.exportPack === null
      ? ["export pack basis : absent"]
      : [
          "export pack basis : present",
          `export pack created at : ${formatDateTime(basis.exportPack.createdAt)}`,
          `export pack import version : ${basis.exportPack.basisImportVersion}`,
          `export pack taxonomy version : ${basis.exportPack.basisTaxonomyVersion}`
        ];

  return [
    `controls readiness : ${basis.controlsReadiness ?? "none"}`,
    `latest import version : ${basis.latestImportVersion ?? "none"}`,
    `taxonomy version : ${basis.taxonomyVersion ?? "none"}`,
    `structured statement state : ${basis.structuredStatementState ?? "none"}`,
    `structured presentation type : ${basis.structuredPresentationType ?? "none"}`,
    ...exportPackLines
  ];
}

function formatEvidenceSummaryLines(summary: MinimalAnnexEvidenceSummary) {
  return [
    `current workpapers : ${summary.currentWorkpaperCount}`,
    `attached documents : ${summary.attachedDocumentCount}`,
    `verified documents : ${summary.verifiedDocumentCount}`,
    `rejected document traces : ${summary.rejectedDocumentTraceCount}`,
    `stale workpapers excluded : ${summary.staleWorkpaperExcludedCount}`,
    `current workpapers without document : ${summary.currentWorkpaperWithoutDocumentCount}`
  ];
}

function formatErrorState(
  state: Exclude<MinimalAnnexShellState, { kind: "loading" | "ready" }>
) {
  if (state.kind === "auth_required") {
    return "authentication required";
  }

  if (state.kind === "forbidden") {
    return "minimal annex preview access refused";
  }

  if (state.kind === "not_found") {
    return "closing folder unavailable for minimal annex preview";
  }

  if (state.kind === "timeout") {
    return "minimal annex preview timeout";
  }

  if (state.kind === "network_error") {
    return "minimal annex preview network error";
  }

  return "Minimal annex preview unavailable.";
}

function formatIssueMessage(message: string) {
  if (containsForbiddenUiWording(message)) {
    return "Issue message held for human review.";
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
