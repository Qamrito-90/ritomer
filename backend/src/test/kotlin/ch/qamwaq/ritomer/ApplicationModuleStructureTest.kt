package ch.qamwaq.ritomer

import org.junit.jupiter.api.Test
import org.springframework.modulith.core.ApplicationModules

class ApplicationModuleStructureTest {
  @Test
  fun `spring modulith verifies module boundaries`() {
    ApplicationModules.of(RitomerBackendApplication::class.java).verify()
  }
}
