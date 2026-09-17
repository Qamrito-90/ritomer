package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshness
import ch.qamwaq.ritomer.shared.application.ActorAuthorityFreshnessVerifier
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticatedActorContextInstaller
import jakarta.servlet.DispatcherType
import jakarta.servlet.FilterChain
import jakarta.servlet.SessionTrackingMode
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.util.Collections
import java.util.function.Supplier
import org.springframework.beans.factory.ObjectProvider
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Condition
import org.springframework.context.annotation.ConditionContext
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Conditional
import org.springframework.core.env.ConfigurableEnvironment
import org.springframework.core.env.EnumerablePropertySource
import org.springframework.core.type.AnnotatedTypeMetadata
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseCookie
import org.springframework.security.core.Authentication
import org.springframework.security.core.GrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.context.SecurityContextHolderStrategy
import org.springframework.security.core.context.SecurityContextImpl
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.access.AccessDeniedHandler
import org.springframework.security.web.authentication.logout.LogoutHandler
import org.springframework.security.web.authentication.logout.LogoutSuccessHandler
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy
import org.springframework.security.web.csrf.CsrfException
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.security.web.csrf.CsrfTokenRepository
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler
import org.springframework.security.web.csrf.CsrfTokenRequestHandler
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository
import org.springframework.security.web.firewall.RequestRejectedHandler
import org.springframework.security.web.firewall.StrictHttpFirewall
import org.springframework.security.web.util.matcher.RequestMatcher
import org.springframework.web.filter.OncePerRequestFilter

internal const val LOCAL_SESSION_API_ROOT = "/api/session"
internal const val SESSION_BOOTSTRAP_PATH = "$LOCAL_SESSION_API_ROOT/bootstrap"
internal const val SESSION_LOCAL_LOGIN_PATH = "$LOCAL_SESSION_API_ROOT/local"
internal const val SESSION_LOGOUT_PATH = "$LOCAL_SESSION_API_ROOT/logout"
internal const val SESSION_COOKIE_NAME = "__Host-ritomer-session"
internal const val SESSION_CSRF_HEADER_NAME = "X-CSRF-TOKEN"
internal const val SESSION_CACHE_CONTROL = "no-store"

private val SESSION_IDLE_TIMEOUT: Duration = Duration.ofMinutes(30)
private val SESSION_ABSOLUTE_TIMEOUT: Duration = Duration.ofHours(8)
private const val SESSION_ALLOWED_BACKEND_ADDRESS = "127.0.0.1"
private const val SESSION_ALLOWED_BACKEND_PORT = 8080
private const val SESSION_ALLOWED_HOST = "127.0.0.1:8080"
private const val SESSION_ALLOWED_ORIGIN = "http://127.0.0.1:5173"

internal val CLOUD_RUN_SESSION_DENY_MARKERS: Set<String> = linkedSetOf(
  "K_SERVICE",
  "K_REVISION",
  "K_CONFIGURATION",
  "CLOUD_RUN_JOB",
  "CLOUD_RUN_EXECUTION",
  "CLOUD_RUN_TASK_INDEX",
  "CLOUD_RUN_TASK_ATTEMPT",
  "CLOUD_RUN_TASK_COUNT",
  "CLOUD_RUN_WORKER_POOL",
  "CLOUD_RUN_REVISION"
)

@ConfigurationProperties(prefix = "ritomer.security.session")
data class SessionSecurityProperties(
  val enabled: Boolean = false,
  val absoluteTimeout: Duration = SESSION_ABSOLUTE_TIMEOUT
)

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SessionSecurityProperties::class)
class SessionSecurityKernelConfiguration {
  @Bean
  fun strictHttpFirewall(): StrictHttpFirewall =
    StrictHttpFirewall().apply {
      setAllowSemicolon(false)
    }

  @Bean
  fun sessionRequestRejectedHandler(): RequestRejectedHandler =
    RequestRejectedHandler { _, response, _ ->
      writeSecurityError(response, HttpServletResponse.SC_BAD_REQUEST, "REQUEST_REJECTED")
    }

  @Bean
  fun sessionAuthenticationEntryPoint(): AuthenticationEntryPoint =
    AuthenticationEntryPoint { _, response, _ ->
      writeSecurityError(response, HttpServletResponse.SC_UNAUTHORIZED, "AUTHENTICATION_REQUIRED")
    }

  @Bean
  fun sessionAccessDeniedHandler(): AccessDeniedHandler =
    AccessDeniedHandler { _, response, exception ->
      val code = if (exception is CsrfException) "CSRF_REJECTED" else "ACCESS_DENIED"
      writeSecurityError(response, HttpServletResponse.SC_FORBIDDEN, code)
    }

  @Bean
  fun sessionLogoutSuccessHandler(): LogoutSuccessHandler =
    LogoutSuccessHandler { _, response, _ ->
      response.status = HttpServletResponse.SC_NO_CONTENT
      response.setHeader(HttpHeaders.CACHE_CONTROL, SESSION_CACHE_CONTROL)
    }

  @Bean
  fun sessionCookieClearingLogoutHandler(): LogoutHandler =
    LogoutHandler { _, response, _ -> expireSessionCookie(response) }

  @Bean
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionSecurityContextRepository(): HttpSessionSecurityContextRepository =
    HttpSessionSecurityContextRepository().apply {
      setDisableUrlRewriting(true)
    }

  @Bean
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionCsrfTokenRepository(): HttpSessionCsrfTokenRepository =
    HttpSessionCsrfTokenRepository().apply {
      setHeaderName(SESSION_CSRF_HEADER_NAME)
    }

  @Bean
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionCsrfTokenRequestHandler(): CsrfTokenRequestHandler =
    HeaderOnlyCsrfTokenRequestHandler()

  @Bean
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionAuthenticationStrategy(
    sessionCsrfTokenRepository: CsrfTokenRepository,
    sessionCsrfTokenRequestHandler: CsrfTokenRequestHandler
  ): SessionAuthenticationStrategy =
    CompositeSessionAuthenticationStrategy(
      listOf(
        ChangeSessionIdAuthenticationStrategy(),
        CsrfAuthenticationStrategy(sessionCsrfTokenRepository).apply {
          setRequestHandler(sessionCsrfTokenRequestHandler)
        }
      )
    )

  @Bean
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun authenticatedSessionLogoutRequestMatcher(): RequestMatcher =
    AuthenticatedSessionLogoutRequestMatcher()

  @Bean
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionTerminationSupport(
    sessionSecurityContextRepository: HttpSessionSecurityContextRepository
  ): SessionTerminationSupport =
    SessionTerminationSupport(sessionSecurityContextRepository)

  @Bean
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun authenticatedActorContextInstaller(
    requestProvider: ObjectProvider<HttpServletRequest>,
    responseProvider: ObjectProvider<HttpServletResponse>,
    sessionSecurityContextRepository: HttpSessionSecurityContextRepository,
    sessionAuthenticationStrategy: SessionAuthenticationStrategy
  ): AuthenticatedActorContextInstaller =
    SpringSessionAuthenticatedActorContextInstaller(
      requestProvider = requestProvider,
      responseProvider = responseProvider,
      securityContextRepository = sessionSecurityContextRepository,
      sessionAuthenticationStrategy = sessionAuthenticationStrategy
    )

  @Bean
  @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionCredentialConflictFilterRegistration(
    filter: SessionCredentialConflictFilter
  ): FilterRegistrationBean<SessionCredentialConflictFilter> = disabledRequestRegistration(filter)

  @Bean
  @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionExpiryFilterRegistration(
    filter: SessionExpiryFilter
  ): FilterRegistrationBean<SessionExpiryFilter> = disabledRequestRegistration(filter)

  @Bean
  @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun localAuthBoundaryFilterRegistration(
    filter: LocalAuthBoundaryFilter
  ): FilterRegistrationBean<LocalAuthBoundaryFilter> = disabledRequestRegistration(filter)

  @Bean
  @ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
  @ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
  fun sessionAuthorityFreshnessFilterRegistration(
    filter: SessionAuthorityFreshnessFilter
  ): FilterRegistrationBean<SessionAuthorityFreshnessFilter> = disabledRequestRegistration(filter)

  private fun <T : jakarta.servlet.Filter> disabledRequestRegistration(
    filter: T
  ): FilterRegistrationBean<T> =
    FilterRegistrationBean(filter).apply {
      setEnabled(false)
      setDispatcherTypes(DispatcherType.REQUEST)
    }
}

@Conditional(NonBlankLegacyJwtSecretCondition::class)
@Target(AnnotationTarget.FUNCTION, AnnotationTarget.CLASS)
@Retention(AnnotationRetention.RUNTIME)
annotation class ConditionalOnNonBlankLegacyJwtSecret

internal class NonBlankLegacyJwtSecretCondition : Condition {
  override fun matches(context: ConditionContext, metadata: AnnotatedTypeMetadata): Boolean =
    try {
      context.environment.getProperty("ritomer.security.jwt.hmac-secret")?.isNotBlank() == true
    } catch (_: IllegalArgumentException) {
      false
    }
}

final class AuthenticatedActorAuthentication private constructor(
  private val actor: AuthenticatedActor
) : Authentication {
  @Volatile
  private var trusted: Boolean = true

  override fun getPrincipal(): AuthenticatedActor = actor

  override fun getCredentials(): Any? = null

  override fun getDetails(): Any? = null

  override fun getAuthorities(): Collection<GrantedAuthority> = emptyList()

  override fun getName(): String = actor.opaqueAuthCorrelation

  override fun isAuthenticated(): Boolean = trusted

  override fun setAuthenticated(isAuthenticated: Boolean) {
    require(!isAuthenticated) { "AuthenticatedActorAuthentication cannot be elevated." }
    trusted = false
  }

  override fun toString(): String = "AuthenticatedActorAuthentication[REDACTED]"

  companion object {
    private const val serialVersionUID: Long = 1L

    internal fun fromValidatedActor(actor: AuthenticatedActor): AuthenticatedActorAuthentication =
      AuthenticatedActorAuthentication(actor)
  }
}

private class HeaderOnlyCsrfTokenRequestHandler : CsrfTokenRequestHandler {
  private val delegate = CsrfTokenRequestAttributeHandler()

  override fun handle(
    request: HttpServletRequest,
    response: HttpServletResponse,
    csrfToken: Supplier<CsrfToken>
  ) {
    delegate.handle(request, response, csrfToken)
  }

  override fun resolveCsrfTokenValue(request: HttpServletRequest, csrfToken: CsrfToken): String? =
    request.getHeader(csrfToken.headerName)
}

private class AuthenticatedSessionLogoutRequestMatcher : RequestMatcher {
  override fun matches(request: HttpServletRequest): Boolean {
    val authentication = SecurityContextHolder.getContext().authentication
    return request.method == "POST" &&
      request.requestURI == SESSION_LOGOUT_PATH &&
      authentication?.isAuthenticated == true &&
      authentication.principal is AuthenticatedActor
  }
}

private class SpringSessionAuthenticatedActorContextInstaller(
  private val requestProvider: ObjectProvider<HttpServletRequest>,
  private val responseProvider: ObjectProvider<HttpServletResponse>,
  private val securityContextRepository: HttpSessionSecurityContextRepository,
  private val sessionAuthenticationStrategy: SessionAuthenticationStrategy,
  private val securityContextHolderStrategy: SecurityContextHolderStrategy =
    SecurityContextHolder.getContextHolderStrategy()
) : AuthenticatedActorContextInstaller {
  override fun installAuthenticatedActor(actor: AuthenticatedActor) {
    val request = requestProvider.getIfAvailable()
      ?: throw IllegalStateException("An HTTP request is required to install the authenticated actor.")
    val response = responseProvider.getIfAvailable()
      ?: throw IllegalStateException("An HTTP response is required to install the authenticated actor.")
    val sessionBeforeAuthentication = request.getSession(false)
      ?: throw IllegalStateException("Session bootstrap is required before local authentication.")
    val previousSessionId = sessionBeforeAuthentication.id
    val authentication = AuthenticatedActorAuthentication.fromValidatedActor(actor)

    sessionAuthenticationStrategy.onAuthentication(authentication, request, response)
    val rotatedSession = request.getSession(false)
      ?: throw IllegalStateException("The authenticated session was not retained after rotation.")
    check(rotatedSession.id != previousSessionId) { "The authenticated session id was not rotated." }

    val context = SecurityContextImpl(authentication)
    securityContextHolderStrategy.context = context
    securityContextRepository.saveContext(context, request, response)
  }
}

class SessionTerminationSupport(
  private val securityContextRepository: HttpSessionSecurityContextRepository,
  private val securityContextHolderStrategy: SecurityContextHolderStrategy =
    SecurityContextHolder.getContextHolderStrategy()
) {
  fun terminate(request: HttpServletRequest, response: HttpServletResponse) {
    val emptyContext = securityContextHolderStrategy.createEmptyContext()
    securityContextHolderStrategy.context = emptyContext
    securityContextRepository.saveContext(emptyContext, request, response)
    try {
      request.getSession(false)?.invalidate()
    } catch (_: IllegalStateException) {
      // The container already invalidated the session; the cookie still has to be expired.
    }
    securityContextHolderStrategy.clearContext()
    expireSessionCookie(response)
  }
}

@org.springframework.stereotype.Component
@ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
class SessionCredentialConflictFilter : OncePerRequestFilter() {
  override fun doFilterInternal(
    request: HttpServletRequest,
    response: HttpServletResponse,
    filterChain: FilterChain
  ) {
    incrementFilterInvocation(request, SESSION_CONFLICT_FILTER_INVOCATIONS)
    val bearerPresent = request.hasBearerAuthorization()
    val sessionCookiePresent = request.hasNamedCookie(SESSION_COOKIE_NAME)

    when {
      bearerPresent && sessionCookiePresent ->
        writeSecurityError(response, HttpServletResponse.SC_BAD_REQUEST, "AMBIGUOUS_CREDENTIALS")
      bearerPresent && request.isSessionEndpoint() ->
        writeSecurityError(
          response,
          HttpServletResponse.SC_BAD_REQUEST,
          "BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT"
        )
      else -> filterChain.doFilter(request, response)
    }
  }

  override fun shouldNotFilterAsyncDispatch(): Boolean = true

  override fun shouldNotFilterErrorDispatch(): Boolean = true
}

@org.springframework.stereotype.Component
@ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
class SessionExpiryFilter(
  clockProvider: ObjectProvider<Clock>,
  private val properties: SessionSecurityProperties,
  private val terminationSupport: SessionTerminationSupport
) : OncePerRequestFilter() {
  private val clock: Clock = clockProvider.getIfAvailable { Clock.systemUTC() }

  override fun doFilterInternal(
    request: HttpServletRequest,
    response: HttpServletResponse,
    filterChain: FilterChain
  ) {
    incrementFilterInvocation(request, SESSION_EXPIRY_FILTER_INVOCATIONS)
    val session = request.getSession(false)
    if (request.hasNamedCookie(SESSION_COOKIE_NAME) && session == null) {
      terminationSupport.terminate(request, response)
      writeSecurityError(response, HttpServletResponse.SC_UNAUTHORIZED, "SESSION_EXPIRED")
      return
    }

    val authentication = SecurityContextHolder.getContext().authentication
    val actor = authentication?.principal as? AuthenticatedActor
    if (authentication?.isAuthenticated == true && actor != null && session != null) {
      if (sessionExpired(actor.authenticatedAt, session.lastAccessedTime, clock.instant())) {
        terminationSupport.terminate(request, response)
        writeSecurityError(response, HttpServletResponse.SC_UNAUTHORIZED, "SESSION_EXPIRED")
        return
      }
    }
    filterChain.doFilter(request, response)
  }

  private fun sessionExpired(authenticatedAt: Instant, lastAccessedTime: Long, now: Instant): Boolean {
    val nowMillis = now.toEpochMilli()
    val absoluteExpired = !now.isBefore(authenticatedAt) &&
      Duration.between(authenticatedAt, now) >= properties.absoluteTimeout
    val idleExpired = nowMillis >= lastAccessedTime &&
      Duration.ofMillis(nowMillis - lastAccessedTime) >= SESSION_IDLE_TIMEOUT
    return absoluteExpired || idleExpired
  }

  override fun shouldNotFilterAsyncDispatch(): Boolean = true

  override fun shouldNotFilterErrorDispatch(): Boolean = true
}

@org.springframework.stereotype.Component
@ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
class LocalAuthBoundaryFilter(
  private val environment: ConfigurableEnvironment
) : OncePerRequestFilter() {
  override fun doFilterInternal(
    request: HttpServletRequest,
    response: HttpServletResponse,
    filterChain: FilterChain
  ) {
    incrementFilterInvocation(request, LOCAL_AUTH_BOUNDARY_FILTER_INVOCATIONS)
    if (request.isSessionEndpoint() || request.requestURI == "/api/me") {
      response.setHeader(HttpHeaders.CACHE_CONTROL, SESSION_CACHE_CONTROL)
    }

    val authentication = SecurityContextHolder.getContext().authentication
    val actorSessionRequest = authentication?.isAuthenticated == true &&
      authentication.principal is AuthenticatedActor
    val sessionSurfaceRequest = request.isSessionEndpoint() ||
      request.hasNamedCookie(SESSION_COOKIE_NAME) ||
      actorSessionRequest
    if (sessionSurfaceRequest && !localSessionRequestAllowed(request)) {
      writeSecurityError(response, HttpServletResponse.SC_FORBIDDEN, "ACCESS_DENIED")
      return
    }

    filterChain.doFilter(request, response)
  }

  private fun localSessionRequestAllowed(request: HttpServletRequest): Boolean {
    if (environment.activeProfiles.toSet() !in ALLOWED_EXACT_PROFILE_SETS) return false
    if (environment.hasProtectedCommandLineOverride()) return false
    if (environment.getProperty("server.address") != SESSION_ALLOWED_BACKEND_ADDRESS) return false
    if (environment.getProperty("server.port", Int::class.java, SESSION_ALLOWED_BACKEND_PORT) !=
      SESSION_ALLOWED_BACKEND_PORT
    ) {
      return false
    }
    if (CLOUD_RUN_SESSION_DENY_MARKERS.any(environment::hasExactProperty)) return false
    if (request.remoteAddr != SESSION_ALLOWED_BACKEND_ADDRESS) return false
    if (request.localAddr != SESSION_ALLOWED_BACKEND_ADDRESS) return false
    if (request.localPort != SESSION_ALLOWED_BACKEND_PORT) return false
    if (request.serverName != SESSION_ALLOWED_BACKEND_ADDRESS) return false
    if (request.serverPort != SESSION_ALLOWED_BACKEND_PORT) return false
    if (request.headers(HttpHeaders.HOST) != listOf(SESSION_ALLOWED_HOST)) return false
    if (request.headerNamesList().any { header ->
        header.equals("Forwarded", ignoreCase = true) ||
          header.startsWith("X-Forwarded-", ignoreCase = true)
      }
    ) {
      return false
    }
    val origins = request.headers(HttpHeaders.ORIGIN)
    if (origins.size > 1 || origins.any { it != SESSION_ALLOWED_ORIGIN }) return false
    if (request.isUnsafeMethod() && origins != listOf(SESSION_ALLOWED_ORIGIN)) return false
    if (request.servletContext.effectiveSessionTrackingModes != setOf(SessionTrackingMode.COOKIE)) return false
    return true
  }

  override fun shouldNotFilterAsyncDispatch(): Boolean = true

  override fun shouldNotFilterErrorDispatch(): Boolean = true

  private companion object {
    val ALLOWED_EXACT_PROFILE_SETS = setOf(setOf("local"), setOf("test"), setOf("dbtest"))
  }
}

@org.springframework.stereotype.Component
@ConditionalOnProperty(name = ["ritomer.security.session.enabled"], havingValue = "true")
class SessionAuthorityFreshnessFilter(
  private val authorityFreshnessVerifier: ActorAuthorityFreshnessVerifier,
  private val terminationSupport: SessionTerminationSupport
) : OncePerRequestFilter() {
  override fun doFilterInternal(
    request: HttpServletRequest,
    response: HttpServletResponse,
    filterChain: FilterChain
  ) {
    incrementFilterInvocation(request, SESSION_AUTHORITY_FILTER_INVOCATIONS)
    val authentication = SecurityContextHolder.getContext().authentication
    val actor = authentication?.principal as? AuthenticatedActor
    if (
      actor != null &&
      authentication.isAuthenticated &&
      authorityFreshnessVerifier.verifyFreshAuthority(actor.actorId) == ActorAuthorityFreshness.REVOKED
    ) {
      terminationSupport.terminate(request, response)
      writeSecurityError(response, HttpServletResponse.SC_FORBIDDEN, "ACCESS_REVOKED")
      return
    }
    filterChain.doFilter(request, response)
  }

  override fun shouldNotFilterAsyncDispatch(): Boolean = true

  override fun shouldNotFilterErrorDispatch(): Boolean = true
}

class CookieOrLegacyBearerCsrfRequestMatcher : RequestMatcher {
  override fun matches(request: HttpServletRequest): Boolean {
    if (!request.isUnsafeMethod()) return false
    if (request.isSessionEndpoint()) return true
    return !(request.hasBearerAuthorization() && !request.hasNamedCookie(SESSION_COOKIE_NAME))
  }
}

internal fun validateEnabledSessionContract(environment: ConfigurableEnvironment) {
  require(environment.getProperty("server.servlet.session.tracking-modes")?.equals("cookie", true) == true)
  require(environment.getProperty("server.servlet.session.cookie.name") == SESSION_COOKIE_NAME)
  require(environment.getProperty("server.servlet.session.cookie.secure", Boolean::class.java) == true)
  require(environment.getProperty("server.servlet.session.cookie.http-only", Boolean::class.java) == true)
  require(environment.getProperty("server.servlet.session.cookie.path") == "/")
  require(environment.getProperty("server.servlet.session.cookie.same-site")?.equals("lax", true) == true)
  require(environment.getProperty("server.servlet.session.timeout", Duration::class.java) == SESSION_IDLE_TIMEOUT)
  require(
    environment.getProperty("ritomer.security.session.absolute-timeout", Duration::class.java) ==
      SESSION_ABSOLUTE_TIMEOUT
  )
}

internal fun HttpServletRequest.isSessionEndpoint(): Boolean =
  requestURI == LOCAL_SESSION_API_ROOT || requestURI.startsWith("$LOCAL_SESSION_API_ROOT/")

private fun HttpServletRequest.hasBearerAuthorization(): Boolean =
  headers(HttpHeaders.AUTHORIZATION).any { value ->
    value.length > "Bearer ".length && value.regionMatches(0, "Bearer ", 0, "Bearer ".length, true)
  }

private fun HttpServletRequest.hasNamedCookie(name: String): Boolean =
  cookies.orEmpty().any { it.name == name } ||
    headers(HttpHeaders.COOKIE).any { line ->
      line.split(';').any { pair -> pair.substringBefore('=').trim() == name }
    }

private fun HttpServletRequest.isUnsafeMethod(): Boolean =
  method.uppercase() !in setOf("GET", "HEAD", "OPTIONS", "TRACE")

private fun HttpServletRequest.headers(name: String): List<String> =
  Collections.list(getHeaders(name))

private fun HttpServletRequest.headerNamesList(): List<String> =
  Collections.list(headerNames)

private fun ConfigurableEnvironment.hasExactProperty(name: String): Boolean =
  propertySources.any { propertySource -> propertySource.containsProperty(name) }

private fun ConfigurableEnvironment.hasProtectedCommandLineOverride(): Boolean {
  val commandLine = propertySources.get(COMMAND_LINE_PROPERTY_SOURCE_NAME) ?: return false
  val propertyNames = (commandLine as? EnumerablePropertySource<*>)?.propertyNames ?: return true
  return propertyNames.any { propertyName ->
    PROTECTED_COMMAND_LINE_PREFIXES.any(propertyName::startsWith)
  }
}

private fun incrementFilterInvocation(request: HttpServletRequest, attribute: String) {
  val current = request.getAttribute(attribute) as? Int ?: 0
  request.setAttribute(attribute, current + 1)
}

internal fun writeSecurityError(response: HttpServletResponse, status: Int, code: String) {
  if (response.isCommitted) return
  response.resetBuffer()
  response.status = status
  response.characterEncoding = Charsets.UTF_8.name()
  response.contentType = MediaType.APPLICATION_JSON_VALUE
  response.setHeader(HttpHeaders.CACHE_CONTROL, SESSION_CACHE_CONTROL)
  response.writer.write("{\"code\":\"$code\",\"message\":\"${securityErrorMessage(code)}\"}")
}

private fun securityErrorMessage(code: String): String =
  when (code) {
    "REQUEST_REJECTED" -> "Request rejected."
    "AUTHENTICATION_REQUIRED" -> "Authentication is required."
    "ACCESS_DENIED" -> "Access is denied."
    "CSRF_REJECTED" -> "CSRF token is invalid."
    "AMBIGUOUS_CREDENTIALS" -> "Conflicting credentials are not allowed."
    "BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT" ->
      "Bearer authentication is not allowed on session endpoints."
    "SESSION_EXPIRED" -> "The session has expired."
    "SESSION_ALREADY_AUTHENTICATED" -> "The session is already authenticated."
    "ACCESS_REVOKED" -> "Access has been revoked."
    else -> "Request failed."
  }

internal fun expireSessionCookie(response: HttpServletResponse) {
  val cookie = ResponseCookie.from(SESSION_COOKIE_NAME, "")
    .secure(true)
    .httpOnly(true)
    .path("/")
    .sameSite("Lax")
    .maxAge(Duration.ZERO)
    .build()
  response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString())
}

internal const val SESSION_CONFLICT_FILTER_INVOCATIONS = "ritomer.session.conflict-filter-invocations"
internal const val SESSION_EXPIRY_FILTER_INVOCATIONS = "ritomer.session.expiry-filter-invocations"
internal const val LOCAL_AUTH_BOUNDARY_FILTER_INVOCATIONS = "ritomer.session.local-boundary-filter-invocations"
internal const val SESSION_AUTHORITY_FILTER_INVOCATIONS = "ritomer.session.authority-filter-invocations"

private const val COMMAND_LINE_PROPERTY_SOURCE_NAME = "commandLineArgs"
private val PROTECTED_COMMAND_LINE_PREFIXES = listOf(
  "server.",
  "ritomer.security.session.",
  "ritomer.security.jwt."
)
