import { z } from "zod";
import { requestJson, type Fetcher } from "./http";

const activeTenantSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  tenantName: z.string().min(1)
});

const meResponseSchema = z.object({
  activeTenant: activeTenantSchema.nullable(),
  effectiveRoles: z.unknown().optional(),
  actor: z.object({ displayName: z.string().min(1).max(200).nullable().optional() }).optional()
});

export type ActiveTenant = z.infer<typeof activeTenantSchema>;
export type EffectiveRolesHint = string[] | null;
export type MeFailureReason = "network_error" | "timeout" | "server_error" | "invalid_response" | "not_found" | "forbidden" | "access_revoked";

export type MeShellState =
  | { kind: "auth_required" }
  | { kind: "tenant_context_required" }
  | { kind: "profile_unavailable"; reason?: MeFailureReason }
  | { kind: "ready"; activeTenant: ActiveTenant; effectiveRoles: EffectiveRolesHint; displayName?: string };

export async function loadMeShellState(
  fetcher: Fetcher = fetch,
  requester: typeof requestJson = requestJson
): Promise<MeShellState> {
  try {
    const response = await requester("/api/me", { method: "GET" }, fetcher);

    if (response.status === 401) {
      return { kind: "auth_required" };
    }

    if (response.status !== 200) {
      let code: unknown;
      if (response.status === 403) {
        try { code = (await response.json() as { code?: unknown }).code; } catch { /* Status remains authoritative. */ }
      }
      return { kind: "profile_unavailable", reason: response.status === 403
        ? code === "ACCESS_REVOKED" ? "access_revoked" : "forbidden"
        : response.status === 404 ? "not_found" : "server_error" };
    }

    let payload: unknown;
    try { payload = await response.json(); } catch { return { kind: "profile_unavailable", reason: "invalid_response" }; }
    const parsed = meResponseSchema.safeParse(payload);

    if (!parsed.success) {
      return { kind: "profile_unavailable", reason: "invalid_response" };
    }

    if (parsed.data.activeTenant === null) {
      return { kind: "tenant_context_required" };
    }

    return {
      kind: "ready",
      activeTenant: parsed.data.activeTenant,
      effectiveRoles: parseEffectiveRolesHint(parsed.data.effectiveRoles),
      ...(parsed.data.actor?.displayName ? { displayName: parsed.data.actor.displayName } : {})
    };
  } catch (error) {
    return { kind: "profile_unavailable", reason: error instanceof Error && error.message === "timeout" ? "timeout" : "network_error" };
  }
}

function parseEffectiveRolesHint(value: unknown): EffectiveRolesHint {
  if (value === undefined) {
    return null;
  }

  const parsed = z.array(z.string().min(1)).safeParse(value);
  return parsed.success ? parsed.data : null;
}
