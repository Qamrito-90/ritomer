package ch.qamwaq.ritomer.identity.application

import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import java.time.Clock
import java.util.UUID
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Service

data class LocalSessionActorOption(
  val actorKey: String,
  val displayLabel: String
)

@Service
@Profile("local | test | dbtest")
@ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
class SessionAuthenticationService(
  private val appUserRepository: AppUserRepository,
  private val tenantMembershipRepository: TenantMembershipRepository,
  clockProvider: ObjectProvider<Clock>
) {
  private val clock: Clock = clockProvider.getIfAvailable { Clock.systemUTC() }

  fun availableLocalActors(): List<LocalSessionActorOption> =
    LOCAL_SESSION_ACTOR_BINDINGS.map { it.option }

  fun authenticateLocalActor(actorKey: String): AuthenticatedActor {
    val binding = LOCAL_SESSION_ACTOR_BINDINGS_BY_KEY[actorKey]
      ?: throw LocalSessionAuthenticationFailedException()
    val appUser = appUserRepository.findById(binding.actorId)
      ?.takeIf { it.isActive() }
      ?: throw LocalSessionAuthenticationFailedException()
    if (tenantMembershipRepository.findActiveMembershipGrants(appUser.id).isEmpty()) {
      throw LocalSessionAuthenticationFailedException()
    }

    return AuthenticatedActor(
      actorId = appUser.id,
      authenticationMechanism = AuthenticationMechanism.LOCAL_SESSION,
      authenticatedAt = clock.instant(),
      opaqueAuthCorrelation = UUID.randomUUID().toString()
    )
  }
}

class LocalSessionAuthenticationFailedException : RuntimeException(
  "Local session authentication failed."
)

internal const val LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY = "actor-01"
internal const val LOCAL_SESSION_REVIEWER_ACTOR_KEY = "actor-02"
internal const val LOCAL_SESSION_ADMIN_ACTOR_KEY = "actor-03"

internal val LOCAL_SESSION_ACCOUNTANT_ACTOR_ID: UUID =
  UUID.fromString("036a0000-0000-4000-8000-000000000002")
internal val LOCAL_SESSION_REVIEWER_ACTOR_ID: UUID =
  UUID.fromString("043b0000-0000-4000-8000-000000000002")
internal val LOCAL_SESSION_ADMIN_ACTOR_ID: UUID =
  UUID.fromString("046b0000-0000-4000-8000-000000000002")

private data class LocalSessionActorBinding(
  val option: LocalSessionActorOption,
  val actorId: UUID
)

private val LOCAL_SESSION_ACTOR_BINDINGS: List<LocalSessionActorBinding> = listOf(
  LocalSessionActorBinding(
    option = LocalSessionActorOption(LOCAL_SESSION_ACCOUNTANT_ACTOR_KEY, "Camille Démo"),
    actorId = LOCAL_SESSION_ACCOUNTANT_ACTOR_ID
  ),
  LocalSessionActorBinding(
    option = LocalSessionActorOption(LOCAL_SESSION_REVIEWER_ACTOR_KEY, "Robin Démo"),
    actorId = LOCAL_SESSION_REVIEWER_ACTOR_ID
  ),
  LocalSessionActorBinding(
    option = LocalSessionActorOption(LOCAL_SESSION_ADMIN_ACTOR_KEY, "Alex Démo"),
    actorId = LOCAL_SESSION_ADMIN_ACTOR_ID
  )
)

private val LOCAL_SESSION_ACTOR_BINDINGS_BY_KEY: Map<String, LocalSessionActorBinding> =
  LOCAL_SESSION_ACTOR_BINDINGS.associateBy { it.option.actorKey }
