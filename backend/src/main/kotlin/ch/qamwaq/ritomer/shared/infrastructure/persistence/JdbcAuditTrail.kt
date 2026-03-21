package ch.qamwaq.ritomer.shared.infrastructure.persistence

import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import com.fasterxml.jackson.databind.ObjectMapper
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcAuditTrail(
  private val jdbcClient: JdbcClient,
  private val objectMapper: ObjectMapper
) : AuditTrail {
  override fun append(command: AppendAuditEventCommand): UUID {
    val auditEventId = UUID.randomUUID()

    jdbcClient.sql(
      """
      insert into audit_event (
        id,
        tenant_id,
        actor_user_id,
        actor_subject,
        actor_roles,
        request_id,
        trace_id,
        ip,
        user_agent,
        action,
        resource_type,
        resource_id,
        metadata
      ) values (
        :id,
        :tenantId,
        :actorUserId,
        :actorSubject,
        cast(:actorRoles as jsonb),
        :requestId,
        :traceId,
        :ip,
        :userAgent,
        :action,
        :resourceType,
        :resourceId,
        cast(:metadata as jsonb)
      )
      """.trimIndent()
    )
      .param("id", auditEventId)
      .param("tenantId", command.tenantId)
      .param("actorUserId", command.actorUserId)
      .param("actorSubject", command.actorSubject)
      .param("actorRoles", objectMapper.writeValueAsString(command.actorRoles.normalized()))
      .param("requestId", command.correlation.requestId)
      .param("traceId", command.correlation.traceId)
      .param("ip", command.correlation.ip)
      .param("userAgent", command.correlation.userAgent)
      .param("action", command.action)
      .param("resourceType", command.resourceType)
      .param("resourceId", command.resourceId)
      .param("metadata", objectMapper.writeValueAsString(command.metadata))
      .update()

    return auditEventId
  }
}

private fun Set<String>.normalized(): List<String> =
  asSequence()
    .map { it.trim() }
    .filter { it.isNotEmpty() }
    .toSortedSet()
    .toList()
