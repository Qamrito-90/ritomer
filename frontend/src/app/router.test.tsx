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
      message: "Latest valid balance import version 3 is available."
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

const BLOCKED_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
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
      message: "Latest valid balance import version 2 is available."
    },
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      status: "FAIL",
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
  financialSummaryResponse = Promise.resolve(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY))
) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
    .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
    .mockImplementationOnce(() => controlsResponse)
    .mockImplementationOnce(() => manualMappingResponse)
    .mockImplementationOnce(() => financialSummaryResponse);
}

function expectNoControlsNominalBlocks() {
  expect(screen.queryByRole("heading", { name: "Readiness" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Prochaine action" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Comptes non mappes" })).not.toBeInTheDocument();
}

async function expectControlsState(text: string) {
  expect(await expectVisibleText(text)).toBeInTheDocument();
  expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
  expect(screen.getByText("Dossier courant")).toBeInTheDocument();
  expect(screen.getByText("Closing FY26")).toBeInTheDocument();
  expect(screen.getByText("Controles")).toBeInTheDocument();
  expectNoControlsNominalBlocks();
}

async function flushTimeout() {
  await act(async () => {
    vi.advanceTimersByTime(DEFAULT_REQUEST_TIMEOUT_MS);
    await Promise.resolve();
  });
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
      expect(screen.queryByText("Liste read-only")).not.toBeInTheDocument();
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
      expect(screen.getByText("Liste read-only")).toBeInTheDocument();
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
      expect(screen.getByText("Liste read-only")).toBeInTheDocument();
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
      expect(screen.getByText("Liste read-only")).toBeInTheDocument();
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
      expect(screen.getByText("Liste read-only")).toBeInTheDocument();
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
      expect(screen.getByText("Liste read-only")).toBeInTheDocument();
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
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY));

      renderRoute("/");

      const folderCard = (await screen.findByText("Closing FY26")).closest("article");
      expect(folderCard).not.toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls.map((call) => String(call[0]))).not.toContain(
        `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
      );

      await user.click(within(folderCard as HTMLElement).getByRole("link", { name: "Ouvrir" }));

      expect(await screen.findByText("Dossier courant")).toBeInTheDocument();
      expect(await screen.findByText("Cockpit read-only")).toBeInTheDocument();
      expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
      expect(fetchMock).toHaveBeenCalledTimes(7);
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
      expect(await expectVisibleText("chargement controls")).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(5);
      expectNoControlsNominalBlocks();
    });

    it.each([
      { status: 401, text: "authentification requise" },
      { status: 403, text: "acces controls refuse" },
      { status: 404, text: "controls introuvables" },
      { status: 500, text: "erreur serveur controls" },
      { status: 400, text: "controles indisponibles" }
    ])("renders the exact controls state for HTTP $status", async ({ status, text }) => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(status, {})));

      renderRoute(CLOSING_ROUTE);

      await expectControlsState(text);
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it("renders erreur reseau controls on a controls network failure", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
        .mockRejectedValueOnce(new Error("network"))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_MANUAL_MAPPING))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY));

      renderRoute(CLOSING_ROUTE);

      await expectControlsState("erreur reseau controls");
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it("renders timeout controls on a controls timeout failure", async () => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
        .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_MANUAL_MAPPING))
        .mockResolvedValueOnce(jsonResponse(200, DEFAULT_FINANCIAL_SUMMARY));

      renderRoute(CLOSING_ROUTE);

      await expectControlsState("timeout controls");
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });

    it("renders payload controls invalide when the controls payload is incomplete", async () => {
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

      await expectControlsState("payload controls invalide");
      expect(fetchMock).toHaveBeenCalledTimes(5);
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

      const readinessHeading = screen.getByRole("heading", { name: "Readiness" });
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

      expectDefinitionValue(readinessBlock as HTMLElement, "readiness", "pret");
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
      expect(fetchMock).toHaveBeenCalledTimes(5);

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
      expect(getRequestHeaders(fetchMock, 0)["X-Tenant-Id"]).toBeUndefined();
      expect(getRequestHeaders(fetchMock, 1)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 2)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 3)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(getRequestHeaders(fetchMock, 4)["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect((await axe(container)).violations).toEqual([]);
    });

    it("renders the exact BLOCKED controls blocks, keeps backend order, and keeps nextAction.path read-only", async () => {
      const fetchMock = vi.mocked(global.fetch);
      primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(200, BLOCKED_CONTROLS)));

      renderRoute(CLOSING_ROUTE);

      expect(await screen.findByText("Closing FY26")).toBeInTheDocument();

      const readinessBlock = screen.getByRole("heading", { name: "Readiness" }).closest("section");
      const controlsBlock = screen.getByRole("heading", { name: "Controles" }).closest("section");
      const nextActionBlock = screen.getByRole("heading", { name: "Prochaine action" }).closest("section");
      const unmappedBlock = screen
        .getByRole("heading", { name: "Comptes non mappes" })
        .closest("section");

      expect(readinessBlock).not.toBeNull();
      expect(controlsBlock).not.toBeNull();
      expect(nextActionBlock).not.toBeNull();
      expect(unmappedBlock).not.toBeNull();

      expectDefinitionValue(readinessBlock as HTMLElement, "readiness", "bloque");
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
      expect(fetchMock).toHaveBeenCalledTimes(5);
    });
  });
});
