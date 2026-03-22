package ch.qamwaq.ritomer.identity.access

import ch.qamwaq.ritomer.identity.application.ActorResolutionSupport
import java.util.UUID
import org.springframework.stereotype.Service

data class TenantAccessContext(
  val actorUserId: UUID,
  val actorSubject: String,
  val tenantId: UUID,
  val effectiveRoles: Set<String>
)

fun interface TenantAccessResolver {
  fun resolveRequiredTenantAccess(tenantId: UUID): TenantAccessContext
}

@Service
class CurrentTenantAccessResolver(
  private val actorResolutionSupport: ActorResolutionSupport
) : TenantAccessResolver {
  override fun resolveRequiredTenantAccess(tenantId: UUID): TenantAccessContext {
    val actorContext = actorResolutionSupport.resolveActorContext()
    val activeTenant = actorResolutionSupport.resolveActiveTenant(actorContext.memberships, tenantId.toString())
      ?: error("Explicit tenant resolution must not return null.")

    return TenantAccessContext(
      actorUserId = actorContext.appUser.id,
      actorSubject = actorContext.appUser.externalSubject,
      tenantId = activeTenant.tenantId,
      effectiveRoles = activeTenant.roles.map { it.name }.toSortedSet()
    )
  }
}
