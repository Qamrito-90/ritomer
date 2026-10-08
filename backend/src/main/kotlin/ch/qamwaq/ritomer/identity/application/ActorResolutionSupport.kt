package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.identity.domain.AppUser
import ch.qamwaq.ritomer.identity.domain.TenantMembership
import ch.qamwaq.ritomer.identity.domain.TenantMembershipGrant
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshness
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshnessVerifier
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.ResponseStatus

@Service
class ActorResolutionSupport(
  private val appUserRepository: AppUserRepository,
  private val tenantMembershipRepository: TenantMembershipRepository,
  private val currentAuthenticatedActorProvider: CurrentAuthenticatedActorProvider,
  private val tenantContextProvider: TenantContextProvider,
  private val oidcIdentityRepository: OidcIdentityRepository? = null
) : ActorAuthorityFreshnessVerifier {
  fun resolveActorContext(): ResolvedActorContext {
    val actor = currentAuthenticatedActorProvider.current()
    if (!oidcBindingIsCurrent(actor)) throw ActorAccessRevokedException()
    val authority = readFreshAuthority(actor.actorId)
    val appUser = authority.appUser
    if (appUser == null || !appUser.isActive() || authority.grants.isEmpty()) {
      throw ActorAccessRevokedException()
    }

    return ResolvedActorContext(appUser = appUser, memberships = groupMemberships(authority.grants))
  }

  override fun verifyFreshAuthority(actorId: UUID): ActorAuthorityFreshness {
    val authority = readFreshAuthority(actorId)
    return if (authority.appUser?.isActive() == true && authority.grants.isNotEmpty()) {
      ActorAuthorityFreshness.ACTIVE
    } else {
      ActorAuthorityFreshness.REVOKED
    }
  }

  override fun verifyFreshAuthority(actor: AuthenticatedActor): ActorAuthorityFreshness =
    if (oidcBindingIsCurrent(actor)) verifyFreshAuthority(actor.actorId) else ActorAuthorityFreshness.REVOKED

  private fun oidcBindingIsCurrent(actor: AuthenticatedActor): Boolean {
    if (actor.authenticationMechanism != AuthenticationMechanism.OIDC) return actor.oidcBindingId == null
    val bindingId = actor.oidcBindingId ?: return false
    val binding = oidcIdentityRepository?.findById(bindingId) ?: return false
    return binding.active && binding.actorId == actor.actorId
  }

  fun resolveActiveTenant(
    memberships: List<TenantMembership>,
    requestedTenantId: UUID?
  ): TenantMembership? {
    val activeTenant = when {
      requestedTenantId != null ->
        memberships.firstOrNull { it.tenantId == requestedTenantId }
          ?: throw RequestedTenantAccessDeniedException()
      memberships.size == 1 -> memberships.single()
      else -> null
    }

    activeTenant?.let { tenantContextProvider.bindAuthorizedTenant(it.tenantId) }
    return activeTenant
  }

  private fun readFreshAuthority(actorId: UUID): FreshAuthority {
    val appUser = appUserRepository.findById(actorId)
    val grants = tenantMembershipRepository.findActiveMembershipGrants(actorId)
    return FreshAuthority(appUser = appUser, grants = grants)
  }

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
}

data class ResolvedActorContext(
  val appUser: AppUser,
  val memberships: List<TenantMembership>
)

private data class FreshAuthority(
  val appUser: AppUser?,
  val grants: List<TenantMembershipGrant>
)

@ResponseStatus(HttpStatus.FORBIDDEN, reason = "ACCESS_REVOKED")
class ActorAccessRevokedException : RuntimeException("Authenticated actor authority is revoked.")

@ResponseStatus(HttpStatus.FORBIDDEN, reason = "ACCESS_DENIED")
class RequestedTenantAccessDeniedException : RuntimeException("Requested tenant is not accessible.")
