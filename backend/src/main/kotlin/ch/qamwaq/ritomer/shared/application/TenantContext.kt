package ch.qamwaq.ritomer.shared.application

const val ACTIVE_TENANT_HEADER = "X-Tenant-Id"

data class TenantContext(
  val tenantId: String?
)

fun interface TenantContextProvider {
  fun currentTenantContext(): TenantContext
}
