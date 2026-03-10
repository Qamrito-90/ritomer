package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

@Component
class TenantMdcFilter(
  private val tenantContextProvider: TenantContextProvider
) : OncePerRequestFilter() {
  override fun doFilterInternal(
    request: HttpServletRequest,
    response: HttpServletResponse,
    filterChain: FilterChain
  ) {
    val tenantId = tenantContextProvider.currentTenantContext().tenantId
    if (!tenantId.isNullOrBlank()) {
      MDC.put("tenant_id", tenantId)
    }

    try {
      filterChain.doFilter(request, response)
    } finally {
      MDC.remove("tenant_id")
    }
  }
}
