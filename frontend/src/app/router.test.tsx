import { act } from "react";
import { RouterProvider } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { vi } from "vitest";
import { createAppMemoryRouter } from "./router";
import { DEFAULT_REQUEST_TIMEOUT_MS } from "../lib/api/http";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER = {
  id: "folder-123",
  tenantId: ACTIVE_TENANT.tenantId,
  name: "Closing FY26",
  periodStartOn: "2026-01-01",
  periodEndOn: "2026-12-31",
  externalRef: "EXT-26",
  status: "DRAFT"
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function renderRoute(initialEntry: string) {
  const router = createAppMemoryRouter([initialEntry]);
  return render(<RouterProvider router={router} />);
}

function expectVisibleText(text: string) {
  return screen.findByText(new RegExp(`^${text}$`));
}

async function flushTimeout() {
  await act(async () => {
    vi.advanceTimersByTime(DEFAULT_REQUEST_TIMEOUT_MS);
    await Promise.resolve();
  });
}

describe("router", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps / as an internal demonstration route with zero API calls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const { container } = renderRoute("/");

    expect(await screen.findByText("Design system minimal")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await axe(container)).violations).toEqual([]);
  });

  it("renders authentification requise on /api/me 401 and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, {}));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders contexte tenant requis on /api/me 200 with activeTenant null and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: null }));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("contexte tenant requis")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
  });

  it("renders profil indisponible on /api/me 403 and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me 5xx and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me network failure and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockRejectedValueOnce(new Error("network"));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me timeout and never calls dossier", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));

    renderRoute("/closing-folders/folder-123");
    await flushTimeout();
    vi.useRealTimers();

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me invalid payload and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: { tenantId: "x" } }));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders authentification requise on dossier 401, keeps tenant visible, and hides detail", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders acces dossier refuse on dossier 403", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(403, {}));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("acces dossier refuse")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier introuvable on dossier 404", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(404, {}));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("dossier introuvable")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier 5xx", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(500, {}));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier network failure", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockRejectedValueOnce(new Error("network"));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier timeout", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockRejectedValueOnce(new Error("timeout"));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier invalid payload", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(200, { id: "folder-123", tenantId: ACTIVE_TENANT.tenantId }));

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders incoherence tenant dossier on tenant mismatch", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ...CLOSING_FOLDER,
          tenantId: "22222222-2222-2222-2222-222222222222"
        })
      );

    renderRoute("/closing-folders/folder-123");

    expect(await expectVisibleText("incoherence tenant dossier")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders the exact dossier detail subset on the nominal branch and stays accessible", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER));

    const { container } = renderRoute("/closing-folders/folder-123");

    expect(await screen.findByText("Closing FY26")).toBeInTheDocument();
    expect(screen.getByText("EXT-26")).toBeInTheDocument();
    expect(screen.getByText("01.01.2026")).toBeInTheDocument();
    expect(screen.getByText("31.12.2026")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.queryByText(ACTIVE_TENANT.tenantId)).not.toBeInTheDocument();
    expect(screen.queryByText("folder-123")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
    expect(firstHeaders["X-Tenant-Id"]).toBeUndefined();
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/closing-folders/folder-123");
    expect(secondHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect((await axe(container)).violations).toEqual([]);
  });
});
