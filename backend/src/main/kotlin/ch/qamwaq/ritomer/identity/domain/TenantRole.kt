package ch.qamwaq.ritomer.identity.domain

enum class TenantRole {
  ACCOUNTANT,
  REVIEWER,
  MANAGER,
  ADMIN;

  companion object {
    fun fromCode(code: String): TenantRole =
      entries.firstOrNull { it.name == code.trim().uppercase() }
        ?: throw IllegalArgumentException("Unsupported tenant role code: $code")
  }
}
