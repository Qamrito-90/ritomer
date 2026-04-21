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
      credit: "175"
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

const READY_MANUAL_MAPPING_AFTER_PUT = {
  ...READY_MANUAL_MAPPING,
  summary: {
    total: 2,
    mapped: 2,
    unmapped: 0
  },
  mappings: [
    {
      accountCode: "1000",
      targetCode: "BS.ASSET"
    },
    {
      accountCode: "2000",
      targetCode: "PL.REVENUE"
    }
  ]
};

const READY_MANUAL_MAPPING_AFTER_DELETE = {
  ...READY_MANUAL_MAPPING,
  summary: {
    total: 2,
    mapped: 0,
    unmapped: 2
  },
  mappings: []
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

const READY_FINANCIAL_STATEMENTS_STRUCTURED = {
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
      currentPeriodResult: "175",
      totalLiabilitiesAndEquity: "100"
    }
  },
  incomeStatement: {
    groups: [
      {
        code: "PL.REVENUE",
        label: "Produits",
        total: "175",
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
      totalRevenue: "175",
      totalExpenses: "0",
      netResult: "175"
    }
  }
};

const EMPTY_WORKPAPERS = {
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

const WORKPAPERS_WITH_DATA = {
  closingFolderId: CLOSING_FOLDER.id,
  summaryCounts: {
    totalCurrentAnchors: 2,
    withWorkpaperCount: 1,
    readyForReviewCount: 1,
    reviewedCount: 0,
    staleCount: 1,
    missingCount: 1
  },
  items: [
    {
      anchorCode: "PL.REVENUE.CURRENT_SECTION",
      anchorLabel: "Revenue",
      statementKind: "INCOME_STATEMENT",
      breakdownType: "LEGACY_BUCKET_FALLBACK",
      isCurrentStructure: true,
      workpaper: null,
      documents: [],
      documentVerificationSummary: null
    },
    {
      anchorCode: "BS.ASSET.CURRENT_SECTION",
      anchorLabel: "Current assets",
      statementKind: "BALANCE_SHEET",
      breakdownType: "SECTION",
      isCurrentStructure: true,
      workpaper: {
        status: "READY_FOR_REVIEW",
        noteText: "Cash tie-out"
      },
      documents: [
        {
          fileName: "z-last.pdf",
          mediaType: "application/pdf",
          sourceLabel: "ERP",
          verificationStatus: "VERIFIED"
        },
        {
          fileName: "a-first.csv",
          mediaType: "text/csv",
          sourceLabel: "Bank portal",
          verificationStatus: "REJECTED"
        }
      ],
      documentVerificationSummary: {
        documentsCount: 2,
        unverifiedCount: 0,
        verifiedCount: 1,
        rejectedCount: 1
      }
    }
  ],
  staleWorkpapers: [
    {
      anchorCode: "BS.ASSET.LEGACY_BUCKET_FALLBACK",
      anchorLabel: "Legacy bucket",
      statementKind: "BALANCE_SHEET",
      breakdownType: "LEGACY_BUCKET_FALLBACK",
      isCurrentStructure: false,
      workpaper: {
        status: "REVIEWED",
        noteText: "Legacy support"
      },
      documents: [
        {
          fileName: "legacy.xlsx",
          mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          sourceLabel: "Archive",
          verificationStatus: "VERIFIED"
        }
      ],
      documentVerificationSummary: {
        documentsCount: 1,
        unverifiedCount: 0,
        verifiedCount: 1,
        rejectedCount: 0
      }
    }
  ],
  nextAction: {
    code: "IGNORED",
    path: "/should-never-render",
    actionable: true
  }
};

const CLOSING_ROUTE = `/closing-folders/${CLOSING_FOLDER.id}`;
const ME_PAYLOAD = {
  activeTenant: ACTIVE_TENANT,
  effectiveRoles: ["ACCOUNTANT"]
};

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

function emptyResponse(status: number) {
  return new Response(null, { status });
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
    financialStatementsStructured = () => jsonResponse(200, READY_FINANCIAL_STATEMENTS_STRUCTURED),
    workpapers = () => jsonResponse(200, EMPTY_WORKPAPERS),
    extras = []
  }: {
    controls?: ResponseFactory;
    manualMapping?: ResponseFactory;
    financialSummary?: ResponseFactory;
    financialStatementsStructured?: ResponseFactory;
    workpapers?: ResponseFactory;
    extras?: ResponseFactory[];
  } = {}
) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, ME_PAYLOAD))
    .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
    .mockImplementationOnce(() => Promise.resolve(controls()))
    .mockImplementationOnce(() => Promise.resolve(manualMapping()))
    .mockImplementationOnce(() => Promise.resolve(financialSummary()))
    .mockImplementationOnce(() => Promise.resolve(financialStatementsStructured()))
    .mockImplementationOnce(() => Promise.resolve(workpapers()));

  extras.forEach((response) => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(response()));
  });
}

async function waitForNominalShell() {
  expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
  expect(await screen.findByText("Import balance")).toBeInTheDocument();
  expect(await screen.findByText("Mapping manuel")).toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Cockpit read-only" })).toBeInTheDocument();
  expect(await screen.findByText("Financial summary")).toBeInTheDocument();
  expect(await screen.findByText("Financial statements structured")).toBeInTheDocument();
  expect(await screen.findByText("Workpapers")).toBeInTheDocument();
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function getWorkpapersPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return getRequestPaths(fetchMock).filter((path) => path.endsWith("/workpapers"));
}

function expectNoForbiddenPaths(paths: string[], expectedWorkpapersCalls = 1) {
  expect(paths.filter((path) => path.includes("/workpapers"))).toHaveLength(expectedWorkpapersCalls);
  expect(paths.some((path) => /\/workpapers\/[^/]+/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/review-decision"))).toBe(false);
  expect(paths.some((path) => path.includes("/documents"))).toBe(false);
  expect(paths.some((path) => path.includes("/exports"))).toBe(false);
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
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

function getWorkpapersSection() {
  const section = screen.getByText("Workpapers").closest("section");
  expect(section).not.toBeNull();
  return within(section as HTMLElement);
}

function getWorkpaperCard(anchorCode: string) {
  return screen.getByLabelText(`workpaper ${anchorCode}`);
}

function expectNodeBefore(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

describe("router workpapers", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("places Workpapers after Financial statements structured, loads it only after /api/me and dossier, and keeps the request scope closed", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    const structuredLabel = screen.getByText("Financial statements structured");
    const workpapersLabel = screen.getByText("Workpapers");

    expectNodeBefore(structuredLabel, workpapersLabel);

    const paths = getRequestPaths(fetchMock);
    expect(paths).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`
    ]);
    expectNoForbiddenPaths(paths);
  });

  it("shows chargement workpapers while the request is pending and keeps the other blocks visible", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      workpapers: () => new Promise(() => {})
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("chargement workpapers")).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByText("Workpapers en lecture seule dans cette version.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Resume workpapers" })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(7);
  });

  it.each([
    { response: () => jsonResponse(400, {}), text: "workpapers indisponibles" },
    { response: () => jsonResponse(401, {}), text: "authentification requise" },
    { response: () => jsonResponse(403, {}), text: "acces workpapers refuse" },
    { response: () => jsonResponse(404, {}), text: "workpapers introuvables" },
    { response: () => jsonResponse(500, {}), text: "erreur serveur workpapers" },
    { response: () => Promise.reject(new Error("network")), text: "erreur reseau workpapers" },
    { response: () => Promise.reject(new Error("timeout")), text: "timeout workpapers" },
    { response: () => jsonResponse(418, {}), text: "workpapers indisponibles" }
  ])("renders the exact workpapers error state '$text' and keeps the existing blocks visible", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      workpapers: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByText("Workpapers en lecture seule dans cette version.")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Resume workpapers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Workpapers courants" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Workpapers stale" })).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "missing documents[]",
      response: () =>
        jsonResponse(200, {
          ...WORKPAPERS_WITH_DATA,
          items: WORKPAPERS_WITH_DATA.items.map((item, index) =>
            index === 0
              ? Object.fromEntries(
                  Object.entries(item).filter(([key]) => key !== "documents")
                )
              : item
          )
        })
    },
    {
      label: "incoherent counts",
      response: () =>
        jsonResponse(200, {
          ...WORKPAPERS_WITH_DATA,
          summaryCounts: {
            ...WORKPAPERS_WITH_DATA.summaryCounts,
            staleCount: 7
          }
        })
    },
    {
      label: "unreadable json",
      response: () => textResponse(200, "{", "application/json")
    }
  ])("renders payload workpapers invalide on $label", async ({ response }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      workpapers: response
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("payload workpapers invalide")).toBeInTheDocument();
    expectExistingBlocksVisible();
    expect(screen.queryByText("Workpapers en lecture seule dans cette version.")).not.toBeInTheDocument();
  });

  it("renders the exact READY_EMPTY state and the read-only reminder", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(200, {
          ...EMPTY_WORKPAPERS,
          nextAction: {
            code: "IGNORED",
            path: "/never-rendered",
            actionable: "still-ignored"
          }
        })
    });

    renderClosingRoute();
    await waitForNominalShell();

    const workpapersSection = getWorkpapersSection();

    expect(await screen.findByText("Workpapers en lecture seule dans cette version.")).toBeInTheDocument();
    expect(workpapersSection.getByRole("heading", { name: "Resume workpapers" })).toBeInTheDocument();
    expect(workpapersSection.getByText("anchors courants total : 0")).toBeInTheDocument();
    expect(workpapersSection.getByText("anchors avec workpaper : 0")).toBeInTheDocument();
    expect(workpapersSection.getByText("workpapers prets pour revue : 0")).toBeInTheDocument();
    expect(workpapersSection.getByText("workpapers revus : 0")).toBeInTheDocument();
    expect(workpapersSection.getByText("workpapers stale : 0")).toBeInTheDocument();
    expect(workpapersSection.getByText("anchors sans workpaper : 0")).toBeInTheDocument();
    expect(workpapersSection.getByText("aucun workpaper disponible")).toBeInTheDocument();
    expect(workpapersSection.getByRole("heading", { name: "Workpapers courants" })).toBeInTheDocument();
    expect(workpapersSection.getByText("aucun workpaper courant")).toBeInTheDocument();
    expect(workpapersSection.getByRole("heading", { name: "Workpapers stale" })).toBeInTheDocument();
    expect(workpapersSection.getByText("aucun workpaper stale")).toBeInTheDocument();
    expect(screen.queryByText("/never-rendered")).not.toBeInTheDocument();
  });

  it("renders READY_WITH_DATA in backend order, renders documents and verification sections exactly, and never exposes workpapers CTAs", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      workpapers: () => jsonResponse(200, WORKPAPERS_WITH_DATA)
    });

    renderClosingRoute();
    await waitForNominalShell();

    const workpapersSection = getWorkpapersSection();
    const currentCards = screen.getAllByLabelText(/workpaper /);
    const revenueCard = getWorkpaperCard("PL.REVENUE.CURRENT_SECTION");
    const currentAssetsCard = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    const staleCard = getWorkpaperCard("BS.ASSET.LEGACY_BUCKET_FALLBACK");

    expect(await screen.findByText("Workpapers en lecture seule dans cette version.")).toBeInTheDocument();
    expectNodeBefore(currentCards[0] as HTMLElement, currentCards[1] as HTMLElement);
    expect(workpapersSection.getByText("anchors courants total : 2")).toBeInTheDocument();
    expect(workpapersSection.getByText("anchors avec workpaper : 1")).toBeInTheDocument();
    expect(workpapersSection.getByText("workpapers prets pour revue : 1")).toBeInTheDocument();
    expect(workpapersSection.getByText("workpapers revus : 0")).toBeInTheDocument();
    expect(workpapersSection.getByText("workpapers stale : 1")).toBeInTheDocument();
    expect(workpapersSection.getByText("anchors sans workpaper : 1")).toBeInTheDocument();

    expect(within(revenueCard).getByText("Revenue")).toBeInTheDocument();
    expect(within(revenueCard).getByText("anchor code : PL.REVENUE.CURRENT_SECTION")).toBeInTheDocument();
    expect(within(revenueCard).getByText("statement kind : INCOME_STATEMENT")).toBeInTheDocument();
    expect(within(revenueCard).getByText("breakdown type : LEGACY_BUCKET_FALLBACK")).toBeInTheDocument();
    expect(within(revenueCard).getByText("etat workpaper : aucun")).toBeInTheDocument();
    expect(within(revenueCard).getByText("aucun document inclus")).toBeInTheDocument();
    expect(within(revenueCard).queryByRole("heading", { name: "Verification documents" })).not.toBeInTheDocument();

    expect(within(currentAssetsCard).getByText("Current assets")).toBeInTheDocument();
    expect(within(currentAssetsCard).getByText("etat workpaper : READY_FOR_REVIEW")).toBeInTheDocument();
    expect(within(currentAssetsCard).getByText("note workpaper : Cash tie-out")).toBeInTheDocument();
    const currentAssetsDocuments = within(currentAssetsCard).getAllByText(/verification : /);
    expect(currentAssetsDocuments).toHaveLength(2);
    expect(currentAssetsDocuments[0]).toHaveTextContent(
      "z-last.pdf | application/pdf | ERP | verification : VERIFIED"
    );
    expect(currentAssetsDocuments[1]).toHaveTextContent(
      "a-first.csv | text/csv | Bank portal | verification : REJECTED"
    );
    expect(within(currentAssetsCard).getByText("documents total : 2")).toBeInTheDocument();
    expect(within(currentAssetsCard).getByText("documents non verifies : 0")).toBeInTheDocument();
    expect(within(currentAssetsCard).getByText("documents verifies : 1")).toBeInTheDocument();
    expect(within(currentAssetsCard).getByText("documents rejetes : 1")).toBeInTheDocument();

    expect(within(staleCard).getByText("Legacy bucket")).toBeInTheDocument();
    expect(within(staleCard).getByText("etat workpaper : REVIEWED")).toBeInTheDocument();
    expect(within(staleCard).getByText("note workpaper : Legacy support")).toBeInTheDocument();
    expect(within(staleCard).queryByText("etat workpaper : aucun")).not.toBeInTheDocument();
    expect(within(staleCard).getByText("legacy.xlsx | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | Archive | verification : VERIFIED")).toBeInTheDocument();
    expect(within(staleCard).getByText("documents total : 1")).toBeInTheDocument();
    expect(within(staleCard).getByText("documents non verifies : 0")).toBeInTheDocument();
    expect(within(staleCard).getByText("documents verifies : 1")).toBeInTheDocument();
    expect(within(staleCard).getByText("documents rejetes : 0")).toBeInTheDocument();

    expect(within(workpapersSection.getByRole("heading", { name: "Workpapers courants" }).closest("section") as HTMLElement).getAllByRole("heading", { name: "Documents inclus" })).toHaveLength(2);
    expect(within(workpapersSection.getByRole("heading", { name: "Workpapers stale" }).closest("section") as HTMLElement).getAllByRole("heading", { name: "Documents inclus" })).toHaveLength(1);
    expect(screen.getAllByRole("heading", { name: "Verification documents" })).toHaveLength(2);
    expect(screen.queryByText("/should-never-render")).not.toBeInTheDocument();

    [
      "Modifier le workpaper",
      "Envoyer en review",
      "Prendre une decision reviewer",
      "Uploader un document",
      "Telecharger un document",
      "Ouvrir les documents",
      "Ouvrir les exports",
      "Ouvrir le workpaper"
    ].forEach((name) => {
      expect(workpapersSection.queryByRole("button", { name })).not.toBeInTheDocument();
      expect(workpapersSection.queryByRole("link", { name })).not.toBeInTheDocument();
    });
  });

  it("does not refetch workpapers after a successful import refresh sequence", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const file = new File(["account,amount"], "balance.csv", { type: "text/csv" });

    primeNominalRoute(fetchMock, {
      extras: [
        () =>
          jsonResponse(201, {
            closingFolderId: CLOSING_FOLDER.id,
            version: 3,
            rowCount: 12
          }),
        () =>
          jsonResponse(200, {
            ...CLOSING_FOLDER,
            name: "Closing FY26 refreshed"
          }),
        () =>
          jsonResponse(200, {
            ...READY_CONTROLS,
            latestImportVersion: 3
          })
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.upload(screen.getByLabelText("Fichier CSV"), file);
    await user.click(screen.getByRole("button", { name: "Importer la balance" }));

    expect(await screen.findByText("balance importee avec succes")).toBeInTheDocument();
    expect(getWorkpapersPaths(fetchMock)).toHaveLength(1);
    expectNoForbiddenPaths(getRequestPaths(fetchMock));
  });

  it("does not refetch workpapers after a successful PUT mapping refresh sequence", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      extras: [
        () =>
          jsonResponse(200, {
            accountCode: "2000",
            targetCode: "PL.REVENUE"
          }),
        () => jsonResponse(200, READY_MANUAL_MAPPING_AFTER_PUT),
        () => jsonResponse(200, READY_CONTROLS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const revenueLine = screen.getByLabelText("ligne mapping 2000");
    const revenueTargetSelect = within(revenueLine).getByLabelText("Cible");
    const revenueSaveButton = within(revenueLine).getByRole("button", {
      name: "Enregistrer le mapping"
    });

    await user.selectOptions(revenueTargetSelect, "PL.REVENUE");
    expect(revenueSaveButton).toBeEnabled();
    await user.click(revenueSaveButton);

    expect(await screen.findByText("mapping enregistre avec succes")).toBeInTheDocument();
    expect(getWorkpapersPaths(fetchMock)).toHaveLength(1);
    expectNoForbiddenPaths(getRequestPaths(fetchMock));
  });

  it("does not refetch workpapers after a successful DELETE mapping refresh sequence", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      extras: [
        () => emptyResponse(204),
        () => jsonResponse(200, READY_MANUAL_MAPPING_AFTER_DELETE),
        () =>
          jsonResponse(200, {
            ...READY_CONTROLS,
            mappingSummary: {
              total: 2,
              mapped: 0,
              unmapped: 2
            }
          })
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const cashLine = screen.getByLabelText("ligne mapping 1000");
    const cashDeleteButton = within(cashLine).getByRole("button", {
      name: "Supprimer le mapping"
    });

    expect(cashDeleteButton).toBeEnabled();
    await user.click(cashDeleteButton);

    expect(await screen.findByText("mapping supprime avec succes")).toBeInTheDocument();
    expect(getWorkpapersPaths(fetchMock)).toHaveLength(1);
    expectNoForbiddenPaths(getRequestPaths(fetchMock));
  });
});
