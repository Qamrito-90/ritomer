package ch.qamwaq.ritomer.devtools

import java.lang.reflect.Proxy
import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.PreparedStatement
import java.sql.ResultSet
import java.sql.SQLException
import java.sql.Statement
import java.time.Clock
import java.time.Instant
import java.time.ZoneId
import java.time.ZoneOffset
import java.util.logging.Handler
import java.util.logging.Level
import java.util.logging.LogRecord
import java.util.logging.Logger
import java.util.UUID
import java.io.ByteArrayOutputStream
import java.io.ObjectOutputStream
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.infrastructure.security.AuthenticatedActorAuthentication
import org.springframework.security.core.context.SecurityContextImpl
import java.security.cert.CertPathBuilderException
import javax.net.ssl.SSLHandshakeException
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.flywaydb.core.api.logging.LogFactory
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir

class SharedCloudOperationsTest {
  @TempDir lateinit var directory: Path
  private val privateValue = "synthetic-private-value"

  private fun environment(mode: String): MutableMap<String, String> {
    val ca = directory.resolve("ca.pem")
    Files.writeString(ca, "SYNTHETIC_FIXTURE")
    return mutableMapOf(
      "RITOMER_M12_PROJECT" to "project-74f86561-bbba-4eb0-aa6",
      "RITOMER_M12_INSTANCE" to "free-trial-first-project", "CLOUD_RUN_JOB" to "ritomer-m12-ops",
      "CLOUD_RUN_TASK_INDEX" to "0", "CLOUD_RUN_TASK_ATTEMPT" to "0",
      "RITOMER_M12_HOST" to "synthetic.europe-west6.sql.goog", "RITOMER_M12_PRIVATE_IP" to "10.50.0.2",
      "RITOMER_M12_CA_PATH" to ca.toString(), "RITOMER_M12_DB_PASSWORD" to privateValue,
      "RITOMER_M12_DB_USER" to when(mode) { "bootstrap" -> "ritomer_m12_bootstrap"; "probe" -> "ritomer_m12_runtime_login"; else -> "ritomer_m12_migrator_login" },
      "RITOMER_M12_DEADLINE_UTC" to Instant.now().plusSeconds(120).toString()
    ).apply {
      if (mode in setOf("bind", "revoke")) put("RITOMER_M12_ACTOR", "A")
      if (mode == "bind") put("RITOMER_M12_SUBJECT", "123456789")
      if (mode == "revoke") {
        put("RITOMER_M12_BINDING_ACTIVE", "false")
        put("RITOMER_M12_EXPECTED_BINDING", "11111111-1111-4111-8111-111111111111")
      }
      if (mode == "reset-ab") {
        put("RITOMER_M12_SUBJECT_A", "123456789"); put("RITOMER_M12_SUBJECT_B", "987654321")
        put("RITOMER_M12_RESET_BINDING_A", "11111111-1111-4111-8111-111111111111")
        put("RITOMER_M12_RESET_BINDING_B", "22222222-2222-4222-8222-222222222222")
      }
    }
  }

  @Test
  fun `bad invocation or Cloud identity is rejected before any connection`() {
    val connector: (SharedCloudOperations.Configuration) -> Connection = { error("MUST_NOT_CONNECT") }
    for (args in listOf(emptyArray(), arrayOf("sql"), arrayOf("bootstrap", "extra")))
      assertThat(SharedCloudOperations.run(args, environment("bootstrap"), connector = connector).second).isEqualTo("CONFIGURATION_REJECTED")
    for ((key, value) in mapOf(
      "RITOMER_M12_PROJECT" to "other-project", "RITOMER_M12_INSTANCE" to "other-instance",
      "CLOUD_RUN_JOB" to "other-job", "CLOUD_RUN_TASK_INDEX" to "1", "CLOUD_RUN_TASK_ATTEMPT" to "1",
      "RITOMER_M12_HOST" to "127.0.0.1", "RITOMER_M12_PRIVATE_IP" to "34.1.2.3",
      "RITOMER_M12_DB_USER" to "postgres", "RITOMER_M12_CA_PATH" to "absent.pem",
      "RITOMER_M12_DB_PASSWORD" to "", "RITOMER_M12_DEADLINE_UTC" to Instant.now().minusSeconds(1).toString(),
      "K_SERVICE" to "ritomer-m12"
    )) assertThat(SharedCloudOperations.run(arrayOf("bootstrap"), environment("bootstrap").apply { put(key,value) }, connector = connector).second)
      .describedAs(key).isEqualTo("CONFIGURATION_REJECTED")
  }

  @Test
  fun `connection options are closed and configuration never renders private values`() {
    val config = SharedCloudOperations.Configuration.read("migrate", environment("migrate"))
    assertThat(config.toString()).isEqualTo("SharedCloudOperationConfiguration(REDACTED)")
    assertThat(config.url).isEqualTo("jdbc:postgresql://synthetic.europe-west6.sql.goog:5432/ritomer_m12")
    assertThat(config.connectionProperties().getProperty("sslmode")).isEqualTo("verify-full")
    assertThat(config.connectionProperties().getProperty("currentSchema")).isEqualTo("public")
    assertThat(config.connectionProperties().getProperty("logServerErrorDetail")).isEqualTo("false")
  }

  @Test
  fun `operator supports both official shared CA hostname suffixes with verify full`() {
    for (suffix in listOf("sql.goog", "sql-psa.goog")) {
      val host = "synthetic.europe-west6.$suffix"
      val config = SharedCloudOperations.Configuration.read("migrate", environment("migrate").apply {
        put("RITOMER_M12_HOST", host)
      })
      assertThat(config.url).isEqualTo("jdbc:postgresql://$host:5432/ritomer_m12")
      assertThat(config.connectionProperties().getProperty("sslmode")).isEqualTo("verify-full")
      assertThat(config.connectionProperties().getProperty("sslrootcert")).isEqualTo(directory.resolve("ca.pem").toString())
    }
  }

  @Test
  fun `operator preserves the exact absolute DNS name through JDBC and TLS configuration`() {
    for (suffix in listOf("sql.goog", "sql-psa.goog")) {
      val host = "synthetic.europe-west6.$suffix."
      val config = SharedCloudOperations.Configuration.read("bootstrap", environment("bootstrap").apply {
        put("RITOMER_M12_HOST", host)
      })
      assertThat(config.host).isEqualTo(host)
      assertThat(config.url).isEqualTo("jdbc:postgresql://$host:5432/postgres")
      assertThat(config.connectionProperties().getProperty("sslmode")).isEqualTo("verify-full")
      assertThat(config.connectionProperties().getProperty("sslrootcert")).isEqualTo(directory.resolve("ca.pem").toString())
      assertThat(config.connectionProperties()).doesNotContainKeys("sslfactory", "sslhostnameverifier")
    }
  }

  @Test
  fun `absolute operator hostname rejects empty labels invalid lengths and injected components before connecting`() {
    for (host in listOf("", ".synthetic.sql-psa.goog.", "a..b.sql-psa.goog.", "synthetic.sql.goog..",
      "synthetic.sql-psa.goog..", "-synthetic.sql.goog.", "synthetic-.sql.goog.", "synthetic .sql.goog.",
      "${"a".repeat(64)}.sql.goog.", "${"a".repeat(63)}.${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(63)}.sql.goog.",
      "synthetic.sql-psa.goog.invalid.", "user@synthetic.sql.goog.", "synthetic.sql.goog.:5432",
      "synthetic.sql.goog./postgres", "synthetic.sql.goog.?sslmode=require", "synthetic.sql.goog.#fragment")) {
      var connected = false
      val result = SharedCloudOperations.run(arrayOf("bootstrap"), environment("bootstrap").apply {
        put("RITOMER_M12_HOST", host)
      }) { connected = true; error("MUST_NOT_CONNECT") }
      assertThat(result.second).isEqualTo("CONFIGURATION_REJECTED")
      assertThat(connected).isFalse()
    }
  }

  @Test
  fun `managed PgJDBC verifier requires the same terminal point as the certificate DNS name`() {
    // Runtime dependency: exercise its real comparator without opening a connection.
    val type = Class.forName("org.postgresql.ssl.PGjdbcHostnameVerifier")
    val verifier = type.getField("INSTANCE").get(null)
    val compare = type.getMethod("verifyHostName", String::class.java, String::class.java)
    val host = "synthetic.europe-west6.sql-psa.goog"
    assertThat(compare.invoke(verifier, host, "$host.")).isEqualTo(false)
    assertThat(compare.invoke(verifier, "$host.", "$host.")).isEqualTo(true)
    assertThat(compare.invoke(verifier, host, host)).isEqualTo(true)
    assertThat(compare.invoke(verifier, "other.$host.", "$host.")).isEqualTo(false)
  }

  @Test
  fun `operator rejects PSA lookalikes and metacharacters before connecting`() {
    for (host in listOf("synthetic.europe-west6.sql-psa.goog.invalid", "synthetic.europe-west6.sql-psaXgoog",
      "synthetic.europe-west6.sql-other.goog", "127.0.0.1", "user@synthetic.europe-west6.sql-psa.goog",
      "synthetic.europe-west6.sql-psa.goog/path", "synthetic.europe-west6.sql-psa.goog?sslmode=disable")) {
      var connected = false
      val result = SharedCloudOperations.run(arrayOf("bootstrap"), environment("bootstrap").apply {
        put("RITOMER_M12_HOST", host)
      }) { connected = true; error("MUST_NOT_CONNECT") }
      assertThat(result.second).isEqualTo("CONFIGURATION_REJECTED")
      assertThat(connected).isFalse()
    }
  }

  @Test
  fun `bootstrap performs no table write creates database outside transaction and activates owner before ACL`() {
    val fixture = Fixture("bootstrap")
    assertThat(SharedCloudOperations.run(arrayOf("bootstrap"), environment("bootstrap")) { fixture.connection }.second).isEqualTo("PASS")
    assertThat(fixture.closed).isTrue()
    val commands = fixture.executed.map { it.first }
    assertThat(commands.indexOf("GRANT ritomer_m12_migrator TO ritomer_m12_bootstrap WITH SET TRUE, INHERIT FALSE"))
      .isLessThan(commands.indexOf("CREATE DATABASE ritomer_m12 OWNER ritomer_m12_migrator"))
    assertThat(commands.indexOf("SET ROLE ritomer_m12_migrator"))
      .isLessThan(commands.indexOf("REVOKE ALL ON DATABASE ritomer_m12 FROM PUBLIC"))
    assertThat(fixture.executed.single { it.first.startsWith("CREATE DATABASE") }.second).isTrue()
    assertThat(commands.joinToString()).doesNotContain("INSERT", "UPDATE", "DELETE", "ritomer_dbtest")
    assertThat(fixture.openStatements).isZero()
  }

  @Test
  fun `server identity compares the host address without the PostgreSQL text netmask`() {
    val fixture = Fixture("bootstrap")
    assertThat(SharedCloudOperations.run(arrayOf("bootstrap"), environment("bootstrap")) { fixture.connection }.second).isEqualTo("PASS")
    val identity = fixture.queried.single { it.startsWith("SELECT current_database()") }
    assertThat(identity).contains("host(inet_server_addr())").doesNotContain("inet_server_addr()::text")
    assertThat(fixture.closed).isTrue()
  }

  @Test
  fun `wrong target or existing resources fail before DDL and always close`() {
    for (fault in listOf("database", "user", "address", "address-prefix", "address-null", "address-blank", "version", "existing")) {
      val fixture = Fixture("bootstrap", fault)
      val result = SharedCloudOperations.run(arrayOf("bootstrap"), environment("bootstrap")) { fixture.connection }
      assertThat(result.second).describedAs(fault).isEqualTo("OPERATION_FAILED")
      assertThat(fixture.executed.none { it.first.startsWith("CREATE") || it.first.startsWith("GRANT") }).isTrue()
      assertThat(fixture.closed).isTrue()
      assertThat(fixture.openStatements).isZero()
    }
  }

  @Test
  fun `every Flyway connection is checked assumes migrator and closes on initialization failure`() {
    val config = SharedCloudOperations.Configuration.read("migrate", environment("migrate"))
    val connections = mutableListOf<Fixture>()
    val source = SharedCloudOperations.migratingDataSource(config) { Fixture("migrate").also(connections::add).connection }
    repeat(2) { source.connection.use { } }
    assertThat(connections).hasSize(2)
    connections.forEach { fixture ->
      assertThat(fixture.executed.map { it.first }).contains("SET ROLE ritomer_m12_migrator")
      assertThat(fixture.closed).isTrue()
    }
    assertThatThrownBy { source.getConnection("alternate", privateValue) }.hasMessage("ALTERNATE_CONNECTION_CONFIGURATION_REJECTED")
    assertThat(connections).hasSize(2)
    val wrong = Fixture("migrate", "membership")
    assertThatThrownBy { SharedCloudOperations.migratingDataSource(config) { wrong.connection }.connection }.isInstanceOf(IllegalArgumentException::class.java)
    assertThat(wrong.closed).isTrue()
  }

  @Test
  fun `Flyway load preserves quiet logger policy and fixed public schema without a database connection`() {
    var opened = false
    val config = SharedCloudOperations.Configuration.read("migrate", environment("migrate"))
    val flyway = SharedCloudOperations.migration(config) { opened = true; error("MUST_NOT_CONNECT") }
    assertThat(opened).isFalse()
    assertThat(flyway.configuration.defaultSchema).isEqualTo("public")
    assertThat(flyway.configuration.schemas).containsExactly("public")
    assertThat(flyway.configuration.isCreateSchemas).isFalse()
    assertThat(flyway.configuration.isCleanDisabled).isTrue()
    val bytes = java.io.ByteArrayOutputStream()
    val originalOut = System.out
    val originalErr = System.err
    try {
      System.setOut(java.io.PrintStream(bytes)); System.setErr(java.io.PrintStream(bytes))
      LogFactory.getLog(javaClass).error(privateValue, IllegalArgumentException(privateValue))
      LogFactory.getLog(javaClass).info(privateValue)
    } finally { System.setOut(originalOut); System.setErr(originalErr) }
    assertThat(bytes.toString()).isEmpty()
  }

  @Test
  fun `JDBC descendant handlers cannot emit and failures return only closed codes`() {
    val logger = Logger.getLogger("org.postgresql.synthetic.sentinel")
    var emitted = false
    val handler = object : Handler() {
      override fun publish(record: LogRecord?) { emitted = true }
      override fun flush() {}
      override fun close() {}
    }
    logger.addHandler(handler); logger.level = Level.ALL
    SharedCloudOperations.silenceLibraries()
    logger.severe(privateValue)
    assertThat(emitted).isFalse()
    assertThat(logger.handlers).isEmpty()
    assertThat(SharedCloudOperations.run(arrayOf("probe"), environment("probe")) { throw SQLException(privateValue) })
      .isEqualTo("probe" to "OPERATION_FAILED")
  }

  @Test
  fun `binding failure rolls back and expiry between inspection and mutation forbids writes`() {
    val fixture = Fixture("bind", "binding-write")
    val result = SharedCloudOperations.run(arrayOf("bind"), environment("bind")) { fixture.connection }
    assertThat(result.second).isEqualTo("OPERATION_FAILED")
    assertThat(fixture.rollbacks).isEqualTo(1)
    assertThat(fixture.commits).isZero()
    assertThat(fixture.closed).isTrue()
    val clock = MutableClock(Instant.now())
    val env = environment("bootstrap").apply { put("RITOMER_M12_DEADLINE_UTC", clock.instant().plusSeconds(60).toString()) }
    val config = SharedCloudOperations.Configuration.read("bootstrap", env, clock)
    val expiring = Fixture("bootstrap").apply { afterTarget = { clock.now = clock.instant().plusSeconds(120) } }
    assertThatThrownBy { SharedCloudOperations.execute("bootstrap", config) { expiring.connection } }
      .hasMessage("OPERATION_BUDGET_EXHAUSTED")
    assertThat(expiring.executed).isEmpty()
    assertThat(expiring.closed).isTrue()
  }

  @Test
  fun `runtime probe requires actual permission refusals and no Flyway history privilege`() {
    val valid = Fixture("probe")
    var tlsChecks = 0
    assertThat(SharedCloudOperations.run(arrayOf("probe"), environment("probe"), tlsProbe = { tlsChecks++ }) { valid.connection }.second).isEqualTo("PASS")
    assertThat(tlsChecks).isEqualTo(1)
    assertThat(valid.rollbacks).isEqualTo(6)
    assertThat(valid.closed).isTrue()
    for (fault in listOf("history-write", "wrong-sqlstate", "ddl-allowed")) {
      val fixture = Fixture("probe", fault)
      assertThat(SharedCloudOperations.run(arrayOf("probe"), environment("probe")) { fixture.connection }.second)
        .describedAs(fault).isEqualTo("OPERATION_FAILED")
      assertThat(fixture.closed).isTrue()
      assertThat(fixture.commits).isZero()
    }
  }

  @Test
  fun `revocation requires changed binding generation and rolls back if it does not rotate`() {
    val valid = Fixture("revoke")
    assertThat(SharedCloudOperations.run(arrayOf("revoke"), environment("revoke")) { valid.connection }.second).isEqualTo("PASS")
    assertThat(valid.commits).isEqualTo(1)
    assertThat(valid.executed.map { it.first }.filter { it.startsWith("UPDATE") }).hasSize(2)
    val stale = Fixture("revoke", "unchanged-generation")
    assertThat(SharedCloudOperations.run(arrayOf("revoke"), environment("revoke")) { stale.connection }.second).isEqualTo("OPERATION_FAILED")
    assertThat(stale.rollbacks).isEqualTo(1)
    assertThat(stale.commits).isZero()
    assertThat(stale.closed).isTrue()
  }

  @Test fun `closed reset deletes exact A B sessions and bindings and only restores memberships`() {
    val fixture = Fixture("reset-ab")
    assertThat(SharedCloudOperations.run(arrayOf("reset-ab"),environment("reset-ab")) { fixture.connection }.second).isEqualTo("PASS")
    assertThat(fixture.commits).isEqualTo(1); assertThat(fixture.rollbacks).isZero()
    val mutations = fixture.parameters.filter { it.first.startsWith("DELETE") || it.first.startsWith("UPDATE") }
    assertThat(mutations).hasSize(6)
    val sessionDeletes = mutations.filter { it.first.startsWith("DELETE FROM spring_session") }
    assertThat(sessionDeletes.map { it.second }).containsExactly(
      listOf("33333333-3333-4333-8333-333333333333", "55555555-5555-4555-8555-555555555555"),
      listOf("44444444-4444-4444-8444-444444444444", "66666666-6666-4666-8666-666666666666"))
    assertThat(mutations.all { it.first.contains("WHERE") }).isTrue()
    assertThat(mutations.none { it.first.contains("audit_event") || it.first.contains("closing_folder") || it.first.contains("app_user SET") }).isTrue()
    assertThat(fixture.executed.filter { it.first.startsWith("DELETE") || it.first.startsWith("UPDATE") }.all { !it.second }).isTrue()
  }

  @Test fun `reset refuses stale generation third identities and malformed session before deletion and rolls back partial failure`() {
    for (fault in listOf("reset-generation", "reset-third", "reset-third-session", "reset-second-delete")) {
      val fixture = Fixture("reset-ab",fault)
      assertThat(SharedCloudOperations.run(arrayOf("reset-ab"),environment("reset-ab")) { fixture.connection }.second)
        .describedAs(fault).isEqualTo("OPERATION_FAILED")
      assertThat(fixture.rollbacks).isEqualTo(1); assertThat(fixture.commits).isZero()
      if(fault != "reset-second-delete") assertThat(fixture.executed.none { it.first.startsWith("DELETE") || it.first.startsWith("UPDATE") }).isTrue()
    }
    for (env in listOf(environment("reset-ab").apply { remove("RITOMER_M12_SUBJECT_B") },
      environment("reset-ab").apply { put("RITOMER_M12_RESET_BINDING_B",getValue("RITOMER_M12_RESET_BINDING_A")) },
      environment("reset-ab").apply { put("RITOMER_M12_SUBJECT_B",getValue("RITOMER_M12_SUBJECT_A")) })) {
      assertThat(SharedCloudOperations.run(arrayOf("reset-ab"),env) { error("MUST_NOT_CONNECT") }.second).isEqualTo("CONFIGURATION_REJECTED")
    }
  }

  @Test fun `partial reset proves absent B and never mutates its binding or membership`() {
    val env = environment("reset-ab").apply { put("RITOMER_M12_RESET_BINDING_B", "ABSENT") }
    val fixture = Fixture("reset-ab", absentB = true)
    assertThat(SharedCloudOperations.run(arrayOf("reset-ab"), env) { fixture.connection }.second).isEqualTo("PASS")
    assertThat(fixture.commits).isEqualTo(1)
    val mutations = fixture.parameters.filter { it.first.startsWith("DELETE") || it.first.startsWith("UPDATE") }
    assertThat(mutations).hasSize(4)
    assertThat(mutations.none { DemoSeedLocalDataset.admin046bActor.userId in it.second }).isTrue()
    assertThat(mutations.none { it.first.contains("oidc_authorization_transaction") || it.first.contains("audit_event") }).isTrue()
    for (fault in listOf("reset-generation", "reset-third", "reset-third-session", "reset-first-binding-delete")) {
      val failed = Fixture("reset-ab", fault, absentB = true)
      assertThat(SharedCloudOperations.run(arrayOf("reset-ab"), env) { failed.connection }.second).describedAs(fault).isEqualTo("OPERATION_FAILED")
      assertThat(failed.commits).isZero(); assertThat(failed.rollbacks).isEqualTo(1)
      if(fault != "reset-first-binding-delete") assertThat(failed.executed.none { it.first.startsWith("DELETE") || it.first.startsWith("UPDATE") }).isTrue()
    }
    val presentB = Fixture("reset-ab")
    assertThat(SharedCloudOperations.run(arrayOf("reset-ab"), env) { presentB.connection }.second).isEqualTo("OPERATION_FAILED")
    assertThat(presentB.executed.none { it.first.startsWith("DELETE") || it.first.startsWith("UPDATE") }).isTrue()
    assertThat(SharedCloudOperations.run(arrayOf("reset-ab"), env.apply { put("RITOMER_M12_RESET_BINDING_A", "ABSENT") }) { error("MUST_NOT_CONNECT") }.second).isEqualTo("CONFIGURATION_REJECTED")
  }

  private fun tlsFailure(hostname: Boolean): SQLException {
    val stateType = Class.forName("org.postgresql.util.PSQLState")
    val state = stateType.enumConstants.single { (it as Enum<*>).name == "CONNECTION_FAILURE" }
    val cause = if (hostname) null else SSLHandshakeException(privateValue).apply {
      initCause(CertPathBuilderException(privateValue))
    }
    return (Class.forName("org.postgresql.util.PSQLException")
      .getConstructor(String::class.java, stateType, Throwable::class.java)
      .newInstance(privateValue, state, cause) as SQLException).apply {
      stackTrace = arrayOf(StackTraceElement("org.postgresql.ssl.MakeSSL", if (hostname) "verifyPeerName" else "convert", "MakeSSL.java", 1))
    }
  }

  @Test
  fun `TLS negatives distinguish handshake and hostname from parsing transport and authentication failures`() {
    assertThat(SharedCloudOperations.expectedTlsRejection(tlsFailure(true), true)).isTrue()
    assertThat(SharedCloudOperations.expectedTlsRejection(tlsFailure(false), false)).isTrue()
    assertThat(SharedCloudOperations.expectedTlsRejection(tlsFailure(true), false)).isFalse()
    assertThat(SharedCloudOperations.expectedTlsRejection(tlsFailure(false), true)).isFalse()
    assertThat(SharedCloudOperations.expectedTlsRejection(SQLException(privateValue, "08006"), false)).isFalse()
    val parse = tlsFailure(false).apply { stackTrace = arrayOf(StackTraceElement("org.postgresql.ssl.LibPQFactory", "<init>", "LibPQFactory.java", 1)) }
    assertThat(SharedCloudOperations.expectedTlsRejection(parse, false)).isFalse()
    val transport = tlsFailure(false).apply { stackTrace = arrayOf(StackTraceElement("org.postgresql.core.PGStream", "createSocket", "PGStream.java", 1)) }
    assertThat(SharedCloudOperations.expectedTlsRejection(transport, false)).isFalse()
  }

  @Test
  fun `TLS probe preserves credentials validates public wrong CA and always removes its temporary file`() {
    val config = SharedCloudOperations.Configuration.read("probe", environment("probe"))
    for (unexpected in listOf(false, true)) {
      var calls = 0
      var temporary: Path? = null
      val action = {
        SharedCloudOperations.verifyTls(config) { url, properties ->
          calls++
          assertThat(properties.getProperty("user")).isEqualTo(config.user)
          assertThat(properties.getProperty("password")).isEqualTo(privateValue)
          assertThat(properties.getProperty("sslmode")).isEqualTo("verify-full")
          if (calls == 1) {
            assertThat(url).isEqualTo("jdbc:postgresql://10.50.0.2:5432/ritomer_m12")
            assertThat(properties.getProperty("sslrootcert")).isEqualTo(config.ca.toString())
            throw tlsFailure(true)
          }
          assertThat(url).isEqualTo(config.url)
          temporary = Path.of(properties.getProperty("sslrootcert"))
          assertThat(Files.isRegularFile(temporary)).isTrue()
          if (unexpected) throw SQLException(privateValue, "08001")
          throw tlsFailure(false)
        }
      }
      if (unexpected) assertThatThrownBy { action() }.hasMessage("UNEXPECTED_TLS_FAILURE") else action()
      assertThat(calls).isEqualTo(2)
      assertThat(Files.exists(temporary)).isFalse()
    }
    val succeeded = Fixture("probe")
    assertThatThrownBy { SharedCloudOperations.verifyTls(config) { _, _ -> succeeded.connection } }
      .hasMessage("TLS_NEGATIVE_CONNECTION_SUCCEEDED")
    assertThat(succeeded.closed).isTrue()
    assertThat(succeeded.executed).isEmpty()
  }

  private class MutableClock(var now: Instant) : Clock() {
    override fun instant() = now
    override fun getZone(): ZoneId = ZoneOffset.UTC
    override fun withZone(zone: ZoneId): Clock = this
  }

  private class Fixture(val mode: String, val fault: String = "", val absentB: Boolean = false) {
    var closed = false
    var autoCommit = true
    var openStatements = 0
    var commits = 0
    var rollbacks = 0
    var afterTarget: () -> Unit = {}
    private var currentRole = when(mode) { "bootstrap" -> "ritomer_m12_bootstrap"; "probe" -> "ritomer_m12_runtime_login"; else -> "ritomer_m12_migrator_login" }
    private var generation = "11111111-1111-4111-8111-111111111111"
    private val resetDeletedActors = mutableSetOf<Any?>()
    private var resetDeletedSessions = 0
    val parameters = mutableListOf<Pair<String,List<Any?>>>()
    val executed = mutableListOf<Pair<String, Boolean>>()
    val queried = mutableListOf<String>()
    val connection = proxy(Connection::class.java) { method, args -> when(method) {
      "getAutoCommit" -> autoCommit
      "setAutoCommit" -> { autoCommit = args[0] as Boolean; null }
      "close" -> { closed = true; null }
      "isClosed" -> closed
      "commit" -> { commits++; null }
      "rollback" -> { rollbacks++; null }
      "createStatement" -> statement(null)
      "prepareStatement" -> statement(args[0] as String)
      else -> null
    } }
    private fun statement(prepared: String?): Statement {
      openStatements++
      val bound = sortedMapOf<Int,Any?>()
      return proxy(PreparedStatement::class.java) { method, args -> when(method) {
        "setObject", "setString", "setLong" -> { bound[args[0] as Int] = args[1]; null }
        "close" -> { openStatements--; null }
        "executeQuery" -> rows(query(prepared ?: args[0] as String,bound.values.toList()))
        "execute", "executeUpdate" -> {
          val sql = prepared ?: args[0] as String
          executed += sql to autoCommit
          parameters += sql to bound.values.toList()
          if (sql.startsWith("DELETE FROM spring_session")) resetDeletedSessions++
          if (sql.startsWith("DELETE FROM oidc_identity_binding")) {
            if(fault=="reset-first-binding-delete") throw SQLException("PRIVATE_ERROR")
            if(fault=="reset-second-delete" && resetDeletedActors.isNotEmpty()) throw SQLException("PRIVATE_ERROR")
            resetDeletedActors += bound[3]
          }
          if (mode == "probe" && (sql.startsWith("CREATE") || sql.startsWith("UPDATE") || sql.startsWith("DELETE") || sql == "SET ROLE ritomer_m12_migrator")) {
            if (fault != "ddl-allowed") throw SQLException("PRIVATE_ERROR", if (fault == "wrong-sqlstate") "42601" else "42501")
          }
          if (sql == "SET ROLE ritomer_m12_migrator") currentRole = "ritomer_m12_migrator"
          if (fault == "binding-write" && sql.startsWith("INSERT INTO oidc_identity_binding")) throw SQLException("PRIVATE_ERROR")
          if (sql.startsWith("UPDATE oidc_identity_binding") && fault != "unchanged-generation") generation = "22222222-2222-4222-8222-222222222222"
          if (method == "execute") false else 1
        }
        else -> null
      } }
    }
    private fun query(sql: String, bound: List<Any?> = emptyList()): List<List<Any?>> {
      queried += sql
      return when {
      mode=="reset-ab" && sql.contains("FROM spring_session s") -> listOf("A","B").map { label ->
        val selected = if(label=="A") DemoSeedLocalDataset.accountantActor else DemoSeedLocalDataset.admin046bActor
        val correlation = if(label=="A") "77777777-7777-4777-8777-777777777777" else "88888888-8888-4888-8888-888888888888"
        val principal = AuthenticatedActor(if(fault=="reset-third-session") UUID.randomUUID() else selected.userId,
          AuthenticationMechanism.OIDC,Instant.now(),correlation,UUID.randomUUID())
        val bytes = ByteArrayOutputStream().use { output -> ObjectOutputStream(output).use { it.writeObject(SecurityContextImpl(AuthenticatedActorAuthentication.fromValidatedActor(principal))) }; output.toByteArray() }
        listOf(if(label=="A") "33333333-3333-4333-8333-333333333333" else "44444444-4444-4444-8444-444444444444",
          if(label=="A") "55555555-5555-4555-8555-555555555555" else "66666666-6666-4666-8666-666666666666",correlation,bytes.size,bytes)
      }
      mode=="reset-ab" && sql.startsWith("SELECT count(*)") && sql.contains("NOT IN") -> listOf(listOf(if(fault=="reset-third") "1" else "0"))
      mode=="reset-ab" && sql.startsWith("SELECT count(*)") && sql.contains("FROM tenant_membership") -> listOf(listOf("1"))
      mode=="reset-ab" && sql.startsWith("SELECT count(*)") && sql.contains("FROM spring_session_attributes") -> listOf(listOf((2-resetDeletedSessions).toString()))
      mode=="reset-ab" && sql.startsWith("SELECT count(*)") && sql.contains("FROM oidc_identity_binding") ->
        listOf(listOf(if((fault=="reset-generation" && sql.contains("WHERE id=?")) || bound.singleOrNull() in resetDeletedActors || absentB && bound.singleOrNull()==DemoSeedLocalDataset.admin046bActor.userId) "0" else "1"))
      sql.startsWith("SELECT current_database()") -> listOf(listOf(
        if (fault == "database") "other" else if (mode == "bootstrap") "postgres" else "ritomer_m12",
        if (fault == "user") "other" else when(mode) { "bootstrap" -> "ritomer_m12_bootstrap"; "probe" -> "ritomer_m12_runtime_login"; else -> "ritomer_m12_migrator_login" },
        currentRole, when {
          fault == "address" -> "10.50.0.3"
          fault == "address-null" -> null
          fault == "address-blank" -> ""
          fault == "address-prefix" || sql.contains("inet_server_addr()::text") -> "10.50.0.2/32"
          else -> "10.50.0.2"
        }, if (fault == "version") 160009 else 170006
      )).also { afterTarget() }
      sql == "SELECT current_user" -> listOf(listOf(currentRole))
      sql.startsWith("SELECT pg_get_userbyid") -> listOf(listOf("ritomer_m12_migrator"))
      sql.startsWith("SELECT ssl::text") || sql.startsWith("SELECT (NOT rol") -> listOf(listOf("true"))
      sql.startsWith("SELECT pg_has_role") || sql.startsWith("SELECT has_database_privilege") || sql.startsWith("SELECT has_schema_privilege") -> listOf(listOf("false"))
      sql.startsWith("SELECT has_table_privilege") -> {
        val parts = Regex("'public\\.([^']+)', '([^']+)'").find(sql)!!.groupValues
        val allowed = if (parts[1] == "flyway_schema_history") fault == "history-write" && parts[2] == "UPDATE"
          else parts[2] in SharedCloudOperations.runtimeGrants.getValue(parts[1]).split(", ")
        listOf(listOf(allowed.toString()))
      }
      sql.startsWith("SELECT id::text FROM oidc_identity_binding") -> listOf(listOf(generation))
      sql.contains("FROM pg_auth_members") -> listOf(listOf(if (sql.contains("rolname=?") && !sql.contains("JOIN")) "0" else if (fault == "membership") "2" else "1"))
      sql.startsWith("SELECT version, success") -> (1..11).map { listOf(it.toString(), true) }
      sql.startsWith("SELECT tablename, tableowner") -> (SharedCloudOperations.runtimeGrants.keys + "flyway_schema_history").map { listOf(it, "ritomer_m12_migrator") }
      sql.startsWith("SELECT count(*)") -> listOf(listOf(if (fault == "existing" && sql.contains("pg_roles")) "1" else "0"))
      else -> error("UNEXPECTED_QUERY")
      }
    }
    private fun rows(values: List<List<Any?>>): ResultSet {
      var index = -1
      return proxy(ResultSet::class.java) { method, args -> when(method) {
        "next" -> { index++; index < values.size }
        "getString" -> values[index][(args[0] as Int) - 1]?.toString()
        "getInt", "getBoolean", "getLong" -> values[index][(args[0] as Int) - 1]
        "getBytes" -> (values[index][(args[0] as Int) - 1] as ByteArray).copyOf()
        else -> null
      } }
    }
    companion object {
      @Suppress("UNCHECKED_CAST")
      private fun <T> proxy(type: Class<T>, handler: (String, Array<out Any?>) -> Any?): T =
        Proxy.newProxyInstance(type.classLoader, arrayOf(type)) { _, method, args -> handler(method.name, args ?: emptyArray()) } as T
    }
  }
}
