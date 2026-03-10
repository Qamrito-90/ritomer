package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.TenantContext
import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken
import org.springframework.stereotype.Component

@Component
class SecurityTenantContextProvider : TenantContextProvider {
  override fun currentTenantContext(): TenantContext {
    val jwtAuthentication = SecurityContextHolder.getContext().authentication as? JwtAuthenticationToken
    val token = jwtAuthentication?.token
    val tenantId = token?.getClaimAsString("tenant_id") ?: token?.getClaimAsString("tenantId")

    return TenantContext(tenantId = tenantId)
  }
}
