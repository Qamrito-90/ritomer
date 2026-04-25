import { describe, expect, it } from "vitest";
import type { WorkpaperDocument } from "../../lib/api/workpapers";
import {
  formatWorkpaperMutationState,
  getDocumentDecisionStatusLines,
  getDocumentDownloadStatusLine,
  getDocumentUploadStatusLines,
  mapDocumentDecisionResult,
  mapDocumentDownloadResult,
  mapDocumentUploadResult,
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
    ).toBe("telechargement document en cours");
    expect(
      getDocumentDownloadStatusLine(createDocument(), {
        kind: "forbidden",
        documentId: DOCUMENT_ID
      })
    ).toBe("acces documents refuse");
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
    ).toEqual(["commentaire reviewer requis"]);
    expect(
      getDocumentDecisionStatusLines(
        DOCUMENT_ID,
        { decision: "VERIFIED", comment: "" },
        { kind: "success", documentId: DOCUMENT_ID, refreshFailed: true }
      )
    ).toEqual(["decision document enregistree avec succes", "rafraichissement workpapers impossible"]);
    expect(
      getDocumentDecisionStatusLines(
        DOCUMENT_ID,
        { decision: "VERIFIED", comment: "" },
        { kind: "conflict_workpaper_status", documentId: DOCUMENT_ID }
      )
    ).toEqual(["decision document disponible quand le workpaper est READY_FOR_REVIEW"]);
    expect(
      getDocumentDecisionStatusLines(
        DOCUMENT_ID,
        { decision: "VERIFIED", comment: "" },
        { kind: "invalid_payload", documentId: DOCUMENT_ID }
      )
    ).toEqual(["payload decision document invalide"]);
  });

  it("maps upload states and upload draft validation to exact visible lines", () => {
    expect(getDocumentUploadStatusLines("A", validUploadDraft(), { kind: "idle" })).toEqual([
      "fichier pret pour upload"
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
    ).toEqual(["document uploade avec succes", "rafraichissement workpapers impossible"]);
    expect(
      getDocumentUploadStatusLines("A", validUploadDraft(), {
        kind: "conflict_workpaper_read_only",
        anchorCode: "A"
      })
    ).toEqual(["document non modifiable pour ce workpaper"]);
    expect(
      getDocumentUploadStatusLines("A", validUploadDraft(), {
        kind: "unexpected",
        anchorCode: "A"
      })
    ).toEqual(["upload document indisponible"]);
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
  });

  it("formats workpaper mutation states with the existing wording", () => {
    expect(formatWorkpaperMutationState({ kind: "submitting" })).toBe(
      "enregistrement workpaper en cours"
    );
    expect(formatWorkpaperMutationState({ kind: "invalid_workpapers_payload" })).toBe(
      "payload workpapers invalide"
    );
    expect(formatWorkpaperMutationState({ kind: "conflict_other" })).toBe(
      "mise a jour workpaper impossible"
    );
    expect(formatWorkpaperMutationState({ kind: "unexpected" })).toBe("workpaper indisponible");
  });
});
