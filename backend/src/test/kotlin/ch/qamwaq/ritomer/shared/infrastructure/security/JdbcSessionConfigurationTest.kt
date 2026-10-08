package ch.qamwaq.ritomer.shared.infrastructure.security

import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.application.OidcActorAdmission
import ch.qamwaq.ritomer.testsupport.*
import ch.qamwaq.ritomer.identity.application.OidcSessionAuthenticationService
import ch.qamwaq.ritomer.identity.api.SyntheticOidcProvider
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.URI
import java.io.ByteArrayInputStream
import java.io.DataOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.util.Optional
import java.util.concurrent.TimeUnit
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import java.util.stream.Stream
import java.io.ByteArrayOutputStream
import java.io.ObjectOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant
import java.time.Clock
import java.sql.Connection
import java.sql.DatabaseMetaData
import java.util.UUID
import java.util.concurrent.ScheduledFuture
import javax.sql.DataSource
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.mockito.Mockito
import org.springframework.boot.autoconfigure.ImportAutoConfiguration
import org.springframework.boot.autoconfigure.session.SessionAutoConfiguration
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.test.context.runner.WebApplicationContextRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.AnnotatedBeanDefinitionReader
import org.springframework.core.convert.TypeDescriptor
import org.springframework.core.convert.support.GenericConversionService
import org.springframework.core.serializer.support.SerializingConverter
import org.springframework.core.serializer.support.DeserializingConverter
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.csrf.DefaultCsrfToken
import org.springframework.core.io.FileSystemResource
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.context.SecurityContextImpl
import org.springframework.session.jdbc.config.annotation.web.http.EnableJdbcHttpSession
import org.springframework.session.SessionRepository
import org.springframework.session.config.SessionRepositoryCustomizer
import org.springframework.session.jdbc.JdbcIndexedSessionRepository
import org.springframework.session.web.http.SessionRepositoryFilter
import org.springframework.scheduling.TaskScheduler
import org.springframework.test.util.ReflectionTestUtils
import org.springframework.transaction.*
import org.springframework.transaction.support.SimpleTransactionStatus

class JdbcSessionConfigurationTest {
  @Test
  fun `M12 primary failure survives all failing cleanup stages without private exception material`() {
    val failures = PostgresTestRailM12Process.QualificationFailures()
    val privateText = "SYNTHETIC_PRIVATE_COOKIE_AND_JDBC_SENTINEL"
    val original = java.io.IOException(privateText, IllegalStateException(privateText)).apply {
      addSuppressed(IllegalArgumentException(privateText))
    }
    failures.primary(original)
    val calls = mutableListOf<String>()
    val thrown = org.junit.jupiter.api.assertThrows<IllegalStateException> {
      failures.finish(listOf("a1" to { calls.add("a1"); error("M12_WORKER_UNCLEAN_EXIT") },
        "b" to { calls.add("b"); error(privateText) }),
        { calls.add("observe") }, { calls.add("idp"); error("M12_IDP_CESSATION_NOT_ATTESTED") },
        { calls.add("quiescent"); error("M12_RESOURCES_NOT_QUIESCENT") })
    }
    assertThat(calls).containsExactly("b", "a1", "idp", "quiescent")
    assertThat(thrown.message).isEqualTo("M12_FAILURE stage=QUALIFICATION worker=NONE category=IO_FAILURE code=M12_UNCLASSIFIED_FAILURE")
    assertThat(thrown.suppressed.map { it.message }).containsExactly(
      "M12_FAILURE stage=WORKER_STOP worker=b category=CONTROLLED_FAILURE code=M12_UNCLASSIFIED_FAILURE",
      "M12_FAILURE stage=WORKER_STOP worker=a1 category=CONTROLLED_FAILURE code=M12_WORKER_UNCLEAN_EXIT",
      "M12_FAILURE stage=IDP_STOP worker=NONE category=CONTROLLED_FAILURE code=M12_IDP_CESSATION_NOT_ATTESTED",
      "M12_FAILURE stage=QUIESCENCE worker=NONE category=CONTROLLED_FAILURE code=M12_RESOURCES_NOT_QUIESCENT")
    assertThat(thrown.stackTraceToString()).doesNotContain(privateText)
    (listOf(thrown) + thrown.suppressed).forEach { assertThat(it.cause).isNull() }
  }

  @Test
  fun `M12 successful cessation cannot turn the original timeout into a pass`() {
    val failures = PostgresTestRailM12Process.QualificationFailures()
    failures.primary(java.util.concurrent.TimeoutException("SYNTHETIC_PRIVATE_TIMEOUT"))
    val calls = mutableListOf<String>()
    assertThatThrownBy {
      failures.finish(listOf("a1" to { calls.add("a1"); Unit }), { calls.add("observe") },
        { calls.add("idp") }, { calls.add("quiescent") })
    }.hasMessage("M12_FAILURE stage=QUALIFICATION worker=NONE category=TIMEOUT code=M12_UNCLASSIFIED_FAILURE")
    assertThat(calls).containsExactly("a1", "observe", "idp", "quiescent")
  }

  @Test
  fun `M12 observation failure remains blocking and every remaining closer runs`() {
    val calls = mutableListOf<String>()
    assertThatThrownBy {
      PostgresTestRailM12Process.QualificationFailures().finish(emptyList(),
        { calls.add("observe"); error("M12_CONNECTION_BUDGET_NOT_ATTESTED") },
        { calls.add("idp") }, { calls.add("quiescent") })
    }.hasMessage("M12_FAILURE stage=CONNECTION_OBSERVATION worker=NONE category=CONTROLLED_FAILURE code=M12_CONNECTION_BUDGET_NOT_ATTESTED")
    assertThat(calls).containsExactly("observe", "idp", "quiescent")
    calls.clear()
    PostgresTestRailM12Process.QualificationFailures().finish(emptyList(), { calls.add("observe") },
      { calls.add("idp") }, { calls.add("quiescent") })
    assertThat(calls).containsExactly("observe", "idp", "quiescent")
  }

  @Test
  fun `M12 runtime verification checks every entry once with at most four owned readers`() {
    val readers = java.util.concurrent.ConcurrentHashMap.newKeySet<Thread>()
    val seen = java.util.concurrent.atomic.AtomicIntegerArray(19)
    val started = CountDownLatch(4)
    M12BoundRuntime.verifyEntries(19) { index ->
      readers.add(Thread.currentThread())
      seen.incrementAndGet(index)
      if (index < 4) { started.countDown(); check(started.await(5, TimeUnit.SECONDS)) }
    }
    assertThat(readers).hasSize(4)
    readers.forEach { it.join(5000) }
    assertThat(readers.none { it.isAlive }).isTrue()
    (0 until 19).forEach { assertThat(seen.get(it)).isEqualTo(1) }
  }

  @ParameterizedTest
  @ValueSource(strings = ["failure", "interruption"])
  fun `M12 runtime verification cannot return with a reader still alive`(mode: String) {
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val returned = CountDownLatch(1)
    val failure = AtomicReference<Throwable>()
    val activeCallbacks = AtomicInteger()
    val readers = java.util.concurrent.ConcurrentHashMap.newKeySet<Thread>()
    val caller = Thread {
      try {
        M12BoundRuntime.verifyEntries(4) { index ->
          readers.add(Thread.currentThread())
          activeCallbacks.incrementAndGet()
          try {
            if (index == 0 && mode == "failure") error("SYNTHETIC_FILE_REJECTED")
            if (index == 1) {
              entered.countDown()
              // Model an in-flight filesystem read that does not finish merely on interruption.
              while (release.count > 0) try { release.await() } catch (_: InterruptedException) { }
            }
          } finally { activeCallbacks.decrementAndGet() }
        }
      } catch (caught: Throwable) { failure.set(caught) }
      finally { returned.countDown() }
    }
    caller.start()
    try {
      check(entered.await(5, TimeUnit.SECONDS))
      if (mode == "interruption") caller.interrupt()
      assertThat(returned.await(100, TimeUnit.MILLISECONDS)).isFalse()
    } finally {
      release.countDown()
      caller.join(5000)
    }
    assertThat(caller.isAlive).isFalse()
    assertThat(activeCallbacks.get()).isZero()
    readers.forEach { it.join(5000) }
    assertThat(readers.none { it.isAlive }).isTrue()
    assertThat(failure.get()).isInstanceOf(if (mode == "failure") java.util.concurrent.ExecutionException::class.java else InterruptedException::class.java)
  }

  @Test
  fun `M12 IdP closer proves real loopback cessation before releasing its lease`() {
    PostgresTestRailM12Activity.requireQuiescent()
    val lease = PostgresTestRailM12Activity.begin("idp")
    val idp = SyntheticOidcProvider()
    val closure = PostgresTestRailM12Process.IdpClosure(lease) {
      idp.close()
      check(!Thread.currentThread().isInterrupted)
      ServerSocket().use { it.bind(InetSocketAddress("127.0.0.1", URI(idp.issuer).port)) }
    }
    closure.stop()
    assertThat(closure.thread.isAlive).isFalse()
    PostgresTestRailM12Activity.requireQuiescent()
  }

  @ParameterizedTest
  @ValueSource(strings = ["error", "interrupted"])
  fun `M12 IdP close failure cannot release the lease even after thread termination`(failure: String) {
    val lease = PostgresTestRailM12Activity.begin("idp")
    val closure = PostgresTestRailM12Process.IdpClosure(lease) {
      if (failure == "error") error("SYNTHETIC_CLOSE_ERROR") else Thread.currentThread().interrupt()
    }
    try {
      assertThatThrownBy { closure.stop() }.hasMessage("M12_IDP_CESSATION_NOT_ATTESTED")
      assertThat(closure.thread.isAlive).isFalse()
      assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
      assertThatThrownBy { closure.stop() }.hasMessage("M12_IDP_STOP_ALREADY_ATTEMPTED")
    } finally {
      // This fake close owns no server or JDBC resource, and the actual closer thread is dead.
      check(!closure.thread.isAlive)
      lease.complete()
    }
  }

  @Test
  fun `M12 IdP close timeout remains unsafe after a late close`() {
    val lease = PostgresTestRailM12Activity.begin("idp")
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val closure = PostgresTestRailM12Process.IdpClosure(lease) { entered.countDown(); release.await() }
    try {
      assertThatThrownBy { closure.stop(100) }.hasMessage("M12_IDP_CESSATION_NOT_ATTESTED")
      assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue()
      assertThat(closure.thread.isAlive).isTrue()
      assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
      release.countDown(); closure.thread.join(2000)
      assertThat(closure.thread.isAlive).isFalse()
      assertThatThrownBy { closure.stop() }.hasMessage("M12_IDP_STOP_ALREADY_ATTEMPTED")
      assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
    } finally {
      release.countDown(); closure.thread.join(2000)
      check(!closure.thread.isAlive) // Only a synthetic latch; never discharge an unknown live resource.
      lease.complete()
    }
  }

  @Test
  fun `M12 interrupted pilot neither interrupts the closer nor attests its late cessation`() {
    val lease = PostgresTestRailM12Activity.begin("idp")
    val entered = CountDownLatch(1)
    val release = CountDownLatch(1)
    val result = AtomicReference<Throwable?>()
    val restored = AtomicBoolean()
    val closerInterrupted = AtomicBoolean()
    val closure = PostgresTestRailM12Process.IdpClosure(lease) {
      entered.countDown(); release.await(); closerInterrupted.set(Thread.currentThread().isInterrupted)
    }
    val pilot = Thread {
      try { closure.stop() } catch (failure: Throwable) {
        result.set(failure); restored.set(Thread.currentThread().isInterrupted)
      }
    }
    try {
      pilot.start()
      assertThat(entered.await(2, TimeUnit.SECONDS)).isTrue()
      pilot.interrupt(); pilot.join(2000)
      assertThat(pilot.isAlive).isFalse()
      assertThat(result.get()).isInstanceOf(InterruptedException::class.java)
      assertThat(restored.get()).isTrue()
      assertThat(closure.thread.isAlive).isTrue()
      assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
      release.countDown(); closure.thread.join(2000)
      assertThat(closure.thread.isAlive).isFalse()
      assertThat(closerInterrupted.get()).isFalse()
      assertThatThrownBy { closure.stop() }.hasMessage("M12_IDP_STOP_ALREADY_ATTEMPTED")
      assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
    } finally {
      release.countDown(); pilot.join(2000); closure.thread.join(2000)
      check(!pilot.isAlive && !closure.thread.isAlive)
      lease.complete() // All fake resources actually ended; production keeps failed attestation sticky.
    }
  }

  @ParameterizedTest
  @ValueSource(strings = ["nominal", "historical", "unknown", "masked", "null-name", "pilot-over", "a-over", "b-over", "a-not-stopped", "missing-b", "bad-count", "transaction"])
  fun `M12 connection observations fail closed without opening an observer pool`(mutation: String) {
    val runId = "1".repeat(32)
    val prefix = "ritomer-m1-2-$runId-"
    fun row(name: String?, count: Any = 2, owned: Boolean? = true): Map<String, Any?> =
      mapOf("application_name" to name, "owned" to owned, "connection_count" to count)
    val rows = mutableListOf(row(prefix + "m12-qualification"), row(prefix + "m12-a"), row(prefix + "m12-b"))
    var boundary = PostgresTestRailM12Process.ConnectionBoundary.WITH_A1_B
    when (mutation) {
      "historical" -> rows.add(row(prefix + "full", 1))
      "unknown" -> rows.add(row("unattributed", 1))
      "masked" -> rows.add(row(prefix + "m12-a", 1, null))
      "null-name" -> rows.add(row(null, 1))
      "pilot-over" -> rows[0] = row(prefix + "m12-qualification", 3)
      "a-over" -> rows[1] = row(prefix + "m12-a", 3)
      "b-over" -> rows[2] = row(prefix + "m12-b", 3)
      "a-not-stopped" -> boundary = PostgresTestRailM12Process.ConnectionBoundary.RESET
      "missing-b" -> rows.removeAt(2)
      "bad-count" -> rows[0] = row(prefix + "m12-qualification", 2.5)
    }
    val jdbc = Mockito.mock(JdbcTemplate::class.java)
    Mockito.`when`(jdbc.queryForList(Mockito.anyString())).thenReturn(rows)
    if (mutation == "transaction") org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(true)
    try {
      if (mutation == "nominal") {
        val observation = PostgresTestRailM12Process.observeConnections(jdbc, runId, boundary)
        assertThat(observation).containsEntry("total", 6).containsEntry("pilot", 2).containsEntry("a", 2).containsEntry("b", 2)
          .containsEntry("unknown", 0).containsEntry("historicalPhasesAbsent", true)
        assertThat(observation.values.any { it is String && it.contains(runId) }).isFalse()
      } else {
        assertThatThrownBy { PostgresTestRailM12Process.observeConnections(jdbc, runId, boundary) }
          .hasMessage(when (mutation) {
            "bad-count" -> "M12_CONNECTION_ROW_INVALID"
            "transaction" -> "M12_OBSERVATION_REQUIRES_AUTOCOMMIT"
            else -> "M12_CONNECTION_BUDGET_NOT_ATTESTED"
          })
      }
      if (mutation == "transaction") Mockito.verifyNoInteractions(jdbc) else {
        val query = org.mockito.ArgumentCaptor.forClass(String::class.java)
        Mockito.verify(jdbc).queryForList(query.capture())
        assertThat(query.value).contains("datname=current_database()", "backend_type is null", "usename=current_user", "group by 1,2")
        Mockito.verifyNoMoreInteractions(jdbc)
      }
    } finally { org.springframework.transaction.support.TransactionSynchronizationManager.setActualTransactionActive(false) }
  }

  @Test
  fun `M12 worker wires actual shared JDBC security with metadata only and no SQL`() {
    val sqlAttempts = AtomicInteger()
    val metadata = Mockito.mock(DatabaseMetaData::class.java)
    Mockito.`when`(metadata.databaseProductName).thenReturn("PostgreSQL")
    val connection = Mockito.mock(Connection::class.java) { call ->
      if (call.method.name in setOf("createStatement", "prepareStatement", "prepareCall")) {
        sqlAttempts.incrementAndGet(); error("OFFLINE_SQL_FORBIDDEN")
      }
      org.mockito.Answers.RETURNS_DEFAULTS.answer(call)
    }
    Mockito.`when`(connection.metaData).thenReturn(metadata)
    val dataSource = Mockito.mock(DataSource::class.java)
    Mockito.`when`(dataSource.connection).thenReturn(connection)
    val environment = m12WorkerEnvironment(mapOf(
      "RITOMER_DB_RAIL_CAMPAIGN" to "M12", "RITOMER_DB_TEST_PHASE" to "m12-a",
      "RITOMER_DB_TEST_JDBC_URL" to "jdbc:postgresql://127.0.0.1:1/offline",
      "RITOMER_DB_TEST_USERNAME" to "offline", "RITOMER_DB_TEST_PASSWORD" to "synthetic-offline",
      "RITOMER_DB_TEST_APPLICATION_NAME" to "offline", "RITOMER_DB_TEST_STORAGE_LOCAL_ROOT" to "offline-unused"))
    val registrations = m12Registrations("http://127.0.0.1:1")
    val observer = M12SerializationObserver()
    val context = m12WebContext(environment, registrations, observer, dataSource)
    AnnotatedBeanDefinitionReader(context).register(SessionAutoConfigurationProbe::class.java)
    try {
      context.refresh()
      val repository = context.getBean(JdbcIndexedSessionRepository::class.java)
      val filter = context.getBean("springSessionRepositoryFilter", SessionRepositoryFilter::class.java)
      assertThat(ReflectionTestUtils.getField(filter, "sessionRepository")).isSameAs(repository)
      assertThat(context.getBean(ClientRegistrationRepository::class.java)).isSameAs(registrations)
      assertThat(context.getBeansOfType(SecurityFilterChain::class.java)).hasSize(1)
      assertThat(context.getBean(OidcActorAdmission::class.java)).isInstanceOf(OidcSessionAuthenticationService::class.java)
      assertThat(context.getBean(PlatformTransactionManager::class.java)).isInstanceOf(DataSourceTransactionManager::class.java)
      assertThat(context.getBeansOfType(JwtDecoder::class.java)).isEmpty()
      assertThat(context.getBeansOfType(org.flywaydb.core.Flyway::class.java)).isEmpty()
      assertThat(environment.activeProfiles).containsExactly("shared-internal")
      assertThat(environment.getProperty("spring.flyway.enabled")).isEqualTo("false")
      assertThat(environment.getProperty("spring.datasource.hikari.maximum-pool-size")).isEqualTo("2")
      assertThat(observer.writes.get()).isZero(); assertThat(observer.reads.get()).isZero()
    } finally { context.close() }
    assertThat(sqlAttempts.get()).isZero()
  }

  @Test
  fun `M12 private frames reject ambiguity truncation and invalid UTF8 without echo`() {
    fun frame(payload: ByteArray, declared: Int = payload.size) = ByteArrayOutputStream().also {
      DataOutputStream(it).apply { writeInt(declared); write(payload) }
    }.toByteArray()
    val invalid = listOf(
      frame("{\"seq\":\"1\",\"seq\":\"2\"}".toByteArray()), frame("{} {}".toByteArray()),
      frame("[]".toByteArray()), frame("{\"seq\":1}".toByteArray()), frame("{\"seq\":{}}".toByteArray()),
      frame(byteArrayOf(0xC3.toByte(), 0x28)), frame(byteArrayOf(), 0), frame(byteArrayOf(), -1),
      frame(byteArrayOf(), M12PrivateProtocol.LIMIT + 1), frame("{}".toByteArray(), 3),
      frame(("{\"" + "x".repeat(33) + "\":\"x\"}").toByteArray()),
      frame((1..13).joinToString(",", "{", "}") { "\"k$it\":\"v\"" }.toByteArray())
    )
    invalid.forEach { bytes ->
      assertThatThrownBy { M12PrivateProtocol.read(ByteArrayInputStream(bytes)) }
        .isInstanceOf(IllegalStateException::class.java).hasMessage("M12_PRIVATE_FRAME_REJECTED").hasNoCause()
    }
    val stream = ByteArrayOutputStream()
    M12PrivateProtocol.write(stream, mapOf("op" to "STOP", "seq" to "1"))
    M12PrivateProtocol.write(stream, mapOf("op" to "STOP", "seq" to "2"))
    val input = ByteArrayInputStream(stream.toByteArray())
    (1..2).forEach { sequence -> M12PrivateProtocol.requireRequest(M12PrivateProtocol.read(input), sequence) }
    listOf(mapOf("op" to "STOP", "seq" to "01"), mapOf("op" to "UNKNOWN", "seq" to "1"),
      mapOf("op" to "STOP", "seq" to "1", "cookie" to "synthetic"), mapOf("op" to "STOP", "seq" to "2"))
      .forEach { assertThatThrownBy { M12PrivateProtocol.requireRequest(it, 1) }.isInstanceOf(IllegalStateException::class.java) }
  }

  @Test
  fun `M12 observes actual serialization without changing bytes and retains violations`() {
    val delegate = GenericConversionService().apply {
      addConverter(Any::class.java, ByteArray::class.java, SerializingConverter())
      addConverter(ByteArray::class.java, Any::class.java, DeserializingConverter())
    }
    val observer = M12SerializationObserver()
    val wrapped = observer.wrap(delegate)
    val actor = AuthenticatedActor(UUID.randomUUID(), AuthenticationMechanism.OIDC, Instant.now(), UUID.randomUUID().toString(), UUID.randomUUID())
    val values = listOf(DefaultCsrfToken(SESSION_CSRF_HEADER_NAME, "_csrf", "synthetic"),
      SecurityContextImpl(AuthenticatedActorAuthentication.fromValidatedActor(actor)))
    values.forEach { value ->
      val expected = delegate.convert(value, ByteArray::class.java)!!
      val actual = wrapped.convert(value, ByteArray::class.java)!!
      assertThat(actual.contentEquals(expected)).isTrue()
      assertThat(wrapped.convert(actual, TypeDescriptor.valueOf(ByteArray::class.java), TypeDescriptor.valueOf(Any::class.java))!!.javaClass).isEqualTo(value.javaClass)
      val second = wrapped.convert(value, TypeDescriptor.forObject(value), TypeDescriptor.valueOf(ByteArray::class.java)) as ByteArray
      assertThat(second.contentEquals(expected)).isTrue()
      assertThat(wrapped.convert(second, Any::class.java)!!.javaClass).isEqualTo(value.javaClass)
    }
    observer.requireClean()
    assertThat(observer.writes.get()).isEqualTo(4); assertThat(observer.reads.get()).isEqualTo(4)
    val forbidden = listOf("synthetic-provider-token", DefaultCsrfToken("OTHER", "_csrf", "synthetic"),
      SecurityContextImpl(UsernamePasswordAuthenticationToken("synthetic-provider", "synthetic-token")))
    forbidden.forEach { value ->
      val rejected = M12SerializationObserver(); val conversion = rejected.wrap(delegate)
      val expected = delegate.convert(value, ByteArray::class.java)!!
      val actual = conversion.convert(value, ByteArray::class.java)!!
      assertThat(actual.contentEquals(expected)).isTrue()
      conversion.convert(actual, Any::class.java)
      conversion.convert(values[0], ByteArray::class.java)
      assertThatThrownBy { rejected.requireClean() }.hasMessage("M12_SESSION_ATTRIBUTE_VIOLATION")
    }
  }

  @Test
  fun `M12 partial launch and unproven cessation retain the reset barrier`() {
    PostgresTestRailM12Activity.requireQuiescent()
    val alive = AtomicBoolean(true)
    val destroyAllowed = AtomicBoolean(false)
    val process = offlineWorkerProcess(alive, destroyAllowed, ByteArrayInputStream(byteArrayOf()), Optional.empty())
    val worker = M12OwnedWorker("a1", process, PostgresTestRailM12Activity.begin("a1"))
    assertThatThrownBy { worker.initialize("http://127.0.0.1:1") }.isInstanceOf(NoSuchElementException::class.java)
    assertThatThrownBy { worker.stop() }.hasMessage("M12_PROCESS_NOT_STOPPED")
    assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
    destroyAllowed.set(true)
    assertThatThrownBy { worker.stop() }.hasMessage("M12_WORKER_UNCLEAN_EXIT")
    assertThat(alive.get()).isFalse()
    PostgresTestRailM12Activity.requireQuiescent()
  }

  @Test
  fun `M12 private IO timeout cannot attest cessation until the blocked reader actually stops`() {
    val alive = AtomicBoolean(true)
    val input = object : InputStream() {
      private var closed = false
      @Synchronized override fun read(): Int { while (!closed) (this as java.lang.Object).wait(); return -1 }
      @Synchronized override fun close() { closed = true; (this as java.lang.Object).notifyAll() }
    }
    val process = offlineWorkerProcess(alive, AtomicBoolean(true), input, Optional.of(Instant.parse("2026-10-06T11:19:27Z")))
    val worker = M12OwnedWorker("a1", process, PostgresTestRailM12Activity.begin("a1"))
    try {
      assertThatThrownBy { worker.initialize("http://127.0.0.1:1") }.isInstanceOf(java.util.concurrent.TimeoutException::class.java)
      assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
    } finally {
      alive.set(false)
      assertThatThrownBy { worker.stop() }.hasMessage("M12_WORKER_UNCLEAN_EXIT")
    }
    PostgresTestRailM12Activity.requireQuiescent()
  }

  private fun offlineWorkerProcess(alive: AtomicBoolean, destroyAllowed: AtomicBoolean, input: InputStream, start: Optional<Instant>): Process {
    val process = Mockito.mock(Process::class.java)
    val info = Mockito.mock(ProcessHandle.Info::class.java)
    Mockito.`when`(info.startInstant()).thenReturn(start)
    Mockito.`when`(process.info()).thenReturn(info)
    Mockito.`when`(process.pid()).thenReturn(123L)
    Mockito.`when`(process.isAlive).thenAnswer { alive.get() }
    Mockito.`when`(process.descendants()).thenAnswer { Stream.empty<ProcessHandle>() }
    Mockito.`when`(process.inputStream).thenReturn(input)
    Mockito.`when`(process.outputStream).thenReturn(OutputStream.nullOutputStream())
    Mockito.`when`(process.errorStream).thenReturn(ByteArrayInputStream(byteArrayOf()))
    Mockito.doAnswer { if (destroyAllowed.get()) alive.set(false); null }.`when`(process).destroy()
    Mockito.`when`(process.destroyForcibly()).thenAnswer { if (destroyAllowed.get()) alive.set(false); process }
    Mockito.`when`(process.waitFor(Mockito.anyLong(), Mockito.any(TimeUnit::class.java))).thenAnswer { !alive.get() }
    return process
  }

  @Test
  fun `M12 unknown descendants still trigger every known shutdown but never attest absence`() {
    val alive = AtomicBoolean(true)
    val inputClosed = AtomicBoolean(false)
    val input = object : ByteArrayInputStream(byteArrayOf()) { override fun close() { inputClosed.set(true); super.close() } }
    val process = offlineWorkerProcess(alive, AtomicBoolean(true), input, Optional.empty())
    Mockito.`when`(process.descendants()).thenThrow(IllegalStateException("SYNTHETIC_ENUMERATION_FAILURE"))
    val lease = PostgresTestRailM12Activity.begin("a1")
    try {
      val worker = M12OwnedWorker("a1", process, lease)
      assertThatThrownBy { worker.stop() }.hasMessage("M12_PROCESS_NOT_STOPPED")
      assertThat(alive.get()).isFalse()
      assertThat(inputClosed.get()).isTrue()
      Mockito.verify(process).destroy()
      assertThatThrownBy { PostgresTestRailM12Activity.requireQuiescent() }.hasMessage("M12_RESOURCES_NOT_QUIESCENT")
    } finally {
      // Only this synthetic process has no OS resources; production cannot discharge an unknown inventory.
      lease.complete()
    }
  }

  @ParameterizedTest
  @ValueSource(strings = ["manifest", "payload", "payload-1", "payload-2", "payload-3", "argfile", "missing-becomes-present", "file-disappears", "structure-addition"])
  fun `M12 bound runtime rejects changes before any process launch`(mutation: String, @org.junit.jupiter.api.io.TempDir temp: Path) {
    val root = Files.createDirectory(temp.resolve("build"))
    val inputs = Files.createDirectory(root.resolve("inputs"))
    val payloads = (0..7).map { Files.writeString(inputs.resolve("payload-$it.class"), "synthetic-bytecode-$it") }
    val payload = payloads.first()
    val javaExecutable = Files.writeString(root.resolve("java.exe"), "synthetic-jdk")
    val argfile = Files.writeString(root.resolve("m12-worker.args"), "synthetic-args")
    val missing = root.resolve("absent")
    fun sha(path: Path) = java.security.MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(path))
      .joinToString("") { "%02x".format(it.toInt() and 0xff) }
    val manifest = root.resolve("m12-runtime.json")
    val value = mapOf("schemaVersion" to 1, "mainClass" to "ch.qamwaq.ritomer.testsupport.PostgresTestRailM12Process",
      "javaExecutablePath" to javaExecutable.toString(), "argfilePath" to argfile.toString(), "argfileText" to "synthetic-args",
      "files" to (payloads + listOf(javaExecutable, argfile)).map { mapOf("path" to it.toString(), "sha256" to sha(it)) },
      "runtimeInputs" to listOf(mapOf("label" to "payload", "path" to inputs.toString()), mapOf("label" to "absent", "path" to missing.toString())),
      "structure" to (listOf(mapOf("label" to "payload", "relativePath" to ".", "kind" to "D")) +
        payloads.map { mapOf("label" to "payload", "relativePath" to it.fileName.toString(), "kind" to "F") } +
        mapOf("label" to "absent", "relativePath" to ".", "kind" to "M")))
    Files.write(manifest, com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(value))
    val binding = sha(manifest)
    val runtime = M12BoundRuntime.read(binding, root, temp)
    runtime.verify()
    when (mutation) {
      "manifest" -> Files.writeString(manifest, "{}")
      "payload" -> Files.writeString(payload, "changed-bytecode")
      "payload-1", "payload-2", "payload-3" -> Files.writeString(payloads[mutation.last().digitToInt()], "changed-bytecode")
      "argfile" -> Files.writeString(argfile, "changed-args")
      "missing-becomes-present" -> Files.createDirectory(missing)
      "file-disappears" -> Files.delete(payload)
      "structure-addition" -> Files.writeString(inputs.resolve("unbound.class"), "extra")
    }
    assertThatThrownBy { runtime.verify() }.isInstanceOf(Exception::class.java)
    if (mutation == "manifest") assertThatThrownBy { M12BoundRuntime.read(binding, root, temp) }.hasMessage("M12_RUNTIME_MANIFEST_CHANGED")
  }

  @Test
  fun `actual global exclusion prevents implicit JDBC sessions locally even when a datasource exists`() {
    val fixture = offlineSessionContext()
    fixture.runner.withPropertyValues("spring.profiles.active=local").run { context ->
      assertThat(context).hasNotFailed()
      assertThat(context).doesNotHaveBean(SessionRepository::class.java)
      assertThat(context).doesNotHaveBean(SessionRepositoryFilter::class.java)
      Mockito.verifyNoInteractions(fixture.dataSource)
      Mockito.verify(fixture.jdbc).afterPropertiesSet()
      Mockito.verifyNoMoreInteractions(fixture.jdbc)
    }
  }

  @Test
  fun `shared configuration explicitly creates the real JDBC repository despite global auto exclusion`() {
    val fixture = offlineSessionContext()
    fixture.runner.withPropertyValues("spring.profiles.active=shared-internal").run { context ->
      assertThat(context).hasNotFailed().hasSingleBean(SessionRepository::class.java)
      val repository = context.getBean(JdbcIndexedSessionRepository::class.java)
      val filter = context.getBean("springSessionRepositoryFilter", SessionRepositoryFilter::class.java)
      assertThat(ReflectionTestUtils.getField(filter, "sessionRepository")).isSameAs(repository)
      @Suppress("UNCHECKED_CAST")
      val sessions = repository as SessionRepository<org.springframework.session.Session>
      assertThat(sessions.createSession().maxInactiveInterval).isEqualTo(java.time.Duration.ofMinutes(30))
      // No save/find/delete: metadata comes from mocks and no SQL statement is allowed.
      Mockito.verify(fixture.jdbc).afterPropertiesSet()
      Mockito.verifyNoMoreInteractions(fixture.jdbc)
    }
  }

  @ParameterizedTest
  @ValueSource(strings = ["disabled", "hmac", "origin", "client", "mixed-profiles"])
  fun `invalid shared context fails startup instead of offering a memory or legacy fallback`(invalid: String) {
    val (override, reason) = when (invalid) {
      "disabled" -> "ritomer.security.session.enabled=false" to "Failed requirement."
      "hmac" -> "ritomer.security.jwt.hmac-secret=synthetic-forbidden" to "Legacy credentials are forbidden"
      "origin" -> "ritomer.security.shared.canonical-origin=" to "An exact HTTPS canonical origin is required"
      "client" -> "ritomer.security.shared.client-id=" to "Shared OIDC configuration is required"
      "mixed-profiles" -> "spring.profiles.active=shared-internal,local" to "The shared profile must be exclusive"
      else -> error("Unknown configuration counterexample.")
    }
    offlineSessionContext().runner.withPropertyValues("spring.profiles.active=shared-internal", override).run { context ->
      assertThat(context).hasFailed()
      assertThat(context.startupFailure).hasRootCauseInstanceOf(IllegalArgumentException::class.java)
        .hasStackTraceContaining(reason)
    }
  }

  private data class OfflineSessionContext(
    val runner: WebApplicationContextRunner,
    val dataSource: DataSource,
    val jdbc: JdbcTemplate
  )

  private fun offlineSessionContext(): OfflineSessionContext {
    val metadata = Mockito.mock(DatabaseMetaData::class.java)
    Mockito.`when`(metadata.databaseProductName).thenReturn("PostgreSQL")
    val connection = Mockito.mock(Connection::class.java) { call ->
      check(call.method.name !in setOf("createStatement", "prepareStatement", "prepareCall")) {
        "SQL is forbidden in the offline session configuration fixture."
      }
      org.mockito.Answers.RETURNS_DEFAULTS.answer(call)
    }
    Mockito.`when`(connection.metaData).thenReturn(metadata)
    val dataSource = Mockito.mock(DataSource::class.java)
    Mockito.`when`(dataSource.connection).thenReturn(connection)
    val jdbc = Mockito.mock(JdbcTemplate::class.java)
    val runner = WebApplicationContextRunner()
      .withUserConfiguration(SessionAutoConfigurationProbe::class.java, SharedSessionSecurityConfiguration::class.java)
      .withInitializer { context ->
        YamlPropertySourceLoader().load("application", FileSystemResource("src/main/resources/application.yml"))
          .forEach { context.environment.propertySources.addLast(it) }
      }
      .withBean(DataSource::class.java, { dataSource })
      .withBean(JdbcTemplate::class.java, { jdbc })
      .withBean(PlatformTransactionManager::class.java, { Mockito.mock(PlatformTransactionManager::class.java) })
      .withPropertyValues(
        "ritomer.security.session.enabled=true", "ritomer.security.jwt.hmac-secret=",
        "ritomer.security.shared.canonical-origin=https://shared.example.test",
        "ritomer.security.shared.client-id=synthetic-client",
        "ritomer.security.shared.client-secret=synthetic-client-secret",
        "ritomer.security.shared.proxy-mode=NONE", "server.forward-headers-strategy=none"
      )
    return OfflineSessionContext(runner, dataSource, jdbc)
  }

  @TestConfiguration(proxyBeanMethods = false)
  @ImportAutoConfiguration(SessionAutoConfiguration::class)
  class SessionAutoConfigurationProbe {
    @Bean
    fun offlineSessionCleanup(): SessionRepositoryCustomizer<JdbcIndexedSessionRepository> =
      SessionRepositoryCustomizer { repository -> repository.setCleanupCron("-") }

    @Bean
    fun taskScheduler(): TaskScheduler = Mockito.mock(TaskScheduler::class.java) { call ->
      when {
        call.method.name == "getClock" -> Clock.systemUTC()
        call.method.name.startsWith("schedule") -> Mockito.mock(ScheduledFuture::class.java)
        else -> org.mockito.Answers.RETURNS_DEFAULTS.answer(call)
      }
    }
  }

  @Test
  fun `JDBC sessions are profile scoped with a fixed idle timeout and additive official schema`() {
    val annotation = SharedSessionSecurityConfiguration::class.java.getAnnotation(EnableJdbcHttpSession::class.java)
    assertThat(annotation.maxInactiveIntervalInSeconds).isEqualTo(1800)
    assertThat(annotation.tableName).isEqualTo("SPRING_SESSION")
    val profile = SharedSessionSecurityConfiguration::class.java.getAnnotation(org.springframework.context.annotation.Profile::class.java)
    assertThat(profile.value).containsExactly("shared-internal")
    val migration = Files.readString(Path.of("src/main/resources/db/migration/V11__m1_2_oidc_identity_and_jdbc_sessions.sql")).lowercase()
    assertThat(migration).contains("session_id char(36)", "attribute_bytes bytea", "on delete cascade", "unique (issuer, subject)",
      "expires_at <= created_at + interval '5 minutes'", "create index oidc_transaction_expiry", "new.id := gen_random_uuid()")
    assertThat(migration).doesNotContain("drop table", "truncate", "alter table app_user", "access_token", "refresh_token", "id_token")
    val official = javaClass.getResourceAsStream("/org/springframework/session/jdbc/schema-postgresql.sql")!!.bufferedReader().use { it.readText().lowercase() }
    fun canonical(sql: String) = sql.replace(Regex("--[^\n]*"), "").replace(Regex("\\s+"), " ").trim()
    val actualSessionSchema = migration.substringAfter("-- spring session 3.5.5 postgresql schema; flyway owns creation.").substringBefore("-- transient authorization")
    assertThat(canonical(actualSessionSchema)).isEqualTo(canonical(official))
  }

  @Test
  fun `every shared context save rejects provider or arbitrary authentication before session creation`() {
    val repository = MinimalSessionSecurityContextRepository()
    val request = MockHttpServletRequest()
    val response = MockHttpServletResponse()
    assertThatThrownBy { repository.saveContext(SecurityContextImpl(UsernamePasswordAuthenticationToken("provider", "token")), request, response) }
      .isInstanceOf(IllegalStateException::class.java)
    assertThat(request.getSession(false)).isNull()
    val actor = AuthenticatedActor(UUID.randomUUID(), AuthenticationMechanism.OIDC, Instant.now(), UUID.randomUUID().toString(), UUID.randomUUID())
    repository.saveContext(SecurityContextImpl(AuthenticatedActorAuthentication.fromValidatedActor(actor)), request, response)
    val context = request.getSession(false)!!.getAttribute("SPRING_SECURITY_CONTEXT")
    val bytes = ByteArrayOutputStream().use { stream -> ObjectOutputStream(stream).use { it.writeObject(context) }; stream.toByteArray() }
    val raw = bytes.toString(Charsets.ISO_8859_1)
    assertThat(raw).contains("AuthenticatedActor").doesNotContain("OAuth2", "OidcUser", "claims", "accessToken", "refreshToken", "idToken")
  }

  @Test
  fun `transaction consumption commits an isolated delete returning before handing material to the caller`() {
    val events = mutableListOf<String>()
    val material = OidcTransaction("synthetic-nonce", "v".repeat(43), "/")
    val jdbc = Mockito.mock(JdbcTemplate::class.java) { call ->
      if (call.method.name == "query") {
        val sql = call.arguments[0] as String
        assertThat(sql).contains("delete from oidc_authorization_transaction", "state_hash=? and session_hash=?", "expires_at>clock_timestamp()", "returning nonce, code_verifier, return_path")
        events.add("delete-returning")
        listOf(material)
      } else org.mockito.Answers.RETURNS_DEFAULTS.answer(call)
    }
    val manager = object : PlatformTransactionManager {
      override fun getTransaction(definition: TransactionDefinition?): TransactionStatus {
        assertThat(definition!!.propagationBehavior).isEqualTo(TransactionDefinition.PROPAGATION_REQUIRES_NEW)
        assertThat(definition.timeout).isEqualTo(5)
        events.add("begin"); return SimpleTransactionStatus()
      }
      override fun commit(status: TransactionStatus) { events.add("commit") }
      override fun rollback(status: TransactionStatus) { events.add("rollback") }
    }
    val returned = JdbcOidcTransactionStore(jdbc, manager).consume("a".repeat(64), "b".repeat(64))
    events.add("caller")
    assertThat(returned).isSameAs(material)
    assertThat(events).containsExactly("begin", "delete-returning", "commit", "caller")
    // This verifies SQL and transaction demarcation, not PostgreSQL concurrency.
  }
}
