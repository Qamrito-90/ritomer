package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabaseGuardInitializer
import ch.qamwaq.ritomer.testsupport.POSTGRES_TEST_RAIL_ADMINISTRATIVE_SETTINGS
import ch.qamwaq.ritomer.testsupport.POSTGRES_TEST_RAIL_ALL_SAFE_SETTINGS
import ch.qamwaq.ritomer.testsupport.POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS
import ch.qamwaq.ritomer.testsupport.PostgresTestRailJdbcLogging
import ch.qamwaq.ritomer.testsupport.PostgresTestRailDBootstrap
import ch.qamwaq.ritomer.testsupport.postgresTestRailProvenance
import com.zaxxer.hikari.HikariConfig
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import java.lang.reflect.InvocationHandler
import java.lang.reflect.Method
import java.lang.reflect.Proxy
import java.nio.charset.StandardCharsets
import java.nio.file.Files
import java.nio.file.Path
import java.sql.Connection
import java.sql.DatabaseMetaData
import java.sql.ResultSet
import java.sql.SQLException
import java.sql.Statement
import java.util.Properties
import javax.sql.DataSource
import kotlin.io.path.readText
import kotlin.streams.asSequence
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.assertj.core.api.Assertions.catchThrowable
import org.junit.jupiter.api.Tag
import org.junit.jupiter.api.Test
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.ValueSource
import org.springframework.asm.AnnotationVisitor
import org.springframework.asm.ClassReader
import org.springframework.asm.ClassVisitor
import org.springframework.asm.ClassWriter
import org.springframework.asm.FieldVisitor
import org.springframework.asm.Handle
import org.springframework.asm.Label
import org.springframework.asm.MethodVisitor
import org.springframework.asm.Opcodes
import org.springframework.asm.Type
import org.springframework.boot.context.properties.bind.Bindable
import org.springframework.boot.context.properties.bind.Binder
import org.springframework.boot.context.properties.source.ConfigurationPropertySources
import org.springframework.boot.env.YamlPropertySourceLoader
import org.springframework.boot.test.autoconfigure.properties.AnnotationsPropertySource
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.support.GenericApplicationContext
import org.springframework.core.env.MapPropertySource
import org.springframework.core.env.EnumerablePropertySource
import org.springframework.core.env.StandardEnvironment
import org.springframework.core.io.FileSystemResource
import org.springframework.mock.env.MockEnvironment
import org.springframework.test.annotation.DirtiesContext
import org.springframework.test.context.BootstrapUtils
import org.springframework.test.context.CacheAwareContextLoaderDelegate
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.context.MergedContextConfiguration
import org.springframework.test.context.bean.override.BeanOverrideHandler
import org.springframework.test.context.support.DefaultBootstrapContext
import org.springframework.test.context.support.TestPropertySourceUtils
import org.springframework.test.util.ReflectionTestUtils

class DemoSeedLocalSourceGuardTest {
  @Test
  fun m1dBusinessContractsKeepSessionAndBearerAlternativesAndConditionalCsrf() {
    val expectedUnsafe = linkedMapOf(
      "mapping-suggestions" to setOf("recordMappingSuggestionDecision"),
      "mapping-suggestions-v2" to emptySet(),
      "closing-folders" to setOf("createClosingFolder", "patchClosingFolder", "archiveClosingFolder"),
      "import-balance" to setOf("createBalanceImport"),
      "manual-mapping" to setOf("upsertManualMapping", "deleteManualMapping"),
      "workpapers" to setOf("upsertWorkpaper", "reviewWorkpaper"),
      "documents" to setOf("uploadWorkpaperDocument", "reviewDocumentVerification"),
      "exports" to setOf("createExportPack")
    )
    val yaml = org.yaml.snakeyaml.Yaml(org.yaml.snakeyaml.constructor.SafeConstructor(
      org.yaml.snakeyaml.LoaderOptions().apply { isAllowDuplicateKeys = false }
    ))
    var unsafeCount = 0
    expectedUnsafe.forEach { (contract, unsafeIds) ->
      val document = yaml.load<Map<String, Any>>(
        Path.of("../contracts/openapi/$contract-api.yaml").readText()
      )
      assertThat(document).doesNotContainKey("security")
      val components = document["components"] as Map<*, *>
      val schemes = components["securitySchemes"] as Map<*, *>
      assertThat(schemes.keys.map { it.toString() })
        .containsExactlyInAnyOrder("cookieSession", "csrfToken", "bearerAuth")
      val cookie = schemes["cookieSession"] as Map<*, *>
      assertThat(cookie["type"]).isEqualTo("apiKey")
      assertThat(cookie["in"]).isEqualTo("cookie")
      assertThat(cookie["name"]).isEqualTo("__Host-ritomer-session")
      val csrf = schemes["csrfToken"] as Map<*, *>
      assertThat(csrf["type"]).isEqualTo("apiKey")
      assertThat(csrf["in"]).isEqualTo("header")
      assertThat(csrf["name"]).isEqualTo("X-CSRF-TOKEN")
      val bearer = schemes["bearerAuth"] as Map<*, *>
      assertThat(bearer["type"]).isEqualTo("http")
      assertThat(bearer["scheme"]).isEqualTo("bearer")
      val foundUnsafe = linkedSetOf<String>()
      val paths = document["paths"] as Map<*, *>
      paths.forEach { (_, rawPath) ->
        (rawPath as Map<*, *>).forEach { (method, rawOperation) ->
          assertThat(method).isIn("get", "post", "put", "patch", "delete")
          val operation = rawOperation as Map<*, *>
          val unsafe = method != "get"
          if (unsafe) {
            unsafeCount++
            foundUnsafe += operation["operationId"] as String
          }
          val expectedCookie = linkedMapOf("cookieSession" to emptyList<String>()).apply {
            if (unsafe) put("csrfToken", emptyList())
          }
          assertThat(operation["security"]).isEqualTo(
            listOf(expectedCookie, mapOf("bearerAuth" to emptyList<String>()))
          )
          val responses = operation["responses"] as Map<*, *>
          assertThat(responses.keys.map { it.toString() }).contains("400", "401", "403")
          if (operation["operationId"] !in setOf("createClosingFolder", "listClosingFolders")) {
            assertThat(responses.keys.map { it.toString() }).contains("404")
          }
          val badRequest = responses["400"] as Map<*, *>
          val unauthenticated = responses["401"] as Map<*, *>
          val forbidden = responses["403"] as Map<*, *>
          assertThat(badRequest["description"].toString())
            .contains("INVALID_TENANT_HEADER", "AMBIGUOUS_CREDENTIALS", "REQUEST_REJECTED")
          assertThat(unauthenticated["description"].toString()).contains("SESSION_EXPIRED")
          assertThat(forbidden["description"].toString()).contains("ACCESS_DENIED", "ACCESS_REVOKED")
          if (unsafe) assertThat(forbidden["description"].toString()).contains("CSRF_REJECTED")
        }
      }
      assertThat(foundUnsafe).isEqualTo(unsafeIds)
    }
    assertThat(unsafeCount).isEqualTo(12)
    val legacy = yaml.load<Map<String, Any>>(Path.of("../contracts/openapi/closing-api.yaml").readText())
    assertThat(legacy["info"].toString()).contains("Legacy", "superseded")
  }

  @Test
  fun dbtestPoolLimitsBindToHikariWithoutStartingAPool() {
    // Bind only the real YAML, with no system/environment sources or placeholder resolution.
    // HikariConfig has no pool or JDBC lifecycle; do not replace it with a started DataSource.
    assertThat(System.getProperty("hikaricp.configurationFile")).isNull()
    val sources = YamlPropertySourceLoader().load(
      "dbtest", FileSystemResource("src/main/resources/application-dbtest.yml")
    )
    val configuration = HikariConfig()
    Binder(ConfigurationPropertySources.from(sources))
      .bind("spring.datasource.hikari", Bindable.ofInstance(configuration))

    assertThat(configuration.maximumPoolSize).isEqualTo(2)
    assertThat(configuration.minimumIdle).isZero()
    println("dbtest_hikari_binding=maximumPoolSize:${configuration.maximumPoolSize},minimumIdle:${configuration.minimumIdle}")
  }

  @Test
  fun dbtestFullWorkerPoolBudgetFitsRunnerLimit() {
    val compiledClasses = compiledProjectTestClasses()
    val dbTests = compiledClasses.filter { DB_INTEGRATION_TAG in it.tags }
    assertThat(dbTests.map { it.simpleName }).containsExactlyInAnyOrderElementsOf(EXPECTED_DB_INTEGRATION_CLASSES)
    val build = postgresRailBuildSource()
    val declaredFullClasses = Regex("\"(ch\\.qamwaq\\.ritomer\\.[^\"]+)\"")
      .findAll(build.sliceBetween("val m1BPostgresRailFullClasses = setOf(", "val m1BPostgresRailRequiredCompiledClasses"))
      .map { it.groupValues[1] }.toSet()
    assertThat(dbTests.map { it.internalName.replace('/', '.') }.toSet()).isEqualTo(declaredFullClasses)

    val noContextLoading = object : CacheAwareContextLoaderDelegate {
      override fun loadContext(mergedConfig: MergedContextConfiguration): ApplicationContext =
        error("The dbtest budget must never load an application context.")

      override fun closeContext(
        mergedConfig: MergedContextConfiguration,
        hierarchyMode: DirtiesContext.HierarchyMode?
      ): Unit = error("The dbtest budget must never manage application contexts.")
    }
    val configurations = dbTests.associate { facts ->
      val testClass = Class.forName(facts.internalName.replace('/', '.'), false, javaClass.classLoader)
      val bootstrapper = BootstrapUtils.resolveTestContextBootstrapper(testClass)
      bootstrapper.setBootstrapContext(DefaultBootstrapContext(testClass, noContextLoading))
      testClass to bootstrapper.buildMergedContextConfiguration()
    }
    configurations.forEach { (testClass, configuration) ->
      assertDbtestMetadataHasNoUnaccountedConnectionSource(testClass, configuration)
    }

    // Spring's real equality includes inline properties, imports, mocks and other customizers.
    // Count every distinct configuration as retained: no cache eviction, idle timeout or test order credit.
    val groups = configurations.entries.groupBy { it.value }
    val maxima = groups.map { (configuration, entries) ->
      val sources = listOf(
        MapPropertySource(
          "test-inline",
          TestPropertySourceUtils.convertInlinedPropertiesToMap(*configuration.propertySourceProperties)
        ),
        AnnotationsPropertySource(configuration.testClass)
      ) + YamlPropertySourceLoader().load(
        "dbtest", FileSystemResource("src/main/resources/application-dbtest.yml")
      ) + YamlPropertySourceLoader().load(
        "application", FileSystemResource("src/main/resources/application.yml")
      )
      val propertyNames = sources.flatMap { (it as EnumerablePropertySource<*>).propertyNames.toList() }
      assertThat(propertyNames.filter { it.startsWith("spring.datasource.") }).isSubsetOf(
        "spring.datasource.url", "spring.datasource.username", "spring.datasource.password",
        "spring.datasource.hikari.maximum-pool-size", "spring.datasource.hikari.minimum-idle",
        "spring.datasource.hikari.data-source-properties.ApplicationName",
        "spring.datasource.hikari.data-source-properties.logServerErrorDetail",
        "spring.datasource.hikari.data-source-properties.sslmode",
        "spring.datasource.hikari.data-source-properties.gssEncMode"
      )
      assertThat(propertyNames.filter { it.startsWith("spring.flyway.") })
        .isSubsetOf("spring.flyway.enabled", "spring.flyway.clean-disabled")
      assertThat(propertyNames.filter {
        it.startsWith("spring.config.") || it.startsWith("spring.profiles.") ||
          it.startsWith("spring.autoconfigure.exclude")
      }).isEmpty()
      assertThat(System.getProperty("hikaricp.configurationFile")).isNull()
      val pool = HikariConfig()
      Binder(ConfigurationPropertySources.from(sources))
        .bind("spring.datasource.hikari", Bindable.ofInstance(pool))
      assertThat(pool.maximumPoolSize).isEqualTo(2)
      assertThat(pool.minimumIdle).isZero()
      println(
        "dbtest_pool_group=${entries.map { it.key.simpleName }.sorted().joinToString(",")};" +
          "maximum=${pool.maximumPoolSize};minimumIdle=${pool.minimumIdle};" +
          "customizers=${configuration.contextCustomizers.map { it.javaClass.name }.sorted().joinToString(",")}"
      )
      pool.maximumPoolSize
    }

    assertDbtestConnectionAndSerializationAssumptions(compiledClasses, dbTests, build)
    val guardConnections = 1 // The serial startup initializer's direct connection, outside Hikari.
    val runnerLimit = 16
    val poolMaximum = maxima.sum()
    val totalMaximum = poolMaximum + guardConnections
    assertThat(totalMaximum).isLessThanOrEqualTo(runnerLimit)
    println(
      "dbtest_connection_budget=classes:${dbTests.size},cacheKeys:${groups.size},pools:${maxima.size}," +
        "poolMaximum:$poolMaximum,extraGuardConnections:$guardConnections,total:$totalMaximum," +
        "runnerLimit:$runnerLimit,margin:${runnerLimit - totalMaximum}"
    )
  }

  private fun assertDbtestMetadataHasNoUnaccountedConnectionSource(
    testClass: Class<*>,
    configuration: MergedContextConfiguration
  ) {
    assertThat(configuration.parent).isNull()
    assertThat(configuration.locations).isEmpty()
    assertThat(configuration.propertySourceDescriptors).isEmpty()
    assertThat(configuration.activeProfiles).containsExactly("dbtest")
    assertThat(configuration.classes.map { it.name })
      .containsExactly("ch.qamwaq.ritomer.RitomerBackendApplication")
    assertThat(configuration.contextInitializerClasses)
      .containsExactly(DisposablePostgresTestDatabaseGuardInitializer::class.java)
    assertThat(testClass.superclass).isEqualTo(Any::class.java)
    assertThat(testClass.declaredAnnotations.map { it.annotationClass.java.name }).isSubsetOf(
      "kotlin.Metadata",
      "org.springframework.boot.test.context.SpringBootTest",
      "org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc",
      "org.springframework.test.context.ActiveProfiles",
      "org.springframework.test.context.ContextConfiguration",
      "org.springframework.context.annotation.Import",
      "org.junit.jupiter.api.Tag",
      "org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable"
    )
    val imports = testClass.getAnnotation(Import::class.java)?.value.orEmpty()
    assertThat(imports.map { it.java.name })
      .isSubsetOf("ch.qamwaq.ritomer.WorkpapersDbIntegrationTestConfig")
    imports.forEach { imported ->
      assertThat(imported.java.declaredMethods.filter { it.isAnnotationPresent(Bean::class.java) }
        .map { it.returnType.name })
        .containsExactly("ch.qamwaq.ritomer.RollbackAwareAuditTrail")
    }
    assertThat(testClass.declaredMethods.any { it.isAnnotationPresent(DynamicPropertySource::class.java) })
      .isFalse()

    val supportedCustomizers = setOf(
      "org.springframework.boot.test.context.filter.ExcludeFilterContextCustomizer",
      "org.springframework.boot.test.json.DuplicateJsonObjectContextCustomizerFactory\$DuplicateJsonObjectContextCustomizer",
      "org.springframework.boot.test.mock.mockito.MockitoContextCustomizer",
      "org.springframework.boot.test.web.client.TestRestTemplateContextCustomizer",
      "org.springframework.boot.test.web.reactor.netty.DisableReactorResourceFactoryGlobalResourcesContextCustomizerFactory\$DisableReactorResourceFactoryGlobalResourcesContextCustomizerCustomizer",
      "org.springframework.boot.test.autoconfigure.OnFailureConditionReportContextCustomizerFactory\$OnFailureConditionReportContextCustomizer",
      "org.springframework.boot.test.autoconfigure.actuate.observability.ObservabilityContextCustomizerFactory\$DisableObservabilityContextCustomizer",
      "org.springframework.boot.test.autoconfigure.properties.PropertyMappingContextCustomizer",
      "org.springframework.boot.test.autoconfigure.web.servlet.WebDriverContextCustomizer",
      "org.springframework.test.context.bean.override.BeanOverrideContextCustomizer",
      "org.springframework.test.context.support.DynamicPropertiesContextCustomizer",
      "org.springframework.boot.test.context.SpringBootTestAnnotation",
      "org.springframework.boot.test.context.ImportsContextCustomizer"
    )
    assertThat(configuration.contextCustomizers.map { it.javaClass.name }).isSubsetOf(supportedCustomizers)
    configuration.contextCustomizers.forEach { customizer ->
      when (customizer.javaClass.name) {
        "org.springframework.test.context.support.DynamicPropertiesContextCustomizer" ->
          assertThat(ReflectionTestUtils.getField(customizer, "methods") as Collection<*>).isEmpty()
        "org.springframework.boot.test.mock.mockito.MockitoContextCustomizer" ->
          assertThat(ReflectionTestUtils.getField(customizer, "definitions") as Collection<*>).isEmpty()
        "org.springframework.test.context.bean.override.BeanOverrideContextCustomizer" -> {
          // Inspect the typed handler collection without depending on a private field name.
          val handlerField = customizer.javaClass.declaredFields.single {
            Collection::class.java.isAssignableFrom(it.type) &&
              it.genericType.typeName.contains(BeanOverrideHandler::class.java.name)
          }
          check(handlerField.trySetAccessible()) { "Bean override metadata must be inspectable." }
          val handlers = handlerField.get(customizer) as Collection<*>
          assertThat(handlers.map { (it as BeanOverrideHandler).beanType.resolve()?.name })
            .containsExactly("ch.qamwaq.ritomer.identity.application.AppUserRepository")
        }
      }
    }
  }

  private fun assertDbtestConnectionAndSerializationAssumptions(
    compiledClasses: List<CompiledClassFacts>,
    dbTests: List<CompiledClassFacts>,
    build: String
  ) {
    val roots = dbTests.map { it.internalName } + listOf(
      "ch/qamwaq/ritomer/WorkpapersDbIntegrationTestConfig",
      "ch/qamwaq/ritomer/RollbackAwareAuditTrail"
    )
    val connectionCalls = compiledClasses.filter { facts ->
      roots.any { facts.internalName == it || facts.internalName.startsWith(it + '$') }
    }.flatMap { dbtestMethodCallsIncludingHandles(it.internalName) }
    assertThat(connectionCalls.filter { call ->
      (call.owner == "java/sql/DriverManager" && call.name == "getConnection") ||
        (call.owner == "java/sql/Driver" && call.name == "connect") ||
        (call.name == "<init>" && call.owner.contains("DataSource")) ||
        call.owner.startsWith("com/zaxxer/hikari/") ||
        (call.owner.endsWith("DataSourceBuilder") && call.name == "build")
    }).isEmpty()
    assertThat(connectionCalls.filter {
      it.owner == "org/flywaydb/core/api/configuration/FluentConfiguration" && it.name == "dataSource"
    }.map { it.descriptor })
      .isNotEmpty()
      .allMatch { it.startsWith("(Ljavax/sql/DataSource;)") }

    val guard = postgresRuntimeGuardSource()
    val initializer = guard.sliceBetween(
      "internal class DisposablePostgresTestDatabaseGuardInitializer(",
      "private enum class StartupStage"
    )
    assertThat(initializer).contains(
      "DriverManager::getConnection",
      "connect(configuration.jdbcUrl, connectionProperties).use { connection ->"
    )
    assertThat(initializer).doesNotContain("Thread", "Executor", "launch(", "async(")
    val initializerName = GUARD_INITIALIZER_INTERNAL_NAME
    val startupCalls = compiledClasses.filter {
      it.internalName == initializerName || it.internalName.startsWith(initializerName + '$')
    }.flatMap { dbtestMethodCallsIncludingHandles(it.internalName) }
    assertThat(startupCalls.count { it.owner == "java/sql/DriverManager" && it.name == "getConnection" })
      .isEqualTo(1)
    assertThat(guard).contains(
      "if (flywayDataSource !== dataSource)",
      "dataSource.connection.use { connection ->"
    )
    val worker = build.sliceBetween(
      "fun Test.configureM1BPostgresRailTest(",
      "tasks.register<Test>(\"m1BPostgresRailTargeted\")"
    )
    assertThat(worker).contains("maxParallelForks = 1")
    assertThat(build).doesNotContain("junit.jupiter.execution.parallel", "forkEvery")
    assertThat(System.getProperty("junit.jupiter.execution.parallel.enabled", "false")).isEqualTo("false")
    javaClass.classLoader.getResources("junit-platform.properties").asSequence().forEach { resource ->
      val properties = Properties().apply { resource.openStream().use { load(it) } }
      assertThat(properties.getProperty("junit.jupiter.execution.parallel.enabled", "false")).isEqualTo("false")
    }
    val rail = postgresRailScriptSource()
    assertThat(rail).contains("CONNECTION LIMIT 16", "'--max-workers=1'")
    val lifecycle = rail.sliceBetween("function Invoke-M1BLifecycle {", "function Invoke-M1BMain {")
    assertThat(lifecycle.indexOf("'targeted' ")).isLessThan(lifecycle.indexOf("'full' "))
    assertThat(rail).contains("Read-M1BBoundedProcessStreams")
    // The existing locking scenario borrows two connections from its one pool: no extra +2.
    val lockingTest = Path.of(
      "src/test/kotlin/ch/qamwaq/ritomer/MappingSuggestionDecisionDbIntegrationTest.kt"
    ).readText()
    assertThat(lockingTest).contains(
      "val connection1 = dataSource.connection",
      "val connection2 = dataSource.connection",
      "Executors.newFixedThreadPool(2)"
    )
  }

  private fun dbtestMethodCallsIncludingHandles(internalName: String): List<CompiledMethodCall> {
    val calls = mutableListOf<CompiledMethodCall>()
    javaClass.classLoader.getResourceAsStream("$internalName.class").use { stream ->
      checkNotNull(stream)
      ClassReader(stream).accept(object : ClassVisitor(Opcodes.ASM9) {
        override fun visitMethod(
          access: Int, name: String, descriptor: String, signature: String?, exceptions: Array<out String>?
        ): MethodVisitor = object : MethodVisitor(Opcodes.ASM9) {
          override fun visitMethodInsn(opcode: Int, owner: String, name: String, descriptor: String, isInterface: Boolean) {
            calls += CompiledMethodCall(owner, name, descriptor)
          }

          override fun visitInvokeDynamicInsn(
            name: String, descriptor: String, bootstrapMethodHandle: Handle, vararg bootstrapMethodArguments: Any
          ) {
            (listOf(bootstrapMethodHandle) + bootstrapMethodArguments.filterIsInstance<Handle>()).forEach {
              calls += CompiledMethodCall(it.owner, it.name, it.desc)
            }
          }
        }
      }, ClassReader.SKIP_DEBUG or ClassReader.SKIP_FRAMES)
    }
    return calls
  }

  @Test
  fun `demo seed main source exposes no http endpoint auth bypass or sensitive local value`() {
    val source = mainDevtoolsSource()

    assertThat(source).doesNotContain(
      "@RestController",
      "@Controller",
      "@RequestMapping",
      "@GetMapping",
      "@PostMapping",
      "@PutMapping",
      "@DeleteMapping",
      "SecurityFilterChain",
      "permitAll",
      "JwtDecoder",
      "BearerToken",
      "password",
      "secret",
      "token",
      "credential",
      "GraphQL",
      "OpenAPI"
    )
    assertThat(source).contains(
      DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT,
      DEMO_SEED_DATASET_CLASSIFICATION_043B,
      DemoSeedLocalDataset.reviewerExternalSubject
    )
    assertThat(source).doesNotContain(
      "insert into workpaper",
      "insert into workpaper_evidence",
      "insert into document",
      "insert into document_verification",
      "insert into export_pack"
    )
    assertThat(Regex("""(^|[\\/])\.env($|[^A-Za-z])""").containsMatchIn(source)).isFalse()
  }

  @Test
  fun `demo seed Gradle task uses exact documented Gradle property names`() {
    val runbook = Path.of("../runbooks/local-dev.md").readText()
    val buildScript = Path.of("build.gradle.kts").readText()
    val enabledProperty = "ritomerDemoSeedEnabled"
    val profileProperty = "ritomerDemoSeedProfile"
    val variantProperty = "ritomerDemoSeedVariant"

    assertThat(runbook).contains(
      "-P$enabledProperty=true",
      "-P$profileProperty=dbtest",
      "-P$variantProperty=$DEMO_SEED_VARIANT_042A2A5D_MIXED_V2",
      "-P$variantProperty=$DEMO_SEED_VARIANT_043B_TWO_ACTOR_PILOT"
    )
    assertThat(buildScript).contains(
      """providers.gradleProperty("$enabledProperty")""",
      """providers.gradleProperty("$profileProperty")""",
      """providers.gradleProperty("$variantProperty")"""
    )
  }

  @Test
  fun postgresLeanRailPinsDirectPsqlAndOneProcessPerPhase() {
    val script = postgresRailScriptSource()
    val argumentBlock = script.sliceBetween(
      "\$script:PsqlArgumentsExact = @(",
      "\$script:TargetDatabase"
    )
    val invoker = script.sliceBetween(
      "function Invoke-M1BDirectPsql",
      "\nfunction " // Bound only this function; adjacent Gradle helpers are a different control surface.
    )
    val binaryGuard = script.sliceBetween(
      "function Assert-M1BPsqlBinary",
      "function Read-M1BBoundedProcessStreams"
    )
    val preflight = script.sliceBetween(
      "function Invoke-M1BPreflight {",
      "function Invoke-M1BLifecycle {"
    )
    val lifecycle = script.sliceBetween(
      "function Invoke-M1BLifecycle {",
      "function Invoke-M1BMain {"
    )

    assertThat(script).contains(
      "\$script:PsqlExeExact = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe'",
      "\$script:PsqlConnectionExact = " +
        "'hostaddr=127.0.0.1 port=15432 dbname=postgres user=postgres connect_timeout=5 " +
        "sslmode=disable gssencmode=disable require_auth=scram-sha-256 " +
        "application_name=ritomer_m1b_admin_rail'",
      "if (\$MyInvocation.InvocationName -cne '.')"
    )
    assertThat(argumentBlock.replace("\r\n", "\n").trim()).isEqualTo(
      """
      ${'$'}script:PsqlArgumentsExact = @(
        '-X',
        '-W',
        '-q',
        '-A',
        '-t',
        '--set=ON_ERROR_STOP=1',
        '--set=VERBOSITY=terse',
        '--dbname',
        ${'$'}script:PsqlConnectionExact
      )
      """.trimIndent()
    )
    assertThat(argumentBlock).doesNotContain("'-h'", "'-p'", "'-U'", "'-d'")
    assertThat(
      Regex("""Invoke-M1BDirectPsql -Phase '(Preflight|Provision|Cleanup)'""")
        .findAll(script)
        .map { it.groupValues[1] }
        .toList()
    ).containsExactly("Preflight", "Provision", "Cleanup")
    assertThat(Regex("""\.Start\(\)""").findAll(invoker).count()).isEqualTo(1)
    assertThat(invoker).contains(
      "System.Diagnostics.ProcessStartInfo",
      "\$startInfo.FileName = \$script:PsqlExeExact",
      "\$startInfo.UseShellExecute = \$false",
      "\$startInfo.CreateNoWindow = (\$Campaign -ceq 'D')",
      "\$startInfo.RedirectStandardInput = \$true",
      "\$startInfo.EnvironmentVariables.Clear()",
      "Read-M1BBoundedProcessStreams",
      "-StandardInputText \$stdinText",
      "_SECOND_START_REJECTED"
    )
    assertThat(binaryGuard).contains(
      "if (\$sha256 -cne \$ExpectedPsqlSha256)",
      "PSQL_EXECUTABLE_SHA256_DIVERGED"
    )
    assertAppearsInOrder(invoker, "\$binary = Assert-M1BPsqlBinary", "\$process.Start()")
    assertThat(invoker).doesNotContain(
      "Start-Process",
      "cmd.exe",
      ".bat",
      "ReadToEnd",
      "Get-Command",
      "where.exe"
    )
    assertThat(script).contains(
      "'HOME' = \$neutralHomePath",
      "'USERPROFILE' = \$neutralHomePath",
      "'APPDATA' = \$appData",
      "\$name.StartsWith('PG'"
    )
    assertThat(script).contains(
      "BEGIN TRANSACTION READ ONLY;",
      "SET LOCAL statement_timeout = '5s';",
      "SET LOCAL lock_timeout = '2s';",
      "SET LOCAL search_path = pg_catalog;",
      "[ValidateRange(1, 8388608)][int]\$LimitChars",
      "[ValidateRange(1, 1800000)][int]\$TimeoutMilliseconds",
      "ORDER BY rule_number",
      "WHERE rule_number = __HBA_RULE__",
      "WHERE earlier.rule_number < __HBA_RULE__"
    )
    assertAppearsInOrder(
      preflight,
      "Invoke-M1BReadiness",
      "Assert-M1BInteractiveConsole",
      "Invoke-M1BPreflightPsql"
    )
    assertAppearsInOrder(
      lifecycle,
      "Invoke-M1BReadiness",
      "Read-M1BPreflightManifest",
      "Assert-M1BInteractiveConsole",
      "Invoke-M1BProvisionPsql",
      "Invoke-M1BTestPhase",
      "'targeted'",
      "Invoke-M1BTestPhase",
      "'full'",
      "finally",
      "Invoke-M1BCleanupPsql"
    )
    assertThat(lifecycle).contains(
      "[System.Array]::Clear(\$runner.PasswordBytes, 0, \$runner.PasswordBytes.Length)",
      "\$runner.PasswordBytes = \$null",
      "[System.Array]::Clear(\$salt, 0, \$salt.Length)",
      "\$salt = \$null",
      "\$verifier = \$null"
    )
  }

  @Test
  fun postgresDLocalAdminPasswordIsBoundedLiteralDataAndNeverAnInheritedChannel() {
    val output = runRailPowerShell(
      """
      §root=Join-Path ([IO.Path]::GetTempPath()) 'admin-password-data'
      [void][IO.Directory]::CreateDirectory(§root)
      §path=Join-Path §root 'fixture.env'
      function Expect-PasswordStop { param(§Expected,§Operation)
        §actual='NONE'; try { [void](& §Operation) } catch { §actual=Get-M1BStopCode §_ }
        if(§actual -cne §Expected){throw 'PASSWORD_REFUSAL_NOT_PRESERVED'}
      }
      Expect-PasswordStop 'D_ADMIN_PASSWORD_FILE_MISSING' { Read-M1DAdminPasswordFile §path }
      foreach(§text in @('', 'RITOMER_TEST_PG_PASSWORD=', 'RITOMER_TEST_PG_PASSWORD=   ',
        'OTHER=synthetic', ' RITOMER_TEST_PG_PASSWORD=synthetic',
        "RITOMER_TEST_PG_PASSWORD=a`nRITOMER_TEST_PG_PASSWORD=b", "RITOMER_TEST_PG_PASSWORD=a`n`n",
        ('RITOMER_TEST_PG_PASSWORD=a'+[char]0), ('x'*4097))) {
        [IO.File]::WriteAllText(§path,§text,(Get-M1BUtf8))
        Expect-PasswordStop 'D_ADMIN_PASSWORD_FILE_INVALID' { Read-M1DAdminPasswordFile §path }
      }
      [IO.File]::WriteAllBytes(§path,[byte[]]@(0xc3,0x28))
      Expect-PasswordStop 'D_ADMIN_PASSWORD_FILE_INVALID' { Read-M1DAdminPasswordFile §path }
      §literal='synthetic-§(throw "NOT_CODE");#=quotes' + [char]39 + ' spaces '
      foreach(§ending in @('',"`n","`r`n")) {
        [IO.File]::WriteAllText(§path,('RITOMER_TEST_PG_PASSWORD='+§literal+§ending),(Get-M1BUtf8))
        if((Read-M1DAdminPasswordFile §path) -cne §literal){throw 'PASSWORD_LITERAL_CHANGED'}
      }
      [IO.File]::WriteAllText(§path,('RITOMER_TEST_PG_PASSWORD='+§literal),[Text.UTF8Encoding]::new(§true,§true))
      if((Read-M1DAdminPasswordFile §path) -cne §literal){throw 'PASSWORD_UTF8_BOM_CHANGED'}
      §realFileReader=(Get-Command Read-M1DAdminPasswordFile).ScriptBlock
      function Read-M1DAdminPasswordFile { param(§Path)
        if(§Path -cne 'C:\dev\ritomer-local-secrets\postgres-test.env'){throw 'PASSWORD_PATH_NOT_FIXED'}
        'synthetic-fixed-path-marker'
      }
      # Execute the real no-argument wrapper; only the file boundary is substituted.
      if((& §realLocalAdminReader) -cne 'synthetic-fixed-path-marker'){throw 'PASSWORD_WRAPPER_FAILED'}
      Set-Item Function:Read-M1DAdminPasswordFile §realFileReader
      §env:RITOMER_TEST_PG_PASSWORD='synthetic-parent-forbidden'
      try { Expect-PasswordStop 'PARENT_CREDENTIAL_CHANNEL_PRESENT' { Assert-M1BNoCredentialChannels } }
      finally { Remove-Item Env:RITOMER_TEST_PG_PASSWORD }
      Assert-M1BNoCredentialChannels
      'D_ADMIN_PASSWORD_DATA_FIXTURES=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("D_ADMIN_PASSWORD_DATA_FIXTURES=PASS")
      .doesNotContain("synthetic-parent-forbidden", "synthetic-fixed-path-marker", "NOT_CODE")
  }

  @Test
  @Tag("windows-only")
  fun postgresDLocalAdminPasswordReachesOnlyPsqlWithoutPromptAndPreservesFailures() {
    val output = runRailPowerShell(
      """
      §Campaign='D'; §Mode='Preflight'
      Assert-M1BInteractiveConsole
      if(-not [Console]::IsInputRedirected -or -not [Console]::IsOutputRedirected){throw 'FIXTURE_NOT_NONINTERACTIVE'}
      §Campaign='B'; §code='NONE'
      try{Assert-M1BInteractiveConsole}catch{§code=Get-M1BStopCode §_}
      if(§code -cne 'INTERACTIVE_CONSOLE_REQUIRED'){throw 'B_CONSOLE_GATE_CHANGED'}
      §Campaign='D'
      function Assert-M1BPsqlBinary { [pscustomobject]@{Path='C:\fixture\inert.exe';Sha256=('a'*64);FileVersion='fixture';ProductVersion='fixture'} }
      function Write-M1DStopReceipt { param(§Role,§Process,§ReceiptContext) §script:events.Add('receipt') }
      function Start-M1DContainedChild {
        param(§StartInfo,§Role,§ReceiptContext)
        §script:events.Add('start'); §script:lastStartInfo=§StartInfo
        if(§Role -cne ('ADMIN_PSQL_'+§script:phase.ToUpperInvariant()) -or §StartInfo.FileName -cne §script:PsqlExeExact -or
          -not §StartInfo.CreateNoWindow -or §StartInfo.UseShellExecute -or -not §StartInfo.RedirectStandardInput -or
          §StartInfo.Arguments -cnotmatch '(^|\s)-w(\s|$)' -or §StartInfo.Arguments -cmatch '(^|\s)-W(\s|$)' -or
          §StartInfo.Arguments.Contains('offline-fixed-admin-marker') -or
          §StartInfo.EnvironmentVariables['PGPASSWORD'] -cne 'offline-fixed-admin-marker' -or
          [Environment]::GetEnvironmentVariables().Contains('PGPASSWORD')){throw 'PASSWORD_CHILD_BOUNDARY_INVALID'}
        if(§script:scenario -ceq 'start-failed'){Stop-M1BRail 'D_CHILD_START_FAILED'}
        §p=[pscustomobject]@{Id=2000000000;HasExited=§true;ExitCode=$(if(§script:scenario -eq 'success'){0}else{2});StartInfo=§StartInfo;
          StandardOutput=[IO.StringReader]::new('synthetic-output');StandardError=[IO.StringReader]::new('');StandardInput=[IO.StringWriter]::new()}
        §p | Add-Member ScriptMethod WaitForExit { }
        §p | Add-Member ScriptMethod TerminateTreeAndWait { param(§Budget) §script:events.Add('terminate'); return §true }
        §p | Add-Member ScriptMethod Dispose {
          §script:events.Add('dispose')
          if(§this.StartInfo.EnvironmentVariables.ContainsKey('PGPASSWORD')){throw 'PASSWORD_RETAINED_AFTER_START'}
          if(§script:scenario -ceq 'auth-plus-dispose'){throw [IO.IOException]::new('synthetic-finalization-fault')}
        }
        return §p
      }
      foreach(§phase in @('Preflight','Provision','Cleanup')) {
        §script:phase=§phase
        foreach(§scenario in @('success','auth-failed','auth-plus-dispose','start-failed')) {
          §script:scenario=§scenario; §script:events=[Collections.Generic.List[string]]::new()
          §script:PsqlProcessStarts=@{Preflight=0;Provision=0;Cleanup=0}; §script:DCampaignClock=§null
          Start-M1DClock Preflight
          §root=Join-Path ([IO.Path]::GetTempPath()) (§phase+'-'+§scenario)
          §result=§null; §code='NONE'
          try{§result=Invoke-M1BDirectPsql -Phase §phase -SqlText 'SYNTHETIC NOT SQL' -NeutralRoot §root}catch{§code=Get-M1BStopCode §_}
          §expected=if(§scenario -ceq 'success'){'NONE'}elseif(§scenario -ceq 'start-failed'){'D_CHILD_START_FAILED'}else{'PSQL_'+§phase.ToUpperInvariant()+'_EXIT_NONZERO'}
          §events=if(§scenario -ceq 'start-failed'){'start'}else{'start,terminate,receipt,dispose'}
          if(§code -cne §expected -or (§script:events -join ',') -cne §events -or §script:lastStartInfo.EnvironmentVariables.Count -ne 0){throw 'PASSWORD_FAILURE_OR_FINALIZATION_LOST'}
          if(§null -ne §result -and (ConvertTo-Json §result).Contains('offline-fixed-admin-marker')){throw 'PASSWORD_RESULT_EXPOSED'}
          if(§scenario -ceq 'auth-plus-dispose' -and (Get-M1DDiagnostics).secondary.Count -ne 1){throw 'PASSWORD_SECONDARY_FAILURE_LOST'}
        }
      }
      §neutral=New-M1BNeutralEnvironment (Join-Path ([IO.Path]::GetTempPath()) 'unrelated-child')
      if(§neutral.Values.Contains('PGPASSWORD') -or [Environment]::GetEnvironmentVariables().Contains('PGPASSWORD')){throw 'PASSWORD_PROPAGATED'}
      'D_ADMIN_PASSWORD_NONINTERACTIVE_FIXTURES=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("D_ADMIN_PASSWORD_NONINTERACTIVE_FIXTURES=PASS")
      .doesNotContain("offline-fixed-admin-marker", "synthetic-finalization-fault")
  }

  @Test
  fun postgresStructuredOutputParserIsStrictOverSyntheticFixtures() {
    val output = runRailPowerShell(
      """
      function New-FixtureRule {
        return [pscustomobject][ordered]@{
          ruleNumber = 1
          lineNumber = 20
          type = 'hostnossl'
          database = [object[]]@('ritomer_043b_test')
          userName = [object[]]@('ritomer_043b_test_runner')
          address = '127.0.0.1'
          netmask = '255.255.255.255'
          authMethod = 'scram-sha-256'
          options = [object[]]@()
          error = §null
        }
      }
      function New-FixturePayload {
        return [pscustomobject][ordered]@{
          serverVersionNum = 170006
          serverAddress = '127.0.0.1'
          serverPort = 15432
          database = 'postgres'
          currentUser = 'postgres'
          sessionUser = 'postgres'
          applicationName = 'ritomer_m1b_admin_rail'
          currentRoleOid = 10
          maintenanceDatabaseOid = 5
          canLogin = §true
          isSuperuser = §true
          canCreateDb = §true
          canCreateRole = §true
          transactionReadOnly = §true
          statementTimeout = '5s'
          lockTimeout = '2s'
          searchPath = 'pg_catalog'
          clusterSystemIdentifier = '7640000000000000000'
          targetDatabaseExists = §false
          targetRoleExists = §false
          hbaFilesLoaded = §true
          hbaRules = [object[]]@((New-FixtureRule))
        }
      }
      function New-ProvisionPayload {
        return [pscustomobject][ordered]@{
          clusterSystemIdentifier = '7640000000000000000'
          databaseOid = 16384
          roleOid = 16385
          databaseOwnerOid = 16385
          provenance = Get-M1BProvenance ('0' * 32) ('0' * 64) '7640000000000000000'
          databaseProvenance = Get-M1BProvenance ('0' * 32) ('0' * 64) '7640000000000000000'
          roleCanLogin = §true
          roleSuperuser = §false
          roleCreateDb = §false
          roleCreateRole = §false
          roleInherit = §false
          roleReplication = §false
          roleBypassRls = §false
          roleConnectionLimit = 16
          postmasterStartUnixMicros = '$SYNTHETIC_POSTMASTER_START_UNIX_MICROS'
          sharedPreloadEmpty = §true
          sessionPreloadRoleDefaultEmpty = §true
          sessionPreloadOverridesAbsent = §true
          preloadMutationPrivilegesAbsent = §true
          runnerMembershipsAbsent = §true
        }
      }
      function New-CleanupPayload {
        return [pscustomobject][ordered]@{
          clusterSystemIdentifier = '7640000000000000000'
          databaseCount = 0
          roleCount = 0
          sessionCount = 0
        }
      }
      function Encode-Fixture([object]§value) {
        §json = ConvertTo-Json -InputObject §value -Depth 8 -Compress
        return [Convert]::ToBase64String((Get-M1BUtf8).GetBytes(§json))
      }
      §lf = [string][char]10
      §crlf = [string][char]13 + [char]10
      function Render-Preflight([object]§value, [string]§client = '170006', [string]§newline = §lf) {
        return 'M1B_CLIENT|' + §client + §newline +
          'M1B_PREFLIGHT|' + (Encode-Fixture §value) + §newline
      }
      function Read-ProvisionFixture([object]§value) {
        §line = 'M1B_CLIENT|170006' + §lf + 'M1B_PROVISION|' + (Encode-Fixture §value) + §lf
        §parsed = ConvertFrom-M1BPsqlStructuredOutput §line '' 0 'PROVISION'
        return Assert-M1BProvisionPayload §parsed.Payload '7640000000000000000' §provenance
      }
      function Expect-ControlledStop([string]§expected, [scriptblock]§action) {
        §stopped = §false
        try {
          & §action
        } catch {
          §stopped = §true
          §actual = Get-M1BStopCode §_
          if (§actual -cne §expected) { throw ('expected ' + §expected + ', got ' + §actual) }
        }
        if (-not §stopped) { throw 'expected controlled stop' }
      }

      §payload = New-FixturePayload
      §parsed = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §payload) '' 0 'PREFLIGHT'
      [void](Assert-M1BPreflightPayload §parsed.Payload)
      [void](ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight (New-FixturePayload) '170006' §crlf) '' 0 'PREFLIGHT')
      §provenance = Get-M1BProvenance ('0' * 32) ('0' * 64) '7640000000000000000'
      §provisionLine = 'M1B_CLIENT|170006' + §lf + 'M1B_PROVISION|' + (Encode-Fixture (New-ProvisionPayload)) + §lf
      §provision = ConvertFrom-M1BPsqlStructuredOutput §provisionLine '' 0 'PROVISION'
      [void](Assert-M1BProvisionPayload §provision.Payload '7640000000000000000' §provenance)
      §cleanupLine = 'M1B_CLIENT|170006' + §lf + 'M1B_CLEANUP|' + (Encode-Fixture (New-CleanupPayload)) + §lf
      §cleanup = ConvertFrom-M1BPsqlStructuredOutput §cleanupLine '' 0 'CLEANUP'
      [void](Assert-M1BCleanupPayload §cleanup.Payload '7640000000000000000')

      Expect-ControlledStop 'PSQL_PREFLIGHT_STDERR_NOT_EMPTY' { ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight (New-FixturePayload)) 'prompt leak' 0 'PREFLIGHT' }
      Expect-ControlledStop 'PSQL_PREFLIGHT_EXIT_NONZERO' { ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight (New-FixturePayload)) '' 2 'PREFLIGHT' }
      Expect-ControlledStop 'PSQL_PREFLIGHT_PAYLOAD_LINE_INVALID' { ConvertFrom-M1BPsqlStructuredOutput ('M1B_CLIENT|170006' + §lf + 'M1B_PREFLIGHT|bad*' + §lf) '' 0 'PREFLIGHT' }
      Expect-ControlledStop 'PSQL_PREFLIGHT_LINE_COUNT_INVALID' { ConvertFrom-M1BPsqlStructuredOutput ((Render-Preflight (New-FixturePayload)) + 'EXTRA' + §lf) '' 0 'PREFLIGHT' }
      Expect-ControlledStop 'PSQL_PREFLIGHT_OUTPUT_TOO_LARGE' { ConvertFrom-M1BPsqlStructuredOutput ('x' * 65537) '' 0 'PREFLIGHT' }
      Expect-ControlledStop 'PSQL_CLIENT_MAJOR_INVALID' { ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight (New-FixturePayload) '160000') '' 0 'PREFLIGHT' }
      §invalidUtf8 = [Convert]::ToBase64String([byte[]]@(0xC3, 0x28))
      Expect-ControlledStop 'PSQL_PREFLIGHT_UTF8_INVALID' { ConvertFrom-M1BPsqlStructuredOutput ('M1B_CLIENT|170006' + §lf + 'M1B_PREFLIGHT|' + §invalidUtf8 + §lf) '' 0 'PREFLIGHT' }
      §invalidJson = [Convert]::ToBase64String((Get-M1BUtf8).GetBytes('{'))
      Expect-ControlledStop 'PSQL_JSON_TOKEN_STREAM_INVALID' { ConvertFrom-M1BPsqlStructuredOutput ('M1B_CLIENT|170006' + §lf + 'M1B_PREFLIGHT|' + §invalidJson + §lf) '' 0 'PREFLIGHT' }
      §duplicateJson = [Convert]::ToBase64String((Get-M1BUtf8).GetBytes('{"a":1,"a":2}'))
      Expect-ControlledStop 'PSQL_JSON_DUPLICATE_PROPERTY' { ConvertFrom-M1BPsqlStructuredOutput ('M1B_CLIENT|170006' + §lf + 'M1B_PREFLIGHT|' + §duplicateJson + §lf) '' 0 'PREFLIGHT' }
      §scalarJson = [Convert]::ToBase64String((Get-M1BUtf8).GetBytes('1'))
      Expect-ControlledStop 'PSQL_PREFLIGHT_JSON_ROOT_INVALID' { ConvertFrom-M1BPsqlStructuredOutput ('M1B_CLIENT|170006' + §lf + 'M1B_PREFLIGHT|' + §scalarJson + §lf) '' 0 'PREFLIGHT' }

      §wrongEndpoint = New-FixturePayload
      §wrongEndpoint.serverAddress = '127.0.0.2'
      Expect-ControlledStop 'PREFLIGHT_IDENTITY_OR_CAPABILITY_INVALID' {
        §candidate = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §wrongEndpoint) '' 0 'PREFLIGHT'
        Assert-M1BPreflightPayload §candidate.Payload
      }
      §targetPresent = New-FixturePayload
      §targetPresent.targetRoleExists = §true
      Expect-ControlledStop 'PREFLIGHT_IDENTITY_OR_CAPABILITY_INVALID' {
        §candidate = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §targetPresent) '' 0 'PREFLIGHT'
        Assert-M1BPreflightPayload §candidate.Payload
      }
      §wrongType = New-FixturePayload
      §wrongType.serverPort = '15432'
      Expect-ControlledStop 'PREFLIGHT_IDENTITY_OR_CAPABILITY_INVALID' {
        §candidate = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §wrongType) '' 0 'PREFLIGHT'
        Assert-M1BPreflightPayload §candidate.Payload
      }
      §extra = New-FixturePayload
      §extra | Add-Member -NotePropertyName extraField -NotePropertyValue 1
      Expect-ControlledStop 'STRUCTURED_OUTPUT_PROPERTY_COUNT_INVALID' {
        §candidate = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §extra) '' 0 'PREFLIGHT'
        Assert-M1BPreflightPayload §candidate.Payload
      }
      §missing = New-FixturePayload
      §missing.PSObject.Properties.Remove('database')
      Expect-ControlledStop 'STRUCTURED_OUTPUT_PROPERTY_COUNT_INVALID' {
        §candidate = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §missing) '' 0 'PREFLIGHT'
        Assert-M1BPreflightPayload §candidate.Payload
      }
      §scalarHba = New-FixturePayload
      §scalarHba.hbaRules = New-FixtureRule
      Expect-ControlledStop 'PREFLIGHT_IDENTITY_OR_CAPABILITY_INVALID' {
        §candidate = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §scalarHba) '' 0 'PREFLIGHT'
        Assert-M1BPreflightPayload §candidate.Payload
      }
      §numericCluster = New-FixturePayload
      §numericCluster.clusterSystemIdentifier = 7640000000000000000
      Expect-ControlledStop 'PREFLIGHT_IDENTITY_OR_CAPABILITY_INVALID' {
        §candidate = ConvertFrom-M1BPsqlStructuredOutput (Render-Preflight §numericCluster) '' 0 'PREFLIGHT'
        Assert-M1BPreflightPayload §candidate.Payload
      }
      §badProvision = New-ProvisionPayload
      §badProvision.provenance = 7
      Expect-ControlledStop 'PROVISION_RESULT_INVALID' {
        Assert-M1BProvisionPayload §badProvision '7640000000000000000' §provenance
      }
      §badCleanup = New-CleanupPayload
      §badCleanup.clusterSystemIdentifier = 7640000000000000000
      Expect-ControlledStop 'CLEANUP_RESULT_INVALID' {
        Assert-M1BCleanupPayload §badCleanup '7640000000000000000'
      }
      §newFields = @('postmasterStartUnixMicros', 'sharedPreloadEmpty', 'sessionPreloadRoleDefaultEmpty',
        'sessionPreloadOverridesAbsent', 'preloadMutationPrivilegesAbsent', 'runnerMembershipsAbsent')
      foreach (§field in §newFields) {
        §missingProvision = New-ProvisionPayload
        §missingProvision.PSObject.Properties.Remove(§field)
        Expect-ControlledStop 'STRUCTURED_OUTPUT_PROPERTY_COUNT_INVALID' { Read-ProvisionFixture §missingProvision }
        §renamedProvision = New-ProvisionPayload
        §renamedProvision.PSObject.Properties.Remove(§field)
        §renamedProvision | Add-Member -NotePropertyName ('unexpected_' + §field) -NotePropertyValue §true
        Expect-ControlledStop 'STRUCTURED_OUTPUT_PROPERTY_SET_INVALID' { Read-ProvisionFixture §renamedProvision }
        §nullProvision = New-ProvisionPayload
        §nullProvision.§field = §null
        Expect-ControlledStop 'PROVISION_RESULT_INVALID' { Read-ProvisionFixture §nullProvision }
        §json = ConvertTo-Json -InputObject (New-ProvisionPayload) -Compress
        §duplicate = §json.Substring(0, §json.Length - 1) + ',"' + §field + '":null}'
        §encoded = [Convert]::ToBase64String((Get-M1BUtf8).GetBytes(§duplicate))
        Expect-ControlledStop 'PSQL_JSON_DUPLICATE_PROPERTY' {
          ConvertFrom-M1BPsqlStructuredOutput ('M1B_CLIENT|170006' + §lf + 'M1B_PROVISION|' + §encoded + §lf) '' 0 'PROVISION'
        }
      }
      §extraProvision = New-ProvisionPayload
      §extraProvision | Add-Member -NotePropertyName unknownProof -NotePropertyValue §true
      Expect-ControlledStop 'STRUCTURED_OUTPUT_PROPERTY_COUNT_INVALID' { Read-ProvisionFixture §extraProvision }
      foreach (§field in §newFields[1..5]) {
        foreach (§invalid in @(§false, 'true', 'false', 1, 0, @('true'))) {
          §candidate = New-ProvisionPayload
          §candidate.§field = §invalid
          Expect-ControlledStop 'PROVISION_RESULT_INVALID' { Read-ProvisionFixture §candidate }
        }
      }
      foreach (§invalid in @('', '0', '00', '01', '-1', '+1', '1.0', '1e6', ' 1', '1 ',
        ('1' + [char]10), ('1' + [char]13 + [char]10), '9223372036854775808',
        '9999999999999999999', '10000000000000000000', '1970-01-01T00:00:00Z', 1, 1.5, §true, @('1'))) {
        §candidate = New-ProvisionPayload
        §candidate.postmasterStartUnixMicros = §invalid
        Expect-ControlledStop 'PROVISION_RESULT_INVALID' { Read-ProvisionFixture §candidate }
      }
      foreach (§valid in @('1', '$SYNTHETIC_POSTMASTER_START_UNIX_MICROS', '1789300000123457', '9223372036854775807')) {
        §candidate = New-ProvisionPayload
        §candidate.postmasterStartUnixMicros = §valid
        §exact = Read-ProvisionFixture §candidate
        if (§exact.PostmasterStartUnixMicros -isnot [string] -or §exact.PostmasterStartUnixMicros -cne §valid) {
          throw 'POSTMASTER_PAYLOAD_PRECISION_LOST'
        }
      }
      'PARSER_FIXTURES=PASS'
      """.trimIndent()
    )

    assertThat(output).contains("PARSER_FIXTURES=PASS")
  }

  @Test
  @Tag("windows-only")
  fun postgresProvisionMicrosecondsCrossTheRealParserAndChildEnvironmentWithoutLoss() {
    val output = runRailPowerShell(
      """
      # Only the two native process boundaries are substituted. Every rail function remains real.
      Add-Type -TypeDefinition @'
      using System;
      using System.Collections.Generic;
      using System.Diagnostics;
      using System.IO;
      using System.Text;
      namespace Ritomer.M1B {
        public sealed class ContainedProcess : IDisposable {
          public static Dictionary<string, string> LastEnvironment;
          public static int Starts;
          public static int Disposals;
          public StreamReader StandardOutput { get; private set; }
          public StreamReader StandardError { get; private set; }
          public bool HasExited { get { return true; } }
          public int ExitCode { get { return 0; } }
          public static ContainedProcess Start(ProcessStartInfo info) {
            Starts++;
            if (info.Arguments.Contains("--offline")) throw new InvalidOperationException("Campaign B unexpectedly offline");
            LastEnvironment = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (string key in info.EnvironmentVariables.Keys) LastEnvironment.Add(key, info.EnvironmentVariables[key]);
            string output;
            if (info.Arguments.EndsWith("m1BPostgresRailReadiness", StringComparison.Ordinal)) {
              output = "M1B_POSTGRES_RAIL_READINESS=PASS\nM1B_POSTGRES_RAIL_DATABASE_EXECUTION=NONE\n" +
                "M1B_POSTGRES_RAIL_RUNTIME_SHA256=" + new string('2', 64) + "\n";
            } else {
              string runtime = LastEnvironment["RITOMER_DB_RAIL_RUNTIME_SHA256"];
              output = "M1B_POSTGRES_RAIL_RUNTIME_SHA256_VERIFIED=" + runtime + "\n" +
                "M1B_POSTGRES_RAIL_RUNTIME_SHA256_REVALIDATED=" + runtime + "\n" +
                "M1B_POSTGRES_RAIL_" + LastEnvironment["RITOMER_DB_TEST_PHASE"].ToUpperInvariant() + "=PASS\n";
            }
            return new ContainedProcess {
              StandardOutput = new StreamReader(new MemoryStream(Encoding.UTF8.GetBytes(output))),
              StandardError = new StreamReader(new MemoryStream(new byte[0]))
            };
          }
          public void WaitForExit() { }
          public bool TerminateTreeAndWait(int timeout) { return true; }
          public void Dispose() { StandardOutput.Dispose(); StandardError.Dispose(); Disposals++; }
          public static bool FileContainsSequence(string path, byte[] value, long maximumBytes) {
            throw new InvalidOperationException("unexpected file inside empty transmission fixture");
          }
        }
      }
      '@
      §script:M1BContainedProcessTypeInitialized = §true
      §fixtureContainer = Join-Path §script:EvidenceBaseRoot ('offline-transmission-' + [Guid]::NewGuid().ToString('N'))
      §javaRoot = Join-Path §fixtureContainer 'runtime'
      §javaBin = Join-Path §javaRoot 'bin'
      [void][IO.Directory]::CreateDirectory(§javaBin)
      [IO.File]::WriteAllBytes((Join-Path §javaBin 'java.exe'), [byte[]]@())
      [Environment]::SetEnvironmentVariable('JAVA_HOME', §javaRoot, 'Process')
      §microsName = 'RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS'
      §cluster = '$SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER'
      §provenance = Get-M1BProvenance §RunId §ReviewedObjectSha256 §cluster
      §verifier = 'SCRAM-SHA-256§4096:W22ZaJ0SNY7soEsUEjb6gQ==§WG5d8oPm3OtcPnkdi4Uo7BkeZkBFzpcXkuLmtbsT4qY=:wfPLwcE6nTWhTAmQ7tl2KeoiWGPlZqQxSrmfPwDl2dU='
      function Invoke-M1BDirectPsql {
        param([string]§Phase, [string]§SqlText, [string]§NeutralRoot)
        if (§Phase -cne 'Provision' -or -not §SqlText.Contains('postmasterStartUnixMicros')) { throw 'PROVISION_BOUNDARY_INVALID' }
        §payload = [pscustomobject][ordered]@{
          clusterSystemIdentifier = §cluster
          databaseOid = $SYNTHETIC_DATABASE_OID
          roleOid = $SYNTHETIC_ROLE_OID
          databaseOwnerOid = $SYNTHETIC_ROLE_OID
          provenance = §provenance
          databaseProvenance = §provenance
          roleCanLogin = §true
          roleSuperuser = §false
          roleCreateDb = §false
          roleCreateRole = §false
          roleInherit = §false
          roleReplication = §false
          roleBypassRls = §false
          roleConnectionLimit = 16
          postmasterStartUnixMicros = §instant
          sharedPreloadEmpty = §true
          sessionPreloadRoleDefaultEmpty = §true
          sessionPreloadOverridesAbsent = §true
          preloadMutationPrivilegesAbsent = §true
          runnerMembershipsAbsent = §true
        }
        §encoded = [Convert]::ToBase64String((Get-M1BUtf8).GetBytes((ConvertTo-Json §payload -Compress)))
        §stdout = 'M1B_CLIENT|170006' + [char]10 + 'M1B_PROVISION|' + §encoded + [char]10
        return [pscustomobject]@{
          Stdout = §stdout; Stderr = ''; ExitCode = 0; ProcessId = 42; ProcessCount = 1
          PsqlSha256 = ('1' * 64); StdoutSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes(§stdout))
        }
      }
      try {
        §readinessRoot = New-M1BDirectory (Join-Path §fixtureContainer 'readiness')
        §ready = Invoke-M1BReadiness §readinessRoot 'initial' §RunId §ReviewedObjectSha256
        if ([Ritomer.M1B.ContainedProcess]::LastEnvironment.ContainsKey(§microsName)) { throw 'READINESS_RECEIVED_POSTMASTER' }
        §beforeInvalid = [Ritomer.M1B.ContainedProcess]::Starts
        §invalidReadiness = @{
          RITOMER_DB_RAIL_RUN_ID = §RunId
          RITOMER_DB_RAIL_RUN_ROOT = §readinessRoot
          RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256 = §ReviewedObjectSha256
          RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS = '$SYNTHETIC_POSTMASTER_START_UNIX_MICROS'
        }
        §stop = §null
        try {
          Invoke-M1BGradleTask -Task 'm1BPostgresRailReadiness' -NeutralRoot (Join-Path §readinessRoot 'invalid-child') -BuildRoot §ready.BuildRoot -GradleUserHome §ready.GradleUserHome -ExtraEnvironment §invalidReadiness
        } catch { §stop = Get-M1BStopCode §_ }
        if (§stop -cne 'GRADLE_CHILD_ENVIRONMENT_ALLOWLIST_MISMATCH' -or [Ritomer.M1B.ContainedProcess]::Starts -ne §beforeInvalid) {
          throw 'READINESS_POSTMASTER_NOT_REJECTED_BEFORE_CHILD'
        }
        foreach (§invalid in @('0', '01', '9223372036854775808', 1, @('1'))) {
          §stop = §null
          try {
            Invoke-M1BTestPhase -Phase 'targeted' -Root (Join-Path §fixtureContainer 'invalid-phase') -BuildRoot §ready.BuildRoot -GradleUserHome §ready.GradleUserHome -RunnerPassword '$SYNTHETIC_PASSWORD' -RuntimeSha256 §ready.Result.RuntimeSha256 -ClusterSystemIdentifier §cluster -DatabaseOid $SYNTHETIC_DATABASE_OID -RoleOid $SYNTHETIC_ROLE_OID -PostmasterStartUnixMicros §invalid
          } catch { §stop = Get-M1BStopCode §_ }
          if (§stop -cne 'POSTMASTER_START_UNIX_MICROS_INVALID' -or [Ritomer.M1B.ContainedProcess]::Starts -ne §beforeInvalid -or [IO.Directory]::Exists((Join-Path §fixtureContainer 'invalid-phase'))) {
            throw 'INVALID_POSTMASTER_REACHED_TEST_PHASE'
          }
        }
        foreach (§instant in @('$SYNTHETIC_POSTMASTER_START_UNIX_MICROS', '1789300000123457')) {
          §root = New-M1BDirectory (Join-Path §fixtureContainer ('run-' + §instant))
          §provision = Invoke-M1BProvisionPsql -NeutralRoot (Join-Path §root 'psql') -Verifier §verifier -Provenance §provenance -ExpectedClusterSystemIdentifier §cluster -ExpectedHbaRuleNumber 7 -ExpectedAdminRoleOid 10 -ExpectedMaintenanceDatabaseOid 20
          if (§provision.PostmasterStartUnixMicros -isnot [string] -or §provision.PostmasterStartUnixMicros -cne §instant) { throw 'PROVISION_POSTMASTER_LOST' }
          foreach (§phase in @('targeted', 'full')) {
            §result = Invoke-M1BTestPhase -Phase §phase -Root §root -BuildRoot §ready.BuildRoot -GradleUserHome §ready.GradleUserHome -RunnerPassword '$SYNTHETIC_PASSWORD' -RuntimeSha256 §ready.Result.RuntimeSha256 -ClusterSystemIdentifier §cluster -DatabaseOid §provision.DatabaseOid -RoleOid §provision.RoleOid -PostmasterStartUnixMicros §provision.PostmasterStartUnixMicros
            §child = [Ritomer.M1B.ContainedProcess]::LastEnvironment
            if (§child[§microsName] -cne §instant -or §child['RITOMER_DB_RAIL_DATABASE_OID'] -cne [string]§provision.DatabaseOid -or §child['RITOMER_DB_RAIL_RUNNER_ROLE_OID'] -cne [string]§provision.RoleOid) {
              throw 'PROVISION_TO_NATIVE_CHILD_BINDING_LOST'
            }
            if (§result.Task -cne ('m1BPostgresRail' + (Get-Culture).TextInfo.ToTitleCase(§phase))) { throw 'TEST_PHASE_RESULT_INVALID' }
            'CHILD_POSTMASTER=' + §phase + ':' + §child[§microsName]
          }
        }
        if ([Ritomer.M1B.ContainedProcess]::Starts -ne 5 -or [Ritomer.M1B.ContainedProcess]::Disposals -ne 5) { throw 'CHILD_BOUNDARY_COUNT_INVALID' }
      } finally {
        [Environment]::SetEnvironmentVariable('JAVA_HOME', §null, 'Process')
        [void](Assert-M1BContainedPath §script:EvidenceBaseRoot §fixtureContainer)
        if ([IO.Directory]::Exists(§fixtureContainer)) { [IO.Directory]::Delete(§fixtureContainer, §true) }
      }
      'PROVISION_NATIVE_CHILD_MICROSECONDS=PASS'
      """.trimIndent()
    )
    assertThat(output.lineSequence().filter { it.startsWith("CHILD_POSTMASTER=") }.toList()).containsExactly(
      "CHILD_POSTMASTER=targeted:$SYNTHETIC_POSTMASTER_START_UNIX_MICROS",
      "CHILD_POSTMASTER=full:$SYNTHETIC_POSTMASTER_START_UNIX_MICROS",
      "CHILD_POSTMASTER=targeted:1789300000123457",
      "CHILD_POSTMASTER=full:1789300000123457"
    )
    assertThat(output).contains("PROVISION_NATIVE_CHILD_MICROSECONDS=PASS")
  }

  @Test
  fun postgresHbaMatrixAcceptsOnlyDedicatedFirstScramRule() {
    val output = runRailPowerShell(
      """
      function New-Rule(
        [int]§Rule,
        [string]§Type,
        [object[]]§Database,
        [object[]]§UserName,
        [AllowNull()][string]§Address,
        [AllowNull()][string]§Netmask,
        [AllowNull()][string]§AuthMethod,
        [AllowNull()][object]§ErrorValue
      ) {
        return [pscustomobject][ordered]@{
          ruleNumber = §Rule
          lineNumber = §Rule
          type = §Type
          database = [object[]]§Database
          userName = [object[]]§UserName
          address = §Address
          netmask = §Netmask
          authMethod = §AuthMethod
          options = [object[]]@()
          error = §ErrorValue
        }
      }
      function Exact-Rule([int]§Rule = 20) {
        return New-Rule §Rule 'hostnossl' @('ritomer_043b_test') @('ritomer_043b_test_runner') '127.0.0.1' '255.255.255.255' 'scram-sha-256' §null
      }
      function Assert-Pass([object[]]§Rules) {
        §result = Test-M1BHbaRuleMatrix §Rules
        if (-not §result.Pass) { throw ('expected pass: ' + §result.Reason) }
      }
      function Assert-Fail([object[]]§Rules) {
        §result = Test-M1BHbaRuleMatrix §Rules
        if (§result.Pass) { throw 'expected fail' }
      }

      Assert-Pass @((Exact-Rule))
      §local = New-Rule 5 'local' @('all') @('all') §null §null §null §null
      Assert-Pass @(§local, (Exact-Rule))
      §otherDb = New-Rule 6 'hostnossl' @('other') @('all') '127.0.0.1' '255.255.255.255' 'trust' §null
      Assert-Pass @(§otherDb, (Exact-Rule))
      §otherNetwork = New-Rule 7 'hostnossl' @('all') @('all') '10.0.0.0' '255.0.0.0' 'trust' §null
      Assert-Pass @(§otherNetwork, (Exact-Rule))
      §includedRule = New-Rule 8 'hostnossl' @('other') @('all') '127.0.0.1' '255.255.255.255' 'trust' §null
      §includedRule.lineNumber = 20
      §dedicatedIncludedRule = Exact-Rule 21
      §dedicatedIncludedRule.lineNumber = 20
      Assert-Pass @(§includedRule, §dedicatedIncludedRule)

      Assert-Fail @((New-Rule 1 'hostnossl' @('all') @('all') '127.0.0.1' '255.255.255.255' 'scram-sha-256' §null), (Exact-Rule))
      Assert-Fail @((New-Rule 20 'hostnossl' @('ritomer_043b_test') @('ritomer_043b_test_runner') '127.0.0.1' '255.255.255.255' 'trust' §null))
      Assert-Fail @((New-Rule 20 'host' @('ritomer_043b_test') @('ritomer_043b_test_runner') '127.0.0.1' '255.255.255.255' 'scram-sha-256' §null))
      Assert-Fail @((New-Rule 1 'hostnossl' @('all') @('+group') '127.0.0.1' '255.255.255.255' 'scram-sha-256' §null), (Exact-Rule))
      Assert-Fail @((New-Rule 1 'hostnossl' @('all') @('all') '::1' 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff' 'scram-sha-256' §null), (Exact-Rule))
      Assert-Fail @((New-Rule 1 'hostnossl' @('all') @('all') '127.0.0.1' '255.255.255.255' 'scram-sha-256' 'parse error'), (Exact-Rule))
      §optioned = Exact-Rule
      §optioned.options = [object[]]@('clientcert=verify-full')
      Assert-Fail @(§optioned)
      Assert-Fail @((Exact-Rule 20), (Exact-Rule 10))
      'HBA_FIXTURES=PASS'
      """.trimIndent()
    )

    assertThat(output).contains("HBA_FIXTURES=PASS")
  }

  @Test
  fun postgresScramVerifierMatchesDeterministicVector() {
    val output = runRailPowerShell(
      """
      §password = (Get-M1BUtf8).GetBytes('pencil')
      §salt = [Convert]::FromBase64String('W22ZaJ0SNY7soEsUEjb6gQ==')
      try {
        §actual = New-M1BScramSha256Verifier §password §salt
        §expected = 'SCRAM-SHA-256§4096:W22ZaJ0SNY7soEsUEjb6gQ==§' +
          'WG5d8oPm3OtcPnkdi4Uo7BkeZkBFzpcXkuLmtbsT4qY=:wfPLwcE6nTWhTAmQ7tl2KeoiWGPlZqQxSrmfPwDl2dU='
        if (§actual -cne §expected) { throw 'SCRAM vector mismatch' }
        if (§actual.Contains('pencil')) { throw 'plaintext contamination' }
        §rejected = §false
        try {
          New-M1BScramSha256Verifier §password ([byte[]]::new(15))
        } catch {
          §rejected = §true
        }
        if (-not §rejected) { throw 'invalid salt accepted' }
      } finally {
        [Array]::Clear(§password, 0, §password.Length)
        [Array]::Clear(§salt, 0, §salt.Length)
      }
      'SCRAM_VECTOR=PASS'
      """.trimIndent()
    )

    assertThat(output).contains("SCRAM_VECTOR=PASS")
  }

  @Test
  fun postgresAdminSqlBuildersReplaceEveryPlaceholderOffline() {
    val output = runRailPowerShell(
      """
      §run = '11111111111111111111111111111111'
      §review = '2222222222222222222222222222222222222222222222222222222222222222'
      §provenance = Get-M1BProvenance §run §review '123456789'
      §verifier = 'SCRAM-SHA-256§4096:W22ZaJ0SNY7soEsUEjb6gQ==§WG5d8oPm3OtcPnkdi4Uo7BkeZkBFzpcXkuLmtbsT4qY=:wfPLwcE6nTWhTAmQ7tl2KeoiWGPlZqQxSrmfPwDl2dU='
      §provision = Get-M1BProvisionSql §verifier §provenance '123456789' 7 10 20
      §cleanup = Get-M1BCleanupSql §provenance §run '123456789' 30 40 10 20
      foreach (§sql in @(§provision, §cleanup)) {
        if (§sql -cmatch '__[A-Z_]+__') { throw 'SQL_PLACEHOLDER_REMAINED' }
        if (-not §sql.Contains(§provenance) -or -not §sql.Contains('123456789')) { throw 'SQL_BINDING_MISSING' }
      }
      if (-not §provision.Contains(§verifier) -or -not §provision.Contains('rule_number = 7')) { throw 'PROVISION_BINDING_MISSING' }
      if (-not §cleanup.Contains('30') -or -not §cleanup.Contains('40')) { throw 'CLEANUP_BINDING_MISSING' }
      if (§provision -isnot [string]) { throw 'PROVISION_OUTPUT_NOT_SINGLE_STRING' }
      §lastGuard = §provision.IndexOf("RAISE EXCEPTION 'target already exists';")
      if (§lastGuard -lt 0) { throw 'PROVISION_LAST_GUARD_MISSING' }
      §guardEnd = §provision.IndexOf('END IF;', §lastGuard) + 'END IF;'.Length
      §doEnd = [regex]::Match(§provision, '(?m)^END\r?\n\§m1b\§;')
      if (-not §doEnd.Success -or §guardEnd -le §lastGuard) { throw 'PROVISION_GUARD_BLOCK_INVALID' }
      foreach (§setting in @('session_preload_libraries', 'local_preload_libraries')) {
        §assignment = "PERFORM pg_catalog.set_config('§setting', '', false);"
        §capture = "ALTER ROLE ritomer_043b_test_runner SET §setting FROM CURRENT;"
        if ([regex]::Matches(§provision, [regex]::Escape(§assignment)).Count -ne 1) { throw 'PROVISION_PRELOAD_DIRECT_VALUE_MISSING' }
        if ([regex]::Matches(§provision, [regex]::Escape(§capture)).Count -ne 1) { throw 'PROVISION_PRELOAD_CAPTURE_MISSING' }
        §assignmentIndex = §provision.IndexOf(§assignment)
        if (§assignmentIndex -le §guardEnd -or §assignmentIndex -ge §doEnd.Index -or §provision.IndexOf(§capture) -le §doEnd.Index) {
          throw 'PROVISION_PRELOAD_ORDER_INVALID'
        }
        if (§provision.Contains("ALTER ROLE ritomer_043b_test_runner SET §setting TO '';")) { throw 'PROVISION_PRELOAD_QUOTED_EMPTY_REINTRODUCED' }
        if ([regex]::Matches(§provision, ('(?im)^ALTER ROLE ritomer_043b_test_runner SET ' + [regex]::Escape(§setting) + '\s')).Count -ne 1) {
          throw 'PROVISION_PRELOAD_REASSIGNMENT'
        }
      }
      §login = 'ALTER ROLE ritomer_043b_test_runner LOGIN;'
      §adminStart = §provision.IndexOf('DO §m1b_preload§')
      §adminEnd = §provision.IndexOf('§m1b_preload§;', §adminStart)
      §loginIndex = §provision.IndexOf(§login)
      if ([regex]::Matches(§provision, [regex]::Escape(§login)).Count -ne 1 -or §adminStart -lt 0 -or §adminEnd -le §adminStart -or §loginIndex -le §adminEnd) {
        throw 'PRELOAD_ADMIN_GUARD_NOT_BEFORE_UNIQUE_LOGIN'
      }
      §protectionIndex = §provision.IndexOf('REVOKE ALL ON DATABASE ritomer_043b_test FROM PUBLIC;')
      if (§protectionIndex -lt 0 -or §protectionIndex -ge §adminStart) { throw 'PRELOAD_GUARD_BEFORE_DATABASE_PROTECTION' }
      §guard = §provision.Substring(§adminStart, §adminEnd - §adminStart)
      §payloadSql = §provision.Substring(§loginIndex + §login.Length)
      foreach (§predicate in @(
        "pg_catalog.current_setting('shared_preload_libraries') = '' AS shared_preload_empty",
        "SELECT pg_catalog.count(*) = 1 AND",
        "pg_catalog.count(*) FILTER (WHERE setting_entry = 'session_preload_libraries=') = 1",
        'FROM pg_catalog.pg_db_role_setting role_settings',
        'role_settings.setdatabase = 0 AND role_settings.setrole = role_entry.oid',
        "pg_catalog.lower(pg_catalog.split_part(setting_entry, '=', 1)) = 'session_preload_libraries'",
        'database_settings.setdatabase = database_entry.oid',
        'database_settings.setrole IN (0, role_entry.oid)',
        "NOT pg_catalog.has_parameter_privilege(role_entry.oid, 'session_preload_libraries', 'SET')",
        "NOT pg_catalog.has_parameter_privilege(role_entry.oid, 'session_preload_libraries', 'ALTER SYSTEM')",
        "NOT pg_catalog.has_parameter_privilege(role_entry.oid, 'shared_preload_libraries', 'ALTER SYSTEM')",
        'WHERE membership.member = role_entry.oid OR membership.roleid = role_entry.oid'
      )) {
        if (-not §guard.Contains(§predicate) -or -not §payloadSql.Contains(§predicate)) { throw 'ADMIN_PREDICATE_NOT_RECOMPUTED' }
      }
      foreach (§field in @('shared_preload_empty', 'session_preload_role_default_empty', 'session_preload_overrides_absent',
        'preload_mutation_privileges_absent', 'runner_memberships_absent')) {
        if (-not §guard.Contains(('preload_proof.' + §field + ' IS NOT TRUE'))) { throw 'PRELOAD_GUARD_NOT_NULL_REJECTING' }
        if (-not §payloadSql.Contains(('preload_observation.' + §field))) { throw 'PRELOAD_PAYLOAD_NOT_OBSERVED' }
      }
      if (-not §guard.Contains('INTO STRICT preload_proof') -or -not §payloadSql.Contains('(EXTRACT(EPOCH FROM pg_catalog.pg_postmaster_start_time()) * 1000000)::pg_catalog.int8::pg_catalog.text')) {
        throw 'ADMIN_BINDING_OR_MICROSECONDS_NOT_EXACT'
      }
      if (§payloadSql -match "'(?:(?:sharedPreloadEmpty)|(?:sessionPreloadRoleDefaultEmpty)|(?:sessionPreloadOverridesAbsent)|(?:preloadMutationPrivilegesAbsent)|(?:runnerMembershipsAbsent))'\s*,\s*(?:true|false|null)") {
        throw 'PRELOAD_SUCCESS_CONSTANT_REJECTED'
      }
      foreach (§marker in @("'M1B_CLIENT|'", "'M1B_PROVISION|'")) {
        if ([regex]::Matches(§provision, [regex]::Escape(§marker)).Count -ne 1) { throw 'PROVISION_STRUCTURED_OUTPUT_CHANGED' }
      }
      'M1B_SQL_BUILDERS=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1B_SQL_BUILDERS=PASS")
  }

  @Test
  @Tag("windows-only")
  fun postgresProvenanceCrossesPowerShellBuildersPayloadAndKotlinGuardUnchanged() {
    val provenance = runRailPowerShell(
      """
      §run = '$SYNTHETIC_RUN_ID'
      §review = '$SYNTHETIC_REVIEWED_OBJECT_SHA256'
      §cluster = '$SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER'
      §values = @(Get-M1BProvenance §run §review §cluster)
      if (§values.Count -ne 1 -or §values[0] -isnot [string]) { throw 'PRODUCER_OUTPUT_NOT_ONE_STRING' }
      §provenance = §values[0]
      §verifier = 'SCRAM-SHA-256§4096:W22ZaJ0SNY7soEsUEjb6gQ==§WG5d8oPm3OtcPnkdi4Uo7BkeZkBFzpcXkuLmtbsT4qY=:wfPLwcE6nTWhTAmQ7tl2KeoiWGPlZqQxSrmfPwDl2dU='
      §provision = Get-M1BProvisionSql §verifier §provenance §cluster 7 10 20
      §cleanup = Get-M1BCleanupSql §provenance §run §cluster $SYNTHETIC_DATABASE_OID $SYNTHETIC_ROLE_OID 10 20
      foreach (§comment in @(
        "COMMENT ON ROLE ritomer_043b_test_runner IS '§provenance';",
        "COMMENT ON DATABASE ritomer_043b_test IS '§provenance';"
      )) {
        if ([regex]::Matches(§provision, [regex]::Escape(§comment)).Count -ne 1) { throw 'PROVISION_COMMENT_BINDING_INVALID' }
      }
      foreach (§predicate in @(
        "shobj_description(database_oid, 'pg_database') IS DISTINCT FROM '§provenance'",
        "shobj_description(role_oid, 'pg_authid') IS DISTINCT FROM '§provenance'"
      )) {
        if ([regex]::Matches(§cleanup, [regex]::Escape(§predicate)).Count -ne 1) { throw 'CLEANUP_PROVENANCE_BINDING_INVALID' }
      }
      §payload = [pscustomobject][ordered]@{
        clusterSystemIdentifier = §cluster
        databaseOid = $SYNTHETIC_DATABASE_OID
        roleOid = $SYNTHETIC_ROLE_OID
        databaseOwnerOid = $SYNTHETIC_ROLE_OID
        provenance = §provenance
        databaseProvenance = §provenance
        roleCanLogin = §true
        roleSuperuser = §false
        roleCreateDb = §false
        roleCreateRole = §false
        roleInherit = §false
        roleReplication = §false
        roleBypassRls = §false
        roleConnectionLimit = 16
        postmasterStartUnixMicros = '$SYNTHETIC_POSTMASTER_START_UNIX_MICROS'
        sharedPreloadEmpty = §true
        sessionPreloadRoleDefaultEmpty = §true
        sessionPreloadOverridesAbsent = §true
        preloadMutationPrivilegesAbsent = §true
        runnerMembershipsAbsent = §true
      }
      §proof = Assert-M1BProvisionPayload §payload §cluster §provenance
      if (§proof.DatabaseOid -ne $SYNTHETIC_DATABASE_OID -or §proof.RoleOid -ne $SYNTHETIC_ROLE_OID) { throw 'PROVISION_OID_BINDING_INVALID' }
      function Expect-ProvenanceStop([string]§expected, [scriptblock]§action) {
        §stopped = §false
        try { [void](& §action) } catch {
          §stopped = §true
          §actual = Get-M1BStopCode §_
          if (§actual -cne §expected) { throw ('expected ' + §expected + ', got ' + §actual) }
        }
        if (-not §stopped) { throw 'invalid provenance accepted' }
      }
      §invalidProvenances = @(
        ('ritomer-m1b:' + §run + ':' + §review),
        ('ritomer-m1-1b:' + §run + ':' + §review),
        ('ritomer-m1-1b:' + §run + ':' + §review + ':'),
        §provenance.Replace('ritomer', 'Ritomer'),
        §provenance.Replace((':' + §run + ':'), (':' + §run.ToUpperInvariant() + ':')),
        §provenance.Replace(§review, §review.ToUpperInvariant()),
        §provenance.Replace((':' + §run + ':'), ':1:'),
        §provenance.Replace(§review, ('0' * 63)),
        §provenance.Replace(§cluster, '0'),
        §provenance.Replace(§cluster, '01'),
        §provenance.Replace(§cluster, '-1'),
        §provenance.Replace(§cluster, 'abc'),
        §provenance.Replace(§cluster, ('1' * 21)),
        (§provenance + ':extra'),
        (§provenance + "'"),
        (§provenance + ' '),
        (§provenance + [char]10),
        (§provenance + [char]13 + [char]10)
      )
      foreach (§invalid in §invalidProvenances) {
        Expect-ProvenanceStop 'PROVENANCE_INVALID' { Get-M1BProvisionSql §verifier §invalid §cluster 7 10 20 }
        Expect-ProvenanceStop 'PROVENANCE_INVALID' { Get-M1BCleanupSql §invalid §run §cluster 16401 16400 10 20 }
        §payload.provenance = §invalid
        §payload.databaseProvenance = §invalid
        Expect-ProvenanceStop 'PROVENANCE_INVALID' { Assert-M1BProvisionPayload §payload §cluster §invalid }
      }
      §payload.provenance = §provenance
      §payload.databaseProvenance = §provenance
      §otherCluster = §provenance.Replace(§cluster, '123456789')
      Expect-ProvenanceStop 'PROVENANCE_CLUSTER_MISMATCH' { Get-M1BProvisionSql §verifier §otherCluster §cluster 7 10 20 }
      Expect-ProvenanceStop 'PROVENANCE_CLUSTER_MISMATCH' { Get-M1BCleanupSql §otherCluster §run §cluster 16401 16400 10 20 }
      Expect-ProvenanceStop 'PROVENANCE_CLUSTER_MISMATCH' { Assert-M1BProvisionPayload §payload §cluster §otherCluster }
      foreach (§invalidCluster in @('0', '01', '-1', 'abc', ('1' * 21), (§cluster + [char]10))) {
        Expect-ProvenanceStop 'CLUSTER_IDENTIFIER_INVALID' { Get-M1BProvisionSql §verifier §provenance §invalidCluster 7 10 20 }
        Expect-ProvenanceStop 'CLUSTER_IDENTIFIER_INVALID' { Get-M1BCleanupSql §provenance §run §invalidCluster 16401 16400 10 20 }
        Expect-ProvenanceStop 'CLUSTER_IDENTIFIER_INVALID' { Assert-M1BProvisionPayload §payload §invalidCluster §provenance }
      }
      Expect-ProvenanceStop 'PROVENANCE_RUN_ID_MISMATCH' { Get-M1BCleanupSql §provenance ('f' * 32) §cluster 16401 16400 10 20 }
      Expect-ProvenanceStop 'RUN_ID_INVALID' { Get-M1BCleanupSql §provenance §run.ToUpperInvariant() §cluster 16401 16400 10 20 }
      foreach (§other in @(
        §provenance.Replace((':' + §run + ':'), (':' + ('f' * 32) + ':')),
        §provenance.Replace(§review, ('f' * 64))
      )) {
        §payload.provenance = §other
        Expect-ProvenanceStop 'PROVISION_RESULT_INVALID' { Assert-M1BProvisionPayload §payload §cluster §provenance }
        §payload.provenance = §provenance
        §payload.databaseProvenance = §other
        Expect-ProvenanceStop 'PROVISION_RESULT_INVALID' { Assert-M1BProvisionPayload §payload §cluster §provenance }
        §payload.databaseProvenance = §provenance
      }
      [Console]::Out.Write(§provenance)
      """.trimIndent()
    )
    assertThat(provenance).isEqualTo(
      postgresTestRailProvenance(
        SYNTHETIC_RUN_ID,
        SYNTHETIC_REVIEWED_OBJECT_SHA256,
        SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER
      )
    )
    listOf(EXPECTED_ROLE, "pg_database_owner").forEach { publicOwner ->
      val options = JdbcOptions(
        roleProvenance = provenance,
        databaseProvenance = provenance,
        publicSchemaOwner = publicOwner
      )
      listOf(false, true).forEach { recreateSchema ->
        val fixture = jdbcFixture(options)
        if (recreateSchema) {
          DisposablePostgresTestDatabase.recreatePublicSchemaForFlyway(fixture.dataSource, canonicalEnvironment())
        } else {
          DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, canonicalEnvironment())
        }
        assertThat(fixture.state.queryCount).isEqualTo(4)
        assertThat(fixture.state.executeCount).isEqualTo(if (recreateSchema) 3 else 1)
        assertThat(fixture.state.commitCount).isEqualTo(1)
        assertThat(fixture.state.rollbackCount).isZero()
        listOf(
          provenance.replaceFirst(":$SYNTHETIC_RUN_ID:", ":${"f".repeat(32)}:"),
          provenance.replace(SYNTHETIC_REVIEWED_OBJECT_SHA256, "f".repeat(64))
        ).forEach { other ->
          listOf(options.copy(roleProvenance = other), options.copy(databaseProvenance = other))
            .forEach { invalid -> assertRejectedAfterConnection(jdbcFixture(invalid), recreateSchema) }
        }
      }
    }
  }

  @Test
  @Tag("windows-only")
  fun postgresRunnerSecretArtifactScannerRejectsBoundarySplitFixture() {
    val output = runRailPowerShell(
      """
      §secret = 'offline-runner-secret-boundary-fixture'
      if (§PSVersionTable.PSEdition -cne 'Desktop' -or §PSVersionTable.PSVersion.Major -ne 5 -or
          §PSVersionTable.PSVersion.Minor -ne 1) { throw 'WINDOWS_POWERSHELL_51_REQUIRED' }
      §container = [IO.Path]::GetFullPath((Join-Path ([IO.Path]::GetTempPath()) ('m1b-scan-' + [Guid]::NewGuid().ToString('N'))))
      §script:EvidenceBaseRoot = §container
      §createdDirectories = [Collections.Generic.List[string]]::new()
      §createdFiles = [Collections.Generic.List[string]]::new()
      §junction = §null
      §lock = §null
      §fixture = §null
      §secretBytes = §null
      §api = 'fixture preparation'
      function Fixture-IoPath([string]§path) {
        if (§path -cne §container -and -not §path.StartsWith(§container + '\', [StringComparison]::Ordinal)) {
          throw 'FIXTURE_OUTSIDE_TEMP_CONTAINER'
        }
        return '\\?\' + §path
      }
      function New-FixtureDirectory([string]§path) {
        §io = Fixture-IoPath §path
        [void][IO.Directory]::CreateDirectory(§io)
        §createdDirectories.Add(§path)
        return §path
      }
      function Write-FixtureFile([string]§path, [byte[]]§bytes) {
        §io = Fixture-IoPath §path
        §stream = [IO.File]::Open(§io, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        §createdFiles.Add(§path)
        try { §stream.Write(§bytes, 0, §bytes.Length) } finally { §stream.Dispose() }
      }
      function Assert-FixturePresent([string]§path, [long]§length) {
        §io = Fixture-IoPath §path
        §attributes = [IO.File]::GetAttributes(§io)
        if ((§attributes -band ([IO.FileAttributes]::Directory -bor [IO.FileAttributes]::ReparsePoint)) -ne 0 -or
            ([IO.FileInfo]::new(§io)).Length -ne §length) { throw 'FIXTURE_PRESENT_STATE_INVALID' }
      }
      function Assert-FixtureAbsent([string]§path) {
        try { [void][IO.File]::GetAttributes((Fixture-IoPath §path)) } catch {
          §exception = §_.Exception
          while (§null -ne §exception) {
            if (§exception -is [IO.FileNotFoundException]) { return }
            §exception = §exception.InnerException
          }
          throw 'FIXTURE_ABSENCE_NOT_PROVEN'
        }
        throw 'FIXTURE_STILL_PRESENT'
      }
      function Expect-ScanStop([string]§expected, [string]§path) {
        §actual = 'NO_STOP'
        try { Assert-M1BRunnerSecretAbsentFromTree §path §secret } catch { §actual = Get-M1BStopCode §_ }
        if (§actual -cne §expected) { [Console]::Out.WriteLine('M1B_SCAN_CODE_EXPECTED=' + §expected + ';actual:' + §actual); throw 'SCANNER_CODE_MISMATCH' }
      }
      try {
        [void](New-FixtureDirectory §container)
        §root = New-FixtureDirectory (§container + '\scan')
        §outside = New-FixtureDirectory (§container + '\outside')
        §clean = (Get-M1BUtf8).GetBytes('offline-clean-artifact')
        §shortClean = §root + '\short-clean.bin'
        Write-FixtureFile §shortClean §clean
        Assert-M1BRunnerSecretAbsentFromTree §root §secret
        Assert-FixturePresent §shortClean §clean.Length
        'M1B_SCAN_NATIVE_SHORT_CLEAN=PASS'

        §fileOnlyLong = §root + '\' + ('f' * 240) + '.bin'
        if (§root.Length -gt 260 -or §fileOnlyLong.Length -le 260) { throw 'FILE_ONLY_LONG_PATH_INVALID' }
        Write-FixtureFile §fileOnlyLong §clean
        Assert-M1BRunnerSecretAbsentFromTree §root §secret
        Assert-FixturePresent §fileOnlyLong §clean.Length
        ('M1B_SCAN_NATIVE_LONG_FILE_SHORT_DIRECTORY=PASS;file:' + §fileOnlyLong.Length)

        §longDirectory = §root
        while (§longDirectory.Length -le 280) {
          §longDirectory = New-FixtureDirectory (§longDirectory + '\' + ('d' * 45))
        }
        §longClean = §longDirectory + '\long-clean.bin'
        Write-FixtureFile §longClean §clean
        if (§longDirectory.Length -le 260 -or §longClean.Length -le 260) { throw 'LONG_PATH_FIXTURE_TOO_SHORT' }
        # Independent managed IO probes identify any unsupported API without a native/config fallback.
        §api = 'System.IO.Directory.EnumerateFileSystemEntries'
        §entries = @([IO.Directory]::EnumerateFileSystemEntries((Fixture-IoPath §longDirectory)))
        if (§entries.Count -ne 1 -or §entries[0] -cne (Fixture-IoPath §longClean)) { throw 'LONG_ENUMERATION_INVALID' }
        §api = 'System.IO.File.GetAttributes'
        [void][IO.File]::GetAttributes((Fixture-IoPath §longDirectory))
        [void][IO.File]::GetAttributes((Fixture-IoPath §longClean))
        §api = 'System.IO.FileInfo.Length'
        if (([IO.FileInfo]::new((Fixture-IoPath §longClean))).Length -ne §clean.Length) { throw 'LONG_SIZE_INVALID' }
        §api = 'FileContainsSequence / System.IO.FileStream'
        Initialize-M1BContainedProcessType
        §secretBytes = (Get-M1BUtf8).GetBytes(§secret)
        if ([Ritomer.M1B.ContainedProcess]::FileContainsSequence((Fixture-IoPath §longClean), §secretBytes, 536870912)) {
          throw 'CLEAN_DIRECT_READ_CONTAMINATED'
        }
        §api = 'real scanner long clean'
        Assert-M1BRunnerSecretAbsentFromTree §root §secret
        Assert-FixturePresent §longClean §clean.Length
        # A scan whose root itself is long must also succeed.
        Assert-M1BRunnerSecretAbsentFromTree §longDirectory §secret
        'M1B_SCAN_NATIVE_LONG_FILE_CLEAN=PASS'
        'M1B_SCAN_NATIVE_LONG_DIRECTORY_DESCENDANT=PASS'
        ('M1B_SCAN_LENGTHS=directory:' + §longDirectory.Length + ',file:' + §longClean.Length)

        §fixture = [byte[]]::new(65530 + §secretBytes.Length)
        for (§index = 0; §index -lt §fixture.Length; §index++) { §fixture[§index] = 65 }
        [Array]::Copy(§secretBytes, 0, §fixture, 65530, §secretBytes.Length)
        §longContaminated = §longDirectory + '\boundary-contaminated.bin'
        Write-FixtureFile §longContaminated §fixture
        §api = 'real scanner long boundary / System.IO.File.Delete'
        Expect-ScanStop 'RUNNER_SECRET_ARTIFACT_CONTAMINATION' §root
        Assert-FixtureAbsent §longContaminated
        Assert-FixturePresent §longClean §clean.Length
        Assert-FixturePresent §shortClean §clean.Length
        ('M1B_SCAN_NATIVE_LONG_BOUNDARY_DELETE=PASS;offset:65530;length:' + §longContaminated.Length)

        §shortContaminated = §root + '\short-contaminated.bin'
        Write-FixtureFile §shortContaminated §fixture
        §api = 'real scanner short boundary'
        Expect-ScanStop 'RUNNER_SECRET_ARTIFACT_CONTAMINATION' §root
        Assert-FixtureAbsent §shortContaminated
        Assert-FixturePresent §shortClean §clean.Length
        'M1B_SCAN_NATIVE_SHORT_CONTAMINATED=PASS'

        §api = 'real confinement'
        §script:EvidenceBaseRoot = §root
        try { Expect-ScanStop 'PATH_ESCAPES_RUN_ROOT' §outside } finally { §script:EvidenceBaseRoot = §container }
        'M1B_SCAN_NATIVE_ROOT_ESCAPE=PASS'
        foreach (§invalid in @(
          ('\\?\' + §root), ('\\.\' + §root), ('\??\' + §root), 'relative\root', 'C:relative',
          (§root + '\..\outside'), (§root + '\.'), (§root + '\ambiguous.'), (§root + '\ambiguous '),
          (§root + '\\empty'), (§root + '\artifact:stream'), (§root + '\NUL.txt'), §root.Replace('\', '/')
        )) {
          Expect-ScanStop 'RUNNER_ARTIFACT_PATH_INVALID' §invalid
        }
        'M1B_SCAN_NATIVE_PATH_INPUT_REJECTIONS=PASS'

        §outsideFile = §outside + '\outside-sentinel.bin'
        Write-FixtureFile §outsideFile §fixture
        §junction = §root + '\junction'
        §api = 'synthetic junction creation'
        [void](New-Item -ItemType Junction -Path §junction -Target §outside -ErrorAction Stop)
        if (([IO.File]::GetAttributes((Fixture-IoPath §junction)) -band [IO.FileAttributes]::ReparsePoint) -eq 0) {
          throw 'JUNCTION_FIXTURE_NOT_REPARSE'
        }
        §api = 'real scanner junction'
        Expect-ScanStop 'RUNNER_ARTIFACT_REPARSE_POINT_REJECTED' §root
        Expect-ScanStop 'REPARSE_POINT_ANCESTOR_REJECTED' §junction
        Assert-FixturePresent §outsideFile §fixture.Length
        [IO.Directory]::Delete((Fixture-IoPath §junction), §false)
        §junction = §null
        Assert-FixturePresent §outsideFile §fixture.Length
        'M1B_SCAN_NATIVE_JUNCTION_REJECTED_OUTSIDE_PRESERVED=PASS'

        §missingRoot = New-FixtureDirectory (§container + '\disappeared')
        [IO.Directory]::Delete((Fixture-IoPath §missingRoot), §false)
        [void]§createdDirectories.Remove(§missingRoot)
        §api = 'real scanner missing root'
        Expect-ScanStop 'RUNNER_ARTIFACT_SCAN_FAILED' §missingRoot
        'M1B_SCAN_NATIVE_MISSING_ROOT=PASS'

        §lockedRoot = New-FixtureDirectory (§container + '\locked')
        §lockedFile = §lockedRoot + '\exclusive.bin'
        Write-FixtureFile §lockedFile §clean
        §lock = [IO.File]::Open((Fixture-IoPath §lockedFile), [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
        §api = 'real scanner exclusive file lock'
        try { Expect-ScanStop 'RUNNER_ARTIFACT_SCAN_FAILED' §lockedRoot } finally { §lock.Dispose(); §lock = §null }
        Assert-FixturePresent §lockedFile §clean.Length
        'M1B_SCAN_NATIVE_EXCLUSIVE_LOCK=PASS'

        §deleteRoot = New-FixtureDirectory (§container + '\delete-blocked')
        §deleteBlocked = §deleteRoot + '\readable-contaminated.bin'
        Write-FixtureFile §deleteBlocked §fixture
        §lock = [IO.File]::Open((Fixture-IoPath §deleteBlocked), [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        §api = 'real scanner readable file without delete sharing'
        try {
          Expect-ScanStop 'RUNNER_SECRET_ARTIFACT_DELETE_FAILED' §deleteRoot
          Assert-FixturePresent §deleteBlocked §fixture.Length
        } finally { §lock.Dispose(); §lock = §null }
        'M1B_SCAN_NATIVE_DELETE_FAILED_PRESERVED=PASS'
        ('M1B_SCAN_POWERSHELL=' + §PSVersionTable.PSVersion.ToString() + ';edition:' + §PSVersionTable.PSEdition)
      } catch {
        # Only fixed scenario/API labels and exception type; never raw messages or paths.
        [Console]::Out.WriteLine('M1B_SCAN_FAILED_API=' + §api)
        throw 'NATIVE_SCANNER_FIXTURE_FAILED'
      } finally {
        if (§null -ne §lock) { §lock.Dispose() }
        if (§null -ne §fixture) { [Array]::Clear(§fixture, 0, §fixture.Length) }
        if (§null -ne §secretBytes) { [Array]::Clear(§secretBytes, 0, §secretBytes.Length) }
        # No recursive deletion: unlink our junction itself, then exact files and reverse-order directories.
        if (§null -ne §junction) { [IO.Directory]::Delete((Fixture-IoPath §junction), §false) }
        foreach (§path in §createdFiles) { [IO.File]::Delete((Fixture-IoPath §path)) }
        for (§index = §createdDirectories.Count - 1; §index -ge 0; §index--) {
          [IO.Directory]::Delete((Fixture-IoPath §createdDirectories[§index]), §false)
        }
      }
      'M1B_RUNNER_ARTIFACT_SCAN=PASS'
      """.trimIndent()
    )
    assertThat(output).contains(
      "M1B_SCAN_NATIVE_SHORT_CLEAN=PASS",
      "M1B_SCAN_NATIVE_LONG_FILE_SHORT_DIRECTORY=PASS",
      "M1B_SCAN_NATIVE_LONG_FILE_CLEAN=PASS",
      "M1B_SCAN_NATIVE_LONG_DIRECTORY_DESCENDANT=PASS",
      "M1B_SCAN_NATIVE_LONG_BOUNDARY_DELETE=PASS;offset:65530",
      "M1B_SCAN_NATIVE_SHORT_CONTAMINATED=PASS",
      "M1B_SCAN_NATIVE_ROOT_ESCAPE=PASS",
      "M1B_SCAN_NATIVE_PATH_INPUT_REJECTIONS=PASS",
      "M1B_SCAN_NATIVE_JUNCTION_REJECTED_OUTSIDE_PRESERVED=PASS",
      "M1B_SCAN_NATIVE_MISSING_ROOT=PASS",
      "M1B_SCAN_NATIVE_EXCLUSIVE_LOCK=PASS",
      "M1B_SCAN_NATIVE_DELETE_FAILED_PRESERVED=PASS",
      "M1B_SCAN_POWERSHELL=5.1.",
      "M1B_RUNNER_ARTIFACT_SCAN=PASS"
    )
    println(output.trim())
  }

  @Test
  fun postgresRunnerArtifactScannerPreservesManagedIoAndSafetyContract() {
    val script = postgresRailScriptSource()
    val converter = script.sliceBetween("function ConvertTo-M1BRunnerArtifactIoPath", "function Assert-M1BRunnerSecretAbsentFromTree")
    val scanner = script.sliceBetween("function Assert-M1BRunnerSecretAbsentFromTree", "function ConvertTo-M1BProcessArgument")
    val ancestors = script.sliceBetween("function Assert-M1BNoReparseAncestors", "function Assert-M1BContainedPath")
    val strictAncestors = ancestors.substringBefore("  \$current = [System.IO.Path]::GetFullPath(\$Path)")
    val reader = script.sliceBetween("public static bool FileContainsSequence", "public void WaitForExit")

    assertThat(converter).contains("RUNNER_ARTIFACT_PATH_INVALID", "return \$ioPath")
    assertThat(scanner).contains(
      "ConvertTo-M1BRunnerArtifactIoPath \$Root",
      "\$rootFull = \$Root",
      "\$directories.Push(\$entry)",
      "\$contaminatedFiles.Add(\$entry)",
      "[System.IO.Directory]::EnumerateFileSystemEntries(\$directoryIoPath)",
      "[System.IO.File]::GetAttributes(\$entryIoPath)",
      "[System.IO.FileInfo]::new(\$entryIoPath)",
      "[System.IO.File]::Delete(\$deleteIoPath)",
      "Assert-M1BNoReparseAncestors \$path -RunnerArtifactScan",
      "RUNNER_ARTIFACT_SCAN_FAILED",
      "RUNNER_SECRET_ARTIFACT_DELETE_FAILED",
      "RUNNER_SECRET_ARTIFACT_CONTAMINATION",
      "if ((Get-M1BStopCode \$_) -cne 'UNEXPECTED_FAILURE') { throw }",
      "[System.Array]::Clear(\$needle, 0, \$needle.Length)",
      "\$fileCount -gt 100000", "\$length -gt 536870912", "\$totalBytes -gt 4294967296"
    )
    assertThat(scanner).doesNotContain("Get-Item", "::Exists(", "preflight-readiness", "cache", "GetFullPath(")
    assertThat(strictAncestors).contains(
      "[switch]\$RunnerArtifactScan",
      "[switch]\$AllowMissing",
      "\$ioPath = ConvertTo-M1BRunnerArtifactIoPath \$current",
      "if (-not \$AllowMissing -or [IO.File]::Exists(\$ioPath) -or [IO.Directory]::Exists(\$ioPath))",
      "[System.IO.File]::GetAttributes(\$ioPath)",
      "REPARSE_POINT_ANCESTOR_REJECTED"
    ).doesNotContain("Get-Item")
    assertThat(ancestors.substringAfter("    return\n  }\n")).contains(
      "[System.IO.Path]::GetFullPath(\$Path)",
      "[System.IO.File]::Exists(\$current) -or [System.IO.Directory]::Exists(\$current)",
      "Get-Item -LiteralPath \$current -Force"
    )
    assertAppearsInOrder(scanner, "try {", "ConvertTo-M1BRunnerArtifactIoPath \$Root", "Initialize-M1BContainedProcessType", "\$needle = (Get-M1BUtf8).GetBytes(\$Literal)")
    assertAppearsInOrder(scanner, "\$entry = \$enumeratedIoPath.Substring(4)", "ConvertTo-M1BRunnerArtifactIoPath \$entry", "\$entry.StartsWith(\$rootPrefix")
    assertAppearsInOrder(scanner, "Assert-M1BNoReparseAncestors \$directory -RunnerArtifactScan", "EnumerateFileSystemEntries", "Assert-M1BNoReparseAncestors \$directory -RunnerArtifactScan", "if (\$contaminatedFiles.Count -gt 0)")
    assertAppearsInOrder(scanner, "foreach (\$path in \$contaminatedFiles)", "Assert-M1BNoReparseAncestors \$path -RunnerArtifactScan", "try {", "[System.IO.File]::Delete")
    assertThat(reader).contains(
      "new byte[65536]", "new FileStream(", "FileShare.Read",
      "while ((read = stream.Read(buffer, 0, buffer.Length)) > 0)",
      "if (stream.Position != length || stream.Length != length)",
      "FILE_CHANGED_OR_READ_INCOMPLETE", "Array.Clear(buffer, 0, buffer.Length)", "Array.Clear(failure, 0, failure.Length)"
    )
  }

  @Test
  @Tag("windows-only")
  fun postgresRunnerArtifactScannerClassifiesSimulatedIncompleteReadAndClearsNeedle() {
    val output = runRailPowerShell(
      """
      # SIMULATION: retain the real reader body and its incomplete-read check, substitute only Read's result.
      §source = [IO.File]::ReadAllText(§railPath)
      §start = §source.IndexOf('    public static bool FileContainsSequence')
      §end = §source.IndexOf('    public void WaitForExit()', §start)
      §reader = §source.Substring(§start, §end - §start)
      §readCall = 'stream.Read(buffer, 0, buffer.Length)'
      if (([regex]::Matches(§reader, [regex]::Escape(§readCall))).Count -ne 1) { throw 'READ_SIMULATION_BINDING_INVALID' }
      §reader = §reader.Replace(§readCall, 'SimulatedRead(stream, buffer)')
      §reader = §reader.Replace('if (String.IsNullOrEmpty(path))', 'LastNeedle = needle; if (String.IsNullOrEmpty(path))')
      §code = 'using System; using System.IO; namespace Ritomer.M1B { public static class ContainedProcess {' +
        'public static byte[] LastNeedle; private static int SimulatedRead(FileStream stream, byte[] buffer) { return 0; }' +
        §reader + '}}'
      Write-OfflineFixturePhase 'ADD_TYPE_ENTER'
      Add-Type -TypeDefinition §code -Language CSharp
      Write-OfflineFixturePhase 'ADD_TYPE_RETURN'
      §script:M1BContainedProcessTypeInitialized = §true
      §container = Join-Path ([IO.Path]::GetTempPath()) ('m1b-incomplete-' + [Guid]::NewGuid().ToString('N'))
      §script:EvidenceBaseRoot = §container
      §root = Join-Path §container 'scan'
      §file = Join-Path §root 'unread.bin'
      [void][IO.Directory]::CreateDirectory(§root)
      try {
        [IO.File]::WriteAllBytes(§file, [byte[]]@(65, 66, 67))
        §stop = 'NO_STOP'
        Write-OfflineFixturePhase 'SCAN_ENTER'
        try { Assert-M1BRunnerSecretAbsentFromTree §root 'offline-fixed-incomplete-marker' } catch { §stop = Get-M1BStopCode §_ }
        Write-OfflineFixturePhase 'SCAN_RETURN'
        if (§stop -cne 'RUNNER_ARTIFACT_SCAN_FAILED') { throw 'SIMULATED_INCOMPLETE_READ_NOT_CLASSIFIED' }
        §captured = [Ritomer.M1B.ContainedProcess]::LastNeedle
        if (§null -eq §captured -or §captured.Length -eq 0 -or @(§captured | Where-Object { §_ -ne 0 }).Count -ne 0) {
          throw 'SIMULATED_INCOMPLETE_READ_NEEDLE_NOT_CLEARED'
        }
        [void][IO.File]::GetAttributes(§file)
        Write-OfflineFixturePhase 'SCAN_ASSERTED'
      } finally {
        if (-not §file.StartsWith(§container + '\', [StringComparison]::Ordinal)) { throw 'FIXTURE_CLEANUP_BOUNDARY' }
        [IO.File]::Delete(§file)
        [IO.Directory]::Delete(§root, §false)
        [IO.Directory]::Delete(§container, §false)
      }
      'M1B_SCAN_SIMULATED_INCOMPLETE_READ_AND_NEEDLE_CLEAR=PASS'
      """.trimIndent(),
      tracePhases = true
    )
    assertThat(output).contains("M1B_SCAN_SIMULATED_INCOMPLETE_READ_AND_NEEDLE_CLEAR=PASS")
    println(output.trim())
  }

  @Test
  @Tag("windows-only")
  fun postgresRunnerArtifactScannerPreservesInjectedControlledStops() {
    val output = runRailPowerShell(
      """
      # SIMULATION: controlled errors injected at initialization and at the managed read boundary.
      Add-Type -TypeDefinition @'
      using System;
      namespace Ritomer.M1B {
        public static class ContainedProcess {
          public static byte[] LastNeedle;
          public static bool FileContainsSequence(string path, byte[] needle, long maxLength) {
            LastNeedle = needle;
            throw new InvalidOperationException("RITOMER_M1B_CONTROLLED_STOP::RUNNER_ARTIFACT_TOTAL_SIZE_EXCEEDED");
          }
        }
      }
      '@
      §container = Join-Path ([IO.Path]::GetTempPath()) ('m1b-stop-' + [Guid]::NewGuid().ToString('N'))
      §script:EvidenceBaseRoot = §container
      §root = Join-Path §container 'scan'
      §file = Join-Path §root 'controlled.bin'
      [void][IO.Directory]::CreateDirectory(§root)
      §script:injectPreparationStop = §true
      function Initialize-M1BContainedProcessType {
        if (§script:injectPreparationStop) { Stop-M1BRail 'RUNNER_ARTIFACT_FILE_COUNT_EXCEEDED' }
      }
      try {
        [IO.File]::WriteAllBytes(§file, [byte[]]@(65, 66, 67))
        §stop = 'NO_STOP'
        try { Assert-M1BRunnerSecretAbsentFromTree §root 'offline-fixed-controlled-marker' } catch { §stop = Get-M1BStopCode §_ }
        if (§stop -cne 'RUNNER_ARTIFACT_FILE_COUNT_EXCEEDED') { throw 'INJECTED_PREPARATION_STOP_LOST' }
        §script:injectPreparationStop = §false
        §stop = 'NO_STOP'
        try { Assert-M1BRunnerSecretAbsentFromTree §root 'offline-fixed-controlled-marker' } catch { §stop = Get-M1BStopCode §_ }
        if (§stop -cne 'RUNNER_ARTIFACT_TOTAL_SIZE_EXCEEDED') { throw 'INJECTED_READ_STOP_LOST' }
        §captured = [Ritomer.M1B.ContainedProcess]::LastNeedle
        if (§null -eq §captured -or §captured.Length -eq 0 -or @(§captured | Where-Object { §_ -ne 0 }).Count -ne 0) {
          throw 'INJECTED_STOP_NEEDLE_NOT_CLEARED'
        }
        [void][IO.File]::GetAttributes(§file)
      } finally {
        if (-not §file.StartsWith(§container + '\', [StringComparison]::Ordinal)) { throw 'FIXTURE_CLEANUP_BOUNDARY' }
        [IO.File]::Delete(§file)
        [IO.Directory]::Delete(§root, §false)
        [IO.Directory]::Delete(§container, §false)
      }
      'M1B_SCAN_SIMULATED_PREPARATION_STOP=PASS'
      'M1B_SCAN_SIMULATED_READ_STOP_AND_NEEDLE_CLEAR=PASS'
      """.trimIndent()
    )
    assertThat(output).contains(
      "M1B_SCAN_SIMULATED_PREPARATION_STOP=PASS",
      "M1B_SCAN_SIMULATED_READ_STOP_AND_NEEDLE_CLEAR=PASS"
    )
    println(output.trim())
  }


  @Test
  fun postgresGradleProcessTreeIsAtomicallyContainedAndTypeCompilesOffline() {
    val script = postgresRailScriptSource()
    val containment = script.sliceBetween(
      "function Initialize-M1BContainedProcessType",
      "function Assert-M1BPsqlBinary"
    )
    val nativeStart = containment.sliceBetween(
      "public static ContainedProcess Start",
      "public void WaitForExit"
    )
    val gradleInvoker = script.sliceBetween(
      "function Invoke-M1BGradleTask",
      "function Invoke-M1BReadiness"
    )

    assertThat(containment).contains(
      "JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE",
      "PROC_THREAD_ATTRIBUTE_HANDLE_LIST",
      "PROC_THREAD_ATTRIBUTE_JOB_LIST",
      "CREATE_SUSPENDED",
      "CREATE_UNICODE_ENVIRONMENT",
      "EXTENDED_STARTUPINFO_PRESENT",
      "CreateJobObjectW",
      "SetInformationJobObject",
      "UpdateProcThreadAttribute",
      "CreateProcessW",
      "IsProcessInJob",
      "ResumeThread",
      "TerminateJobObject",
      "QueryInformationJobObject",
      "DisposeLocalCopyOfClientHandle",
      "Marshal.AllocHGlobal(checked(3 * IntPtr.Size))"
    )
    assertAppearsInOrder(
      nativeStart,
      "CreateJobObjectW",
      "SetInformationJobObject",
      "PROC_THREAD_ATTRIBUTE_HANDLE_LIST",
      "PROC_THREAD_ATTRIBUTE_JOB_LIST",
      "CreateProcessW",
      "IsProcessInJob",
      "ResumeThread"
    )
    assertThat(containment).doesNotContain(
      "AssignProcessToJobObject",
      "JOB_OBJECT_LIMIT_BREAKAWAY_OK",
      "JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK",
      "CREATE_BREAKAWAY_FROM_JOB"
    )
    assertThat(gradleInvoker).contains(
      "[Ritomer.M1B.ContainedProcess]::Start(\$startInfo)",
      "-TerminateTreeWhenRootExits",
      "\$process.TerminateTreeAndWait(30000)",
      "\$process.Dispose()",
      "\$startInfo.EnvironmentVariables.Clear()",
      "\$ExtraEnvironment.Remove('RITOMER_DB_TEST_PASSWORD')"
    )
    assertThat(gradleInvoker).doesNotContain(
      "\$process.Start()",
      "-not \$process.HasExited"
    )

    val output = runRailPowerShell(
      """
      Initialize-M1BContainedProcessType
      if (§null -eq ('Ritomer.M1B.ContainedProcess' -as [type])) { throw 'TYPE_MISSING' }
      'M1B_CONTAINED_PROCESS_TYPE=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1B_CONTAINED_PROCESS_TYPE=PASS")
  }

  @Test
  fun postgresDReservesFollowExecutionContextAtExactBudgetBoundaries() {
    val output = runRailPowerShell(
      """
      function FixtureClock([string]§kind, [long]§total, [long]§elapsed) {
        §script:Mode = if (§kind -ceq 'Preflight') { 'Preflight' } else { 'Lifecycle' }
        §script:LifecycleAction = if (§kind -ceq 'CleanupOnly') { 'CleanupOnly' } else { 'Run' }
        §script:DCampaignClock = §null
        Start-M1DClock §kind
        §expectedTotal = switch (§kind) { 'Preflight' { 2400000L }; 'Lifecycle' { 9300000L }; 'CleanupOnly' { 720000L } }
        if (§script:DTotalMilliseconds -ne §expectedTotal) { throw 'NOMINAL_TOTAL_CHANGED' }
        §script:DCampaignClock.Stop()
        # Only the elapsed-time input is synthetic; phase admission, deadlines,
        # reentry and termination budgets below are the extracted real functions.
        §script:DCampaignClock = [pscustomobject]@{ ElapsedMilliseconds = §elapsed }
        §script:DTotalMilliseconds = §total
      }
      function ExpectStop([scriptblock]§action, [string]§expected) {
        §code = 'NONE'
        try { & §action } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne §expected) { throw ('T1_STOP:' + §code + ':' + §expected) }
      }
      §checks = 0
      foreach (§nominal in @(
        @('Preflight', 2400000L, 'readiness', 1800000L),
        @('Lifecycle', 9300000L, 'readiness', 1800000L),
        @('CleanupOnly', 720000L, 'cleanup', 300000L)
      )) {
        FixtureClock §nominal[0] §nominal[1] 0
        Enter-M1DPhase §nominal[2]
        if (§script:DPhaseDeadline -ne §nominal[3]) { throw 'NOMINAL_DEADLINE_CHANGED' }
        §checks++
      }
      foreach (§minutes in @(40L,12L)) {
        foreach (§delta in @(-1L,0L,1L)) {
          foreach (§elapsed in @(0L,123456L)) {
            FixtureClock 'Lifecycle' (§minutes * 60000L + §delta) §elapsed
            ExpectStop { Enter-M1DPhase 'readiness' } 'D_DEADLINE_EXPIRED'
            if (§script:DPhaseDeadline -ne (§script:DTotalMilliseconds - 7500000L)) { throw 'LIFECYCLE_RESERVE_ALIASED' }
            §checks++
          }
        }
      }
      # Expected reserves are contractual test data, independent of the implementation.
      §reserves = @(
        @('Lifecycle','readiness',125L), @('Lifecycle','provision',120L),
        @('Lifecycle','seed',115L), @('Lifecycle','backend',113L),
        @('Lifecycle','integration',53L), @('Lifecycle','stop',52L),
        @('Lifecycle','targeted',32L), @('Lifecycle','full',12L),
        @('Lifecycle','cleanup',7L), @('Lifecycle','controls',0L),
        @('Preflight','readiness',10L), @('Preflight','provision',0L),
        @('CleanupOnly','cleanup',7L), @('CleanupOnly','controls',0L)
      )
      foreach (§case in §reserves) {
        foreach (§elapsed in @(0L,123456L)) {
          foreach (§delta in @(-1L,0L,1L)) {
            FixtureClock §case[0] (§elapsed + §case[2] * 60000L + §delta) §elapsed
            if (§delta -le 0) {
              ExpectStop { Enter-M1DPhase §case[1] } 'D_DEADLINE_EXPIRED'
            } else {
              Enter-M1DPhase §case[1]
              if (§script:DPhaseDeadline -ne §elapsed + 1L) { throw 'RESERVE_BOUNDARY_NOT_ONE_MILLISECOND' }
              §deadline = §script:DPhaseDeadline
              ExpectStop { Enter-M1DPhase §case[1] } 'D_PHASE_REENTRY_REJECTED'
              if (§script:DPhaseDeadline -ne §deadline) { throw 'PHASE_DEADLINE_RENEWED' }
              §script:DCampaignClock.ElapsedMilliseconds = §deadline
              ExpectStop { Assert-M1DDeadline } 'D_DEADLINE_EXPIRED'
            }
            §checks++
          }
        }
      }
      FixtureClock 'Lifecycle' 60001L 1L
      §script:DPhaseDeadline = 1L
      ExpectStop { Assert-M1DDeadline } 'D_DEADLINE_EXPIRED'
      foreach (§remaining in @(60000L,30000L,29999L,1L,0L,-1L)) {
        §script:DCampaignClock.ElapsedMilliseconds = §script:DTotalMilliseconds - §remaining
        if (§remaining -gt 0) {
          if ((Get-M1DStopBudget) -ne [Math]::Min(30000L,§remaining)) { throw 'STOP_BUDGET_CHANGED' }
        } else { ExpectStop { Get-M1DStopBudget } 'D_TERMINATION_BUDGET_EXHAUSTED' }
        if (§script:DPhaseDeadline -ne 1L) { throw 'STOP_RENEWED_PHASE' }
        §checks++
      }
      if (§checks -ne 105) { throw 'T1_CASE_OMITTED' }
      'M1D_T1_RESERVES=PASS;CASES=105'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_T1_RESERVES=PASS;CASES=105")
  }

  @Test
  fun postgresDSupervisionRejectsMissingDuplicateForeignAndPrematureResults() {
    val output = runRailPowerShell(
      """
      §script:DRuntimeSha256 = '2' * 64
      §script:DFinishSent = §false
      §script:DBackendStopSent = §false
      function FixtureDrain([string]§role, [string]§output, [string]§errorOutput = '') {
        §outReader = [IO.StreamReader]::new([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes(§output)))
        §errReader = [IO.StreamReader]::new([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes(§errorOutput)))
        §process = [pscustomobject]@{ StandardOutput = §outReader; StandardError = §errReader; HasExited = §true; ExitCode = 0 }
        return New-M1DDrain §process §role 'offline-runner-marker'
      }
      function ExpectStop([object]§drain, [string]§expected) {
        §code = 'NONE'
        try { 1..5 | ForEach-Object { Update-M1DDrain §drain } } catch { §code = Get-M1BStopCode §_ }
        finally { §drain.Process.StandardOutput.Dispose(); §drain.Process.StandardError.Dispose() }
        if (§code -cne §expected) { throw ('D_FIXTURE_STOP:' + §code + ':' + §expected) }
      }
      §jars = 'M1D_JARS_RESULT ' + §RunId + ' ' + §ReviewedObjectSha256 + ' ' + §script:DRuntimeSha256 + ' PASS'
      §valid = FixtureDrain 'HARNESS' (§jars + "`n")
      1..5 | ForEach-Object { Update-M1DDrain §valid }
      if (-not §valid.Signals.ContainsKey(§jars)) { throw 'D_JARS_NOT_ACCEPTED' }
      §valid.Process.StandardOutput.Dispose(); §valid.Process.StandardError.Dispose()
      ExpectStop (FixtureDrain 'HARNESS' (§jars + "`n" + §jars + "`n")) 'D_CONTROL_MESSAGE_REJECTED'
      ExpectStop (FixtureDrain 'HARNESS' (§jars + "`n" + §jars)) 'D_UNTERMINATED_CONTROL_MESSAGE'
      ExpectStop (FixtureDrain 'BACKEND' (§jars + "`n")) 'D_CONTROL_MESSAGE_REJECTED'
      ExpectStop (FixtureDrain 'HARNESS' ((§jars.Replace(§RunId, ('f' * 32))) + "`n")) 'D_CONTROL_MESSAGE_REJECTED'
      ExpectStop (FixtureDrain 'HARNESS' '' (§jars + "`n")) 'D_CONTROL_MESSAGE_WRONG_CHANNEL'
      ExpectStop (FixtureDrain 'HARNESS' ('M1D_HARNESS_STOPPED ' + §RunId + " JARS=PASS VITE_STOP=PASS`n")) 'D_PREMATURE_HARNESS_STOP'
      ExpectStop (FixtureDrain 'BACKEND' "offline-runner-marker`n") 'RUNNER_SECRET_OUTPUT_CONTAMINATION'
      §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock 'Lifecycle'
      Enter-M1DPhase 'integration'
      §firstDeadline = §script:DPhaseDeadline
      §empty = FixtureDrain 'HARNESS' ''
      §script:DChildren['HARNESS'] = §empty
      §code = 'NONE'
      try { Wait-M1DSignal 'HARNESS' §jars -RequireExit } catch { §code = Get-M1BStopCode §_ }
      if (§code -cne 'D_REQUIRED_RESULT_ABSENT') { throw 'ZERO_EXIT_WAS_NOT_REFUSED' }
      §code = 'NONE'
      try { Enter-M1DPhase 'integration' } catch { §code = Get-M1BStopCode §_ }
      if (§code -cne 'D_PHASE_REENTRY_REJECTED' -or §script:DPhaseDeadline -ne §firstDeadline) { throw 'D_DEADLINE_WAS_RENEWED' }
      §script:DPhaseDeadline = 0
      §code = 'NONE'
      try { Assert-M1DDeadline } catch { §code = Get-M1BStopCode §_ }
      if (§code -cne 'D_DEADLINE_EXPIRED') { throw 'D_DEADLINE_NOT_ENFORCED' }
      'M1D_PROTOCOL_DEADLINES=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_PROTOCOL_DEADLINES=PASS")
  }

  @Test
  fun postgresDPlaywrightCompositionIsClosedAndKeepsBrowserOutsidePersonalProfiles() {
    val source = postgresRailScriptSource()
    val d = source.sliceBetween("if (\$Campaign -ceq 'D') {", "function Stop-M1BRail")
      .substringAfter('{').substringBeforeLast('}').trimIndent()
    val added = powershellLiteralArray(d, "ExpectedAddedFileSet")
    val composite = powershellLiteralArray(d, "CompositeFileSet")
    assertThat(added).containsExactly(
      "frontend/e2e/m1d/playwright.config.ts", "frontend/e2e/m1d/session.spec.ts",
      "frontend/e2e/m1d/evidence.ts", "frontend/m1d-browser-evidence.test.ts"
    )
    assertThat(composite).hasSize(37).doesNotHaveDuplicates().containsAll(added)
      .contains(
        "backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt",
        "backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt",
        "frontend/src/lib/api/session.ts", "frontend/src/lib/api/session.test.ts"
      )
    assertThat(powershellLiteralArray(d, "CorrectiveFileSet")).hasSize(11).doesNotHaveDuplicates()
      .contains("frontend/src/lib/api/session.ts", "frontend/src/lib/api/session.test.ts")
    assertThat(d).contains("codex/m1-1d-playwright-integration", "c7857e3180f4ba02c49f6713ecedba3f7d3eb7c5", "A4_M33_R0_D0_TOTAL37", "A4_M7_R0_D0_TOTAL11")
    val browser = source.sliceBetween("function Get-M1DBrowserDistribution", "function Write-M1DJavaArgumentFile")
    assertThat(browser).contains("chromium-1200", "chrome-win64", "'chrome.exe'", "D_BROWSER_LINK_REJECTED", "Get-M1BSha256File", "BROWSER_PATH|")
    assertThat(browser).doesNotContain("GetFolderPath", "UserProfile", "EnumerateDirectories")
    val launch = source.sliceBetween("function Start-M1DIntegratedChild", "function Invoke-M1DIntegrated")
    assertThat(launch).contains("BROWSER_COOKIE", "BROWSER_JOURNEY", "PLAYWRIGHT_NO_COPY_PROMPT", "D_BROWSER_RUNTIME_CHANGED", "Start-M1DContainedChild")
    assertThat(launch).doesNotContain("--no-sandbox", "--ignore-certificate-errors", "--disable-web-security", "--reporter")
  }

  @Test
  fun postgresDPlaywrightWaitRequiresRunnerReceiptAndEmptyJobTogether() {
    val output = runRailPowerShell(
      """
      §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock Lifecycle
      Enter-M1DPhase integration
      function Update-M1DChildren { }
      §script:receiptRead = 0
      function Read-M1DBrowserReceipt {
        param(§Kind)
        §script:receiptRead++
        if (§script:missingReceipt) { Stop-M1BRail 'D_BROWSER_RECEIPT_MISSING' }
        return 'SYNTHETIC_VALIDATED_RECEIPT'
      }
      function FixtureChild(§exitCode, §active) {
        return [pscustomobject]@{ Process=[pscustomobject]@{ HasExited=§true; ExitCode=§exitCode; ActiveProcessCount=§active }; OutEnded=§true; ErrEnded=§true }
      }
      function ExpectBrowserStop(§code) {
        §actual = 'NONE'; try { Wait-M1DBrowserReceipt cookie } catch { §actual = Get-M1BStopCode §_ }
        if (§actual -cne §code) { throw ('BROWSER_STOP_DIVERGED:' + §actual + ':' + §code) }
      }
      §script:missingReceipt = §false
      §script:DChildren = @{}
      ExpectBrowserStop 'D_BROWSER_CHILD_MISSING'
      §script:DChildren['BROWSER_COOKIE'] = FixtureChild 1 0
      ExpectBrowserStop 'D_BROWSER_RUNNER_FAILED'
      §script:DChildren['BROWSER_COOKIE'] = FixtureChild 0 1
      ExpectBrowserStop 'D_BROWSER_DESCENDANT_ALIVE'
      if (§script:receiptRead -ne 0) { throw 'RECEIPT_PRECEDED_RUNNER_CESSATION' }
      §script:DChildren['BROWSER_COOKIE'] = FixtureChild 0 0
      §script:missingReceipt = §true
      ExpectBrowserStop 'D_BROWSER_RECEIPT_MISSING'
      §script:missingReceipt = §false
      if ((Wait-M1DBrowserReceipt cookie) -cne 'SYNTHETIC_VALIDATED_RECEIPT') { throw 'VALID_RESULT_LOST' }
      §script:DChildren['BACKEND'] = FixtureChild 0 0
      ExpectBrowserStop 'D_INTEGRATED_CHILD_DISAPPEARED'
      'M1D_BROWSER_FINITE_CHILD_FAIL_CLOSED=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_BROWSER_FINITE_CHILD_FAIL_CLOSED=PASS")
  }

  @Test
  fun postgresDPlaywrightStartupWaitsForHttpAndRejectsExitOrDeadline() {
    val output = runRailPowerShell(
      """
      # Real integration and readiness loop, doubles only at process/HTTP edges.
      function Assert-M1DPortsFree { }
      function Read-M1DIntegratedRuntime { param(§Root) return [pscustomobject]@{ synthetic=§true } }
      function Wait-M1DSignal { param(§Role,§Signal,[switch]§RequireExit) }
      function Stop-M1DChild { param(§Role) §script:DChildren.Remove(§Role) }
      function Update-M1DChildren { }
      function Start-M1DIntegratedChild {
        param(§Role,§Runtime,§Provision,§RunnerPassword,§Cluster)
        if (§Role -ceq 'BROWSER_COOKIE') {
          §script:browserStarts++
          if (-not §script:httpReady) { throw 'BROWSER_NAVIGATED_BEFORE_HTTP_READY' }
          Stop-M1BRail 'D_SYNTHETIC_BROWSER_BOUNDARY'
        }
        §script:DChildren[§Role] = [pscustomobject]@{ Process=[pscustomobject]@{ HasExited=§false } }
        if (§Role -ceq 'VITE' -and §script:scenario -ceq 'already-exited') { §script:DChildren[§Role].Process.HasExited = §true }
      }
      function Test-M1DViteReady {
        param(§TimeoutMilliseconds)
        if (§TimeoutMilliseconds -lt 1 -or §TimeoutMilliseconds -gt 200) { throw 'UNBOUNDED_HTTP_PROBE' }
        if (§script:browserStarts -ne 0) { throw 'PROBE_AFTER_BROWSER_START' }
        §script:probes++
        if (§script:scenario -ceq 'exit-during-probe') { §script:DChildren['VITE'].Process.HasExited = §true; return §true }
        if (§script:scenario -ceq 'deadline') { §script:DPhaseDeadline = 0L; return §false }
        if (§script:scenario -ceq 'backend-exit') { §script:DChildren['BACKEND'].Process.HasExited = §true; return §true }
        §script:httpReady = §script:probes -ge 3
        return §script:httpReady
      }
      foreach (§case in @('late-ready','already-exited','exit-during-probe','deadline','backend-exit')) {
        §script:scenario = §case; §script:probes = 0; §script:browserStarts = 0; §script:httpReady = §false
        §script:DChildren = @{}; §script:DCampaignClock = §null
        §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock Lifecycle
        §readiness = [pscustomobject]@{ BuildRoot='SYNTHETIC'; Result=[pscustomobject]@{ RuntimeSha256='2' * 64 } }
        §code = 'NONE'
        try { Invoke-M1DIntegrated §readiness ([pscustomobject]@{}) 'SYNTHETIC' '999' } catch { §code = Get-M1BStopCode §_ }
        §expected = if (§case -ceq 'late-ready') { 'D_SYNTHETIC_BROWSER_BOUNDARY' } elseif (§case -ceq 'deadline') { 'D_DEADLINE_EXPIRED' } else { 'D_INTEGRATED_CHILD_DISAPPEARED' }
        if (§code -cne §expected) { throw ('STARTUP_STOP_DIVERGED:' + §case + ':' + §code) }
        if (§case -ceq 'late-ready') {
          if (§script:probes -ne 3 -or §script:browserStarts -ne 1) { throw 'LATE_READINESS_NOT_OBSERVED' }
        } elseif (§script:browserStarts -ne 0) { throw 'FAILED_STARTUP_USED_BROWSER' }
        if (§case -ceq 'already-exited' -and §script:probes -ne 0) { throw 'EXIT_NOT_CHECKED_BEFORE_PROBE' }
      }
      'M1D_VITE_READINESS_BEFORE_BROWSER=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_VITE_READINESS_BEFORE_BROWSER=PASS")
  }

  @Test
  fun postgresDPlaywrightObservationsRejectMissingPrivacyAndChangedRuntime() {
    val output = runRailPowerShell(
      """
      §script:DRuntimeSha256 = '3' * 64; §script:DFrontendRuntimeSha256 = '4' * 64
      §values = [ordered]@{ emittedCookie=31; acceptedCookie=31; continuity=1; login=204; rotation=1; authenticated=1; me=200
        privacyScans=2; privacyViolations=0; lostObservations=0; pagesClosed=1; contextsClosed=1; browserDisconnected=1 }
      §items = @(); §time = 1
      # Desktop 5.1 decodes fractional JSON performance.now() values as Decimal.
      foreach (§key in §values.Keys) { §items += [pscustomobject]@{ event=§key; atMs=([decimal]§time + [decimal]'0.25'); value=§values[§key] }; §time++ }
      §fixture = [pscustomobject]@{ schemaVersion=1; kind='cookie'; runId=§RunId; objectSha=§ReviewedObjectSha256
        runtimeSha=§script:DRuntimeSha256; frontendSha=§script:DFrontendRuntimeSha256; browserVersion='153.0.8010.12'
        observations=§items; windows=@('anonymous','authenticated') }
      function ExpectObservationStop(§expected) {
        §actual = 'NONE'; try { Assert-M1DBrowserObservations §fixture cookie '153.0.8010.12' } catch { §actual = Get-M1BStopCode §_ }
        if (§actual -cne §expected) { throw ('OBSERVATION_STOP_DIVERGED:' + §actual) }
      }
      Assert-M1DBrowserObservations §fixture cookie '153.0.8010.12'
      §fixture.observations[0].atMs = '1.25'
      ExpectObservationStop 'D_BROWSER_OBSERVATION_INVALID'
      §fixture.observations[0].atMs = [decimal]'1.25'
      §fixture.frontendSha = '5' * 64
      ExpectObservationStop 'D_BROWSER_OBSERVATION_BINDING_INVALID'
      §fixture.frontendSha = §script:DFrontendRuntimeSha256
      §fixture.observations += §items[0]
      ExpectObservationStop 'D_BROWSER_OBSERVATION_INVALID'
      §fixture.observations = §items
      §fixture.windows = @('authenticated')
      ExpectObservationStop 'D_BROWSER_PRIVACY_WINDOW_MISSING'
      §fixture.windows = @('anonymous','authenticated')
      (§fixture.observations | Where-Object event -ceq 'lostObservations').value = 1
      ExpectObservationStop 'D_BROWSER_OBSERVATION_MISSING'
      'M1D_BROWSER_OBSERVATION_BINDINGS=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_BROWSER_OBSERVATION_BINDINGS=PASS")
  }

  @Test
  fun postgresDQuarantinePersistsWithoutProcessLockAndRejectsIncompleteRecovery() {
    val output = runRailPowerShell(
      """
      §tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §root = Join-Path §tempBase ('m1d-receipts-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      §script:DRunRoot = §root
      §script:DQuarantinePath = Join-Path §root '.m1d-unreleased.json'
      function Get-M1DNamespaceIdentity { '00000000000000000000000000000001:0000000000000001:1' }
      try {
        Enter-M1DQuarantine ([ordered]@{
          preflightAuthorizationRecordId = 'AUTH-FIXTURE-PREFLIGHT'; preflightSha256 = '0' * 64; psqlSha256 = '0' * 64
          cluster = '999'; adminRoleOid = 10; maintenanceDatabaseOid = 11
          provenance = Get-M1BProvenance §RunId §ReviewedObjectSha256 '999'
          runtimeSha256 = '0' * 64; integratedManifestSha256 = '0' * 64; frontendRuntimeSha256 = '0' * 64
          controllerProcessId = §PID; controllerCreationTicks = [string][Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime().Ticks
        })
        §code = 'NONE'; try { Assert-M1DNoQuarantine } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_PREVIOUS_CAMPAIGN_UNRELEASED') { throw 'D_SECOND_RUN_NOT_BLOCKED' }
        # Dot-prefixed files are hidden on Unix; reproduce that property on Windows too.
        if ([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT) {
          [IO.File]::SetAttributes(§script:DQuarantinePath, ([IO.File]::GetAttributes(§script:DQuarantinePath) -bor [IO.FileAttributes]::Hidden))
        }
        [void](Assert-M1DQuarantineBinding)
        §markerBytes = [IO.File]::ReadAllBytes(§script:DQuarantinePath)
        foreach (§invalidMarker in @('missing','oversized','runId','root','receiptSha256')) {
          try {
            if (§invalidMarker -ceq 'missing') { [IO.File]::Delete(§script:DQuarantinePath) }
            elseif (§invalidMarker -ceq 'oversized') { [IO.File]::WriteAllText(§script:DQuarantinePath, ('x' * 4097), (Get-M1BUtf8)) }
            else {
              §forgedMarker = ConvertFrom-Json ((Get-M1BUtf8).GetString(§markerBytes))
              §forgedMarker.§invalidMarker = switch (§invalidMarker) { 'runId' { 'f' * 32 }; 'root' { §root + '-foreign' }; 'receiptSha256' { 'f' * 64 } }
              [IO.File]::WriteAllText(§script:DQuarantinePath, (ConvertTo-Json §forgedMarker -Compress), (Get-M1BUtf8))
            }
            §code = 'NONE'; try { [void](Assert-M1DQuarantineBinding) } catch { §code = Get-M1BStopCode §_ }
            §expected = if (§invalidMarker -cin @('missing','oversized')) { 'D_QUARANTINE_MARKER_MISSING' } else { 'D_QUARANTINE_BINDING_INVALID' }
            if (§code -cne §expected -or (§invalidMarker -cne 'missing' -and -not [IO.File]::Exists(§script:DQuarantinePath))) { throw ('D_INVALID_MARKER_ACCEPTED:' + §invalidMarker) }
          } finally { [IO.File]::WriteAllBytes(§script:DQuarantinePath, §markerBytes) }
        }
        [void](Assert-M1DQuarantineBinding)
        §code = 'NONE'; try { Exit-M1DQuarantine 'cleanup' } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_RECEIPT_MISSING' -or -not [IO.File]::Exists(§script:DQuarantinePath)) { throw 'D_QUARANTINE_RELEASED_WITHOUT_CLEANUP' }
        §code = 'NONE'; try { Read-M1DReceipt 'provision' } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_RECEIPT_MISSING') { throw 'D_INCOMPLETE_PROVISION_ACCEPTED' }
        §Campaign = 'D'
        §script:DExpectedPostmasterStart = '1789722000123456'
        §provenance = Get-M1BProvenance §RunId §ReviewedObjectSha256 '999'
        §code = 'NONE'
        try { Get-M1BCleanupSql §provenance §RunId '999' 0 20 10 11 } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_CLEANUP_EXACT_PROVISION_RECEIPT_REQUIRED') { throw 'D_ZERO_OID_ACCEPTED' }
        §sql = Get-M1BCleanupSql §provenance §RunId '999' 19 20 10 11
        if (§sql.Contains('pg_terminate_backend(') -or -not §sql.Contains('session remains after stop barrier') -or -not §sql.Contains('postmaster binding mismatch')) { throw 'D_CLEANUP_SQL_GUARDS_MISSING' }
        §Campaign = 'B'
        [void](Write-M1DReceipt 'cleanup' ([ordered]@{ targetsAbsent = §true }))
        Exit-M1DQuarantine 'cleanup'
        Assert-M1DNoQuarantine
        # Synthetic fixture cleanup is confined to this fresh temp root.
      } finally {
        if (-not §root.StartsWith(§tempBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-receipts-')) { throw 'FIXTURE_ROOT_INVALID' }
        [IO.Directory]::Delete(§root, §true)
      }
      'M1D_PERSISTENT_QUARANTINE_AND_EXACT_CLEANUP=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_PERSISTENT_QUARANTINE_AND_EXACT_CLEANUP=PASS")
  }

  @Test
  fun postgresDIntegratedOrderAndExplicitStopAreExercisedOnClosedDoubles() {
    val output = runRailPowerShell(
      """
      §tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §root = Join-Path §tempBase ('m1d-order-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      §script:DRunRoot = §root
      §script:events = [Collections.Generic.List[string]]::new()
      §script:DFrontendRuntimeSha256 = '3' * 64
      function Get-M1DNamespaceIdentity { '00000000000000000000000000000001:0000000000000001:1' }
      function Get-M1DListenerPorts { return @() }
      function Read-M1DIntegratedRuntime { param(§BuildRoot) return [pscustomobject]@{ synthetic = §true } }
      function Get-M1DFrontendRuntimeSha256 { return '3' * 64 }
      function Update-M1DChildren { }
      function Test-M1DViteReady { param(§TimeoutMilliseconds) §script:events.Add('http-ready:VITE'); return §true }
      function Assert-M1DRecordedCessation {
        if (§script:DChildren.Count -ne 0) { Stop-M1BRail 'D_FIXTURE_TREE_ALIVE' }
        §script:events.Add('cessation')
      }
      function Start-M1DIntegratedChild {
        param(§Role,§Runtime,§Provision,§RunnerPassword,§Cluster)
        §script:events.Add('start:' + §Role)
        §writer = [pscustomobject]@{ role = §Role }
        §writer | Add-Member ScriptMethod Write { param(§line) §script:events.Add('input:' + §line.Replace("`n", '<LF>')) }
        §writer | Add-Member ScriptMethod WriteLine { param(§line) §script:events.Add('input:' + §line) }
        §writer | Add-Member ScriptMethod Close { }
        §script:DChildren[§Role] = [pscustomobject]@{ Process = [pscustomobject]@{ StandardInput = §writer; HasExited = §false } }
      }
      function Wait-M1DSignal {
        param(§Role,§Signal,[switch]§RequireExit)
        §script:events.Add('wait:' + §Role + ':' + [bool]§RequireExit)
      }
      function Stop-M1DChild { param(§Role,[switch]§Forced) §script:events.Add('stop:' + §Role); §script:DChildren.Remove(§Role) }
      function Wait-M1DBrowserReceipt { param(§Kind) §script:events.Add('browser:' + §Kind); return [pscustomobject]@{ Sha256 = (('4' * 63) + $(if (§Kind -eq 'cookie') { '5' } else { '6' })) } }
      function Read-M1DBrowserReceipt { param(§Kind) return [pscustomobject]@{ Sha256 = (('4' * 63) + $(if (§Kind -eq 'cookie') { '5' } else { '6' })) } }
      try {
        §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock Lifecycle
        Enter-M1DPhase readiness
        Enter-M1DPhase provision
        §readiness = [pscustomobject]@{ BuildRoot = §root; Result = [pscustomobject]@{ RuntimeSha256 = '2' * 64 } }
        Invoke-M1DIntegrated §readiness ([pscustomobject]@{ synthetic = §true }) 'offline-runner-marker' '999'
        §expected = @(
          'start:SEED','wait:SEED:True','stop:SEED','start:BACKEND','wait:BACKEND:False',
          'start:VITE','http-ready:VITE','start:BROWSER_COOKIE','browser:cookie','stop:BROWSER_COOKIE','stop:VITE',
          'start:HARNESS','wait:HARNESS:False','start:BROWSER_JOURNEY','browser:browser','stop:BROWSER_JOURNEY',
          ('input:M1D_FINISH ' + §RunId + '<LF>'),'wait:HARNESS:True','stop:HARNESS',
          ('input:M1D_BACKEND_STOP ' + §RunId),'wait:BACKEND:True','stop:BACKEND','cessation'
        )
        if ((§script:events -join '|') -cne (§expected -join '|')) { throw ('D_PHASE_ORDER_DIVERGED:' + (§script:events -join '|')) }
        [void](Read-M1DReceipt 'integrated'); [void](Read-M1DReceipt 'stopped')
        if (-not §script:DFinishSent -or -not §script:DBackendStopSent) { throw 'D_EXPLICIT_FINISH_MISSING' }
        function Get-M1DListenerPorts { return @(5173) }
        §code = 'NONE'; try { Assert-M1DPortsFree } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_INTEGRATED_PORT_NOT_FREE') { throw 'D_FOREIGN_PORT_ACCEPTED' }
      } finally {
        if (-not §root.StartsWith(§tempBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-order-')) { throw 'FIXTURE_ROOT_INVALID' }
        [IO.Directory]::Delete(§root, §true)
      }
      'M1D_INTEGRATED_ORDER_STOP_AND_FOREIGN_PORT=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_INTEGRATED_ORDER_STOP_AND_FOREIGN_PORT=PASS")
  }

  @Test
  @Tag("windows-only")
  fun postgresDRealPreparationValidatesLongPathsAndReachesOnlySubstitutedNativeLaunch() {
    val output = runRailPowerShell(
      """
      if (§PSVersionTable.PSEdition -cne 'Desktop' -or §PSVersionTable.PSVersion.Major -ne 5) { throw 'DESKTOP_51_REQUIRED' }
      §Campaign = 'D'; §Mode = 'Lifecycle'; §LifecycleAction = 'Run'
      §tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §container = Join-Path §tempBase ('m1d-preparation-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§container)
      # Use the real D binding block. Only Git's process boundary is substituted;
      # GetBaseline, ReviewedObject and ExecutionState still validate its bytes.
      §dBindings = @(§railAst.EndBlock.Statements | Where-Object { §_ -is [Management.Automation.Language.IfStatementAst] -and §_.Clauses[0].Item1.Extent.Text.Trim() -ceq "§([char]36)Campaign -ceq 'D'" })
      . ([scriptblock]::Create(§dBindings[0].Extent.Text))
      §script:fixtureDiff = "OFFLINE_SYNTHETIC_DIFF`n"
      §ReviewedObjectSha256 = Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes(§script:fixtureDiff))
      function Invoke-M1BGit {
        param([string[]]§Arguments,[hashtable]§ExtraEnvironment=@{},[int]§LimitChars=1048576)
        §key = §Arguments -join '|'
        switch (§key) {
          'rev-parse|--show-toplevel' { return §script:RepoRoot }
          'branch|--show-current' { return §script:ExpectedBranch }
          'rev-parse|HEAD' { if (§script:scenario -ceq 'head') { return 'f' * 40 }; return §script:ExpectedHead }
          'ls-files|-v|-z' { return 'H fixture' + [char]0 }
          'status|--porcelain=v1|-z|--untracked-files=all' { return (@(§script:CompositeFileSet | ForEach-Object { $(if (§script:ExpectedAddedFileSet -ccontains §_) { '?? ' } else { ' M ' }) + §_ }) -join [char]0) + [char]0 }
          'diff|--cached|--name-only' { return '' }
          'diff|--check' { return '' }
        }
        if (§Arguments[0] -cin @('read-tree','update-index')) { return '' }
        if (§Arguments[0] -ceq 'diff' -and §Arguments[1] -ceq '--binary') { if (§script:scenario -ceq 'diff') { return 'changed' }; return §script:fixtureDiff }
        throw 'UNEXPECTED_GIT_FIXTURE_CALL'
      }
      function Get-M1DListenerPorts { if (§script:scenario -ceq 'port') { return 5173 } }
      function Initialize-M1BContainedProcessType { }
      # Final native effect only. Captures what the real preparation transmitted,
      # then throws without creating a process or claiming confinement.
      Add-Type -TypeDefinition @'
      namespace Ritomer.M1B {
        public class ContainedProcess {
          public static int Calls;
          public static string FileName, Arguments, Directory, Role, Run;
          public static bool Flags, Callback;
          public static System.Collections.Generic.Dictionary<string,string> Environment;
          public static object StartD(System.Diagnostics.ProcessStartInfo info, string run, string role, System.Action<int,long,string> callback) {
            Calls++; FileName=info.FileName; Arguments=info.Arguments; Directory=info.WorkingDirectory; Role=role; Run=run;
            Flags=!info.UseShellExecute && info.CreateNoWindow && info.RedirectStandardInput && info.RedirectStandardOutput && info.RedirectStandardError;
            Callback=callback!=null;
            Environment=new System.Collections.Generic.Dictionary<string,string>();
            foreach (string key in info.EnvironmentVariables.Keys) Environment[key]=info.EnvironmentVariables[key];
            throw new System.IO.IOException("fixture-RUNNER-COOKIE-CSRF-DSN-sensitive-marker");
          }
        }
      }
      '@
      function Write-M1DReceipt { param(§Name,§Payload) §script:intents.Add([pscustomobject]@{name=§Name;payload=§Payload}); return 'OFFLINE_NO_RECEIPT_WRITTEN' }
      §runtimeRoot = Join-Path §container 'runtime'
      §longDirectory = §runtimeRoot + '\' + ('x' * 190)
      §longFile = §longDirectory + '\DeclaredClass.class'
      if (§longFile.Length -le 260) { throw 'LONG_PATH_FIXTURE_TOO_SHORT' }
      [void][IO.Directory]::CreateDirectory('\\?\' + §longDirectory)
      [IO.File]::WriteAllText('\\?\' + §longFile, 'class-fixture-not-executable')
      §executable = (Join-Path §env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
      §manifest = [ordered]@{
        schemaVersion=1; mainClass='ch.qamwaq.ritomer.testsupport.PostgresTestRailDBootstrap'; javaExecutablePath=§executable
        classpathEntries=@(§runtimeRoot); supportClasses=@()
        runtimeInputs=@([ordered]@{label='classes';path=§runtimeRoot},[ordered]@{label='java';path=§executable})
        structure=@([ordered]@{label='classes';relativePath='.';kind='D'},[ordered]@{label='classes';relativePath=('x'*190);kind='D'},[ordered]@{label='classes';relativePath=(('x'*190)+'/DeclaredClass.class');kind='F'},[ordered]@{label='java';relativePath='.';kind='F'})
        files=@([ordered]@{path=§longFile;sha256=(Get-M1BSha256File ('\\?\'+§longFile))},[ordered]@{path=§executable;sha256=(Get-M1BSha256File §executable)})
        seedArguments=@('seed'); backendArguments=@('backend')
      }
      §validJson = ConvertTo-Json §manifest -Depth 8 -Compress
      §provision = [pscustomobject]@{DatabaseOid=19;RoleOid=20;PostmasterStartUnixMicros='1789722000123456'}
      try {
        foreach (§scenario in @('head','diff','port','manifest-hash','structure','file-hash','path','type','valid')) {
          §script:scenario=§scenario
          §script:DRunRoot=Join-Path §container §scenario; [void][IO.Directory]::CreateDirectory(§script:DRunRoot)
          §runtime=ConvertFrom-Json §validJson
          switch (§scenario) {
            'structure' { §runtime.structure[0].kind='F' }
            'file-hash' { §runtime.files[0].sha256='0'*64 }
            'path' { §runtime.runtimeInputs[0].path=§runtimeRoot+'\..\runtime' }
            'type' { §runtime.files[0].path=42 }
          }
          §manifestPath=Join-Path §script:DRunRoot 'm1d-integrated-runtime.json'
          [IO.File]::WriteAllText(§manifestPath,(ConvertTo-Json §runtime -Depth 8 -Compress),(Get-M1BUtf8))
          §script:DIntegratedManifestSha256=Get-M1BSha256File §manifestPath
          if (§scenario -ceq 'manifest-hash') { §script:DIntegratedManifestSha256='0'*64 }
          §script:DCampaignClock=§null; §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock Lifecycle; Enter-M1DPhase readiness; Enter-M1DPhase provision
          §script:intents=[Collections.Generic.List[object]]::new()
          §code='NONE'
          try {
            Set-M1DDiagnosticOperation 'post-provision-state'
            [void](Assert-M1BExecutionState §script:DRunRoot 'd-post-provision')
            Invoke-M1DIntegrated ([pscustomobject]@{BuildRoot=§script:DRunRoot;Result=[pscustomobject]@{RuntimeSha256=('2'*64)}}) §provision 'fixture-runner-no-authority' '999'
          } catch { §code=Get-M1BStopCode §_; [void](Add-M1DFailure §_) }
          if (§scenario -cne 'valid') {
            if (§code -ceq 'NONE' -or §code -ceq 'UNEXPECTED_FAILURE' -or [Ritomer.M1B.ContainedProcess]::Calls -ne 0 -or §script:intents.Count -ne 0) { throw ('INVALID_PREPARATION_REACHED_LAUNCH:' + §scenario) }
            continue
          }
          §diag=Get-M1DDiagnostics
          if (§code -cne 'UNEXPECTED_FAILURE' -or §diag.primary.stage -cne 'seed' -or §diag.primary.operation -cne 'native-launch' -or §diag.primary.category -cne 'IO_FAILURE' -or §diag.secondary.Count -ne 0) { throw 'PREPARATION_FAILURE_NOT_CLASSIFIED' }
          if ([Ritomer.M1B.ContainedProcess]::Calls -ne 1 -or [Ritomer.M1B.ContainedProcess]::Role -cne 'SEED' -or [Ritomer.M1B.ContainedProcess]::Run -cne §RunId -or [Ritomer.M1B.ContainedProcess]::FileName -cne §executable -or -not [Ritomer.M1B.ContainedProcess]::Flags -or -not [Ritomer.M1B.ContainedProcess]::Callback) { throw 'NATIVE_PARAMETERS_DIVERGED' }
          §neutral=Join-Path §script:DRunRoot 'volatile\integrated\seed-child'
          §argumentPath=Join-Path §neutral 'java-arguments.txt'
          §expectedArguments=@(('-Duser.home='+(Join-Path §neutral 'home')),('-Djava.io.tmpdir='+(Join-Path §neutral 'tmp')),'-Duser.name=ritomer-m1b-rail','-Djava.net.useSystemProxies=false',('-XX:ErrorFile='+(Join-Path §neutral 'hs_err_pid%p.log')),('-XX:HeapDumpPath='+(Join-Path §neutral 'heapdump_pid%p.hprof')),'-XX:-HeapDumpOnOutOfMemoryError',('@'+§argumentPath),'ch.qamwaq.ritomer.testsupport.PostgresTestRailDBootstrap','seed')
          §command=(§expectedArguments | ForEach-Object { ConvertTo-M1BProcessArgument §_ }) -join ' '
          if ([Ritomer.M1B.ContainedProcess]::Arguments -cne §command -or [Ritomer.M1B.ContainedProcess]::Directory -cne §neutral) { throw 'SEED_COMMAND_DIVERGED' }
          §environment=[Ritomer.M1B.ContainedProcess]::Environment
          §expected=@{RITOMER_DB_RAIL_CAMPAIGN='D';RITOMER_DB_RAIL_RUN_ID=§RunId;RITOMER_DB_RAIL_RUN_ROOT=§script:DRunRoot;RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256=§ReviewedObjectSha256;RITOMER_DB_RAIL_RUNTIME_SHA256=('2'*64);RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER='999';RITOMER_DB_RAIL_DATABASE_OID='19';RITOMER_DB_RAIL_RUNNER_ROLE_OID='20';RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS=§provision.PostmasterStartUnixMicros;RITOMER_DB_TEST_PASSWORD='fixture-runner-no-authority';RITOMER_DB_TEST_PHASE='d-seed';RITOMER_DB_TEST_USERNAME=§script:TargetRunnerRole;RITOMER_DB_TEST_JDBC_URL=§script:TargetJdbcUrl;RITOMER_DB_TEST_DESTRUCTIVE_CONSENT=§script:DestructiveConsent;RITOMER_DB_TESTS_ENABLED='true'}
          foreach (§key in §expected.Keys) { if (-not §environment.ContainsKey(§key) -or §environment[§key] -cne §expected[§key]) { throw 'SEED_ENVIRONMENT_BINDING_DIVERGED' } }
          if (§environment.ContainsKey('JAVA_TOOL_OPTIONS') -or §environment.ContainsKey('PGPASSWORD') -or §environment['TEMP'] -cne (Join-Path §neutral 'tmp')) { throw 'SEED_ENVIRONMENT_LEAK' }
          §argumentText=[IO.File]::ReadAllText(§argumentPath,(Get-M1BUtf8))
          §expectedText='-classpath'+"`n"+'"'+§runtimeRoot.Replace('\','\\')+'"'+"`n"
          if (§argumentText -cne §expectedText -or §script:intents.Count -ne 1 -or §script:intents[0].name -cne 'launch-lifecycle-SEED-intent' -or §script:intents[0].payload.argumentFileSha256 -cne (Get-M1BSha256File §argumentPath)) { throw 'ARGUMENT_FILE_OR_INTENT_DIVERGED' }
          §serialized=ConvertTo-Json §diag -Depth 5 -Compress
          if (§serialized.Contains('sensitive-marker') -or §argumentText.Contains('fixture-runner')) { throw 'SYNTHETIC_SECRET_PERSISTED' }
        }
      } finally {
        if (-not §container.StartsWith(§tempBase,[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§container)).StartsWith('m1d-preparation-')) { throw 'FIXTURE_ROOT_INVALID' }
        [IO.File]::Delete('\\?\'+§longFile); [IO.Directory]::Delete('\\?\'+§longDirectory)
        [IO.Directory]::Delete(§container,§true)
      }
      'M1D_REAL_PREPARATION_LONG_PATH_AND_NEGATIVE_BINDINGS=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_REAL_PREPARATION_LONG_PATH_AND_NEGATIVE_BINDINGS=PASS")
    assertThat(output).doesNotContain("fixture-RUNNER-COOKIE-CSRF-DSN-sensitive-marker")
  }

  @Test
  fun postgresDLifecycleOrdersDestructionAndKeepsFailedCleanupQuarantinedOnDoubles() {
    val output = runRailPowerShell(
      """
      # Every process/DB boundary is a closed synthetic double. The orchestration,
      # deadlines, durable receipts, quarantine and recovery code are the real rail.
      §Campaign = 'D'; §Mode = 'Lifecycle'; §LifecycleAction = 'Run'
      §PreflightAuthorizationRecordId = 'AUTH-FIXTURE-PREFLIGHT'
      §tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §container = Join-Path §tempBase ('m1d-lifecycle-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§container)
      §script:realReceiptWriter = (Get-Command Write-M1DReceipt).ScriptBlock
      function Write-M1DReceipt {
        param(§Name,§Payload)
        if (§Name -ceq 'terminal' -and §script:scenario -cin @('publication-secondary','publication-only')) { throw [IO.IOException]::new('fixture-PUBLICATION-COOKIE-secret') }
        & §script:realReceiptWriter §Name §Payload
      }
      function Get-M1DNamespaceIdentity { '00000000000000000000000000000001:0000000000000001:1' }
      function Assert-M1BInvocation { return §script:scenarioRoot }
      # Cache validity has dedicated real-reader tests; this fixture isolates lifecycle ordering.
      function Initialize-M1DGradleCacheReuse { param(§Root,§Preflight) }
      function Enter-M1BRunLock { param(§Root) return [pscustomobject]@{ synthetic = §true } }
      function Exit-M1BRunLock { param(§Lock) §script:lockReleased = §true }
      function Assert-M1BExecutionState {
        param(§Root,§Phase)
        if (§Phase -ceq 'd-terminal-state' -and §script:scenario -ceq 'controls-secondary') { throw [UnauthorizedAccessException]::new('fixture-CONTROLS-DSN-secret') }
        return [pscustomobject]@{ Baseline = [pscustomobject]@{ synthetic = §true } }
      }
      function Invoke-M1BReadiness {
        param(§Root,§PhaseName,§RunId,§ReviewedObjectSha256)
        §script:events.Add('readiness'); §script:DIntegratedManifestSha256 = '1' * 64
        return [pscustomobject]@{ BuildRoot = §Root; GradleUserHome = §Root; Result = [pscustomobject]@{ RuntimeSha256 = '2' * 64 } }
      }
      function Read-M1BPreflightManifest {
        param(§Root,§RunId,§ReviewedObjectSha256,§Authorization,§Baseline)
        §script:fixtureCampaignTimestamp = if (§script:scenario -ceq 'campaign-expired') { [string]([Diagnostics.Stopwatch]::GetTimestamp() - 11760L * [Diagnostics.Stopwatch]::Frequency) } else { [string][Diagnostics.Stopwatch]::GetTimestamp() }
        if (§script:scenario -ceq 'reserve-readiness') {
          # Leave a valid monotonic binding even on a recently booted host.
          # 80 elapsed minutes leave 75 of the real 155-minute lifecycle cap,
          # below the real 125-minute readiness reserve. Admission stays real.
          §script:DCampaignClock.Stop()
          §script:DCampaignClock = [pscustomobject]@{ ElapsedMilliseconds = 4800000L }
        }
        return [pscustomobject]@{ Sha256 = ('3' * 64); Value = [pscustomobject]@{
          runtimeSha256 = '2' * 64; psql = [pscustomobject]@{ sha256 = §ExpectedPsqlSha256 }
          campaignStartTimestamp = §script:fixtureCampaignTimestamp
          stopwatchFrequency = [string][Diagnostics.Stopwatch]::Frequency; machine = [Environment]::MachineName
          namespaceIdentity = $(if (§script:scenario -ceq 'namespace-mismatch') { 'different-boot' } else { Get-M1DNamespaceIdentity })
          frontendRuntimeSha256 = $(if (§script:scenario -ceq 'frontend-drift') { 'f' * 64 } else { '4' * 64 })
          observation = [pscustomobject]@{ clusterSystemIdentifier = '999'; currentRoleOid = 10; maintenanceDatabaseOid = 11; hbaRuleNumber = 1 }
        } }
      }
      function Get-M1DFrontendRuntimeSha256 { return '4' * 64 }
      function Assert-M1BInteractiveConsole { }
      function New-M1BRunnerSecret { return [pscustomobject]@{ PasswordBytes = [byte[]]@(1,2,3); Password = 'offline-runner-marker' } }
      function New-M1BRandomSalt { return ,([byte[]]@(4,5,6)) }
      function New-M1BScramSha256Verifier { param(§Password,§Salt) return 'synthetic-verifier' }
      function Assert-M1BRunnerSecretAbsentFromTree { param(§Root,§Password) }
      function Invoke-M1BProvisionPsql {
        param(§NeutralRoot,§Verifier,§Provenance,§Cluster,§Hba,§Admin,§Maintenance)
        §script:events.Add('provision'); §script:PsqlProcessStarts.Provision = 1
        return [pscustomobject]@{ DatabaseOid = 19; RoleOid = 20; PostmasterStartUnixMicros = '1789722000123456'; PsqlSha256 = §ExpectedPsqlSha256; StructuredOutputSha256 = ('5' * 64) }
      }
      function Invoke-M1DIntegrated {
        param(§Readiness,§Provision,§Password,§Cluster)
        §script:events.Add('integration')
        if (§script:scenario -ceq 'sealed-finalizer') {
          §script:stopAttested=§true
          foreach(§ownedRole in @('BACKEND','VITE')){
            §ownedProcess=[pscustomobject]@{Role=§ownedRole;Id=2000000000;CreationTimeUtcTicks=638000000000000000L;JobName=('OFFLINE_'+§ownedRole);HasExited=§true;ActiveProcessCount=0
              StandardOutput=[IO.StringReader]::new('');StandardError=[IO.StringReader]::new('')}
            §ownedProcess | Add-Member ScriptMethod TerminateTreeAndWait {param(§Budget) return §true}
            §ownedProcess | Add-Member ScriptMethod DisposeD {
              param(§Budget)
              §script:events.Add('release-'+§this.Role);§this.StandardOutput.Dispose();§this.StandardError.Dispose()
              if(§this.Role -ceq 'BACKEND'){return @('stop-stdout-close')};return @()
            }
            §script:DChildren[§ownedRole]=New-M1DDrain §ownedProcess §ownedRole §null
          }
          Stop-M1DChild BACKEND -Forced
          throw 'FAILED_CHILD_FINALIZATION_RETURNED'
        }
        if (§script:scenario -cin @('unexpected','cleanup-secondary','publication-secondary','controls-secondary','forged-stop','propagated-primary')) {
          §script:stopAttested=§true; Enter-M1DPhase seed; Set-M1DDiagnosticOperation 'native-launch'
          if (§script:scenario -ceq 'forged-stop') { throw 'RITOMER_M1B_CONTROLLED_STOP::FIXTURE_SECRET_COOKIE_CSRF' }
          if (§script:scenario -ceq 'propagated-primary') {
            try { throw [IO.IOException]::new('fixture-PRIMARY-RUNNER-COOKIE-CSRF-secret') }
            catch { [void](Add-M1DFailure §_); throw }
          }
          throw [IO.IOException]::new('fixture-PRIMARY-RUNNER-COOKIE-CSRF-secret')
        }
        if (§script:scenario -ceq 'unattested-stop') { §script:stopAttested = §false; Stop-M1BRail 'D_SYNTHETIC_INTERRUPTION' }
        [void](Write-M1DReceipt 'integrated' ([ordered]@{ synthetic = §true }))
        [void](Write-M1DReceipt 'stopped' ([ordered]@{ synthetic = §true }))
        §script:stopAttested = §true
        if (§script:scenario -cin @('reserve-targeted','reserve-cleanup')) {
          §script:DCampaignClock.Stop()
          §script:DCampaignClock = [pscustomobject]@{ ElapsedMilliseconds = 0L }
          §script:DTotalMilliseconds = if (§script:scenario -ceq 'reserve-targeted') { 1920000L } else { 420000L }
          §script:DChildren = @{ HARNESS = 'synthetic'; BACKEND = 'synthetic' }
        }
      }
      §realStopChild = (Get-Command Stop-M1DChild).ScriptBlock
      function Stop-M1DChild {
        param(§Role,[switch]§Forced,[switch]§Finalizing)
        if (§script:scenario -cnotin @('reserve-targeted','reserve-cleanup')) { & §realStopChild §Role -Forced:§Forced -Finalizing:§Finalizing; return }
        # OS boundary only: this proves orchestration, never native cessation.
        if (-not §Forced -or -not §Finalizing) { throw 'FINALIZATION_FLAGS_LOST' }
        §script:stoppedRoles.Add(§Role)
      }
      function Assert-M1DRecordedCessation { if (-not §script:stopAttested) { Stop-M1BRail 'D_SYNTHETIC_STOP_UNPROVEN' } }
      function Assert-M1DPortsFree { }
      function Invoke-M1BTestPhase {
        param(§Phase,§Root,§BuildRoot,§GradleHome,§Password,§Runtime,§Cluster,§DatabaseOid,§RoleOid,§Postmaster)
        if (-not §script:stopAttested) { throw 'DESTRUCTION_BEFORE_STOP' }
        §script:events.Add(§Phase)
        if (§script:scenario -ceq 'targeted-failure' -and §Phase -ceq 'targeted') { Stop-M1BRail 'D_SYNTHETIC_TARGETED_FAILURE' }
        return [pscustomobject]@{ OutputSha256 = ('6' * 64) }
      }
      function Invoke-M1BCleanupPsql {
        param(§Root,§Provenance,§RunId,§Cluster,§DatabaseOid,§RoleOid,§Admin,§Maintenance)
        if (-not §script:stopAttested -or §DatabaseOid -ne 19 -or §RoleOid -ne 20) { throw 'CLEANUP_WITHOUT_EXACT_STOP_IDENTITY' }
        §script:events.Add('cleanup'); §script:PsqlProcessStarts.Cleanup = 1
        if (§script:scenario -ceq 'cleanup-secondary') { throw [UnauthorizedAccessException]::new('fixture-CLEANUP-DSN-secret') }
        if (§script:scenario -ceq 'cleanup-failure') { Stop-M1BRail 'D_SYNTHETIC_OPERATOR_ABSENT' }
        return [pscustomobject]@{ PsqlSha256 = §ExpectedPsqlSha256; StructuredOutputSha256 = ('7' * 64) }
      }
      try {
        foreach (§scenario in @('namespace-mismatch','campaign-expired','reserve-readiness','reserve-targeted','reserve-cleanup','frontend-drift','healthy','targeted-failure','unattested-stop','sealed-finalizer','unexpected','cleanup-secondary','publication-secondary','controls-secondary','forged-stop','propagated-primary','publication-only','cleanup-failure')) {
          §script:scenario = §scenario
          §script:scenarioRoot = Join-Path §container §scenario
          [void][IO.Directory]::CreateDirectory(§script:scenarioRoot)
          §script:DQuarantinePath = Join-Path §script:scenarioRoot '.m1d-unreleased.json'
          §script:DCampaignClock = §null; §script:DChildren = @{}; §script:stopAttested = §false
          §script:PsqlProcessStarts = @{ Preflight = 0; Provision = 0; Cleanup = 0 }
          §script:events = [Collections.Generic.List[string]]::new()
          §script:stoppedRoles = [Collections.Generic.List[string]]::new(); §script:lockReleased = §false
          §SensitiveAuthorizationRecordId = 'AUTH-FIXTURE-LIFECYCLE'
          §code = 'NONE'
          try { [void](Invoke-M1DLifecycle) } catch { §code = Get-M1BStopCode §_ }
          if (-not §script:lockReleased) { throw 'LIFECYCLE_LOCK_NOT_RELEASED' }
          if (§scenario -ceq 'reserve-readiness') {
            if (-not §script:DEnteredPhases.ContainsKey('readiness')) { throw 'READINESS_RESERVE_NOT_REACHED' }
            if (§code -cne 'D_DEADLINE_EXPIRED' -or §script:events.Count -ne 0 -or [IO.File]::Exists(§script:DQuarantinePath) -or §script:PsqlProcessStarts.Provision -ne 0 -or §script:PsqlProcessStarts.Cleanup -ne 0) {
              # Closed observations only; never substitute a different expected result.
              if ([long]§script:fixtureCampaignTimestamp -le 0) { 'M1D_READINESS_TIMESTAMP_NONPOSITIVE' }
              if (§script:fixtureCampaignTimestamp -cmatch '^[1-9][0-9]{1,18}$') { 'M1D_READINESS_TIMESTAMP_VALID' }
              if (§script:DEnteredPhases.ContainsKey('readiness')) { 'M1D_READINESS_ADMISSION_REACHED' }
              if (§code -ceq 'D_CAMPAIGN_CLOCK_BINDING_INVALID') { 'M1D_READINESS_CLOCK_BINDING_INVALID' }
              elseif (§code -ceq 'D_DEADLINE_EXPIRED') { 'M1D_READINESS_DEADLINE_EXPIRED' }
              else { 'M1D_READINESS_STOP_UNCLASSIFIED' }
              if (§script:events.Count -eq 0 -and -not [IO.File]::Exists(§script:DQuarantinePath) -and §script:PsqlProcessStarts.Provision -eq 0 -and §script:PsqlProcessStarts.Cleanup -eq 0) { 'M1D_READINESS_EFFECTS_ABSENT' }
              throw 'INSUFFICIENT_RESERVE_STARTED_WORK'
            }
            continue
          }
          if (§scenario -cin @('reserve-targeted','reserve-cleanup')) {
            §terminal = Read-M1DReceipt 'terminal'
            §diag = Get-M1DDiagnostics
            §cleanupExpected = §scenario -ceq 'reserve-targeted'
            §expectedEvents = if (§cleanupExpected) { 'readiness|provision|integration|cleanup' } else { 'readiness|provision|integration' }
            if (§code -cne 'D_LIFECYCLE_FAILED_SEE_RECEIPTS' -or §terminal.payload.campaignResult -cne 'FAIL' -or §terminal.payload.primaryStop -cne 'D_CONTROLLED_FAILURE' -or §diag.primary.stage -cne 'targeted' -or §diag.primary.category -cne 'TIMEOUT') { throw 'RESERVE_PRIMARY_FAILURE_LOST' }
            if ((§script:events -join '|') -cne §expectedEvents -or ((§script:stoppedRoles | Sort-Object) -join '|') -cne 'BACKEND|HARNESS') { throw 'RESERVE_FINALIZATION_ORDER_CHANGED' }
            if (§terminal.payload.cleanupVerified -ne §cleanupExpected -or §script:PsqlProcessStarts.Cleanup -ne [int]§cleanupExpected -or [IO.File]::Exists(§script:DQuarantinePath) -eq §cleanupExpected) { throw 'RESERVE_CLEANUP_GATE_CHANGED' }
            if (-not §cleanupExpected -and (§terminal.payload.cleanupStop -cne 'D_CONTROLLED_FAILURE' -or §diag.secondary.Count -ne 1 -or §diag.secondary[0].stage -cne 'cleanup' -or §diag.secondary[0].category -cne 'TIMEOUT')) { throw 'CLEANUP_RESERVE_FAILURE_LOST' }
            continue
          }
          if (§scenario -ceq 'namespace-mismatch') {
            if (§code -cne 'D_CAMPAIGN_CLOCK_BINDING_INVALID' -or §script:events.Count -ne 0 -or [IO.File]::Exists(§script:DQuarantinePath)) { throw 'D_CROSS_BOOT_PREFLIGHT_ACCEPTED' }
            continue
          }
          if (§scenario -ceq 'campaign-expired') {
            if (§code -cnotin @('D_CAMPAIGN_DEADLINE_EXPIRED','D_CAMPAIGN_CLOCK_BINDING_INVALID') -or §script:events.Count -ne 0 -or [IO.File]::Exists(§script:DQuarantinePath)) { throw 'D_EXPIRED_CAMPAIGN_STARTED_READINESS' }
            continue
          }
          if (§scenario -ceq 'frontend-drift') {
            if (§code -cne 'D_FRONTEND_PREFLIGHT_RUNTIME_DIVERGED' -or (§script:events -join '|') -cne 'readiness' -or [IO.File]::Exists(§script:DQuarantinePath)) { throw 'D_FRONTEND_PREFLIGHT_DRIFT_ACCEPTED' }
            continue
          }
          if(§scenario -ceq 'sealed-finalizer'){
            §terminal=Read-M1DReceipt terminal;§diag=Get-M1DDiagnostics
            if(§code -cne 'D_LIFECYCLE_FAILED_SEE_RECEIPTS' -or (§script:events -join '|') -cne 'readiness|provision|integration|release-BACKEND|release-VITE' -or §script:PsqlProcessStarts.Cleanup -ne 0 -or §terminal.payload.cleanupVerified -or §terminal.payload.cleanupStop -cne 'D_CONTROLLED_FAILURE'){throw 'FAILED_FINALIZATION_DID_NOT_BLOCK_DESTRUCTION'}
            if(§diag.primary.childRole -cne 'BACKEND' -or §diag.primary.operation -cne 'stop-stdout-close' -or §diag.secondary.Count -ne 1 -or §diag.secondary[0].control -cne 'D_STOP_BARRIER_FAILED' -or §script:DChildren.Count -ne 1 -or -not §script:DChildren.ContainsKey('BACKEND')){throw 'SEALED_FAILURE_OR_INDEPENDENT_PEER_LOST'}
            continue
          }
          §expected = switch (§scenario) {
            'healthy' { 'readiness|provision|integration|targeted|full|cleanup' }
            'targeted-failure' { 'readiness|provision|integration|targeted|cleanup' }
            'unattested-stop' { 'readiness|provision|integration' }
            'cleanup-failure' { 'readiness|provision|integration|targeted|full|cleanup' }
            'publication-only' { 'readiness|provision|integration|targeted|full|cleanup' }
            default { 'readiness|provision|integration|cleanup' }
          }
          if ((§script:events -join '|') -cne §expected) { throw ('D_LIFECYCLE_ORDER:' + §scenario + ':' + (§script:events -join '|')) }
          if (§scenario -cin @('unexpected','cleanup-secondary','publication-secondary','controls-secondary','forged-stop','propagated-primary','publication-only')) {
            §diagnostics=Get-M1DDiagnostics
            §json=ConvertTo-Json §diagnostics -Depth 5 -Compress
            foreach (§marker in @('fixture-PRIMARY-RUNNER-COOKIE-CSRF-secret','fixture-CLEANUP-DSN-secret','fixture-PUBLICATION-COOKIE-secret','fixture-CONTROLS-DSN-secret','FIXTURE_SECRET_COOKIE_CSRF')) {
              if (§json.Contains(§marker) -or §json.Contains((Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes(§marker))))) { throw 'DIAGNOSTIC_SECRET_LEAK' }
              foreach (§artifact in [IO.Directory]::EnumerateFiles(§script:scenarioRoot,'*.json')) { if ([IO.File]::ReadAllText(§artifact).Contains(§marker)) { throw 'RECEIPT_SECRET_LEAK' } }
            }
            §expectedPrimary=if (§scenario -ceq 'publication-only') { 'terminal-publication' } else { 'native-launch' }
            if (§diagnostics.primary.operation -cne §expectedPrimary -or §diagnostics.primary.category -cne $(if (§scenario -ceq 'forged-stop') { 'CONTROLLED_STOP' } else { 'IO_FAILURE' })) { throw 'PRIMARY_DIAGNOSTIC_LOST' }
            §secondaryOperation=switch (§scenario) { 'cleanup-secondary' { 'cleanup' }; 'publication-secondary' { 'terminal-publication' }; 'controls-secondary' { 'terminal-controls' }; default { '' } }
            if (§secondaryOperation.Length -gt 0 -and (§diagnostics.secondary.Count -ne 1 -or §diagnostics.secondary[0].operation -cne §secondaryOperation)) { throw 'SECONDARY_DIAGNOSTIC_LOST' }
            if (§scenario -ceq 'propagated-primary' -and §diagnostics.secondary.Count -ne 0) { throw 'PROPAGATED_PRIMARY_DUPLICATED' }
            if (§scenario -cin @('publication-secondary','publication-only')) {
              if (§code -cne 'D_TERMINAL_PUBLICATION_FAILED' -or [IO.File]::Exists((Join-Path §script:scenarioRoot 'd-terminal.json'))) { throw 'PUBLICATION_FAILURE_BECAME_SUCCESS' }
            } else {
              §terminal=Read-M1DReceipt 'terminal'
              if (§code -cne 'D_LIFECYCLE_FAILED_SEE_RECEIPTS' -or §terminal.payload.campaignResult -cne 'FAIL' -or (ConvertTo-Json §terminal.payload.diagnostics -Depth 5 -Compress) -cne §json) { throw 'TERMINAL_DIAGNOSTIC_DIVERGED' }
              # Reader must reject a correctly rehashed but open diagnostic field.
              §terminal.payload.diagnostics.primary.category='UNTRUSTED_VALUE'
              §path=Join-Path §script:scenarioRoot 'd-terminal.json'
              [IO.File]::WriteAllText(§path,(ConvertTo-Json §terminal -Depth 12 -Compress),(Get-M1BUtf8))
              [IO.File]::WriteAllText((§path+'.sha256'),((Get-M1BSha256File §path)+"`n"),(Get-M1BUtf8))
              §invalid='NONE'; try { [void](Read-M1DReceipt 'terminal') } catch { §invalid=Get-M1BStopCode §_ }
              if (§invalid -cne 'D_DIAGNOSTIC_INVALID') { throw 'OPEN_DIAGNOSTIC_ACCEPTED' }
            }
            continue
          }
          §terminal = Read-M1DReceipt 'terminal'
          if (§scenario -ceq 'healthy') {
            if (§code -cne 'NONE' -or §terminal.payload.campaignResult -cne 'PASS' -or [IO.File]::Exists(§script:DQuarantinePath)) { throw 'D_HEALTHY_NOT_PROVEN' }
          } else {
            if (§code -cne 'D_LIFECYCLE_FAILED_SEE_RECEIPTS' -or §terminal.payload.campaignResult -cne 'FAIL') { throw ('D_FAILURE_BECAME_PASS:' + §code) }
            if (§scenario -ceq 'targeted-failure') { Assert-M1DNoQuarantine }
            else {
              §blocked = 'NONE'; try { Assert-M1DNoQuarantine } catch { §blocked = Get-M1BStopCode §_ }
              if (§blocked -cne 'D_PREVIOUS_CAMPAIGN_UNRELEASED') { throw 'D_FAILURE_QUARANTINE_LOST' }
            }
          }
        }
        # The final scenario left an exact failed-cleanup receipt set. Model only
        # the original controller's absence; the native fixture proves that boundary.
        §LifecycleAction = 'CleanupOnly'; §script:DCampaignClock = §null
        §SensitiveAuthorizationRecordId = 'AUTH-FIXTURE-CLEANUP-NEW'
        §code = 'NONE'; try { Invoke-M1DCleanupOnly } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_ORIGINAL_CONTROLLER_STILL_ALIVE') { throw 'D_LIVE_CONTROLLER_ACCEPTED' }
        function Get-Process { param(§Id,§ErrorAction) return §null }
        §LifecycleAction = 'CleanupOnly'; §script:DCampaignClock = §null
        §SensitiveAuthorizationRecordId = 'AUTH-FIXTURE-LIFECYCLE'
        §code = 'NONE'; try { Invoke-M1DCleanupOnly } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_NEW_CLEANUP_AUTHORIZATION_REQUIRED') { throw 'D_REUSED_AUTHORIZATION_ACCEPTED' }
        §script:DCampaignClock = §null; §SensitiveAuthorizationRecordId = 'AUTH-FIXTURE-CLEANUP-NEW'
        §script:scenario = 'recovery'; §script:PsqlProcessStarts = @{ Preflight = 0; Provision = 0; Cleanup = 0 }
        [void](Invoke-M1DCleanupOnly)
        Assert-M1DNoQuarantine
        §recovery = Read-M1DReceipt 'recovery-terminal'
        if (§recovery.payload.campaignResult -cne 'FAIL' -or §recovery.payload.cleanupResult -cne 'PASS' -or (Read-M1DReceipt 'terminal').payload.campaignResult -cne 'FAIL') { throw 'D_RECOVERY_REWROTE_CAMPAIGN' }
      } finally {
        if (-not §container.StartsWith(§tempBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§container)).StartsWith('m1d-lifecycle-')) { throw 'FIXTURE_ROOT_INVALID' }
        [IO.Directory]::Delete(§container, §true)
      }
      'M1D_LIFECYCLE_DESTRUCTION_QUARANTINE_RECOVERY=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_LIFECYCLE_DESTRUCTION_QUARANTINE_RECOVERY=PASS")
    assertThat(output).contains("M1D_LIFECYCLE_DIAGNOSTIC")
    assertThat(output).doesNotContain(
      "fixture-PRIMARY-RUNNER-COOKIE-CSRF-secret", "fixture-CLEANUP-DSN-secret",
      "fixture-PUBLICATION-COOKIE-secret", "fixture-CONTROLS-DSN-secret", "FIXTURE_SECRET_COOKIE_CSRF"
    )
  }

  @ParameterizedTest
  @ValueSource(strings = ["reuse", "runtime-drift", "stop-authorization", "stop-active", "stop-pid", "stop-ticks", "stop-job", "stop-array-ticks", "stop-array-job", "stop-missing", "binding-missing", "path-invalid", "root-invalid", "digest-invalid", "launcher-altered", "wrapper-missing", "extra-file", "reparse", "error-preservation"])
  @Tag("windows-only")
  fun postgresDGradleCacheIsSealedAfterCessationAndReusedByAllThreeOfflineChildren(scenario: String) {
    val body = """
      §scenario='$scenario'
      §Campaign='D'; §Mode='Preflight'; §LifecycleAction='Run'
      §SensitiveAuthorizationRecordId='AUTH-CACHE-FIXTURE-C1'; §PreflightAuthorizationRecordId=§SensitiveAuthorizationRecordId
      # Each invocation owns a fresh short root, including its C1 and C2 receipts.
      §owned=[IO.Path]::GetFullPath((Split-Path -Parent §PSCommandPath))
      §allowed=[IO.Path]::GetFullPath((Join-Path §script:RepoRoot 'out\ofx'))
      if(-not §owned.StartsWith(§allowed+'\',[StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName(§owned) -cnotmatch '^t[0-9a-f]{8}§'){throw 'FIXTURE_ROOT_INVALID'}
      Assert-M1BNoReparseAncestors §owned
      §container=Join-Path §owned 'c'; if(Test-Path -LiteralPath §container){throw 'FIXTURE_COLLISION'}
      [void][IO.Directory]::CreateDirectory(§container)
      §root=Join-Path §container §RunId
      §cache=Join-Path §root 'volatile\preflight-readiness\gradle-home'
      §dist=Join-Path §cache 'wrapper\dists\gradle-8.14.4-bin\92wwslzcyst3phie3o264zltu'
      §launcher=Join-Path §dist 'gradle-8.14.4\lib\gradle-launcher-8.14.4.jar'
      §marker=Join-Path §dist 'gradle-8.14.4-bin.zip.ok'
      §junction=Join-Path §cache 'outside'
      §script:fixtureStep='path-budget';§script:fixtureTarget=§launcher
      §primaryFailure=§null;§cleanupFailure=§null
      §script:fixtureRuntime='2'*64
      §script:captured=[Collections.Generic.List[object]]::new()
      §script:processes=[Collections.Generic.List[object]]::new()
      function Get-M1DNamespaceIdentity { '00000000000000000000000000000001:0000000000000001:1' }
      function Initialize-M1BContainedProcessType { }
      function Assert-M1BRunnerSecretAbsentFromTree { param(§Root,§Password) }
      function Start-M1DContainedChild {
        param(§StartInfo,§Role,§ArgumentFile)
        §environment=@{};foreach(§key in §StartInfo.EnvironmentVariables.Keys){§environment[[string]§key]=[string]§StartInfo.EnvironmentVariables[§key]}
        §script:captured.Add([pscustomobject]@{Role=§Role;Arguments=§StartInfo.Arguments;Environment=§environment;WorkingDirectory=§StartInfo.WorkingDirectory;UseShellExecute=§StartInfo.UseShellExecute})
        §runtime=§script:fixtureRuntime
        §text="M1B_POSTGRES_RAIL_READINESS=PASS`nM1B_POSTGRES_RAIL_DATABASE_EXECUTION=NONE`nM1B_POSTGRES_RAIL_RUNTIME_SHA256=§runtime`nM1D_INTEGRATED_MANIFEST_SHA256=§('1'*64)`nM1B_POSTGRES_RAIL_RUNTIME_SHA256_VERIFIED=§runtime`nM1B_POSTGRES_RAIL_RUNTIME_SHA256_REVALIDATED=§runtime`nM1B_POSTGRES_RAIL_TARGETED=PASS`nM1B_POSTGRES_RAIL_FULL=PASS`n"
        §p=[pscustomobject]@{Id=(2000000000+§script:captured.Count);CreationTimeUtcTicks='638000000000000000';JobName=('Local\Ritomer.M1D.'+§RunId+'.'+§Role);HasExited=§true;ActiveProcessCount=0;ExitCode=0;StartInfo=§StartInfo;StandardInput=[IO.StringWriter]::new();StandardOutput=[IO.StringReader]::new(§text);StandardError=[IO.StringReader]::new('');Disposed=§false}
        §p | Add-Member ScriptMethod WaitForExit { }
        §p | Add-Member ScriptMethod TerminateTreeAndWait { param(§Budget) return §true }
        §p | Add-Member ScriptMethod Dispose { §this.StandardInput.Dispose();§this.StandardOutput.Dispose();§this.StandardError.Dispose();§this.Disposed=§true }
        §script:processes.Add(§p)
        §name='launch-'+$(if(§Mode -ceq 'Preflight'){'preflight'}else{'lifecycle'})+'-'+§Role
        §script:fixtureTarget=Join-Path §root ('d-'+§name+'-intent.json')
        §binary=Get-M1BSha256File §StartInfo.FileName
        §command=Get-M1BSha256Bytes ((Get-M1BUtf8).GetBytes(§StartInfo.Arguments))
        [void](Write-M1DReceipt (§name+'-intent') ([ordered]@{role=§Role;binaryPath=§StartInfo.FileName;binarySha256=§binary;commandSha256=§command;argumentFileSha256='NONE'}))
        [void](Write-M1DReceipt (§name+'-confined') ([ordered]@{role=§Role;processId=§p.Id;creationTimeUtcTicks=§p.CreationTimeUtcTicks;jobName=§p.JobName;binaryPath=§StartInfo.FileName;binarySha256=§binary;commandSha256=§command;argumentFileSha256='NONE';confinedBeforeResume=§true}))
        return §p
      }
      function Expect-CacheStop {
        param([scriptblock]§Action,[string]§Code)
        §before=§script:captured.Count;§actual='NONE'
        try{& §Action | Out-Null}catch{§actual=Get-M1BStopCode §_}
        if(§actual -cne §Code -or §script:captured.Count -ne §before){throw ('CACHE_REFUSAL_DIVERGED:'+§Code+':'+§actual)}
      }
      try {
        if(§launcher.Length -ge 260 -or (Split-Path -Parent §launcher).Length -ge 248){throw 'FIXTURE_PATH_BUDGET_EXCEEDED'}
        §script:fixtureStep='witness';§script:fixtureTarget=Join-Path §container 'w'
        [IO.File]::WriteAllText(§script:fixtureTarget,'owned-witness')
        if([IO.File]::ReadAllText(§script:fixtureTarget) -cne 'owned-witness'){throw 'FIXTURE_WITNESS_READ_FAILED'}
        [IO.File]::Delete(§script:fixtureTarget)
        if([IO.File]::Exists(§script:fixtureTarget)){throw 'FIXTURE_WITNESS_DELETE_FAILED'}
        if(§scenario -ceq 'error-preservation'){throw 'FIXTURE_PRIMARY_SYNTHETIC'}
        [void][IO.Directory]::CreateDirectory(§root);§script:DRunRoot=§root
        §env:JAVA_HOME=Join-Path §container 'j'
        [void][IO.Directory]::CreateDirectory((Join-Path §env:JAVA_HOME 'bin'))
        [IO.File]::WriteAllText((Join-Path §env:JAVA_HOME 'bin\java.exe'),'NOT_EXECUTABLE')
        §script:fixtureStep='c1-readiness';§script:fixtureTarget=§root
        Start-M1DClock Preflight;Enter-M1DPhase readiness
        §c1=Invoke-M1BReadiness §root 'preflight-readiness' §RunId §ReviewedObjectSha256
        if(§c1.GradleUserHome -cne §cache -or §script:captured[0].Arguments.Contains('--offline') -or [IO.Directory]::GetFileSystemEntries(§cache).Count -ne 0){throw 'C1_CACHE_NOT_FRESH_ONLINE'}
        # Fixed fixture from the unchanged wrapper URI, independent of the production constructor.
        §script:fixtureStep='inert-distribution';§script:fixtureTarget=§launcher
        [void][IO.Directory]::CreateDirectory((Join-Path §dist 'gradle-8.14.4\bin'))
        [void][IO.Directory]::CreateDirectory((Join-Path §dist 'gradle-8.14.4\lib'))
        [IO.File]::WriteAllText(§marker,'')
        [IO.File]::WriteAllText((Join-Path §dist 'gradle-8.14.4\bin\gradle.bat'),'inert-wrapper')
        [IO.File]::WriteAllText(§launcher,'inert-launcher')
        §script:fixtureStep='c1-seal';§script:fixtureTarget=§cache
        §binding=New-M1DGradleCacheBinding §root;§hash=§binding.sha256
        [IO.File]::SetLastWriteTimeUtc(§launcher,[DateTime]::UtcNow.AddDays(-1))
        if((Get-M1DGradleCacheSha256 §root) -cne §hash){throw 'CACHE_TIMESTAMP_WAS_HASHED'}
        §preflight=[pscustomobject]@{Sha256=('3'*64);Value=[pscustomobject]@{readinessCache=§binding}}
        §script:fixtureStep=§scenario;§script:fixtureTarget=§cache
        if(§scenario.StartsWith('stop-')){
          §stopPath=Join-Path §root 'd-launch-preflight-READINESS-stopped.json';§script:fixtureTarget=§stopPath
          if(§scenario -ceq 'stop-missing'){
            [IO.File]::Move(§stopPath,§stopPath+'.held')
            Expect-CacheStop {New-M1DGradleCacheBinding §root} 'D_RECEIPT_MISSING'
          }else{
            §value=ConvertFrom-Json ([IO.File]::ReadAllText(§stopPath,(Get-M1BUtf8)))
            switch(§scenario){
              'stop-authorization'{§value.authorizationRecordId='AUTH-CACHE-FIXTURE-C2'}
              'stop-active'{§value.payload.activeProcesses=1}
              'stop-pid'{§value.payload.processId++}
              'stop-ticks'{§value.payload.creationTimeUtcTicks='638000000000000001'}
              'stop-job'{§value.payload.jobName='Local.other'}
              'stop-array-ticks'{§value.payload.creationTimeUtcTicks=@(§value.payload.creationTimeUtcTicks)}
              'stop-array-job'{§value.payload.jobName=@(§value.payload.jobName)}
            }
            §bytes=(Get-M1BUtf8).GetBytes((ConvertTo-Json §value -Depth 12 -Compress))
            [IO.File]::WriteAllBytes(§stopPath,§bytes);[IO.File]::WriteAllText(§stopPath+'.sha256',(Get-M1BSha256Bytes §bytes)+"`n",(Get-M1BUtf8))
            Expect-CacheStop {New-M1DGradleCacheBinding §root} 'D_GRADLE_CACHE_CESSATION_INVALID'
          }
        }else{
          §Mode='Lifecycle';§SensitiveAuthorizationRecordId='AUTH-CACHE-FIXTURE-C2'
          §script:DCampaignClock=§null
          if(§scenario -ceq 'runtime-drift'){
            # This case has only its own C1; no C2 READINESS receipts exist yet.
            if(Test-Path (Join-Path §root 'd-launch-lifecycle-READINESS-intent.json')){throw 'RUNTIME_CASE_NOT_ISOLATED'}
            §script:fixtureRuntime='4'*64;§script:released=§false
            function Assert-M1BInvocation { §root }
            function Assert-M1DNoQuarantine { }
            function Enter-M1BRunLock { param(§Root) [pscustomobject]@{synthetic=§true} }
            function Exit-M1BRunLock { param(§Lock) §script:released=§true }
            function Assert-M1BExecutionState { param(§Root,§Phase) [pscustomobject]@{Baseline=[pscustomobject]@{synthetic=§true}} }
            function Read-M1BPreflightManifest {
              [pscustomobject]@{Sha256=('3'*64);Value=[pscustomobject]@{
                readinessCache=§binding;runtimeSha256=('2'*64);psql=[pscustomobject]@{sha256=§ExpectedPsqlSha256}
                campaignStartTimestamp=[string][Diagnostics.Stopwatch]::GetTimestamp();stopwatchFrequency=[string][Diagnostics.Stopwatch]::Frequency
                machine=[Environment]::MachineName;namespaceIdentity=(Get-M1DNamespaceIdentity)
              }}
            }
            function Enter-M1DQuarantine { throw 'RUNTIME_DRIFT_REACHED_QUARANTINE' }
            function Invoke-M1BProvisionPsql { throw 'RUNTIME_DRIFT_REACHED_PROVISION' }
            §actual='NONE';try{[void](Invoke-M1DLifecycle)}catch{§actual=Get-M1BStopCode §_}
            if(§actual -cne 'D_PREFLIGHT_RUNTIME_DIVERGED' -or §script:captured.Count -ne 2 -or -not §script:released){throw ('RUNTIME_COMPARISON_NOT_EXERCISED:'+§actual)}
            [void](Read-M1DReceipt 'launch-lifecycle-READINESS-stopped')
          }else{
            Start-M1DClock Lifecycle;Enter-M1DPhase readiness
            switch(§scenario){
              'binding-missing'{§preflight.Value.readinessCache=§null;§expected='D_GRADLE_CACHE_BINDING_INVALID'}
              'path-invalid'{§binding.relativePath='volatile/other/gradle-home';§expected='D_GRADLE_CACHE_BINDING_INVALID'}
              'root-invalid'{§root=Join-Path §container ('1'*32);§expected='D_GRADLE_CACHE_ROOT_INVALID'}
              'digest-invalid'{§binding.sha256='f'*64;§expected='D_GRADLE_CACHE_DIGEST_DIVERGED'}
              'launcher-altered'{[IO.File]::WriteAllText(§launcher,'altered-launcher');§expected='D_GRADLE_CACHE_DIGEST_DIVERGED'}
              'wrapper-missing'{[IO.File]::Move(§marker,§marker+'.held');§expected='D_GRADLE_WRAPPER_CACHE_INCOMPLETE'}
              'extra-file'{[IO.File]::WriteAllText((Join-Path §cache 'unexpected-file'),'not-bound');§expected='D_GRADLE_CACHE_DIGEST_DIVERGED'}
              'reparse'{[void](New-Item -ItemType Junction -Path §junction -Target §env:JAVA_HOME);§expected='D_GRADLE_CACHE_ENTRY_INVALID'}
            }
            if(§scenario -cne 'reuse'){Expect-CacheStop {Initialize-M1DGradleCacheReuse §root §preflight} §expected}
            else{
              Expect-CacheStop {Assert-M1DGradleCacheReuse §cache} 'D_GRADLE_CACHE_NOT_VERIFIED'
              §realHash=(Get-Command Get-M1DGradleCacheSha256).ScriptBlock;§script:hashCalls=0
              function Get-M1DGradleCacheSha256 { param(§Root) §script:hashCalls++; & §realHash §Root }
              Initialize-M1DGradleCacheReuse §root §preflight
              Expect-CacheStop {Assert-M1DGradleCacheReuse §env:JAVA_HOME} 'D_GRADLE_CACHE_NOT_VERIFIED'
              §originalId=§RunId;§RunId='1'*32
              Expect-CacheStop {Assert-M1DGradleCacheReuse §cache} 'D_GRADLE_CACHE_NOT_VERIFIED';§RunId=§originalId
              §c2=Invoke-M1BReadiness §root 'lifecycle-readiness' §RunId §ReviewedObjectSha256
              if(§c2.BuildRoot -ceq §c1.BuildRoot -or [IO.Directory]::Exists((Join-Path §root 'volatile\lifecycle-readiness\gradle-home'))){throw 'C2_ISOLATION_INVALID'}
              [IO.File]::WriteAllText((Join-Path §cache 'legitimate-metadata'),'changed-by-fixture-child')
              foreach(§phase in @('targeted','full')){Enter-M1DPhase §phase;[void](Invoke-M1BTestPhase §phase §root §c2.BuildRoot §c2.GradleUserHome 'fixture-password-not-a-secret' ('2'*64) '999' 19 20 '1789722000123456')}
              if(§script:hashCalls -ne 1 -or (§script:captured.Role -join '|') -cne 'READINESS|READINESS|TARGETED|FULL'){throw 'CACHE_RECHECK_OR_PHASES_INVALID'}
              foreach(§psi in @((§script:captured.ToArray())[1..3])){
                if(§psi.Environment['GRADLE_USER_HOME'] -cne §cache -or [regex]::Matches(§psi.Arguments,'(?:^| )--offline(?= |§)').Count -ne 1 -or
                   -not §psi.Arguments.Contains('--rerun-tasks') -or -not §psi.Arguments.Contains('--no-build-cache') -or §psi.UseShellExecute -or §psi.Environment['USERPROFILE'] -ceq §env:USERPROFILE){throw 'C2_GRADLE_PSI_INVALID'}
              }
            }
          }
        }
        foreach(§p in §script:processes){if(-not §p.Disposed -or §p.StartInfo.EnvironmentVariables.Count -ne 0){throw 'GRADLE_FINALIZATION_INVALID'}}
        Write-Output ('FIXTURE_SCENARIO_RESULT '+(ConvertTo-Json ([ordered]@{scenario=§scenario;status='PASS';children=§script:captured.Count;root=§root}) -Compress))
      }catch{
        §primaryFailure=§_
        Write-Output ('FIXTURE_SCENARIO_RESULT '+(ConvertTo-Json ([ordered]@{scenario=§scenario;status='FAIL';step=§script:fixtureStep;target=§script:fixtureTarget;category=§_.Exception.GetType().FullName;message=§_.Exception.Message}) -Compress))
      }finally{
        try{
          §cleanupStep='children-ended';§cleanupTarget=§container
          foreach(§p in §script:processes){if(-not §p.HasExited -or §p.ActiveProcessCount -ne 0 -or -not §p.Disposed){throw 'FIXTURE_CHILD_NOT_FINALIZED'}}
          §cleanupStep='containment'
          if([IO.Path]::GetFullPath(§container) -cne (§owned+'\c')){throw 'FIXTURE_CLEANUP_OUTSIDE_OWNED_ROOT'}
          Assert-M1BNoReparseAncestors §container
          §cleanupStep='owned-link';§cleanupTarget=§junction
          if([IO.Directory]::Exists(§junction)){
            if(([IO.File]::GetAttributes(§junction) -band [IO.FileAttributes]::ReparsePoint) -eq 0){throw 'FIXTURE_LINK_TYPE_CHANGED'}
            [IO.Directory]::Delete(§junction)
          }
          §cleanupStep='owned-tree';§cleanupTarget=§container
          Remove-Item -LiteralPath §container -Recurse -Force -ErrorAction Stop
          if(§scenario -ceq 'error-preservation'){throw 'FIXTURE_CLEANUP_SYNTHETIC'}
          Write-Output ('FIXTURE_FINALIZATION_RESULT '+(ConvertTo-Json ([ordered]@{scenario=§scenario;status='PASS';step=§cleanupStep;target=§cleanupTarget}) -Compress))
        }catch{
          §cleanupFailure=§_
          Write-Output ('FIXTURE_FINALIZATION_RESULT '+(ConvertTo-Json ([ordered]@{scenario=§scenario;status='FAIL';step=§cleanupStep;target=§cleanupTarget;category=§_.Exception.GetType().FullName;message=§_.Exception.Message}) -Compress))
        }
      }
      if(§null -ne §primaryFailure){throw §primaryFailure}
      if(§null -ne §cleanupFailure){throw §cleanupFailure}
      'D_GRADLE_CACHE_FIXTURE=PASS'
      """.trimIndent()
    if (scenario == "error-preservation") {
      val failure = requireNotNull(org.assertj.core.api.Assertions.catchThrowable { runRailPowerShell(body) })
      assertThat(failure).isInstanceOf(AssertionError::class.java)
        .hasMessageContaining("FIXTURE_PRIMARY_SYNTHETIC")
        .hasMessageContaining("FIXTURE_CLEANUP_SYNTHETIC")
      assertThat(failure.message).doesNotContain("D_GRADLE_CACHE_FIXTURE=PASS")
    } else {
      assertThat(runRailPowerShell(body)).contains("D_GRADLE_CACHE_FIXTURE=PASS")
    }
  }
  @Test
  fun postgresDHarnessDiagnosticBlocksProgressEvenWithPassAndZeroExit() {
    val output = runRailPowerShell(
      """
      §Mode='Lifecycle';§LifecycleAction='Run';Start-M1DClock Lifecycle
      §script:DPhase='integration';§script:DOperation='child-drain';§script:DRuntimeSha256='3'*64
      §jars='M1D_JARS_RESULT '+§RunId+' '+§ReviewedObjectSha256+' '+§script:DRuntimeSha256+' PASS'
      §frame=[ordered]@{schemaVersion=1;runId=§RunId;objectSha=§ReviewedObjectSha256;runtimeSha=§script:DRuntimeSha256
        diagnostic=[ordered]@{code='HTTP_STATUS_MISMATCH';step='FOLDER_CREATE';expectedStatus=201;receivedStatus=409}}
      §line='HARNESS_FAILED '+(ConvertTo-Json §frame -Depth 5 -Compress)+[char]10
      foreach(§withPass in @(§false,§true)){
        §script:DHarnessDiagnostic=§null;§script:DFailures=[Collections.Generic.List[object]]::new()
        §stdout=if(§withPass){§jars+[char]10}else{''}
        §process=[pscustomobject]@{StandardOutput=[IO.StringReader]::new(§stdout);StandardError=[IO.StringReader]::new(§line);HasExited=§true;ExitCode=0}
        try{
          §script:DChildren=@{HARNESS=(New-M1DDrain §process HARNESS §null)}
          §advanced=§false;§stop='NONE'
          try{Wait-M1DSignal HARNESS §jars;§advanced=§true}catch{§stop=Get-M1BStopCode §_;[void](Add-M1DFailure §_)}
          §expected=if(§withPass){'D_CONTROL_MESSAGE_REJECTED'}else{'D_REQUIRED_RESULT_ABSENT'}
          if(§advanced -or §stop -cne §expected){throw 'HARNESS_DIAGNOSTIC_ALLOWED_PROGRESS'}
          §detail=§script:DHarnessDiagnostic.diagnostic
          if(§detail.code -cne 'HTTP_STATUS_MISMATCH' -or §detail.step -cne 'FOLDER_CREATE' -or §detail.expectedStatus -ne 201 -or §detail.receivedStatus -ne 409){throw 'HARNESS_FIRST_DETAIL_LOST'}
          §primary=(Get-M1DDiagnostics).primary
          if(@(§primary.PSObject.Properties.Name).Count -ne 5 -or §primary.stage -cne 'integration' -or §primary.operation -cne 'child-drain' -or §primary.childRole -cne 'HARNESS' -or §primary.control -cne §expected){throw 'HARNESS_PRIMARY_CONTRACT_CHANGED'}
          # Exercise the actual terminal producer even if its caller mistakenly
          # supplies success: a failure diagnostic must remain a failure.
          §payload=Get-M1DTerminalPayload -Success §true -PrimaryStop §stop -CleanupStop §null -Targeted §null -Full §null -Cleanup §null
          if(§payload.campaignResult -cne 'FAIL' -or §payload.harnessDiagnostic.diagnostic.code -cne 'HTTP_STATUS_MISMATCH'){throw 'HARNESS_DETAIL_BECAME_TERMINAL_PASS'}
        }finally{§process.StandardOutput.Dispose();§process.StandardError.Dispose()}
      }
      'HARNESS_DIAGNOSTIC_BLOCKS_PROGRESS=PASS CASES=2'
      """.trimIndent()
    )
    assertThat(output).contains("HARNESS_DIAGNOSTIC_BLOCKS_PROGRESS=PASS CASES=2")
  }

  @Test
  fun postgresDHarnessFirstDiagnosticSurvivesRejectedLaterFramesAndFinalization() {
    val output = runRailPowerShell(
      """
      §Mode='Lifecycle';§LifecycleAction='Run';Start-M1DClock Lifecycle
      §script:DPhase='integration';§script:DOperation='child-drain';§script:DRuntimeSha256='3'*64
      §frame=[ordered]@{schemaVersion=1;runId=§RunId;objectSha=§ReviewedObjectSha256;runtimeSha=§script:DRuntimeSha256
        diagnostic=[ordered]@{code='HTTP_STATUS_MISMATCH';step='FOLDER_CREATE';expectedStatus=201;receivedStatus=409}}
      §first='HARNESS_FAILED '+(ConvertTo-Json §frame -Depth 5 -Compress)+[char]10
      §later=ConvertFrom-Json (ConvertTo-Json §frame -Depth 5 -Compress)
      §later.diagnostic=[pscustomobject]@{code='LOGOUT_FAILED';step='LOGOUT';expectedStatus=§null;receivedStatus=§null}
      §duplicate='HARNESS_FAILED '+(ConvertTo-Json §later -Depth 5 -Compress)+[char]10
      §malformed='HARNESS_FAILED {"private":"private-harness-body-cookie"}'+[char]10
      foreach(§second in @(§duplicate,§malformed)){
        §script:DHarnessDiagnostic=§null;§script:DFailures=[Collections.Generic.List[object]]::new()
        §process=[pscustomobject]@{StandardOutput=[IO.StringReader]::new('');StandardError=[IO.StringReader]::new(§first+§second);HasExited=§true;ExitCode=1}
        try{
          §drain=New-M1DDrain §process HARNESS §null
          §stop='NONE';try{Update-M1DDrain §drain}catch{§stop=Get-M1BStopCode §_;[void](Add-M1DFailure §_)}
          if(§stop -cne 'D_CONTROL_MESSAGE_REJECTED'){throw 'HARNESS_LATER_FRAME_NOT_REJECTED'}
          §retained=§script:DHarnessDiagnostic
          if(§null -eq §retained -or §retained.diagnostic.code -cne 'HTTP_STATUS_MISMATCH' -or §retained.diagnostic.step -cne 'FOLDER_CREATE'){throw 'HARNESS_FIRST_FRAME_OVERWRITTEN'}
          §firstJson=ConvertTo-Json §retained -Depth 5 -Compress
          # These are the same drain and finalization mode used after a stop;
          # parsing a completed buffer twice must not duplicate the failure.
          1..4 | ForEach-Object{Update-M1DDrain §drain -Finalizing}
          if(-not §drain.OutEnded -or -not §drain.ErrEnded -or §drain.ErrParsedOffset -ne §drain.Stderr.Length){throw 'HARNESS_FINALIZATION_DRAIN_INCOMPLETE'}
          if(-not [object]::ReferenceEquals(§retained,§script:DHarnessDiagnostic) -or (ConvertTo-Json §script:DHarnessDiagnostic -Depth 5 -Compress) -cne §firstJson){throw 'HARNESS_FIRST_FRAME_CHANGED_DURING_FINALIZATION'}
          §diag=Get-M1DDiagnostics
          if(§script:DFailures.Count -ne 1 -or §diag.secondary.Count -ne 0 -or §diag.primary.control -cne 'D_CONTROL_MESSAGE_REJECTED'){throw 'HARNESS_DRAIN_FAILURE_RECOLLECTED'}
          §payload=Get-M1DTerminalPayload -Success §false -PrimaryStop §stop -CleanupStop §null -Targeted §null -Full §null -Cleanup §null
          §json=ConvertTo-Json §payload -Depth 10 -Compress
          if(§json.Contains('private-harness-body-cookie') -or §payload.harnessDiagnostic.diagnostic.receivedStatus -ne 409){throw 'HARNESS_TERMINAL_EXPOSED_OR_REPLACED_DETAIL'}
        }finally{§process.StandardOutput.Dispose();§process.StandardError.Dispose()}
      }
      'HARNESS_FIRST_DIAGNOSTIC_PRESERVED=PASS CASES=2'
      """.trimIndent()
    )
    assertThat(output).contains("HARNESS_FIRST_DIAGNOSTIC_PRESERVED=PASS CASES=2")
    assertThat(output).doesNotContain("private-harness-body-cookie")
  }

  @Test
  fun postgresDHarnessTerminalRoundTripPreservesOptionalHistoricalDetail() {
    val output = runRailPowerShell(
      """
      §Mode='Lifecycle';§LifecycleAction='Run';Start-M1DClock Lifecycle
      §script:DPhase='integration';§script:DOperation='child-drain';§script:DRuntimeSha256='3'*64
      function Get-M1DNamespaceIdentity{return 'OFFLINE_HARNESS_NAMESPACE'}
      §frame=[ordered]@{schemaVersion=1;runId=§RunId;objectSha=§ReviewedObjectSha256;runtimeSha=§script:DRuntimeSha256
        diagnostic=[ordered]@{code='HTTP_RESPONSE_UNAVAILABLE';step='REVIEWER_READ';expectedStatus=200;receivedStatus=§null}}
      §tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §root=Join-Path §tempBase ('m1d-harness-terminal-'+[Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      try{
        foreach(§case in @('legacy','null','current')){
          §script:DRunRoot=Join-Path §root §case;[void][IO.Directory]::CreateDirectory(§script:DRunRoot)
          §script:DHarnessDiagnostic=if(§case -ceq 'current'){Read-M1DHarnessDiagnosticLine ('HARNESS_FAILED '+(ConvertTo-Json §frame -Depth 5 -Compress))}else{§null}
          §payload=Get-M1DTerminalPayload -Success (§case -cne 'current') -PrimaryStop §null -CleanupStop §null -Targeted §null -Full §null -Cleanup §null
          if(§case -ceq 'legacy'){§payload.Remove('harnessDiagnostic')}
          [void](Write-M1DReceipt campaign ([ordered]@{runtimeSha256=§script:DRuntimeSha256}))
          [void](Write-M1DReceipt terminal §payload)
          §path=Join-Path §script:DRunRoot 'd-terminal.json';§before=Get-M1BSha256File §path
          §read=Read-M1DReceipt terminal
          if((Get-M1BSha256File §path) -cne §before){throw 'HARNESS_HISTORICAL_RECEIPT_CHANGED'}
          if(§case -ceq 'legacy'){
            if(§read.payload.PSObject.Properties.Name -ccontains 'harnessDiagnostic'){throw 'HARNESS_LEGACY_DETAIL_INVENTED'}
          }elseif(§case -ceq 'null'){
            if(§null -ne §read.payload.harnessDiagnostic){throw 'HARNESS_NULL_DETAIL_ENRICHED'}
          }else{
            if(§read.payload.campaignResult -cne 'FAIL' -or (ConvertTo-Json §read.payload.harnessDiagnostic -Depth 5 -Compress) -cne (ConvertTo-Json §script:DHarnessDiagnostic -Depth 5 -Compress)){throw 'HARNESS_TERMINAL_DETAIL_ROUND_TRIP_CHANGED'}
            # A recomputed fixture sidecar cannot legitimize a contradictory
            # PASS receipt: semantic validation is still mandatory on readback.
            §read.payload.campaignResult='PASS'
            [IO.File]::WriteAllText(§path,(ConvertTo-Json §read -Depth 12 -Compress),(Get-M1BUtf8))
            [IO.File]::WriteAllText(§path+'.sha256',(Get-M1BSha256File §path)+[char]10,(Get-M1BUtf8))
            §stop='NONE';try{[void](Read-M1DReceipt terminal)}catch{§stop=Get-M1BStopCode §_}
            if(§stop -cne 'D_CONTROL_MESSAGE_REJECTED'){throw 'HARNESS_CONTRADICTORY_PASS_RECEIPT_ACCEPTED'}
          }
        }
      }finally{
        if(-not §root.StartsWith(§tempBase,[StringComparison]::OrdinalIgnoreCase)-or-not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-harness-terminal-')){throw 'HARNESS_TERMINAL_FIXTURE_PATH_INVALID'}
        [IO.Directory]::Delete(§root,§true)
      }
      'HARNESS_TERMINAL_OPTIONAL_DETAIL=PASS CASES=3'
      """.trimIndent()
    )
    assertThat(output).contains("HARNESS_TERMINAL_OPTIONAL_DETAIL=PASS CASES=3")
  }

  @Test
  fun postgresDCookieDiagnosticCannotBecomeASuccessSignalEvenWithZeroExit() {
    val output = runRailPowerShell(
      """
      §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock 'Lifecycle'
      §script:DPhase='integration'; §script:DOperation='child-drain'
      §script:DRuntimeSha256='3'*64; §script:DFrontendRuntimeSha256='4'*64
      §facts=[ordered]@{}
      foreach (§key in @('bootstrapStatus','bootstrapState','continuityStatus','continuityState','loginStatus','loginCode',
          'authenticatedStatus','authenticatedState','meStatus','meCode','emittedCount','emittedMask','acceptedCount','acceptedMask',
          'continuity','rotation','roleMatches','privacyScans','privacyViolations','lostObservations')) { §facts[§key]=§null }
      §facts.bootstrapStatus=503
      §frame=[ordered]@{schemaVersion=1;runId=§RunId;objectSha=§ReviewedObjectSha256;runtimeSha=§script:DRuntimeSha256;frontendSha=§script:DFrontendRuntimeSha256
        diagnostic=[ordered]@{schemaVersion=1;source='BROWSER';step='BOOTSTRAP_RESPONSE';lastCompleted=§null;reason='HTTP_STATUS';metric=§null;facts=§facts}}
      §line='M1D_COOKIE_DIAGNOSTIC '+(ConvertTo-Json §frame -Depth 8 -Compress)+[char]10
      # Only process/stream boundary is doubled; no real process or operational
      # receipt is needed to prove that a diagnostic cannot authorize progress.
      §process=[pscustomobject]@{StandardOutput=[IO.StringReader]::new(§line);StandardError=[IO.StringReader]::new('');HasExited=§true;ExitCode=0;ActiveProcessCount=0}
      try {
        §script:DChildren=@{BROWSER_COOKIE=(New-M1DDrain §process 'BROWSER_COOKIE' §null)}
        §stop=§null
        try { [void](Wait-M1DBrowserReceipt 'cookie') } catch { §stop=Get-M1BStopCode §_ }
        if (§stop -cne 'D_BROWSER_RUNNER_FAILED') { throw 'COOKIE_DIAGNOSTIC_DID_NOT_BLOCK_SUCCESS' }
        §child=§script:DChildren.BROWSER_COOKIE
        if (-not §child.OutEnded -or -not §child.ErrEnded -or §child.Signals.Count -ne 0 -or §child.Failures.Count -ne 0) { throw 'DIAGNOSTIC_MISTAKEN_FOR_CONTROL_OR_DRAIN_FAILURE' }
        if (§script:DCookieDiagnostic.diagnostic.facts.bootstrapStatus -ne 503) { throw 'COOKIE_DETAIL_LOST' }
        if (§script:DFailures.Count -ne 0) { throw 'COOKIE_DETAIL_CREATED_STOP_CASCADE' }
        'COOKIE_DIAGNOSTIC_ZERO_EXIT_REJECTED_WITH_COMPLETE_DRAIN'
      } finally { §process.StandardOutput.Dispose(); §process.StandardError.Dispose(); §script:DCampaignClock.Stop() }
      """.trimIndent()
    )
    assertThat(output).contains("COOKIE_DIAGNOSTIC_ZERO_EXIT_REJECTED_WITH_COMPLETE_DRAIN")
  }

  @Test
  fun postgresDCookiePrivacyV2IsClosedAndLegacyRemainsUnenriched() {
    val output = runRailPowerShell(
      """
      §Mode='Lifecycle';§LifecycleAction='Run';Start-M1DClock Lifecycle
      §script:DPhase='integration';§script:DOperation='child-drain'
      §script:DRuntimeSha256='3'*64;§script:DFrontendRuntimeSha256='4'*64
      §facts=[ordered]@{}
      foreach(§key in @('bootstrapStatus','bootstrapState','continuityStatus','continuityState','loginStatus','loginCode','authenticatedStatus','authenticatedState','meStatus','meCode','emittedCount','emittedMask','acceptedCount','acceptedMask','continuity','rotation','roleMatches','privacyScans','privacyViolations','lostObservations')){§facts[§key]=§null}
      §facts.privacyScans=2;§facts.privacyViolations=2;§facts.lostObservations=0
      §frame=[ordered]@{schemaVersion=1;runId=§RunId;objectSha=§ReviewedObjectSha256;runtimeSha=§script:DRuntimeSha256;frontendSha=§script:DFrontendRuntimeSha256
        diagnostic=[ordered]@{schemaVersion=2;source='BROWSER';step='AUTHENTICATED_PRIVACY';lastCompleted='ROTATION';reason='PRIVACY';metric=§null;facts=§facts;firstPrivacyViolation=§null}}
      function Read-FixtureFrame(§Frame){return Read-M1DCookieDiagnosticLine ('M1D_COOKIE_DIAGNOSTIC '+(ConvertTo-Json §Frame -Depth 10 -Compress))}
      §accepted=Read-FixtureFrame §frame
      if(§null -ne §accepted.diagnostic.firstPrivacyViolation){throw 'MISSING_CATEGORY_INVENTED'}
      §triples=[Collections.Generic.List[object]]::new()
      foreach(§surface in @('DOM','FORM_FIELD','URL','DOCUMENT_COOKIE','LOCAL_STORAGE','SESSION_STORAGE','INDEXED_DB','CONSOLE','CHANNEL','AMBIGUOUS')){
        foreach(§value in @('SESSION_COOKIE','CSRF_TOKEN','ACTOR_KEY','USER_ID','SUBJECT','TENANT_ID','MEMBERSHIP_ID','ACTOR_ID','AMBIGUOUS')){
          §triples.Add([ordered]@{rule='PROTECTED_VALUE_MATCH';surface=§surface;valueCategory=§value})
        }
      }
      §triples.Add([ordered]@{rule='AUTHORIZATION_HEADER';surface='REQUEST_HEADERS';valueCategory='NONE'})
      §triples.Add([ordered]@{rule='TENANT_SESSION_HEADER';surface='REQUEST_HEADERS';valueCategory='TENANT_ID'})
      §triples.Add([ordered]@{rule='AUTHORIZATION_AND_TENANT_SESSION_HEADERS';surface='REQUEST_HEADERS';valueCategory='AMBIGUOUS'})
      §triples.Add([ordered]@{rule='CHANNEL_SHAPE';surface='CHANNEL';valueCategory='NONE'})
      foreach(§triple in §triples){
        §frame.diagnostic.firstPrivacyViolation=§triple;§accepted=Read-FixtureFrame §frame
        foreach(§field in @('rule','surface','valueCategory')){if(§accepted.diagnostic.firstPrivacyViolation.§field -cne §triple[§field]){throw 'PRIVACY_CATEGORY_CHANGED'}}
      }
      §frame.diagnostic.firstPrivacyViolation=[ordered]@{rule='PROTECTED_VALUE_MATCH';surface='DOM';valueCategory='TENANT_ID'}
      §template=ConvertTo-Json §frame -Depth 10 -Compress;§rejected=0
      foreach(§field in @('rule','surface','valueCategory')){
        §exact=§frame.diagnostic.firstPrivacyViolation[§field]
        foreach(§invalid in @((§exact.ToLowerInvariant()),(§exact+' '),(§exact+"`n"),(§exact+[char]0),'private-category',§null,42,@(§exact),[pscustomobject]@{value=§exact})){
          §candidate=ConvertFrom-Json §template;§candidate.diagnostic.firstPrivacyViolation.§field=§invalid
          §stop='NONE';try{[void](Read-FixtureFrame §candidate)}catch{§stop=Get-M1BStopCode §_}
          if(§stop -ceq 'NONE'){throw 'OPEN_PRIVACY_CATEGORY_ACCEPTED'};§rejected++
        }
      }
      foreach(§case in @('v2-missing','v1-with-detail','unknown-version','detail-extra','detail-missing','detail-array','authorization-value','authorization-surface','tenant-value','combined-value','channel-surface','protected-none','protected-header')){
        §candidate=ConvertFrom-Json §template
        switch(§case){
          'v2-missing'{§candidate.diagnostic.PSObject.Properties.Remove('firstPrivacyViolation')}
          'v1-with-detail'{§candidate.diagnostic.schemaVersion=1}
          'unknown-version'{§candidate.diagnostic.schemaVersion=3}
          'detail-extra'{§candidate.diagnostic.firstPrivacyViolation | Add-Member NoteProperty private 'private-value'}
          'detail-missing'{§candidate.diagnostic.firstPrivacyViolation.PSObject.Properties.Remove('surface')}
          'detail-array'{§candidate.diagnostic.firstPrivacyViolation=@(§candidate.diagnostic.firstPrivacyViolation)}
          'authorization-value'{§candidate.diagnostic.firstPrivacyViolation.rule='AUTHORIZATION_HEADER';§candidate.diagnostic.firstPrivacyViolation.surface='REQUEST_HEADERS'}
          'authorization-surface'{§candidate.diagnostic.firstPrivacyViolation.rule='AUTHORIZATION_HEADER';§candidate.diagnostic.firstPrivacyViolation.valueCategory='NONE'}
          'tenant-value'{§candidate.diagnostic.firstPrivacyViolation.rule='TENANT_SESSION_HEADER';§candidate.diagnostic.firstPrivacyViolation.surface='REQUEST_HEADERS';§candidate.diagnostic.firstPrivacyViolation.valueCategory='NONE'}
          'combined-value'{§candidate.diagnostic.firstPrivacyViolation.rule='AUTHORIZATION_AND_TENANT_SESSION_HEADERS';§candidate.diagnostic.firstPrivacyViolation.surface='REQUEST_HEADERS'}
          'channel-surface'{§candidate.diagnostic.firstPrivacyViolation.rule='CHANNEL_SHAPE';§candidate.diagnostic.firstPrivacyViolation.valueCategory='NONE'}
          'protected-none'{§candidate.diagnostic.firstPrivacyViolation.valueCategory='NONE'}
          'protected-header'{§candidate.diagnostic.firstPrivacyViolation.surface='REQUEST_HEADERS'}
        }
        §stop='NONE';try{[void](Read-FixtureFrame §candidate)}catch{§stop=Get-M1BStopCode §_}
        if(§stop -ceq 'NONE'){throw ('INVALID_PRIVACY_COMBINATION_ACCEPTED_'+§case)};§rejected++
      }
      function Get-M1DNamespaceIdentity {return 'OFFLINE_PRIVACY_NAMESPACE'}
      §tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath());§root=Join-Path §tempBase ('m1d-privacy-v2-'+[Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      try{
        foreach(§version in @(1,2)){
          §candidate=ConvertFrom-Json §template;§candidate.diagnostic.schemaVersion=§version
          if(§version -eq 1){§candidate.diagnostic.PSObject.Properties.Remove('firstPrivacyViolation')}
          §line='M1D_COOKIE_DIAGNOSTIC '+(ConvertTo-Json §candidate -Depth 10 -Compress)+[char]10
          §process=[pscustomobject]@{StandardOutput=[IO.StringReader]::new(§line);StandardError=[IO.StringReader]::new('');HasExited=§true;ExitCode=0;ActiveProcessCount=0}
          try{
            §script:DCookieDiagnostic=§null;§script:DChildren=@{BROWSER_COOKIE=(New-M1DDrain §process 'BROWSER_COOKIE' §null)}
            §stop='NONE';try{[void](Wait-M1DBrowserReceipt cookie)}catch{§stop=Get-M1BStopCode §_}
            if(§stop -cne 'D_BROWSER_RUNNER_FAILED' -or §script:DCookieDiagnostic.diagnostic.schemaVersion -ne §version){throw 'PRIVACY_DIAGNOSTIC_BECAME_SUCCESS_OR_WAS_LOST'}
            §script:DRunRoot=Join-Path §root ([string]§version);[void][IO.Directory]::CreateDirectory(§script:DRunRoot)
            [void](Write-M1DReceipt campaign ([ordered]@{runtimeSha256=§script:DRuntimeSha256;frontendRuntimeSha256=§script:DFrontendRuntimeSha256}))
            [void](Write-M1DReceipt terminal ([ordered]@{campaignResult='FAIL';cookieDiagnostic=§script:DCookieDiagnostic}))
            §read=(Read-M1DReceipt terminal).payload.cookieDiagnostic
            if((ConvertTo-Json §read -Depth 10 -Compress) -cne (ConvertTo-Json §candidate -Depth 10 -Compress)){throw 'PRIVACY_TERMINAL_ROUND_TRIP_CHANGED'}
            if(§version -eq 1 -and §read.diagnostic.PSObject.Properties.Name -ccontains 'firstPrivacyViolation'){throw 'LEGACY_PRIVACY_ENRICHED'}
          }finally{§process.StandardOutput.Dispose();§process.StandardError.Dispose()}
        }
      }finally{
        if(-not §root.StartsWith(§tempBase,[StringComparison]::OrdinalIgnoreCase)-or-not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-privacy-v2-')){throw 'PRIVACY_FIXTURE_PATH_INVALID'}
        [IO.Directory]::Delete(§root,§true)
      }
      'M1D_COOKIE_PRIVACY_V2_CLOSED=PASS VALID='+§triples.Count+' REJECTED='+§rejected
      """.trimIndent()
    )
    assertThat(output).contains("M1D_COOKIE_PRIVACY_V2_CLOSED=PASS VALID=94")
    assertThat(output).doesNotContain("private-")
    println(output.trim())
  }
  @ParameterizedTest
  @ValueSource(strings = ["gradle-a", "gradle-b", "gradle-c", "psql", "other-a", "other-b", "other-c", "contexts"])
  @Tag("windows-only")
  fun postgresDInternalFinalizersPreserveFirstFailureThroughLifecycle(group: String) {
    val output = runRailPowerShell(
      """
      # Synthetic OS/DB boundaries only; the reader, all three finalizers, scanner,
      # collector, cessation validator, lifecycle and terminal readback are real.
      Add-Type -TypeDefinition @'
      using System;
      using System.IO;
      using System.Collections;
      using System.Threading.Tasks;
      public sealed class FixtureProjectionFault : IOException {
        public FixtureProjectionFault() : base("offline-private-projection") {}
        public override IDictionary Data { get { throw new FormatException("offline-private-data"); } }
      }
      public sealed class FixtureFaultReader : StringReader {
        readonly Exception failure;
        public FixtureFaultReader(bool projection) : base("") {
          failure = projection ? (Exception)new FixtureProjectionFault() : new IOException("offline-private-reader");
        }
        public override Task<int> ReadAsync(char[] buffer, int index, int count) {
          var task = new TaskCompletionSource<int>(); task.SetException(failure); return task.Task;
        }
      }
      '@
      §Campaign='D'; §Mode='Lifecycle'; §LifecycleAction='Run'
      §PreflightAuthorizationRecordId='AUTH-FIXTURE-PREFLIGHT'
      §SensitiveAuthorizationRecordId='AUTH-FIXTURE-FINALIZERS'
      §container=Join-Path ([IO.Path]::GetTempPath()) ('m1d-finalizers-'+[Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§container); §script:EvidenceBaseRoot=§container
      # The shared runner intentionally removes JAVA_HOME. This inert fixture file
      # satisfies preparation only; Start-M1DContainedChild below never executes it.
      §env:JAVA_HOME=Join-Path §container 'inert-java'
      [void][IO.Directory]::CreateDirectory((Join-Path §env:JAVA_HOME 'bin'))
      [IO.File]::WriteAllText((Join-Path §env:JAVA_HOME 'bin\java.exe'),'NOT_EXECUTABLE')
      §realWriter=(Get-Command Write-M1DReceipt).ScriptBlock
      §realReadiness=(Get-Command Invoke-M1BReadiness).ScriptBlock
      # Finalizer cases substitute cache selection only; cache tests use the real guards.
      function Initialize-M1DGradleCacheReuse { param(§Root,§Preflight) }
      function Assert-M1DGradleCacheReuse { param(§Path) }
      function Get-M1DGradleCachePath { param(§Root) Join-Path §Root 'fixture-cache' }
      function Get-M1DNamespaceIdentity { '00000000000000000000000000000001:0000000000000001:1' }
      function Assert-M1BInvocation { §script:scenarioRoot }
      function Enter-M1BRunLock { param(§Root) [pscustomobject]@{ synthetic=§true } }
      function Exit-M1BRunLock { param(§Lock) §script:events.Add('lock-release') }
      function Assert-M1BExecutionState { param(§Root,§Phase) [pscustomobject]@{ Baseline=[pscustomobject]@{synthetic=§true} } }
      function Read-M1BPreflightManifest {
        param(§Root,§RunId,§Object,§Authorization,§Baseline)
        if (§script:fixtureClock -eq §null) {
          §script:DCampaignClock.Stop()
          §script:fixtureClock=[pscustomobject]@{ElapsedMilliseconds=0L}
          §script:DCampaignClock=§script:fixtureClock
        }
        [pscustomobject]@{Sha256=('3'*64);Value=[pscustomobject]@{
          campaignStartTimestamp=[string][Diagnostics.Stopwatch]::GetTimestamp();stopwatchFrequency=[string][Diagnostics.Stopwatch]::Frequency
          machine=[Environment]::MachineName;namespaceIdentity=(Get-M1DNamespaceIdentity)
          runtimeSha256=('2'*64);frontendRuntimeSha256=('4'*64);psql=[pscustomobject]@{sha256=§ExpectedPsqlSha256}
          observation=[pscustomobject]@{clusterSystemIdentifier='999';currentRoleOid=10;maintenanceDatabaseOid=11;hbaRuleNumber=1}
        }}
      }
      function Invoke-M1BReadiness { param(§Root,§Phase,§Id,§Object) & §realReadiness §Root §Phase §Id §Object }
      function Get-M1DFrontendRuntimeSha256 { '4'*64 }
      function Assert-M1BInteractiveConsole { }
      function Assert-M1BNoCredentialChannels { }
      function Assert-M1BPsqlBinary { [pscustomobject]@{Path='C:\fixture\never-executed.exe';Sha256=§ExpectedPsqlSha256;FileVersion='fixture';ProductVersion='fixture'} }
      function New-M1BRunnerSecret { [pscustomobject]@{PasswordBytes=[byte[]]@(1,2);Password='offline-fixed-runner-marker'} }
      function New-M1BRandomSalt { ,([byte[]]@(3,4)) }
      function New-M1BScramSha256Verifier { param(§Password,§Salt) 'synthetic-verifier' }
      function Get-Process { param(§Id,§ErrorAction) §null }
      function Get-M1DListenerPorts { @() }
      function Get-M1DRecordedJobCount { param(§Name) §role=§Name.Substring(§Name.LastIndexOf('.')+1); if(§script:processes.ContainsKey(§role)){§script:processes[§role].ActiveProcessCount}else{-1} }
      function Write-M1DReceipt {
        param(§Name,§Payload)
        if(§Name.EndsWith('-stopped')) {
          §script:events.Add('receipt:'+§Payload.jobName.Substring(§Payload.jobName.LastIndexOf('.')+1))
          if(§Payload.jobName.EndsWith('.'+§script:faultRole) -and §script:scenario -match 'receipt|multiple'){throw [UnauthorizedAccessException]::new('offline-private-receipt')}
        }
        & §realWriter §Name §Payload
      }
      function Start-M1DContainedChild {
        param(§StartInfo,§Role,§ArgumentFile)
        §script:events.Add('start:'+§Role)
        §runtime='2'*64
        §text="M1B_POSTGRES_RAIL_READINESS=PASS`nM1B_POSTGRES_RAIL_DATABASE_EXECUTION=NONE`nM1B_POSTGRES_RAIL_RUNTIME_SHA256=§runtime`nM1D_INTEGRATED_MANIFEST_SHA256=§('1'*64)`nM1B_POSTGRES_RAIL_RUNTIME_SHA256_VERIFIED=§runtime`nM1B_POSTGRES_RAIL_RUNTIME_SHA256_REVALIDATED=§runtime`nM1B_POSTGRES_RAIL_TARGETED=PASS`nM1B_POSTGRES_RAIL_FULL=PASS`n"
        §reader=[IO.StringReader]::new(§text)
        if(§Role -ceq §script:faultRole -and (§script:scenario -match 'initial' -or §script:scenario -ceq 'diagnostic-fault')){§reader=[FixtureFaultReader]::new((§script:scenario -ceq 'diagnostic-fault'))}
        §p=[pscustomobject]@{Role=§Role;Id=(2000000000+§script:processes.Count);CreationTimeUtcTicks='638000000000000000';JobName=('Local\Ritomer.M1D.'+§RunId+'.'+§Role);HasExited=§true;ActiveProcessCount=0;ExitCode=0;StartInfo=§StartInfo;StandardOutput=§reader;StandardError=[IO.StringReader]::new('');StandardInput=[IO.StringWriter]::new();Disposed=§false}
        §p | Add-Member ScriptMethod WaitForExit { }
        §p | Add-Member ScriptMethod TerminateTreeAndWait {
          param(§Budget) §script:events.Add('terminate:'+§this.Role)
          if(§this.Role -ceq §script:faultRole -and §script:scenario -match 'termination-false'){§this.ActiveProcessCount=1;return §false}
          if(§this.Role -ceq §script:faultRole -and §script:scenario -match 'termination-throw'){§this.ActiveProcessCount=1;throw [IO.IOException]::new('offline-private-termination')}
          §this.HasExited=§true; §this.ActiveProcessCount=0; return §true
        }
        §p | Add-Member ScriptMethod Dispose {
          §script:events.Add('dispose:'+§this.Role);§this.Disposed=§true
          §this.StandardOutput.Dispose();§this.StandardError.Dispose();§this.StandardInput.Dispose()
          if(§this.Role -ceq §script:faultRole -and §script:scenario -match 'dispose|multiple'){throw [IO.IOException]::new('offline-private-dispose')}
        }
        if(§Role -ceq §script:faultRole -and (§script:scenario -match 'initial' -or §script:scenario -ceq 'diagnostic-fault')){§p.HasExited=§false}
        §script:processes[§Role]=§p
        §stage=if(§LifecycleAction -ceq 'CleanupOnly'){'recovery'}elseif(§Mode -ceq 'Preflight'){'preflight'}else{'lifecycle'}
        §name='launch-'+§stage+'-'+§Role
        [void](Write-M1DReceipt (§name+'-intent') ([ordered]@{role=§Role;binaryPath='C:\fixture\never-executed.exe';binarySha256=('a'*64);commandSha256=('b'*64);argumentFileSha256='NONE'}))
        [void](Write-M1DReceipt (§name+'-confined') ([ordered]@{role=§Role;processId=§p.Id;creationTimeUtcTicks=§p.CreationTimeUtcTicks;jobName=§p.JobName;binaryPath='C:\fixture\never-executed.exe';binarySha256=('a'*64);commandSha256=('b'*64);argumentFileSha256='NONE';confinedBeforeResume=§true}))
        if(§Role -ceq 'TARGETED' -and §script:scenario -ceq 'timeout-scan') {§p.HasExited=§false;§script:fixtureClock.ElapsedMilliseconds=§script:DPhaseDeadline}
        if(§Role -ceq 'TARGETED' -and §script:scenario -cin @('timeout-scan','scan-only')) {
          §blocked=Join-Path §script:scenarioRoot 'locked-fixture.bin';[IO.File]::WriteAllBytes(§blocked,[byte[]]@(1,2,3))
          §script:scanLock=[IO.File]::Open(§blocked,[IO.FileMode]::Open,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
        }
        Set-M1DDiagnosticOperation 'native-launch'; return §p
      }
      function Invoke-M1BProvisionPsql {
        param(§Root,§Verifier,§Provenance,§Cluster,§Hba,§Admin,§Maintenance)
        [void](Invoke-M1BDirectPsql -Phase Provision -SqlText 'OFFLINE NOT SQL' -NeutralRoot §Root)
        [pscustomobject]@{DatabaseOid=19;RoleOid=20;PostmasterStartUnixMicros='1789722000123456';PsqlSha256=§ExpectedPsqlSha256;StructuredOutputSha256=('5'*64)}
      }
      function Invoke-M1BCleanupPsql {
        param(§Root,§Provenance,§Run,§Cluster,§Database,§Role,§Admin,§Maintenance)
        §script:events.Add('cleanup-boundary')
        [void](Invoke-M1BDirectPsql -Phase Cleanup -SqlText 'OFFLINE NOT SQL' -NeutralRoot §Root)
        [pscustomobject]@{PsqlSha256=§ExpectedPsqlSha256;StructuredOutputSha256=('6'*64)}
      }
      function Invoke-M1DIntegrated {
        param(§Readiness,§Provision,§Password,§Cluster)
        [void](Write-M1DReceipt 'integrated' ([ordered]@{synthetic=§true}))
        [void](Write-M1DReceipt 'stopped' ([ordered]@{synthetic=§true}))
      }
      §results=[Collections.Generic.List[object]]::new()
      §cases=switch('$group') {
        'gradle-a' { @('timeout-scan','gradle-initial-termination-false') }
        'gradle-b' { @('gradle-initial-termination-throw','gradle-initial-receipt') }
        'gradle-c' { @('gradle-initial-dispose','gradle-initial-multiple') }
        'psql' { @('psql-initial-termination-false','psql-initial-termination-throw','psql-initial-receipt','psql-initial-dispose','psql-initial-multiple') }
        'other-a' { @('gradle-only-receipt','psql-only-dispose','scan-only') }
        'other-b' { @('diagnostic-fault','nominal') }
        'other-c' { @('full-initial-dispose','psql-cleanup-initial-dispose') }
        'contexts' { @('c1-readiness-only-dispose','c2-readiness-only-dispose','preflight-psql-only-dispose','recovery-psql-only-dispose') }
      }
      try {
        foreach(§scenario in §cases) {
          §script:scenario=§scenario;§script:faultRole=if(§scenario -like 'psql-cleanup*'){'ADMIN_PSQL_CLEANUP'}elseif(§scenario -like 'psql*'){'ADMIN_PSQL_PROVISION'}elseif(§scenario -like 'full*'){'FULL'}else{'TARGETED'}
          §script:scenarioRoot=Join-Path §container §scenario;[void][IO.Directory]::CreateDirectory(§script:scenarioRoot)
          §script:DQuarantinePath=Join-Path §script:scenarioRoot '.m1d-unreleased.json'
          §script:DCampaignClock=§null;§script:fixtureClock=§null;§script:DChildren=@{};§script:processes=@{};§script:scanLock=§null
          §script:PsqlProcessStarts=@{Preflight=0;Provision=0;Cleanup=0};§script:events=[Collections.Generic.List[string]]::new()
          if('$group' -ceq 'contexts') {
            §Mode=if(§scenario -match '^(c1|preflight)'){'Preflight'}else{'Lifecycle'}
            §LifecycleAction=if(§scenario -like 'recovery*'){'CleanupOnly'}else{'Run'}
            §kind=if(§LifecycleAction -ceq 'CleanupOnly'){'CleanupOnly'}else{§Mode}
            Start-M1DClock §kind;§script:DRunRoot=§script:scenarioRoot
            §script:faultRole=if(§scenario -match 'readiness'){'READINESS'}elseif(§Mode -ceq 'Preflight'){'ADMIN_PSQL_PREFLIGHT'}else{'ADMIN_PSQL_CLEANUP'}
            §code='NONE';§sharedResult=§null
            try {
              if(§scenario -match 'readiness') {Enter-M1DPhase readiness;§sharedResult=Invoke-M1BReadiness §script:scenarioRoot 'shared-readiness' §RunId §ReviewedObjectSha256}
              else {§phase=if(§Mode -ceq 'Preflight'){'Preflight'}else{'Cleanup'};Enter-M1DPhase $(if(§phase -ceq 'Cleanup'){'cleanup'}else{'provision'});§sharedResult=Invoke-M1BDirectPsql -Phase §phase -SqlText 'OFFLINE NOT SQL' -NeutralRoot (Join-Path §script:scenarioRoot 'psql')}
            } catch {§code=Get-M1BStopCode §_}
            §diag=Get-M1DDiagnostics;§p=§script:processes[§script:faultRole];§issues=@()
            if(§code -cne 'UNEXPECTED_FAILURE' -or §null -ne §sharedResult -or §diag.primary.category -cne 'IO_FAILURE' -or §diag.secondary.Count -ne 0 -or -not §p.Disposed -or §p.StartInfo.EnvironmentVariables.Count -ne 0){§issues+= 'SHARED_CONTEXT_FAILURE_LOST'}
            §summary=[pscustomobject]@{scenario=§scenario;stop=§code;diagnostics=§diag;events=@(§script:events.ToArray());issues=§issues}
            §results.Add(§summary);'FC2_CASE '+(ConvertTo-Json §summary -Depth 8 -Compress);continue
          }
          §code='NONE';try{[void](Invoke-M1DLifecycle)}catch{§code=Get-M1BStopCode §_}
          if(§null -ne §script:scanLock){§script:scanLock.Dispose();§script:scanLock=§null}
          if(-not [IO.File]::Exists((Join-Path §script:scenarioRoot 'd-terminal.json'))){'FC2_EARLY '+(ConvertTo-Json ([pscustomobject]@{scenario=§scenario;stop=§code;events=@(§script:events.ToArray());diagnostics=(Get-M1DDiagnostics)}) -Depth 6 -Compress);throw 'FC2_TERMINAL_NOT_REACHED'}
          §terminal=Read-M1DReceipt 'terminal';§diag=§terminal.payload.diagnostics
          §issues=[Collections.Generic.List[string]]::new()
          §nominal=§scenario -ceq 'nominal';§primaryExpected=if(§scenario -ceq 'timeout-scan'){'TIMEOUT'}elseif(§scenario -ceq 'scan-only'){'CONTROLLED_STOP'}elseif(§scenario -ceq 'gradle-only-receipt'){'ACCESS_DENIED'}else{'IO_FAILURE'}
          if(§nominal){if(§code -cne 'NONE' -or §terminal.payload.campaignResult -cne 'PASS' -or §null -ne §diag.primary -or §diag.secondary.Count -ne 0){§issues.Add('NOMINAL_CHANGED')}}
          else {
            if(§code -cne 'D_LIFECYCLE_FAILED_SEE_RECEIPTS' -or §terminal.payload.campaignResult -cne 'FAIL'){§issues.Add('FAIL_NOT_PRESERVED')}
            if(§null -eq §diag.primary -or §diag.primary.category -cne §primaryExpected){§issues.Add('PRIMARY_LOST')}
            §expectedSecondary=if(§scenario -match 'multiple'){2}elseif(§scenario -match 'initial|timeout-scan|diagnostic-fault'){1}else{0}
            if(§scenario -match '^psql(?!-cleanup)'){§expectedSecondary++}
            if(§scenario -match 'termination-' -and §scenario -notmatch '^psql'){§expectedSecondary++}
            if(§scenario -cin @('timeout-scan','scan-only')){§expectedSecondary++}
            if(§diag.secondary.Count -ne §expectedSecondary){§issues.Add('SECONDARY_CARDINALITY')}
            if(§script:faultRole -ceq 'TARGETED' -and §script:events.Contains('start:FULL')){§issues.Add('FULL_AFTER_TARGETED_FAILURE')}
          }
          §failedProcess=§script:processes[§script:faultRole]
          if(§null -ne §failedProcess -and (-not §failedProcess.Disposed -or §failedProcess.StartInfo.EnvironmentVariables.Count -ne 0)){§issues.Add('INDEPENDENT_FINALIZATION_SKIPPED')}
          if(-not §script:events.Contains('lock-release')){§issues.Add('LOCK_RELEASE_SKIPPED')}
          §cleanupBlocked=§scenario -match 'termination-|^psql(?!-cleanup)'
          if(§cleanupBlocked -and (§script:events.Contains('cleanup-boundary') -or -not [IO.File]::Exists(§script:DQuarantinePath))){§issues.Add('CLEANUP_BARRIER_BYPASSED')}
          if(§scenario -match 'multiple' -and (§diag.secondary.Count -lt 2 -or §diag.secondary[0].category -cne 'ACCESS_DENIED' -or §diag.secondary[1].category -cne 'IO_FAILURE')){§issues.Add('SECONDARY_ORDER')}
          §json=ConvertTo-Json §terminal -Depth 12 -Compress
          if(§json.Contains('offline-private') -or §json.Contains('M1DFailureCollector')){§issues.Add('PRIVATE_DIAGNOSTIC_LEAK')}
          §summary=[pscustomobject]@{scenario=§scenario;stop=§code;diagnostics=§diag;events=@(§script:events.ToArray());cleanupVerified=§terminal.payload.cleanupVerified;quarantined=[IO.File]::Exists(§script:DQuarantinePath);issues=@(§issues.ToArray())}
          §results.Add(§summary);'FC2_CASE '+(ConvertTo-Json §summary -Depth 8 -Compress)
          'FC2_TERMINAL '+(ConvertTo-Json ([pscustomobject]@{scenario=§scenario;text=[IO.File]::ReadAllText((Join-Path §script:scenarioRoot 'd-terminal.json'));sidecar=[IO.File]::ReadAllText((Join-Path §script:scenarioRoot 'd-terminal.json.sha256'))}) -Compress)
        }
      } finally {
        if(§null -ne §script:scanLock){§script:scanLock.Dispose()}
        if(-not ([IO.Path]::GetFileName(§container)).StartsWith('m1d-finalizers-') -or -not §container.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase)){throw 'FIXTURE_CLEANUP_BOUNDARY'}
        [IO.Directory]::Delete(§container,§true)
      }
      if(§results.Count -ne §cases.Count -or @(§results | Where-Object {§_.issues.Count -gt 0}).Count -gt 0){throw 'FC2_REGRESSION_FAILED'}
      'M1D_INTERNAL_FINALIZERS=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_INTERNAL_FINALIZERS=PASS")
    assertThat(output).doesNotContain("offline-private", "M1DFailureCollector")
    println(output.trim())
  }

  @Test
  fun postgresDChildDiagnosticsAreClosedAndReadLegacyReceipts() {
    val output = runRailPowerShell(
      """
      function Test-FixtureOrdinal([object]§Actual, [object]§Expected) {
        return (§Actual -is [string] -and §Expected -is [string] -and [string]::Equals(§Actual, §Expected, [System.StringComparison]::Ordinal))
      }
      function Get-FixtureInvalidValues([string]§Exact) {
        §middle=[int][Math]::Floor(§Exact.Length/2)
        §otherCase=§Exact.ToLowerInvariant()
        if (Test-FixtureOrdinal §Exact §otherCase) { §otherCase=§Exact.ToUpperInvariant() }
        return @(
          [pscustomobject]@{name='nul-start';value=([string][char]0+§Exact)},
          [pscustomobject]@{name='nul-middle';value=(§Exact.Substring(0,§middle)+[char]0+§Exact.Substring(§middle))},
          [pscustomobject]@{name='nul-end';value=(§Exact+[char]0)},
          [pscustomobject]@{name='lf';value=(§Exact+"`n")},
          [pscustomobject]@{name='crlf';value=(§Exact+"`r`n")},
          [pscustomobject]@{name='space';value=(§Exact+' ')},
          [pscustomobject]@{name='case';value=§otherCase},
          [pscustomobject]@{name='foreign';value='PRIVATE_UNTRUSTED_VALUE'},
          [pscustomobject]@{name='empty';value=''},
          [pscustomobject]@{name='null';value=§null},
          [pscustomobject]@{name='number';value=42},
          [pscustomobject]@{name='array';value=@(§Exact)},
          [pscustomobject]@{name='coercible-object';value=[Text.StringBuilder]::new(§Exact)}
        )
      }
      function Assert-FixtureDiagnosticRoundTrip([object]§Expected, [object]§Actual) {
        if (§Actual.schemaVersion -ne §Expected.schemaVersion -or §Actual.secondary.Count -ne §Expected.secondary.Count) { throw 'DIAGNOSTIC_ROUND_TRIP_STRUCTURE_CHANGED' }
        §expectedRows=@(§Expected.primary)+@(§Expected.secondary)
        §actualRows=@(§Actual.primary)+@(§Actual.secondary)
        §fields=@('stage','operation','category')
        if (§Expected.schemaVersion -eq 2) { §fields+=@('childRole','control') }
        for (§row=0; §row -lt §expectedRows.Count; §row++) {
          foreach (§field in §fields) {
            if (-not (Test-FixtureOrdinal §actualRows[§row].§field §expectedRows[§row].§field)) { throw 'DIAGNOSTIC_ROUND_TRIP_VALUE_CHANGED' }
          }
        }
      }
      §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock Lifecycle
      try { Stop-M1DChildControl 'HARNESS' 'D_CONTROL_MESSAGE_WRONG_CHANNEL' } catch { [void](Add-M1DFailure §_) }
      try { Stop-M1BRail 'FIXTURE_PRIVATE_ARBITRARY_SUFFIX' } catch { [void](Add-M1DFailure §_) }
      §diagnostics=Get-M1DDiagnostics
      if (§diagnostics.schemaVersion -ne 2 -or -not (Test-FixtureOrdinal §diagnostics.primary.childRole 'HARNESS') -or -not (Test-FixtureOrdinal §diagnostics.primary.control 'D_CONTROL_MESSAGE_WRONG_CHANNEL') -or -not (Test-FixtureOrdinal §diagnostics.secondary[0].control 'UNCLASSIFIED')) { throw 'CHILD_DIAGNOSTICS_NOT_CLOSED' }
      if ((ConvertTo-Json §diagnostics -Depth 5).Contains('FIXTURE_PRIVATE_ARBITRARY_SUFFIX')) { throw 'ARBITRARY_SUFFIX_EXPOSED' }
      §roles=@('SEED','BACKEND','VITE','HARNESS','BROWSER_COOKIE','BROWSER_JOURNEY')
      foreach (§role in §roles) {
        §code='NONE'
        try { Stop-M1DChildControl §role 'D_CONTROL_MESSAGE_WRONG_CHANNEL' } catch {
          §code=Get-M1BStopCode §_
          [void](Add-M1DFailure §_)
        }
        §entry=§script:DFailures[§script:DFailures.Count-1]
        if (-not (Test-FixtureOrdinal §code 'D_CONTROL_MESSAGE_WRONG_CHANNEL') -or -not (Test-FixtureOrdinal §entry.childRole §role) -or -not (Test-FixtureOrdinal §entry.control §code)) { throw 'EXACT_CHILD_ROLE_REJECTED' }
        §accepted=Get-M1DDiagnostics -Failures @(§entry)
        if (-not (Test-FixtureOrdinal §accepted.primary.childRole §role)) { throw 'EXACT_DIAGNOSTIC_ROLE_REJECTED' }
      }
      §invalidRoles=@(Get-FixtureInvalidValues 'HARNESS')+@([pscustomobject]@{name='none';value='NONE'})
      foreach (§case in §invalidRoles) {
        §code='NONE'
        try { Stop-M1DChildControl -Role §case.value -Code 'D_CONTROL_MESSAGE_WRONG_CHANNEL' } catch { §code=Get-M1BStopCode §_ }
        if (-not (Test-FixtureOrdinal §code 'D_DIAGNOSTIC_INVALID')) { throw ('INVALID_STOP_ROLE_ACCEPTED_' + §case.name) }
        §exception=[InvalidOperationException]::new('RITOMER_M1B_CONTROLLED_STOP::D_CONTROL_MESSAGE_WRONG_CHANNEL')
        §exception.Data['M1DChildRole']=§case.value
        try { throw §exception } catch { [void](Add-M1DFailure §_) }
        §entry=§script:DFailures[§script:DFailures.Count-1]
        if (-not (Test-FixtureOrdinal §entry.childRole 'NONE') -or -not (Test-FixtureOrdinal §entry.control 'D_CONTROL_MESSAGE_WRONG_CHANNEL')) { throw ('INVALID_METADATA_ROLE_ATTRIBUTED_' + §case.name) }
        §expectedDiagnostics=Get-M1DDiagnostics
        §decoded=ConvertFrom-Json (ConvertTo-Json §expectedDiagnostics -Depth 5 -Compress)
        Assert-FixtureDiagnosticRoundTrip §expectedDiagnostics §decoded
        if (§case.value -is [string] -and -not (Test-FixtureOrdinal §case.value 'NONE')) {
          foreach (§decodedFailure in (@(§decoded.primary)+@(§decoded.secondary))) {
            if (Test-FixtureOrdinal §decodedFailure.childRole §case.value) { throw ('INVALID_ROLE_EXPOSED_' + §case.name) }
          }
        }
        §probe=[pscustomobject]@{stage='integration';operation='child-drain';category='CONTROLLED_STOP';childRole=§case.value;control='D_CONTROL_MESSAGE_WRONG_CHANNEL'}
        §code='NONE'
        try { §accepted=Get-M1DDiagnostics -Failures @(§probe) } catch { §code=Get-M1BStopCode §_ }
        if (Test-FixtureOrdinal §case.name 'none') {
          if (-not (Test-FixtureOrdinal §code 'NONE') -or -not (Test-FixtureOrdinal §accepted.primary.childRole 'NONE')) { throw 'DIAGNOSTIC_NONE_REJECTED' }
        } elseif (-not (Test-FixtureOrdinal §code 'D_DIAGNOSTIC_INVALID')) { throw ('INVALID_DIAGNOSTIC_ROLE_ACCEPTED_' + §case.name) }
      }
      §diagnostics=Get-M1DDiagnostics
      if (-not (Test-FixtureOrdinal §diagnostics.primary.childRole 'HARNESS') -or -not (Test-FixtureOrdinal §diagnostics.primary.control 'D_CONTROL_MESSAGE_WRONG_CHANNEL') -or -not (Test-FixtureOrdinal §diagnostics.secondary[0].control 'UNCLASSIFIED') -or §diagnostics.secondary.Count -ne (1+§roles.Count+§invalidRoles.Count)) { throw 'DIAGNOSTIC_ORDER_OR_CARDINALITY_LOST' }
      for (§index=0; §index -lt §roles.Count; §index++) {
        if (-not (Test-FixtureOrdinal §diagnostics.secondary[§index+1].childRole §roles[§index])) { throw 'SECONDARY_ROLE_ORDER_LOST' }
      }
      §allowed=[ordered]@{
        stage=@('readiness','provision','seed','backend','integration','stop','targeted','full','cleanup','controls')
        operation=@('initialization','provision','post-provision-state','integrated-entry','ports','phase','runtime-manifest','runtime-structure','runtime-files','child-environment','java-arguments','child-start-info','launch-identity','launch-intent','native-launch','child-drain','integrated-observations','stop-barrier','targeted-tests','full-tests','execution-state','forced-stop','stop-terminate','stop-attestation','stop-root-read','stop-root-wait','stop-job-read','stop-job-wait','stop-drain','stop-receipt','stop-release','stop-job-terminate','stop-job-close','stop-root-release-wait','stop-stdout-close','stop-stderr-close','stop-stdin-close','stop-process-close','cleanup','cleanup-publication','secret-scan','terminal-controls','terminal-publication','lock-release')
        category=@('UNEXPECTED_FAILURE','ACCESS_DENIED','PATH_NOT_FOUND','PATH_TOO_LONG','IO_FAILURE','PARAMETER_BINDING','INVALID_VALUE','TIMEOUT','CONTROLLED_STOP')
        childRole=@('SEED','BACKEND','VITE','HARNESS','BROWSER_COOKIE','BROWSER_JOURNEY','NONE')
        control=@('D_CHILD_OUTPUT_LIMIT_EXCEEDED','RUNNER_SECRET_OUTPUT_CONTAMINATION','D_CONTROL_MESSAGE_REJECTED','D_PREMATURE_HARNESS_STOP','D_PREMATURE_BACKEND_STOP','D_UNTERMINATED_CONTROL_MESSAGE','D_CONTROL_MESSAGE_WRONG_CHANNEL','D_CHILD_STDOUT_READ_FAILED','D_CHILD_STDERR_READ_FAILED','D_UNEXPECTED_LIVE_CHILD','D_TREE_STOP_UNPROVEN','D_TERMINATION_BUDGET_EXHAUSTED','D_STREAM_STOP_UNPROVEN','D_CHILD_STOP_NOT_ATTESTED','D_INTEGRATED_CHILD_DISAPPEARED','D_REQUIRED_RESULT_ABSENT','D_CHILD_NONZERO_EXIT','D_BROWSER_RUNNER_FAILED','D_STOP_BARRIER_FAILED','D_CHILD_FINALIZATION_FAILED','PSQL_PREFLIGHT_EXIT_NONZERO','PSQL_PROVISION_EXIT_NONZERO','PSQL_CLEANUP_EXIT_NONZERO','UNCLASSIFIED')
      }
      foreach (§operation in §allowed.operation) {
        Set-M1DDiagnosticOperation §operation
        if (-not (Test-FixtureOrdinal §script:DOperation §operation)) { throw 'EXACT_OPERATION_SETTER_CHANGED' }
      }
      Set-M1DDiagnosticOperation 'child-drain'
      Enter-M1DPhase 'integration'
      foreach (§control in §allowed.control) {
        if (-not (Test-FixtureOrdinal (Get-M1DControlCode §control) §control)) { throw 'EXACT_CONTROL_PROJECTION_CHANGED' }
        §code='NONE'; §result='NONE'
        try { Stop-M1DChildControl 'HARNESS' §control } catch { §code=Get-M1BStopCode §_; §result=Add-M1DFailure §_ }
        §expected=§control
        if (Test-FixtureOrdinal §control 'UNCLASSIFIED') { §expected='D_DIAGNOSTIC_INVALID' }
        §entry=§script:DFailures[§script:DFailures.Count-1]
        if (-not (Test-FixtureOrdinal §code §expected) -or -not (Test-FixtureOrdinal §result 'D_CONTROLLED_FAILURE') -or -not (Test-FixtureOrdinal §entry.control §control)) { throw 'CONTROL_STOP_OR_FAILURE_PROJECTION_CHANGED' }
      }
      foreach (§case in @(Get-FixtureInvalidValues 'D_CONTROL_MESSAGE_WRONG_CHANNEL')) {
        if (-not (Test-FixtureOrdinal (Get-M1DControlCode §case.value) 'UNCLASSIFIED')) { throw ('INVALID_CONTROL_NOT_PROJECTED_' + §case.name) }
        §code='NONE'
        try { Stop-M1DChildControl -Role 'HARNESS' -Code §case.value } catch { §code=Get-M1BStopCode §_ }
        if (-not (Test-FixtureOrdinal §code 'D_DIAGNOSTIC_INVALID')) { throw ('INVALID_STOP_CONTROL_ACCEPTED_' + §case.name) }
        if (§case.value -is [string]) {
          §exception=[InvalidOperationException]::new('RITOMER_M1B_CONTROLLED_STOP::'+§case.value)
          §result='NONE'
          try { throw §exception } catch { §result=Add-M1DFailure §_ }
          §entry=§script:DFailures[§script:DFailures.Count-1]
          if ((-not (Test-FixtureOrdinal §result 'D_CONTROLLED_FAILURE') -and -not (Test-FixtureOrdinal §result 'UNEXPECTED_FAILURE')) -or -not (Test-FixtureOrdinal §entry.control 'UNCLASSIFIED')) { throw ('INVALID_EXCEPTION_CONTROL_RETAINED_' + §case.name) }
        }
      }
      §current=Get-M1DDiagnostics
      §decoded=ConvertFrom-Json (ConvertTo-Json §current -Depth 5 -Compress)
      Assert-FixtureDiagnosticRoundTrip §current §decoded
      for (§index=0; §index -lt §allowed.control.Count; §index++) {
        §entry=§decoded.secondary[§diagnostics.secondary.Count+§index]
        if (-not (Test-FixtureOrdinal §entry.control §allowed.control[§index])) { throw 'SECONDARY_CONTROL_ORDER_LOST' }
      }
      if (-not (Test-FixtureOrdinal §decoded.primary.childRole 'HARNESS') -or §decoded.secondary.Count -ne (§diagnostics.secondary.Count+§allowed.control.Count+9)) { throw 'FIRST_FAILURE_OR_SECONDARY_COUNT_CHANGED' }
      foreach (§case in @(Get-FixtureInvalidValues 'D_CONTROL_MESSAGE_WRONG_CHANNEL')) {
        if (§case.value -is [string]) {
          foreach (§entry in (@(§decoded.primary)+@(§decoded.secondary))) {
            if (Test-FixtureOrdinal §entry.control §case.value) { throw 'INVALID_CONTROL_EXPOSED_AFTER_JSON' }
          }
        }
      }
      §tempBase=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §root=Join-Path §tempBase ('m1d-diagnostics-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      §script:DRunRoot=§root
      # This fixture tests JSON/schema compatibility, not Windows namespace identity.
      function Get-M1DNamespaceIdentity { return 'OFFLINE_DIAGNOSTIC_NAMESPACE' }
      try {
        §legacy=[pscustomobject]@{stage='integration';operation='child-drain';category='CONTROLLED_STOP'}
        §v1=Get-M1DDiagnostics -Failures @(§legacy) -SchemaVersion 1
        [void](Write-M1DReceipt 'terminal' ([ordered]@{diagnostics=§v1}))
        §read=Read-M1DReceipt 'terminal'
        if (§read.payload.diagnostics.schemaVersion -ne 1 -or -not (Test-FixtureOrdinal §read.payload.diagnostics.primary.operation 'child-drain')) { throw 'LEGACY_DIAGNOSTIC_REJECTED' }
        Assert-FixtureDiagnosticRoundTrip §v1 §read.payload.diagnostics
        §script:DRunRoot=Join-Path §root 'v2'
        [void][IO.Directory]::CreateDirectory(§script:DRunRoot)
        [void](Write-M1DReceipt 'terminal' ([ordered]@{diagnostics=§diagnostics}))
        §read=Read-M1DReceipt 'terminal'
        if (§read.payload.diagnostics.schemaVersion -ne 2) { throw 'CURRENT_DIAGNOSTIC_REJECTED' }
        Assert-FixtureDiagnosticRoundTrip §diagnostics §read.payload.diagnostics
        §counts=[ordered]@{}
        foreach (§field in §allowed.Keys) {
          §counts[§field]=[ordered]@{exact=0;invalid=0;readerRejected=0}
          §schemas=@(2)
          if (@('stage','operation','category') -contains §field) { §schemas=@(1,2) }
          foreach (§schema in §schemas) {
            foreach (§exact in §allowed[§field]) {
              §probe=[pscustomobject][ordered]@{stage='integration';operation='child-drain';category='CONTROLLED_STOP'}
              if (§schema -eq 2) { Add-Member -InputObject §probe -NotePropertyName childRole -NotePropertyValue 'HARNESS'; Add-Member -InputObject §probe -NotePropertyName control -NotePropertyValue 'D_CONTROL_MESSAGE_WRONG_CHANNEL' }
              §probe.§field=§exact
              §accepted=Get-M1DDiagnostics -Failures @(§probe) -SchemaVersion §schema
              §decoded=ConvertFrom-Json (ConvertTo-Json §accepted -Depth 5 -Compress)
              Assert-FixtureDiagnosticRoundTrip §accepted §decoded
              if (-not (Test-FixtureOrdinal §decoded.primary.§field §exact)) { throw 'EXACT_ENUM_CHANGED_AFTER_JSON' }
              §counts[§field].exact++
            }
            §seed=§probe.§field
            foreach (§case in @(Get-FixtureInvalidValues §seed)) {
              §probe.§field=§case.value
              §code='NONE'
              try { [void](Get-M1DDiagnostics -Failures @(§probe) -SchemaVersion §schema) } catch { §code=Get-M1BStopCode §_ }
              if (-not (Test-FixtureOrdinal §code 'D_DIAGNOSTIC_INVALID')) { throw ('INVALID_ENUM_ACCEPTED_' + §field + '_' + §case.name) }
              §counts[§field].invalid++
              # These are deliberately invalid, bound fixture receipts; only the real reader may reject them.
              §script:DRunRoot=Join-Path §root (§field+'-'+§schema+'-'+§case.name)
              [void][IO.Directory]::CreateDirectory(§script:DRunRoot)
              §invalid=[ordered]@{schemaVersion=§schema;primary=§probe;secondary=@()}
              [void](Write-M1DReceipt 'terminal' ([ordered]@{diagnostics=§invalid}))
              §code='NONE'
              try { [void](Read-M1DReceipt 'terminal') } catch { §code=Get-M1BStopCode §_ }
              if (-not (Test-FixtureOrdinal §code 'D_DIAGNOSTIC_INVALID')) { throw ('INVALID_ENUM_RECEIPT_ACCEPTED_' + §field + '_' + §case.name) }
              §counts[§field].readerRejected++
              if (§schema -eq 2 -and ((Test-FixtureOrdinal §field 'stage') -or (Test-FixtureOrdinal §field 'operation'))) {
                §priorPhase=§script:DPhase; §priorOperation=§script:DOperation
                §priorDeadline=§script:DPhaseDeadline; §priorEntered=§script:DEnteredPhases.Count
                §code='NONE'
                try {
                  if (Test-FixtureOrdinal §field 'stage') { Enter-M1DPhase §case.value } else { Set-M1DDiagnosticOperation §case.value }
                } catch { §code=Get-M1BStopCode §_ }
                if (-not (Test-FixtureOrdinal §code 'D_DIAGNOSTIC_INVALID') -or -not (Test-FixtureOrdinal §script:DPhase §priorPhase) -or -not (Test-FixtureOrdinal §script:DOperation §priorOperation) -or §script:DPhaseDeadline -ne §priorDeadline -or §script:DEnteredPhases.Count -ne §priorEntered) { throw ('INVALID_ENUM_SETTER_CHANGED_STATE_' + §field + '_' + §case.name) }
              }
            }
          }
        }
        'M1D_DIAGNOSTIC_ENUM_COUNTS='+(ConvertTo-Json §counts -Depth 3 -Compress)
      } finally {
        if (-not §root.StartsWith(§tempBase,[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-diagnostics-')) { throw 'FIXTURE_ROOT_INVALID' }
        [IO.Directory]::Delete(§root,§true)
      }
      # Occurrence identity survives rethrow/wrapping, never merges equal fields,
      # and is scoped to the actual collection, not a reusable boolean marker.
      if(§script:DCampaignClock -is [Diagnostics.Stopwatch]){§script:DCampaignClock.Stop()}
      §script:DCampaignClock=§null;Start-M1DClock Lifecycle
      §same=§null
      try{Stop-M1BRail 'D_DEADLINE_EXPIRED'}catch{§same=§_;[void](Add-M1DFailure §_)}
      try{throw §same}catch{[void](Add-M1DFailure §_)}
      §wrapped=[Management.Automation.ErrorRecord]::new([InvalidOperationException]::new('offline-wrapper',§same.Exception),'fixture-wrapper',[Management.Automation.ErrorCategory]::NotSpecified,§null)
      [void](Add-M1DFailure §wrapped)
      if(§script:DFailures.Count -ne 1 -or (Get-M1DDiagnostics).primary.category -cne 'TIMEOUT'){throw 'SAME_OCCURRENCE_DUPLICATED'}
      foreach(§i in @(1,2)){try{throw [IO.IOException]::new('offline-same-content')}catch{[void](Add-M1DFailure §_)}}
      §diag=Get-M1DDiagnostics
      if(§diag.secondary.Count -ne 2 -or §diag.secondary[0].category -cne 'IO_FAILURE' -or §diag.secondary[1].category -cne 'IO_FAILURE'){throw 'DISTINCT_OCCURRENCES_MERGED'}
      §priorCollection=§script:DFailures
      §script:DCampaignClock.Stop();§script:DCampaignClock=§null;Start-M1DClock Lifecycle
      [void](Add-M1DFailure §same)
      if(§priorCollection.Count -ne 3 -or §script:DFailures.Count -ne 1 -or (Get-M1DDiagnostics).primary.category -cne 'TIMEOUT'){throw 'FOREIGN_COLLECTION_MARKER_REUSED'}
      if((ConvertTo-Json (Get-M1DDiagnostics) -Depth 5).Contains('M1DFailureCollector')){throw 'OCCURRENCE_MARKER_PUBLISHED'}
      'M1D_FAILURE_OCCURRENCE_IDENTITY=PASS'
      'M1D_CHILD_DIAGNOSTICS_COMPATIBILITY=PASS'
      'M1D_CHILD_ROLE_LITERAL_BOUNDARIES=PASS'
      'M1D_CHILD_ROLE_ORDINAL_BOUNDARIES=PASS'
      'M1D_DIAGNOSTIC_ENUM_BOUNDARIES=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_CHILD_DIAGNOSTICS_COMPATIBILITY=PASS")
    assertThat(output).contains("M1D_FAILURE_OCCURRENCE_IDENTITY=PASS")
    assertThat(output).contains("M1D_CHILD_ROLE_LITERAL_BOUNDARIES=PASS")
    assertThat(output).contains("M1D_CHILD_ROLE_ORDINAL_BOUNDARIES=PASS")
    assertThat(output).contains("M1D_DIAGNOSTIC_ENUM_BOUNDARIES=PASS")
    println(output.lineSequence().single { it.startsWith("M1D_DIAGNOSTIC_ENUM_COUNTS=") })
  }

  @Test
  fun postgresDStopUsesOneDeadlineAndSealsFailuresBeforeCleanup() {
    val output = runRailPowerShell(
      """
      §Mode='Lifecycle'; §LifecycleAction='Run'; Start-M1DClock Lifecycle
      §script:DCampaignClock.Stop()
      function Write-M1DReceipt {
        param(§Name,§Payload)
        §script:events.Add('receipt')
        if(§script:scenario -ceq 'receipt-failure'){throw [IO.IOException]::new('private-stop-publication')}
        if(§Payload.activeProcesses -ne 0){throw 'FALSE_STOP_RECEIPT'}
        if(§script:scenario -ceq 'receipt-late'){§script:DCampaignClock.ElapsedMilliseconds=30001L}
        §script:receipts++; return 'OFFLINE_RECEIPT'
      }
      foreach(§scenario in @('normal','root-delayed','root-timeout','job-timeout','root-read','job-read','receipt-failure','dispose-two','terminate-failure','terminate-error','recheck-job','budget-expired','drain-timeout','terminate-late','attestation-late','drain-late','receipt-recheck-late','receipt-late','release-late','release-late-error','terminate-late-release-error')) {
        §script:scenario=§scenario; §script:events=[Collections.Generic.List[string]]::new()
        §script:DCampaignClock=[pscustomobject]@{ElapsedMilliseconds=0L}; §script:DTotalMilliseconds=30000L
        §script:DFailures=[Collections.Generic.List[object]]::new(); §script:DPhase='integration'
        §script:rootReads=0; §script:jobReads=0; §script:receipts=0; §script:terminateBudget=§null; §script:releaseBudget=§null;§script:releaseObservedAt=§null
        if(§scenario -ceq 'budget-expired'){§script:DTotalMilliseconds=0L}
        §p=[pscustomobject]@{Id=2000000000;CreationTimeUtcTicks=638000000000000000L;JobName='OFFLINE_JOB';Released=§false
          StandardOutput=[IO.StringReader]::new('');StandardError=[IO.StringReader]::new('')}
        §p | Add-Member ScriptProperty HasExited {
          if(§this.Released){throw 'CLOSED_ROOT_READ'}
          §script:rootReads++
          if(§script:scenario -ceq 'root-read'){throw [IO.IOException]::new('private-root-read')}
          if(§script:scenario -ceq 'root-timeout'){§script:DCampaignClock.ElapsedMilliseconds=30000L;return §false}
          if(§script:scenario -ceq 'attestation-late' -or (§script:scenario -ceq 'receipt-recheck-late' -and §script:rootReads -gt 1)){§script:DCampaignClock.ElapsedMilliseconds=30001L;return §true}
          if(§script:scenario -ceq 'root-delayed'){§script:DCampaignClock.ElapsedMilliseconds+=10L;return (§script:DCampaignClock.ElapsedMilliseconds -ge 50L)}
          return §true
        }
        §p | Add-Member ScriptProperty ActiveProcessCount {
          if(§this.Released){throw 'CLOSED_JOB_READ'}
          §script:jobReads++
          if(§script:scenario -ceq 'job-read'){throw [IO.IOException]::new('private-job-read')}
          if(§script:scenario -ceq 'job-timeout'){§script:DCampaignClock.ElapsedMilliseconds=30000L;return 1}
          if(§script:scenario -ceq 'recheck-job' -and §script:jobReads -gt 1){return 1}
          return 0
        }
        §p | Add-Member ScriptMethod TerminateTreeAndWait {
          param(§Budget)
          §script:events.Add('terminate'); §script:terminateBudget=§Budget
          §script:DCampaignClock.ElapsedMilliseconds+=§(if(§script:scenario -ceq 'drain-timeout'){1L}elseif(§script:scenario -cin @('terminate-late','terminate-late-release-error')){30001L}else{20L})
          if(§script:scenario -ceq 'terminate-error'){throw [IO.IOException]::new('private-terminate')}
          return (§script:scenario -cne 'terminate-failure')
        }
        §p | Add-Member ScriptMethod DisposeD {
          param(§Budget)
          if(§this.Released){throw 'DOUBLE_RELEASE'}
          §script:events.Add('release'); §script:releaseBudget=§Budget;§script:releaseObservedAt=§script:DCampaignClock.ElapsedMilliseconds; §this.Released=§true
          if(§script:scenario -cin @('release-late','release-late-error')){§script:DCampaignClock.ElapsedMilliseconds+=§Budget+1L}
          §this.StandardOutput.Dispose(); §this.StandardError.Dispose()
          if(§script:scenario -cin @('release-late-error','terminate-late-release-error')){return @('stop-stdout-close')}
          if(§script:scenario -ceq 'dispose-two'){return @('stop-stdout-close','stop-process-close')}
          if(§script:scenario -ceq 'root-timeout'){return @('stop-root-release-wait')}
          return @()
        }
        §child=New-M1DDrain §p 'BACKEND' 'private-forbidden-literal'
        §child.OutEnded=§true; §child.ErrEnded=§true
        if(§scenario -ceq 'drain-timeout'){
          §child.OutEnded=§false;§script:DCampaignClock.ElapsedMilliseconds=29980L
          §pending=[pscustomobject]@{}
          §pending | Add-Member ScriptProperty IsCompleted {§script:DCampaignClock.ElapsedMilliseconds=30000L;return §false}
          §child.OutTask=§pending
        }
        if(§scenario -ceq 'drain-late'){
          §child.OutEnded=§false;§awaiter=[pscustomobject]@{}
          §awaiter | Add-Member ScriptMethod GetResult {§script:DCampaignClock.ElapsedMilliseconds=30001L;return 0}
          §completed=[pscustomobject]@{IsCompleted=§true;Awaiter=§awaiter}
          §completed | Add-Member ScriptMethod GetAwaiter {return §this.Awaiter}
          §child.OutTask=§completed
        }
        §script:DChildren=@{BACKEND=§child}
        §first='NONE'; try { Stop-M1DChild BACKEND -Forced -Finalizing } catch { §first=Get-M1BStopCode §_;[void](Add-M1DFailure §_) }
        §success=§scenario -cin @('normal','root-delayed')
        if(§p.Released -ne §true -or §null -ne §child.ForbiddenLiteral -or @((§script:events) | Where-Object {§_ -ceq 'release'}).Count -ne 1){throw 'RELEASE_OR_SECRET_FINALIZATION_SKIPPED'}
        §expectedBudget=if(§scenario -ceq 'budget-expired'){0}else{[Math]::Max(0L,30000L-§script:releaseObservedAt)}
        if(§script:releaseBudget -ne §expectedBudget -or (§scenario -cne 'budget-expired' -and §script:terminateBudget -ne §(if(§scenario -ceq 'drain-timeout'){20}else{30000}))){throw 'STOP_BUDGET_RENEWED'}
        if(§success){
          if(§first -cne 'NONE' -or §script:DChildren.Count -ne 0 -or §script:receipts -ne 1 -or -not §child.StopReceiptWritten -or (§script:events -join ',') -cne 'terminate,receipt,release' -or §script:DFailures.Count -ne 0){throw 'VALID_STOP_REJECTED'}
          if(§scenario -ceq 'root-delayed' -and (§script:rootReads -lt 4 -or §script:releaseBudget -ge 29950)){throw 'ROOT_WAS_NOT_WAITED_WITHIN_ORIGINAL_BUDGET'}
        } else {
          if(§first -ceq 'NONE' -or -not §script:DChildren.ContainsKey('BACKEND') -or -not §child.StopAttempted -or §null -eq §child.StopFailure){throw 'FAILED_STOP_NOT_SEALED'}
          §expectedReceipts=if(§scenario -cin @('dispose-two','receipt-late','release-late','release-late-error')){1}else{0}
          if(§script:receipts -ne §expectedReceipts -or §child.StopReceiptWritten -ne [bool]§expectedReceipts){throw 'UNATTESTED_STOP_PUBLISHED'}
          §diag=Get-M1DDiagnostics
          §expectedOperation=switch(§scenario){'root-timeout'{'stop-root-wait'};'job-timeout'{'stop-job-wait'};'root-read'{'stop-root-read'};'job-read'{'stop-job-read'};'receipt-failure'{'stop-receipt'};'dispose-two'{'stop-stdout-close'};'recheck-job'{'stop-job-wait'};'drain-timeout'{'stop-drain'};'attestation-late'{'stop-attestation'};'drain-late'{'stop-drain'};'receipt-recheck-late'{'stop-receipt'};'receipt-late'{'stop-receipt'};'release-late'{'stop-release'};'release-late-error'{'stop-stdout-close'};default{'stop-terminate'}}
          if(§diag.primary.operation -cne §expectedOperation -or §diag.primary.childRole -cne 'BACKEND'){throw ('STOP_PREDICATE_OR_ROLE_LOST_'+§scenario)}
          §expectedSecondary=if(§scenario -cin @('dispose-two','root-timeout','release-late-error','terminate-late-release-error')){1}else{0}
          if(§diag.secondary.Count -ne §expectedSecondary){throw 'STOP_SECONDARY_COUNT_CHANGED'}
          if(§scenario -ceq 'dispose-two' -and §diag.secondary[0].operation -cne 'stop-process-close'){throw 'INDEPENDENT_CLOSE_FAILURE_LOST'}
          if(§scenario -cin @('terminate-late','attestation-late','drain-late','receipt-recheck-late','receipt-late','release-late','release-late-error','terminate-late-release-error')){
            if(§null -eq §child.StopBudgetFailure -or @((@((Get-M1DDiagnostics).primary)+@((Get-M1DDiagnostics).secondary)) | Where-Object {§_.control -ceq 'D_TERMINATION_BUDGET_EXHAUSTED'}).Count -ne 1){throw 'LATE_SUCCESS_OR_DUPLICATED_BUDGET_ACCEPTED'}
            if(§scenario -cin @('terminate-late','terminate-late-release-error') -and (§script:rootReads -ne 0 -or §script:jobReads -ne 0)){throw 'LATE_TERMINATION_BECAME_ATTESTATION'}
            if(§scenario -ceq 'release-late-error' -and §diag.secondary[0].operation -cne 'stop-release'){throw 'LATE_RELEASE_FIRST_ERROR_LOST'}
            if(§scenario -ceq 'terminate-late-release-error' -and §diag.secondary[0].operation -cne 'stop-stdout-close'){throw 'RELEASE_ERROR_AFTER_BUDGET_LOST'}
          }
          §eventsBefore=§script:events.Count; §readsBefore=§script:rootReads+§script:jobReads; §failuresBefore=§script:DFailures.Count; §deadlineBefore=§child.StopDeadline
          §second='NONE'; try{Stop-M1DChild BACKEND -Forced -Finalizing}catch{§second=Get-M1BStopCode §_;[void](Add-M1DFailure §_)}
          if(§second -cne §first -or §script:events.Count -ne §eventsBefore -or §script:rootReads+§script:jobReads -ne §readsBefore -or §script:DFailures.Count -ne §failuresBefore -or §child.StopDeadline -ne §deadlineBefore){throw 'REENTRY_RETRIED_OR_DUPLICATED_FINALIZATION'}
          if((ConvertTo-Json (Get-M1DDiagnostics) -Depth 5 -Compress).Contains('private-')){throw 'RAW_STOP_DETAIL_EXPOSED'}
        }
      }
      'M1D_STOP_SINGLE_DEADLINE_SEALED_FAILURES=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_STOP_SINGLE_DEADLINE_SEALED_FAILURES=PASS")
    assertThat(output).doesNotContain("private-")
  }
  @Test
  @Tag("windows-only")
  fun postgresDNativeReleaseAttemptsEveryOwnedStreamWithZeroRemainingBudget() {
    val source = postgresRailScriptSource()
    val dedicated = source.sliceBetween("public string[] DisposeD", "public void Dispose()")
    assertThat(dedicated).contains("timeoutMilliseconds - timer.ElapsedMilliseconds", "WaitForSingleObject(currentProcess, (uint)remaining)")
    assertThat(dedicated).doesNotContain("WaitForSingleObject(currentProcess, 30000)", "INFINITE")
    assertThat(source.sliceBetween("public void Dispose()", "static void Validate(")).contains("WaitForSingleObject(currentProcess, 30000)")
    val output = runRailPowerShell(
      """
      Initialize-M1BContainedProcessType
      Add-Type -TypeDefinition @'
      using System;
      using System.IO;
      using System.Collections.Generic;
      public static class DReleaseFixture { public static List<string> Calls = new List<string>(); }
      public sealed class DReleaseReader : StreamReader {
        readonly string stage; readonly bool fail;
        public DReleaseReader(string stage, bool fail) : base(new MemoryStream()) { this.stage=stage; this.fail=fail; }
        protected override void Dispose(bool disposing) {
          DReleaseFixture.Calls.Add(stage); base.Dispose(disposing);
          if(fail) throw new IOException("private-release-reader");
        }
      }
      public sealed class DReleaseWriter : StreamWriter {
        readonly bool fail;
        public DReleaseWriter(bool fail) : base(new MemoryStream()) { this.fail=fail; }
        protected override void Dispose(bool disposing) {
          DReleaseFixture.Calls.Add("stdin"); base.Dispose(disposing);
          if(fail) throw new IOException("private-release-writer");
        }
      }
'@
      §ctor=[Ritomer.M1B.ContainedProcess].GetConstructors([Reflection.BindingFlags]'Instance,NonPublic')[0]
      foreach(§scenario in @('none','stdout','stderr','stdin','all')){
        [DReleaseFixture]::Calls.Clear()
        §out=[DReleaseReader]::new('stdout',§scenario -cin @('stdout','all'))
        §err=[DReleaseReader]::new('stderr',§scenario -cin @('stderr','all'))
        §inputWriter=[DReleaseWriter]::new(§scenario -cin @('stdin','all'))
        # Zero handles: only fixture-owned in-memory streams are substituted.
        # The real DisposeD implementation executes, never an OS process lookup.
        §p=§ctor.Invoke([object[]]@([IntPtr]::Zero,[IntPtr]::Zero,[uint32]1,§out,§err))
        [void][Ritomer.M1B.ContainedProcess].GetProperty('StandardInput').GetSetMethod(§true).Invoke(§p,[object[]]@(§inputWriter))
        §failures=@(§p.DisposeD(0))
        §expected=switch(§scenario){'none'{''};'stdout'{'stop-stdout-close'};'stderr'{'stop-stderr-close'};'stdin'{'stop-stdin-close'};'all'{'stop-stdout-close,stop-stderr-close,stop-stdin-close'}}
        if(([DReleaseFixture]::Calls -join ',') -cne 'stdout,stderr,stdin' -or (§failures -join ',') -cne §expected){throw 'NATIVE_RELEASE_SKIPPED_OR_LEAKED_DETAIL'}
        if((@(§p.DisposeD(0)) -join ',') -cne 'stop-release' -or [DReleaseFixture]::Calls.Count -ne 3){throw 'NATIVE_RELEASE_REENTERED'}
        §p.Dispose()
        if([DReleaseFixture]::Calls.Count -ne 3){throw 'LEGACY_DISPOSE_REOPENED_RELEASED_RESOURCES'}
      }
      'M1D_NATIVE_RELEASE_INDEPENDENT_ZERO_BUDGET=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_NATIVE_RELEASE_INDEPENDENT_ZERO_BUDGET=PASS")
    assertThat(output).doesNotContain("private-")
  }
  @ParameterizedTest
  @ValueSource(strings = ["normal", "cascade", "secondary", "late", "stream-error", "finalization-error"])
  @Tag("windows-only")
  fun postgresDNativeDrainFinalizesEachOwnedJobDespiteInvalidPeer(scenario: String) {
    val output = runRailPowerShell(
      """
      §scenario = '__SCENARIO__'
      Initialize-M1BContainedProcessType
      §fixtureBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §fixtureRoot = Join-Path §fixtureBase ('m1d-drain-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§fixtureRoot)
      §RunId = [Guid]::NewGuid().ToString('N')
      §Mode = 'Lifecycle'; §LifecycleAction = 'Run'
      §ReviewedObjectSha256 = '0' * 64
      §SensitiveAuthorizationRecordId = 'AUTH-OFFLINE-DRAIN-FIXTURE'
      §script:DRunRoot = §fixtureRoot
      §script:DChildren = @{}
      §script:DFinishSent = §false; §script:DBackendStopSent = §false
      §script:DRuntimeSha256 = '1' * 64
      §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock 'Lifecycle'
      §script:DTotalMilliseconds = 45000L
      §script:DPhaseDeadline = 45000L
      §script:DPhase = 'integration'; §script:DOperation = 'child-drain'
      §owned = [Collections.Generic.List[object]]::new()
      §beforeResume = [Collections.Generic.List[bool]]::new()
      §launchObservations = [Collections.Generic.List[object]]::new()
      §pumpCount = 0; §firstPumpMs = §null
      function Start-FixtureChild([string]§role, [string]§code) {
        §launchStartedMs = §script:DCampaignClock.ElapsedMilliseconds
        §info = [Diagnostics.ProcessStartInfo]::new()
        §info.FileName = Join-Path §env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
        §info.Arguments = '-NoLogo -NoProfile -NonInteractive -EncodedCommand ' + [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(§code))
        §info.WorkingDirectory = §fixtureRoot
        §info.UseShellExecute = §false; §info.CreateNoWindow = §true
        §info.RedirectStandardInput = §true; §info.RedirectStandardOutput = §true; §info.RedirectStandardError = §true
        §info.EnvironmentVariables.Clear()
        §info.EnvironmentVariables['SystemRoot'] = §env:SystemRoot
        §info.EnvironmentVariables['WINDIR'] = §env:SystemRoot
        §info.EnvironmentVariables['TEMP'] = §fixtureRoot; §info.EnvironmentVariables['TMP'] = §fixtureRoot
        §process = Start-M1DContainedChild §info §role §null
        §owned.Add(§process)
        §confined = Read-M1DReceipt ('launch-lifecycle-' + §role + '-confined')
        §beforeResume.Add((§confined.payload.confinedBeforeResume -and §confined.payload.processId -eq §process.Id -and [string]§confined.payload.creationTimeUtcTicks -ceq [string]§process.CreationTimeUtcTicks))
        Set-M1DDiagnosticOperation 'child-drain'
        §script:DChildren[§role] = New-M1DDrain §process §role §null
        §launchObservations.Add([ordered]@{ role=§role; startedMs=§launchStartedMs; drainRegisteredMs=§script:DCampaignClock.ElapsedMilliseconds })
        return §process
      }
      §stopCodes = [Collections.Generic.List[string]]::new()
      §firstCode = 'NONE'; §liveSecond = §false; §normalStreams = §false
      §secondRootExited = §null; §secondJobCount = §null
      §jobZero = §false; §receipts = 0; §remaining = -1; §diagnostics = §null
      §cessation = §false; §stdoutChars = 0; §stderrChars = 0; §lateReceived = §false
      §dependentReached = §false
      §exerciseStartedMs = §null; §exerciseDeadline = §null
      §firstObservedMs = §null; §secondaryObservedMs = §null
      try {
        if (§scenario -in @('cascade','secondary')) {
          §exerciseGate = Join-Path §fixtureRoot 'exercise-gate'
          §bad = Start-FixtureChild 'HARNESS' "[IO.File]::WriteAllText('§fixtureRoot\harness-entered','1'); while (-not [IO.File]::Exists('§exerciseGate')) { [Threading.Thread]::Sleep(10) }; [Console]::Error.WriteLine('M1D_INVALID_FIXTURE'); [IO.File]::WriteAllText('§fixtureRoot\harness-signal-written','1'); [Threading.Thread]::Sleep(20000)"
          §gate = Join-Path §fixtureRoot 'secondary-gate'
          §goodCode = if (§scenario -eq 'secondary') { "[Console]::Out.WriteLine('M1D_BACKEND_READY §RunId'); while (-not [IO.File]::Exists('§gate')) { [Threading.Thread]::Sleep(10) }; [Console]::Error.WriteLine('M1D_INVALID_SECONDARY'); [Threading.Thread]::Sleep(20000)" } else { "[Console]::Out.WriteLine('M1D_BACKEND_READY §RunId'); [Threading.Thread]::Sleep(20000)" }
          §goodCode = "[IO.File]::WriteAllText('§fixtureRoot\backend-entered','1'); while (-not [IO.File]::Exists('§exerciseGate')) { [Threading.Thread]::Sleep(10) }; " + §goodCode
          §good = Start-FixtureChild 'BACKEND' §goodCode
          while (-not ([IO.File]::Exists((Join-Path §fixtureRoot 'harness-entered')) -and [IO.File]::Exists((Join-Path §fixtureRoot 'backend-entered')))) {
            Assert-M1DDeadline
            if (§bad.HasExited -or §good.HasExited) { throw 'FIXTURE_CHILD_EXITED_BEFORE_RELEASE' }
            [Threading.Thread]::Sleep(5)
          }
          Assert-M1DDeadline
          if (§bad.HasExited -or §good.HasExited -or §bad.ActiveProcessCount -le 0 -or §good.ActiveProcessCount -le 0 -or §script:DChildren.Count -ne 2 -or §beforeResume.Count -ne 2 -or @(§beforeResume | Where-Object { -not §_ }).Count -ne 0) { throw 'FIXTURE_PREPARATION_NOT_PROVEN' }
          if ([IO.File]::Exists((Join-Path §fixtureRoot 'harness-signal-written'))) { throw 'FIXTURE_SIGNAL_BEFORE_RELEASE' }
          # Ten seconds measure real error production/observation after both children
          # are prepared, not their startup. Preparation and finalization still share
          # the original 45-second clock and helper watchdog; neither is restarted.
          §exerciseStartedMs = §script:DCampaignClock.ElapsedMilliseconds
          §exerciseDeadline = [Math]::Min(§exerciseStartedMs + 10000L, 45000L)
          [IO.File]::WriteAllText(§exerciseGate, 'fixture-release')
          while (§firstCode -eq 'NONE' -and §script:DCampaignClock.ElapsedMilliseconds -lt §exerciseDeadline) {
            if (§pumpCount -eq 0) { §firstPumpMs = §script:DCampaignClock.ElapsedMilliseconds }; §pumpCount++
            try { Update-M1DChildren } catch { §firstCode = Get-M1BStopCode §_; [void](Add-M1DFailure §_); §firstObservedMs = §script:DCampaignClock.ElapsedMilliseconds }
            [Threading.Thread]::Sleep(5)
          }
          if (§firstCode -eq 'NONE' -or §firstObservedMs -ge §exerciseDeadline) { throw 'FIXTURE_INVALID_OUTPUT_NOT_OBSERVED' }
          §secondRootExited = §good.HasExited; §secondJobCount = §good.ActiveProcessCount
          §liveSecond = -not §secondRootExited -and §secondJobCount -gt 0
          if (§scenario -eq 'secondary') {
            [IO.File]::WriteAllText(§gate, 'fixture-release')
            while (-not §script:DChildren['BACKEND'].ErrTask.IsCompleted -and §script:DCampaignClock.ElapsedMilliseconds -lt §exerciseDeadline) { [Threading.Thread]::Sleep(5) }
            if (-not §script:DChildren['BACKEND'].ErrTask.IsCompleted) { throw 'SECONDARY_PIPE_NOT_READY' }
            Update-M1DDrain §script:DChildren['BACKEND'] -Finalizing
            §secondaryObservedMs = §script:DCampaignClock.ElapsedMilliseconds
            if (-not §script:DChildren['BACKEND'].Failures.ContainsKey('D_CONTROL_MESSAGE_WRONG_CHANNEL') -or §secondaryObservedMs -ge §exerciseDeadline) { throw 'FIXTURE_SECONDARY_ERROR_NOT_OBSERVED' }
          }
          foreach (§role in @('BACKEND','HARNESS')) {
            try { Set-M1DDiagnosticOperation 'forced-stop'; Stop-M1DChild §role -Forced -Finalizing }
            catch { §stopCodes.Add((Get-M1BStopCode §_)); [void](Add-M1DFailure §_) }
          }
        } else {
          §code = if (§scenario -eq 'finalization-error') { "[Console]::Error.WriteLine('M1D_BAD_FINALIZATION')" } elseif (§scenario -eq 'late') { "[Console]::Out.WriteLine('ordinary'); [Threading.Thread]::Sleep(500); [Console]::Error.WriteLine('late');" } else { "[Console]::Out.WriteLine(('o'*70000)); [Console]::Error.WriteLine(('e'*70000));" }
          §good = Start-FixtureChild 'VITE' §code
          §drain = §script:DChildren['VITE']
          if (§scenario -eq 'stream-error') {
            # Fault the real pipe read by closing its actual native StreamReader.
            §good.StandardOutput.Dispose()
          }
          while (-not §good.HasExited -and §script:DCampaignClock.ElapsedMilliseconds -lt 10000) {
            if (§scenario -ne 'finalization-error') {
              try { Update-M1DChildren } catch { if (§firstCode -eq 'NONE') { §firstCode=Get-M1BStopCode §_ }; [void](Add-M1DFailure §_); break }
            }
            [Threading.Thread]::Sleep(5)
          }
          try { Set-M1DDiagnosticOperation 'forced-stop'; Stop-M1DChild 'VITE' -Forced -Finalizing:(§scenario -eq 'stream-error'); §dependentReached=§true }
          catch { §stopCodes.Add((Get-M1BStopCode §_)); [void](Add-M1DFailure §_) }
          §normalStreams = §drain.OutEnded -and §drain.ErrEnded
          §stdoutChars = §drain.Stdout.Length; §stderrChars = §drain.Stderr.Length
          §lateReceived = §drain.Stderr.ToString().Contains('late')
        }
        §remaining = §script:DChildren.Count
        §receipts = @(Get-ChildItem -LiteralPath §fixtureRoot -Filter '*-stopped.json' -File).Count
        §jobZero = @(§owned | Where-Object { [Ritomer.M1B.ContainedProcess]::QueryDJob(§_.JobName) -gt 0 }).Count -eq 0
        Assert-M1DRecordedCessation
        §cessation = §true
        §diagnostics = Get-M1DDiagnostics
      } finally {
        if (§scenario -in @('cascade','secondary')) {
          §drainStates = @(foreach (§role in @('HARNESS','BACKEND')) {
            if (§script:DChildren.ContainsKey(§role)) {
              §observedDrain = §script:DChildren[§role]
              [ordered]@{ role=§role; rootExited=§observedDrain.Process.HasExited; errTaskCompleted=§observedDrain.ErrTask.IsCompleted; errChars=§observedDrain.Stderr.Length }
            }
          })
          'T1_DRAIN_OBSERVATION=' + ([ordered]@{ scenario=§scenario; elapsedMs=§script:DCampaignClock.ElapsedMilliseconds; launches=@(§launchObservations.ToArray()); exerciseStartedMs=§exerciseStartedMs; exerciseDeadlineMs=§exerciseDeadline; firstObservedMs=§firstObservedMs; secondaryObservedMs=§secondaryObservedMs; pumpCount=§pumpCount; firstPumpMs=§firstPumpMs; signalProduced=[IO.File]::Exists((Join-Path §fixtureRoot 'harness-signal-written')); harnessEntered=[IO.File]::Exists((Join-Path §fixtureRoot 'harness-entered')); firstCode=§firstCode; drains=§drainStates } | ConvertTo-Json -Depth 5 -Compress)
        }
        # Only handles created above; no PID lookup, adoption, existing run or DB.
        foreach (§process in §owned) { §process.Dispose() }
        'T1_DRAIN_DISPOSED=' + ([ordered]@{ scenario=§scenario; ownedJobs=@(§owned | ForEach-Object { [Ritomer.M1B.ContainedProcess]::QueryDJob(§_.JobName) }) } | ConvertTo-Json -Compress)
        if (-not §fixtureRoot.StartsWith(§fixtureBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§fixtureRoot)).StartsWith('m1d-drain-')) { throw 'FIXTURE_PATH_INVALID' }
        [IO.Directory]::Delete(§fixtureRoot, §true)
      }
      [ordered]@{ scenario=§scenario; powershellVersion=§PSVersionTable.PSVersion.ToString(); firstCode=§firstCode; secondWasAlive=§liveSecond; secondRootExited=§secondRootExited; secondJobCount=§secondJobCount; stopCodes=@(§stopCodes.ToArray()); dependentReached=§dependentReached; stopReceipts=§receipts; remainingChildren=§remaining; normalStreamsEnded=§normalStreams; stdoutChars=§stdoutChars; stderrChars=§stderrChars; lateReceived=§lateReceived; jobsEmptyOrGone=§jobZero; recordedCessation=§cessation; confinementBeforeResume=(@(§beforeResume | Where-Object { -not §_ }).Count -eq 0 -and §beforeResume.Count -eq §owned.Count); diagnostics=§diagnostics; elapsedMilliseconds=§script:DCampaignClock.ElapsedMilliseconds; noOperationalRun=§true } | ConvertTo-Json -Depth 7 -Compress

      if (§PSVersionTable.PSVersion.Major -ne 5 -or §PSVersionTable.PSVersion.Minor -ne 1) { throw 'NATIVE_PS51_REQUIRED' }
      if (-not §jobZero -or -not §cessation -or §remaining -ne 0 -or §script:DCampaignClock.ElapsedMilliseconds -ge 45000) { throw 'INDEPENDENT_FINALIZATION_FAILED' }
      if (@(§beforeResume | Where-Object { -not §_ }).Count -ne 0 -or §beforeResume.Count -ne §owned.Count) { throw 'NATIVE_CONFINEMENT_NOT_PROVEN' }
      §expectedReceipts = if (§scenario -in @('cascade','secondary')) { 2 } else { 1 }
      if (§receipts -ne §expectedReceipts) { throw 'NATIVE_STOP_RECEIPTS_MISSING' }
      if (§scenario -eq 'finalization-error') {
        if (§dependentReached -or §stopCodes.Count -ne 1 -or §stopCodes[0] -cne 'D_CHILD_FINALIZATION_FAILED' -or §diagnostics.primary.childRole -cne 'VITE' -or §diagnostics.primary.control -cne 'D_CONTROL_MESSAGE_WRONG_CHANNEL') { throw 'FINALIZATION_FAILURE_DID_NOT_STOP_DEPENDENTS' }
      } elseif (§stopCodes.Count -ne 0) { throw 'INDEPENDENT_STOP_FAILED' }
      if (§scenario -in @('normal','late')) {
        if (§firstCode -cne 'NONE' -or §null -ne §diagnostics.primary -or -not §normalStreams) { throw 'NORMAL_STREAMS_INCOMPLETE' }
        if (§scenario -eq 'normal' -and (§stdoutChars -lt 70000 -or §stderrChars -lt 70000)) { throw 'NATIVE_BYTES_NOT_DRAINED' }
        if (§scenario -eq 'late' -and -not §lateReceived) { throw 'LATE_NATIVE_BYTES_LOST' }
      } else {
        if (§null -eq §diagnostics.primary -or §script:DFailures.Count -eq 0) { throw 'SCENARIO_FAILURE_ERASED' }
        if (§scenario -eq 'stream-error') {
          if (§normalStreams -or §diagnostics.primary.childRole -cne 'VITE' -or §diagnostics.primary.control -cne 'D_CHILD_STDOUT_READ_FAILED') { throw 'STREAM_ERROR_MASQUERADED_AS_EOF' }
        } elseif (§scenario -ne 'finalization-error') {
          if (-not §liveSecond -or §diagnostics.primary.childRole -cne 'HARNESS' -or §diagnostics.primary.control -cne 'D_CONTROL_MESSAGE_WRONG_CHANNEL') { throw 'FIRST_CHILD_FAILURE_LOST' }
          if (§scenario -eq 'secondary' -and (§diagnostics.secondary.Count -ne 1 -or §diagnostics.secondary[0].childRole -cne 'BACKEND' -or §diagnostics.secondary[0].control -cne 'D_CONTROL_MESSAGE_WRONG_CHANNEL')) { throw 'INDEPENDENT_SECONDARY_FAILURE_LOST' }
        }
      }
      'M1D_NATIVE_DRAIN_FINALIZATION=PASS'

      """.trimIndent().replace("__SCENARIO__", scenario)
    )
    assertThat(output).contains("M1D_NATIVE_DRAIN_FINALIZATION=PASS")
    output.lineSequence().filter { it.startsWith("T1_DRAIN_") }.forEach(::println)
    output.lineSequence().filter { it.startsWith("{\"scenario\":") }.forEach(::println)
  }

  @Test
  @Tag("windows-only")
  fun postgresDNativeConfinementPrecedesExecutionAndDrainsConcurrentStreams() {
    val output = runRailPowerShell(
      """
      Initialize-M1BContainedProcessType
      §tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §root = Join-Path §tempBase ('m1d-native-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      §receipt = Join-Path §root 'before-resume.txt'
      §startedFile = Join-Path §root 'child-started.txt'
      §childCode = "if (-not [IO.File]::Exists('§receipt')) { exit 7 }; [IO.File]::WriteAllText('§startedFile','started'); [Console]::Out.WriteLine(('x'*70000)); [Console]::Error.WriteLine(('e'*70000)); [Console]::Out.WriteLine([Console]::In.ReadLine())"
      §psi = [Diagnostics.ProcessStartInfo]::new()
      §psi.FileName = (Join-Path §env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe')
      §psi.Arguments = '-NoLogo -NoProfile -NonInteractive -EncodedCommand ' + [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(§childCode))
      §psi.WorkingDirectory = §root; §psi.UseShellExecute = §false; §psi.CreateNoWindow = §true
      §psi.RedirectStandardInput = §true; §psi.RedirectStandardOutput = §true; §psi.RedirectStandardError = §true
      §callback = {
        param([int]§childId,[long]§ticks,[string]§jobName)
        if ([IO.File]::Exists(§startedFile) -or §ticks -le 0 -or [Ritomer.M1B.ContainedProcess]::QueryDJob(§jobName) -ne 1) { throw 'CONFINEMENT_NOT_BEFORE_EXECUTION' }
        [IO.File]::WriteAllText(§receipt, 'confined')
      }
      §child = §null
      try {
        §nativeRunId = [Guid]::NewGuid().ToString('N')
        §child = [Ritomer.M1B.ContainedProcess]::StartD(§psi, §nativeRunId, 'BACKEND', [Action[int,long,string]]§callback)
        §captured = Read-M1BBoundedProcessStreams -Process §child -LimitChars 200000 -TimeoutMilliseconds 10000 -StandardInputText "fixture-finish`n"
        if (§child.ExitCode -ne 0 -or §captured.Stdout.Length -lt 70000 -or §captured.Stderr.Length -lt 70000 -or -not §captured.Stdout.Contains('fixture-finish')) { throw 'CONCURRENT_DRAIN_OR_STDIN_FAILED' }
        if (-not §child.TerminateTreeAndWait(3000) -or §child.ActiveProcessCount -ne 0) { throw 'D_CHILD_TREE_NOT_EMPTY' }
        §child.Dispose(); §child = §null
        # ADMIN_PSQL uses the same native wrapper with non-interactive flags.
        # This controlled executable only checks presence, never prints a value.
        # Keep the child reference literal: the parent must not expand it.
        §adminCode='if ([string]::IsNullOrEmpty(§env:PGPASSWORD)) { exit 9 }; [Console]::Out.WriteLine([Console]::In.ReadLine())'
        §psi.Arguments='-NoLogo -NoProfile -NonInteractive -EncodedCommand '+[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes(§adminCode))
        §psi.EnvironmentVariables['PGPASSWORD']='synthetic-native-admin-only'
        §psi.CreateNoWindow = §true
        §child = [Ritomer.M1B.ContainedProcess]::StartD(§psi, [Guid]::NewGuid().ToString('N'), 'ADMIN_PSQL_PREFLIGHT', [Action[int,long,string]]{ param(§id,§ticks,§name) })
        §psi.EnvironmentVariables.Remove('PGPASSWORD')
        §captured = Read-M1BBoundedProcessStreams -Process §child -LimitChars 200000 -TimeoutMilliseconds 10000 -StandardInputText "synthetic-admin-input`n"
        if (§child.ExitCode -ne 0 -or -not §captured.Stdout.Contains('synthetic-admin-input') -or §captured.Stdout.Contains('synthetic-native-admin-only') -or §captured.Stderr.Contains('synthetic-native-admin-only') -or [Environment]::GetEnvironmentVariables().Contains('PGPASSWORD')) { throw 'ADMIN_NATIVE_STDIN_FAILED' }
        if (-not §child.TerminateTreeAndWait(3000)) { throw 'ADMIN_TREE_NOT_EMPTY' }
      } finally {
        if (§null -ne §child) { §child.Dispose() }
        if (-not §root.StartsWith(§tempBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-native-')) { throw 'FIXTURE_ROOT_INVALID' }
        [IO.Directory]::Delete(§root, §true)
      }
      'M1D_NATIVE_CONFINEMENT_DRAIN_ADMIN_FIXTURE=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_NATIVE_CONFINEMENT_DRAIN_ADMIN_FIXTURE=PASS")
  }

  @Test
  @Tag("windows-only")
  fun postgresDParentDeathRequiresReceiptsAndSameBootLogonNamespace() {
    val output = runRailPowerShell(
      """
      Initialize-M1BContainedProcessType
      §tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §root = Join-Path §tempBase ('m1d-parent-' + [Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      §RunId = [Guid]::NewGuid().ToString('N')
      §script:DRunRoot = §root
      §powershell = Join-Path §env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
      §grandFile = Join-Path §root 'grandchild.ps1'
      §childFile = Join-Path §root 'child.ps1'
      §parentFile = Join-Path §root 'parent.ps1'
      §grandIdFile = Join-Path §root 'grandchild-id.txt'
      [IO.File]::WriteAllText(§grandFile, ('[IO.File]::WriteAllText(''__ROOT__\grand-entered'',''1''); while (§true) { [Threading.Thread]::Sleep(100) }').Replace('__ROOT__', §root))
      §childSource = @'
      [IO.File]::WriteAllText('__ROOT__\child-entered',[string][Diagnostics.Stopwatch]::GetTimestamp())
      §psi = [Diagnostics.ProcessStartInfo]::new()
      §psi.FileName = '__POWERSHELL__'
      §psi.Arguments = '-NoLogo -NoProfile -NonInteractive -File "__GRAND__"'
      §psi.UseShellExecute = §false; §psi.CreateNoWindow = §true
      §grandStage = 'START'; §failureCategory = 'UNEXPECTED_FAILURE'
      try {
        [IO.File]::WriteAllText('__ROOT__\grand-start-entered',[string][Diagnostics.Stopwatch]::GetTimestamp())
        §grand = [Diagnostics.Process]::Start(§psi)
        [IO.File]::WriteAllText('__ROOT__\grand-start-returned',[string][Diagnostics.Stopwatch]::GetTimestamp())
        if (§null -eq §grand) { §failureCategory = 'NULL_RETURN'; throw 'FIXTURE_GRAND_NULL_RETURN' }
        §grandStage = 'ID'
        §grandId = §grand.Id
        [IO.File]::WriteAllText('__ROOT__\grand-id-obtained',[string][Diagnostics.Stopwatch]::GetTimestamp())
        §grandStage = 'PUBLICATION'
        [IO.File]::WriteAllText('__ROOT__\grand-id-publish-entered',[string][Diagnostics.Stopwatch]::GetTimestamp())
        [IO.File]::WriteAllText('__GRAND_ID__', [string]§grandId)
        [IO.File]::WriteAllText('__ROOT__\grand-id-published',[string][Diagnostics.Stopwatch]::GetTimestamp())
      } catch {
        §cause = §_.Exception.GetBaseException()
        if (§cause -is [UnauthorizedAccessException]) { §failureCategory = 'ACCESS_DENIED' }
        elseif (§cause -is [IO.IOException]) { §failureCategory = 'IO_FAILURE' }
        elseif (§cause -is [ArgumentException]) { §failureCategory = 'INVALID_ARGUMENT' }
        elseif (§cause -is [ComponentModel.Win32Exception]) { §failureCategory = 'NATIVE_START_FAILURE' }
        elseif (§cause -is [InvalidOperationException]) { §failureCategory = 'INVALID_OPERATION' }
        [IO.File]::WriteAllText('__ROOT__\grand-failure', ([string][Diagnostics.Stopwatch]::GetTimestamp() + '|' + §grandStage + '|' + §failureCategory))
        exit 23
      }
      while (§true) { [Threading.Thread]::Sleep(100) }
      '@
      §childSource = §childSource.Replace('__ROOT__', §root).Replace('__POWERSHELL__', §powershell).Replace('__GRAND__', §grandFile).Replace('__GRAND_ID__', §grandIdFile)
      [IO.File]::WriteAllText(§childFile, §childSource)
      §parentSource = @'
      [IO.File]::WriteAllText('__ROOT__\parent-entered',[string][Diagnostics.Stopwatch]::GetTimestamp())
      §fixtureBootstrapStage = 'EXTRACT'; §fixtureFailureCategory = 'UNEXPECTED_FAILURE'
      try {
        [IO.File]::WriteAllText('__ROOT__\extract-entered',[string][Diagnostics.Stopwatch]::GetTimestamp())
        §extractedPath=[IO.Path]::ChangeExtension(§PSCommandPath,'.functions.ps1')
        [IO.File]::WriteAllBytes(§extractedPath,[Convert]::FromBase64String('__EXTRACTED_FUNCTIONS__'))
        [IO.File]::WriteAllText('__ROOT__\functions-extracted',[string][Diagnostics.Stopwatch]::GetTimestamp())
        §fixtureBootstrapStage = 'MODULES'
        Set-StrictMode -Version Latest
        §ErrorActionPreference = 'Stop'
        §ProgressPreference = 'SilentlyContinue'
        # The synthetic parent inherits the fixture's minimal environment. Load only its two
        # system dependencies explicitly: implicit discovery exhausted the hosted startup window.
        foreach (§fixtureModule in @('Microsoft.PowerShell.Management','Microsoft.PowerShell.Utility')) {
          §fixtureManifest = [IO.Path]::Combine(§PSHOME, ('Modules\' + §fixtureModule + '\' + §fixtureModule + '.psd1'))
          if (-not [IO.File]::Exists(§fixtureManifest)) { throw 'FIXTURE_MODULE_MANIFEST_UNOBSERVABLE' }
          §null = Import-Module -Name §fixtureManifest -ErrorAction Stop
        }
        §fixtureBootstrapStage = 'IMPORT'
        [IO.File]::WriteAllText('__ROOT__\import-entered',[string][Diagnostics.Stopwatch]::GetTimestamp())
        . §extractedPath -Campaign D -Mode Lifecycle -RunId '__RUN__' -ReviewedObjectSha256 '__HASH__' -ExpectedPsqlSha256 '__HASH__' -RunRoot '__ROOT__' -SensitiveAuthorizationRecordId AUTH-OFFLINE-FIXTURE -PreflightAuthorizationRecordId AUTH-OFFLINE-PREFLIGHT
        [IO.File]::WriteAllText('__ROOT__\functions-loaded',[string][Diagnostics.Stopwatch]::GetTimestamp())
      } catch {
        §fixtureCause = §_.Exception.GetBaseException()
        if (§fixtureCause -is [UnauthorizedAccessException]) { §fixtureFailureCategory = 'ACCESS_DENIED' }
        elseif (§fixtureCause -is [IO.IOException]) { §fixtureFailureCategory = 'IO_FAILURE' }
        elseif (§_.CategoryInfo.Reason -ceq 'CommandNotFoundException') { §fixtureFailureCategory = 'COMMAND_NOT_FOUND' }
        elseif (§fixtureCause.Message -ceq 'FIXTURE_MODULE_MANIFEST_UNOBSERVABLE') { §fixtureFailureCategory = 'MODULE_MANIFEST_UNOBSERVABLE' }
        [IO.File]::WriteAllText('__ROOT__\parent-bootstrap-failure', (§fixtureBootstrapStage + '|' + §fixtureFailureCategory))
        exit 23
      }
      §script:DRunRoot = '__ROOT__'
      §Mode = 'Lifecycle'; §LifecycleAction = 'Run'; Start-M1DClock Lifecycle
      Enter-M1DPhase backend
      [IO.File]::WriteAllText('__ROOT__\phase-admitted','1')
      §psi = [Diagnostics.ProcessStartInfo]::new()
      §psi.FileName = '__POWERSHELL__'
      §psi.Arguments = '-NoLogo -NoProfile -NonInteractive -File "__CHILD__"'
      §psi.WorkingDirectory = '__ROOT__'; §psi.UseShellExecute = §false; §psi.CreateNoWindow = §true
      §psi.RedirectStandardInput = §true; §psi.RedirectStandardOutput = §true; §psi.RedirectStandardError = §true
      §child = Start-M1DContainedChild §psi BACKEND
      [IO.File]::WriteAllText('__ROOT__\child-launched','1')
      while (§true) { [Threading.Thread]::Sleep(100) }
      '@
      §parentSource = §parentSource.Replace('__EXTRACTED_FUNCTIONS__', [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(§offlineRailSource))).Replace('__RUN__', §RunId).Replace('__HASH__', §ReviewedObjectSha256).Replace('__ROOT__', §root).Replace('__POWERSHELL__', §powershell).Replace('__CHILD__', §childFile)
      [IO.File]::WriteAllText(§parentFile, §parentSource)
      §parent = §null
      §clock = [Diagnostics.Stopwatch]::StartNew()
      §startObservation = §null
      try {
        §psi = [Diagnostics.ProcessStartInfo]::new(); §psi.FileName = §powershell
        §psi.Arguments = '-NoLogo -NoProfile -NonInteractive -File "' + §parentFile + '"'
        §psi.WorkingDirectory = §root; §psi.UseShellExecute = §false; §psi.CreateNoWindow = §true
        §psi.RedirectStandardOutput = §true; §psi.RedirectStandardError = §true
        §parent = [Ritomer.M1B.ContainedProcess]::Start(§psi)
        §clock = [Diagnostics.Stopwatch]::StartNew()
        §observationOrigin = [Diagnostics.Stopwatch]::GetTimestamp()
        while (-not [IO.File]::Exists(§grandIdFile) -and -not §parent.HasExited -and §clock.ElapsedMilliseconds -lt 10000) { [Threading.Thread]::Sleep(25) }
        §waitEndTicks = [Diagnostics.Stopwatch]::GetTimestamp()
        §observedAtMs = §clock.ElapsedMilliseconds
        §grandFilePresentAtWaitEnd = [IO.File]::Exists(§grandIdFile)
        function Get-FixtureRelativeTick {
          param([long]§Ticks)
          if (§Ticks -lt §observationOrigin) { return 'PRE_ORIGIN' }
          §milliseconds = [Math]::Floor((§Ticks - §observationOrigin) * 1000.0 / [Diagnostics.Stopwatch]::Frequency)
          if (§milliseconds -gt 45000) { return 'OUT_OF_RANGE' }
          return ([long]§milliseconds).ToString([Globalization.CultureInfo]::InvariantCulture)
        }
        §parentTiming = @(foreach (§stage in @('parent-entered','extract-entered','functions-extracted','import-entered','functions-loaded')) {
          §stagePath = Join-Path §root §stage
          if (-not [IO.File]::Exists(§stagePath)) { 'MISSING'; continue }
          §stageTicks = 0L
          if (-not [long]::TryParse([IO.File]::ReadAllText(§stagePath), [ref]§stageTicks) -or §stageTicks -le 0) { 'INVALID'; continue }
          Get-FixtureRelativeTick §stageTicks
        })
        "`nM1D_PARENT_TIMING entry=" + §parentTiming[0] + ' extractEnter=' + §parentTiming[1] + ' extractReturn=' + §parentTiming[2] + ' importEnter=' + §parentTiming[3] + ' importReturn=' + §parentTiming[4] + ' wait=' + (Get-FixtureRelativeTick §waitEndTicks)
        §bootstrapFailurePath = Join-Path §root 'parent-bootstrap-failure'
        if ([IO.File]::Exists(§bootstrapFailurePath)) {
          §bootstrapFailure = [IO.File]::ReadAllText(§bootstrapFailurePath)
          if (§bootstrapFailure -cmatch '^(EXTRACT|MODULES|IMPORT)\|(UNEXPECTED_FAILURE|ACCESS_DENIED|IO_FAILURE|COMMAND_NOT_FOUND|MODULE_MANIFEST_UNOBSERVABLE)\z') {
            'M1D_PARENT_BOOTSTRAP stage=' + §Matches[1] + ' category=' + §Matches[2]
          } else { 'M1D_PARENT_BOOTSTRAP stage=INVALID category=INVALID' }
        }
        §grandTrace = @(foreach (§stage in @('child-entered','grand-start-entered','grand-start-returned','grand-id-obtained','grand-id-publish-entered','grand-id-published')) {
          §stagePath = Join-Path §root §stage
          if ([IO.File]::Exists(§stagePath)) {
            §stageTicks = 0L
            §complete = [long]::TryParse([IO.File]::ReadAllText(§stagePath), [ref]§stageTicks)
            [ordered]@{ stage=§stage; complete=§complete; elapsedMs=§(if (§complete) { [Math]::Round((§stageTicks - §observationOrigin) * 1000.0 / [Diagnostics.Stopwatch]::Frequency, 3) } else { §null }) }
          }
        })
        §grandFailure = §null
        if ([IO.File]::Exists((Join-Path §root 'grand-failure'))) {
          §parts = [IO.File]::ReadAllText((Join-Path §root 'grand-failure')).Split('|')
          if (§parts.Count -eq 3 -and §parts[1] -cin @('START','ID','PUBLICATION') -and §parts[2] -cin @('UNEXPECTED_FAILURE','NULL_RETURN','ACCESS_DENIED','IO_FAILURE','INVALID_ARGUMENT','NATIVE_START_FAILURE','INVALID_OPERATION')) {
            §grandFailure = [ordered]@{ stage=§parts[1]; category=§parts[2] }
          } else { §grandFailure = [ordered]@{ stage='UNKNOWN'; category='INCOMPLETE_TRACE' } }
        }
        §publication = 'ABSENT'; §observedGrandId = 0
        if ([IO.File]::Exists(§grandIdFile)) {
          try { §publication = if ([int]::TryParse([IO.File]::ReadAllText(§grandIdFile), [ref]§observedGrandId) -and §observedGrandId -gt 0) { 'READABLE_ID' } else { 'INCOMPLETE' } }
          catch { §publication = 'READ_FAILED' }
        }
        §startObservation = [ordered]@{ elapsedMs=§observedAtMs; grandFilePresentAtWaitEnd=§grandFilePresentAtWaitEnd; observationCompletedMs=§clock.ElapsedMilliseconds; parentExited=§parent.HasExited; parentExitCode=§(if (§parent.HasExited) { §parent.ExitCode } else { §null }); grandTrace=§grandTrace; grandFailure=§grandFailure; publication=§publication; present=@(@('parent-entered','functions-extracted','functions-loaded','phase-admitted','d-launch-lifecycle-BACKEND-intent.json','d-launch-lifecycle-BACKEND-confined.json','child-launched','child-entered','grandchild-id.txt','grand-entered') | Where-Object { [IO.File]::Exists((Join-Path §root §_)) }) }
        # Observation must not admit a publication arriving after the wait ended.
        if (-not §grandFilePresentAtWaitEnd) {
          if (-not §parent.HasExited) { throw 'SYNTHETIC_PARENT_START_TIMEOUT' }
          throw 'SYNTHETIC_PARENT_START_FAILED'
        }
        §code = 'NONE'; try { Assert-M1DRecordedCessation } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_RECORDED_ROOT_STILL_ALIVE') { throw ('LIVE_ROOT_ACCEPTED:' + §code) }
        §jobName = 'Local\Ritomer.M1D.' + §RunId + '.BACKEND'
        if ([Ritomer.M1B.ContainedProcess]::QueryDJob(§jobName) -lt 2) { throw 'DESCENDANT_NOT_CONFINED' }
        §parentIdentity = [Diagnostics.Process]::GetProcessById(§parent.Id)
        try { §parentIdentity.Kill(); if (-not §parentIdentity.WaitForExit(5000)) { throw 'SYNTHETIC_PARENT_NOT_TERMINATED' } }
        finally { §parentIdentity.Dispose() }
        §clock.Restart()
        while ([Ritomer.M1B.ContainedProcess]::QueryDJob(§jobName) -gt 0 -and §clock.ElapsedMilliseconds -lt 5000) { [Threading.Thread]::Sleep(10) }
        Assert-M1DRecordedCessation
        if ([Ritomer.M1B.ContainedProcess]::QueryDJob(§jobName) -ne -1) { throw 'EXPECTED_JOB_ABSENCE_NOT_OBSERVED' }
        # Model an independently surviving descendant while the recorded root is
        # absent. Root disappearance alone must never authorize destruction.
        function Get-M1DRecordedJobCount { param(§JobName) return 1 }
        §code = 'NONE'; try { Assert-M1DRecordedCessation } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_RECORDED_DESCENDANT_STILL_ALIVE') { throw 'SURVIVING_DESCENDANT_ACCEPTED' }
        function Get-M1DRecordedJobCount { param(§JobName) return [Ritomer.M1B.ContainedProcess]::QueryDJob(§JobName) }
        §confined = Read-M1DReceipt 'launch-lifecycle-BACKEND-confined'
        §actualNamespace = Get-M1DNamespaceIdentity
        function Get-M1DNamespaceIdentity { 'ffffffffffffffffffffffffffffffff:ffffffffffffffff:999' }
        §code = 'NONE'; try { Assert-M1DRecordedCessation } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_RECEIPT_BINDING_INVALID') { throw 'CHANGED_BOOT_LOGON_ACCEPTED' }
        Remove-Item Function:Get-M1DNamespaceIdentity
        function Get-M1DNamespaceIdentity { return [Ritomer.M1B.ContainedProcess]::DNamespaceIdentity() }
        §intentPath = Join-Path §root 'd-launch-lifecycle-BACKEND-intent.json'
        [IO.File]::Move(§intentPath, (§intentPath + '.fixture-hidden'))
        §code = 'NONE'; try { Assert-M1DRecordedCessation } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_LAUNCH_RECEIPT_ORPHAN') { throw 'ORPHAN_CONFINEMENT_ACCEPTED' }
      } finally {
        if (§null -eq §startObservation) { 'M1D_PARENT_OBSERVATION_ABSENT' }
        else {
          foreach (§stage in @('parent-entered','functions-extracted','functions-loaded','phase-admitted','d-launch-lifecycle-BACKEND-intent.json','d-launch-lifecycle-BACKEND-confined.json','child-launched','child-entered','grandchild-id.txt','grand-entered')) {
            if (§startObservation.present -ccontains §stage) { 'M1D_PARENT_PRESENT_' + §stage }
          }
          if (§startObservation.parentExited) { 'M1D_PARENT_EXITED_AT_OBSERVATION' }
          if (§startObservation.elapsedMs -ge 10000) { 'M1D_PARENT_START_WINDOW_EXPIRED' }
          if (§startObservation.publication -ceq 'READABLE_ID') { 'M1D_PARENT_PUBLICATION_READABLE' }
        }
        'T1_PARENT_OBSERVATION=' + (§startObservation | ConvertTo-Json -Depth 4 -Compress)
        if (§null -ne §parent) {
          try {
            §fixtureStopped = §parent.TerminateTreeAndWait(5000)
            # Observe only after the outcome and process termination are fixed.
            # Never drain a blocked writer into a late startup success.
            if (§null -ne §startObservation -and -not §startObservation.grandFilePresentAtWaitEnd) {
              foreach (§streamName in @('StandardOutput','StandardError')) {
                §sampleState = 'STOP_UNCONFIRMED'; §sampleSize = 0; §sampleText = ''
                try {
                  if (§fixtureStopped) {
                    §sampleBytes = [byte[]]::new(8192); §sampleClock = [Diagnostics.Stopwatch]::StartNew()
                    §sampleTask = §parent.§streamName.BaseStream.ReadAsync(§sampleBytes, 0, §sampleBytes.Length)
                    §sampleState = 'PENDING'
                    while (§sampleClock.ElapsedMilliseconds -lt 200) {
                      if (-not §sampleTask.IsCompleted) { [Threading.Thread]::Sleep(1); continue }
                      §read = §sampleTask.GetAwaiter().GetResult()
                      if (§read -eq 0) { §sampleState = if (§sampleSize -eq 0) { 'EOF_EMPTY' } else { 'EOF_NONEMPTY' }; break }
                      §sampleSize += §read
                      if (§sampleSize -eq §sampleBytes.Length) { §sampleState = 'LIMIT_REACHED'; break }
                      §sampleTask = §parent.§streamName.BaseStream.ReadAsync(§sampleBytes, §sampleSize, §sampleBytes.Length - §sampleSize)
                    }
                    §sampleText = [Text.Encoding]::UTF8.GetString(§sampleBytes, 0, §sampleSize)
                  }
                } catch { §sampleState = 'READ_FAULT' }
                §streamLabel = if (§streamName -ceq 'StandardError') { 'STDERR' } else { 'STDOUT' }
                'M1D_PARENT_STREAM stream=' + §streamLabel + ' state=' + §sampleState + ' sampled=' + §sampleSize + ' clixml=' + [int]§sampleText.Contains('#< CLIXML') + ' progress=' + [int]§sampleText.Contains('S="progress"') + ' error=' + [int]§sampleText.Contains('S="Error"')
              }
            }
          } finally { §parent.Dispose() }
        }
        'T1_PARENT_DISPOSED_JOB_COUNT=' + [Ritomer.M1B.ContainedProcess]::QueryDJob(('Local\Ritomer.M1D.' + §RunId + '.BACKEND'))
        if (-not §root.StartsWith(§tempBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-parent-')) { throw 'FIXTURE_ROOT_INVALID' }
        [IO.Directory]::Delete(§root, §true)
      }
      'M1D_PARENT_DEATH_JOB_ABSENCE_NAMESPACE=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_PARENT_DEATH_JOB_ABSENCE_NAMESPACE=PASS")
    output.lineSequence().filter { it.startsWith("T1_PARENT_") }.forEach(::println)
  }

  @Test
  @Tag("windows-only")
  fun postgresDFrontendCacheJunctionIsRejectedBeforeExcludedCacheIsRead() {
    val output = runRailPowerShell(
      """
      §tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
      §root = Join-Path §tempBase ('m1d-cache-' + [Guid]::NewGuid().ToString('N'))
      §modules = Join-Path §root 'frontend\node_modules'
      §externalCache = Join-Path §root 'synthetic-external-cache'
      §cacheLink = Join-Path §modules '.vite'
      [void][IO.Directory]::CreateDirectory(§modules)
      [void][IO.Directory]::CreateDirectory(§externalCache)
      §sentinel = Join-Path §externalCache 'sentinel.txt'
      [IO.File]::WriteAllText(§sentinel, 'SYNTHETIC_CACHE_MUST_NOT_BE_TOUCHED')
      §script:RepoRoot = §root
      §Mode = 'Preflight'; §LifecycleAction = 'Run'; Start-M1DClock Preflight
      try {
        [void](New-Item -ItemType Junction -Path §cacheLink -Target §externalCache)
        §code = 'NONE'; try { Get-M1DFrontendRuntimeSha256 } catch { §code = Get-M1BStopCode §_ }
        if (§code -cne 'D_VITE_CACHE_LINK_REJECTED') { throw ('CACHE_LINK_NOT_REFUSED:' + §code) }
        if ([IO.File]::ReadAllText(§sentinel) -cne 'SYNTHETIC_CACHE_MUST_NOT_BE_TOUCHED') { throw 'CACHE_TARGET_WAS_CHANGED' }
      } finally {
        if (-not §root.StartsWith(§tempBase, [StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-cache-')) { throw 'FIXTURE_ROOT_INVALID' }
        if ([IO.Directory]::Exists(§cacheLink)) { [IO.Directory]::Delete(§cacheLink, §false) }
        [IO.Directory]::Delete(§root, §true)
      }
      'M1D_CACHE_JUNCTION_REFUSED_WITHOUT_TARGET_EFFECT=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1D_CACHE_JUNCTION_REFUSED_WITHOUT_TARGET_EFFECT=PASS")
  }

  @Test
  fun postgresReviewedDiffAndGitBaselineAreRecomputedWithoutInheritedGitState() {
    val script = postgresRailScriptSource()
    val gitInvoker = script.sliceBetween(
      "function Assert-M1BGitExecutable",
      "function Assert-M1BInvocation"
    )
    val phases = Regex("""Assert-M1BExecutionState \${'$'}root '([^']+)'""")
      .findAll(script)
      .map { it.groupValues[1] }
      .toList()

    assertThat(script).contains(
      "\$script:GitExeExact = 'C:\\Program Files\\Git\\cmd\\git.exe'",
      "\$name.StartsWith('GIT_'",
      "'GIT_CONFIG_NOSYSTEM' = '1'",
      "'GIT_CONFIG_GLOBAL' = 'NUL'",
      "'GIT_OPTIONAL_LOCKS' = '0'",
      "'GIT_TERMINAL_PROMPT' = '0'",
      "\$startInfo.EnvironmentVariables.Clear()",
      "Invoke-M1BGit @('rev-parse', '--show-toplevel')",
      "Invoke-M1BGit @('diff', '--cached', '--name-only')",
      "Invoke-M1BGit @('ls-files', '-v', '-z')",
      "GIT_TRACKED_PATH_FLAGS_INVALID",
      "'update-index', '--add', '--cacheinfo', \$cacheInfo",
      "'100644,e69de29bb2d1d6434b8b29ae775ad8c2e48c5391,' + \$path",
      "'diff', '--binary', '--full-index', '--no-color', '--no-ext-diff', '--no-textconv'",
      "if (\$actualHash -cne \$ReviewedObjectSha256)",
      "REVIEWED_OBJECT_SHA256_DIVERGED"
    )
    assertThat(gitInvoker).doesNotContain("FileName = 'git.exe'")
    assertThat(phases).containsExactly(
      "preflight-initial",
      "preflight-post-readiness",
      "preflight-post-psql",
      "lifecycle-initial",
      "lifecycle-post-readiness",
      "lifecycle-post-provision",
      "lifecycle-post-targeted",
      "lifecycle-post-full",
      "lifecycle-post-cleanup",
      "d-lifecycle-initial",
      "d-lifecycle-post-readiness",
      "d-post-provision",
      "d-post-targeted",
      "d-post-full",
      "d-terminal-state",
      "d-cleanup-only-initial",
      "d-cleanup-only-final"
    )
  }

  @Test
  fun postgresPreflightManifestTextFieldsRejectSingletonArraysOffline() {
    val script = postgresRailScriptSource()
    val manifestReader = script.sliceBetween(
      "function Read-M1BPreflightManifest",
      "function Invoke-M1BPreflightPsql"
    )
    listOf(
      "kind",
      "verdict",
      "runId",
      "reviewedObjectSha256",
      "sensitiveAuthorizationRecordId",
      "branch",
      "head",
      "correctiveFileSet",
      "compositeFileSet",
      "createdAtUtc",
      "readinessOutputSha256",
      "runtimeSha256",
      "structuredOutputSha256",
      "payloadSha256"
    ).forEach { field ->
      assertThat(manifestReader).contains("\$manifest.$field -isnot [string]")
    }
    listOf("path", "sha256", "fileVersion", "productVersion").forEach { field ->
      assertThat(manifestReader).contains("\$manifest.psql.$field -isnot [string]")
    }

    val output = runRailPowerShell(
      """
      §fixture = ConvertFrom-Json '{"kind":["M1B_POSTGRES_PREFLIGHT"]}'
      if (§fixture.kind -is [string] -or (§fixture.kind -isnot [object[]])) {
        throw 'SINGLETON_ARRAY_TYPE_FIXTURE_INVALID'
      }
      'M1B_MANIFEST_STRING_TYPE_FIXTURE=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("M1B_MANIFEST_STRING_TYPE_FIXTURE=PASS")
  }

  @Test
  fun postgresDInitializerProjectsBeforeRefreshAndEffects() {
    for (mode in listOf("seed", "backend")) {
      val environment = canonicalDEnvironment(mode, mapOf(
        "APPDATA" to "synthetic-appdata", "LOCALAPPDATA" to "synthetic-localappdata",
        "USERNAME" to "ritomer-m1b-rail", "USERDOMAIN" to "LOCAL"
      ))
      environment.propertySources.addFirst(MapPropertySource("injected-low-priority", mapOf(
        "spring.datasource.url" to "must-be-replaced",
        "ritomer.security.jwt.hmac-secret" to "must-be-empty",
        "ritomer.demo.seed.enabled" to "wrong"
      )))
      var guardCalls = 0
      var effects = 0
      GenericApplicationContext().use { context ->
        context.environment = environment
        context.addBeanFactoryPostProcessor { effects++ }
        PostgresTestRailDBootstrap.initializer(mode) { guarded ->
          guardCalls++
          assertThat(guarded.isActive).isFalse()
          assertThat(effects).isZero()
          assertThat(guarded.environment.getProperty(DATASOURCE_URL)).isEqualTo(EXPECTED_JDBC_URL)
          assertThat(guarded.environment.getProperty("spring.datasource.hikari.maximum-pool-size")).isEqualTo("2")
          assertThat(guarded.environment.getProperty("spring.datasource.hikari.minimum-idle")).isEqualTo("0")
          assertThat(guarded.environment.getProperty("ritomer.security.jwt.hmac-secret")).isEmpty()
          assertThat(guarded.environment.getProperty("ritomer.security.session.enabled")).isEqualTo("true")
          assertThat(guarded.environment.getProperty("ritomer.demo.seed.enabled")).isEqualTo((mode == "seed").toString())
          assertThat(java.util.logging.Logger.getLogger("org.postgresql").isLoggable(java.util.logging.Level.SEVERE)).isFalse()
        }.initialize(context)
        assertThat(guardCalls).isEqualTo(1)
        context.refresh()
        assertThat(effects).isEqualTo(1)
      }
    }
  }

  @Test
  fun postgresDBootstrapRefusesOverridesBeforeGuardOrRefresh() {
    val rejected = listOf(
      canonicalDEnvironment("seed", mapOf("RITOMER_DB_RAIL_CAMPAIGN" to "B")),
      canonicalDEnvironment("seed", mapOf(DB_TEST_PHASE to "d-backend")),
      canonicalDEnvironment("seed", mapOf("JAVA_TOOL_OPTIONS" to "synthetic")),
      canonicalDEnvironment("seed", mapOf("SPRING_PROFILES_ACTIVE" to "local")),
      canonicalDEnvironment("seed", mapOf("RITOMER_SECURITY_JWT_HMAC_SECRET" to "synthetic")),
      canonicalDEnvironment("seed", systemOverrides = mapOf("spring.config.location" to "file:synthetic")),
      canonicalDEnvironment("seed", systemOverrides = mapOf("server.port" to "8080")),
      canonicalDEnvironment("seed", systemOverrides = mapOf("server.address" to "127.0.0.1")),
      canonicalDEnvironment("seed").apply { setActiveProfiles("local", "test") }
    )
    rejected.forEach { environment ->
      var calls = 0
      GenericApplicationContext().use { context ->
        context.environment = environment
        assertThatThrownBy {
          PostgresTestRailDBootstrap.initializer("seed") { calls++ }.initialize(context)
        }.isInstanceOf(IllegalStateException::class.java)
        assertThat(calls).isZero()
        assertThat(context.isActive).isFalse()
      }
    }
  }

  @Test
  fun postgresDBootstrapRealSpringRefreshWaitsForInitializerGuard() {
    val events = mutableListOf<String>()
    val initializer = PostgresTestRailDBootstrap.initializer("seed") { context ->
      assertThat(context.isActive).isFalse()
      events += "guard"
      context.addBeanFactoryPostProcessor { events += "effect" }
    }
    org.springframework.boot.builder.SpringApplicationBuilder(DOfflineRefreshFixture::class.java)
      .environment(canonicalDEnvironment("seed"))
      .web(org.springframework.boot.WebApplicationType.NONE)
      .initializers(initializer)
      .logStartupInfo(false)
      .run()
      .use { context ->
        assertThat(context.isActive).isTrue()
        assertThat(context.getBean("dOfflineMarker")).isEqualTo("synthetic")
        assertThat(events).containsExactly("guard", "effect")
      }
    events.clear()
    val application = org.springframework.boot.builder.SpringApplicationBuilder(DOfflineRefreshFixture::class.java)
      .environment(canonicalDEnvironment("seed"))
      .web(org.springframework.boot.WebApplicationType.NONE)
      .initializers(PostgresTestRailDBootstrap.initializer("seed") { context ->
        context.addBeanFactoryPostProcessor { events += "forbidden-effect" }
        error("Synthetic identity refusal.")
      })
      .logStartupInfo(false)
    assertThatThrownBy { application.run().close() }.isInstanceOf(IllegalStateException::class.java)
    assertThat(events).isEmpty()
  }

  @org.springframework.boot.test.context.TestConfiguration(proxyBeanMethods = false)
  class DOfflineRefreshFixture {
    @Bean fun dOfflineMarker(): String = "synthetic"
  }

  @Test
  fun postgresDIntegratedResetsRefuseBeforeConnectionOrStorageResolution() {
    listOf("seed", "backend").forEach { mode ->
      val environment = canonicalDEnvironment(mode)
      val fixture = jdbcFixture()
      assertThatThrownBy {
        DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, environment)
      }.isInstanceOf(IllegalStateException::class.java)
      assertThatThrownBy {
        DisposablePostgresTestDatabase.recreatePublicSchemaForFlyway(fixture.dataSource, environment)
      }.isInstanceOf(IllegalStateException::class.java)
      assertThatThrownBy {
        DisposablePostgresTestDatabase.requireRunBoundLocalStorageLeaf(environment)
      }.isInstanceOf(IllegalStateException::class.java)
      assertThat(fixture.state.acquisitionCount).isZero()
      assertThat(fixture.state.destructiveSql).isEmpty()
    }
  }

  @Test
  @Tag("windows-only")
  fun postgresDCommonGuardAndFlywayUseTheProjectedIdentityBeforeEffects() {
    listOf("seed", "backend").forEach { mode ->
      val applicationName = "ritomer-m1-1d-$SYNTHETIC_RUN_ID-d-$mode"
      val provenance = postgresTestRailProvenance(SYNTHETIC_RUN_ID, SYNTHETIC_REVIEWED_OBJECT_SHA256,
        SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER, "D")
      val fixture = jdbcFixture(JdbcOptions(applicationName = applicationName,
        roleProvenance = provenance, databaseProvenance = provenance))
      GenericApplicationContext().use { context ->
        context.environment = canonicalDEnvironment(mode)
        val guard = DisposablePostgresTestDatabaseGuardInitializer { _, properties ->
          assertThat(context.isActive).isFalse()
          assertThat(properties.getProperty("ApplicationName")).isEqualTo(applicationName)
          fixture.dataSource.connection
        }
        PostgresTestRailDBootstrap.initializer(mode, guard).initialize(context)
        assertThat(fixture.state.acquisitionCount).isEqualTo(1)
        assertThat(fixture.state.queryCount).isEqualTo(4)
        assertThat(fixture.state.executeCount).isZero()
        val flyway = org.flywaydb.core.Flyway.configure().dataSource(fixture.dataSource).load()
        DisposablePostgresTestDatabase.assertCanonicalDataSourceAndFlyway(fixture.dataSource, flyway, context.environment)
        assertThat(fixture.state.acquisitionCount).isEqualTo(2)
        val wrong = jdbcFixture()
        assertThatThrownBy {
          DisposablePostgresTestDatabase.assertCanonicalDataSourceAndFlyway(wrong.dataSource, flyway, context.environment)
        }.isInstanceOf(IllegalStateException::class.java)
        assertThat(wrong.state.acquisitionCount).isZero()
      }
      val divergent = jdbcFixture(JdbcOptions(applicationName = applicationName,
        roleProvenance = "divergent", databaseProvenance = provenance))
      GenericApplicationContext().use { context ->
        context.environment = canonicalDEnvironment(mode)
        assertThatThrownBy {
          PostgresTestRailDBootstrap.initializer(mode,
            DisposablePostgresTestDatabaseGuardInitializer { _, _ -> divergent.dataSource.connection }
          ).initialize(context)
        }.isInstanceOf(IllegalStateException::class.java)
        assertThat(context.isActive).isFalse()
        assertThat(divergent.state.executeCount).isZero()
      }
    }
  }

  @Test
  fun postgresDCompiledRuntimeContainsOnlyMainAndClosedSupport() {
    val mapper = com.fasterxml.jackson.module.kotlin.jacksonObjectMapper()
    val manifest = mapper.readTree(Path.of("build/m1d-integrated-runtime.json").toFile())
    assertThat(manifest["schemaVersion"].asInt()).isEqualTo(1)
    val entries = manifest["classpathEntries"].map { Path.of(it.asText()) }
    assertThat(entries).noneSatisfy { path ->
      assertThat(path.toString().replace('\\', '/')).containsAnyOf(
        "/classes/kotlin/test", "/resources/test", "junit", "mockito", "spring-test", "spring-boot-test"
      )
    }
    val owners = setOf("PostgresTestRailDBootstrap", "PostgresTestRailJdbcLogging",
      "DisposablePostgresTestDatabaseGuardInitializer", "DisposablePostgresTestDatabase",
      "DisposablePostgresTestDatabaseSupportKt", "CanonicalRuntimeConfiguration", "StartupDiagnostics",
      "StartupStage", "StartupCategory", "StartupControl", "GuardInvariantFailure", "DestructivePrimitive")
    val classes = manifest["supportClasses"].map { it.asText() }
    assertThat(classes.map { it.substringAfterLast('/').substringBefore('$').removeSuffix(".class") }.toSet())
      .isEqualTo(owners)
    classes.forEach { relative ->
      val compiled = requireNotNull(javaClass.classLoader.getResourceAsStream(relative)).use { it.readAllBytes() }
      assertThat(Files.readAllBytes(entries.last().resolve(relative))).isEqualTo(compiled)
    }
    java.net.URLClassLoader(entries.map { it.toUri().toURL() }.toTypedArray(), ClassLoader.getPlatformClassLoader()).use { loader ->
      classes.forEach { relative ->
        val type = Class.forName(relative.removeSuffix(".class").replace('/', '.'), false, loader)
        type.declaredMethods // resolve referenced types with no test runtime available
      }
      assertThatThrownBy { loader.loadClass("org.junit.jupiter.api.Test") }.isInstanceOf(ClassNotFoundException::class.java)
      assertThatThrownBy { loader.loadClass(javaClass.name) }.isInstanceOf(ClassNotFoundException::class.java)
    }
    val binding = Path.of("build/m1d-integrated-binding.json").readText()
    var equivalentOtherRun = Path.of("build/m1d-integrated-runtime.json").readText()
    manifest["runtimeInputs"].sortedByDescending { it["path"].asText().length }.forEachIndexed { index, input ->
      val encodedRoot = mapper.writeValueAsString(input["path"].asText()).removeSurrounding("\"")
      assertThat(binding).doesNotContain(encodedRoot)
      val otherRoot = "synthetic-readiness-root-$index"
      equivalentOtherRun = equivalentOtherRun.replace(encodedRoot, otherRoot)
        .replace(otherRoot, "<${input["label"].asText()}>")
    }
    val windows = System.getProperty("os.name").startsWith("Windows", ignoreCase = true)
    val expectedLauncher = if (windows) "<integrated-launcher-jdk>" else "<integrated-launcher-executable>"
    val excludedLauncher = if (windows) "<integrated-launcher-executable>" else "<integrated-launcher-jdk>"
    assertThat(binding).contains("<integrated-classpath/", expectedLauncher).doesNotContain(excludedLauncher)
    assertThat(binding).isEqualTo(equivalentOtherRun)
  }

  @Test
  @Tag("windows-only")
  fun postgresDJavaArgumentFileRunsASyntheticMainBeyondWindowsCommandLimit(
    @org.junit.jupiter.api.io.TempDir temporaryRoot: Path
  ) {
    val fixtureRoot = Files.createDirectory(temporaryRoot.resolve("argument file fixture"))
    val classes = Files.createDirectory(fixtureRoot.resolve("compiled classes"))
    val argumentRoot = Files.createDirectory(fixtureRoot.resolve("argument root"))
    val source = fixtureRoot.resolve("M1DArgumentFixture.java")
    Files.writeString(source, """
      public class M1DArgumentFixture {
        public static void main(String[] args) {
          if (args.length != 1 || !args[0].equals("seed")) throw new IllegalArgumentException("synthetic arguments");
          System.out.println("M1D_ARGUMENT_FILE_SYNTHETIC_OK");
        }
      }
    """.trimIndent())
    val compileOutput = java.io.ByteArrayOutputStream()
    val compiler = requireNotNull(javax.tools.ToolProvider.getSystemJavaCompiler())
    assertThat(compiler.run(null, compileOutput, compileOutput, "-d", classes.toString(), source.toString()))
      .describedAs("synthetic JVM fixture compilation: %s", compileOutput.toString(StandardCharsets.UTF_8))
      .isZero()
    val classpath = listOf(classes.toString()) + (0..239).map {
      fixtureRoot.resolve("missing ${"x".repeat(120)} $it").toString()
    }
    assertThat(classpath.joinToString(";").length).isGreaterThan(32767)
    fun ps(value: String) = "'" + value.replace("'", "''") + "'"
    val output = runRailPowerShell("""
      foreach (${'$'}invalid in @("C:\synthetic`nnewline", 'C:\synthetic"quote')) {
        ${'$'}rejected = ${'$'}false
        try { [void](Write-M1DJavaArgumentFile ${ps(argumentRoot.toString())} ([pscustomobject]@{ classpathEntries = @(${'$'}invalid) })) }
        catch { if ((Get-M1BStopCode ${'$'}_) -cne 'D_CLASSPATH_ENTRY_INVALID') { throw }; ${'$'}rejected = ${'$'}true }
        if (-not ${'$'}rejected -or (Test-Path -LiteralPath ${ps(argumentRoot.resolve("java-arguments.txt").toString())})) { throw 'unsafe argument file input accepted' }
      }
      ${'$'}runtime = [pscustomobject]@{ classpathEntries = @(${classpath.joinToString(",", transform = ::ps)}) }
      ${'$'}result = Write-M1DJavaArgumentFile ${ps(argumentRoot.toString())} ${'$'}runtime
      if (${ '$' }result.Sha256 -cne (Get-M1BSha256File ${'$'}result.Path)) { throw 'argument file hash mismatch' }
      if ((Get-Item -LiteralPath ${'$'}result.Path).Length -le 32767) { throw 'argument file fixture too short' }
      Write-Output 'M1D_ARGUMENT_FILE_PREPARED_SYNTHETIC'
    """.trimIndent())
    assertThat(output).contains("M1D_ARGUMENT_FILE_PREPARED_SYNTHETIC")
    val javaExecutable = Path.of(System.getProperty("java.home"), "bin", "java.exe").toRealPath()
    val processBuilder = ProcessBuilder(javaExecutable.toString(),
      "@${argumentRoot.resolve("java-arguments.txt")}", "M1DArgumentFixture", "seed")
      .directory(fixtureRoot.toFile()).redirectErrorStream(true)
    processBuilder.environment().apply {
      clear()
      put("SystemRoot", requireNotNull(System.getenv("SystemRoot")))
      put("TEMP", temporaryRoot.toString())
      put("TMP", temporaryRoot.toString())
    }
    val child = processBuilder.start()
    val captured = java.util.concurrent.CompletableFuture.supplyAsync {
      child.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
    }
    try {
      assertThat(child.waitFor(15, java.util.concurrent.TimeUnit.SECONDS)).isTrue()
      val result = captured.get(5, java.util.concurrent.TimeUnit.SECONDS)
      assertThat(child.exitValue()).describedAs("synthetic JVM argument file result: %s", result).isZero()
      assertThat(result.trim()).isEqualTo("M1D_ARGUMENT_FILE_SYNTHETIC_OK")
    } finally {
      if (child.isAlive) {
        child.destroyForcibly()
        check(child.waitFor(5, java.util.concurrent.TimeUnit.SECONDS))
      }
    }
  }

  private fun canonicalDEnvironment(
    mode: String,
    overrides: Map<String, String?> = emptyMap(),
    systemOverrides: Map<String, String> = emptyMap()
  ): MockEnvironment =
    canonicalEnvironment(mapOf(
      "RITOMER_DB_RAIL_CAMPAIGN" to "D",
      DB_TEST_PHASE to "d-$mode",
      DB_TEST_APPLICATION_NAME to "ritomer-m1-1d-$SYNTHETIC_RUN_ID-d-$mode",
      DB_TEST_STORAGE_LOCAL_ROOT to "$SYNTHETIC_RUN_ROOT\\volatile\\integrated\\local-fs"
    ) + overrides, systemOverrides = systemOverrides).apply { setActiveProfiles("local") }

  @Test
  fun postgresAdminChannelsAreAbsentOutsideNativePsql() {
    val lifecycle = postgresRailLifecycleSource()
    val runtimeGuard = postgresRuntimeGuardSource()
    val backendSource = Files.walk(Path.of(".")).use { paths ->
      paths.asSequence()
        .filter { Files.isRegularFile(it) }
        .filter {
          it.toString().replace('\\', '/').let { path ->
            !path.startsWith("build/") &&
              !path.startsWith("./build/") &&
              !path.startsWith(".gradle/") &&
              (path.endsWith(".kt") || path.endsWith(".kts") || path.endsWith(".java") ||
                path.endsWith(".yml") || path.endsWith(".yaml") || path.endsWith(".properties") ||
                path.endsWith(".ps1") || path.endsWith(".sql") || path.endsWith(".xml"))
          }
        }
        .sortedBy { it.toString() }
        .joinToString("\n") { it.readText() }
        .lowercase()
    }
    val adminCredentialSurface = Files.walk(Path.of(".")).use { paths ->
      paths.asSequence()
        .filter { Files.isRegularFile(it) }
        .filter {
          val path = it.toString().replace('\\', '/').removePrefix("./")
          !path.startsWith("build/") &&
            !path.startsWith(".gradle/") &&
            path != "scripts/m1-1b-postgresql-rail.ps1" &&
            path != "src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt" &&
            (path == "build.gradle.kts" || path.endsWith(".kt") || path.endsWith(".kts") ||
              path.endsWith(".java") || path.endsWith(".yml") || path.endsWith(".yaml") ||
              path.endsWith(".properties") || path.endsWith(".sql") || path.endsWith(".xml"))
        }
        .sortedBy { it.toString() }
        .joinToString("\n") { it.readText() }
        .lowercase()
    }
    val retiredAdminPrefix = ("RITOMER_DB_RAIL_" + "ADMIN_").lowercase()
    val retiredSymbols = listOf(
      "PostgresTestRail" + "Security",
      "PostgresTestRail" + "ArtifactScanner",
      "PostgresTestRail" + "Contamination",
      "PostgresTestRailLifecycle" + "CommandKt",
      "configureM1BPostgresRail" + "Command",
      "RITOMER_DB_RAIL_PROVISIONING_" + "RUNNER_PASSWORD",
      "DB_RAIL_" + "ADMIN",
      "m1BPostgresRail" + "Inspect",
      "m1BPostgresRail" + "InitialInspect",
      "m1BPostgresRail" + "Provision",
      "m1BPostgresRail" + "Cleanup"
    ).map(String::lowercase)

    assertThat(backendSource).doesNotContain(retiredAdminPrefix)
    assertThat(backendSource).doesNotContain(*retiredSymbols.toTypedArray())
    val forbiddenCredentialChannels = listOf(
      "PG" + "PASSWORD",
      "PG" + "PASSFILE",
      "PG" + "SERVICE",
      "PG" + "SERVICEFILE",
      "PG" + "OPTIONS",
      "PG" + "HOST",
      "PG" + "HOSTADDR",
      "PG" + "PORT",
      "PG" + "DATABASE",
      "PG" + "USER",
      "SPRING_FLYWAY_" + "URL",
      "SPRING_FLYWAY_" + "USER",
      "SPRING_FLYWAY_" + "PASSWORD",
      "FLYWAY_" + "URL",
      "FLYWAY_" + "USER",
      "FLYWAY_" + "PASSWORD"
    ).map(String::lowercase)
    assertThat(adminCredentialSurface).doesNotContain(*forbiddenCredentialChannels.toTypedArray())
    val credentialedJdbcMatches = Regex(
      """jdbc:postgresql:[^\s"']*(?:[?&](?:user|password)=|//[^/\s:@]+:[^@\s/]+@)"""
    ).findAll(adminCredentialSurface).map { it.value }.toList()
    assertThat(credentialedJdbcMatches).containsExactly("jdbc:postgresql://user:password@")
    assertThat(Path.of("src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalActivationTest.kt").readText())
      .contains(
        "seed refuses explicit activation with non local or prod like datasource targets",
        "jdbc:postgresql://user:password@localhost:5432/ritomer"
      )
    assertThat(
      Regex(
        """(?:admin(?:istrator)?|superuser|postgres)[_-]?(?:password|secret|credential|username)|""" +
          """(?:password|secret|credential|username)[_-]?(?:admin(?:istrator)?|superuser|postgres)"""
      ).find(adminCredentialSurface)
    ).isNull()
    assertThat(lifecycle).contains("internal object PostgresTestRailJdbcLogging", "internal object PostgresTestRailDBootstrap",
      "DisposablePostgresTestDatabaseGuardInitializer()", "DisposablePostgresTestDatabase.assertCanonicalDataSourceAndFlyway(",
      ".initializers(initializer(mode))", ".run()", "MapPropertySource(\"m1d-closed-runtime\"")
    assertThat(lifecycle).doesNotContain(
      "DriverManager",
      "java.sql",
      "CREATE ROLE",
      "DROP DATABASE",
      "SCRAM-SHA-256"
    )
    assertThat(Regex("""\bfun main\(""").findAll(lifecycle).count()).isEqualTo(1)
    assertThat(
      Regex("""PostgresTestRailJdbcLogging\.disableAndVerifyForTest\(\)""")
        .findAll(runtimeGuard)
        .count()
    ).isEqualTo(3)
  }

  @Test
  fun postgresPostmasterBindingIsPhaseBoundThroughGradleAndLifecycleManifest() {
    val build = postgresRailBuildSource()
    val script = postgresRailScriptSource()
    val constant = "DB_RAIL_POSTMASTER_START_UNIX_MICROS_ENV"
    assertThat(build).contains("val $constant = \"$DB_RAIL_POSTMASTER_START_UNIX_MICROS\"")
    assertThat(build.sliceBetween("val DB_RAIL_COMMON_ENV = setOf(", "val DB_RAIL_TEST_ENV"))
      .contains(constant)
    val readiness = build.sliceBetween("tasks.register(\"m1BPostgresRailReadiness\")", "fun Test.configureM1BPostgresRailTest")
    assertThat(readiness).doesNotContain(constant)
    assertThat(readiness).contains(
      "requireClosedPostgresRailEnvironment(",
      "setOf(DB_RAIL_BUILD_ROOT_ENV, DB_RAIL_RUN_ID_ENV, DB_RAIL_RUN_ROOT_ENV, DB_RAIL_REVIEWED_OBJECT_SHA256_ENV, DB_RAIL_CAMPAIGN_ENV)"
    )
    val phases = build.sliceBetween("fun Test.configureM1BPostgresRailTest", "tasks.register<Test>(\"m1BPostgresRailTargeted\")")
    assertThat(phases).contains(
      constant,
      "requireNonBlankEnvironment($constant)",
      "postmasterStartUnixMicros.toLongOrNull()?.let { it > 0L } != true",
      "setEnvironment(allowlistedEnvironment(DB_RAIL_COMMON_ENV + DB_RAIL_TEST_ENV + DB_RAIL_OS_ENV))"
    )
    assertThat(phases).contains("Regex(\"\\\\A[1-9][0-9]{0,18}\\\\z\")")
    val preflight = script.sliceBetween("function Invoke-M1BPreflight {", "function Invoke-M1BLifecycle {")
    assertThat(preflight).doesNotContain("PostmasterStartUnixMicros", "postmasterStartUnixMicros", DB_RAIL_POSTMASTER_START_UNIX_MICROS)
    val lifecycle = script.sliceBetween("function Invoke-M1BLifecycle {", "function Start-M1DClock {")
    assertThat(Regex(Regex.escape("\$provision.PostmasterStartUnixMicros")).findAll(lifecycle).count()).isEqualTo(3)
    assertThat(lifecycle).contains("postmasterStartUnixMicros = \$provision.PostmasterStartUnixMicros")
    val lifecycleCalls = lifecycle.lines().filter { it.contains("\$readiness.Result.RuntimeSha256 \$cluster \$databaseOid \$roleOid") }
    assertThat(lifecycleCalls).hasSize(2).allSatisfy { line ->
      assertThat(line.trimEnd()).endsWith("\$provision.PostmasterStartUnixMicros")
    }
    val integrated = script.sliceBetween("function Start-M1DIntegratedChild {", "function Invoke-M1DIntegrated {")
    assertThat(integrated).contains("RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS = \$Provision.PostmasterStartUnixMicros")
    val dLifecycle = script.sliceBetween("function Invoke-M1DLifecycle {", "function Invoke-M1DCleanupOnly {")
    assertThat(dLifecycle).contains("postmasterStartUnixMicros = \$provision.PostmasterStartUnixMicros")
    val dCalls = dLifecycle.lines().filter { it.contains("Invoke-M1BTestPhase ") }
    assertThat(dCalls).hasSize(2).allSatisfy { line ->
      assertThat(line.trimEnd()).endsWith("\$provision.PostmasterStartUnixMicros")
    }
    val mainParameters = script.substringBefore("$" + "script:PsqlExeExact")
    assertThat(mainParameters).doesNotContain("PostmasterStartUnixMicros", DB_RAIL_POSTMASTER_START_UNIX_MICROS)
  }

  @Test
  fun postgresGradleTasksAndLeanDocumentationAreExact() {
    val buildScript = postgresRailBuildSource()
    val portableTestBlock = buildScript.sliceBetween(
      """tasks.named<Test>("test")""",
      """tasks.register<Test>("windowsTest")"""
    )
    val windowsTestBlock = buildScript.sliceBetween(
      """tasks.register<Test>("windowsTest")""",
      """tasks.register<Test>("dbIntegrationTest")"""
    )
    assertThat(portableTestBlock)
      .contains("""excludeTags("db-integration", "windows-only")""")
      .doesNotContain("includeTags", "onlyIf", "ignoreFailures")
    assertThat(windowsTestBlock).contains(
      "testClassesDirs = testSourceSet.output.classesDirs",
      "classpath = testSourceSet.runtimeClasspath",
      """shouldRunAfter(tasks.named("test"))""",
      """includeTags("windows-only")""",
      """excludeTags("db-integration")""",
      "doFirst {",
      """if (!System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {""",
      "throw GradleException("
    ).doesNotContain("onlyIf", "ignoreFailures", "dbIntegrationTest", "m1BPostgresRail")
    val railScript = postgresRailScriptSource()
    val registrations = Regex(
      """tasks\.register(?:<[^>]+>)?\("(m1BPostgresRail[^"]+)"\)"""
    ).findAll(buildScript).map { it.groupValues[1] }.toList()
    val railIdentifierCounts = Regex("""\bm1BPostgresRail[A-Za-z0-9_]*\b""")
      .findAll(buildScript)
      .map { it.value }
      .groupingBy(String::toString)
      .eachCount()
    val dbIntegrationBlock = buildScript.sliceBetween(
      """tasks.register<Test>("dbIntegrationTest")""",
      "val m1BPostgresRailTargetedClasses"
    )
    val gradleInvoker = railScript.sliceBetween(
      "function Invoke-M1BGradleTask",
      "function Invoke-M1BReadiness"
    )
    val testPhase = railScript.sliceBetween(
      "function Invoke-M1BTestPhase",
      "function Invoke-M1BPreflight"
    )
    val runnerTaskGraph = buildScript.sliceBetween(
      "gradle.taskGraph.whenReady",
      "tasks.register<Test>(\"offlineMappingEval042a2\")"
    )
    assertThat(runnerTaskGraph).contains(
      "(taskNames.contains(\"m1BPostgresRailReadiness\") || taskNames.any(runnerCredentialTasks::contains)) &&",
      "System.getenv().keys.any { it.equals(DB_TEST_PASSWORD_ENV, ignoreCase = true) }",
      "PostgreSQL runner credentials must never reach compilation or resource processing."
    )
    val runbook = Path.of("../runbooks/local-dev.md").readText()
    val specPaths = listOf("active", "done").map {
      Path.of("../specs/$it/046-authenticated-session-foundation-v1.md")
    }.filter(Files::isRegularFile)
    assertThat(specPaths).hasSize(1)
    val spec = specPaths.single().readText()
    val correctiveFileSet = powershellLiteralArray(railScript, "CorrectiveFileSet")
    val expectedAddedFileSet = powershellLiteralArray(railScript, "ExpectedAddedFileSet")
    val compositeFileSet = powershellLiteralArray(railScript, "CompositeFileSet")
    val durableMarkers = listOf(
      "M1_1B_POSTGRESQL_RAIL_DELTA=A2_M4_R0_D0_TOTAL6",
      "M1_1B_POSTGRESQL_RAIL_COMPOSITE=A8_M17_R0_D0_TOTAL25",
      "M1_1B_POSTGRESQL_RAIL_OVERLAPS_WITH_B=1",
      "M1_1B_POSTGRESQL_RAIL_MODES=PREFLIGHT_LIFECYCLE_ONLY",
      "M1_1B_POSTGRESQL_ADMIN_CLIENT=PSQL_17_DIRECT",
      "ADMIN_SECRET_VISIBLE_TO_GRADLE=NO",
      "ADMIN_SECRET_VISIBLE_TO_JAVA=NO",
      "GRADLE_RAIL_TASKS=READINESS_TARGETED_FULL_ONLY",
      "PSQL_PHASE_PROCESS_COUNTS=PREFLIGHT_1_PROVISION_1_CLEANUP_1",
      "POSTGRESQL_CONNECTION=NOT_EXECUTED_NOT_AUTHORIZED",
      "PREFLIGHT_EXECUTED=NO",
      "LIFECYCLE_EXECUTED=NO",
      "DB_INTEGRATION_TEST_EXECUTED=NO",
      "POSTGRESQL_RAIL_TECHNICAL_STATUS=INCONCLUSIVE_PENDING_DB_EXECUTION"
    )

    assertThat(registrations).containsExactlyInAnyOrder(
      "m1BPostgresRailReadiness",
      "m1BPostgresRailTargeted",
      "m1BPostgresRailFull"
    )
    assertThat(railIdentifierCounts).isEqualTo(
      mapOf(
        "m1BPostgresRailDetachedRuntimeClasspath" to 2,
        "m1BPostgresRailDetachedTestClassesDirs" to 2,
        "m1BPostgresRailFull" to 3,
        "m1BPostgresRailFullClasses" to 3,
        "m1BPostgresRailJavaLauncher" to 6,
        "m1BPostgresRailReadiness" to 2,
        "m1BPostgresRailRequiredCompiledClasses" to 2,
        "m1BPostgresRailRuntimeClasspathFiles" to 3,
        "m1BPostgresRailRuntimeInputs" to 4,
        "m1BPostgresRailTargeted" to 3,
        "m1BPostgresRailTargetedClasses" to 3
      )
    )
    assertThat(Regex("""\bdbIntegrationTest\b""").findAll(buildScript).count()).isEqualTo(7)
    assertThat(buildScript).doesNotContain("tasks.create", "by tasks.registering")
    assertThat(correctiveFileSet).containsExactly(
      "backend/scripts/m1-1b-postgresql-rail.ps1",
      "backend/build.gradle.kts",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt",
      "runbooks/local-dev.md",
      "specs/active/046-authenticated-session-foundation-v1.md"
    )
    assertThat(expectedAddedFileSet).containsExactly(
      "backend/scripts/m1-1b-postgresql-rail.ps1",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/SessionAuthenticationService.kt",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SessionSecurityKernel.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt",
      "contracts/openapi/auth-session-api.yaml",
      "docs/adr/0007-authenticated-session-boundary.md"
    )
    assertThat(compositeFileSet).containsExactly(
      "backend/build.gradle.kts",
      "backend/scripts/m1-1b-postgresql-rail.ps1",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalService.kt",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/identity/api/SessionController.kt",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/identity/application/SessionAuthenticationService.kt",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfig.kt",
      "backend/src/main/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SessionSecurityKernel.kt",
      "backend/src/main/resources/application-dbtest.yml",
      "backend/src/main/resources/application.yml",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/DocumentsDbIntegrationTest.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/identity/api/LocalTestSessionControllerSecurityTest.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/shared/infrastructure/security/SecurityConfigJwtValidationTest.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt",
      "backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt",
      "contracts/openapi/auth-session-api.yaml",
      "docs/adr/0007-authenticated-session-boundary.md",
      "docs/present/ai-cadrage-v1.md",
      "docs/present/architecture-cadrage-v1.md",
      "docs/present/ux-cadrage-v1.md",
      "docs/product/v1-plan.md",
      "runbooks/local-dev.md",
      "specs/active/046-authenticated-session-foundation-v1.md"
    )
    assertThat(buildScript).contains(
      """configureM1BPostgresRailTest("targeted", m1BPostgresRailTargetedClasses, 13)""",
      """configureM1BPostgresRailTest("full", m1BPostgresRailFullClasses, 55)"""
    )
    assertThat(dbIntegrationBlock).doesNotContain(
      "m1BPostgresRailReadiness",
      "m1BPostgresRailTargeted",
      "m1BPostgresRailFull"
    )
    assertThat(railScript).doesNotContain("dbIntegrationTest")
    assertThat(
      Regex("""(?s)(?:dependsOn|finalizedBy|mustRunAfter|shouldRunAfter)\s*\([^)]*dbIntegrationTest""")
        .find(buildScript)
    ).isNull()
    assertThat(gradleInvoker).contains(
      "\$startInfo.EnvironmentVariables.Clear()",
      "GRADLE_CHILD_ENVIRONMENT_ALLOWLIST_MISMATCH",
      "'--no-daemon'",
      "'--no-build-cache'",
      "'--project-dir'",
      "\$startInfo.WorkingDirectory = \$neutral.Root",
      "'-XX:ErrorFile=' + (Join-Path \$neutral.Root 'hs_err_pid%p.log')",
      "'-Pkotlin.compiler.execution.strategy=in-process'",
      "RUNNER_SECRET_OUTPUT_CONTAMINATION"
    )
    assertThat(testPhase).contains(
      "-ForbiddenLiteral \$RunnerPassword",
      "'RITOMER_DB_TEST_PASSWORD' = \$RunnerPassword",
      "finally",
      "Assert-M1BRunnerSecretAbsentFromTree \$Root \$RunnerPassword"
    )
    assertAppearsInOrder(
      gradleInvoker,
      "\$startInfo.EnvironmentVariables.Clear()",
      "[Ritomer.M1B.ContainedProcess]::Start(\$startInfo)",
      "RUNNER_SECRET_OUTPUT_CONTAMINATION",
      "if (\$process.ExitCode -ne 0)"
    )
    assertThat(buildScript).contains(
      "setEnvironment(allowlistedEnvironment(DB_RAIL_COMMON_ENV + DB_RAIL_TEST_ENV + DB_RAIL_OS_ENV))",
      "javaLauncher.set(m1BPostgresRailJavaLauncher)",
      "File(System.getProperty(\"java.home\"))",
      "m1BPostgresRailJavaLauncher.get().metadata.installationPath.asFile",
      "\"classpath/\${index.toString().padStart(5, '0')}\" to file",
      "RailRuntimeFile(label, relativePath, normalized)",
      "postgresRailRuntimeSha256(m1BPostgresRailRuntimeInputs.get())",
      "M1B_POSTGRES_RAIL_RUNTIME_SHA256_VERIFIED=",
      "M1B_POSTGRES_RAIL_RUNTIME_SHA256_REVALIDATED=",
      "reports.junitXml.includeSystemOutLog.set(false)",
      "reports.junitXml.includeSystemErrLog.set(false)",
      "-XX:ErrorFile=\${crashRoot.resolve(\"hs_err_pid%p.log\")}",
      "-XX:HeapDumpPath=\${crashRoot.resolve(\"heapdump_pid%p.hprof\")}",
      "-XX:-HeapDumpOnOutOfMemoryError",
      "workingDir(crashRoot)"
    )
    assertThat(railScript).contains(
      "'readinessOutputSha256', 'runtimeSha256', 'psql'",
      "runtimeSha256 = \$readiness.Result.RuntimeSha256",
      "\$preflight.Value.runtimeSha256 -cne [string]\$readiness.Result.RuntimeSha256",
      "\$preflight.Value.psql.sha256 -cne \$ExpectedPsqlSha256",
      "provisionPsqlSha256 = \$provision.PsqlSha256",
      "cleanupPsqlSha256 = \$cleanup.PsqlSha256",
      "'^[0-9a-f]{64}\\n\\z'"
    )
    assertThat(buildScript).doesNotContain(
      "systemProperty(DB_TEST_PASSWORD_ENV",
      "args(DB_TEST_PASSWORD_ENV",
      "jvmArgs(DB_TEST_PASSWORD_ENV"
    )
    assertThat(runnerTaskGraph).contains(
      "val runnerCredentialTasks = setOf(\"m1BPostgresRailTargeted\", \"m1BPostgresRailFull\")",
      "providers.gradleProperty(\"kotlin.compiler.execution.strategy\").orNull != \"in-process\"",
      "compileOrResourceTasks.isNotEmpty()"
    )
    durableMarkers.forEach { marker ->
      assertThat(runbook).contains(marker)
      assertThat(spec).contains(marker)
    }
    assertThat(runbook).contains(
      "\$preflightAuthorizationRecordId",
      "\$lifecycleAuthorizationRecordId",
      "-PreflightAuthorizationRecordId \$preflightAuthorizationRecordId",
      "C:\\Program Files\\Git\\cmd\\git.exe",
      "Job Object"
    )
    assertThat(spec).contains(
      "Preflight et Lifecycle exigent deux records d'autorisation sensible distincts.",
      "ReviewedObjectSha256",
      "kill-on-close"
    )
    val specCorrectiveRows = Regex("""(?m)^\| ([AM]) \| `([^`]+)` \|$""")
      .findAll(spec.sliceBetween("M1_1B_POSTGRESQL_RAIL_DELTA", "L'unique overlap"))
      .map { "${it.groupValues[1]}:${it.groupValues[2]}" }
      .toList()
    assertThat(specCorrectiveRows).containsExactly(
      "A:backend/scripts/m1-1b-postgresql-rail.ps1",
      "A:backend/src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt",
      "M:backend/build.gradle.kts",
      "M:backend/src/test/kotlin/ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest.kt",
      "M:runbooks/local-dev.md",
      "M:specs/active/046-authenticated-session-foundation-v1.md"
    )
  }

  @Test
  fun `structural scanner covers the exact destructive integration test inventory`() {
    val compiledClasses = compiledProjectTestClasses()
    val dbTests = compiledClasses.filter { it.tags.contains(DB_INTEGRATION_TAG) }
    val actualClasses = dbTests.map(CompiledClassFacts::simpleName).sorted()
    val classesWithInitializer = dbTests.count { facts ->
      facts.contextInitializers == listOf(GUARD_INITIALIZER_INTERNAL_NAME)
    }
    val classesWithEnableCondition = dbTests.count { facts ->
      facts.enabledEnvironmentConditions == listOf(
        EnabledEnvironmentCondition(DB_TESTS_ENABLED, CASE_INSENSITIVE_TRUE_PATTERN)
      )
    }
    val classesUsingTruncate = dbTests.count { it.calls(TRUNCATE_METHOD_NAME) }
    val authoritativeClasses = compiledClasses.filter { facts ->
      facts.tags.contains(DB_INTEGRATION_TAG) ||
        facts.internalName in setOf(SUPPORT_INTERNAL_NAME, SUPPORT_FILE_INTERNAL_NAME)
    }
    val scannableClasses = authoritativeClasses.filterNot { facts ->
      facts.internalName in setOf(SUPPORT_INTERNAL_NAME, SUPPORT_FILE_INTERNAL_NAME) ||
        facts.isScannerImplementationClass()
    }
    val schemaRecreateClasses = scannableClasses
      .filter { it.calls(RECREATE_SCHEMA_METHOD_NAME) }
      .map(CompiledClassFacts::simpleName)
      .sorted()
    val truncateClasses = scannableClasses
      .filter { it.calls(TRUNCATE_METHOD_NAME) }
      .map(CompiledClassFacts::simpleName)
      .sorted()
    val destructiveSql = compiledDestructiveSqlCounts(scannableClasses)
    val deletePolicy = compiledDeleteProbePolicy(
      authoritativeClasses,
      ALLOWED_APPEND_ONLY_DELETE_PROBES
    )
    val flywayClean = scannableClasses.count { facts ->
      facts.methodCalls.any { call -> call.owner == FLYWAY_INTERNAL_NAME && call.name == "clean" }
    }
    val authMeFacts = compiledClasses.single {
      it.internalName == AUTH_ME_DB_TEST_INTERNAL_NAME
    }

    assertThat(actualClasses).containsExactlyElementsOf(EXPECTED_DB_INTEGRATION_CLASSES.sorted())
    assertThat(dbTests).hasSize(12)
    assertThat(classesWithInitializer).isEqualTo(12)
    assertThat(classesWithEnableCondition).isEqualTo(12)
    assertThat(classesUsingTruncate).isEqualTo(12)
    assertThat(truncateClasses).containsExactlyElementsOf(EXPECTED_DB_INTEGRATION_CLASSES.sorted())
    assertThat(schemaRecreateClasses).containsExactly(
      "DocumentsDbIntegrationTest",
      "ExportsDbIntegrationTest"
    )
    assertThat(destructiveSql.total).isZero()
    assertThat(deletePolicy.violations).isEmpty()
    assertThat(deletePolicy.targetedProbeCount).isEqualTo(2)
    assertThat(deletePolicy.exportPackProbePassed).isTrue()
    assertThat(deletePolicy.auditEventProbePassed).isTrue()
    assertThat(deletePolicy.unexpectedDeleteCount).isZero()
    assertThat(deletePolicy.deleteSqlInsideSupport).isZero()
    assertThat(deletePolicy.unresolvedSqlSinkCount).isZero()
    assertThat(deletePolicy.unsafeSqlMethodCount).isZero()
    assertThat(deletePolicy.sqlCommentSurfaceCount).isZero()
    assertThat(flywayClean).isZero()
    assertThat(authMeFacts.autoConfigureMockMvcPresent).isTrue()
    assertThat(authMeFacts.mockMvcPrint).isEqualTo("NONE")
    assertThat(authMeFacts.mockMvcPrintOnlyOnFailure).isFalse()

    println("db_integration_classes=${dbTests.size}")
    println("classes_with_initializer=$classesWithInitializer")
    println("classes_with_case_insensitive_enable_condition=$classesWithEnableCondition")
    println("classes_using_truncate_primitive=$classesUsingTruncate")
    println("classes_using_schema_recreate_primitive=${schemaRecreateClasses.size}")
    println("raw_truncate_outside_support=${destructiveSql.truncate}")
    println("raw_drop_schema_outside_support=${destructiveSql.dropSchema}")
    println("raw_create_schema_outside_support=${destructiveSql.createSchema}")
    println("raw_drop_database_outside_support=${destructiveSql.dropDatabase}")
    println("raw_drop_table_outside_support=${destructiveSql.dropTable}")
    println("raw_drop_owned_outside_support=${destructiveSql.dropOwned}")
    println("targeted_append_only_delete_probes=${deletePolicy.targetedProbeCount}")
    println("delete_probe_export_pack=${if (deletePolicy.exportPackProbePassed) "PASS" else "FAIL"}")
    println("delete_probe_audit_event=${if (deletePolicy.auditEventProbePassed) "PASS" else "FAIL"}")
    println("unexpected_delete_outside_support=${deletePolicy.unexpectedDeleteCount}")
    println("delete_sql_inside_support=${deletePolicy.deleteSqlInsideSupport}")
    println("unresolved_sql_sinks=${deletePolicy.unresolvedSqlSinkCount}")
    println("unsafe_sql_methods=${deletePolicy.unsafeSqlMethodCount}")
    println("sql_comment_surfaces=${deletePolicy.sqlCommentSurfaceCount}")
    println("flyway_clean=$flywayClean")
    println("runner_explicit_memberships=ZERO_REQUIRED")
    println("mockmvc_print=${authMeFacts.mockMvcPrint}")
    println("mockmvc_print_only_on_failure=${authMeFacts.mockMvcPrintOnlyOnFailure}")
  }

  @Test
  fun `compiled scanner rejects adversarial classes and ignores comments and marker strings`() {
    val nominal = scanCompiledClass(syntheticDbClass("fixture/Nominal"))
    assertThat(
      validateSyntheticCompiledSafety(listOf(nominal), setOf("Nominal"))
    ).isEmpty()
    assertThat(nominal.tags).containsExactly(DB_INTEGRATION_TAG)

    val secondTaggedClass = scanCompiledClass(syntheticDbClass("fixture/SecondTagged"))
    assertThat(
      validateSyntheticCompiledSafety(
        listOf(nominal, secondTaggedClass),
        setOf("Nominal")
      )
    ).contains("DB_INTEGRATION_INVENTORY")

    val initializerCommentOnly = scanCompiledClass(
      syntheticDbClass(
        "fixture/InitializerCommentOnly",
        initializer = false,
        strings = listOf("DisposablePostgresTestDatabaseGuardInitializer")
      )
    )
    assertThat(
      validateSyntheticCompiledSafety(
        listOf(initializerCommentOnly),
        setOf("InitializerCommentOnly")
      )
    ).contains("MISSING_EXACT_INITIALIZER")

    val primitiveStringOnly = scanCompiledClass(
      syntheticDbClass(
        "fixture/PrimitiveStringOnly",
        truncateCall = false,
        strings = listOf("DisposablePostgresTestDatabase.truncateAllCurrentTables")
      )
    )
    assertThat(
      validateSyntheticCompiledSafety(listOf(primitiveStringOnly), setOf("PrimitiveStringOnly"))
    ).contains("MISSING_TRUNCATE_CALL")

    val destructiveSqlCases = listOf(
      "ConcatenatedTruncate" to listOf("TRUNCATE ", "TABLE synthetic_table"),
      "MixedCaseTruncate" to listOf("tRuNcAtE TaBlE synthetic_table"),
      "MultilineDrop" to listOf("DROP\nSCHEMA public"),
      "SpacedCreate" to listOf("CREATE     SCHEMA public"),
      "DirectJdbcDropTable" to listOf("DROP TABLE synthetic_table")
    )
    destructiveSqlCases.forEach { (name, fragments) ->
      val facts = scanCompiledClass(
        syntheticDbClass("fixture/$name", strings = fragments, jdbcCall = true)
      )
      assertThat(validateSyntheticCompiledSafety(listOf(facts), setOf(name)))
        .anyMatch { it.startsWith("RAW_DESTRUCTIVE_SQL") }
    }

    val noInitializer = scanCompiledClass(
      syntheticDbClass("fixture/NoInitializer", initializer = false)
    )
    assertThat(validateSyntheticCompiledSafety(listOf(noInitializer), setOf("NoInitializer")))
      .contains("MISSING_EXACT_INITIALIZER")

    val noGuardedPrimitive = scanCompiledClass(
      syntheticDbClass("fixture/NoGuardedPrimitive", truncateCall = false)
    )
    assertThat(validateSyntheticCompiledSafety(listOf(noGuardedPrimitive), setOf("NoGuardedPrimitive")))
      .contains("MISSING_TRUNCATE_CALL")

    val unexpectedThirteenth = (1..13).map { index ->
      scanCompiledClass(syntheticDbClass("fixture/Inventory$index"))
    }
    assertThat(
      validateSyntheticCompiledSafety(
        unexpectedThirteenth,
        (1..12).mapTo(mutableSetOf()) { "Inventory$it" }
      )
    ).contains("DB_INTEGRATION_INVENTORY")

    val unauthorizedRecreate = scanCompiledClass(
      syntheticDbClass("fixture/UnauthorizedRecreate", recreateCall = true)
    )
    assertThat(
      validateSyntheticCompiledSafety(
        listOf(unauthorizedRecreate),
        setOf("UnauthorizedRecreate")
      )
    ).contains("UNAUTHORIZED_SCHEMA_RECREATE_CALL")
  }

  @Test
  fun `compiled delete scanner accepts only the two exact append only probes`() {
    fun compiledProbe(
      internalName: String,
      sqlCalls: List<SyntheticSqlCall> = emptyList(),
      strings: List<String> = emptyList(),
      storedStrings: List<String> = emptyList(),
      fieldStrings: List<String> = emptyList(),
      tagged: Boolean = true
    ): CompiledClassFacts = scanCompiledClass(
      syntheticDbClass(
        internalName = internalName,
        tagged = tagged,
        initializer = tagged,
        enableCondition = tagged,
        truncateCall = tagged,
        strings = strings,
        storedStrings = storedStrings,
        fieldStrings = fieldStrings,
        sqlCalls = sqlCalls
      )
    )

    fun exportProbe(
      strings: List<String> = listOf("delete from export_pack where id = ?"),
      owner: String = JDBC_TEMPLATE_INTERNAL_NAME,
      name: String = "update",
      descriptor: String = JDBC_TEMPLATE_UPDATE_DESCRIPTOR
    ) = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      sqlCalls = listOf(SyntheticSqlCall(strings, owner, name, descriptor))
    )

    fun auditProbe(
      strings: List<String> = listOf("delete from audit_event where id = ?"),
      owner: String = JDBC_TEMPLATE_INTERNAL_NAME,
      name: String = "update",
      descriptor: String = JDBC_TEMPLATE_UPDATE_DESCRIPTOR
    ) = compiledProbe(
      PERSISTENCE_DB_TEST_INTERNAL_NAME,
      sqlCalls = listOf(SyntheticSqlCall(strings, owner, name, descriptor))
    )

    fun policy(vararg classes: CompiledClassFacts): DeleteProbePolicyResult =
      compiledDeleteProbePolicy(classes.toList(), ALLOWED_APPEND_ONLY_DELETE_PROBES)

    val nominal = policy(exportProbe(), auditProbe())
    assertThat(nominal.violations).isEmpty()
    assertThat(nominal.targetedProbeCount).isEqualTo(2)
    assertThat(nominal.unexpectedDeleteCount).isZero()
    assertThat(nominal.deleteSqlInsideSupport).isZero()

    val thirdDelete = compiledProbe(
      "fixture/ThirdDelete",
      sqlCalls = listOf(SyntheticSqlCall(listOf("delete from export_pack where id = ?")))
    )
    assertThat(policy(exportProbe(), auditProbe(), thirdDelete).violations)
      .contains("UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val exportInAnotherClass = compiledProbe(
      "fixture/ExportDeleteInAnotherClass",
      sqlCalls = listOf(SyntheticSqlCall(listOf("delete from export_pack where id = ?")))
    )
    assertThat(policy(exportInAnotherClass, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val auditInAnotherClass = compiledProbe(
      "fixture/AuditDeleteInAnotherClass",
      sqlCalls = listOf(SyntheticSqlCall(listOf("delete from audit_event where id = ?")))
    )
    assertThat(policy(exportProbe(), auditInAnotherClass).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    assertThat(policy(exportProbe(listOf("delete from export_pack")), auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(policy(exportProbe(), auditProbe(listOf("delete from audit_event"))).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(exportProbe(listOf("delete from export_pack where tenant_id = ?")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(policy(exportProbe(listOf("delete from export_pack where id")), auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(policy(exportProbe(listOf("delete from tenant where id = ?")), auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(exportProbe(listOf("delete from export_pack where id = ?; select 1")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(exportProbe(listOf("delete from ", "export_pack where id = ?")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(
        exportProbe(descriptor = "(Ljava/lang/String;)I"),
        auditProbe()
      ).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(
        exportProbe(
          owner = "java/sql/Statement",
          name = "executeUpdate",
          descriptor = "(Ljava/lang/String;)I"
        ),
        auditProbe()
      ).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(
      policy(
        exportProbe(
          owner = "java/sql/Connection",
          name = "prepareStatement",
          descriptor = "(Ljava/lang/String;)Ljava/sql/PreparedStatement;"
        ),
        auditProbe()
      ).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val supportDelete = compiledProbe(
      SUPPORT_INTERNAL_NAME,
      fieldStrings = listOf("delete from export_pack where id = ?"),
      tagged = false
    )
    assertThat(policy(exportProbe(), auditProbe(), supportDelete).violations)
      .contains("DELETE_SQL_INSIDE_SUPPORT")

    assertThat(
      policy(exportProbe(listOf("delete from export_pack", "WHERE id = ?")), auditProbe()).violations
    ).contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val exportConstantOnly = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?")
    )
    assertThat(policy(exportConstantOnly, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val discardedDeleteBeforeUnrelatedSink = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table set value = ?"))
      )
    )
    assertThat(policy(discardedDeleteBeforeUnrelatedSink, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val storedDeleteBeforeUnrelatedSink = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      storedStrings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table set value = ?"))
      )
    )
    assertThat(policy(storedDeleteBeforeUnrelatedSink, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val fieldDeleteBeforeUnrelatedSink = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      fieldStrings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table set value = ?"))
      )
    )
    assertThat(policy(fieldDeleteBeforeUnrelatedSink, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val dynamicArgumentAfterUnusedDelete = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(
        SyntheticSqlCall(listOf("update another_table ", "set value = ?"))
      )
    )
    assertThat(policy(dynamicArgumentAfterUnusedDelete, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val unknownArgumentAfterUnusedDelete = compiledProbe(
      EXPORTS_DB_TEST_INTERNAL_NAME,
      strings = listOf("delete from export_pack where id = ?"),
      sqlCalls = listOf(SyntheticSqlCall(emptyList()))
    )
    assertThat(policy(unknownArgumentAfterUnusedDelete, auditProbe()).violations)
      .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")

    val structuralVariations = listOf(
      "delete from export_pack where id = ? or tenant_id = ?",
      "delete from export_pack where id = ? and tenant_id = ?",
      "delete from export_pack where id in (select id from export_pack)",
      "delete from export_pack where id = ? -- append-only bypass"
    )
    structuralVariations.forEach { sql ->
      assertThat(policy(exportProbe(listOf(sql)), auditProbe()).violations)
        .contains("DELETE_PROBE_INVENTORY", "UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    }

    val normalizedEquivalent = policy(
      exportProbe(listOf("  dElEtE\tFrOm   export_pack\r\n WhErE id = ? ;  ")),
      auditProbe(listOf("DELETE\nFROM\taudit_event   WHERE   ID = ?"))
    )
    assertThat(normalizedEquivalent.violations).isEmpty()
    assertThat(normalizedEquivalent.targetedProbeCount).isEqualTo(2)
  }

  @Test
  fun `compiled sql scanner fails closed for the six reviewed bypass families`() {
    val allowedExportProbe = mapOf(EXPORTS_DB_TEST_INTERNAL_NAME to EXPORT_PACK_DELETE_SQL)

    val pop2Facts = scanCompiledClass(pop2CategoryAdversarialClass())
    val pop2Policy = compiledDeleteProbePolicy(listOf(pop2Facts), allowedExportProbe)
    assertThat(pop2Policy.violations).contains("UNRESOLVED_SQL_SINK")
    assertThat(pop2Policy.unresolvedSqlSinkCount).isEqualTo(1)
    assertThat(pop2Policy.unsafeSqlMethodCount).isZero()

    val commentCases = linkedMapOf(
      "EmptyBlockDeleteComment" to "delete/**/from tenant where id = ?",
      "BlockDeleteComment" to "delete/*x*/from tenant where id = ?",
      "LineDeleteComment" to "delete--x\nfrom tenant where id = ?",
      "BlockTruncateComment" to "truncate/**/table tenant",
      "BlockDropSchemaComment" to "drop/**/schema public",
      "BlockCreateSchemaComment" to "create/**/schema public",
      "NestedBlockComment" to "delete/*outer/*inner*/from tenant where id = ?",
      "UnterminatedBlockComment" to "delete/*unterminated from tenant where id = ?"
    )
    commentCases.forEach { (name, sql) ->
      val facts = scanCompiledClass(
        syntheticDbClass(
          internalName = "fixture/$name",
          sqlCalls = listOf(SyntheticSqlCall(listOf(sql)))
        )
      )
      val policy = compiledDeleteProbePolicy(listOf(facts), emptyMap())
      assertThat(policy.violations).contains("SQL_COMMENT_SURFACE")
      assertThat(policy.sqlCommentSurfaceCount).isEqualTo(1)
      assertThat(policy.unresolvedSqlSinkCount).isZero()
    }

    val similarPrefixFacts = scanCompiledClass(
      syntheticDbClass(
        internalName = SCANNER_INTERNAL_NAME + "Bypass",
        sqlCalls = listOf(SyntheticSqlCall(listOf("delete from tenant where id = ?")))
      )
    )
    val similarPrefixPolicy = compiledDeleteProbePolicy(listOf(similarPrefixFacts), emptyMap())
    assertThat(similarPrefixPolicy.violations).contains("UNEXPECTED_DELETE_OUTSIDE_SUPPORT")
    assertThat(similarPrefixPolicy.unexpectedDeleteCount).isEqualTo(1)

    val invokeDynamicFacts = scanCompiledClass(invokeDynamicDeleteRecipeClass())
    val invokeDynamicPolicy = compiledDeleteProbePolicy(listOf(invokeDynamicFacts), emptyMap())
    assertThat(invokeDynamicPolicy.violations)
      .contains("UNEXPECTED_DELETE_OUTSIDE_SUPPORT", "UNRESOLVED_SQL_SINK")
    assertThat(invokeDynamicFacts.methods.flatMap(CompiledMethodFacts::potentialSqlSurfaces))
      .containsExactly("delete from tenant where id = \u0001")

    val branchFacts = scanCompiledClass(branchWithoutFramesAdversarialClass())
    val branchPolicy = compiledDeleteProbePolicy(listOf(branchFacts), allowedExportProbe)
    assertThat(branchPolicy.violations).contains("UNSAFE_SQL_METHOD", "UNRESOLVED_SQL_SINK")
    assertThat(branchPolicy.unsafeSqlMethodCount).isEqualTo(1)

    val runtimeBuiltFacts = scanCompiledClass(runtimeBuiltSqlSinkClass())
    val runtimeBuiltPolicy = compiledDeleteProbePolicy(listOf(runtimeBuiltFacts), emptyMap())
    assertThat(runtimeBuiltPolicy.violations).contains("UNRESOLVED_SQL_SINK")
    assertThat(runtimeBuiltPolicy.unresolvedSqlSinkCount).isEqualTo(1)
    assertThat(deleteSqlSurfaceCount(runtimeBuiltFacts)).isZero()

    println("jvm_category_tracking_fail_closed=YES")
    println("pop2_adversarial_fixture_rejected=YES")
    println("sql_comment_fixtures_rejected=YES")
    println("scanner_prefix_fixture_rejected=YES")
    println("invokedynamic_recipe_fixture_rejected=YES")
    println("branch_without_frames_fixture_rejected=YES")
    println("runtime_built_sql_fixture_rejected=YES")
  }

  @Test
  fun `case insensitive JUnit gate hands uppercase activation to the exact runtime guard`() {
    val authMeFacts = compiledProjectTestClasses().single {
      it.internalName == AUTH_ME_DB_TEST_INTERNAL_NAME
    }
    val condition = authMeFacts.enabledEnvironmentConditions.single()
    val compiledPattern = Regex(condition.matches ?: error("Compiled enable pattern is required."))

    assertThat(condition.named).isEqualTo(DB_TESTS_ENABLED)
    assertThat(condition.matches).isEqualTo(CASE_INSENSITIVE_TRUE_PATTERN)
    assertThat(compiledPattern.matches("true")).isTrue()
    assertThat(compiledPattern.matches("TRUE")).isTrue()

    val fixture = jdbcFixture()
    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        fixture.dataSource,
        canonicalEnvironment(processOverrides = mapOf(DB_TESTS_ENABLED to "TRUE"))
      )
    }.isInstanceOf(IllegalStateException::class.java)
    assertThat(fixture.state.acquisitionCount).isZero()
    assertThat(fixture.state.executeCount).isZero()
  }

  @Test
  fun `guard rejects absent or incorrect activation and consent before connection`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(DB_TESTS_ENABLED to null)),
      canonicalEnvironment(processOverrides = mapOf(DB_TESTS_ENABLED to "false")),
      canonicalEnvironment(processOverrides = mapOf(DESTRUCTIVE_CONSENT to null)),
      canonicalEnvironment(processOverrides = mapOf(DESTRUCTIVE_CONSENT to "WRONG"))
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  @Tag("windows-only")
  fun `guard rejects divergent process and effective Spring datasource configuration`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_JDBC_URL to "jdbc:postgresql://localhost:15432/ritomer_043b_test")),
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_JDBC_URL to "jdbc:postgresql://127.0.0.1:5432/ritomer_043b_test")),
      canonicalEnvironment(processOverrides = mapOf(DB_RAIL_RUN_ID to "ABCDEF0123456789ABCDEF0123456789")),
      canonicalEnvironment(processOverrides = mapOf(DB_RAIL_RUN_ROOT to "C:\\dev\\ritomer-local-evidence\\m1-1b-postgresql\\other")),
      canonicalEnvironment(processOverrides = mapOf(DB_RAIL_REVIEWED_OBJECT_SHA256 to "0".repeat(63))),
      canonicalEnvironment(processOverrides = mapOf(DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER to "0")),
      canonicalEnvironment(processOverrides = mapOf(DB_RAIL_DATABASE_OID to "0")),
      canonicalEnvironment(processOverrides = mapOf(DB_RAIL_RUNNER_ROLE_OID to "4294967296")),
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_RUN_ROOT to "C:\\dev\\other")),
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_PHASE to "recovery")),
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_STORAGE_LOCAL_ROOT to "C:\\dev\\other\\local-fs")),
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_APPLICATION_NAME to "ritomer-m1-1b-other")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_URL to "jdbc:postgresql://127.0.0.1:15432/other")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_USERNAME to "other_runner")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_PASSWORD to "divergent-synthetic-value")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_APPLICATION_NAME to "ritomer-m1-1b-other")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_LOG_SERVER_ERROR_DETAIL to "true")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_SSL_MODE to "prefer")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_GSS_ENC_MODE to "prefer")),
      canonicalEnvironment(springOverrides = mapOf(STORAGE_BACKEND to "GCS")),
      canonicalEnvironment(springOverrides = mapOf(STORAGE_LOCAL_ROOT to "C:\\dev\\other")),
      canonicalEnvironment(springOverrides = mapOf("spring.flyway.enabled" to "false")),
      canonicalEnvironment(springOverrides = mapOf("spring.flyway.clean-disabled" to "false")),
      canonicalEnvironment(springOverrides = mapOf("spring.sql.init.mode" to "always"))
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  @Tag("windows-only")
  fun `guard rejects absent blank and divergent password configuration`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_PASSWORD to null)),
      canonicalEnvironment(processOverrides = mapOf(DB_TEST_PASSWORD to " ")),
      canonicalEnvironment(springOverrides = mapOf(DATASOURCE_PASSWORD to "divergent-synthetic-value"))
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  fun `guard rejects divergent alternate Spring configuration channels`() {
    val cases = listOf(
      canonicalEnvironment(processOverrides = mapOf(SPRING_DATASOURCE_URL to "jdbc:postgresql://127.0.0.1:15432/other")),
      canonicalEnvironment(processOverrides = mapOf(SPRING_DATASOURCE_USERNAME to "other_runner")),
      canonicalEnvironment(processOverrides = mapOf(SPRING_DATASOURCE_PASSWORD to "divergent-synthetic-value")),
      canonicalEnvironment(processOverrides = mapOf("SPRING_FLYWAY_URL" to EXPECTED_JDBC_URL)),
      canonicalEnvironment(
        processOverrides = mapOf(
          "RITOMER_WORKPAPERS_DOCUMENTS_STORAGE_LOCAL_ROOT" to "C:\\dev\\other"
        )
      ),
      canonicalEnvironment(systemOverrides = mapOf(DATASOURCE_URL to "jdbc:postgresql://127.0.0.1:15432/other")),
      canonicalEnvironment(systemOverrides = mapOf("spring.flyway.url" to EXPECTED_JDBC_URL)),
      canonicalEnvironment(systemOverrides = mapOf(STORAGE_LOCAL_ROOT to "C:\\dev\\other")),
      canonicalEnvironment(
        processOverrides = mapOf(
          SPRING_APPLICATION_JSON to """{"spring":{"datasource":{"url":"jdbc:postgresql://127.0.0.1:15432/other"}}}"""
        )
      )
    )

    cases.forEach(::assertRejectedBeforeConnection)
  }

  @Test
  @Tag("windows-only")
  fun `guard rejects divergent JDBC metadata without executing destructive SQL`() {
    val fixtures = listOf(
      jdbcFixture(JdbcOptions(metadataUrl = "jdbc:postgresql://127.0.0.1:15432/other")),
      jdbcFixture(JdbcOptions(metadataUsername = "other_runner")),
      jdbcFixture(JdbcOptions(metadataDriverVersion = "42.7.9"))
    )

    fixtures.forEach { fixture ->
      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
    }
  }

  @Test
  @Tag("windows-only")
  fun `runner settings keep the independent exhaustive partition and reserved reads really fail with 42501`() {
    assertThat(INDEPENDENT_ALL_SETTINGS).hasSize(23)
    assertThat(INDEPENDENT_SESSION_SETTINGS).hasSize(21)
    assertThat(POSTGRES_TEST_RAIL_ALL_SAFE_SETTINGS).isEqualTo(INDEPENDENT_ALL_SETTINGS)
    assertThat(POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS).isEqualTo(INDEPENDENT_SESSION_SETTINGS)
    assertThat(POSTGRES_TEST_RAIL_ADMINISTRATIVE_SETTINGS)
      .containsExactlyInAnyOrderEntriesOf(mapOf("shared_preload_libraries" to "", "session_preload_libraries" to ""))
    assertThat(POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS.keys.intersect(POSTGRES_TEST_RAIL_ADMINISTRATIVE_SETTINGS.keys))
      .isEmpty()

    INDEPENDENT_ADMINISTRATIVE_SETTINGS.forEach { setting ->
      listOf("", ", true", ", false").forEach { missingOk ->
        listOf("current_setting", "pg_catalog.current_setting").forEach { function ->
          val rejected = jdbcFixture()
          rejected.dataSource.connection.use { connection ->
            connection.createStatement().use { statement ->
              assertThatThrownBy { statement.executeQuery("SELECT $function('$setting'$missingOk)") }
                .isInstanceOf(SQLException::class.java)
                .extracting { (it as SQLException).sqlState }.isEqualTo("42501")
            }
          }
          assertThat(rejected.state.executeCount).isZero()
          assertThat(rejected.state.commitCount).isZero()
        }
      }
    }
    val nominal = jdbcFixture()
    initializeStartup(nominal)
    assertStartupReadOnly(nominal)
    assertThat(nominal.state.queryCount).isEqualTo(4)
    val identity = nominal.state.queriedSql.first()
    val actualNames = Regex("""current_setting\('([^']+)'\)""").findAll(identity)
      .map { it.groupValues[1] }.filter { it in INDEPENDENT_ALL_SETTINGS }.toList()
    assertThat(actualNames).containsExactlyElementsOf(INDEPENDENT_SESSION_SETTINGS.keys)
    assertThat(identity).contains("current_setting('local_preload_libraries')")
    assertThat(identity).doesNotContain("current_setting('shared_preload_libraries'", "current_setting('session_preload_libraries'")
  }

  @Test
  @Tag("windows-only")
  fun `postmaster configuration is canonical positive int64 before all connection paths`() {
    val invalid = listOf(
      null, "", "0", "00", "01", "-1", "+1", "1.0", "1e6", " 1", "1 ", "1\n", "1\r\n",
      "9223372036854775808", "9999999999999999999", "10000000000000000000", "1970-01-01T00:00:00Z"
    )
    invalid.forEach { value ->
      val environment = canonicalEnvironment(processOverrides = mapOf(DB_RAIL_POSTMASTER_START_UNIX_MICROS to value))
      val startup = jdbcFixture()
      assertThatThrownBy { initializeStartup(startup, environment) }.isInstanceOf(IllegalStateException::class.java)
      assertThat(startup.state.acquisitionCount).isZero()
      assertThat(startup.state.executeCount).isZero()
      assertThat(startup.state.commitCount).isZero()
      listOf(false, true).forEach { recreate ->
        val fixture = jdbcFixture()
        assertThatThrownBy {
          if (recreate) DisposablePostgresTestDatabase.recreatePublicSchemaForFlyway(fixture.dataSource, environment)
          else DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, environment)
        }.isInstanceOf(IllegalStateException::class.java)
        assertThat(fixture.state.acquisitionCount).isZero()
        assertThat(fixture.state.executeCount).isZero()
        assertThat(fixture.state.commitCount).isZero()
      }
    }
    listOf("1", SYNTHETIC_POSTMASTER_START_UNIX_MICROS, "1789300000123457", Long.MAX_VALUE.toString()).forEach { instant ->
      val fixture = jdbcFixture(JdbcOptions(postmasterStartUnixMicros = instant))
      initializeStartup(fixture, canonicalEnvironment(processOverrides = mapOf(DB_RAIL_POSTMASTER_START_UNIX_MICROS to instant)))
      assertStartupReadOnly(fixture)
      assertThat(fixture.state.queryCount).isEqualTo(4)
    }
  }

  @Test
  @Tag("windows-only")
  fun `postmaster divergence including one microsecond refuses startup and both destructions`() {
    listOf(null, "", "0", "1789300000123455", "1789300000123457", "1789300000123000", "01789300000123456").forEach { instant ->
      val options = JdbcOptions(postmasterStartUnixMicros = instant)
      assertStartupRejected(jdbcFixture(options), "IDENTITY", "INVARIANT_REJECTED", "SERVER_VERSION")
      listOf(false, true).forEach { recreate -> assertRejectedAfterConnection(jdbcFixture(options), recreate) }
    }
    val source = postgresRuntimeGuardSource()
    val identity = source.sliceBetween("private val POSTGRES_IDENTITY_SQL", "private val POSTGRES_ROLE_SQL")
    assertThat(identity).contains(
      "EXTRACT(EPOCH FROM pg_catalog.pg_postmaster_start_time()) * 1000000",
      "::pg_catalog.int8::pg_catalog.text"
    )
    assertThat(identity.lowercase()).doesNotContain("double", "float", "date_trunc", "to_char", "epoch_millis")
  }

  @Test
  @Tag("windows-only")
  fun `preload catalogue observations reject unsafe defaults overrides privileges and nulls`() {
    // Fixture facts become boundary result rows. The generated SQL is inspected separately below.
    val rejectedCatalogues = listOf(
      SyntheticPreloadCatalogue(roleDefaults = emptyList()),
      SyntheticPreloadCatalogue(roleDefaults = listOf(null)),
      SyntheticPreloadCatalogue(roleDefaults = listOf("session_preload_libraries=\"\"")),
      SyntheticPreloadCatalogue(roleDefaults = listOf("session_preload_libraries=unsafe_module")),
      SyntheticPreloadCatalogue(roleDefaults = listOf("session_preload_libraries=", "session_preload_libraries=")),
      SyntheticPreloadCatalogue(roleDefaults = listOf("session_preload_libraries=", "SESSION_PRELOAD_LIBRARIES=")),
      SyntheticPreloadCatalogue(roleDefaults = listOf("SESSION_PRELOAD_LIBRARIES="))
    ) + listOf(SYNTHETIC_ROLE_OID, "0").flatMap { roleOid ->
      listOf("session_preload_libraries=", "session_preload_libraries=unsafe_module", "SESSION_PRELOAD_LIBRARIES=").map { entry ->
        SyntheticPreloadCatalogue(overrides = listOf(SyntheticSettingOverride(SYNTHETIC_DATABASE_OID, roleOid, entry)))
      }
    } + listOf(EXPECTED_ROLE, "PUBLIC").flatMap { grantee ->
      listOf("session_preload_libraries" to "SET", "session_preload_libraries" to "ALTER SYSTEM", "shared_preload_libraries" to "ALTER SYSTEM").map { (parameter, privilege) ->
        SyntheticPreloadCatalogue(grants = listOf(SyntheticParameterGrant(grantee, parameter, privilege)))
      }
    }
    rejectedCatalogues.forEach { catalogue ->
      assertThat(catalogue.roleDefaultEmpty() && catalogue.overridesAbsent() && catalogue.mutationPrivilegesAbsent()).isFalse()
      val options = JdbcOptions(preloadCatalogue = catalogue)
      assertStartupRejected(jdbcFixture(options), "OWNERS_ACL", "INVARIANT_REJECTED", "USER_SCHEMA_COUNT")
      listOf(false, true).forEach { recreate -> assertRejectedAfterConnection(jdbcFixture(options), recreate) }
    }
    listOf(
      JdbcOptions(sessionPreloadRoleDefaultEmpty = null),
      JdbcOptions(sessionPreloadOverridesAbsent = null),
      JdbcOptions(preloadMutationPrivilegesAbsent = null)
    ).forEach { options ->
      assertStartupRejected(jdbcFixture(options), "OWNERS_ACL", "INVARIANT_REJECTED", "USER_SCHEMA_COUNT")
      listOf(false, true).forEach { recreate -> assertRejectedAfterConnection(jdbcFixture(options), recreate) }
    }
    listOf("session_preload_libraries" to "SET", "session_preload_libraries" to "ALTER SYSTEM", "shared_preload_libraries" to "ALTER SYSTEM").forEach { (parameter, privilege) ->
      val catalogue = SyntheticPreloadCatalogue(
        grants = listOf(SyntheticParameterGrant("indirect_grant", parameter, privilege)),
        memberships = listOf(
          SyntheticRoleMembership("intermediate", EXPECTED_ROLE),
          SyntheticRoleMembership("indirect_grant", "intermediate")
        )
      )
      assertThat(catalogue.mutationPrivilegesAbsent()).isFalse()
      val options = JdbcOptions(preloadCatalogue = catalogue)
      // The earlier membership family rejects the transitive capability before the OWNER query.
      val startup = jdbcFixture(options)
      assertStartupRejected(startup, "MEMBERSHIPS", "INVARIANT_REJECTED", "MEMBERSHIP_COUNT")
      assertThat(startup.state.queryCount).isEqualTo(3)
      listOf(false, true).forEach { recreate -> assertRejectedAfterConnection(jdbcFixture(options), recreate) }
    }
    listOf(
      SyntheticRoleMembership("ordinary", EXPECTED_ROLE),
      SyntheticRoleMembership(EXPECTED_ROLE, "other_member")
    ).forEach { membership ->
      val options = JdbcOptions(preloadCatalogue = SyntheticPreloadCatalogue(memberships = listOf(membership)))
      assertStartupRejected(jdbcFixture(options), "MEMBERSHIPS", "INVARIANT_REJECTED", "MEMBERSHIP_COUNT")
      listOf(false, true).forEach { recreate -> assertRejectedAfterConnection(jdbcFixture(options), recreate) }
    }
    val nominal = jdbcFixture(JdbcOptions(preloadCatalogue = SyntheticPreloadCatalogue(
      roleDefaults = listOf("application_name=irrelevant", "session_preload_libraries="),
      overrides = listOf(
        SyntheticSettingOverride("99999", SYNTHETIC_ROLE_OID, "session_preload_libraries=irrelevant_database"),
        SyntheticSettingOverride(SYNTHETIC_DATABASE_OID, "99999", "session_preload_libraries=irrelevant_role"),
        SyntheticSettingOverride(SYNTHETIC_DATABASE_OID, "0", "local_preload_libraries=")
      ),
      grants = listOf(SyntheticParameterGrant("unrelated_role", "session_preload_libraries", "SET"))
    )))
    initializeStartup(nominal)
    assertStartupReadOnly(nominal)
    assertThat(nominal.state.queryCount).isEqualTo(4)
    val ownerSql = nominal.state.queriedSql.last().lowercase().replace(Regex("\\s+"), " ")
    assertThat(ownerSql).contains(
      "select pg_catalog.count(*) = 1 and pg_catalog.count(*) filter ( where role_setting.entry = 'session_preload_libraries=' ) = 1",
      "role_default.setdatabase = 0", "role_default.setrole = runner_role.oid",
      "pg_catalog.lower(pg_catalog.split_part(role_setting.entry, '=', 1)) = 'session_preload_libraries'",
      "database_default.setdatabase = database_entry.oid", "database_default.setrole in (runner_role.oid, 0)",
      "pg_catalog.lower(pg_catalog.split_part(database_setting.entry, '=', 1)) = 'session_preload_libraries'",
      "not pg_catalog.has_parameter_privilege(runner_role.oid, 'session_preload_libraries', 'set')",
      "not pg_catalog.has_parameter_privilege(runner_role.oid, 'session_preload_libraries', 'alter system')",
      "not pg_catalog.has_parameter_privilege(runner_role.oid, 'shared_preload_libraries', 'alter system')"
    )
    assertThat(ownerSql).doesNotContain("current_setting('session_preload_libraries'", "current_setting('shared_preload_libraries'")
  }

  @Test
  @Tag("windows-only")
  fun `guard rejects every divergent PostgreSQL identity value`() {
    val invalidOptions = listOf(
      JdbcOptions(database = "ritomer"),
      JdbcOptions(database = "postgres"),
      JdbcOptions(database = "template0"),
      JdbcOptions(database = "template1"),
      JdbcOptions(currentUser = "other_runner"),
      JdbcOptions(sessionUser = "other_runner"),
      JdbcOptions(serverAddress = "::1"),
      JdbcOptions(serverPort = "5433"),
      JdbcOptions(applicationName = "ritomer-m1-1b-other"),
      JdbcOptions(serverVersionNumber = "160009"),
      JdbcOptions(ssl = true),
      JdbcOptions(gss = true),
      JdbcOptions(sessionSettingOverrides = mapOf("log_statement" to "all"))
    )

    invalidOptions.forEach { options ->
      val fixture = jdbcFixture(options)
      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
    }
  }

  @Test
  @Tag("windows-only")
  fun `server identity query requests the exact host and accepts only the exact host address`() {
    val nominal = jdbcFixture(JdbcOptions(serverAddress = "127.0.0.1"))

    DisposablePostgresTestDatabase.truncateAllCurrentTables(
      nominal.dataSource,
      canonicalEnvironment()
    )

    val identitySql = nominal.state.queriedSql.single {
      it.contains("current_database()", ignoreCase = true)
    }
    assertThat(identitySql).contains("host(inet_server_addr())")
    assertThat(identitySql).doesNotContain("inet_server_addr()::text")
    assertThat(Regex("""host\(inet_server_addr\(\)\)""").findAll(identitySql).count()).isEqualTo(1)
    assertThat(nominal.state.queryCount).isEqualTo(4)
    assertThat(nominal.state.executeCount).isEqualTo(1)
    assertThat(nominal.state.commitCount).isEqualTo(1)
    assertThat(nominal.state.rollbackCount).isZero()
  }

  @Test
  @Tag("windows-only")
  fun `server address rejects a network prefix another address null and blank before destruction`() {
    val invalidServerAddresses = listOf("127.0.0.1/32", "::1", null, "")

    invalidServerAddresses.forEach { serverAddress ->
      val fixture = jdbcFixture(JdbcOptions(serverAddress = serverAddress))

      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
      assertThat(fixture.state.commitCount).isZero()
      assertThat(fixture.state.rollbackCount).isEqualTo(1)
    }
  }

  @Test
  @Tag("windows-only")
  fun `guard rejects null and blank values returned by PostgreSQL`() {
    val invalidOptions = listOf(
      JdbcOptions(database = null),
      JdbcOptions(currentUser = " "),
      JdbcOptions(sessionUser = null),
      JdbcOptions(serverAddress = ""),
      JdbcOptions(serverPort = null),
      JdbcOptions(applicationName = " "),
      JdbcOptions(serverVersionNumber = null),
      JdbcOptions(sessionSettingOverrides = mapOf("log_statement" to null)),
      JdbcOptions(roleOid = null),
      JdbcOptions(roleCanLogin = null),
      JdbcOptions(explicitMembershipCount = null),
      JdbcOptions(databaseOid = null),
      JdbcOptions(databaseOwner = " "),
      JdbcOptions(publicSchemaOwner = null),
      JdbcOptions(databaseAclExact = null),
      JdbcOptions(publicSchemaAclExact = null),
      JdbcOptions(userSchemaCount = null)
    )

    invalidOptions.forEach { options ->
      val fixture = jdbcFixture(options)
      assertRejectedAfterConnection(fixture)
      assertThat(fixture.state.executeCount).isZero()
    }
  }

  @ParameterizedTest
  @ValueSource(ints = [0, 1, 2, 3, 4, 5])
  @Tag("windows-only")
  fun `guard rejects each dangerous PostgreSQL role privilege`(dangerousPrivilegeIndex: Int) {
    val fixture = jdbcFixture(JdbcOptions(dangerousPrivilegeIndex = dangerousPrivilegeIndex))

    assertRejectedAfterConnection(fixture)
    assertThat(fixture.state.executeCount).isZero()
  }

  @ParameterizedTest
  @ValueSource(strings = [EXPECTED_ROLE, "pg_database_owner"])
  @Tag("windows-only")
  fun `guard rejects every explicit membership shape and incorrect owners`(publicOwner: String) {
    val membershipCases = listOf(
      "predefined-powerful" to "1",
      "ordinary" to "1",
      "intermediate" to "1",
      "multiple" to "2"
    )
    val nominalOptions = JdbcOptions(publicSchemaOwner = publicOwner)
    val invalidOptions = listOf(
      *membershipCases.map { (_, count) -> nominalOptions.copy(explicitMembershipCount = count) }.toTypedArray(),
      nominalOptions.copy(currentUser = "other_runner"),
      nominalOptions.copy(sessionUser = "other_runner"),
      nominalOptions.copy(roleOid = "16402"),
      nominalOptions.copy(roleCanLogin = false),
      nominalOptions.copy(roleConnectionLimit = "17"),
      nominalOptions.copy(roleProvenance = "other-provenance"),
      nominalOptions.copy(databaseOid = "16403"),
      nominalOptions.copy(databaseOwner = "other_owner"),
      nominalOptions.copy(databaseOwner = "postgres"),
      nominalOptions.copy(databaseProvenance = "other-provenance"),
      nominalOptions.copy(databaseAllowsConnections = false),
      nominalOptions.copy(databaseIsTemplate = true),
      nominalOptions.copy(publicSchemaOwner = "other_owner"),
      nominalOptions.copy(publicSchemaOwner = "postgres"),
      nominalOptions.copy(databaseAclExact = false),
      nominalOptions.copy(publicSchemaAclExact = false),
      nominalOptions.copy(userSchemaCount = "2"),
      *List(6) { nominalOptions.copy(dangerousPrivilegeIndex = it) }.toTypedArray()
    )

    invalidOptions.forEach { options ->
      listOf(false, true).forEach { recreateSchema ->
        assertRejectedAfterConnection(jdbcFixture(options), recreateSchema)
      }
    }

    val nominal = jdbcFixture(nominalOptions)
    DisposablePostgresTestDatabase.truncateAllCurrentTables(nominal.dataSource, canonicalEnvironment())
    val membershipSql = nominal.state.queriedSql.single { it.contains("pg_auth_members", ignoreCase = true) }
    assertThat(membershipSql).contains("granted_role.rolname = 'ritomer_043b_test_runner'")
    assertThat(membershipSql).contains("member_role.rolname = 'ritomer_043b_test_runner'")
    val ownerSql = nominal.state.queriedSql.single { it.contains("from pg_database", ignoreCase = true) }
    assertThat(ownerSql).contains(
      "database_acl.grantor = database_entry.datdba",
      "not database_acl.is_grantable",
      "pg_get_userbyid(namespace_entry.nspowner)",
      "schema_acl.grantor = namespace_entry.nspowner",
      "schema_acl.grantee = namespace_entry.nspowner",
      "schema_acl.grantee = 0",
      "schema_acl.privilege_type = 'USAGE'",
      "not schema_acl.is_grantable"
    )
    assertThat(membershipCases.map(Pair<String, String>::first)).containsExactly(
      "predefined-powerful",
      "ordinary",
      "intermediate",
      "multiple"
    )
  }

  @Test
  @Tag("windows-only")
  fun `membership catalogue failure is fail closed sanitized and preserves rollback evidence`() {
    val catalogueFailure = SQLException("synthetic catalogue failure")
    val rollbackFailure = SQLException("synthetic rollback failure")
    val fixture = jdbcFixture(
      JdbcOptions(
        selectFailureIndex = 3,
        selectFailure = catalogueFailure,
        rollbackFailure = rollbackFailure
      )
    )

    val caught = catchThrowable {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        fixture.dataSource,
        canonicalEnvironment()
      )
    }

    assertThat(caught)
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessage("PostgreSQL guarded destructive operation failed.")
    assertThat(caught.cause).isNull()
    assertThat(caught.suppressed).isEmpty()
    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.executeCount).isZero()
    assertThat(fixture.state.commitCount).isZero()
    assertThat(fixture.state.rollbackCount).isEqualTo(1)
  }

  @Test
  @Tag("windows-only")
  fun `connection and SELECT failures stop before destruction`() {
    val connectionFailure = jdbcFixture(JdbcOptions(connectionFailure = SQLException("synthetic connection failure")))
    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        connectionFailure.dataSource,
        canonicalEnvironment()
      )
    }.isInstanceOf(IllegalStateException::class.java)
      .hasMessage("PostgreSQL guarded destructive operation failed.")
      .hasNoCause()
    assertThat(connectionFailure.state.acquisitionCount).isEqualTo(1)
    assertThat(connectionFailure.state.executeCount).isZero()

    val selectFailure = jdbcFixture(JdbcOptions(selectFailureIndex = 2))
    assertRejectedAfterConnection(selectFailure)
    assertThat(selectFailure.state.executeCount).isZero()
    assertThat(selectFailure.state.rollbackCount).isEqualTo(1)
  }

  @ParameterizedTest
  @ValueSource(strings = [EXPECTED_ROLE, "pg_database_owner"])
  @Tag("windows-only")
  fun `nominal guard validates before SQL and commits exactly once on one connection`(publicOwner: String) {
    val fixture = jdbcFixture(JdbcOptions(publicSchemaOwner = publicOwner))

    DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, canonicalEnvironment())

    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.queryCount).isEqualTo(4)
    assertThat(fixture.state.executeCount).isEqualTo(1)
    assertThat(fixture.state.events.indexOf("execute")).isGreaterThan(
      fixture.state.events.indexOfLast { it == "query" }
    )
    assertThat(fixture.state.commitCount).isEqualTo(1)
    assertThat(fixture.state.rollbackCount).isZero()
    assertThat(fixture.state.closeCount).isEqualTo(1)
    assertThat(fixture.state.autoCommit).isTrue()
  }

  @Test
  @Tag("windows-only")
  fun `failure rolls back once and exposes only a sanitized exception`() {
    val destructiveFailure = SQLException(SYNTHETIC_PASSWORD)
    val rollbackFailure = SQLException("rollback-$SYNTHETIC_PASSWORD")
    val fixture = jdbcFixture(
      JdbcOptions(
        destructiveFailure = destructiveFailure,
        rollbackFailure = rollbackFailure
      )
    )

    val caught = catchThrowable {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(
        fixture.dataSource,
        canonicalEnvironment()
      )
    }

    assertThat(caught)
      .isInstanceOf(IllegalStateException::class.java)
      .hasMessage("PostgreSQL guarded destructive operation failed.")
    assertThat(caught.cause).isNull()
    assertThat(caught.suppressed).isEmpty()
    assertThat(caught.message).doesNotContain(SYNTHETIC_PASSWORD)
    assertThat(fixture.state.commitCount).isZero()
    assertThat(fixture.state.rollbackCount).isEqualTo(1)
    assertThat(fixture.state.executeCount).isEqualTo(1)
  }

  @ParameterizedTest
  @ValueSource(strings = [EXPECTED_ROLE, "pg_database_owner"])
  @Tag("windows-only")
  fun `schema recreation uses one connection one transaction and ordered fixed operations`(publicOwner: String) {
    val fixture = jdbcFixture(JdbcOptions(publicSchemaOwner = publicOwner))

    DisposablePostgresTestDatabase.recreatePublicSchemaForFlyway(
      fixture.dataSource,
      canonicalEnvironment()
    )

    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.queryCount).isEqualTo(4)
    assertThat(fixture.state.executeCount).isEqualTo(3)
    assertThat(fixture.state.events.indexOf("execute")).isGreaterThan(
      fixture.state.events.indexOfLast { it == "query" }
    )
    assertThat(fixture.state.destructiveSql.map { it.uppercase() }).allSatisfy { sql ->
      assertThat(sql).contains("SCHEMA PUBLIC")
    }
    assertThat(fixture.state.destructiveSql[0].uppercase()).startsWith("DROP")
    assertThat(fixture.state.destructiveSql[1].uppercase()).startsWith("CREATE")
    assertThat(fixture.state.destructiveSql[2].uppercase()).startsWith("GRANT USAGE")
    assertThat(fixture.state.commitCount).isEqualTo(1)
    assertThat(fixture.state.rollbackCount).isZero()
    assertThat(fixture.state.closeCount).isEqualTo(1)
    assertThat(fixture.state.autoCommit).isTrue()
  }

  @Test
  fun `direct IDE style invocation remains guarded without the Gradle task gate`() {
    val invalidEnvironment = canonicalEnvironment(processOverrides = mapOf(DESTRUCTIVE_CONSENT to null))
    val fixture = jdbcFixture()

    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, invalidEnvironment)
    }.isInstanceOf(IllegalStateException::class.java)
    assertThat(fixture.state.acquisitionCount).isZero()
    assertThat(fixture.state.executeCount).isZero()
  }

  @ParameterizedTest
  @ValueSource(strings = [EXPECTED_ROLE, "pg_database_owner"])
  @Tag("windows-only")
  fun `startup initializer validates all four query families without a transaction`(publicOwner: String) {
    val fixture = jdbcFixture(JdbcOptions(publicSchemaOwner = publicOwner))

    initializeStartup(fixture)

    assertStartupReadOnly(fixture)
    assertThat(fixture.state.queryCount).isEqualTo(4)
    assertThat(fixture.state.statementCloseCount).isEqualTo(1)
    assertThat(fixture.state.resultSetCloseCount).isEqualTo(4)
    assertThat(fixture.state.closeCount).isEqualTo(1)
  }

  @ParameterizedTest
  @ValueSource(strings = ["local_preload_libraries"])
  @Tag("windows-only")
  fun `startup preload settings require genuinely empty values`(setting: String) {
    assertThat(POSTGRES_TEST_RAIL_ADMINISTRATIVE_SETTINGS.getValue("session_preload_libraries")).hasSize(0)
    assertThat(POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS.getValue("local_preload_libraries")).hasSize(0)
    val emptySettings = mapOf("local_preload_libraries" to "")
    val nominal = jdbcFixture(JdbcOptions(sessionSettingOverrides = emptySettings))

    initializeStartup(nominal)

    assertStartupReadOnly(nominal)
    assertThat(nominal.state.queryCount).isEqualTo(4)
    val quotedEmpty = jdbcFixture(JdbcOptions(sessionSettingOverrides = emptySettings + (setting to "\"\"")))
    assertStartupRejected(quotedEmpty, "IDENTITY", "INVARIANT_REJECTED", "LOGGING_SETTINGS")
  }

  @Test
  fun `startup initializer retains the no argument constructor required by Spring`() {
    val initializer = DisposablePostgresTestDatabaseGuardInitializer::class.java
      .getDeclaredConstructor().newInstance()

    assertThat(initializer).isInstanceOf(DisposablePostgresTestDatabaseGuardInitializer::class.java)
  }

  @Test
  @Tag("windows-only")
  fun `startup connection failure reports only safe acquisition diagnostics and clears properties`() {
    val fixture = jdbcFixture(JdbcOptions(connectionFailure = startupSqlFailure("08001")))

    assertStartupRejected(fixture, "CONNECTION", "SQL_ERROR", "OPEN_CONNECTION", "08001")

    assertThat(fixture.state.queryCount).isZero()
    assertThat(fixture.state.closeCount).isZero()
  }

  @Test
  @Tag("windows-only")
  fun `startup JDBC metadata failures identify the exact metadata operation`() {
    val controls = linkedMapOf(
      "getMetaData" to "METADATA_READ",
      "getURL" to "METADATA_URL",
      "getUserName" to "METADATA_USERNAME",
      "getDriverVersion" to "METADATA_DRIVER_VERSION"
    )
    controls.forEach { (method, control) ->
      val fixture = jdbcFixture(
        JdbcOptions(metadataFailureMethod = method, metadataFailure = startupSqlFailure("08006"))
      )

      assertStartupRejected(fixture, "JDBC_METADATA", "SQL_ERROR", control, "08006")

      assertThat(fixture.state.queryCount).isZero()
      assertThat(fixture.state.closeCount).isEqualTo(1)
    }
  }

  @Test
  @Tag("windows-only")
  fun `startup statement acquisition failure identifies the identity stage`() {
    val fixture = jdbcFixture(JdbcOptions(statementOpenFailure = startupSqlFailure("08003")))

    assertStartupRejected(fixture, "IDENTITY", "SQL_ERROR", "STATEMENT_OPEN", "08003")

    assertThat(fixture.state.queryCount).isZero()
    assertThat(fixture.state.statementCloseCount).isZero()
    assertThat(fixture.state.closeCount).isEqualTo(1)
  }

  @ParameterizedTest
  @ValueSource(ints = [1, 2, 3, 4])
  @Tag("windows-only")
  fun `startup SELECT failure identifies each query family`(queryIndex: Int) {
    val fixture = jdbcFixture(
      JdbcOptions(selectFailureIndex = queryIndex, selectFailure = startupSqlFailure("42501"))
    )
    val stage = startupQueryStage(queryIndex)

    assertStartupRejected(fixture, stage, "SQL_ERROR", "${stage}_QUERY", "42501")

    assertThat(fixture.state.queryCount).isEqualTo(queryIndex)
    assertThat(fixture.state.resultSetCloseCount).isEqualTo(queryIndex - 1)
    assertThat(fixture.state.statementCloseCount).isEqualTo(1)
    assertThat(fixture.state.closeCount).isEqualTo(1)
  }

  @ParameterizedTest
  @ValueSource(strings = [
    "08001", "08003", "08004", "08006", "08007", "08P01", "28000", "28P01",
    "3D000", "42501", "42601", "42703", "42883", "42P01", "53300", "53400",
    "55000", "57014", "57P01", "57P02", "57P03", "58000", "58030", "XX000"
  ])
  @Tag("windows-only")
  fun `startup allows only an explicitly recognized SQLSTATE`(sqlState: String) {
    assertStartupRejected(
      jdbcFixture(JdbcOptions(connectionFailure = startupSqlFailure(sqlState))),
      "CONNECTION", "SQL_ERROR", "OPEN_CONNECTION", sqlState
    )
  }

  @Test
  @Tag("windows-only")
  fun `startup maps absent unknown and malformed SQLSTATE to a fixed safe value`() {
    listOf(null, "", " ", "ZZ999", "00000", "08p01", " 08001", "08001 ", "08001\n",
      "08001; password=$SYNTHETIC_PASSWORD", SYNTHETIC_PASSWORD
    ).forEach { sqlState ->
      assertStartupRejected(
        jdbcFixture(JdbcOptions(connectionFailure = startupSqlFailure(sqlState))),
        "CONNECTION", "SQL_ERROR", "OPEN_CONNECTION", "UNKNOWN"
      )
    }
  }

  @Test
  @Tag("windows-only")
  fun `startup contains a driver exception whose SQLSTATE getter itself throws`() {
    val failure = object : SQLException("STARTUP_RAW_MESSAGE") {
      override fun getSQLState(): String = throw IllegalStateException("STARTUP_RAW_CAUSE")
    }

    assertStartupRejected(
      jdbcFixture(JdbcOptions(connectionFailure = failure)),
      "CONNECTION", "SQL_ERROR", "OPEN_CONNECTION", "UNKNOWN"
    )
  }

  @Test
  @Tag("windows-only")
  fun `startup unexpected failures have no SQLSTATE and do not impersonate an invariant rejection`() {
    val cases = listOf(
      Triple("CONNECTION", "OPEN_CONNECTION", JdbcOptions(connectionFailure = startupUnexpectedFailure())),
      Triple("JDBC_METADATA", "METADATA_READ", JdbcOptions(
        metadataFailureMethod = "getMetaData", metadataFailure = startupUnexpectedFailure()
      )),
      Triple("ROLE", "ROLE_QUERY", JdbcOptions(
        selectFailureIndex = 2, selectFailure = startupUnexpectedFailure()
      )),
      Triple("RESOURCE_CLOSE", "CONNECTION_CLOSE", JdbcOptions(connectionCloseFailure = startupUnexpectedFailure()))
    )
    cases.forEach { (stage, control, options) ->
      assertStartupRejected(jdbcFixture(options), stage, "UNEXPECTED_ERROR", control)
    }
  }

  @Test
  @Tag("windows-only")
  fun `startup rejected invariants identify each safe control without exposing returned values`() {
    val cases = listOf(
      Triple("JDBC_METADATA", "METADATA_READ", JdbcOptions(metadataAbsent = true)),
      Triple("JDBC_METADATA", "METADATA_URL", JdbcOptions(metadataUrl = SYNTHETIC_PASSWORD)),
      Triple("JDBC_METADATA", "METADATA_USERNAME", JdbcOptions(metadataUsername = SYNTHETIC_PASSWORD)),
      Triple("JDBC_METADATA", "METADATA_DRIVER_VERSION", JdbcOptions(metadataDriverVersion = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "CURRENT_DATABASE", JdbcOptions(database = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "CURRENT_ROLE", JdbcOptions(currentUser = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "SESSION_ROLE", JdbcOptions(sessionUser = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "SERVER_ADDRESS", JdbcOptions(serverAddress = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "SERVER_PORT", JdbcOptions(serverPort = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "APPLICATION_NAME", JdbcOptions(applicationName = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "SERVER_VERSION", JdbcOptions(serverVersionNumber = SYNTHETIC_PASSWORD)),
      Triple("IDENTITY", "SERVER_VERSION", JdbcOptions(serverVersionNumber = "160000")),
      Triple("IDENTITY", "TRANSPORT_MODE", JdbcOptions(ssl = true)),
      Triple("IDENTITY", "TRANSPORT_MODE", JdbcOptions(gss = true)),
      Triple("IDENTITY", "TRANSPORT_MODE", JdbcOptions(ssl = null)),
      Triple("IDENTITY", "TRANSPORT_MODE", JdbcOptions(gss = null)),
      Triple("ROLE", "ROLE_OID", JdbcOptions(roleOid = SYNTHETIC_PASSWORD)),
      Triple("ROLE", "ROLE_LOGIN", JdbcOptions(roleCanLogin = false)),
      Triple("ROLE", "ROLE_LOGIN", JdbcOptions(roleCanLogin = null)),
      Triple("ROLE", "ROLE_CONNECTION_LIMIT", JdbcOptions(roleConnectionLimit = SYNTHETIC_PASSWORD)),
      Triple("ROLE", "ROLE_PROVENANCE", JdbcOptions(roleProvenance = SYNTHETIC_PASSWORD)),
      Triple("MEMBERSHIPS", "MEMBERSHIP_COUNT", JdbcOptions(explicitMembershipCount = SYNTHETIC_PASSWORD)),
      Triple("OWNERS_ACL", "DATABASE_OID", JdbcOptions(databaseOid = SYNTHETIC_PASSWORD)),
      Triple("OWNERS_ACL", "DATABASE_OWNER", JdbcOptions(databaseOwner = SYNTHETIC_PASSWORD)),
      Triple("OWNERS_ACL", "DATABASE_PROVENANCE", JdbcOptions(databaseProvenance = SYNTHETIC_PASSWORD)),
      Triple("OWNERS_ACL", "DATABASE_FLAGS", JdbcOptions(databaseAllowsConnections = false)),
      Triple("OWNERS_ACL", "DATABASE_FLAGS", JdbcOptions(databaseIsTemplate = true)),
      Triple("OWNERS_ACL", "PUBLIC_SCHEMA_OWNER", JdbcOptions(publicSchemaOwner = SYNTHETIC_PASSWORD)),
      Triple("OWNERS_ACL", "DATABASE_ACL", JdbcOptions(databaseAclExact = false)),
      Triple("OWNERS_ACL", "PUBLIC_SCHEMA_ACL", JdbcOptions(publicSchemaAclExact = false)),
      Triple("OWNERS_ACL", "USER_SCHEMA_COUNT", JdbcOptions(userSchemaCount = SYNTHETIC_PASSWORD))
    ) + (0..5).map { index ->
      Triple("ROLE", "ROLE_PRIVILEGES", JdbcOptions(dangerousPrivilegeIndex = index))
    } + POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS.keys.flatMap { setting ->
      listOf(SYNTHETIC_PASSWORD, null).map { value ->
        Triple("IDENTITY", "LOGGING_SETTINGS", JdbcOptions(sessionSettingOverrides = mapOf(setting to value)))
      }
    }

    cases.forEach { (stage, control, options) ->
      assertStartupRejected(jdbcFixture(options), stage, "INVARIANT_REJECTED", control)
    }
  }

  @ParameterizedTest
  @ValueSource(ints = [1, 2, 3, 4])
  @Tag("windows-only")
  fun `startup absent or duplicate rows are rejected in the original query stage`(queryIndex: Int) {
    listOf(0, 2).forEach { rowCount ->
      val fixture = jdbcFixture(JdbcOptions(rowCountOverrides = mapOf(queryIndex to rowCount)))

      assertStartupRejected(fixture, startupQueryStage(queryIndex), "INVARIANT_REJECTED", "ROW_COUNT")

      assertThat(fixture.state.queryCount).isEqualTo(queryIndex)
      assertThat(fixture.state.resultSetCloseCount).isEqualTo(queryIndex)
      assertThat(fixture.state.closeCount).isEqualTo(1)
    }
  }

  @ParameterizedTest
  @ValueSource(ints = [1, 2, 3, 4])
  @Tag("windows-only")
  fun `startup result cursor and getter SQL failures retain the query stage and active control`(queryIndex: Int) {
    val getterControls = listOf("CURRENT_DATABASE", "ROLE_OID", "MEMBERSHIP_COUNT", "DATABASE_OID")
    listOf("next" to "ROW_COUNT", "getString" to getterControls[queryIndex - 1]).forEach { (method, control) ->
      val fixture = jdbcFixture(JdbcOptions(
        resultFailureQuery = queryIndex,
        resultFailureMethod = method,
        resultFailure = startupSqlFailure("42703")
      ))

      assertStartupRejected(fixture, startupQueryStage(queryIndex), "SQL_ERROR", control, "42703")

      assertThat(fixture.state.queryCount).isEqualTo(queryIndex)
      assertThat(fixture.state.resultSetCloseCount).isEqualTo(queryIndex)
    }
  }

  @ParameterizedTest
  @ValueSource(ints = [1, 2, 3, 4])
  @Tag("windows-only")
  fun `startup result set close failures are reported as resource close failures`(queryIndex: Int) {
    val fixture = jdbcFixture(JdbcOptions(resultSetCloseFailures = mapOf(queryIndex to startupSqlFailure("58030"))))

    assertStartupRejected(fixture, "RESOURCE_CLOSE", "SQL_ERROR", "RESULT_SET_CLOSE", "58030")

    assertThat(fixture.state.queryCount).isEqualTo(queryIndex)
    assertThat(fixture.state.resultSetCloseCount).isEqualTo(queryIndex)
    assertThat(fixture.state.statementCloseCount).isEqualTo(1)
    assertThat(fixture.state.closeCount).isEqualTo(1)
  }

  @Test
  @Tag("windows-only")
  fun `startup statement and connection close failures expose only fixed resource controls`() {
    listOf(
      "STATEMENT_CLOSE" to JdbcOptions(statementCloseFailure = startupSqlFailure("08006")),
      "CONNECTION_CLOSE" to JdbcOptions(connectionCloseFailure = startupSqlFailure("08006"))
    ).forEach { (control, options) ->
      val fixture = jdbcFixture(options)

      assertStartupRejected(fixture, "RESOURCE_CLOSE", "SQL_ERROR", control, "08006")

      assertThat(fixture.state.queryCount).isEqualTo(4)
      assertThat(fixture.state.resultSetCloseCount).isEqualTo(4)
      assertThat(fixture.state.statementCloseCount).isEqualTo(1)
      assertThat(fixture.state.closeCount).isEqualTo(1)
    }
  }

  @Test
  @Tag("windows-only")
  fun `startup preserves the primary SQL or invariant refusal over all suppressed close failures`() {
    val closeOptions = JdbcOptions(
      resultSetCloseFailures = mapOf(2 to startupSqlFailure("08006")),
      statementCloseFailure = startupSqlFailure("58030"),
      connectionCloseFailure = startupSqlFailure("57P01")
    )
    val queryFailure = startupSqlFailure("42501")
    val queryFixture = jdbcFixture(closeOptions.copy(selectFailureIndex = 2, selectFailure = queryFailure))
    assertStartupRejected(queryFixture, "ROLE", "SQL_ERROR", "ROLE_QUERY", "42501")
    assertThat(queryFailure.suppressed).hasSize(3)

    val getterFailure = startupSqlFailure("42703")
    val getterFixture = jdbcFixture(closeOptions.copy(
      resultFailureQuery = 2, resultFailureMethod = "getString", resultFailure = getterFailure
    ))
    assertStartupRejected(getterFixture, "ROLE", "SQL_ERROR", "ROLE_OID", "42703")
    assertThat(getterFailure.suppressed).hasSize(4)

    val invariantFixture = jdbcFixture(closeOptions.copy(roleProvenance = SYNTHETIC_PASSWORD))
    assertStartupRejected(invariantFixture, "ROLE", "INVARIANT_REJECTED", "ROLE_PROVENANCE")
    assertThat(invariantFixture.state.resultSetCloseCount).isEqualTo(2)
    assertThat(invariantFixture.state.statementCloseCount).isEqualTo(1)
    assertThat(invariantFixture.state.closeCount).isEqualTo(1)
  }

  private fun initializeStartup(fixture: JdbcFixture, environment: MockEnvironment = canonicalEnvironment()) {
    val initializer = DisposablePostgresTestDatabaseGuardInitializer { jdbcUrl, properties ->
      fixture.state.connectionProperties = properties
      assertThat(jdbcUrl).isEqualTo(EXPECTED_JDBC_URL)
      assertThat(properties).hasSize(6)
      assertThat(properties.getProperty("user")).isEqualTo(EXPECTED_ROLE)
      assertThat(properties.getProperty("password")).isEqualTo(SYNTHETIC_PASSWORD)
      assertThat(properties.getProperty("ApplicationName")).isEqualTo(SYNTHETIC_APPLICATION_NAME)
      assertThat(properties.getProperty("logServerErrorDetail")).isEqualTo("false")
      assertThat(properties.getProperty("sslmode")).isEqualTo("disable")
      assertThat(properties.getProperty("gssEncMode")).isEqualTo("disable")
      fixture.dataSource.connection
    }
    GenericApplicationContext().use { context ->
      context.environment = environment
      initializer.initialize(context)
    }
  }

  private fun assertStartupRejected(
    fixture: JdbcFixture,
    stage: String,
    category: String,
    control: String,
    sqlState: String? = null
  ) {
    val caught = catchThrowable { initializeStartup(fixture) }
    val expected = "PostgreSQL rail startup rejected; stage=$stage; category=$category; control=$control" +
      if (sqlState == null) "" else "; sqlstate=$sqlState"
    assertThat(caught).isInstanceOf(IllegalStateException::class.java).hasMessage(expected).hasNoCause()
    assertThat(caught.suppressed).isEmpty()
    val rendered = StringWriter().also { caught.printStackTrace(PrintWriter(it)) }.toString()
    assertThat(rendered).doesNotContain(
      SYNTHETIC_PASSWORD, EXPECTED_JDBC_URL,
      "STARTUP_RAW_MESSAGE", "STARTUP_RAW_CAUSE", "STARTUP_RAW_SUPPRESSED",
      "STARTUP_RAW_FRAME", "STARTUP_RAW_NEXT_EXCEPTION"
    )
    if (sqlState == null) assertThat(rendered).doesNotContain("sqlstate=")
    assertStartupReadOnly(fixture)
  }

  private fun assertStartupReadOnly(fixture: JdbcFixture) {
    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.connectionProperties).isNotNull().isEmpty()
    assertThat(fixture.state.executeCount).isZero()
    assertThat(fixture.state.destructiveSql).isEmpty()
    assertThat(fixture.state.commitCount).isZero()
    assertThat(fixture.state.rollbackCount).isZero()
    assertThat(fixture.state.autoCommit).isTrue()
    assertThat(fixture.state.queriedSql).allSatisfy { sql ->
      assertThat(sql.trimStart()).startsWith("SELECT")
    }
  }

  private fun startupQueryStage(queryIndex: Int): String =
    listOf("IDENTITY", "ROLE", "MEMBERSHIPS", "OWNERS_ACL")[queryIndex - 1]

  private fun startupSqlFailure(sqlState: String?): SQLException =
    SQLException("STARTUP_RAW_MESSAGE $SYNTHETIC_PASSWORD $EXPECTED_JDBC_URL", sqlState).apply {
      initCause(IllegalStateException("STARTUP_RAW_CAUSE"))
      addSuppressed(IllegalStateException("STARTUP_RAW_SUPPRESSED"))
      setNextException(SQLException("STARTUP_RAW_NEXT_EXCEPTION"))
      stackTrace = arrayOf(StackTraceElement("STARTUP_RAW_FRAME", "hidden", "hidden", 1))
    }

  private fun startupUnexpectedFailure(): IllegalStateException =
    IllegalStateException("STARTUP_RAW_MESSAGE $SYNTHETIC_PASSWORD", startupSqlFailure("08001")).apply {
      addSuppressed(IllegalStateException("STARTUP_RAW_SUPPRESSED"))
      stackTrace = arrayOf(StackTraceElement("STARTUP_RAW_FRAME", "hidden", "hidden", 1))
    }

  private fun assertRejectedBeforeConnection(environment: MockEnvironment) {
    val fixture = jdbcFixture()
    assertThatThrownBy {
      DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, environment)
    }.isInstanceOf(IllegalStateException::class.java)
    assertThat(fixture.state.acquisitionCount).isZero()
    assertThat(fixture.state.executeCount).isZero()
  }

  private fun assertRejectedAfterConnection(fixture: JdbcFixture, recreateSchema: Boolean = false) {
    assertThatThrownBy {
      if (recreateSchema) {
        DisposablePostgresTestDatabase.recreatePublicSchemaForFlyway(fixture.dataSource, canonicalEnvironment())
      } else {
        DisposablePostgresTestDatabase.truncateAllCurrentTables(fixture.dataSource, canonicalEnvironment())
      }
    }.isInstanceOf(Exception::class.java)
    assertThat(fixture.state.acquisitionCount).isEqualTo(1)
    assertThat(fixture.state.executeCount).isZero()
    assertThat(fixture.state.destructiveSql).isEmpty()
    assertThat(fixture.state.commitCount).isZero()
    assertThat(fixture.state.rollbackCount).isEqualTo(1)
  }

  private fun postgresRailScriptSource(): String =
    Path.of("scripts/m1-1b-postgresql-rail.ps1").readText()

  private fun postgresRailBuildSource(): String = Path.of("build.gradle.kts").readText()

  private fun postgresRailLifecycleSource(): String = Path.of(
    "src/test/kotlin/ch/qamwaq/ritomer/testsupport/PostgresTestRailLifecycleCommand.kt"
  ).readText()

  @Test
  fun postgresB1CleanupKeepsBodyFailureWhenRealLockDisposeFails() {
    val output = runRailPowerShell(
      """
      §Campaign='D'; §Mode='Lifecycle'; §LifecycleAction='CleanupOnly'
      §script:lockDisposed=§false
      function Assert-M1BInvocation { [IO.Path]::GetFullPath([IO.Path]::GetTempPath()) }
      function Enter-M1BRunLock {
        param(§Root)
        §stream=[pscustomobject]@{}
        §stream | Add-Member ScriptMethod Dispose { §script:lockDisposed=§true; throw [IO.IOException]::new('private-lock-fault') }
        [pscustomobject]@{Stream=§stream;Path=(Join-Path §Root 'synthetic-unused-lock')}
      }
      function Assert-M1BExecutionState { throw [FormatException]::new('private-body-fault') }
      §failure=§null; §result=§null
      try { §result=Invoke-M1DCleanupOnly } catch { §failure=§_ }
      §bodyPreserved=§false
      if (§null -ne §failure) { §e=§failure.Exception; while (§null -ne §e) { if (§e -is [FormatException]) { §bodyPreserved=§true }; §e=§e.InnerException } }
      §diag=Get-M1DDiagnostics
      'B1_LOCK '+(ConvertTo-Json ([pscustomobject]@{bodyPreserved=§bodyPreserved;lockDisposed=§script:lockDisposed;noResult=(§null -eq §result);diagnostics=§diag}) -Depth 8 -Compress)
      if (-not §bodyPreserved -or -not §script:lockDisposed -or §null -ne §result -or §diag.primary.category -cne 'INVALID_VALUE' -or §diag.secondary.Count -ne 1 -or §diag.secondary[0].category -cne 'IO_FAILURE') { throw 'B1_BODY_ERROR_REPLACED_BY_LOCK' }
      """.trimIndent()
    )
    println(output.trim())
  }

  @ParameterizedTest
  @ValueSource(strings = ["Preflight", "Provision", "Cleanup"])
  @Tag("windows-only")
  fun postgresB1PsqlNonzeroPrecedesRealFinalizations(phase: String) {
    val output = runRailPowerShell(
      """
      §Campaign='D'; §Mode='Lifecycle'; §LifecycleAction='Run'
      §root=Join-Path ([IO.Path]::GetTempPath()) ('m1d-b1-psql-'+[Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root); §script:DRunRoot=§root
      §script:events=[Collections.Generic.List[string]]::new(); §script:exitReads=0
      function Assert-M1BNoCredentialChannels { }
      function Assert-M1BPsqlBinary { [pscustomobject]@{Path='C:\fixture\inert.exe';Sha256=('a'*64);FileVersion='fixture';ProductVersion='fixture'} }
      function Get-M1DNamespaceIdentity { 'OFFLINE_B1' }
      function Write-M1BCreateNewUtf8 { param(§Path,§Text) §script:events.Add('stopped'); throw [UnauthorizedAccessException]::new('private-stopped-fault') }
      function Start-M1DContainedChild {
        param(§StartInfo,§Role,§ArgumentFile,§ReceiptContext)
        §p=[pscustomobject]@{Id=2000000000;CreationTimeUtcTicks='638000000000000000';JobName=('Local\Ritomer.M1D.'+§RunId+'.'+§Role);HasExited=§true;ActiveProcessCount=0;StandardOutput=[IO.StringReader]::new('synthetic-output');StandardError=[IO.StringReader]::new('');StandardInput=[IO.StringWriter]::new();StartInfo=§StartInfo}
        §p | Add-Member ScriptProperty ExitCode { §script:exitReads++; return 7 }
        §p | Add-Member ScriptMethod WaitForExit { }
        §p | Add-Member ScriptMethod TerminateTreeAndWait { param(§Budget) §script:events.Add('terminate'); return §true }
        §p | Add-Member ScriptMethod Dispose { §script:events.Add('dispose'); throw [IO.IOException]::new('private-dispose-fault') }
        §script:fixtureProcess=§p; return §p
      }
      try {
        Start-M1DClock Lifecycle
        §code='NONE'; §result=§null
        try { §result=Invoke-M1BDirectPsql -Phase '$phase' -SqlText 'SYNTHETIC NEVER EXECUTED' -NeutralRoot (Join-Path §root 'neutral') } catch { §code=Get-M1BStopCode §_; [void](Add-M1DFailure §_) }
        §diag=Get-M1DDiagnostics
        'B1_PSQL '+(ConvertTo-Json ([pscustomobject]@{phase='$phase';stop=§code;exitReads=§script:exitReads;events=@(§script:events);noResult=(§null -eq §result);diagnostics=§diag;environmentCleared=(§script:fixtureProcess.StartInfo.EnvironmentVariables.Count -eq 0)}) -Depth 8 -Compress)
        §expected='PSQL_'+'$phase'.ToUpperInvariant()+'_EXIT_NONZERO'
        if (§code -cne §expected -or §diag.primary.control -cne §expected -or §diag.secondary.Count -ne 2 -or §diag.secondary[0].category -cne 'ACCESS_DENIED' -or §diag.secondary[1].category -cne 'IO_FAILURE' -or §script:exitReads -ne 1 -or (§script:events -join ',') -cne 'terminate,stopped,dispose' -or §null -ne §result -or §script:fixtureProcess.StartInfo.EnvironmentVariables.Count -ne 0) { throw 'B1_PSQL_NONZERO_MASKED' }
      } finally {
        if (-not §root.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-b1-psql-')) { throw 'FIXTURE_CLEANUP_BOUNDARY' }
        [IO.Directory]::Delete(§root,§true)
      }
      """.trimIndent()
    )
    println(output.trim())
  }

  @Test
  fun postgresRecoveryOriginSelectionIsFixedAndHasNoOperationalEffects() {
    val output = runRailPowerShell(
      """
      # Pure selection only: the real root string is never opened or dispatched.
      §Campaign='D'; §Mode='Lifecycle'; §LifecycleAction='CleanupOnly'
      §RunId='5b6936c097c9472d85f697348cfd756a'
      §RunRoot='C:\dev\ritomer-local-evidence\m1-1b-postgresql\5b6936c097c9472d85f697348cfd756a'
      §origin=Get-M1DFixedRecoveryOrigin
      if (§null -eq §origin -or §origin.runId -cne §RunId -or §origin.runRoot -cne §RunRoot -or
          §origin.reviewedObjectSha256 -cne 'a26d18378f40572974a9c22b137063bd4afab0fa323f584902c79af5c04e97d2' -or
          §origin.scriptSha256 -cne '66ee9ca05593ecf91cc0a6f075e76144314ff32afe60c869013320d10befe139' -or
          §origin.campaignReceiptSha256 -cne 'ff16d868c52930c9870df47ab1340dae2dee500ac247f18906e22690c0befe74' -or
          §origin.provisionReceiptSha256 -cne '4c36f8a8669494c8746889fffdeb2c235083576af8b03466890d561014c96eb6') { throw 'FIXED_ORIGIN_CHANGED' }
      foreach (§change in @(@('Campaign','B'),@('Mode','Preflight'),@('LifecycleAction','Run'),@('RunId',('0'*32)),@('RunRoot',(§RunRoot+'\')),@('RunRoot',§RunRoot.ToLowerInvariant()),@('RunRoot',(§RunRoot+[char]0)))) {
        §saved=Get-Variable -Name §change[0] -ValueOnly
        Set-Variable -Name §change[0] -Value §change[1]
        try { if (§null -ne (Get-M1DFixedRecoveryOrigin)) { throw ('ORIGIN_SELECTION_ESCAPED_SCOPE_'+§change[0]) } }
        finally { Set-Variable -Name §change[0] -Value §saved }
      }
      'HE_FIXED_SELECTION=PASS'
      """.trimIndent()
    )
    assertThat(output).contains("HE_FIXED_SELECTION=PASS")
  }

  @ParameterizedTest
  @ValueSource(strings = [
    "nominal", "bad-run", "bad-root", "bad-rail", "bad-composite", "bad-campaign", "bad-provision",
    "campaign-rehashed", "provision-rehashed", "provenance-current", "historical-current", "historical-auth",
    "preflight-auth", "lifecycle-c1-auth", "historical-kind", "historical-schema", "historical-origin", "mixed-confined",
    "historical-stopped-current", "historical-stopped-auth", "historical-stopped-active",
    "old-authorization", "c1-authorization", "preexisting", "preexisting-sidecar", "preexisting-foreign",
    "controller-alive", "root-alive", "job-active", "job-inaccessible", "namespace", "ports",
    "wrong-executor", "wrong-executor-script", "old-recovery-auth", "other-provision", "recovery-schema", "recovery-kind",
    "origin-extra", "targets-present", "campaign-late", "quarantine-late", "psql-nonzero-finalizers",
    "invalid-output", "invalid-payload", "lock-only", "late-controls", "late-terminal"
  ])
  @Tag("windows-only")
  fun postgresRecoveryKeepsHistoricalOriginAndCurrentExecutorThroughRealFunctions(scenario: String) {
    val output = runRailPowerShell(
      """
      # OS/process/I/O and repository execution-state boundaries are doubled. No real dispatcher, SQL,
      # psql, listener, recorded process or operational evidence is accessed.
      Add-Type -TypeDefinition @'
      using System;
      using System.Diagnostics;
      namespace Ritomer.M1B {
        public static class ContainedProcess {
          public static Func<ProcessStartInfo,string,string,Action<int,long,string>,object> Launch;
          public static object StartD(ProcessStartInfo info,string run,string role,Action<int,long,string> confined) {
            return Launch(info,run,role,confined);
          }
        }
      }
      '@
      §case='$scenario'
      §root=Join-Path ([IO.Path]::GetTempPath()) ('m1d-he-'+[Guid]::NewGuid().ToString('N'))
      [void][IO.Directory]::CreateDirectory(§root)
      §Campaign='D'; §Mode='Lifecycle'; §LifecycleAction='CleanupOnly'; §RunId='0'*32; §RunRoot=§root
      §ReviewedObjectSha256='3'*64; §SensitiveAuthorizationRecordId='AUTH-FIXTURE-RECOVERY'; §PreflightAuthorizationRecordId='AUTH-FIXTURE-C1'
      §script:DRunRoot=§root; §script:DQuarantinePath=Join-Path §root '.m1d-unreleased.json'
      §script:PsqlExeExact=Join-Path §root 'inert-psql.exe'
      [IO.File]::WriteAllText(§script:PsqlExeExact,'SYNTHETIC NOT EXECUTABLE')
      §ExpectedPsqlSha256=Get-M1BSha256File §script:PsqlExeExact
      §origin=[pscustomobject][ordered]@{runId=§RunId;runRoot=§root;reviewedObjectSha256=('1'*64);scriptSha256=('2'*64);campaignReceiptSha256=('0'*64);provisionReceiptSha256=('0'*64)}
      §provenance=Get-M1BProvenance §RunId §origin.reviewedObjectSha256 '999'
      §script:events=[Collections.Generic.List[string]]::new(); §script:launches=0; §script:exitReads=0; §script:process=§null
      §realCreate=(Get-Command Write-M1BCreateNewUtf8).ScriptBlock
      function Initialize-M1BContainedProcessType { }
      function Get-M1DNamespaceIdentity { if(§case -ceq 'namespace'){'OTHER_NAMESPACE'}else{'OFFLINE_HE_NAMESPACE'} }
      function Assert-M1BInvocation { §root }
      function Assert-M1BExecutionState {
        param(§Root,§Phase)
        §script:events.Add(§Phase)
        if(§Phase -ceq 'd-cleanup-only-final' -and §case -ceq 'late-controls'){throw [FormatException]::new('private-late-control')}
        [pscustomobject]@{synthetic=§true}
      }
      function Enter-M1BRunLock {
        param(§Root)
        §stream=[pscustomobject]@{}
        §stream | Add-Member ScriptMethod Dispose {
          §script:events.Add('lock-dispose')
          if(§case -cin @('lock-only','psql-nonzero-finalizers')){throw [IO.IOException]::new('private-lock')}
        }
        [pscustomobject]@{Stream=§stream;Path=(Join-Path §Root 'inert-lock')}
      }
      function Assert-M1BInteractiveConsole { }
      function Assert-M1BNoCredentialChannels { }
      function Assert-M1BPsqlBinary { [pscustomobject]@{Path=§script:PsqlExeExact;Sha256=§ExpectedPsqlSha256;FileVersion='fixture';ProductVersion='fixture'} }
      function Get-M1DListenerPorts { if(§case -ceq 'ports'){@(5173)}else{@()} }
      function Get-M1DRecordedJobCount {
        param(§Name)
        if(§case -ceq 'job-inaccessible'){throw [UnauthorizedAccessException]::new('private-job')}
        if(§case -ceq 'job-active'){1}else{-1}
      }
      function Get-Process {
        param(§Id,§ErrorAction)
        if((§case -ceq 'controller-alive' -and §Id -eq 2000000001) -or (§case -ceq 'root-alive' -and §Id -eq 2000000002)){
          §p=[pscustomobject]@{StartTime=[DateTime]::new(638000000000000000L,[DateTimeKind]::Utc)}
          §p | Add-Member ScriptMethod Dispose { }; return §p
        }
        return §null
      }
      function Save-FixtureReceipt([string]§Name,[object]§Value) {
        §path=Join-Path §root ('d-'+§Name+'.json')
        [IO.File]::WriteAllText(§path,(ConvertTo-Json §Value -Depth 12 -Compress)+"`n",(Get-M1BUtf8))
        [IO.File]::WriteAllText((§path+'.sha256'),(Get-M1BSha256File §path)+"`n",(Get-M1BUtf8))
      }
      function New-HistoricalReceipt([string]§Name,[object]§Payload,[string]§Auth='AUTH-FIXTURE-C2') {
        §v=[ordered]@{schemaVersion=1;campaign='D';kind=§Name;runId=§RunId;reviewedObjectSha256=§origin.reviewedObjectSha256;scriptSha256=§origin.scriptSha256;machine=[Environment]::MachineName;windowsSessionId=[Diagnostics.Process]::GetCurrentProcess().SessionId;namespaceIdentity='OFFLINE_HE_NAMESPACE';authorizationRecordId=§Auth;payload=§Payload}
        Save-FixtureReceipt §Name §v
      }
      function Change-FixtureReceipt([string]§Name,[scriptblock]§Change) {
        §v=ConvertFrom-Json ([IO.File]::ReadAllText((Join-Path §root ('d-'+§Name+'.json'))))
        & §Change §v
        Save-FixtureReceipt §Name §v
      }
      function Write-M1BCreateNewUtf8 {
        param(§Path,§Text)
        if(§Path.EndsWith('-stopped.json') -and §case -ceq 'psql-nonzero-finalizers'){
          §script:events.Add('stopped-fault');throw [UnauthorizedAccessException]::new('private-stopped')
        }
        if(§Path.EndsWith('d-recovery-terminal.json.sha256') -and §case -ceq 'late-terminal'){throw [IO.IOException]::new('private-terminal')}
        & §realCreate §Path §Text
        if(§Path.EndsWith('d-recovery-cleanup.json')){
          §v=ConvertFrom-Json §Text
          switch(§case){
            'wrong-executor' {§v.reviewedObjectSha256=§origin.reviewedObjectSha256}
            'wrong-executor-script' {§v.scriptSha256=§origin.scriptSha256}
            'old-recovery-auth' {§v.authorizationRecordId='AUTH-FIXTURE-C2'}
            'other-provision' {§v.recoveryOrigin.provisionReceiptSha256='9'*64}
            'recovery-schema' {§v.schemaVersion=1}
            'recovery-kind' {§v.kind='cleanup'}
            'origin-extra' {§v.recoveryOrigin | Add-Member NoteProperty bypass §true}
            'targets-present' {§v.payload.targetsAbsent=§false}
            'campaign-late' {Change-FixtureReceipt 'campaign' {param(§c) §c.authorizationRecordId='AUTH-ALTERED'}}
            'quarantine-late' {[IO.File]::WriteAllText(§script:DQuarantinePath,(ConvertTo-Json ([ordered]@{runId=§RunId;root=§root;receiptSha256=('9'*64)}) -Compress))}
          }
          [IO.File]::WriteAllText(§Path,(ConvertTo-Json §v -Depth 12 -Compress)+"`n",(Get-M1BUtf8))
        }
      }
      [Ritomer.M1B.ContainedProcess]::Launch={
        param(§info,§run,§role,§confined)
        §script:launches++;§script:events.Add('native-boundary')
        if(§run -cne §RunId -or §role -cne 'ADMIN_PSQL_CLEANUP'){throw 'NATIVE_BOUNDARY_ESCAPED'}
        §job='Local\Ritomer.M1D.'+§RunId+'.'+§role
        §confined.Invoke(2000000003,638000000000000000L,§job)
        §payload=[ordered]@{clusterSystemIdentifier='999';databaseCount=0;roleCount=0;sessionCount=0}
        if(§case -ceq 'invalid-payload'){§payload.databaseCount=1}
        §text="M1B_CLIENT|170006`nM1B_CLEANUP|"+[Convert]::ToBase64String((Get-M1BUtf8).GetBytes((ConvertTo-Json §payload -Compress)))+"`n"
        if(§case -ceq 'invalid-output'){§text='invalid'}
        §p=[pscustomobject]@{Id=2000000003;CreationTimeUtcTicks=638000000000000000L;JobName=§job;HasExited=§true;ActiveProcessCount=0;StartInfo=§info;StandardInput=[IO.StringWriter]::new();StandardOutput=[IO.StringReader]::new(§text);StandardError=[IO.StringReader]::new('')}
        §p | Add-Member ScriptProperty ExitCode { §script:exitReads++; if(§case -ceq 'psql-nonzero-finalizers'){7}else{0} }
        §p | Add-Member ScriptMethod WaitForExit { }
        §p | Add-Member ScriptMethod TerminateTreeAndWait {param(§Budget) §script:events.Add('terminate');return §true}
        §p | Add-Member ScriptMethod Dispose {
          §script:events.Add('process-dispose')
          §this.StandardInput.Dispose();§this.StandardOutput.Dispose();§this.StandardError.Dispose()
          if(§case -ceq 'psql-nonzero-finalizers'){throw [IO.IOException]::new('private-process')}
        }
        §script:process=§p; return §p
      }
      try {
        New-HistoricalReceipt 'campaign' ([ordered]@{preflightAuthorizationRecordId=§PreflightAuthorizationRecordId;preflightSha256=('a'*64);psqlSha256=§ExpectedPsqlSha256;cluster='999';adminRoleOid=10;maintenanceDatabaseOid=11;provenance=§provenance;runtimeSha256=('b'*64);integratedManifestSha256=('c'*64);frontendRuntimeSha256=('d'*64);controllerProcessId=2000000001;controllerCreationTicks='638000000000000000'})
        New-HistoricalReceipt 'provision' ([ordered]@{databaseOid=19;roleOid=20;postmasterStartUnixMicros='1789722000123456';cluster='999';provenance=§provenance;adminRoleOid=10;maintenanceDatabaseOid=11;psqlSha256=§ExpectedPsqlSha256;structuredOutputSha256=('e'*64)})
        foreach(§stage in @('preflight','lifecycle')){
          foreach(§role in @('READINESS','ADMIN_PSQL_PROVISION')){
            §auth=if(§stage -ceq 'preflight'){§PreflightAuthorizationRecordId}else{'AUTH-FIXTURE-C2'}
            §name='launch-'+§stage+'-'+§role
            New-HistoricalReceipt (§name+'-intent') ([ordered]@{role=§role;binaryPath=§script:PsqlExeExact;binarySha256=§ExpectedPsqlSha256;commandSha256=('f'*64);argumentFileSha256='NONE'}) §auth
            New-HistoricalReceipt (§name+'-confined') ([ordered]@{role=§role;processId=2000000002;creationTimeUtcTicks='638000000000000000';jobName=('Local\Ritomer.M1D.'+§RunId+'.'+§role);binaryPath=§script:PsqlExeExact;binarySha256=§ExpectedPsqlSha256;commandSha256=('f'*64);argumentFileSha256='NONE';confinedBeforeResume=§true}) §auth
            if(§role -ceq 'READINESS'){New-HistoricalReceipt (§name+'-stopped') ([ordered]@{processId=2000000002;creationTimeUtcTicks='638000000000000000';jobName=('Local\Ritomer.M1D.'+§RunId+'.'+§role);activeProcesses=0}) §auth}
          }
        }
        §origin.campaignReceiptSha256=Get-M1BSha256File (Join-Path §root 'd-campaign.json')
        §origin.provisionReceiptSha256=Get-M1BSha256File (Join-Path §root 'd-provision.json')
        [IO.File]::WriteAllText(§script:DQuarantinePath,(ConvertTo-Json ([ordered]@{runId=§RunId;root=§root;receiptSha256=§origin.campaignReceiptSha256}) -Compress))
        §historicalName='launch-lifecycle-READINESS-intent'
        switch(§case){
          'bad-run' {§origin.runId='9'*32}
          'bad-root' {§origin.runRoot=§root+'-wrong'}
          'bad-rail' {§origin.scriptSha256='9'*64}
          'bad-composite' {§origin.reviewedObjectSha256='9'*64}
          'bad-campaign' {§origin.campaignReceiptSha256='9'*64}
          'bad-provision' {§origin.provisionReceiptSha256='9'*64}
          'campaign-rehashed' {Change-FixtureReceipt 'campaign' {param(§v) §v.authorizationRecordId='AUTH-ALTERED'}}
          'provision-rehashed' {Change-FixtureReceipt 'provision' {param(§v) §v.payload.roleOid=99}}
          'provenance-current' {
            Change-FixtureReceipt 'campaign' {param(§v) §v.payload.provenance=Get-M1BProvenance §RunId §ReviewedObjectSha256 '999'}
            §origin.campaignReceiptSha256=Get-M1BSha256File (Join-Path §root 'd-campaign.json')
          }
          'historical-current' {Change-FixtureReceipt §historicalName {param(§v) §v.reviewedObjectSha256=§ReviewedObjectSha256}}
          'historical-auth' {Change-FixtureReceipt §historicalName {param(§v) §v.authorizationRecordId=§SensitiveAuthorizationRecordId}}
          'preflight-auth' {Change-FixtureReceipt 'launch-preflight-READINESS-intent' {param(§v) §v.authorizationRecordId='AUTH-FIXTURE-C2'}}
          'lifecycle-c1-auth' {Change-FixtureReceipt §historicalName {param(§v) §v.authorizationRecordId=§PreflightAuthorizationRecordId}}
          'historical-kind' {Change-FixtureReceipt §historicalName {param(§v) §v.kind='launch-recovery-ADMIN_PSQL_CLEANUP-intent'}}
          'historical-schema' {Change-FixtureReceipt §historicalName {param(§v) §v.schemaVersion=2}}
          'historical-origin' {Change-FixtureReceipt §historicalName {param(§v) §v | Add-Member NoteProperty recoveryOrigin ([pscustomobject]@{reviewedObjectSha256=§ReviewedObjectSha256})}}
          'mixed-confined' {Change-FixtureReceipt 'launch-lifecycle-READINESS-confined' {param(§v) §v.reviewedObjectSha256=§ReviewedObjectSha256;§v.scriptSha256=Get-M1BSha256File §offlineRailPath}}
          'historical-stopped-current' {Change-FixtureReceipt 'launch-lifecycle-READINESS-stopped' {param(§v) §v.reviewedObjectSha256=§ReviewedObjectSha256}}
          'historical-stopped-auth' {Change-FixtureReceipt 'launch-lifecycle-READINESS-stopped' {param(§v) §v.authorizationRecordId=§SensitiveAuthorizationRecordId}}
          'historical-stopped-active' {Change-FixtureReceipt 'launch-lifecycle-READINESS-stopped' {param(§v) §v.payload.activeProcesses=1}}
          'old-authorization' {§SensitiveAuthorizationRecordId='AUTH-FIXTURE-C2'}
          'c1-authorization' {§SensitiveAuthorizationRecordId=§PreflightAuthorizationRecordId}
          'preexisting' {[IO.File]::WriteAllText((Join-Path §root 'd-recovery-cleanup.json'),'{}')}
          'preexisting-sidecar' {[IO.File]::WriteAllText((Join-Path §root 'd-recovery-cleanup.json.sha256'),('0'*64)+"`n")}
          'preexisting-foreign' {[IO.File]::WriteAllText((Join-Path §root 'd-launch-recovery-HARNESS-intent.json'),'{}')}
        }
        §before=@{};foreach(§file in Get-ChildItem -LiteralPath §root -File){§before[§file.Name]=Get-M1BSha256File §file.FullName}
        §code='NONE';§result=§null
        try{§result=Invoke-M1DCleanupOnly -RecoveryOrigin §origin}catch{§code=Get-M1BStopCode §_}
        §diag=Get-M1DDiagnostics
        §afterSql=§case -cin @('nominal','wrong-executor','wrong-executor-script','old-recovery-auth','other-provision','recovery-schema','recovery-kind','origin-extra','targets-present','campaign-late','quarantine-late','psql-nonzero-finalizers','invalid-output','invalid-payload','lock-only','late-controls','late-terminal')
        if(§script:launches -ne $(if(§afterSql){1}else{0})){throw 'HE_SQL_BARRIER_CHANGED'}
        if(-not §script:events.Contains('lock-dispose')){throw 'HE_LOCK_FINALIZATION_SKIPPED'}
        if(§case -ceq 'nominal'){
          if(§code -cne 'NONE' -or §null -eq §result -or [IO.File]::Exists(§script:DQuarantinePath) -or §null -ne §diag.primary){throw 'HE_NOMINAL_FAILED'}
          §context=[pscustomobject]@{origin=§origin;campaignAuthorization='AUTH-FIXTURE-C2';preflightAuthorization=§PreflightAuthorizationRecordId}
          foreach(§name in @('launch-recovery-ADMIN_PSQL_CLEANUP-intent','launch-recovery-ADMIN_PSQL_CLEANUP-confined','launch-recovery-ADMIN_PSQL_CLEANUP-stopped','recovery-cleanup','recovery-terminal')){
            §receipt=Read-M1DReceipt §name -ReceiptContext §context
            if(§receipt.schemaVersion -ne 2 -or §receipt.reviewedObjectSha256 -cne §ReviewedObjectSha256 -or §receipt.scriptSha256 -cne (Get-M1BSha256File §offlineRailPath) -or §receipt.authorizationRecordId -cne 'AUTH-FIXTURE-RECOVERY'){throw 'HE_EXECUTOR_NOT_PRESERVED'}
            §raw=[IO.File]::ReadAllText((Join-Path §root ('d-'+§name+'.json'))).Trim()
            §envelope=ConvertFrom-Json §raw
            §expectedKeys=@('schemaVersion','campaign','kind','runId','reviewedObjectSha256','scriptSha256','machine','windowsSessionId','namespaceIdentity','authorizationRecordId','payload','recoveryOrigin')
            if((@((§envelope.PSObject.Properties.Name) | Sort-Object) -join ',') -cne (@(§expectedKeys | Sort-Object) -join ',')){throw 'HE_ENVELOPE_SHAPE_CHANGED'}
            §originKeys=@('reviewedObjectSha256','scriptSha256','campaignReceiptSha256','provisionReceiptSha256')
            if((@((§envelope.recoveryOrigin.PSObject.Properties.Name) | Sort-Object) -join ',') -cne (@(§originKeys | Sort-Object) -join ',')){throw 'HE_ORIGIN_SHAPE_CHANGED'}
            foreach(§key in §originKeys){if(§envelope.recoveryOrigin.§key -cne §origin.§key){throw 'HE_ORIGIN_NOT_PRESERVED'}}
            'HE_ENVELOPE '+§raw
          }
          Assert-M1DRecordedCessation -ReceiptContext §context
          §stoppedName='launch-recovery-ADMIN_PSQL_CLEANUP-stopped'
          §stoppedPath=Join-Path §root ('d-'+§stoppedName+'.json')
          §stoppedBytes=[IO.File]::ReadAllBytes(§stoppedPath);§stoppedHashBytes=[IO.File]::ReadAllBytes(§stoppedPath+'.sha256')
          try{
            Change-FixtureReceipt §stoppedName {param(§v) §v.reviewedObjectSha256=§origin.reviewedObjectSha256}
            §stoppedCode='NONE';try{Assert-M1DRecordedCessation -ReceiptContext §context}catch{§stoppedCode=Get-M1BStopCode §_}
            if(§stoppedCode -cne 'D_RECEIPT_BINDING_INVALID'){throw 'HE_RECOVERY_STOPPED_ACCEPTED_HISTORICAL_EXECUTOR'}
          }finally{[IO.File]::WriteAllBytes(§stoppedPath,§stoppedBytes);[IO.File]::WriteAllBytes(§stoppedPath+'.sha256',§stoppedHashBytes)}
          foreach(§name in @('campaign','provision')){
            §rejected=§false;try{[void](Read-M1DReceipt §name)}catch{§rejected=§true}
            if(-not §rejected){throw 'HE_DEFAULT_READER_ACCEPTED_HISTORICAL'}
          }
          foreach(§change in @(@('Campaign','B'),@('Mode','Preflight'),@('LifecycleAction','Run'))){
            §saved=Get-Variable -Name §change[0] -ValueOnly
            Set-Variable -Name §change[0] -Value §change[1]
            try{
              §scopeCode='NONE';try{[void](Read-M1DReceipt 'campaign' -ReceiptContext §context)}catch{§scopeCode=Get-M1BStopCode §_}
              if(§scopeCode -cne 'D_RECOVERY_CONTEXT_INVALID'){throw 'HE_CONTEXT_ESCAPED_MODE'}
            }finally{Set-Variable -Name §change[0] -Value §saved}
          }
        } else {
          if(§code -ceq 'NONE' -or §null -ne §result -or §null -eq §diag.primary){throw 'HE_FAILURE_ACCEPTED'}
          §expectedStops=@{
            'bad-run'='D_RECOVERY_CONTEXT_INVALID';'bad-root'='D_RECOVERY_CONTEXT_INVALID'
            'bad-rail'='D_RECEIPT_BINDING_INVALID';'bad-composite'='D_RECEIPT_BINDING_INVALID'
            'bad-campaign'='D_RECOVERY_ORIGIN_HASH_INVALID';'bad-provision'='D_RECOVERY_ORIGIN_HASH_INVALID'
            'campaign-rehashed'='D_RECOVERY_ORIGIN_HASH_INVALID';'provision-rehashed'='D_RECOVERY_ORIGIN_HASH_INVALID'
            'provenance-current'='D_CAMPAIGN_PAYLOAD_INVALID'
            'historical-current'='D_RECEIPT_BINDING_INVALID';'historical-auth'='D_RECEIPT_BINDING_INVALID'
            'preflight-auth'='D_RECEIPT_BINDING_INVALID';'lifecycle-c1-auth'='D_RECEIPT_BINDING_INVALID'
            'historical-kind'='D_RECEIPT_BINDING_INVALID';'historical-schema'='D_RECEIPT_BINDING_INVALID'
            'historical-origin'='STRUCTURED_OUTPUT_PROPERTY_COUNT_INVALID';'mixed-confined'='D_RECEIPT_BINDING_INVALID'
            'historical-stopped-current'='D_RECEIPT_BINDING_INVALID';'historical-stopped-auth'='D_RECEIPT_BINDING_INVALID'
            'historical-stopped-active'='D_CHILD_STOP_NOT_ATTESTED'
            'old-authorization'='D_NEW_CLEANUP_AUTHORIZATION_REQUIRED';'c1-authorization'='D_NEW_CLEANUP_AUTHORIZATION_REQUIRED'
            'preexisting'='D_RECOVERY_ALREADY_STARTED';'preexisting-sidecar'='D_RECOVERY_ALREADY_STARTED';'preexisting-foreign'='D_RECOVERY_ALREADY_STARTED'
            'controller-alive'='D_ORIGINAL_CONTROLLER_STILL_ALIVE';'root-alive'='D_RECORDED_ROOT_STILL_ALIVE'
            'job-active'='D_RECORDED_DESCENDANT_STILL_ALIVE';'job-inaccessible'='UNEXPECTED_FAILURE'
            'namespace'='D_RECEIPT_BINDING_INVALID';'ports'='D_INTEGRATED_PORT_NOT_FREE'
            'wrong-executor'='D_RECEIPT_BINDING_INVALID';'wrong-executor-script'='D_RECEIPT_BINDING_INVALID'
            'old-recovery-auth'='D_RECEIPT_BINDING_INVALID';'other-provision'='D_RECOVERY_ORIGIN_INVALID'
            'recovery-schema'='D_RECEIPT_BINDING_INVALID';'recovery-kind'='D_RECEIPT_BINDING_INVALID'
            'origin-extra'='STRUCTURED_OUTPUT_PROPERTY_COUNT_INVALID';'targets-present'='D_CLEANUP_NOT_PROVEN'
            'campaign-late'='D_RECOVERY_ORIGIN_HASH_INVALID';'quarantine-late'='D_QUARANTINE_BINDING_INVALID'
            'psql-nonzero-finalizers'='PSQL_CLEANUP_EXIT_NONZERO';'invalid-output'='PSQL_CLEANUP_TERMINAL_NEWLINE_MISSING'
            'invalid-payload'='CLEANUP_RESULT_INVALID';'lock-only'='UNEXPECTED_FAILURE'
            'late-controls'='UNEXPECTED_FAILURE';'late-terminal'='UNEXPECTED_FAILURE'
          }
          if(-not §expectedStops.ContainsKey(§case) -or §code -cne §expectedStops[§case]){throw ('HE_WRONG_STOP_'+§case+'_'+§code)}
          §expectedCategory=switch(§case){'job-inaccessible'{'ACCESS_DENIED'};'lock-only'{'IO_FAILURE'};'late-controls'{'INVALID_VALUE'};'late-terminal'{'IO_FAILURE'};default{'CONTROLLED_STOP'}}
          if(§diag.primary.category -cne §expectedCategory){throw 'HE_WRONG_PRIMARY_CATEGORY'}
          §late=§case -cin @('lock-only','late-controls','late-terminal')
          if([IO.File]::Exists(§script:DQuarantinePath) -eq §late){throw 'HE_QUARANTINE_ORDER_CHANGED'}
          §terminalPath=Join-Path §root 'd-recovery-terminal.json'
          if(§case -ceq 'lock-only' -and (-not [IO.File]::Exists(§terminalPath) -or -not [IO.File]::Exists(§terminalPath+'.sha256') -or §diag.primary.operation -cne 'lock-release' -or §diag.secondary.Count -ne 0)){throw 'HE_LATE_LOCK_SEMANTICS_CHANGED'}
          if(§case -ceq 'late-terminal' -and (-not [IO.File]::Exists(§terminalPath) -or [IO.File]::Exists(§terminalPath+'.sha256'))){throw 'HE_PARTIAL_TERMINAL_SEMANTICS_CHANGED'}
          if(§case -ceq 'late-controls' -and [IO.File]::Exists(§terminalPath)){throw 'HE_TERMINAL_PUBLISHED_BEFORE_FINAL_CONTROLS'}
          if(§case -ceq 'psql-nonzero-finalizers'){
            if(§code -cne 'PSQL_CLEANUP_EXIT_NONZERO' -or §diag.primary.control -cne §code -or §diag.secondary.Count -ne 3 -or §diag.secondary[0].category -cne 'ACCESS_DENIED' -or §diag.secondary[1].category -cne 'IO_FAILURE' -or §diag.secondary[2].operation -cne 'lock-release'){throw 'HE_B1_ORDER_OR_DEDUP_FAILED'}
            if((§script:events | Where-Object {§_ -cin @('terminate','stopped-fault','process-dispose','lock-dispose')}) -join ',' -cne 'terminate,stopped-fault,process-dispose,lock-dispose'){throw 'HE_FINALIZATION_ORDER_FAILED'}
          }
        }
        foreach(§name in §before.Keys){
          if(§name -ceq '.m1d-unreleased.json'){continue}
          if(§case -ceq 'campaign-late' -and §name -cin @('d-campaign.json','d-campaign.json.sha256')){continue}
          if((Get-M1BSha256File (Join-Path §root §name)) -cne §before[§name]){throw 'HE_HISTORICAL_BYTES_CHANGED'}
        }
        foreach(§stage in @('preflight','lifecycle')){if([IO.File]::Exists((Join-Path §root ('d-launch-'+§stage+'-ADMIN_PSQL_PROVISION-stopped.json')))){throw 'HE_OLD_STOPPED_CREATED'}}
        if(§afterSql -and (§script:exitReads -ne 1 -or §script:process.StartInfo.EnvironmentVariables.Count -ne 0)){throw 'HE_PSQL_FINALIZATION_INCOMPLETE'}
        'HE_CASE '+(ConvertTo-Json ([pscustomobject]@{scenario=§case;stop=§code;nativeBoundaryCalls=§script:launches;diagnostics=§diag;historicalBytesPreserved=(§case -cne 'campaign-late');injectedHistoricalTamper=(§case -ceq 'campaign-late');quarantined=[IO.File]::Exists(§script:DQuarantinePath);nominalResult=(§null -ne §result)}) -Depth 8 -Compress)
      } finally {
        [Ritomer.M1B.ContainedProcess]::Launch=§null
        if(-not §root.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -or -not ([IO.Path]::GetFileName(§root)).StartsWith('m1d-he-')){throw 'FIXTURE_CLEANUP_BOUNDARY'}
        [IO.Directory]::Delete(§root,§true)
      }
      """.trimIndent()
    )
    assertThat(output).contains("HE_CASE ")
    assertThat(output).doesNotContain("private-", "M1DFailureCollector")
    println(output.trim())
  }

  @Test
  @Tag("windows-only")
  fun offlineFixturePreservesTimeoutWhenItsInertChildCannotAttestCessation() {
    var alive = true
    var terminations = 0
    var exitReads = 0
    val waits = mutableListOf<Long>()
    var commandFile: Path? = null
    val child = object : Process() {
      override fun getOutputStream() = java.io.ByteArrayOutputStream()
      override fun getInputStream() = java.io.ByteArrayInputStream(byteArrayOf())
      override fun getErrorStream() = java.io.ByteArrayInputStream(byteArrayOf())
      override fun waitFor(): Int = throw AssertionError("unexpected unbounded wait")
      override fun waitFor(timeout: Long, unit: java.util.concurrent.TimeUnit): Boolean {
        waits.add(unit.toSeconds(timeout))
        return false
      }
      override fun exitValue(): Int { exitReads++; throw IllegalThreadStateException("inert fixture") }
      override fun destroy() { throw AssertionError("unexpected second termination path") }
      override fun destroyForcibly(): Process { terminations++; return this }
      override fun isAlive() = alive
    }
    try {
      val failure = requireNotNull(catchThrowable {
        runRailPowerShell("throw 'must never execute'") { builder ->
          commandFile = Path.of(builder.command().last())
          child
        }
      })
      assertThat(failure).isInstanceOf(AssertionError::class.java)
        .hasMessageContaining("timed out after 45 seconds")
      assertThat(failure.suppressed).hasSize(1)
      assertThat(failure.suppressed[0]).hasMessageContaining("FIXTURE_COMMAND_FINALIZATION_ERROR")
      assertThat(failure.suppressed[0].cause).hasMessageContaining("FIXTURE_CHILD_CESSATION_UNCONFIRMED")
      assertThat(waits).containsExactly(45L, 5L)
      assertThat(terminations).isEqualTo(1)
      assertThat(exitReads).isZero()
      assertThat(Files.isRegularFile(requireNotNull(commandFile))).isTrue()
    } finally {
      // No native child was started. End the inert model before deleting its one owned file.
      alive = false
      commandFile?.let { file ->
        val expectedBase = Path.of("../out/ofx").toAbsolutePath().normalize()
        check(file.fileName.toString() == "f.ps1" && file.parent.parent == expectedBase)
        Files.deleteIfExists(file)
      }
    }
  }

  @Test
  fun offlineFixtureOutputKeepsUtf8AndFragmentedPhasesButRedactsDiagnostics() {
    val capture = OfflineFixtureOutput()
    val original = "pièce synthétique €\nM1B_OFFLINE_PHASE phase=AST_ENTER childMs=12\r\n" +
      "M1B_OFFLINE_PHASE phase=PRIVATE_VALUE childMs=13\n" +
      "M1B_OFFLINE_PHASE phase=SCAN_RETURN childMs=1234567\n"
    val bytes = original.toByteArray(StandardCharsets.UTF_8)
    val input = object : java.io.ByteArrayInputStream(bytes) {
      override fun read(buffer: ByteArray, offset: Int, length: Int): Int = super.read(buffer, offset, minOf(length, 3))
    }
    capture.drain(input)
    assertThat(capture.completeOutput()).isEqualTo(original)
    assertThat(capture.diagnostics()).contains("state=EOF", "phase=AST_ENTER childMs=12")
      .doesNotContain("pièce", "PRIVATE_VALUE", "SCAN_RETURN")
  }

  @Test
  fun offlineFixtureOutputRejectsOverflowWhileDrainingAndKeepingLaterPhases() {
    val capture = OfflineFixtureOutput()
    val input = java.io.ByteArrayInputStream(("x".repeat(65537) +
      "\nM1B_OFFLINE_PHASE phase=SCAN_RETURN childMs=23\n").toByteArray(StandardCharsets.UTF_8))
    capture.drain(input)
    assertThat(input.available()).isZero()
    assertThat(capture.diagnostics()).contains("state=EOF kept=65536 overflow=1", "phase=SCAN_RETURN childMs=23")
    assertThatThrownBy { capture.completeOutput() }.hasMessageContaining("FIXTURE_OUTPUT_LIMIT")
  }

  @Test
  fun offlineFixtureOutputRejectsIncompleteAndFailedReads() {
    val capture = OfflineFixtureOutput()
    capture.accept("M1B_OFFLINE_PHASE phase=AST_ENTER childMs=1\n")
    assertThatThrownBy { capture.completeOutput() }.hasMessageContaining("FIXTURE_OUTPUT_INCOMPLETE")
    val input = object : java.io.InputStream() {
      override fun read(): Int = throw java.io.IOException("private-synthetic-read-error")
    }
    assertThatThrownBy { capture.drain(input) }.isInstanceOf(java.io.IOException::class.java)
    assertThat(capture.diagnostics()).contains("state=READ_FAILED", "phase=AST_ENTER")
      .doesNotContain("private-synthetic-read-error")
    assertThatThrownBy { capture.completeOutput() }.hasMessageContaining("FIXTURE_OUTPUT_INCOMPLETE")
  }

  @ParameterizedTest
  @ValueSource(strings = ["EOF_ON_CLOSE", "LATE_PASS", "DRAIN_STUCK", "READ_FAULT", "CHILD_STUCK", "CLOSE_FAULT"])
  @Tag("windows-only")
  fun offlineFixtureTimeoutKeepsPartialDiagnosticsAndFinalizationFailures(scenario: String) {
    val waitingForEof = java.util.concurrent.CountDownLatch(1)
    val release = java.util.concurrent.CountDownLatch(1)
    val readReturned = java.util.concurrent.CountDownLatch(1)
    val readerClosed = java.util.concurrent.CountDownLatch(1)
    val testThread = Thread.currentThread()
    var alive = true
    var terminations = 0
    var exitReads = 0
    var closeCalls = 0
    var commandFile: Path? = null
    val waits = mutableListOf<Long>()
    val input = object : java.io.InputStream() {
      private var first = true
      private var late = scenario == "LATE_PASS"
      override fun read(): Int = throw AssertionError("unexpected single-byte read")
      override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        if (first) {
          first = false
          val prefix = ("private-synthetic-output\nM1B_OFFLINE_PHASE phase=AST_ENTER childMs=7\n")
            .toByteArray(StandardCharsets.UTF_8)
          check(length >= prefix.size)
          prefix.copyInto(buffer, offset)
          return prefix.size
        }
        waitingForEof.countDown() // The previous chunk was already accepted by the single drain.
        check(release.await(15, java.util.concurrent.TimeUnit.SECONDS)) { "test failed to release its inert stream" }
        try {
          if (scenario == "READ_FAULT") throw java.io.IOException("private-synthetic-late-read-error")
          if (late) {
            late = false
            val tail = "M1B_OFFLINE_PHASE phase=SCAN_ASSERTED childMs=44\nPASS\n".toByteArray(StandardCharsets.UTF_8)
            tail.copyInto(buffer, offset)
            return tail.size
          }
          return -1
        } finally {
          readReturned.countDown()
        }
      }
      override fun close() {
        closeCalls++
        if (Thread.currentThread() != testThread) readerClosed.countDown()
        if (scenario != "DRAIN_STUCK") release.countDown()
        if (scenario == "CLOSE_FAULT") throw java.io.IOException("private-synthetic-close-error")
      }
    }
    val child = object : Process() {
      override fun getOutputStream() = java.io.ByteArrayOutputStream()
      override fun getInputStream() = input
      override fun getErrorStream() = java.io.ByteArrayInputStream(byteArrayOf())
      override fun waitFor(): Int = throw AssertionError("unexpected unbounded wait")
      override fun waitFor(timeout: Long, unit: java.util.concurrent.TimeUnit): Boolean {
        waits.add(unit.toSeconds(timeout))
        if (alive) {
          check(waitingForEof.await(5, java.util.concurrent.TimeUnit.SECONDS))
          return false
        }
        return true
      }
      override fun exitValue(): Int { exitReads++; return 0 }
      override fun destroy() { throw AssertionError("unexpected second termination path") }
      override fun destroyForcibly(): Process { terminations++; alive = scenario == "CHILD_STUCK"; return this }
      override fun isAlive() = alive
    }
    try {
      val failure = requireNotNull(catchThrowable {
        runRailPowerShell("throw 'must never execute'") { builder ->
          commandFile = Path.of(builder.command().last())
          child
        }
      })
      assertThat(failure).isInstanceOf(AssertionError::class.java)
        .hasMessageContaining("timed out after 45 seconds")
        .hasMessageContaining("state=READING")
        .hasMessageContaining("phase=AST_ENTER childMs=7")
        .hasMessageNotContaining("private-")
        .hasMessageNotContaining("SCAN_ASSERTED")
        .hasMessageNotContaining("PASS")
      assertThat(waits).containsExactly(45L, 5L)
      assertThat(terminations).isEqualTo(1)
      assertThat(exitReads).isZero()
      assertThat(closeCalls).isGreaterThanOrEqualTo(1)
      if (scenario in setOf("DRAIN_STUCK", "READ_FAULT", "CHILD_STUCK", "CLOSE_FAULT")) {
        assertThat(failure.suppressed).hasSize(1)
        val expected = when (scenario) {
          "DRAIN_STUCK" -> "FIXTURE_OUTPUT_CESSATION_UNCONFIRMED"
          "CHILD_STUCK" -> "FIXTURE_CHILD_CESSATION_UNCONFIRMED"
          "CLOSE_FAULT" -> "FIXTURE_OUTPUT_CLOSE_FAILED"
          else -> "FIXTURE_OUTPUT_READ_FAILED"
        }
        assertThat(failure.suppressed[0]).hasMessageContaining("FIXTURE_COMMAND_FINALIZATION_ERROR")
        assertThat(failure.suppressed[0].cause).hasMessageContaining(expected)
        if (scenario == "CLOSE_FAULT") {
          assertThat(failure.suppressed[0].cause!!.suppressed).hasSize(1)
          assertThat(failure.suppressed[0].cause!!.suppressed[0]).hasMessageContaining("FIXTURE_OUTPUT_READ_FAILED")
        }
        assertThat(Files.isRegularFile(requireNotNull(commandFile)))
          .isEqualTo(scenario in setOf("DRAIN_STUCK", "CHILD_STUCK"))
      } else {
        assertThat(failure.suppressed).isEmpty()
        assertThat(Files.exists(requireNotNull(commandFile))).isFalse()
      }
    } finally {
      alive = false // End only this inert model; no native process was started.
      release.countDown()
      check(readReturned.await(5, java.util.concurrent.TimeUnit.SECONDS))
      check(readerClosed.await(5, java.util.concurrent.TimeUnit.SECONDS))
      commandFile?.let { file ->
        val expectedBase = Path.of("../out/ofx").toAbsolutePath().normalize()
        check(file.fileName.toString() == "f.ps1" && file.parent.parent == expectedBase)
        Files.deleteIfExists(file)
      }
    }
  }

  @Test
  @Tag("windows-only")
  fun offlineFixtureNativeTimeoutTerminatesItsOwnedProcess() {
    var child: Process? = null
    var commandFile: Path? = null
    val started = System.nanoTime()
    val failure = catchThrowable {
      runRailPowerShell("[Threading.Thread]::Sleep(60000)", timeoutSeconds = 5) { builder ->
        commandFile = Path.of(builder.command().last())
        builder.start().also { child = it }
      }
    }
    assertThat(failure).isInstanceOf(AssertionError::class.java).hasMessageContaining("timed out after 5 seconds")
    assertThat(requireNotNull(child).isAlive).isFalse()
    assertThat((System.nanoTime() - started) / 1_000_000).isLessThan(20000L)
    // The real process and reader are gone; pipe-close errors remain observable.
    failure!!.suppressed.forEach { suppressed ->
      assertThat(suppressed).hasMessageContaining("FIXTURE_COMMAND_FINALIZATION_ERROR")
      assertThat(suppressed.cause).hasMessageContaining("FIXTURE_OUTPUT_READ_FAILED")
    }
    assertThat(Files.exists(requireNotNull(commandFile))).isFalse()
  }


  // Keep one drain alive from process start; timeout diagnostics must not wait for EOF.
  // Only closed phase labels and bounded monotone timings enter the diagnostic snapshot.
  private class OfflineFixtureOutput(private val startedNanos: Long = System.nanoTime()) {
    private val output = StringBuilder()
    private val line = StringBuilder()
    private val phases = linkedMapOf<String, String>()
    private var oversizedLine = false
    private var overflow = false
    private var state = "READING"
    private val phasePattern = Regex(
      "M1B_OFFLINE_PHASE phase=(BOOTSTRAP_ENTER|BOOTSTRAP_RETURN|AST_ENTER|AST_RETURN|AST_VALIDATED|" +
        "EXTRACTED|LOAD_ENTER|LOAD_RETURN|BODY_ENTER|ADD_TYPE_ENTER|ADD_TYPE_RETURN|" +
        "SCAN_ENTER|SCAN_RETURN|SCAN_ASSERTED|FINALIZE_ENTER|FINALIZE_RETURN) childMs=([0-9]{1,6})"
    )

    fun drain(stream: java.io.InputStream) {
      try {
        stream.reader(StandardCharsets.UTF_8).use { reader ->
          val buffer = CharArray(2048)
          while (true) {
            val count = reader.read(buffer)
            if (count < 0) break
            accept(String(buffer, 0, count))
          }
        }
        synchronized(this) { state = "EOF" }
      } catch (failure: Throwable) {
        synchronized(this) { state = "READ_FAILED" }
        throw failure
      }
    }

    @Synchronized
    fun accept(chunk: String) {
      val remaining = 65536 - output.length
      output.append(chunk.take(remaining))
      if (chunk.length > remaining) overflow = true
      for (character in chunk) {
        if (character == '\n') {
          if (!oversizedLine) {
            val match = phasePattern.matchEntire(line.toString().removeSuffix("\r"))
            if (match != null) {
              val observedMs = (System.nanoTime() - startedNanos) / 1_000_000
              if (observedMs in 0..999999) {
                // Keep the first occurrence: a late/repeated success cannot replace a prior phase.
                phases.putIfAbsent(match.groupValues[1],
                  "M1B_OFFLINE_TIMING phase=" + match.groupValues[1] +
                    " childMs=" + match.groupValues[2] + " observedMs=" + observedMs)
              }
            }
          }
          line.setLength(0)
          oversizedLine = false
        } else if (line.length < 160 && !oversizedLine) {
          line.append(character)
        } else {
          oversizedLine = true
          line.setLength(0)
        }
      }
    }

    @Synchronized
    fun diagnostics(): String =
      "M1B_OFFLINE_STREAM state=$state kept=" + output.length + " overflow=" + (if (overflow) 1 else 0) +
        "\n" + phases.values.joinToString("\n")

    @Synchronized
    fun completeOutput(): String {
      check(state == "EOF") { "FIXTURE_OUTPUT_INCOMPLETE\n" + diagnostics() }
      check(!overflow) { "FIXTURE_OUTPUT_LIMIT\n" + diagnostics() }
      return output.toString()
    }
  }

  private fun runRailPowerShell(
    body: String,
    tracePhases: Boolean = false,
    timeoutSeconds: Long = 45,
    startProcess: (ProcessBuilder) -> Process = { it.start() }
  ): String {
    require(timeoutSeconds in 1..45)
    val scriptPath = Path.of("scripts/m1-1b-postgresql-rail.ps1")
      .toAbsolutePath()
      .normalize()
      .toString()
      .replace("'", "''")
    val command = buildString {
      appendLine("§script:offlineFixtureClock = [Diagnostics.Stopwatch]::StartNew()")
      appendLine("function Write-OfflineFixturePhase([string]§phase) {")
      if (tracePhases) {
        appendLine("  [Console]::Out.WriteLine('M1B_OFFLINE_PHASE phase=' + §phase + ' childMs=' + §script:offlineFixtureClock.ElapsedMilliseconds)")
      }
      appendLine("}")
      appendLine("Write-OfflineFixturePhase 'BOOTSTRAP_ENTER'")
      appendLine("Write-OfflineFixturePhase 'BOOTSTRAP_RETURN'")
      appendLine("Write-OfflineFixturePhase 'AST_ENTER'")
      append("§railPath = '")
      append(scriptPath)
      appendLine("'")
      appendLine("§parseTokens = §null")
      appendLine("§parseErrors = §null")
      appendLine("§railAst = [System.Management.Automation.Language.Parser]::ParseFile(§railPath, [ref]§parseTokens, [ref]§parseErrors)")
      appendLine("Write-OfflineFixturePhase 'AST_RETURN'")
      appendLine("if (§parseErrors.Count -ne 0) { throw 'rail AST invalid before offline extraction' }")
      appendLine("§cleanBlock = §null")
      appendLine("if (§railAst.PSObject.Properties.Name -contains 'CleanBlock') { §cleanBlock = §railAst.CleanBlock }")
      appendLine("if (§null -ne §railAst.DynamicParamBlock -or §null -ne §railAst.BeginBlock -or §null -ne §railAst.ProcessBlock -or §null -ne §cleanBlock -or §null -eq §railAst.EndBlock) { throw 'unsafe named script block' }")
      appendLine("§expectedParameterTexts = @(")
      appendLine("  '[ValidateSet(''Preflight'', ''Lifecycle'')] [string]§Mode',")
      appendLine("  '[ValidateSet(''B'', ''D'')] [string]§Campaign = ''B''',")
      appendLine("  '[ValidateSet(''Run'', ''CleanupOnly'')] [string]§LifecycleAction = ''Run''',")
      appendLine("  '[ValidatePattern(''^[0-9a-f]{32}$'')] [string]§RunId',")
      appendLine("  '[ValidatePattern(''^[0-9a-f]{64}$'')] [string]§ReviewedObjectSha256',")
      appendLine("  '[ValidatePattern(''^[0-9a-f]{64}$'')] [string]§ExpectedPsqlSha256',")
      appendLine("  '[string]§RunRoot',")
      appendLine("  '[ValidatePattern(''^[A-Z0-9][A-Z0-9._:-]{0,127}$'')] [string]§SensitiveAuthorizationRecordId',")
      appendLine("  '[ValidatePattern(''^[A-Z0-9][A-Z0-9._:-]{0,127}$'')] [string]§PreflightAuthorizationRecordId'")
      appendLine(")")
      appendLine("§actualParameterTexts = @(§railAst.ParamBlock.Parameters | ForEach-Object { (§_.Extent.Text -replace '\\s+', ' ').Trim() })")
      appendLine("if ((§actualParameterTexts -join [char]0) -cne (§expectedParameterTexts -join [char]0)) { throw 'unsafe parameter block' }")
      appendLine("foreach (§parameter in §railAst.ParamBlock.Parameters) {")
      appendLine("  if ((§null -ne §parameter.DefaultValue -and §parameter.Name.VariablePath.UserPath -notin @('Campaign','LifecycleAction')) -or @(§parameter.FindAll({ param(§node) §node -is [System.Management.Automation.Language.CommandAst] -or §node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] }, §true)).Count -ne 0) { throw 'active parameter binding rejected' }")
      appendLine("}")
      appendLine("§allowedAssignments = @(")
      appendLine("  'ErrorActionPreference', 'ProgressPreference', 'script:PsqlExeExact', 'script:GitExeExact',")
      appendLine("  'script:PsqlConnectionExact', 'script:PsqlArgumentsExact', 'script:TargetDatabase',")
      appendLine("  'script:TargetRunnerRole', 'script:TargetJdbcUrl', 'script:DestructiveConsent',")
      appendLine("  'script:EvidenceBaseRoot', 'script:ExpectedBranch', 'script:ExpectedHead',")
      appendLine("  'script:CorrectiveFileSetSummary', 'script:CompositeFileSetSummary',")
      appendLine("  'script:CorrectiveFileSet', 'script:ExpectedAddedFileSet', 'script:CompositeFileSet',")
      appendLine("  'script:BackendRoot', 'script:RepoRoot', 'script:M1BContainedProcessTypeInitialized',")
      appendLine("  'script:PsqlProcessStarts', 'script:DCampaignClock', 'script:DPhaseDeadline', 'script:DPhase',")
      appendLine("  'script:DRunRoot', 'script:DExpectedPostmasterStart', 'script:DChildren', 'script:DCookieDiagnostic', 'script:DBrowserDiagnostic', 'script:DHarnessDiagnostic', 'script:DReadinessCacheVerifiedState', 'script:DQuarantinePath', 'script:DPhaseMinutes'")
      appendLine(")")
      appendLine("§assignmentCounts = @{}")
      appendLine("§footerCount = 0")
      appendLine("§pipelineCount = 0")
      appendLine("foreach (§statement in §railAst.EndBlock.Statements) {")
      appendLine("  if (§statement -is [System.Management.Automation.Language.FunctionDefinitionAst]) { continue }")
      appendLine("  if (§statement -is [System.Management.Automation.Language.AssignmentStatementAst]) {")
      appendLine("    §assignmentName = §statement.Left.Extent.Text.TrimStart([char]'§')")
      appendLine("    if (-not (§allowedAssignments -ccontains §assignmentName)) { throw ('unsafe top-level assignment: ' + §assignmentName) }")
      appendLine("    §assignmentCounts[§assignmentName] = 1 + [int]§assignmentCounts[§assignmentName]")
      appendLine("    §activeNodes = @(§statement.FindAll({ param(§node) §node -is [System.Management.Automation.Language.CommandAst] -or §node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -or §node -is [System.Management.Automation.Language.ScriptBlockExpressionAst] }, §true))")
      appendLine("    if (§assignmentName -in @('script:BackendRoot', 'script:RepoRoot')) {")
      appendLine("      §expectedRootAssignment = if (§assignmentName -ceq 'script:BackendRoot') { '§script:BackendRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent §PSScriptRoot))' } else { '§script:RepoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent §script:BackendRoot))' }")
      appendLine("      if ((§statement.Extent.Text -replace '\\s+', ' ').Trim() -cne §expectedRootAssignment) { throw 'unsafe repository-root initializer' }")
      appendLine("    } elseif (§assignmentName -ceq 'script:DQuarantinePath') {")
      appendLine("      if ((§statement.Extent.Text -replace '\\s+', ' ').Trim() -cne '§script:DQuarantinePath = §script:EvidenceBaseRoot + ''\\.m1d-unreleased.json''' -or §activeNodes.Count -ne 0) { throw 'unexpected quarantine path' }")
      appendLine("    } elseif (§activeNodes.Count -ne 0) { throw ('active top-level assignment: ' + §assignmentName) }")
      appendLine("    continue")
      appendLine("  }")
      appendLine("  if (§statement -is [System.Management.Automation.Language.PipelineAst]) {")
      appendLine("    §pipelineCount++")
      appendLine("    §topText = (§statement.Extent.Text -replace '\\s+', ' ').Trim()")
      appendLine("    §assemblyLoad = \"[void][System.Reflection.Assembly]::Load( 'System.Runtime.Serialization, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089' )\"")
      appendLine("    if (§topText -ceq 'Set-StrictMode -Version Latest' -or §topText -ceq §assemblyLoad) { continue }")
      appendLine("    throw ('unsafe top-level pipeline: ' + §topText)")
      appendLine("  }")
      appendLine("  if (§statement -is [System.Management.Automation.Language.IfStatementAst]) {")
      appendLine("    if (§statement.Clauses[0].Item1.Extent.Text.Trim() -ceq ([string][char]36 + 'Campaign -ceq ' + [char]39 + 'D' + [char]39)) {")
      appendLine("      if (§statement.Clauses.Count -ne 1 -or §null -ne §statement.ElseClause -or @(§statement.FindAll({ param(§node) §node -is [System.Management.Automation.Language.CommandAst] -or §node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] }, §true)).Count -ne 0) { throw 'active D bindings rejected' }")
      appendLine("      foreach (§binding in §statement.Clauses[0].Item2.Statements) { if (§binding -isnot [System.Management.Automation.Language.AssignmentStatementAst] -or §binding.Left.Extent.Text.TrimStart([char]'§') -notin @('script:ExpectedBranch','script:ExpectedHead','script:CorrectiveFileSetSummary','script:CompositeFileSetSummary','script:ExpectedAddedFileSet','script:CompositeFileSet','script:CorrectiveFileSet')) { throw 'unknown D binding' } }")
      appendLine("      continue")
      appendLine("    }")
      appendLine("    §footerCount++")
      appendLine("    §footerCondition = §statement.Clauses[0].Item1.Extent.Text.Trim()")
      appendLine("    §expectedFooterCondition = [string][char]36 + 'MyInvocation.InvocationName -cne ' + [char]39 + '.' + [char]39")
      appendLine("    if (§footerCondition -cne §expectedFooterCondition) { throw 'unsafe top-level conditional' }")
      appendLine("    §footerCommands = @(§statement.FindAll({ param(§node) §node -is [System.Management.Automation.Language.CommandAst] }, §true) | ForEach-Object { §_.GetCommandName() })")
      appendLine("    if (@(§footerCommands | Where-Object { @('Invoke-M1BMain', 'Write-Output', 'Write-Error', 'Get-M1BStopCode') -cnotcontains §_ }).Count -ne 0) { throw 'unsafe command in guarded dispatch' }")
      appendLine("    if (@(§statement.FindAll({ param(§node) §node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] }, §true)).Count -ne 0) { throw 'active expression in guarded dispatch' }")
      appendLine("    continue")
      appendLine("  }")
      appendLine("  throw ('unsafe top-level AST node: ' + §statement.GetType().FullName)")
      appendLine("}")
      appendLine("foreach (§assignmentName in §allowedAssignments) { if ([int]§assignmentCounts[§assignmentName] -ne 1) { throw ('top-level assignment cardinality invalid: ' + §assignmentName) } }")
      appendLine("if (§pipelineCount -ne 2) { throw 'top-level pipeline cardinality invalid' }")
      appendLine("if (§footerCount -ne 1) { throw 'guarded dispatch cardinality invalid' }")
      appendLine("§directCalls = @(§railAst.FindAll({ param(§node) §node -is [System.Management.Automation.Language.CommandAst] -and §node.GetCommandName() -ceq 'Invoke-M1BDirectPsql' }, §true) | ForEach-Object { (§_.Extent.Text -replace '\\s+', ' ').Trim() })")
      appendLine("§expectedDirectCalls = @(")
      appendLine("  'Invoke-M1BDirectPsql -Phase ''Preflight'' -SqlText (Get-M1BPreflightSql) -NeutralRoot §NeutralRoot',")
      appendLine("  'Invoke-M1BDirectPsql -Phase ''Provision'' -SqlText §sql -NeutralRoot §NeutralRoot',")
      appendLine("  'Invoke-M1BDirectPsql -Phase ''Cleanup'' -SqlText §sql -NeutralRoot §NeutralRoot'")
      appendLine(")")
      appendLine("if ((§directCalls -join [char]0) -cne (§expectedDirectCalls -join [char]0)) { throw 'direct psql call inventory invalid' }")
      appendLine("Write-OfflineFixturePhase 'AST_VALIDATED'")
      // Retain the existing AST safety checks, but never load the operational
      // dispatch. Extract exact functions and the validated inert initializers.
      appendLine("§offlineParts = [Collections.Generic.List[string]]::new()")
      appendLine("§offlineParts.Add(§railAst.ParamBlock.Extent.Text)")
      appendLine("foreach (§statement in §railAst.EndBlock.Statements) {")
      appendLine("  if (§statement -is [System.Management.Automation.Language.IfStatementAst] -and §statement.Clauses[0].Item1.Extent.Text.Trim() -ceq §expectedFooterCondition) { continue }")
      appendLine("  §part = §statement.Extent.Text")
      appendLine("  if (§statement -is [System.Management.Automation.Language.AssignmentStatementAst] -and §statement.Left.Extent.Text -ceq '§script:BackendRoot') { §part = '§script:BackendRoot = ' + [char]39 + (Split-Path -Parent (Split-Path -Parent §railPath)).Replace([string][char]39, ([string][char]39 + [char]39)) + [char]39 }")
      appendLine("  §offlineParts.Add(§part)")
      appendLine("}")
      appendLine("§offlineRailSource = §offlineParts -join [Environment]::NewLine")
      appendLine("§offlineRailPath = [IO.Path]::ChangeExtension(§PSCommandPath, '.functions.ps1')")
      appendLine("if ([IO.File]::Exists(§offlineRailPath)) { throw 'EXTRACTION_FIXTURE_COLLISION' }")
      appendLine("[IO.File]::WriteAllText(§offlineRailPath, §offlineRailSource, [Text.UTF8Encoding]::new(§false))")
      appendLine("Write-OfflineFixturePhase 'EXTRACTED'")
      appendLine("§extractionPrimaryFailure=§null; §extractionCleanupFailure=§null")
      appendLine("try {")
      appendLine("Write-OfflineFixturePhase 'LOAD_ENTER'")
      append(". §offlineRailPath -Mode 'Preflight'")
      append(" -RunId '00000000000000000000000000000000'")
      append(" -ReviewedObjectSha256 '")
      append("0".repeat(64))
      append("'")
      append(" -ExpectedPsqlSha256 '")
      append("0".repeat(64))
      append("'")
      append(" -RunRoot 'C:\\dev\\ritomer-local-evidence\\m1-1b-postgresql\\00000000000000000000000000000000'")
      append(" -SensitiveAuthorizationRecordId 'AUTH-OFFLINE-FIXTURE'")
      append('\n')
      // Every offline fixture is isolated from the real local credential file.
      // The dedicated password test retains this block to exercise the true
      // wrapper while substituting only its filesystem boundary.
      appendLine("§realLocalAdminReader=(Get-Command Read-M1DLocalAdminPassword).ScriptBlock")
      appendLine("function Read-M1DLocalAdminPassword { 'offline-fixed-admin-marker' }")
      appendLine("Write-OfflineFixturePhase 'LOAD_RETURN'")
      appendLine("Write-OfflineFixturePhase 'BODY_ENTER'")
      append(body)
      append('\n')
      appendLine("} catch {")
      appendLine("  §extractionPrimaryFailure=§_")
      appendLine("  if (§_.CategoryInfo.Reason -ceq 'ItemNotFoundException' -and §null -ne §_.InvocationInfo -and §null -ne §_.InvocationInfo.MyCommand -and §_.InvocationInfo.MyCommand.Name -ceq 'Get-Item') { Write-Output 'M1D_OFFLINE_GET_ITEM_NOT_FOUND' }")
      appendLine("  if (§_.CategoryInfo.Reason -ceq 'IOException' -and §null -ne §_.InvocationInfo -and §null -ne §_.InvocationInfo.MyCommand -and §_.InvocationInfo.MyCommand.Name -ceq 'Get-Item' -and §_.TargetObject -is [string] -and §_.TargetObject -ceq §script:DQuarantinePath) { Write-Output 'M1D_OFFLINE_QUARANTINE_GET_ITEM_IO' }")
      appendLine("} finally {")
      appendLine("  Write-OfflineFixturePhase 'FINALIZE_ENTER'")
      appendLine("  try { [IO.File]::Delete(§offlineRailPath) } catch {")
      appendLine("    §extractionCleanupFailure=§_")
      appendLine("    Write-Output ('FIXTURE_EXTRACTION_FINALIZATION_ERROR '+(ConvertTo-Json ([ordered]@{step='extracted-functions-delete';target=§offlineRailPath;category=§_.Exception.GetType().FullName;message=§_.Exception.Message}) -Compress))")
      appendLine("  }")
      appendLine("}")
      appendLine("Write-OfflineFixturePhase 'FINALIZE_RETURN'")
      appendLine("if(§null -ne §extractionPrimaryFailure){throw §extractionPrimaryFailure}")
      appendLine("if(§null -ne §extractionCleanupFailure){throw §extractionCleanupFailure}")
    }.replace('§', '$')
    val windows = System.getProperty("os.name").startsWith("Windows", ignoreCase = true)
    val executable = if (windows) {
      Path.of(requireNotNull(System.getenv("SystemRoot")))
        .resolve("System32/WindowsPowerShell/v1.0/powershell.exe")
        .toRealPath()
    } else {
      val pathCandidates = (System.getenv("PATH") ?: "")
        .split(File.pathSeparator)
        .filter(String::isNotBlank)
        .map { Path.of(it).resolve("pwsh") } +
        listOf(Path.of("/usr/bin/pwsh"), Path.of("/usr/local/bin/pwsh"))
      pathCandidates.firstOrNull(Files::isRegularFile)?.toRealPath()
        ?: error("pwsh executable is required for offline rail fixtures")
    }
    val arguments = mutableListOf(
      executable.toString(),
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive"
    )
    if (windows) arguments.addAll(listOf("-ExecutionPolicy", "Bypass"))
    val fixtureBase = Path.of(scriptPath).parent.parent.parent.resolve("out/ofx").normalize()
    Files.createDirectories(fixtureBase)
    val fixtureRoot = Files.createDirectory(fixtureBase.resolve("t" + java.util.UUID.randomUUID().toString().replace("-", "").take(8)))
    val tempRoot = fixtureRoot.toString()
    val commandFile = fixtureRoot.resolve("f.ps1")
    Files.writeString(commandFile, command, StandardCharsets.UTF_8)
    arguments.addAll(listOf("-File", commandFile.toString()))
    val processBuilder = ProcessBuilder(arguments)
      .directory(File("."))
      .redirectErrorStream(true)
    processBuilder.environment().apply {
      val parentPath = System.getenv("PATH") ?: ""
      clear()
      put("PATH", parentPath)
      put("TEMP", tempRoot)
      put("TMP", tempRoot)
      if (windows) {
        put("SystemRoot", requireNotNull(System.getenv("SystemRoot")))
        put("WINDIR", requireNotNull(System.getenv("SystemRoot")))
      } else {
        put("HOME", tempRoot)
        put("TMPDIR", tempRoot)
      }
    }
    var primaryFailure: Throwable? = null
    var fixtureProcess: Process? = null
    var rawOutput: java.io.InputStream? = null
    var outputFuture: java.util.concurrent.CompletableFuture<Void>? = null
    val startedNanos = System.nanoTime()
    val captured = OfflineFixtureOutput(startedNanos)
    try {
      val process = startProcess(processBuilder)
      fixtureProcess = process
      val startMs = (System.nanoTime() - startedNanos) / 1_000_000
      val stream = process.inputStream
      rawOutput = stream
      val drain = java.util.concurrent.CompletableFuture.runAsync { captured.drain(stream) }
      outputFuture = drain
      val finished = process.waitFor(timeoutSeconds, java.util.concurrent.TimeUnit.SECONDS)
      if (!finished) {
        // Snapshot now, before termination or late output; timeout remains the primary failure.
        throw AssertionError("offline PowerShell fixture timed out after $timeoutSeconds seconds target=$commandFile\n" +
          "M1B_OFFLINE_PROCESS startMs=$startMs\n" + captured.diagnostics())
      }
      drain.get(5, java.util.concurrent.TimeUnit.SECONDS)
      val output = captured.completeOutput()
      assertThat(process.exitValue())
        .describedAs("offline PowerShell fixture failed: %s\n%s", output, captured.diagnostics())
        .isZero()
      // Some existing callers consume an exact value without even a trailing newline.
      // Only the scanner diagnostic fixture opts into phase text in its nominal output.
      return if (tracePhases) output + "\nM1B_OFFLINE_PROCESS startMs=$startMs\n" + captured.diagnostics() else output
    } catch (failure: Throwable) {
      primaryFailure = failure
      throw failure
    } finally {
      var cleanupFailure: Throwable? = null
      var childStopped = fixtureProcess == null
      var drainStopped = outputFuture == null
      fun finalizeStep(action: () -> Unit) {
        try {
          action()
        } catch (failure: Throwable) {
          val previous = cleanupFailure
          if (previous == null) cleanupFailure = failure else previous.addSuppressed(failure)
        }
      }
      finalizeStep {
        val process = fixtureProcess
        if (process != null && process.isAlive) {
          process.destroyForcibly()
          process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)
        }
        childStopped = process == null || !process.isAlive
        check(childStopped) { "FIXTURE_CHILD_CESSATION_UNCONFIRMED target=$commandFile" }
      }
      // Attempt every finalizer even when cessation is unconfirmed. Closing the raw
      // pipe does not wait on a BufferedReader's read lock and cannot make timeout pass.
      finalizeStep {
        try {
          rawOutput?.close()
        } catch (failure: Throwable) {
          throw IllegalStateException("FIXTURE_OUTPUT_CLOSE_FAILED", failure)
        }
      }
      finalizeStep {
        val drain = outputFuture
        if (drain != null) {
          try {
            drain.get(5, java.util.concurrent.TimeUnit.SECONDS)
            drainStopped = true
          } catch (failure: java.util.concurrent.ExecutionException) {
            drainStopped = true // Failed, but finished; retain the error and permit owned-file cleanup.
            throw IllegalStateException("FIXTURE_OUTPUT_READ_FAILED", failure.cause)
          } catch (failure: java.util.concurrent.TimeoutException) {
            throw IllegalStateException("FIXTURE_OUTPUT_CESSATION_UNCONFIRMED", failure)
          }
        }
      }
      if (childStopped && drainStopped) finalizeStep {
        check(commandFile.parent == fixtureRoot && fixtureRoot.parent == fixtureBase)
        Files.deleteIfExists(commandFile)
      }
      cleanupFailure?.let { cleanup ->
        val reported = IllegalStateException("FIXTURE_COMMAND_FINALIZATION_ERROR target=$commandFile", cleanup)
        primaryFailure?.addSuppressed(reported) ?: throw reported
      }
    }
  }

  private fun postgresRuntimeGuardSource(): String = Path.of(
    "src/test/kotlin/ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupport.kt"
  ).readText()

  private fun String.sliceBetween(startMarker: String, endMarker: String): String {
    val start = indexOf(startMarker)
    assertThat(start)
      .describedAs("start marker %s", startMarker)
      .isGreaterThanOrEqualTo(0)
    val end = indexOf(endMarker, start + startMarker.length)
    assertThat(end)
      .describedAs("end marker %s", endMarker)
      .isGreaterThan(start)
    return substring(start, end)
  }

  private fun powershellLiteralArray(source: String, assignmentName: String): List<String> {
    val match = Regex(
      """(?ms)^\${'$'}script:${Regex.escape(assignmentName)} = @\(\r?\n(.*?)^\)$"""
    ).find(source)
    assertThat(match).describedAs("PowerShell array %s", assignmentName).isNotNull()
    return requireNotNull(match).groupValues[1].lineSequence()
      .filter(String::isNotBlank)
      .map { line ->
        val item = Regex("""^  '([^']+)'[,]?\r?$""").matchEntire(line)
        assertThat(item).describedAs("literal array item in %s: %s", assignmentName, line).isNotNull()
        requireNotNull(item).groupValues[1]
      }
      .toList()
  }

  private fun assertAppearsInOrder(source: String, vararg markers: String) {
    var previous = -1
    markers.forEach { marker ->
      val current = source.indexOf(marker, previous + 1)
      assertThat(current)
        .describedAs("ordered marker %s", marker)
        .isGreaterThan(previous)
      previous = current
    }
  }

  private fun mainDevtoolsSource(): String {
    val root = Path.of("src/main/kotlin/ch/qamwaq/ritomer/devtools")
    return Files.walk(root).use { paths ->
      paths.asSequence()
        .filter { Files.isRegularFile(it) }
        .sorted()
        .joinToString(separator = "\n") { it.readText() }
    }
  }

  internal companion object {
    const val EXPECTED_JDBC_URL = "jdbc:postgresql://127.0.0.1:15432/ritomer_043b_test"
    const val EXPECTED_ROLE = "ritomer_043b_test_runner"
    const val SYNTHETIC_PASSWORD = "synthetic-password-for-unit-tests-only"
    const val DB_TESTS_ENABLED = "RITOMER_DB_TESTS_ENABLED"
    const val DB_TEST_JDBC_URL = "RITOMER_DB_TEST_JDBC_URL"
    const val DB_TEST_USERNAME = "RITOMER_DB_TEST_USERNAME"
    const val DB_TEST_PASSWORD = "RITOMER_DB_TEST_PASSWORD"
    const val DESTRUCTIVE_CONSENT = "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT"
    const val DB_RAIL_RUN_ID = "RITOMER_DB_RAIL_RUN_ID"
    const val DB_RAIL_RUN_ROOT = "RITOMER_DB_RAIL_RUN_ROOT"
    const val DB_RAIL_REVIEWED_OBJECT_SHA256 = "RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256"
    const val DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER = "RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER"
    const val DB_RAIL_DATABASE_OID = "RITOMER_DB_RAIL_DATABASE_OID"
    const val DB_RAIL_RUNNER_ROLE_OID = "RITOMER_DB_RAIL_RUNNER_ROLE_OID"
    const val DB_RAIL_POSTMASTER_START_UNIX_MICROS = "RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS"
    const val DB_TEST_RUN_ROOT = "RITOMER_DB_TEST_RUN_ROOT"
    const val DB_TEST_PHASE = "RITOMER_DB_TEST_PHASE"
    const val DB_TEST_STORAGE_LOCAL_ROOT = "RITOMER_DB_TEST_STORAGE_LOCAL_ROOT"
    const val DB_TEST_APPLICATION_NAME = "RITOMER_DB_TEST_APPLICATION_NAME"
    const val SYNTHETIC_RUN_ID = "0123456789abcdef0123456789abcdef"
    const val SYNTHETIC_REVIEWED_OBJECT_SHA256 =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    const val SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER = "765432109876543210"
    const val SYNTHETIC_DATABASE_OID = "16401"
    const val SYNTHETIC_ROLE_OID = "16400"
    const val SYNTHETIC_POSTMASTER_START_UNIX_MICROS = "1789300000123456"
    const val SYNTHETIC_PHASE = "targeted"
    const val SYNTHETIC_RUN_ROOT =
      "C:\\dev\\ritomer-local-evidence\\m1-1b-postgresql\\$SYNTHETIC_RUN_ID"
    const val SYNTHETIC_STORAGE_LOCAL_ROOT = "$SYNTHETIC_RUN_ROOT\\volatile\\$SYNTHETIC_PHASE\\local-fs"
    const val SYNTHETIC_APPLICATION_NAME = "ritomer-m1-1b-$SYNTHETIC_RUN_ID-$SYNTHETIC_PHASE"
    const val SPRING_APPLICATION_JSON = "SPRING_APPLICATION_JSON"
    const val SPRING_DATASOURCE_URL = "SPRING_DATASOURCE_URL"
    const val SPRING_DATASOURCE_USERNAME = "SPRING_DATASOURCE_USERNAME"
    const val SPRING_DATASOURCE_PASSWORD = "SPRING_DATASOURCE_PASSWORD"
    const val DATASOURCE_URL = "spring.datasource.url"
    const val DATASOURCE_USERNAME = "spring.datasource.username"
    const val DATASOURCE_PASSWORD = "spring.datasource.password"
    const val DATASOURCE_APPLICATION_NAME =
      "spring.datasource.hikari.data-source-properties.ApplicationName"
    const val DATASOURCE_LOG_SERVER_ERROR_DETAIL =
      "spring.datasource.hikari.data-source-properties.logServerErrorDetail"
    const val DATASOURCE_SSL_MODE = "spring.datasource.hikari.data-source-properties.sslmode"
    const val DATASOURCE_GSS_ENC_MODE = "spring.datasource.hikari.data-source-properties.gssEncMode"
    const val STORAGE_BACKEND = "ritomer.workpapers.documents.storage.backend"
    const val STORAGE_LOCAL_ROOT = "ritomer.workpapers.documents.storage.local-root"
    const val DB_INTEGRATION_TAG = "db-integration"
    const val CASE_INSENSITIVE_TRUE_PATTERN = "(?i:true)"
    const val SUPPORT_INTERNAL_NAME =
      "ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabase"
    const val SUPPORT_FILE_INTERNAL_NAME =
      "ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupportKt"
    const val GUARD_INITIALIZER_INTERNAL_NAME =
      "ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseGuardInitializer"
    const val SCANNER_INTERNAL_NAME =
      "ch/qamwaq/ritomer/devtools/DemoSeedLocalSourceGuardTest"
    const val AUTH_ME_DB_TEST_INTERNAL_NAME =
      "ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest"
    const val FLYWAY_INTERNAL_NAME = "org/flywaydb/core/Flyway"
    const val JDBC_TEMPLATE_INTERNAL_NAME = "org/springframework/jdbc/core/JdbcTemplate"
    const val EXPORTS_DB_TEST_INTERNAL_NAME = "ch/qamwaq/ritomer/ExportsDbIntegrationTest"
    const val PERSISTENCE_DB_TEST_INTERNAL_NAME =
      "ch/qamwaq/ritomer/PersistenceFoundationIntegrationTest"
    const val EXPORT_PACK_DELETE_SQL = "DELETE FROM EXPORT_PACK WHERE ID = ?"
    const val AUDIT_EVENT_DELETE_SQL = "DELETE FROM AUDIT_EVENT WHERE ID = ?"
    const val TRUNCATE_METHOD_NAME = "truncateAllCurrentTables"
    const val RECREATE_SCHEMA_METHOD_NAME = "recreatePublicSchemaForFlyway"

    val ALLOWED_APPEND_ONLY_DELETE_PROBES = mapOf(
      EXPORTS_DB_TEST_INTERNAL_NAME to EXPORT_PACK_DELETE_SQL,
      PERSISTENCE_DB_TEST_INTERNAL_NAME to AUDIT_EVENT_DELETE_SQL
    )

    val EXPECTED_DB_INTEGRATION_CLASSES = listOf(
      "BalanceImportPersistenceIntegrationTest",
      "ControlsDbIntegrationTest",
      "DocumentsDbIntegrationTest",
      "ExportsDbIntegrationTest",
      "FinancialStatementsStructuredDbIntegrationTest",
      "FinancialSummaryDbIntegrationTest",
      "ManualMappingPersistenceIntegrationTest",
      "MappingSuggestionDecisionDbIntegrationTest",
      "PersistenceFoundationIntegrationTest",
      "WorkpapersDbIntegrationTest",
      "DemoSeedLocalAuthMeDbIntegrationTest",
      "DemoSeedLocalDbIntegrationTest"
    )
  }
}

private const val TAG_DESCRIPTOR = "Lorg/junit/jupiter/api/Tag;"
private const val TAGS_DESCRIPTOR = "Lorg/junit/jupiter/api/Tags;"
private const val CONTEXT_CONFIGURATION_DESCRIPTOR =
  "Lorg/springframework/test/context/ContextConfiguration;"
private const val ENABLED_ENVIRONMENT_DESCRIPTOR =
  "Lorg/junit/jupiter/api/condition/EnabledIfEnvironmentVariable;"
private const val AUTO_CONFIGURE_MOCK_MVC_DESCRIPTOR =
  "Lorg/springframework/boot/test/autoconfigure/web/servlet/AutoConfigureMockMvc;"

private data class EnabledEnvironmentCondition(
  val named: String?,
  val matches: String?
)

private data class CompiledMethodCall(
  val owner: String,
  val name: String,
  val descriptor: String
)

private data class CompiledSqlCall(
  val owner: String,
  val name: String,
  val descriptor: String,
  val sqlArgument: String?
)

private data class CompiledMethodFacts(
  val name: String,
  val descriptor: String,
  val methodCalls: MutableList<CompiledMethodCall> = mutableListOf(),
  val sqlCalls: MutableList<CompiledSqlCall> = mutableListOf(),
  val stringConstants: MutableList<String> = mutableListOf(),
  val potentialSqlSurfaces: MutableList<String> = mutableListOf(),
  var unsafeForSqlProof: Boolean = false
)

private data class CompiledClassFacts(
  var internalName: String = "",
  val tags: MutableSet<String> = linkedSetOf(),
  val contextInitializers: MutableList<String> = mutableListOf(),
  val enabledEnvironmentConditions: MutableList<EnabledEnvironmentCondition> = mutableListOf(),
  var autoConfigureMockMvcPresent: Boolean = false,
  var mockMvcPrint: String? = null,
  var mockMvcPrintOnlyOnFailure: Boolean? = null,
  val fieldStringConstants: MutableList<String> = mutableListOf(),
  val methods: MutableList<CompiledMethodFacts> = mutableListOf()
) {
  val simpleName: String
    get() = internalName.substringAfterLast('/')

  val methodCalls: List<CompiledMethodCall>
    get() = methods.flatMap(CompiledMethodFacts::methodCalls)

  fun calls(methodName: String): Boolean = methodCalls.any { call ->
    call.owner == DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME && call.name == methodName
  }
}

private fun CompiledClassFacts.isScannerImplementationClass(): Boolean =
  internalName == DemoSeedLocalSourceGuardTest.SCANNER_INTERNAL_NAME ||
    internalName.startsWith(DemoSeedLocalSourceGuardTest.SCANNER_INTERNAL_NAME + '$')

private data class DestructiveSqlCounts(
  val truncate: Int,
  val dropSchema: Int,
  val createSchema: Int,
  val dropDatabase: Int,
  val dropTable: Int,
  val dropOwned: Int
) {
  val total: Int
    get() = truncate + dropSchema + createSchema + dropDatabase + dropTable + dropOwned
}

private fun compiledProjectTestClasses(): List<CompiledClassFacts> {
  val classesRoot = Path.of(
    DemoSeedLocalSourceGuardTest::class.java.protectionDomain.codeSource.location.toURI()
  )
  check(Files.isDirectory(classesRoot)) {
    "Compiled test classes must be available from a filesystem directory."
  }
  return Files.walk(classesRoot).use { paths ->
    paths.asSequence()
      .filter { Files.isRegularFile(it) && it.toString().endsWith(".class") }
      .sorted()
      .map { scanCompiledClass(Files.readAllBytes(it)) }
      .filter { it.internalName.startsWith("ch/qamwaq/ritomer/") }
      .toList()
  }
}

private fun scanCompiledClass(bytes: ByteArray): CompiledClassFacts {
  val facts = CompiledClassFacts()
  ClassReader(bytes).accept(
    object : ClassVisitor(Opcodes.ASM9) {
      override fun visit(
        version: Int,
        access: Int,
        name: String,
        signature: String?,
        superName: String?,
        interfaces: Array<out String>?
      ) {
        facts.internalName = name
      }

      override fun visitAnnotation(descriptor: String, visible: Boolean): AnnotationVisitor? =
        when (descriptor) {
          TAG_DESCRIPTOR -> tagVisitor(facts)
          TAGS_DESCRIPTOR -> tagsContainerVisitor(facts)
          CONTEXT_CONFIGURATION_DESCRIPTOR -> contextConfigurationVisitor(facts)
          ENABLED_ENVIRONMENT_DESCRIPTOR -> enabledEnvironmentVisitor(facts)
          AUTO_CONFIGURE_MOCK_MVC_DESCRIPTOR -> autoConfigureMockMvcVisitor(facts)
          else -> null
        }

      override fun visitField(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        value: Any?
      ): FieldVisitor? {
        if (value is String) facts.fieldStringConstants += value
        return null
      }

      override fun visitMethod(
        access: Int,
        name: String,
        descriptor: String,
        signature: String?,
        exceptions: Array<out String>?
      ): MethodVisitor {
        val methodFacts = CompiledMethodFacts(name, descriptor)
        facts.methods += methodFacts
        return SqlOperandTrackingMethodVisitor(methodFacts)
      }
    },
    ClassReader.SKIP_DEBUG or ClassReader.EXPAND_FRAMES
  )
  return facts
}

private sealed interface TrackedOperand {
  val slots: Int
}

private data class KnownStringOperand(
  val value: String
) : TrackedOperand {
  override val slots: Int = 1
}

private data class UnknownOperand(
  override val slots: Int = 1
) : TrackedOperand

private class SqlOperandTrackingMethodVisitor(
  private val methodFacts: CompiledMethodFacts
) : MethodVisitor(Opcodes.ASM9) {
  private val operandStack = mutableListOf<TrackedOperand>()
  private val localOperands = mutableMapOf<Int, TrackedOperand>()
  private val controlFlowTargets = linkedSetOf<Label>()
  private val targetsWithUsableFrames = linkedSetOf<Label>()
  private var lastVisitedLabel: Label? = null

  override fun visitFrame(
    type: Int,
    numLocal: Int,
    local: Array<out Any>?,
    numStack: Int,
    stack: Array<out Any>?
  ) {
    localOperands.clear()
    operandStack.clear()
    var frameIsUsable = type == Opcodes.F_NEW
    var localIndex = 0
    local.orEmpty().take(numLocal).forEach { frameOperand ->
      val slots = frameOperandSlots(frameOperand, allowTop = true)
      if (slots == null) {
        frameIsUsable = false
      } else {
        if (frameOperand != Opcodes.TOP) {
          localOperands[localIndex] = UnknownOperand(slots)
        }
        localIndex += slots
      }
    }
    stack.orEmpty().take(numStack).forEach { frameOperand ->
      val slots = frameOperandSlots(frameOperand, allowTop = false)
      if (slots == null) {
        frameIsUsable = false
      } else {
        push(UnknownOperand(slots))
      }
    }
    if (frameIsUsable) {
      lastVisitedLabel?.let(targetsWithUsableFrames::add)
    } else {
      markUnsafe()
    }
  }

  override fun visitInsn(opcode: Int) {
    when (opcode) {
      Opcodes.NOP -> Unit
      Opcodes.ACONST_NULL,
      Opcodes.ICONST_M1,
      Opcodes.ICONST_0,
      Opcodes.ICONST_1,
      Opcodes.ICONST_2,
      Opcodes.ICONST_3,
      Opcodes.ICONST_4,
      Opcodes.ICONST_5,
      Opcodes.FCONST_0,
      Opcodes.FCONST_1,
      Opcodes.FCONST_2 -> push(UnknownOperand())
      Opcodes.LCONST_0,
      Opcodes.LCONST_1,
      Opcodes.DCONST_0,
      Opcodes.DCONST_1 -> push(UnknownOperand(2))
      Opcodes.IALOAD,
      Opcodes.FALOAD,
      Opcodes.AALOAD,
      Opcodes.BALOAD,
      Opcodes.CALOAD,
      Opcodes.SALOAD -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.LALOAD,
      Opcodes.DALOAD -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand(2))
      }
      Opcodes.IASTORE,
      Opcodes.FASTORE,
      Opcodes.AASTORE,
      Opcodes.BASTORE,
      Opcodes.CASTORE,
      Opcodes.SASTORE -> {
        popExpected(1)
        popExpected(1)
        popExpected(1)
      }
      Opcodes.LASTORE,
      Opcodes.DASTORE -> {
        popExpected(2)
        popExpected(1)
        popExpected(1)
      }
      Opcodes.POP -> popExpected(1)
      Opcodes.POP2 -> {
        val first = popRaw()
        when (first?.slots) {
          2 -> Unit
          1 -> {
            val second = popRaw()
            if (second?.slots != 1) markUnsafe()
          }
          else -> markUnsafe()
        }
      }
      Opcodes.DUP -> {
        val operand = operandStack.lastOrNull()
        if (operand?.slots == 1) push(operand) else markUnsafe()
      }
      Opcodes.SWAP -> {
        val first = popRaw()
        val second = popRaw()
        if (first?.slots == 1 && second?.slots == 1) {
          push(first)
          push(second)
        } else {
          markUnsafe()
        }
      }
      Opcodes.DUP_X1,
      Opcodes.DUP_X2,
      Opcodes.DUP2,
      Opcodes.DUP2_X1,
      Opcodes.DUP2_X2 -> markUnsafe()
      Opcodes.IADD,
      Opcodes.FADD,
      Opcodes.ISUB,
      Opcodes.FSUB,
      Opcodes.IMUL,
      Opcodes.FMUL,
      Opcodes.IDIV,
      Opcodes.FDIV,
      Opcodes.IREM,
      Opcodes.FREM,
      Opcodes.ISHL,
      Opcodes.ISHR,
      Opcodes.IUSHR,
      Opcodes.IAND,
      Opcodes.IOR,
      Opcodes.IXOR -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.LADD,
      Opcodes.DADD,
      Opcodes.LSUB,
      Opcodes.DSUB,
      Opcodes.LMUL,
      Opcodes.DMUL,
      Opcodes.LDIV,
      Opcodes.DDIV,
      Opcodes.LREM,
      Opcodes.DREM,
      Opcodes.LAND,
      Opcodes.LOR,
      Opcodes.LXOR -> {
        popExpected(2)
        popExpected(2)
        push(UnknownOperand(2))
      }
      Opcodes.LSHL,
      Opcodes.LSHR,
      Opcodes.LUSHR -> {
        popExpected(1)
        popExpected(2)
        push(UnknownOperand(2))
      }
      Opcodes.INEG,
      Opcodes.FNEG -> {
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.LNEG,
      Opcodes.DNEG -> {
        popExpected(2)
        push(UnknownOperand(2))
      }
      Opcodes.I2L,
      Opcodes.I2D,
      Opcodes.F2L,
      Opcodes.F2D -> convertOperand(fromSlots = 1, toSlots = 2)
      Opcodes.I2F,
      Opcodes.F2I,
      Opcodes.I2B,
      Opcodes.I2C,
      Opcodes.I2S -> convertOperand(fromSlots = 1, toSlots = 1)
      Opcodes.L2I,
      Opcodes.L2F,
      Opcodes.D2I,
      Opcodes.D2F -> convertOperand(fromSlots = 2, toSlots = 1)
      Opcodes.L2D,
      Opcodes.D2L -> convertOperand(fromSlots = 2, toSlots = 2)
      Opcodes.LCMP,
      Opcodes.DCMPL,
      Opcodes.DCMPG -> {
        popExpected(2)
        popExpected(2)
        push(UnknownOperand())
      }
      Opcodes.FCMPL,
      Opcodes.FCMPG -> {
        popExpected(1)
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.IRETURN,
      Opcodes.FRETURN,
      Opcodes.ARETURN -> {
        popExpected(1)
        clearAnalysisState()
      }
      Opcodes.LRETURN,
      Opcodes.DRETURN -> {
        popExpected(2)
        clearAnalysisState()
      }
      Opcodes.RETURN -> clearAnalysisState()
      Opcodes.ARRAYLENGTH -> {
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.ATHROW -> {
        popExpected(1)
        clearAnalysisState()
      }
      Opcodes.MONITORENTER,
      Opcodes.MONITOREXIT -> popExpected(1)
      else -> markUnsafe()
    }
  }

  override fun visitIntInsn(opcode: Int, operand: Int) {
    when (opcode) {
      Opcodes.BIPUSH,
      Opcodes.SIPUSH -> push(UnknownOperand())
      Opcodes.NEWARRAY -> {
        popExpected(1)
        push(UnknownOperand())
      }
      else -> markUnsafe()
    }
  }

  override fun visitVarInsn(opcode: Int, variable: Int) {
    when (opcode) {
      Opcodes.ILOAD,
      Opcodes.FLOAD,
      Opcodes.ALOAD -> loadLocal(variable, 1)
      Opcodes.LLOAD,
      Opcodes.DLOAD -> loadLocal(variable, 2)
      Opcodes.ISTORE,
      Opcodes.FSTORE,
      Opcodes.ASTORE -> localOperands[variable] = popExpected(1)
      Opcodes.LSTORE,
      Opcodes.DSTORE -> localOperands[variable] = popExpected(2)
      else -> markUnsafe()
    }
  }

  override fun visitTypeInsn(opcode: Int, type: String) {
    when (opcode) {
      Opcodes.NEW -> push(UnknownOperand())
      Opcodes.ANEWARRAY -> {
        popExpected(1)
        push(UnknownOperand())
      }
      Opcodes.CHECKCAST -> {
        if (operandStack.lastOrNull()?.slots != 1) markUnsafe()
      }
      Opcodes.INSTANCEOF -> {
        popExpected(1)
        push(UnknownOperand())
      }
      else -> markUnsafe()
    }
  }

  override fun visitFieldInsn(opcode: Int, owner: String, name: String, descriptor: String) {
    val fieldSlots = Type.getType(descriptor).size
    when (opcode) {
      Opcodes.GETSTATIC -> push(UnknownOperand(fieldSlots))
      Opcodes.PUTSTATIC -> popExpected(fieldSlots)
      Opcodes.GETFIELD -> {
        popExpected(1)
        push(UnknownOperand(fieldSlots))
      }
      Opcodes.PUTFIELD -> {
        popExpected(fieldSlots)
        popExpected(1)
      }
      else -> markUnsafe()
    }
  }

  override fun visitMethodInsn(
    opcode: Int,
    owner: String,
    name: String,
    descriptor: String,
    isInterface: Boolean
  ) {
    val argumentTypes = Type.getArgumentTypes(descriptor)
    val arguments = argumentTypes.indices.reversed()
      .map { argumentIndex -> popExpected(argumentTypes[argumentIndex].size) }
      .reversed()
    if (opcode !in setOf(
        Opcodes.INVOKEVIRTUAL,
        Opcodes.INVOKESPECIAL,
        Opcodes.INVOKESTATIC,
        Opcodes.INVOKEINTERFACE
      )
    ) {
      markUnsafe()
    }
    if (opcode != Opcodes.INVOKESTATIC) popExpected(1)

    val call = CompiledMethodCall(owner, name, descriptor)
    methodFacts.methodCalls += call
    if (call.isJdbcSqlSink()) {
      val sqlArgument = if (methodFacts.unsafeForSqlProof) {
        null
      } else {
        arguments.firstOrNull()
          ?.takeIf { argumentTypes.firstOrNull()?.descriptor == "Ljava/lang/String;" }
          ?.let { it as? KnownStringOperand }
          ?.value
      }
      methodFacts.sqlCalls += CompiledSqlCall(owner, name, descriptor, sqlArgument)
    }

    pushReturnValue(descriptor)
  }

  override fun visitInvokeDynamicInsn(
    name: String,
    descriptor: String,
    bootstrapMethodHandle: Handle,
    vararg bootstrapMethodArguments: Any
  ) {
    val argumentTypes = Type.getArgumentTypes(descriptor)
    argumentTypes.indices.reversed().forEach { argumentIndex ->
      popExpected(argumentTypes[argumentIndex].size)
    }
    bootstrapMethodArguments
      .filterIsInstance<String>()
      .filter(::containsDestructiveSqlSurface)
      .forEach(methodFacts.potentialSqlSurfaces::add)
    pushReturnValue(descriptor)
  }

  override fun visitJumpInsn(opcode: Int, label: Label) {
    controlFlowTargets += label
    when (opcode) {
      Opcodes.IFEQ,
      Opcodes.IFNE,
      Opcodes.IFLT,
      Opcodes.IFGE,
      Opcodes.IFGT,
      Opcodes.IFLE,
      Opcodes.IFNULL,
      Opcodes.IFNONNULL -> popExpected(1)
      Opcodes.IF_ICMPEQ,
      Opcodes.IF_ICMPNE,
      Opcodes.IF_ICMPLT,
      Opcodes.IF_ICMPGE,
      Opcodes.IF_ICMPGT,
      Opcodes.IF_ICMPLE,
      Opcodes.IF_ACMPEQ,
      Opcodes.IF_ACMPNE -> {
        popExpected(1)
        popExpected(1)
      }
      Opcodes.GOTO -> clearAnalysisState()
      else -> markUnsafe()
    }
  }

  override fun visitLabel(label: Label) {
    lastVisitedLabel = label
  }

  override fun visitTryCatchBlock(start: Label, end: Label, handler: Label, type: String?) {
    controlFlowTargets += handler
  }

  override fun visitLdcInsn(value: Any?) {
    when (value) {
      is String -> {
        methodFacts.stringConstants += value
        push(KnownStringOperand(value))
      }
      is Long,
      is Double -> push(UnknownOperand(2))
      is Int,
      is Float,
      is Type,
      is Handle -> push(UnknownOperand())
      else -> markUnsafe()
    }
  }

  override fun visitIincInsn(variable: Int, increment: Int) {
    if (localOperands[variable]?.slots == 2) markUnsafe()
    localOperands[variable] = UnknownOperand()
  }

  override fun visitTableSwitchInsn(min: Int, max: Int, defaultLabel: Label, vararg labels: Label) {
    popExpected(1)
    controlFlowTargets += defaultLabel
    controlFlowTargets += labels
    clearAnalysisState()
  }

  override fun visitLookupSwitchInsn(defaultLabel: Label, keys: IntArray, labels: Array<out Label>) {
    popExpected(1)
    controlFlowTargets += defaultLabel
    controlFlowTargets += labels
    clearAnalysisState()
  }

  override fun visitMultiANewArrayInsn(descriptor: String, numDimensions: Int) {
    repeat(numDimensions) { popExpected(1) }
    push(UnknownOperand())
  }

  override fun visitEnd() {
    if (methodFacts.sqlCalls.isNotEmpty() &&
      controlFlowTargets.any { target -> target !in targetsWithUsableFrames }
    ) {
      markUnsafe()
    }
  }

  private fun pushReturnValue(descriptor: String) {
    val returnType = Type.getReturnType(descriptor)
    if (returnType.sort != Type.VOID) push(UnknownOperand(returnType.size))
  }

  private fun convertOperand(fromSlots: Int, toSlots: Int) {
    popExpected(fromSlots)
    push(UnknownOperand(toSlots))
  }

  private fun loadLocal(variable: Int, expectedSlots: Int) {
    val operand = localOperands[variable] ?: UnknownOperand(expectedSlots)
    if (operand.slots == expectedSlots) {
      push(operand)
    } else {
      markUnsafe()
      push(UnknownOperand(expectedSlots))
    }
  }

  private fun push(operand: TrackedOperand) {
    if (operand.slots in 1..2) {
      operandStack += operand
    } else {
      markUnsafe()
    }
  }

  private fun popExpected(expectedSlots: Int): TrackedOperand {
    val operand = popRaw()
    if (operand?.slots == expectedSlots) return operand
    markUnsafe()
    return UnknownOperand(expectedSlots)
  }

  private fun popRaw(): TrackedOperand? {
    if (operandStack.isEmpty()) {
      markUnsafe()
      return null
    }
    return operandStack.removeAt(operandStack.lastIndex)
  }

  private fun markUnsafe() {
    methodFacts.unsafeForSqlProof = true
    methodFacts.sqlCalls.replaceAll { sqlCall -> sqlCall.copy(sqlArgument = null) }
    clearAnalysisState()
  }

  private fun clearAnalysisState() {
    operandStack.clear()
    localOperands.clear()
  }
}

private fun frameOperandSlots(frameOperand: Any, allowTop: Boolean): Int? = when (frameOperand) {
  Opcodes.TOP -> if (allowTop) 1 else null
  Opcodes.INTEGER,
  Opcodes.FLOAT,
  Opcodes.NULL,
  Opcodes.UNINITIALIZED_THIS -> 1
  Opcodes.LONG,
  Opcodes.DOUBLE -> 2
  is String,
  is Label -> 1
  else -> null
}

private fun tagVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visit(name: String?, value: Any?) {
      if (name == "value" && value is String) facts.tags += value
    }
  }

private fun tagsContainerVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visitArray(name: String?): AnnotationVisitor? =
      if (name == "value") {
        object : AnnotationVisitor(Opcodes.ASM9) {
          override fun visitAnnotation(name: String?, descriptor: String?): AnnotationVisitor? =
            if (descriptor == TAG_DESCRIPTOR) tagVisitor(facts) else null
        }
      } else {
        null
      }
  }

private fun contextConfigurationVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visitArray(name: String?): AnnotationVisitor? =
      if (name == "initializers") {
        object : AnnotationVisitor(Opcodes.ASM9) {
          override fun visit(name: String?, value: Any?) {
            if (value is Type) facts.contextInitializers += value.internalName
          }
        }
      } else {
        null
      }
  }

private fun enabledEnvironmentVisitor(facts: CompiledClassFacts): AnnotationVisitor =
  object : AnnotationVisitor(Opcodes.ASM9) {
    private var named: String? = null
    private var matches: String? = null

    override fun visit(name: String?, value: Any?) {
      if (name == "named") named = value as? String
      if (name == "matches") matches = value as? String
    }

    override fun visitEnd() {
      facts.enabledEnvironmentConditions += EnabledEnvironmentCondition(named, matches)
    }
  }

private fun autoConfigureMockMvcVisitor(facts: CompiledClassFacts): AnnotationVisitor {
  facts.autoConfigureMockMvcPresent = true
  return object : AnnotationVisitor(Opcodes.ASM9) {
    override fun visit(name: String?, value: Any?) {
      if (name == "printOnlyOnFailure") facts.mockMvcPrintOnlyOnFailure = value as? Boolean
    }

    override fun visitEnum(name: String?, descriptor: String?, value: String?) {
      if (name == "print") facts.mockMvcPrint = value
    }
  }
}

private fun compiledDestructiveSqlCounts(classes: List<CompiledClassFacts>): DestructiveSqlCounts {
  val candidatesByClass = classes.associateWith(::compiledStringCandidates)
  fun count(pattern: Regex): Int = candidatesByClass.count { (facts, candidates) ->
    facts.hasJdbcExecutionCall() && candidates.any(pattern::containsMatchIn)
  }

  return DestructiveSqlCounts(
    truncate = count(Regex("\\bTRUNCATE\\s+TABLE\\b", RegexOption.IGNORE_CASE)),
    dropSchema = count(Regex("\\bDROP\\s+SCHEMA\\b", RegexOption.IGNORE_CASE)),
    createSchema = count(Regex("\\bCREATE\\s+SCHEMA\\b", RegexOption.IGNORE_CASE)),
    dropDatabase = count(Regex("\\bDROP\\s+DATABASE\\b", RegexOption.IGNORE_CASE)),
    dropTable = count(Regex("\\bDROP\\s+TABLE\\b", RegexOption.IGNORE_CASE)),
    dropOwned = count(Regex("\\bDROP\\s+OWNED\\b", RegexOption.IGNORE_CASE))
  )
}

private fun compiledStringCandidates(facts: CompiledClassFacts): List<String> {
  return buildList {
    addAll(facts.fieldStringConstants)
    facts.methods.forEach { method ->
      addAll(method.stringConstants)
      addAll(method.potentialSqlSurfaces)
      add(method.stringConstants.joinToString(separator = ""))
      add(method.stringConstants.joinToString(separator = " "))
    }
  }.map { candidate -> candidate.replace(Regex("\\s+"), " ").trim() }
}

private fun CompiledMethodCall.isJdbcExecutionCall(): Boolean = when {
  owner in setOf(
    "java/sql/Statement",
    "java/sql/PreparedStatement",
    "java/sql/CallableStatement"
  ) -> name.startsWith("execute") || name == "addBatch"
  owner == DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME ->
    name in setOf("execute", "update", "batchUpdate")
  else -> false
}

private fun CompiledMethodCall.isJdbcSqlSink(): Boolean =
  Type.getArgumentTypes(descriptor).firstOrNull()?.descriptor == "Ljava/lang/String;" &&
    (
      isJdbcExecutionCall() ||
        (owner == "java/sql/Connection" && name in setOf("prepareStatement", "prepareCall"))
      )

private fun CompiledClassFacts.hasJdbcExecutionCall(): Boolean = methodCalls.any { call ->
  call.isJdbcExecutionCall()
}

private val DELETE_FROM_PATTERN = Regex("\\bDELETE\\s+FROM\\b", RegexOption.IGNORE_CASE)
private val DESTRUCTIVE_SQL_SURFACE_PATTERNS = listOf(
  DELETE_FROM_PATTERN,
  Regex("\\bTRUNCATE\\s+TABLE\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+SCHEMA\\b", RegexOption.IGNORE_CASE),
  Regex("\\bCREATE\\s+SCHEMA\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+DATABASE\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+TABLE\\b", RegexOption.IGNORE_CASE),
  Regex("\\bDROP\\s+OWNED\\b", RegexOption.IGNORE_CASE)
)
private const val JDBC_TEMPLATE_UPDATE_DESCRIPTOR = "(Ljava/lang/String;[Ljava/lang/Object;)I"

private fun containsDestructiveSqlSurface(raw: String): Boolean =
  DESTRUCTIVE_SQL_SURFACE_PATTERNS.any { pattern -> pattern.containsMatchIn(raw) }

private fun containsSqlCommentMarker(raw: String): Boolean =
  "/*" in raw || "*/" in raw || "--" in raw

private data class DeleteSqlCallFinding(
  val classInternalName: String,
  val methodName: String,
  val call: CompiledSqlCall,
  val normalizedSql: String?
)

private data class DeleteProbePolicyResult(
  val targetedProbeCount: Int,
  val exportPackProbePassed: Boolean,
  val auditEventProbePassed: Boolean,
  val unexpectedDeleteCount: Int,
  val deleteSqlInsideSupport: Int,
  val unresolvedSqlSinkCount: Int,
  val unsafeSqlMethodCount: Int,
  val sqlCommentSurfaceCount: Int,
  val violations: Set<String>
)

private fun normalizeClosedDeleteSql(raw: String): String? {
  if (containsSqlCommentMarker(raw)) return null
  var normalized = raw.trim().replace(Regex("\\s+"), " ").uppercase()
  val semicolonCount = normalized.count { it == ';' }
  if (semicolonCount > 1 || (semicolonCount == 1 && !normalized.endsWith(';'))) return null
  if (semicolonCount == 1) normalized = normalized.dropLast(1).trimEnd()
  return normalized.takeIf { ';' !in it }
}

private fun deleteSqlSurfaceCount(facts: CompiledClassFacts): Int {
  val fieldCount = facts.fieldStringConstants.count(DELETE_FROM_PATTERN::containsMatchIn)
  val methodCount = facts.methods.sumOf { method ->
    val candidates = method.stringConstants + method.potentialSqlSurfaces
    val directCount = candidates.count(DELETE_FROM_PATTERN::containsMatchIn)
    if (directCount > 0) {
      directCount
    } else {
      val joinedCandidates = listOf(
        method.stringConstants.joinToString(separator = ""),
        method.stringConstants.joinToString(separator = " ")
      )
      if (joinedCandidates.any(DELETE_FROM_PATTERN::containsMatchIn)) 1 else 0
    }
  }
  return fieldCount + methodCount
}

private fun compiledDeleteProbePolicy(
  classes: List<CompiledClassFacts>,
  allowedProbes: Map<String, String>
): DeleteProbePolicyResult {
  val supportNames = setOf(
    DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
    DemoSeedLocalSourceGuardTest.SUPPORT_FILE_INTERNAL_NAME
  )
  val supportClasses = classes.filter { it.internalName in supportNames }
  val deleteSqlInsideSupport = supportClasses.sumOf(::deleteSqlSurfaceCount)
  val scopedClasses = classes.filter { facts ->
    facts.tags.contains(DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG) ||
      facts.internalName in supportNames ||
      facts.internalName in allowedProbes
  }
  val productionClasses = scopedClasses.filterNot { facts ->
    facts.internalName in supportNames ||
      facts.isScannerImplementationClass()
  }
  val surfaceCountByClass = productionClasses.associate { facts ->
    facts.internalName to deleteSqlSurfaceCount(facts)
  }
  val unresolvedSinkCountByClass = productionClasses.associate { facts ->
    facts.internalName to facts.methods.sumOf { method ->
      method.sqlCalls.count { it.sqlArgument == null }
    }
  }
  val unsafeSqlMethodCountByClass = productionClasses.associate { facts ->
    facts.internalName to facts.methods.count { method ->
      method.sqlCalls.isNotEmpty() && method.unsafeForSqlProof
    }
  }
  val sqlCommentSurfaceCountByClass = productionClasses.associate { facts ->
    facts.internalName to facts.methods.sumOf { method ->
      method.sqlCalls.count { sqlCall ->
        sqlCall.sqlArgument?.let(::containsSqlCommentMarker) == true
      }
    }
  }
  val findings = productionClasses.flatMap { facts ->
    facts.methods.flatMap { method ->
      method.sqlCalls.mapNotNull { sqlCall ->
        sqlCall.sqlArgument
          ?.takeIf(DELETE_FROM_PATTERN::containsMatchIn)
          ?.let { sqlArgument ->
          DeleteSqlCallFinding(
            classInternalName = facts.internalName,
            methodName = method.name,
            call = sqlCall,
            normalizedSql = normalizeClosedDeleteSql(sqlArgument)
          )
        }
      }
    }
  }
  fun findingMatchesExpected(finding: DeleteSqlCallFinding): Boolean =
    finding.call.owner == DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME &&
      finding.call.name == "update" &&
      finding.call.descriptor == JDBC_TEMPLATE_UPDATE_DESCRIPTOR &&
      finding.normalizedSql == allowedProbes[finding.classInternalName]

  val classPasses = allowedProbes.mapValues { (classInternalName, expectedSql) ->
    val classFindings = findings.filter { it.classInternalName == classInternalName }
    classFindings.size == 1 &&
      findingMatchesExpected(classFindings.single()) &&
      surfaceCountByClass[classInternalName] == 1 &&
      unresolvedSinkCountByClass[classInternalName] == 0 &&
      unsafeSqlMethodCountByClass[classInternalName] == 0 &&
      sqlCommentSurfaceCountByClass[classInternalName] == 0 &&
      classFindings.single().normalizedSql == expectedSql
  }
  val matchedFindings = findings.filter(::findingMatchesExpected)
  val extraMatchingCalls = matchedFindings.groupingBy(DeleteSqlCallFinding::classInternalName)
    .eachCount()
    .values
    .sumOf { count -> (count - 1).coerceAtLeast(0) }
  val unmatchedCalls = findings.count { !findingMatchesExpected(it) }
  val unboundDeleteSurfaces = (
    surfaceCountByClass.values.sum() - findings.size
    ).coerceAtLeast(0)
  val unexpectedDeleteCount =
    unmatchedCalls + extraMatchingCalls + unboundDeleteSurfaces
  val unresolvedSqlSinkCount = unresolvedSinkCountByClass.values.sum()
  val unsafeSqlMethodCount = unsafeSqlMethodCountByClass.values.sum()
  val sqlCommentSurfaceCount = sqlCommentSurfaceCountByClass.values.sum()
  val targetedProbeCount = classPasses.values.count { it }
  val violations = linkedSetOf<String>()
  if (targetedProbeCount != allowedProbes.size) violations += "DELETE_PROBE_INVENTORY"
  if (unexpectedDeleteCount > 0) violations += "UNEXPECTED_DELETE_OUTSIDE_SUPPORT"
  if (deleteSqlInsideSupport > 0) violations += "DELETE_SQL_INSIDE_SUPPORT"
  if (unresolvedSqlSinkCount > 0) violations += "UNRESOLVED_SQL_SINK"
  if (unsafeSqlMethodCount > 0) violations += "UNSAFE_SQL_METHOD"
  if (sqlCommentSurfaceCount > 0) violations += "SQL_COMMENT_SURFACE"

  return DeleteProbePolicyResult(
    targetedProbeCount = targetedProbeCount,
    exportPackProbePassed = classPasses[DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME]
      ?: false,
    auditEventProbePassed = classPasses[DemoSeedLocalSourceGuardTest.PERSISTENCE_DB_TEST_INTERNAL_NAME]
      ?: false,
    unexpectedDeleteCount = unexpectedDeleteCount,
    deleteSqlInsideSupport = deleteSqlInsideSupport,
    unresolvedSqlSinkCount = unresolvedSqlSinkCount,
    unsafeSqlMethodCount = unsafeSqlMethodCount,
    sqlCommentSurfaceCount = sqlCommentSurfaceCount,
    violations = violations
  )
}

private fun validateSyntheticCompiledSafety(
  classes: List<CompiledClassFacts>,
  expectedDbClasses: Set<String>,
  allowedSchemaRecreateClasses: Set<String> = emptySet(),
  allowedDeleteProbes: Map<String, String> = emptyMap()
): Set<String> {
  val violations = linkedSetOf<String>()
  val dbClasses = classes.filter { it.tags.contains(DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG) }
  if (dbClasses.map(CompiledClassFacts::simpleName).toSet() != expectedDbClasses ||
    dbClasses.size != expectedDbClasses.size
  ) {
    violations += "DB_INTEGRATION_INVENTORY"
  }
  dbClasses.forEach { facts ->
    if (facts.contextInitializers != listOf(DemoSeedLocalSourceGuardTest.GUARD_INITIALIZER_INTERNAL_NAME)) {
      violations += "MISSING_EXACT_INITIALIZER"
    }
    if (facts.enabledEnvironmentConditions != listOf(
        EnabledEnvironmentCondition(
          DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED,
          DemoSeedLocalSourceGuardTest.CASE_INSENSITIVE_TRUE_PATTERN
        )
      )
    ) {
      violations += "MISSING_EXACT_ENABLE_CONDITION"
    }
    if (!facts.calls(DemoSeedLocalSourceGuardTest.TRUNCATE_METHOD_NAME)) {
      violations += "MISSING_TRUNCATE_CALL"
    }
    if (facts.calls(DemoSeedLocalSourceGuardTest.RECREATE_SCHEMA_METHOD_NAME) &&
      facts.simpleName !in allowedSchemaRecreateClasses
    ) {
      violations += "UNAUTHORIZED_SCHEMA_RECREATE_CALL"
    }
  }
  val sql = compiledDestructiveSqlCounts(classes)
  if (sql.truncate > 0) violations += "RAW_DESTRUCTIVE_SQL_TRUNCATE"
  if (sql.dropSchema > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_SCHEMA"
  if (sql.createSchema > 0) violations += "RAW_DESTRUCTIVE_SQL_CREATE_SCHEMA"
  if (sql.dropDatabase > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_DATABASE"
  if (sql.dropTable > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_TABLE"
  if (sql.dropOwned > 0) violations += "RAW_DESTRUCTIVE_SQL_DROP_OWNED"
  violations += compiledDeleteProbePolicy(classes, allowedDeleteProbes).violations
  if (classes.any { facts ->
      facts.methodCalls.any { call ->
        call.owner == DemoSeedLocalSourceGuardTest.FLYWAY_INTERNAL_NAME && call.name == "clean"
      }
    }
  ) {
    violations += "FLYWAY_CLEAN_CALL"
  }
  return violations
}

private data class SyntheticSqlCall(
  val strings: List<String>,
  val owner: String = DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME,
  val name: String = "update",
  val descriptor: String = JDBC_TEMPLATE_UPDATE_DESCRIPTOR
)

private fun syntheticDbClass(
  internalName: String,
  tagged: Boolean = true,
  initializer: Boolean = true,
  enableCondition: Boolean = true,
  truncateCall: Boolean = true,
  recreateCall: Boolean = false,
  strings: List<String> = emptyList(),
  storedStrings: List<String> = emptyList(),
  fieldStrings: List<String> = emptyList(),
  jdbcCall: Boolean = false,
  sqlCalls: List<SyntheticSqlCall> = emptyList()
): ByteArray {
  val writer = ClassWriter(ClassWriter.COMPUTE_FRAMES or ClassWriter.COMPUTE_MAXS)
  writer.visit(Opcodes.V17, Opcodes.ACC_PUBLIC, internalName, null, "java/lang/Object", null)
  if (tagged) {
    writer.visitAnnotation(TAG_DESCRIPTOR, true).apply {
      visit("value", DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG)
      visitEnd()
    }
  }
  fieldStrings.forEachIndexed { index, value ->
    writer.visitField(
      Opcodes.ACC_PRIVATE or Opcodes.ACC_STATIC or Opcodes.ACC_FINAL,
      "SQL_$index",
      "Ljava/lang/String;",
      null,
      value
    ).visitEnd()
  }
  if (initializer) {
    writer.visitAnnotation(CONTEXT_CONFIGURATION_DESCRIPTOR, true).apply {
      visitArray("initializers").apply {
        visit(null, Type.getObjectType(DemoSeedLocalSourceGuardTest.GUARD_INITIALIZER_INTERNAL_NAME))
        visitEnd()
      }
      visitEnd()
    }
  }
  if (enableCondition) {
    writer.visitAnnotation(ENABLED_ENVIRONMENT_DESCRIPTOR, true).apply {
      visit("named", DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED)
      visit("matches", DemoSeedLocalSourceGuardTest.CASE_INSENSITIVE_TRUE_PATTERN)
      visitEnd()
    }
  }
  writer.visitMethod(Opcodes.ACC_PUBLIC or Opcodes.ACC_STATIC, "exercise", "()V", null, null).apply {
    visitCode()
    strings.forEach { value ->
      visitLdcInsn(value)
      visitInsn(Opcodes.POP)
    }
    storedStrings.forEachIndexed { index, value ->
      visitLdcInsn(value)
      visitVarInsn(Opcodes.ASTORE, index)
    }
    if (truncateCall) {
      visitFieldInsn(
        Opcodes.GETSTATIC,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        "INSTANCE",
        "L${DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME};"
      )
      visitInsn(Opcodes.ACONST_NULL)
      visitInsn(Opcodes.ACONST_NULL)
      visitMethodInsn(
        Opcodes.INVOKEVIRTUAL,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        DemoSeedLocalSourceGuardTest.TRUNCATE_METHOD_NAME,
        "(Ljavax/sql/DataSource;Lorg/springframework/core/env/Environment;)V",
        false
      )
    }
    if (recreateCall) {
      visitFieldInsn(
        Opcodes.GETSTATIC,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        "INSTANCE",
        "L${DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME};"
      )
      visitInsn(Opcodes.ACONST_NULL)
      visitInsn(Opcodes.ACONST_NULL)
      visitMethodInsn(
        Opcodes.INVOKEVIRTUAL,
        DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
        DemoSeedLocalSourceGuardTest.RECREATE_SCHEMA_METHOD_NAME,
        "(Ljavax/sql/DataSource;Lorg/springframework/core/env/Environment;)V",
        false
      )
    }
    if (jdbcCall) {
      emitSyntheticSqlCall(
        SyntheticSqlCall(
          strings = listOf(strings.joinToString(separator = "")),
          owner = "java/sql/Statement",
          name = "execute",
          descriptor = "(Ljava/lang/String;)Z"
        )
      )
    }
    sqlCalls.forEach { sqlCall -> emitSyntheticSqlCall(sqlCall) }
    visitInsn(Opcodes.RETURN)
    visitMaxs(0, 0)
    visitEnd()
  }
  writer.visitEnd()
  return writer.toByteArray().also(::verifySyntheticClass)
}

private fun pop2CategoryAdversarialClass(): ByteArray =
  syntheticCustomDbClass(
    internalName = DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
    includeRuntimeSqlMethod = true
  ) {
    visitMethodInsn(
      Opcodes.INVOKESTATIC,
      DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
      "runtimeSql",
      "()Ljava/lang/String;",
      false
    )
    visitVarInsn(Opcodes.ASTORE, 0)
    visitLdcInsn("delete from export_pack where id = ?")
    visitVarInsn(Opcodes.ASTORE, 1)
    visitVarInsn(Opcodes.ALOAD, 0)
    visitVarInsn(Opcodes.ALOAD, 1)
    visitInsn(Opcodes.ICONST_2)
    visitInsn(Opcodes.ICONST_1)
    visitInsn(Opcodes.ISUB)
    visitInsn(Opcodes.POP2)
    visitVarInsn(Opcodes.ASTORE, 2)
    emitJdbcTemplateUpdateFromLocal(2)
  }

private fun invokeDynamicDeleteRecipeClass(): ByteArray =
  syntheticCustomDbClass("fixture/InvokeDynamicDeleteRecipe") {
    visitInsn(Opcodes.ACONST_NULL)
    visitLdcInsn("?")
    visitInvokeDynamicInsn(
      "makeConcatWithConstants",
      "(Ljava/lang/String;)Ljava/lang/String;",
      Handle(
        Opcodes.H_INVOKESTATIC,
        "java/lang/invoke/StringConcatFactory",
        "makeConcatWithConstants",
        "(Ljava/lang/invoke/MethodHandles\$Lookup;Ljava/lang/String;" +
          "Ljava/lang/invoke/MethodType;Ljava/lang/String;[Ljava/lang/Object;)" +
          "Ljava/lang/invoke/CallSite;",
        false
      ),
      "delete from tenant where id = \u0001"
    )
    visitInsn(Opcodes.ICONST_0)
    visitTypeInsn(Opcodes.ANEWARRAY, "java/lang/Object")
    visitMethodInsn(
      Opcodes.INVOKEVIRTUAL,
      DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME,
      "update",
      JDBC_TEMPLATE_UPDATE_DESCRIPTOR,
      false
    )
    visitInsn(Opcodes.POP)
  }

private fun branchWithoutFramesAdversarialClass(): ByteArray =
  syntheticCustomDbClass(
    internalName = DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
    version = Opcodes.V1_5,
    computeFrames = false,
    includeRuntimeSqlMethod = true
  ) {
    visitMethodInsn(
      Opcodes.INVOKESTATIC,
      DemoSeedLocalSourceGuardTest.EXPORTS_DB_TEST_INTERNAL_NAME,
      "runtimeSql",
      "()Ljava/lang/String;",
      false
    )
    visitVarInsn(Opcodes.ASTORE, 0)
    val join = Label()
    visitInsn(Opcodes.ICONST_0)
    visitJumpInsn(Opcodes.IFEQ, join)
    visitLdcInsn("delete from export_pack where id = ?")
    visitVarInsn(Opcodes.ASTORE, 0)
    visitLabel(join)
    emitJdbcTemplateUpdateFromLocal(0)
  }

private fun runtimeBuiltSqlSinkClass(): ByteArray =
  syntheticCustomDbClass(
    internalName = "fixture/RuntimeBuiltSqlSink",
    includeRuntimeSqlMethod = true
  ) {
    visitMethodInsn(
      Opcodes.INVOKESTATIC,
      "fixture/RuntimeBuiltSqlSink",
      "runtimeSql",
      "()Ljava/lang/String;",
      false
    )
    visitVarInsn(Opcodes.ASTORE, 0)
    emitJdbcTemplateUpdateFromLocal(0)
  }

private fun syntheticCustomDbClass(
  internalName: String,
  version: Int = Opcodes.V17,
  computeFrames: Boolean = true,
  includeRuntimeSqlMethod: Boolean = false,
  exercise: MethodVisitor.() -> Unit
): ByteArray {
  val writerFlags = ClassWriter.COMPUTE_MAXS or
    if (computeFrames) ClassWriter.COMPUTE_FRAMES else 0
  val writer = ClassWriter(writerFlags)
  writer.visit(version, Opcodes.ACC_PUBLIC, internalName, null, "java/lang/Object", null)
  writer.visitAnnotation(TAG_DESCRIPTOR, true).apply {
    visit("value", DemoSeedLocalSourceGuardTest.DB_INTEGRATION_TAG)
    visitEnd()
  }
  writer.visitAnnotation(CONTEXT_CONFIGURATION_DESCRIPTOR, true).apply {
    visitArray("initializers").apply {
      visit(null, Type.getObjectType(DemoSeedLocalSourceGuardTest.GUARD_INITIALIZER_INTERNAL_NAME))
      visitEnd()
    }
    visitEnd()
  }
  writer.visitAnnotation(ENABLED_ENVIRONMENT_DESCRIPTOR, true).apply {
    visit("named", DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED)
    visit("matches", DemoSeedLocalSourceGuardTest.CASE_INSENSITIVE_TRUE_PATTERN)
    visitEnd()
  }
  if (includeRuntimeSqlMethod) {
    writer.visitMethod(
      Opcodes.ACC_PRIVATE or Opcodes.ACC_STATIC,
      "runtimeSql",
      "()Ljava/lang/String;",
      null,
      null
    ).apply {
      visitCode()
      emitRuntimeSqlFromCharArray()
      visitMaxs(0, 0)
      visitEnd()
    }
  }
  writer.visitMethod(Opcodes.ACC_PUBLIC or Opcodes.ACC_STATIC, "exercise", "()V", null, null).apply {
    visitCode()
    emitGuardedTruncateCall()
    exercise()
    visitInsn(Opcodes.RETURN)
    visitMaxs(0, 0)
    visitEnd()
  }
  writer.visitEnd()
  return writer.toByteArray().also(::verifySyntheticClass)
}

private fun MethodVisitor.emitGuardedTruncateCall() {
  visitFieldInsn(
    Opcodes.GETSTATIC,
    DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
    "INSTANCE",
    "L${DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME};"
  )
  visitInsn(Opcodes.ACONST_NULL)
  visitInsn(Opcodes.ACONST_NULL)
  visitMethodInsn(
    Opcodes.INVOKEVIRTUAL,
    DemoSeedLocalSourceGuardTest.SUPPORT_INTERNAL_NAME,
    DemoSeedLocalSourceGuardTest.TRUNCATE_METHOD_NAME,
    "(Ljavax/sql/DataSource;Lorg/springframework/core/env/Environment;)V",
    false
  )
}

private fun MethodVisitor.emitRuntimeSqlFromCharArray() {
  val sqlCharacters = "update tenant set active = true".toCharArray()
  emitIntegerConstant(sqlCharacters.size)
  visitIntInsn(Opcodes.NEWARRAY, Opcodes.T_CHAR)
  visitVarInsn(Opcodes.ASTORE, 0)
  sqlCharacters.forEachIndexed { index, character ->
    visitVarInsn(Opcodes.ALOAD, 0)
    emitIntegerConstant(index)
    emitIntegerConstant(character.code)
    visitInsn(Opcodes.CASTORE)
  }
  visitTypeInsn(Opcodes.NEW, "java/lang/String")
  visitInsn(Opcodes.DUP)
  visitVarInsn(Opcodes.ALOAD, 0)
  visitMethodInsn(Opcodes.INVOKESPECIAL, "java/lang/String", "<init>", "([C)V", false)
  visitInsn(Opcodes.ARETURN)
}

private fun MethodVisitor.emitIntegerConstant(value: Int) {
  when (value) {
    -1 -> visitInsn(Opcodes.ICONST_M1)
    0 -> visitInsn(Opcodes.ICONST_0)
    1 -> visitInsn(Opcodes.ICONST_1)
    2 -> visitInsn(Opcodes.ICONST_2)
    3 -> visitInsn(Opcodes.ICONST_3)
    4 -> visitInsn(Opcodes.ICONST_4)
    5 -> visitInsn(Opcodes.ICONST_5)
    in Byte.MIN_VALUE..Byte.MAX_VALUE -> visitIntInsn(Opcodes.BIPUSH, value)
    else -> visitIntInsn(Opcodes.SIPUSH, value)
  }
}

private fun MethodVisitor.emitJdbcTemplateUpdateFromLocal(localIndex: Int) {
  visitInsn(Opcodes.ACONST_NULL)
  visitVarInsn(Opcodes.ALOAD, localIndex)
  visitInsn(Opcodes.ICONST_0)
  visitTypeInsn(Opcodes.ANEWARRAY, "java/lang/Object")
  visitMethodInsn(
    Opcodes.INVOKEVIRTUAL,
    DemoSeedLocalSourceGuardTest.JDBC_TEMPLATE_INTERNAL_NAME,
    "update",
    JDBC_TEMPLATE_UPDATE_DESCRIPTOR,
    false
  )
  visitInsn(Opcodes.POP)
}

private fun MethodVisitor.emitSyntheticSqlCall(sqlCall: SyntheticSqlCall) {
  visitInsn(Opcodes.ACONST_NULL)
  Type.getArgumentTypes(sqlCall.descriptor).forEachIndexed { argumentIndex, argumentType ->
    if (argumentIndex == 0 && argumentType.descriptor == "Ljava/lang/String;") {
      emitSyntheticSqlOperand(sqlCall.strings)
    } else {
      emitDefaultOperand(argumentType)
    }
  }
  val isInterface = sqlCall.owner.startsWith("java/sql/")
  visitMethodInsn(
    if (isInterface) Opcodes.INVOKEINTERFACE else Opcodes.INVOKEVIRTUAL,
    sqlCall.owner,
    sqlCall.name,
    sqlCall.descriptor,
    isInterface
  )
  Type.getReturnType(sqlCall.descriptor).let { returnType ->
    if (returnType.sort != Type.VOID) {
      visitInsn(if (returnType.size == 2) Opcodes.POP2 else Opcodes.POP)
    }
  }
}

private fun MethodVisitor.emitSyntheticSqlOperand(strings: List<String>) {
  when (strings.size) {
    0 -> visitInsn(Opcodes.ACONST_NULL)
    1 -> visitLdcInsn(strings.single())
    else -> {
      visitTypeInsn(Opcodes.NEW, "java/lang/StringBuilder")
      visitInsn(Opcodes.DUP)
      visitMethodInsn(Opcodes.INVOKESPECIAL, "java/lang/StringBuilder", "<init>", "()V", false)
      strings.forEach { fragment ->
        visitLdcInsn(fragment)
        visitMethodInsn(
          Opcodes.INVOKEVIRTUAL,
          "java/lang/StringBuilder",
          "append",
          "(Ljava/lang/String;)Ljava/lang/StringBuilder;",
          false
        )
      }
      visitMethodInsn(
        Opcodes.INVOKEVIRTUAL,
        "java/lang/StringBuilder",
        "toString",
        "()Ljava/lang/String;",
        false
      )
    }
  }
}

private fun MethodVisitor.emitDefaultOperand(type: Type) {
  when (type.sort) {
    Type.BOOLEAN,
    Type.BYTE,
    Type.CHAR,
    Type.SHORT,
    Type.INT -> visitInsn(Opcodes.ICONST_0)
    Type.FLOAT -> visitInsn(Opcodes.FCONST_0)
    Type.LONG -> visitInsn(Opcodes.LCONST_0)
    Type.DOUBLE -> visitInsn(Opcodes.DCONST_0)
    else -> visitInsn(Opcodes.ACONST_NULL)
  }
}

private fun verifySyntheticClass(bytes: ByteArray) {
  val verifier = object : ClassLoader(DemoSeedLocalSourceGuardTest::class.java.classLoader) {
    fun defineAndResolve(): Class<*> =
      defineClass(null, bytes, 0, bytes.size).also(::resolveClass)
  }
  verifier.defineAndResolve().declaredMethods
}

// Independent oracle: never derive this inventory or its values from the runtime guard.
private val INDEPENDENT_ALL_SETTINGS = linkedMapOf(
  "log_statement" to "none",
  "log_min_error_statement" to "panic",
  "log_min_duration_statement" to "-1",
  "log_min_duration_sample" to "-1",
  "log_statement_sample_rate" to "0",
  "log_transaction_sample_rate" to "0",
  "log_parameter_max_length" to "0",
  "log_parameter_max_length_on_error" to "0",
  "log_duration" to "off",
  "log_min_messages" to "panic",
  "log_error_verbosity" to "terse",
  "debug_print_parse" to "off",
  "debug_print_rewritten" to "off",
  "debug_print_plan" to "off",
  "log_statement_stats" to "off",
  "log_parser_stats" to "off",
  "log_planner_stats" to "off",
  "log_executor_stats" to "off",
  "track_activities" to "off",
  "compute_query_id" to "off",
  "shared_preload_libraries" to "",
  "session_preload_libraries" to "",
  "local_preload_libraries" to ""
)
private val INDEPENDENT_ADMINISTRATIVE_SETTINGS = setOf("shared_preload_libraries", "session_preload_libraries")
private val INDEPENDENT_SESSION_SETTINGS = INDEPENDENT_ALL_SETTINGS.filterKeys {
  it !in INDEPENDENT_ADMINISTRATIVE_SETTINGS
}

private data class SyntheticSettingOverride(val databaseOid: String, val roleOid: String, val entry: String)
private data class SyntheticParameterGrant(val grantee: String, val parameter: String, val privilege: String)
private data class SyntheticRoleMembership(val grantedRole: String, val memberRole: String)

// Projects synthetic catalogue facts to JDBC boundary rows; it never interprets or executes SQL.
private data class SyntheticPreloadCatalogue(
  val roleDefaults: List<String?> = listOf("session_preload_libraries="),
  val overrides: List<SyntheticSettingOverride> = emptyList(),
  val grants: List<SyntheticParameterGrant> = emptyList(),
  val memberships: List<SyntheticRoleMembership> = emptyList()
) {
  fun roleDefaultEmpty(): Boolean {
    val relevant = roleDefaults.filter { it?.substringBefore('=')?.equals("session_preload_libraries", ignoreCase = true) == true }
    return relevant.size == 1 && relevant.single() == "session_preload_libraries="
  }

  fun overridesAbsent(): Boolean = overrides.none {
    it.databaseOid == DemoSeedLocalSourceGuardTest.SYNTHETIC_DATABASE_OID &&
      it.roleOid in setOf("0", DemoSeedLocalSourceGuardTest.SYNTHETIC_ROLE_OID) &&
      it.entry.substringBefore('=').equals("session_preload_libraries", ignoreCase = true)
  }

  fun mutationPrivilegesAbsent(): Boolean {
    val effectiveRoles = mutableSetOf("PUBLIC", DemoSeedLocalSourceGuardTest.EXPECTED_ROLE)
    do {
      val previousSize = effectiveRoles.size
      memberships.filter { it.memberRole in effectiveRoles }.forEach { effectiveRoles += it.grantedRole }
    } while (effectiveRoles.size != previousSize)
    return grants.none {
      it.grantee in effectiveRoles &&
        ((it.parameter == "session_preload_libraries" && it.privilege in setOf("SET", "ALTER SYSTEM")) ||
          (it.parameter == "shared_preload_libraries" && it.privilege == "ALTER SYSTEM"))
    }
  }

  fun runnerMembershipCount(): String = memberships.count {
    it.memberRole == DemoSeedLocalSourceGuardTest.EXPECTED_ROLE || it.grantedRole == DemoSeedLocalSourceGuardTest.EXPECTED_ROLE
  }.toString()
}

private data class JdbcOptions(
  val metadataUrl: String = DemoSeedLocalSourceGuardTest.EXPECTED_JDBC_URL,
  val metadataUsername: String = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val metadataDriverVersion: String? = "42.7.10",
  val metadataAbsent: Boolean = false,
  val metadataFailureMethod: String? = null,
  val metadataFailure: Throwable? = null,
  val database: String? = "ritomer_043b_test",
  val currentUser: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val sessionUser: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val serverAddress: String? = "127.0.0.1",
  val serverPort: String? = "15432",
  val applicationName: String? = DemoSeedLocalSourceGuardTest.SYNTHETIC_APPLICATION_NAME,
  val serverVersionNumber: String? = "170000",
  val ssl: Boolean? = false,
  val gss: Boolean? = false,
  val postmasterStartUnixMicros: String? = DemoSeedLocalSourceGuardTest.SYNTHETIC_POSTMASTER_START_UNIX_MICROS,
  val restrictAdministrativeSettings: Boolean = true,
  val sessionSettingOverrides: Map<String, String?> = emptyMap(),
  val roleOid: String? = DemoSeedLocalSourceGuardTest.SYNTHETIC_ROLE_OID,
  val roleCanLogin: Boolean? = true,
  val dangerousPrivilegeIndex: Int? = null,
  val roleConnectionLimit: String? = "16",
  val roleProvenance: String? = postgresTestRailProvenance(
    DemoSeedLocalSourceGuardTest.SYNTHETIC_RUN_ID,
    DemoSeedLocalSourceGuardTest.SYNTHETIC_REVIEWED_OBJECT_SHA256,
    DemoSeedLocalSourceGuardTest.SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER
  ),
  val explicitMembershipCount: String? = "0",
  val databaseOid: String? = DemoSeedLocalSourceGuardTest.SYNTHETIC_DATABASE_OID,
  val databaseOwner: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val databaseProvenance: String? = postgresTestRailProvenance(
    DemoSeedLocalSourceGuardTest.SYNTHETIC_RUN_ID,
    DemoSeedLocalSourceGuardTest.SYNTHETIC_REVIEWED_OBJECT_SHA256,
    DemoSeedLocalSourceGuardTest.SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER
  ),
  val databaseAllowsConnections: Boolean? = true,
  val databaseIsTemplate: Boolean? = false,
  val publicSchemaOwner: String? = DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
  val databaseAclExact: Boolean? = true,
  val publicSchemaAclExact: Boolean? = true,
  val userSchemaCount: String? = "1",
  val sessionPreloadRoleDefaultEmpty: Boolean? = true,
  val sessionPreloadOverridesAbsent: Boolean? = true,
  val preloadMutationPrivilegesAbsent: Boolean? = true,
  val preloadCatalogue: SyntheticPreloadCatalogue? = null,
  val connectionFailure: Throwable? = null,
  val statementOpenFailure: Throwable? = null,
  val selectFailureIndex: Int? = null,
  val selectFailure: Throwable? = null,
  val rowCountOverrides: Map<Int, Int> = emptyMap(),
  val resultFailureQuery: Int? = null,
  val resultFailureMethod: String? = null,
  val resultFailure: Throwable? = null,
  val resultSetCloseFailures: Map<Int, Throwable> = emptyMap(),
  val statementCloseFailure: Throwable? = null,
  val connectionCloseFailure: Throwable? = null,
  val destructiveFailure: SQLException? = null,
  val rollbackFailure: SQLException? = null
)

private data class JdbcState(
  var acquisitionCount: Int = 0,
  var queryCount: Int = 0,
  var executeCount: Int = 0,
  var commitCount: Int = 0,
  var rollbackCount: Int = 0,
  var closeCount: Int = 0,
  var statementCloseCount: Int = 0,
  var resultSetCloseCount: Int = 0,
  var connectionProperties: Properties? = null,
  var autoCommit: Boolean = true,
  val events: MutableList<String> = mutableListOf(),
  val queriedSql: MutableList<String> = mutableListOf(),
  val destructiveSql: MutableList<String> = mutableListOf()
)

private data class JdbcFixture(
  val dataSource: DataSource,
  val state: JdbcState,
  val options: JdbcOptions
)

private fun canonicalEnvironment(
  processOverrides: Map<String, String?> = emptyMap(),
  springOverrides: Map<String, String> = emptyMap(),
  systemOverrides: Map<String, String> = emptyMap()
): MockEnvironment {
  val processValues = mutableMapOf<String, Any>(
    DemoSeedLocalSourceGuardTest.DB_TESTS_ENABLED to "true",
    DemoSeedLocalSourceGuardTest.DB_TEST_JDBC_URL to DemoSeedLocalSourceGuardTest.EXPECTED_JDBC_URL,
    DemoSeedLocalSourceGuardTest.DB_TEST_USERNAME to DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
    DemoSeedLocalSourceGuardTest.DB_TEST_PASSWORD to DemoSeedLocalSourceGuardTest.SYNTHETIC_PASSWORD,
    DemoSeedLocalSourceGuardTest.DESTRUCTIVE_CONSENT to "TRUNCATE_RITOMER_043B_TEST",
    DemoSeedLocalSourceGuardTest.DB_RAIL_RUN_ID to DemoSeedLocalSourceGuardTest.SYNTHETIC_RUN_ID,
    DemoSeedLocalSourceGuardTest.DB_RAIL_RUN_ROOT to DemoSeedLocalSourceGuardTest.SYNTHETIC_RUN_ROOT,
    DemoSeedLocalSourceGuardTest.DB_RAIL_REVIEWED_OBJECT_SHA256 to
      DemoSeedLocalSourceGuardTest.SYNTHETIC_REVIEWED_OBJECT_SHA256,
    DemoSeedLocalSourceGuardTest.DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER to
      DemoSeedLocalSourceGuardTest.SYNTHETIC_CLUSTER_SYSTEM_IDENTIFIER,
    DemoSeedLocalSourceGuardTest.DB_RAIL_DATABASE_OID to DemoSeedLocalSourceGuardTest.SYNTHETIC_DATABASE_OID,
    DemoSeedLocalSourceGuardTest.DB_RAIL_RUNNER_ROLE_OID to DemoSeedLocalSourceGuardTest.SYNTHETIC_ROLE_OID,
    DemoSeedLocalSourceGuardTest.DB_RAIL_POSTMASTER_START_UNIX_MICROS to
      DemoSeedLocalSourceGuardTest.SYNTHETIC_POSTMASTER_START_UNIX_MICROS,
    DemoSeedLocalSourceGuardTest.DB_TEST_RUN_ROOT to DemoSeedLocalSourceGuardTest.SYNTHETIC_RUN_ROOT,
    DemoSeedLocalSourceGuardTest.DB_TEST_PHASE to DemoSeedLocalSourceGuardTest.SYNTHETIC_PHASE,
    DemoSeedLocalSourceGuardTest.DB_TEST_STORAGE_LOCAL_ROOT to
      DemoSeedLocalSourceGuardTest.SYNTHETIC_STORAGE_LOCAL_ROOT,
    DemoSeedLocalSourceGuardTest.DB_TEST_APPLICATION_NAME to
      DemoSeedLocalSourceGuardTest.SYNTHETIC_APPLICATION_NAME
  )
  processOverrides.forEach { (name, value) ->
    if (value == null) processValues.remove(name) else processValues[name] = value
  }

  val systemValues: Map<String, Any> = systemOverrides
  return MockEnvironment().apply {
    propertySources.replaceOrAdd(
      StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME,
      MapPropertySource(StandardEnvironment.SYSTEM_ENVIRONMENT_PROPERTY_SOURCE_NAME, processValues)
    )
    propertySources.replaceOrAdd(
      StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME,
      MapPropertySource(
        StandardEnvironment.SYSTEM_PROPERTIES_PROPERTY_SOURCE_NAME,
        systemValues
      )
    )
    val canonicalSpringValues = linkedMapOf(
      DemoSeedLocalSourceGuardTest.DATASOURCE_URL to DemoSeedLocalSourceGuardTest.EXPECTED_JDBC_URL,
      DemoSeedLocalSourceGuardTest.DATASOURCE_USERNAME to DemoSeedLocalSourceGuardTest.EXPECTED_ROLE,
      DemoSeedLocalSourceGuardTest.DATASOURCE_PASSWORD to DemoSeedLocalSourceGuardTest.SYNTHETIC_PASSWORD,
      DemoSeedLocalSourceGuardTest.DATASOURCE_APPLICATION_NAME to
        DemoSeedLocalSourceGuardTest.SYNTHETIC_APPLICATION_NAME,
      DemoSeedLocalSourceGuardTest.DATASOURCE_LOG_SERVER_ERROR_DETAIL to "false",
      DemoSeedLocalSourceGuardTest.DATASOURCE_SSL_MODE to "disable",
      DemoSeedLocalSourceGuardTest.DATASOURCE_GSS_ENC_MODE to "disable",
      DemoSeedLocalSourceGuardTest.STORAGE_BACKEND to "LOCAL_FS",
      DemoSeedLocalSourceGuardTest.STORAGE_LOCAL_ROOT to
        DemoSeedLocalSourceGuardTest.SYNTHETIC_STORAGE_LOCAL_ROOT,
      "spring.flyway.enabled" to "true",
      "spring.flyway.clean-disabled" to "true",
      "spring.sql.init.mode" to "never"
    )
    canonicalSpringValues.forEach { (name, canonicalValue) ->
      setProperty(name, springOverrides[name] ?: canonicalValue)
    }
  }
}

private fun org.springframework.core.env.MutablePropertySources.replaceOrAdd(
  name: String,
  source: MapPropertySource
) {
  if (contains(name)) replace(name, source) else addLast(source)
}

private fun jdbcFixture(options: JdbcOptions = JdbcOptions()): JdbcFixture {
  val state = JdbcState()
  lateinit var connection: Connection

  val metadata = proxy<DatabaseMetaData> { method, _ ->
    if (method.name == options.metadataFailureMethod) options.metadataFailure?.let { throw it }
    when (method.name) {
      "getURL" -> options.metadataUrl
      "getUserName" -> options.metadataUsername
      "getDriverVersion" -> options.metadataDriverVersion
      else -> defaultProxyValue(method)
    }
  }

  val statement = proxy<Statement> { method, arguments ->
    when (method.name) {
      "executeQuery" -> {
        state.queryCount += 1
        state.events += "query"
        val rawSql = arguments?.get(0).toString()
        state.queriedSql += rawSql
        if (options.selectFailureIndex == state.queryCount) {
          throw options.selectFailure ?: SQLException("synthetic SELECT failure")
        }
        val sql = rawSql.lowercase()
        if (options.restrictAdministrativeSettings && Regex(
            """(?:\bpg_catalog\.)?\bcurrent_setting\s*\(\s*'(?:shared|session)_preload_libraries'""",
            RegexOption.IGNORE_CASE
          ).containsMatchIn(rawSql)) {
          throw SQLException("synthetic reserved setting access denied", "42501")
        }
        val row = when {
          sql.contains("current_database()") ->
            buildList {
              add(options.database)
              add(options.currentUser)
              add(options.sessionUser)
              add(options.serverAddress)
              add(options.serverPort)
              add(options.applicationName)
              add(options.serverVersionNumber)
              add(options.ssl)
              add(options.gss)
              add(options.postmasterStartUnixMicros)
              INDEPENDENT_SESSION_SETTINGS.forEach { (name, expected) ->
                add(if (options.sessionSettingOverrides.containsKey(name)) {
                  options.sessionSettingOverrides[name]
                } else {
                  expected
                })
              }
            }
          sql.contains("pg_auth_members") -> listOf(options.preloadCatalogue?.runnerMembershipCount() ?: options.explicitMembershipCount)
          Regex("""from\s+(?:pg_catalog\.)?pg_roles\b""").containsMatchIn(sql) ->
            buildList {
              add(options.roleOid)
              add(options.roleCanLogin)
              (0..5).forEach { index -> add(index == options.dangerousPrivilegeIndex) }
              add(options.roleConnectionLimit)
              add(options.roleProvenance)
            }
          Regex("""from\s+(?:pg_catalog\.)?pg_database\b""").containsMatchIn(sql) ->
            listOf(
              options.databaseOid,
              options.databaseOwner,
              options.databaseProvenance,
              options.databaseAllowsConnections,
              options.databaseIsTemplate,
              options.publicSchemaOwner,
              options.databaseAclExact,
              options.publicSchemaAclExact,
              options.userSchemaCount,
              options.preloadCatalogue?.roleDefaultEmpty() ?: options.sessionPreloadRoleDefaultEmpty,
              options.preloadCatalogue?.overridesAbsent() ?: options.sessionPreloadOverridesAbsent,
              options.preloadCatalogue?.mutationPrivilegesAbsent() ?: options.preloadMutationPrivilegesAbsent
            )
          else -> throw SQLException("unexpected synthetic query")
        }
        resultSet(row, state.queryCount, options, state)
      }
      "execute" -> {
        state.executeCount += 1
        state.events += "execute"
        state.destructiveSql += arguments?.get(0).toString()
        options.destructiveFailure?.let { throw it }
        false
      }
      "close" -> {
        state.statementCloseCount += 1
        options.statementCloseFailure?.let { throw it }
        null
      }
      else -> defaultProxyValue(method)
    }
  }

  connection = proxy { method, arguments ->
    when (method.name) {
      "getAutoCommit" -> state.autoCommit
      "setAutoCommit" -> {
        state.autoCommit = arguments?.get(0) as Boolean
        null
      }
      "getMetaData" -> {
        if (method.name == options.metadataFailureMethod) options.metadataFailure?.let { throw it }
        if (options.metadataAbsent) null else metadata
      }
      "createStatement" -> {
        options.statementOpenFailure?.let { throw it }
        statement
      }
      "commit" -> {
        state.commitCount += 1
        state.events += "commit"
        null
      }
      "rollback" -> {
        state.rollbackCount += 1
        state.events += "rollback"
        options.rollbackFailure?.let { throw it }
        null
      }
      "close" -> {
        state.closeCount += 1
        options.connectionCloseFailure?.let { throw it }
        null
      }
      "isClosed" -> state.closeCount > 0
      else -> defaultProxyValue(method)
    }
  }

  val dataSource = proxy<DataSource> { method, _ ->
    when (method.name) {
      "getConnection" -> {
        state.acquisitionCount += 1
        options.connectionFailure?.let { throw it }
        connection
      }
      else -> defaultProxyValue(method)
    }
  }
  return JdbcFixture(dataSource, state, options)
}

private fun resultSet(row: List<Any?>, queryIndex: Int, options: JdbcOptions, state: JdbcState): ResultSet {
  var cursor = -1
  var lastWasNull = false
  return proxy { method, arguments ->
    if (options.resultFailureQuery == queryIndex && options.resultFailureMethod == method.name) {
      options.resultFailure?.let { throw it }
    }
    when (method.name) {
      "next" -> {
        cursor += 1
        cursor < (options.rowCountOverrides[queryIndex] ?: 1)
      }
      "getString" -> {
        val value = row[(arguments?.get(0) as Int) - 1]
        lastWasNull = value == null
        value?.toString()
      }
      "getBoolean" -> {
        val value = row[(arguments?.get(0) as Int) - 1]
        lastWasNull = value == null
        value as? Boolean ?: false
      }
      "wasNull" -> lastWasNull
      "close" -> {
        state.resultSetCloseCount += 1
        options.resultSetCloseFailures[queryIndex]?.let { throw it }
        null
      }
      else -> defaultProxyValue(method)
    }
  }
}

private inline fun <reified T> proxy(
  crossinline invocation: (Method, Array<out Any?>?) -> Any?
): T = Proxy.newProxyInstance(
  T::class.java.classLoader,
  arrayOf(T::class.java),
  InvocationHandler { proxy, method, arguments ->
    when (method.name) {
      "toString" -> "Synthetic${T::class.java.simpleName}Double"
      "hashCode" -> System.identityHashCode(proxy)
      "equals" -> proxy === arguments?.get(0)
      else -> invocation(method, arguments)
    }
  }
) as T

private fun defaultProxyValue(method: Method): Any? = when (method.returnType) {
  java.lang.Boolean.TYPE -> false
  java.lang.Byte.TYPE -> 0.toByte()
  java.lang.Short.TYPE -> 0.toShort()
  java.lang.Integer.TYPE -> 0
  java.lang.Long.TYPE -> 0L
  java.lang.Float.TYPE -> 0F
  java.lang.Double.TYPE -> 0.0
  java.lang.Character.TYPE -> '\u0000'
  else -> null
}
