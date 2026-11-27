package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.infrastructure.security.AuthenticatedActorAuthentication
import java.io.ByteArrayOutputStream
import java.io.ObjectOutputStream
import java.time.Instant
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextImpl

class SharedSessionResetContextTest {
  private val now = Instant.parse("2026-10-11T12:00:00Z")
  private val binding = UUID.fromString("11111111-1111-4111-8111-111111111111")
  private fun actor() = AuthenticatedActor(
    DemoSeedLocalDataset.accountantActor.userId, AuthenticationMechanism.OIDC,
    now, "22222222-2222-4222-8222-222222222222", binding)
  private fun encode(value: Any): ByteArray = ByteArrayOutputStream().use { output ->
    ObjectOutputStream(output).use { it.writeObject(value) }; output.toByteArray()
  }
  private fun context(actor: AuthenticatedActor = actor()): SecurityContextImpl =
    SecurityContextImpl(AuthenticatedActorAuthentication.fromValidatedActor(actor))

  @Test fun `actual Spring minimal session serialization passes the closed filter`() {
    val bytes = encode(context())
    val decoded = SharedSessionResetContext.decodeContext(bytes)
    assertThat(decoded.actorId).isEqualTo(actor().actorId)
    assertThat(decoded.authenticationMechanism).isEqualTo(AuthenticationMechanism.OIDC)
    assertThat(decoded.authenticatedAt).isEqualTo(now)
    assertThat(decoded.oidcBindingId).isEqualTo(binding)
    assertThat(decoded.opaqueAuthCorrelation).isEqualTo(actor().opaqueAuthCorrelation)
  }

  @Test fun `provider style principal arrays oversized blobs and trailing objects are refused`() {
    val unexpected = SecurityContextImpl(UsernamePasswordAuthenticationToken.authenticated("synthetic-principal", "synthetic-token", emptyList()))
    for (bytes in listOf(encode(unexpected), encode(ByteArray(100)), ByteArray(16385), encode(context()) + encode(context()))) {
      assertThatThrownBy { SharedSessionResetContext.decodeContext(bytes) }.isInstanceOf(Exception::class.java)
    }
    val nested = generateSequence(listOf<Any>("synthetic")) { listOf(it) }.take(20).last()
    assertThatThrownBy { SharedSessionResetContext.decodeContext(encode(nested)) }.isInstanceOf(Exception::class.java)
  }

  @Test fun `untrusted wrong actor non OIDC missing generation and invalid correlation cannot be selected for reset`() {
    val untrusted = context().apply { authentication.isAuthenticated = false }
    assertThatThrownBy { SharedSessionResetContext.decodeContext(encode(untrusted)) }.isInstanceOf(Exception::class.java)
    for (bad in listOf(actor().copy(actorId = UUID.randomUUID()), actor().copy(authenticationMechanism = AuthenticationMechanism.LOCAL_SESSION),
      actor().copy(oidcBindingId = null), actor().copy(opaqueAuthCorrelation = "synthetic-private-value")))
      assertThatThrownBy { SharedSessionResetContext.decodeContext(encode(context(bad))) }.isInstanceOf(Exception::class.java)
  }
}
