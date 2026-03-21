package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.REQUEST_ID_HEADER
import jakarta.servlet.http.HttpServletRequest
import java.util.UUID
import org.springframework.beans.factory.ObjectProvider
import org.springframework.http.HttpHeaders
import org.springframework.stereotype.Component

@Component
class SecurityAuditCorrelationContextProvider(
  private val requestProvider: ObjectProvider<HttpServletRequest>
) : AuditCorrelationContextProvider {
  override fun currentCorrelationContext(): AuditCorrelationContext {
    val request = requestProvider.getIfAvailable()
      ?: return AuditCorrelationContext(requestId = UUID.randomUUID().toString())

    return AuditCorrelationContext(
      requestId = resolveRequestId(request),
      traceId = resolveTraceId(request),
      ip = resolveIp(request),
      userAgent = request.getHeader(HttpHeaders.USER_AGENT).normalized()
    )
  }

  private fun resolveRequestId(request: HttpServletRequest): String {
    request.getHeader(REQUEST_ID_HEADER).normalized()?.let { return it }

    val existingRequestId = request.getAttribute(GENERATED_REQUEST_ID_ATTRIBUTE) as? String
    if (existingRequestId != null) {
      return existingRequestId
    }

    return UUID.randomUUID().toString().also { generatedRequestId ->
      request.setAttribute(GENERATED_REQUEST_ID_ATTRIBUTE, generatedRequestId)
    }
  }

  private fun resolveTraceId(request: HttpServletRequest): String? =
    parseTraceparent(request.getHeader(TRACEPARENT_HEADER).normalized())
      ?: request.getHeader(B3_TRACE_ID_HEADER).normalized()
      ?: request.getHeader(CLOUD_TRACE_CONTEXT_HEADER).normalized()?.substringBefore("/").normalized()

  private fun resolveIp(request: HttpServletRequest): String? =
    request.getHeader(FORWARDED_FOR_HEADER).normalized()?.substringBefore(",")?.trim()?.takeUnless { it.isEmpty() }
      ?: request.remoteAddr.normalized()

  private fun parseTraceparent(headerValue: String?): String? {
    val segments = headerValue?.split("-") ?: return null
    if (segments.size < 4) {
      return null
    }

    val traceId = segments[1]
    return traceId.takeIf { it.length == 32 && it.all(Char::isLetterOrDigit) }
  }

  companion object {
    private const val GENERATED_REQUEST_ID_ATTRIBUTE = "ritomer.audit.generated_request_id"
    private const val FORWARDED_FOR_HEADER = "X-Forwarded-For"
    private const val TRACEPARENT_HEADER = "traceparent"
    private const val B3_TRACE_ID_HEADER = "X-B3-TraceId"
    private const val CLOUD_TRACE_CONTEXT_HEADER = "X-Cloud-Trace-Context"
  }
}

private fun String?.normalized(): String? = this?.trim()?.takeUnless { it.isEmpty() }
