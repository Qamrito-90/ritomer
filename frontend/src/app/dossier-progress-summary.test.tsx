import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DossierProgressSummary } from "./dossier-progress-summary";
import type { ControlsShellState } from "../lib/api/controls";
import type { FinancialSummaryShellState } from "../lib/api/financial-summary";
import type { FinancialStatementsStructuredShellState } from "../lib/api/financial-statements-structured";
import type { ManualMappingShellState } from "../lib/api/manual-mapping";
import type {
  ClosingWorkpapersReadModel,
  WorkpapersShellState
} from "../lib/api/workpapers";

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const READY_CONTROLS: ControlsShellState = {
  kind: "ready",
  controls: {
    closingFolderId: CLOSING_FOLDER_ID,
    closingFolderStatus: "DRAFT",
    readiness: "READY",
    latestImportPresent: true,
    latestImportVersion: 3,
    mappingSummary: {
      total: 2,
      mapped: 2,
      unmapped: 0
    },
    controls: [
      {
        code: "LATEST_VALID_BALANCE_IMPORT_PRESENT",
        status: "PASS",
        severity: "BLOCKER",
        message: "Latest valid balance import version 3 is available."
      },
      {
        code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
        status: "PASS",
        severity: "BLOCKER",
        message: "Manual mapping is complete on the latest import."
      }
    ],
    nextAction: null,
    unmappedAccounts: []
  }
};

const BLOCKED_CONTROLS: ControlsShellState = {
  kind: "ready",
  controls: {
    closingFolderId: CLOSING_FOLDER_ID,
    closingFolderStatus: "DRAFT",
    readiness: "BLOCKED",
    latestImportPresent: false,
    latestImportVersion: null,
    mappingSummary: {
      total: 0,
      mapped: 0,
      unmapped: 0
    },
    controls: [
      {
        code: "LATEST_VALID_BALANCE_IMPORT_PRESENT",
        status: "FAIL",
        severity: "BLOCKER",
        message: "No valid balance import is available."
      },
      {
        code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
        status: "NOT_APPLICABLE",
        severity: "BLOCKER",
        message: "Manual mapping completeness is not applicable until import."
      }
    ],
    nextAction: {
      code: "IMPORT_BALANCE",
      path: `/api/closing-folders/${CLOSING_FOLDER_ID}/imports/balance`,
      actionable: true
    },
    unmappedAccounts: []
  }
};

const READY_MAPPING: ManualMappingShellState = {
  kind: "ready",
  projection: {
    closingFolderId: CLOSING_FOLDER_ID,
    latestImportVersion: 3,
    summary: {
      total: 2,
      mapped: 2,
      unmapped: 0
    },
    lines: [
      {
        accountCode: "1000",
        accountLabel: "Cash",
        debit: "100",
        credit: "0"
      },
      {
        accountCode: "2000",
        accountLabel: "Revenue",
        debit: "0",
        credit: "100"
      }
    ],
    mappings: [
      {
        accountCode: "1000",
        targetCode: "BS.ASSET"
      },
      {
        accountCode: "2000",
        targetCode: "PL.REVENUE"
      }
    ],
    targets: [
      {
        code: "BS.ASSET",
        label: "Actif",
        selectable: true
      },
      {
        code: "PL.REVENUE",
        label: "Produit",
        selectable: true
      }
    ]
  }
};

const EMPTY_MAPPING: ManualMappingShellState = {
  kind: "ready",
  projection: {
    closingFolderId: CLOSING_FOLDER_ID,
    latestImportVersion: null,
    summary: {
      total: 0,
      mapped: 0,
      unmapped: 0
    },
    lines: [],
    mappings: [],
    targets: []
  }
};

const READY_FINANCIAL_SUMMARY: FinancialSummaryShellState = {
  kind: "ready",
  summary: {
    closingFolderId: CLOSING_FOLDER_ID,
    statementState: "PREVIEW_READY",
    latestImportVersion: 3,
    coverage: {
      totalLines: 2,
      mappedLines: 2,
      unmappedLines: 0,
      mappedShare: "1"
    },
    unmappedBalanceImpact: {
      debitTotal: "0",
      creditTotal: "0",
      netDebitMinusCredit: "0"
    },
    balanceSheetSummary: {
      assets: "100",
      liabilities: "0",
      equity: "0",
      currentPeriodResult: "100",
      totalAssets: "100",
      totalLiabilitiesAndEquity: "100"
    },
    incomeStatementSummary: {
      revenue: "100",
      expenses: "0",
      netResult: "100"
    }
  }
};

const EMPTY_FINANCIAL_SUMMARY: FinancialSummaryShellState = {
  kind: "ready",
  summary: {
    closingFolderId: CLOSING_FOLDER_ID,
    statementState: "NO_DATA",
    latestImportVersion: null,
    coverage: {
      totalLines: 0,
      mappedLines: 0,
      unmappedLines: 0,
      mappedShare: "0"
    },
    unmappedBalanceImpact: {
      debitTotal: "0",
      creditTotal: "0",
      netDebitMinusCredit: "0"
    },
    balanceSheetSummary: null,
    incomeStatementSummary: null
  }
};

const READY_STRUCTURED: FinancialStatementsStructuredShellState = {
  kind: "ready",
  financialStatements: {
    closingFolderId: CLOSING_FOLDER_ID,
    statementState: "PREVIEW_READY",
    presentationType: "STRUCTURED_PREVIEW",
    isStatutory: false,
    latestImportVersion: 3,
    coverage: {
      totalLines: 2,
      mappedLines: 2,
      unmappedLines: 0,
      mappedShare: "1"
    },
    balanceSheet: {
      groups: [
        {
          code: "BS.ASSET",
          label: "Actifs",
          total: "100",
          breakdowns: []
        },
        {
          code: "BS.LIABILITY",
          label: "Passifs",
          total: "0",
          breakdowns: []
        },
        {
          code: "BS.EQUITY",
          label: "Capitaux propres",
          total: "0",
          breakdowns: []
        }
      ],
      totals: {
        totalAssets: "100",
        totalLiabilities: "0",
        totalEquity: "0",
        currentPeriodResult: "100",
        totalLiabilitiesAndEquity: "100"
      }
    },
    incomeStatement: {
      groups: [
        {
          code: "PL.REVENUE",
          label: "Produits",
          total: "100",
          breakdowns: []
        },
        {
          code: "PL.EXPENSE",
          label: "Charges",
          total: "0",
          breakdowns: []
        }
      ],
      totals: {
        totalRevenue: "100",
        totalExpenses: "0",
        netResult: "100"
      }
    }
  }
};

const EMPTY_STRUCTURED: FinancialStatementsStructuredShellState = {
  kind: "ready",
  financialStatements: {
    closingFolderId: CLOSING_FOLDER_ID,
    statementState: "NO_DATA",
    presentationType: "STRUCTURED_PREVIEW",
    isStatutory: false,
    latestImportVersion: null,
    coverage: {
      totalLines: 0,
      mappedLines: 0,
      unmappedLines: 0,
      mappedShare: "0"
    },
    balanceSheet: null,
    incomeStatement: null
  }
};

const READY_WORKPAPERS: WorkpapersShellState = {
  kind: "ready",
  workpapers: createWorkpapersReadModel()
};

const EMPTY_WORKPAPERS: WorkpapersShellState = {
  kind: "ready",
  workpapers: {
    closingFolderId: CLOSING_FOLDER_ID,
    closingFolderStatus: "DRAFT",
    readiness: "BLOCKED",
    summaryCounts: {
      totalCurrentAnchors: 0,
      withWorkpaperCount: 0,
      readyForReviewCount: 0,
      reviewedCount: 0,
      staleCount: 0,
      missingCount: 0
    },
    items: [],
    staleWorkpapers: []
  }
};

function createWorkpapersReadModel(): ClosingWorkpapersReadModel {
  return {
    closingFolderId: CLOSING_FOLDER_ID,
    closingFolderStatus: "DRAFT",
    readiness: "READY",
    summaryCounts: {
      totalCurrentAnchors: 2,
      withWorkpaperCount: 2,
      readyForReviewCount: 1,
      reviewedCount: 1,
      staleCount: 0,
      missingCount: 0
    },
    items: [
      {
        anchorCode: "BS.ASSET",
        anchorLabel: "Actifs",
        statementKind: "BALANCE_SHEET",
        breakdownType: "SECTION",
        isCurrentStructure: true,
        workpaper: {
          status: "READY_FOR_REVIEW",
          noteText: "Assets documented.",
          evidences: []
        },
        documents: [
          {
            fileName: "bank.pdf",
            mediaType: "application/pdf",
            sourceLabel: "Bank",
            verificationStatus: "VERIFIED",
            reviewComment: null
          }
        ],
        documentVerificationSummary: {
          documentsCount: 1,
          unverifiedCount: 0,
          verifiedCount: 1,
          rejectedCount: 0
        }
      },
      {
        anchorCode: "PL.REVENUE",
        anchorLabel: "Produits",
        statementKind: "INCOME_STATEMENT",
        breakdownType: "SECTION",
        isCurrentStructure: true,
        workpaper: {
          status: "REVIEWED",
          noteText: "Revenue reviewed.",
          evidences: []
        },
        documents: [
          {
            fileName: "invoice.pdf",
            mediaType: "application/pdf",
            sourceLabel: "Invoice",
            verificationStatus: "REJECTED",
            reviewComment: "Mismatch."
          }
        ],
        documentVerificationSummary: {
          documentsCount: 1,
          unverifiedCount: 0,
          verifiedCount: 0,
          rejectedCount: 1
        }
      }
    ],
    staleWorkpapers: []
  };
}

function renderSummary({
  controlsState = READY_CONTROLS,
  financialStatementsStructuredState = READY_STRUCTURED,
  financialSummaryState = READY_FINANCIAL_SUMMARY,
  manualMappingState = READY_MAPPING,
  workpapersState = READY_WORKPAPERS
}: Partial<{
  controlsState: ControlsShellState;
  financialStatementsStructuredState: FinancialStatementsStructuredShellState;
  financialSummaryState: FinancialSummaryShellState;
  manualMappingState: ManualMappingShellState;
  workpapersState: WorkpapersShellState;
}> = {}) {
  return render(
    <DossierProgressSummary
      controlsState={controlsState}
      financialStatementsStructuredState={financialStatementsStructuredState}
      financialSummaryState={financialSummaryState}
      manualMappingState={manualMappingState}
      workpapersState={workpapersState}
    />
  );
}

function getProgressItem(label: string) {
  const item = screen.getByText(label).closest("li");

  expect(item).not.toBeNull();

  return item as HTMLElement;
}

describe("DossierProgressSummary", () => {
  it("renders the compact read-only progress from existing route read models", () => {
    renderSummary();

    expect(screen.getByRole("heading", { name: "Synthese du dossier" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Previsualisation non statutaire. Etat indicatif, revue humaine obligatoire, pas un export final ni un document CO."
      )
    ).toBeInTheDocument();

    expect(within(getProgressItem("Import balance")).getByText("fait")).toBeInTheDocument();
    expect(within(getProgressItem("Import balance")).getByText("version 3")).toBeInTheDocument();

    expect(within(getProgressItem("Mapping")).getByText("pret")).toBeInTheDocument();
    expect(within(getProgressItem("Mapping")).getByText("2/2 comptes mappes")).toBeInTheDocument();

    expect(within(getProgressItem("Etat de preparation")).getByText("pret")).toBeInTheDocument();
    expect(
      within(getProgressItem("Etat de preparation")).getByText("etat de preparation pret")
    ).toBeInTheDocument();

    expect(within(getProgressItem("Previsualisations financieres")).getByText("pret")).toBeInTheDocument();
    expect(
      within(getProgressItem("Previsualisations financieres")).getByText(
        "previsualisations non statutaires disponibles"
      )
    ).toBeInTheDocument();

    expect(within(getProgressItem("Couverture justifications")).getByText("pret")).toBeInTheDocument();
    expect(
      within(getProgressItem("Couverture justifications")).getByText(
        "2 courant(s), 0 manquant(s), 0 ancien(s)"
      )
    ).toBeInTheDocument();

    expect(within(getProgressItem("Pieces justificatives")).getByText("rejete")).toBeInTheDocument();
    expect(
      within(getProgressItem("Pieces justificatives")).getByText(
        "2 deposee(s), 1 verifiee(s), 1 rejetee(s), 0 a verifier"
      )
    ).toBeInTheDocument();

    expect(within(getProgressItem("Revue")).getByText("pret pour revue")).toBeInTheDocument();
    expect(
      within(getProgressItem("Revue")).getByText("1 pret(s) pour revue, 1 revu(s)")
    ).toBeInTheDocument();
  });

  it("renders loading and error states without hiding the rest of the summary", () => {
    renderSummary({
      controlsState: { kind: "loading" },
      financialSummaryState: { kind: "forbidden" },
      manualMappingState: { kind: "forbidden" },
      workpapersState: { kind: "timeout" }
    });

    expect(within(getProgressItem("Import balance")).getAllByText("chargement")).toHaveLength(2);
    expect(within(getProgressItem("Mapping")).getByText("erreur")).toBeInTheDocument();
    expect(within(getProgressItem("Mapping")).getByText("etat mapping indisponible")).toBeInTheDocument();
    expect(
      within(getProgressItem("Previsualisations financieres")).getByText("erreur")
    ).toBeInTheDocument();
    expect(
      within(getProgressItem("Previsualisations financieres")).getByText(
        "previsualisations indisponibles"
      )
    ).toBeInTheDocument();
    expect(within(getProgressItem("Couverture justifications")).getByText("erreur")).toBeInTheDocument();
    expect(within(getProgressItem("Revue")).getByText("erreur")).toBeInTheDocument();
  });

  it("renders empty and missing states without storage keys or forbidden wording", () => {
    const { container } = renderSummary({
      controlsState: BLOCKED_CONTROLS,
      financialStatementsStructuredState: EMPTY_STRUCTURED,
      financialSummaryState: EMPTY_FINANCIAL_SUMMARY,
      manualMappingState: EMPTY_MAPPING,
      workpapersState: EMPTY_WORKPAPERS
    });

    expect(within(getProgressItem("Import balance")).getByText("manquant")).toBeInTheDocument();
    expect(within(getProgressItem("Import balance")).getByText("aucun import valide")).toBeInTheDocument();
    expect(within(getProgressItem("Mapping")).getByText("manquant")).toBeInTheDocument();
    expect(within(getProgressItem("Mapping")).getByText("balance import manquant")).toBeInTheDocument();
    expect(within(getProgressItem("Etat de preparation")).getByText("bloque")).toBeInTheDocument();
    expect(
      within(getProgressItem("Etat de preparation")).getByText(
        "etat de preparation bloque par controles"
      )
    ).toBeInTheDocument();
    expect(
      within(getProgressItem("Previsualisations financieres")).getByText("manquant")
    ).toBeInTheDocument();
    expect(
      within(getProgressItem("Previsualisations financieres")).getByText(
        "aucune previsualisation disponible"
      )
    ).toBeInTheDocument();
    expect(within(getProgressItem("Couverture justifications")).getByText("vide")).toBeInTheDocument();
    expect(within(getProgressItem("Couverture justifications")).getByText("aucune rubrique a documenter")).toBeInTheDocument();
    expect(within(getProgressItem("Pieces justificatives")).getByText("manquant")).toBeInTheDocument();
    expect(
      within(getProgressItem("Pieces justificatives")).getByText("justifications requises avant preuves")
    ).toBeInTheDocument();
    expect(within(getProgressItem("Revue")).getByText("bloque")).toBeInTheDocument();

    expect(container).not.toHaveTextContent(/storage_object_key|storageObjectKey|signed URL/i);
    expect(container).not.toHaveTextContent(
      /CO-ready|statutory-ready|official financial statements|automatically approved|AI-approved|final CO annex/i
    );
  });
});
