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

const FINANCIAL_STATEMENTS_STRUCTURED_BLOCKED = {
  closingFolderId: CLOSING_FOLDER.id,
  statementState: "BLOCKED",
  presentationType: "STRUCTURED_PREVIEW",
  isStatutory: false,
  latestImportVersion: 2,
  coverage: {
    totalLines: 2,
    mappedLines: 1,
    unmappedLines: 1,
    mappedShare: "0.5"
  },
  balanceSheet: null,
  incomeStatement: null
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
    title: "Previsualisation non statutaire.",
    notOfficialCoAnnex: "Pas un livrable statutaire final.",
    noAutomaticValidation: "Aucune decision automatique.",
    humanReviewRequired: "requise."
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

const DEFAULT_IMPORT_VERSIONS = [
  {
    closingFolderId: CLOSING_FOLDER.id,
    version: 2,
    importedAt: "2026-05-13T09:00:00Z",
    rowCount: 2,
    totalDebit: "100",
    totalCredit: "100"
  },
  {
    closingFolderId: CLOSING_FOLDER.id,
    version: 1,
    importedAt: "2026-05-12T09:00:00Z",
    rowCount: 1,
    totalDebit: "50",
    totalCredit: "50"
  }
];

const DEFAULT_IMPORT_DIFF = {
  version: 2,
  previousVersion: 1,
  added: [],
  removed: [],
  changed: []
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
    financialSummary = () => jsonResponse(200, FINANCIAL_SUMMARY_PREVIEW_PARTIAL),
    financialStatementsStructured = () =>
      jsonResponse(200, FINANCIAL_STATEMENTS_STRUCTURED_BLOCKED),
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
    .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_VERSIONS))
    .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_DIFF))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
    .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX));
}

async function waitForNominalShell() {
  expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
  expect(await screen.findByText("Import balance")).toBeInTheDocument();
  expect(await screen.findByText("Mapping manuel")).toBeInTheDocument();
  expect(await screen.findByText("Etat de preparation")).toBeInTheDocument();
  expect(await screen.findByText("Synthese financiere")).toBeInTheDocument();
  expect(await screen.findByText("Etats financiers structures")).toBeInTheDocument();
  expect(await screen.findByText("Justifications / Preuves")).toBeInTheDocument();
  expect(await screen.findByText("Suggestions de mapping a revoir")).toBeInTheDocument();
  expect(await screen.findByText("Pack export auditable")).toBeInTheDocument();
  expect(await screen.findByText("Annexe minimale")).toBeInTheDocument();

  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: "Previsualisations" }));
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function expectNoForbiddenPaths(paths: string[]) {
  expect(paths.filter((path) => path.includes("/imports/balance/versions"))).toHaveLength(2);
  expect(paths.filter((path) => path.includes("/diff-previous"))).toHaveLength(1);
  expect(paths.filter((path) => path.includes("/financial-statements/structured"))).toHaveLength(1);
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
  expect(screen.getByText("Etat de preparation")).toBeInTheDocument();
  expect(screen.getByText("Synthese financiere")).toBeInTheDocument();
  expect(screen.getByText("Etats financiers structures")).toBeInTheDocument();
  expect(screen.getByText("Justifications / Preuves")).toBeInTheDocument();
}

describe("router financial summary", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("places Synthese financiere after Controles, loads it only after /api/me and dossier, and keeps the request scope closed", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    const controlsHeading = screen.getByRole("heading", {
      hidden: true,
      name: "Etat de preparation"
    });
    const financialSummaryLabel = screen.getByText("Synthese financiere");

    expect(
      Boolean(
        controlsHeading.compareDocumentPosition(financialSummaryLabel) &
          Node.DOCUMENT_POSITION_FOLLOWING
      )
    ).toBe(true);

    const paths = getRequestPaths(fetchMock);
    expect(paths).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`
    ]);
    expect(paths.filter((path) => path.includes("/financial-summary"))).toHaveLength(1);
    expectNoForbiddenPaths(paths);
  });

  it("shows chargement synthese financiere while the request is pending and keeps the other blocks visible", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => new Promise(() => {})
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("chargement synthese financiere")).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(
      screen.queryByText(
        "Previsualisation non statutaire. Pas un livrable statutaire final. Ne pas utiliser pour un depot officiel."
      )
    ).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it.each([
    { response: () => jsonResponse(400, {}), text: "synthese financiere indisponible" },
    { response: () => jsonResponse(401, {}), text: "authentification requise" },
    { response: () => jsonResponse(403, {}), text: "acces synthese financiere refuse" },
    { response: () => jsonResponse(404, {}), text: "synthese financiere introuvable" },
    { response: () => jsonResponse(500, {}), text: "erreur serveur synthese financiere" },
    { response: () => Promise.reject(new Error("network")), text: "erreur reseau synthese financiere" },
    { response: () => Promise.reject(new Error("timeout")), text: "timeout synthese financiere" },
    { response: () => jsonResponse(418, {}), text: "synthese financiere indisponible" }
  ])("renders the exact synthese financiere error state '$text' and keeps the existing blocks visible", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByRole("heading", { name: "Etat de la previsualisation" })).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Previsualisation non statutaire. Pas un livrable statutaire final. Ne pas utiliser pour un depot officiel."
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
  ])("renders payload synthese financiere invalide for $label", async ({ response }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("payload synthese financiere invalide")).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByRole("heading", { name: "Etat de la previsualisation" })).not.toBeInTheDocument();
  });

  it("renders the NO_DATA preview as a business-readable financial summary with the non-statutory posture", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => jsonResponse(200, FINANCIAL_SUMMARY_NO_DATA)
    });

    renderClosingRoute();
    await waitForNominalShell();
    const financialSummarySection = screen.getByText("Synthese financiere").closest("section");
    expect(financialSummarySection).not.toBeNull();
    const summary = within(financialSummarySection as HTMLElement);

    expect(
      await summary.findByText("Previsualisation non statutaire")
    ).toBeInTheDocument();
    expect(summary.getByText("Lecture seule. Revue humaine obligatoire avant usage engageant.")).toBeInTheDocument();
    expect(summary.getByText("Pas un livrable statutaire final. Ne pas utiliser comme depot officiel.")).toBeInTheDocument();
    expect(summary.getByText("Etat de revue")).toBeInTheDocument();
    expect(summary.getByText("aucune donnee")).toBeInTheDocument();
    expect(summary.getByText("Aucune synthese financiere exploitable pour le moment.")).toBeInTheDocument();
    expect(summary.getByText("Aucune version disponible")).toBeInTheDocument();
    expect(summary.getByText("Lignes total")).toBeInTheDocument();
    expect(summary.getByText("Lignes a mapper")).toBeInTheDocument();
    expect(summary.getByText("Impact non mappe net")).toBeInTheDocument();
    expect(summary.getByText("Aucune previsualisation financiere disponible.")).toBeInTheDocument();
    expect(summary.queryByRole("heading", { name: "Bilan synthetique" })).not.toBeInTheDocument();
    expect(
      summary.queryByRole("heading", { name: "Compte de resultat synthetique" })
    ).not.toBeInTheDocument();
  });

  it("renders the PREVIEW_PARTIAL preview as scan-ready rows and never renders nextAction.path", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => jsonResponse(200, FINANCIAL_SUMMARY_PREVIEW_PARTIAL)
    });

    renderClosingRoute();
    await waitForNominalShell();
    const financialSummarySection = screen.getByText("Synthese financiere").closest("section");
    expect(financialSummarySection).not.toBeNull();
    const summary = within(financialSummarySection as HTMLElement);

    expect(
      await summary.findByText("Previsualisation non statutaire")
    ).toBeInTheDocument();
    expect(summary.getByText("Revue humaine obligatoire avant usage engageant.", { exact: false })).toBeInTheDocument();
    expect(summary.getByText("Etat de revue")).toBeInTheDocument();
    expect(summary.getByText("previsualisation partielle")).toBeInTheDocument();
    expect(summary.getByText("Contenu partiel : les montants disponibles restent a revoir avant toute decision.")).toBeInTheDocument();
    expect(summary.getByText("Version 2")).toBeInTheDocument();
    expect(summary.getByText("Lignes total")).toBeInTheDocument();
    expect(summary.getByText("Lignes mappees")).toBeInTheDocument();
    expect(summary.getByText("Lignes a mapper")).toBeInTheDocument();
    expect(summary.getByText("Part mappee")).toBeInTheDocument();
    expect(summary.getByText("66.7 %")).toBeInTheDocument();
    expect(summary.getByRole("heading", { name: "Bilan synthetique" })).toBeInTheDocument();
    expect(
      summary.getByRole("heading", { name: "Compte de resultat synthetique" })
    ).toBeInTheDocument();
    expect(summary.getByText("Actifs")).toBeInTheDocument();
    expect(summary.getByText("Passifs")).toBeInTheDocument();
    expect(summary.getByText("Capitaux propres")).toBeInTheDocument();
    expect(summary.getByText("Resultat de la periode")).toBeInTheDocument();
    expect(summary.getByText("Total passifs et capitaux propres")).toBeInTheDocument();
    expect(summary.getByText("Produits")).toBeInTheDocument();
    expect(summary.getByText("Charges")).toBeInTheDocument();
    expect(summary.getByText("Resultat net")).toBeInTheDocument();
    expect(summary.getAllByText("CHF 175.00").length).toBeGreaterThanOrEqual(3);
    expect(summary.getAllByText("CHF 100.00").length).toBeGreaterThanOrEqual(2);
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

  it("renders the PREVIEW_READY preview state and the required non-statutory reminder", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      financialSummary: () => jsonResponse(200, FINANCIAL_SUMMARY_PREVIEW_READY)
    });

    renderClosingRoute();
    await waitForNominalShell();
    const financialSummarySection = screen.getByText("Synthese financiere").closest("section");
    expect(financialSummarySection).not.toBeNull();
    const summary = within(financialSummarySection as HTMLElement);

    expect(
      await summary.findByText("Previsualisation non statutaire")
    ).toBeInTheDocument();
    expect(summary.getByText("Previsualisation non statutaire")).toBeInTheDocument();
    expect(summary.getByText("previsualisation prete")).toBeInTheDocument();
    expect(summary.getByText("Synthese financiere disponible pour revue humaine.")).toBeInTheDocument();
    expect(summary.getByText("Version 2")).toBeInTheDocument();
    expect(summary.getByText("Lignes total")).toBeInTheDocument();
    expect(summary.getByText("Lignes mappees")).toBeInTheDocument();
    expect(summary.getByText("Lignes a mapper")).toBeInTheDocument();
    expect(summary.getByText("Impact non mappe debit")).toBeInTheDocument();
    expect(summary.getByText("Impact non mappe credit")).toBeInTheDocument();
    expect(summary.getByText("Impact non mappe net")).toBeInTheDocument();
    expect(summary.getAllByText("CHF 0.00").length).toBeGreaterThanOrEqual(5);
    expect(summary.getAllByText("CHF 175.00").length).toBeGreaterThanOrEqual(3);
    expect(summary.getByRole("heading", { name: "Bilan synthetique" })).toBeInTheDocument();
    expect(
      summary.getByRole("heading", { name: "Compte de resultat synthetique" })
    ).toBeInTheDocument();
  });
});
