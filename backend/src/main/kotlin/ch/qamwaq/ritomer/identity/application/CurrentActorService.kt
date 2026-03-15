package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.identity.domain.ActorProfile
import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.CurrentActor
import ch.qamwaq.ritomer.identity.domain.TenantMembership
import ch.qamwaq.ritomer.identity.domain.TenantMembershipGrant
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
  private val tenantContextProvider: TenantContextProvider
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

    val requestedTenantId = tenantContextProvider.currentTenantContext().tenantId
    val activeTenant = resolveActiveTenant(memberships, requestedTenantId)

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
    val normalizedRequestedTenantId = requestedTenantId.normalized()

    return when {
      normalizedRequestedTenantId != null ->
        memberships.firstOrNull { it.tenantId.toString() == normalizedRequestedTenantId }
          ?: throw AccessDeniedException("Requested tenant is not accessible.")
      memberships.size == 1 -> memberships.single()
      else -> null
    }
  }
}

private fun String?.normalized(): String? = this?.trim()?.takeUnless { it.isEmpty() }
