package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.identity.infrastructure.persistence.JdbcOidcIdentityRepository
import ch.qamwaq.ritomer.shared.application.AuthenticatedActor
import ch.qamwaq.ritomer.shared.application.AuthenticationMechanism
import ch.qamwaq.ritomer.shared.infrastructure.security.*
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabaseGuardInitializer
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import ch.qamwaq.ritomer.testsupport.PostgresTestRailM12Activity
import ch.qamwaq.ritomer.testsupport.PostgresTestRailM12Process
import java.time.Duration
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.ConcurrentHashMap
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.core.env.Environment
import org.springframework.security.core.context.SecurityContextImpl
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.session.jdbc.JdbcIndexedSessionRepository
import org.springframework.session.Session
import org.springframework.session.SessionRepository
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.ContextConfiguration
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.TransactionDefinition
import org.springframework.transaction.TransactionStatus
import org.springframework.transaction.support.TransactionTemplate

/** Written/compiled in M1.2 local; execution requires a fresh guarded DB authorization. */
@SpringBootTest
@ActiveProfiles("dbtest")
@ContextConfiguration(initializers = [DisposablePostgresTestDatabaseGuardInitializer::class])
@Tag("db-integration")
@EnabledIfEnvironmentVariable(named = "RITOMER_DB_TESTS_ENABLED", matches = "(?i:true)")
class SharedOidcSessionDbIntegrationTest {
  @Autowired private lateinit var jdbc: JdbcTemplate
  @Autowired private lateinit var manager: PlatformTransactionManager
  @Autowired private lateinit var environment: Environment

  @BeforeEach
  @AfterEach
  fun resetGuardedDisposableDatabase() {
    PostgresTestRailM12Activity.requireQuiescent()
    if (System.getenv("RITOMER_DB_RAIL_CAMPAIGN") == "M12" && System.getenv("RITOMER_DB_TEST_PHASE") == "m12-qualification") {
      PostgresTestRailM12Process.observeConnections(jdbc, System.getenv("RITOMER_DB_RAIL_RUN_ID"),
        PostgresTestRailM12Process.ConnectionBoundary.RESET)
    }
    DisposablePostgresTestDatabase.truncateAllCurrentTables(
      jdbc.dataSource ?: error("A guarded disposable datasource is required."), environment
    )
  }

  @Test
  fun `V11 exists and binding uniqueness revocation generation and parameterized lookup hold`() {
    assertThat(jdbc.queryForList("select version from flyway_schema_history where success=true and version is not null order by installed_rank", String::class.java))
      .containsExactly("1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11")
    assertThat(jdbc.queryForList("select tablename from pg_tables where schemaname='public' and tablename in ('oidc_identity_binding','spring_session','spring_session_attributes','oidc_authorization_transaction')", String::class.java))
      .containsExactlyInAnyOrder("oidc_identity_binding", "spring_session", "spring_session_attributes", "oidc_authorization_transaction")
    assertThat(jdbc.queryForList("select indexname from pg_indexes where schemaname='public' and indexname in ('spring_session_ix1','spring_session_ix2','spring_session_ix3','oidc_transaction_expiry')", String::class.java))
      .containsExactlyInAnyOrder("spring_session_ix1", "spring_session_ix2", "spring_session_ix3", "oidc_transaction_expiry")
    assertThat(jdbc.queryForObject("select count(*) from pg_trigger t join pg_proc p on p.oid=t.tgfoid where t.tgrelid='public.oidc_identity_binding'::regclass and t.tgname='oidc_binding_reference_changed' and t.tgenabled='O' and p.proname='rotate_oidc_binding_reference'", Int::class.java)).isEqualTo(1)
    assertThat(jdbc.queryForList("select conname from pg_constraint where conrelid in ('public.oidc_identity_binding'::regclass,'public.spring_session'::regclass,'public.spring_session_attributes'::regclass,'public.oidc_authorization_transaction'::regclass) and contype in ('p','u','f')", String::class.java))
      .contains("oidc_identity_binding_pkey", "uk_oidc_identity", "oidc_identity_binding_app_user_id_fkey", "spring_session_pk", "spring_session_attributes_pk", "spring_session_attributes_fk", "oidc_authorization_transaction_pkey", "oidc_authorization_transaction_session_hash_key")
    assertThat(jdbc.queryForObject("select count(*) from information_schema.columns where table_schema='public' and table_name in ('oidc_identity_binding','spring_session','spring_session_attributes','oidc_authorization_transaction') and is_nullable='YES'", Int::class.java)).isEqualTo(1)
    val actor = UUID.randomUUID()
    val otherActor = UUID.randomUUID()
    val initial = UUID.randomUUID()
    val subject = "synthetic-${UUID.randomUUID()}"
    val issuer = "https://accounts.google.com"
    jdbc.update("insert into app_user(id, external_subject) values (?, ?)", actor, "internal-$actor")
    jdbc.update("insert into app_user(id, external_subject) values (?, ?)", otherActor, "internal-$otherActor")
    run {
      jdbc.update("insert into oidc_identity_binding(id, issuer, subject, app_user_id) values (?, ?, ?, ?)", initial, issuer, subject, actor)
      val repository = JdbcOidcIdentityRepository(jdbc)
      assertThat(repository.findByIdentity(issuer, subject)?.actorId == actor).isTrue()
      assertThat(repository.findByIdentity("https://other.example.test", subject) == null).isTrue()
      assertThat(repository.findByIdentity(issuer, "' OR 1=1 --") == null).isTrue()
      assertThat(repository.findByIdentity("' OR 1=1 --", subject) == null).isTrue()
      jdbc.update("insert into oidc_identity_binding(issuer, subject, app_user_id) values (?, ?, ?)", issuer, "subject's-apostrophe", actor)
      assertThat(repository.findByIdentity(issuer, "subject's-apostrophe")?.actorId == actor).isTrue()
      jdbc.update("insert into oidc_identity_binding(issuer, subject, app_user_id) values (?, ?, ?)", "https://other.example.test", subject, actor)
      assertThat(repository.findByIdentity("https://other.example.test", subject)?.active).isTrue()
      for ((badIssuer, badSubject, badActor) in listOf(
        Triple("", subject, actor), Triple("i".repeat(256), subject, actor),
        Triple(issuer, "", actor), Triple(issuer, "s".repeat(256), actor),
        Triple(issuer, "missing-actor", UUID.randomUUID())
      )) assertThatThrownBy {
        jdbc.update("insert into oidc_identity_binding(issuer, subject, app_user_id) values (?, ?, ?)", badIssuer, badSubject, badActor)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      assertThatThrownBy {
        jdbc.update("insert into oidc_identity_binding(issuer, subject, app_user_id, active) values (?, ?, ?, null)", issuer, "null-active", actor)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      assertThatThrownBy {
        jdbc.update("insert into oidc_identity_binding(issuer, subject, app_user_id) values (?, ?, ?)", issuer, subject, actor)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      jdbc.update("update oidc_identity_binding set issuer=issuer, subject=subject, app_user_id=app_user_id, active=active where id=?", initial)
      assertThat(repository.findById(initial)?.active).isTrue()
      jdbc.update("update oidc_identity_binding set issuer=? where id=?", "https://changed.example.test", initial)
      assertThat(repository.findById(initial)).isNull()
      val changedIssuer = repository.findByIdentity("https://changed.example.test", subject)!!
      jdbc.update("update oidc_identity_binding set subject=? where id=?", "changed-subject", changedIssuer.id)
      assertThat(repository.findById(changedIssuer.id)).isNull()
      val changedSubject = repository.findByIdentity("https://changed.example.test", "changed-subject")!!
      jdbc.update("update oidc_identity_binding set app_user_id=? where id=?", otherActor, changedSubject.id)
      assertThat(repository.findById(changedSubject.id)).isNull()
      val changedActor = repository.findByIdentity("https://changed.example.test", "changed-subject")!!
      assertThat(changedActor.actorId == otherActor).isTrue()
      jdbc.update("update oidc_identity_binding set active=false where id=?", changedActor.id)
      assertThat(repository.findById(changedActor.id)).isNull()
      val revoked = repository.findByIdentity("https://changed.example.test", "changed-subject")!!
      assertThat(revoked.active).isFalse()
      jdbc.update("update oidc_identity_binding set active=true where id=?", revoked.id)
      assertThat(repository.findById(revoked.id)).isNull()
      val activeAgain = repository.findByIdentity("https://changed.example.test", "changed-subject")!!
      assertThat(activeAgain.active).isTrue()
      assertThat(activeAgain.id !in setOf(initial, changedIssuer.id, changedSubject.id, changedActor.id, revoked.id)).isTrue()
    }
  }

  @Test
  fun `two repository instances share only minimal session attributes and logout stays deleted after a stale save`() {
    val tx = TransactionTemplate(manager)
    @Suppress("UNCHECKED_CAST")
    fun repository() = JdbcIndexedSessionRepository(jdbc, tx) as SessionRepository<Session>
    val first = repository()
    val second = repository()
    val old = first.createSession().apply { maxInactiveInterval = Duration.ofMinutes(30) }
    first.save(old)
    val oldPrimary = jdbc.queryForObject("select primary_id from spring_session where session_id=?", String::class.java, old.id)!!
    val staleAnonymous = second.findById(old.id)!!
    first.deleteById(old.id)
    val fresh = first.createSession()
    val actor = AuthenticatedActor(UUID.randomUUID(), AuthenticationMechanism.OIDC, Instant.now(), UUID.randomUUID().toString(), UUID.randomUUID())
    fresh.setAttribute("SPRING_SECURITY_CONTEXT", SecurityContextImpl(AuthenticatedActorAuthentication.fromValidatedActor(actor)))
    val csrfName = HttpSessionCsrfTokenRepository::class.java.name + ".CSRF_TOKEN"
    fresh.setAttribute(csrfName, HttpSessionCsrfTokenRepository().generateToken(MockHttpServletRequest()))
    try {
      first.save(fresh)
      assertThat(fresh.id != old.id).isTrue()
      assertThat(jdbc.queryForObject("select primary_id from spring_session where session_id=?", String::class.java, fresh.id) != oldPrimary).isTrue()
      staleAnonymous.lastAccessedTime = Instant.now().plusMillis(1)
      second.save(staleAnonymous)
      assertThat(first.findById(old.id)).isNull()
      val restored = second.findById(fresh.id)!!
      val authentication = restored.getAttribute<SecurityContextImpl>("SPRING_SECURITY_CONTEXT").authentication
      assertThat(authentication is AuthenticatedActorAuthentication && authentication.principal == actor && authentication.credentials == null && authentication.details == null && authentication.authorities.isEmpty()).isTrue()
      assertThat(restored.attributeNames).containsExactlyInAnyOrder("SPRING_SECURITY_CONTEXT", csrfName)
      assertThat(restored.getAttribute<CsrfToken>(csrfName) != null).isTrue()
      assertThat(jdbc.queryForObject("select principal_name from spring_session where session_id=?", String::class.java, fresh.id) == actor.opaqueAuthCorrelation).isTrue()
      val bytes = jdbc.queryForList("select attribute_bytes from spring_session_attributes where session_primary_id=(select primary_id from spring_session where session_id=?)", ByteArray::class.java, fresh.id)
      assertThat(bytes.size).isEqualTo(2)
      assertThat(bytes.all { serialized -> listOf("OAuth2", "OidcUser", "accessToken", "refreshToken", "idToken", "claims").none { serialized.toString(Charsets.ISO_8859_1).contains(it) } }).isTrue()
      first.deleteById(fresh.id)
      assertThat(jdbc.queryForObject("select count(*) from spring_session_attributes", Int::class.java)).isZero()
      restored.lastAccessedTime = Instant.now().plusMillis(1)
      second.save(restored)
      assertThat(first.findById(fresh.id)).isNull()
      assertThat(jdbc.queryForObject("select count(*) from spring_session_attributes where session_primary_id not in (select primary_id from spring_session)", Int::class.java)).isZero()
    } finally { first.deleteById(old.id); first.deleteById(fresh.id) }
  }

  @Test
  fun `atomic consumption across two DB connections has one winner and committed failure cannot replay`() {
    val store = JdbcOidcTransactionStore(jdbc, manager)
    val state = digest(UUID.randomUUID().toString())
    val session = digest(UUID.randomUUID().toString())
    val material = OidcTransaction("synthetic-nonce", "v".repeat(43), "/")
    val lease = PostgresTestRailM12Activity.begin("jdbc-workers")
    val executor = Executors.newFixedThreadPool(2)
    try {
      store.save(state, session, material)
      assertThat(store.read(state, digest("wrong-session"))).isNull()
      assertThat(store.consume(state, digest("wrong-session"))).isNull()
      assertThat(store.read(state, session) != null).isTrue()
      val acquired = CountDownLatch(2)
      val pids = ConcurrentHashMap.newKeySet<Int>()
      val concurrentManager = object : PlatformTransactionManager {
        override fun getTransaction(definition: TransactionDefinition?): TransactionStatus {
          check(definition?.propagationBehavior == TransactionDefinition.PROPAGATION_REQUIRES_NEW)
          val status = manager.getTransaction(definition)
          try {
            pids.add(jdbc.queryForObject("select pg_backend_pid()", Int::class.java)!!)
            acquired.countDown()
            check(acquired.await(3, TimeUnit.SECONDS)) { "M12_CONNECTION_RENDEZVOUS_TIMEOUT" }
            return status
          } catch (failure: Throwable) { manager.rollback(status); throw failure }
        }
        override fun commit(status: TransactionStatus) = manager.commit(status)
        override fun rollback(status: TransactionStatus) = manager.rollback(status)
      }
      val concurrentStore = JdbcOidcTransactionStore(jdbc, concurrentManager)
      val callbacks = (1..2).map { executor.submit<OidcTransaction?> { concurrentStore.consume(state, session) } }
      val results = callbacks.map { it.get(10, TimeUnit.SECONDS) }
      assertThat(pids.size).isEqualTo(2)
      assertThat(results.count { sameMaterial(it, material) }).isEqualTo(1)
      assertThat(results.count { it == null }).isEqualTo(1)
      assertThat(jdbc.queryForObject("select count(*) from oidc_authorization_transaction where state_hash=?", Int::class.java, state)).isZero()
      assertThat(store.consume(state, session)).isNull()
      // Simulates a downstream admission failure inside an outer transaction.
      store.save(state, session, material)
      TransactionTemplate(manager).executeWithoutResult { status ->
        assertThat(store.consume(state, session)).isNotNull()
        status.setRollbackOnly()
      }
      assertThat(store.consume(state, session)).isNull()
      assertThat(jdbc.queryForObject("select count(*) from oidc_authorization_transaction where state_hash=?", Int::class.java, state)).isZero()
    } finally {
      executor.shutdownNow()
      val stopped = executor.awaitTermination(5, TimeUnit.SECONDS)
      if (stopped) lease.complete()
      check(stopped) { "M12_JDBC_WORKERS_NOT_STOPPED" }
      store.clear(session)
    }
  }

  @Test
  fun `database TTL constraint expiration and cleanup retain no usable expired transaction`() {
    val store = JdbcOidcTransactionStore(jdbc, manager)
    val state = digest(UUID.randomUUID().toString())
    val session = digest(UUID.randomUUID().toString())
    try {
      store.save(state, session, OidcTransaction("synthetic-nonce", "v".repeat(43), "/"))
      assertThat(jdbc.queryForObject("select expires_at=created_at + interval '5 minutes' and created_at<=clock_timestamp() and created_at>clock_timestamp()-interval '30 seconds' from oidc_authorization_transaction where state_hash=?", Boolean::class.java, state)).isTrue()
      assertThatThrownBy { jdbc.update("update oidc_authorization_transaction set expires_at=created_at where state_hash=?", state) }
        .isInstanceOf(DataIntegrityViolationException::class.java)
      assertThatThrownBy { jdbc.update("update oidc_authorization_transaction set expires_at=created_at + interval '6 minutes' where state_hash=?", state) }
        .isInstanceOf(DataIntegrityViolationException::class.java)
      jdbc.update("with stamp as (select clock_timestamp() as now) update oidc_authorization_transaction set created_at=stamp.now-interval '6 minutes', expires_at=stamp.now-interval '1 minute' from stamp where state_hash=?", state)
      assertThat(store.read(state, session)).isNull()
      assertThat(store.consume(state, session)).isNull()
      store.purgeExpired()
      assertThat(jdbc.queryForObject("select count(*) from oidc_authorization_transaction where state_hash=?", Int::class.java, state)).isZero()
      val replacement = digest(UUID.randomUUID().toString())
      val witnessState = digest(UUID.randomUUID().toString())
      val witnessSession = digest(UUID.randomUUID().toString())
      val material = OidcTransaction("synthetic-nonce", "v".repeat(43), "/")
      store.save(witnessState, witnessSession, material)
      store.save(state, session, material)
      store.save(replacement, session, material)
      assertThat(store.read(state, session)).isNull()
      assertThat(sameMaterial(store.read(replacement, session), material)).isTrue()
      assertThat(jdbc.queryForObject("select count(*) from oidc_authorization_transaction where session_hash=?", Int::class.java, session)).isEqualTo(1)
      store.clear(session)
      assertThat(sameMaterial(store.read(witnessState, witnessSession), material)).isTrue()
      assertThatThrownBy {
        jdbc.update("insert into oidc_authorization_transaction(state_hash,session_hash,nonce,code_verifier,return_path,created_at,expires_at) select ?,session_hash,nonce,code_verifier,return_path,created_at,expires_at from oidc_authorization_transaction where state_hash=?", state, witnessState)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      assertThatThrownBy {
        jdbc.update("insert into oidc_authorization_transaction(state_hash,session_hash,nonce,code_verifier,return_path,created_at,expires_at) select state_hash,?,nonce,code_verifier,return_path,created_at,expires_at from oidc_authorization_transaction where state_hash=?", session, witnessState)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      for (nonce in listOf("", "n".repeat(257))) assertThatThrownBy {
        jdbc.update("update oidc_authorization_transaction set nonce=? where state_hash=?", nonce, witnessState)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      for (verifier in listOf("v".repeat(42), "v".repeat(129))) assertThatThrownBy {
        jdbc.update("update oidc_authorization_transaction set code_verifier=? where state_hash=?", verifier, witnessState)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      jdbc.update("update oidc_authorization_transaction set nonce=?,code_verifier=?,return_path=? where state_hash=?", "n".repeat(256), "v".repeat(128), "r".repeat(100), witnessState)
      assertThatThrownBy {
        jdbc.update("update oidc_authorization_transaction set return_path=? where state_hash=?", "r".repeat(101), witnessState)
      }.isInstanceOf(DataIntegrityViolationException::class.java)
      // Direct SQL fixtures reach SQL constraints instead of application value-object validation.
      jdbc.update("with stamp as (select clock_timestamp() as now) insert into oidc_authorization_transaction(state_hash,session_hash,nonce,code_verifier,return_path,created_at,expires_at) select md5(g::text)||md5((g+1000)::text),md5((g+2000)::text)||md5((g+3000)::text),'synthetic-nonce',repeat('v',43),'/',stamp.now-interval '6 minutes',stamp.now-interval '1 minute' from generate_series(1,101) g cross join stamp")
      store.purgeExpired()
      assertThat(jdbc.queryForObject("select count(*) from oidc_authorization_transaction where expires_at<=clock_timestamp()", Int::class.java)).isEqualTo(1)
      val expired = jdbc.queryForMap("select state_hash,session_hash from oidc_authorization_transaction where expires_at<=clock_timestamp()")
      assertThat(store.read(expired["state_hash"] as String, expired["session_hash"] as String)).isNull()
      assertThat(store.consume(expired["state_hash"] as String, expired["session_hash"] as String)).isNull()
      store.save(state, session, material)
      assertThat(jdbc.queryForObject("select count(*) from oidc_authorization_transaction where expires_at<=clock_timestamp()", Int::class.java)).isZero()
      assertThat(jdbc.queryForObject("select count(*) from oidc_authorization_transaction where state_hash=?", Int::class.java, witnessState)).isEqualTo(1)
      store.clear(witnessSession)
    } finally { store.clear(session) }
  }

  @Test
  @Tag("m12-process")
  fun `two owned JVMs preserve sessions across restart and logout without affecting the second account`() {
    PostgresTestRailM12Process.runQualification(jdbc, environment)
  }

  private fun sameMaterial(actual: OidcTransaction?, expected: OidcTransaction): Boolean = actual != null &&
    actual.nonce == expected.nonce && actual.verifier == expected.verifier && actual.returnPath == expected.returnPath
}
