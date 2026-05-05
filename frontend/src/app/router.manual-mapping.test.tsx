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
      message: "Latest valid balance import version 2 is available."
    },
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      status: "FAIL",
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
    extras = []
  }: {
    me?: Record<string, unknown>;
    closingFolder?: typeof CLOSING_FOLDER;
    controls?: ResponseFactory;
    manualMapping?: ResponseFactory;
    financialSummary?: ResponseFactory;
    financialStatementsStructured?: ResponseFactory;
    workpapers?: ResponseFactory;
    extras?: ResponseFactory[];
  } = {}
) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, me))
    .mockResolvedValueOnce(jsonResponse(200, closingFolder))
    .mockImplementationOnce(() => Promise.resolve(controls()))
    .mockImplementationOnce(() => Promise.resolve(manualMapping()))
    .mockImplementationOnce(() => Promise.resolve(financialSummary()))
    .mockImplementationOnce(() => Promise.resolve(financialStatementsStructured()))
    .mockImplementationOnce(() => Promise.resolve(workpapers()))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
    .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX));

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
  expect(await screen.findByText("Audit-ready export pack")).toBeInTheDocument();
  expect(await screen.findByText("No audit-ready pack generated yet.")).toBeInTheDocument();
  expect(await screen.findByText("Minimal annex preview")).toBeInTheDocument();
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
  expectedWorkpapersCalls = 1
) {
  expect(paths.some((path) => path.includes("/imports/balance"))).toBe(false);
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
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
  expect(paths.some((path) => /\/workpapers\/[^/]+/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/documents"))).toBe(false);
  expect(paths.some((path) => /\/export-packs\/[^/]+\/content$/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
}

describe("router manual mapping", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("places Mapping manuel between Import balance and Controles and only loads controls plus manual mapping after me then dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    const importHeading = screen.getByRole("heading", { name: "Upload CSV" });
    const mappingHeading = getMappingHeading();
    const controlsHeading = screen.getByRole("heading", { name: "Cockpit read-only" });

    expect(Boolean(importHeading.compareDocumentPosition(mappingHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(mappingHeading.compareDocumentPosition(controlsHeading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(getRequestPaths(fetchMock)).toEqual([
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
    expect(getRequestHeaders(fetchMock, 0)["X-Tenant-Id"]).toBeUndefined();
    expect(getRequestHeaders(fetchMock, 1)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 2)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 3)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 4)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 5)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 6)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(getRequestHeaders(fetchMock, 7)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock));
  });

  it("keeps Dossier courant, Import balance and Controles visible when the mapping block fails", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, {
      controls: () => jsonResponse(200, REFRESHED_CONTROLS),
      manualMapping: () => jsonResponse(500, {})
    });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText("erreur serveur mapping")).toBeInTheDocument();
    expect(screen.getByText("Closing FY26")).toBeInTheDocument();
    expect(screen.getByText("aucun fichier selectionne")).toBeInTheDocument();
    expect(screen.getByText("Readiness")).toBeInTheDocument();
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
    expect(screen.getByText("chargement controls")).toBeInTheDocument();
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
      text: "payload mapping invalide"
    }
  ])("renders the exact mapping read state '$text'", async ({ factory, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock, { manualMapping: factory });

    renderClosingRoute();
    await waitForNominalShell();

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cockpit read-only" })).toBeInTheDocument();
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
      ).toEqual(["Choisir une cible", "Actif (BS.ASSET)", "Produit (PL.REVENUE)"]);
      expect(
        within(getLineDetailCard("1000", "Mapping courant")).getByText("Actif (BS.ASSET)")
      ).toBeInTheDocument();
      expect(within(getLineDetailCard("2000", "Mapping courant")).getByText("aucun")).toBeInTheDocument();
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

    expect(fetchMock).toHaveBeenCalledTimes(9);
    expect(getLineSaveButton("2000")).toBeEnabled();

    await user.click(getLineSaveButton("2000"));

    expect(await screen.findByText("enregistrement mapping en cours")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(getLineTargetSelect("1000")).toBeDisabled();
    expect(getLineTargetSelect("2000")).toBeDisabled();
    expect(getLineSaveButton("1000")).toBeDisabled();
    expect(getLineSaveButton("2000")).toBeDisabled();
    expect(getLineDeleteButton("1000")).toBeDisabled();

    await user.click(getLineDeleteButton("1000"));
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock));
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
        () => controlsRefresh
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
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
    ]);

    const putInit = fetchMock.mock.calls[9]?.[1] as RequestInit;
    const putHeaders = putInit.headers as Record<string, string>;
    expect(putInit.method).toBe("PUT");
    expect(putHeaders.Accept).toBe("application/json");
    expect(putHeaders["Content-Type"]).toBe("application/json");
    expect(putHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(putInit.body).toBe(JSON.stringify({ accountCode: "2000", targetCode: "PL.REVENUE" }));

    resolveMappingRefresh?.(jsonResponse(200, REFRESHED_MANUAL_MAPPING_AFTER_PUT));
    resolveControlsRefresh?.(jsonResponse(200, REFRESHED_CONTROLS));

    expect(
      await within(getLineDetailCard("2000", "Mapping courant")).findByText("Produit (PL.REVENUE)")
    ).toBeInTheDocument();
    expect(await screen.findByText("Manual mapping is complete on the latest import.")).toBeInTheDocument();
    expect(screen.getByText("etat preview : preview partielle")).toBeInTheDocument();
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), 1);
  });

  it("renders payload mapping invalide and skips refresh when the PUT success payload is incoherent", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [() => jsonResponse(200, { accountCode: "2000" })]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.selectOptions(getLineTargetSelect("2000"), "PL.REVENUE");
    await user.click(getLineSaveButton("2000"));

    expect(await screen.findByText("payload mapping invalide")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(10);
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
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it("sends the exact DELETE query param, keeps no body, and refreshes mapping plus controls after success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock, {
      extras: [
        () => new Response(null, { status: 204 }),
        () => jsonResponse(200, REFRESHED_MANUAL_MAPPING_AFTER_DELETE),
        () => jsonResponse(200, INITIAL_CONTROLS)
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
      `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual?accountCode=1000`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
    ]);

    const deleteInit = fetchMock.mock.calls[9]?.[1] as RequestInit;
    const deleteHeaders = deleteInit.headers as Record<string, string>;
    expect(deleteInit.method).toBe("DELETE");
    expect(deleteHeaders.Accept).toBe("application/json");
    expect(deleteHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(deleteInit.body).toBeUndefined();
    expect(await within(getLineDetailCard("1000", "Mapping courant")).findByText("aucun")).toBeInTheDocument();
    expect(screen.getByText("etat preview : preview partielle")).toBeInTheDocument();
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), 1);
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
        () => jsonResponse(200, REFRESHED_CONTROLS)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.selectOptions(getLineTargetSelect("2000"), "PL.REVENUE");
    await user.click(getLineSaveButton("2000"));

    expect(await screen.findByText("mapping enregistre avec succes")).toBeInTheDocument();
    expect(screen.getByText("rafraichissement mapping impossible")).toBeInTheDocument();
    expect(within(getLineDetailCard("2000", "Mapping courant")).getByText("aucun")).toBeInTheDocument();
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
        () => jsonResponse(500, {})
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.click(getLineDeleteButton("1000"));

    expect(await screen.findByText("mapping supprime avec succes")).toBeInTheDocument();
    expect(screen.getByText("rafraichissement controls impossible")).toBeInTheDocument();
    expect(await within(getLineDetailCard("1000", "Mapping courant")).findByText("aucun")).toBeInTheDocument();
    expect(screen.getByText("1 account(s) remain unmapped on the latest import.")).toBeInTheDocument();
    expect(screen.queryByText("Manual mapping is complete on the latest import.")).not.toBeInTheDocument();
  });
});
