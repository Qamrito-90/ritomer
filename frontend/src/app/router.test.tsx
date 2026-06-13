import { act } from "react";
import { RouterProvider } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { vi } from "vitest";
import { createAppMemoryRouter } from "./router";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "../lib/api/http";

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

const ENTRYPOINT_PRIMARY_FOLDER = {
  ...CLOSING_FOLDER,
  archivedAt: null
};

const ENTRYPOINT_ARCHIVED_FOLDER = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  tenantId: ACTIVE_TENANT.tenantId,
  name: "Closing FY25",
  periodStartOn: "2025-01-01",
  periodEndOn: "2025-12-31",
  externalRef: null,
  status: "ARCHIVED",
  archivedAt: "2026-01-15T10:30:00Z"
};

const ENTRYPOINT_OTHER_TENANT_FOLDER = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  tenantId: "22222222-2222-2222-2222-222222222222",
  name: "Cross-tenant folder",
  periodStartOn: "2024-01-01",
  periodEndOn: "2024-12-31",
  externalRef: "EXT-X",
  status: "DRAFT",
  archivedAt: null
};

const READY_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
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
};

const BLOCKED_CONTROLS = {
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

const DEFAULT_MANUAL_MAPPING = {
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

const DEFAULT_FINANCIAL_SUMMARY = {
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
    debitTotal: "100",
    creditTotal: "0",
    netDebitMinusCredit: "100"
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

const DEFAULT_FINANCIAL_STATEMENTS_STRUCTURED = {
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

const DEFAULT_WORKPAPERS = {
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

const READY_IMPORT_VERSIONS = [
  {
    closingFolderId: CLOSING_FOLDER.id,
    version: 3,
    importedAt: "2026-05-14T09:00:00Z",
    rowCount: 3,
    totalDebit: "150",
    totalCredit: "150"
  },
  ...DEFAULT_IMPORT_VERSIONS
];

const DEFAULT_IMPORT_DIFF = {
  version: 2,
  previousVersion: 1,
  added: [],
  removed: [],
  changed: []
};

const READY_IMPORT_DIFF = {
  version: 3,
  previousVersion: 2,
  added: [],
  removed: [],
  changed: []
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

function renderRoute(initialEntry: string) {
  const router = createAppMemoryRouter([initialEntry]);
  return render(<RouterProvider router={router} />);
}

function expectVisibleText(text: string) {
  return screen.findByText(new RegExp(`^${text}$`));
}

function expectNodeBefore(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

function expectDefinitionValue(container: HTMLElement, label: string, value: string) {
  const labelNode = within(container).getByText(new RegExp(`^${label}$`));
  const valueNode = labelNode.parentElement?.querySelector("dd");

  expect(valueNode).not.toBeNull();
  expect(valueNode).toHaveTextContent(value);
}

function getRequestHeaders(fetchMock: ReturnType<typeof vi.fn>, index: number) {
  return ((fetchMock.mock.calls[index]?.[1] as RequestInit | undefined)?.headers ?? {}) as Record<
    string,
    string
  >;
}

function primeClosingRoute(
  fetchMock: ReturnType<typeof vi.fn>,
  controlsResponse: Promise<Response>,
  manualMappingResponse = Promise.resolve(jsonResponse(200, DEFAULT_MANUAL_MAPPING)),
  financialSummaryResponse = Promise.resolve(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY)),
  financialStatementsStructuredResponse = Promise.resolve(
    jsonResponse(200, DEFAULT_FINANCIAL_STATEMENTS_STRUCTURED)
  ),
  workpapersResponse = Promise.resolve(jsonResponse(200, DEFAULT_WORKPAPERS))
) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
    .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
    .mockImplementationOnce(() => controlsResponse)
    .mockImplementationOnce(() => manualMappingResponse)
    .mockImplementationOnce(() => financialSummaryResponse)
    .mockImplementationOnce(() => financialStatementsStructuredResponse)
    .mockImplementationOnce(() => workpapersResponse)
    .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_VERSIONS))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS))
    .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
    .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX))
    .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_DIFF));
}

function expectNoControlsNominalBlocks() {
  expect(screen.queryByRole("heading", { name: "Resume de preparation" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Prochaine action" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Comptes non mappes" })).not.toBeInTheDocument();
}

function expectNoPrototypeMicrocopy(container: HTMLElement = document.body) {
  [
    "Controls",
    "Workpapers",
    "Maker update unitaire",
    "Resume workpapers",
    "anchors courants",
    "anchors sans workpaper",
    "added",
    "removed",
    "changed",
    "Previews read-only",
    "Financial summary",
    "Financial statements structured",
    "Zone d action",
    "Liste read-only",
    "Entree produit V1",
    "Shell lecture seule du frontend V1"
  ].forEach((text) => {
    expect(container).not.toHaveTextContent(text);
  });
}

async function expectControlsState(text: string) {
  expect(await expectVisibleText(text)).toBeInTheDocument();
  expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
  expect(screen.getByText("Dossier courant")).toBeInTheDocument();
  expect(screen.getByText("Closing FY26")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Controles" })).toBeInTheDocument();
  expect(await screen.findByText("Aucun pack auditable genere.")).toBeInTheDocument();
  expect(await screen.findByText("Suggestions de mapping a revoir")).toBeInTheDocument();
  expect(await screen.findByText("Annexe minimale")).toBeInTheDocument();
  expectNoControlsNominalBlocks();
}

async function flushTimeout() {
  await act(async () => {
    vi.advanceTimersByTime(DEFAULT_REQUEST_TIMEOUT_MS);
    await Promise.resolve();
  });
}

async function openWorkbenchPanel(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("tab", { name: label }));
}

describe("router", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("/", () => {
    it("renders chargement dossiers while /api/me is pending", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockImplementationOnce(() => new Promise(() => {}));

      renderRoute("/");

      expect(await expectVisibleText("chargement dossiers")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
      expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
      expect(screen.queryByText("Portefeuille de closing")).not.toBeInTheDocument();
    });

    it("renders authentification requise on /api/me 401 and never calls /api/closing-folders", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

      renderRoute("/");

      expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
      expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
    });

    it("renders contexte tenant requis on /api/me 200 with activeTenant null and never calls /api/closing-folders", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: null }));

      renderRoute("/");

      expect(await expectVisibleText("contexte tenant requis")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
    });

    it("renders profil indisponible on /api/me invalid payload and never calls /api/closing-folders", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: { tenantId: "x" } }));

      renderRoute("/");

      expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
    });

    it("renders authentification requise on /api/closing-folders 401 with tenant visible", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(401, {}));

      renderRoute("/");

      expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(screen.getByText("Portefeuille de closing")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/closing-folders");
    });

    it("renders acces dossiers refuse on /api/closing-folders 403", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(403, {}));

      renderRoute("/");

      expect(await expectVisibleText("acces dossiers refuse")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(screen.getByText("Portefeuille de closing")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Ouvrir" })).not.toBeInTheDocument();
    });

    it("renders dossiers indisponibles on /api/closing-folders invalid payload", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(
          jsonResponse(200, [
            {
              id: CLOSING_FOLDER.id,
              tenantId: ACTIVE_TENANT.tenantId,
              name: CLOSING_FOLDER.name
            }
          ])
        );

      renderRoute("/");

      expect(await expectVisibleText("dossiers indisponibles")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(screen.getByText("Portefeuille de closing")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Ouvrir" })).not.toBeInTheDocument();
    });

    it("renders aucun dossier de closing when the tenant-filtered list is empty", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, [ENTRYPOINT_OTHER_TENANT_FOLDER]));

      renderRoute("/");

      expect(await expectVisibleText("aucun dossier de closing")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(screen.getByText("Portefeuille de closing")).toBeInTheDocument();
      expect(screen.queryByText("Cross-tenant folder")).not.toBeInTheDocument();
    });

    it("renders the nominal list in backend order, filters cross-tenant rows, sends X-Tenant-Id, avoids /controls, removes the manual UUID entrypoint, and stays accessible", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(
          jsonResponse(200, [
            ENTRYPOINT_PRIMARY_FOLDER,
            ENTRYPOINT_OTHER_TENANT_FOLDER,
            ENTRYPOINT_ARCHIVED_FOLDER
          ])
        );

      const { container } = renderRoute("/");

      const firstFolder = await screen.findByText("Closing FY26");
      const archivedFolder = await screen.findByText("Closing FY25");
      const archivedCard = archivedFolder.closest("article");

      expect(firstFolder).toBeInTheDocument();
      expect(archivedFolder).toBeInTheDocument();
      expectNodeBefore(firstFolder, archivedFolder);
      expect(screen.queryByText("Cross-tenant folder")).not.toBeInTheDocument();
      expect(screen.getAllByRole("link", { name: "Ouvrir" })).toHaveLength(2);
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(screen.getByText("Portefeuille de closing")).toBeInTheDocument();
      expect(screen.queryByLabelText("Closing folder id")).not.toBeInTheDocument();
      expect(screen.queryByText("Surface de demonstration interne")).not.toBeInTheDocument();

      expect(archivedCard).not.toBeNull();
      expect(within(archivedCard as HTMLElement).getByText("Reference externe")).toBeInTheDocument();
      expect(within(archivedCard as HTMLElement).getByText("aucune")).toBeInTheDocument();
      expect(within(archivedCard as HTMLElement).getByText("Archive")).toBeInTheDocument();

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
      expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/closing-folders");
      expect(getRequestHeaders(fetchMock, 0)["X-Tenant-Id"]).toBeUndefined();
      expect(getRequestHeaders(fetchMock, 1)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(fetchMock.mock.calls.map((call) => String(call[0]))).not.toContain(
        `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
      );
      expect((await axe(container)).violations).toEqual([]);
      expectNoPrototypeMicrocopy(container);
    });

    it("navigates with Ouvrir to /closing-folders/:closingFolderId and reuses the existing shell and cockpit", async () => {
      const fetchMock = vi.mocked(global.fetch);
      const user = userEvent.setup();
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, [ENTRYPOINT_PRIMARY_FOLDER]))
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
        .mockResolvedValueOnce(jsonResponse(200, READY_CONTROLS))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_MANUAL_MAPPING))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_STATEMENTS_STRUCTURED))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_WORKPAPERS))
        .mockResolvedValueOnce(jsonResponse(200, READY_IMPORT_VERSIONS))
        .mockResolvedValueOnce(jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS))
        .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
        .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX))
        .mockResolvedValueOnce(jsonResponse(200, READY_IMPORT_DIFF));

      renderRoute("/");

      const folderCard = (await screen.findByText("Closing FY26")).closest("article");
      expect(folderCard).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls.map((call) => String(call[0]))).not.toContain(
        `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
      );

      await user.click(within(folderCard as HTMLElement).getByRole("link", { name: "Ouvrir" }));

      expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
      expect(await screen.findByText("Etat de preparation")).toBeInTheDocument();
      expect(await screen.findByText("Justifications / Preuves")).toBeInTheDocument();
      expect(await screen.findByText("Suggestions de mapping a revoir")).toBeInTheDocument();
      expect(await screen.findByText("Aucun pack auditable genere.")).toBeInTheDocument();
      expect(await screen.findByText("Annexe minimale")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(14);
      expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/me");
      expect(fetchMock.mock.calls[3]?.[0]).toBe(`/api/closing-folders/${CLOSING_FOLDER.id}`);
      expect(fetchMock.mock.calls[4]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
      );
      expect(fetchMock.mock.calls[5]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`
      );
      expect(fetchMock.mock.calls[6]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`
      );
      expect(fetchMock.mock.calls[7]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`
      );
      expect(fetchMock.mock.calls[8]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`
      );
      expect(fetchMock.mock.calls[9]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`
      );
      expect(fetchMock.mock.calls[10]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`
      );
      expect(fetchMock.mock.calls[11]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`
      );
      expect(fetchMock.mock.calls[12]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`
      );
      expect(fetchMock.mock.calls[13]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/3/diff-previous`
      );
    });
  });

  describe("/closing-folders/:closingFolderId", () => {
    it("renders authentification requise on /api/me 401 and never calls dossier", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders contexte tenant requis on /api/me 200 with activeTenant null and never calls dossier", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: null }));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("contexte tenant requis")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
    });

    it("renders profil indisponible on /api/me 403 and never calls dossier", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("renders profil indisponible on /api/me 5xx and never calls dossier", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("renders profil indisponible on /api/me network failure and never calls dossier", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockRejectedValueOnce(new Error("network"));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("renders profil indisponible on /api/me timeout and never calls dossier", async () => {
      vi.useFakeTimers();
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockImplementationOnce(() => new Promise(() => {}));

      renderRoute(CLOSING_ROUTE);
      await flushTimeout();
      vi.useRealTimers();

      expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("renders profil indisponible on /api/me invalid payload and never calls dossier", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: { tenantId: "x" } }));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("renders authentification requise on dossier 401, keeps tenant visible, and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(401, {}));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders acces dossier refuse on dossier 403 and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(403, {}));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("acces dossier refuse")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders dossier introuvable on dossier 404 and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(404, {}));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("dossier introuvable")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders dossier indisponible on dossier 5xx and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(500, {}));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders dossier indisponible on dossier network failure and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockRejectedValueOnce(new Error("network"));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders dossier indisponible on dossier timeout and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockRejectedValueOnce(new Error("timeout"));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders dossier indisponible on dossier invalid payload and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, { id: CLOSING_FOLDER.id, tenantId: ACTIVE_TENANT.tenantId }));

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders incoherence tenant dossier on tenant mismatch and never calls controls", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(
          jsonResponse(200, {
            ...CLOSING_FOLDER,
            tenantId: "22222222-2222-2222-2222-222222222222"
          })
        );

      renderRoute(CLOSING_ROUTE);

      expect(await expectVisibleText("incoherence tenant dossier")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
    });

    it("renders the dossier block first, then the controls loading slot while controls are pending", async () => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(fetchMock, new Promise(() => {}));

      renderRoute(CLOSING_ROUTE);

      expect(await screen.findByText("Closing FY26")).toBeInTheDocument();
      expect(screen.getByText("Dossier courant")).toBeInTheDocument();
      expect(await expectVisibleText("chargement controles")).toBeInTheDocument();
      expect(await screen.findByText("Aucun pack auditable genere.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(12);
      expectNoControlsNominalBlocks();
    });

    it("renders the 038 cockpit summary before detailed sections without endpoint or raw id noise", async () => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(
        fetchMock,
        Promise.resolve(jsonResponse(200, BLOCKED_CONTROLS)),
        Promise.resolve(jsonResponse(200, DEFAULT_MANUAL_MAPPING)),
        Promise.resolve(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY)),
        Promise.resolve(jsonResponse(200, DEFAULT_FINANCIAL_STATEMENTS_STRUCTURED)),
        Promise.resolve(
          jsonResponse(200, {
            ...DEFAULT_WORKPAPERS,
            closingFolderStatus: "DRAFT",
            readiness: "BLOCKED"
          })
        )
      );

      renderRoute(CLOSING_ROUTE);

      const cockpit = await screen.findByRole("region", { name: "Closing FY26" });

      expect(within(cockpit).getByText("Dossier courant")).toBeInTheDocument();
      expect(within(cockpit).getByText("Dossier bloque")).toBeInTheDocument();
      expect(within(cockpit).getByText("Revue humaine requise")).toBeInTheDocument();
      expect(within(cockpit).getByText("Statut")).toBeInTheDocument();
      expect(within(cockpit).getByText("Reference dossier")).toBeInTheDocument();
      expect(within(cockpit).getByText("Debut periode")).toBeInTheDocument();
      expect(within(cockpit).getByText("Fin periode")).toBeInTheDocument();
      expect(within(cockpit).getByText("Prochaine action")).toBeInTheDocument();
      expect(within(cockpit).getByText("Reprendre le mapping")).toBeInTheDocument();
      expect(within(cockpit).getByText("Blockers principaux")).toBeInTheDocument();
      expect(within(cockpit).getByText("Mapping manuel incomplet")).toBeInTheDocument();
      expect(within(cockpit).getByText("Ce qui est pret")).toBeInTheDocument();
      expect(within(cockpit).getByText("Preuves et revue")).toBeInTheDocument();
      expect(
        within(cockpit).getByText("0/0 justification(s), 0 piece(s), 0 pret(s) pour revue, 0 revu(s).")
      ).toBeInTheDocument();
      expect(within(cockpit).getByText("Previsualisations et export")).toBeInTheDocument();
      expect(
        within(cockpit).getByText(
          "Synthese financiere partielle - Previsualisation structuree bloquee. Previsualisation non statutaire. Revue humaine requise."
        )
      ).toBeInTheDocument();

      const progression = within(cockpit).getByLabelText("progression closing");
      expect(progression).toHaveTextContent("Closing");
      expect(progression).toHaveTextContent("Import");
      expect(progression).toHaveTextContent("Mapping");
      expect(progression).toHaveTextContent("Controles");
      expect(progression).toHaveTextContent("Previsualisations");
      expect(progression).toHaveTextContent("Preuves");
      expect(progression).toHaveTextContent("Export");
      expect(progression).toHaveTextContent("indetermine");

      expect(within(cockpit).getByRole("navigation", { name: "Sections du dossier" })).toBeInTheDocument();
      expect(cockpit).not.toHaveTextContent("/api/");
      expect(cockpit).not.toHaveTextContent(CLOSING_FOLDER.id);
      expect(cockpit).not.toHaveTextContent(ACTIVE_TENANT.tenantId);
      expect(cockpit).not.toHaveTextContent("Prepared for human review");
      expect(cockpit).not.toHaveTextContent("Status");
      expect(cockpit).not.toHaveTextContent("External ref");
      expect(cockpit).not.toHaveTextContent("Period start on");
      expect(cockpit).not.toHaveTextContent("Period end on");
      expect(cockpit).not.toHaveTextContent("Human review required");
      expect(cockpit).not.toHaveTextContent("ready for review");
      expect(cockpit).not.toHaveTextContent("reviewed");
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    it("renders a compact workbench with tabs, one active detail panel, and structural overflow guards", async () => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(200, BLOCKED_CONTROLS)));

      const { container } = renderRoute(CLOSING_ROUTE);

      const cockpit = await screen.findByRole("region", { name: "Closing FY26" });
      const tablist = within(cockpit).getByRole("tablist", { name: "Panneaux du workbench" });
      const overviewPanel = await screen.findByRole("tabpanel", { name: "Vue d'ensemble" });

      expect(container.firstElementChild).toHaveClass("overflow-x-hidden");
      expect(container.querySelector("main")).toHaveClass("min-w-0", "overflow-x-hidden");
      expect(overviewPanel).toHaveClass("min-w-0", "overflow-x-hidden");
      expect(within(tablist).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
        "Vue d'ensemble",
        "Import",
        "Mapping",
        "Controles",
        "Previsualisations",
        "Preuves",
        "Export"
      ]);
      expect(within(tablist).getByRole("tab", { name: "Vue d'ensemble" })).toHaveAttribute(
        "aria-selected",
        "true"
      );
      expect(screen.getAllByRole("tabpanel")).toHaveLength(1);
      expect(screen.queryByRole("tabpanel", { name: "Import" })).not.toBeInTheDocument();
      expect(screen.queryByRole("tabpanel", { name: "Mapping" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Revue des imports balance" })).not.toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Projection du dernier import" })).not.toBeInTheDocument();

      expect(within(cockpit).getByText("Tenant actif : Tenant Alpha - Periode :")).toBeInTheDocument();
      expect(within(cockpit).getByText("Dossier bloque")).toBeInTheDocument();
      expect(within(cockpit).getByText("Prochaine action")).toBeInTheDocument();
      expect(within(cockpit).getByText("Mapping manuel incomplet")).toBeInTheDocument();
      expect(within(cockpit).getByLabelText("progression closing")).toHaveTextContent("Mapping");
      expect(within(overviewPanel).getByText("Decision du moment")).toBeInTheDocument();
      expect(within(overviewPanel).getByText("Tenant Alpha")).toBeInTheDocument();
      expect(within(overviewPanel).getByText("Points a traiter")).toBeInTheDocument();
      expect(overviewPanel).not.toHaveTextContent("/api/");
      expect(overviewPanel).not.toHaveTextContent(CLOSING_FOLDER.id);
      expect(overviewPanel).not.toHaveTextContent(ACTIVE_TENANT.tenantId);
      expectNoPrototypeMicrocopy(cockpit);
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    it("keeps long mapping rows bounded with wrapping fields and aligned actions", async () => {
      const fetchMock = vi.mocked(global.fetch);
      const longAccountCode = "999999999999999999999999999999999999999999";
      const longAccountLabel =
        "Libelle tres long pour verifier que la ligne de mapping ne force pas un scroll horizontal sauvage dans le workbench";
      const longMapping = {
        ...DEFAULT_MANUAL_MAPPING,
        summary: {
          total: 1,
          mapped: 0,
          unmapped: 1
        },
        lines: [
          {
            accountCode: longAccountCode,
            accountLabel: longAccountLabel,
            debit: "1234567890.00",
            credit: "0"
          }
        ],
        mappings: [],
        targets: [
          {
            code: "PL.REVENUE.EXTRA.LONG.TARGET.CODE",
            label: "Produit avec libelle long",
            selectable: true
          }
        ]
      };

      primeClosingRoute(
        fetchMock,
        Promise.resolve(jsonResponse(200, BLOCKED_CONTROLS)),
        Promise.resolve(jsonResponse(200, longMapping))
      );

      renderRoute(CLOSING_ROUTE);

      expect(await screen.findByRole("region", { name: "Closing FY26" })).toBeInTheDocument();
      await openWorkbenchPanel("Mapping");

      const mappingPanel = screen.getByRole("tabpanel", { name: "Mapping" });
      const mappingTable = within(mappingPanel).getByRole("table", {
        name: "Table de revue du mapping manuel"
      });
      const mappingLine = await within(mappingPanel).findByLabelText(`ligne mapping ${longAccountCode}`);

      expect(mappingPanel).toHaveClass("overflow-x-hidden");
      expect(mappingTable.parentElement).toHaveClass("min-w-0", "overflow-hidden");
      expect(mappingTable.querySelector("article")).toBeNull();
      expect(mappingLine).toHaveClass("min-w-0");
      expect(within(mappingLine).getByText(longAccountCode)).toHaveClass("break-all");
      expect(within(mappingLine).getByText(longAccountLabel)).toHaveClass("break-words");
      expect(within(mappingLine).getByLabelText("Cible")).toHaveClass(
        "w-full",
        "min-w-0",
        "max-w-full",
        "truncate"
      );
      expect(within(mappingLine).getByRole("button", { name: "Enregistrer le mapping" })).toHaveClass(
        "w-full"
      );
      expect(within(mappingLine).getByRole("button", { name: "Supprimer le mapping" })).toHaveClass(
        "w-full"
      );
      expect(mappingPanel).not.toHaveTextContent("/api/");
      expect(mappingPanel).not.toHaveTextContent(CLOSING_FOLDER.id);
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    it.each([
      { status: 401, text: "authentification requise" },
      { status: 403, text: "acces controles refuse" },
      { status: 404, text: "controles introuvables" },
      { status: 500, text: "erreur serveur controles" },
      { status: 400, text: "controles indisponibles" }
    ])("renders the exact controls state for HTTP $status", async ({ status, text }) => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(status, {})));

      renderRoute(CLOSING_ROUTE);

      await expectControlsState(text);
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    it("renders erreur reseau controles on a controls network failure", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_MANUAL_MAPPING))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_STATEMENTS_STRUCTURED))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_WORKPAPERS))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_VERSIONS))
        .mockResolvedValueOnce(jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS))
        .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
        .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_DIFF));

      renderRoute(CLOSING_ROUTE);

      await expectControlsState("erreur reseau controles");
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    it("renders timeout controles on a controls timeout failure", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_MANUAL_MAPPING))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_STATEMENTS_STRUCTURED))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_WORKPAPERS))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_VERSIONS))
        .mockResolvedValueOnce(jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS))
        .mockResolvedValueOnce(jsonResponse(200, EMPTY_EXPORT_PACKS))
        .mockResolvedValueOnce(jsonResponse(200, BLOCKED_MINIMAL_ANNEX))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_IMPORT_DIFF));

      renderRoute(CLOSING_ROUTE);

      await expectControlsState("timeout controles");
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    it("renders payload controles invalide when the controls payload is incomplete", async () => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(
        fetchMock,
        Promise.resolve(
          jsonResponse(200, {
            ...READY_CONTROLS,
            controls: [READY_CONTROLS.controls[1], READY_CONTROLS.controls[0]]
          })
        )
      );

      renderRoute(CLOSING_ROUTE);

      await expectControlsState("payload controles invalide");
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });

    it("renders the exact READY controls blocks in order and stays accessible", async () => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(200, READY_CONTROLS)));

      const { container } = renderRoute(CLOSING_ROUTE);

      expect(await screen.findByText("Closing FY26")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(screen.getByText("EXT-26")).toBeInTheDocument();
      expect(screen.getByText("01.01.2026")).toBeInTheDocument();
      expect(screen.getByText("31.12.2026")).toBeInTheDocument();
      expect(screen.getByText("DRAFT")).toBeInTheDocument();

      await openWorkbenchPanel("Controles");

      const readinessHeading = screen.getByRole("heading", { name: "Resume de preparation" });
      const controlsHeading = screen.getByRole("heading", { name: "Controles" });
      const nextActionHeading = screen.getByRole("heading", { name: "Prochaine action" });
      const unmappedHeading = screen.getByRole("heading", { name: "Comptes non mappes" });

      expectNodeBefore(readinessHeading, controlsHeading);
      expectNodeBefore(controlsHeading, nextActionHeading);
      expectNodeBefore(nextActionHeading, unmappedHeading);

      const readinessBlock = readinessHeading.closest("section");
      const controlsBlock = controlsHeading.closest("section");
      const nextActionBlock = nextActionHeading.closest("section");
      const unmappedBlock = unmappedHeading.closest("section");

      expect(readinessBlock).not.toBeNull();
      expect(controlsBlock).not.toBeNull();
      expect(nextActionBlock).not.toBeNull();
      expect(unmappedBlock).not.toBeNull();

      expectDefinitionValue(readinessBlock as HTMLElement, "etat de preparation", "pret");
      expectDefinitionValue(readinessBlock as HTMLElement, "dernier import valide", "present");
      expectDefinitionValue(readinessBlock as HTMLElement, "version d import", "3");
      expectDefinitionValue(readinessBlock as HTMLElement, "comptes total", "2");
      expectDefinitionValue(readinessBlock as HTMLElement, "comptes mappes", "2");
      expectDefinitionValue(readinessBlock as HTMLElement, "comptes non mappes", "0");

      expect(within(controlsBlock as HTMLElement).getByText("dernier import valide")).toBeInTheDocument();
      expect(within(controlsBlock as HTMLElement).getByText("mapping manuel complet")).toBeInTheDocument();
      expect(within(controlsBlock as HTMLElement).getAllByText("ok")).toHaveLength(2);
      expect(
        within(controlsBlock as HTMLElement).getByText(READY_CONTROLS.controls[0].message)
      ).toBeInTheDocument();
      expect(
        within(controlsBlock as HTMLElement).getByText(READY_CONTROLS.controls[1].message)
      ).toBeInTheDocument();

      expect(within(nextActionBlock as HTMLElement).getByText("aucune action requise")).toBeInTheDocument();
      expect(within(unmappedBlock as HTMLElement).getByText("aucun compte non mappe")).toBeInTheDocument();

      expect(screen.queryByText(ACTIVE_TENANT.tenantId)).not.toBeInTheDocument();
      expect(screen.queryByText(CLOSING_FOLDER.id)).not.toBeInTheDocument();
      expect(await screen.findByText("Aucun pack auditable genere.")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(12);

      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
      expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/closing-folders/${CLOSING_FOLDER.id}`);
      expect(fetchMock.mock.calls[2]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
      );
      expect(fetchMock.mock.calls[3]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`
      );
      expect(fetchMock.mock.calls[4]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`
      );
      expect(fetchMock.mock.calls[5]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`
      );
      expect(fetchMock.mock.calls[6]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`
      );
      expect(fetchMock.mock.calls[7]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions`
      );
      expect((fetchMock.mock.calls[7]?.[1] as RequestInit | undefined)?.method).toBe("GET");
      expect(fetchMock.mock.calls[8]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/suggestions`
      );
      expect(fetchMock.mock.calls[9]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs`
      );
      expect(fetchMock.mock.calls[10]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex`
      );
      expect(fetchMock.mock.calls[11]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/imports/balance/versions/2/diff-previous`
      );
      expect(getRequestHeaders(fetchMock, 0)["X-Tenant-Id"]).toBeUndefined();
      expect(getRequestHeaders(fetchMock, 1)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 2)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 3)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 4)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 5)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 6)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 7)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 7).Accept).toBe("application/json");
      expect(getRequestHeaders(fetchMock, 8)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 9)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect((await axe(container)).violations).toEqual([]);
      expectNoPrototypeMicrocopy(container);
    });

    it("renders the exact BLOCKED controls blocks, keeps backend order, and keeps nextAction.path read-only", async () => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(200, BLOCKED_CONTROLS)));

      renderRoute(CLOSING_ROUTE);

      expect(await screen.findByText("Closing FY26")).toBeInTheDocument();
      expect(await screen.findByText("Aucun pack auditable genere.")).toBeInTheDocument();

      await openWorkbenchPanel("Controles");

      const readinessBlock = screen.getByRole("heading", { name: "Resume de preparation" }).closest("section");
      const controlsBlock = screen.getByRole("heading", { name: "Controles" }).closest("section");
      const nextActionBlock = screen.getByRole("heading", { name: "Prochaine action" }).closest("section");
      const unmappedBlock = screen
        .getByRole("heading", { name: "Comptes non mappes" })
        .closest("section");

      expect(readinessBlock).not.toBeNull();
      expect(controlsBlock).not.toBeNull();
      expect(nextActionBlock).not.toBeNull();
      expect(unmappedBlock).not.toBeNull();

      expectDefinitionValue(readinessBlock as HTMLElement, "etat de preparation", "bloque");
      expectDefinitionValue(readinessBlock as HTMLElement, "dernier import valide", "present");
      expectDefinitionValue(readinessBlock as HTMLElement, "version d import", "2");
      expectDefinitionValue(readinessBlock as HTMLElement, "comptes total", "3");
      expectDefinitionValue(readinessBlock as HTMLElement, "comptes mappes", "1");
      expectDefinitionValue(readinessBlock as HTMLElement, "comptes non mappes", "2");

      const importLabel = within(controlsBlock as HTMLElement).getByText("dernier import valide");
      const mappingLabel = within(controlsBlock as HTMLElement).getByText("mapping manuel complet");
      expectNodeBefore(importLabel, mappingLabel);
      expect(within(controlsBlock as HTMLElement).getByText("ok")).toBeInTheDocument();
      expect(within(controlsBlock as HTMLElement).getByText("bloquant")).toBeInTheDocument();
      expect(
        within(controlsBlock as HTMLElement).getByText(BLOCKED_CONTROLS.controls[0].message)
      ).toBeInTheDocument();
      expect(
        within(controlsBlock as HTMLElement).getByText(BLOCKED_CONTROLS.controls[1].message)
      ).toBeInTheDocument();

      expect(
        within(nextActionBlock as HTMLElement).getByText("completer le mapping manuel")
      ).toBeInTheDocument();
      expectDefinitionValue(nextActionBlock as HTMLElement, "action possible", "oui");
      const pathNode = within(nextActionBlock as HTMLElement).getByText(BLOCKED_CONTROLS.nextAction.path);
      expect(pathNode.closest("a")).toBeNull();

      expect(
        within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Compte" })
      ).toBeInTheDocument();
      expect(
        within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Libelle" })
      ).toBeInTheDocument();
      expect(
        within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Debit" })
      ).toBeInTheDocument();
      expect(
        within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Credit" })
      ).toBeInTheDocument();

      const rows = within(unmappedBlock as HTMLElement).getAllByRole("row");
      expect(rows[1]).toHaveTextContent("9000");
      expect(rows[1]).toHaveTextContent("Revenue");
      expect(rows[2]).toHaveTextContent("0500");
      expect(rows[2]).toHaveTextContent("Receivable");
      expect(fetchMock).toHaveBeenCalledTimes(12);
    });
  });
});
