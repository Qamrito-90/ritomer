package ch.qamwaq.ritomer.shared.application

import java.util.UUID

interface AuditTrail {
  fun append(command: AppendAuditEventCommand): UUID
}

data class AppendAuditEventCommand(
  val tenantId: UUID,
  val actorUserId: UUID?,
  val actorSubject: String?,
  val actorRoles: Set<String> = emptySet(),
  val correlation: AuditCorrelationContext,
  val action: String,
  val resourceType: String,
  val resourceId: String,
  val metadata: Map<String, Any?> = emptyMap()
)
