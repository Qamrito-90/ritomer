import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MinimalAnnexPanel } from "./minimal-annex-panel";
import type { MinimalAnnexReadModel } from "../lib/api/minimal-annex";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MINIMAL_ANNEX_UNAVAILABLE_MESSAGE = [
  "Previsualisation annexe minimale indisponible : les donnees de revue ne sont pas encore exploitables.",
  "Consequence : l'annexe ne peut pas etre consultee dans ce panneau.",
  "Action : completez les justifications, verifiez les preuves et levez les points de revue ouverts."
].join(" ");

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
    notOfficialCoAnnex: "Pas un livrable statutaire final.",
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
    preparationLimits: ["Preparee pour revue humaine."]
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

function renderPanel(postExportPackRefreshRequestId = 0) {
  return render(
    <MinimalAnnexPanel
      activeTenant={ACTIVE_TENANT}
      closingFolderId={CLOSING_FOLDER_ID}
      postExportPackRefreshRequestId={postExportPackRefreshRequestId}
    />
  );
}

function renderPanelElement(postExportPackRefreshRequestId = 0) {
  return (
    <MinimalAnnexPanel
      activeTenant={ACTIVE_TENANT}
      closingFolderId={CLOSING_FOLDER_ID}
      postExportPackRefreshRequestId={postExportPackRefreshRequestId}
    />
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
    expect(screen.getByText("chargement previsualisation annexe minimale")).toBeInTheDocument();
    loadingRender.unmount();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(500, {})));

    renderPanel();
    expect(await screen.findByText(MINIMAL_ANNEX_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText(/Consequence : l'annexe ne peut pas etre consultee/)).toBeInTheDocument();
    expect(screen.getByText(/Action : completez les justifications/)).toBeInTheDocument();
  });

  it("renders BLOCKED state with blockers, basis, and non-statutory limits", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, blockedMinimalAnnex()));

    const { container } = renderPanel();

    expect(await screen.findByText("Bloque")).toBeInTheDocument();
    expect(screen.getByText("Contenu manquant")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Consequence : annexe indisponible pour revue tant que ces points ne sont pas leves. Action : completez les justifications, verifiez les preuves et preparez le pack de revue si necessaire."
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Origine controles/)).toBeInTheDocument();
    expect(screen.getByText("Code technique CLOSING_NOT_READY")).toBeInTheDocument();
    expect(screen.getByText("Closing controls are not ready.")).toBeInTheDocument();
    expect(screen.getByText(/Origine pack de revue/)).toBeInTheDocument();
    expect(screen.getByText("Code technique EXPORT_PACK_MISSING")).toBeInTheDocument();
    expect(screen.getByText("pack de revue : manquant")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Consequence : annexe indisponible pour revue. La synthese des preuves sera disponible quand les blocages seront leves."
      )
    ).toBeInTheDocument();
    expect(container).toHaveTextContent("Previsualisation non statutaire et en lecture seule.");
    expect(container).toHaveTextContent("Revue humaine obligatoire.");
    expect(container).toHaveTextContent("Pas un livrable statutaire final.");
    expect(container).toHaveTextContent("Ne pas utiliser comme depot officiel.");
  });

  it("renders READY state with warnings, basis summary, and evidence summary only", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MINIMAL_ANNEX));

    const { container } = renderPanel();

    expect(await screen.findByText("Pret pour revue")).toBeInTheDocument();
    expect(screen.getAllByText("Contenu disponible").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/Origine previsualisation structuree/)
    ).toBeInTheDocument();
    expect(screen.getByText("Code technique LEGACY_MAPPING_FALLBACK_USED")).toBeInTheDocument();
    expect(screen.getByText("Reference technique BS.ASSET")).toBeInTheDocument();
    expect(
      screen.getByText("Legacy mapping fallback is included as a review warning.")
    ).toBeInTheDocument();
    expect(screen.getByText("controles : pret")).toBeInTheDocument();
    expect(screen.getByText("derniere version import : 3")).toBeInTheDocument();
    expect(screen.getByText("pack de revue : disponible")).toBeInTheDocument();
    expect(screen.getByText("Montants repris de la preview")).toBeInTheDocument();
    expect(screen.getAllByText("CHF 100.00").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("CHF 0.00").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("justifications courantes : 1")).toBeInTheDocument();
    expect(screen.getByText("documents verifies : 1")).toBeInTheDocument();
    expect(screen.getByText("Preuves verifiees")).toBeInTheDocument();
    expect(screen.getByText("Contenu manquant")).toBeInTheDocument();

    expect(container).not.toHaveTextContent("support.pdf");
    expect(container).not.toHaveTextContent("abcdef0123456789");
    expect(container).not.toHaveTextContent("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee");
  });

  it("refreshes after export pack creation and replaces the preview with an exploitable BLOCKED payload", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MINIMAL_ANNEX))
      .mockResolvedValueOnce(jsonResponse(200, blockedMinimalAnnex()));

    const { rerender } = renderPanel();

    expect(await screen.findByText("Pret pour revue")).toBeInTheDocument();

    rerender(renderPanelElement(1));

    expect(await screen.findByText("Bloque")).toBeInTheDocument();
    expect(screen.getByText("pack de revue : manquant")).toBeInTheDocument();
    expect(
      screen.queryByText("rafraichissement annexe minimale impossible")
    ).not.toBeInTheDocument();
  });

  it.each([
    {
      label: "HTTP error",
      nextResponse: () => Promise.resolve(jsonResponse(500, {}))
    },
    {
      label: "timeout",
      nextResponse: () => Promise.reject(new Error("timeout"))
    },
    {
      label: "network error",
      nextResponse: () => Promise.reject(new TypeError("network unavailable"))
    },
    {
      label: "invalid payload",
      nextResponse: () => Promise.resolve(jsonResponse(200, { ...READY_MINIMAL_ANNEX, annex: null }))
    }
  ])(
    "keeps the previous preview and shows the exact post-action warning on $label",
    async ({ nextResponse }) => {
      const fetchMock = vi.mocked(global.fetch);
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, READY_MINIMAL_ANNEX))
        .mockImplementationOnce(nextResponse);

      const { rerender } = renderPanel();

      expect(await screen.findByText("Pret pour revue")).toBeInTheDocument();
      expect(screen.getByText("pack de revue : disponible")).toBeInTheDocument();

      rerender(renderPanelElement(1));

      expect(
        await screen.findByText("rafraichissement annexe minimale impossible")
      ).toBeInTheDocument();
      expect(screen.getByText("Pret pour revue")).toBeInTheDocument();
      expect(screen.getByText("pack de revue : disponible")).toBeInTheDocument();
    }
  );

  it("removes the post-action warning after a later successful refresh", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, READY_MINIMAL_ANNEX))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, blockedMinimalAnnex()));

    const { rerender } = renderPanel();

    expect(await screen.findByText("Pret pour revue")).toBeInTheDocument();

    rerender(renderPanelElement(1));
    expect(
      await screen.findByText("rafraichissement annexe minimale impossible")
    ).toBeInTheDocument();

    rerender(renderPanelElement(2));

    expect(await screen.findByText("Bloque")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.queryByText("rafraichissement annexe minimale impossible")
      ).not.toBeInTheDocument();
    });
  });

  it("does not expose forbidden wording, mutations, export, download, content, storage, or browser storage", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const storageSetItem = vi.spyOn(Storage.prototype, "setItem");
    const storageGetItem = vi.spyOn(Storage.prototype, "getItem");
    fetchMock.mockResolvedValueOnce(jsonResponse(200, READY_MINIMAL_ANNEX));

    const { container } = renderPanel();
    await screen.findByText("Pret pour revue");

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

    expect(await screen.findByText(MINIMAL_ANNEX_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
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

    const blockers = await screen.findByRole("heading", { name: "Blocages" });
    const block = blockers.closest("section");

    expect(block).not.toBeNull();
    expect(
      within(block as HTMLElement).getByText(/Origine controles/)
    ).toBeInTheDocument();
    expect(
      within(block as HTMLElement).getByText("Code technique CLOSING_NOT_READY")
    ).toBeInTheDocument();
    expect(
      within(block as HTMLElement).getByText("Message masque pour revue humaine.")
    ).toBeInTheDocument();
    expect(screen.queryByText(forbiddenIssueText)).not.toBeInTheDocument();
  });
});
