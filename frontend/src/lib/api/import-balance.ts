import { z } from "zod";
import type { ActiveTenant } from "./me";
import { requestJson, type Fetcher } from "./http";

const createdBalanceImportSchema = z.object({
  closingFolderId: z.string().uuid(),
  version: z.number().int().positive(),
  rowCount: z.number().int().positive()
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

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
