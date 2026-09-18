import { RouterProvider } from "react-router-dom";
import { act } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppMemoryRouter } from "./router";
import * as workpapersApi from "../lib/api/workpapers";

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
      }
    ],
    totals: {
      totalRevenue: "175",
      totalExpenses: "0",
      netResult: "175"
    }
  }
};

const READY_WORKPAPERS = {
  closingFolderId: CLOSING_FOLDER.id,
  closingFolderStatus: "DRAFT",
  readiness: "READY",
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

const ACCOUNTANT_ME = {
  activeTenant: ACTIVE_TENANT,
  effectiveRoles: ["ACCOUNTANT"]
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

const activeRouters: ReturnType<typeof createAppMemoryRouter>[] = [];

function renderClosingRoute() {
  const router = createAppMemoryRouter([CLOSING_ROUTE]);
  activeRouters.push(router);
  return render(<RouterProvider router={router} />);
}

async function waitForNominalShell(fetchMock: ReturnType<typeof vi.fn>) {
  await screen.findByText("Dossier courant");
  await screen.findByText("Progression dossier");
  await screen.findByRole("tab", { name: "Previsualisations" });
  await screen.findByRole("tab", { name: "Preuves" });
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledTimes(13);
  });
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function getRequests(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => {
    const [path, init] = call as [string, RequestInit];

    return {
      method: init.method,
      path
    };
  });
}

function primeNominalRoute(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, ACCOUNTANT_ME)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, CLOSING_FOLDER)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, READY_CONTROLS)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, READY_MANUAL_MAPPING)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, READY_FINANCIAL_SUMMARY)))
    .mockImplementationOnce(() =>
      Promise.resolve(jsonResponse(200, READY_FINANCIAL_STATEMENTS_STRUCTURED))
    )
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, READY_WORKPAPERS)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, DEFAULT_IMPORT_VERSIONS)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, DEFAULT_IMPORT_DIFF)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, EMPTY_MAPPING_SUGGESTIONS)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, EMPTY_EXPORT_PACKS)))
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, BLOCKED_MINIMAL_ANNEX)));
}

function expectNodeBefore(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

describe("router workpapers smoke", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce((input, init) => {
      expect(String(input)).toBe("/api/session/bootstrap");
      expect(init?.method).toBe("GET");
      return Promise.resolve(jsonResponse(404, {}));
    }));
  });

  afterEach(() => {
    cleanup();
    activeRouters.splice(0).forEach((router) => router.dispose());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps Workpapers after Etats financiers structures and preserves the initial request scope", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell(fetchMock);

    expectNodeBefore(screen.getByText("Dossier courant"), screen.getByText("Progression dossier"));
    expectNodeBefore(
      screen.getByRole("tab", { name: "Previsualisations" }),
      screen.getByRole("tab", { name: "Preuves" })
    );
    await user.click(screen.getByRole("tab", { name: "Preuves" }));
    expect(await screen.findByRole("heading", { name: "Continuer les preuves" })).toBeVisible();
    expect(screen.getByText("Justifications / Preuves")).toBeVisible();
    expect(getRequestPaths(fetchMock)).toEqual([
      "/api/session/bootstrap",
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
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/workpapers"))
    ).toHaveLength(1);
    expect(
      getRequests(fetchMock).filter(
        (request) =>
          request.path === `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs` &&
          request.method === "GET"
      )
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).some((path) => /\/documents\/[^/]+\/content$/.test(path))
    ).toBe(false);
    expect(
      getRequests(fetchMock).some(
        (request) =>
          request.path === `/api/closing-folders/${CLOSING_FOLDER.id}/export-packs` &&
          request.method === "POST"
      )
    ).toBe(false);
    expect(
      getRequestPaths(fetchMock).some((path) =>
        /\/export-packs\/[^/]+\/content$/.test(path)
      )
    ).toBe(false);
    expect(
      getRequestPaths(fetchMock).some((path) =>
        /\/api\/closing-folders\/[^/]+\/workpapers\/[^/]+$/.test(path)
      )
    ).toBe(false);
    expect(getRequestPaths(fetchMock).some((path) => path.includes("/review-decision"))).toBe(
      false
    );
    expect(
      getRequests(fetchMock).filter(
        (request) =>
          request.path === `/api/closing-folders/${CLOSING_FOLDER.id}/minimal-annex` &&
          request.method === "GET"
      )
    ).toHaveLength(1);
    expect(
      getRequests(fetchMock).some(
        (request) =>
          request.path.includes("/minimal-annex") &&
          request.method !== "GET"
      )
    ).toBe(false);
    expect(
      getRequestPaths(fetchMock).some((path) => path.includes("/minimal-annex/content"))
    ).toBe(false);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.includes("/imports/balance/versions"))
    ).toHaveLength(2);
    expect(getRequestPaths(fetchMock).filter((path) => path.includes("/diff-previous"))).toHaveLength(1);
    expect(getRequestPaths(fetchMock).some((path) => path.includes("/ai"))).toBe(false);
  });
});

const SESSION_DOCUMENT = {
  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
  fileName: "session-support.pdf",
  mediaType: "application/pdf",
  sourceLabel: "ERP",
  verificationStatus: "UNVERIFIED",
  reviewComment: null
};

function deferredSessionValue<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function primeSessionDocumentRoute(content: () => Response | Promise<Response>) {
  const folder = `/api/closing-folders/${CLOSING_FOLDER.id}`;
  const payloads: Record<string, unknown> = {
    "/api/session/bootstrap": {
      sessionState: "AUTHENTICATED", localLoginAvailable: true,
      csrf: { headerName: "X-CSRF-TOKEN", token: "document-session-token" }
    },
    "/api/me": ACCOUNTANT_ME,
    [folder]: CLOSING_FOLDER,
    [`${folder}/controls`]: READY_CONTROLS,
    [`${folder}/mappings/manual`]: READY_MANUAL_MAPPING,
    [`${folder}/financial-summary`]: READY_FINANCIAL_SUMMARY,
    [`${folder}/financial-statements/structured`]: READY_FINANCIAL_STATEMENTS_STRUCTURED,
    [`${folder}/workpapers`]: {
      ...READY_WORKPAPERS,
      summaryCounts: { ...READY_WORKPAPERS.summaryCounts, totalCurrentAnchors: 1, withWorkpaperCount: 1 },
      items: [{
        anchorCode: "BS.ASSET.CURRENT_SECTION", anchorLabel: "Current assets",
        statementKind: "BALANCE_SHEET", breakdownType: "SECTION", isCurrentStructure: true,
        workpaper: { status: "DRAFT", noteText: "Support session", evidences: [] },
        documents: [SESSION_DOCUMENT],
        documentVerificationSummary: { documentsCount: 1, unverifiedCount: 1, verifiedCount: 0, rejectedCount: 0 }
      }]
    },
    [`${folder}/imports/balance/versions`]: DEFAULT_IMPORT_VERSIONS,
    [`${folder}/imports/balance/versions/2/diff-previous`]: DEFAULT_IMPORT_DIFF,
    [`${folder}/mappings/suggestions`]: EMPTY_MAPPING_SUGGESTIONS,
    [`${folder}/export-packs`]: EMPTY_EXPORT_PACKS,
    [`${folder}/minimal-annex`]: BLOCKED_MINIMAL_ANNEX
  };
  const served = new Set<string>();
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    const key = `${init?.method ?? "GET"} ${path}`;
    if (served.has(key)) throw new Error(`Repeated document fixture request: ${key}`);
    served.add(key);
    if (key === "POST /api/session/logout") return new Promise<Response>(() => {});
    if (key === `GET ${folder}/documents/${SESSION_DOCUMENT.id}/content`) return Promise.resolve(content());
    if ((init?.method ?? "GET") !== "GET" || !(path in payloads)) {
      throw new Error(`Unexpected document fixture request: ${key}`);
    }
    return Promise.resolve(jsonResponse(200, payloads[path]));
  });
  vi.stubGlobal("fetch", fetchMock);
  const router = createAppMemoryRouter([CLOSING_ROUTE]);
  activeRouters.push(router);
  const view = render(<RouterProvider router={router} />);
  return { ...view, router, fetchMock };
}

function mockDocumentBrowserDownload() {
  const createObjectURL = vi.fn(() => "blob:session-document");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
  return {
    createObjectURL,
    revokeObjectURL,
    append: vi.spyOn(document.body, "append"),
    click: vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined)
  };
}

describe("router workpaper session downloads", () => {
  afterEach(() => {
    cleanup();
    activeRouters.splice(0).forEach((router) => router.dispose());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("downloads with the real document client and revokes its browser object URL", async () => {
    const browser = mockDocumentBrowserDownload();
    const { fetchMock, container } = primeSessionDocumentRoute(() => new Response(new Blob(["pdf"]), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename=session-support.pdf" }
    }));
    await screen.findByText("session-support.pdf");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Preuves" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Telecharger la piece" }));
    await waitFor(() => { expect(browser.createObjectURL).toHaveBeenCalledTimes(1); });
    expect(browser.click).toHaveBeenCalledTimes(1);
    expect(browser.revokeObjectURL).toHaveBeenCalledWith("blob:session-document");
    expect(container.querySelector("a[download]")).toBeNull();
    const downloadInit = fetchMock.mock.calls.find(([path]) => String(path).endsWith(`/${SESSION_DOCUMENT.id}/content`))?.[1];
    expect(downloadInit?.headers).toEqual({ "X-Tenant-Id": ACTIVE_TENANT.tenantId });
    expect(downloadInit?.credentials).toBe("same-origin");
  });

  it.each(["headers", "blob", "panel"] as const)("suppresses every browser side effect when logout invalidates a document at %s", async (phase) => {
    const browser = mockDocumentBrowserDownload();
    const headers = deferredSessionValue<Response>();
    const blob = deferredSessionValue<Blob>();
    const bodyStarted = deferredSessionValue<void>();
    const clientFinished = deferredSessionValue<void>();
    const releaseClient = deferredSessionValue<void>();
    const response = new Response(new Blob(["pdf"]), { headers: { "Content-Type": "application/pdf" } });
    if (phase === "blob") {
      vi.spyOn(response, "blob").mockImplementation(() => {
        bodyStarted.resolve();
        return blob.promise;
      });
    }
    if (phase === "panel") {
      const realDownload = workpapersApi.downloadWorkpaperDocument;
      vi.spyOn(workpapersApi, "downloadWorkpaperDocument").mockImplementation(async (...args) => {
        const result = await realDownload(...args);
        expect(result.kind).toBe("success");
        clientFinished.resolve();
        await releaseClient.promise;
        return result;
      });
    }
    const { router, fetchMock } = primeSessionDocumentRoute(() => phase === "headers" ? headers.promise : response);
    await screen.findByText("session-support.pdf");
    await userEvent.setup().click(screen.getByRole("tab", { name: "Preuves" }));
    await userEvent.setup().click(screen.getByRole("button", { name: "Telecharger la piece" }));
    await waitFor(() => { expect(fetchMock.mock.calls.some(([path]) => String(path).endsWith(`/${SESSION_DOCUMENT.id}/content`))).toBe(true); });
    if (phase === "blob") await bodyStarted.promise;
    if (phase === "panel") await clientFinished.promise;
    await act(async () => { void router.sessionCoordinator.logout(); });
    await act(async () => {
      headers.resolve(response);
      blob.resolve(new Blob(["late pdf"]));
      releaseClient.resolve();
    });
    expect(browser.createObjectURL).not.toHaveBeenCalled();
    expect(browser.append).not.toHaveBeenCalled();
    expect(browser.click).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
  });
});
