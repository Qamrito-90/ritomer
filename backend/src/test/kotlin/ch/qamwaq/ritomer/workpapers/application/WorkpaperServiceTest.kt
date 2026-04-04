package ch.qamwaq.ritomer.workpapers.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.access.ClosingControlsSnapshot
import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsBlocker
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperAnchor
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperAnchorProjection
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperBreakdownType
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperStatementKind
import ch.qamwaq.ritomer.financials.access.WorkpaperAnchorAccess
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContext
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.workpapers.domain.Document
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidence
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidenceVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test

class WorkpaperServiceTest {
  private val tenantId = UUID.fromString("11111111-1111-1111-1111-111111111111")
  private val actorUserId = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
  private val closingFolderId = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

  @Test
  fun `state machine allows only validated transitions`() {
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.DRAFT, WorkpaperStatus.READY_FOR_REVIEW)).isTrue()
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.READY_FOR_REVIEW, WorkpaperStatus.CHANGES_REQUESTED)).isTrue()
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.READY_FOR_REVIEW, WorkpaperStatus.REVIEWED)).isTrue()
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.CHANGES_REQUESTED, WorkpaperStatus.DRAFT)).isTrue()
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.CHANGES_REQUESTED, WorkpaperStatus.READY_FOR_REVIEW)).isTrue()

    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.DRAFT, WorkpaperStatus.DRAFT)).isFalse()
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.DRAFT, WorkpaperStatus.REVIEWED)).isFalse()
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.REVIEWED, WorkpaperStatus.DRAFT)).isFalse()
    assertThat(WorkpaperStatusTransitions.isAllowedTransition(WorkpaperStatus.REVIEWED, WorkpaperStatus.CHANGES_REQUESTED)).isFalse()
  }

  @Test
  fun `upsert rejects stale or non current anchor`() {
    val repository = FakeWorkpaperRepository()
    val auditTrail = RecordingAuditTrail()
    val service = service(
      controlsSnapshot = readyControls(),
      anchorProjection = anchorProjection(currentAnchor("BS.ASSET.CURRENT_SECTION")),
      repository = repository,
      auditTrail = auditTrail
    )

    assertThatThrownBy {
      service.upsert(
        makerAccess(),
        closingFolderId,
        "BS.ASSET.LEGACY_BUCKET_FALLBACK",
        WorkpaperUpsertCommand(
          noteText = "Justification",
          status = WorkpaperStatus.DRAFT,
          evidences = emptyList()
        )
      )
    }.isInstanceOf(WorkpaperConflictException::class.java)

    assertThat(repository.workpapers).isEmpty()
    assertThat(auditTrail.commands).isEmpty()
  }

  @Test
  fun `get computes current items and stale workpapers separately`() {
    val current = currentAnchor("BS.ASSET.CURRENT_SECTION")
    val currentWorkpaper = persistedWorkpaper(anchorCode = current.code, anchorLabel = current.label)
    val staleWorkpaper = persistedWorkpaper(
      anchorCode = "BS.ASSET.LEGACY_BUCKET_FALLBACK",
      anchorLabel = "Legacy bucket-level mappings",
      breakdownType = WorkpaperBreakdownType.LEGACY_BUCKET_FALLBACK
    )
    val repository = FakeWorkpaperRepository(listOf(currentWorkpaper, staleWorkpaper))
    val service = service(
      controlsSnapshot = readyControls(),
      anchorProjection = anchorProjection(current),
      repository = repository
    )

    val response = service.getWorkpapers(readAccess(), closingFolderId)

    assertThat(response.items).hasSize(1)
    assertThat(response.items.single().isCurrentStructure).isTrue()
    assertThat(response.items.single().workpaper?.id).isEqualTo(currentWorkpaper.id)
    assertThat(response.staleWorkpapers).hasSize(1)
    assertThat(response.staleWorkpapers.single().isCurrentStructure).isFalse()
    assertThat(response.staleWorkpapers.single().workpaper?.id).isEqualTo(staleWorkpaper.id)
    assertThat(response.summaryCounts.totalCurrentAnchors).isEqualTo(1)
    assertThat(response.summaryCounts.withWorkpaperCount).isEqualTo(1)
    assertThat(response.summaryCounts.staleCount).isEqualTo(1)
  }

  @Test
  fun `upsert no op stays silent in audit`() {
    val existing = persistedWorkpaper(
      noteText = "Justification",
      status = WorkpaperStatus.DRAFT,
      evidences = listOf(
        persistedEvidence(position = 1, fileName = "invoice.pdf", mediaType = "application/pdf")
      )
    )
    val repository = FakeWorkpaperRepository(listOf(existing))
    val auditTrail = RecordingAuditTrail()
    val service = service(
      controlsSnapshot = readyControls(),
      anchorProjection = anchorProjection(currentAnchor(existing.anchorCode)),
      repository = repository,
      auditTrail = auditTrail
    )

    val result = service.upsert(
      makerAccess(),
      closingFolderId,
      existing.anchorCode,
      WorkpaperUpsertCommand(
        noteText = "Justification",
        status = WorkpaperStatus.DRAFT,
        evidences = listOf(
          WorkpaperEvidenceCommand(
            position = 1,
            fileName = "invoice.pdf",
            mediaType = "application/pdf",
            documentDate = null,
            sourceLabel = "ERP",
            verificationStatus = WorkpaperEvidenceVerificationStatus.UNVERIFIED,
            externalReference = null,
            checksumSha256 = null
          )
        )
      )
    )

    assertThat(result.outcome).isEqualTo(WorkpaperMutationOutcome.NOOP)
    assertThat(auditTrail.commands).isEmpty()
  }

  @Test
  fun `maker update rejects changed content once workpaper is ready for review`() {
    val existing = persistedWorkpaper(status = WorkpaperStatus.READY_FOR_REVIEW)
    val repository = FakeWorkpaperRepository(listOf(existing))
    val auditTrail = RecordingAuditTrail()
    val service = service(
      controlsSnapshot = readyControls(),
      anchorProjection = anchorProjection(currentAnchor(existing.anchorCode)),
      repository = repository,
      auditTrail = auditTrail
    )

    assertThatThrownBy {
      service.upsert(
        makerAccess(),
        closingFolderId,
        existing.anchorCode,
        WorkpaperUpsertCommand(
          noteText = "Updated after review",
          status = WorkpaperStatus.READY_FOR_REVIEW,
          evidences = listOf(
            WorkpaperEvidenceCommand(
              position = 1,
              fileName = "invoice.pdf",
              mediaType = "application/pdf",
              documentDate = null,
              sourceLabel = "ERP",
              verificationStatus = WorkpaperEvidenceVerificationStatus.UNVERIFIED,
              externalReference = null,
              checksumSha256 = null
            )
          )
        )
      )
    }.isInstanceOf(WorkpaperConflictException::class.java)

    assertThat(auditTrail.commands).isEmpty()
    assertThat(repository.findByAnchorCode(tenantId, closingFolderId, existing.anchorCode)).isEqualTo(existing)
  }

  @Test
  fun `maker update is allowed from changes requested`() {
    val existing = persistedWorkpaper(
      noteText = "Need more details",
      status = WorkpaperStatus.CHANGES_REQUESTED
    )
    val repository = FakeWorkpaperRepository(listOf(existing))
    val auditTrail = RecordingAuditTrail()
    val service = service(
      controlsSnapshot = readyControls(),
      anchorProjection = anchorProjection(currentAnchor(existing.anchorCode)),
      repository = repository,
      auditTrail = auditTrail
    )

    val result = service.upsert(
      makerAccess(),
      closingFolderId,
      existing.anchorCode,
      WorkpaperUpsertCommand(
        noteText = "Added tie-out details",
        status = WorkpaperStatus.DRAFT,
        evidences = listOf(
          WorkpaperEvidenceCommand(
            position = 1,
            fileName = "invoice.pdf",
            mediaType = "application/pdf",
            documentDate = null,
            sourceLabel = "ERP",
            verificationStatus = WorkpaperEvidenceVerificationStatus.VERIFIED,
            externalReference = null,
            checksumSha256 = null
          )
        )
      )
    )

    assertThat(result.outcome).isEqualTo(WorkpaperMutationOutcome.UPDATED)
    assertThat(result.item.workpaper?.status).isEqualTo(WorkpaperStatus.DRAFT)
    assertThat(result.item.workpaper?.noteText).isEqualTo("Added tie-out details")
    assertThat(auditTrail.commands.map { it.action }).containsExactly(WORKPAPER_UPDATED_ACTION)
  }

  @Test
  fun `upsert normalizes and orders evidences`() {
    val repository = FakeWorkpaperRepository()
    val service = service(
      controlsSnapshot = readyControls(),
      anchorProjection = anchorProjection(currentAnchor("BS.ASSET.CURRENT_SECTION")),
      repository = repository
    )

    val result = service.upsert(
      makerAccess(),
      closingFolderId,
      "BS.ASSET.CURRENT_SECTION",
      WorkpaperUpsertCommand(
        noteText = "  Cash support  ",
        status = WorkpaperStatus.DRAFT,
        evidences = listOf(
          WorkpaperEvidenceCommand(
            position = 2,
            fileName = "  bank.csv  ",
            mediaType = "TEXT/CSV",
            documentDate = null,
            sourceLabel = "  Bank portal  ",
            verificationStatus = WorkpaperEvidenceVerificationStatus.VERIFIED,
            externalReference = "  bank://42  ",
            checksumSha256 = "ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789"
          ),
          WorkpaperEvidenceCommand(
            position = 1,
            fileName = " invoice.pdf ",
            mediaType = "APPLICATION/PDF",
            documentDate = LocalDate.parse("2024-12-31"),
            sourceLabel = " ERP ",
            verificationStatus = WorkpaperEvidenceVerificationStatus.UNVERIFIED,
            externalReference = "   ",
            checksumSha256 = null
          )
        )
      )
    )

    val evidences = result.item.workpaper?.evidences.orEmpty()
    assertThat(evidences).hasSize(2)
    assertThat(evidences[0].position).isEqualTo(1)
    assertThat(evidences[0].fileName).isEqualTo("invoice.pdf")
    assertThat(evidences[0].mediaType).isEqualTo("application/pdf")
    assertThat(evidences[0].sourceLabel).isEqualTo("ERP")
    assertThat(evidences[0].externalReference).isNull()
    assertThat(evidences[1].position).isEqualTo(2)
    assertThat(evidences[1].fileName).isEqualTo("bank.csv")
    assertThat(evidences[1].mediaType).isEqualTo("text/csv")
    assertThat(evidences[1].sourceLabel).isEqualTo("Bank portal")
    assertThat(evidences[1].externalReference).isEqualTo("bank://42")
    assertThat(evidences[1].checksumSha256).isEqualTo("abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789")
  }

  @Test
  fun `review decision requires comment when changes requested`() {
    val existing = persistedWorkpaper(status = WorkpaperStatus.READY_FOR_REVIEW)
    val repository = FakeWorkpaperRepository(listOf(existing))
    val service = service(
      controlsSnapshot = readyControls(),
      anchorProjection = anchorProjection(currentAnchor(existing.anchorCode)),
      repository = repository
    )

    assertThatThrownBy {
      service.reviewDecision(
        reviewerAccess(),
        closingFolderId,
        existing.anchorCode,
        WorkpaperReviewDecisionCommand(
          decision = WorkpaperStatus.CHANGES_REQUESTED,
          comment = "   "
        )
      )
    }.isInstanceOf(WorkpaperBadRequestException::class.java)
  }

  private fun service(
    controlsSnapshot: ClosingControlsSnapshot,
    anchorProjection: CurrentWorkpaperAnchorProjection,
    repository: FakeWorkpaperRepository,
    documentRepository: FakeDocumentRepository = FakeDocumentRepository(),
    auditTrail: RecordingAuditTrail = RecordingAuditTrail()
  ): WorkpaperService =
    WorkpaperService(
      controlsAccess = ControlsAccess { _, _ -> controlsSnapshot },
      workpaperAnchorAccess = WorkpaperAnchorAccess { _, _ -> anchorProjection },
      workpaperRepository = repository,
      documentRepository = documentRepository,
      auditTrail = auditTrail,
      auditCorrelationContextProvider = AuditCorrelationContextProvider {
        AuditCorrelationContext(requestId = "req-1")
      }
    )

  private fun readyControls(): ClosingControlsSnapshot =
    ClosingControlsSnapshot(
      closingFolderStatus = ClosingFolderAccessStatus.DRAFT,
      readiness = ControlsReadiness.READY,
      blockers = emptyList(),
      nextAction = null
    )

  private fun anchorProjection(vararg anchors: CurrentWorkpaperAnchor): CurrentWorkpaperAnchorProjection =
    CurrentWorkpaperAnchorProjection(
      latestImportVersion = 3,
      taxonomyVersion = 2,
      anchors = anchors.toList()
    )

  private fun currentAnchor(code: String): CurrentWorkpaperAnchor =
    CurrentWorkpaperAnchor(
      code = code,
      label = if (code.endsWith("LEGACY_BUCKET_FALLBACK")) "Legacy bucket-level mappings" else "Current assets",
      summaryBucketCode = "BS.ASSET",
      statementKind = CurrentWorkpaperStatementKind.BALANCE_SHEET,
      breakdownType = if (code.endsWith("LEGACY_BUCKET_FALLBACK")) {
        CurrentWorkpaperBreakdownType.LEGACY_BUCKET_FALLBACK
      } else {
        CurrentWorkpaperBreakdownType.SECTION
      }
    )

  private fun makerAccess(): TenantAccessContext =
    TenantAccessContext(
      actorUserId = actorUserId,
      actorSubject = "maker",
      tenantId = tenantId,
      effectiveRoles = setOf("ACCOUNTANT")
    )

  private fun reviewerAccess(): TenantAccessContext =
    TenantAccessContext(
      actorUserId = actorUserId,
      actorSubject = "reviewer",
      tenantId = tenantId,
      effectiveRoles = setOf("REVIEWER")
    )

  private fun readAccess(): TenantAccessContext =
    TenantAccessContext(
      actorUserId = actorUserId,
      actorSubject = "reader",
      tenantId = tenantId,
      effectiveRoles = setOf("MANAGER")
    )

  private fun persistedWorkpaper(
    anchorCode: String = "BS.ASSET.CURRENT_SECTION",
    anchorLabel: String = "Current assets",
    breakdownType: WorkpaperBreakdownType = WorkpaperBreakdownType.SECTION,
    noteText: String = "Justification",
    status: WorkpaperStatus = WorkpaperStatus.DRAFT,
    evidences: List<WorkpaperEvidence> = listOf(persistedEvidence())
  ): Workpaper {
    val workpaperId = UUID.randomUUID()
    return Workpaper(
      id = workpaperId,
      tenantId = tenantId,
      closingFolderId = closingFolderId,
      anchorCode = anchorCode,
      anchorLabel = anchorLabel,
      summaryBucketCode = "BS.ASSET",
      statementKind = WorkpaperStatementKind.BALANCE_SHEET,
      breakdownType = breakdownType,
      noteText = noteText,
      status = status,
      reviewComment = null,
      basisImportVersion = 3,
      basisTaxonomyVersion = 2,
      createdAt = OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      createdByUserId = actorUserId,
      updatedAt = OffsetDateTime.parse("2025-01-01T00:00:00Z"),
      updatedByUserId = actorUserId,
      reviewedAt = null,
      reviewedByUserId = null,
      evidences = evidences.map { it.copy(workpaperId = workpaperId) }
    )
  }

  private fun persistedEvidence(
    position: Int = 1,
    fileName: String = "invoice.pdf",
    mediaType: String = "application/pdf"
  ): WorkpaperEvidence =
    WorkpaperEvidence(
      id = UUID.randomUUID(),
      tenantId = tenantId,
      workpaperId = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc"),
      position = position,
      fileName = fileName,
      mediaType = mediaType,
      documentDate = null,
      sourceLabel = "ERP",
      verificationStatus = WorkpaperEvidenceVerificationStatus.UNVERIFIED,
      externalReference = null,
      checksumSha256 = null
    )
}

private class FakeWorkpaperRepository(initial: List<Workpaper> = emptyList()) : WorkpaperRepository {
  val workpapers = initial.associateBy { it.id }.toMutableMap()

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<Workpaper> =
    workpapers.values
      .filter { it.tenantId == tenantId && it.closingFolderId == closingFolderId }
      .sortedBy { it.anchorCode }

  override fun findByAnchorCode(tenantId: UUID, closingFolderId: UUID, anchorCode: String): Workpaper? =
    workpapers.values.firstOrNull {
      it.tenantId == tenantId &&
        it.closingFolderId == closingFolderId &&
        it.anchorCode == anchorCode
    }

  override fun create(workpaper: Workpaper): Workpaper {
    workpapers[workpaper.id] = workpaper
    return workpaper
  }

  override fun update(workpaper: Workpaper): Workpaper {
    workpapers[workpaper.id] = workpaper
    return workpaper
  }
}

private class FakeDocumentRepository(initial: List<Document> = emptyList()) : DocumentRepository {
  private val documents = initial.associateBy { it.id }.toMutableMap()

  override fun create(document: Document): Document {
    documents[document.id] = document
    return document
  }

  override fun findByWorkpaper(tenantId: UUID, workpaperId: UUID): List<Document> =
    documents.values
      .filter { it.tenantId == tenantId && it.workpaperId == workpaperId }
      .sortedWith(compareByDescending<Document> { it.createdAt }.thenByDescending { it.id })

  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): Map<UUID, List<Document>> =
    documents.values
      .filter { it.tenantId == tenantId }
      .groupBy { it.workpaperId }

  override fun findByIdWithinClosingFolder(tenantId: UUID, closingFolderId: UUID, documentId: UUID): Document? =
    documents[documentId]?.takeIf { it.tenantId == tenantId }
}

private class RecordingAuditTrail : AuditTrail {
  val commands = mutableListOf<AppendAuditEventCommand>()

  override fun append(command: AppendAuditEventCommand): UUID {
    commands.add(command)
    return UUID.randomUUID()
  }
}
