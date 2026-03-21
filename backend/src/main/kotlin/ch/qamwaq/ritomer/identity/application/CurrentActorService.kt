package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.identity.domain.ActorProfile
import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.CurrentActor
import ch.qamwaq.ritomer.identity.domain.TenantMembership
import ch.qamwaq.ritomer.identity.domain.TenantMembershipGrant
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Service

@Service
class CurrentActorService(
  private val appUserRepository: AppUserRepository,
  private val tenantMembershipRepository: TenantMembershipRepository,
  private val tenantContextProvider: TenantContextProvider,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider
) {
  fun currentActor(): CurrentActor {
    val jwt = currentJwt()
    val subject = jwt.subject?.trim()?.takeUnless { it.isEmpty() }
      ?: throw AccessDeniedException("JWT subject claim is required.")
    val email = jwt.getClaimAsString("email").normalized()
    val displayName = resolveDisplayName(jwt)

    val appUser = synchronizeAppUser(subject, email, displayName)
    val memberships = groupMemberships(tenantMembershipRepository.findActiveMembershipGrants(appUser.id))
    if (memberships.isEmpty()) {
      throw AccessDeniedException("At least one active tenant membership is required.")
    }

    val requestedTenantId = tenantContextProvider.currentTenantContext().tenantId.normalized()
    val activeTenant = resolveActiveTenant(memberships, requestedTenantId)
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

  private fun currentJwt(): Jwt {
    val authentication = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
      ?: throw AccessDeniedException("JWT authentication is required.")

    return authentication.token
  }

  private fun synchronizeAppUser(subject: String, email: String?, displayName: String?): AppUser {
    val existing = appUserRepository.findByExternalSubject(subject)
    if (existing == null) {
      return appUserRepository.create(subject, email, displayName)
    }

    if (!existing.isActive()) {
      throw AccessDeniedException("Application user is not active.")
    }

    val resolvedEmail = email ?: existing.email
    val resolvedDisplayName = displayName ?: existing.displayName
    if (resolvedEmail == existing.email && resolvedDisplayName == existing.displayName) {
      return existing
    }

    return appUserRepository.updateProfile(existing.id, resolvedEmail, resolvedDisplayName)
  }

  private fun resolveDisplayName(jwt: Jwt): String? =
    jwt.getClaimAsString("name").normalized() ?: jwt.getClaimAsString("preferred_username").normalized()

  private fun groupMemberships(grants: List<TenantMembershipGrant>): List<TenantMembership> =
    grants.groupBy { it.tenantId }
      .values
      .map { tenantGrants ->
        val first = tenantGrants.first()
        TenantMembership(
          tenantId = first.tenantId,
          tenantSlug = first.tenantSlug,
          tenantName = first.tenantName,
          roles = tenantGrants.map { it.role }.toSortedSet()
        )
      }
      .sortedBy { it.tenantSlug }

  private fun resolveActiveTenant(
    memberships: List<TenantMembership>,
    requestedTenantId: String?
  ): TenantMembership? {
    return when {
      requestedTenantId != null ->
        memberships.firstOrNull { it.tenantId.toString() == requestedTenantId }
          ?: throw AccessDeniedException("Requested tenant is not accessible.")
      memberships.size == 1 -> memberships.single()
      else -> null
    }
  }

  private fun auditTenantSelectionIfExplicitAndValid(
    appUser: AppUser,
    requestedTenantId: String?,
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

private fun String?.normalized(): String? = this?.trim()?.takeUnless { it.isEmpty() }
