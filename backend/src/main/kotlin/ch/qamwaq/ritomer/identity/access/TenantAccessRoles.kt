package ch.qamwaq.ritomer.identity.access

import ch.qamwaq.ritomer.identity.domain.TenantRole

val CONTROLS_READ_ROLE_NAMES: Set<String> = sortedSetOf(
  TenantRole.ACCOUNTANT.name,
  TenantRole.REVIEWER.name,
  TenantRole.MANAGER.name,
  TenantRole.ADMIN.name
)
