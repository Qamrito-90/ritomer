import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.the
import java.io.File
import java.net.URI
import java.nio.file.Files
import java.nio.file.LinkOption
import java.nio.file.Path
import java.nio.file.attribute.BasicFileAttributes
import java.security.MessageDigest
import javax.xml.parsers.DocumentBuilderFactory

val DB_TESTS_ENABLED_ENV = "RITOMER_DB_TESTS_ENABLED"
val DB_TEST_JDBC_URL_ENV = "RITOMER_DB_TEST_JDBC_URL"
val DB_TEST_USERNAME_ENV = "RITOMER_DB_TEST_USERNAME"
val DB_TEST_PASSWORD_ENV = "RITOMER_DB_TEST_PASSWORD"
val DB_TEST_DESTRUCTIVE_CONSENT_ENV = "RITOMER_DB_TEST_DESTRUCTIVE_CONSENT"
val DB_TEST_DATABASE = "ritomer_043b_test"
val DB_TEST_USERNAME = "ritomer_043b_test_runner"
val DB_TEST_DESTRUCTIVE_CONSENT = "TRUNCATE_RITOMER_043B_TEST"
val DB_TEST_EXPECTED_JDBC_URL = "jdbc:postgresql://127.0.0.1:15432/$DB_TEST_DATABASE"

val DB_RAIL_BUILD_ROOT_ENV = "RITOMER_DB_RAIL_BUILD_ROOT"
val DB_RAIL_RUN_ID_ENV = "RITOMER_DB_RAIL_RUN_ID"
val DB_RAIL_RUN_ROOT_ENV = "RITOMER_DB_RAIL_RUN_ROOT"
val DB_RAIL_REVIEWED_OBJECT_SHA256_ENV = "RITOMER_DB_RAIL_REVIEWED_OBJECT_SHA256"
val DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER_ENV = "RITOMER_DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER"
val DB_RAIL_POSTMASTER_START_UNIX_MICROS_ENV = "RITOMER_DB_RAIL_POSTMASTER_START_UNIX_MICROS"
val DB_RAIL_DATABASE_OID_ENV = "RITOMER_DB_RAIL_DATABASE_OID"
val DB_RAIL_RUNNER_ROLE_OID_ENV = "RITOMER_DB_RAIL_RUNNER_ROLE_OID"
val DB_RAIL_RUNTIME_SHA256_ENV = "RITOMER_DB_RAIL_RUNTIME_SHA256"
val DB_TEST_RUN_ROOT_ENV = "RITOMER_DB_TEST_RUN_ROOT"
val DB_TEST_PHASE_ENV = "RITOMER_DB_TEST_PHASE"
val DB_TEST_STORAGE_LOCAL_ROOT_ENV = "RITOMER_DB_TEST_STORAGE_LOCAL_ROOT"
val DB_TEST_APPLICATION_NAME_ENV = "RITOMER_DB_TEST_APPLICATION_NAME"

val DB_RAIL_COMMON_ENV = setOf(
  DB_RAIL_BUILD_ROOT_ENV,
  DB_RAIL_RUN_ID_ENV,
  DB_RAIL_RUN_ROOT_ENV,
  DB_RAIL_REVIEWED_OBJECT_SHA256_ENV,
  DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER_ENV,
  DB_RAIL_POSTMASTER_START_UNIX_MICROS_ENV,
  DB_RAIL_DATABASE_OID_ENV,
  DB_RAIL_RUNNER_ROLE_OID_ENV,
  DB_RAIL_RUNTIME_SHA256_ENV
)
val DB_RAIL_TEST_ENV = setOf(
  DB_TESTS_ENABLED_ENV,
  DB_TEST_JDBC_URL_ENV,
  DB_TEST_USERNAME_ENV,
  DB_TEST_PASSWORD_ENV,
  DB_TEST_DESTRUCTIVE_CONSENT_ENV,
  DB_TEST_RUN_ROOT_ENV,
  DB_TEST_PHASE_ENV,
  DB_TEST_STORAGE_LOCAL_ROOT_ENV,
  DB_TEST_APPLICATION_NAME_ENV
)
val DB_RAIL_OS_ENV = setOf(
  "COMSPEC",
  "HOME",
  "JAVA_HOME",
  "LANG",
  "LC_ALL",
  "NUMBER_OF_PROCESSORS",
  "OS",
  "Path",
  "PATH",
  "PATHEXT",
  "SystemDrive",
  "SystemRoot",
  "TEMP",
  "TMP",
  "USERPROFILE",
  "WINDIR"
)

private fun isExact043bPostgresJdbcUrl(rawValue: String?): Boolean {
  val value = rawValue ?: return false
  if (value != DB_TEST_EXPECTED_JDBC_URL) return false
  if (value.isBlank() || value != value.trim() || '%' in value || '\\' in value) return false
  if (!value.startsWith("jdbc:postgresql://")) return false

  val uri = try {
    URI(value.removePrefix("jdbc:"))
  } catch (_: Exception) {
    return false
  }
  return uri.scheme == "postgresql"
    && uri.host == "127.0.0.1"
    && uri.rawUserInfo == null
    && uri.rawQuery == null
    && uri.rawFragment == null
    && uri.rawPath == "/$DB_TEST_DATABASE"
    && uri.port == 15432
}

private fun exactEnvironmentValue(name: String): String? {
  val matchingNames = System.getenv().keys.filter { actual -> actual.equals(name, ignoreCase = true) }
  if (matchingNames.isEmpty()) return null
  if (matchingNames != listOf(name)) {
    throw GradleException("PostgreSQL rail environment variable casing is invalid.")
  }
  return System.getenv(name)
}

private fun requireNonBlankEnvironment(name: String): String =
  exactEnvironmentValue(name)?.takeIf { it.isNotBlank() }
    ?: throw GradleException("Required PostgreSQL rail environment is missing: $name")

private fun requireAbsentEnvironment(names: Set<String>) {
  val present = System.getenv().keys.filter { actual -> names.any { it.equals(actual, ignoreCase = true) } }
  if (present.isNotEmpty()) {
    throw GradleException("A forbidden PostgreSQL rail environment channel is present.")
  }
}

private fun requireClosedPostgresRailEnvironment(allowedRailNames: Set<String>) {
  val allowed = allowedRailNames.map(String::uppercase).toSet()
  val forbiddenNames = System.getenv().keys.filter { name ->
    name.startsWith("PG", ignoreCase = true) ||
      (name.startsWith("RITOMER_DB_RAIL_", ignoreCase = true) && name.uppercase() !in allowed)
  }
  if (forbiddenNames.isNotEmpty()) {
    throw GradleException("PostgreSQL rail environment contains an unexpected credential or libpq channel.")
  }
}

private fun allowlistedEnvironment(names: Set<String>): Map<String, String> {
  val normalized = names.map(String::uppercase).toSet()
  return System.getenv().filterKeys { it.uppercase() in normalized }
}

private fun requireCanonicalRailBuildRoot(configuredBuildRoot: File) {
  val runRoot = Path.of(requireNonBlankEnvironment(DB_RAIL_RUN_ROOT_ENV))
  val requestedBuildRoot = Path.of(requireNonBlankEnvironment(DB_RAIL_BUILD_ROOT_ENV))
  if (!runRoot.isAbsolute || runRoot != runRoot.normalize()) {
    throw GradleException("PostgreSQL rail run root must be absolute and normalized.")
  }
  if (!requestedBuildRoot.isAbsolute || requestedBuildRoot != requestedBuildRoot.normalize()) {
    throw GradleException("PostgreSQL rail build root must be absolute and normalized.")
  }
  if (!requestedBuildRoot.startsWith(runRoot)) {
    throw GradleException("PostgreSQL rail build root must remain under the run root.")
  }
  if (configuredBuildRoot.toPath().toAbsolutePath().normalize() != requestedBuildRoot) {
    throw GradleException("Gradle build output is not bound to the PostgreSQL rail build root.")
  }
}

private data class RailRuntimeFile(val label: String, val relativePath: String, val path: Path)

private fun postgresRailRuntimeSha256(entries: List<Pair<String, File>>): String {
  if (
    entries.isEmpty() ||
    entries.size > 2048 ||
    entries.map { it.first }.toSet().size != entries.size ||
    entries.any { (label, _) -> !label.matches(Regex("^[a-z0-9][a-z0-9/-]{0,127}$")) }
  ) {
    throw GradleException("PostgreSQL rail runtime input labels are invalid.")
  }
  val files = mutableListOf<RailRuntimeFile>()
  val structure = linkedSetOf<String>()
  fun requireBoundedInputCounts() {
    if (files.size > 20000 || structure.size > 40000) {
      throw GradleException("PostgreSQL rail runtime input file count is invalid.")
    }
  }
  entries.forEach { (label, file) ->
      val root = file.toPath().toAbsolutePath().normalize()
      if (!Files.exists(root, LinkOption.NOFOLLOW_LINKS)) {
        structure.add("M\u0000$label\u0000")
        requireBoundedInputCounts()
        return@forEach
      }
      Files.walk(root).use { paths ->
        paths.forEach { path ->
          val attributes = Files.readAttributes(
            path,
            BasicFileAttributes::class.java,
            LinkOption.NOFOLLOW_LINKS
          )
          if (attributes.isSymbolicLink || attributes.isOther) {
            throw GradleException("PostgreSQL rail runtime input contains a link or special file.")
          }
          val normalized = path.toAbsolutePath().normalize()
          val relativePath = root.relativize(normalized).toString().replace('\\', '/').ifEmpty { "." }
          if (attributes.isDirectory) {
            structure.add("D\u0000$label\u0000$relativePath\u0000")
            requireBoundedInputCounts()
          } else if (attributes.isRegularFile) {
            structure.add("F\u0000$label\u0000$relativePath\u0000")
            files.add(RailRuntimeFile(label, relativePath, normalized))
            requireBoundedInputCounts()
          } else {
            throw GradleException("PostgreSQL rail runtime input type is invalid.")
          }
        }
      }
    }
  if (files.isEmpty()) {
    throw GradleException("PostgreSQL rail runtime input file count is invalid.")
  }
  val digest = MessageDigest.getInstance("SHA-256")
  structure.sorted().forEach { record -> digest.update(record.toByteArray(Charsets.UTF_8)) }
  val buffer = ByteArray(65536)
  var totalBytes = 0L
  try {
    files.sortedWith(compareBy(RailRuntimeFile::label, RailRuntimeFile::relativePath)).forEach { input ->
      val size = Files.size(input.path)
      if (size > 536870912L) throw GradleException("PostgreSQL rail runtime input file is too large.")
      totalBytes += size
      if (totalBytes > 4294967296L) throw GradleException("PostgreSQL rail runtime input set is too large.")
      digest.update(
        "F\u0000${input.label}\u0000${input.relativePath}\u0000$size\u0000".toByteArray(Charsets.UTF_8)
      )
      Files.newInputStream(input.path).use { stream ->
        var observedBytes = 0L
        var read = stream.read(buffer)
        while (read >= 0) {
          if (read > 0) {
            observedBytes += read
            if (observedBytes > size) {
              throw GradleException("PostgreSQL rail runtime input changed while hashing.")
            }
            digest.update(buffer, 0, read)
          }
          read = stream.read(buffer)
        }
        if (observedBytes != size || Files.size(input.path) != size) {
          throw GradleException("PostgreSQL rail runtime input changed while hashing.")
        }
      }
    }
  } finally {
    buffer.fill(0)
  }
  return digest.digest().joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
}

private data class RailJUnitSummary(
  val classNames: Set<String>,
  val tests: Int,
  val failures: Int,
  val errors: Int,
  val skipped: Int
)

private fun readRailJUnitSummary(directory: File): RailJUnitSummary {
  val xmlFiles = directory.listFiles { file -> file.isFile && file.name.startsWith("TEST-") && file.extension == "xml" }
    ?.sortedBy(File::getName)
    ?: emptyList()
  if (xmlFiles.isEmpty()) throw GradleException("PostgreSQL rail JUnit XML is missing.")

  val factory = DocumentBuilderFactory.newInstance().apply {
    setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
    setFeature("http://xml.org/sax/features/external-general-entities", false)
    setFeature("http://xml.org/sax/features/external-parameter-entities", false)
    isXIncludeAware = false
    isExpandEntityReferences = false
  }
  val classes = linkedSetOf<String>()
  var tests = 0
  var failures = 0
  var errors = 0
  var skipped = 0
  xmlFiles.forEach { xml ->
    val root = factory.newDocumentBuilder().parse(xml).documentElement
    if (root.tagName != "testsuite") throw GradleException("Unexpected PostgreSQL rail JUnit XML root.")
    val className = root.getAttribute("name").takeIf { it.isNotBlank() }
      ?: throw GradleException("PostgreSQL rail JUnit XML class name is missing.")
    if (!classes.add(className)) throw GradleException("Duplicate PostgreSQL rail JUnit class result.")
    tests += root.getAttribute("tests").toIntOrNull()
      ?: throw GradleException("Invalid PostgreSQL rail JUnit test count.")
    failures += root.getAttribute("failures").toIntOrNull()
      ?: throw GradleException("Invalid PostgreSQL rail JUnit failure count.")
    errors += root.getAttribute("errors").toIntOrNull()
      ?: throw GradleException("Invalid PostgreSQL rail JUnit error count.")
    skipped += root.getAttribute("skipped").toIntOrNull()
      ?: throw GradleException("Invalid PostgreSQL rail JUnit skipped count.")
  }
  return RailJUnitSummary(classes, tests, failures, errors, skipped)
}

private fun requireRailJUnitSummary(
  summary: RailJUnitSummary,
  expectedClasses: Set<String>,
  expectedTests: Int
) {
  if (
    summary.classNames != expectedClasses ||
    summary.tests != expectedTests ||
    summary.failures != 0 ||
    summary.errors != 0 ||
    summary.skipped != 0
  ) {
    throw GradleException("PostgreSQL rail JUnit inventory or result count diverged.")
  }
}

plugins {
  kotlin("jvm") version "1.9.25"
  kotlin("plugin.spring") version "1.9.25"
  id("org.springframework.boot") version "3.5.11"
  id("io.spring.dependency-management") version "1.1.7"
}

group = "ch.qamwaq"
version = "0.1.0-SNAPSHOT"
description = "Ritomer backend foundation (spec 001)"

java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(21)
  }
}

springBoot {
  mainClass.set("ch.qamwaq.ritomer.RitomerBackendApplicationKt")
}

repositories {
  mavenCentral()
}

extra["springModulithVersion"] = "1.4.8"

dependencies {
  implementation(platform("com.google.cloud:libraries-bom:26.71.0"))
  implementation("org.apache.commons:commons-csv:1.13.0")
  implementation("com.google.cloud:google-cloud-storage")
  implementation("org.springframework.boot:spring-boot-starter-actuator")
  implementation("org.springframework.boot:spring-boot-starter-jdbc")
  implementation("org.springframework.boot:spring-boot-starter-oauth2-resource-server")
  implementation("org.springframework.boot:spring-boot-starter-security")
  implementation("org.springframework.boot:spring-boot-starter-validation")
  implementation("org.springframework.boot:spring-boot-starter-web")
  implementation("com.fasterxml.jackson.module:jackson-module-kotlin")
  implementation("org.flywaydb:flyway-core")
  implementation("org.jetbrains.kotlin:kotlin-reflect")
  implementation("org.springframework.modulith:spring-modulith-starter-core")

  runtimeOnly("io.micrometer:micrometer-registry-prometheus")
  runtimeOnly("org.flywaydb:flyway-database-postgresql")
  runtimeOnly("org.postgresql:postgresql")
  runtimeOnly("org.springframework.modulith:spring-modulith-actuator")
  runtimeOnly("org.springframework.modulith:spring-modulith-observability")

  testImplementation("org.springframework.boot:spring-boot-starter-test")
  testImplementation("org.jetbrains.kotlin:kotlin-test-junit5")
  testImplementation("org.springframework.modulith:spring-modulith-starter-test")
  testImplementation("org.springframework.security:spring-security-test")
  testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

dependencyManagement {
  imports {
    mavenBom("org.springframework.modulith:spring-modulith-bom:${property("springModulithVersion")}")
  }
}

kotlin {
  compilerOptions {
    freeCompilerArgs.add("-Xjsr305=strict")
  }
}

val testSourceSet = the<SourceSetContainer>()["test"]
val mainSourceSet = the<SourceSetContainer>()["main"]
val m1BPostgresRailJavaLauncher = javaToolchains.launcherFor {
  languageVersion = JavaLanguageVersion.of(21)
}
val m1BPostgresRailRuntimeClasspathFiles = providers.provider {
  testSourceSet.runtimeClasspath.files.map(File::getAbsoluteFile)
}
val m1BPostgresRailDetachedTestClassesDirs = files(providers.provider {
  testSourceSet.output.classesDirs.files.map(File::getAbsoluteFile)
})
val m1BPostgresRailDetachedRuntimeClasspath = files(m1BPostgresRailRuntimeClasspathFiles)
val m1BPostgresRailRuntimeInputs = providers.provider {
  m1BPostgresRailRuntimeClasspathFiles.get().mapIndexed { index, file ->
    "classpath/${index.toString().padStart(5, '0')}" to file
  } + listOf(
    "gradle-wrapper" to file("gradle/wrapper/gradle-wrapper.jar"),
    "gradle-daemon-jdk" to File(System.getProperty("java.home")),
    "test-launcher-jdk" to m1BPostgresRailJavaLauncher.get().metadata.installationPath.asFile,
    "gradle-distribution" to requireNotNull(gradle.gradleHomeDir) {
      "Gradle home is required for PostgreSQL rail runtime binding."
    }
  )
}

providers.environmentVariable(DB_RAIL_BUILD_ROOT_ENV).orNull
  ?.takeIf { it.isNotBlank() }
  ?.let { layout.buildDirectory.set(file(it)) }

mainSourceSet.resources.srcDir("../contracts/reference")

tasks.withType<Test>().configureEach {
  useJUnitPlatform()
}

tasks.named<Test>("test") {
  useJUnitPlatform {
    excludeTags("db-integration", "windows-only")
  }
}

tasks.register<Test>("windowsTest") {
  description = "Runs the mandatory Windows-only offline fixtures without a database."
  group = "verification"
  testClassesDirs = testSourceSet.output.classesDirs
  classpath = testSourceSet.runtimeClasspath
  shouldRunAfter(tasks.named("test"))
  useJUnitPlatform {
    includeTags("windows-only")
    excludeTags("db-integration")
  }
  doFirst {
    if (!System.getProperty("os.name").startsWith("Windows", ignoreCase = true)) {
      throw GradleException("windowsTest requires Windows; its mandatory fixtures must not be skipped.")
    }
  }
}

tasks.register<Test>("dbIntegrationTest") {
  description = "Runs optional PostgreSQL integration tests against an explicitly configured database."
  group = "verification"
  testClassesDirs = testSourceSet.output.classesDirs
  classpath = testSourceSet.runtimeClasspath
  shouldRunAfter(tasks.named("test"))
  useJUnitPlatform {
    includeTags("db-integration")
  }
  onlyIf {
    val enabled = System.getenv(DB_TESTS_ENABLED_ENV).equals("true", ignoreCase = true)
    if (!enabled) {
      logger.lifecycle(
        "Skipping dbIntegrationTest: set $DB_TESTS_ENABLED_ENV=true to activate the dedicated guarded database checks."
      )
    }
    enabled
  }
  doFirst {
    val jdbcUrl = System.getenv(DB_TEST_JDBC_URL_ENV)
    val username = System.getenv(DB_TEST_USERNAME_ENV)
    val consent = System.getenv(DB_TEST_DESTRUCTIVE_CONSENT_ENV)
    val passwordConfigured = System.getenv(DB_TEST_PASSWORD_ENV)?.isNotBlank() == true

    if (jdbcUrl.isNullOrBlank() || username.isNullOrBlank() || !passwordConfigured || consent.isNullOrBlank()) {
      throw GradleException(
        "dbIntegrationTest requires explicit URL, username, password and destructive consent environment variables."
      )
    }
    if (!isExact043bPostgresJdbcUrl(jdbcUrl)) {
      throw GradleException("dbIntegrationTest requires the exact unambiguous dedicated 043b PostgreSQL database path.")
    }
    if (username != DB_TEST_USERNAME) {
      throw GradleException("dbIntegrationTest requires the exact dedicated 043b PostgreSQL login role.")
    }
    if (consent != DB_TEST_DESTRUCTIVE_CONSENT) {
      throw GradleException("dbIntegrationTest requires the exact destructive-test consent value.")
    }
  }
}

val m1BPostgresRailTargetedClasses = setOf(
  "ch.qamwaq.ritomer.devtools.DemoSeedLocalAuthMeDbIntegrationTest",
  "ch.qamwaq.ritomer.devtools.DemoSeedLocalDbIntegrationTest"
)
val m1BPostgresRailFullClasses = setOf(
  "ch.qamwaq.ritomer.BalanceImportPersistenceIntegrationTest",
  "ch.qamwaq.ritomer.ControlsDbIntegrationTest",
  "ch.qamwaq.ritomer.DocumentsDbIntegrationTest",
  "ch.qamwaq.ritomer.ExportsDbIntegrationTest",
  "ch.qamwaq.ritomer.FinancialStatementsStructuredDbIntegrationTest",
  "ch.qamwaq.ritomer.FinancialSummaryDbIntegrationTest",
  "ch.qamwaq.ritomer.ManualMappingPersistenceIntegrationTest",
  "ch.qamwaq.ritomer.MappingSuggestionDecisionDbIntegrationTest",
  "ch.qamwaq.ritomer.PersistenceFoundationIntegrationTest",
  "ch.qamwaq.ritomer.WorkpapersDbIntegrationTest",
  "ch.qamwaq.ritomer.devtools.DemoSeedLocalAuthMeDbIntegrationTest",
  "ch.qamwaq.ritomer.devtools.DemoSeedLocalDbIntegrationTest"
)

val m1BPostgresRailRequiredCompiledClasses = setOf(
  "ch/qamwaq/ritomer/testsupport/PostgresTestRailJdbcLogging.class",
  "ch/qamwaq/ritomer/testsupport/DisposablePostgresTestDatabaseSupportKt.class",
  "ch/qamwaq/ritomer/devtools/DemoSeedLocalAuthMeDbIntegrationTest.class",
  "ch/qamwaq/ritomer/devtools/DemoSeedLocalDbIntegrationTest.class"
)

fun requireM1BPostgresRailCompiledClasses(relativePaths: Set<String>) {
  val classDirectories = testSourceSet.output.classesDirs.files
  val missing = relativePaths.filterNot { relativePath ->
    classDirectories.any { directory -> directory.resolve(relativePath).isFile }
  }
  if (missing.isNotEmpty()) {
    throw GradleException("Required PostgreSQL rail compiled classes are missing.")
  }
}

tasks.register("m1BPostgresRailReadiness") {
  description = "Compiles and strictly resolves the PostgreSQL rail runtime without executing tests or database code."
  group = "verification"
  dependsOn(tasks.named("testClasses"))

  doFirst {
    requireCanonicalRailBuildRoot(layout.buildDirectory.get().asFile)
    listOf(
      DB_RAIL_RUN_ID_ENV,
      DB_RAIL_RUN_ROOT_ENV,
      DB_RAIL_REVIEWED_OBJECT_SHA256_ENV
    ).forEach(::requireNonBlankEnvironment)
    requireAbsentEnvironment(DB_RAIL_TEST_ENV)
    requireClosedPostgresRailEnvironment(
      setOf(DB_RAIL_BUILD_ROOT_ENV, DB_RAIL_RUN_ID_ENV, DB_RAIL_RUN_ROOT_ENV, DB_RAIL_REVIEWED_OBJECT_SHA256_ENV)
    )

    val forbiddenTasks = gradle.taskGraph.allTasks.filter { candidate ->
      candidate is Test ||
        candidate is JavaExec ||
        candidate.name in setOf(
          "bootRun",
          "dbIntegrationTest",
          "demoSeedLocal",
          "flywayClean",
          "flywayMigrate",
          "m1BPostgresRailTargeted",
          "m1BPostgresRailFull"
        )
    }
    if (forbiddenTasks.isNotEmpty()) {
      throw GradleException("PostgreSQL rail readiness task graph contains an executable database or forked-JVM task.")
    }
  }

  doLast {
    val runtimeConfiguration = configurations.named("testRuntimeClasspath").get()
    if (!runtimeConfiguration.isCanBeResolved) {
      throw GradleException("PostgreSQL rail test runtime classpath is not resolvable.")
    }
    runtimeConfiguration.incoming.artifactView {
      isLenient = false
    }.files.files
    val resolvedArtifacts = runtimeConfiguration.resolvedConfiguration.resolvedArtifacts
    val coordinates = resolvedArtifacts.map { artifact ->
      "${artifact.moduleVersion.id.group}:${artifact.name}"
    }.toSet()
    val requiredCoordinates = setOf(
      "org.flywaydb:flyway-core",
      "org.flywaydb:flyway-database-postgresql",
      "org.postgresql:postgresql"
    )
    if (!coordinates.containsAll(requiredCoordinates)) {
      throw GradleException("PostgreSQL rail runtime classpath is incomplete.")
    }
    val postgresDriverVersions = resolvedArtifacts
      .filter { artifact -> artifact.moduleVersion.id.group == "org.postgresql" && artifact.name == "postgresql" }
      .map { artifact -> artifact.moduleVersion.id.version }
      .toSet()
    if (postgresDriverVersions != setOf("42.7.10")) {
      throw GradleException("PostgreSQL rail requires the exact reviewed pgJDBC runtime version.")
    }
    requireM1BPostgresRailCompiledClasses(m1BPostgresRailRequiredCompiledClasses)
    val runtimeSha256 = postgresRailRuntimeSha256(m1BPostgresRailRuntimeInputs.get())
    logger.lifecycle("M1B_POSTGRES_RAIL_READINESS=PASS")
    logger.lifecycle("M1B_POSTGRES_RAIL_RUNTIME_CLASSPATH=STRICT_RESOLUTION_PASS")
    logger.lifecycle("M1B_POSTGRES_RAIL_RUNTIME_SHA256=$runtimeSha256")
    logger.lifecycle("M1B_POSTGRES_RAIL_DATABASE_EXECUTION=NONE")
  }
}

fun Test.configureM1BPostgresRailTest(
  phase: String,
  expectedClasses: Set<String>,
  expectedTests: Int
) {
  description = "Runs the isolated PostgreSQL rail $phase test phase with exact JUnit accounting."
  group = "verification"
  testClassesDirs = m1BPostgresRailDetachedTestClassesDirs
  classpath = m1BPostgresRailDetachedRuntimeClasspath
  javaLauncher.set(m1BPostgresRailJavaLauncher)
  maxParallelForks = 1
  failFast = true
  useJUnitPlatform {
    includeTags("db-integration")
  }
  reports.junitXml.required.set(true)
  reports.junitXml.outputLocation.set(layout.buildDirectory.dir("test-results/m1b-postgresql-rail/$phase"))
  reports.junitXml.includeSystemOutLog.set(false)
  reports.junitXml.includeSystemErrLog.set(false)
  reports.html.required.set(false)
  testLogging.showStandardStreams = false
  setEnvironment(allowlistedEnvironment(DB_RAIL_COMMON_ENV + DB_RAIL_TEST_ENV + DB_RAIL_OS_ENV))
  System.getenv("USERPROFILE")?.takeIf { it.isNotBlank() }?.let { systemProperty("user.home", it) }
  System.getenv("TEMP")?.takeIf { it.isNotBlank() }?.let { systemProperty("java.io.tmpdir", it) }

  doFirst {
    requireCanonicalRailBuildRoot(layout.buildDirectory.get().asFile)
    (setOf(
      DB_RAIL_RUN_ID_ENV,
      DB_RAIL_RUN_ROOT_ENV,
      DB_RAIL_REVIEWED_OBJECT_SHA256_ENV,
      DB_RAIL_CLUSTER_SYSTEM_IDENTIFIER_ENV,
      DB_RAIL_POSTMASTER_START_UNIX_MICROS_ENV,
      DB_RAIL_DATABASE_OID_ENV,
      DB_RAIL_RUNNER_ROLE_OID_ENV,
      DB_RAIL_RUNTIME_SHA256_ENV
    ) + DB_RAIL_TEST_ENV).forEach(::requireNonBlankEnvironment)
    requireClosedPostgresRailEnvironment(DB_RAIL_COMMON_ENV)
    val postmasterStartUnixMicros = requireNonBlankEnvironment(DB_RAIL_POSTMASTER_START_UNIX_MICROS_ENV)
    if (
      !postmasterStartUnixMicros.matches(Regex("\\A[1-9][0-9]{0,18}\\z")) ||
      postmasterStartUnixMicros.toLongOrNull()?.let { it > 0L } != true
    ) {
      throw GradleException("PostgreSQL rail postmaster start binding is invalid.")
    }
    if (System.getenv(DB_TESTS_ENABLED_ENV) != "true") {
      throw GradleException("PostgreSQL rail tests require exact lowercase activation.")
    }
    if (!isExact043bPostgresJdbcUrl(System.getenv(DB_TEST_JDBC_URL_ENV))) {
      throw GradleException("PostgreSQL rail tests require the exact dedicated JDBC target.")
    }
    if (System.getenv(DB_TEST_USERNAME_ENV) != DB_TEST_USERNAME) {
      throw GradleException("PostgreSQL rail tests require the exact dedicated runner role.")
    }
    if (System.getenv(DB_TEST_DESTRUCTIVE_CONSENT_ENV) != DB_TEST_DESTRUCTIVE_CONSENT) {
      throw GradleException("PostgreSQL rail tests require exact destructive consent.")
    }
    if (System.getenv(DB_TEST_PHASE_ENV) != phase) {
      throw GradleException("PostgreSQL rail test phase diverged from the selected task.")
    }
    val expectedRuntimeSha256 = requireNonBlankEnvironment(DB_RAIL_RUNTIME_SHA256_ENV)
    val actualRuntimeSha256 = postgresRailRuntimeSha256(m1BPostgresRailRuntimeInputs.get())
    if (!expectedRuntimeSha256.matches(Regex("^[0-9a-f]{64}$")) || actualRuntimeSha256 != expectedRuntimeSha256) {
      throw GradleException("PostgreSQL rail runtime inputs diverged after readiness.")
    }
    logger.lifecycle("M1B_POSTGRES_RAIL_RUNTIME_SHA256_VERIFIED=$actualRuntimeSha256")
    val testRunRoot = Path.of(requireNonBlankEnvironment(DB_TEST_RUN_ROOT_ENV))
    val storageRoot = Path.of(requireNonBlankEnvironment(DB_TEST_STORAGE_LOCAL_ROOT_ENV))
    val expectedStorageRoot = testRunRoot.resolve("volatile").resolve(phase).resolve("local-fs")
    if (
      !testRunRoot.isAbsolute ||
      testRunRoot != testRunRoot.normalize() ||
      !storageRoot.isAbsolute ||
      storageRoot != storageRoot.normalize() ||
      storageRoot != expectedStorageRoot
    ) {
      throw GradleException("PostgreSQL rail LOCAL_FS root is not the exact run-bound phase leaf.")
    }
    val crashRoot = testRunRoot.resolve("volatile").resolve(phase)
    workingDir(crashRoot)
    jvmArgs(
      "-XX:ErrorFile=${crashRoot.resolve("hs_err_pid%p.log")}",
      "-XX:HeapDumpPath=${crashRoot.resolve("heapdump_pid%p.hprof")}",
      "-XX:-HeapDumpOnOutOfMemoryError"
    )
    val expectedApplicationName = "ritomer-m1-1b-${requireNonBlankEnvironment(DB_RAIL_RUN_ID_ENV)}-$phase"
    if (System.getenv(DB_TEST_APPLICATION_NAME_ENV) != expectedApplicationName) {
      throw GradleException("PostgreSQL rail application name is not run-bound.")
    }
    requireM1BPostgresRailCompiledClasses(expectedClasses.map { it.replace('.', '/') + ".class" }.toSet())
  }

  doLast {
    requireRailJUnitSummary(
      readRailJUnitSummary(reports.junitXml.outputLocation.get().asFile),
      expectedClasses,
      expectedTests
    )
    val expectedRuntimeSha256 = requireNonBlankEnvironment(DB_RAIL_RUNTIME_SHA256_ENV)
    val actualRuntimeSha256 = postgresRailRuntimeSha256(m1BPostgresRailRuntimeInputs.get())
    if (actualRuntimeSha256 != expectedRuntimeSha256) {
      throw GradleException("PostgreSQL rail runtime inputs changed during test execution.")
    }
    logger.lifecycle("M1B_POSTGRES_RAIL_${phase.uppercase()}=PASS")
    logger.lifecycle("M1B_POSTGRES_RAIL_RUNTIME_SHA256_REVALIDATED=$actualRuntimeSha256")
    logger.lifecycle("M1B_POSTGRES_RAIL_${phase.uppercase()}_CLASSES=${expectedClasses.size}")
    logger.lifecycle("M1B_POSTGRES_RAIL_${phase.uppercase()}_TESTS=$expectedTests")
  }
}

tasks.register<Test>("m1BPostgresRailTargeted") {
  configureM1BPostgresRailTest("targeted", m1BPostgresRailTargetedClasses, 13)
  filter {
    m1BPostgresRailTargetedClasses.forEach { className -> includeTestsMatching(className) }
    isFailOnNoMatchingTests = true
  }
}

tasks.register<Test>("m1BPostgresRailFull") {
  configureM1BPostgresRailTest("full", m1BPostgresRailFullClasses, 55)
  filter {
    m1BPostgresRailFullClasses.forEach { className -> includeTestsMatching(className) }
    isFailOnNoMatchingTests = true
  }
}

gradle.taskGraph.whenReady {
  val taskNames = allTasks.map { it.name }.toSet()
  val runnerCredentialTasks = setOf("m1BPostgresRailTargeted", "m1BPostgresRailFull")
  val compileOrResourceTasks = allTasks.filter { task ->
    task.name in setOf(
      "compileJava",
      "compileKotlin",
      "compileTestJava",
      "compileTestKotlin",
      "processResources",
      "processTestResources",
      "classes",
      "testClasses"
    ) || task.name.startsWith("kapt") || task.name.startsWith("ksp")
  }
  if (
    taskNames.any(runnerCredentialTasks::contains) &&
    providers.gradleProperty("kotlin.compiler.execution.strategy").orNull != "in-process"
  ) {
    throw GradleException("PostgreSQL rail runner tasks require in-process Kotlin compiler isolation.")
  }
  if (taskNames.any(runnerCredentialTasks::contains) && compileOrResourceTasks.isNotEmpty()) {
    throw GradleException("PostgreSQL rail runner credential tasks must not compile or process resources.")
  }
}

tasks.register<Test>("offlineMappingEval042a2") {
  description = "Runs the deterministic offline candidate mapping eval for 042a2."
  group = "verification"
  testClassesDirs = testSourceSet.output.classesDirs
  classpath = testSourceSet.runtimeClasspath
  shouldRunAfter(tasks.named("test"))
  useJUnitPlatform {
    includeTags("offline-mapping-eval-042a2")
  }
}

tasks.register<JavaExec>("demoSeedLocal") {
  description = "Runs the explicit local/test-only synthetic demo seed against a configured PostgreSQL database."
  group = "application"
  classpath = mainSourceSet.runtimeClasspath
  mainClass.set("ch.qamwaq.ritomer.devtools.DemoSeedLocalCommandKt")

  val demoSeedProfile = providers.gradleProperty("ritomerDemoSeedProfile").orElse("local")
  args("--spring.profiles.active=${demoSeedProfile.get()}")

  val demoSeedEnabled = providers.gradleProperty("ritomerDemoSeedEnabled")
  if (demoSeedEnabled.isPresent) {
    args("--ritomer.demo.seed.enabled=${demoSeedEnabled.get()}")
  }

  val demoSeedVariant = providers.gradleProperty("ritomerDemoSeedVariant")
  if (demoSeedVariant.isPresent) {
    args("--ritomer.demo.seed.variant=${demoSeedVariant.get()}")
  }
}
