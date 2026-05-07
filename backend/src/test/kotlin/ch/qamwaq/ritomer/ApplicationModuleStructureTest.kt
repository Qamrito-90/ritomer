package ch.qamwaq.ritomer

import java.nio.file.Files
import java.nio.file.Paths
import kotlin.streams.asSequence
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.modulith.core.ApplicationModules

class ApplicationModuleStructureTest {
  @Test
  fun `spring modulith verifies module boundaries`() {
    ApplicationModules.of(RitomerBackendApplication::class.java).verify()
  }

  @Test
  fun `mapping module only imports the published ai access surface`() {
    val mappingSourceRoot = Paths.get("src/main/kotlin/ch/qamwaq/ritomer/mapping")
    val disallowedAiImports = Files.walk(mappingSourceRoot).use { paths ->
      paths.asSequence()
        .filter { Files.isRegularFile(it) }
        .flatMap { path ->
          Files.readAllLines(path).asSequence()
            .filter { it.matches(DISALLOWED_AI_IMPORT_REGEX) }
            .map { "${mappingSourceRoot.relativize(path)}: $it" }
        }
        .toList()
    }

    assertThat(disallowedAiImports).isEmpty()
  }

  companion object {
    private val DISALLOWED_AI_IMPORT_REGEX = Regex("""import\s+ch\.qamwaq\.ritomer\.ai\.(?!access\.).*""")
  }
}
