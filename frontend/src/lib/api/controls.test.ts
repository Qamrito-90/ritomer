import { describe, expect, it, vi } from "vitest";
import {
  loadControlsShellState,
  type ClosingControlsSummary
} from "./controls";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const CLOSING_FOLDER = {
  id: CLOSING_FOLDER_ID,
  tenantId: ACTIVE_TENANT.tenantId,
  name: "Closing FY26",
  periodStartOn: "2026-01-01",
  periodEndOn: "2026-12-31",
  externalRef: "EXT-26",
  status: "DRAFT"
};

const READY_CONTROLS: ClosingControlsSummary = {
  closingFolderId: CLOSING_FOLDER_ID,
  closingFolderStatus: "DRAFT",
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
      severity: "BLOCKER",
      message: "Latest valid balance import version 3 is available."
    },
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      status: "PASS",
      severity: "BLOCKER",
      message: "Manual mapping is complete on the latest import."
    }
  ],
  nextAction: null,
  unmappedAccounts: []
};

const BLOCKED_CONTROLS: ClosingControlsSummary = {
  closingFolderId: CLOSING_FOLDER_ID,
  closingFolderStatus: "DRAFT",
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
      severity: "BLOCKER",
      message: "Latest valid balance import version 2 is available."
    },
    {
      code: "MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT",
      status: "FAIL",
      severity: "BLOCKER",
      message: "2 account(s) remain unmapped on the latest import."
    }
  ],
  nextAction: {
    code: "COMPLETE_MANUAL_MAPPING",
    path: `/api/closing-folders/${CLOSING_FOLDER_ID}/mappings/manual`,
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

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function cloneReadyControls(overrides: Record<string, unknown> = {}) {
  return {
    ...READY_CONTROLS,
    ...overrides
  };
}

function cloneBlockedControls(overrides: Record<string, unknown> = {}) {
  return {
    ...BLOCKED_CONTROLS,
    ...overrides
  };
}

describe("controls api", () => {
  it("calls GET /controls with X-Tenant-Id and returns READY payload", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, READY_CONTROLS));

    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "ready",
      controls: READY_CONTROLS
    });

    expect(fetcher).toHaveBeenCalledWith(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/controls`,
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          Accept: "application/json",
          "X-Tenant-Id": ACTIVE_TENANT.tenantId
        })
      })
    );
  });

  it("encodes closingFolderId before calling the read-only endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(404, {}));

    await expect(
      loadControlsShellState("folder id/with spaces", CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "not_found" });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/closing-folders/folder%20id%2Fwith%20spaces/controls",
      expect.objectContaining({
        method: "GET"
      })
    );
  });

  it("returns BLOCKED payload without sorting unmapped accounts", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, BLOCKED_CONTROLS));

    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "ready",
      controls: BLOCKED_CONTROLS
    });
  });

  it.each([
    { status: 401, kind: "auth_required" },
    { status: 403, kind: "forbidden" },
    { status: 404, kind: "not_found" },
    { status: 500, kind: "server_error" },
    { status: 418, kind: "unexpected" }
  ])("maps GET /controls HTTP $status to $kind", async ({ status, kind }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind });
  });

  it("maps timeout and network failures", async () => {
    const timeoutFetcher = vi.fn().mockRejectedValue(new Error("timeout"));
    const networkFetcher = vi.fn().mockRejectedValue(new Error("network"));

    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, timeoutFetcher)
    ).resolves.toEqual({ kind: "timeout" });
    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, networkFetcher)
    ).resolves.toEqual({ kind: "network_error" });
  });

  it.each([
    {
      label: "missing payload",
      payload: () => undefined
    },
    {
      label: "closingFolderId mismatch",
      payload: () =>
        cloneReadyControls({
          closingFolderId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        })
    },
    {
      label: "READY with nextAction",
      payload: () =>
        cloneReadyControls({
          nextAction: {
            code: "IMPORT_BALANCE",
            path: `/api/closing-folders/${CLOSING_FOLDER_ID}/imports/balance`,
            actionable: true
          }
        })
    },
    {
      label: "BLOCKED without failed control",
      payload: () =>
        cloneBlockedControls({
          controls: [
            BLOCKED_CONTROLS.controls[0],
            {
              ...BLOCKED_CONTROLS.controls[1],
              status: "NOT_APPLICABLE"
            }
          ]
        })
    },
    {
      label: "nextAction path not canonical",
      payload: () =>
        cloneBlockedControls({
          nextAction: {
            ...BLOCKED_CONTROLS.nextAction,
            path: `/api/closing-folders/${CLOSING_FOLDER_ID}/imports/balance`
          }
        })
    },
    {
      label: "missing closingFolderStatus",
      payload: () => {
        const payload: Partial<ClosingControlsSummary> = { ...READY_CONTROLS };
        delete payload.closingFolderStatus;

        return payload;
      }
    },
    {
      label: "invalid readiness enum",
      payload: () => cloneReadyControls({ readiness: "DONE" })
    },
    {
      label: "invalid closingFolderStatus enum",
      payload: () => cloneReadyControls({ closingFolderStatus: "FINALIZED" })
    },
    {
      label: "invalid severity enum",
      payload: () =>
        cloneReadyControls({
          controls: [
            {
              ...READY_CONTROLS.controls[0],
              severity: "WARNING"
            },
            READY_CONTROLS.controls[1]
          ]
        })
    },
    {
      label: "missing severity",
      payload: () => {
        const controlWithoutSeverity: Partial<ClosingControlsSummary["controls"][number]> = {
          ...READY_CONTROLS.controls[0]
        };
        delete controlWithoutSeverity.severity;

        return cloneReadyControls({
          controls: [controlWithoutSeverity, READY_CONTROLS.controls[1]]
        });
      }
    },
    {
      label: "invalid latestImportPresent type",
      payload: () => cloneReadyControls({ latestImportPresent: "true" })
    },
    {
      label: "invalid null account label",
      payload: () =>
        cloneBlockedControls({
          unmappedAccounts: [
            {
              ...BLOCKED_CONTROLS.unmappedAccounts[0],
              accountLabel: null
            }
          ]
        })
    },
    {
      label: "missing mappingSummary field",
      payload: () =>
        cloneReadyControls({
          mappingSummary: {
            total: 2,
            mapped: 2
          }
        })
    },
    {
      label: "controls order divergent",
      payload: () =>
        cloneReadyControls({
          controls: [READY_CONTROLS.controls[1], READY_CONTROLS.controls[0]]
        })
    },
    {
      label: "latest import coherence violation",
      payload: () => cloneBlockedControls({ latestImportPresent: false })
    }
  ])("returns invalid_payload for $label", async ({ payload }) => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse(200, payload()));

    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });

  it("does not reject non-sensitive additional fields by principle", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...READY_CONTROLS,
        serverTraceId: "trace-1"
      })
    );

    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({
      kind: "ready",
      controls: READY_CONTROLS
    });
  });

  it.each([
    "storageObjectKey",
    "storage_object_key",
    "signedUrl",
    "storagePath",
    "rawProviderMessage",
    "providerResponse",
    "secret",
    "token",
    "credential",
    "privatePath"
  ])("fails closed on sensitive field %s", async (field) => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ...READY_CONTROLS,
        diagnostics: {
          [field]: "private-value"
        }
      })
    );

    await expect(
      loadControlsShellState(CLOSING_FOLDER_ID, CLOSING_FOLDER, ACTIVE_TENANT, fetcher)
    ).resolves.toEqual({ kind: "invalid_payload" });
  });
});
