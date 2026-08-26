package ch.qamwaq.ritomer.identity.infrastructure.security

import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.identity.application.CurrentAuthenticatedActorProvider
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import java.time.Clock
import java.util.UUID
import org.springframework.beans.factory.ObjectProvider
import org.springframework.security.access.AccessDeniedException
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component

@Component
class SecurityAuthenticatedActorProvider(
  private val appUserRepository: AppUserRepository,
  clockProvider: ObjectProvider<Clock>
) : CurrentAuthenticatedActorProvider {
  private val clock: Clock = clockProvider.getIfAvailable { Clock.systemUTC() }

  override fun current(): AuthenticatedActor {
    val authentication = SecurityContextHolder.getContext().authentication
      ?: throw AccessDeniedException("Authenticated application actor is required.")
    if (!authentication.isAuthenticated) {
      throw AccessDeniedException("Authenticated application actor is required.")
    }

    val principal = authentication.principal
    if (principal is AuthenticatedActor) {
      return principal
    }

    val jwtAuthentication = authentication as? JwtAuthenticationToken
      ?: throw AccessDeniedException("Unsupported authenticated principal.")
    val subject = jwtAuthentication.token.subject?.takeUnless { it.isBlank() }
      ?: throw AccessDeniedException("JWT subject claim is required.")
    val appUser = appUserRepository.findByExternalSubject(subject)
      ?.takeIf { it.isActive() }
      ?: throw AccessDeniedException("Authenticated application actor is unavailable.")

    return AuthenticatedActor(
      actorId = appUser.id,
      authenticationMechanism = AuthenticationMechanism.LEGACY_JWT,
      authenticatedAt = clock.instant(),
      opaqueAuthCorrelation = UUID.randomUUID().toString()
    )
  }
}
