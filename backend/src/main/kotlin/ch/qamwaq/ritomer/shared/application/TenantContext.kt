package ch.qamwaq.ritomer.shared.application

data class TenantContext(
  val tenantId: String?
)

fun interface TenantContextProvider {
  fun currentTenantContext(): TenantContext
}
