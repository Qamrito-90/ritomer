package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.AuthenticatedActorContextInstaller
import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.PlainJWT
import com.nimbusds.jwt.SignedJWT
import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.Date
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatCode
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.boot.test.util.TestPropertyValues
import org.springframework.context.annotation.AnnotationConfigApplicationContext
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository

class SecurityConfigJwtValidationTest {
  private val now = Instant.parse("2026-07-22T10:15:30Z")
  private val clock = Clock.fixed(now, ZoneOffset.UTC)
  private val secret = "s".repeat(64)
  private val decoder = createLocalTestDbtestJwtDecoder(secret, clock)

  @Test
  fun `legacy decoder construction fails fast for absent blank short legacy and sentinel secrets`() {
    val rejected = listOf<String?>(
      null,
      "",
      " ".repeat(32),
      "x".repeat(31),
      "local-dev-only-jwt-hmac-secret-change-me",
      "__INVALID_RUNTIME_SECRET_REQUIRED__"
    )

    rejected.forEach { candidate ->
      assertThatThrownBy { createLocalTestDbtestJwtDecoder(candidate, clock) }
        .isInstanceOf(IllegalStateException::class.java)
    }
  }

  @Test
  fun `strict decoder measures the minimum secret in UTF-8 bytes`() {
    val exactlyThirtyTwoAsciiBytes = "a".repeat(32)
    val exactlyThirtyTwoMultibyteBytes = "\u00e9".repeat(16)

    assertThat(exactlyThirtyTwoMultibyteBytes.toByteArray(StandardCharsets.UTF_8)).hasSize(32)
    assertThatCode {
      createLocalTestDbtestJwtDecoder(exactlyThirtyTwoAsciiBytes, clock)
      createLocalTestDbtestJwtDecoder(exactlyThirtyTwoMultibyteBytes, clock)
    }.doesNotThrowAnyException()
  }

  @Test
  fun `strict decoder accepts a correctly signed nominal HS256 token`() {
    assertAccepted(macToken(JWSAlgorithm.HS256, secret, now, now.plusSeconds(3_600), "ACCOUNTANT"))
  }

  @Test
  fun `strict decoder rejects a bad signature`() {
    assertRejected(macToken(JWSAlgorithm.HS256, "x".repeat(64), now, now.plusSeconds(3_600)))
  }

  @ParameterizedTest
  @ValueSource(strings = ["HS384", "HS512"])
  fun `strict decoder rejects every other HMAC algorithm`(algorithmName: String) {
    assertRejected(
      macToken(JWSAlgorithm.parse(algorithmName), secret, now, now.plusSeconds(3_600))
    )
  }

  @Test
  fun `strict decoder rejects a non HMAC algorithm`() {
    val claims = claims(now, now.plusSeconds(3_600), "ACCOUNTANT")
    assertRejected(PlainJWT(claims).serialize())
  }

  @Test
  fun `strict decoder requires iat`() {
    assertRejected(macToken(JWSAlgorithm.HS256, secret, null, now.plusSeconds(300)))
  }

  @Test
  fun `strict decoder requires exp`() {
    assertRejected(macToken(JWSAlgorithm.HS256, secret, now, null))
  }

  @Test
  fun `strict decoder requires exp strictly after iat`() {
    assertRejected(macToken(JWSAlgorithm.HS256, secret, now, now))
  }

  @Test
  fun `strict decoder rejects a TTL of 3601 seconds`() {
    assertRejected(macToken(JWSAlgorithm.HS256, secret, now, now.plusSeconds(3_601)))
  }

  @Test
  fun `strict decoder accepts a TTL of exactly 3600 seconds`() {
    assertAccepted(macToken(JWSAlgorithm.HS256, secret, now, now.plusSeconds(3_600)))
  }

  @Test
  fun `strict decoder rejects an expired token`() {
    assertRejected(macToken(JWSAlgorithm.HS256, secret, now.minusSeconds(120), now.minusSeconds(1)))
  }

  @Test
  fun `strict decoder rejects exp equal to now`() {
    assertRejected(macToken(JWSAlgorithm.HS256, secret, now.minusSeconds(60), now))
  }

  @Test
  fun `strict decoder rejects iat 61 seconds in the future`() {
    assertRejected(
      macToken(
        JWSAlgorithm.HS256,
        secret,
        now.plusSeconds(61),
        now.plusSeconds(3_661)
      )
    )
  }

  @Test
  fun `strict decoder accepts iat exactly 60 seconds in the future`() {
    assertAccepted(
      macToken(
        JWSAlgorithm.HS256,
        secret,
        now.plusSeconds(60),
        now.plusSeconds(3_660)
      )
    )
  }

  @ParameterizedTest
  @ValueSource(strings = ["ACCOUNTANT", "REVIEWER"])
  fun `strict decoder accepts both synthetic role subjects`(subject: String) {
    val decoded = decoder.decode(
      macToken(JWSAlgorithm.HS256, secret, now.minusSeconds(10), now.plusSeconds(3_590), subject)
    )

    assertThat(decoded.subject).isEqualTo(subject)
  }

  @ParameterizedTest
  @ValueSource(strings = ["local", "test", "dbtest"])
  fun `strict profiles expose exactly one local decoder bean`(profile: String) {
    withSecurityContext(profile) { context ->
      assertThat(context.getBeansOfType(JwtDecoder::class.java).keys)
        .containsExactly("localTestDbtestJwtDecoder")
    }
  }

  @Test
  fun `a synthetic non local profile exposes only the functionally unchanged decoder`() {
    withSecurityContext("synthetic-non-local") { context ->
      val decoders = context.getBeansOfType(JwtDecoder::class.java)
      assertThat(decoders.keys).containsExactly("jwtDecoder")

      val tokenWithoutLocalTemporalClaims = macToken(
        JWSAlgorithm.HS256,
        secret,
        issuedAt = null,
        expiresAt = null
      )
      assertThat(decoders.getValue("jwtDecoder").decode(tokenWithoutLocalTemporalClaims).subject)
        .isEqualTo("ACCOUNTANT")
    }
  }

  @Test
  fun `session capability is default off and does not imply a legacy decoder`() {
    withSecurityContext(profile = "test", hmacSecret = null) { context ->
      assertThat(context.getBean(SessionSecurityProperties::class.java).enabled).isFalse()
      assertThat(context.getBeansOfType(JwtDecoder::class.java)).isEmpty()
      assertThat(context.getBeansOfType(HttpSessionSecurityContextRepository::class.java)).isEmpty()
      assertThat(context.getBeansOfType(HttpSessionCsrfTokenRepository::class.java)).isEmpty()
      assertThat(context.getBeansOfType(AuthenticatedActorContextInstaller::class.java)).isEmpty()
      assertThat(context.getBeansOfType(SessionTerminationSupport::class.java)).isEmpty()
    }
  }

  @Test
  fun `session-only context starts without HMAC and exposes no legacy decoder`() {
    withSecurityContext(profile = "test", hmacSecret = null, sessionEnabled = true) { context ->
      assertThat(context.getBean(SessionSecurityProperties::class.java).enabled).isTrue()
      assertThat(context.getBeansOfType(JwtDecoder::class.java)).isEmpty()
      assertThat(context.getBeansOfType(HttpSessionSecurityContextRepository::class.java)).hasSize(1)
      assertThat(context.getBeansOfType(HttpSessionCsrfTokenRepository::class.java)).hasSize(1)
      assertThat(context.getBeansOfType(AuthenticatedActorContextInstaller::class.java)).hasSize(1)
      assertThat(context.getBeansOfType(SessionTerminationSupport::class.java)).hasSize(1)
    }
  }

  @Test
  fun `an explicit HMAC keeps one legacy decoder alongside the session kernel`() {
    withSecurityContext(profile = "test", hmacSecret = secret, sessionEnabled = true) { context ->
      assertThat(context.getBean(SessionSecurityProperties::class.java).enabled).isTrue()
      assertThat(context.getBeansOfType(JwtDecoder::class.java).keys)
        .containsExactly("localTestDbtestJwtDecoder")
      assertThat(context.getBeansOfType(HttpSessionSecurityContextRepository::class.java)).hasSize(1)
    }
  }

  private fun assertAccepted(token: String) {
    assertThatCode { decoder.decode(token) }.doesNotThrowAnyException()
  }

  private fun assertRejected(token: String) {
    assertThatThrownBy { decoder.decode(token) }
      .isInstanceOf(RuntimeException::class.java)
  }

  private fun macToken(
    algorithm: JWSAlgorithm,
    signingSecret: String,
    issuedAt: Instant?,
    expiresAt: Instant?,
    subject: String = "ACCOUNTANT"
  ): String {
    val signed = SignedJWT(JWSHeader.Builder(algorithm).type(com.nimbusds.jose.JOSEObjectType.JWT).build(), claims(issuedAt, expiresAt, subject))
    signed.sign(MACSigner(signingSecret.toByteArray(StandardCharsets.UTF_8)))
    return signed.serialize()
  }

  private fun claims(issuedAt: Instant?, expiresAt: Instant?, subject: String): JWTClaimsSet {
    val builder = JWTClaimsSet.Builder()
      .subject(subject)
      .jwtID("synthetic-jti")
    issuedAt?.let { builder.issueTime(Date.from(it)) }
    expiresAt?.let { builder.expirationTime(Date.from(it)) }
    return builder.build()
  }

  private fun withSecurityContext(
    profile: String,
    hmacSecret: String? = secret,
    sessionEnabled: Boolean? = null,
    assertion: (AnnotationConfigApplicationContext) -> Unit
  ) {
    AnnotationConfigApplicationContext().use { context ->
      context.environment.setActiveProfiles(profile)
      val properties = buildList {
        hmacSecret?.let { add("ritomer.security.jwt.hmac-secret=$it") }
        sessionEnabled?.let { add("ritomer.security.session.enabled=$it") }
      }
      if (properties.isNotEmpty()) {
        TestPropertyValues.of(*properties.toTypedArray()).applyTo(context)
      }
      context.register(
        SecurityConfig::class.java,
        SessionSecurityKernelConfiguration::class.java
      )
      context.refresh()
      assertion(context)
    }
  }
}
