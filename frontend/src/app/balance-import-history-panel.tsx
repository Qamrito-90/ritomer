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
      className="min-w-0 overflow-hidden rounded-lg border bg-muted/20 p-4"
    >
      <div className="grid gap-4">
        <div className="grid gap-1">
          <p className="label-eyebrow">Historique imports</p>
          <h4 className="text-lg font-semibold text-foreground" id="balance-import-history-title">
            Balance courante et historique
          </h4>
          <p className="text-sm text-muted-foreground">
            Versions importees, volumes et ecarts N/N-1 deja disponibles pour revue.
          </p>
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
    return (
      <StateMessage
        text="historique import bloque par securite"
        detail="Les donnees recues sont incoherentes. Relancer le chargement avant de conclure la revue."
      />
    );
  }

  if (state.kind === "diff_error") {
    return (
      <div className="grid gap-4">
        <VersionSummary versions={state.versions} />
        <StateMessage
          text="comparaison N/N-1 indisponible"
          detail="L'historique reste visible. Relancer le chargement pour revoir le diff."
        />
      </div>
    );
  }

  if (state.kind === "diff_invalid_payload") {
    return (
      <div className="grid gap-4">
        <VersionSummary versions={state.versions} />
        <StateMessage
          text="comparaison N/N-1 bloquee par securite"
          detail="Les donnees recues sont incoherentes. La comparaison reste fermee."
        />
      </div>
    );
  }

  const { diff, versions } = state;

  return (
    <div className="grid gap-4">
      <VersionSummary versions={versions} />
      <dl className="grid gap-3 sm:grid-cols-3">
        <MetricItem label="ajoutes" value={String(diff.added.length)} />
        <MetricItem label="supprimes" value={String(diff.removed.length)} />
        <MetricItem label="modifies" value={String(diff.changed.length)} />
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
        <dl className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MetricItem label="version courante" value={`v${currentVersion.version}`} />
          <MetricItem label="date import" value={formatHistoryDate(currentVersion.importedAt)} />
          <MetricItem label="lignes" value={String(currentVersion.rowCount)} />
          <MetricItem label="debit" value={currentVersion.totalDebit} align="right" />
          <MetricItem label="credit" value={currentVersion.totalCredit} align="right" />
          <MetricItem
            label="equilibre"
            value={currentVersion.totalDebit === currentVersion.totalCredit ? "oui" : "a verifier"}
          />
        </dl>
      ) : null}
      <div className="min-w-0 overflow-hidden rounded-lg border bg-background/80">
        <table className="w-full table-fixed text-sm">
          <caption className="sr-only">Historique des imports balance</caption>
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium" scope="col">Version</th>
              <th className="px-3 py-2 text-left font-medium" scope="col">Date</th>
              <th className="px-3 py-2 text-right font-medium" scope="col">Lignes</th>
              <th className="px-3 py-2 text-right font-medium" scope="col">Debit</th>
              <th className="px-3 py-2 text-right font-medium" scope="col">Credit</th>
              <th className="px-3 py-2 text-left font-medium" scope="col">Equilibre</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visibleVersions.map((version) => (
              <tr key={version.version}>
                <td className="px-3 py-2 font-medium tabular-nums text-foreground">
                  v{version.version}
                </td>
                <td className="px-3 py-2 tabular-nums text-foreground">
                  {formatHistoryDate(version.importedAt)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {version.rowCount}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {version.totalDebit}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-foreground">
                  {version.totalCredit}
                </td>
                <td className="px-3 py-2 text-foreground">
                  {version.totalDebit === version.totalCredit ? "oui" : "a verifier"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiffDetails({ diff }: { diff: BalanceImportDiff }) {
  return (
    <div className="grid gap-3">
      <DiffLineGroup label="lignes ajoutees" lines={diff.added} />
      <DiffLineGroup label="lignes supprimees" lines={diff.removed} />
      {diff.changed.length > 0 ? (
        <div className="grid gap-2">
          <p className="text-sm font-semibold text-foreground">lignes modifiees</p>
          <ul className="grid min-w-0 gap-2">
            {diff.changed.slice(0, diffDetailsLimit).map((line) => (
              <li
                className="grid min-w-0 gap-3 rounded-lg border bg-background/80 p-3 text-sm text-foreground md:grid-cols-[minmax(7rem,0.7fr)_minmax(0,1.3fr)_minmax(8rem,1fr)_minmax(8rem,1fr)] md:items-center"
                key={line.accountCode}
              >
                <span className="break-all font-medium tabular-nums">{line.accountCode}</span>
                <span className="min-w-0 break-words">{line.before.accountLabel}</span>
                <span className="text-right tabular-nums">
                  avant {line.before.debit} / {line.before.credit}
                </span>
                <span className="text-right tabular-nums">
                  apres {line.after.debit} / {line.after.credit}
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
      <ul className="grid min-w-0 gap-2">
        {lines.slice(0, diffDetailsLimit).map((line) => (
          <li
            className="grid min-w-0 gap-3 rounded-lg border bg-background/80 p-3 text-sm text-foreground md:grid-cols-[minmax(7rem,0.7fr)_minmax(0,1.3fr)_minmax(8rem,1fr)] md:items-center"
            key={line.accountCode}
          >
            <span className="break-all font-medium tabular-nums">{line.accountCode}</span>
            <span className="min-w-0 break-words">{line.accountLabel}</span>
            <span className="text-right tabular-nums">
              debit {line.debit} / credit {line.credit}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricItem({
  align = "left",
  label,
  value
}: {
  align?: "left" | "right";
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border bg-background/80 p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={`mt-2 break-words text-sm font-medium tabular-nums text-foreground ${
          align === "right" ? "text-right" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function StateMessage({ detail, text }: { detail?: string; text: string }) {
  return (
    <div aria-live="polite" className="grid gap-1">
      <p className="label-eyebrow">Etat historique</p>
      <p className="text-sm font-semibold text-foreground">{text}</p>
      {detail === undefined ? null : <p className="text-sm text-muted-foreground">{detail}</p>}
    </div>
  );
}

function formatHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : localDateTimeFormatter.format(date);
}
