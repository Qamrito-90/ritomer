import { RouterProvider } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createAppMemoryRouter } from "./router";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  tenantId: ACTIVE_TENANT.tenantId,
  name: "Closing FY26",
  periodStartOn: "2026-01-01",
  periodEndOn: "2026-12-31",
  externalRef: "EXT-26",
  status: "DRAFT"
};

const ARCHIVED_CLOSING_FOLDER = {
  ...CLOSING_FOLDER,
  status: "ARCHIVED"
};

const REFRESHED_CLOSING_FOLDER = {
  ...CLOSING_FOLDER,
  name: "Closing FY26 refreshed",
  externalRef: "EXT-26-R"
};

const INITIAL_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "BLOCKED",
  latestImportPresent: true,
  latestImportVersion: 2,
  mappingSummary: {
    total: 3,
    mapped: 1,
    unmapped: 2
  },
  controls: [
    {
      code: "LATEST_VALID_BALANCE_IMPORT_PRESENT",
      status: "PASS",
      severity: "BLOCKER",
      message: "Latest valid balance import version 2 is available."
    },
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      status: "FAIL",
      severity: "BLOCKER",
      message: "2 account(s) remain unmapped on the latest import."
    }
  ],
  nextAction: {
    code: "COMPLETE_MANUAL_MAPPING",
    path: `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
    actionable: true
  },
  unmappedAccounts: [
    {
      accountCode: "9000",
      accountLabel: "Revenue",
      debit: "0",
      credit: "100"
    },
    {
      accountCode: "0500",
      accountLabel: "Receivable",
      debit: "100",
      credit: "0"
    }
  ]
};

const REFRESHED_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "READY",
  latestImportPresent: true,
  latestImportVersion: 4,
  mappingSummary: {
    total: 3,
    mapped: 3,
    unmapped: 0
  },
  controls: [
    {
      code: "LATEST_VALID_BALANCE_IMPORT_PRESENT",
      status: "PASS",
      severity: "BLOCKER",
      message: "Latest valid balance import version 4 is available."
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
};

const INITIAL_MANUAL_MAPPING = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 2,
  summary: {
    total: 2,
    mapped: 1,
    unmapped: 1
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
};

const REFRESHED_MANUAL_MAPPING = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 4,
  summary: {
    total: 1,
    mapped: 1,
    unmapped: 0
  },
  lines: [
    {
      accountCode: "3000",
      accountLabel: "Sales refreshed",
      debit: "0",
      credit: "300"
    }
  ],
  mappings: [
    {
      accountCode: "3000",
      targetCode: "PL.REVENUE"
    }
  ],
  targets: INITIAL_MANUAL_MAPPING.targets
};

const INITIAL_FINANCIAL_SUMMARY = {
  closingFolderId: CLOSING_FOLDER.id,
  statementState: "PREVIEW_PARTIAL",
  latestImportVersion: 2,
  coverage: {
    totalLines: 3,
    mappedLines: 1,
    unmappedLines: 2,
    mappedShare: "0.3333"
  },
  unmappedBalanceImpact: {
    debitTotal: "100",
    creditTotal: "100",
    netDebitMinusCredit: "0"
  },
  balanceSheetSummary: {
    assets: "100",
    liabilities: "0",
    equity: "0",
    currentPeriodResult: "0",
    totalAssets: "100",
    totalLiabilitiesAndEquity: "0"
  },
  incomeStatementSummary: {
    revenue: "0",
    expenses: "0",
    netResult: "0"
  }
};

const REFRESHED_FINANCIAL_SUMMARY = {
  ...INITIAL_FINANCIAL_SUMMARY,
  statementState: "PREVIEW_READY",
  latestImportVersion: 4,
  coverage: {
    totalLines: 1,
    mappedLines: 1,
    unmappedLines: 0,
    mappedShare: "1"
  },
  unmappedBalanceImpact: {
    debitTotal: "0",
    creditTotal: "0",
    netDebitMinusCredit: "0"
  },
  incomeStatementSummary: {
    revenue: "300",
    expenses: "0",
    netResult: "300"
  }
};

const INITIAL_FINANCIAL_STATEMENTS_STRUCTURED = {
  closingFolderId: CLOSING_FOLDER.id,
  statementState: "BLOCKED",
  presentationType: "STRUCTURED_PREVIEW",
  isStatutory: false,
  latestImportVersion: 2,
  coverage: {
    totalLines: 3,
    mappedLines: 1,
    unmappedLines: 2,
    mappedShare: "0.3333"
  },
  balanceSheet: null,
  incomeStatement: null
};

const REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED = {
  ...INITIAL_FINANCIAL_STATEMENTS_STRUCTURED,
  statementState: "PREVIEW_READY",
  latestImportVersion: 4,
  coverage: {
    totalLines: 1,
    mappedLines: 1,
    unmappedLines: 0,
    mappedShare: "1"
  },
  balanceSheet: {
    groups: [
      {
        code: "BS.ASSET",
        label: "Actifs",
        total: "0",
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
        total: "300",
        breakdowns: []
      }
    ],
    totals: {
      totalAssets: "0",
      totalLiabilities: "0",
      totalEquity: "0",
      currentPeriodResult: "300",
      totalLiabilitiesAndEquity: "300"
    }
  },
  incomeStatement: {
    groups: [
      {
        code: "PL.REVENUE",
        label: "Produits",
        total: "300",
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
      totalRevenue: "300",
      totalExpenses: "0",
      netResult: "300"
    }
  }
};

const INITIAL_WORKPAPERS = {
  closingFolderId: CLOSING_FOLDER.id,
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
};

const REFRESHED_WORKPAPERS = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "READY",
  latestImportVersion: 4,
  blockers: [],
  nextAction: null,
  summaryCounts: {
    totalCurrentAnchors: 1,
    withWorkpaperCount: 0,
    readyForReviewCount: 0,
    reviewedCount: 0,
    staleCount: 0,
    missingCount: 1
  },
  items: [
    {
      anchorCode: "PL.REVENUE",
      anchorLabel: "Produits",
      statementKind: "INCOME_STATEMENT",
      breakdownType: "SECTION",
      isCurrentStructure: true,
      workpaper: null,
      documents: [],
      documentVerificationSummary: null
    }
  ],
  staleWorkpapers: []
};

const EMPTY_EXPORT_PACKS = {
  items: []
};

const BLOCKED_MINIMAL_ANNEX = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "BLOCKED",
  annexState: "BLOCKED",
  presentationType: "MINIMAL_OPERATIONAL_ANNEX",
  isStatutory: false,
  requiresHumanReview: true,
  legalNotice: {
    title: "Preview non statutaire.",
    notOfficialCoAnnex: "Not a final CO deliverable.",
    noAutomaticValidation: "Aucune decision automatique.",
    humanReviewRequired: "Human review required."
  },
  basis: {
    controlsReadiness: "BLOCKED",
    latestImportVersion: null,
    taxonomyVersion: 2,
    structuredStatementState: "NO_DATA",
    structuredPresentationType: "STRUCTURED_PREVIEW",
    exportPack: null
  },
  blockers: [],
  warnings: [],
  annex: null
};

const EMPTY_MAPPING_SUGGESTIONS = {
  state: "DISABLED",
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: null,
  taxonomyVersion: 2,
  suggestions: [],
  errors: [
    {
      code: "AI_MAPPING_SUGGESTIONS_DISABLED",
      message: "Mapping suggestions are disabled."
    }
  ]
};

const REFRESHED_MAPPING_SUGGESTIONS = {
  state: "READY",
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 4,
  taxonomyVersion: 2,
  suggestions: [],
  errors: []
};

const CLOSING_ROUTE = `/closing-folders/${CLOSING_FOLDER.id}`;

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function renderClosingRoute() {
  const router = createAppMemoryRouter([CLOSING_ROUTE]);
  return render(<RouterProvider router={router} />);
}

function primeReadyClosingRoute(
  fetchMock: ReturnType<typeof vi.fn>,
  closingFolder = CLOSING_FOLDER,
  controls = INITIAL_CONTROLS
) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
    .mockResolvedValueOnce(jsonResponse(200, closingFolder))
    .mockResolvedValueOnce(jsonResponse(200, controls))
    .mockResolvedValueOnce(jsonResponse(200, INITIAL_MANUAL_MAPPING))
    .mockResolvedValueOnce(jsonResponse(200, INITIAL_FINANCIAL_SUMMARY))
    .mockResolvedValueOnce(jsonResponse(200, INITIAL_FINANCIAL_STATEMENTS_STRUCTURED))
    .mockResolvedValueOnce(jsonResponse(200, INITIAL_WORKPAPERS))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
    .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX));
}

async function waitForClosingRouteReady() {
  expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
  expect(await screen.findByText("Import balance")).toBeInTheDocument();
  expect(await screen.findByText("Mapping manuel")).toBeInTheDocument();
  expect(await screen.findByText("Cockpit read-only")).toBeInTheDocument();
  expect(await screen.findByText("Financial summary")).toBeInTheDocument();
  expect(await screen.findByText("Financial statements structured")).toBeInTheDocument();
  expect(await screen.findByText("Workpapers")).toBeInTheDocument();
  expect(await screen.findByText("AI mapping suggestion")).toBeInTheDocument();
  expect(await screen.findByText("Audit-ready export pack")).toBeInTheDocument();
  expect(await screen.findByText("No audit-ready pack generated yet.")).toBeInTheDocument();
  expect(await screen.findByText("Minimal annex preview")).toBeInTheDocument();
}

function getImportInput() {
  return screen.getByLabelText("Fichier CSV") as HTMLInputElement;
}

function getImportButton() {
  return screen.getByRole("button", { name: "Importer la balance" });
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function expectNoForbiddenImportCalls(
  paths: string[],
  expectedFinancialSummaryCalls = 1,
  expectedFinancialStatementsStructuredCalls = 1,
  expectedWorkpapersCalls = 1,
  expectedMappingSuggestionsCalls = 1
) {
  expect(paths.filter((path) => path.includes("/financial-summary"))).toHaveLength(
    expectedFinancialSummaryCalls
  );
  expect(paths.filter((path) => path.includes("/financial-statements/structured"))).toHaveLength(
    expectedFinancialStatementsStructuredCalls
  );
  expect(paths.filter((path) => path.includes("/workpapers"))).toHaveLength(
    expectedWorkpapersCalls
  );
  expect(paths.filter((path) => path.endsWith("/mappings/suggestions"))).toHaveLength(
    expectedMappingSuggestionsCalls
  );
  expect(paths.filter((path) => path.endsWith("/export-packs"))).toHaveLength(1);
  expect(paths.filter((path) => path.endsWith("/minimal-annex"))).toHaveLength(1);
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
  expect(paths.some((path) => path.includes("/financial-statements-structured"))).toBe(false);
  expect(paths.some((path) => /\/workpapers\/[^/]+/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/documents"))).toBe(false);
  expect(paths.some((path) => /\/export-packs\/[^/]+\/content$/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
  expect(paths.some((path) => path.includes("/graphql"))).toBe(false);
}

function expectDefinitionValue(container: HTMLElement, label: string, value: string) {
  const labelNode = within(container).getByText(new RegExp(`^${label}$`));
  const valueNode = labelNode.parentElement?.querySelector("dd");

  expect(valueNode).not.toBeNull();
  expect(valueNode).toHaveTextContent(value);
}

describe("router import balance", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows aucun fichier selectionne by default and never posts without a selected file", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeReadyClosingRoute(fetchMock);

    renderClosingRoute();
    await waitForClosingRouteReady();

    expect(await screen.findByText("aucun fichier selectionne")).toBeInTheDocument();
    expect(getImportButton()).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expectNoForbiddenImportCalls(getRequestPaths(fetchMock));
  });

  it("accepts a .csv file locally and enables the upload action", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv", { type: "text/plain" }));

    expect(await screen.findByText("fichier pret : balance.csv")).toBeInTheDocument();
    expect(getImportButton()).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("accepts a .CSV file locally", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.CSV", { type: "text/plain" }));

    expect(await screen.findByText("fichier pret : balance.CSV")).toBeInTheDocument();
    expect(getImportButton()).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("rejects a non-CSV file locally and never posts", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const uploadOptions = {
      ["appl" + "yAccept"]: false
    } as Parameters<typeof userEvent.setup>[0];
    const user = userEvent.setup(uploadOptions);
    primeReadyClosingRoute(fetchMock);

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["pdf"], "balance.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("fichier CSV requis")).toBeInTheDocument();
    expect(getImportButton()).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("does not perform any local MIME validation for a *.csv file", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(
      getImportInput(),
      new File(["csv"], "balance.csv", { type: "application/octet-stream" })
    );
    await user.click(getImportButton());

    expect(await screen.findByText("authentification requise")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(11);
    expect(fetchMock.mock.calls[10]?.[0]).toBe(
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance`
    );
  });

  it("disables the import surface and never posts when the dossier is ARCHIVED", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeReadyClosingRoute(fetchMock, ARCHIVED_CLOSING_FOLDER);

    renderClosingRoute();
    await waitForClosingRouteReady();

    expect(await screen.findByText("dossier archive, import impossible")).toBeInTheDocument();
    expect(getImportInput()).toBeDisabled();
    expect(getImportButton()).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("shows import balance en cours while the POST is pending", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(screen.getByText("import balance en cours")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it("renders timeout import on a timeout failure", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock.mockRejectedValueOnce(new Error("timeout"));

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(await screen.findByText("timeout import")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it("keeps the success visible and refreshes dossier plus core downstream surfaces after a valid 201", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(201, {
          closingFolderId: CLOSING_FOLDER.id,
          version: 4,
          rowCount: 12
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_CLOSING_FOLDER))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_CONTROLS))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MANUAL_MAPPING))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_WORKPAPERS))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(await screen.findByText("balance importee avec succes")).toBeInTheDocument();
    expect(screen.getByText("version import : 4")).toBeInTheDocument();
    expect(screen.getByText("lignes importees : 12")).toBeInTheDocument();
    expect(await screen.findByText("Closing FY26 refreshed")).toBeInTheDocument();
    expect(screen.getByText("EXT-26-R")).toBeInTheDocument();

    const readinessBlock = screen.getByRole("heading", { name: "Readiness" }).closest("section");
    expect(readinessBlock).not.toBeNull();
    expectDefinitionValue(readinessBlock as HTMLElement, "version d import", "4");
    expect(screen.getByText("Latest valid balance import version 4 is available.")).toBeInTheDocument();
    expect(screen.queryByText("Latest valid balance import version 2 is available.")).not.toBeInTheDocument();
    expect(await screen.findByLabelText("ligne mapping 3000")).toBeInTheDocument();
    expect(screen.getByText("Sales refreshed")).toBeInTheDocument();
    expect(screen.getByText("etat preview : preview prete")).toBeInTheDocument();
    expect(screen.getAllByText("resultat net : 300").length).toBeGreaterThan(0);
    expect(screen.getByText("etat structured preview : preview prete")).toBeInTheDocument();
    expect(screen.getByText("total produits : 300")).toBeInTheDocument();
    expect(screen.getByText("anchors courants total : 1")).toBeInTheDocument();
    expect(screen.getByText("AI mapping suggestion ready.")).toBeInTheDocument();

    const paths = getRequestPaths(fetchMock);
    expect(paths).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance`,
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`
    ]);
    expectNoForbiddenImportCalls(paths, 2, 2, 2, 2);
  });

  it("keeps the import success visible and preserves the last dossier and controls render when the dossier refresh fails", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(201, {
          closingFolderId: CLOSING_FOLDER.id,
          version: 4,
          rowCount: 12
        })
      )
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, INITIAL_CONTROLS))
      .mockResolvedValueOnce(jsonResponse(200, INITIAL_MANUAL_MAPPING))
      .mockResolvedValueOnce(jsonResponse(200, INITIAL_FINANCIAL_SUMMARY))
      .mockResolvedValueOnce(jsonResponse(200, INITIAL_FINANCIAL_STATEMENTS_STRUCTURED))
      .mockResolvedValueOnce(jsonResponse(200, INITIAL_WORKPAPERS))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(await screen.findByText("balance importee avec succes")).toBeInTheDocument();
    expect(screen.getByText("rafraichissement dossier impossible")).toBeInTheDocument();
    expect(screen.getByText("Closing FY26")).toBeInTheDocument();
    expect(screen.queryByText("Closing FY26 refreshed")).not.toBeInTheDocument();
    expect(screen.getByText("Latest valid balance import version 2 is available.")).toBeInTheDocument();
    expect(screen.getByText("etat preview : preview partielle")).toBeInTheDocument();
    expect(await screen.findByText("AI mapping suggestion ready.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(18);
    expectNoForbiddenImportCalls(getRequestPaths(fetchMock), 2, 2, 2, 2);
  });

  it("keeps the import success visible, refreshes the dossier, and preserves the last controls render when the controls refresh fails", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(201, {
          closingFolderId: CLOSING_FOLDER.id,
          version: 4,
          rowCount: 12
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_CLOSING_FOLDER))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MANUAL_MAPPING))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_WORKPAPERS))
      .mockResolvedValueOnce(jsonResponse(200, REFRESHED_MAPPING_SUGGESTIONS));

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(await screen.findByText("balance importee avec succes")).toBeInTheDocument();
    expect(screen.getByText("rafraichissement controls impossible")).toBeInTheDocument();
    expect(await screen.findByText("Closing FY26 refreshed")).toBeInTheDocument();
    expect(screen.getByText("EXT-26-R")).toBeInTheDocument();
    expect(screen.getByText("Latest valid balance import version 2 is available.")).toBeInTheDocument();
    expect(screen.queryByText("Latest valid balance import version 4 is available.")).not.toBeInTheDocument();
    expect(await screen.findByText("etat preview : preview prete")).toBeInTheDocument();
    expect(await screen.findByText("AI mapping suggestion ready.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(18);
    expectNoForbiddenImportCalls(getRequestPaths(fetchMock), 2, 2, 2, 2);
  });

  it("renders payload import invalide on an invalid 201 payload, keeps the selected file, and skips refreshs", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, {
        version: 4,
        rowCount: 12
      })
    );

    renderClosingRoute();
    await waitForClosingRouteReady();

    const file = new File(["csv"], "balance.csv");

    await user.upload(getImportInput(), file);
    await user.click(getImportButton());

    expect(await screen.findByText("payload import invalide")).toBeInTheDocument();
    expect(getImportInput().files?.[0]?.name).toBe("balance.csv");
    expect(getImportButton()).toBeEnabled();
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it("renders import invalide, the backend message, and ordered 400 errors on a structured bad request", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        message: "CSV validation failed",
        errors: [
          {
            line: 2,
            field: "accountCode",
            message: "duplicate account"
          },
          {
            line: 3,
            field: null,
            message: "missing credit"
          },
          {
            line: null,
            field: "accountLabel",
            message: "label missing"
          },
          {
            line: null,
            field: null,
            message: "totals mismatch"
          }
        ]
      })
    );

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(await screen.findByText("import invalide")).toBeInTheDocument();
    expect(screen.getByText("CSV validation failed")).toBeInTheDocument();

    const statusBlock = screen.getByText("import invalide").closest("div");
    expect(statusBlock).not.toBeNull();
    const errorLines = within(statusBlock as HTMLElement).getAllByRole("listitem");
    expect(errorLines.map((item) => item.textContent)).toEqual([
      "ligne 2 - accountCode : duplicate account",
      "ligne 3 : missing credit",
      "accountLabel : label missing",
      "totals mismatch"
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it("renders import indisponible on an unusable 400 payload", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        errors: []
      })
    );

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(await screen.findByText("import indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it.each([
    { response: () => Promise.resolve(jsonResponse(401, {})), text: "authentification requise" },
    { response: () => Promise.resolve(jsonResponse(403, {})), text: "acces import refuse" },
    { response: () => Promise.resolve(jsonResponse(404, {})), text: "dossier introuvable" },
    { response: () => Promise.resolve(jsonResponse(409, {})), text: "dossier archive, import impossible" },
    { response: () => Promise.resolve(jsonResponse(500, {})), text: "erreur serveur import" },
    { response: () => Promise.reject(new Error("network")), text: "erreur reseau import" }
  ])("renders the exact import error state $text", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeReadyClosingRoute(fetchMock);
    fetchMock.mockImplementationOnce(response);

    renderClosingRoute();
    await waitForClosingRouteReady();

    await user.upload(getImportInput(), new File(["csv"], "balance.csv"));
    await user.click(getImportButton());

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });
});
