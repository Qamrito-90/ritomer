package ch.qamwaq.ritomer

import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.dao.DataAccessException
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dbtest")
@Import(WorkpapersDbIntegrationTestConfig::class)
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "true")
class ExportsDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: org.springframework.jdbc.core.JdbcTemplate

  @BeforeEach
  fun resetDatabaseState() {
    jdbcTemplate.execute(
      "truncate table audit_event, export_pack, document_verification, document, workpaper_evidence, workpaper, manual_mapping, balance_import_line, balance_import, closing_folder, tenant_membership, app_user, tenant cascade"
    )
  }

  @Test
  fun `export pack schema exists with tenant scoped fk indexes and immutability`() {
    val versions = jdbcTemplate.queryForList(
      """
      select version
      from flyway_schema_history
      where success = true
        and version is not null
      order by installed_rank asc
      """.trimIndent(),
      String::class.java
    )

    assertThat(versions).containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9")
    assertThat(tableExists("export_pack")).isTrue()
    assertThat(columnExists("export_pack", "tenant_id")).isTrue()
    assertThat(columnExists("export_pack", "source_fingerprint")).isTrue()
    assertThat(foreignKeyExists("export_pack", "fk_export_pack_closing_folder")).isTrue()
    assertThat(uniqueConstraintExists("export_pack", "uk_export_pack_tenant_closing_idempotency")).isTrue()
    assertThat(uniqueConstraintExists("export_pack", "uk_export_pack_tenant_storage_object_key")).isTrue()
    assertThat(indexExists("export_pack", "idx_export_pack_tenant_closing_created")).isTrue()
    assertThat(indexExists("export_pack", "idx_export_pack_tenant_id")).isTrue()
  }

  @Test
  fun `export pack constraints reject invalid rows and mutation`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val userId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
    val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

    insertTenant(tenantId, "tenant-alpha", "Tenant Alpha")
    insertUser(userId, "export-user")
    insertClosingFolder(closingFolderId, tenantId)

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into export_pack (
          id, tenant_id, closing_folder_id, idempotency_key, source_fingerprint, storage_backend,
          storage_object_key, file_name, media_type, byte_size, checksum_sha256,
          basis_import_version, basis_taxonomy_version, created_at, created_by_user_id
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent(),
        UUID.randomUUID(),
        tenantId,
        closingFolderId,
        "key-1",
        "fingerprint-1",
        "LOCAL_FS",
        "tenants/$tenantId/closing-folders/$closingFolderId/export-packs/bad.zip",
        "bad.zip",
        "application/json",
        0L,
        "not-a-checksum",
        3,
        2,
        OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        userId
      )
    }.isInstanceOf(DataAccessException::class.java)

    val exportPackId = UUID.randomUUID()
    jdbcTemplate.update(
      """
      insert into export_pack (
        id, tenant_id, closing_folder_id, idempotency_key, source_fingerprint, storage_backend,
        storage_object_key, file_name, media_type, byte_size, checksum_sha256,
        basis_import_version, basis_taxonomy_version, created_at, created_by_user_id
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      exportPackId,
      tenantId,
      closingFolderId,
      "key-1",
      "fingerprint-1",
      "LOCAL_FS",
      "tenants/$tenantId/closing-folders/$closingFolderId/export-packs/$exportPackId.zip",
      "export.zip",
      "application/zip",
      12L,
      "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      3,
      2,
      OffsetDateTime.parse("2025-01-02T00:00:00Z"),
      userId
    )

    assertThatThrownBy {
      jdbcTemplate.update(
        """
        insert into export_pack (
          id, tenant_id, closing_folder_id, idempotency_key, source_fingerprint, storage_backend,
          storage_object_key, file_name, media_type, byte_size, checksum_sha256,
          basis_import_version, basis_taxonomy_version, created_at, created_by_user_id
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """.trimIndent(),
        UUID.randomUUID(),
        tenantId,
        closingFolderId,
        "key-1",
        "fingerprint-2",
        "LOCAL_FS",
        "tenants/$tenantId/closing-folders/$closingFolderId/export-packs/duplicate.zip",
        "export-2.zip",
        "application/zip",
        12L,
        "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
        3,
        2,
        OffsetDateTime.parse("2025-01-02T00:00:00Z"),
        userId
      )
    }.isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      jdbcTemplate.update(
        "update export_pack set file_name = 'changed.zip' where id = ?",
        exportPackId
      )
    }.isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      jdbcTemplate.update(
        "delete from export_pack where id = ?",
        exportPackId
      )
    }.isInstanceOf(DataAccessException::class.java)
  }

  @Test
  fun `flyway from scratch reaches v9`() {
    val dataSource = jdbcTemplate.dataSource ?: error("DataSource is required for Flyway verification.")

    jdbcTemplate.execute("drop schema if exists public cascade")
    jdbcTemplate.execute("create schema public")

    Flyway.configure()
      .dataSource(dataSource)
      .locations("classpath:db/migration")
      .load()
      .migrate()

    val versions = jdbcTemplate.queryForList(
      """
      select version
      from flyway_schema_history
      where success = true
        and version is not null
      order by installed_rank asc
      """.trimIndent(),
      String::class.java
    )

    assertThat(versions).containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9")
  }

  private fun tableExists(tableName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public'
          and table_name = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName
    ) ?: false

  private fun columnExists(tableName: String, columnName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
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

  private fun foreignKeyExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = ?
          and constraint_name = ?
          and constraint_type = 'FOREIGN KEY'
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      constraintName
    ) ?: false

  private fun uniqueConstraintExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
        select 1
        from information_schema.table_constraints
        where table_schema = 'public'
          and table_name = ?
          and constraint_name = ?
          and constraint_type = 'UNIQUE'
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      constraintName
    ) ?: false

  private fun indexExists(tableName: String, indexName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and tablename = ?
          and indexname = ?
      )
      """.trimIndent(),
      Boolean::class.java,
      tableName,
      indexName
    ) ?: false

  private fun insertTenant(tenantId: UUID, tenantSlug: String, tenantName: String) {
    jdbcTemplate.update(
      """
      insert into tenant (id, slug, legal_name, status)
      values (?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      tenantId,
      tenantSlug,
      tenantName
    )
  }

  private fun insertUser(userId: UUID, externalSubject: String) {
    jdbcTemplate.update(
      """
      insert into app_user (id, external_subject, email, display_name, status)
      values (?, ?, ?, ?, 'ACTIVE')
      """.trimIndent(),
      userId,
      externalSubject,
      "$externalSubject@example.com",
      "Export User"
    )
  }

  private fun insertClosingFolder(closingFolderId: UUID, tenantId: UUID) {
    jdbcTemplate.update(
      """
      insert into closing_folder (
        id, tenant_id, name, period_start_on, period_end_on, status,
        archived_at, archived_by_user_id, created_at, updated_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      closingFolderId,
      tenantId,
      "Closing FY24",
      LocalDate.parse("2024-01-01"),
      LocalDate.parse("2024-12-31"),
      "DRAFT",
      null,
      null,
      OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      OffsetDateTime.parse("2025-01-01T00:00:00Z")
    )
  }
}
