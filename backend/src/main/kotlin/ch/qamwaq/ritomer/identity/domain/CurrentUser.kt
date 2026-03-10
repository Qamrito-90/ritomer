package ch.qamwaq.ritomer.identity.domain

data class CurrentUser(
  val subject: String,
  val email: String?,
  val tenantId: String?,
  val authorities: Set<String>
)
