import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BalanceImportHistoryPanel,
  type BalanceImportHistoryPanelState
} from "./balance-import-history-panel";

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const VERSION_4 = {
  closingFolderId: CLOSING_FOLDER_ID,
  version: 4,
  importedAt: "2026-05-14T10:30:00Z",
  rowCount: 12,
  totalDebit: "12345.6",
  totalCredit: "12345.6"
};

const VERSION_3 = {
  ...VERSION_4,
  version: 3,
  importedAt: "2026-05-13T09:00:00Z",
  rowCount: 10,
  totalDebit: "-42",
  totalCredit: "-42"
};

const VERSION_2 = {
  ...VERSION_4,
  version: 2,
  importedAt: "2026-05-12T09:00:00Z",
  rowCount: 8,
  totalDebit: "NaN",
  totalCredit: "Infinity"
};

const READY_STATE: BalanceImportHistoryPanelState = {
  kind: "ready",
  versions: [VERSION_4, VERSION_3, VERSION_2],
  diff: {
    version: 4,
    previousVersion: 3,
    added: [
      {
        accountCode: "3000",
        accountLabel: "Sales",
        debit: "0",
        credit: "300"
      }
    ],
    removed: [
      {
        accountCode: "0999",
        accountLabel: "Old suspense",
        debit: "10",
        credit: ""
      }
    ],
    changed: [
      {
        accountCode: "1000",
        before: {
          accountCode: "1000",
          accountLabel: "Cash",
          debit: "100",
          credit: "0"
        },
        after: {
          accountCode: "1000",
          accountLabel: "Cash",
          debit: "125",
          credit: "0"
        }
      }
    ]
  }
};

function expectNodeBefore(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

describe("BalanceImportHistoryPanel", () => {
  it.each([
    { state: { kind: "loading" } as const, text: "chargement historique imports" },
    { state: { kind: "empty" } as const, text: "aucun import balance historise" },
    { state: { kind: "history_error" } as const, text: "historique import indisponible" },
    {
      state: { kind: "history_invalid_payload" } as const,
      text: "historique import bloque par securite"
    }
  ])("renders the stable state $text", ({ state, text }) => {
    render(<BalanceImportHistoryPanel state={state} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("renders versions, counters, and bounded diff details in ready state", () => {
    render(<BalanceImportHistoryPanel state={READY_STATE} />);

    expect(screen.getByText("Historique imports")).toBeInTheDocument();
    expect(screen.getByText("Balance courante et historique")).toBeInTheDocument();
    expect(screen.getByText("Resume courant")).toBeInTheDocument();
    expect(screen.getByText("Versions importees")).toBeInTheDocument();
    expect(screen.getAllByRole("columnheader", { name: "Version" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Date import" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Lignes" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Debit" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Credit" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("columnheader", { name: "Equilibre" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Compte" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Libelle" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Avant debit/credit" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Apres debit/credit" })).toBeInTheDocument();
    expect(screen.getAllByText("v4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("v3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("v2").length).toBeGreaterThan(0);
    expect(screen.getAllByText("oui").length).toBeGreaterThan(0);
    expect(screen.getByText("a verifier")).toBeInTheDocument();
    expect(screen.getAllByText("CHF 12 345.60").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CHF -42.00").length).toBeGreaterThan(0);
    expect(screen.getByText("NaN")).toBeInTheDocument();
    expect(screen.getByText("Infinity")).toBeInTheDocument();

    expect(screen.getByText("Ajoutees 1")).toBeInTheDocument();
    expect(screen.getByText("Supprimees 1")).toBeInTheDocument();
    expect(screen.getByText("Modifiees 1")).toBeInTheDocument();

    expect(screen.getByText("Ajoutee")).toBeInTheDocument();
    expect(screen.getByText("Supprimee")).toBeInTheDocument();
    expect(screen.getByText("Modifiee")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Old suspense")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
    expect(screen.getByText("CHF 0.00 / CHF 300.00")).toBeInTheDocument();
    expect(screen.getByText(/^CHF 10\.00 \/$/)).toBeInTheDocument();
    expect(screen.getByText("CHF 100.00 / CHF 0.00")).toBeInTheDocument();
    expect(screen.getByText("CHF 125.00 / CHF 0.00")).toBeInTheDocument();
  });

  it("places the optional CSV import slot after the current summary and before history", () => {
    render(
      <BalanceImportHistoryPanel
        state={READY_STATE}
        uploadSlot={<div>Nouvel import CSV</div>}
      />
    );

    const currentSummary = screen.getByText("Resume courant");
    const upload = screen.getByText("Nouvel import CSV");
    const history = screen.getByText("Versions importees");

    expectNodeBefore(currentSummary, upload);
    expectNodeBefore(upload, history);
  });

  it("renders no previous version state when previousVersion is null", () => {
    render(
      <BalanceImportHistoryPanel
        state={{
          kind: "ready",
          versions: [{ ...VERSION_4, version: 1 }],
          diff: {
            version: 1,
            previousVersion: null,
            added: [],
            removed: [],
            changed: []
          }
        }}
      />
    );

    expect(
      screen.getByText("La comparaison N/N-1 sera disponible apres un nouvel import.")
    ).toBeInTheDocument();
  });

  it("renders diff error states while keeping the version summary visible", () => {
    render(
      <BalanceImportHistoryPanel
        state={{
          kind: "diff_error",
          versions: [VERSION_4],
          requestedVersion: 4
        }}
      />
    );

    expect(screen.getAllByText("v4").length).toBeGreaterThan(0);
    expect(screen.getByText("comparaison N/N-1 indisponible")).toBeInTheDocument();
  });

  it("renders diff invalid payload state while keeping the version summary visible", () => {
    render(
      <BalanceImportHistoryPanel
        state={{
          kind: "diff_invalid_payload",
          versions: [VERSION_4],
          requestedVersion: 4
        }}
      />
    );

    expect(screen.getAllByText("v4").length).toBeGreaterThan(0);
    expect(screen.getByText("comparaison N/N-1 bloquee par securite")).toBeInTheDocument();
  });
});
