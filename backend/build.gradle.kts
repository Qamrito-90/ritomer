import org.gradle.api.tasks.SourceSetContainer
import org.gradle.api.tasks.testing.Test
import org.gradle.kotlin.dsl.the

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

mainSourceSet.resources.srcDir("../contracts/reference")

tasks.withType<Test>().configureEach {
  useJUnitPlatform()
}

tasks.named<Test>("test") {
  useJUnitPlatform {
    excludeTags("db-integration")
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
    val enabled = System.getenv("RITOMER_DB_TESTS_ENABLED").equals("true", ignoreCase = true)
    val urlConfigured = !System.getenv("RITOMER_DB_TEST_JDBC_URL").isNullOrBlank()
    val usernameConfigured = !System.getenv("RITOMER_DB_TEST_USERNAME").isNullOrBlank()

    if (!enabled || !urlConfigured || !usernameConfigured) {
      logger.lifecycle(
        "Skipping dbIntegrationTest: set RITOMER_DB_TESTS_ENABLED=true, RITOMER_DB_TEST_JDBC_URL and RITOMER_DB_TEST_USERNAME."
      )
    }

    enabled && urlConfigured && usernameConfigured
  }
}
