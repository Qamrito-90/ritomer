package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.identity.domain.ActorProfile
import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.CurrentActor
import ch.qamwaq.ritomer.identity.domain.TenantMembership
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import java.util.UUID
import org.springframework.stereotype.Service

@Service
class CurrentActorService(
  private val actorResolutionSupport: ActorResolutionSupport,
  private val tenantContextProvider: TenantContextProvider,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider
) {
  fun currentActor(): CurrentActor {
    val requestedTenantId = tenantContextProvider.currentTenantContext().optionalTenantId()
    val actorContext = actorResolutionSupport.resolveActorContext()
    val appUser = actorContext.appUser
    val memberships = actorContext.memberships

    val activeTenant = actorResolutionSupport.resolveActiveTenant(memberships, requestedTenantId)
    auditTenantSelectionIfExplicitAndValid(appUser, requestedTenantId, activeTenant)

    return CurrentActor(
      actor = ActorProfile(
        userId = appUser.id,
        externalSubject = appUser.externalSubject,
        email = appUser.email,
        displayName = appUser.displayName
      ),
      memberships = memberships,
      activeTenant = activeTenant,
      effectiveRoles = activeTenant?.roles.orEmpty()
    )
  }

  private fun auditTenantSelectionIfExplicitAndValid(
    appUser: AppUser,
    requestedTenantId: UUID?,
    activeTenant: TenantMembership?
  ) {
    if (requestedTenantId == null || activeTenant == null) {
      return
    }

    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = activeTenant.tenantId,
        actorUserId = appUser.id,
        actorSubject = appUser.externalSubject,
        actorRoles = activeTenant.roles.map { it.name }.toSet(),
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = IDENTITY_ACTIVE_TENANT_SELECTED_ACTION,
        resourceType = TENANT_AUDIT_RESOURCE_TYPE,
        resourceId = activeTenant.tenantId.toString(),
        metadata = mapOf("selection_source" to ACTIVE_TENANT_HEADER)
      )
    )
  }
}
