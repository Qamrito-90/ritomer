package ch.qamwaq.ritomer.devtools

import ch.qamwaq.ritomer.IdentityTestConfiguration
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.ApplicationContext
import org.springframework.context.annotation.Import
import org.springframework.security.web.SecurityFilterChain
import org.springframework.test.context.ActiveProfiles
import org.springframework.web.context.WebApplicationContext

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class DemoSeedLocalNonWebContextTest {
  @Autowired
  private lateinit var context: ApplicationContext

  @Test
  fun `demo seed compatible non web context does not instantiate servlet security filter chain`() {
    assertThat(context).isNotInstanceOf(WebApplicationContext::class.java)
    assertThat(context.getBeansOfType(SecurityFilterChain::class.java)).isEmpty()
  }
}
