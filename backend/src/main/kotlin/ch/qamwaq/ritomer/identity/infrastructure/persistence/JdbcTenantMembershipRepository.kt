package ch.qamwaq.ritomer.identity.infrastructure.persistence

import ch.qamwaq.ritomer.identity.application.TenantMembershipRepository
import ch.qamwaq.ritomer.identity.domain.TenantMembershipGrant
import ch.qamwaq.ritomer.identity.domain.TenantRole
import java.util.UUID
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@ConditionalOnBean(JdbcClient::class)
class JdbcTenantMembershipRepository(
  private val jdbcClient: JdbcClient
) : TenantMembershipRepository {
  override fun findActiveMembershipGrants(userId: UUID): List<TenantMembershipGrant> =
    jdbcClient.sql(
      """
      select tm.tenant_id,
             t.slug as tenant_slug,
             t.legal_name as tenant_name,
             tm.role_code
      from tenant_membership tm
      join tenant t on t.id = tm.tenant_id
      where tm.user_id = :userId
        and upper(tm.status) = 'ACTIVE'
        and upper(t.status) = 'ACTIVE'
      order by t.slug asc, tm.role_code asc
      """
    )
      .param("userId", userId)
      .query(TENANT_MEMBERSHIP_GRANT_ROW_MAPPER)
      .list()

  companion object {
    private val TENANT_MEMBERSHIP_GRANT_ROW_MAPPER = RowMapper<TenantMembershipGrant> { rs, _ ->
      TenantMembershipGrant(
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        tenantSlug = rs.getString("tenant_slug"),
        tenantName = rs.getString("tenant_name"),
        role = TenantRole.fromCode(rs.getString("role_code"))
      )
    }
  }
}
