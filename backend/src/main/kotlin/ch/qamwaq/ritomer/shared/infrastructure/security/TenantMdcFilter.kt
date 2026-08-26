package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.TenantContextProvider
import ch.qamwaq.ritomer.shared.application.TenantHeaderStatus
import jakarta.servlet.DispatcherType
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.boot.web.servlet.FilterRegistrationBean
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.MediaType
import org.springframework.security.core.context.SecurityContextHolder
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
    val invocationCount = request.getAttribute(TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE) as? Int ?: 0
    request.setAttribute(TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE, invocationCount + 1)
    request.setAttribute(TENANT_MDC_PRESENT_AT_FILTER_ENTRY_ATTRIBUTE, MDC.get(TENANT_MDC_KEY) != null)
    request.setAttribute(
      TENANT_MDC_FILTER_AUTHENTICATED_AT_ENTRY_ATTRIBUTE,
      SecurityContextHolder.getContext().authentication?.isAuthenticated == true
    )
    tenantContextProvider.clearAuthorizedTenant()

    try {
      val tenantContext = tenantContextProvider.currentTenantContext()
      request.setAttribute(TENANT_HEADER_REASON_CODE_ATTRIBUTE, tenantContext.status.name)
      if (tenantContext.status != TenantHeaderStatus.ABSENT && tenantContext.status != TenantHeaderStatus.VALID) {
        writeInvalidTenantHeader(response)
        return
      }

      filterChain.doFilter(request, response)
    } finally {
      tenantContextProvider.clearAuthorizedTenant()
      request.setAttribute(TENANT_MDC_CLEARED_ATTRIBUTE, MDC.get(TENANT_MDC_KEY) == null)
    }
  }

  override fun shouldNotFilterAsyncDispatch(): Boolean = true

  override fun shouldNotFilterErrorDispatch(): Boolean = true

  private fun writeInvalidTenantHeader(response: HttpServletResponse) {
    response.status = HttpServletResponse.SC_BAD_REQUEST
    response.characterEncoding = Charsets.UTF_8.name()
    response.contentType = MediaType.APPLICATION_JSON_VALUE
    response.writer.write(
      """{"code":"INVALID_TENANT_HEADER","message":"X-Tenant-Id is invalid."}"""
    )
  }
}

@Configuration(proxyBeanMethods = false)
class TenantMdcFilterRegistrationConfiguration {
  @Bean
  fun tenantMdcFilterRegistration(tenantMdcFilter: TenantMdcFilter): FilterRegistrationBean<TenantMdcFilter> =
    FilterRegistrationBean(tenantMdcFilter).apply {
      setEnabled(false)
      setDispatcherTypes(DispatcherType.REQUEST)
    }
}

internal const val TENANT_MDC_KEY = "tenant_id"
internal const val TENANT_MDC_FILTER_INVOCATION_COUNT_ATTRIBUTE =
  "ritomer.tenant-mdc.filter-invocation-count"
internal const val TENANT_MDC_FILTER_AUTHENTICATED_AT_ENTRY_ATTRIBUTE =
  "ritomer.tenant-mdc.filter-authenticated-at-entry"
internal const val TENANT_MDC_PRESENT_AT_FILTER_ENTRY_ATTRIBUTE =
  "ritomer.tenant-mdc.present-at-filter-entry"
internal const val TENANT_MDC_BIND_COUNT_ATTRIBUTE = "ritomer.tenant-mdc.bind-count"
internal const val TENANT_MDC_PRESENT_BEFORE_BIND_ATTRIBUTE = "ritomer.tenant-mdc.present-before-bind"
internal const val TENANT_MDC_AUTHORIZED_VALUE_ATTRIBUTE = "ritomer.tenant-mdc.authorized-value"
internal const val TENANT_MDC_CLEARED_ATTRIBUTE = "ritomer.tenant-mdc.cleared"
internal const val TENANT_HEADER_REASON_CODE_ATTRIBUTE = "ritomer.tenant-mdc.reason-code"
