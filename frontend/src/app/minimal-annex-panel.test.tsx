import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MinimalAnnexPanel } from "./minimal-annex-panel";
import type { MinimalAnnexReadModel } from "../lib/api/minimal-annex";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const READY_MINIMAL_ANNEX: MinimalAnnexReadModel = {
  closingFolderId: CLOSING_FOLDER_ID,
  closingFolderStatus: "DRAFT",
  readiness: "READY",
  annexState: "READY",
  presentationType: "MINIMAL_OPERATIONAL_ANNEX",
  isStatutory: false,
  requiresHumanReview: true,
  legalNotice: {
    title: "Annexe minimale operationnelle, non statutaire.",
    notOfficialCoAnnex: "Not a final CO deliverable.",
    noAutomaticValidation: "Aucune decision comptable automatique n'est effectuee.",
    humanReviewRequired: "Revue humaine requise avant tout usage engageant."
  },
  basis: {
    controlsReadiness: "READY",
    latestImportVersion: 3,
    taxonomyVersion: 2,
    structuredStatementState: "PREVIEW_READY",
    structuredPresentationType: "STRUCTURED_PREVIEW",
    exportPack: {
      exportPackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      createdAt: "2026-02-01T10:00:00Z",
      basisImportVersion: 3,
      basisTaxonomyVersion: 2
    }
  },
  blockers: [],
  warnings: [
    {
      code: "LEGACY_MAPPING_FALLBACK_USED",
      message: "Legacy mapping fallback is included as a review warning.",
      source: "FINANCIAL_STATEMENTS_STRUCTURED",
      target: {
        type: "WORKPAPER_ANCHOR",
        code: "BS.ASSET",
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
      }
    }
  ],
  annex: {
    financialStatements: {
      presentationType: "STRUCTURED_PREVIEW",
      latestImportVersion: 3,
      taxonomyVersion: 2,
      balanceSheet: {
        groups: [
          {
            code: "BS.ASSET",
            label: "Asset",
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
            label: "Revenue",
            total: "100",
            breakdowns: []
          }
        ],
        totals: {
          totalRevenue: "100",
          totalExpenses: "0",
          netResult: "100"
        }
      }
    },
    workpapers: [
      {
        anchorCode: "BS.ASSET",
        anchorLabel: "Asset",
        summaryBucketCode: "BS.ASSET",
        statementKind: "BALANCE_SHEET",
        breakdownType: "SECTION",
        workpaperId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        noteText: "Reviewed.",
        reviewedAt: "2026-01-31T10:00:00Z",
        reviewedByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        documents: [
          {
            documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            fileName: "support.pdf",
            mediaType: "application/pdf",
            byteSize: 128,
            checksumSha256:
              "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            sourceLabel: "ERP",
            documentDate: "2025-12-31",
            verificationStatus: "VERIFIED",
            evidenceRole: "VERIFIED_SUPPORT"
          }
        ]
      }
    ],
    evidenceSummary: {
      currentWorkpaperCount: 1,
      attachedDocumentCount: 1,
      verifiedDocumentCount: 1,
      rejectedDocumentTraceCount: 0,
      staleWorkpaperExcludedCount: 0,
      currentWorkpaperWithoutDocumentCount: 0
    },
    preparationLimits: ["Prepared for human review."]
  }
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function blockedMinimalAnnex(): MinimalAnnexReadModel {
  return {
    ...READY_MINIMAL_ANNEX,
    readiness: "BLOCKED",
    annexState: "BLOCKED",
    basis: {
      controlsReadiness: "BLOCKED",
      latestImportVersion: null,
      taxonomyVersion: 2,
      structuredStatementState: "NO_DATA",
      structuredPresentationType: "STRUCTURED_PREVIEW",
      exportPack: null
    },
    blockers: [
      {
        code: "CLOSING_NOT_READY",
        message: "Closing controls are not ready.",
        source: "CONTROLS",
        target: null
      },
      {
        code: "EXPORT_PACK_MISSING",
        message: "No audit-ready export pack exists for this closing folder.",
        source: "EXPORT_PACK",
        target: null
      }
    ],
    warnings: [],
    annex: null
  };
}

function renderPanel() {
  return render(
    <MinimalAnnexPanel activeTenant={ACTIVE_TENANT} closingFolderId={CLOSING_FOLDER_ID} />
  );
}

describe("MinimalAnnexPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows loading and error states", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));

    const loadingRender = renderPanel();
    expect(screen.getByText("loading minimal annex preview")).toBeInTheDocument();
    loadingRender.unmount();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(500, {})));

    renderPanel();
    expect(await screen.findByText("Minimal annex preview unavailable.")).toBeInTheDocument();
  });

  it("renders BLOCKED state with blockers, basis, and non-statutory limits", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, blockedMinimalAnnex()));

    const { container } = renderPanel();

    expect(await screen.findAllByText("BLOCKED")).toHaveLength(2);
    expect(screen.getByText("CLOSING_NOT_READY / CONTROLS")).toBeInTheDocument();
    expect(screen.getByText("Closing controls are not ready.")).toBeInTheDocument();
    expect(screen.getByText("EXPORT_PACK_MISSING / EXPORT_PACK")).toBeInTheDocument();
    expect(screen.getByText("export pack basis : absent")).toBeInTheDocument();
    expect(
      screen.getByText("Evidence summary unavailable while preview is BLOCKED.")
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("Preview non statutaire.");
    expect(container).toHaveTextContent("Human review required.");
    expect(container).toHaveTextContent("Not a final CO deliverable.");
    expect(container).toHaveTextContent("Do not use as statutory filing.");
  });

  it("renders READY state with warnings, basis summary, and evidence summary only", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MINIMAL_ANNEX));

    const { container } = renderPanel();

    expect(await screen.findAllByText("READY")).toHaveLength(2);
    expect(screen.getByText("LEGACY_MAPPING_FALLBACK_USED / FINANCIAL_STATEMENTS_STRUCTURED")).toBeInTheDocument();
    expect(
      screen.getByText("Legacy mapping fallback is included as a review warning.")
    ).toBeInTheDocument();
    expect(screen.getByText("controls readiness : READY")).toBeInTheDocument();
    expect(screen.getByText("latest import version : 3")).toBeInTheDocument();
    expect(screen.getByText("export pack basis : present")).toBeInTheDocument();
    expect(screen.getByText("current workpapers : 1")).toBeInTheDocument();
    expect(screen.getByText("verified documents : 1")).toBeInTheDocument();

    expect(container).not.toHaveTextContent("support.pdf");
    expect(container).not.toHaveTextContent("abcdef0123456789");
    expect(container).not.toHaveTextContent("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  });

  it("does not expose forbidden wording, mutations, export, download, content, storage, or browser storage", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const storageSetItem = vi.spyOn(Storage.prototype, "setItem");
    const storageGetItem = vi.spyOn(Storage.prototype, "getItem");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MINIMAL_ANNEX));

    const { container } = renderPanel();
    await screen.findAllByText("READY");

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent("/content");
    expect(container).not.toHaveTextContent("/minimal-annex/content");
    expect(container).not.toHaveTextContent("export/download");
    expect(storageSetItem).not.toHaveBeenCalled();
    expect(storageGetItem).not.toHaveBeenCalled();

    const forbiddenPhrases = [
      "annexe CO " + "finale",
      "annexe " + "officielle",
      "etats financiers " + "officiels",
      "CO-" + "ready",
      "statutory-" + "ready",
      "conforme " + "CO",
      "valid" + "ated",
      "approv" + "ed",
      "automatically " + "approved",
      "final accounts " + "approved",
      "ready to " + "file",
      "pack final pret a " + "deposer",
      "sign" + "ature",
      "cert" + "ified",
      "official financial " + "statements",
      "final CO " + "annex"
    ];

    for (const phrase of forbiddenPhrases) {
      expect(container).not.toHaveTextContent(new RegExp(phrase, "i"));
    }
  });

  it("does not expose storage keys, signed URLs, private paths, or storage metadata from invalid payloads", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        ...READY_MINIMAL_ANNEX,
        annex: {
          ...READY_MINIMAL_ANNEX.annex,
          storageObjectKey: "gs://private-bucket/support.pdf",
          signedUrl: "https://storage.googleapis.com/private/support.pdf"
        }
      })
    );

    const { container } = renderPanel();

    expect(await screen.findByText("Minimal annex preview unavailable.")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("storageObjectKey");
    expect(container).not.toHaveTextContent("signedUrl");
    expect(container).not.toHaveTextContent("gs://");
    expect(container).not.toHaveTextContent("private-bucket");
    expect(container).not.toHaveTextContent("storage.googleapis.com");
  });

  it("keeps blocker messages visible but withholds forbidden claims from displayed issue text", async () => {
    const forbiddenIssueText = "ready to " + "file";
    const payload: MinimalAnnexReadModel = {
      ...blockedMinimalAnnex(),
      blockers: [
        {
          code: "CLOSING_NOT_READY",
          message: forbiddenIssueText,
          source: "CONTROLS",
          target: null
        }
      ]
    };
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));

    renderPanel();

    const blockers = await screen.findByRole("heading", { name: "Blockers" });
    const block = blockers.closest("section");

    expect(block).not.toBeNull();
    expect(within(block as HTMLElement).getByText("CLOSING_NOT_READY / CONTROLS")).toBeInTheDocument();
    expect(
      within(block as HTMLElement).getByText("Issue message held for human review.")
    ).toBeInTheDocument();
    expect(screen.queryByText(forbiddenIssueText)).not.toBeInTheDocument();
  });
});
