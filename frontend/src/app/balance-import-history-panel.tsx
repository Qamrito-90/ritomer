import type {
  BalanceImportDiff,
  BalanceImportDiffLine,
  BalanceImportVersionSummary
} from "../lib/api/import-balance";

export type BalanceImportHistoryPanelState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "history_error" }
  | { kind: "history_invalid_payload" }
  | {
      kind: "diff_error";
      versions: BalanceImportVersionSummary[];
      requestedVersion: number;
    }
  | {
      kind: "diff_invalid_payload";
      versions: BalanceImportVersionSummary[];
      requestedVersion: number;
    }
  | {
      kind: "ready";
      versions: BalanceImportVersionSummary[];
      diff: BalanceImportDiff;
    };

type BalanceImportHistoryPanelProps = {
  state: BalanceImportHistoryPanelState;
};

const localDateTimeFormatter = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

const compactVersionsLimit = 5;
const diffDetailsLimit = 3;

export function BalanceImportHistoryPanel({ state }: BalanceImportHistoryPanelProps) {
  return (
    <section
      aria-labelledby="balance-import-history-title"
      className="rounded-lg border bg-muted/20 p-4"
    >
      <div className="grid gap-4">
        <div className="grid gap-1">
          <p className="label-eyebrow">Historique imports</p>
          <h4 className="text-lg font-semibold text-foreground" id="balance-import-history-title">
            Diff N/N-1
          </h4>
        </div>
        <BalanceImportHistoryStateSlot state={state} />
      </div>
    </section>
  );
}

function BalanceImportHistoryStateSlot({ state }: { state: BalanceImportHistoryPanelState }) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement historique imports" />;
  }

  if (state.kind === "empty") {
    return <StateMessage text="aucun import balance historise" />;
  }

  if (state.kind === "history_error") {
    return <StateMessage text="historique import indisponible" />;
  }

  if (state.kind === "history_invalid_payload") {
    return <StateMessage text="payload historique import invalide" />;
  }

  if (state.kind === "diff_error") {
    return (
      <div className="grid gap-4">
        <VersionSummary versions={state.versions} />
        <StateMessage text="diff import indisponible" />
      </div>
    );
  }

  if (state.kind === "diff_invalid_payload") {
    return (
      <div className="grid gap-4">
        <VersionSummary versions={state.versions} />
        <StateMessage text="payload diff import invalide" />
      </div>
    );
  }

  const { diff, versions } = state;

  return (
    <div className="grid gap-4">
      <VersionSummary versions={versions} />
      <dl className="grid gap-3 sm:grid-cols-3">
        <MetricItem label="added" value={String(diff.added.length)} />
        <MetricItem label="removed" value={String(diff.removed.length)} />
        <MetricItem label="changed" value={String(diff.changed.length)} />
      </dl>
      {diff.previousVersion === null ? (
        <StateMessage text="aucune version precedente a comparer" />
      ) : (
        <DiffDetails diff={diff} />
      )}
    </div>
  );
}

function VersionSummary({ versions }: { versions: BalanceImportVersionSummary[] }) {
  const currentVersion = versions[0] ?? null;
  const visibleVersions = versions.slice(0, compactVersionsLimit);

  return (
    <div className="grid gap-3">
      {currentVersion !== null ? (
        <dl className="grid gap-3 sm:grid-cols-2">
          <MetricItem label="derniere version connue" value={String(currentVersion.version)} />
          <MetricItem label="lignes importees" value={String(currentVersion.rowCount)} />
        </dl>
      ) : null}
      <ul className="grid gap-2">
        {visibleVersions.map((version) => (
          <li
            className="rounded-lg border bg-background/80 p-3 text-sm font-medium text-foreground"
            key={version.version}
          >
            <span className="tabular-nums">v{version.version}</span>
            <span className="text-muted-foreground"> - </span>
            <span>{formatHistoryDate(version.importedAt)}</span>
            <span className="text-muted-foreground"> - </span>
            <span className="tabular-nums">{version.rowCount} lignes</span>
            <span className="text-muted-foreground"> - </span>
            <span className="tabular-nums">debit {version.totalDebit}</span>
            <span className="text-muted-foreground"> / </span>
            <span className="tabular-nums">credit {version.totalCredit}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DiffDetails({ diff }: { diff: BalanceImportDiff }) {
  return (
    <div className="grid gap-3">
      <DiffLineGroup label="added details" lines={diff.added} />
      <DiffLineGroup label="removed details" lines={diff.removed} />
      {diff.changed.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-foreground">changed details</p>
          <ul className="grid gap-2">
            {diff.changed.slice(0, diffDetailsLimit).map((line) => (
              <li
                className="rounded-lg border bg-background/80 p-3 text-sm text-foreground"
                key={line.accountCode}
              >
                <span className="font-medium tabular-nums">{line.accountCode}</span>
                <span className="text-muted-foreground"> - </span>
                <span>{line.before.accountLabel}</span>
                <span className="text-muted-foreground"> : </span>
                <span className="tabular-nums">
                  {line.before.debit}/{line.before.credit}
                </span>
                <span className="text-muted-foreground"> vers </span>
                <span className="tabular-nums">
                  {line.after.debit}/{line.after.credit}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function DiffLineGroup({ label, lines }: { label: string; lines: BalanceImportDiffLine[] }) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-2">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <ul className="grid gap-2">
        {lines.slice(0, diffDetailsLimit).map((line) => (
          <li
            className="rounded-lg border bg-background/80 p-3 text-sm text-foreground"
            key={line.accountCode}
          >
            <span className="font-medium tabular-nums">{line.accountCode}</span>
            <span className="text-muted-foreground"> - </span>
            <span>{line.accountLabel}</span>
            <span className="text-muted-foreground"> - </span>
            <span className="tabular-nums">
              debit {line.debit} / credit {line.credit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/80 p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-sm font-medium tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function StateMessage({ text }: { text: string }) {
  return (
    <div aria-live="polite" className="grid gap-1">
      <p className="label-eyebrow">Etat historique</p>
      <p className="text-sm font-semibold text-foreground">{text}</p>
    </div>
  );
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : localDateTimeFormatter.format(date);
}
