package ch.qamwaq.ritomer

import ch.qamwaq.ritomer.closing.application.CLOSING_FOLDER_ARCHIVED_ACTION
import ch.qamwaq.ritomer.closing.application.CLOSING_FOLDER_CREATED_ACTION
import ch.qamwaq.ritomer.closing.application.CLOSING_FOLDER_RESOURCE_TYPE
import ch.qamwaq.ritomer.closing.application.CLOSING_FOLDER_UPDATED_ACTION
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.identity.domain.TenantRole
import ch.qamwaq.ritomer.shared.application.ACTIVE_TENANT_HEADER
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.hamcrest.Matchers.matchesPattern
import org.hamcrest.Matchers.notNullValue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.patch
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(IdentityTestConfiguration::class)
class ClosingFolderApiTest {
  @Autowired
  private lateinit var mockMvc: MockMvc

  @Autowired
  private lateinit var identityTestStore: IdentityTestStore

  @Autowired
  private lateinit var auditTestStore: AuditTestStore

  @Autowired
  private lateinit var closingFolderTestStore: ClosingFolderTestStore

  @BeforeEach
  fun resetStores() {
    identityTestStore.reset()
    auditTestStore.reset()
    closingFolderTestStore.reset()
  }

  @Test
  fun `closing endpoints require authentication`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    val folderId = tenantId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

    mockMvc.post("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = createBody()
    }.andExpect { status { isUnauthorized() } }

    mockMvc.get("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.get("/api/closing-folders/$folderId") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
    }.andExpect { status { isUnauthorized() } }

    mockMvc.patch("/api/closing-folders/$folderId") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      contentType = MediaType.APPLICATION_JSON
      content = """{"name":"Updated"}"""
    }.andExpect { status { isUnauthorized() } }

    mockMvc.post("/api/closing-folders/$folderId/archive") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
    }.andExpect { status { isUnauthorized() } }
  }

  @Test
  fun `closing endpoints require X-Tenant-Id`() {
    seedMembership("user-123", tenantId("11111111-1111-1111-1111-111111111111"), TenantRole.MANAGER)
    val folder = seedFolder(tenantId("11111111-1111-1111-1111-111111111111"))

    mockMvc.post("/api/closing-folders") {
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = createBody()
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.get("/api/closing-folders/${folder.id}") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }

    mockMvc.patch("/api/closing-folders/${folder.id}") {
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = """{"name":"Updated"}"""
    }.andExpect { status { isBadRequest() } }

    mockMvc.post("/api/closing-folders/${folder.id}/archive") {
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }
  }

  @Test
  fun `closing endpoints reject invalid X-Tenant-Id`() {
    seedMembership("user-123", tenantId("11111111-1111-1111-1111-111111111111"), TenantRole.MANAGER)

    mockMvc.get("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, "not-a-uuid")
      with(actorJwt("user-123"))
    }.andExpect { status { isBadRequest() } }
  }

  @Test
  fun `reviewer cannot mutate closing folders`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    seedMembership("user-123", tenantId, TenantRole.REVIEWER)
    val folder = seedFolder(tenantId)

    mockMvc.post("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = createBody()
    }.andExpect { status { isForbidden() } }

    mockMvc.patch("/api/closing-folders/${folder.id}") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = """{"name":"Updated"}"""
    }.andExpect { status { isForbidden() } }

    mockMvc.post("/api/closing-folders/${folder.id}/archive") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isForbidden() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `get returns 404 when folder is absent or belongs to another tenant`() {
    val tenantAlphaId = tenantId("11111111-1111-1111-1111-111111111111")
    val tenantBetaId = tenantId("22222222-2222-2222-2222-222222222222")
    seedMembership("user-123", tenantAlphaId, TenantRole.ACCOUNTANT)
    seedMembership("user-123", tenantBetaId, TenantRole.REVIEWER)
    val betaFolder = seedFolder(tenantBetaId)

    mockMvc.get("/api/closing-folders/${UUID.randomUUID()}") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }

    mockMvc.get("/api/closing-folders/${betaFolder.id}") {
      header(ACTIVE_TENANT_HEADER, tenantAlphaId.toString())
      with(actorJwt("user-123"))
    }.andExpect { status { isNotFound() } }
  }

  @Test
  fun `create returns 201 with location and writes one audit event`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    val result = mockMvc.post("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = createBody()
    }.andExpect {
      status { isCreated() }
      header { string("Location", matchesPattern(".*/api/closing-folders/.*")) }
      jsonPath("$.tenantId") { value(tenantId.toString()) }
      jsonPath("$.name") { value("Closing FY24") }
      jsonPath("$.status") { value("DRAFT") }
    }.andReturn()

    val createdId = result.response.contentAsString.substringAfter("\"id\":\"").substringBefore('"')
    val auditEvents = auditTestStore.auditEvents()
    assertThat(auditEvents).hasSize(1)
    assertThat(auditEvents.single().command.action).isEqualTo(CLOSING_FOLDER_CREATED_ACTION)
    assertThat(auditEvents.single().command.resourceType).isEqualTo(CLOSING_FOLDER_RESOURCE_TYPE)
    assertThat(auditEvents.single().command.resourceId).isEqualTo(createdId)
    assertThat(auditEvents.single().command.tenantId).isEqualTo(tenantId)
  }

  @Test
  fun `list and get do not emit audit events and list ordering is deterministic`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    seedMembership("user-123", tenantId, TenantRole.REVIEWER)
    val older = seedFolder(
      tenantId = tenantId,
      id = tenantId("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
      name = "Older",
      periodEndOn = LocalDate.parse("2024-06-30"),
      createdAt = OffsetDateTime.parse("2024-07-01T10:00:00Z")
    )
    val newer = seedFolder(
      tenantId = tenantId,
      id = tenantId("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"),
      name = "Newer",
      periodEndOn = LocalDate.parse("2024-12-31"),
      createdAt = OffsetDateTime.parse("2025-01-02T10:00:00Z")
    )

    mockMvc.get("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$[0].id") { value(newer.id.toString()) }
      jsonPath("$[1].id") { value(older.id.toString()) }
    }

    mockMvc.get("/api/closing-folders/${older.id}") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.id") { value(older.id.toString()) }
      jsonPath("$.name") { value("Older") }
    }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `patch updates only provided fields and writes one audit event`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    seedMembership("user-123", tenantId, TenantRole.MANAGER)
    val folder = seedFolder(tenantId = tenantId, externalRef = "EXT-1")

    mockMvc.patch("/api/closing-folders/${folder.id}") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = """{"name":"Closing FY24 Updated","externalRef":null}"""
    }.andExpect {
      status { isOk() }
      jsonPath("$.name") { value("Closing FY24 Updated") }
      jsonPath("$.externalRef") { doesNotExist() }
      jsonPath("$.status") { value("DRAFT") }
    }

    val auditEvents = auditTestStore.auditEvents()
    assertThat(auditEvents).hasSize(1)
    assertThat(auditEvents.single().command.action).isEqualTo(CLOSING_FOLDER_UPDATED_ACTION)
    assertThat(auditEvents.single().command.metadata["changes"].toString()).contains("name")
    assertThat(auditEvents.single().command.metadata["changes"].toString()).contains("externalRef")
  }

  @Test
  fun `patch rejects empty body and invalid period range`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)
    val folder = seedFolder(tenantId)

    mockMvc.patch("/api/closing-folders/${folder.id}") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = """{}"""
    }.andExpect { status { isBadRequest() } }

    mockMvc.patch("/api/closing-folders/${folder.id}") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = """{"periodStartOn":"2024-12-31","periodEndOn":"2024-01-01"}"""
    }.andExpect { status { isBadRequest() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  @Test
  fun `archive is idempotent and writes no second audit event`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    seedMembership("user-123", tenantId, TenantRole.ADMIN)
    val folder = seedFolder(tenantId)

    mockMvc.post("/api/closing-folders/${folder.id}/archive") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.status") { value("ARCHIVED") }
      jsonPath("$.archivedByUserId") { value(notNullValue()) }
    }

    mockMvc.post("/api/closing-folders/${folder.id}/archive") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
    }.andExpect {
      status { isOk() }
      jsonPath("$.status") { value("ARCHIVED") }
    }

    val auditEvents = auditTestStore.auditEvents()
    assertThat(auditEvents).hasSize(1)
    assertThat(auditEvents.single().command.action).isEqualTo(CLOSING_FOLDER_ARCHIVED_ACTION)
  }

  @Test
  fun `create rejects invalid period range without audit`() {
    val tenantId = tenantId("11111111-1111-1111-1111-111111111111")
    seedMembership("user-123", tenantId, TenantRole.ACCOUNTANT)

    mockMvc.post("/api/closing-folders") {
      header(ACTIVE_TENANT_HEADER, tenantId.toString())
      with(actorJwt("user-123"))
      contentType = MediaType.APPLICATION_JSON
      content = """
        {
          "name":"Invalid",
          "periodStartOn":"2024-12-31",
          "periodEndOn":"2024-01-01"
        }
      """.trimIndent()
    }.andExpect { status { isBadRequest() } }

    assertThat(auditTestStore.auditEvents()).isEmpty()
  }

  private fun seedMembership(
    subject: String,
    tenantId: UUID,
    vararg roles: TenantRole
  ) {
    identityTestStore.seedActiveMembership(subject, tenantId, "tenant-${tenantId.toString().take(4)}", "Tenant", *roles)
  }

  private fun seedFolder(
    tenantId: UUID,
    id: UUID = UUID.randomUUID(),
    name: String = "Closing FY24",
    periodStartOn: LocalDate = LocalDate.parse("2024-01-01"),
    periodEndOn: LocalDate = LocalDate.parse("2024-12-31"),
    externalRef: String? = null,
    status: ClosingFolderStatus = ClosingFolderStatus.DRAFT,
    archivedAt: OffsetDateTime? = null,
    archivedByUserId: UUID? = null,
    createdAt: OffsetDateTime = OffsetDateTime.now(ZoneOffset.UTC).minusDays(1),
    updatedAt: OffsetDateTime = createdAt
  ): ClosingFolder {
    val folder = ClosingFolder(
      id = id,
      tenantId = tenantId,
      name = name,
      periodStartOn = periodStartOn,
      periodEndOn = periodEndOn,
      externalRef = externalRef,
      status = status,
      archivedAt = archivedAt,
      archivedByUserId = archivedByUserId,
      createdAt = createdAt,
      updatedAt = updatedAt
    )
    closingFolderTestStore.save(folder)
    return folder
  }

  private fun createBody(): String =
    """
      {
        "name":"Closing FY24",
        "periodStartOn":"2024-01-01",
        "periodEndOn":"2024-12-31",
        "externalRef":"EXT-123"
      }
    """.trimIndent()

  private fun tenantId(value: String): UUID = UUID.fromString(value)
}

private fun actorJwt(
  subject: String,
  email: String? = null,
  name: String? = null,
  preferredUsername: String? = null
) = jwt().jwt { token ->
  token.subject(subject)
  email?.let { token.claim("email", it) }
  name?.let { token.claim("name", it) }
  preferredUsername?.let { token.claim("preferred_username", it) }
}
