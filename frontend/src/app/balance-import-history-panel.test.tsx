import { render, screen, within } from "@testing-library/react";
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
  totalDebit: "1200.00",
  totalCredit: "1200.00"
};

const VERSION_3 = {
  ...VERSION_4,
  version: 3,
  importedAt: "2026-05-13T09:00:00Z",
  rowCount: 10,
  totalDebit: "1000.00",
  totalCredit: "1000.00"
};

const READY_STATE: BalanceImportHistoryPanelState = {
  kind: "ready",
  versions: [VERSION_4, VERSION_3],
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
        credit: "0"
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

describe("BalanceImportHistoryPanel", () => {
  it.each([
    { state: { kind: "loading" } as const, text: "chargement historique imports" },
    { state: { kind: "empty" } as const, text: "aucun import balance historise" },
    { state: { kind: "history_error" } as const, text: "historique import indisponible" },
    {
      state: { kind: "history_invalid_payload" } as const,
      text: "payload historique import invalide"
    }
  ])("renders the stable state $text", ({ state, text }) => {
    render(<BalanceImportHistoryPanel state={state} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("renders versions, counters, and bounded diff details in ready state", () => {
    render(<BalanceImportHistoryPanel state={READY_STATE} />);

    expect(screen.getByText("Historique imports")).toBeInTheDocument();
    expect(screen.getByText("Diff N/N-1")).toBeInTheDocument();
    expect(screen.getByText("v4")).toBeInTheDocument();
    expect(screen.getByText("v3")).toBeInTheDocument();

    const metrics = screen.getByText("added").closest("dl");
    expect(metrics).not.toBeNull();
    expect(within(metrics as HTMLElement).getAllByText("1")).toHaveLength(3);
    expect(within(metrics as HTMLElement).getByText("removed")).toBeInTheDocument();
    expect(within(metrics as HTMLElement).getByText("changed")).toBeInTheDocument();

    expect(screen.getByText("added details")).toBeInTheDocument();
    expect(screen.getByText("removed details")).toBeInTheDocument();
    expect(screen.getByText("changed details")).toBeInTheDocument();
    expect(screen.getByText("Sales")).toBeInTheDocument();
    expect(screen.getByText("Old suspense")).toBeInTheDocument();
    expect(screen.getByText("Cash")).toBeInTheDocument();
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

    expect(screen.getByText("aucune version precedente a comparer")).toBeInTheDocument();
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

    expect(screen.getByText("v4")).toBeInTheDocument();
    expect(screen.getByText("diff import indisponible")).toBeInTheDocument();
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

    expect(screen.getByText("v4")).toBeInTheDocument();
    expect(screen.getByText("payload diff import invalide")).toBeInTheDocument();
  });
});
