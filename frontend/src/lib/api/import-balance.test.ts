import { describe, expect, it, vi } from "vitest";
import {
  loadBalanceImportDiffPreviousShellState,
  loadBalanceImportVersionsShellState,
  uploadBalanceImport
} from "./import-balance";

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

describe("loadBalanceImportVersionsShellState", () => {
  it("loads GET /imports/balance/versions with X-Tenant-Id and validates the consumed payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, [
        {
          closingFolderId: CLOSING_FOLDER_ID,
          version: 4,
          importedAt: "2026-05-14T10:30:00Z",
          rowCount: 12,
          totalDebit: "1200.00",
          totalCredit: "1200.00"
        }
      ])
    );

    const result = await loadBalanceImportVersionsShellState(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      fetchMock
    );

    expect(result).toEqual({
      kind: "ready",
      versions: [
        {
          closingFolderId: CLOSING_FOLDER_ID,
          version: 4,
          importedAt: "2026-05-14T10:30:00Z",
          rowCount: 12,
          totalDebit: "1200.00",
          totalCredit: "1200.00"
        }
      ]
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/imports/balance/versions`
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe("GET");
    expect(headers.Accept).toBe("application/json");
    expect(headers["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
  });

  it.each([
    {
      label: "non array root",
      payload: {}
    },
    {
      label: "foreign closingFolderId",
      payload: [
        {
          closingFolderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          version: 1,
          importedAt: "2026-05-14T10:30:00Z",
          rowCount: 1,
          totalDebit: "1",
          totalCredit: "1"
        }
      ]
    },
    {
      label: "invalid importedAt",
      payload: [
        {
          closingFolderId: CLOSING_FOLDER_ID,
          version: 1,
          importedAt: "not-a-date",
          rowCount: 1,
          totalDebit: "1",
          totalCredit: "1"
        }
      ]
    },
    {
      label: "missing totalCredit",
      payload: [
        {
          closingFolderId: CLOSING_FOLDER_ID,
          version: 1,
          importedAt: "2026-05-14T10:30:00Z",
          rowCount: 1,
          totalDebit: "1"
        }
      ]
    }
  ])("returns invalid_payload on versions $label", async ({ payload }) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, payload));

    const result = await loadBalanceImportVersionsShellState(
      CLOSING_FOLDER_ID,
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
    { status: 418, expected: { kind: "unexpected" } }
  ])("maps versions HTTP $status to the expected state", async ({ status, expected }) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    const result = await loadBalanceImportVersionsShellState(
      CLOSING_FOLDER_ID,
      ACTIVE_TENANT,
      fetchMock
    );

    expect(result).toEqual(expected);
  });
});

describe("loadBalanceImportDiffPreviousShellState", () => {
  it("loads GET /imports/balance/versions/{version}/diff-previous with X-Tenant-Id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        version: 4,
        previousVersion: 3,
        added: [
          {
            accountCode: "3000",
            accountLabel: "Sales",
            debit: "0",
            credit: "300"
          }
        ],
        removed: [],
        changed: [
          {
            accountCode: "1000",
            before: {
              accountCode: "1000",
              accountLabel: "Cash",
              debit: "100",
              credit: "0"
            },
            after: {
              accountCode: "1000",
              accountLabel: "Cash",
              debit: "125",
              credit: "0"
            }
          }
        ]
      })
    );

    const result = await loadBalanceImportDiffPreviousShellState(
      CLOSING_FOLDER_ID,
      4,
      ACTIVE_TENANT,
      fetchMock
    );

    expect(result).toEqual({
      kind: "ready",
      diff: {
        version: 4,
        previousVersion: 3,
        added: [
          {
            accountCode: "3000",
            accountLabel: "Sales",
            debit: "0",
            credit: "300"
          }
        ],
        removed: [],
        changed: [
          {
            accountCode: "1000",
            before: {
              accountCode: "1000",
              accountLabel: "Cash",
              debit: "100",
              credit: "0"
            },
            after: {
              accountCode: "1000",
              accountLabel: "Cash",
              debit: "125",
              credit: "0"
            }
          }
        ]
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/api/closing-folders/${CLOSING_FOLDER_ID}/imports/balance/versions/4/diff-previous`
    );

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const headers = init.headers as Record<string, string>;

    expect(init.method).toBe("GET");
    expect(headers.Accept).toBe("application/json");
    expect(headers["X-Tenant-Id"]).toBe(ACTIVE_TENANT.tenantId);
  });

  it.each([
    {
      label: "missing previousVersion",
      payload: {
        version: 4,
        added: [],
        removed: [],
        changed: []
      }
    },
    {
      label: "requested version mismatch",
      payload: {
        version: 3,
        previousVersion: 2,
        added: [],
        removed: [],
        changed: []
      }
    },
    {
      label: "missing arrays",
      payload: {
        version: 4,
        previousVersion: 3
      }
    },
    {
      label: "changed account mismatch",
      payload: {
        version: 4,
        previousVersion: 3,
        added: [],
        removed: [],
        changed: [
          {
            accountCode: "1000",
            before: {
              accountCode: "2000",
              accountLabel: "Cash",
              debit: "100",
              credit: "0"
            },
            after: {
              accountCode: "1000",
              accountLabel: "Cash",
              debit: "125",
              credit: "0"
            }
          }
        ]
      }
    }
  ])("returns invalid_payload on diff $label", async ({ payload }) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, payload));

    const result = await loadBalanceImportDiffPreviousShellState(
      CLOSING_FOLDER_ID,
      4,
      ACTIVE_TENANT,
      fetchMock
    );

    expect(result).toEqual({ kind: "invalid_payload" });
  });

  it("accepts previousVersion null for the first valid version", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        version: 1,
        previousVersion: null,
        added: [],
        removed: [],
        changed: []
      })
    );

    const result = await loadBalanceImportDiffPreviousShellState(
      CLOSING_FOLDER_ID,
      1,
      ACTIVE_TENANT,
      fetchMock
    );

    expect(result).toEqual({
      kind: "ready",
      diff: {
        version: 1,
        previousVersion: null,
        added: [],
        removed: [],
        changed: []
      }
    });
  });

  it.each([
    { status: 401, expected: { kind: "auth_required" } },
    { status: 403, expected: { kind: "forbidden" } },
    { status: 404, expected: { kind: "not_found" } },
    { status: 500, expected: { kind: "server_error" } },
    { status: 418, expected: { kind: "unexpected" } }
  ])("maps diff HTTP $status to the expected state", async ({ status, expected }) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, {}));

    const result = await loadBalanceImportDiffPreviousShellState(
      CLOSING_FOLDER_ID,
      4,
      ACTIVE_TENANT,
      fetchMock
    );

    expect(result).toEqual(expected);
  });
});
