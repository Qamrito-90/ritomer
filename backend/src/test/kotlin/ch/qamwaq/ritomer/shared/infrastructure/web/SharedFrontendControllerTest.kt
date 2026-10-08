package ch.qamwaq.ritomer.shared.infrastructure.web

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.core.io.ByteArrayResource
import org.springframework.core.io.ClassPathResource
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders

class SharedFrontendControllerTest {
  @Test
  fun `only exact shell routes receive HTML and API OAuth and unknown paths never do`() {
    val shell = "<!doctype html><html lang=\"fr\"><body>synthetic shell</body></html>"
    val mvc = MockMvcBuilders.standaloneSetup(SharedFrontendController(ByteArrayResource(shell.toByteArray()))).build()
    for (path in listOf("/", "/closing-folders/11111111-1111-4111-8111-111111111111")) {
      val response = mvc.perform(get(path)).andReturn().response
      assertThat(response.status).isEqualTo(200)
      assertThat(response.contentType).startsWith("text/html")
      assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store")
      assertThat(response.contentAsString).isEqualTo(shell)
    }
    for (path in listOf("/api/me", "/api/missing", "/oauth2/authorization/google", "/login/oauth2/code/google",
      "/closing-folders/not-a-uuid", "/closing-folders/11111111-1111-4111-8111-111111111111/extra", "/assets/missing.js")) {
      val response = mvc.perform(get(path)).andReturn().response
      assertThat(response.status).isEqualTo(404)
      assertThat(response.contentAsString).doesNotContain("synthetic shell")
    }
  }

  @Test
  fun `shared startup fails when the explicitly bundled entrypoint is missing`() {
    assertThatThrownBy { SharedFrontendController(ClassPathResource("absent-m1-2-entrypoint.html")) }
      .isInstanceOf(IllegalStateException::class.java).hasMessageContaining("explicitly bundled frontend")
  }
}
