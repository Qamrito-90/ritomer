import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExportAuditPackPanel } from "./export-audit-pack-panel";
import { MinimalAnnexPanel } from "./minimal-annex-panel";
import type { ExportPack } from "../lib/api/exports";
import type { MinimalAnnexReadModel } from "../lib/api/minimal-annex";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EXPORT_PACK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const VALID_EXPORT_PACK: ExportPack = {
  exportPackId: EXPORT_PACK_ID,
  closingFolderId: CLOSING_FOLDER_ID,
  fileName: "audit-ready-pack.zip",
  mediaType: "application/zip",
  byteSize: 512,
  checksumSha256: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  basisImportVersion: 2,
  basisTaxonomyVersion: 1,
  createdAt: "2026-02-01T10:00:00Z",
  createdByUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd"
};

const BLOCKED_MINIMAL_ANNEX_WITHOUT_EXPORT: MinimalAnnexReadModel = {
  closingFolderId: CLOSING_FOLDER_ID,
  closingFolderStatus: "DRAFT",
  readiness: "BLOCKED",
  annexState: "BLOCKED",
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
    controlsReadiness: "BLOCKED",
    latestImportVersion: null,
    taxonomyVersion: 2,
    structuredStatementState: "NO_DATA",
    structuredPresentationType: "STRUCTURED_PREVIEW",
    exportPack: null
  },
  blockers: [
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

const BLOCKED_MINIMAL_ANNEX_WITH_EXPORT: MinimalAnnexReadModel = {
  ...BLOCKED_MINIMAL_ANNEX_WITHOUT_EXPORT,
  basis: {
    ...BLOCKED_MINIMAL_ANNEX_WITHOUT_EXPORT.basis,
    exportPack: {
      exportPackId: EXPORT_PACK_ID,
      createdAt: VALID_EXPORT_PACK.createdAt,
      basisImportVersion: VALID_EXPORT_PACK.basisImportVersion,
      basisTaxonomyVersion: VALID_EXPORT_PACK.basisTaxonomyVersion
    }
  },
  blockers: [
    {
      code: "CLOSING_NOT_READY",
      message: "Closing controls are not ready.",
      source: "CONTROLS",
      target: null
    }
  ]
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function zipResponse(status = 200, blob: Blob = new Blob(["zip-content"])) {
  return new Response(blob, {
    status,
    headers: {
      "Content-Disposition": "attachment; filename*=UTF-8''audit-ready-pack.zip",
      "Content-Type": "application/zip"
    }
  });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

function renderPanel() {
  return render(
    <ExportAuditPackPanel activeTenant={ACTIVE_TENANT} closingFolderId={CLOSING_FOLDER_ID} />
  );
}

function ExportAndMinimalAnnexHarness() {
  const [minimalAnnexRefreshRequestId, setMinimalAnnexRefreshRequestId] = useState(0);

  return (
    <>
      <ExportAuditPackPanel
        activeTenant={ACTIVE_TENANT}
        closingFolderId={CLOSING_FOLDER_ID}
        onExportPackCreateSucceeded={() => {
          setMinimalAnnexRefreshRequestId((currentRequestId) => currentRequestId + 1);
        }}
      />
      <MinimalAnnexPanel
        activeTenant={ACTIVE_TENANT}
        closingFolderId={CLOSING_FOLDER_ID}
        postExportPackRefreshRequestId={minimalAnnexRefreshRequestId}
      />
    </>
  );
}

function renderExportAndMinimalAnnexHarness() {
  return render(<ExportAndMinimalAnnexHarness />);
}

function getRequestPaths(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

function getPostExportPackCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const [path, init] = call as [string, RequestInit];
    return path.endsWith("/export-packs") && init.method === "POST";
  });
}

function getDownloadContentCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const [path, init] = call as [string, RequestInit];
    return path.endsWith(`/export-packs/${EXPORT_PACK_ID}/content`) && init.method === "GET";
  });
}

function getMinimalAnnexCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => {
    const [path, init] = call as [string, RequestInit];
    return path.endsWith("/minimal-annex") && init.method === "GET";
  });
}

describe("ExportAuditPackPanel", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows loading, empty, error, and generated list states", async () => {
    const pendingFetch = vi.fn(() => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", pendingFetch);

    const loadingRender = renderPanel();
    expect(screen.getByText("loading export packs")).toBeInTheDocument();
    loadingRender.unmount();

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));
    vi.stubGlobal("fetch", fetchMock);

    const emptyRender = renderPanel();
    expect(await screen.findByText("No audit-ready pack generated yet.")).toBeInTheDocument();
    emptyRender.unmount();

    const errorRender = renderPanel();
    expect(await screen.findByText("export packs unavailable")).toBeInTheDocument();
    errorRender.unmount();

    renderPanel();
    expect(await screen.findByText("audit-ready-pack.zip")).toBeInTheDocument();
    expect(screen.getByText("Audit-ready pack available.")).toBeInTheDocument();
  });

  it("creates an export pack with 201 and refreshes the list", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
      .mockResolvedValueOnce(jsonResponse(201, VALID_EXPORT_PACK))
      .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));

    renderPanel();
    expect(await screen.findByText("No audit-ready pack generated yet.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Generate audit-ready pack" }));

    expect(await screen.findByText("audit-ready-pack.zip")).toBeInTheDocument();
    expect(getRequestPaths(fetchMock)).toEqual([
      `/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs`,
      `/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs`
    ]);
    expect(getPostExportPackCalls(fetchMock)).toHaveLength(1);
  });

  it("treats 200 create replay as success and refreshes the list", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
      .mockResolvedValueOnce(jsonResponse(200, VALID_EXPORT_PACK))
      .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));

    renderPanel();
    await screen.findByText("No audit-ready pack generated yet.");
    await user.click(screen.getByRole("button", { name: "Generate audit-ready pack" }));

    expect(await screen.findByText("audit-ready-pack.zip")).toBeInTheDocument();
    expect(getPostExportPackCalls(fetchMock)).toHaveLength(1);
  });

  it.each([
    { status: 201, label: "created" },
    { status: 200, label: "replay" }
  ])(
    "refreshes the minimal annex preview after export pack $label success",
    async ({ status }) => {
      const user = userEvent.setup();
      const fetchMock = vi.mocked(global.fetch);
      let exportPackListCalls = 0;
      let minimalAnnexCalls = 0;

      fetchMock.mockImplementation((input, init) => {
        const path = String(input);
        const method = init?.method;

        if (path.endsWith("/minimal-annex") && method === "GET") {
          minimalAnnexCalls += 1;
          return Promise.resolve(
            jsonResponse(
              200,
              minimalAnnexCalls === 1
                ? BLOCKED_MINIMAL_ANNEX_WITHOUT_EXPORT
                : BLOCKED_MINIMAL_ANNEX_WITH_EXPORT
            )
          );
        }

        if (path.endsWith("/export-packs") && method === "GET") {
          exportPackListCalls += 1;
          return Promise.resolve(
            jsonResponse(200, {
              items: exportPackListCalls === 1 ? [] : [VALID_EXPORT_PACK]
            })
          );
        }

        if (path.endsWith("/export-packs") && method === "POST") {
          return Promise.resolve(jsonResponse(status, VALID_EXPORT_PACK));
        }

        return Promise.resolve(jsonResponse(404, {}));
      });

      renderExportAndMinimalAnnexHarness();

      expect(await screen.findByText("No audit-ready pack generated yet.")).toBeInTheDocument();
      expect(await screen.findByText("export pack basis : absent")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Generate audit-ready pack" }));

      expect(await screen.findByText("audit-ready-pack.zip")).toBeInTheDocument();
      expect(await screen.findByText("export pack basis : present")).toBeInTheDocument();
      expect(getMinimalAnnexCalls(fetchMock)).toHaveLength(2);
      expect(
        screen.queryByText("rafraichissement minimal annex impossible")
      ).not.toBeInTheDocument();

      const requestPaths = getRequestPaths(fetchMock);
      expect(requestPaths.some((path) => path.includes("/ai"))).toBe(false);
      expect(requestPaths.some((path) => path.includes("/graphql"))).toBe(false);
      expect(requestPaths.some((path) => path.includes("/workpapers"))).toBe(false);
      expect(requestPaths.some((path) => path.includes("/documents"))).toBe(false);
      expect(requestPaths.some((path) => path.endsWith("/content"))).toBe(false);
    }
  );

  it.each([
    { status: 409, label: "409 generic" },
    { status: 403, label: "403" },
    { status: 404, label: "404" },
    { status: 500, label: "5xx" }
  ])("shows generic create blocked feedback on $label", async ({ status }) => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
      .mockResolvedValueOnce(jsonResponse(status, {}));

    renderPanel();
    await screen.findByText("No audit-ready pack generated yet.");
    await user.click(screen.getByRole("button", { name: "Generate audit-ready pack" }));

    expect(await screen.findByText("Export pack generation blocked.")).toBeInTheDocument();
  });

  it("does not create or download automatically at mount", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));

    renderPanel();
    expect(await screen.findByText("audit-ready-pack.zip")).toBeInTheDocument();

    expect(getRequestPaths(fetchMock)).toEqual([
      `/api/closing-folders/${CLOSING_FOLDER_ID}/export-packs`
    ]);
    expect(getPostExportPackCalls(fetchMock)).toHaveLength(0);
    expect(getDownloadContentCalls(fetchMock)).toHaveLength(0);
  });

  it("downloads ZIP through a blob URL and revokes it", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    const createObjectUrl = vi.fn<(blob: Blob) => string>(() => "blob:ritomer-export");
    const revokeObjectUrl = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl
    });

    try {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }))
        .mockResolvedValueOnce(zipResponse());

      renderPanel();
      await screen.findByText("audit-ready-pack.zip");
      await user.click(screen.getByRole("button", { name: "Download ZIP" }));

      await waitFor(() => {
        expect(createObjectUrl).toHaveBeenCalledTimes(1);
      });
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectUrl
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectUrl
      });
    }

    expect((createObjectUrl.mock.calls[0]?.[0] as Blob).type).toBe("application/zip");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:ritomer-export");
  });

  it("shows download error feedback", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }))
      .mockResolvedValueOnce(zipResponse(500));

    renderPanel();
    await screen.findByText("audit-ready-pack.zip");
    await user.click(screen.getByRole("button", { name: "Download ZIP" }));

    expect(await screen.findByText("Export pack download unavailable.")).toBeInTheDocument();
  });

  it("does not refresh minimal annex or show its warning after ZIP download", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    const createObjectUrl = vi.fn<(blob: Blob) => string>(() => "blob:ritomer-export");
    const revokeObjectUrl = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl
    });

    fetchMock.mockImplementation((input, init) => {
      const path = String(input);
      const method = init?.method;

      if (path.endsWith("/minimal-annex") && method === "GET") {
        return Promise.resolve(jsonResponse(200, BLOCKED_MINIMAL_ANNEX_WITH_EXPORT));
      }

      if (path.endsWith("/export-packs") && method === "GET") {
        return Promise.resolve(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));
      }

      if (path.endsWith(`/export-packs/${EXPORT_PACK_ID}/content`) && method === "GET") {
        return Promise.resolve(zipResponse());
      }

      return Promise.resolve(jsonResponse(404, {}));
    });

    try {
      renderExportAndMinimalAnnexHarness();

      await screen.findByText("audit-ready-pack.zip");
      await screen.findByText("export pack basis : present");

      expect(getMinimalAnnexCalls(fetchMock)).toHaveLength(1);

      await user.click(screen.getByRole("button", { name: "Download ZIP" }));

      expect(await screen.findByText("Download ZIP started.")).toBeInTheDocument();
      expect(click).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrl).toHaveBeenCalledWith("blob:ritomer-export");
      expect(getDownloadContentCalls(fetchMock)).toHaveLength(1);
      expect(getMinimalAnnexCalls(fetchMock)).toHaveLength(1);
      expect(
        screen.queryByText("rafraichissement minimal annex impossible")
      ).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectUrl
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectUrl
      });
    }
  });

  it("prevents double-submit during create and keeps the Idempotency-Key out of the DOM", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    const createDeferred = deferredResponse();
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
      .mockReturnValueOnce(createDeferred.promise)
      .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));
    const { container } = renderPanel();

    await screen.findByText("No audit-ready pack generated yet.");
    const button = screen.getByRole("button", { name: "Generate audit-ready pack" });

    await user.click(button);
    await user.click(button);

    expect(getPostExportPackCalls(fetchMock)).toHaveLength(1);

    const [, init] = getPostExportPackCalls(fetchMock)[0] as [string, RequestInit];
    const idempotencyKey = (init.headers as Record<string, string>)["Idempotency-Key"];
    expect(idempotencyKey).toBeTruthy();
    expect(container).not.toHaveTextContent(idempotencyKey);

    createDeferred.resolve(jsonResponse(201, VALID_EXPORT_PACK));
    expect(await screen.findByText("audit-ready-pack.zip")).toBeInTheDocument();
  });

  it("prevents double-submit during download for the same pack", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    const downloadDeferred = deferredResponse();
    const createObjectUrl = vi.fn<(blob: Blob) => string>(() => "blob:ritomer-export");
    const revokeObjectUrl = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl
    });

    try {
      fetchMock
        .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }))
        .mockReturnValueOnce(downloadDeferred.promise);

      renderPanel();
      await screen.findByText("audit-ready-pack.zip");
      const button = screen.getByRole("button", { name: "Download ZIP" });

      await user.click(button);
      await user.click(button);

      expect(getDownloadContentCalls(fetchMock)).toHaveLength(1);

      downloadDeferred.resolve(zipResponse());
      await waitFor(() => {
        expect(click).toHaveBeenCalledTimes(1);
      });
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectUrl
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectUrl
      });
    }
  });

  it("does not use browser storage for idempotency or actions", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(global.fetch);
    const storageSetItem = vi.spyOn(Storage.prototype, "setItem");
    const storageGetItem = vi.spyOn(Storage.prototype, "getItem");
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
      .mockResolvedValueOnce(jsonResponse(201, VALID_EXPORT_PACK))
      .mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));

    renderPanel();
    await screen.findByText("No audit-ready pack generated yet.");
    await user.click(screen.getByRole("button", { name: "Generate audit-ready pack" }));
    await screen.findByText("audit-ready-pack.zip");

    expect(storageSetItem).not.toHaveBeenCalled();
    expect(storageGetItem).not.toHaveBeenCalled();
  });

  it("does not expose storage keys, signed links, or private paths from invalid payloads", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        items: [
          {
            ...VALID_EXPORT_PACK,
            storage_object_key: "gs://private-bucket/export.zip",
            storageObjectKey: "private/object.zip",
            signedUrl: "https://storage.googleapis.com/private/export.zip"
          }
        ]
      })
    );
    const { container } = renderPanel();

    expect(await screen.findByText("export packs unavailable")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("storage_object_key");
    expect(container).not.toHaveTextContent("storageObjectKey");
    expect(container).not.toHaveTextContent("signedUrl");
    expect(container).not.toHaveTextContent("gs://");
    expect(container).not.toHaveTextContent("private-bucket");
    expect(container).not.toHaveTextContent("storage.googleapis.com");
  });

  it("keeps the required non-statutory, human-review wording and avoids forbidden claims", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { items: [VALID_EXPORT_PACK] }));
    const { container } = renderPanel();

    await screen.findByText("audit-ready-pack.zip");

    expect(container).toHaveTextContent("Non statutory.");
    expect(container).toHaveTextContent(
      "Human review required before client or statutory use."
    );
    expect(container).toHaveTextContent("Not a final CO deliverable.");

    const forbiddenPhrases = [
      "CO-" + "ready",
      "statutory-" + "ready",
      "official financial statements",
      "automatically approved",
      "AI-" + "approved",
      "final accounts approved",
      "statutory approval",
      "final CO annex",
      "pack final pret a deposer",
      "comptes annuels officiels",
      "annexe CO finale",
      "approuve automatiquement"
    ];

    for (const phrase of forbiddenPhrases) {
      expect(container).not.toHaveTextContent(new RegExp(phrase, "i"));
    }
  });
});
