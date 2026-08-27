package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.TenantContext
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import ch.qamwaq.ritomer.shared.application.TenantHeaderStatus
import jakarta.servlet.http.HttpServletRequest
import java.util.Collections
import java.util.UUID
import org.slf4j.MDC
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component

@Component
class SecurityTenantContextProvider(
  private val requestProvider: ObjectProvider<HttpServletRequest>
) : TenantContextProvider {
  override fun currentTenantContext(): TenantContext {
    val request = requestProvider.getIfAvailable()
      ?: return TenantContext(status = TenantHeaderStatus.ABSENT, tenantId = null)
    val rawHeaders = Collections.list(request.getHeaders(ACTIVE_TENANT_HEADER))
    if (rawHeaders.isEmpty()) {
      return TenantContext(status = TenantHeaderStatus.ABSENT, tenantId = null)
    }
    if (request.requestURI == SESSION_API_ROOT || request.requestURI.startsWith("$SESSION_API_ROOT/")) {
      return TenantContext(status = TenantHeaderStatus.SESSION_ENDPOINT, tenantId = null)
    }
    if (rawHeaders.size != 1) {
      return TenantContext(status = TenantHeaderStatus.MULTIPLE, tenantId = null)
    }

    val rawHeader = rawHeaders.single()
    if (rawHeader.isBlank()) {
      return TenantContext(status = TenantHeaderStatus.BLANK, tenantId = null)
    }
    if (rawHeader.contains(',')) {
      return TenantContext(status = TenantHeaderStatus.COMMA_COALESCED, tenantId = null)
    }

    val tenantId = rawHeader.toUuidOrNull()
      ?: return TenantContext(status = TenantHeaderStatus.MALFORMED, tenantId = null)
    if (rawHeader != tenantId.toString()) {
      return TenantContext(status = TenantHeaderStatus.NON_CANONICAL, tenantId = null)
    }

    return TenantContext(status = TenantHeaderStatus.VALID, tenantId = tenantId)
  }

  override fun bindAuthorizedTenant(tenantId: UUID) {
    requestProvider.getIfAvailable()?.let { request ->
      val bindCount = request.getAttribute(TENANT_MDC_BIND_COUNT_ATTRIBUTE) as? Int ?: 0
      request.setAttribute(TENANT_MDC_BIND_COUNT_ATTRIBUTE, bindCount + 1)
      request.setAttribute(TENANT_MDC_PRESENT_BEFORE_BIND_ATTRIBUTE, MDC.get(TENANT_MDC_KEY) != null)
      request.setAttribute(TENANT_MDC_AUTHORIZED_VALUE_ATTRIBUTE, tenantId.toString())
    }
    MDC.put(TENANT_MDC_KEY, tenantId.toString())
  }

  override fun clearAuthorizedTenant() {
    MDC.remove(TENANT_MDC_KEY)
  }
}

private const val SESSION_API_ROOT = "/api/session"

private fun String.toUuidOrNull(): UUID? =
  try {
    UUID.fromString(this)
  } catch (_: IllegalArgumentException) {
    null
  }
