import { describe, expect, it, vi } from "vitest";
import {
  deleteManualMapping,
  loadManualMappingShellState,
  upsertManualMapping
} from "./manual-mapping";

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

const MAPPING_PROJECTION = {
  closingFolderId: CLOSING_FOLDER.id,
  latestImportVersion: 3,
  summary: {
    total: 2,
    mapped: 1,
    unmapped: 1
  },
  lines: [
    {
      accountCode: "1000",
      accountLabel: "Cash",
      debit: "100",
      credit: "0"
    },
    {
      accountCode: "2000",
      accountLabel: "Revenue",
      debit: "0",
      credit: "100"
    }
  ],
  mappings: [
    {
      accountCode: "1000",
      targetCode: "BS.ASSET"
    }
  ],
  targets: [
    {
      code: "BS.ASSET",
      label: "Actif",
      selectable: true
    },
    {
      code: "BS.ASSET.SECTION",
      label: "Actif section",
      selectable: false
    },
    {
      code: "PL.REVENUE",
      label: "Produit",
      selectable: true
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

describe("manual mapping api", () => {
  describe("loadManualMappingShellState", () => {
    it("loads the projection, preserves backend order, and sends Accept plus X-Tenant-Id", async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, MAPPING_PROJECTION));

      const result = await loadManualMappingShellState(
        CLOSING_FOLDER.id,
        CLOSING_FOLDER,
        ACTIVE_TENANT,
        fetchMock
      );

      expect(result).toEqual({
        kind: "ready",
        projection: MAPPING_PROJECTION
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`
      );

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(init.method).toBe("GET");
      expect(headers.Accept).toBe("application/json");
      expect(headers["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    });

    it("returns invalid_payload when the projection is incoherent", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(200, {
          ...MAPPING_PROJECTION,
          summary: {
            total: 2,
            mapped: 2,
            unmapped: 0
          }
        })
      );

      const result = await loadManualMappingShellState(
        CLOSING_FOLDER.id,
        CLOSING_FOLDER,
        ACTIVE_TENANT,
        fetchMock
      );

      expect(result).toEqual({ kind: "invalid_payload" });
    });

    it.each([
      { status: 401, expected: { kind: "auth_required" } },
      { status: 403, expected: { kind: "forbidden" } },
      { status: 404, expected: { kind: "not_found" } },
      { status: 500, expected: { kind: "server_error" } },
      { status: 400, expected: { kind: "unexpected" } }
    ])("maps HTTP $status to the expected read state", async ({ status, expected }) => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, {}));

      const result = await loadManualMappingShellState(
        CLOSING_FOLDER.id,
        CLOSING_FOLDER,
        ACTIVE_TENANT,
        fetchMock
      );

      expect(result).toEqual(expected);
    });

    it("returns network_error on a network failure", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network"));

      const result = await loadManualMappingShellState(
        CLOSING_FOLDER.id,
        CLOSING_FOLDER,
        ACTIVE_TENANT,
        fetchMock
      );

      expect(result).toEqual({ kind: "network_error" });
    });

    it("returns timeout on a timeout failure", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));

      const result = await loadManualMappingShellState(
        CLOSING_FOLDER.id,
        CLOSING_FOLDER,
        ACTIVE_TENANT,
        fetchMock
      );

      expect(result).toEqual({ kind: "timeout" });
    });
  });

  describe("upsertManualMapping", () => {
    it("sends the exact PUT request body and headers", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(201, {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        })
      );

      const result = await upsertManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        },
        fetchMock
      );

      expect(result).toEqual({
        kind: "success",
        mapping: {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        }
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual`
      );

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(init.method).toBe("PUT");
      expect(headers.Accept).toBe("application/json");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(init.body).toBe(JSON.stringify({ accountCode: "2000", targetCode: "PL.REVENUE" }));
    });

    it("returns invalid_payload on an unusable success payload", async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        jsonResponse(200, {
          accountCode: "2000"
        })
      );

      const result = await upsertManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        },
        fetchMock
      );

      expect(result).toEqual({ kind: "invalid_payload" });
    });

    it.each([
      {
        response: jsonResponse(400, {
          message: "accountCode is not present in the latest import."
        }),
        expected: { kind: "bad_request_account_absent" }
      },
      {
        response: jsonResponse(400, {
          message: "targetCode is unknown."
        }),
        expected: { kind: "bad_request_target_invalid" }
      },
      {
        response: jsonResponse(400, {
          message: "targetCode is not selectable."
        }),
        expected: { kind: "bad_request_target_invalid" }
      },
      {
        response: jsonResponse(400, {
          message: "other"
        }),
        expected: { kind: "bad_request" }
      },
      {
        response: jsonResponse(409, {
          message: "Closing folder is archived and manual mappings cannot be modified."
        }),
        expected: { kind: "conflict_archived" }
      },
      {
        response: jsonResponse(409, {
          message: "No balance import is available for manual mapping."
        }),
        expected: { kind: "conflict_import_required" }
      },
      {
        response: jsonResponse(409, {
          message: "other"
        }),
        expected: { kind: "conflict_other" }
      }
    ])("refines mapping mutation errors from backend messages", async ({ response, expected }) => {
      const fetchMock = vi.fn().mockResolvedValue(response);

      const result = await upsertManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        },
        fetchMock
      );

      expect(result).toEqual(expected);
    });

    it.each([
      { status: 401, expected: { kind: "auth_required" } },
      { status: 403, expected: { kind: "forbidden" } },
      { status: 404, expected: { kind: "not_found" } },
      { status: 500, expected: { kind: "server_error" } },
      { status: 418, expected: { kind: "unexpected" } }
    ])("maps HTTP $status to the expected PUT state", async ({ status, expected }) => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, {}));

      const result = await upsertManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        },
        fetchMock
      );

      expect(result).toEqual(expected);
    });

    it("returns network_error on a PUT network failure", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network"));

      const result = await upsertManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        },
        fetchMock
      );

      expect(result).toEqual({ kind: "network_error" });
    });

    it("returns timeout on a PUT timeout failure", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));

      const result = await upsertManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        {
          accountCode: "2000",
          targetCode: "PL.REVENUE"
        },
        fetchMock
      );

      expect(result).toEqual({ kind: "timeout" });
    });
  });

  describe("deleteManualMapping", () => {
    it("sends the exact DELETE request with query param, Accept, X-Tenant-Id, and no body", async () => {
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

      const result = await deleteManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        "2000",
        fetchMock
      );

      expect(result).toEqual({ kind: "success" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        `/api/closing-folders/${CLOSING_FOLDER.id}/mappings/manual?accountCode=2000`
      );

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      const headers = init.headers as Record<string, string>;
      expect(init.method).toBe("DELETE");
      expect(headers.Accept).toBe("application/json");
      expect(headers["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
      expect(init.body).toBeUndefined();
    });

    it.each([
      {
        response: jsonResponse(400, {
          message: "accountCode is not present in the latest import."
        }),
        expected: { kind: "bad_request_account_absent" }
      },
      {
        response: jsonResponse(400, {
          message: "other"
        }),
        expected: { kind: "bad_request" }
      },
      {
        response: jsonResponse(409, {
          message: "Closing folder is archived and manual mappings cannot be modified."
        }),
        expected: { kind: "conflict_archived" }
      },
      {
        response: jsonResponse(409, {
          message: "No balance import is available for manual mapping."
        }),
        expected: { kind: "conflict_import_required" }
      }
    ])("refines DELETE errors from backend messages", async ({ response, expected }) => {
      const fetchMock = vi.fn().mockResolvedValue(response);

      const result = await deleteManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        "2000",
        fetchMock
      );

      expect(result).toEqual(expected);
    });

    it.each([
      { status: 401, expected: { kind: "auth_required" } },
      { status: 403, expected: { kind: "forbidden" } },
      { status: 404, expected: { kind: "not_found" } },
      { status: 500, expected: { kind: "server_error" } },
      { status: 418, expected: { kind: "unexpected" } }
    ])("maps HTTP $status to the expected DELETE state", async ({ status, expected }) => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, {}));

      const result = await deleteManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        "2000",
        fetchMock
      );

      expect(result).toEqual(expected);
    });

    it("returns network_error on a DELETE network failure", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("network"));

      const result = await deleteManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        "2000",
        fetchMock
      );

      expect(result).toEqual({ kind: "network_error" });
    });

    it("returns timeout on a DELETE timeout failure", async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));

      const result = await deleteManualMapping(
        CLOSING_FOLDER.id,
        ACTIVE_TENANT,
        "2000",
        fetchMock
      );

      expect(result).toEqual({ kind: "timeout" });
    });
  });
});
