package ch.qamwaq.ritomer.testsupport

import ch.qamwaq.ritomer.identity.api.*
import ch.qamwaq.ritomer.identity.application.*
import ch.qamwaq.ritomer.identity.infrastructure.persistence.*
import ch.qamwaq.ritomer.identity.infrastructure.security.SecurityAuthenticatedActorProvider
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.infrastructure.persistence.JdbcAuditTrail
import ch.qamwaq.ritomer.shared.infrastructure.security.*
import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.core.StreamReadConstraints
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.DeserializationFeature
import com.zaxxer.hikari.HikariDataSource
import jakarta.servlet.SessionTrackingMode
import jakarta.servlet.http.Cookie
import java.io.*
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.URI
import java.net.URLDecoder
import java.nio.ByteBuffer
import java.nio.charset.CodingErrorAction
import java.nio.file.*
import java.nio.file.attribute.BasicFileAttributes
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicInteger
import java.util.function.Supplier
import javax.sql.DataSource
import org.springframework.beans.factory.config.BeanDefinitionCustomizer
import org.springframework.beans.factory.support.BeanDefinitionRegistry
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
import org.springframework.boot.convert.ApplicationConversionService
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.*
import org.springframework.core.convert.ConversionService
import org.springframework.core.convert.TypeDescriptor
import org.springframework.core.env.*
import org.springframework.core.io.ClassPathResource
import org.springframework.http.HttpMethod
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.mock.web.MockServletContext
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.core.context.SecurityContextImpl
import org.springframework.security.oauth2.client.registration.*
import org.springframework.security.oauth2.core.*
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity
import org.springframework.security.web.csrf.DefaultCsrfToken
import org.springframework.session.config.SessionRepositoryCustomizer
import org.springframework.session.jdbc.JdbcIndexedSessionRepository
import org.springframework.session.web.http.SessionRepositoryFilter
import org.springframework.test.util.ReflectionTestUtils
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request
import org.springframework.test.web.servlet.setup.DefaultMockMvcBuilder
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.web.context.support.GenericWebApplicationContext
import org.springframework.web.servlet.config.annotation.EnableWebMvc

/** A failed/partial launch stays unsafe across JUnit instances; finally is not an attestation. */
internal object PostgresTestRailM12Activity {
  fun begin(label: String) = DisposablePostgresTestDatabase.M12Activity.begin(label)
  fun requireQuiescent() = DisposablePostgresTestDatabase.M12Activity.requireQuiescent()
}

/** Private framed traffic. Nothing returned here is an evidence/log object. */
internal object M12PrivateProtocol {
  const val LIMIT = 65536
  private val mapper = ObjectMapper().enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION)
    .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS).apply {
    factory.setStreamReadConstraints(StreamReadConstraints.builder().maxNestingDepth(4).maxStringLength(LIMIT).build())
  }
  fun write(output: OutputStream, fields: Map<String, String>) {
    val bytes = mapper.writeValueAsBytes(fields)
    check(bytes.size in 1..LIMIT) { "M12_FRAME_SIZE" }
    DataOutputStream(output).apply { writeInt(bytes.size); write(bytes); flush() }
  }
  fun read(input: InputStream): Map<String, String> {
    try {
      val stream = DataInputStream(input)
      val size = stream.readInt()
      check(size in 1..LIMIT)
      val bytes = ByteArray(size)
      stream.readFully(bytes)
      val text = Charsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString()
      val tree = mapper.readTree(text)
      check(tree.isObject && tree.size() <= 12)
      return tree.fields().asSequence().associate { (key, value) ->
        check(key.length in 1..32 && value.isTextual)
        key to value.textValue()
      }
    } catch (_: Throwable) { error("M12_PRIVATE_FRAME_REJECTED") }
  }
  fun requireRequest(fields: Map<String, String>, sequence: Int) {
    check(fields["seq"] == sequence.toString()) { "M12_SEQUENCE_REJECTED" }
    val payload = when (fields["op"]) {
      "INIT" -> setOf("issuer")
      "BOOTSTRAP", "START", "ME" -> setOf("cookie")
      "CALLBACK" -> setOf("cookie", "state", "code")
      "LOGOUT" -> setOf("cookie", "csrf")
      "STOP" -> emptySet()
      else -> error("M12_OPERATION_REJECTED")
    }
    check(fields.keys == payload + setOf("seq", "op")) { "M12_FIELDS_REJECTED" }
  }
}

/** Observes every conversion while preserving the original conversion result byte-for-byte. */
internal class M12SerializationObserver {
  val writes = AtomicInteger()
  val reads = AtomicInteger()
  private val violations = AtomicInteger()
  fun wrap(delegate: ConversionService): ConversionService = object : ConversionService by delegate {
    override fun <T : Any?> convert(source: Any?, targetType: Class<T>): T? {
      val result = delegate.convert(source, targetType)
      observe(source, targetType, result)
      return result
    }
    override fun convert(source: Any?, sourceType: TypeDescriptor?, targetType: TypeDescriptor): Any? {
      val result = delegate.convert(source, sourceType, targetType)
      observe(source, targetType.type, result)
      return result
    }
  }
  private fun observe(source: Any?, target: Class<*>, result: Any?) {
    if (target == ByteArray::class.java) {
      writes.incrementAndGet()
      if (!allowed(source)) violations.incrementAndGet()
    } else if (source is ByteArray) {
      reads.incrementAndGet()
      if (!allowed(result)) violations.incrementAndGet()
    }
  }
  private fun allowed(value: Any?): Boolean = when {
    value?.javaClass == DefaultCsrfToken::class.java -> (value as DefaultCsrfToken).headerName == SESSION_CSRF_HEADER_NAME
    value?.javaClass == SecurityContextImpl::class.java -> {
      val authentication = (value as SecurityContextImpl).authentication
      val actor = authentication?.principal as? AuthenticatedActor
      authentication?.javaClass == AuthenticatedActorAuthentication::class.java && actor != null &&
        actor.authenticationMechanism == AuthenticationMechanism.OIDC && actor.oidcBindingId != null &&
        authentication.credentials == null && authentication.details == null && authentication.authorities.isEmpty()
    }
    else -> false
  }
  fun requireClean() { check(violations.get() == 0) { "M12_SESSION_ATTRIBUTE_VIOLATION" } }
}

@TestConfiguration(proxyBeanMethods = false)
@EnableWebMvc
@EnableWebSecurity
@Import(DataSourceAutoConfiguration::class, SecurityConfig::class, SessionSecurityKernelConfiguration::class,
  SharedSessionSecurityConfiguration::class, GoogleOidcAuthenticationConfiguration::class,
  SessionCredentialConflictFilter::class, SessionExpiryFilter::class, LocalAuthBoundaryFilter::class,
  SessionAuthorityFreshnessFilter::class, TenantMdcFilter::class, SecurityTenantContextProvider::class,
  SecurityAuditCorrelationContextProvider::class, SharedSessionController::class, SharedSessionControllerAdvice::class,
  MeController::class, CurrentActorService::class, ActorResolutionSupport::class,
  SecurityAuthenticatedActorProvider::class, OidcSessionAuthenticationService::class,
  JdbcAppUserRepository::class, JdbcTenantMembershipRepository::class, JdbcOidcIdentityRepository::class, JdbcAuditTrail::class)
internal class M12SharedServletConfiguration {
  @Bean fun jdbc(dataSource: DataSource) = JdbcTemplate(dataSource)
  @Bean fun jdbcClient(dataSource: DataSource) = JdbcClient.create(dataSource)
  @Bean fun transactionManager(dataSource: DataSource): PlatformTransactionManager = DataSourceTransactionManager(dataSource)
  @Bean fun objectMapper() = ObjectMapper().findAndRegisterModules()
  @Bean fun observeJdbcSessions(observer: M12SerializationObserver): SessionRepositoryCustomizer<JdbcIndexedSessionRepository> =
    SessionRepositoryCustomizer { repository ->
      val delegate = ReflectionTestUtils.getField(repository, "conversionService") as ConversionService
      repository.setConversionService(observer.wrap(delegate))
    }
}

/** Exact same servlet wiring is inspected offline with a connection-rejecting mocked DataSource. */
internal fun m12WebContext(
  environment: ConfigurableEnvironment,
  registrations: ClientRegistrationRepository,
  observer: M12SerializationObserver,
  offlineDataSource: DataSource? = null
): GenericWebApplicationContext = GenericWebApplicationContext().apply {
  environment.conversionService = ApplicationConversionService()
  this.environment = environment
  servletContext = MockServletContext().apply { setSessionTrackingModes(setOf(SessionTrackingMode.COOKIE)) }
  registerBean("m12Registrations", ClientRegistrationRepository::class.java, Supplier { registrations },
    BeanDefinitionCustomizer { it.isPrimary = true })
  registerBean("m12SerializationObserver", M12SerializationObserver::class.java, Supplier { observer })
  if (offlineDataSource != null) registerBean("offlineDataSource", DataSource::class.java, Supplier { offlineDataSource })
  AnnotatedBeanDefinitionReader(this as BeanDefinitionRegistry).register(M12SharedServletConfiguration::class.java)
}

internal fun m12Registrations(issuer: String): ClientRegistrationRepository {
  val uri = URI(issuer)
  check(uri.scheme == "http" && uri.host == "127.0.0.1" && uri.port in 1..65535 && uri.rawPath.isNullOrEmpty() &&
    uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null) { "M12_IDP_ORIGIN_REJECTED" }
  return InMemoryClientRegistrationRepository(ClientRegistration.withRegistrationId("google")
    .clientId("synthetic-client").clientSecret("synthetic-secret")
    .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE).clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
    .redirectUri("https://app.example.test" + OIDC_CALLBACK_PATH).scope("openid")
    .authorizationUri("$issuer/authorize").tokenUri("$issuer/token").jwkSetUri("$issuer/jwks")
    .issuerUri(issuer).userNameAttributeName("sub").build())
}

internal fun m12WorkerEnvironment(process: Map<String, String>): ConfigurableEnvironment {
  fun required(name: String) = process[name]?.takeIf(String::isNotBlank) ?: error("M12_ENVIRONMENT_INCOMPLETE")
  check(required("RITOMER_DB_RAIL_CAMPAIGN") == "M12")
  check(required("RITOMER_DB_TEST_PHASE") in setOf("m12-a", "m12-b"))
  return StandardEnvironment().apply {
    setActiveProfiles("shared-internal")
    propertySources.replace(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, SystemEnvironmentPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, process))
    YamlPropertySourceLoader().load("m12-defaults", ClassPathResource("application.yml")).forEach { propertySources.addLast(it) }
    propertySources.addFirst(MapPropertySource("m12-closed-worker", mapOf(
      "spring.datasource.url" to required("RITOMER_DB_TEST_JDBC_URL"),
      "spring.datasource.username" to required("RITOMER_DB_TEST_USERNAME"),
      "spring.datasource.password" to required("RITOMER_DB_TEST_PASSWORD"),
      "spring.datasource.hikari.maximum-pool-size" to "2", "spring.datasource.hikari.minimum-idle" to "0",
      "spring.datasource.hikari.connection-timeout" to "5000",
      "spring.datasource.hikari.data-source-properties.ApplicationName" to required("RITOMER_DB_TEST_APPLICATION_NAME"),
      "spring.datasource.hikari.data-source-properties.logServerErrorDetail" to "false",
      "spring.datasource.hikari.data-source-properties.sslmode" to "disable",
      "spring.datasource.hikari.data-source-properties.gssEncMode" to "disable",
      "spring.flyway.enabled" to "false", "spring.flyway.clean-disabled" to "true", "spring.sql.init.mode" to "never",
      "ritomer.workpapers.documents.storage.backend" to "LOCAL_FS",
      "ritomer.workpapers.documents.storage.local-root" to required("RITOMER_DB_TEST_STORAGE_LOCAL_ROOT"),
      "ritomer.security.session.enabled" to "true", "ritomer.security.session.absolute-timeout" to "8h",
      "ritomer.security.jwt.hmac-secret" to "", "ritomer.security.shared.canonical-origin" to "https://app.example.test",
      "ritomer.security.shared.client-id" to "synthetic-client", "ritomer.security.shared.client-secret" to "synthetic-secret",
      "ritomer.security.shared.proxy-mode" to "NONE", "server.forward-headers-strategy" to "none"
    )))
  }
}

object PostgresTestRailM12Process {
  private val json = ObjectMapper()
  private val replyKeys = setOf("seq", "op", "status", "body", "cookie", "location", "writes", "reads", "pid", "started")

  /** Keep the first failure while attempting every closer; never retain private exception text. */
  internal class QualificationFailures {
    private var first: IllegalStateException? = null
    private val safeCodes = setOf("M12_WORKER_UNCLEAN_EXIT", "M12_PROCESS_NOT_STOPPED",
      "M12_RESOURCES_NOT_QUIESCENT", "M12_IDP_CESSATION_NOT_ATTESTED", "M12_IDP_CLOSE_INTERRUPTED",
      "M12_CONNECTION_BUDGET_NOT_ATTESTED", "M12_RESPONSE_REJECTED", "M12_PRIVATE_FRAME_REJECTED",
      "M12_WORKER_IDENTITY", "M12_SESSION_ATTRIBUTE_VIOLATION", "M12_RUNTIME_CHANGED",
      "M12_RUNTIME_LINK", "M12_RUNTIME_STRUCTURE_CHANGED", "M12_RUNTIME_MANIFEST_CHANGED", "M12_ARGFILE_CHANGED")

    private fun record(stage: String, label: String, failure: Throwable) {
      val category = when (failure) {
        is TimeoutException -> "TIMEOUT"
        is InterruptedException -> "INTERRUPTED"
        is ExecutionException -> "EXECUTION_FAILURE"
        is IOException -> "IO_FAILURE"
        is IllegalStateException -> "CONTROLLED_FAILURE"
        is AssertionError -> "ASSERTION_FAILURE"
        else -> "UNCLASSIFIED_FAILURE"
      }
      val code = failure.message?.takeIf { it in safeCodes } ?: "M12_UNCLASSIFIED_FAILURE"
      val worker = label.takeIf { it in setOf("a1", "a2", "b") } ?: "NONE"
      val safe = IllegalStateException("M12_FAILURE stage=$stage worker=$worker category=$category code=$code")
      if (first == null) first = safe else first!!.addSuppressed(safe)
    }

    fun primary(failure: Throwable) = record("QUALIFICATION", "NONE", failure)

    fun finish(workers: List<Pair<String, () -> Unit>>, observe: () -> Unit, closeIdp: () -> Unit, quiescent: () -> Unit) {
      fun attempt(stage: String, label: String = "NONE", action: () -> Unit): Boolean =
        try { action(); true } catch (failure: Throwable) { record(stage, label, failure); false }
      var workersStopped = true
      workers.asReversed().forEach { (label, stop) -> if (!attempt("WORKER_STOP", label, stop)) workersStopped = false }
      if (workersStopped) attempt("CONNECTION_OBSERVATION", action = observe)
      attempt("IDP_STOP", action = closeIdp)
      attempt("QUIESCENCE", action = quiescent)
      first?.let { throw it }
    }
  }

  @JvmStatic fun main(args: Array<String>) {
    val output = FileOutputStream(FileDescriptor.out)
    System.setOut(PrintStream(OutputStream.nullOutputStream()))
    System.setErr(PrintStream(OutputStream.nullOutputStream()))
    try {
      check(args.contentEquals(arrayOf("worker")))
      worker(System.`in`, output)
    } catch (_: Throwable) { kotlin.system.exitProcess(21) }
  }

  private fun worker(input: InputStream, output: OutputStream) {
    check(System.getenv("RITOMER_DB_RAIL_CAMPAIGN") == "M12")
    val runtime = M12BoundRuntime.read(System.getenv("RITOMER_M12_MANIFEST_SHA256") ?: error("M12_RUNTIME_BINDING_MISSING"))
    runtime.verify()
    val init = M12PrivateProtocol.read(input)
    M12PrivateProtocol.requireRequest(init, 1)
    check(init["op"] == "INIT")
    val environment = m12WorkerEnvironment(System.getenv())
    val observer = M12SerializationObserver()
    val context = m12WebContext(environment, m12Registrations(init.getValue("issuer")), observer)
    try {
      DisposablePostgresTestDatabaseGuardInitializer().initialize(context)
      context.refresh()
      val dataSource = context.getBean(DataSource::class.java)
      check(dataSource is HikariDataSource && dataSource.maximumPoolSize == 2 && dataSource.minimumIdle == 0)
      DisposablePostgresTestDatabase.assertCanonicalM12WorkerDataSource(dataSource, environment)
      check(context.getBeansOfType(org.flywaydb.core.Flyway::class.java).isEmpty())
      val sessions = context.getBean("springSessionRepositoryFilter", SessionRepositoryFilter::class.java)
      val mvc = MockMvcBuilders.webAppContextSetup(context).addFilters<DefaultMockMvcBuilder>(sessions)
        .apply<DefaultMockMvcBuilder>(springSecurity()).build()
      writeReply(output, 1, 200, observer)
      var sequence = 2
      while (true) {
        val command = M12PrivateProtocol.read(input)
        M12PrivateProtocol.requireRequest(command, sequence)
        check(command["op"] != "INIT")
        if (command["op"] == "STOP") {
          observer.requireClean()
          context.close()
          check(dataSource.isClosed)
          writeReply(output, sequence, 200, observer)
          return
        }
        perform(mvc, command, output, sequence, observer)
        sequence++
      }
    } finally { context.close() }
  }

  private fun perform(mvc: MockMvc, command: Map<String, String>, output: OutputStream, sequence: Int, observer: M12SerializationObserver) {
    val operation = command.getValue("op")
    val path = when (operation) {
      "BOOTSTRAP" -> SESSION_BOOTSTRAP_PATH
      "START" -> OIDC_START_PATH
      "CALLBACK" -> OIDC_CALLBACK_PATH
      "ME" -> "/api/me"
      "LOGOUT" -> SESSION_LOGOUT_PATH
      else -> error("M12_OPERATION_REJECTED")
    }
    val builder = request(if (operation == "LOGOUT") HttpMethod.POST else HttpMethod.GET, path)
      .secure(true).header("Host", "app.example.test")
    command["cookie"]?.takeIf(String::isNotEmpty)?.let { builder.cookie(Cookie(SESSION_COOKIE_NAME, it)) }
    if (operation == "START") builder.param("returnPath", "/")
    if (operation == "CALLBACK") builder.param("state", command.getValue("state")).param("code", command.getValue("code"))
    if (operation == "LOGOUT") builder.header("Origin", "https://app.example.test").header(SESSION_CSRF_HEADER_NAME, command.getValue("csrf"))
    val response = mvc.perform(builder).andReturn().response
    observer.requireClean()
    writeReply(output, sequence, response.status, observer, response.contentAsString,
      response.getCookie(SESSION_COOKIE_NAME)?.value.orEmpty(), response.redirectedUrl.orEmpty())
  }

  private fun writeReply(output: OutputStream, sequence: Int, status: Int, observer: M12SerializationObserver,
    body: String = "", cookie: String = "", location: String = "") {
    observer.requireClean()
    M12PrivateProtocol.write(output, mapOf("seq" to sequence.toString(), "op" to "REPLY", "status" to status.toString(),
      "body" to body, "cookie" to cookie, "location" to location, "writes" to observer.writes.get().toString(),
      "reads" to observer.reads.get().toString(), "pid" to ProcessHandle.current().pid().toString(),
      "started" to ProcessHandle.current().info().startInstant().orElseThrow().toString()))
  }

  /** Only this owned closer can discharge the IdP lease. Failure is sticky after late completion. */
  internal class IdpClosure(
    private val lease: DisposablePostgresTestDatabase.M12Activity.Lease,
    close: () -> Unit
  ) {
    private var attempted = false
    private var completed = false
    private var failed = false
    private var interrupted = false
    internal val thread = Thread({
      try { close(); completed = true } catch (_: Throwable) { failed = true }
      finally { interrupted = Thread.currentThread().isInterrupted }
    }, "ritomer-m12-idp-close").apply { isDaemon = true }

    fun stop(timeoutMillis: Long = 3000) {
      require(timeoutMillis in 1..3000)
      check(!attempted) { "M12_IDP_STOP_ALREADY_ATTEMPTED" }
      attempted = true
      thread.start()
      try { thread.join(timeoutMillis) } catch (failure: InterruptedException) {
        Thread.currentThread().interrupt()
        throw failure
      }
      check(!thread.isAlive && completed && !failed && !interrupted) { "M12_IDP_CESSATION_NOT_ATTESTED" }
      lease.complete()
    }
  }

  internal enum class ConnectionBoundary(val expectsA: Boolean, val expectsB: Boolean) {
    RESET(false, false), BEFORE_A(false, false), AFTER_A1(true, false), WITH_A1_B(true, true),
    AFTER_A1_STOP(false, true), WITH_A2_B(true, true), AFTER_WORKERS(false, false)
  }

  // NULL backend_type is deliberately included: PostgreSQL can mask another role's activity.
  private const val CONNECTION_COUNTS_SQL = "select application_name, (usename=current_user and backend_type='client backend') as owned, count(*)::integer as connection_count from pg_stat_activity where datname=current_database() and (backend_type='client backend' or backend_type is null) group by 1,2"

  internal fun observeConnections(jdbc: JdbcTemplate, runId: String, boundary: ConnectionBoundary): Map<String, Any> {
    check(runId.matches(Regex("[0-9a-f]{32}"))) { "M12_RUN_ID_INVALID" }
    check(!org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive()) { "M12_OBSERVATION_REQUIRES_AUTOCOMMIT" }
    val prefix = "ritomer-m1-2-$runId-"
    val names = listOf(prefix + "m12-qualification", prefix + "m12-a", prefix + "m12-b")
    val counts = IntArray(4)
    // Reuses the pilot's existing pool. No observer DataSource or extra connection owner.
    jdbc.queryForList(CONNECTION_COUNTS_SQL).forEach { row ->
      val count = row["connection_count"]
      check(count is Int && count in 1..16) { "M12_CONNECTION_ROW_INVALID" }
      val index = if (row["owned"] == true) names.indexOf(row["application_name"]) else -1
      counts[if (index >= 0) index else 3] += count
    }
    val total = counts.sum()
    check(counts[0] in 1..2 && counts[1] in (if (boundary.expectsA) 1..2 else 0..0) &&
      counts[2] in (if (boundary.expectsB) 1..2 else 0..0) && counts[3] == 0 && total <= 7) {
      "M12_CONNECTION_BUDGET_NOT_ATTESTED"
    }
    return mapOf("boundary" to boundary.name, "pilot" to counts[0], "a" to counts[1], "b" to counts[2],
      "unknown" to counts[3], "total" to total, "historicalPhasesAbsent" to true)
  }

  internal fun runQualification(jdbc: JdbcTemplate, environment: Environment) {
    check(environment.activeProfiles.toList() == listOf("dbtest") && System.getenv("RITOMER_DB_RAIL_CAMPAIGN") == "M12" &&
      System.getenv("RITOMER_DB_TEST_PHASE") == "m12-qualification") { "M12_QUALIFICATION_PHASE_REQUIRED" }
    PostgresTestRailM12Activity.requireQuiescent()
    val runtime = M12BoundRuntime.read(System.getProperty("ritomer.m12.manifest.sha256") ?: error("M12_RUNTIME_BINDING_MISSING"))
    runtime.verify()
    val workers = mutableListOf<M12OwnedWorker>()
    val idpLease = PostgresTestRailM12Activity.begin("idp")
    val idp = SyntheticOidcProvider()
    val idpClosure = IdpClosure(idpLease) {
      idp.close()
      check(!Thread.currentThread().isInterrupted) { "M12_IDP_CLOSE_INTERRUPTED" }
      ServerSocket().use { it.bind(InetSocketAddress("127.0.0.1", URI(idp.issuer).port)) }
    }
    val observations = mutableListOf<Map<String, Any>>()
    fun observe(boundary: ConnectionBoundary) {
      observations.add(observeConnections(jdbc, System.getenv("RITOMER_DB_RAIL_RUN_ID"), boundary))
    }
    var succeeded = false
    val failures = QualificationFailures()
    try {
      observe(ConnectionBoundary.BEFORE_A)
      val actors = listOf(UUID.randomUUID(), UUID.randomUUID())
      val tenants = listOf(UUID.randomUUID(), UUID.randomUUID())
      actors.indices.forEach { index ->
        jdbc.update("insert into app_user(id,external_subject) values (?,?)", actors[index], "m12-internal-$index")
        jdbc.update("insert into tenant(id,slug,legal_name) values (?,?,?)", tenants[index], "m12-$index", "M12 synthetic tenant")
        jdbc.update("insert into tenant_membership(id,tenant_id,user_id,role_code) values (?,?,?,'ACCOUNTANT')", UUID.randomUUID(), tenants[index], actors[index])
        jdbc.update("insert into oidc_identity_binding(issuer,subject,app_user_id) values (?,?,?)", idp.issuer, "m12-provider-$index", actors[index])
      }
      fun start(label: String): M12OwnedWorker = M12OwnedWorker.launch(label, runtime).also {
        workers.add(it)
        it.initialize(idp.issuer)
      }
      val a1 = start("a1")
      observe(ConnectionBoundary.AFTER_A1)
      val b = start("b")
      observe(ConnectionBoundary.WITH_A1_B)
      check(a1.pid != b.pid) { "M12_DISTINCT_JVMS_REQUIRED" }
      fun login(worker: M12OwnedWorker, index: Int): Pair<String, String> {
        val bootstrap = worker.call("BOOTSTRAP", mapOf("cookie" to ""))
        check(bootstrap["status"] == "200")
        val anonymous = bootstrap.getValue("cookie")
        val oldCsrf = json.readTree(bootstrap.getValue("body")).path("csrf").path("token").asText()
        check(anonymous.isNotBlank() && oldCsrf.isNotBlank())
        val oldPrimary = jdbc.queryForObject("select primary_id from spring_session where session_id=?", String::class.java, anonymous)
        val initiation = worker.call("START", mapOf("cookie" to anonymous))
        check(initiation["status"] == "302")
        val uri = initiation.getValue("location")
        val query = URI(uri).rawQuery.split('&').associate {
          URLDecoder.decode(it.substringBefore('='), Charsets.UTF_8) to URLDecoder.decode(it.substringAfter('='), Charsets.UTF_8)
        }
        check(query["scope"] == "openid" && query["code_challenge_method"] == "S256")
        val callback = worker.call("CALLBACK", mapOf("cookie" to anonymous, "state" to query.getValue("state"), "code" to idp.authorize(uri, "m12-provider-$index")))
        check(callback["status"] == "302" && callback["location"] == "/")
        val cookie = callback.getValue("cookie")
        check(cookie.isNotBlank() && cookie != anonymous)
        check(jdbc.queryForObject("select count(*) from spring_session where session_id=? or primary_id=?", Int::class.java, anonymous, oldPrimary) == 0)
        check(jdbc.queryForObject("select primary_id from spring_session where session_id=?", String::class.java, cookie) != oldPrimary)
        val fresh = worker.call("BOOTSTRAP", mapOf("cookie" to cookie))
        check(fresh["status"] == "200" && json.readTree(fresh.getValue("body")).path("sessionState").asText() == "AUTHENTICATED")
        val csrf = json.readTree(fresh.getValue("body")).path("csrf").path("token").asText()
        check(csrf.isNotBlank() && csrf != oldCsrf)
        check(worker.call("LOGOUT", mapOf("cookie" to cookie, "csrf" to oldCsrf))["status"] == "403")
        return cookie to csrf
      }
      val first = login(a1, 0)
      fun requireActor(reply: Map<String, String>, index: Int) {
        val body = json.readTree(reply.getValue("body"))
        check(reply["status"] == "200" && body.path("actor").path("userId").asText() == actors[index].toString())
        check(body.path("memberships").size() == 1 && body.path("memberships")[0].path("tenantId").asText() == tenants[index].toString())
        check(body.path("memberships")[0].path("roles").map { it.asText() } == listOf("ACCOUNTANT"))
      }
      val onB = b.call("ME", mapOf("cookie" to first.first))
      requireActor(onB, 0)
      check(b.call("BOOTSTRAP", mapOf("cookie" to first.first))["status"] == "200")
      val second = login(b, 1)
      val secondBefore = b.call("ME", mapOf("cookie" to second.first))
      requireActor(secondBefore, 1)
      a1.stop()
      observe(ConnectionBoundary.AFTER_A1_STOP)
      val a2 = start("a2")
      observe(ConnectionBoundary.WITH_A2_B)
      check(a2.identity() != a1.identity() && a2.pid != b.pid)
      val restarted = a2.call("ME", mapOf("cookie" to first.first))
      check(restarted["status"] == "200" && restarted["body"] == onB["body"])
      check(b.call("LOGOUT", mapOf("cookie" to first.first, "csrf" to first.second))["status"] == "204")
      check(a2.call("ME", mapOf("cookie" to first.first))["status"] == "401")
      val secondAfter = a2.call("ME", mapOf("cookie" to second.first))
      check(secondAfter["status"] == "200" && secondAfter["body"] == secondBefore["body"])
      check(jdbc.queryForObject("select count(*) from spring_session where session_id=?", Int::class.java, first.first) == 0)
      check(jdbc.queryForObject("select count(*) from spring_session_attributes where session_primary_id not in (select primary_id from spring_session)", Int::class.java) == 0)
      check(jdbc.queryForList("select distinct attribute_name from spring_session_attributes", String::class.java).toSet() ==
        setOf("SPRING_SECURITY_CONTEXT", "org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository.CSRF_TOKEN"))
      check(a1.writes > 0 && b.writes > 0 && a2.reads > 0)
      succeeded = true
    } catch (failure: Throwable) {
      failures.primary(failure)
    } finally {
      failures.finish(workers.map { worker -> worker.label to { worker.stop() } },
        { observe(ConnectionBoundary.AFTER_WORKERS) }, { idpClosure.stop() },
        { PostgresTestRailM12Activity.requireQuiescent() })
    }
    check(succeeded)
    val root = Path.of(System.getenv("RITOMER_DB_RAIL_RUN_ROOT"))
    Files.writeString(root.resolve("m12-process-evidence.json"), json.writeValueAsString(mapOf(
      "schemaVersion" to 1, "result" to "PASS", "quiescent" to true, "connectionBudget" to 7,
      "connectionObservations" to observations, "maximumObservedAtBoundaries" to observations.maxOf { it.getValue("total") as Int },
      "runtimeManifestSha256" to runtime.manifestHash, "processes" to workers.map { it.evidence() }
    )) + "\n", StandardOpenOption.CREATE_NEW)
  }
}

/** Startup receives only a bound argfile and closed environment; no protocol material is in argv. */
internal class M12OwnedWorker internal constructor(
  internal val label: String, private val process: Process,
  private val lease: DisposablePostgresTestDatabase.M12Activity.Lease
) {
  val pid: Long get() = process.pid()
  private lateinit var started: Instant
  private var ioLease: DisposablePostgresTestDatabase.M12Activity.Lease? = null
  private var io: ExecutorService? = null
  private var stderr: Future<Boolean>? = null
  private val descendants = linkedMapOf<Long, ProcessHandle>()
  private var descendantsKnown = true
  private fun rememberDescendants() {
    try { process.descendants().use { handles -> handles.forEach { descendants.putIfAbsent(it.pid(), it) } } }
    catch (failure: Throwable) { descendantsKnown = false; throw failure }
  }
  private fun drainErrors(): Boolean {
    var count = 0
    val buffer = ByteArray(4096)
    process.errorStream.use { stream ->
      while (true) { val size = stream.read(buffer); if (size < 0) break; count += size; check(count <= M12PrivateProtocol.LIMIT) { "M12_STDERR_LIMIT" } }
    }
    return true
  }
  private var sequence = 0
  private var stopped = false
  var writes = 0; private set
  var reads = 0; private set

  fun initialize(issuer: String) {
    started = process.info().startInstant().orElseThrow()
    ioLease = PostgresTestRailM12Activity.begin("private-io")
    io = Executors.newFixedThreadPool(2)
    stderr = io!!.submit<Boolean> { drainErrors() }
    check(call("INIT", mapOf("issuer" to issuer))["status"] == "200")
  }
  fun call(operation: String, values: Map<String, String> = emptyMap()): Map<String, String> {
    check(!stopped && process.isAlive && process.info().startInstant().orElseThrow() == started) { "M12_WORKER_IDENTITY" }
    val current = ++sequence
    rememberDescendants()
    val response = checkNotNull(io).submit<Map<String, String>> {
      M12PrivateProtocol.write(process.outputStream, values + mapOf("op" to operation, "seq" to current.toString()))
      M12PrivateProtocol.read(process.inputStream)
    }.get(20, TimeUnit.SECONDS)
    check(response.keys == setOf("seq", "op", "status", "body", "cookie", "location", "writes", "reads", "pid", "started") &&
      response["seq"] == current.toString() && response["op"] == "REPLY" && response["pid"] == pid.toString() && response["started"] == started.toString()) { "M12_RESPONSE_REJECTED" }
    val nextWrites = response.getValue("writes").toIntOrNull()
    val nextReads = response.getValue("reads").toIntOrNull()
    check(nextWrites != null && nextReads != null && nextWrites >= writes && nextReads >= reads &&
      response.getValue("status").toIntOrNull() in 100..599) { "M12_COUNTER_OR_STATUS_REJECTED" }
    writes = nextWrites
    reads = nextReads
    return response
  }
  fun stop() {
    if (stopped) return
    var cleanExit = false
    var closed = true
    fun attempt(action: () -> Unit) { try { action() } catch (_: Throwable) { closed = false } }
    attempt { rememberDescendants() }
    try { if (process.isAlive) { call("STOP"); cleanExit = process.waitFor(3, TimeUnit.SECONDS) && process.exitValue() == 0 } }
    catch (_: Throwable) { /* Cessation still runs; the functional failure remains. */ }
    attempt { if (process.isAlive) rememberDescendants() }
    attempt {
      if (process.isAlive) process.destroy()
      if (!process.waitFor(2, TimeUnit.SECONDS)) { process.destroyForcibly(); process.waitFor(3, TimeUnit.SECONDS) }
    }
    descendants.values.forEach { handle -> attempt {
      if (handle.isAlive) handle.destroy()
      if (handle.isAlive) handle.destroyForcibly()
      if (handle.isAlive) handle.onExit().get(3, TimeUnit.SECONDS)
    } }
    attempt { process.outputStream.close() }
    attempt { process.inputStream.close() }
    val stderrDrained = try { stderr?.get(3, TimeUnit.SECONDS) ?: (io == null) } catch (_: Throwable) { false }
    attempt { process.errorStream.close() }
    attempt { io?.shutdownNow() }
    val ioStopped = try { io?.awaitTermination(3, TimeUnit.SECONDS) ?: true } catch (_: Throwable) { false }
    check(descendantsKnown && !process.isAlive && descendants.values.none { it.isAlive } && ioStopped && stderrDrained && closed) { "M12_PROCESS_NOT_STOPPED" }
    ioLease?.complete(); lease.complete(); stopped = true
    check(cleanExit) { "M12_WORKER_UNCLEAN_EXIT" }
  }
  fun identity(): Pair<Long, Instant> = pid to started
  fun evidence(): Map<String, Any> = mapOf("label" to label, "pid" to pid, "created" to started.toString(),
    "stopped" to stopped, "writes" to writes, "reads" to reads)

  companion object {
    fun launch(label: String, runtime: M12BoundRuntime): M12OwnedWorker {
      require(label in setOf("a1", "a2", "b"))
      runtime.verify()
      val lease = PostgresTestRailM12Activity.begin(label)
      val phase = if (label == "b") "m12-b" else "m12-a"
      val source = System.getenv()
      val runRoot = Path.of(source.getValue("RITOMER_DB_RAIL_RUN_ROOT"))
      val leaf = runRoot.resolve("volatile").resolve(phase)
      Files.createDirectories(leaf.resolve("local-fs"))
      val builder = ProcessBuilder(runtime.javaExecutable, "@" + runtime.argfile)
      builder.directory(leaf.toFile())
      val allowed = setOf("RITOMER_DB_RAIL_CAMPAIGN", "RITOMER_DB_RAIL_BUILD_ROOT", "RITOMER_DB_RAIL_RUN_ID", "RITOMER_DB_RAIL_RUN_ROOT",
        "RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256", "RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER", "RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS",
        "RITOMER_DB_RAIL_DATABASE_OID", "RITOMER_DB_RAIL_RUNNER_ROLE_OID", "RITOMER_DB_RAIL_RUNTIME_SHA256",
        "RITOMER_DB_TESTS_ENABLED", "RITOMER_DB_TEST_JDBC_URL", "RITOMER_DB_TEST_USERNAME", "RITOMER_DB_TEST_PASSWORD",
        "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT", "RITOMER_DB_TEST_RUN_ROOT", "SystemRoot", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "USERPROFILE")
      builder.environment().clear()
      builder.environment().putAll(source.filterKeys { it in allowed })
      builder.environment()["RITOMER_DB_TEST_PHASE"] = phase
      builder.environment()["RITOMER_DB_TEST_STORAGE_LOCAL_ROOT"] = leaf.resolve("local-fs").toString()
      builder.environment()["RITOMER_DB_TEST_APPLICATION_NAME"] = "ritomer-m1-2-${source.getValue("RITOMER_DB_RAIL_RUN_ID")}-$phase"
      builder.environment()["RITOMER_M12_MANIFEST_SHA256"] = runtime.manifestHash
      // A thrown start leaves the lease unsafe: the outer Job must prove absence before any reset.
      return M12OwnedWorker(label, builder.start(), lease)
    }
  }
}

internal class M12BoundRuntime private constructor(private val manifestPath: Path, val manifestHash: String, manifestBytes: ByteArray) {
  private val json = ObjectMapper().readTree(manifestBytes)
  val javaExecutable: String = json.path("javaExecutablePath").asText()
  val argfile: String = json.path("argfilePath").asText()
  fun verify() {
    check(sha(manifestPath) == manifestHash && json.path("schemaVersion").asInt() == 1 &&
      json.path("mainClass").asText() == "ch.qamwaq.ritomer.testsupport.PostgresTestRailM12Process") { "M12_RUNTIME_CHANGED" }
    check(Files.readString(Path.of(argfile)) == json.path("argfileText").asText()) { "M12_ARGFILE_CHANGED" }
    val files = json.path("files")
    verifyEntries(files.size()) { index ->
      val entry = files[index]
      check(sha(Path.of(entry.path("path").asText())) == entry.path("sha256").asText()) { "M12_RUNTIME_CHANGED" }
    }
    val actual = mutableListOf<Map<String, String>>()
    json.path("runtimeInputs").forEach { input ->
      val label = input.path("label").asText()
      val root = Path.of(input.path("path").asText())
      if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) actual += mapOf("label" to label, "relativePath" to ".", "kind" to "M")
      else Files.walk(root).use { paths -> paths.sorted().forEach { path ->
        val attributes = Files.readAttributes(path, BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
        check(!attributes.isSymbolicLink && !attributes.isOther) { "M12_RUNTIME_LINK" }
        actual += mapOf("label" to label, "relativePath" to root.relativize(path).toString().replace('\\', '/').ifEmpty { "." }, "kind" to if (attributes.isDirectory) "D" else "F")
      } }
    }
    check(ObjectMapper().valueToTree<com.fasterxml.jackson.databind.JsonNode>(actual) == json.path("structure")) { "M12_RUNTIME_STRUCTURE_CHANGED" }
  }
  companion object {
    /** Each file keeps every ancestor/type/hash check; close waits for all reading tasks, even on failure. */
    internal fun verifyEntries(count: Int, verify: (Int) -> Unit) {
      require(count >= 0)
      if (count == 0) return
      val parallelism = minOf(4, count)
      Executors.newFixedThreadPool(parallelism).use { pool ->
        pool.invokeAll((0 until parallelism).map { partition -> Callable {
          for (index in partition until count step parallelism) verify(index)
        } }).forEach { it.get() }
      }
    }

    fun read(expectedHash: String,
      root: Path = Path.of(System.getenv("RITOMER_DB_RAIL_BUILD_ROOT") ?: error("M12_BUILD_ROOT_MISSING")),
      runRoot: Path = Path.of(System.getenv("RITOMER_DB_RAIL_RUN_ROOT") ?: error("M12_RUN_ROOT_MISSING"))): M12BoundRuntime {
      check(expectedHash.matches(Regex("[0-9a-f]{64}"))) { "M12_RUNTIME_BINDING_INVALID" }
      check(runRoot.isAbsolute && runRoot == runRoot.normalize() && root.isAbsolute && root == root.normalize() && root != runRoot && root.startsWith(runRoot))
      val manifest = root.resolve("m12-runtime.json")
      requireNoLinks(manifest)
      val bytes = Files.readAllBytes(manifest)
      check(MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 0xff) } == expectedHash) { "M12_RUNTIME_MANIFEST_CHANGED" }
      return M12BoundRuntime(manifest, expectedHash, bytes)
    }
    private fun requireNoLinks(path: Path) {
      var current: Path? = path
      while (current != null) {
        val attributes = Files.readAttributes(current, BasicFileAttributes::class.java, LinkOption.NOFOLLOW_LINKS)
        check(!attributes.isSymbolicLink && !attributes.isOther) { "M12_RUNTIME_LINK" }
        current = current.parent
      }
    }
    private fun sha(path: Path): String {
      requireNoLinks(path)
      check(!Files.isSymbolicLink(path) && Files.isRegularFile(path, LinkOption.NOFOLLOW_LINKS))
      val digest = MessageDigest.getInstance("SHA-256")
      Files.newInputStream(path).use { stream ->
        val buffer = ByteArray(65536)
        while (true) { val size = stream.read(buffer); if (size < 0) break; digest.update(buffer, 0, size) }
      }
      return digest.digest().joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }
  }
}
