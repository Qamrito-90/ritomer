import { describe, expect, it } from "vitest";
import type { WorkpaperDocument, WorkpaperReadModelItem } from "../../lib/api/workpapers";
import {
  formatWorkpaperMutationState,
  getDocumentDecisionStatusLines,
  getDocumentDownloadStatusLine,
  getDocumentUploadStatusLines,
  getWorkpaperDecisionStatusLines,
  mapDocumentDecisionResult,
  mapDocumentDownloadResult,
  mapDocumentUploadResult,
  mapWorkpaperDecisionResult,
  mapWorkpaperMutationResult
} from "./status-lines";
import type { DocumentUploadDraft } from "./types";

const DOCUMENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function createDocument(overrides: Partial<WorkpaperDocument> = {}): WorkpaperDocument {
  return {
    id: DOCUMENT_ID,
    fileName: "support.pdf",
    mediaType: "application/pdf",
    sourceLabel: "ERP",
    verificationStatus: "UNVERIFIED",
    reviewComment: null,
    ...overrides
  };
}

function validUploadDraft(overrides: Partial<DocumentUploadDraft> = {}): DocumentUploadDraft {
  return {
    file: new File(["content"], "support.pdf", { type: "application/pdf" }),
    selectedFileCount: 1,
    sourceLabel: "ERP",
    documentDate: "",
    ...overrides
  };
}

function createWorkpaperItem(
  overrides: Partial<WorkpaperReadModelItem> = {}
): WorkpaperReadModelItem {
  return {
    anchorCode: "BS.ASSET.CURRENT_SECTION",
    anchorLabel: "Current assets",
    statementKind: "BALANCE_SHEET",
    breakdownType: "SECTION",
    isCurrentStructure: true,
    workpaper: {
      status: "READY_FOR_REVIEW",
      noteText: "Ready support",
      evidences: []
    },
    documents: [],
    documentVerificationSummary: {
      documentsCount: 0,
      unverifiedCount: 0,
      verifiedCount: 0,
      rejectedCount: 0
    },
    ...overrides
  };
}

describe("workpapers-panel status line helpers", () => {
  it("maps download states to the exact visible lines", () => {
    expect(getDocumentDownloadStatusLine(createDocument({ id: "invalid" }), { kind: "idle" })).toBe(
      "telechargement indisponible"
    );
    expect(getDocumentDownloadStatusLine(createDocument(), { kind: "idle" })).toBe(null);
    expect(
      getDocumentDownloadStatusLine(createDocument(), {
        kind: "submitting",
        documentId: DOCUMENT_ID
      })
    ).toBe("Telechargement de la piece en cours");
    expect(
      getDocumentDownloadStatusLine(createDocument(), {
        kind: "forbidden",
        documentId: DOCUMENT_ID
      })
    ).toBe("acces pieces refuse");
    expect(
      getDocumentDownloadStatusLine(createDocument(), {
        kind: "unexpected",
        documentId: DOCUMENT_ID
      })
    ).toBe("telechargement indisponible");
  });

  it("maps decision states and draft validation to exact visible lines", () => {
    expect(
      getDocumentDecisionStatusLines(
        DOCUMENT_ID,
        { decision: "REJECTED", comment: " " },
        { kind: "idle" }
      )
    ).toEqual(["commentaire de verification requis"]);
    expect(
      getDocumentDecisionStatusLines(
        DOCUMENT_ID,
        { decision: "VERIFIED", comment: "" },
        { kind: "success", documentId: DOCUMENT_ID, refreshFailed: true }
      )
    ).toEqual(["Verification de la piece enregistree", "rafraichissement justifications impossible"]);
    expect(
      getDocumentDecisionStatusLines(
        DOCUMENT_ID,
        { decision: "VERIFIED", comment: "" },
        { kind: "conflict_workpaper_status", documentId: DOCUMENT_ID }
      )
    ).toEqual(["Verification disponible quand la justification est prete pour revue"]);
    expect(
      getDocumentDecisionStatusLines(
        DOCUMENT_ID,
        { decision: "VERIFIED", comment: "" },
        { kind: "invalid_payload", documentId: DOCUMENT_ID }
      )
    ).toEqual(["Données de preuves incohérentes. L’écran reste bloqué par sécurité."]);
  });

  it("maps upload states and upload draft validation to exact visible lines", () => {
    expect(getDocumentUploadStatusLines("A", validUploadDraft(), { kind: "idle" })).toEqual([
      "Piece prete a ajouter"
    ]);
    expect(
      getDocumentUploadStatusLines(
        "A",
        validUploadDraft({ file: null, selectedFileCount: 0 }),
        { kind: "idle" }
      )
    ).toEqual(["selectionner un fichier"]);
    expect(
      getDocumentUploadStatusLines("A", validUploadDraft(), {
        kind: "success",
        anchorCode: "A",
        refreshFailed: true
      })
    ).toEqual(["Piece ajoutee avec succes", "rafraichissement justifications impossible"]);
    expect(
      getDocumentUploadStatusLines("A", validUploadDraft(), {
        kind: "conflict_workpaper_read_only",
        anchorCode: "A"
      })
    ).toEqual(["piece non modifiable pour cette justification"]);
    expect(
      getDocumentUploadStatusLines("A", validUploadDraft(), {
        kind: "unexpected",
        anchorCode: "A"
      })
    ).toEqual(["ajout de piece indisponible"]);
  });

  it("maps workpaper decision states and draft validation to exact visible lines", () => {
    expect(
      getWorkpaperDecisionStatusLines(
        "BS.ASSET.CURRENT_SECTION",
        createWorkpaperItem({
          documents: [createDocument()],
          documentVerificationSummary: {
            documentsCount: 1,
            unverifiedCount: 1,
            verifiedCount: 0,
            rejectedCount: 0
          }
        }),
        { decision: "REVIEWED", comment: "" },
        { kind: "idle" }
      )
    ).toEqual(["Revue possible quand les preuves sont verifiees ou quand aucune piece n'est attachee"]);
    expect(
      getWorkpaperDecisionStatusLines(
        "BS.ASSET.CURRENT_SECTION",
        createWorkpaperItem(),
        { decision: "CHANGES_REQUESTED", comment: " " },
        { kind: "idle" }
      )
    ).toEqual(["commentaire de revue requis"]);
    expect(
      getWorkpaperDecisionStatusLines(
        "BS.ASSET.CURRENT_SECTION",
        createWorkpaperItem(),
        { decision: "REVIEWED", comment: "" },
        {
          kind: "success",
          anchorCode: "BS.ASSET.CURRENT_SECTION",
          refreshFailed: true
        }
      )
    ).toEqual(["Revue de la justification enregistree", "rafraichissement justifications impossible"]);
    expect(
      getWorkpaperDecisionStatusLines(
        "BS.ASSET.CURRENT_SECTION",
        createWorkpaperItem(),
        { decision: "REVIEWED", comment: "" },
        { kind: "forbidden", anchorCode: "BS.ASSET.CURRENT_SECTION" }
      )
    ).toEqual(["Revue indisponible pour cette rubrique."]);
    expect(
      getWorkpaperDecisionStatusLines(
        "BS.ASSET.CURRENT_SECTION",
        createWorkpaperItem(),
        { decision: "REVIEWED", comment: "" },
        { kind: "conflict_other", anchorCode: "BS.ASSET.CURRENT_SECTION" }
      )
    ).toEqual(["Revue de la justification bloquee par les controles de preuve"]);
  });

  it("keeps API result mappers pure and scoped to local UI states", () => {
    expect(mapWorkpaperMutationResult({ kind: "bad_request" })).toEqual({
      kind: "invalid_workpaper"
    });
    expect(mapWorkpaperMutationResult({ kind: "conflict_not_ready" })).toEqual({
      kind: "conflict_not_ready"
    });
    expect(mapDocumentUploadResult({ kind: "payload_too_large" }, "A")).toEqual({
      kind: "payload_too_large",
      anchorCode: "A"
    });
    expect(mapDocumentDownloadResult({ kind: "timeout" }, DOCUMENT_ID)).toEqual({
      kind: "timeout",
      documentId: DOCUMENT_ID
    });
    expect(mapDocumentDecisionResult({ kind: "conflict_stale" }, DOCUMENT_ID)).toEqual({
      kind: "conflict_stale",
      documentId: DOCUMENT_ID
    });
    expect(mapWorkpaperDecisionResult({ kind: "not_found" }, "A")).toEqual({
      kind: "not_found",
      anchorCode: "A"
    });
  });

  it("formats workpaper mutation states with the existing wording", () => {
    expect(formatWorkpaperMutationState({ kind: "submitting" })).toBe(
      "enregistrement justification en cours"
    );
    expect(formatWorkpaperMutationState({ kind: "invalid_workpapers_payload" })).toBe(
      "Données de preuves incohérentes. L’écran reste bloqué par sécurité."
    );
    expect(formatWorkpaperMutationState({ kind: "conflict_other" })).toBe(
      "mise a jour justification impossible"
    );
    expect(formatWorkpaperMutationState({ kind: "unexpected" })).toBe("justification indisponible");
  });
});
