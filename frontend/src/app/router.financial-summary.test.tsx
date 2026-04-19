import { RouterProvider } from "react-router-dom";
import { render, screen } from "@testing-library/react";
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

const FINANCIAL_SUMMARY_NO_DATA = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "BLOCKED",
  statementState: "NO_DATA",
  latestImportVersion: null,
  coverage: {
    totalLines: 0,
    mappedLines: 0,
    unmappedLines: 0,
    mappedShare: "0"
  },
  blockers: [],
  nextAction: {
    code: "IMPORT_BALANCE",
    path: `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance`,
    actionable: true
  },
  unmappedBalanceImpact: {
    debitTotal: "0",
    creditTotal: "0",
    netDebitMinusCredit: "0"
  },
  balanceSheetSummary: null,
  incomeStatementSummary: null
};

const FINANCIAL_SUMMARY_PREVIEW_PARTIAL = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "BLOCKED",
  statementState: "PREVIEW_PARTIAL",
  latestImportVersion: 2,
  coverage: {
    totalLines: 3,
    mappedLines: 2,
    unmappedLines: 1,
    mappedShare: "0.6667"
  },
  blockers: [
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      message: "1 account(s) remain unmapped on the latest import."
    }
  ],
  nextAction: {
    code: "COMPLETE_MANUAL_MAPPING",
    path: `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
    actionable: true
  },
  unmappedBalanceImpact: {
    debitTotal: "75",
    creditTotal: "0",
    netDebitMinusCredit: "75"
  },
  balanceSheetSummary: {
    assets: "100",
    liabilities: "0",
    equity: "0",
    currentPeriodResult: "175",
    totalAssets: "100",
    totalLiabilitiesAndEquity: "175"
  },
  incomeStatementSummary: {
    revenue: "175",
    expenses: "0",
    netResult: "175"
  }
};

const FINANCIAL_SUMMARY_PREVIEW_READY = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "READY",
  statementState: "PREVIEW_READY",
  latestImportVersion: 2,
  coverage: {
    totalLines: 2,
    mappedLines: 2,
    unmappedLines: 0,
    mappedShare: "1"
  },
  blockers: [],
  nextAction: null,
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
    totalLiabilitiesAndEquity: "175"
  },
  incomeStatementSummary: {
    revenue: "175",
    expenses: "0",
    netResult: "175"
  }
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
    financialSummary = () => jsonResponse(200, FINANCIAL_SUMMARY_PREVIEW_PARTIAL)
  }: {
    controls?: ResponseFactory;
    manualMapping?: ResponseFactory;
    financialSummary?: ResponseFactory;
  } = {}
) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
    .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
    .mockImplementationOnce(() => Promise.resolve(controls()))
    .mockImplementationOnce(() => Promise.resolve(manualMapping()))
    .mockImplementationOnce(() => Promise.resolve(financialSummary()));
}

async function waitForNominalShell() {
  expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
  expect(await screen.findByText("Import balance")).toBeInTheDocument();
  expect(await screen.findByText("Mapping manuel")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Cockpit read-only" })).toBeInTheDocument();
  expect(await screen.findByText("Financial summary")).toBeInTheDocument();
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function expectNoForbiddenPaths(paths: string[]) {
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
  expect(paths.some((path) => path.includes("/financial-statements-structured"))).toBe(false);
  expect(paths.some((path) => path.includes("/workpapers"))).toBe(false);
  expect(paths.some((path) => path.includes("/documents"))).toBe(false);
  expect(paths.some((path) => path.includes("/exports"))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
}

function expectExistingBlocksVisible() {
  expect(screen.getByText("Dossier courant")).toBeInTheDocument();
  expect(screen.getByText("Import balance")).toBeInTheDocument();
  expect(screen.getByText("Mapping manuel")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Cockpit read-only" })).toBeInTheDocument();
  expect(screen.getByText("Financial summary")).toBeInTheDocument();
}

describe("router financial summary", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("places Financial summary after Controles, loads it only after /api/me and dossier, and keeps the request scope closed", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    const controlsHeading = screen.getByRole("heading", { name: "Cockpit read-only" });
    const financialSummaryHeading = screen.getByRole("heading", { name: "Preview read-only" });

    expect(
      Boolean(
        controlsHeading.compareDocumentPosition(financialSummaryHeading) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    const paths = getRequestPaths(fetchMock);
    expect(paths).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`
    ]);
    expect(paths.filter((path) => path.includes("/financial-summary"))).toHaveLength(1);
    expectNoForbiddenPaths(paths);
  });

  it("shows chargement financial summary while the request is pending and keeps the other blocks visible", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => new Promise(() => {})
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("chargement financial summary")).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(
      screen.queryByText(
        "Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO."
      )
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it.each([
    { response: () => jsonResponse(400, {}), text: "financial summary indisponible" },
    { response: () => jsonResponse(401, {}), text: "authentification requise" },
    { response: () => jsonResponse(403, {}), text: "acces financial summary refuse" },
    { response: () => jsonResponse(404, {}), text: "financial summary introuvable" },
    { response: () => jsonResponse(500, {}), text: "erreur serveur financial summary" },
    { response: () => Promise.reject(new Error("network")), text: "erreur reseau financial summary" },
    { response: () => Promise.reject(new Error("timeout")), text: "timeout financial summary" },
    { response: () => jsonResponse(418, {}), text: "financial summary indisponible" }
  ])("renders the exact financial summary error state '$text' and keeps the existing blocks visible", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByRole("heading", { name: "Etat preview" })).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO."
      )
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "closingFolderId incoherent",
      response: () =>
        jsonResponse(200, {
          ...FINANCIAL_SUMMARY_PREVIEW_PARTIAL,
          closingFolderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
        })
    },
    {
      label: "NO_DATA with summaries not null",
      response: () =>
        jsonResponse(200, {
          ...FINANCIAL_SUMMARY_NO_DATA,
          balanceSheetSummary: FINANCIAL_SUMMARY_PREVIEW_READY.balanceSheetSummary
        })
    },
    {
      label: "PREVIEW_READY with unmapped lines",
      response: () =>
        jsonResponse(200, {
          ...FINANCIAL_SUMMARY_PREVIEW_READY,
          coverage: {
            ...FINANCIAL_SUMMARY_PREVIEW_READY.coverage,
            unmappedLines: 1
          }
        })
    },
    {
      label: "missing coverage field",
      response: () =>
        jsonResponse(200, {
          ...FINANCIAL_SUMMARY_PREVIEW_PARTIAL,
          coverage: {
            totalLines: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.coverage.totalLines,
            mappedLines: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.coverage.mappedLines,
            unmappedLines: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.coverage.unmappedLines
          }
        })
    },
    {
      label: "missing balance sheet field",
      response: () =>
        jsonResponse(200, {
          ...FINANCIAL_SUMMARY_PREVIEW_PARTIAL,
          balanceSheetSummary: {
            liabilities: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.balanceSheetSummary.liabilities,
            equity: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.balanceSheetSummary.equity,
            currentPeriodResult:
              FINANCIAL_SUMMARY_PREVIEW_PARTIAL.balanceSheetSummary.currentPeriodResult,
            totalAssets: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.balanceSheetSummary.totalAssets,
            totalLiabilitiesAndEquity:
              FINANCIAL_SUMMARY_PREVIEW_PARTIAL.balanceSheetSummary.totalLiabilitiesAndEquity
          }
        })
    },
    {
      label: "body 200 non JSON",
      response: () => textResponse(200, "not-json", "application/json")
    }
  ])("renders payload financial summary invalide for $label", async ({ response }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("payload financial summary invalide")).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByRole("heading", { name: "Etat preview" })).not.toBeInTheDocument();
  });

  it("renders the exact NO_DATA preview state and the non-statutory reminder", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => jsonResponse(200, FINANCIAL_SUMMARY_NO_DATA)
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(
      await screen.findByText(
        "Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("etat preview : aucune donnee")).toBeInTheDocument();
    expect(screen.getByText("version d import : aucune")).toBeInTheDocument();
    expect(screen.getByText("lignes total : 0")).toBeInTheDocument();
    expect(screen.getByText("lignes mappees : 0")).toBeInTheDocument();
    expect(screen.getByText("lignes non mappees : 0")).toBeInTheDocument();
    expect(screen.getByText("part mappee : 0")).toBeInTheDocument();
    expect(screen.getByText("impact non mappe debit : 0")).toBeInTheDocument();
    expect(screen.getByText("impact non mappe credit : 0")).toBeInTheDocument();
    expect(screen.getByText("impact non mappe net : 0")).toBeInTheDocument();
    expect(screen.getByText("aucune preview financiere disponible")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Bilan synthetique" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Compte de resultat synthetique" })
    ).not.toBeInTheDocument();
  });

  it("renders the exact PREVIEW_PARTIAL preview state and never renders nextAction.path", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => jsonResponse(200, FINANCIAL_SUMMARY_PREVIEW_PARTIAL)
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(
      await screen.findByText(
        "Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("etat preview : preview partielle")).toBeInTheDocument();
    expect(screen.getByText("version d import : 2")).toBeInTheDocument();
    expect(screen.getByText("lignes total : 3")).toBeInTheDocument();
    expect(screen.getByText("lignes mappees : 2")).toBeInTheDocument();
    expect(screen.getByText("lignes non mappees : 1")).toBeInTheDocument();
    expect(screen.getByText("part mappee : 0.6667")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bilan synthetique" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Compte de resultat synthetique" })
    ).toBeInTheDocument();
    expect(screen.getByText("actifs : 100")).toBeInTheDocument();
    expect(screen.getByText("passifs : 0")).toBeInTheDocument();
    expect(screen.getByText("capitaux propres : 0")).toBeInTheDocument();
    expect(screen.getByText("resultat de la periode : 175")).toBeInTheDocument();
    expect(screen.getByText("total actifs : 100")).toBeInTheDocument();
    expect(screen.getByText("total passifs et capitaux propres : 175")).toBeInTheDocument();
    expect(screen.getByText("produits : 175")).toBeInTheDocument();
    expect(screen.getByText("charges : 0")).toBeInTheDocument();
    expect(screen.getByText("resultat net : 175")).toBeInTheDocument();
    expect(
      screen.queryByText(FINANCIAL_SUMMARY_PREVIEW_PARTIAL.nextAction.path)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.nextAction.path })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: FINANCIAL_SUMMARY_PREVIEW_PARTIAL.nextAction.path })
    ).not.toBeInTheDocument();
  });

  it("renders the exact PREVIEW_READY preview state and the non-statutory reminder", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => jsonResponse(200, FINANCIAL_SUMMARY_PREVIEW_READY)
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(
      await screen.findByText(
        "Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou document CO."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("etat preview : preview prete")).toBeInTheDocument();
    expect(screen.getByText("version d import : 2")).toBeInTheDocument();
    expect(screen.getByText("lignes total : 2")).toBeInTheDocument();
    expect(screen.getByText("lignes mappees : 2")).toBeInTheDocument();
    expect(screen.getByText("lignes non mappees : 0")).toBeInTheDocument();
    expect(screen.getByText("part mappee : 1")).toBeInTheDocument();
    expect(screen.getByText("impact non mappe debit : 0")).toBeInTheDocument();
    expect(screen.getByText("impact non mappe credit : 0")).toBeInTheDocument();
    expect(screen.getByText("impact non mappe net : 0")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bilan synthetique" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Compte de resultat synthetique" })
    ).toBeInTheDocument();
  });
});
