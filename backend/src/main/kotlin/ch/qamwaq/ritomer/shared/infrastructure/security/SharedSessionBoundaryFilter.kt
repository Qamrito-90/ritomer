package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import jakarta.servlet.FilterChain
import jakarta.servlet.SessionTrackingMode
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import jakarta.servlet.http.HttpServletRequestWrapper
import java.net.URI
import java.util.Collections
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
  val expectedCloudRunService: String = ""
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

class SharedSessionBoundaryFilter(private val properties: SharedSessionProperties) : OncePerRequestFilter() {
  override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
    response.setHeader("Cache-Control", "no-store")
    val oidc = request.requestURI == OIDC_START_PATH || request.requestURI == OIDC_CALLBACK_PATH
    if (!originAllowed(request)) {
      writeSecurityError(response, 403, "ACCESS_DENIED")
      return
    }
    if (request.requestURI == SESSION_LOCAL_LOGIN_PATH) {
      writeSecurityError(response, 404, "NOT_FOUND")
      return
    }
    if (oidc) {
      if (request.headerValues("X-Tenant-Id").isNotEmpty()) {
        writeSecurityError(response, 400, "INVALID_TENANT_HEADER")
        return
      }
      if (request.headerValues("Authorization").isNotEmpty()) {
        writeSecurityError(response, 400, "BEARER_NOT_ALLOWED_FOR_SESSION_ENDPOINT")
        return
      }
      if (request.method != "GET") {
        writeSecurityError(response, 405, "REQUEST_REJECTED")
        return
      }
      if (SecurityContextHolder.getContext().authentication?.principal is AuthenticatedActor) {
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

  private fun originAllowed(request: HttpServletRequest): Boolean {
    // Liveness carries no cookie or credentials and does not initialize a session.
    if (request.requestURI == "/actuator/health" || request.requestURI.startsWith("/actuator/health/")) return true
    val origin = URI(properties.canonicalOrigin)
    if (request.headerValues("Host") != listOf(origin.rawAuthority)) return false
    if (request.headerValues("Forwarded").isNotEmpty() ||
      request.headerValues("X-Forwarded-Host").isNotEmpty() ||
      request.headerValues("X-Forwarded-Port").isNotEmpty() ||
      request.headerValues("X-Forwarded-Prefix").isNotEmpty()
    ) return false
    if (properties.proxyMode == "CLOUD_RUN") {
      // Only the explicit Cloud Run topology may supply its single overwritten proto header.
      if (request.headerValues("X-Forwarded-Proto") != listOf("https")) return false
      if (Collections.list(request.headerNames).any {
          it.startsWith("X-Forwarded-", true) &&
            !it.equals("X-Forwarded-Proto", true) && !it.equals("X-Forwarded-For", true)
        }) return false
    } else {
      if (!request.isSecure || Collections.list(request.headerNames).any {
          it.startsWith("X-Forwarded-", true)
        }) return false
    }
    val origins = request.headerValues("Origin")
    if (origins.size > 1 || origins.any { it != properties.canonicalOrigin }) return false
    if (request.method !in setOf("GET", "HEAD", "OPTIONS") && origins != listOf(properties.canonicalOrigin)) return false
    // A top-level OIDC GET callback legitimately has no Origin. State/nonce/PKCE bind it.
    return request.servletContext.effectiveSessionTrackingModes == setOf(SessionTrackingMode.COOKIE)
  }
}

internal fun HttpServletRequest.headerValues(name: String): List<String> = Collections.list(getHeaders(name))

internal fun safeSharedReturnPath(value: String?): String =
  if (value == "/" || value?.matches(
      Regex("/closing-folders/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
    ) == true) value else "/"

