import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkpapersPanel } from "./workpapers-panel";
import {
  downloadWorkpaperDocument,
  loadWorkpapersShellState,
  reviewDocumentVerificationDecision,
  uploadWorkpaperDocument,
  upsertWorkpaper,
  type ClosingWorkpapersReadModel,
  type DownloadWorkpaperDocumentState,
  type ReviewDocumentVerificationDecisionState,
  type UploadWorkpaperDocumentState,
  type WorkpaperEvidence,
  type WorkpapersShellState
} from "../lib/api/workpapers";
import type { EffectiveRolesHint } from "../lib/api/me";

vi.mock("../lib/api/workpapers", async () => {
  const actual = await vi.importActual<typeof import("../lib/api/workpapers")>(
    "../lib/api/workpapers"
  );

  return {
    ...actual,
    downloadWorkpaperDocument: vi.fn(),
    loadWorkpapersShellState: vi.fn(),
    reviewDocumentVerificationDecision: vi.fn(),
    uploadWorkpaperDocument: vi.fn(),
    upsertWorkpaper: vi.fn()
  };
});

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

type WorkpaperDocument = {
  id?: unknown;
  fileName: string;
  mediaType: string;
  sourceLabel: string;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED";
  reviewComment: string | null;
};

type WorkpaperDetails = {
  status: "DRAFT" | "READY_FOR_REVIEW" | "CHANGES_REQUESTED" | "REVIEWED";
  noteText: string;
  evidences: WorkpaperEvidence[];
};

type WorkpaperItem = ClosingWorkpapersReadModel["items"][number];
type LoadedWorkpapersShellState = Exclude<WorkpapersShellState, { kind: "loading" }>;

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
    reviewComment: null,
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
  const resolvedDocuments = workpaper === null ? [] : (documents ?? []);

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
  staleWorkpapers = []
}: Partial<ClosingWorkpapersReadModel> = {}): ClosingWorkpapersReadModel {
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
    staleWorkpapers
  };
}

function createReadyState(
  workpapers: ClosingWorkpapersReadModel = createWorkpapersModel()
): LoadedWorkpapersShellState {
  return { kind: "ready", workpapers };
}

function createUploadFile(
  fileName = "support.pdf",
  type = "application/pdf",
  contents = "pdf-content"
) {
  return new File([contents], fileName, { type });
}

function renderPanel({
  effectiveRoles = ["ACCOUNTANT"],
  initialState = createReadyState()
}: {
  effectiveRoles?: EffectiveRolesHint;
  initialState?: WorkpapersShellState;
} = {}) {
  return render(
    <WorkpapersPanel
      activeTenant={ACTIVE_TENANT}
      closingFolder={CLOSING_FOLDER}
      closingFolderId={CLOSING_FOLDER.id}
      effectiveRoles={effectiveRoles}
      initialState={initialState}
    />
  );
}

function getWorkpaperCard(anchorCode: string) {
  return screen.getByLabelText(`workpaper ${anchorCode}`);
}

describe("workpapers panel", () => {
  const mockedDownload = vi.mocked(downloadWorkpaperDocument);
  const mockedLoadWorkpapers = vi.mocked(loadWorkpapersShellState);
  const mockedReviewDecision = vi.mocked(reviewDocumentVerificationDecision);
  const mockedUpload = vi.mocked(uploadWorkpaperDocument);
  const mockedUpsert = vi.mocked(upsertWorkpaper);

  beforeEach(() => {
    mockedDownload.mockReset();
    mockedLoadWorkpapers.mockReset();
    mockedReviewDecision.mockReset();
    mockedUpload.mockReset();
    mockedUpsert.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the nominal maker and upload blocks, keeps stale items read-only, and preserves download visibility on stale documents", () => {
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
      ]
    });

    renderPanel({ initialState: createReadyState(workpapers) });

    const newCard = getWorkpaperCard("PL.REVENUE.NEW");
    const draftCard = getWorkpaperCard("BS.ASSET.DRAFT");
    const changesCard = getWorkpaperCard("BS.ASSET.CHANGES");
    const readyCard = getWorkpaperCard("BS.ASSET.READY");
    const reviewedCard = getWorkpaperCard("BS.ASSET.REVIEWED");
    const staleCard = getWorkpaperCard("BS.ASSET.STALE");

    expect(
      screen.getByText("Mise a jour maker unitaire sur les workpapers courants uniquement.")
    ).toBeInTheDocument();
    expect(screen.getByText("workpapers stale en lecture seule")).toBeInTheDocument();

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
      within(changesCard).getByRole("button", { name: "Enregistrer le workpaper" })
    ).toBeEnabled();

    expect(within(readyCard).getByText("workpaper en lecture seule")).toBeInTheDocument();
    expect(within(readyCard).queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(
      within(readyCard).queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();

    expect(within(reviewedCard).getByText("workpaper en lecture seule")).toBeInTheDocument();
    expect(within(reviewedCard).queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(
      within(reviewedCard).queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();

    expect(within(staleCard).queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(
      within(staleCard).queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();
    expect(
      within(staleCard).getByRole("button", { name: "Telecharger le document" })
    ).toBeInTheDocument();
  });

  it.each([
    {
      label: "effectiveRoles absent",
      effectiveRoles: null,
      message: "lecture seule",
      downloadVisible: false
    },
    {
      label: "effectiveRoles invalid",
      effectiveRoles: ["oops"] as unknown as EffectiveRolesHint,
      message: "lecture seule",
      downloadVisible: false
    },
    {
      label: "REVIEWER only",
      effectiveRoles: ["REVIEWER"],
      message: "lecture seule",
      downloadVisible: true
    },
    {
      label: "ARCHIVED",
      effectiveRoles: ["ACCOUNTANT"],
      initialState: createReadyState(
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
      ),
      message: "dossier archive, workpaper en lecture seule",
      downloadVisible: true
    },
    {
      label: "readiness blocked",
      effectiveRoles: ["ACCOUNTANT"],
      initialState: createReadyState(
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
      ),
      message: "workpaper non modifiable tant que les controles ne sont pas READY",
      downloadVisible: true
    }
  ])("keeps the block read-only for $label", ({ downloadVisible, effectiveRoles, initialState, message }) => {
    renderPanel({
      effectiveRoles,
      initialState:
        initialState ??
        createReadyState(
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

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByLabelText("Note workpaper")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Statut maker")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fichier document")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enregistrer le workpaper" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Uploader le document" })
    ).not.toBeInTheDocument();

    if (downloadVisible) {
      expect(
        screen.getByRole("button", { name: "Telecharger le document" })
      ).toBeInTheDocument();
    } else {
      expect(
        screen.queryByRole("button", { name: "Telecharger le document" })
      ).not.toBeInTheDocument();
    }
  });

  it("renders document reviewer decision only for eligible current documents and never for stale documents", () => {
    const workpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          anchorCode: "BS.ASSET.READY",
          anchorLabel: "Current assets ready",
          workpaper: createWorkpaperDetails({
            status: "READY_FOR_REVIEW",
            noteText: "Ready"
          }),
          documents: [
            createDocument({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee21",
              fileName: "eligible.pdf"
            })
          ]
        }),
        createCurrentItem({
          anchorCode: "BS.ASSET.DRAFT",
          anchorLabel: "Current assets draft",
          workpaper: createWorkpaperDetails({
            status: "DRAFT",
            noteText: "Draft"
          }),
          documents: [
            createDocument({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee22",
              fileName: "draft.pdf"
            })
          ]
        })
      ],
      staleWorkpapers: [
        createStaleItem({
          anchorCode: "BS.ASSET.STALE",
          documents: [
            createDocument({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee23",
              fileName: "stale.pdf"
            })
          ]
        })
      ]
    });

    renderPanel({ effectiveRoles: ["REVIEWER"], initialState: createReadyState(workpapers) });

    const eligibleCard = getWorkpaperCard("BS.ASSET.READY");
    const draftCard = getWorkpaperCard("BS.ASSET.DRAFT");
    const staleCard = getWorkpaperCard("BS.ASSET.STALE");

    expect(within(eligibleCard).getAllByText("Decision reviewer document")).toHaveLength(2);
    expect(within(eligibleCard).getByLabelText("Decision reviewer document")).toHaveValue(
      "VERIFIED"
    );
    expect(
      within(eligibleCard).getByRole("button", { name: "Enregistrer la decision document" })
    ).toBeEnabled();
    expect(
      within(draftCard).getByText(
        "decision document disponible quand le workpaper est READY_FOR_REVIEW"
      )
    ).toBeInTheDocument();
    expect(
      within(draftCard).queryByRole("button", { name: "Enregistrer la decision document" })
    ).not.toBeInTheDocument();
    expect(within(staleCard).queryByText("Decision reviewer document")).not.toBeInTheDocument();
    expect(
      within(staleCard).queryByRole("button", { name: "Enregistrer la decision document" })
    ).not.toBeInTheDocument();
    expect(mockedReviewDecision).not.toHaveBeenCalled();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("uses the document verification status and review comment as the initial local decision draft", () => {
    renderPanel({
      effectiveRoles: ["MANAGER"],
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "Ready"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee24",
                  fileName: "verified.pdf",
                  verificationStatus: "VERIFIED"
                }),
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee25",
                  fileName: "rejected.pdf",
                  verificationStatus: "REJECTED",
                  reviewComment: "Piece illisible"
                })
              ]
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    const decisions = within(card).getAllByLabelText("Decision reviewer document");

    expect(decisions[0]).toHaveValue("VERIFIED");
    expect(decisions[1]).toHaveValue("REJECTED");
    expect(within(card).getByLabelText("Commentaire reviewer")).toHaveValue("Piece illisible");
  });

  it.each([
    {
      label: "ACCOUNTANT only",
      effectiveRoles: ["ACCOUNTANT"] as EffectiveRolesHint,
      workpapers: createWorkpapersModel({
        items: [
          createCurrentItem({
            workpaper: createWorkpaperDetails({
              status: "READY_FOR_REVIEW",
              noteText: "Ready"
            }),
            documents: [
              createDocument({
                id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee26"
              })
            ]
          })
        ]
      }),
      text: "verification reviewer en lecture seule"
    },
    {
      label: "archived",
      effectiveRoles: ["ADMIN"] as EffectiveRolesHint,
      workpapers: createWorkpapersModel({
        closingFolderStatus: "ARCHIVED",
        items: [
          createCurrentItem({
            workpaper: createWorkpaperDetails({
              status: "READY_FOR_REVIEW",
              noteText: "Archived"
            }),
            documents: [
              createDocument({
                id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee27"
              })
            ]
          })
        ]
      }),
      text: "dossier archive, verification document en lecture seule"
    },
    {
      label: "readiness blocked",
      effectiveRoles: ["ADMIN"] as EffectiveRolesHint,
      workpapers: createWorkpapersModel({
        readiness: "BLOCKED",
        items: [
          createCurrentItem({
            workpaper: createWorkpaperDetails({
              status: "READY_FOR_REVIEW",
              noteText: "Blocked"
            }),
            documents: [
              createDocument({
                id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee28"
              })
            ]
          })
        ]
      }),
      text: "verification document non modifiable tant que les controles ne sont pas READY"
    },
    {
      label: "invalid document id",
      effectiveRoles: ["ADMIN"] as EffectiveRolesHint,
      workpapers: createWorkpapersModel({
        items: [
          createCurrentItem({
            workpaper: createWorkpaperDetails({
              status: "READY_FOR_REVIEW",
              noteText: "Ready"
            }),
            documents: [
              createDocument({
                id: "not-a-uuid"
              })
            ]
          })
        ]
      }),
      text: "decision document indisponible"
    }
  ])("does not render reviewer affordance or emit POST for $label", ({ effectiveRoles, text, workpapers }) => {
    renderPanel({ effectiveRoles, initialState: createReadyState(workpapers) });

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Enregistrer la decision document" })
    ).not.toBeInTheDocument();
    expect(mockedReviewDecision).not.toHaveBeenCalled();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("does not emit requests while editing a document decision, then submits VERIFIED and refreshes only Workpapers", async () => {
    const user = userEvent.setup();
    const refreshedWorkpapers = createWorkpapersModel({
      items: [
        createCurrentItem({
          workpaper: createWorkpaperDetails({
            status: "READY_FOR_REVIEW",
            noteText: "Ready"
          }),
          documents: [
            createDocument({
              id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee29",
              fileName: "refreshed-verified.pdf",
              verificationStatus: "VERIFIED"
            })
          ]
        })
      ]
    });

    mockedReviewDecision.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue(createReadyState(refreshedWorkpapers));

    renderPanel({
      effectiveRoles: ["REVIEWER"],
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "Ready"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee29",
                  verificationStatus: "UNVERIFIED"
                })
              ]
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.selectOptions(within(card).getByLabelText("Decision reviewer document"), "VERIFIED");

    expect(mockedReviewDecision).not.toHaveBeenCalled();

    await user.click(
      within(card).getByRole("button", { name: "Enregistrer la decision document" })
    );

    expect(await screen.findByText("decision document enregistree avec succes")).toBeInTheDocument();
    expect(await screen.findByText(/refreshed-verified\.pdf/)).toBeInTheDocument();
    expect(mockedReviewDecision).toHaveBeenCalledWith(CLOSING_FOLDER.id, ACTIVE_TENANT, {
      documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee29",
      decision: "VERIFIED"
    });
    expect(mockedLoadWorkpapers).toHaveBeenCalledTimes(1);
    expect(mockedLoadWorkpapers).toHaveBeenCalledWith(
      CLOSING_FOLDER.id,
      CLOSING_FOLDER,
      ACTIVE_TENANT
    );
  });

  it("requires a reviewer comment for REJECTED and sends the trimmed comment after explicit save", async () => {
    const user = userEvent.setup();
    mockedReviewDecision.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue(
      createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "Ready"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee30",
                  verificationStatus: "REJECTED",
                  reviewComment: "Piece illisible"
                })
              ]
            })
          ]
        })
      )
    );

    renderPanel({
      effectiveRoles: ["ADMIN"],
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "Ready"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee30",
                  verificationStatus: "UNVERIFIED"
                })
              ]
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.selectOptions(within(card).getByLabelText("Decision reviewer document"), "REJECTED");

    expect(within(card).getByText("commentaire reviewer requis")).toBeInTheDocument();
    expect(
      within(card).getByRole("button", { name: "Enregistrer la decision document" })
    ).toBeDisabled();
    expect(mockedReviewDecision).not.toHaveBeenCalled();

    await user.type(within(card).getByLabelText("Commentaire reviewer"), "  Piece illisible  ");
    await user.click(
      within(card).getByRole("button", { name: "Enregistrer la decision document" })
    );

    expect(await screen.findByText("decision document enregistree avec succes")).toBeInTheDocument();
    expect(mockedReviewDecision).toHaveBeenCalledWith(CLOSING_FOLDER.id, ACTIVE_TENANT, {
      documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee30",
      decision: "REJECTED",
      comment: "Piece illisible"
    });
    expect(mockedLoadWorkpapers).toHaveBeenCalledTimes(1);
  });

  it("allows only one document decision in flight and disables other Workpapers actions during the POST", async () => {
    const user = userEvent.setup();
    mockedReviewDecision.mockReturnValue(new Promise(() => {}));

    renderPanel({
      effectiveRoles: ["MANAGER"],
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              anchorCode: "BS.ASSET.ONE",
              anchorLabel: "Current assets one",
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "One"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee31",
                  fileName: "one.pdf"
                })
              ]
            }),
            createCurrentItem({
              anchorCode: "BS.ASSET.TWO",
              anchorLabel: "Current assets two",
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "Two"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee32",
                  fileName: "two.pdf"
                })
              ]
            })
          ]
        })
      )
    });

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.click(
      within(firstCard).getByRole("button", { name: "Enregistrer la decision document" })
    );

    expect(await screen.findByText("decision document en cours")).toBeInTheDocument();
    expect(mockedReviewDecision).toHaveBeenCalledTimes(1);
    expect(
      within(secondCard).getByRole("button", { name: "Enregistrer la decision document" })
    ).toBeDisabled();
    expect(
      within(secondCard).getByRole("button", { name: "Telecharger le document" })
    ).toBeDisabled();

    await user.click(
      within(secondCard).getByRole("button", { name: "Enregistrer la decision document" })
    );

    expect(mockedReviewDecision).toHaveBeenCalledTimes(1);
  });

  it("keeps the last rendered workpapers block visible and shows the refresh failure after a valid document decision success", async () => {
    const user = userEvent.setup();
    mockedReviewDecision.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue({ kind: "server_error" });

    renderPanel({
      effectiveRoles: ["REVIEWER"],
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "Ready"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee33"
                })
              ]
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.click(
      within(card).getByRole("button", { name: "Enregistrer la decision document" })
    );

    expect(await screen.findByText("decision document enregistree avec succes")).toBeInTheDocument();
    expect(
      await screen.findByText("rafraichissement workpapers impossible")
    ).toBeInTheDocument();
    expect(getWorkpaperCard("BS.ASSET.CURRENT_SECTION")).toBeInTheDocument();
  });

  it.each([
    { label: "400", result: { kind: "bad_request" }, text: "decision document invalide" },
    { label: "401", result: { kind: "auth_required" }, text: "authentification requise" },
    {
      label: "403",
      result: { kind: "forbidden" },
      text: "acces verification document refuse"
    },
    {
      label: "404",
      result: { kind: "not_found" },
      text: "document introuvable pour decision"
    },
    {
      label: "409 archived",
      result: { kind: "conflict_archived" },
      text: "dossier archive, verification document non modifiable"
    },
    {
      label: "409 readiness",
      result: { kind: "conflict_not_ready" },
      text: "verification document non modifiable tant que les controles ne sont pas READY"
    },
    {
      label: "409 stale",
      result: { kind: "conflict_stale" },
      text: "document indisponible sur un workpaper stale"
    },
    {
      label: "409 workpaper status",
      result: { kind: "conflict_workpaper_status" },
      text: "decision document disponible quand le workpaper est READY_FOR_REVIEW"
    },
    {
      label: "409 other",
      result: { kind: "conflict_other" },
      text: "decision document impossible"
    },
    { label: "5xx", result: { kind: "server_error" }, text: "erreur serveur documents" },
    { label: "network", result: { kind: "network_error" }, text: "erreur reseau documents" },
    { label: "timeout", result: { kind: "timeout" }, text: "timeout documents" },
    {
      label: "invalid payload",
      result: { kind: "invalid_payload" },
      text: "payload decision document invalide"
    },
    { label: "unexpected", result: { kind: "unexpected" }, text: "decision document indisponible" }
  ])("renders the exact document decision mutation error '$text' on $label", async ({ result, text }) => {
    const user = userEvent.setup();
    mockedReviewDecision.mockResolvedValue(result as ReviewDocumentVerificationDecisionState);

    renderPanel({
      effectiveRoles: ["REVIEWER"],
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              workpaper: createWorkpaperDetails({
                status: "READY_FOR_REVIEW",
                noteText: "Ready"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeee34"
                })
              ]
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.click(
      within(card).getByRole("button", { name: "Enregistrer la decision document" })
    );

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it.each([
    { label: "missing document id", document: createDocument({ id: undefined }) },
    { label: "invalid document id", document: createDocument({ id: "not-a-uuid" }) }
  ])("keeps a visible document line read-only with 'telechargement indisponible' on $label", ({ document }) => {
    renderPanel({
      initialState: createReadyState(
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

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    expect(within(card).getByText("telechargement indisponible")).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Telecharger le document" })
    ).not.toBeInTheDocument();
    expect(mockedDownload).not.toHaveBeenCalled();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("allows only one document download in flight across the whole block", async () => {
    const user = userEvent.setup();
    mockedDownload.mockReturnValue(new Promise(() => {}));

    renderPanel({
      initialState: createReadyState(
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
      )
    });

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.click(within(firstCard).getByRole("button", { name: "Telecharger le document" }));

    expect(await screen.findByText("telechargement document en cours")).toBeInTheDocument();
    expect(mockedDownload).toHaveBeenCalledTimes(1);
    expect(
      within(secondCard).getByRole("button", { name: "Telecharger le document" })
    ).toBeDisabled();

    await user.click(within(secondCard).getByRole("button", { name: "Telecharger le document" }));

    expect(mockedDownload).toHaveBeenCalledTimes(1);
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("downloads through the local API seam, triggers the browser download, and never refreshes workpapers after success", async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((blob: Blob) => {
      void blob;
      return "blob:download-url";
    });
    const revokeObjectURL = vi.fn();
    const appendSpy = vi.spyOn(document.body, "append");
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const rawBlob = new Blob(["pdf-content"]);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    });

    mockedDownload.mockResolvedValue({
      kind: "success",
      blob: rawBlob,
      contentDisposition:
        "attachment; filename*=UTF-8''support%20final.pdf; filename=\"ignored.pdf\"",
      contentType: "application/pdf"
    });

    renderPanel({
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              workpaper: createWorkpaperDetails({
                status: "DRAFT",
                noteText: "Current support"
              }),
              documents: [
                createDocument({
                  id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed8",
                  fileName: "fallback.pdf",
                  mediaType: "image/png"
                })
              ]
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.click(within(card).getByRole("button", { name: "Telecharger le document" }));

    const appendedLink = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;

    expect(mockedDownload).toHaveBeenCalledWith(CLOSING_FOLDER.id, ACTIVE_TENANT, {
      documentId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeed8"
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(createObjectURL.mock.calls[0]?.[0]?.type).toBe("application/pdf");
    expect(appendedLink.href).toBe("blob:download-url");
    expect(appendedLink.download).toBe("support final.pdf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(document.body.contains(appendedLink)).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:download-url");
    expect(screen.queryByText("telechargement document en cours")).not.toBeInTheDocument();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it.each([
    { label: "401", result: { kind: "auth_required" }, text: "authentification requise" },
    { label: "403", result: { kind: "forbidden" }, text: "acces documents refuse" },
    {
      label: "404",
      result: { kind: "not_found" },
      text: "document introuvable pour telechargement"
    },
    { label: "5xx", result: { kind: "server_error" }, text: "erreur serveur documents" },
    { label: "network", result: { kind: "network_error" }, text: "erreur reseau documents" },
    { label: "timeout", result: { kind: "timeout" }, text: "timeout documents" },
    {
      label: "unexpected",
      result: { kind: "unexpected" },
      text: "telechargement indisponible"
    }
  ])("renders the exact download error '$text' on $label without refreshing workpapers", async ({ result, text }) => {
    const user = userEvent.setup();
    mockedDownload.mockResolvedValue(result as DownloadWorkpaperDocumentState);

    renderPanel({
      initialState: createReadyState(
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
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.click(within(card).getByRole("button", { name: "Telecharger le document" }));

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("does not autosave on textarea or select changes, sends evidences [] for a current item without persisted workpaper, and refreshes only local workpapers after success", async () => {
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

    mockedUpsert.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue(createReadyState(refreshedWorkpapers));

    renderPanel({ initialState: createReadyState(initialWorkpapers) });

    const card = getWorkpaperCard("PL.REVENUE.NEW");
    const noteField = within(card).getByLabelText("Note workpaper");
    const statusSelect = within(card).getByLabelText("Statut maker");

    await user.type(noteField, "  Revenue support  ");
    expect(mockedUpsert).not.toHaveBeenCalled();

    await user.selectOptions(statusSelect, "READY_FOR_REVIEW");
    expect(mockedUpsert).not.toHaveBeenCalled();

    await user.click(within(card).getByRole("button", { name: "Enregistrer le workpaper" }));

    expect(await screen.findByText("workpaper enregistre avec succes")).toBeInTheDocument();
    expect(mockedUpsert).toHaveBeenCalledWith(CLOSING_FOLDER.id, ACTIVE_TENANT, {
      anchorCode: "PL.REVENUE.NEW",
      noteText: "Revenue support",
      status: "READY_FOR_REVIEW",
      evidences: []
    });
    expect(mockedLoadWorkpapers).toHaveBeenCalledTimes(1);
    expect(mockedLoadWorkpapers).toHaveBeenCalledWith(
      CLOSING_FOLDER.id,
      CLOSING_FOLDER,
      ACTIVE_TENANT
    );
    expect(screen.getByText("note workpaper : Revenue support")).toBeInTheDocument();
    expect(screen.getByText("etat workpaper : READY_FOR_REVIEW")).toBeInTheDocument();
  });

  it("preserves the exact evidences order and fields from the latest ready workpapers on a persisted current item", async () => {
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

    mockedUpsert.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue(
      createReadyState(
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
    );

    renderPanel({
      initialState: createReadyState(
        createWorkpapersModel({
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
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.clear(within(card).getByLabelText("Note workpaper"));
    await user.type(within(card).getByLabelText("Note workpaper"), "Updated note");
    await user.selectOptions(within(card).getByLabelText("Statut maker"), "READY_FOR_REVIEW");
    await user.click(within(card).getByRole("button", { name: "Enregistrer le workpaper" }));

    expect(mockedUpsert.mock.calls[0]?.[2]).toEqual({
      anchorCode: "BS.ASSET.DRAFT",
      noteText: "Updated note",
      status: "READY_FOR_REVIEW",
      evidences
    });
  });

  it.each([
    { label: "400", result: { kind: "bad_request" }, text: "workpaper invalide" },
    { label: "401", result: { kind: "auth_required" }, text: "authentification requise" },
    { label: "403", result: { kind: "forbidden" }, text: "acces workpapers refuse" },
    { label: "404", result: { kind: "not_found" }, text: "dossier introuvable" },
    {
      label: "409 archived",
      result: { kind: "conflict_archived" },
      text: "dossier archive, workpaper non modifiable"
    },
    {
      label: "409 readiness",
      result: { kind: "conflict_not_ready" },
      text: "workpaper non modifiable tant que les controles ne sont pas READY"
    },
    {
      label: "409 other",
      result: { kind: "conflict_other" },
      text: "mise a jour workpaper impossible"
    },
    { label: "5xx", result: { kind: "server_error" }, text: "erreur serveur workpapers" },
    { label: "network", result: { kind: "network_error" }, text: "erreur reseau workpapers" },
    { label: "timeout", result: { kind: "timeout" }, text: "timeout workpapers" },
    {
      label: "invalid payload",
      result: { kind: "invalid_payload" },
      text: "payload workpaper invalide"
    },
    { label: "unexpected", result: { kind: "unexpected" }, text: "workpaper indisponible" }
  ])("renders the exact mutation error '$text' on $label", async ({ result, text }) => {
    const user = userEvent.setup();
    mockedUpsert.mockResolvedValue(result as Awaited<ReturnType<typeof upsertWorkpaper>>);

    renderPanel({
      initialState: createReadyState(
        createWorkpapersModel({
          items: [createCurrentItem({ workpaper: null })]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.CURRENT_SECTION");
    await user.type(within(card).getByLabelText("Note workpaper"), "Save me");
    await user.click(within(card).getByRole("button", { name: "Enregistrer le workpaper" }));

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("keeps the last rendered workpapers block visible and shows the refresh failure after a valid workpaper success", async () => {
    const user = userEvent.setup();
    mockedUpsert.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue({ kind: "server_error" });

    renderPanel({
      initialState: createReadyState(
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
      )
    });

    const card = getWorkpaperCard("PL.REVENUE.NEW");
    await user.type(within(card).getByLabelText("Note workpaper"), "  Saved locally  ");
    await user.click(within(card).getByRole("button", { name: "Enregistrer le workpaper" }));

    expect(await screen.findByText("workpaper enregistre avec succes")).toBeInTheDocument();
    expect(
      await screen.findByText("rafraichissement workpapers impossible")
    ).toBeInTheDocument();
    expect(getWorkpaperCard("PL.REVENUE.NEW")).toBeInTheDocument();
    expect(within(getWorkpaperCard("PL.REVENUE.NEW")).getByLabelText("Note workpaper")).toBeInTheDocument();
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
    }
  ])("renders the exact local upload validation '$text' for $label and emits no upload request", async ({ arrange, text }) => {
    renderPanel({
      initialState: createReadyState(
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

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    await arrange(card);

    expect(within(card).getByText(text)).toBeInTheDocument();
    if (text !== "fichier pret pour upload") {
      expect(
        within(card).getByRole("button", { name: "Uploader le document" })
      ).toBeDisabled();
    }
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("does not emit any upload request on file or metadata changes, then refreshes only local workpapers after a valid upload success", async () => {
    const user = userEvent.setup();
    const selectedFile = createUploadFile();
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

    mockedUpload.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue(createReadyState(refreshedWorkpapers));

    renderPanel({
      initialState: createReadyState(
        createWorkpapersModel({
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
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    const fileInput = within(card).getByLabelText("Fichier document");
    const sourceInput = within(card).getByLabelText("Source document");
    const dateInput = within(card).getByLabelText("Date document");

    await user.upload(fileInput, selectedFile);
    expect(mockedUpload).not.toHaveBeenCalled();

    await user.type(sourceInput, "ERP");
    expect(mockedUpload).not.toHaveBeenCalled();

    fireEvent.change(dateInput, { target: { value: "2026-02-15" } });
    expect(mockedUpload).not.toHaveBeenCalled();
    expect(within(card).getByText("fichier pret pour upload")).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Uploader le document" }));

    expect(await screen.findByText("document uploade avec succes")).toBeInTheDocument();
    expect(await screen.findByText(/refreshed-only\.pdf/)).toBeInTheDocument();
    expect(mockedUpload).toHaveBeenCalledWith(CLOSING_FOLDER.id, ACTIVE_TENANT, {
      anchorCode: "BS.ASSET.DRAFT",
      file: selectedFile,
      sourceLabel: "ERP",
      documentDate: "2026-02-15"
    });
    expect(mockedLoadWorkpapers).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: "400", result: { kind: "bad_request" }, text: "document invalide" },
    {
      label: "invalid media type",
      result: { kind: "bad_request_invalid_media_type" },
      text: "format de fichier non autorise"
    },
    {
      label: "empty file",
      result: { kind: "bad_request_empty_file" },
      text: "fichier vide"
    },
    {
      label: "source required",
      result: { kind: "bad_request_source_required" },
      text: "source du document requise"
    },
    { label: "401", result: { kind: "auth_required" }, text: "authentification requise" },
    { label: "403", result: { kind: "forbidden" }, text: "acces documents refuse" },
    {
      label: "404",
      result: { kind: "not_found" },
      text: "workpaper introuvable pour upload document"
    },
    {
      label: "409 archived",
      result: { kind: "conflict_archived" },
      text: "dossier archive, document non modifiable"
    },
    {
      label: "409 readiness",
      result: { kind: "conflict_not_ready" },
      text: "document non modifiable tant que les controles ne sont pas READY"
    },
    {
      label: "409 stale",
      result: { kind: "conflict_stale" },
      text: "document indisponible sur un workpaper stale"
    },
    {
      label: "409 workpaper status",
      result: { kind: "conflict_workpaper_read_only" },
      text: "document non modifiable pour ce workpaper"
    },
    {
      label: "409 other",
      result: { kind: "conflict_other" },
      text: "upload document impossible"
    },
    {
      label: "413",
      result: { kind: "payload_too_large" },
      text: "fichier trop volumineux (25 MiB max)"
    },
    { label: "5xx", result: { kind: "server_error" }, text: "erreur serveur documents" },
    { label: "network", result: { kind: "network_error" }, text: "erreur reseau documents" },
    { label: "timeout", result: { kind: "timeout" }, text: "timeout documents" },
    {
      label: "invalid payload",
      result: { kind: "invalid_payload" },
      text: "payload upload document invalide"
    },
    { label: "unexpected", result: { kind: "unexpected" }, text: "upload document indisponible" }
  ])("renders the exact upload mutation error '$text' on $label", async ({ result, text }) => {
    const user = userEvent.setup();
    mockedUpload.mockResolvedValue(result as UploadWorkpaperDocumentState);

    renderPanel({
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              anchorCode: "BS.ASSET.DRAFT",
              anchorLabel: "Current assets draft",
              workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Draft note" })
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.upload(within(card).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(card).getByLabelText("Source document"), "ERP");
    await user.click(within(card).getByRole("button", { name: "Uploader le document" }));

    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(mockedLoadWorkpapers).not.toHaveBeenCalled();
  });

  it("keeps the last rendered workpapers block visible and shows the refresh failure after a valid document upload success", async () => {
    const user = userEvent.setup();
    mockedUpload.mockResolvedValue({ kind: "success" });
    mockedLoadWorkpapers.mockResolvedValue({ kind: "server_error" });

    renderPanel({
      initialState: createReadyState(
        createWorkpapersModel({
          items: [
            createCurrentItem({
              anchorCode: "BS.ASSET.DRAFT",
              anchorLabel: "Current assets draft",
              workpaper: createWorkpaperDetails({ status: "DRAFT", noteText: "Draft note" })
            })
          ]
        })
      )
    });

    const card = getWorkpaperCard("BS.ASSET.DRAFT");
    await user.upload(within(card).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(card).getByLabelText("Source document"), "ERP");
    await user.click(within(card).getByRole("button", { name: "Uploader le document" }));

    expect(await screen.findByText("document uploade avec succes")).toBeInTheDocument();
    expect(
      await screen.findByText("rafraichissement workpapers impossible")
    ).toBeInTheDocument();
    expect(getWorkpaperCard("BS.ASSET.DRAFT")).toBeInTheDocument();
  });

  it("allows only one document upload in flight across the whole block", async () => {
    const user = userEvent.setup();
    mockedUpload.mockReturnValue(new Promise(() => {}));

    renderPanel({
      initialState: createReadyState(
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
      )
    });

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.upload(within(firstCard).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(firstCard).getByLabelText("Source document"), "ERP");
    await user.upload(within(secondCard).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(secondCard).getByLabelText("Source document"), "ERP");

    await user.click(within(firstCard).getByRole("button", { name: "Uploader le document" }));

    expect(await screen.findByText("upload document en cours")).toBeInTheDocument();
    expect(mockedUpload).toHaveBeenCalledTimes(1);
    expect(
      within(secondCard).getByRole("button", { name: "Uploader le document" })
    ).toBeDisabled();

    await user.click(within(secondCard).getByRole("button", { name: "Uploader le document" }));

    expect(mockedUpload).toHaveBeenCalledTimes(1);
  });

  it("keeps upload controls disabled while a workpaper save is submitting and never emits an upload in that state", async () => {
    const user = userEvent.setup();
    mockedUpsert.mockReturnValue(new Promise(() => {}));

    renderPanel({
      initialState: createReadyState(
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
      )
    });

    const firstCard = getWorkpaperCard("BS.ASSET.ONE");
    const secondCard = getWorkpaperCard("BS.ASSET.TWO");

    await user.clear(within(firstCard).getByLabelText("Note workpaper"));
    await user.type(within(firstCard).getByLabelText("Note workpaper"), "Updated one");
    await user.upload(within(secondCard).getByLabelText("Fichier document"), createUploadFile());
    await user.type(within(secondCard).getByLabelText("Source document"), "ERP");

    await user.click(within(firstCard).getByRole("button", { name: "Enregistrer le workpaper" }));

    expect(await screen.findByText("enregistrement workpaper en cours")).toBeInTheDocument();
    expect(
      within(secondCard).getByRole("button", { name: "Uploader le document" })
    ).toBeDisabled();
    expect(mockedUpload).not.toHaveBeenCalled();
  });
});
