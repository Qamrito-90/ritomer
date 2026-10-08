package ch.qamwaq.ritomer.shared.application

/** Called only after protocol, signature, issuer, audience and nonce validation. */
fun interface OidcActorAdmission {
  fun admit(issuer: String, subject: String): AuthenticatedActor
}

class OidcAdmissionDeniedException : RuntimeException("OIDC admission denied.")

