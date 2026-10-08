package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.application.OidcActorAdmission
import ch.qamwaq.ritomer.shared.application.OidcAdmissionDeniedException
import java.time.Clock
import java.util.UUID
import org.springframework.beans.factory.ObjectProvider
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Service

@Service
@Profile("shared-internal")
class OidcSessionAuthenticationService(
  private val bindings: OidcIdentityRepository,
  private val users: AppUserRepository,
  private val memberships: TenantMembershipRepository,
  clockProvider: ObjectProvider<Clock>
) : OidcActorAdmission {
  private val clock = clockProvider.getIfAvailable { Clock.systemUTC() }

  override fun admit(issuer: String, subject: String): AuthenticatedActor {
    if (issuer.isBlank() || subject.isBlank()) throw OidcAdmissionDeniedException()
    val binding = bindings.findByIdentity(issuer, subject) ?: throw OidcAdmissionDeniedException()
    if (!binding.active || users.findById(binding.actorId)?.isActive() != true ||
      memberships.findActiveMembershipGrants(binding.actorId).isEmpty()
    ) throw OidcAdmissionDeniedException()
    return AuthenticatedActor(
      actorId = binding.actorId,
      authenticationMechanism = AuthenticationMechanism.OIDC,
      authenticatedAt = clock.instant(),
      opaqueAuthCorrelation = UUID.randomUUID().toString(),
      oidcBindingId = binding.id
    )
  }
}

