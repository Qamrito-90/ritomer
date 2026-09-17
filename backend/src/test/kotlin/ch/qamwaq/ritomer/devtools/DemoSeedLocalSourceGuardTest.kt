package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabase
import ch.qamwaq.ritomer.testsupport.DisposablePostgresTestDatabaseGuardInitializer
import ch.qamwaq.ritomer.testsupport.POSTGRES_TEST_RAIL_ADMINISTRATIVE_SETTINGS
import ch.qamwaq.ritomer.testsupport.POSTGRES_TEST_RAIL_ALL_SAFE_SETTINGS
import ch.qamwaq.ritomer.testsupport.POSTGRES_TEST_RAIL_SAFE_SESSION_SETTINGS
import ch.qamwaq.ritomer.testsupport.PostgresTestRailJdbcLogging
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
      "function Invoke-M1BGradleTask"
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
      "\$startInfo.CreateNoWindow = \$false",
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
      "[System.IO.File]::GetAttributes((ConvertTo-M1BRunnerArtifactIoPath \$current))",
      "REPARSE_POINT_ANCESTOR_REJECTED"
    ).doesNotContain("::Exists(", "Get-Item")
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
      Add-Type -TypeDefinition §code -Language CSharp
      §script:M1BContainedProcessTypeInitialized = §true
      §container = Join-Path ([IO.Path]::GetTempPath()) ('m1b-incomplete-' + [Guid]::NewGuid().ToString('N'))
      §script:EvidenceBaseRoot = §container
      §root = Join-Path §container 'scan'
      §file = Join-Path §root 'unread.bin'
      [void][IO.Directory]::CreateDirectory(§root)
      try {
        [IO.File]::WriteAllBytes(§file, [byte[]]@(65, 66, 67))
        §stop = 'NO_STOP'
        try { Assert-M1BRunnerSecretAbsentFromTree §root 'offline-fixed-incomplete-marker' } catch { §stop = Get-M1BStopCode §_ }
        if (§stop -cne 'RUNNER_ARTIFACT_SCAN_FAILED') { throw 'SIMULATED_INCOMPLETE_READ_NOT_CLASSIFIED' }
        §captured = [Ritomer.M1B.ContainedProcess]::LastNeedle
        if (§null -eq §captured -or §captured.Length -eq 0 -or @(§captured | Where-Object { §_ -ne 0 }).Count -ne 0) {
          throw 'SIMULATED_INCOMPLETE_READ_NEEDLE_NOT_CLEARED'
        }
        [void][IO.File]::GetAttributes(§file)
      } finally {
        if (-not §file.StartsWith(§container + '\', [StringComparison]::Ordinal)) { throw 'FIXTURE_CLEANUP_BOUNDARY' }
        [IO.File]::Delete(§file)
        [IO.Directory]::Delete(§root, §false)
        [IO.Directory]::Delete(§container, §false)
      }
      'M1B_SCAN_SIMULATED_INCOMPLETE_READ_AND_NEEDLE_CLEAR=PASS'
      """.trimIndent()
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
      "lifecycle-post-cleanup"
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
    assertThat(lifecycle).contains("internal object PostgresTestRailJdbcLogging")
    assertThat(lifecycle).doesNotContain(
      "fun main",
      "DriverManager",
      "java.sql",
      "CREATE ROLE",
      "DROP DATABASE",
      "SCRAM-SHA-256",
      "RITOMER_DB_RAIL_"
    )
    assertThat(Regex("""\b(?:class|object|fun)\s+""").findAll(lifecycle).count()).isEqualTo(2)
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
      "setOf(DB_RAIL_BUILD_ROOT_ENV, DB_RAIL_RUN_ID_ENV, DB_RAIL_RUN_ROOT_ENV, DB_RAIL_REVIEWED_OBJECT_SHA256_ENV)"
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
    val lifecycle = script.sliceBetween("function Invoke-M1BLifecycle {", "function Invoke-M1BMain {")
    assertThat(Regex(Regex.escape("\$provision.PostmasterStartUnixMicros")).findAll(lifecycle).count()).isEqualTo(3)
    assertThat(lifecycle).contains("postmasterStartUnixMicros = \$provision.PostmasterStartUnixMicros")
    val lifecycleCalls = lifecycle.lines().filter { it.contains("\$readiness.Result.RuntimeSha256 \$cluster \$databaseOid \$roleOid") }
    assertThat(lifecycleCalls).hasSize(2).allSatisfy { line ->
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
    val runbook = Path.of("../runbooks/local-dev.md").readText()
    val spec = Path.of("../specs/active/046-authenticated-session-foundation-v1.md").readText()
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
        "m1BPostgresRailJavaLauncher" to 3,
        "m1BPostgresRailReadiness" to 1,
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

  private fun runRailPowerShell(body: String): String {
    val scriptPath = Path.of("scripts/m1-1b-postgresql-rail.ps1")
      .toAbsolutePath()
      .normalize()
      .toString()
      .replace("'", "''")
    val command = buildString {
      append("§railPath = '")
      append(scriptPath)
      appendLine("'")
      appendLine("§parseTokens = §null")
      appendLine("§parseErrors = §null")
      appendLine("§railAst = [System.Management.Automation.Language.Parser]::ParseFile(§railPath, [ref]§parseTokens, [ref]§parseErrors)")
      appendLine("if (§parseErrors.Count -ne 0) { throw 'rail AST invalid before offline dot-source' }")
      appendLine("§cleanBlock = §null")
      appendLine("if (§railAst.PSObject.Properties.Name -contains 'CleanBlock') { §cleanBlock = §railAst.CleanBlock }")
      appendLine("if (§null -ne §railAst.DynamicParamBlock -or §null -ne §railAst.BeginBlock -or §null -ne §railAst.ProcessBlock -or §null -ne §cleanBlock -or §null -eq §railAst.EndBlock) { throw 'unsafe named script block' }")
      appendLine("§expectedParameterTexts = @(")
      appendLine("  '[ValidateSet(''Preflight'', ''Lifecycle'')] [string]§Mode',")
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
      appendLine("  if (§null -ne §parameter.DefaultValue -or @(§parameter.FindAll({ param(§node) §node -is [System.Management.Automation.Language.CommandAst] -or §node -is [System.Management.Automation.Language.InvokeMemberExpressionAst] }, §true)).Count -ne 0) { throw 'active parameter binding rejected' }")
      appendLine("}")
      appendLine("§allowedAssignments = @(")
      appendLine("  'ErrorActionPreference', 'ProgressPreference', 'script:PsqlExeExact', 'script:GitExeExact',")
      appendLine("  'script:PsqlConnectionExact', 'script:PsqlArgumentsExact', 'script:TargetDatabase',")
      appendLine("  'script:TargetRunnerRole', 'script:TargetJdbcUrl', 'script:DestructiveConsent',")
      appendLine("  'script:EvidenceBaseRoot', 'script:ExpectedBranch', 'script:ExpectedHead',")
      appendLine("  'script:CorrectiveFileSetSummary', 'script:CompositeFileSetSummary',")
      appendLine("  'script:CorrectiveFileSet', 'script:ExpectedAddedFileSet', 'script:CompositeFileSet',")
      appendLine("  'script:BackendRoot', 'script:RepoRoot', 'script:M1BContainedProcessTypeInitialized',")
      appendLine("  'script:PsqlProcessStarts'")
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
      append(". §railPath -Mode 'Preflight'")
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
      append(body)
      append('\n')
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
    val tempRoot = System.getProperty("java.io.tmpdir")
    val commandFile = Files.createTempFile(Path.of(tempRoot), "ritomer-m1b-offline-", ".ps1")
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
    try {
      val process = processBuilder.start()
      val outputFuture = java.util.concurrent.CompletableFuture.supplyAsync {
        process.inputStream.bufferedReader(StandardCharsets.UTF_8).use { it.readText() }
      }
      val finished = process.waitFor(45, java.util.concurrent.TimeUnit.SECONDS)
      if (!finished) {
        process.destroyForcibly()
        process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS)
      }
      val output = outputFuture.get(5, java.util.concurrent.TimeUnit.SECONDS)
      assertThat(finished)
        .describedAs("offline PowerShell fixture timed out: %s", output)
        .isTrue()
      assertThat(process.exitValue())
        .describedAs("offline PowerShell fixture failed: %s", output)
        .isZero()
      return output
    } finally {
      Files.deleteIfExists(commandFile)
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
