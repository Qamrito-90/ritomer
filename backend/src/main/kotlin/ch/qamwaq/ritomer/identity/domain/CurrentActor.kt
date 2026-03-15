package ch.qamwaq.ritomer.identity.domain

import java.util.UUID

data class ActorProfile(
  val userId: UUID,
  val externalSubject: String,
  val email: String?,
  val displayName: String?
)

data class CurrentActor(
  val actor: ActorProfile,
  val memberships: List<TenantMembership>,
  val activeTenant: TenantMembership?,
  val effectiveRoles: Set<TenantRole>
)
