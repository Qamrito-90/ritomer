import { act } from "react";
import { RouterProvider } from "react-router-dom";
import { render, screen, within } from "@testing-library/react";
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
  latestImportVersion: 3,
  mappingSummary: {
    total: 2,
    mapped: 2,
    unmapped: 0
  },
  controls: [
    {
      code: "LATEST_VALID_BALANCE_IMPORT_PRESENT",
      status: "PASS",
      message: "Latest valid balance import version 3 is available."
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

const BLOCKED_CONTROLS = {
  closingFolderId: CLOSING_FOLDER.id,
  readiness: "BLOCKED",
  latestImportPresent: true,
  latestImportVersion: 2,
  mappingSummary: {
    total: 3,
    mapped: 1,
    unmapped: 2
  },
  controls: [
    {
      code: "LATEST_VALID_BALANCE_IMPORT_PRESENT",
      status: "PASS",
      message: "Latest valid balance import version 2 is available."
    },
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      status: "FAIL",
      message: "2 account(s) remain unmapped on the latest import."
    }
  ],
  nextAction: {
    code: "COMPLETE_MANUAL_MAPPING",
    path: `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`,
    actionable: true
  },
  unmappedAccounts: [
    {
      accountCode: "9000",
      accountLabel: "Revenue",
      debit: "0",
      credit: "100"
    },
    {
      accountCode: "0500",
      accountLabel: "Receivable",
      debit: "100",
      credit: "0"
    }
  ]
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

function renderRoute(initialEntry: string) {
  const router = createAppMemoryRouter([initialEntry]);
  return render(<RouterProvider router={router} />);
}

function expectVisibleText(text: string) {
  return screen.findByText(new RegExp(`^${text}$`));
}

function primeClosingRoute(fetchMock: ReturnType<typeof vi.fn>, controlsResponse: Promise<Response>) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
    .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
    .mockImplementationOnce(() => controlsResponse);
}

function expectNodeBefore(first: HTMLElement, second: HTMLElement) {
  expect(Boolean(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
    true
  );
}

function expectNoControlsNominalBlocks() {
  expect(screen.queryByRole("heading", { name: "Readiness" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Prochaine action" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Comptes non mappes" })).not.toBeInTheDocument();
}

function expectDefinitionValue(container: HTMLElement, label: string, value: string) {
  const labelNode = within(container).getByText(new RegExp(`^${label}$`));
  const valueNode = labelNode.parentElement?.querySelector("dd");

  expect(valueNode).not.toBeNull();
  expect(valueNode).toHaveTextContent(value);
}

async function expectControlsState(text: string) {
  expect(await expectVisibleText(text)).toBeInTheDocument();
  expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
  expect(screen.getByText("Dossier courant")).toBeInTheDocument();
  expect(screen.getByText("Closing FY26")).toBeInTheDocument();
  expect(screen.getByText("Controles")).toBeInTheDocument();
  expectNoControlsNominalBlocks();
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

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders contexte tenant requis on /api/me 200 with activeTenant null and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: null }));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("contexte tenant requis")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("tenant actif")).not.toBeInTheDocument();
  });

  it("renders profil indisponible on /api/me 403 and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me 5xx and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me network failure and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockRejectedValueOnce(new Error("network"));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me timeout and never calls dossier", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockImplementationOnce(() => new Promise(() => {}));

    renderRoute(CLOSING_ROUTE);
    await flushTimeout();
    vi.useRealTimers();

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders profil indisponible on /api/me invalid payload and never calls dossier", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { activeTenant: { tenantId: "x" } }));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("profil indisponible")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders authentification requise on dossier 401, keeps tenant visible, and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(401, {}));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("authentification requise")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders acces dossier refuse on dossier 403 and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(403, {}));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("acces dossier refuse")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier introuvable on dossier 404 and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(404, {}));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("dossier introuvable")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier 5xx and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(500, {}));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier network failure and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockRejectedValueOnce(new Error("network"));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier timeout and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockRejectedValueOnce(new Error("timeout"));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders dossier indisponible on dossier invalid payload and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(200, { id: CLOSING_FOLDER.id, tenantId: ACTIVE_TENANT.tenantId }));

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("dossier indisponible")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders incoherence tenant dossier on tenant mismatch and never calls controls", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ...CLOSING_FOLDER,
          tenantId: "22222222-2222-2222-2222-222222222222"
        })
      );

    renderRoute(CLOSING_ROUTE);

    expect(await expectVisibleText("incoherence tenant dossier")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Closing FY26")).not.toBeInTheDocument();
  });

  it("renders the dossier block first, then the controls loading slot while controls are pending", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeClosingRoute(fetchMock, new Promise(() => {}));

    renderRoute(CLOSING_ROUTE);

    expect(await screen.findByText("Closing FY26")).toBeInTheDocument();
    expect(screen.getByText("Dossier courant")).toBeInTheDocument();
    expect(await expectVisibleText("chargement controls")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expectNoControlsNominalBlocks();
  });

  it.each([
    { status: 401, text: "authentification requise" },
    { status: 403, text: "acces controls refuse" },
    { status: 404, text: "controls introuvables" },
    { status: 500, text: "erreur serveur controls" },
    { status: 400, text: "controles indisponibles" }
  ])("renders the exact controls state for HTTP $status", async ({ status, text }) => {
    const fetchMock = vi.mocked(global.fetch);
    primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(status, {})));

    renderRoute(CLOSING_ROUTE);

    await expectControlsState(text);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renders erreur reseau controls on a controls network failure", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
      .mockRejectedValueOnce(new Error("network"));

    renderRoute(CLOSING_ROUTE);

    await expectControlsState("erreur reseau controls");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renders timeout controls on a controls timeout failure", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { activeTenant: ACTIVE_TENANT }))
      .mockResolvedValueOnce(jsonResponse(200, CLOSING_FOLDER))
      .mockRejectedValueOnce(new Error("timeout"));

    renderRoute(CLOSING_ROUTE);

    await expectControlsState("timeout controls");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renders payload controls invalide when the controls payload is incomplete", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeClosingRoute(
      fetchMock,
      Promise.resolve(
        jsonResponse(200, {
          ...READY_CONTROLS,
          controls: [
            READY_CONTROLS.controls[1],
            READY_CONTROLS.controls[0]
          ]
        })
      )
    );

    renderRoute(CLOSING_ROUTE);

    await expectControlsState("payload controls invalide");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("renders the exact READY controls blocks in order and stays accessible", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(200, READY_CONTROLS)));

    const { container } = renderRoute(CLOSING_ROUTE);

    expect(await screen.findByText("Closing FY26")).toBeInTheDocument();
    expect(await screen.findByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect(screen.getByText("EXT-26")).toBeInTheDocument();
    expect(screen.getByText("01.01.2026")).toBeInTheDocument();
    expect(screen.getByText("31.12.2026")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();

    const readinessHeading = screen.getByRole("heading", { name: "Readiness" });
    const controlsHeading = screen.getByRole("heading", { name: "Controles" });
    const nextActionHeading = screen.getByRole("heading", { name: "Prochaine action" });
    const unmappedHeading = screen.getByRole("heading", { name: "Comptes non mappes" });

    expectNodeBefore(readinessHeading, controlsHeading);
    expectNodeBefore(controlsHeading, nextActionHeading);
    expectNodeBefore(nextActionHeading, unmappedHeading);

    const readinessBlock = readinessHeading.closest("section");
    const controlsBlock = controlsHeading.closest("section");
    const nextActionBlock = nextActionHeading.closest("section");
    const unmappedBlock = unmappedHeading.closest("section");

    expect(readinessBlock).not.toBeNull();
    expect(controlsBlock).not.toBeNull();
    expect(nextActionBlock).not.toBeNull();
    expect(unmappedBlock).not.toBeNull();

    expectDefinitionValue(readinessBlock as HTMLElement, "readiness", "pret");
    expectDefinitionValue(readinessBlock as HTMLElement, "dernier import valide", "present");
    expectDefinitionValue(readinessBlock as HTMLElement, "version d import", "3");
    expectDefinitionValue(readinessBlock as HTMLElement, "comptes total", "2");
    expectDefinitionValue(readinessBlock as HTMLElement, "comptes mappes", "2");
    expectDefinitionValue(readinessBlock as HTMLElement, "comptes non mappes", "0");

    expect(
      within(controlsBlock as HTMLElement).getByText("dernier import valide")
    ).toBeInTheDocument();
    expect(
      within(controlsBlock as HTMLElement).getByText("mapping manuel complet")
    ).toBeInTheDocument();
    expect(within(controlsBlock as HTMLElement).getAllByText("ok")).toHaveLength(2);
    expect(
      within(controlsBlock as HTMLElement).getByText(READY_CONTROLS.controls[0].message)
    ).toBeInTheDocument();
    expect(
      within(controlsBlock as HTMLElement).getByText(READY_CONTROLS.controls[1].message)
    ).toBeInTheDocument();

    expect(within(nextActionBlock as HTMLElement).getByText("aucune action requise")).toBeInTheDocument();
    expect(within(unmappedBlock as HTMLElement).getByText("aucun compte non mappe")).toBeInTheDocument();

    expect(screen.queryByText(ACTIVE_TENANT.tenantId)).not.toBeInTheDocument();
    expect(screen.queryByText(CLOSING_FOLDER.id)).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const firstHeaders = (fetchMock.mock.calls[0]?.[1] as RequestInit).headers as Record<string, string>;
    const secondHeaders = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Record<string, string>;
    const thirdHeaders = (fetchMock.mock.calls[2]?.[1] as RequestInit).headers as Record<string, string>;

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/me");
    expect(firstHeaders["X-Tenant-Id"]).toBeUndefined();
    expect(fetchMock.mock.calls[1]?.[0]).toBe(`/api/closing-folders/${CLOSING_FOLDER.id}`);
    expect(secondHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      `/api/closing-folders/${CLOSING_FOLDER.id}/controls`
    );
    expect(thirdHeaders["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect((await axe(container)).violations).toEqual([]);
  });

  it("renders the exact BLOCKED controls blocks, keeps backend order, and keeps nextAction.path read-only", async () => {
    const fetchMock = vi.mocked(global.fetch);
    primeClosingRoute(fetchMock, Promise.resolve(jsonResponse(200, BLOCKED_CONTROLS)));

    renderRoute(CLOSING_ROUTE);

    expect(await screen.findByText("Closing FY26")).toBeInTheDocument();

    const readinessBlock = screen.getByRole("heading", { name: "Readiness" }).closest("section");
    const controlsBlock = screen.getByRole("heading", { name: "Controles" }).closest("section");
    const nextActionBlock = screen
      .getByRole("heading", { name: "Prochaine action" })
      .closest("section");
    const unmappedBlock = screen
      .getByRole("heading", { name: "Comptes non mappes" })
      .closest("section");

    expect(readinessBlock).not.toBeNull();
    expect(controlsBlock).not.toBeNull();
    expect(nextActionBlock).not.toBeNull();
    expect(unmappedBlock).not.toBeNull();

    expectDefinitionValue(readinessBlock as HTMLElement, "readiness", "bloque");
    expectDefinitionValue(readinessBlock as HTMLElement, "dernier import valide", "present");
    expectDefinitionValue(readinessBlock as HTMLElement, "version d import", "2");
    expectDefinitionValue(readinessBlock as HTMLElement, "comptes total", "3");
    expectDefinitionValue(readinessBlock as HTMLElement, "comptes mappes", "1");
    expectDefinitionValue(readinessBlock as HTMLElement, "comptes non mappes", "2");

    const importLabel = within(controlsBlock as HTMLElement).getByText("dernier import valide");
    const mappingLabel = within(controlsBlock as HTMLElement).getByText("mapping manuel complet");
    expectNodeBefore(importLabel, mappingLabel);
    expect(within(controlsBlock as HTMLElement).getByText("ok")).toBeInTheDocument();
    expect(within(controlsBlock as HTMLElement).getByText("bloquant")).toBeInTheDocument();
    expect(
      within(controlsBlock as HTMLElement).getByText(BLOCKED_CONTROLS.controls[0].message)
    ).toBeInTheDocument();
    expect(
      within(controlsBlock as HTMLElement).getByText(BLOCKED_CONTROLS.controls[1].message)
    ).toBeInTheDocument();

    expect(
      within(nextActionBlock as HTMLElement).getByText("completer le mapping manuel")
    ).toBeInTheDocument();
    expectDefinitionValue(nextActionBlock as HTMLElement, "action possible", "oui");
    const pathNode = within(nextActionBlock as HTMLElement).getByText(
      BLOCKED_CONTROLS.nextAction.path
    );
    expect(pathNode.closest("a")).toBeNull();

    expect(
      within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Compte" })
    ).toBeInTheDocument();
    expect(
      within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Libelle" })
    ).toBeInTheDocument();
    expect(
      within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Debit" })
    ).toBeInTheDocument();
    expect(
      within(unmappedBlock as HTMLElement).getByRole("columnheader", { name: "Credit" })
    ).toBeInTheDocument();

    const rows = within(unmappedBlock as HTMLElement).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("9000");
    expect(rows[1]).toHaveTextContent("Revenue");
    expect(rows[2]).toHaveTextContent("0500");
    expect(rows[2]).toHaveTextContent("Receivable");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
