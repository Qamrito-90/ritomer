import { describe, expect, it } from "vitest";
import type {
  ClosingWorkpapersReadModel,
  WorkpaperDocument,
  WorkpaperEvidence,
  WorkpaperReadModelItem
} from "../../lib/api/workpapers";
import {
  canSaveWorkpaperItem,
  canMarkWorkpaperReviewed,
  canSubmitDocumentDecision,
  canSubmitWorkpaperDecision,
  canUploadDocumentItem,
  createDocumentDecisionDraft,
  createDocumentDecisionDrafts,
  createDocumentUploadDraft,
  createWorkpaperDecisionDraft,
  createWorkpaperDecisionDrafts,
  createWorkpaperDraft,
  createWorkpaperEvidencePayload,
  clearWorkpaperDecisionStateForAnchor,
  findCurrentDocumentInWorkpapers,
  findDocumentInWorkpapers,
  getCurrentWorkpaperReadOnlyMessage,
  getCurrentWorkpaperUploadAvailabilityMessage,
  getDocumentDecisionAvailabilityMessage,
  getReadableDocumentId,
  getWorkpaperDecisionAvailabilityMessage,
  getWorkpaperDecisionDraft,
  getWorkpapersGlobalReadOnlyMessage,
  hasDocumentReadableRole,
  hasDocumentReviewerRole,
  hasWorkpaperReviewerRole,
  hasWorkpaperWritableRole,
  isDocumentUploadFileAllowed,
  isDocumentVerificationDecision,
  isIsoDateOnly,
  isMakerWorkpaperStatus,
  isWorkpaperReviewDecision,
  validateDocumentUploadDraft
} from "./model";

const DOCUMENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const STALE_DOCUMENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";

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
    id: DOCUMENT_ID,
    fileName: "support.pdf",
    mediaType: "application/pdf",
    sourceLabel: "ERP",
    verificationStatus: "UNVERIFIED",
    reviewComment: null,
    ...overrides
  };
}

function createItem(overrides: Partial<WorkpaperReadModelItem> = {}): WorkpaperReadModelItem {
  const documents = overrides.documents ?? [createDocument()];

  return {
    anchorCode: "BS.ASSET.CURRENT_SECTION",
    anchorLabel: "Current assets",
    statementKind: "BALANCE_SHEET",
    breakdownType: "SECTION",
    isCurrentStructure: true,
    workpaper: {
      status: "DRAFT",
      noteText: "Cash tie-out",
      evidences: [createEvidence()]
    },
    documents,
    documentVerificationSummary: {
      documentsCount: documents.length,
      unverifiedCount: documents.filter((document) => document.verificationStatus === "UNVERIFIED")
        .length,
      verifiedCount: documents.filter((document) => document.verificationStatus === "VERIFIED")
        .length,
      rejectedCount: documents.filter((document) => document.verificationStatus === "REJECTED")
        .length
    },
    ...overrides
  };
}

function createWorkpapers(
  overrides: Partial<ClosingWorkpapersReadModel> = {}
): ClosingWorkpapersReadModel {
  const items = overrides.items ?? [createItem()];
  const staleWorkpapers =
    overrides.staleWorkpapers ??
    [
      createItem({
        anchorCode: "BS.ASSET.LEGACY_BUCKET_FALLBACK",
        isCurrentStructure: false,
        documents: [createDocument({ id: STALE_DOCUMENT_ID, fileName: "legacy.pdf" })]
      })
    ];

  return {
    closingFolderId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    closingFolderStatus: "DRAFT",
    readiness: "READY",
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
    ...overrides
  };
}

function createUploadFile(
  fileName = "support.pdf",
  type = "application/pdf",
  contents = "content"
) {
  return new File([contents], fileName, { type });
}

describe("workpapers-panel model helpers", () => {
  it("keeps role helpers and enum guards scoped to proven roles", () => {
    expect(hasWorkpaperWritableRole(["ACCOUNTANT"])).toBe(true);
    expect(hasWorkpaperWritableRole(["REVIEWER"])).toBe(false);
    expect(hasWorkpaperReviewerRole(["REVIEWER"])).toBe(true);
    expect(hasWorkpaperReviewerRole(["ACCOUNTANT"])).toBe(false);
    expect(hasDocumentReadableRole(["REVIEWER"])).toBe(true);
    expect(hasDocumentReadableRole(["UNKNOWN"])).toBe(false);
    expect(hasDocumentReviewerRole(["MANAGER"])).toBe(true);
    expect(hasDocumentReviewerRole(["ACCOUNTANT"])).toBe(false);
    expect(isMakerWorkpaperStatus("READY_FOR_REVIEW")).toBe(true);
    expect(isMakerWorkpaperStatus("REVIEWED")).toBe(false);
    expect(isDocumentVerificationDecision("REJECTED")).toBe(true);
    expect(isDocumentVerificationDecision("UNVERIFIED")).toBe(false);
    expect(isWorkpaperReviewDecision("REVIEWED")).toBe(true);
    expect(isWorkpaperReviewDecision("VERIFIED")).toBe(false);
  });

  it("creates drafts and read-only messages without changing visible wording", () => {
    expect(createWorkpaperDraft(createItem({ workpaper: null }))).toEqual({
      noteText: "",
      status: "DRAFT"
    });
    expect(
      createWorkpaperDraft(
        createItem({ workpaper: { status: "CHANGES_REQUESTED", noteText: "Fix", evidences: [] } })
      )
    ).toEqual({ noteText: "Fix", status: "DRAFT" });
    expect(createDocumentUploadDraft()).toEqual({
      file: null,
      selectedFileCount: 0,
      sourceLabel: "",
      documentDate: ""
    });
    expect(
      createDocumentDecisionDraft(
        createDocument({ verificationStatus: "REJECTED", reviewComment: "Missing stamp" })
      )
    ).toEqual({ decision: "REJECTED", comment: "Missing stamp" });
    expect(
      createDocumentDecisionDrafts(
        createWorkpapers({
          items: [createItem({ documents: [createDocument({ id: "not-a-uuid" })] })],
          staleWorkpapers: []
        })
      )
    ).toEqual({});
    expect(
      createWorkpaperDecisionDraft(
        createItem({
          workpaper: {
            status: "CHANGES_REQUESTED",
            noteText: "Fix",
            reviewComment: "Needs evidence",
            evidences: []
          }
        })
      )
    ).toEqual({ decision: "CHANGES_REQUESTED", comment: "Needs evidence" });
    expect(
      createWorkpaperDecisionDrafts(createWorkpapers({ items: [createItem()], staleWorkpapers: [] }))
    ).toEqual({
      "BS.ASSET.CURRENT_SECTION": { decision: "REVIEWED", comment: "" }
    });
    expect(
      getCurrentWorkpaperReadOnlyMessage(
        createItem({ workpaper: { status: "REVIEWED", noteText: "Done", evidences: [] } }),
        null
      )
    ).toBe("workpaper en lecture seule");
    expect(getCurrentWorkpaperUploadAvailabilityMessage(createItem({ workpaper: null }), null)).toBe(
      "upload disponible apres creation du workpaper"
    );
  });

  it("respects global and document decision availability priorities", () => {
    const item = createItem({
      workpaper: { status: "READY_FOR_REVIEW", noteText: "Ready", evidences: [] }
    });
    const workpapers = createWorkpapers({ items: [item], staleWorkpapers: [] });

    expect(getWorkpapersGlobalReadOnlyMessage(workpapers, ["ACCOUNTANT"])).toBe(null);
    expect(
      getWorkpapersGlobalReadOnlyMessage(
        createWorkpapers({ closingFolderStatus: "ARCHIVED", items: [item] }),
        ["ACCOUNTANT"]
      )
    ).toBe("dossier archive, workpaper en lecture seule");
    expect(
      getWorkpapersGlobalReadOnlyMessage(
        createWorkpapers({ readiness: "BLOCKED", items: [item] }),
        ["ACCOUNTANT"]
      )
    ).toBe("workpaper non modifiable tant que les controles ne sont pas READY");
    expect(getWorkpapersGlobalReadOnlyMessage(workpapers, ["REVIEWER"])).toBe("lecture seule");
    expect(getDocumentDecisionAvailabilityMessage(workpapers, ["REVIEWER"], item, item.documents[0]))
      .toBe(null);
    expect(getDocumentDecisionAvailabilityMessage(workpapers, ["ACCOUNTANT"], item, item.documents[0]))
      .toBe("verification reviewer en lecture seule");
    expect(
      getDocumentDecisionAvailabilityMessage(
        workpapers,
        ["REVIEWER"],
        createItem({ workpaper: null }),
        item.documents[0]
      )
    ).toBe("decision document disponible quand le workpaper est READY_FOR_REVIEW");
    expect(getWorkpaperDecisionAvailabilityMessage(workpapers, ["REVIEWER"], item)).toBe(null);
    expect(getWorkpaperDecisionAvailabilityMessage(workpapers, ["ACCOUNTANT"], item)).toBe(
      "workpaper decision refused"
    );
    expect(
      getWorkpaperDecisionAvailabilityMessage(
        createWorkpapers({ readiness: "BLOCKED", items: [item] }),
        ["REVIEWER"],
        item
      )
    ).toBe("workpaper decision unavailable for this status");
    expect(
      getWorkpaperDecisionAvailabilityMessage(workpapers, ["REVIEWER"], createItem({ workpaper: null }))
    ).toBe("workpaper decision unavailable for this status");
  });

  it("validates upload drafts and file allow-list inputs", () => {
    expect(validateDocumentUploadDraft(createDocumentUploadDraft())).toEqual({
      kind: "invalid",
      message: "selectionner un fichier"
    });
    expect(
      validateDocumentUploadDraft({
        file: createUploadFile(),
        selectedFileCount: 2,
        sourceLabel: "ERP",
        documentDate: ""
      })
    ).toEqual({ kind: "invalid", message: "un seul fichier est autorise" });
    expect(isDocumentUploadFileAllowed(createUploadFile("support.exe", ""))).toBe(false);
    expect(isDocumentUploadFileAllowed(createUploadFile("support.csv", ""))).toBe(true);
    expect(isDocumentUploadFileAllowed(createUploadFile("support.csv", "text/plain"))).toBe(false);
    expect(
      validateDocumentUploadDraft({
        file: createUploadFile("empty.pdf", "application/pdf", ""),
        selectedFileCount: 1,
        sourceLabel: "ERP",
        documentDate: ""
      })
    ).toEqual({ kind: "invalid", message: "fichier vide" });
    expect(
      validateDocumentUploadDraft({
        file: createUploadFile(),
        selectedFileCount: 1,
        sourceLabel: "  ERP  ",
        documentDate: "2026-01-31"
      })
    ).toMatchObject({
      kind: "valid",
      sourceLabel: "ERP",
      documentDate: "2026-01-31"
    });
    expect(isIsoDateOnly("2026-02-29")).toBe(false);
  });

  it("preserves evidence payloads and blocks invalid read-model evidence", () => {
    const item = createItem();
    expect(createWorkpaperEvidencePayload(createItem({ workpaper: null }))).toEqual([]);
    expect(createWorkpaperEvidencePayload(item)).toEqual([
      {
        position: 1,
        fileName: "support.pdf",
        mediaType: "application/pdf",
        documentDate: "2026-01-31",
        sourceLabel: "ERP",
        verificationStatus: "UNVERIFIED",
        externalReference: null,
        checksumSha256: null
      }
    ]);
    expect(
      createWorkpaperEvidencePayload(
        createItem({ workpaper: { status: "DRAFT", noteText: "Bad", evidences: [createEvidence({ position: 0 })] } })
      )
    ).toBe(null);
  });

  it("keeps document lookup current-aware and enablement helpers local", () => {
    const workpapers = createWorkpapers();
    const item = workpapers.items[0];
    const validUploadDraft = {
      file: createUploadFile(),
      selectedFileCount: 1,
      sourceLabel: "ERP",
      documentDate: ""
    };

    expect(getReadableDocumentId(createDocument())).toBe(DOCUMENT_ID);
    expect(getReadableDocumentId(createDocument({ id: "invalid" }))).toBe(null);
    expect(findDocumentInWorkpapers(workpapers, STALE_DOCUMENT_ID)?.item.isCurrentStructure).toBe(
      false
    );
    expect(findCurrentDocumentInWorkpapers(workpapers, STALE_DOCUMENT_ID)).toBe(null);
    expect(
      canSaveWorkpaperItem(
        workpapers,
        ["ACCOUNTANT"],
        createItem({ workpaper: null }),
        { noteText: "New note", status: "DRAFT" },
        { kind: "idle" }
      )
    ).toBe(true);
    expect(
      canSaveWorkpaperItem(
        workpapers,
        ["ACCOUNTANT"],
        item,
        { noteText: item.workpaper?.noteText ?? "", status: "DRAFT" },
        { kind: "idle" }
      )
    ).toBe(false);
    expect(
      canUploadDocumentItem(workpapers, ["ACCOUNTANT"], item, validUploadDraft, { kind: "idle" }, { kind: "idle" })
    ).toBe(true);
    expect(
      canUploadDocumentItem(
        workpapers,
        ["ACCOUNTANT"],
        item,
        validUploadDraft,
        { kind: "submitting" },
        { kind: "idle" }
      )
    ).toBe(false);
    expect(canSubmitDocumentDecision({ decision: "VERIFIED", comment: "" })).toBe(true);
    expect(canSubmitDocumentDecision({ decision: "REJECTED", comment: " " })).toBe(false);
    expect(
      canMarkWorkpaperReviewed(
        createItem({
          workpaper: { status: "READY_FOR_REVIEW", noteText: "Ready", evidences: [] },
          documents: []
        })
      )
    ).toBe(true);
    expect(
      canMarkWorkpaperReviewed(
        createItem({
          workpaper: { status: "READY_FOR_REVIEW", noteText: "Ready", evidences: [] },
          documents: [createDocument({ verificationStatus: "VERIFIED" })],
          documentVerificationSummary: {
            documentsCount: 1,
            unverifiedCount: 0,
            verifiedCount: 1,
            rejectedCount: 0
          }
        })
      )
    ).toBe(true);
    expect(
      canMarkWorkpaperReviewed(
        createItem({
          workpaper: { status: "READY_FOR_REVIEW", noteText: "Ready", evidences: [] },
          documents: [createDocument({ verificationStatus: "UNVERIFIED" })],
          documentVerificationSummary: {
            documentsCount: 1,
            unverifiedCount: 1,
            verifiedCount: 0,
            rejectedCount: 0
          }
        })
      )
    ).toBe(false);
    expect(
      canSubmitWorkpaperDecision(item, { decision: "CHANGES_REQUESTED", comment: " " })
    ).toBe(false);
    expect(
      canSubmitWorkpaperDecision(item, { decision: "CHANGES_REQUESTED", comment: "Fix evidence" })
    ).toBe(true);
    expect(getWorkpaperDecisionDraft({}, item)).toEqual({ decision: "REVIEWED", comment: "" });
    expect(
      clearWorkpaperDecisionStateForAnchor(
        { kind: "forbidden", anchorCode: item.anchorCode },
        item.anchorCode
      )
    ).toEqual({ kind: "idle" });
  });
});
