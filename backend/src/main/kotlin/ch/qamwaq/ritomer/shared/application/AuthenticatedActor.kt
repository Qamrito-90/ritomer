package ch.qamwaq.ritomer.shared.application

import java.io.Serializable
import java.time.Instant
import java.util.UUID

enum class AuthenticationMechanism {
  LOCAL_SESSION,
  LEGACY_JWT,
  OIDC
}

data class AuthenticatedActor(
  val actorId: UUID,
  val authenticationMechanism: AuthenticationMechanism,
  val authenticatedAt: Instant,
  val opaqueAuthCorrelation: String
) : Serializable {
  companion object {
    private const val serialVersionUID: Long = 1L
  }
}

fun interface AuthenticatedActorContextInstaller {
  fun installAuthenticatedActor(actor: AuthenticatedActor)
}

enum class ActorAuthorityFreshness {
  ACTIVE,
  REVOKED
}

fun interface ActorAuthorityFreshnessVerifier {
  fun verifyFreshAuthority(actorId: UUID): ActorAuthorityFreshness
}
