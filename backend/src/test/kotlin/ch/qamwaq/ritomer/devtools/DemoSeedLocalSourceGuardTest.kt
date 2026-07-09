package ch.qamwaq.ritomer.devtools

import java.nio.file.Files
import java.nio.file.Path
import kotlin.io.path.readText
import kotlin.streams.asSequence
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class DemoSeedLocalSourceGuardTest {
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
      "-P$variantProperty=$DEMO_SEED_VARIANT_042A2A5D_MIXED_V2"
    )
    assertThat(buildScript).contains(
      """providers.gradleProperty("$enabledProperty")""",
      """providers.gradleProperty("$profileProperty")""",
      """providers.gradleProperty("$variantProperty")"""
    )
    assertThat(buildScript).doesNotContain(
      """providers.gradleProperty("RitomerDemoSeedEnabled")""",
      """providers.gradleProperty("RitomerDemoSeedProfile")""",
      """providers.gradleProperty("RitomerDemoSeedVariant")"""
    )
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
}
