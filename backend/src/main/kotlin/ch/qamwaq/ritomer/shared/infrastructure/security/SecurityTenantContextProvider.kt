package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.TenantContext
import ch.qamwaq.ritomer.shared.application.TenantHeaderStatus
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import jakarta.servlet.http.HttpServletRequest
import java.util.UUID
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component

@Component
class SecurityTenantContextProvider(
  private val requestProvider: ObjectProvider<HttpServletRequest>
) : TenantContextProvider {
  override fun currentTenantContext(): TenantContext {
    val rawHeader = requestProvider.getIfAvailable()?.getHeader(ACTIVE_TENANT_HEADER)
      ?: return TenantContext(status = TenantHeaderStatus.ABSENT, tenantId = null)
    val normalized = rawHeader.trim()
    if (normalized.isEmpty()) {
      return TenantContext(status = TenantHeaderStatus.BLANK, tenantId = null)
    }

    val tenantId = normalized.toUuidOrNull()
      ?: return TenantContext(status = TenantHeaderStatus.MALFORMED, tenantId = null)

    return TenantContext(status = TenantHeaderStatus.VALID, tenantId = tenantId)
  }
}

private fun String.toUuidOrNull(): UUID? =
  try {
    UUID.fromString(this)
  } catch (_: IllegalArgumentException) {
    null
  }
