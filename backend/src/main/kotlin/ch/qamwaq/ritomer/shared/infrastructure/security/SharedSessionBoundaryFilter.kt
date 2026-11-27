package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import jakarta.servlet.FilterChain
import jakarta.servlet.SessionTrackingMode
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.http.HttpServletRequestWrapper
import java.net.URI
import java.util.Collections
import java.util.UUID
import jakarta.servlet.DispatcherType
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.web.filter.OncePerRequestFilter

internal const val OIDC_START_PATH = "/oauth2/authorization/google"
internal const val OIDC_CALLBACK_PATH = "/login/oauth2/code/google"
internal const val OIDC_FAILURE_PATH = "/?login=failed"

@ConfigurationProperties("ritomer.security.shared")
data class SharedSessionProperties(
  val canonicalOrigin: String = "",
  val clientId: String = "",
  val clientSecret: String = "",
  val proxyMode: String = "NONE",
  val expectedCloudRunService: String = "",
  val qualificationEnabled: Boolean = false,
  val manualOidcObservationUntil: String = "",
  val browserCommitments: String = ""
) {
  override fun toString() = "SharedSessionProperties(REDACTED)"

  fun validate(activeProfiles: Set<String>, cloudRunService: String?) {
    require(activeProfiles == setOf("shared-internal")) { "The shared profile must be exclusive." }
    val origin = URI(canonicalOrigin)
    require(origin.scheme == "https" && !origin.host.isNullOrBlank() && origin.rawUserInfo == null &&
      origin.rawPath.isNullOrEmpty() && origin.rawQuery == null && origin.rawFragment == null &&
      origin.port in setOf(-1, 443) && origin.toASCIIString() == canonicalOrigin
    ) { "An exact HTTPS canonical origin is required." }
    require(clientId.isNotBlank() && clientSecret.isNotBlank()) { "Shared OIDC configuration is required." }
    require(proxyMode in setOf("NONE", "CLOUD_RUN")) { "Unsupported shared proxy mode." }
    if (proxyMode == "CLOUD_RUN") {
      require(expectedCloudRunService.isNotBlank() && cloudRunService == expectedCloudRunService) {
        "The expected Cloud Run service must match the runtime."
      }
    } else require(cloudRunService == null) { "Cloud Run requires the explicit proxy mode." }
  }
}

class SharedSessionBoundaryFilter(
  private val properties: SharedSessionProperties,
  private val diagnosticEmit: (String) -> Unit = { System.out.println(it) }
) : OncePerRequestFilter() {
  override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
    response.setHeader("Cache-Control", "no-store")
    val oidc = request.requestURI == OIDC_START_PATH || request.requestURI == OIDC_CALLBACK_PATH
    val rejection = originRejection(request)
    if (rejection != null) {
      if (oidc) observeOidc(request, ManualOidcStage.FAILURE_HTTP_BOUNDARY)
      writeSecurityError(response, 403, "ACCESS_DENIED")
      try {
        observeAnonymousQualificationRejection(request, rejection)
      } catch (failure: Exception) {
        // Optional evidence must not change the security verdict or its correlation.
        if (failure is InterruptedException) Thread.currentThread().interrupt()
      }
      return
    }
    if (request.requestURI == SESSION_LOCAL_LOGIN_PATH) {
      writeSecurityError(response, 404, "NOT_FOUND")
      return
    }
    if (oidc) {
      if (request.headerValues("X-Tenant-Id").isNotEmpty()) {
        observeOidc(request, ManualOidcStage.FAILURE_HTTP_BOUNDARY)
        writeSecurityError(response, 400, "INVALID_TENANT_HEADER")
        return
      }
      if (request.headerValues("Authorization").isNotEmpty()) {
        observeOidc(request, ManualOidcStage.FAILURE_HTTP_BOUNDARY)
        writeSecurityError(response, 400, "BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT")
        return
      }
      if (request.method != "GET") {
        observeOidc(request, ManualOidcStage.FAILURE_HTTP_BOUNDARY)
        writeSecurityError(response, 405, "REQUEST_REJECTED")
        return
      }
      if (SecurityContextHolder.getContext().authentication?.principal is AuthenticatedActor) {
        observeOidc(request, ManualOidcStage.FAILURE_HTTP_BOUNDARY)
        writeSecurityError(response, 409, "SESSION_ALREADY_AUTHENTICATED")
        return
      }
    }
    chain.doFilter(object : HttpServletRequestWrapper(request) {
      override fun getScheme() = "https"
      override fun isSecure() = true
      override fun getServerName() = URI(properties.canonicalOrigin).host
      override fun getServerPort() = 443
      override fun getRequestURL() = StringBuffer(properties.canonicalOrigin + request.requestURI)
    }, response)
  }

  private enum class BoundaryRejection { HOST, FORWARDED_FORBIDDEN, PROTO, FORWARDED_UNKNOWN, DIRECT_TRANSPORT, ORIGIN, TRACKING }

  private fun observeAnonymousQualificationRejection(request: HttpServletRequest, rejection: BoundaryRejection) {
    if (!properties.qualificationEnabled || request.dispatcherType != DispatcherType.REQUEST ||
      request.method != "GET" || request.requestURI != "/api/me" || request.queryString != null ||
      request.headerValues("Cookie").isNotEmpty() || request.headerValues("Authorization").isNotEmpty()
    ) return
    val challenge = request.headerValues(SharedQualificationFilter.HEADER).singleOrNull()?.takeIf {
      it.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
    } ?: return
    // Separate closed diagnostic; the existing four-field correlation remains unchanged.
    diagnosticEmit("{\"diagnostic\":\"M12_BOUNDARY_01\",\"challenge\":\"$challenge\",\"reason\":\"${rejection.name}\"}")
    if (rejection == BoundaryRejection.FORWARDED_FORBIDDEN) observeForwardedShape(request, challenge)
  }

  private fun observeForwardedShape(request: HttpServletRequest, challenge: String) {
    val forwarded = request.headerValues("Forwarded")
    val host = request.headerValues("X-Forwarded-Host")
    val port = request.headerValues("X-Forwarded-Port")
    val prefix = request.headerValues("X-Forwarded-Prefix")
    val mask = listOf(forwarded, host, port, prefix).mapIndexed { index, values ->
      if (values.isEmpty()) 0 else 1 shl index
    }.sum()
    fun category(values: List<String>, expected: String, match: String): String = when {
      values.isEmpty() -> "ABSENT"
      values == listOf(expected) -> match
      else -> "OTHER"
    }
    val hostShape = category(host, URI(properties.canonicalOrigin).rawAuthority, "CANONICAL_SINGLE")
    val portShape = category(port, "443", "HTTPS_SINGLE")
    val prefixShape = category(prefix, "", "EMPTY_SINGLE")
    val forwardedShape = forwardedShape(forwarded)
    // Categories describe syntax only. No header value, address or authority is emitted or trusted.
    diagnosticEmit("{\"diagnostic\":\"M12_FORWARDED_01\",\"challenge\":\"$challenge\",\"mask\":$mask," +
      "\"forwardedCount\":${forwarded.size.coerceAtMost(2)},\"forwardedShape\":\"$forwardedShape\"," +
      "\"hostShape\":\"$hostShape\",\"portShape\":\"$portShape\",\"prefixShape\":\"$prefixShape\"}")
  }

  private fun forwardedShape(values: List<String>): String {
    if (values.isEmpty()) return "ABSENT"
    if (values.size != 1) return "MULTIPLE"
    val value = values.single()
    if (value.length !in 1..2048 || value.any { it == ',' || it == '\r' || it == '\n' || it == '\\' }) return "OTHER"
    val fields = value.split(';').map { it.trim().split('=', limit = 2) }
    if (fields.any { it.size != 2 || it[1].isBlank() } || fields.map { it[0].lowercase() }.distinct().size != fields.size) return "OTHER"
    val pairs = fields.associate { it[0].lowercase() to it[1] }
    if (pairs["proto"] != "https" || pairs["for"].isNullOrBlank()) return "OTHER"
    if (pairs.keys == setOf("for", "proto")) return "KEYS_FOR_PROTO_HTTPS"
    if (pairs.keys == setOf("for", "proto", "host") &&
      pairs["host"] in setOf(URI(properties.canonicalOrigin).rawAuthority, "\"${URI(properties.canonicalOrigin).rawAuthority}\"")) {
      return "KEYS_FOR_PROTO_HTTPS_HOST_CANONICAL"
    }
    return "OTHER"
  }

  private fun validCloudRunForwarded(values: List<String>): Boolean {
    val value = values.singleOrNull() ?: return false
    if (value.length !in 1..2048 || value.any { it.code !in 0x20..0x7e || it == ',' || it == '\\' }) return false
    val fields = value.split(';').map { it.trim(' ').split('=', limit = 2) }
    if (fields.size != 2 || fields.any { it.size != 2 } || fields.map { it[0].lowercase() }.distinct().size != 2) return false
    val pairs = fields.associate { it[0].lowercase() to it[1] }
    // Opaque syntax only: this value never determines an address, origin, redirect or identity.
    return pairs.keys == setOf("for", "proto") && pairs["proto"] == "https" &&
      pairs["for"]?.matches(Regex("""(?:[A-Za-z0-9._-]{1,256}|"[A-Za-z0-9._:\[\]-]{1,256}")""")) == true
  }

  private fun originRejection(request: HttpServletRequest): BoundaryRejection? {
    // Liveness carries no cookie or credentials and does not initialize a session.
    if (request.requestURI == "/actuator/health" || request.requestURI.startsWith("/actuator/health/")) return null
    val origin = URI(properties.canonicalOrigin)
    if (request.headerValues("Host") != listOf(origin.rawAuthority)) return BoundaryRejection.HOST
    val forwarded = request.headerValues("Forwarded")
    if (forwarded.isNotEmpty() && (properties.proxyMode != "CLOUD_RUN" || !validCloudRunForwarded(forwarded)) ||
      request.headerValues("X-Forwarded-Host").isNotEmpty() ||
      request.headerValues("X-Forwarded-Port").isNotEmpty() ||
      request.headerValues("X-Forwarded-Prefix").isNotEmpty()
    ) return BoundaryRejection.FORWARDED_FORBIDDEN
    if (properties.proxyMode == "CLOUD_RUN") {
      // Only the explicit Cloud Run topology may supply its single overwritten proto header.
      if (request.headerValues("X-Forwarded-Proto") != listOf("https")) return BoundaryRejection.PROTO
      if (Collections.list(request.headerNames).any {
          it.startsWith("X-Forwarded-", true) &&
            !it.equals("X-Forwarded-Proto", true) && !it.equals("X-Forwarded-For", true)
        }) return BoundaryRejection.FORWARDED_UNKNOWN
    } else {
      if (!request.isSecure || Collections.list(request.headerNames).any {
          it.startsWith("X-Forwarded-", true)
        }) return BoundaryRejection.DIRECT_TRANSPORT
    }
    val origins = request.headerValues("Origin")
    if (origins.size > 1 || origins.any { it != properties.canonicalOrigin }) return BoundaryRejection.ORIGIN
    if (request.method !in setOf("GET", "HEAD", "OPTIONS") && origins != listOf(properties.canonicalOrigin)) return BoundaryRejection.ORIGIN
    // A top-level OIDC GET callback legitimately has no Origin. State/nonce/PKCE bind it.
    return if (request.servletContext.effectiveSessionTrackingModes == setOf(SessionTrackingMode.COOKIE)) null else BoundaryRejection.TRACKING
  }
}

internal fun HttpServletRequest.headerValues(name: String): List<String> = Collections.list(getHeaders(name))

internal fun safeSharedReturnPath(value: String?): String =
  if (value == "/" || value?.matches(
      Regex("/closing-folders/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
    ) == true) value else "/"

/** Temporary, default-off evidence only. This filter never establishes an identity or grants access. */
class SharedQualificationFilter(
  private val revision: String,
  private val emit: (String) -> Unit = { System.out.println(it) },
  private val bootId: UUID = UUID.randomUUID(),
  private val windowAuthority: () -> Pair<String, java.time.Instant>? = { null }
) : OncePerRequestFilter() {
  init { require(validRevision(revision)) { "SHARED_QUALIFICATION_REVISION_REJECTED" } }

  override fun shouldNotFilter(request: HttpServletRequest): Boolean =
    request.dispatcherType != DispatcherType.REQUEST ||
      (!isBootstrap(request) && (challenge(request) == null || !routeAllowed(request)))

  private fun isBootstrap(request: HttpServletRequest) =
    request.method == "GET" && request.requestURI == "/api/session/bootstrap" && request.queryString == null

  override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
    if (isBootstrap(request)) {
      windowAuthority()?.let { (pins, until) ->
        if (java.time.Instant.now().isBefore(until) && pins.matches(Regex("[0-9a-f]{64}(,[0-9a-f]{64}){2}"))) {
          response.setHeader("X-Ritomer-Qualification-Revision", revision)
          response.setHeader("X-Ritomer-Qualification-Windows", pins)
          response.setHeader("X-Ritomer-Qualification-Until", until.toString())
        }
      }
      return chain.doFilter(request, response)
    }
    val challenge = challenge(request) ?: return chain.doFilter(request, response)
    var failed = false
    try {
      chain.doFilter(request, response)
    } catch (failure: Throwable) {
      failed = true
      throw failure
    } finally {
      val status = when {
        failed -> "\"ERROR\""
        request.isAsyncStarted -> "\"INCONCLUSIVE_ASYNC\""
        else -> response.status.toString()
      }
      // Closed ASCII fields only; no URI, headers, principal, exception or credential is interpolated.
      emit("{\"challenge\":\"$challenge\",\"bootId\":\"$bootId\",\"revision\":\"$revision\",\"status\":$status}")
    }
  }

  private fun challenge(request: HttpServletRequest): String? = request.headerValues(HEADER).singleOrNull()
    ?.takeIf { it.matches(UUID_PATTERN) }

  private fun routeAllowed(request: HttpServletRequest): Boolean {
    if (request.queryString != null) return false
    return when (request.method) {
      "GET" -> request.requestURI == "/api/me" || DOWNLOAD_PATTERN.matches(request.requestURI)
      "POST" -> request.requestURI == SESSION_LOGOUT_PATH
      else -> false
    }
  }

  companion object {
    const val HEADER = "X-Ritomer-Qualification-Challenge"
    private const val UUID_TEXT = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
    private val UUID_PATTERN = Regex(UUID_TEXT)
    private val DOWNLOAD_PATTERN = Regex("/api/closing-folders/$UUID_TEXT/(documents|export-packs)/$UUID_TEXT/content")
    fun validRevision(value: String?): Boolean = value != null && value.matches(Regex("[a-z][a-z0-9-]{0,62}"))
  }
}

