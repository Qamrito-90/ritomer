package ch.qamwaq.ritomer.shared.infrastructure.security

import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.Duration
import javax.crypto.spec.SecretKeySpec
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.OAuth2TokenValidator
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult
import org.springframework.security.oauth2.jose.jws.MacAlgorithm
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter
import org.springframework.security.web.SecurityFilterChain

@Configuration
@EnableMethodSecurity
class SecurityConfig(
  @Value("\${ritomer.security.jwt.hmac-secret}")
  private val hmacSecret: String
) {
  @Bean
  @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
  fun securityFilterChain(
    http: HttpSecurity,
    jwtAuthenticationConverter: JwtAuthenticationConverter,
    tenantMdcFilter: TenantMdcFilter
  ): SecurityFilterChain {
    http
      .csrf { it.disable() }
      .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
      .authorizeHttpRequests {
        it.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
        it.requestMatchers(HttpMethod.GET, "/api/me").authenticated()
        it.anyRequest().authenticated()
      }
      .oauth2ResourceServer {
        it.jwt { jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter) }
      }
      .addFilterAfter(tenantMdcFilter, BearerTokenAuthenticationFilter::class.java)

    return http.build()
  }

  @Profile("local | test | dbtest")
  @Bean
  fun localTestDbtestJwtDecoder(): JwtDecoder =
    createLocalTestDbtestJwtDecoder(hmacSecret, Clock.systemUTC())

  @Profile("!local & !test & !dbtest")
  @Bean
  fun jwtDecoder(): JwtDecoder {
    val key = SecretKeySpec(hmacSecret.toByteArray(StandardCharsets.UTF_8), "HmacSHA256")
    return NimbusJwtDecoder.withSecretKey(key).build()
  }

  @Bean
  fun jwtAuthenticationConverter(): JwtAuthenticationConverter {
    val scopeAuthoritiesConverter = JwtGrantedAuthoritiesConverter()

    return JwtAuthenticationConverter().apply {
      setJwtGrantedAuthoritiesConverter { jwt -> scopeAuthoritiesConverter.convert(jwt)?.toSet().orEmpty() }
    }
  }
}

private const val LOCAL_JWT_MINIMUM_SECRET_BYTES = 32
private const val LOCAL_JWT_MAXIMUM_TTL_SECONDS = 3_600L
private const val LOCAL_JWT_MAXIMUM_FUTURE_IAT_SECONDS = 60L
private const val LEGACY_LOCAL_JWT_SECRET = "local-dev-only-jwt-hmac-secret-change-me"
private const val INVALID_RUNTIME_SECRET_SENTINEL = "__INVALID_RUNTIME_SECRET_REQUIRED__"

internal fun createLocalTestDbtestJwtDecoder(
  hmacSecret: String?,
  clock: Clock
): JwtDecoder {
  val secretBytes = requireValidLocalHmacSecret(hmacSecret)
  val key = SecretKeySpec(secretBytes, "HmacSHA256")
  return NimbusJwtDecoder
    .withSecretKey(key)
    .macAlgorithm(MacAlgorithm.HS256)
    .build()
    .apply {
      setJwtValidator(LocalJwtTemporalValidator(clock))
    }
}

private fun requireValidLocalHmacSecret(hmacSecret: String?): ByteArray {
  val value = hmacSecret?.takeIf { it.isNotBlank() }
    ?: throw IllegalStateException("Local JWT HMAC secret is required.")
  if (value == LEGACY_LOCAL_JWT_SECRET || value == INVALID_RUNTIME_SECRET_SENTINEL) {
    throw IllegalStateException("Local JWT HMAC secret uses a forbidden placeholder.")
  }
  return value.toByteArray(StandardCharsets.UTF_8).also { bytes ->
    if (bytes.size < LOCAL_JWT_MINIMUM_SECRET_BYTES) {
      throw IllegalStateException("Local JWT HMAC secret must contain at least 32 UTF-8 bytes.")
    }
  }
}

private class LocalJwtTemporalValidator(
  private val clock: Clock
) : OAuth2TokenValidator<Jwt> {
  override fun validate(token: Jwt): OAuth2TokenValidatorResult {
    val now = clock.instant()
    val issuedAt = token.issuedAt
      ?: return failure("JWT iat claim is required.")
    val expiresAt = token.expiresAt
      ?: return failure("JWT exp claim is required.")

    val valid = expiresAt.isAfter(issuedAt) &&
      Duration.between(issuedAt, expiresAt) <= Duration.ofSeconds(LOCAL_JWT_MAXIMUM_TTL_SECONDS) &&
      expiresAt.isAfter(now) &&
      !issuedAt.isAfter(now.plusSeconds(LOCAL_JWT_MAXIMUM_FUTURE_IAT_SECONDS))

    return if (valid) {
      OAuth2TokenValidatorResult.success()
    } else {
      failure("JWT temporal claims violate the local safety policy.")
    }
  }

  private fun failure(description: String): OAuth2TokenValidatorResult =
    OAuth2TokenValidatorResult.failure(OAuth2Error("invalid_token", description, null))
}
