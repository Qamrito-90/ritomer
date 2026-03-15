package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.identity.application.AppUserRepository
import ch.qamwaq.ritomer.identity.application.TenantMembershipRepository
import ch.qamwaq.ritomer.identity.domain.TenantRole
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import java.util.UUID

@SpringBootTest
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class PersistenceFoundationIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var appUserRepository: AppUserRepository

  @Autowired
  private lateinit var tenantMembershipRepository: TenantMembershipRepository

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute("truncate table audit_event, closing_folder, tenant_membership, app_user, tenant cascade")
  }

  @Test
  fun `spring context uses postgresql for integration tests`() {
    val version = jdbcTemplate.queryForObject("select version()", String::class.java)

    assertThat(version).contains("PostgreSQL")
  }

  @Test
  fun `flyway creates the core schema`() {
    assertThat(tableExists("tenant")).isTrue()
    assertThat(tableExists("app_user")).isTrue()
    assertThat(tableExists("tenant_membership")).isTrue()
    assertThat(tableExists("closing_folder")).isTrue()
    assertThat(tableExists("audit_event")).isTrue()
  }

  @Test
  fun `tenant scoped tables expose tenant columns and audit metadata uses jsonb`() {
    assertThat(columnExists("tenant_membership", "tenant_id")).isTrue()
    assertThat(columnExists("closing_folder", "tenant_id")).isTrue()
    assertThat(columnExists("closing_folder", "archived_at")).isTrue()
    assertThat(columnExists("audit_event", "tenant_id")).isTrue()
    assertThat(columnType("audit_event", "actor_roles")).isEqualTo("jsonb")
    assertThat(columnType("audit_event", "metadata")).isEqualTo("jsonb")
  }

  @Test
  fun `identity jdbc repositories persist users and resolve only active memberships`() {
    val createdUser = appUserRepository.create("db-user", "db-user@example.com", "DB User")
    val updatedUser = appUserRepository.updateProfile(
      createdUser.id,
      "updated@example.com",
      "Updated User"
    )

    val tenantAlphaId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    val inactiveTenantId = UUID.fromString("33333333-3333-3333-3333-333333333333")
    insertTenant(tenantBetaId, "tenant-beta", "Tenant Beta")
    insertTenant(tenantAlphaId, "tenant-alpha", "Tenant Alpha")
    insertTenant(inactiveTenantId, "tenant-gamma", "Tenant Gamma", status = "INACTIVE")

    insertMembership(updatedUser.id, tenantBetaId, "MANAGER")
    insertMembership(updatedUser.id, tenantAlphaId, "ACCOUNTANT")
    insertMembership(updatedUser.id, inactiveTenantId, "ADMIN")
    insertMembership(updatedUser.id, tenantAlphaId, "REVIEWER", status = "INACTIVE")

    val reloadedUser = appUserRepository.findByExternalSubject("db-user")
    val activeMemberships = tenantMembershipRepository.findActiveMembershipGrants(updatedUser.id)

    assertThat(reloadedUser).isNotNull
    assertThat(reloadedUser?.id).isEqualTo(updatedUser.id)
    assertThat(reloadedUser?.email).isEqualTo("updated@example.com")
    assertThat(reloadedUser?.displayName).isEqualTo("Updated User")
    assertThat(activeMemberships.map { it.tenantSlug to it.role })
      .containsExactly(
        "tenant-alpha" to TenantRole.ACCOUNTANT,
        "tenant-beta" to TenantRole.MANAGER
      )
  }

  private fun tableExists(tableName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName
    ) ?: false

  private fun columnExists(tableName: String, columnName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = ?
          and column_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      columnName
    ) ?: false

  private fun columnType(tableName: String, columnName: String): String =
    jdbcTemplate.queryForObject(
      """
      select udt_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = ?
        and column_name = ?
      """.trimIndent(),
      String::class.java,
      tableName,
      columnName
    ) ?: error("Column $tableName.$columnName not found")

  private fun insertTenant(
    tenantId: UUID,
    tenantSlug: String,
    tenantName: String,
    status: String = "ACTIVE"
  ) {
    jdbcTemplate.update(
      """
      insert into tenant (id, slug, legal_name, status)
      values (?, ?, ?, ?)
      """.trimIndent(),
      tenantId,
      tenantSlug,
      tenantName,
      status
    )
  }

  private fun insertMembership(
    userId: UUID,
    tenantId: UUID,
    roleCode: String,
    status: String = "ACTIVE"
  ) {
    jdbcTemplate.update(
      """
      insert into tenant_membership (id, tenant_id, user_id, role_code, status)
      values (?, ?, ?, ?, ?)
      """.trimIndent(),
      UUID.randomUUID(),
      tenantId,
      userId,
      roleCode,
      status
    )
  }
}
