package ch.qamwaq.ritomer.shared.application

import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ResponseStatus

const val ACTIVE_TENANT_HEADER = "X-Tenant-Id"

enum class TenantHeaderStatus {
  ABSENT,
  BLANK,
  MALFORMED,
  NON_CANONICAL,
  MULTIPLE,
  COMMA_COALESCED,
  SESSION_ENDPOINT,
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
      TenantHeaderStatus.NON_CANONICAL ->
        throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER must be a canonical lowercase UUID.")
      TenantHeaderStatus.MULTIPLE ->
        throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER must occur at most once.")
      TenantHeaderStatus.COMMA_COALESCED ->
        throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER must contain exactly one UUID.")
      TenantHeaderStatus.SESSION_ENDPOINT ->
        throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER is not accepted on session endpoints.")
    }

  fun requiredTenantId(): UUID =
    optionalTenantId() ?: throw InvalidTenantHeaderException("$ACTIVE_TENANT_HEADER is required.")
}

interface TenantContextProvider {
  fun currentTenantContext(): TenantContext

  fun bindAuthorizedTenant(tenantId: UUID)

  fun clearAuthorizedTenant()
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class InvalidTenantHeaderException(message: String) : RuntimeException(message)
