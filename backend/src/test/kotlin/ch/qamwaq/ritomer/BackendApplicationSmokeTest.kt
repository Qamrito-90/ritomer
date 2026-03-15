package ch.qamwaq.ritomer

import org.junit.jupiter.api.Test
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BackendApplicationSmokeTest : PostgresIntegrationTest() {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Test
  fun `context loads`() {
  }

  @Test
  fun `health endpoint is available without authentication`() {
    mockMvc.get("/actuator/health")
      .andExpect {
        status { isOk() }
        jsonPath("$.status") { value("UP") }
      }
  }

  @Test
  fun `api me requires authentication`() {
    mockMvc.get("/api/me")
      .andExpect {
        status { isUnauthorized() }
      }
  }

  @Test
  fun `api me returns placeholder identity data for authenticated users`() {
    mockMvc.get("/api/me") {
      with(jwt().jwt { token ->
        token.subject("user-123")
        token.claim("email", "reviewer@example.com")
        token.claim("tenant_id", "tenant-alpha")
        token.claim("roles", listOf("ACCOUNTANT"))
      })
    }.andExpect {
      status { isOk() }
      jsonPath("$.subject") { value("user-123") }
      jsonPath("$.email") { value("reviewer@example.com") }
      jsonPath("$.tenantId") { value("tenant-alpha") }
      jsonPath("$.mode") { value("placeholder") }
    }
  }
}
