package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import ch.qamwaq.ritomer.shared.application.TenantContext
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.ObjectProvider
import org.springframework.stereotype.Component

@Component
class SecurityTenantContextProvider(
  private val requestProvider: ObjectProvider<HttpServletRequest>
) : TenantContextProvider {
  override fun currentTenantContext(): TenantContext {
    val tenantId = requestProvider.getIfAvailable()?.getHeader(ACTIVE_TENANT_HEADER)?.trim()?.takeUnless { it.isEmpty() }

    return TenantContext(tenantId = tenantId)
  }
}
