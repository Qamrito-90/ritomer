import { z } from "zod";
import type { ClosingFolderSummary } from "./closing-folders";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const manualMappingTargetSchema = z.object({
  code: z.string().min(1),
  label: z.string().min(1),
  selectable: z.boolean()
});

const manualMappingLineSchema = z.object({
  accountCode: z.string().min(1),
  accountLabel: z.string().min(1),
  debit: z.string().min(1),
  credit: z.string().min(1)
});

const manualMappingEntrySchema = z.object({
  accountCode: z.string().min(1),
  targetCode: z.string().min(1)
});

const manualMappingSummarySchema = z.object({
  total: z.number().int().nonnegative(),
  mapped: z.number().int().nonnegative(),
  unmapped: z.number().int().nonnegative()
});

const manualMappingProjectionSchema = z.object({
  closingFolderId: z.string().uuid(),
  latestImportVersion: z.number().int().positive().nullable(),
  targets: z.array(manualMappingTargetSchema),
  lines: z.array(manualMappingLineSchema),
  mappings: z.array(manualMappingEntrySchema),
  summary: manualMappingSummarySchema
});

export type ManualMappingTarget = z.infer<typeof manualMappingTargetSchema>;
export type ManualMappingLine = z.infer<typeof manualMappingLineSchema>;
export type ManualMappingEntry = z.infer<typeof manualMappingEntrySchema>;
export type ManualMappingSummary = z.infer<typeof manualMappingSummarySchema>;
export type ManualMappingProjection = z.infer<typeof manualMappingProjectionSchema>;

export type ManualMappingShellState =
  | { kind: "loading" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" }
  | { kind: "ready"; projection: ManualMappingProjection };

export type UpsertManualMappingState =
  | { kind: "success"; mapping: ManualMappingEntry }
  | { kind: "bad_request_account_absent" }
  | { kind: "bad_request_target_invalid" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_import_required" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

export type DeleteManualMappingState =
  | { kind: "success" }
  | { kind: "bad_request_account_absent" }
  | { kind: "bad_request_target_invalid" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_import_required" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "timeout" }
  | { kind: "network_error" }
  | { kind: "unexpected" };

export async function loadManualMappingShellState(
  closingFolderId: string,
  closingFolder: ClosingFolderSummary,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<ManualMappingShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/mappings/manual`,
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

    const parsed = manualMappingProjectionSchema.safeParse(payload);

    if (!parsed.success || !isManualMappingProjectionCoherent(parsed.data, closingFolderId, closingFolder)) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      projection: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

export async function upsertManualMapping(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  mapping: ManualMappingEntry,
  fetcher: Fetcher = fetch
): Promise<UpsertManualMappingState> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/mappings/manual`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Tenant-Id": activeTenant.tenantId
        },
        body: JSON.stringify({
          accountCode: mapping.accountCode,
          targetCode: mapping.targetCode
        })
      },
      fetcher
    );

    if (response.status === 200 || response.status === 201) {
      const payload = await readJsonBody(response);

      if (payload === undefined) {
        return { kind: "invalid_payload" };
      }

      const parsed = manualMappingEntrySchema.safeParse(payload);

      if (!parsed.success) {
        return { kind: "invalid_payload" };
      }

      return {
        kind: "success",
        mapping: parsed.data
      };
    }

    if (response.status === 400) {
      return refineBadRequestForUpsert(await readErrorMessage(response));
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
      return refineConflictForUpsert(await readErrorMessage(response));
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

export async function deleteManualMapping(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  accountCode: string,
  fetcher: Fetcher = fetch
): Promise<DeleteManualMappingState> {
  try {
    const path = `/api/closing-folders/${encodeURIComponent(closingFolderId)}/mappings/manual?accountCode=${encodeURIComponent(accountCode)}`;
    const response = await requestJson(
      path,
      {
        method: "DELETE",
        headers: {
          "X-Tenant-Id": activeTenant.tenantId
        }
      },
      fetcher
    );

    if (response.status === 204) {
      return { kind: "success" };
    }

    if (response.status === 400) {
      return refineBadRequestForDelete(await readErrorMessage(response));
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
      return refineConflictForDelete(await readErrorMessage(response));
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

function isManualMappingProjectionCoherent(
  projection: ManualMappingProjection,
  closingFolderId: string,
  closingFolder: ClosingFolderSummary
) {
  if (
    projection.closingFolderId !== closingFolderId ||
    projection.closingFolderId !== closingFolder.id
  ) {
    return false;
  }

  if (projection.summary.total !== projection.lines.length) {
    return false;
  }

  if (projection.summary.mapped !== projection.mappings.length) {
    return false;
  }

  if (projection.summary.unmapped !== projection.summary.total - projection.summary.mapped) {
    return false;
  }

  const lineAccountCodes = new Set(projection.lines.map((line) => line.accountCode));
  const targetCodes = new Set(projection.targets.map((target) => target.code));

  if (projection.mappings.some((mapping) => !lineAccountCodes.has(mapping.accountCode))) {
    return false;
  }

  if (projection.mappings.some((mapping) => !targetCodes.has(mapping.targetCode))) {
    return false;
  }

  if (projection.latestImportVersion === null) {
    return (
      projection.lines.length === 0 &&
      projection.mappings.length === 0 &&
      projection.summary.total === 0 &&
      projection.summary.mapped === 0 &&
      projection.summary.unmapped === 0
    );
  }

  if (projection.summary.total > 0 && !projection.targets.some((target) => target.selectable)) {
    return false;
  }

  return true;
}

function refineBadRequestForUpsert(message: string | undefined): UpsertManualMappingState {
  if (message === "accountCode is not present in the latest import.") {
    return { kind: "bad_request_account_absent" };
  }

  if (message === "targetCode is unknown." || message === "targetCode is not selectable.") {
    return { kind: "bad_request_target_invalid" };
  }

  return { kind: "bad_request" };
}

function refineBadRequestForDelete(message: string | undefined): DeleteManualMappingState {
  if (message === "accountCode is not present in the latest import.") {
    return { kind: "bad_request_account_absent" };
  }

  if (message === "targetCode is unknown." || message === "targetCode is not selectable.") {
    return { kind: "bad_request_target_invalid" };
  }

  return { kind: "bad_request" };
}

function refineConflictForUpsert(message: string | undefined): UpsertManualMappingState {
  if (message === "Closing folder is archived and manual mappings cannot be modified.") {
    return { kind: "conflict_archived" };
  }

  if (message === "No balance import is available for manual mapping.") {
    return { kind: "conflict_import_required" };
  }

  return { kind: "conflict_other" };
}

function refineConflictForDelete(message: string | undefined): DeleteManualMappingState {
  if (message === "Closing folder is archived and manual mappings cannot be modified.") {
    return { kind: "conflict_archived" };
  }

  if (message === "No balance import is available for manual mapping.") {
    return { kind: "conflict_import_required" };
  }

  return { kind: "conflict_other" };
}

async function readJsonBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function readErrorMessage(response: Response) {
  const payload = await readJsonBody(response);
  const parsed = z.object({ message: z.string().min(1) }).safeParse(payload);
  return parsed.success ? parsed.data.message : undefined;
}
