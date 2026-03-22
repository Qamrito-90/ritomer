package ch.qamwaq.ritomer.shared.application

import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ResponseStatus

const val ACTIVE_TENANT_HEADER = "X-Tenant-Id"

enum class TenantHeaderStatus {
  ABSENT,
  BLANK,
  MALFORMED,
  VALID
}

data class TenantContext(
  val status: TenantHeaderStatus,
  val tenantId: UUID?
) {
  fun optionalTenantId(): UUID? =
    when (status) {
      TenantHeaderStatus.ABSENT -> null
      TenantHeaderStatus.VALID -> tenantId
      TenantHeaderStatus.BLANK -> throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER must not be blank.")
      TenantHeaderStatus.MALFORMED -> throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER must be a valid UUID.")
    }

  fun requiredTenantId(): UUID =
    optionalTenantId() ?: throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER is required.")
}

fun interface TenantContextProvider {
  fun currentTenantContext(): TenantContext
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class InvalidTenantHeaderException(message: String) : RuntimeException(message)
