package ch.qamwaq.ritomer

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("dbtest")
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class PersistenceFoundationIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

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
}
