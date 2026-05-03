import { RouterProvider } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

function renderClosingRoute() {
  const router = createAppMemoryRouter([CLOSING_ROUTE]);
  return render(<RouterProvider router={router} />);
}

function waitForNominalShell() {
  return Promise.all([
    screen.findByText("Dossier courant"),
    screen.findByText("Progression dossier"),
    screen.findByText("Import balance"),
    screen.findByText("Mapping manuel"),
    screen.findByText("Financial summary"),
    screen.findByText("Financial statements structured"),
    screen.findByText("Workpapers")
  ]);
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
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
    .mockImplementationOnce(() => Promise.resolve(jsonResponse(200, READY_WORKPAPERS)));
}

function expectNodeBefore(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

describe("router workpapers smoke", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps Workpapers after Financial statements structured and preserves the initial request scope", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

    expectNodeBefore(screen.getByText("Dossier courant"), screen.getByText("Progression dossier"));
    expectNodeBefore(screen.getByText("Progression dossier"), screen.getByText("Import balance"));
    expectNodeBefore(
      screen.getByText("Financial statements structured"),
      screen.getByText("Workpapers")
    );
    expect(getRequestPaths(fetchMock)).toEqual([
      "/api/me",
      `/api/closing-folders/${CLOSING_FOLDER.id}`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-summary`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/financial-statements/structured`,
      `/api/closing-folders/${CLOSING_FOLDER.id}/workpapers`
    ]);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/workpapers"))
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).some((path) => /\/documents\/[^/]+\/content$/.test(path))
    ).toBe(false);
    expect(
      getRequestPaths(fetchMock).some((path) =>
        /\/api\/closing-folders\/[^/]+\/workpapers\/[^/]+$/.test(path)
      )
    ).toBe(false);
    expect(getRequestPaths(fetchMock).some((path) => path.includes("/review-decision"))).toBe(
      false
    );
    expect(getRequestPaths(fetchMock).some((path) => path.includes("/exports"))).toBe(false);
    expect(getRequestPaths(fetchMock).some((path) => path.includes("/minimal-annex"))).toBe(
      false
    );
    expect(
      getRequestPaths(fetchMock).some((path) => path.includes("/imports/balance/versions"))
    ).toBe(false);
    expect(getRequestPaths(fetchMock).some((path) => path.includes("/diff-previous"))).toBe(
      false
    );
    expect(getRequestPaths(fetchMock).some((path) => path.includes("/ai"))).toBe(false);
  });
});
