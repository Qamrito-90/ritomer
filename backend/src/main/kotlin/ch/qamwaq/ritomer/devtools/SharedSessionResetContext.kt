package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import java.io.ByteArrayInputStream
import java.io.ObjectInputFilter
import java.io.ObjectInputStream
import org.springframework.security.core.context.SecurityContextImpl

/** Reads only the minimal actor context needed to identify owned rows during reset-ab. */
internal object SharedSessionResetContext {
  private const val MAX_CONTEXT_BYTES = 16384
  private val uuidPattern = Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
  // Serialized wire-format allowlist; no invocation or compile-time dependency on another module's infrastructure.
  private const val authenticationClass = "ch.qamwaq.ritomer.shared.infrastructure.security.AuthenticatedActorAuthentication"
  private val contextClasses = setOf(
    SecurityContextImpl::class.java.name, authenticationClass,
    AuthenticatedActor::class.java.name, AuthenticationMechanism::class.java.name,
    "java.lang.Enum", "java.lang.String", "java.util.UUID", "java.time.Ser", "java.time.Instant"
  )

  private val fixtureActors = setOf(DemoSeedLocalDataset.accountantActor.userId, DemoSeedLocalDataset.admin046bActor.userId)

  fun decodeContext(bytes: ByteArray): AuthenticatedActor {
    require(bytes.size in 1..MAX_CONTEXT_BYTES) { "CONTEXT_REJECTED" }
    return ByteArrayInputStream(bytes).use { buffer ->
      ObjectInputStream(buffer).use { stream ->
        stream.setObjectInputFilter { info ->
          when {
            info.depth() > 12 || info.references() > 64 || info.streamBytes() > MAX_CONTEXT_BYTES -> ObjectInputFilter.Status.REJECTED
            info.arrayLength() >= 0 -> ObjectInputFilter.Status.REJECTED
            info.serialClass() == null -> ObjectInputFilter.Status.UNDECIDED
            info.serialClass().name in contextClasses -> ObjectInputFilter.Status.ALLOWED
            else -> ObjectInputFilter.Status.REJECTED
          }
        }
        val context = stream.readObject()
        require(context?.javaClass == SecurityContextImpl::class.java && stream.read() == -1) { "CONTEXT_REJECTED" }
        val authentication = (context as SecurityContextImpl).authentication
        require(authentication?.javaClass?.name == authenticationClass && authentication.isAuthenticated &&
          authentication.credentials == null && authentication.details == null && authentication.authorities.isEmpty()) { "CONTEXT_REJECTED" }
        val principal = authentication.principal
        require(principal?.javaClass == AuthenticatedActor::class.java) { "CONTEXT_REJECTED" }
        (principal as AuthenticatedActor).also {
          require(it.authenticationMechanism == AuthenticationMechanism.OIDC && it.oidcBindingId != null &&
            it.actorId in fixtureActors && uuidPattern.matches(it.opaqueAuthCorrelation)) { "CONTEXT_REJECTED" }
        }
      }
    }
  }
}
