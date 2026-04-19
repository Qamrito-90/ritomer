import { z } from "zod";
import type { ClosingFolderSummary } from "./closing-folders";
import { requestJson, type Fetcher } from "./http";
import type { ActiveTenant } from "./me";

const controlStatusSchema = z.enum(["PASS", "FAIL", "NOT_APPLICABLE"]);

const controlResultSchema = z.object({
  status: controlStatusSchema,
  message: z.string().min(1)
});

const controlsResponseSchema = z.object({
  closingFolderId: z.string().uuid(),
  readiness: z.enum(["READY", "BLOCKED"]),
  latestImportPresent: z.boolean(),
  latestImportVersion: z.number().int().positive().nullable(),
  mappingSummary: z.object({
    total: z.number().int().nonnegative(),
    mapped: z.number().int().nonnegative(),
    unmapped: z.number().int().nonnegative()
  }),
  controls: z.tuple([
    controlResultSchema.extend({
      code: z.literal("LATEST_VALID_BALANCE_IMPORT_PRESENT")
    }),
    controlResultSchema.extend({
      code: z.literal("MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT")
    })
  ]),
  nextAction: z
    .object({
      code: z.enum(["IMPORT_BALANCE", "COMPLETE_MANUAL_MAPPING"]),
      path: z.string().min(1),
      actionable: z.boolean()
    })
    .nullable(),
  unmappedAccounts: z.array(
    z.object({
      accountCode: z.string().min(1),
      accountLabel: z.string().min(1),
      debit: z.string().min(1),
      credit: z.string().min(1)
    })
  )
});

export type ClosingControlsSummary = z.infer<typeof controlsResponseSchema>;
export type ClosingControlsReadiness = ClosingControlsSummary["readiness"];
export type ControlStatus = ClosingControlsSummary["controls"][number]["status"];

export type ControlsShellState =
  | { kind: "loading" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" }
  | { kind: "ready"; controls: ClosingControlsSummary };

export async function loadControlsShellState(
  closingFolderId: string,
  closingFolder: ClosingFolderSummary,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<Exclude<ControlsShellState, { kind: "loading" }>> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}/controls`,
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

    const payload = await response.json();
    const parsed = controlsResponseSchema.safeParse(payload);

    if (!parsed.success || !isControlsPayloadCoherent(parsed.data, closingFolderId, closingFolder)) {
      return { kind: "invalid_payload" };
    }

    return {
      kind: "ready",
      controls: parsed.data
    };
  } catch (error) {
    if (error instanceof Error && error.message === "timeout") {
      return { kind: "timeout" };
    }

    return { kind: "network_error" };
  }
}

function isControlsPayloadCoherent(
  controls: ClosingControlsSummary,
  closingFolderId: string,
  closingFolder: ClosingFolderSummary
) {
  if (
    controls.closingFolderId !== closingFolderId ||
    controls.closingFolderId !== closingFolder.id
  ) {
    return false;
  }

  if (controls.readiness === "READY") {
    return (
      controls.latestImportPresent &&
      controls.latestImportVersion !== null &&
      controls.mappingSummary.unmapped === 0 &&
      controls.unmappedAccounts.length === 0 &&
      controls.controls[0].status === "PASS" &&
      controls.controls[1].status === "PASS" &&
      controls.nextAction === null
    );
  }

  return !(
    controls.controls[0].status === "PASS" && controls.controls[1].status === "PASS"
  );
}
