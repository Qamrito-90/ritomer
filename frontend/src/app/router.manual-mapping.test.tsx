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

const INITIAL_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "BLOCKED",
  latestImportPresent: true,
  latestImportVersion: 2,
  mappingSummary: {
    total: 2,
    mapped: 1,
    unmapped: 1
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
      message: "1 account(s) remain unmapped on the latest import."
    }
  ],
  nextAction: {
    code: "COMPLETE_MANUAL_MAPPING",
    path: `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
    actionable: true
  },
  unmappedAccounts: [
    {
      accountCode: "2000",
      accountLabel: "Revenue",
      debit: "0",
      credit: "100"
    }
  ]
};

const REFRESHED_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
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
      severity: "BLOCKER",
      message: "Latest valid balance import version 2 is available."
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
      code: "BS.ASSET.SECTION",
      label: "Actif section",
      selectable: false
    },
    {
      code: "PL.REVENUE",
      label: "Produit",
      selectable: true
    }
  ]
};

const IMPORT_REQUIRED_MANUAL_MAPPING = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: null,
  summary: {
    total: 0,
    mapped: 0,
    unmapped: 0
  },
  lines: [],
  mappings: [],
  targets: INITIAL_MANUAL_MAPPING.targets
};

const INITIAL_FINANCIAL_SUMMARY = {
  closingFolderId: CLOSING_FOLDER.id,
  statementState: "PREVIEW_PARTIAL",
  latestImportVersion: 2,
  coverage: {
    totalLines: 2,
    mappedLines: 1,
    unmappedLines: 1,
    mappedShare: "0.5"
  },
  unmappedBalanceImpact: {
    debitTotal: "0",
    creditTotal: "100",
    netDebitMinusCredit: "-100"
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
  incomeStatementSummary: {
    revenue: "100",
    expenses: "0",
    netResult: "100"
  }
};

const INITIAL_FINANCIAL_STATEMENTS_STRUCTURED = {
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

const REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED = {
  ...INITIAL_FINANCIAL_STATEMENTS_STRUCTURED,
  statementState: "PREVIEW_READY",
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
        total: "100",
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
  latestImportVersion: 2,
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

const REFRESHED_MANUAL_MAPPING_AFTER_PUT = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 2,
  summary: {
    total: 2,
    mapped: 2,
    unmapped: 0
  },
  lines: INITIAL_MANUAL_MAPPING.lines,
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
  targets: INITIAL_MANUAL_MAPPING.targets
};

const REFRESHED_MANUAL_MAPPING_AFTER_DELETE = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 2,
  summary: {
    total: 2,
    mapped: 0,
    unmapped: 2
  },
  lines: INITIAL_MANUAL_MAPPING.lines,
  mappings: [],
  targets: INITIAL_MANUAL_MAPPING.targets
};

const REFRESHED_MANUAL_MAPPING_AFTER_CORRECT = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 2,
  summary: {
    total: 2,
    mapped: 2,
    unmapped: 0
  },
  lines: INITIAL_MANUAL_MAPPING.lines,
  mappings: [
    {
      accountCode: "1000",
      targetCode: "BS.ASSET"
    },
    {
      accountCode: "2000",
      targetCode: "BS.ASSET"
    }
  ],
  targets: INITIAL_MANUAL_MAPPING.targets
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

const READY_MAPPING_SUGGESTIONS = {
  state: "READY",
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 2,
  taxonomyVersion: 2,
  suggestions: [
    {
      accountCode: "2000",
      accountLabel: "Revenue",
      suggestedTargetCode: "PL.REVENUE",
      confidence: 0.91,
      riskLevel: "LOW",
      rationale: "Account label and target taxonomy are consistent with revenue.",
      evidence: [
        {
          type: "ACCOUNT_LABEL",
          ref: "balance_import_line:2000",
          snippet: "Revenue"
        },
        {
          type: "TARGET_TAXONOMY",
          ref: "manual-mapping-targets-v2:PL.REVENUE",
          snippet: "Produit"
        }
      ],
      requiresHumanReview: true,
      schemaVersion: "mapping-suggestion-v1",
      promptVersion: "not_applicable_for_stub",
      modelVersion: "not_applicable_for_stub",
      suggestionFingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    }
  ],
  errors: []
};

const REFRESHED_EMPTY_MAPPING_SUGGESTIONS = {
  ...READY_MAPPING_SUGGESTIONS,
  suggestions: []
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

function mePayload(effectiveRoles?: unknown) {
  return effectiveRoles === undefined
    ? { activeTenant: ACTIVE_TENANT }
    : { activeTenant: ACTIVE_TENANT, effectiveRoles };
}

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

function primeNominalRoute(
  fetchMock: ReturnType<typeof vi.fn>,
  {
    me = mePayload(["ACCOUNTANT"]),
    closingFolder = CLOSING_FOLDER,
    controls = () => jsonResponse(200, INITIAL_CONTROLS),
    manualMapping = () => jsonResponse(200, INITIAL_MANUAL_MAPPING),
    financialSummary = () => jsonResponse(200, INITIAL_FINANCIAL_SUMMARY),
    financialStatementsStructured = () =>
      jsonResponse(200, INITIAL_FINANCIAL_STATEMENTS_STRUCTURED),
    workpapers = () => jsonResponse(200, INITIAL_WORKPAPERS),
    mappingSuggestions = () => jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS),
    extras = []
  }: {
    me?: Record<string, unknown>;
    closingFolder?: typeof CLOSING_FOLDER;
    controls?: ResponseFactory;
    manualMapping?: ResponseFactory;
    financialSummary?: ResponseFactory;
    financialStatementsStructured?: ResponseFactory;
    workpapers?: ResponseFactory;
    mappingSuggestions?: ResponseFactory;
    extras?: ResponseFactory[];
  } = {}
) {
  const extraQueue = [...extras];
  const initialGetCounts = new Map<string, number>();
  const initialGetHandlers = new Map<string, ResponseFactory>([
    ["/api/me", () => jsonResponse(200, me)],
    [`/api/closing-folders/${CLOSING_FOLDER.id}`, () => jsonResponse(200, closingFolder)],
    [`/api/closing-folders/${CLOSING_FOLDER.id}/controls`, controls],
    [`/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`, manualMapping],
    [`/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`, financialSummary],
    [
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      financialStatementsStructured
    ],
    [`/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`, workpapers],
    [
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`,
      () => jsonResponse(200, DEFAULT_IMPORT_VERSIONS)
    ],
    [
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`,
      () => jsonResponse(200, DEFAULT_IMPORT_DIFF)
    ],
    [`/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`, mappingSuggestions],
    [`/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`, () => jsonResponse(200, EMPTY_EXPORT_PACKS)],
    [
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      () => jsonResponse(200, BLOCKED_MINIMAL_ANNEX)
    ]
  ]);

  fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";

    if (method === "GET") {
      const handler = initialGetHandlers.get(path);

      if (handler !== undefined) {
        const previousCalls = initialGetCounts.get(path) ?? 0;
        initialGetCounts.set(path, previousCalls + 1);

        if (previousCalls === 0) {
          return Promise.resolve(handler());
        }
      }
    }

    const nextResponse = extraQueue.shift();

    if (nextResponse === undefined) {
      return Promise.resolve(jsonResponse(500, {}));
    }

    return Promise.resolve(nextResponse());
  });
}

async function waitForNominalShell() {
  const user = userEvent.setup();

  expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
  expect(await screen.findByText("Import balance")).toBeInTheDocument();
  expect(await screen.findByText("Mapping manuel")).toBeInTheDocument();
  expect(await screen.findByText("Etat de preparation")).toBeInTheDocument();
  expect(await screen.findByText("Synthese financiere")).toBeInTheDocument();
  expect(await screen.findByText("Etats financiers structures")).toBeInTheDocument();
  expect(await screen.findByText("Justifications")).toBeInTheDocument();
  expect(await screen.findByText("Suggestions de mapping a revoir")).toBeInTheDocument();
  expect(await screen.findByText("Pack export auditable")).toBeInTheDocument();
  expect(await screen.findByText("Aucun pack auditable genere.")).toBeInTheDocument();
  expect(await screen.findByText("Annexe minimale")).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: "Mapping" }));
}

function getRequestHeaders(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return ((fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<
    string,
    string
  >;
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function stubRandomUUID(...values: string[]) {
  const randomUUID = vi.fn();

  values.forEach((value) => {
    randomUUID.mockReturnValueOnce(value);
  });
  vi.stubGlobal("crypto", {
    ...globalThis.crypto,
    randomUUID
  });

  return randomUUID;
}

function getMappingHeading() {
  return screen.getByRole("heading", { name: "Projection du dernier import" });
}

function getMappingSection() {
  const section = getMappingHeading().closest("section");

  if (!(section instanceof HTMLElement)) {
    throw new Error("mapping section not found");
  }

  return section;
}

function getLine(accountCode: string) {
  return screen.getByLabelText(`ligne mapping ${accountCode}`);
}

function getLineDetailCard(accountCode: string, label: string) {
  const detailCard = within(getLine(accountCode)).getByText(label).closest("div");

  if (!(detailCard instanceof HTMLElement)) {
    throw new Error(`detail card '${label}' not found for line ${accountCode}`);
  }

  return detailCard;
}

function getLineTargetSelect(accountCode: string) {
  return within(getLine(accountCode)).getByLabelText("Cible") as HTMLSelectElement;
}

function getLineSaveButton(accountCode: string) {
  return within(getLine(accountCode)).getByRole("button", {
    name: "Enregistrer le mapping"
  });
}

function getLineDeleteButton(accountCode: string) {
  return within(getLine(accountCode)).getByRole("button", {
    name: "Supprimer le mapping"
  });
}

function expectNoOutOfScopePaths(
  paths: string[],
  expectedFinancialSummaryCalls = 1,
  expectedFinancialStatementsStructuredCalls = 1,
  expectedWorkpapersCalls = 1,
  expectedMappingSuggestionsCalls = 1
) {
  expect(paths.some((path) => path.endsWith("/imports/balance"))).toBe(false);
  expect(paths.filter((path) => path.endsWith("/imports/balance/versions"))).toHaveLength(1);
  expect(paths.filter((path) => path.includes("/diff-previous"))).toHaveLength(1);
  expect(paths.filter((path) => path.includes("/financial-summary"))).toHaveLength(
    expectedFinancialSummaryCalls
  );
  expect(paths.filter((path) => path.includes("/financial-statements/structured"))).toHaveLength(
    expectedFinancialStatementsStructuredCalls
  );
  expect(paths.some((path) => path.includes("/financial-statements-structured"))).toBe(false);
  expect(paths.filter((path) => path.includes("/workpapers"))).toHaveLength(
    expectedWorkpapersCalls
  );
  expect(paths.filter((path) => path.endsWith("/mappings/suggestions"))).toHaveLength(
    expectedMappingSuggestionsCalls
  );
  expect(paths.filter((path) => path.endsWith("/export-packs"))).toHaveLength(1);
  expect(paths.filter((path) => path.endsWith("/minimal-annex"))).toHaveLength(1);
  expect(paths.some((path) => /\/workpapers\/[^/]+/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/documents"))).toBe(false);
  expect(paths.some((path) => /\/export-packs\/[^/]+\/content$/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
  expect(paths.some((path) => path.includes("/graphql"))).toBe(false);
}

describe("router manual mapping", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("exposes Mapping through the workbench navigation and only loads controls plus manual mapping after me then dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    expect(screen.getByRole("tab", { name: "Import" })).toHaveAttribute(
      "aria-controls",
      "workbench-panel-import"
    );
    expect(screen.getByRole("tab", { name: "Mapping" })).toHaveAttribute(
      "aria-controls",
      "workbench-panel-mapping"
    );
    expect(screen.getByRole("tab", { name: "Controles" })).toHaveAttribute(
      "aria-controls",
      "workbench-panel-controls"
    );
    expect(screen.getByRole("tabpanel", { name: "Mapping" })).toBeInTheDocument();
    const mappingHeading = getMappingHeading();
    expect(mappingHeading).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Revue des imports balance" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Etat de preparation" })).not.toBeInTheDocument();
    expect(getRequestPaths(fetchMock)).toEqual([
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
    expect(getRequestHeaders(fetchMock, 0)["X-Tenant-Id"]).toBeUndefined();
    expect(getRequestHeaders(fetchMock, 1)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 2)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 3)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 4)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 5)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 6)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 7)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 8)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 9)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 10)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock));
  });

  it("renders manual mapping as a review table without bulk or automatic apply controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    const mappingSection = getMappingSection();
    const mappingTable = within(mappingSection).getByRole("table", {
      name: "Table de revue du mapping manuel"
    });

    [
      "Compte source",
      "Débit",
      "Crédit",
      "Affectation actuelle",
      "Nouvelle affectation",
      "Action"
    ].forEach((columnName) => {
      expect(within(mappingTable).getByRole("columnheader", { name: columnName })).toBeInTheDocument();
    });

    ["Debit", "Credit", "Mapping courant", "Cible a appliquer", "Cible"].forEach((columnName) => {
      expect(within(mappingTable).queryByRole("columnheader", { name: columnName })).not.toBeInTheDocument();
    });

    expect(within(mappingTable).getByLabelText("ligne mapping 1000")).toBeInTheDocument();
    expect(within(mappingTable).getByLabelText("ligne mapping 2000")).toBeInTheDocument();
    const currentMapping = getLineDetailCard("1000", "Affectation actuelle");
    expect(within(currentMapping).getByText("Actif")).toBeInTheDocument();
    expect(within(currentMapping).getByText("BS.ASSET")).toHaveClass(
      "max-w-full",
      "truncate",
      "text-xs",
      "font-mono",
      "text-muted-foreground"
    );
    const actionCell = within(getLine("1000")).getByText("Action").closest("div");
    expect(actionCell).toHaveClass("grid", "min-w-0", "gap-2");
    expect(mappingTable.querySelector("article")).toBeNull();
    expect(within(mappingSection).queryByRole("button", { name: /appliquer tout/i })).not.toBeInTheDocument();
    expect(within(mappingSection).queryByRole("button", { name: /bulk/i })).not.toBeInTheDocument();
    expect(mappingSection).not.toHaveTextContent("auto-apply");
    expect(mappingSection).not.toHaveTextContent("Application automatique");
    expectNoOutOfScopePaths(getRequestPaths(fetchMock));
  });

  it("keeps the cockpit and workspace navigation usable when the mapping block fails", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      controls: () => jsonResponse(200, REFRESHED_CONTROLS),
      manualMapping: () => jsonResponse(500, {})
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("erreur serveur mapping")).toBeInTheDocument();
    expect(screen.getByText("Closing FY26")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Controles" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Import" }));
    expect(screen.getByText("aucun fichier selectionne")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Controles" }));
    expect(screen.getByText("Etat de preparation")).toBeInTheDocument();
    expect(screen.getByText("aucune action requise")).toBeInTheDocument();
  });

  it("shows chargement mapping manuel while the mapping request is pending", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      manualMapping: () => new Promise(() => {})
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("chargement mapping manuel")).toBeInTheDocument();
    expect(screen.getByText("chargement controles")).toBeInTheDocument();
  });

  it.each([
    { factory: () => jsonResponse(401, {}), text: "authentification requise" },
    { factory: () => jsonResponse(403, {}), text: "acces mapping refuse" },
    { factory: () => jsonResponse(404, {}), text: "mapping introuvable" },
    { factory: () => jsonResponse(500, {}), text: "erreur serveur mapping" },
    { factory: () => jsonResponse(400, {}), text: "mapping indisponible" },
    { factory: () => Promise.reject(new Error("network")), text: "erreur reseau mapping" },
    { factory: () => Promise.reject(new Error("timeout")), text: "timeout mapping" },
    {
      factory: () =>
        jsonResponse(200, {
          ...INITIAL_MANUAL_MAPPING,
          summary: {
            total: 2,
            mapped: 2,
            unmapped: 0
          }
        }),
      text: "mapping bloque par securite, donnees incoherentes"
    }
  ])("renders the exact mapping read state '$text'", async ({ factory, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, { manualMapping: factory });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Controles" })).toBeInTheDocument();
  });

  it("renders import requis with the exact summary and no lines when no import exists", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      manualMapping: () => jsonResponse(200, IMPORT_REQUIRED_MANUAL_MAPPING)
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("import requis")).toBeInTheDocument();
    expect(within(getMappingSection()).getByText("version d import")).toBeInTheDocument();
    expect(within(getMappingSection()).getByText("aucune ligne a mapper")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Enregistrer le mapping" })).not.toBeInTheDocument();
  });

  it("renders dossier archive, mapping en lecture seule on an archived dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      closingFolder: ARCHIVED_CLOSING_FOLDER,
      manualMapping: () => jsonResponse(200, INITIAL_MANUAL_MAPPING)
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("dossier archive, mapping en lecture seule")).toBeInTheDocument();
    expect(getLineTargetSelect("1000")).toBeDisabled();
    expect(getLineSaveButton("1000")).toBeDisabled();
    expect(getLineDeleteButton("1000")).toBeDisabled();
  });

  it("renders lecture seule for REVIEWER and disables mapping actions", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      me: mePayload(["REVIEWER"])
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("lecture seule")).toBeInTheDocument();
    expect(getLineTargetSelect("2000")).toBeDisabled();
    expect(getLineSaveButton("2000")).toBeDisabled();
    expect(getLineDeleteButton("1000")).toBeDisabled();
  });

  it.each([
    { me: mePayload(), label: "roles absents" },
    { me: mePayload(42), label: "roles invalides" }
  ])("falls back to lecture seule when %s", async ({ me }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, { me });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("lecture seule")).toBeInTheDocument();
    expect(getLineTargetSelect("2000")).toBeDisabled();
    expect(getLineSaveButton("2000")).toBeDisabled();
  });

  it.each(["ACCOUNTANT", "MANAGER", "ADMIN"])(
    "enables the writable mapping mode for %s",
    async (role) => {
      const fetchMock = vi.mocked(global.fetch);
      primeNominalRoute(fetchMock, {
        me: mePayload([role])
      });

      renderClosingRoute();
      await waitForNominalShell();

      expect(screen.queryByText("lecture seule")).not.toBeInTheDocument();
      expect(getLineTargetSelect("2000")).toBeEnabled();
      expect(getLineSaveButton("2000")).toBeDisabled();
      expect(getLineDeleteButton("1000")).toBeEnabled();
      expect(
        Array.from(getLineTargetSelect("2000").options).map((option) => option.textContent)
      ).toEqual(["Choisir une rubrique", "Actif", "Produit"]);
      const mappedLine = getLineDetailCard("1000", "Affectation actuelle");
      expect(within(mappedLine).getByText("Actif")).toBeInTheDocument();
      expect(within(mappedLine).getByText("BS.ASSET")).toBeInTheDocument();
      expect(
        within(getLineDetailCard("2000", "Affectation actuelle")).getByText(
          "Aucune affectation"
        )
      ).toBeInTheDocument();
    }
  );

  it("does not autosave on select change and disables every mapping action while a PUT is pending", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [() => new Promise(() => {})]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.selectOptions(getLineTargetSelect("2000"), "PL.REVENUE");

    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(getLineSaveButton("2000")).toBeEnabled();

    await user.click(getLineSaveButton("2000"));

    expect(await screen.findByText("enregistrement mapping en cours")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(13);
    expect(getLineTargetSelect("1000")).toBeDisabled();
    expect(getLineTargetSelect("2000")).toBeDisabled();
    expect(getLineSaveButton("1000")).toBeDisabled();
    expect(getLineSaveButton("2000")).toBeDisabled();
    expect(getLineDeleteButton("1000")).toBeDisabled();

    await user.click(getLineDeleteButton("1000"));
    expect(fetchMock).toHaveBeenCalledTimes(13);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock));
  });

  it("does not POST a suggestion decision before click, then refreshes suggestions plus core mapping surfaces after ACCEPT creates a manual mapping", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("route-accept-key-1");
    primeNominalRoute(fetchMock, {
      mappingSuggestions: () => jsonResponse(200, READY_MAPPING_SUGGESTIONS),
      extras: [
        () =>
          jsonResponse(200, {
            decision: "ACCEPT",
            accountCode: "2000",
            resultKind: "MANUAL_MAPPING_CREATED",
            appliedMapping: {
              accountCode: "2000",
              targetCode: "PL.REVENUE"
            }
          }),
        () => jsonResponse(200, REFRESHED_EMPTY_MAPPING_SUGGESTIONS),
        () => jsonResponse(200, REFRESHED_MANUAL_MAPPING_AFTER_PUT),
        () => jsonResponse(200, REFRESHED_CONTROLS),
        () => jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY),
        () => jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED),
        () => jsonResponse(200, REFRESHED_WORKPAPERS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();
    await screen.findByLabelText("suggestion mapping 2000 a revoir");

    expect(fetchMock).toHaveBeenCalledTimes(12);
    expect(getRequestPaths(fetchMock)).not.toContain(
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions/2000/decision`
    );
    expect(
      fetchMock.mock.calls.some(
        (call) => ((call[1] as RequestInit | undefined)?.method ?? "GET") === "POST"
      )
    ).toBe(false);
    expect(getLineTargetSelect("2000")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Accepter" }));

    expect(await screen.findByText(/Decision humaine enregistree : accepter/)).toBeInTheDocument();
    expect(getRequestPaths(fetchMock)).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions/2000/decision`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`
    ]);

    const postInit = fetchMock.mock.calls[12]?.[1] as RequestInit;
    const postHeaders = postInit.headers as Record<string, string>;
    expect(postInit.method).toBe("POST");
    expect(postHeaders.Accept).toBe("application/json");
    expect(postHeaders["Content-Type"]).toBe("application/json");
    expect(postHeaders["Idempotency-Key"]).toBe("route-accept-key-1");
    expect(postHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(JSON.parse(String(postInit.body))).toEqual({
      decision: "ACCEPT",
      latestImportVersion: 2,
      suggestionFingerprint:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      targetCode: "PL.REVENUE"
    });

    expect(
      await within(getLineDetailCard("2000", "Affectation actuelle")).findByText("Produit")
    ).toBeInTheDocument();
    expect(within(getLineDetailCard("2000", "Affectation actuelle")).getByText("PL.REVENUE")).toBeInTheDocument();
    expect(await screen.findByText("Manual mapping is complete on the latest import.")).toBeInTheDocument();
    expect(await screen.findByText("etat previsualisation : previsualisation prete")).toBeInTheDocument();
    expect(await screen.findByText("rubriques a documenter : 1")).toBeInTheDocument();
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), 2, 2, 2, 2);
  });

  it("refreshes suggestions plus core mapping surfaces after CORRECT updates a manual mapping", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("route-correct-key-1");
    primeNominalRoute(fetchMock, {
      mappingSuggestions: () => jsonResponse(200, READY_MAPPING_SUGGESTIONS),
      extras: [
        () =>
          jsonResponse(200, {
            decision: "CORRECT",
            accountCode: "2000",
            resultKind: "MANUAL_MAPPING_UPDATED",
            appliedMapping: {
              accountCode: "2000",
              targetCode: "BS.ASSET"
            }
          }),
        () => jsonResponse(200, REFRESHED_EMPTY_MAPPING_SUGGESTIONS),
        () => jsonResponse(200, REFRESHED_MANUAL_MAPPING_AFTER_CORRECT),
        () => jsonResponse(200, REFRESHED_CONTROLS),
        () => jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY),
        () => jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED),
        () => jsonResponse(200, REFRESHED_WORKPAPERS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();
    await screen.findByLabelText("suggestion mapping 2000 a revoir");

    await user.selectOptions(
      screen.getByLabelText("Corriger avec une autre cible"),
      "BS.ASSET"
    );
    await user.click(screen.getByRole("button", { name: "Corriger" }));

    expect(await screen.findByText(/Decision humaine enregistree : corriger/)).toBeInTheDocument();
    expect(getRequestPaths(fetchMock)).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions/2000/decision`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[12]?.[1] as RequestInit).body))).toEqual({
      decision: "CORRECT",
      latestImportVersion: 2,
      suggestionFingerprint:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      targetCode: "BS.ASSET"
    });
    expect(
      await within(getLineDetailCard("2000", "Affectation actuelle")).findByText("Actif")
    ).toBeInTheDocument();
    expect(within(getLineDetailCard("2000", "Affectation actuelle")).getByText("BS.ASSET")).toBeInTheDocument();
    expect(await screen.findByText("etat previsualisation : previsualisation prete")).toBeInTheDocument();
    expect(await screen.findByText("rubriques a documenter : 1")).toBeInTheDocument();
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), 2, 2, 2, 2);
  });

  it("refreshes suggestions only after REJECT and never refreshes manual mapping or controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("route-reject-key-1");
    primeNominalRoute(fetchMock, {
      mappingSuggestions: () => jsonResponse(200, READY_MAPPING_SUGGESTIONS),
      extras: [
        () =>
          jsonResponse(200, {
            decision: "REJECT",
            accountCode: "2000",
            resultKind: "REJECT_RECORDED",
            appliedMapping: null
          }),
        () => jsonResponse(200, REFRESHED_EMPTY_MAPPING_SUGGESTIONS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();
    await screen.findByLabelText("suggestion mapping 2000 a revoir");

    await user.click(screen.getByRole("button", { name: "Rejeter" }));

    expect(await screen.findByText(/Decision humaine enregistree : rejeter/)).toBeInTheDocument();
    expect(getRequestPaths(fetchMock)).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions/2000/decision`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`
    ]);
    expect(JSON.parse(String((fetchMock.mock.calls[12]?.[1] as RequestInit).body))).toEqual({
      decision: "REJECT",
      latestImportVersion: 2,
      suggestionFingerprint:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    });
    expect(getRequestPaths(fetchMock).filter((path) => path.endsWith("/mappings/manual"))).toHaveLength(1);
    expect(getRequestPaths(fetchMock).filter((path) => path.endsWith("/controls"))).toHaveLength(1);
    expect(getRequestPaths(fetchMock).filter((path) => path.endsWith("/financial-summary"))).toHaveLength(1);
    expect(getRequestPaths(fetchMock).filter((path) => path.endsWith("/financial-statements/structured"))).toHaveLength(1);
    expect(getRequestPaths(fetchMock).filter((path) => path.endsWith("/workpapers"))).toHaveLength(1);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), 1, 1, 1, 2);
  });

  it("does not prefill the manual mapping select while an ACCEPT decision is pending", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    stubRandomUUID("route-pending-key-1");
    primeNominalRoute(fetchMock, {
      mappingSuggestions: () => jsonResponse(200, READY_MAPPING_SUGGESTIONS),
      extras: [() => new Promise<Response>(() => {})]
    });

    renderClosingRoute();
    await waitForNominalShell();
    await screen.findByLabelText("suggestion mapping 2000 a revoir");

    await user.click(screen.getByRole("button", { name: "Accepter" }));

    expect(await screen.findByText("Decision humaine en cours : accepter.")).toBeInTheDocument();
    expect(getLineTargetSelect("2000")).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledTimes(13);
  });

  it("sends the exact PUT payload on explicit save, shows success before refresh, and refreshes mapping plus controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    let resolveMappingRefresh: ((value: Response) => void) | undefined;
    let resolveControlsRefresh: ((value: Response) => void) | undefined;
    const mappingRefresh = new Promise<Response>((resolve) => {
      resolveMappingRefresh = resolve;
    });
    const controlsRefresh = new Promise<Response>((resolve) => {
      resolveControlsRefresh = resolve;
    });

    primeNominalRoute(fetchMock, {
      extras: [
        () =>
          jsonResponse(201, {
            accountCode: "2000",
            targetCode: "PL.REVENUE"
          }),
        () => mappingRefresh,
        () => controlsRefresh,
        () => jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY),
        () => jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED),
        () => jsonResponse(200, REFRESHED_WORKPAPERS),
        () => jsonResponse(200, REFRESHED_EMPTY_MAPPING_SUGGESTIONS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.selectOptions(getLineTargetSelect("2000"), "PL.REVENUE");
    await user.click(getLineSaveButton("2000"));

    expect(await screen.findByText("mapping enregistre avec succes")).toBeInTheDocument();
    expect(getRequestPaths(fetchMock)).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`
    ]);

    const putInit = fetchMock.mock.calls[12]?.[1] as RequestInit;
    const putHeaders = putInit.headers as Record<string, string>;
    expect(putInit.method).toBe("PUT");
    expect(putHeaders.Accept).toBe("application/json");
    expect(putHeaders["Content-Type"]).toBe("application/json");
    expect(putHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(putInit.body).toBe(JSON.stringify({ accountCode: "2000", targetCode: "PL.REVENUE" }));

    resolveMappingRefresh?.(jsonResponse(200, REFRESHED_MANUAL_MAPPING_AFTER_PUT));
    resolveControlsRefresh?.(jsonResponse(200, REFRESHED_CONTROLS));

    expect(
      await within(getLineDetailCard("2000", "Affectation actuelle")).findByText("Produit")
    ).toBeInTheDocument();
    expect(within(getLineDetailCard("2000", "Affectation actuelle")).getByText("PL.REVENUE")).toBeInTheDocument();
    expect(await screen.findByText("Manual mapping is complete on the latest import.")).toBeInTheDocument();
    expect(await screen.findByText("etat previsualisation : previsualisation prete")).toBeInTheDocument();
    expect(
      await screen.findByText("Suggestions pretes pour revue humaine. Aucune decision automatique.")
    ).toBeInTheDocument();
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), 2, 2, 2, 2);
  });

  it("renders a fail-closed mapping message and skips refresh when the PUT success payload is incoherent", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [() => jsonResponse(200, { accountCode: "2000" })]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.selectOptions(getLineTargetSelect("2000"), "PL.REVENUE");
    await user.click(getLineSaveButton("2000"));

    expect(
      await screen.findByText("mapping bloque par securite, donnees incoherentes")
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(13);
  });

  it.each([
    {
      response: () =>
        jsonResponse(400, {
          message: "accountCode is not present in the latest import."
        }),
      text: "compte absent du dernier import"
    },
    {
      response: () =>
        jsonResponse(400, {
          message: "targetCode is unknown."
        }),
      text: "target invalide"
    },
    {
      response: () => jsonResponse(400, { message: "other" }),
      text: "mapping invalide"
    },
    {
      response: () => jsonResponse(401, {}),
      text: "authentification requise"
    },
    {
      response: () => jsonResponse(403, {}),
      text: "acces mapping refuse"
    },
    {
      response: () => jsonResponse(404, {}),
      text: "dossier introuvable"
    },
    {
      response: () =>
        jsonResponse(409, {
          message: "Closing folder is archived and manual mappings cannot be modified."
        }),
      text: "dossier archive, mapping impossible"
    },
    {
      response: () =>
        jsonResponse(409, {
          message: "No balance import is available for manual mapping."
        }),
      text: "import requis"
    },
    {
      response: () => jsonResponse(409, { message: "other" }),
      text: "mapping impossible"
    },
    {
      response: () => jsonResponse(500, {}),
      text: "erreur serveur mapping"
    },
    {
      response: () => Promise.reject(new Error("network")),
      text: "erreur reseau mapping"
    },
    {
      response: () => Promise.reject(new Error("timeout")),
      text: "timeout mapping"
    },
    {
      response: () => jsonResponse(418, {}),
      text: "mapping indisponible"
    }
  ])("renders the exact PUT mutation state '$text'", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [response]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.selectOptions(getLineTargetSelect("2000"), "PL.REVENUE");
    await user.click(getLineSaveButton("2000"));

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(13);
  });

  it("sends the exact DELETE query param, keeps no body, and refreshes mapping plus controls after success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [
        () => new Response(null, { status: 204 }),
        () => jsonResponse(200, REFRESHED_MANUAL_MAPPING_AFTER_DELETE),
        () => jsonResponse(200, INITIAL_CONTROLS),
        () => jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY),
        () => jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED),
        () => jsonResponse(200, REFRESHED_WORKPAPERS),
        () => jsonResponse(200, REFRESHED_EMPTY_MAPPING_SUGGESTIONS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.click(getLineDeleteButton("1000"));

    expect(await screen.findByText("mapping supprime avec succes")).toBeInTheDocument();
    expect(getRequestPaths(fetchMock)).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual?accountCode=1000`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`
    ]);

    const deleteInit = fetchMock.mock.calls[12]?.[1] as RequestInit;
    const deleteHeaders = deleteInit.headers as Record<string, string>;
    expect(deleteInit.method).toBe("DELETE");
    expect(deleteHeaders.Accept).toBe("application/json");
    expect(deleteHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(deleteInit.body).toBeUndefined();
    expect(
      await within(getLineDetailCard("1000", "Affectation actuelle")).findByText(
        "Aucune affectation"
      )
    ).toBeInTheDocument();
    expect(await screen.findByText("etat previsualisation : previsualisation prete")).toBeInTheDocument();
    expect(
      await screen.findByText("Suggestions pretes pour revue humaine. Aucune decision automatique.")
    ).toBeInTheDocument();
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), 2, 2, 2, 2);
  });

  it("keeps the last valid mapping block and warns when the mapping refresh fails after a PUT success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [
        () =>
          jsonResponse(200, {
            accountCode: "2000",
            targetCode: "PL.REVENUE"
          }),
        () => jsonResponse(500, {}),
        () => jsonResponse(200, REFRESHED_CONTROLS),
        () => jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY),
        () => jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED),
        () => jsonResponse(200, REFRESHED_WORKPAPERS),
        () => jsonResponse(200, REFRESHED_EMPTY_MAPPING_SUGGESTIONS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.selectOptions(getLineTargetSelect("2000"), "PL.REVENUE");
    await user.click(getLineSaveButton("2000"));

    expect(await screen.findByText("mapping enregistre avec succes")).toBeInTheDocument();
    expect(screen.getByText("rafraichissement mapping impossible")).toBeInTheDocument();
    expect(
      within(getLineDetailCard("2000", "Affectation actuelle")).getByText(
        "Aucune affectation"
      )
    ).toBeInTheDocument();
    expect(getLineTargetSelect("2000")).toHaveValue("PL.REVENUE");
    expect(screen.getByText("Manual mapping is complete on the latest import.")).toBeInTheDocument();
  });

  it("keeps the last valid controls block and warns when the controls refresh fails after a DELETE success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [
        () => new Response(null, { status: 204 }),
        () => jsonResponse(200, REFRESHED_MANUAL_MAPPING_AFTER_DELETE),
        () => jsonResponse(500, {}),
        () => jsonResponse(200, REFRESHED_FINANCIAL_SUMMARY),
        () => jsonResponse(200, REFRESHED_FINANCIAL_STATEMENTS_STRUCTURED),
        () => jsonResponse(200, REFRESHED_WORKPAPERS),
        () => jsonResponse(200, REFRESHED_EMPTY_MAPPING_SUGGESTIONS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.click(getLineDeleteButton("1000"));

    expect(await screen.findByText("mapping supprime avec succes")).toBeInTheDocument();
    expect(screen.getByText("rafraichissement controles impossible")).toBeInTheDocument();
    expect(
      await within(getLineDetailCard("1000", "Affectation actuelle")).findByText(
        "Aucune affectation"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("1 account(s) remain unmapped on the latest import.")).toBeInTheDocument();
    expect(screen.queryByText("Manual mapping is complete on the latest import.")).not.toBeInTheDocument();
  });
});
