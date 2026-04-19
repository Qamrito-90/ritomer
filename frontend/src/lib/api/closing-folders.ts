import { z } from "zod";
import type { ActiveTenant } from "./me";
import { requestJson, type Fetcher } from "./http";

const isoLocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTimeSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)));

const closingFolderSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  name: z.string().min(1),
  periodStartOn: z.string().min(1),
  periodEndOn: z.string().min(1),
  externalRef: z.string().nullable(),
  status: z.string().min(1)
});

const closingFolderListItemSchema = z
  .object({
    id: z.string().min(1),
    tenantId: z.string().min(1),
    name: z.string().min(1),
    periodStartOn: isoLocalDateSchema,
    periodEndOn: isoLocalDateSchema,
    externalRef: z.union([z.string(), z.null()]).optional(),
    status: z.string().min(1),
    archivedAt: z.union([isoDateTimeSchema, z.null()]).optional()
  })
  .transform((value) => ({
    ...value,
    externalRef: value.externalRef ?? null,
    archivedAt: value.archivedAt ?? null
  }));

export type ClosingFolderSummary = z.infer<typeof closingFolderSchema>;
export type ClosingFolderListItem = z.infer<typeof closingFolderListItemSchema>;

export type ClosingFolderShellState =
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "unavailable" }
  | { kind: "tenant_mismatch" }
  | { kind: "ready"; closingFolder: ClosingFolderSummary };

export type ClosingFoldersListState =
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "unavailable" }
  | { kind: "ready"; closingFolders: ClosingFolderListItem[] };

export async function loadClosingFoldersListState(
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<ClosingFoldersListState> {
  try {
    const response = await requestJson(
      "/api/closing-folders",
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

    if (response.status !== 200) {
      return { kind: "unavailable" };
    }

    const payload = await response.json();
    const parsed = z.array(closingFolderListItemSchema).safeParse(payload);

    if (!parsed.success) {
      return { kind: "unavailable" };
    }

    return {
      kind: "ready",
      closingFolders: parsed.data
    };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function loadClosingFolderShellState(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  fetcher: Fetcher = fetch
): Promise<ClosingFolderShellState> {
  try {
    const response = await requestJson(
      `/api/closing-folders/${encodeURIComponent(closingFolderId)}`,
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

    if (response.status !== 200) {
      return { kind: "unavailable" };
    }

    const payload = await response.json();
    const parsed = closingFolderSchema.safeParse(payload);

    if (!parsed.success) {
      return { kind: "unavailable" };
    }

    if (parsed.data.tenantId !== activeTenant.tenantId) {
      return { kind: "tenant_mismatch" };
    }

    return {
      kind: "ready",
      closingFolder: parsed.data
    };
  } catch {
    return { kind: "unavailable" };
  }
}
