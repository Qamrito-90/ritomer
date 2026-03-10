package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.identity.application.CurrentUserService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class MeController(
  private val currentUserService: CurrentUserService
) {
  @GetMapping("/me")
  fun me(): MeResponse {
    val currentUser = currentUserService.currentUser()
    return MeResponse(
      subject = currentUser.subject,
      email = currentUser.email,
      tenantId = currentUser.tenantId,
      authorities = currentUser.authorities,
      mode = "placeholder"
    )
  }
}

data class MeResponse(
  val subject: String,
  val email: String?,
  val tenantId: String?,
  val authorities: Set<String>,
  val mode: String
)
