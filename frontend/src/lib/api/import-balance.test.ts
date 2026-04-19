import { describe, expect, it, vi } from "vitest";
import { uploadBalanceImport } from "./import-balance";

const ACTIVE_TENANT = {
  tenantId: "11111111-1111-1111-1111-111111111111",
  tenantSlug: "tenant-alpha",
  tenantName: "Tenant Alpha"
};

const CLOSING_FOLDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("uploadBalanceImport", () => {
  it("posts FormData with the single file part, sends Accept and X-Tenant-Id, and never sets Content-Type manually", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        closingFolderId: CLOSING_FOLDER_ID,
        version: 3,
        rowCount: 12
      })
    );
    const file = new File(["accountCode,accountLabel,debit,credit"], "balance.csv", {
      type: "text/plain"
    });

    const result = await uploadBalanceImport(CLOSING_FOLDER_ID, ACTIVE_TENANT, file, fetchMock);

    expect(result).toEqual({
      kind: "created",
      balanceImport: {
        closingFolderId: CLOSING_FOLDER_ID,
        version: 3,
        rowCount: 12
      }
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/imports/balance`
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const formData = init.body as FormData;

    expect(init.method).toBe("POST");
    expect(headers.Accept).toBe("application/json");
    expect(headers["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
    expect(headers["Content-Type"]).toBeUndefined();
    expect(formData).toBeInstanceOf(FormData);
    expect(Array.from(formData.keys())).toEqual(["file"]);
    expect(formData.get("file")).toBe(file);
  });

  it("returns invalid_payload on an invalid 201 payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(201, {
        closingFolderId: CLOSING_FOLDER_ID,
        version: 3
      })
    );

    const result = await uploadBalanceImport(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      new File(["csv"], "balance.csv"),
      fetchMock
    );

    expect(result).toEqual({ kind: "invalid_payload" });
  });

  it("returns a structured bad_request on a valid 400 payload and preserves backend order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        message: "CSV validation failed",
        errors: [
          {
            line: 2,
            field: "accountCode",
            message: "duplicate account"
          },
          {
            line: null,
            field: null,
            message: "total debit and credit mismatch"
          }
        ]
      })
    );

    const result = await uploadBalanceImport(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      new File(["csv"], "balance.csv"),
      fetchMock
    );

    expect(result).toEqual({
      kind: "bad_request",
      error: {
        message: "CSV validation failed",
        errors: [
          {
            line: 2,
            field: "accountCode",
            message: "duplicate account"
          },
          {
            line: null,
            field: null,
            message: "total debit and credit mismatch"
          }
        ]
      }
    });
  });

  it("returns unexpected on an unusable 400 payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        errors: []
      })
    );

    const result = await uploadBalanceImport(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      new File(["csv"], "balance.csv"),
      fetchMock
    );

    expect(result).toEqual({ kind: "unexpected" });
  });

  it.each([
    { status: 401, expected: { kind: "auth_required" } },
    { status: 403, expected: { kind: "forbidden" } },
    { status: 404, expected: { kind: "not_found" } },
    { status: 409, expected: { kind: "conflict_archived" } },
    { status: 500, expected: { kind: "server_error" } },
    { status: 418, expected: { kind: "unexpected" } }
  ])("maps HTTP $status to the expected upload state", async ({ status, expected }) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    const result = await uploadBalanceImport(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      new File(["csv"], "balance.csv"),
      fetchMock
    );

    expect(result).toEqual(expected);
  });

  it("returns network_error on a network failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network"));

    const result = await uploadBalanceImport(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      new File(["csv"], "balance.csv"),
      fetchMock
    );

    expect(result).toEqual({ kind: "network_error" });
  });

  it("returns timeout on a timeout failure", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("timeout"));

    const result = await uploadBalanceImport(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      new File(["csv"], "balance.csv"),
      fetchMock
    );

    expect(result).toEqual({ kind: "timeout" });
  });
});
