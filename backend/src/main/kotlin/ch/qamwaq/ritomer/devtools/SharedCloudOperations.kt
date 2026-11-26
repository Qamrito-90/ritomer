package ch.qamwaq.ritomer.devtools

import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DriverManager
import java.sql.SQLException
import java.time.Instant
import java.time.Clock
import java.time.Duration
import java.util.Properties
import java.util.UUID
import java.util.logging.Level
import java.util.logging.Logger
import java.util.logging.LogManager
import java.util.Collections
import java.security.KeyStore
import java.security.MessageDigest
import java.security.cert.CertificateFactory
import java.security.cert.CertPathBuilderException
import java.security.cert.CertPathValidatorException
import java.security.cert.PKIXReason
import java.security.cert.X509Certificate
import javax.net.ssl.SSLHandshakeException
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.logging.Log
import org.flywaydb.core.api.logging.LogFactory
import org.springframework.jdbc.datasource.AbstractDataSource
import javax.sql.DataSource
import kotlin.system.exitProcess

/** Explicit Cloud Job entrypoint. No Spring context, servlet, automatic profile or SQL supplied by callers. */
object SharedCloudOperations {
  const val DATABASE = "ritomer_m12"
  const val MIGRATOR = "ritomer_m12_migrator"
  const val RUNTIME = "ritomer_m12_runtime"
  const val BOOTSTRAP = "ritomer_m12_bootstrap"
  private val modes = setOf("bootstrap", "migrate", "bind", "revoke", "reset-ab", "probe")
  private val noLog = object : Log {
    override fun isDebugEnabled() = false
    override fun debug(message: String?) {}
    override fun info(message: String?) {}
    override fun warn(message: String?) {}
    override fun error(message: String?) {}
    override fun error(message: String?, exception: Exception?) {}
    override fun notice(message: String?) {}
  }

  @JvmStatic fun main(args: Array<String>) {
    val result = run(args, System.getenv(), connector = ::connect)
    // No caught exception, SQL, identity, connection property or provider value reaches stdout.
    println("{\"operation\":\"${result.first}\",\"status\":\"${result.second}\"}")
    exitProcess(if (result.second == "PASS") 0 else 1)
  }

  internal fun run(args: Array<String>, environment: Map<String, String>,
    tlsProbe: (Configuration) -> Unit = { verifyTls(it) }, connector: (Configuration) -> Connection): Pair<String, String> {
    val mode = args.singleOrNull()?.takeIf { it in modes } ?: return "INVALID" to "CONFIGURATION_REJECTED"
    return try {
      silenceLibraries()
      val config = Configuration.read(mode, environment)
      execute(mode, config, tlsProbe, connector)
      mode to "PASS"
    } catch (_: ConfigurationRejected) { mode to "CONFIGURATION_REJECTED" }
      catch (_: Exception) { mode to "OPERATION_FAILED" }
  }

  internal fun silenceLibraries() {
    val manager = LogManager.getLogManager()
    val names = Collections.list(manager.loggerNames).filter { it == "org.postgresql" || it.startsWith("org.postgresql.") } + "org.postgresql"
    names.distinct().forEach { name ->
      Logger.getLogger(name).apply { level = Level.OFF; useParentHandlers = false; handlers.forEach(::removeHandler) }
    }
    LogFactory.setLogCreator { noLog }
    LogFactory.setFallbackLogCreator { noLog }
  }

  internal class Configuration private constructor(
    val mode: String, val host: String, val address: String, val ca: Path, val user: String,
    private val password: String, val deadline: Instant, val subject: String?, val label: String?, val active: Boolean,
    private val clock: Clock, internal val resetBindings: List<ResetBinding>, internal val expectedBinding: UUID?
  ) {
    val database get() = if (mode == "bootstrap") "postgres" else DATABASE
    val url get() = "jdbc:postgresql://$host:5432/$database"
    fun connectionProperties() = Properties().apply {
      setProperty("user", user); setProperty("password", password)
      setProperty("sslmode", "verify-full"); setProperty("sslrootcert", ca.toString())
      setProperty("connectTimeout", "10"); setProperty("socketTimeout", "30")
      setProperty("logServerErrorDetail", "false"); setProperty("ApplicationName", "ritomer-m12-ops")
      setProperty("currentSchema", "public")
    }
    fun withinBudget() { require(clock.instant().isBefore(deadline)) { "OPERATION_BUDGET_EXHAUSTED" } }
    fun remainingSeconds(): Int {
      withinBudget()
      val remaining = Duration.between(clock.instant(), deadline).seconds
      require(remaining >= 1) { "OPERATION_BUDGET_EXHAUSTED" }
      return remaining.coerceAtMost(30).toInt()
    }
    override fun toString() = "SharedCloudOperationConfiguration(REDACTED)"

    companion object {
      fun read(mode: String, env: Map<String, String>, clock: Clock = Clock.systemUTC()): Configuration = try {
        require(mode in modes)
        require(env["RITOMER_M12_PROJECT"] == "project-74f86561-bbba-4eb0-aa6")
        require(env["RITOMER_M12_INSTANCE"] == "free-trial-first-project")
        require(env["CLOUD_RUN_JOB"] == "ritomer-m12-ops")
        require(env["CLOUD_RUN_TASK_INDEX"] == "0" && env["CLOUD_RUN_TASK_ATTEMPT"] == "0")
        require(env["K_SERVICE"] == null)
        val host = env.getValue("RITOMER_M12_HOST")
        require(host.length <= (if (host.endsWith('.')) 254 else 253))
        require(host.matches(Regex("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+sql(?:-psa)?\\.goog\\.?")))
        val address = env.getValue("RITOMER_M12_PRIVATE_IP")
        val octets = address.split('.').map { it.toInt() }
        require(octets.size == 4 && octets.all { it in 0..255 } &&
          (octets[0] == 10 || (octets[0] == 172 && octets[1] in 16..31) || (octets[0] == 192 && octets[1] == 168)))
        require(octets.joinToString(".") == address)
        val ca = Path.of(env.getValue("RITOMER_M12_CA_PATH"))
        require(ca.isAbsolute && Files.isRegularFile(ca) && Files.isReadable(ca))
        val user = when { mode == "bootstrap" -> BOOTSTRAP; mode == "probe" -> "${RUNTIME}_login"; else -> "${MIGRATOR}_login" }
        require(env["RITOMER_M12_DB_USER"] == user)
        val password = env.getValue("RITOMER_M12_DB_PASSWORD")
        require(password.isNotBlank() && password.length <= 256)
        val deadline = Instant.parse(env.getValue("RITOMER_M12_DEADLINE_UTC"))
        require(deadline.isAfter(clock.instant()) && !deadline.isAfter(clock.instant().plusSeconds(600)))
        val label = env["RITOMER_M12_ACTOR"]
        val subject = env["RITOMER_M12_SUBJECT"]
        if (mode in setOf("bind", "revoke")) require(label in setOf("A", "B")) else require(label == null)
        if (mode == "bind") require(subject != null && subject.matches(Regex("[0-9]{1,255}"))) else require(subject == null)
        val active = env["RITOMER_M12_BINDING_ACTIVE"]
        if (mode == "revoke") require(active in setOf("true", "false")) else require(active == null)
        val expectedBinding = if(mode=="revoke") UUID.fromString(env.getValue("RITOMER_M12_EXPECTED_BINDING")) else {
          require(env["RITOMER_M12_EXPECTED_BINDING"] == null); null
        }
        val resetBindings = if (mode == "reset-ab") listOf("A", "B").map { resetLabel ->
          val resetSubject = env.getValue("RITOMER_M12_SUBJECT_$resetLabel")
          require(resetSubject.matches(Regex("[0-9]{1,255}")))
          val expectedGeneration = env.getValue("RITOMER_M12_RESET_BINDING_$resetLabel")
          ResetBinding(resetLabel, if (resetLabel == "B" && expectedGeneration == "ABSENT") null else UUID.fromString(expectedGeneration), resetSubject)
        }.also { require(it[0].generation != it[1].generation && it[0].subject != it[1].subject) } else {
          require(listOf("A", "B").none { env.containsKey("RITOMER_M12_SUBJECT_$it") || env.containsKey("RITOMER_M12_RESET_BINDING_$it") })
          emptyList()
        }
        Configuration(mode, host, address, ca, user, password, deadline, subject, label, active == "true", clock, resetBindings, expectedBinding)
      } catch (_: Exception) { throw ConfigurationRejected() }
    }
  }

  internal class ResetBinding(val label: String, val generation: UUID?, val subject: String) {
    override fun toString() = "ResetBinding(REDACTED)"
  }

  private class ConfigurationRejected : RuntimeException("CONFIGURATION_REJECTED")
  private fun connect(config: Configuration): Connection = DriverManager.getConnection(config.url, config.connectionProperties())

  internal fun execute(mode: String, config: Configuration,
    tlsProbe: (Configuration) -> Unit = { verifyTls(it) },
    connector: (Configuration) -> Connection) {
    config.withinBudget()
    connector(config).use { connection ->
      assertTarget(connection, config)
      if (mode == "bootstrap") bootstrap(connection, config)
      else {
        if (mode != "probe") {
          executeSql(connection, config, "SET ROLE $MIGRATOR")
          require(scalar(connection, config, "SELECT current_user") == MIGRATOR)
        }
        when (mode) {
          "migrate" -> {
            migration(config, connector).migrate()
            config.withinBudget()
            assertSchema(connection, config)
            transaction(connection, config) { grantRuntime(connection, config); seedIdentities(connection, config) }
          }
          "bind" -> transaction(connection, config) { assertSchema(connection, config); bind(connection, config) }
          "revoke" -> transaction(connection, config) { assertSchema(connection, config); revoke(connection, config) }
          "reset-ab" -> transaction(connection, config) { assertSchema(connection, config); resetBindings(connection, config) }
          "probe" -> probe(connection, config)
          else -> error("MODE_REJECTED")
        }
      }
      config.withinBudget()
    }
    if (mode == "probe") {
      tlsProbe(config)
      config.withinBudget()
      connector(config).use { assertTarget(it, config) }
    }
  }

  /** A network/parse/authentication error is never accepted as a TLS rejection. */
  internal fun expectedTlsRejection(failure: SQLException, hostname: Boolean): Boolean {
    if (failure.javaClass.name != "org.postgresql.util.PSQLException" || failure.sqlState != "08006") return false
    val source = failure.stackTrace.firstOrNull() ?: return false
    if (source.className != "org.postgresql.ssl.MakeSSL") return false
    if (hostname) return source.methodName == "verifyPeerName" && failure.cause == null
    if (source.methodName != "convert" || failure.cause !is SSLHandshakeException) return false
    var cause: Throwable? = failure.cause
    repeat(12) {
      val current = cause ?: return false
      if (current is CertPathBuilderException ||
        current is CertPathValidatorException && current.reason == PKIXReason.NO_TRUST_ANCHOR) return true
      cause = current.cause
    }
    return false
  }

  internal fun verifyTls(config: Configuration,
    open: (String, Properties) -> Connection = { url, props -> DriverManager.getConnection(url, props) }) {
    require(config.mode == "probe")
    fun rejected(url: String, properties: Properties, hostname: Boolean) {
      config.withinBudget()
      try { open(url, properties).use { } }
      catch (failure: SQLException) {
        require(expectedTlsRejection(failure, hostname)) { "UNEXPECTED_TLS_FAILURE" }
        return
      }
      error("TLS_NEGATIVE_CONNECTION_SUCCEEDED")
    }
    rejected("jdbc:postgresql://${config.address}:5432/$DATABASE", config.connectionProperties(), true)
    // Public trust anchor, deliberately unrelated to the Google Cloud SQL chain. No private key or secret.
    val fingerprint = "96bcec06264976f37460779acf28c5a7cfe8a3c0aae11a8ffcee05c0bddf08c6"
    fun digest(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    val store = KeyStore.getInstance(Path.of(System.getProperty("java.home"), "lib", "security", "cacerts").toFile(), null as CharArray?)
    val certificate = Collections.list(store.aliases()).mapNotNull { store.getCertificate(it) as? X509Certificate }
      .filter { digest(it.encoded) == fingerprint }.single()
    require(certificate.basicConstraints >= 0)
    certificate.checkValidity()
    val temporary = Files.createTempFile("ritomer-m12-untrusted-ca-", ".crt")
    try {
      Files.write(temporary, certificate.encoded)
      val reread = Files.newInputStream(temporary).use { CertificateFactory.getInstance("X.509").generateCertificate(it) }
      require(digest(reread.encoded) == fingerprint)
      rejected(config.url, config.connectionProperties().apply { setProperty("sslrootcert", temporary.toString()) }, false)
    } finally { Files.deleteIfExists(temporary) }
  }

  internal fun migration(config: Configuration, connector: (Configuration) -> Connection): Flyway {
    silenceLibraries()
    return Flyway.configure().dataSource(migratingDataSource(config, connector))
      // Flyway resets LogFactory at load(); console deliberately selects our silent fallback.
      .loggers("console").locations("classpath:db/migration").cleanDisabled(true).validateOnMigrate(true)
      .schemas("public").defaultSchema("public").createSchemas(false)
      .baselineOnMigrate(false).outOfOrder(false).load()
  }

  /** Every Flyway connection, including metadata connections, is checked and assumes the NOLOGIN owner. */
  internal fun migratingDataSource(config: Configuration, connector: (Configuration) -> Connection): DataSource = object : AbstractDataSource() {
    override fun getConnection(): Connection {
      config.withinBudget()
      val connection = connector(config)
      try {
        assertTarget(connection, config)
        executeSql(connection, config, "SET ROLE $MIGRATOR")
        require(scalar(connection, config, "SELECT current_user") == MIGRATOR)
        return connection
      } catch (failure: Exception) {
        try { connection.close() } catch (_: Exception) { }
        throw failure
      }
    }
    override fun getConnection(username: String?, password: String?): Connection =
      throw SQLException("ALTERNATE_CONNECTION_CONFIGURATION_REJECTED")
  }

  private fun assertTarget(connection: Connection, config: Configuration) {
    require(connection.autoCommit)
    connection.prepareStatement("SELECT current_database(), session_user, current_user, host(inet_server_addr()), current_setting('server_version_num')::int").use { statement ->
      statement.queryTimeout = config.remainingSeconds()
      statement.executeQuery().use { rows ->
        require(rows.next() && rows.getString(1) == config.database && rows.getString(2) == config.user &&
          rows.getString(3) == config.user && rows.getString(4) == config.address && rows.getInt(5) in 170000..179999)
        require(!rows.next())
      }
    }
    require(scalar(connection, config, "SELECT ssl::text FROM pg_stat_ssl WHERE pid=pg_backend_pid()") == "true")
    executeSql(connection, config, "SET statement_timeout='30s'")
    executeSql(connection, config, "SET lock_timeout='5s'")
    if (config.mode != "bootstrap") {
      require(scalar(connection, config, "SELECT (NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)::text FROM pg_roles WHERE rolname=session_user") == "true")
      require(scalar(connection, config, "SELECT pg_has_role(session_user, 'cloudsqlsuperuser', 'MEMBER')::text") == "false")
      val expectedRole = if (config.mode == "probe") RUNTIME else MIGRATOR
      require(scalar(connection, config, "SELECT count(*)::text FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=session_user)") == "1")
      require(scalar(connection, config, "SELECT count(*)::text FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE m.member=(SELECT oid FROM pg_roles WHERE rolname=session_user) AND r.rolname=? AND NOT m.admin_option AND m.inherit_option AND m.set_option", expectedRole) == "1")
      for (role in listOf(MIGRATOR, RUNTIME)) {
        require(scalar(connection, config, "SELECT count(*)::text FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname=?)", role) == "0")
      }
    }
  }

  private fun bootstrap(connection: Connection, config: Configuration) {
    // Only role/catalog/database DDL on postgres; never any historical application table.
    // A partial previous execution needs an exact reviewed recovery, never implicit adoption by name.
    require(scalar(connection, config, "SELECT count(*)::text FROM pg_roles WHERE rolname IN ('$MIGRATOR', '$RUNTIME')") == "0")
    require(scalar(connection, config, "SELECT count(*)::text FROM pg_database WHERE datname='$DATABASE'") == "0")
    for (role in listOf(MIGRATOR, RUNTIME)) {
      executeSql(connection, config, "CREATE ROLE $role NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS")
      require(scalar(connection, config, "SELECT (NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication AND NOT rolbypassrls)::text FROM pg_roles WHERE rolname='$role'") == "true")
    }
    executeSql(connection, config, "GRANT $MIGRATOR TO $BOOTSTRAP WITH SET TRUE, INHERIT FALSE")
    require(connection.autoCommit)
    executeSql(connection, config, "CREATE DATABASE $DATABASE OWNER $MIGRATOR")
    require(scalar(connection, config, "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='$DATABASE'") == MIGRATOR)
    executeSql(connection, config, "SET ROLE $MIGRATOR")
    require(scalar(connection, config, "SELECT current_user") == MIGRATOR)
    executeSql(connection, config, "REVOKE ALL ON DATABASE $DATABASE FROM PUBLIC")
    executeSql(connection, config, "GRANT CONNECT ON DATABASE $DATABASE TO $MIGRATOR, $RUNTIME")
    require(scalar(connection, config, "SELECT has_database_privilege('$RUNTIME', '$DATABASE', 'TEMPORARY')::text") == "false")
  }

  internal val runtimeGrants = linkedMapOf(
    "tenant" to "SELECT", "app_user" to "SELECT", "tenant_membership" to "SELECT", "oidc_identity_binding" to "SELECT",
    "audit_event" to "SELECT, INSERT", "export_pack" to "SELECT, INSERT", "balance_import" to "SELECT, INSERT",
    "balance_import_line" to "SELECT, INSERT", "document" to "SELECT, INSERT",
    "closing_folder" to "SELECT, INSERT, UPDATE", "workpaper" to "SELECT, INSERT, UPDATE",
    "document_verification" to "SELECT, INSERT, UPDATE", "mapping_suggestion_decision_request" to "SELECT, INSERT, UPDATE",
    "manual_mapping" to "SELECT, INSERT, UPDATE, DELETE", "workpaper_evidence" to "SELECT, INSERT, DELETE",
    "spring_session" to "SELECT, INSERT, UPDATE, DELETE", "spring_session_attributes" to "SELECT, INSERT, UPDATE, DELETE",
    "oidc_authorization_transaction" to "SELECT, INSERT, UPDATE, DELETE"
  )

  private fun assertSchema(connection: Connection, config: Configuration) {
    connection.prepareStatement("SELECT version, success FROM public.flyway_schema_history ORDER BY installed_rank").use { statement ->
      statement.queryTimeout = config.remainingSeconds()
      statement.executeQuery().use { rows ->
        for (version in 1..11) require(rows.next() && rows.getString(1) == version.toString() && rows.getBoolean(2))
        require(!rows.next())
      }
    }
    val expected = runtimeGrants.keys + "flyway_schema_history"
    val tables = mutableSetOf<String>()
    connection.prepareStatement("SELECT tablename, tableowner FROM pg_tables WHERE schemaname='public'").use { statement ->
      statement.queryTimeout = config.remainingSeconds()
      statement.executeQuery().use { rows -> while (rows.next()) {
        require(rows.getString(2) == MIGRATOR); tables += rows.getString(1)
      } }
    }
    require(tables == expected.toSet())
    require(scalar(connection, config, "SELECT count(*)::text FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='public' AND relkind='S'") == "0")
  }

  private fun grantRuntime(connection: Connection, config: Configuration) {
    executeSql(connection, config, "REVOKE ALL ON SCHEMA public FROM PUBLIC")
    executeSql(connection, config, "GRANT USAGE ON SCHEMA public TO $RUNTIME")
    executeSql(connection, config, "REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, $RUNTIME")
    executeSql(connection, config, "REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, $RUNTIME")
    executeSql(connection, config, "ALTER DEFAULT PRIVILEGES FOR ROLE $MIGRATOR IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, $RUNTIME")
    executeSql(connection, config, "ALTER DEFAULT PRIVILEGES FOR ROLE $MIGRATOR IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, $RUNTIME")
    executeSql(connection, config, "ALTER DEFAULT PRIVILEGES FOR ROLE $MIGRATOR REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC")
    runtimeGrants.forEach { (table, privileges) -> executeSql(connection, config, "GRANT $privileges ON TABLE public.$table TO $RUNTIME") }
  }

  internal val tenantB: UUID = UUID.fromString("047c0000-0000-4000-8000-000000000001")
  private fun actor(label: String?) = when (label) { "A" -> DemoSeedLocalDataset.accountantActor; "B" -> DemoSeedLocalDataset.admin046bActor; else -> error("ACTOR_REJECTED") }
  private fun seedIdentities(connection: Connection, config: Configuration) {
    // Fixed synthetic tenants and actors only. Closing folders are created later through the business API.
    for (label in listOf("A", "B")) {
      val actor = actor(label)
      val tenant = if (label == "A") DemoSeedLocalDataset.tenantId else tenantB
      val slug = if (label == "A") DemoSeedLocalDataset.tenantSlug else "ritomer-m12-b-synthetic"
      val name = if (label == "A") DemoSeedLocalDataset.tenantLegalName else "Ritomer M12 B (synthetic)"
      update(connection, config, "INSERT INTO tenant(id,slug,legal_name) VALUES (?,?,?) ON CONFLICT DO NOTHING", tenant, slug, name)
      require(scalar(connection, config, "SELECT count(*)::text FROM tenant WHERE id=? AND slug=? AND legal_name=? AND status='ACTIVE'", tenant, slug, name) == "1")
      update(connection, config, "INSERT INTO app_user(id,external_subject,email,display_name) VALUES (?,?,?,?) ON CONFLICT DO NOTHING", actor.userId, actor.externalSubject, actor.email, actor.displayName)
      require(scalar(connection, config, "SELECT count(*)::text FROM app_user WHERE id=? AND external_subject=? AND email=? AND display_name=? AND status='ACTIVE'", actor.userId, actor.externalSubject, actor.email, actor.displayName) == "1")
      update(connection, config, "INSERT INTO tenant_membership(id,tenant_id,user_id,role_code) VALUES (?,?,?,?) ON CONFLICT DO NOTHING", actor.membershipId, tenant, actor.userId, actor.membershipRole)
      require(scalar(connection, config, "SELECT count(*)::text FROM tenant_membership WHERE id=? AND tenant_id=? AND user_id=? AND role_code=? AND status='ACTIVE'", actor.membershipId, tenant, actor.userId, actor.membershipRole) == "1")
      require(scalar(connection, config, "SELECT count(*)::text FROM tenant_membership WHERE user_id=?", actor.userId) == "1")
    }
  }

  private fun bind(connection: Connection, config: Configuration) {
    val actor = actor(config.label)
    require(scalar(connection, config, "SELECT count(*)::text FROM oidc_identity_binding WHERE app_user_id=?", actor.userId) == "0")
    require(update(connection, config, "INSERT INTO oidc_identity_binding(issuer,subject,app_user_id) VALUES ('https://accounts.google.com',?,?)", config.subject, actor.userId) == 1)
  }

  private fun revoke(connection: Connection, config: Configuration) {
    val actor = actor(config.label)
    val old = scalar(connection, config, "SELECT id::text FROM oidc_identity_binding WHERE id=? AND app_user_id=? AND issuer='https://accounts.google.com' AND active=?", config.expectedBinding, actor.userId, !config.active)
    require(old == config.expectedBinding.toString())
    require(update(connection, config, "UPDATE oidc_identity_binding SET active=? WHERE id=? AND app_user_id=? AND issuer='https://accounts.google.com' AND active=?", config.active, config.expectedBinding, actor.userId, !config.active) == 1)
    require(update(connection, config, "UPDATE tenant_membership SET status=?, updated_at=current_timestamp WHERE id=? AND user_id=?", if (config.active) "ACTIVE" else "INACTIVE", actor.membershipId, actor.userId) == 1)
    require(scalar(connection, config, "SELECT id::text FROM oidc_identity_binding WHERE app_user_id=?", actor.userId) != old)
  }

  /** Closed trial recovery: exact A/B bindings (or verified absent B), authenticated sessions and memberships only. */
  internal fun resetBindings(connection: Connection, config: Configuration) {
    require(config.mode == "reset-ab" && !connection.autoCommit && config.resetBindings.size == 2)
    // Prevent a concurrent login/bind from slipping between the snapshot, deletion and zero readback.
    executeSql(connection, config, "LOCK TABLE oidc_identity_binding, spring_session, spring_session_attributes, tenant_membership IN SHARE ROW EXCLUSIVE MODE")
    val actorA = actor("A"); val actorB = actor("B")
    require(scalar(connection, config, "SELECT count(*)::text FROM app_user WHERE id NOT IN (?,?)", actorA.userId, actorB.userId) == "0")
    require(scalar(connection, config, "SELECT count(*)::text FROM oidc_identity_binding WHERE app_user_id NOT IN (?,?)", actorA.userId, actorB.userId) == "0")
    for (expected in config.resetBindings) {
      val selected = actor(expected.label)
      if (expected.generation == null) {
        require(expected.label == "B")
        require(scalar(connection, config, "SELECT count(*)::text FROM oidc_identity_binding WHERE app_user_id=?", selected.userId) == "0")
        require(scalar(connection, config, "SELECT count(*)::text FROM tenant_membership WHERE id=? AND user_id=? AND role_code=? AND status='ACTIVE'",
          selected.membershipId, selected.userId, selected.membershipRole) == "1")
        require(scalar(connection, config, "SELECT count(*)::text FROM tenant_membership WHERE user_id=?", selected.userId) == "1")
        continue
      }
      require(scalar(connection, config, "SELECT count(*)::text FROM oidc_identity_binding WHERE id=? AND issuer='https://accounts.google.com' AND subject=? AND app_user_id=?",
        expected.generation, expected.subject, selected.userId) == "1")
      require(scalar(connection, config, "SELECT count(*)::text FROM oidc_identity_binding WHERE app_user_id=?", selected.userId) == "1")
      require(scalar(connection, config, "SELECT count(*)::text FROM tenant_membership WHERE id=? AND user_id=? AND role_code=? AND status IN ('ACTIVE','INACTIVE')",
        selected.membershipId, selected.userId, selected.membershipRole) == "1")
      require(scalar(connection, config, "SELECT count(*)::text FROM tenant_membership WHERE user_id=?", selected.userId) == "1")
    }
    val sessions = mutableListOf<Pair<String, String>>()
    connection.prepareStatement("""
      SELECT s.primary_id,s.session_id,s.principal_name,octet_length(a.attribute_bytes),
             CASE WHEN octet_length(a.attribute_bytes)<=16384 THEN a.attribute_bytes ELSE NULL END
      FROM spring_session s JOIN spring_session_attributes a ON a.session_primary_id=s.primary_id
      WHERE a.attribute_name='SPRING_SECURITY_CONTEXT' ORDER BY s.primary_id LIMIT 65
    """.trimIndent()).use { statement ->
      statement.queryTimeout = config.remainingSeconds()
      statement.executeQuery().use { rows ->
        while (rows.next()) {
          require(sessions.size < 64 && rows.getInt(4) in 1..16384) { "RESET_SESSION_REJECTED" }
          val bytes = rows.getBytes(5)
          val principal = try { SharedSessionResetContext.decodeContext(bytes) } finally { bytes.fill(0) }
          require(rows.getString(3) == principal.opaqueAuthCorrelation) { "RESET_SESSION_REJECTED" }
          // Old binding generations are deliberately accepted here: their exact contexts are invalidated, never revived.
          require(principal.actorId in setOf(actorA.userId, actorB.userId)) { "RESET_SESSION_REJECTED" }
          val primary = rows.getString(1); val sid = rows.getString(2)
          UUID.fromString(primary); UUID.fromString(sid)
          sessions += primary to sid
        }
      }
    }
    for ((primary, sid) in sessions) require(update(connection, config,
      "DELETE FROM spring_session WHERE primary_id=? AND session_id=?", primary, sid) == 1)
    for (expected in config.resetBindings) {
      val selected = actor(expected.label)
      if (expected.generation == null) {
        require(scalar(connection, config, "SELECT count(*)::text FROM oidc_identity_binding WHERE app_user_id=?", selected.userId) == "0")
        continue
      }
      require(update(connection, config, "DELETE FROM oidc_identity_binding WHERE id=? AND issuer='https://accounts.google.com' AND subject=? AND app_user_id=?",
        expected.generation, expected.subject, selected.userId) == 1)
      require(update(connection, config, "UPDATE tenant_membership SET status='ACTIVE', updated_at=current_timestamp WHERE id=? AND user_id=? AND role_code=? AND status IN ('ACTIVE','INACTIVE')",
        selected.membershipId, selected.userId, selected.membershipRole) == 1)
      require(scalar(connection, config, "SELECT count(*)::text FROM oidc_identity_binding WHERE app_user_id=?", selected.userId) == "0")
    }
    require(scalar(connection, config, "SELECT count(*)::text FROM spring_session_attributes WHERE attribute_name='SPRING_SECURITY_CONTEXT'") == "0")
    // Anonymous sessions/authorization transactions, actors, tenants, audit and business records are untouched.
  }

  private fun probe(connection: Connection, config: Configuration) {
    require(scalar(connection, config, "SELECT has_database_privilege(current_user, current_database(), 'CREATE')::text") == "false")
    require(scalar(connection, config, "SELECT has_database_privilege(current_user, current_database(), 'TEMPORARY')::text") == "false")
    require(scalar(connection, config, "SELECT has_schema_privilege(current_user, 'public', 'CREATE')::text") == "false")
    for ((table, privileges) in runtimeGrants + ("flyway_schema_history" to "")) {
      for (privilege in listOf("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER", "MAINTAIN"))
        require(scalar(connection, config, "SELECT has_table_privilege(current_user, 'public.$table', '$privilege')::text") == (privilege in privileges.split(", ")).toString())
    }
    for (sql in listOf(
      "CREATE TABLE public.ritomer_m12_denied_probe(id integer)",
      "CREATE TEMPORARY TABLE ritomer_m12_denied_probe(id integer)",
      "UPDATE public.oidc_identity_binding SET active=false WHERE false",
      "UPDATE public.audit_event SET action='denied' WHERE false",
      "DELETE FROM public.audit_event WHERE false", "SET ROLE $MIGRATOR"
    )) {
      connection.autoCommit = false
      try {
        var denied = false
        try { executeSql(connection, config, sql) } catch (failure: SQLException) { if (failure.sqlState == "42501") denied = true else throw failure }
        require(denied) { "RUNTIME_PRIVILEGE_NOT_DENIED" }
      } finally { connection.rollback(); connection.autoCommit = true }
    }
  }

  private fun transaction(connection: Connection, config: Configuration, operation: () -> Unit) {
    connection.autoCommit = false
    try { config.withinBudget(); operation(); config.withinBudget(); connection.commit() }
    catch (failure: Exception) { try { connection.rollback() } catch (_: Exception) { }; throw failure }
    finally { connection.autoCommit = true }
  }
  private fun executeSql(connection: Connection, config: Configuration, sql: String) {
    connection.createStatement().use { it.queryTimeout = config.remainingSeconds(); it.execute(sql) }
  }
  private fun update(connection: Connection, config: Configuration, sql: String, vararg values: Any?): Int = connection.prepareStatement(sql).use {
    it.queryTimeout = config.remainingSeconds(); values.forEachIndexed { index, value -> it.setObject(index + 1, value) }; it.executeUpdate()
  }
  private fun scalar(connection: Connection, config: Configuration, sql: String, vararg values: Any?): String = connection.prepareStatement(sql).use {
    it.queryTimeout = config.remainingSeconds(); values.forEachIndexed { index, value -> it.setObject(index + 1, value) }
    it.executeQuery().use { rows -> require(rows.next()); val value = rows.getString(1); require(value != null && !rows.next()); value }
  }
}
