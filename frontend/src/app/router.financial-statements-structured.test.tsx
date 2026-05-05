import { RouterProvider } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
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

const READY_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
  readiness: "READY",
  latestImportPresent: true,
  latestImportVersion: 2,
  mappingSummary: {
    total: 2,
    mapped: 2,
    unmapped: 0
  },
  controls: [
    {
      code: "LATEST_VALID_BALANCE_IMPORT_PRESENT",
      status: "PASS",
      message: "Latest valid balance import version 2 is available."
    },
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      status: "PASS",
      message: "Manual mapping is complete on the latest import."
    }
  ],
  nextAction: null,
  unmappedAccounts: []
};

const READY_MANUAL_MAPPING = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 2,
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
      credit: "175"
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
};

const READY_FINANCIAL_SUMMARY = {
  closingFolderId: CLOSING_FOLDER.id,
  statementState: "PREVIEW_READY",
  latestImportVersion: 2,
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
    currentPeriodResult: "175",
    totalAssets: "100",
    totalLiabilitiesAndEquity: "100"
  },
  incomeStatementSummary: {
    revenue: "175",
    expenses: "0",
    netResult: "175"
  }
};

const STRUCTURED_NO_DATA = {
  closingFolderId: CLOSING_FOLDER.id,
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
};

const STRUCTURED_BLOCKED = {
  closingFolderId: CLOSING_FOLDER.id,
  statementState: "BLOCKED",
  presentationType: "STRUCTURED_PREVIEW",
  isStatutory: false,
  taxonomyVersion: 2,
  nextAction: {
    code: "COMPLETE_MANUAL_MAPPING",
    path: `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
    actionable: true
  },
  latestImportVersion: 2,
  coverage: {
    totalLines: 3,
    mappedLines: 2,
    unmappedLines: 1,
    mappedShare: "0.6667"
  },
  balanceSheet: null,
  incomeStatement: null
};

const STRUCTURED_PREVIEW_READY = {
  closingFolderId: CLOSING_FOLDER.id,
  statementState: "PREVIEW_READY",
  presentationType: "STRUCTURED_PREVIEW",
  isStatutory: false,
  latestImportVersion: 2,
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
        total: "10",
        breakdowns: []
      },
      {
        code: "BS.LIABILITY",
        label: "Passifs",
        total: "10",
        breakdowns: [
          {
            code: "BS.LIABILITY.CURRENT",
            label: "Passifs courants",
            breakdownType: "SECTION",
            total: "10"
          }
        ]
      },
      {
        code: "BS.EQUITY",
        label: "Capitaux propres",
        total: "0",
        breakdowns: [
          {
            code: "BS.EQUITY.CORE",
            label: "Capitaux propres de base",
            breakdownType: "SECTION",
            total: "0"
          }
        ]
      }
    ],
    totals: {
      totalAssets: "10",
      totalLiabilities: "10",
      totalEquity: "0",
      currentPeriodResult: "0",
      totalLiabilitiesAndEquity: "10"
    }
  },
  incomeStatement: {
    groups: [
      {
        code: "PL.REVENUE",
        label: "Produits",
        total: "0",
        breakdowns: [
          {
            code: "PL.REVENUE.OPERATING",
            label: "Produits d exploitation",
            breakdownType: "SECTION",
            total: "0"
          },
          {
            code: "PL.REVENUE.OTHER",
            label: "Autres produits",
            breakdownType: "SECTION",
            total: "0"
          }
        ]
      },
      {
        code: "PL.EXPENSE",
        label: "Charges",
        total: "0",
        breakdowns: []
      }
    ],
    totals: {
      totalRevenue: "0",
      totalExpenses: "0",
      netResult: "0"
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

const CLOSING_ROUTE = `/closing-folders/${CLOSING_FOLDER.id}`;

type ResponseFactory = () => Response | Promise<Response>;

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function textResponse(status: number, body: string, contentType = "text/plain") {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": contentType
    }
  });
}

function renderClosingRoute() {
  const router = createAppMemoryRouter([CLOSING_ROUTE]);
  return render(<RouterProvider router={router} />);
}

function primeNominalRoute(
  fetchMock: ReturnType<typeof vi.fn>,
  {
    controls = () => jsonResponse(200, READY_CONTROLS),
    manualMapping = () => jsonResponse(200, READY_MANUAL_MAPPING),
    financialSummary = () => jsonResponse(200, READY_FINANCIAL_SUMMARY),
    financialStatementsStructured = () => jsonResponse(200, STRUCTURED_BLOCKED),
    workpapers = () => jsonResponse(200, INITIAL_WORKPAPERS)
  }: {
    controls?: ResponseFactory;
    manualMapping?: ResponseFactory;
    financialSummary?: ResponseFactory;
    financialStatementsStructured?: ResponseFactory;
    workpapers?: ResponseFactory;
  } = {}
) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
    .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
    .mockImplementationOnce(() => Promise.resolve(controls()))
    .mockImplementationOnce(() => Promise.resolve(manualMapping()))
    .mockImplementationOnce(() => Promise.resolve(financialSummary()))
    .mockImplementationOnce(() => Promise.resolve(financialStatementsStructured()))
    .mockImplementationOnce(() => Promise.resolve(workpapers()))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
    .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX));
}

async function waitForNominalShell() {
  expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
  expect(await screen.findByText("Import balance")).toBeInTheDocument();
  expect(await screen.findByText("Mapping manuel")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Cockpit read-only" })).toBeInTheDocument();
  expect(await screen.findByText("Financial summary")).toBeInTheDocument();
  expect(await screen.findByText("Financial statements structured")).toBeInTheDocument();
  expect(await screen.findByText("Workpapers")).toBeInTheDocument();
  expect(await screen.findByText("Audit-ready export pack")).toBeInTheDocument();
  expect(await screen.findByText("No audit-ready pack generated yet.")).toBeInTheDocument();
  expect(await screen.findByText("Minimal annex preview")).toBeInTheDocument();
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function expectNoForbiddenPaths(paths: string[]) {
  expect(paths.filter((path) => path.includes("/financial-statements/structured"))).toHaveLength(1);
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
  expect(paths.some((path) => path.includes("/financial-statements-structured"))).toBe(false);
  expect(paths.filter((path) => path.includes("/workpapers"))).toHaveLength(1);
  expect(paths.some((path) => /\/workpapers\/[^/]+/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/documents"))).toBe(false);
  expect(paths.some((path) => /\/export-packs\/[^/]+\/content$/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
}

function expectExistingBlocksVisible() {
  expect(screen.getByText("Dossier courant")).toBeInTheDocument();
  expect(screen.getByText("Import balance")).toBeInTheDocument();
  expect(screen.getByText("Mapping manuel")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cockpit read-only" })).toBeInTheDocument();
  expect(screen.getByText("Financial summary")).toBeInTheDocument();
  expect(screen.getByText("Financial statements structured")).toBeInTheDocument();
  expect(screen.getByText("Workpapers")).toBeInTheDocument();
}

function getFinancialStatementsStructuredSection() {
  const section = screen.getByText("Financial statements structured").closest("section");
  expect(section).not.toBeNull();
  return within(section as HTMLElement);
}

function expectNodeBefore(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

describe("router financial statements structured", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("places Financial statements structured after Financial summary, loads the exact path once after /api/me and dossier, and keeps the request scope closed", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    const financialSummaryLabel = screen.getByText("Financial summary");
    const financialStatementsStructuredLabel = screen.getByText(
      "Financial statements structured"
    );

    expectNodeBefore(financialSummaryLabel, financialStatementsStructuredLabel);

    const paths = getRequestPaths(fetchMock);
    expect(paths).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`
    ]);
    expectNoForbiddenPaths(paths);
  });

  it("shows chargement structured preview while the request is pending and keeps the other blocks visible", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialStatementsStructured: () => new Promise(() => {})
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("chargement structured preview")).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(
      screen.queryByText(
        "Preview structuree non statutaire. Not a final CO deliverable. Do not use as statutory filing."
      )
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(9);
  });

  it.each([
    { response: () => jsonResponse(400, {}), text: "financial statements structured indisponible" },
    { response: () => jsonResponse(401, {}), text: "authentification requise" },
    { response: () => jsonResponse(403, {}), text: "acces financial statements structured refuse" },
    { response: () => jsonResponse(404, {}), text: "financial statements structured introuvable" },
    { response: () => jsonResponse(500, {}), text: "erreur serveur financial statements structured" },
    { response: () => Promise.reject(new Error("network")), text: "erreur reseau financial statements structured" },
    { response: () => Promise.reject(new Error("timeout")), text: "timeout financial statements structured" },
    { response: () => jsonResponse(418, {}), text: "financial statements structured indisponible" }
  ])("renders the exact structured preview error state '$text' and keeps the existing blocks visible", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialStatementsStructured: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByRole("heading", { name: "Etat structured preview" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bilan structure" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Compte de resultat structure" })).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Preview structuree non statutaire. Not a final CO deliverable. Do not use as statutory filing."
      )
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "closingFolderId incoherent",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_BLOCKED,
          closingFolderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        })
    },
    {
      label: "presentationType invalide",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_BLOCKED,
          presentationType: "OTHER"
        })
    },
    {
      label: "isStatutory invalide",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_BLOCKED,
          isStatutory: true
        })
    },
    {
      label: "NO_DATA avec balanceSheet non null",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_NO_DATA,
          balanceSheet: STRUCTURED_PREVIEW_READY.balanceSheet
        })
    },
    {
      label: "BLOCKED avec latestImportVersion null",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_BLOCKED,
          latestImportVersion: null
        })
    },
    {
      label: "PREVIEW_READY avec balanceSheet null",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          balanceSheet: null
        })
    },
    {
      label: "PREVIEW_READY avec incomeStatement null",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          incomeStatement: null
        })
    },
    {
      label: "PREVIEW_READY avec unmappedLines non nul",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          coverage: {
            ...STRUCTURED_PREVIEW_READY.coverage,
            unmappedLines: 1
          }
        })
    },
    {
      label: "ordre bilan incoherent",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          balanceSheet: {
            ...STRUCTURED_PREVIEW_READY.balanceSheet,
            groups: [
              STRUCTURED_PREVIEW_READY.balanceSheet.groups[1],
              STRUCTURED_PREVIEW_READY.balanceSheet.groups[0],
              STRUCTURED_PREVIEW_READY.balanceSheet.groups[2]
            ]
          }
        })
    },
    {
      label: "ordre compte de resultat incoherent",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          incomeStatement: {
            ...STRUCTURED_PREVIEW_READY.incomeStatement,
            groups: [
              STRUCTURED_PREVIEW_READY.incomeStatement.groups[1],
              STRUCTURED_PREVIEW_READY.incomeStatement.groups[0]
            ]
          }
        })
    },
    {
      label: "champ coverage manquant",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_BLOCKED,
          coverage: {
            totalLines: STRUCTURED_BLOCKED.coverage.totalLines,
            mappedLines: STRUCTURED_BLOCKED.coverage.mappedLines,
            unmappedLines: STRUCTURED_BLOCKED.coverage.unmappedLines
          }
        })
    },
    {
      label: "champ balanceSheet.totals manquant",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          balanceSheet: {
            ...STRUCTURED_PREVIEW_READY.balanceSheet,
            totals: {
              totalAssets: STRUCTURED_PREVIEW_READY.balanceSheet.totals.totalAssets,
              totalLiabilities: STRUCTURED_PREVIEW_READY.balanceSheet.totals.totalLiabilities,
              totalEquity: STRUCTURED_PREVIEW_READY.balanceSheet.totals.totalEquity,
              currentPeriodResult:
                STRUCTURED_PREVIEW_READY.balanceSheet.totals.currentPeriodResult
            }
          }
        })
    },
    {
      label: "champ incomeStatement.totals manquant",
      response: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          incomeStatement: {
            ...STRUCTURED_PREVIEW_READY.incomeStatement,
            totals: {
              totalRevenue: STRUCTURED_PREVIEW_READY.incomeStatement.totals.totalRevenue,
              totalExpenses: STRUCTURED_PREVIEW_READY.incomeStatement.totals.totalExpenses
            }
          }
        })
    },
    {
      label: "body 200 non JSON",
      response: () => textResponse(200, "not-json", "application/json")
    }
  ])("renders payload financial statements structured invalide for $label", async ({ response }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialStatementsStructured: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(
      await screen.findByText("payload financial statements structured invalide")
    ).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByRole("heading", { name: "Etat structured preview" })).not.toBeInTheDocument();
  });

  it("renders the exact NO_DATA structured preview state and the non-statutory reminder", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialStatementsStructured: () => jsonResponse(200, STRUCTURED_NO_DATA)
    });

    renderClosingRoute();
    await waitForNominalShell();
    const structured = getFinancialStatementsStructuredSection();

    expect(
      await structured.findByText(
        "Preview structuree non statutaire. Not a final CO deliverable. Do not use as statutory filing."
      )
    ).toBeInTheDocument();
    expect(structured.getByText("etat structured preview : aucune donnee")).toBeInTheDocument();
    expect(structured.getByText("version d import : aucune")).toBeInTheDocument();
    expect(structured.getByText("lignes total : 0")).toBeInTheDocument();
    expect(structured.getByText("lignes mappees : 0")).toBeInTheDocument();
    expect(structured.getByText("lignes non mappees : 0")).toBeInTheDocument();
    expect(structured.getByText("part mappee : 0")).toBeInTheDocument();
    expect(structured.getByText("aucune preview structuree disponible")).toBeInTheDocument();
    expect(structured.queryByRole("heading", { name: "Bilan structure" })).not.toBeInTheDocument();
    expect(
      structured.queryByRole("heading", { name: "Compte de resultat structure" })
    ).not.toBeInTheDocument();
  });

  it("renders the exact BLOCKED structured preview state and never renders nextAction.path as text, link or button", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialStatementsStructured: () => jsonResponse(200, STRUCTURED_BLOCKED)
    });

    renderClosingRoute();
    await waitForNominalShell();
    const structured = getFinancialStatementsStructuredSection();

    expect(
      await structured.findByText(
        "Preview structuree non statutaire. Not a final CO deliverable. Do not use as statutory filing."
      )
    ).toBeInTheDocument();
    expect(structured.getByText("etat structured preview : bloquee")).toBeInTheDocument();
    expect(structured.getByText("version d import : 2")).toBeInTheDocument();
    expect(structured.getByText("lignes total : 3")).toBeInTheDocument();
    expect(structured.getByText("lignes mappees : 2")).toBeInTheDocument();
    expect(structured.getByText("lignes non mappees : 1")).toBeInTheDocument();
    expect(structured.getByText("part mappee : 0.6667")).toBeInTheDocument();
    expect(structured.getByText("preview structuree bloquee")).toBeInTheDocument();
    expect(structured.queryByText(STRUCTURED_BLOCKED.nextAction.path)).not.toBeInTheDocument();
    expect(
      structured.queryByRole("link", { name: STRUCTURED_BLOCKED.nextAction.path })
    ).not.toBeInTheDocument();
    expect(
      structured.queryByRole("button", { name: STRUCTURED_BLOCKED.nextAction.path })
    ).not.toBeInTheDocument();
    expect(structured.queryByRole("heading", { name: "Bilan structure" })).not.toBeInTheDocument();
    expect(
      structured.queryByRole("heading", { name: "Compte de resultat structure" })
    ).not.toBeInTheDocument();
  });

  it("renders the exact PREVIEW_READY structured preview state, preserves backend order, keeps empty breakdown groups visible, and shows zero values", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialStatementsStructured: () => jsonResponse(200, STRUCTURED_PREVIEW_READY)
    });

    renderClosingRoute();
    await waitForNominalShell();
    const structured = getFinancialStatementsStructuredSection();

    expect(
      await structured.findByText(
        "Preview structuree non statutaire. Not a final CO deliverable. Do not use as statutory filing."
      )
    ).toBeInTheDocument();
    expect(structured.getByText("etat structured preview : preview prete")).toBeInTheDocument();
    expect(structured.getByText("version d import : 2")).toBeInTheDocument();
    expect(structured.getByText("lignes total : 2")).toBeInTheDocument();
    expect(structured.getByText("lignes mappees : 2")).toBeInTheDocument();
    expect(structured.getByText("lignes non mappees : 0")).toBeInTheDocument();
    expect(structured.getByText("part mappee : 1")).toBeInTheDocument();

    const bilanHeading = structured.getByRole("heading", { name: "Bilan structure" });
    const assetLabel = structured.getByText("Actifs");
    const liabilityLabel = structured.getByText("Passifs");
    const equityLabel = structured.getByText("Capitaux propres");
    expectNodeBefore(assetLabel, liabilityLabel);
    expectNodeBefore(liabilityLabel, equityLabel);

    const revenueLabel = structured.getByText("Produits");
    const expenseLabel = structured.getByText("Charges");
    expectNodeBefore(revenueLabel, expenseLabel);
    expectNodeBefore(
      structured.getByText("Produits d exploitation : 0"),
      structured.getByText("Autres produits : 0")
    );

    expect(bilanHeading).toBeInTheDocument();
    expect(
      structured.getByRole("heading", { name: "Compte de resultat structure" })
    ).toBeInTheDocument();
    expect(structured.getAllByText("total groupe : 10")).toHaveLength(2);
    expect(structured.getAllByText("total groupe : 0")).toHaveLength(3);
    expect(structured.getByText("Capitaux propres de base : 0")).toBeInTheDocument();
    expect(structured.getByText("Passifs courants : 10")).toBeInTheDocument();
    expect(structured.getByText("Produits d exploitation : 0")).toBeInTheDocument();
    expect(structured.getByText("Autres produits : 0")).toBeInTheDocument();
    expect(structured.getByText("total actifs : 10")).toBeInTheDocument();
    expect(structured.getByText("total passifs : 10")).toBeInTheDocument();
    expect(structured.getByText("total capitaux propres : 0")).toBeInTheDocument();
    expect(structured.getByText("resultat de la periode : 0")).toBeInTheDocument();
    expect(structured.getByText("total passifs et capitaux propres : 10")).toBeInTheDocument();
    expect(structured.getByText("total produits : 0")).toBeInTheDocument();
    expect(structured.getByText("total charges : 0")).toBeInTheDocument();
    expect(structured.getByText("resultat net : 0")).toBeInTheDocument();
  });

  it("ignores malformed taxonomyVersion and nextAction.path when the consumed subset remains valid", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialStatementsStructured: () =>
        jsonResponse(200, {
          ...STRUCTURED_PREVIEW_READY,
          taxonomyVersion: "malforme",
          nextAction: {
            code: "COMPLETE_MANUAL_MAPPING",
            path: 42,
            actionable: "oui"
          }
        })
    });

    renderClosingRoute();
    await waitForNominalShell();
    const structured = getFinancialStatementsStructuredSection();

    expect(await structured.findByText("etat structured preview : preview prete")).toBeInTheDocument();
    expect(structured.getByText("Bilan structure")).toBeInTheDocument();
    expect(structured.queryByText("42")).not.toBeInTheDocument();
    expect(structured.queryByRole("link", { name: "42" })).not.toBeInTheDocument();
    expect(structured.queryByRole("button", { name: "42" })).not.toBeInTheDocument();
  });
});
