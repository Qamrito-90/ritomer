import { z } from "zod";
import type { ActiveTenant } from "./me";
import { requestJson, type Fetcher } from "./http";

const createdBalanceImportSchema = z.object({
  closingFolderId: z.string().uuid(),
  version: z.number().int().positive(),
  rowCount: z.number().int().positive()
});

const isoDateTimeStringSchema = z.string().refine((value) => !Number.isNaN(new Date(value).getTime()));

const balanceImportVersionSchema = z.object({
  closingFolderId: z.string().uuid(),
  version: z.number().int().positive(),
  importedAt: isoDateTimeStringSchema,
  rowCount: z.number().int().positive(),
  totalDebit: z.string(),
  totalCredit: z.string()
});

const balanceImportDiffLineSchema = z.object({
  accountCode: z.string(),
  accountLabel: z.string(),
  debit: z.string(),
  credit: z.string()
});

const balanceImportDiffSchema = z.object({
  version: z.number().int().positive(),
  previousVersion: z.number().int().positive().nullable(),
  added: z.array(balanceImportDiffLineSchema),
  removed: z.array(balanceImportDiffLineSchema),
  changed: z.array(
    z.object({
      accountCode: z.string(),
      before: balanceImportDiffLineSchema,
      after: balanceImportDiffLineSchema
    })
  )
});

const balanceImportValidationErrorSchema = z
  .object({
    line: z.number().int().positive().nullable().optional(),
    field: z.string().nullable().optional(),
    message: z.string().min(1)
  })
  .transform((value) => ({
    line: value.line ?? null,
    field: value.field ?? null,
    message: value.message
  }));

const balanceImportBadRequestSchema = z.object({
  message: z.string().min(1),
  errors: z.array(balanceImportValidationErrorSchema)
});

export type CreatedBalanceImportSummary = z.infer<typeof createdBalanceImportSchema>;
export type BalanceImportVersionSummary = z.infer<typeof balanceImportVersionSchema>;
export type BalanceImportDiffLine = z.infer<typeof balanceImportDiffLineSchema>;
export type BalanceImportDiff = z.infer<typeof balanceImportDiffSchema>;
export type BalanceImportValidationError = z.infer<typeof balanceImportValidationErrorSchema>;
export type BalanceImportBadRequest = z.infer<typeof balanceImportBadRequestSchema>;

export type UploadBalanceImportState =
  | { kind: "created"; balanceImport: CreatedBalanceImportSummary }
  | { kind: "bad_request"; error: BalanceImportBadRequest }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export type BalanceImportVersionsState =
  | { kind: "ready"; versions: BalanceImportVersionSummary[] }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export type BalanceImportDiffState =
  | { kind: "ready"; diff: BalanceImportDiff }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export async function uploadBalanceImport(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  file: File,
  fetcher: Fetcher = fetch
): Promise<UploadBalanceImportState> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/imports/balance`,
      {
        method: "POST",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        },
        body: formData
      },
      fetcher
    );

    if (response.status === 201) {
      const payload = await readJsonBody(response);

      if (payload === undefined) {
        return { kind: "invalid_payload" };
      }

      const parsed = createdBalanceImportSchema.safeParse(payload);

      if (!parsed.success) {
        return { kind: "invalid_payload" };
      }

      return {
        kind: "created",
        balanceImport: parsed.data
      };
    }

    if (response.status === 400) {
      const payload = await readJsonBody(response);

      if (payload === undefined) {
        return { kind: "unexpected" };
      }

      const parsed = balanceImportBadRequestSchema.safeParse(payload);

      if (!parsed.success) {
        return { kind: "unexpected" };
      }

      return {
        kind: "bad_request",
        error: parsed.data
      };
    }

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status === 409) {
      return { kind: "conflict_archived" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    return { kind: "unexpected" };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

export async function loadBalanceImportVersionsShellState(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<BalanceImportVersionsState> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/imports/balance/versions`,
      {
        method: "GET",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    if (response.status !== 200) {
      return { kind: "unexpected" };
    }

    const payload = await readJsonBody(response);

    if (payload === undefined) {
      return { kind: "invalid_payload" };
    }

    const parsed = z.array(balanceImportVersionSchema).safeParse(payload);

    if (!parsed.success || parsed.data.some((version) => version.closingFolderId !== closingFolderId)) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      versions: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

export async function loadBalanceImportDiffPreviousShellState(
  closingFolderId: string,
  version: number,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<BalanceImportDiffState> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/imports/balance/versions/${encodeURIComponent(String(version))}/diff-previous`,
      {
        method: "GET",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status === 403) {
      return { kind: "forbidden" };
    }

    if (response.status === 404) {
      return { kind: "not_found" };
    }

    if (response.status >= 500 && response.status <= 599) {
      return { kind: "server_error" };
    }

    if (response.status !== 200) {
      return { kind: "unexpected" };
    }

    const payload = await readJsonBody(response);

    if (payload === undefined) {
      return { kind: "invalid_payload" };
    }

    const parsed = balanceImportDiffSchema.safeParse(payload);

    if (!parsed.success || !isBalanceImportDiffCoherent(parsed.data, version)) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      diff: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

function isBalanceImportDiffCoherent(diff: BalanceImportDiff, requestedVersion: number) {
  if (diff.version !== requestedVersion) {
    return false;
  }

  return diff.changed.every(
    (line) =>
      line.before.accountCode === line.accountCode &&
      line.after.accountCode === line.accountCode
  );
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
