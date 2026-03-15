package ch.qamwaq.ritomer.identity.domain

import java.util.UUID

data class TenantMembershipGrant(
  val tenantId: UUID,
  val tenantSlug: String,
  val tenantName: String,
  val role: TenantRole
)

data class TenantMembership(
  val tenantId: UUID,
  val tenantSlug: String,
  val tenantName: String,
  val roles: Set<TenantRole>
)
