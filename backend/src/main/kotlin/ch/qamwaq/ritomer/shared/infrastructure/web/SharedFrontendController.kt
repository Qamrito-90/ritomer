package ch.qamwaq.ritomer.shared.infrastructure.web

import org.springframework.context.annotation.Profile
import org.springframework.core.io.ClassPathResource
import org.springframework.core.io.Resource
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping

@Controller
@Profile("shared-internal")
class SharedFrontendController(private val index: Resource = ClassPathResource("static/index.html")) {
  init {
    check(index.exists()) {
      "The shared profile requires an explicitly bundled frontend."
    }
  }

  @GetMapping("/", "/closing-folders/{id:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}}")
  fun shell(): ResponseEntity<Resource> =
    ResponseEntity.ok().contentType(MediaType.TEXT_HTML).header("Cache-Control", "no-store")
      .body(index)
}

