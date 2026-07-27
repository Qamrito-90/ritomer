package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabaseGuardInitializer
import java.sql.Connection
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import javax.sql.DataSource
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.ContextConfiguration

@SpringBootTest
@ActiveProfiles("dbtest")
@ContextConfiguration(
  initializers = [
    DisposablePostgresTestDatabaseGuardInitializer::class
  ]
)
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "(?i:true)")
class MappingSuggestionDecisionDbIntegrationTest {
  @Autowired
  private lateinit var jdbcTemplate: JdbcTemplate

  @Autowired
  private lateinit var dataSource: DataSource

  @Autowired
  private lateinit var environment: Environment

  @BeforeEach
  fun resetDatabaseState() {
    DisposablePostgresTestDatabase.truncateAllCurrentTables(dataSource, environment)
  }

  @Test
  fun `flyway applies decision request migration and creates constraints and indexes`() {
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

    assertThat(versions).contains("10")
    assertThat(tableExists("mapping_suggestion_decision_request")).isTrue()
    assertThat(foreignKeyExists("mapping_suggestion_decision_request", "fk_mapping_suggestion_decision_request_closing_folder")).isTrue()
    assertThat(uniqueConstraintExists("mapping_suggestion_decision_request", "uk_mapping_suggestion_decision_request_idempotency")).isTrue()
    assertThat(indexExists("mapping_suggestion_decision_request", "uk_mapping_suggestion_decision_request_idempotency")).isTrue()
    assertThat(indexExists("mapping_suggestion_decision_request", "idx_mapping_suggestion_decision_request_history")).isTrue()
  }

  @Test
  fun `foreign keys enforce tenant actor and closing folder tenant scope`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val otherTenantId = UUID.fromString("22222222-2222-2222-2222-222222222222")
    val actorUserId = UUID.fromString("99999999-9999-9999-9999-999999999999")
    insertTenant(tenantId)
    insertTenant(otherTenantId, slug = "tenant-beta")
    insertUser(actorUserId)
    val closingFolderId = insertClosingFolder(tenantId)
    val otherClosingFolderId = insertClosingFolder(otherTenantId)

    assertThatThrownBy {
      insertDecisionRow(tenantId = UUID.randomUUID(), closingFolderId = closingFolderId, actorUserId = actorUserId)
    }.isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = UUID.randomUUID())
    }.isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = otherClosingFolderId, actorUserId = actorUserId)
    }.isInstanceOf(DataAccessException::class.java)
  }

  @Test
  fun `unique key and check constraints enforce decision request shape`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val actorUserId = UUID.fromString("99999999-9999-9999-9999-999999999999")
    insertTenant(tenantId)
    insertUser(actorUserId)
    val closingFolderId = insertClosingFolder(tenantId)

    insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId)
    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId)
    }.isInstanceOf(DataAccessException::class.java)

    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId, idempotencyKey = "unique-02", decision = "UNKNOWN")
    }.isInstanceOf(DataAccessException::class.java)
    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId, idempotencyKey = "unique-03", canonicalPayloadHash = "A".repeat(64))
    }.isInstanceOf(DataAccessException::class.java)
    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId, idempotencyKey = "unique-04", suggestionFingerprint = "not-hex")
    }.isInstanceOf(DataAccessException::class.java)
    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId, idempotencyKey = "unique-05", latestImportVersion = 0)
    }.isInstanceOf(DataAccessException::class.java)
    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId, idempotencyKey = "unique-06", decision = "ACCEPT", targetCode = null)
    }.isInstanceOf(DataAccessException::class.java)
    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId, idempotencyKey = "unique-07", decision = "REJECT", targetCode = "BS.ASSET.CASH_AND_EQUIVALENTS")
    }.isInstanceOf(DataAccessException::class.java)
    assertThatThrownBy {
      insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId, idempotencyKey = "unique-08", reviewComment = "x".repeat(601))
    }.isInstanceOf(DataAccessException::class.java)

    assertThat(countPendingRows()).isZero()
  }

  @Test
  fun `select for update serializes decision request rows`() {
    val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
    val actorUserId = UUID.fromString("99999999-9999-9999-9999-999999999999")
    insertTenant(tenantId)
    insertUser(actorUserId)
    val closingFolderId = insertClosingFolder(tenantId)
    insertDecisionRow(tenantId = tenantId, closingFolderId = closingFolderId, actorUserId = actorUserId)

    val firstLocked = CountDownLatch(1)
    val secondElapsedMillis = AtomicReference<Long>()
    val executor = Executors.newFixedThreadPool(2)
    val connection1 = dataSource.connection
    val connection2 = dataSource.connection

    try {
      executor.submit {
        connection1.useLockedRow(tenantId, closingFolderId, "idempotent-01") {
          firstLocked.countDown()
          Thread.sleep(600)
        }
      }
      executor.submit {
        assertThat(firstLocked.await(5, TimeUnit.SECONDS)).isTrue()
        val startedAt = System.nanoTime()
        connection2.useLockedRow(tenantId, closingFolderId, "idempotent-01") {}
        secondElapsedMillis.set(TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt))
      }
      executor.shutdown()
      assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue()
    } finally {
      connection1.close()
      connection2.close()
    }

    assertThat(secondElapsedMillis.get()).isGreaterThanOrEqualTo(400)
  }

  private fun Connection.useLockedRow(
    tenantId: UUID,
    closingFolderId: UUID,
    idempotencyKey: String,
    block: () -> Unit
  ) {
    autoCommit = false
    prepareStatement(
      """
      select id
      from mapping_suggestion_decision_request
      where tenant_id = ?
        and closing_folder_id = ?
        and account_code = '1000'
        and idempotency_key = ?
      for update
      """.trimIndent()
    ).use { statement ->
      statement.setObject(1, tenantId)
      statement.setObject(2, closingFolderId)
      statement.setString(3, idempotencyKey)
      statement.executeQuery().use { resultSet ->
        assertThat(resultSet.next()).isTrue()
      }
    }
    block()
    commit()
  }

  private fun insertDecisionRow(
    tenantId: UUID,
    closingFolderId: UUID,
    actorUserId: UUID,
    idempotencyKey: String = "idempotent-01",
    canonicalPayloadHash: String = "a".repeat(64),
    decision: String = "REJECT",
    latestImportVersion: Int = 1,
    suggestionFingerprint: String = "b".repeat(64),
    targetCode: String? = null,
    reviewComment: String? = null,
    resultKind: String = "REJECT_RECORDED"
  ) {
    jdbcTemplate.update(
      """
      insert into mapping_suggestion_decision_request (
        id,
        tenant_id,
        closing_folder_id,
        account_code,
        idempotency_key,
        canonical_payload_hash,
        decision,
        latest_import_version,
        suggestion_fingerprint,
        target_code,
        review_comment,
        actor_user_id,
        result_kind,
        applied_account_code,
        applied_target_code,
        created_at,
        completed_at
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """.trimIndent(),
      UUID.randomUUID(),
      tenantId,
      closingFolderId,
      "1000",
      idempotencyKey,
      canonicalPayloadHash,
      decision,
      latestImportVersion,
      suggestionFingerprint,
      targetCode,
      reviewComment,
      actorUserId,
      resultKind,
      null,
      null,
      OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      OffsetDateTime.parse("2025-01-01T00:00:01Z")
    )
  }

  private fun insertTenant(
    tenantId: UUID,
    slug: String = "tenant-alpha"
  ) {
    jdbcTemplate.update(
      "insert into tenant (id, slug, legal_name, status) values (?, ?, ?, 'ACTIVE')",
      tenantId,
      slug,
      "Tenant"
    )
  }

  private fun insertUser(userId: UUID) {
    jdbcTemplate.update(
      "insert into app_user (id, external_subject, status) values (?, ?, 'ACTIVE')",
      userId,
      "user-${userId.toString().take(8)}"
    )
  }

  private fun insertClosingFolder(tenantId: UUID): UUID {
    val closingFolderId = UUID.randomUUID()
    jdbcTemplate.update(
      """
      insert into closing_folder (
        id,
        tenant_id,
        name,
        period_start_on,
        period_end_on,
        status,
        archived_at,
        archived_by_user_id,
        created_at,
        updated_at
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
    return closingFolderId
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

  private fun uniqueConstraintExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
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

  private fun foreignKeyExists(tableName: String, constraintName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
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

  private fun indexExists(tableName: String, indexName: String): Boolean =
    jdbcTemplate.queryForObject(
      """
      select exists(
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

  private fun countPendingRows(): Int =
    jdbcTemplate.queryForObject(
      "select count(*) from mapping_suggestion_decision_request where result_kind = 'PENDING'",
      Int::class.java
    ) ?: 0
}
