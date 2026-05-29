import type { ReactNode } from "react";
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
  uploadSlot?: ReactNode;
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

export function BalanceImportHistoryPanel({ state, uploadSlot }: BalanceImportHistoryPanelProps) {
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
        <BalanceImportHistoryStateSlot state={state} uploadSlot={uploadSlot} />
      </div>
    </section>
  );
}

function BalanceImportHistoryStateSlot({
  state,
  uploadSlot
}: {
  state: BalanceImportHistoryPanelState;
  uploadSlot?: ReactNode;
}) {
  if (state.kind === "loading") {
    return (
      <div className="grid gap-4">
        <StateMessage text="chargement historique imports" />
        {uploadSlot}
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className="grid gap-4">
        <StateMessage text="aucun import balance historise" />
        {uploadSlot}
      </div>
    );
  }

  if (state.kind === "history_error") {
    return (
      <div className="grid gap-4">
        <StateMessage
          text="historique import indisponible"
          detail="Les imports existants ne peuvent pas etre relus pour le moment. Reessayez avant de conclure la revue."
        />
        {uploadSlot}
      </div>
    );
  }

  if (state.kind === "history_invalid_payload") {
    return (
      <div className="grid gap-4">
        <StateMessage
          text="historique import bloque par securite"
          detail="Les donnees recues sont incoherentes. Relancer le chargement avant de conclure la revue."
        />
        {uploadSlot}
      </div>
    );
  }

  if (state.kind === "diff_error") {
    return (
      <div className="grid gap-4">
        <CurrentVersionSummary versions={state.versions} />
        {uploadSlot}
        <VersionHistoryTable versions={state.versions} />
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
        <CurrentVersionSummary versions={state.versions} />
        {uploadSlot}
        <VersionHistoryTable versions={state.versions} />
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
      <CurrentVersionSummary versions={versions} />
      {uploadSlot}
      <VersionHistoryTable versions={versions} />
      {diff.previousVersion === null ? (
        <StateMessage text="aucune version precedente a comparer" />
      ) : (
        <DiffReviewTable diff={diff} />
      )}
    </div>
  );
}

function CurrentVersionSummary({ versions }: { versions: BalanceImportVersionSummary[] }) {
  const currentVersion = versions[0] ?? null;

  if (currentVersion === null) {
    return null;
  }

  return (
    <div className="grid gap-3">
      <h5 className="text-sm font-semibold text-foreground">Resume courant</h5>
      <ImportVersionsTable
        caption="Resume courant de l'import balance"
        versions={[currentVersion]}
      />
    </div>
  );
}

function VersionHistoryTable({ versions }: { versions: BalanceImportVersionSummary[] }) {
  return (
    <div className="grid gap-3">
      <h5 className="text-sm font-semibold text-foreground">Versions importees</h5>
      <ImportVersionsTable
        caption="Versions importees de la balance"
        versions={versions.slice(0, compactVersionsLimit)}
      />
    </div>
  );
}

function ImportVersionsTable({
  caption,
  versions
}: {
  caption: string;
  versions: BalanceImportVersionSummary[];
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border bg-background/80">
      <table className="w-full table-fixed text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="w-[14%] px-3 py-2 text-left font-medium" scope="col">
              Version
            </th>
            <th className="w-[24%] px-3 py-2 text-left font-medium" scope="col">
              Date import
            </th>
            <th className="w-[12%] px-3 py-2 text-right font-medium" scope="col">
              Lignes
            </th>
            <th className="w-[17%] px-3 py-2 text-right font-medium" scope="col">
              Debit
            </th>
            <th className="w-[17%] px-3 py-2 text-right font-medium" scope="col">
              Credit
            </th>
            <th className="w-[16%] px-3 py-2 text-left font-medium" scope="col">
              Equilibre
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {versions.map((version) => (
            <tr key={version.version}>
              <td className="break-words px-3 py-2 font-medium tabular-nums text-foreground">
                v{version.version}
              </td>
              <td className="break-words px-3 py-2 tabular-nums text-foreground">
                {formatHistoryDate(version.importedAt)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">
                {version.rowCount}
              </td>
              <td className="break-words px-3 py-2 text-right tabular-nums text-foreground">
                {version.totalDebit}
              </td>
              <td className="break-words px-3 py-2 text-right tabular-nums text-foreground">
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
  );
}

function DiffReviewTable({ diff }: { diff: BalanceImportDiff }) {
  const rows = createDiffRows(diff).slice(0, diffDetailsLimit * 3);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-foreground">
        <span className="tabular-nums">Ajoutees {diff.added.length}</span>
        <span className="tabular-nums">Supprimees {diff.removed.length}</span>
        <span className="tabular-nums">Modifiees {diff.changed.length}</span>
      </div>
      {rows.length === 0 ? (
        <StateMessage text="aucun ecart detaille sur cette comparaison" />
      ) : (
        <div className="min-w-0 overflow-hidden rounded-lg border bg-background/80">
          <table className="w-full table-fixed text-sm">
            <caption className="sr-only">Comparaison N/N-1 de la balance importee</caption>
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="w-[14%] px-3 py-2 text-left font-medium" scope="col">
                  Type
                </th>
                <th className="w-[16%] px-3 py-2 text-left font-medium" scope="col">
                  Compte
                </th>
                <th className="w-[24%] px-3 py-2 text-left font-medium" scope="col">
                  Libelle
                </th>
                <th className="w-[23%] px-3 py-2 text-right font-medium" scope="col">
                  Avant debit/credit
                </th>
                <th className="w-[23%] px-3 py-2 text-right font-medium" scope="col">
                  Apres debit/credit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={`${row.type}-${row.accountCode}`}>
                  <td className="break-words px-3 py-2 font-medium text-foreground">
                    {row.typeLabel}
                  </td>
                  <td className="break-all px-3 py-2 font-medium tabular-nums text-foreground">
                    {row.accountCode}
                  </td>
                  <td className="min-w-0 break-words px-3 py-2 text-foreground">
                    {row.accountLabel}
                  </td>
                  <td className="break-words px-3 py-2 text-right tabular-nums text-foreground">
                    {row.beforeAmount}
                  </td>
                  <td className="break-words px-3 py-2 text-right tabular-nums text-foreground">
                    {row.afterAmount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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

function createDiffRows(diff: BalanceImportDiff) {
  return [
    ...diff.added.map((line) => ({
      accountCode: line.accountCode,
      accountLabel: line.accountLabel,
      afterAmount: formatDebitCredit(line),
      beforeAmount: "-",
      type: "added" as const,
      typeLabel: "Ajoutee"
    })),
    ...diff.removed.map((line) => ({
      accountCode: line.accountCode,
      accountLabel: line.accountLabel,
      afterAmount: "-",
      beforeAmount: formatDebitCredit(line),
      type: "removed" as const,
      typeLabel: "Supprimee"
    })),
    ...diff.changed.map((line) => ({
      accountCode: line.accountCode,
      accountLabel: line.after.accountLabel,
      afterAmount: formatDebitCredit(line.after),
      beforeAmount: formatDebitCredit(line.before),
      type: "changed" as const,
      typeLabel: "Modifiee"
    }))
  ];
}

function formatDebitCredit(line: BalanceImportDiffLine) {
  return `${line.debit} / ${line.credit}`;
}
