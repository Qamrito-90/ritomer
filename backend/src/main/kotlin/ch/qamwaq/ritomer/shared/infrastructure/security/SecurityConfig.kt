package ch.qamwaq.ritomer.shared.infrastructure.security

import java.nio.charset.StandardCharsets
import java.time.Clock
import java.time.Duration
import javax.crypto.spec.SecretKeySpec
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer
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
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.security.web.authentication.logout.LogoutHandler
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.context.SecurityContextHolderFilter
import org.springframework.security.web.csrf.CsrfTokenRequestHandler
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository
import org.springframework.security.web.firewall.RequestRejectedHandler
import org.springframework.security.web.firewall.StrictHttpFirewall
import org.springframework.security.web.savedrequest.NullRequestCache
import org.springframework.security.web.util.matcher.RequestMatcher

@Configuration
@EnableMethodSecurity
class SecurityConfig {
  @Bean
  @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
  fun securityFilterChain(
    http: HttpSecurity,
    jwtAuthenticationConverter: JwtAuthenticationConverter,
    jwtDecoderProvider: ObjectProvider<JwtDecoder>,
    tenantMdcFilter: TenantMdcFilter,
    sessionProperties: SessionSecurityProperties,
    environment: ConfigurableEnvironment,
    sessionCredentialConflictFilterProvider: ObjectProvider<SessionCredentialConflictFilter>,
    sessionExpiryFilterProvider: ObjectProvider<SessionExpiryFilter>,
    localAuthBoundaryFilterProvider: ObjectProvider<LocalAuthBoundaryFilter>,
    sessionAuthorityFreshnessFilterProvider: ObjectProvider<SessionAuthorityFreshnessFilter>,
    sessionSecurityContextRepositoryProvider: ObjectProvider<HttpSessionSecurityContextRepository>,
    sessionCsrfTokenRepositoryProvider: ObjectProvider<HttpSessionCsrfTokenRepository>,
    sessionCsrfTokenRequestHandlerProvider: ObjectProvider<CsrfTokenRequestHandler>,
    authenticatedSessionLogoutRequestMatcherProvider: ObjectProvider<RequestMatcher>,
    sessionAuthenticationEntryPoint: AuthenticationEntryPoint,
    sessionAccessDeniedHandler: AccessDeniedHandler,
    sessionLogoutSuccessHandler: LogoutSuccessHandler,
    sessionCookieClearingLogoutHandler: LogoutHandler
  ): SecurityFilterChain {
    http
      .authorizeHttpRequests {
        it.requestMatchers("/actuator/health", "/actuator/health/**", "/actuator/info").permitAll()
        it.requestMatchers(HttpMethod.GET, SESSION_BOOTSTRAP_PATH).permitAll()
        it.requestMatchers(HttpMethod.POST, SESSION_LOCAL_LOGIN_PATH).permitAll()
        it.requestMatchers(HttpMethod.POST, SESSION_LOGOUT_PATH).authenticated()
        it.requestMatchers(HttpMethod.GET, "/api/me").authenticated()
        it.anyRequest().authenticated()
      }

    val jwtDecoder = jwtDecoderProvider.getIfAvailable()
    if (jwtDecoder != null) {
      http.oauth2ResourceServer {
        if (sessionProperties.enabled) {
          it.authenticationEntryPoint(sessionAuthenticationEntryPoint)
        }
        it.jwt { jwt ->
          jwt.decoder(jwtDecoder)
          jwt.jwtAuthenticationConverter(jwtAuthenticationConverter)
        }
      }
    }

    if (sessionProperties.enabled) {
      validateEnabledSessionContract(environment)
      val securityContextRepository = sessionSecurityContextRepositoryProvider.getObject()
      val csrfTokenRepository = sessionCsrfTokenRepositoryProvider.getObject()
      val csrfTokenRequestHandler = sessionCsrfTokenRequestHandlerProvider.getObject()
      val conflictFilter = sessionCredentialConflictFilterProvider.getObject()
      val expiryFilter = sessionExpiryFilterProvider.getObject()
      val localBoundaryFilter = localAuthBoundaryFilterProvider.getObject()
      val authorityFreshnessFilter = sessionAuthorityFreshnessFilterProvider.getObject()

      http
        .exceptionHandling {
          it.authenticationEntryPoint(sessionAuthenticationEntryPoint)
          it.accessDeniedHandler(sessionAccessDeniedHandler)
        }
        .securityContext {
          it.securityContextRepository(securityContextRepository)
          it.requireExplicitSave(true)
        }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED) }
        .requestCache { it.requestCache(NullRequestCache()) }
        .csrf {
          it.csrfTokenRepository(csrfTokenRepository)
          it.csrfTokenRequestHandler(csrfTokenRequestHandler)
          it.requireCsrfProtectionMatcher(CookieOrLegacyBearerCsrfRequestMatcher())
        }
        .logout {
          it.logoutRequestMatcher(authenticatedSessionLogoutRequestMatcherProvider.getObject())
          it.invalidateHttpSession(true)
          it.clearAuthentication(true)
          it.addLogoutHandler(sessionCookieClearingLogoutHandler)
          it.logoutSuccessHandler(sessionLogoutSuccessHandler)
        }
        .addFilterAfter(conflictFilter, SecurityContextHolderFilter::class.java)
        .addFilterAfter(expiryFilter, SessionCredentialConflictFilter::class.java)
        .addFilterAfter(localBoundaryFilter, SessionExpiryFilter::class.java)
        .addFilterAfter(tenantMdcFilter, LocalAuthBoundaryFilter::class.java)
        .addFilterAfter(authorityFreshnessFilter, TenantMdcFilter::class.java)
    } else {
      check(jwtDecoder != null) {
        "A non-blank legacy JWT HMAC secret is required while the session kernel is disabled."
      }
      http
        .csrf { it.disable() }
        .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
        .addFilterAfter(tenantMdcFilter, BearerTokenAuthenticationFilter::class.java)
    }

    return http.build()
  }

  @Bean
  @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
  fun webSecurityCustomizer(
    strictHttpFirewall: StrictHttpFirewall,
    sessionRequestRejectedHandler: RequestRejectedHandler
  ): WebSecurityCustomizer =
    WebSecurityCustomizer { web ->
      web.httpFirewall(strictHttpFirewall)
      web.requestRejectedHandler(sessionRequestRejectedHandler)
    }

  @Profile("local | test | dbtest")
  @Bean
  @ConditionalOnNonBlankLegacyJwtSecret
  fun localTestDbtestJwtDecoder(
    @Value("\${ritomer.security.jwt.hmac-secret}") hmacSecret: String
  ): JwtDecoder =
    createLocalTestDbtestJwtDecoder(hmacSecret, Clock.systemUTC())

  @Profile("!local & !test & !dbtest")
  @Bean
  @ConditionalOnNonBlankLegacyJwtSecret
  fun jwtDecoder(
    @Value("\${ritomer.security.jwt.hmac-secret}") hmacSecret: String
  ): JwtDecoder {
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
