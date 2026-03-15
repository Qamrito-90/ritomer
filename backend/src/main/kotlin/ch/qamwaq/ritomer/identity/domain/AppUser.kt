package ch.qamwaq.ritomer.identity.domain

import java.util.UUID

data class AppUser(
  val id: UUID,
  val externalSubject: String,
  val email: String?,
  val displayName: String?,
  val status: String
) {
  fun isActive(): Boolean = status.equals(ACTIVE_STATUS, ignoreCase = true)

  companion object {
    const val ACTIVE_STATUS = "ACTIVE"
  }
}
