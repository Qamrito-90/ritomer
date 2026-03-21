package ch.qamwaq.ritomer.shared.application

const val REQUEST_ID_HEADER = "X-Request-Id"

data class AuditCorrelationContext(
  val requestId: String,
  val traceId: String? = null,
  val ip: String? = null,
  val userAgent: String? = null
)

fun interface AuditCorrelationContextProvider {
  fun currentCorrelationContext(): AuditCorrelationContext
}
