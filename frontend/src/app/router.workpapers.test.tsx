import { RouterProvider } from "react-router-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

const ACCOUNTANT_ME = {
  activeTenant: ACTIVE_TENANT,
  effectiveRoles: ["ACCOUNTANT"]
};

const CLOSING_ROUTE = `/closing-folders/${CLOSING_FOLDER.id}`;

type WorkpaperEvidence = {
  position: number;
  fileName: string;
  mediaType: string;
  documentDate: string | null;
  sourceLabel: string;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED";
  externalReference: string | null;
  checksumSha256: string | null;
};

type WorkpaperDocument = {
  id?: unknown;
  fileName: string;
  mediaType: string;
  sourceLabel: string;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED";
};

type WorkpaperDetails = {
  status: "DRAFT" | "READY_FOR_REVIEW" | "CHANGES_REQUESTED" | "REVIEWED";
  noteText: string;
  evidences: WorkpaperEvidence[];
};

type WorkpaperItem = {
  anchorCode: string;
  anchorLabel: string;
  statementKind: "BALANCE_SHEET" | "INCOME_STATEMENT";
  breakdownType: "SECTION" | "LEGACY_BUCKET_FALLBACK";
  isCurrentStructure: boolean;
  workpaper: WorkpaperDetails | null;
  documents: WorkpaperDocument[];
  documentVerificationSummary:
    | {
        documentsCount: number;
        unverifiedCount: number;
        verifiedCount: number;
        rejectedCount: number;
      }
    | null;
};

type WorkpapersModel = {
  closingFolderId: string;
  closingFolderStatus: "DRAFT" | "ARCHIVED";
  readiness: "READY" | "BLOCKED";
  summaryCounts: {
    totalCurrentAnchors: number;
    withWorkpaperCount: number;
    readyForReviewCount: number;
    reviewedCount: number;
    staleCount: number;
    missingCount: number;
  };
  items: WorkpaperItem[];
  staleWorkpapers: WorkpaperItem[];
  nextAction?: {
    code: string;
    path: string;
    actionable: boolean;
  };
};

type ResponseFactory = () => Response | Promise<Response>;

type DocumentUploadSuccessPayload = {
  id: string;
  fileName: string;
  mediaType: string;
  byteSize: number;
  checksumSha256: string;
  sourceLabel: string;
  documentDate: string | null;
  createdAt: string;
  createdByUserId: string;
  verificationStatus: "UNVERIFIED";
  reviewComment: null;
  reviewedAt: null;
  reviewedByUserId: null;
};

function createEvidence(overrides: Partial<WorkpaperEvidence> = {}): WorkpaperEvidence {
  return {
    position: 1,
    fileName: "support.pdf",
    mediaType: "application/pdf",
    documentDate: "2026-01-31",
    sourceLabel: "ERP",
    verificationStatus: "UNVERIFIED",
    externalReference: null,
    checksumSha256: null,
    ...overrides
  };
}

function createDocument(overrides: Partial<WorkpaperDocument> = {}): WorkpaperDocument {
  return {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
    fileName: "support.pdf",
    mediaType: "application/pdf",
    sourceLabel: "ERP",
    verificationStatus: "UNVERIFIED",
    ...overrides
  };
}

function summarizeDocuments(documents: WorkpaperDocument[]) {
  return {
    documentsCount: documents.length,
    unverifiedCount: documents.filter((document) => document.verificationStatus === "UNVERIFIED")
      .length,
    verifiedCount: documents.filter((document) => document.verificationStatus === "VERIFIED")
      .length,
    rejectedCount: documents.filter((document) => document.verificationStatus === "REJECTED")
      .length
  };
}

function createWorkpaperDetails(overrides: Partial<WorkpaperDetails> = {}): WorkpaperDetails {
  return {
    status: "DRAFT",
    noteText: "Cash tie-out",
    evidences: [createEvidence()],
    ...overrides
  };
}

function createCurrentItem({
  anchorCode = "BS.ASSET.CURRENT_SECTION",
  anchorLabel = "Current assets",
  statementKind = "BALANCE_SHEET",
  breakdownType = "SECTION",
  workpaper = null,
  documents,
  documentVerificationSummary
}: Partial<WorkpaperItem> = {}): WorkpaperItem {
  const resolvedDocuments =
    workpaper === null ? [] : (documents ?? []);

  return {
    anchorCode,
    anchorLabel,
    statementKind,
    breakdownType,
    isCurrentStructure: true,
    workpaper,
    documents: resolvedDocuments,
    documentVerificationSummary:
      workpaper === null
        ? null
        : (documentVerificationSummary ?? summarizeDocuments(resolvedDocuments))
  };
}

function createStaleItem({
  anchorCode = "BS.ASSET.LEGACY_BUCKET_FALLBACK",
  anchorLabel = "Legacy bucket",
  statementKind = "BALANCE_SHEET",
  breakdownType = "LEGACY_BUCKET_FALLBACK",
  workpaper = createWorkpaperDetails({
    status: "REVIEWED",
    noteText: "Legacy support"
  }),
  documents = [createDocument({ fileName: "legacy.pdf", verificationStatus: "VERIFIED" })],
  documentVerificationSummary
}: Partial<WorkpaperItem> = {}): WorkpaperItem {
  return {
    anchorCode,
    anchorLabel,
    statementKind,
    breakdownType,
    isCurrentStructure: false,
    workpaper,
    documents,
    documentVerificationSummary: documentVerificationSummary ?? summarizeDocuments(documents)
  };
}

function createWorkpapersModel({
  closingFolderStatus = "DRAFT",
  readiness = "READY",
  items = [],
  staleWorkpapers = [],
  nextAction
}: Partial<WorkpapersModel> = {}): WorkpapersModel {
  return {
    closingFolderId: CLOSING_FOLDER.id,
    closingFolderStatus,
    readiness,
    summaryCounts: {
      totalCurrentAnchors: items.length,
      withWorkpaperCount: items.filter((item) => item.workpaper !== null).length,
      readyForReviewCount: items.filter(
        (item) => item.workpaper?.status === "READY_FOR_REVIEW"
      ).length,
      reviewedCount: items.filter((item) => item.workpaper?.status === "REVIEWED").length,
      staleCount: staleWorkpapers.length,
      missingCount: items.filter((item) => item.workpaper === null).length
    },
    items,
    staleWorkpapers,
    ...(nextAction === undefined ? {} : { nextAction })
  };
}

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function createUploadFile(
  fileName = "support.pdf",
  type = "application/pdf",
  contents = "pdf-content"
) {
  return new File([contents], fileName, { type });
}

function createDocumentUploadSuccessPayload({
  file,
  sourceLabel,
  documentDate
}: {
  file: File;
  sourceLabel: string;
  documentDate: string | null;
}): DocumentUploadSuccessPayload {
  return {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    fileName: file.name,
    mediaType: file.type,
    byteSize: file.size,
    checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    sourceLabel,
    documentDate,
    createdAt: "2026-02-15T10:00:00Z",
    createdByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    verificationStatus: "UNVERIFIED",
    reviewComment: null,
    reviewedAt: null,
    reviewedByUserId: null
  };
}

function renderClosingRoute() {
  const router = createAppMemoryRouter([CLOSING_ROUTE]);
  return render(<RouterProvider router={router} />);
}

function primeNominalRoute(
  fetchMock: ReturnType<typeof vi.fn>,
  {
    me = () => jsonResponse(200, ACCOUNTANT_ME),
    closingFolder = () => jsonResponse(200, CLOSING_FOLDER),
    controls = () => jsonResponse(200, READY_CONTROLS),
    manualMapping = () => jsonResponse(200, READY_MANUAL_MAPPING),
    financialSummary = () => jsonResponse(200, READY_FINANCIAL_SUMMARY),
    financialStatementsStructured = () =>
      jsonResponse(200, READY_FINANCIAL_STATEMENTS_STRUCTURED),
    workpapers = () => jsonResponse(200, createWorkpapersModel()),
    extras = []
  }: {
    me?: ResponseFactory;
    closingFolder?: ResponseFactory;
    controls?: ResponseFactory;
    manualMapping?: ResponseFactory;
    financialSummary?: ResponseFactory;
    financialStatementsStructured?: ResponseFactory;
    workpapers?: ResponseFactory;
    extras?: ResponseFactory[];
  } = {}
) {
  fetchMock
    .mockImplementationOnce(() => Promise.resolve(me()))
    .mockImplementationOnce(() => Promise.resolve(closingFolder()))
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

function getWorkpapersGetPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return getRequestPaths(fetchMock).filter((path) => path.endsWith("/workpapers"));
}

function getWorkpapersPutCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([path]) =>
    /\/api\/closing-folders\/[^/]+\/workpapers\/[^/]+$/.test(String(path))
  ) as Array<[string, RequestInit]>;
}

function getWorkpaperDocumentPostCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([path, init]) => {
    const requestPath = String(path);
    const requestInit = init as RequestInit | undefined;

    return (
      /\/api\/closing-folders\/[^/]+\/workpapers\/[^/]+\/documents$/.test(requestPath) &&
      requestInit?.method === "POST"
    );
  }) as Array<[string, RequestInit]>;
}

function getDocumentContentGetCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([path, init]) => {
    const requestPath = String(path);
    const requestInit = init as RequestInit | undefined;

    return (
      /\/api\/closing-folders\/[^/]+\/documents\/[^/]+\/content$/.test(requestPath) &&
      requestInit?.method === "GET"
    );
  }) as Array<[string, RequestInit]>;
}

function expectNoOutOfScopePaths(
  paths: string[],
  {
    workpapersGets,
    workpapersPuts
  }: {
    workpapersGets: number;
    workpapersPuts: number;
  }
) {
  expect(paths.filter((path) => path.endsWith("/workpapers"))).toHaveLength(workpapersGets);
  expect(
    paths.filter((path) => /\/api\/closing-folders\/[^/]+\/workpapers\/[^/]+$/.test(path))
  ).toHaveLength(workpapersPuts);
  expect(paths.some((path) => path.includes("/review-decision"))).toBe(false);
  expect(paths.some((path) => path.includes("/documents"))).toBe(false);
  expect(paths.some((path) => path.includes("/exports"))).toBe(false);
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
}

function expectNoOutOfScopePathsAllowingDocumentUploads(
  fetchMock: ReturnType<typeof vi.fn>,
  {
    workpapersGets,
    workpapersPuts,
    workpaperDocumentPosts
  }: {
    workpapersGets: number;
    workpapersPuts: number;
    workpaperDocumentPosts: number;
  }
) {
  const paths = getRequestPaths(fetchMock);

  expect(paths.filter((path) => path.endsWith("/workpapers"))).toHaveLength(workpapersGets);
  expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(workpapersPuts);
  expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(workpaperDocumentPosts);
  expect(
    fetchMock.mock.calls.some(([path, init]) => {
      const requestPath = String(path);
      const requestInit = init as RequestInit | undefined;

      return (
        /\/api\/closing-folders\/[^/]+\/workpapers\/[^/]+\/documents$/.test(requestPath) &&
        requestInit?.method !== "POST"
      );
    })
  ).toBe(false);
  expect(paths.some((path) => /\/documents\/[^/]+\/content$/.test(path))).toBe(false);
  expect(paths.some((path) => /\/documents\/[^/]+\/verification-decision$/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/review-decision"))).toBe(false);
  expect(paths.some((path) => path.includes("/exports"))).toBe(false);
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
}

function expectNoOutOfScopePathsAllowingDocumentDownloads(
  fetchMock: ReturnType<typeof vi.fn>,
  {
    workpapersGets,
    workpapersPuts,
    workpaperDocumentPosts,
    documentContentGets
  }: {
    workpapersGets: number;
    workpapersPuts: number;
    workpaperDocumentPosts: number;
    documentContentGets: number;
  }
) {
  const paths = getRequestPaths(fetchMock);

  expect(paths.filter((path) => path.endsWith("/workpapers"))).toHaveLength(workpapersGets);
  expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(workpapersPuts);
  expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(workpaperDocumentPosts);
  expect(getDocumentContentGetCalls(fetchMock)).toHaveLength(documentContentGets);
  expect(paths.some((path) => /\/workpapers\/[^/]+\/documents$/.test(path))).toBe(false);
  expect(paths.some((path) => /\/documents\/[^/]+\/verification-decision$/.test(path))).toBe(false);
  expect(paths.some((path) => path.includes("/review-decision"))).toBe(false);
  expect(paths.some((path) => path.includes("/exports"))).toBe(false);
  expect(paths.some((path) => path.includes("/imports/balance/versions"))).toBe(false);
  expect(paths.some((path) => path.includes("/diff-previous"))).toBe(false);
  expect(paths.some((path) => path.includes("/ai"))).toBe(false);
}

function createDocumentDownloadResponse({
  blob = new Blob(["pdf-content"]),
  contentDisposition = 'attachment; filename="support.pdf"',
  contentType = "application/pdf"
}: {
  blob?: Blob;
  contentDisposition?: string | null;
  contentType?: string | null;
} = {}) {
  const blobSpy = vi.fn().mockResolvedValue(blob);
  const jsonSpy = vi.fn();
  const headers = new Headers();

  if (contentDisposition !== null) {
    headers.set("Content-Disposition", contentDisposition);
  }

  if (contentType !== null) {
    headers.set("Content-Type", contentType);
  }

  return {
    response: {
      status: 200,
      headers,
      blob: blobSpy,
      json: jsonSpy
    } as unknown as Response,
    blob,
    blobSpy,
    jsonSpy
  };
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

  it("places Workpapers after Financial statements structured and keeps the request scope closed on initial load", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeNominalRoute(fetchMock);

    renderClosingRoute();
    await waitForNominalShell();

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
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), {
      workpapersGets: 1,
      workpapersPuts: 0
    });
  });

  it("renders the nominal maker block, keeps stale read-only, and never renders nextAction.path as navigation", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const workpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "PL.REVENUE.NEW",
          anchorLabel: "Revenue new",
          statementKind: "INCOME_STATEMENT",
          breakdownType: "LEGACY_BUCKET_FALLBACK",
          workpaper: null
        }),
        createCurrentItem({
          anchorCode: "BS.ASSET.DRAFT",
          anchorLabel: "Current assets draft",
          workpaper: createWorkpaperDetails({
            status: "DRAFT",
            noteText: "Draft note"
          }),
          documents: [
            createDocument({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed1",
              fileName: "draft-support.pdf"
            })
          ]
        }),
        createCurrentItem({
          anchorCode: "BS.ASSET.CHANGES",
          anchorLabel: "Current assets changes",
          workpaper: createWorkpaperDetails({
            status: "CHANGES_REQUESTED",
            noteText: "Needs update"
          })
        }),
        createCurrentItem({
          anchorCode: "BS.ASSET.READY",
          anchorLabel: "Current assets ready",
          workpaper: createWorkpaperDetails({
            status: "READY_FOR_REVIEW",
            noteText: "Ready for review"
          })
        }),
        createCurrentItem({
          anchorCode: "BS.ASSET.REVIEWED",
          anchorLabel: "Current assets reviewed",
          workpaper: createWorkpaperDetails({
            status: "REVIEWED",
            noteText: "Reviewed note"
          })
        })
      ],
      staleWorkpapers: [
        createStaleItem({
          anchorCode: "BS.ASSET.STALE",
          anchorLabel: "Legacy bucket stale",
          documents: [
            createDocument({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed2",
              fileName: "legacy-stale.pdf",
              verificationStatus: "VERIFIED"
            })
          ]
        })
      ],
      nextAction: {
        code: "IGNORED",
        path: "/never-rendered",
        actionable: true
      }
    });

    primeNominalRoute(fetchMock, {
      workpapers: () => jsonResponse(200, workpapers)
    });

    renderClosingRoute();
    await waitForNominalShell();

    const section = getWorkpapersSection();
    const newCard = getWorkpaperCard("PL.REVENUE.NEW");
    const draftCard = getWorkpaperCard("BS.ASSET.DRAFT");
    const changesCard = getWorkpaperCard("BS.ASSET.CHANGES");
    const readyCard = getWorkpaperCard("BS.ASSET.READY");
    const reviewedCard = getWorkpaperCard("BS.ASSET.REVIEWED");
    const staleCard = getWorkpaperCard("BS.ASSET.STALE");

    expect(
      await screen.findByText("Mise a jour maker unitaire sur les workpapers courants uniquement.")
    ).toBeInTheDocument();
    expect(section.getByText("workpapers stale en lecture seule")).toBeInTheDocument();
    expect(screen.queryByText("/never-rendered")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "/never-rendered" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "/never-rendered" })).not.toBeInTheDocument();

    expect(within(newCard).getByLabelText("Note workpaper")).toHaveValue("");
    expect(within(newCard).getByLabelText("Statut maker")).toHaveValue("DRAFT");
    expect(
      within(newCard).getByText("upload disponible apres creation du workpaper")
    ).toBeInTheDocument();
    expect(within(newCard).queryByText("Upload document")).not.toBeInTheDocument();
    expect(
      within(newCard).queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();
    expect(
      within(newCard).getByRole("button", { name: "Enregistrer le workpaper" })
    ).toBeDisabled();

    expect(within(draftCard).getByLabelText("Note workpaper")).toHaveValue("Draft note");
    expect(within(draftCard).getByLabelText("Statut maker")).toHaveValue("DRAFT");
    expect(within(draftCard).getByText("Upload document")).toBeInTheDocument();
    expect(within(draftCard).getByLabelText("Fichier document")).toBeInTheDocument();
    expect(within(draftCard).getByLabelText("Source document")).toHaveValue("");
    expect(within(draftCard).getByLabelText("Date document")).toHaveValue("");
    expect(within(draftCard).getByText("selectionner un fichier")).toBeInTheDocument();
    expect(
      within(draftCard).getByRole("button", { name: "Telecharger le document" })
    ).toBeInTheDocument();
    expect(
      within(draftCard).getByRole("button", { name: "Uploader le document" })
    ).toBeDisabled();
    expect(
      within(draftCard).getByRole("button", { name: "Enregistrer le workpaper" })
    ).toBeDisabled();

    expect(within(changesCard).getByLabelText("Note workpaper")).toHaveValue("Needs update");
    expect(within(changesCard).getByLabelText("Statut maker")).toHaveValue("DRAFT");
    expect(within(changesCard).getByText("Upload document")).toBeInTheDocument();
    expect(
      within(changesCard).getByRole("button", { name: "Uploader le document" })
    ).toBeDisabled();
    expect(
      within(changesCard).getByRole("button", { name: "Enregistrer le workpaper" })
    ).toBeEnabled();

    expect(within(readyCard).getByText("workpaper en lecture seule")).toBeInTheDocument();
    expect(within(readyCard).queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(within(readyCard).queryByLabelText("Statut maker")).not.toBeInTheDocument();
    expect(
      within(readyCard).queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();
    expect(
      within(readyCard).queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();

    expect(within(reviewedCard).getByText("workpaper en lecture seule")).toBeInTheDocument();
    expect(within(reviewedCard).queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(within(reviewedCard).queryByLabelText("Statut maker")).not.toBeInTheDocument();
    expect(
      within(reviewedCard).queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();
    expect(
      within(reviewedCard).queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();

    expect(within(staleCard).queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(within(staleCard).queryByLabelText("Statut maker")).not.toBeInTheDocument();
    expect(
      within(staleCard).queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();
    expect(
      within(staleCard).queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();
    expect(
      within(staleCard).getByRole("button", { name: "Telecharger le document" })
    ).toBeInTheDocument();
  });

  it("does not autosave on textarea or select changes and sends evidences [] for a current item without persisted workpaper", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const initialWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "PL.REVENUE.NEW",
          anchorLabel: "Revenue new",
          statementKind: "INCOME_STATEMENT",
          breakdownType: "LEGACY_BUCKET_FALLBACK",
          workpaper: null
        })
      ]
    });
    const refreshedWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "PL.REVENUE.NEW",
          anchorLabel: "Revenue new",
          statementKind: "INCOME_STATEMENT",
          breakdownType: "LEGACY_BUCKET_FALLBACK",
          workpaper: createWorkpaperDetails({
            status: "READY_FOR_REVIEW",
            noteText: "Revenue support"
          })
        })
      ]
    });

    primeNominalRoute(fetchMock, {
      workpapers: () => jsonResponse(200, initialWorkpapers),
      extras: [
        () =>
          jsonResponse(201, {
            anchorCode: "PL.REVENUE.NEW",
            isCurrentStructure: true,
            workpaper: {
              status: "READY_FOR_REVIEW",
              noteText: "Revenue support",
              evidences: []
            }
          }),
        () => jsonResponse(200, refreshedWorkpapers)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const newCard = getWorkpaperCard("PL.REVENUE.NEW");
    const noteField = within(newCard).getByLabelText("Note workpaper");
    const statusSelect = within(newCard).getByLabelText("Statut maker");
    const saveButton = within(newCard).getByRole("button", {
      name: "Enregistrer le workpaper"
    });

    await user.type(noteField, "  Revenue support  ");
    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(0);

    await user.selectOptions(statusSelect, "READY_FOR_REVIEW");
    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(0);

    await user.click(saveButton);

    expect(await screen.findByText("workpaper enregistre avec succes")).toBeInTheDocument();
    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(1);
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(2);

    const [, init] = getWorkpapersPutCalls(fetchMock)[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      noteText: string;
      status: string;
      evidences: unknown[];
    };

    expect(body).toEqual({
      noteText: "Revenue support",
      status: "READY_FOR_REVIEW",
      evidences: []
    });
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), {
      workpapersGets: 2,
      workpapersPuts: 1
    });
  });

  it("preserves the exact evidences order and fields from the latest GET workpapers on a persisted current item", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const evidences = [
      createEvidence({
        position: 2,
        fileName: "z-last.csv",
        mediaType: "text/csv",
        documentDate: "2026-02-28",
        sourceLabel: "Bank portal",
        verificationStatus: "REJECTED",
        externalReference: "bank://42",
        checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789"
      }),
      createEvidence({
        position: 1,
        fileName: "a-first.pdf",
        mediaType: "application/pdf",
        documentDate: null,
        sourceLabel: "ERP",
        verificationStatus: "VERIFIED"
      })
    ];
    const initialWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "BS.ASSET.DRAFT",
          anchorLabel: "Current assets draft",
          workpaper: createWorkpaperDetails({
            status: "DRAFT",
            noteText: "Draft note",
            evidences
          })
        })
      ]
    });

    primeNominalRoute(fetchMock, {
      workpapers: () => jsonResponse(200, initialWorkpapers),
      extras: [
        () =>
          jsonResponse(200, {
            anchorCode: "BS.ASSET.DRAFT",
            isCurrentStructure: true,
            workpaper: {
              status: "READY_FOR_REVIEW",
              noteText: "Updated note",
              evidences
            }
          }),
        () =>
          jsonResponse(
            200,
            createWorkpapersModel({
              items: [
                createCurrentItem({
                  anchorCode: "BS.ASSET.DRAFT",
                  anchorLabel: "Current assets draft",
                  workpaper: createWorkpaperDetails({
                    status: "READY_FOR_REVIEW",
                    noteText: "Updated note",
                    evidences
                  })
                })
              ]
            })
          )
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const draftCard = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.clear(within(draftCard).getByLabelText("Note workpaper"));
    await user.type(within(draftCard).getByLabelText("Note workpaper"), "Updated note");
    await user.selectOptions(
      within(draftCard).getByLabelText("Statut maker"),
      "READY_FOR_REVIEW"
    );
    await user.click(
      within(draftCard).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(await screen.findByText("workpaper enregistre avec succes")).toBeInTheDocument();

    const [, init] = getWorkpapersPutCalls(fetchMock)[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body)) as {
      evidences: Array<Record<string, unknown>>;
    };

    expect(body.evidences).toEqual(evidences);
    expect(body.evidences[0]).not.toHaveProperty("id");
    expect(Object.keys(body.evidences[0] ?? {})).toEqual([
      "position",
      "fileName",
      "mediaType",
      "documentDate",
      "sourceLabel",
      "verificationStatus",
      "externalReference",
      "checksumSha256"
    ]);
  });

  it.each([
    {
      label: "effectiveRoles absent",
      me: () => jsonResponse(200, { activeTenant: ACTIVE_TENANT }),
      downloadVisible: false
    },
    {
      label: "effectiveRoles invalid",
      me: () => jsonResponse(200, { activeTenant: ACTIVE_TENANT, effectiveRoles: "oops" }),
      downloadVisible: false
    },
    {
      label: "REVIEWER only",
      me: () => jsonResponse(200, { activeTenant: ACTIVE_TENANT, effectiveRoles: ["REVIEWER"] }),
      downloadVisible: true
    }
  ])("keeps the block read-only when $label", async ({ me, downloadVisible }) => {
    const fetchMock = vi.mocked(global.fetch);

    primeNominalRoute(fetchMock, {
      me,
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Cash tie-out"
                }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed3"
                  })
                ]
              })
            ]
          })
        )
    });

    renderClosingRoute();
    await waitForNominalShell();

    const section = getWorkpapersSection();
    expect(await screen.findAllByText("lecture seule")).toHaveLength(2);
    expect(section.getAllByText("lecture seule")).toHaveLength(1);
    expect(section.queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Statut maker")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Fichier document")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Source document")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Date document")).not.toBeInTheDocument();
    expect(
      section.queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();
    expect(
      section.queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();
    if (downloadVisible) {
      expect(
        section.getByRole("button", { name: "Telecharger le document" })
      ).toBeInTheDocument();
    } else {
      expect(
        section.queryByRole("button", { name: "Telecharger le document" })
      ).not.toBeInTheDocument();
    }
    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(0);
  });

  it("keeps the block read-only on ARCHIVED and never emits PUT", async () => {
    const fetchMock = vi.mocked(global.fetch);

    primeNominalRoute(fetchMock, {
      closingFolder: () =>
        jsonResponse(200, {
          ...CLOSING_FOLDER,
          status: "ARCHIVED"
        }),
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            closingFolderStatus: "ARCHIVED",
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Archived support"
                }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed4",
                    fileName: "archived-support.pdf"
                  })
                ]
              })
            ]
          })
        )
    });

    renderClosingRoute();
    await waitForNominalShell();

    const section = getWorkpapersSection();
    expect(
      await screen.findByText("dossier archive, workpaper en lecture seule")
    ).toBeInTheDocument();
    expect(section.queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Statut maker")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Fichier document")).not.toBeInTheDocument();
    expect(
      section.queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();
    expect(
      section.queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();
    expect(
      section.getByRole("button", { name: "Telecharger le document" })
    ).toBeInTheDocument();
    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(0);
  });

  it("keeps the block read-only when readiness is not READY and never emits PUT", async () => {
    const fetchMock = vi.mocked(global.fetch);

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            readiness: "BLOCKED",
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Blocked support"
                }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed5",
                    fileName: "blocked-support.pdf"
                  })
                ]
              })
            ]
          })
        )
    });

    renderClosingRoute();
    await waitForNominalShell();

    const section = getWorkpapersSection();
    expect(
      await screen.findByText(
        "workpaper non modifiable tant que les controles ne sont pas READY"
      )
    ).toBeInTheDocument();
    expect(section.queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Statut maker")).not.toBeInTheDocument();
    expect(section.queryByLabelText("Fichier document")).not.toBeInTheDocument();
    expect(
      section.queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();
    expect(
      section.queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();
    expect(
      section.getByRole("button", { name: "Telecharger le document" })
    ).toBeInTheDocument();
    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(0);
  });

  it.each([
    {
      label: "missing document id",
      document: createDocument({ id: undefined })
    },
    {
      label: "invalid document id",
      document: createDocument({ id: "not-a-uuid" })
    }
  ])("keeps a visible document line read-only with 'telechargement indisponible' on $label", async ({ document }) => {
    const fetchMock = vi.mocked(global.fetch);

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Download support"
                }),
                documents: [document]
              })
            ]
          })
        )
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    expect(within(card).getByText("telechargement indisponible")).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Telecharger le document" })
    ).not.toBeInTheDocument();
    expect(getDocumentContentGetCalls(fetchMock)).toHaveLength(0);
    expectNoOutOfScopePathsAllowingDocumentDownloads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 0,
      documentContentGets: 0
    });
  });

  it("allows only one document download in flight across the whole block", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.ONE",
                anchorLabel: "Current assets one",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "One" }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed6",
                    fileName: "one.pdf"
                  })
                ]
              }),
              createCurrentItem({
                anchorCode: "BS.ASSET.TWO",
                anchorLabel: "Current assets two",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Two" }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed7",
                    fileName: "two.pdf"
                  })
                ]
              })
            ]
          })
        ),
      extras: [() => new Promise(() => {})]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.click(
      within(firstCard).getByRole("button", { name: "Telecharger le document" })
    );

    expect(await screen.findByText("telechargement document en cours")).toBeInTheDocument();
    expect(getDocumentContentGetCalls(fetchMock)).toHaveLength(1);
    expect(
      within(secondCard).getByRole("button", { name: "Telecharger le document" })
    ).toBeDisabled();

    await user.click(
      within(secondCard).getByRole("button", { name: "Telecharger le document" })
    );

    expect(getDocumentContentGetCalls(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePathsAllowingDocumentDownloads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 0,
      documentContentGets: 1
    });
  });

  it("downloads through fetch + blob + object URL + temporary link, uses the visible document id, and never refreshes the shell after success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const documentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed8";
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const appendSpy = vi.spyOn(document.body, "append");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return "blob:download-url";
    });
    const revokeObjectURL = vi.fn();
    const response = createDocumentDownloadResponse({
      blob: new Blob(["pdf-content"]),
      contentDisposition:
        "attachment; filename*=UTF-8''support%20final.pdf; filename=\"ignored.pdf\"",
      contentType: "application/pdf"
    });

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    });

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Current support"
                }),
                documents: [
                  createDocument({
                    id: documentId,
                    fileName: "fallback.pdf",
                    mediaType: "image/png"
                  })
                ]
              })
            ]
          })
        ),
      extras: [() => response.response]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.click(within(card).getByRole("button", { name: "Telecharger le document" }));

    const [path, init] = getDocumentContentGetCalls(fetchMock)[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const appendedLink = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;

    expect(path).toBe(
      `/api/closing-folders/${CLOSING_FOLDER.id}/documents/${documentId}/content`
    );
    expect(init.method).toBe("GET");
    expect(headers).toEqual({
      "X-Tenant-Id": ACTIVE_TENANT.tenantId
    });
    expect(response.blobSpy).toHaveBeenCalledTimes(1);
    expect(response.jsonSpy).not.toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]?.type).toBe("application/pdf");
    expect(appendedLink.href).toBe("blob:download-url");
    expect(appendedLink.download).toBe("support final.pdf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.body.contains(appendedLink)).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download-url");
    expect(openSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("telechargement document en cours")).not.toBeInTheDocument();
    expect(screen.queryByText("telechargement indisponible")).not.toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((requestPath) => requestPath.endsWith("/controls"))
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((requestPath) => requestPath.endsWith("/financial-summary"))
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((requestPath) =>
        requestPath.endsWith("/financial-statements/structured")
      )
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((requestPath) => requestPath.endsWith("/mappings/manual"))
    ).toHaveLength(1);
    expect(getRequestPaths(fetchMock).filter((requestPath) => requestPath === "/api/me")).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter(
        (requestPath) => requestPath === `/api/closing-folders/${CLOSING_FOLDER.id}`
      )
    ).toHaveLength(1);
    expectNoOutOfScopePathsAllowingDocumentDownloads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 0,
      documentContentGets: 1
    });
  });

  it.each([
    {
      label: "filename* from Content-Disposition",
      contentDisposition:
        "attachment; filename*=UTF-8''support%20final.pdf; filename=\"ignored.pdf\"",
      fallbackFileName: "fallback.pdf",
      expectedDownload: "support final.pdf"
    },
    {
      label: "filename from Content-Disposition",
      contentDisposition: "attachment; filename=\"header.pdf\"",
      fallbackFileName: "fallback.pdf",
      expectedDownload: "header.pdf"
    },
    {
      label: "documents[].fileName fallback",
      contentDisposition: null,
      fallbackFileName: "fallback.pdf",
      expectedDownload: "fallback.pdf"
    },
    {
      label: "document-<documentId> fallback",
      contentDisposition: null,
      fallbackFileName: "   ",
      expectedDownload: "document-eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed9"
    }
  ])("resolves the download file name from $label", async ({ contentDisposition, fallbackFileName, expectedDownload }) => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const appendSpy = vi.spyOn(document.body, "append");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:file-name-test")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Name resolution"
                }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed9",
                    fileName: fallbackFileName
                  })
                ]
              })
            ]
          })
        ),
      extras: [
        () =>
          createDocumentDownloadResponse({
            contentDisposition,
            contentType: "application/pdf"
          }).response
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.click(
      within(getWorkpaperCard("BS.ASSET.CURRENT_SECTION")).getByRole("button", {
        name: "Telecharger le document"
      })
    );

    const appendedLink = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(appendedLink.download).toBe(expectedDownload);
  });

  it.each([
    {
      label: "Content-Type response",
      contentType: "application/pdf",
      fallbackMediaType: "image/png",
      blob: new Blob(["pdf-content"]),
      expectedType: "application/pdf"
    },
    {
      label: "documents[].mediaType fallback",
      contentType: null,
      fallbackMediaType: "image/png",
      blob: new Blob(["image-content"]),
      expectedType: "image/png"
    },
    {
      label: "raw Blob fallback",
      contentType: null,
      fallbackMediaType: "   ",
      blob: new Blob(["raw-content"], { type: "text/plain" }),
      expectedType: "text/plain"
    }
  ])("resolves the local MIME from $label", async ({ contentType, fallbackMediaType, blob, expectedType }) => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return "blob:mime-test";
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn()
    });

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Mime resolution"
                }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee10",
                    mediaType: fallbackMediaType
                  })
                ]
              })
            ]
          })
        ),
      extras: [
        () =>
          createDocumentDownloadResponse({
            blob,
            contentDisposition: 'attachment; filename="support.pdf"',
            contentType
          }).response
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.click(
      within(getWorkpaperCard("BS.ASSET.CURRENT_SECTION")).getByRole("button", {
        name: "Telecharger le document"
      })
    );

    expect(createObjectURL.mock.calls[0]?.[0]?.type).toBe(expectedType);
  });

  it.each([
    { label: "401", response: () => jsonResponse(401, {}), text: "authentification requise" },
    { label: "403", response: () => jsonResponse(403, {}), text: "acces documents refuse" },
    {
      label: "404",
      response: () => jsonResponse(404, {}),
      text: "document introuvable pour telechargement"
    },
    {
      label: "5xx",
      response: () => jsonResponse(500, {}),
      text: "erreur serveur documents"
    },
    {
      label: "network",
      response: () => Promise.reject(new Error("network")),
      text: "erreur reseau documents"
    },
    {
      label: "timeout",
      response: () => Promise.reject(new Error("timeout")),
      text: "timeout documents"
    },
    {
      label: "unexpected 400",
      response: () => jsonResponse(400, {}),
      text: "telechargement indisponible"
    }
  ])("renders the exact download error '$text' on $label without refreshing workpapers", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Download errors"
                }),
                documents: [
                  createDocument({
                    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee11"
                  })
                ]
              })
            ]
          })
        ),
      extras: [response]
    });

    renderClosingRoute();
    await waitForNominalShell();

    await user.click(
      within(getWorkpaperCard("BS.ASSET.CURRENT_SECTION")).getByRole("button", {
        name: "Telecharger le document"
      })
    );

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePathsAllowingDocumentDownloads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 0,
      documentContentGets: 1
    });
  });

  it("does not emit any upload request on file or metadata changes, then posts the exact FormData payload and refreshes only GET /workpapers after a valid success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const selectedFile = createUploadFile();
    const initialWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "BS.ASSET.DRAFT",
          anchorLabel: "Current assets draft",
          workpaper: createWorkpaperDetails({
            status: "DRAFT",
            noteText: "Draft note"
          }),
          documents: []
        })
      ]
    });
    const refreshedWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "BS.ASSET.DRAFT",
          anchorLabel: "Current assets draft",
          workpaper: createWorkpaperDetails({
            status: "DRAFT",
            noteText: "Draft note"
          }),
          documents: [
            createDocument({
              fileName: "refreshed-only.pdf",
              mediaType: "application/pdf",
              sourceLabel: "ERP",
              verificationStatus: "UNVERIFIED"
            })
          ]
        })
      ]
    });

    primeNominalRoute(fetchMock, {
      workpapers: () => jsonResponse(200, initialWorkpapers),
      extras: [
        () =>
          jsonResponse(
            201,
            {
              ...createDocumentUploadSuccessPayload({
                file: selectedFile,
                sourceLabel: "ERP",
                documentDate: "2026-02-15"
              }),
              fileName: "server-only.pdf"
            }
          ),
        () => jsonResponse(200, refreshedWorkpapers)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const draftCard = getWorkpaperCard("BS.ASSET.DRAFT");
    const fileInput = within(draftCard).getByLabelText("Fichier document");
    const sourceInput = within(draftCard).getByLabelText("Source document");
    const dateInput = within(draftCard).getByLabelText("Date document");
    const uploadButton = within(draftCard).getByRole("button", {
      name: "Uploader le document"
    });

    await user.upload(fileInput, selectedFile);
    expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(0);

    await user.type(sourceInput, "ERP");
    expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(0);

    fireEvent.change(dateInput, { target: { value: "2026-02-15" } });
    expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(0);
    expect(within(draftCard).getByText("fichier pret pour upload")).toBeInTheDocument();

    await user.click(uploadButton);

    expect(await screen.findByText("document uploade avec succes")).toBeInTheDocument();
    expect(await screen.findByText(/refreshed-only\.pdf/)).toBeInTheDocument();
    expect(screen.queryByText(/server-only\.pdf/)).not.toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(2);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/controls"))
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/financial-summary"))
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((path) =>
        path.endsWith("/financial-statements/structured")
      )
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/mappings/manual"))
    ).toHaveLength(1);

    const [, init] = getWorkpaperDocumentPostCalls(fetchMock)[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    const formData = init.body as FormData;
    const entries = Array.from(formData.entries());

    expect(headers).toEqual(
      expect.objectContaining({
        Accept: "application/json",
        "X-Tenant-Id": ACTIVE_TENANT.tenantId
      })
    );
    expect(headers["Content-Type"]).toBeUndefined();
    expect(entries.map(([key]) => key)).toEqual(["file", "sourceLabel", "documentDate"]);
    expect(entries[0]?.[1]).toBe(selectedFile);
    expect(entries[1]?.[1]).toBe("ERP");
    expect(entries[2]?.[1]).toBe("2026-02-15");
    expectNoOutOfScopePathsAllowingDocumentUploads(fetchMock, {
      workpapersGets: 2,
      workpapersPuts: 0,
      workpaperDocumentPosts: 1
    });
  });

  it.each([
    {
      label: "multiple files",
      arrange: async (card: HTMLElement) => {
        fireEvent.change(within(card).getByLabelText("Fichier document"), {
          target: { files: [createUploadFile("first.pdf"), createUploadFile("second.pdf")] }
        });
      },
      text: "un seul fichier est autorise"
    },
    {
      label: "disallowed MIME with allowed extension",
      arrange: async (card: HTMLElement) => {
        fireEvent.change(within(card).getByLabelText("Fichier document"), {
          target: { files: [createUploadFile("support.pdf", "text/plain", "plain")] }
        });
      },
      text: "format de fichier non autorise"
    },
    {
      label: "empty MIME with allowed extension",
      arrange: async (card: HTMLElement) => {
        const user = userEvent.setup();
        await user.upload(
          within(card).getByLabelText("Fichier document"),
          createUploadFile("support.PDF", "", "pdf-content")
        );
        await user.type(within(card).getByLabelText("Source document"), "ERP");
      },
      text: "fichier pret pour upload"
    },
    {
      label: "empty MIME with disallowed extension",
      arrange: async (card: HTMLElement) => {
        fireEvent.change(within(card).getByLabelText("Fichier document"), {
          target: { files: [createUploadFile("support.txt", "", "txt")] }
        });
      },
      text: "format de fichier non autorise"
    },
    {
      label: "zero-byte file",
      arrange: async (card: HTMLElement) => {
        const user = userEvent.setup();
        await user.upload(
          within(card).getByLabelText("Fichier document"),
          createUploadFile("empty.pdf", "application/pdf", "")
        );
      },
      text: "fichier vide"
    },
    {
      label: "oversized file",
      arrange: async (card: HTMLElement) => {
        const user = userEvent.setup();
        await user.upload(
          within(card).getByLabelText("Fichier document"),
          new File([new Uint8Array(26 * 1024 * 1024)], "huge.pdf", {
            type: "application/pdf"
          })
        );
      },
      text: "fichier trop volumineux (25 MiB max)"
    },
    {
      label: "blank source label",
      arrange: async (card: HTMLElement) => {
        const user = userEvent.setup();
        await user.upload(within(card).getByLabelText("Fichier document"), createUploadFile());
        await user.type(within(card).getByLabelText("Source document"), "   ");
      },
      text: "source du document requise"
    },
    {
      label: "invalid document date",
      arrange: async (card: HTMLElement) => {
        const user = userEvent.setup();
        await user.upload(within(card).getByLabelText("Fichier document"), createUploadFile());
        await user.type(within(card).getByLabelText("Source document"), "ERP");
        const dateInput = within(card).getByLabelText("Date document") as HTMLInputElement;
        Object.defineProperty(dateInput, "value", {
          configurable: true,
          value: "2026-02-31"
        });
        fireEvent.change(dateInput);
      },
      text: "date document invalide"
    },
    {
      label: "allowed MIME with disallowed extension",
      arrange: async (card: HTMLElement) => {
        const user = userEvent.setup();
        await user.upload(
          within(card).getByLabelText("Fichier document"),
          createUploadFile("support.weird", "application/pdf", "pdf-content")
        );
        await user.type(within(card).getByLabelText("Source document"), "ERP");
      },
      text: "fichier pret pour upload"
    }
  ])("renders the exact local upload validation '$text' for $label and emits no POST", async ({ arrange, text }) => {
    const fetchMock = vi.mocked(global.fetch);

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.DRAFT",
                anchorLabel: "Current assets draft",
                workpaper: createWorkpaperDetails({
                  status: "DRAFT",
                  noteText: "Draft note"
                })
              })
            ]
          })
        )
    });

    renderClosingRoute();
    await waitForNominalShell();

    const draftCard = getWorkpaperCard("BS.ASSET.DRAFT");
    await arrange(draftCard);

    expect(within(draftCard).getByText(text)).toBeInTheDocument();
    if (text !== "fichier pret pour upload") {
      expect(
        within(draftCard).getByRole("button", { name: "Uploader le document" })
      ).toBeDisabled();
    }
    expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(0);
    expectNoOutOfScopePathsAllowingDocumentUploads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 0
    });
  });

  it("allows only one document upload in flight across the whole block", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.ONE",
                anchorLabel: "Current assets one",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "One" })
              }),
              createCurrentItem({
                anchorCode: "BS.ASSET.TWO",
                anchorLabel: "Current assets two",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Two" })
              })
            ]
          })
        ),
      extras: [() => new Promise(() => {})]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.upload(within(firstCard).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(firstCard).getByLabelText("Source document"), "ERP");
    await user.upload(within(secondCard).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(secondCard).getByLabelText("Source document"), "ERP");

    await user.click(
      within(firstCard).getByRole("button", { name: "Uploader le document" })
    );

    expect(await screen.findByText("upload document en cours")).toBeInTheDocument();
    expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(1);
    expect(
      within(secondCard).getByRole("button", { name: "Uploader le document" })
    ).toBeDisabled();

    await user.click(
      within(secondCard).getByRole("button", { name: "Uploader le document" })
    );

    expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePathsAllowingDocumentUploads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 1
    });
  });

  it("keeps upload controls disabled while a workpaper PUT is submitting and never emits POST /documents in that state", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.ONE",
                anchorLabel: "Current assets one",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "One" })
              }),
              createCurrentItem({
                anchorCode: "BS.ASSET.TWO",
                anchorLabel: "Current assets two",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Two" })
              })
            ]
          })
        ),
      extras: [() => new Promise(() => {})]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.clear(within(firstCard).getByLabelText("Note workpaper"));
    await user.type(within(firstCard).getByLabelText("Note workpaper"), "Updated one");
    await user.upload(within(secondCard).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(secondCard).getByLabelText("Source document"), "ERP");

    await user.click(
      within(firstCard).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(await screen.findByText("enregistrement workpaper en cours")).toBeInTheDocument();
    expect(
      within(secondCard).getByRole("button", { name: "Uploader le document" })
    ).toBeDisabled();
    expect(getWorkpaperDocumentPostCalls(fetchMock)).toHaveLength(0);
  });

  it("keeps the last rendered workpapers block visible and shows the refresh failure after a valid document upload success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const selectedFile = createUploadFile();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.DRAFT",
                anchorLabel: "Current assets draft",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Draft note" })
              })
            ]
          })
        ),
      extras: [
        () =>
          jsonResponse(
            201,
            createDocumentUploadSuccessPayload({
              file: selectedFile,
              sourceLabel: "ERP",
              documentDate: null
            })
          ),
        () => jsonResponse(500, {})
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.upload(within(card).getByLabelText("Fichier document"), selectedFile);
    await user.type(within(card).getByLabelText("Source document"), "ERP");
    await user.click(within(card).getByRole("button", { name: "Uploader le document" }));

    expect(await screen.findByText("document uploade avec succes")).toBeInTheDocument();
    expect(
      await screen.findByText("rafraichissement workpapers impossible")
    ).toBeInTheDocument();
    expect(getWorkpaperCard("BS.ASSET.DRAFT")).toBeInTheDocument();
    expectNoOutOfScopePathsAllowingDocumentUploads(fetchMock, {
      workpapersGets: 2,
      workpapersPuts: 0,
      workpaperDocumentPosts: 1
    });
  });

  it("treats an invalid POST /documents success payload as payload upload document invalide and does not refresh GET /workpapers", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.DRAFT",
                anchorLabel: "Current assets draft",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Draft note" })
              })
            ]
          })
        ),
      extras: [
        () =>
          jsonResponse(201, {
            id: "not-a-uuid"
          })
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.upload(within(card).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(card).getByLabelText("Source document"), "ERP");
    await user.click(within(card).getByRole("button", { name: "Uploader le document" }));

    expect(await screen.findByText("payload upload document invalide")).toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePathsAllowingDocumentUploads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 1
    });
  });

  it.each([
    { label: "400", response: () => jsonResponse(400, {}), text: "document invalide" },
    { label: "401", response: () => jsonResponse(401, {}), text: "authentification requise" },
    { label: "403", response: () => jsonResponse(403, {}), text: "acces documents refuse" },
    {
      label: "404",
      response: () => jsonResponse(404, {}),
      text: "workpaper introuvable pour upload document"
    },
    {
      label: "409 archived",
      response: () =>
        jsonResponse(409, {
          message: "Closing folder is archived and documents cannot be modified."
        }),
      text: "dossier archive, document non modifiable"
    },
    {
      label: "409 readiness",
      response: () =>
        jsonResponse(409, {
          message: "Documents can only be modified when controls.readiness is READY."
        }),
      text: "document non modifiable tant que les controles ne sont pas READY"
    },
    {
      label: "409 stale",
      response: () =>
        jsonResponse(409, {
          message: "anchorCode is not part of the current structure."
        }),
      text: "document indisponible sur un workpaper stale"
    },
    {
      label: "409 workpaper status",
      response: () =>
        jsonResponse(409, {
          message: "workpaper status does not allow document uploads."
        }),
      text: "document non modifiable pour ce workpaper"
    },
    {
      label: "409 other",
      response: () => jsonResponse(409, { message: "other conflict" }),
      text: "upload document impossible"
    },
    {
      label: "413",
      response: () => jsonResponse(413, {}),
      text: "fichier trop volumineux (25 MiB max)"
    },
    {
      label: "5xx",
      response: () => jsonResponse(500, {}),
      text: "erreur serveur documents"
    },
    {
      label: "network",
      response: () => Promise.reject(new Error("network")),
      text: "erreur reseau documents"
    },
    {
      label: "timeout",
      response: () => Promise.reject(new Error("timeout")),
      text: "timeout documents"
    },
    {
      label: "unexpected 200",
      response: () => jsonResponse(200, {}),
      text: "upload document indisponible"
    }
  ])("renders the exact upload mutation error '$text' on $label", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.DRAFT",
                anchorLabel: "Current assets draft",
                workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Draft note" })
              })
            ]
          })
        ),
      extras: [response]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.upload(within(card).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(card).getByLabelText("Source document"), "ERP");
    await user.click(within(card).getByRole("button", { name: "Uploader le document" }));

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePathsAllowingDocumentUploads(fetchMock, {
      workpapersGets: 1,
      workpapersPuts: 0,
      workpaperDocumentPosts: 1
    });
  });

  it("allows only one mutation in flight across the whole block", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "BS.ASSET.ONE",
                anchorLabel: "Current assets one",
                workpaper: null
              }),
              createCurrentItem({
                anchorCode: "BS.ASSET.TWO",
                anchorLabel: "Current assets two",
                workpaper: null
              })
            ]
          })
        ),
      extras: [() => new Promise(() => {})]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.type(within(firstCard).getByLabelText("Note workpaper"), "First note");
    await user.type(within(secondCard).getByLabelText("Note workpaper"), "Second note");

    expect(screen.getAllByRole("button", { name: "Enregistrer le workpaper" })).toHaveLength(2);

    await user.click(
      within(firstCard).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(await screen.findByText("enregistrement workpaper en cours")).toBeInTheDocument();
    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(1);
    expect(
      within(secondCard).getByRole("button", { name: "Enregistrer le workpaper" })
    ).toBeDisabled();

    await user.click(
      within(secondCard).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(getWorkpapersPutCalls(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), {
      workpapersGets: 1,
      workpapersPuts: 1
    });
  });

  it("shows success, refreshes exactly GET /workpapers once, and does not refresh the other blocks after PUT success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();
    const initialWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "BS.ASSET.DRAFT",
          anchorLabel: "Current assets draft",
          workpaper: createWorkpaperDetails({
            status: "DRAFT",
            noteText: "Draft note"
          })
        })
      ]
    });
    const refreshedWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "BS.ASSET.DRAFT",
          anchorLabel: "Current assets draft",
          workpaper: createWorkpaperDetails({
            status: "READY_FOR_REVIEW",
            noteText: "Updated note"
          })
        })
      ]
    });

    primeNominalRoute(fetchMock, {
      workpapers: () => jsonResponse(200, initialWorkpapers),
      extras: [
        () =>
          jsonResponse(200, {
            anchorCode: "BS.ASSET.DRAFT",
            isCurrentStructure: true,
            workpaper: {
              status: "READY_FOR_REVIEW",
              noteText: "Updated note",
              evidences: [createEvidence()]
            }
          }),
        () => jsonResponse(200, refreshedWorkpapers)
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const draftCard = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.clear(within(draftCard).getByLabelText("Note workpaper"));
    await user.type(within(draftCard).getByLabelText("Note workpaper"), "Updated note");
    await user.selectOptions(
      within(draftCard).getByLabelText("Statut maker"),
      "READY_FOR_REVIEW"
    );
    await user.click(
      within(draftCard).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(await screen.findByText("workpaper enregistre avec succes")).toBeInTheDocument();
    expect(await screen.findByText("note workpaper : Updated note")).toBeInTheDocument();
    expect(await screen.findByText("etat workpaper : READY_FOR_REVIEW")).toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(2);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/controls"))
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/financial-summary"))
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((path) =>
        path.endsWith("/financial-statements/structured")
      )
    ).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter((path) => path.endsWith("/mappings/manual"))
    ).toHaveLength(1);
    expect(getRequestPaths(fetchMock).filter((path) => path === "/api/me")).toHaveLength(1);
    expect(
      getRequestPaths(fetchMock).filter(
        (path) => path === `/api/closing-folders/${CLOSING_FOLDER.id}`
      )
    ).toHaveLength(1);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), {
      workpapersGets: 2,
      workpapersPuts: 1
    });
  });

  it("keeps the last rendered workpapers block visible and shows the refresh failure after a valid PUT success", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [
              createCurrentItem({
                anchorCode: "PL.REVENUE.NEW",
                anchorLabel: "Revenue new",
                statementKind: "INCOME_STATEMENT",
                breakdownType: "LEGACY_BUCKET_FALLBACK",
                workpaper: null
              })
            ]
          })
        ),
      extras: [
        () =>
          jsonResponse(201, {
            anchorCode: "PL.REVENUE.NEW",
            isCurrentStructure: true,
            workpaper: {
              status: "DRAFT",
              noteText: "Saved locally",
              evidences: []
            }
          }),
        () => jsonResponse(500, {})
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("PL.REVENUE.NEW");
    await user.type(within(card).getByLabelText("Note workpaper"), "  Saved locally  ");
    await user.click(
      within(card).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(await screen.findByText("workpaper enregistre avec succes")).toBeInTheDocument();
    expect(
      await screen.findByText("rafraichissement workpapers impossible")
    ).toBeInTheDocument();
    const refreshedCard = getWorkpaperCard("PL.REVENUE.NEW");
    expect(refreshedCard).toBeInTheDocument();
    expect(within(refreshedCard).getByLabelText("Note workpaper")).toBeInTheDocument();
    expect(
      within(refreshedCard).getByRole("button", { name: "Enregistrer le workpaper" })
    ).toBeInTheDocument();
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), {
      workpapersGets: 2,
      workpapersPuts: 1
    });
  });

  it("treats an invalid PUT success payload as payload workpaper invalide and does not refresh GET /workpapers", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [createCurrentItem({ workpaper: null })]
          })
        ),
      extras: [
        () =>
          jsonResponse(200, {
            anchorCode: "WRONG.ANCHOR",
            isCurrentStructure: true,
            workpaper: {
              status: "DRAFT",
              noteText: "Broken payload",
              evidences: []
            }
          })
      ]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.type(within(card).getByLabelText("Note workpaper"), "Broken payload");
    await user.click(
      within(card).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(await screen.findByText("payload workpaper invalide")).toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), {
      workpapersGets: 1,
      workpapersPuts: 1
    });
  });

  it.each([
    { label: "400", response: () => jsonResponse(400, {}), text: "workpaper invalide" },
    { label: "401", response: () => jsonResponse(401, {}), text: "authentification requise" },
    { label: "403", response: () => jsonResponse(403, {}), text: "acces workpapers refuse" },
    { label: "404", response: () => jsonResponse(404, {}), text: "dossier introuvable" },
    {
      label: "409 archived",
      response: () =>
        jsonResponse(409, {
          message: "Closing folder is archived and workpapers cannot be modified."
        }),
      text: "dossier archive, workpaper non modifiable"
    },
    {
      label: "409 readiness",
      response: () =>
        jsonResponse(409, {
          message: "Workpapers can only be modified when controls.readiness is READY."
        }),
      text: "workpaper non modifiable tant que les controles ne sont pas READY"
    },
    {
      label: "409 other",
      response: () =>
        jsonResponse(409, {
          message: "anchorCode is not part of the current structure."
        }),
      text: "mise a jour workpaper impossible"
    },
    { label: "5xx", response: () => jsonResponse(500, {}), text: "erreur serveur workpapers" },
    {
      label: "network",
      response: () => Promise.reject(new Error("network")),
      text: "erreur reseau workpapers"
    },
    {
      label: "timeout",
      response: () => Promise.reject(new Error("timeout")),
      text: "timeout workpapers"
    },
    { label: "unexpected", response: () => jsonResponse(418, {}), text: "workpaper indisponible" }
  ])("renders the exact mutation error '$text' on $label", async ({ response, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    const user = userEvent.setup();

    primeNominalRoute(fetchMock, {
      workpapers: () =>
        jsonResponse(
          200,
          createWorkpapersModel({
            items: [createCurrentItem({ workpaper: null })]
          })
        ),
      extras: [response]
    });

    renderClosingRoute();
    await waitForNominalShell();

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.type(within(card).getByLabelText("Note workpaper"), "Save me");
    await user.click(
      within(card).getByRole("button", { name: "Enregistrer le workpaper" })
    );

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(getWorkpapersGetPaths(fetchMock)).toHaveLength(1);
    expectNoOutOfScopePaths(getRequestPaths(fetchMock), {
      workpapersGets: 1,
      workpapersPuts: 1
    });
  });
});
