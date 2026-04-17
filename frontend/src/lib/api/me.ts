import { z } from "zod";
import { requestJson, type Fetcher } from "./http";

const activeTenantSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  tenantName: z.string().min(1)
});

const meResponseSchema = z.object({
  activeTenant: activeTenantSchema.nullable()
});

export type ActiveTenant = z.infer<typeof activeTenantSchema>;

export type MeShellState =
  | { kind: "auth_required" }
  | { kind: "tenant_context_required" }
  | { kind: "profile_unavailable" }
  | { kind: "ready"; activeTenant: ActiveTenant };

export async function loadMeShellState(fetcher: Fetcher = fetch): Promise<MeShellState> {
  try {
    const response = await requestJson("/api/me", { method: "GET" }, fetcher);

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status !== 200) {
      return { kind: "profile_unavailable" };
    }

    const payload = await response.json();
    const parsed = meResponseSchema.safeParse(payload);

    if (!parsed.success) {
      return { kind: "profile_unavailable" };
    }

    if (parsed.data.activeTenant === null) {
      return { kind: "tenant_context_required" };
    }

    return {
      kind: "ready",
      activeTenant: parsed.data.activeTenant
    };
  } catch {
    return { kind: "profile_unavailable" };
  }
}
