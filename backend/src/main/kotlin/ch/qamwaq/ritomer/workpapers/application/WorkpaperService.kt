package ch.qamwaq.ritomer.workpapers.application

import ch.qamwaq.ritomer.closing.access.ClosingFolderAccessStatus
import ch.qamwaq.ritomer.controls.access.ClosingControlsSnapshot
import ch.qamwaq.ritomer.controls.access.ControlsAccess
import ch.qamwaq.ritomer.controls.access.ControlsBlocker
import ch.qamwaq.ritomer.controls.access.ControlsNextActionView
import ch.qamwaq.ritomer.controls.access.ControlsReadiness
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperAnchor
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperAnchorProjection
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperBreakdownType
import ch.qamwaq.ritomer.financials.access.CurrentWorkpaperStatementKind
import ch.qamwaq.ritomer.financials.access.WorkpaperAnchorAccess
import ch.qamwaq.ritomer.identity.access.TenantAccessContext
import ch.qamwaq.ritomer.shared.application.AppendAuditEventCommand
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidence
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidenceVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.ResponseStatus

data class ClosingWorkpapers(
  val closingFolderId: UUID,
  val closingFolderStatus: String,
  val readiness: String,
  val latestImportVersion: Int?,
  val blockers: List<WorkpaperBlocker>,
  val nextAction: WorkpaperNextAction?,
  val summaryCounts: WorkpaperSummaryCounts,
  val items: List<WorkpaperItem>,
  val staleWorkpapers: List<WorkpaperItem>
)

data class WorkpaperSummaryCounts(
  val totalCurrentAnchors: Int,
  val withWorkpaperCount: Int,
  val readyForReviewCount: Int,
  val reviewedCount: Int,
  val staleCount: Int,
  val missingCount: Int
)

data class WorkpaperItem(
  val anchorCode: String,
  val anchorLabel: String,
  val summaryBucketCode: String,
  val statementKind: String,
  val breakdownType: String,
  val isCurrentStructure: Boolean,
  val workpaper: WorkpaperDetails?
)

data class WorkpaperDetails(
  val id: UUID,
  val noteText: String,
  val status: WorkpaperStatus,
  val reviewComment: String?,
  val basisImportVersion: Int,
  val basisTaxonomyVersion: Int,
  val createdAt: OffsetDateTime,
  val createdByUserId: UUID,
  val updatedAt: OffsetDateTime,
  val updatedByUserId: UUID,
  val reviewedAt: OffsetDateTime?,
  val reviewedByUserId: UUID?,
  val evidences: List<WorkpaperEvidenceDetails>
)

data class WorkpaperEvidenceDetails(
  val id: UUID,
  val position: Int,
  val fileName: String,
  val mediaType: String,
  val documentDate: LocalDate?,
  val sourceLabel: String,
  val verificationStatus: WorkpaperEvidenceVerificationStatus,
  val externalReference: String?,
  val checksumSha256: String?
)

data class WorkpaperBlocker(
  val code: String,
  val message: String
)

data class WorkpaperNextAction(
  val code: String,
  val path: String,
  val actionable: Boolean
)

data class WorkpaperUpsertCommand(
  val noteText: String,
  val status: WorkpaperStatus,
  val evidences: List<WorkpaperEvidenceCommand>
)

data class WorkpaperEvidenceCommand(
  val position: Int,
  val fileName: String,
  val mediaType: String,
  val documentDate: LocalDate?,
  val sourceLabel: String,
  val verificationStatus: WorkpaperEvidenceVerificationStatus,
  val externalReference: String?,
  val checksumSha256: String?
)

data class WorkpaperReviewDecisionCommand(
  val decision: WorkpaperStatus,
  val comment: String?
)

data class WorkpaperMutationResult(
  val item: WorkpaperItem,
  val outcome: WorkpaperMutationOutcome
)

enum class WorkpaperMutationOutcome {
  CREATED,
  UPDATED,
  NOOP
}

@Service
class WorkpaperService(
  private val controlsAccess: ControlsAccess,
  private val workpaperAnchorAccess: WorkpaperAnchorAccess,
  private val workpaperRepository: WorkpaperRepository,
  private val auditTrail: AuditTrail,
  private val auditCorrelationContextProvider: AuditCorrelationContextProvider
) {
  fun getWorkpapers(access: TenantAccessContext, closingFolderId: UUID): ClosingWorkpapers {
    requireAnyRole(access, READ_ROLES, "workpapers read")

    val controls = controlsAccess.getSnapshot(access, closingFolderId)
    val currentAnchors = workpaperAnchorAccess.getCurrentAnchors(access.tenantId, closingFolderId)
    val persistedWorkpapers = workpaperRepository.findByClosingFolder(access.tenantId, closingFolderId)
    val persistedByAnchorCode = persistedWorkpapers.associateBy { it.anchorCode }
    val currentAnchorCodes = currentAnchors.anchors.asSequence().map { it.code }.toSet()

    val items = currentAnchors.anchors.map { anchor ->
      WorkpaperItem(
        anchorCode = anchor.code,
        anchorLabel = anchor.label,
        summaryBucketCode = anchor.summaryBucketCode,
        statementKind = anchor.statementKind.name,
        breakdownType = anchor.breakdownType.name,
        isCurrentStructure = true,
        workpaper = persistedByAnchorCode[anchor.code]?.toDetails()
      )
    }

    val staleWorkpapers = persistedWorkpapers
      .filter { it.anchorCode !in currentAnchorCodes }
      .sortedWith(compareBy<Workpaper> { SUMMARY_BUCKET_ORDER.indexOf(it.summaryBucketCode).takeIf { index -> index >= 0 } ?: Int.MAX_VALUE }.thenBy { it.anchorCode })
      .map {
        WorkpaperItem(
          anchorCode = it.anchorCode,
          anchorLabel = it.anchorLabel,
          summaryBucketCode = it.summaryBucketCode,
          statementKind = it.statementKind.name,
          breakdownType = it.breakdownType.name,
          isCurrentStructure = false,
          workpaper = it.toDetails()
        )
      }

    val withWorkpaperCount = items.count { it.workpaper != null }
    val readyForReviewCount = items.count { it.workpaper?.status == WorkpaperStatus.READY_FOR_REVIEW }
    val reviewedCount = items.count { it.workpaper?.status == WorkpaperStatus.REVIEWED }

    return ClosingWorkpapers(
      closingFolderId = closingFolderId,
      closingFolderStatus = controls.closingFolderStatus.name,
      readiness = controls.readiness.name,
      latestImportVersion = currentAnchors.latestImportVersion,
      blockers = controls.blockers.map { it.toBlocker() },
      nextAction = controls.nextAction?.toNextAction(),
      summaryCounts = WorkpaperSummaryCounts(
        totalCurrentAnchors = items.size,
        withWorkpaperCount = withWorkpaperCount,
        readyForReviewCount = readyForReviewCount,
        reviewedCount = reviewedCount,
        staleCount = staleWorkpapers.size,
        missingCount = items.size - withWorkpaperCount
      ),
      items = items,
      staleWorkpapers = staleWorkpapers
    )
  }

  @Transactional
  fun upsert(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorCode: String,
    command: WorkpaperUpsertCommand
  ): WorkpaperMutationResult {
    requireAnyRole(access, MAKER_ROLES, "workpaper upsert")
    val normalizedAnchorCode = normalizeRequired(anchorCode, "anchorCode")
    val normalizedNoteText = normalizeRequired(command.noteText, "noteText")
    if (command.status !in MAKER_ALLOWED_STATUSES) {
      throw WorkpaperBadRequestException("status is not accepted by maker upsert.")
    }

    val controls = controlsAccess.getSnapshot(access, closingFolderId)
    ensureWritable(controls)
    val anchorProjection = workpaperAnchorAccess.getCurrentAnchors(access.tenantId, closingFolderId)
    val anchor = anchorProjection.anchors.find { it.code == normalizedAnchorCode }
      ?: throw WorkpaperConflictException("anchorCode is not part of the current structure.")
    val normalizedEvidences = normalizeEvidenceCommands(command.evidences)
    val existing = workpaperRepository.findByAnchorCode(access.tenantId, closingFolderId, normalizedAnchorCode)

    if (existing == null) {
      val created = newWorkpaper(access, closingFolderId, anchorProjection, anchor, normalizedNoteText, command.status, normalizedEvidences)
      val persisted = workpaperRepository.create(created)
      appendCreatedAudit(access, persisted)
      return WorkpaperMutationResult(persisted.toCurrentItem(anchor), WorkpaperMutationOutcome.CREATED)
    }

    val desired = existing.copy(
      noteText = normalizedNoteText,
      status = command.status,
      evidences = normalizedEvidences.toDomainEvidences(access.tenantId, existing.id, existing.evidences)
    )
    if (existing.sameMakerContentAs(desired)) {
      return WorkpaperMutationResult(existing.toCurrentItem(anchor), WorkpaperMutationOutcome.NOOP)
    }
    if (existing.status !in MAKER_EDITABLE_STATUSES) {
      throw WorkpaperConflictException("workpaper status does not allow maker-side edits.")
    }
    if (!WorkpaperStatusTransitions.isAllowedTransition(existing.status, command.status)) {
      throw WorkpaperConflictException("workpaper status transition is not allowed.")
    }

    val updated = workpaperRepository.update(
      desired.copy(
        updatedAt = OffsetDateTime.now(ZoneOffset.UTC),
        updatedByUserId = access.actorUserId,
        basisImportVersion = anchorProjection.requiredLatestImportVersion(),
        basisTaxonomyVersion = anchorProjection.taxonomyVersion
      )
    )
    appendUpdatedAudit(access, before = existing, after = updated)
    return WorkpaperMutationResult(updated.toCurrentItem(anchor), WorkpaperMutationOutcome.UPDATED)
  }

  @Transactional
  fun reviewDecision(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorCode: String,
    command: WorkpaperReviewDecisionCommand
  ): WorkpaperMutationResult {
    requireAnyRole(access, REVIEWER_ROLES, "workpaper review")
    val normalizedAnchorCode = normalizeRequired(anchorCode, "anchorCode")
    if (command.decision !in REVIEW_ALLOWED_STATUSES) {
      throw WorkpaperBadRequestException("decision is not accepted by review-decision.")
    }
    val normalizedComment = when (command.decision) {
      WorkpaperStatus.CHANGES_REQUESTED -> normalizeRequired(command.comment, "comment")
      WorkpaperStatus.REVIEWED -> normalizeOptional(command.comment)
      else -> throw WorkpaperBadRequestException("decision is not accepted by review-decision.")
    }

    val controls = controlsAccess.getSnapshot(access, closingFolderId)
    ensureWritable(controls)
    val anchorProjection = workpaperAnchorAccess.getCurrentAnchors(access.tenantId, closingFolderId)
    val anchor = anchorProjection.anchors.find { it.code == normalizedAnchorCode }
      ?: throw WorkpaperConflictException("anchorCode is not part of the current structure.")
    val existing = workpaperRepository.findByAnchorCode(access.tenantId, closingFolderId, normalizedAnchorCode)
      ?: throw WorkpaperNotFoundException("workpaper not found for current anchor.")

    val sameStatus = existing.status == command.decision
    val sameComment = existing.reviewComment == normalizedComment
    if (sameStatus && sameComment) {
      return WorkpaperMutationResult(existing.toCurrentItem(anchor), WorkpaperMutationOutcome.NOOP)
    }
    if (!sameStatus && !WorkpaperStatusTransitions.isAllowedTransition(existing.status, command.decision)) {
      throw WorkpaperConflictException("workpaper status transition is not allowed.")
    }
    if (!sameStatus && existing.status != WorkpaperStatus.READY_FOR_REVIEW) {
      throw WorkpaperConflictException("review decisions require READY_FOR_REVIEW.")
    }

    val reviewedAt = OffsetDateTime.now(ZoneOffset.UTC)
    val updated = workpaperRepository.update(
      existing.copy(
        status = command.decision,
        reviewComment = normalizedComment,
        reviewedAt = reviewedAt,
        reviewedByUserId = access.actorUserId,
        updatedAt = reviewedAt,
        updatedByUserId = access.actorUserId
      )
    )
    appendReviewAudit(access, before = existing, after = updated)
    return WorkpaperMutationResult(updated.toCurrentItem(anchor), WorkpaperMutationOutcome.UPDATED)
  }

  private fun newWorkpaper(
    access: TenantAccessContext,
    closingFolderId: UUID,
    anchorProjection: CurrentWorkpaperAnchorProjection,
    anchor: CurrentWorkpaperAnchor,
    noteText: String,
    status: WorkpaperStatus,
    evidences: List<WorkpaperEvidenceCommand>
  ): Workpaper {
    val now = OffsetDateTime.now(ZoneOffset.UTC)
    val workpaperId = UUID.randomUUID()
    return Workpaper(
      id = workpaperId,
      tenantId = access.tenantId,
      closingFolderId = closingFolderId,
      anchorCode = anchor.code,
      anchorLabel = anchor.label,
      summaryBucketCode = anchor.summaryBucketCode,
      statementKind = anchor.statementKind.toDomainStatementKind(),
      breakdownType = anchor.breakdownType.toDomainBreakdownType(),
      noteText = noteText,
      status = status,
      reviewComment = null,
      basisImportVersion = anchorProjection.requiredLatestImportVersion(),
      basisTaxonomyVersion = anchorProjection.taxonomyVersion,
      createdAt = now,
      createdByUserId = access.actorUserId,
      updatedAt = now,
      updatedByUserId = access.actorUserId,
      reviewedAt = null,
      reviewedByUserId = null,
      evidences = evidences.toDomainEvidences(access.tenantId, workpaperId)
    )
  }

  private fun ensureWritable(controls: ClosingControlsSnapshot) {
    if (controls.closingFolderStatus == ClosingFolderAccessStatus.ARCHIVED) {
      throw WorkpaperConflictException("Closing folder is archived and workpapers cannot be modified.")
    }
    if (controls.readiness != ControlsReadiness.READY) {
      throw WorkpaperConflictException("Workpapers can only be modified when the closing is PREVIEW_READY.")
    }
  }

  private fun appendCreatedAudit(access: TenantAccessContext, created: Workpaper) {
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = WORKPAPER_CREATED_ACTION,
        resourceType = WORKPAPER_RESOURCE_TYPE,
        resourceId = created.id.toString(),
        metadata = mapOf(
          "closingFolderId" to created.closingFolderId.toString(),
          "anchorCode" to created.anchorCode,
          "status" to created.status.name,
          "basisImportVersion" to created.basisImportVersion,
          "basisTaxonomyVersion" to created.basisTaxonomyVersion,
          "evidenceCount" to created.evidences.size
        )
      )
    )
  }

  private fun appendUpdatedAudit(access: TenantAccessContext, before: Workpaper, after: Workpaper) {
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = WORKPAPER_UPDATED_ACTION,
        resourceType = WORKPAPER_RESOURCE_TYPE,
        resourceId = after.id.toString(),
        metadata = mapOf(
          "closingFolderId" to after.closingFolderId.toString(),
          "anchorCode" to after.anchorCode,
          "status" to mapOf("before" to before.status.name, "after" to after.status.name),
          "noteText" to mapOf("before" to before.noteText, "after" to after.noteText),
          "basisImportVersion" to mapOf("before" to before.basisImportVersion, "after" to after.basisImportVersion),
          "basisTaxonomyVersion" to mapOf("before" to before.basisTaxonomyVersion, "after" to after.basisTaxonomyVersion),
          "evidenceCount" to mapOf("before" to before.evidences.size, "after" to after.evidences.size)
        )
      )
    )
  }

  private fun appendReviewAudit(access: TenantAccessContext, before: Workpaper, after: Workpaper) {
    auditTrail.append(
      AppendAuditEventCommand(
        tenantId = access.tenantId,
        actorUserId = access.actorUserId,
        actorSubject = access.actorSubject,
        actorRoles = access.effectiveRoles,
        correlation = auditCorrelationContextProvider.currentCorrelationContext(),
        action = WORKPAPER_REVIEW_STATUS_CHANGED_ACTION,
        resourceType = WORKPAPER_RESOURCE_TYPE,
        resourceId = after.id.toString(),
        metadata = mapOf(
          "closingFolderId" to after.closingFolderId.toString(),
          "anchorCode" to after.anchorCode,
          "status" to mapOf("before" to before.status.name, "after" to after.status.name),
          "reviewComment" to mapOf("before" to before.reviewComment, "after" to after.reviewComment),
          "reviewedAt" to after.reviewedAt?.toString(),
          "reviewedByUserId" to after.reviewedByUserId?.toString()
        )
      )
    )
  }

  private fun normalizeEvidenceCommands(evidences: List<WorkpaperEvidenceCommand>): List<WorkpaperEvidenceCommand> {
    val normalized = evidences.map { evidence ->
      WorkpaperEvidenceCommand(
        position = evidence.position,
        fileName = normalizeRequired(evidence.fileName, "evidences.fileName"),
        mediaType = normalizeRequired(evidence.mediaType, "evidences.mediaType").lowercase(),
        documentDate = evidence.documentDate,
        sourceLabel = normalizeRequired(evidence.sourceLabel, "evidences.sourceLabel"),
        verificationStatus = evidence.verificationStatus,
        externalReference = normalizeOptional(evidence.externalReference),
        checksumSha256 = normalizeChecksum(evidence.checksumSha256)
      )
    }.sortedBy { it.position }

    if (normalized.any { it.position <= 0 }) {
      throw WorkpaperBadRequestException("evidences.position must be greater than 0.")
    }
    if (normalized.groupBy { it.position }.any { (_, samePositions) -> samePositions.size > 1 }) {
      throw WorkpaperBadRequestException("evidences.position must be unique.")
    }
    return normalized
  }

  private fun normalizeChecksum(rawValue: String?): String? {
    val normalized = normalizeOptional(rawValue)?.lowercase() ?: return null
    if (!normalized.matches(CHECKSUM_PATTERN)) {
      throw WorkpaperBadRequestException("evidences.checksumSha256 must be a 64-character lowercase hex SHA-256.")
    }
    return normalized
  }

  private fun requireAnyRole(access: TenantAccessContext, allowedRoles: Set<String>, operation: String) {
    if (access.effectiveRoles.none { it in allowedRoles }) {
      throw AccessDeniedException("Insufficient role for $operation.")
    }
  }

  private fun normalizeRequired(rawValue: String?, fieldName: String): String =
    rawValue?.trim()?.takeUnless { it.isEmpty() }
      ?: throw WorkpaperBadRequestException("$fieldName must not be blank.")

  private fun normalizeOptional(rawValue: String?): String? =
    rawValue?.trim()?.takeUnless { it.isEmpty() }

  private fun List<WorkpaperEvidenceCommand>.toDomainEvidences(
    tenantId: UUID,
    workpaperId: UUID,
    existing: List<WorkpaperEvidence> = emptyList()
  ): List<WorkpaperEvidence> {
    val existingByPosition = existing.associateBy { it.position }
    return map { evidence ->
      WorkpaperEvidence(
        id = existingByPosition[evidence.position]?.id ?: UUID.randomUUID(),
        tenantId = tenantId,
        workpaperId = workpaperId,
        position = evidence.position,
        fileName = evidence.fileName,
        mediaType = evidence.mediaType,
        documentDate = evidence.documentDate,
        sourceLabel = evidence.sourceLabel,
        verificationStatus = evidence.verificationStatus,
        externalReference = evidence.externalReference,
        checksumSha256 = evidence.checksumSha256
      )
    }
  }

  private fun Workpaper.sameMakerContentAs(other: Workpaper): Boolean =
    noteText == other.noteText &&
      status == other.status &&
      evidences == other.evidences

  private fun Workpaper.toCurrentItem(anchor: CurrentWorkpaperAnchor): WorkpaperItem =
    WorkpaperItem(
      anchorCode = anchor.code,
      anchorLabel = anchor.label,
      summaryBucketCode = anchor.summaryBucketCode,
      statementKind = anchor.statementKind.name,
      breakdownType = anchor.breakdownType.name,
      isCurrentStructure = true,
      workpaper = toDetails()
    )

  private fun Workpaper.toDetails(): WorkpaperDetails =
    WorkpaperDetails(
      id = id,
      noteText = noteText,
      status = status,
      reviewComment = reviewComment,
      basisImportVersion = basisImportVersion,
      basisTaxonomyVersion = basisTaxonomyVersion,
      createdAt = createdAt,
      createdByUserId = createdByUserId,
      updatedAt = updatedAt,
      updatedByUserId = updatedByUserId,
      reviewedAt = reviewedAt,
      reviewedByUserId = reviewedByUserId,
      evidences = evidences
        .sortedBy { it.position }
        .map {
          WorkpaperEvidenceDetails(
            id = it.id,
            position = it.position,
            fileName = it.fileName,
            mediaType = it.mediaType,
            documentDate = it.documentDate,
            sourceLabel = it.sourceLabel,
            verificationStatus = it.verificationStatus,
            externalReference = it.externalReference,
            checksumSha256 = it.checksumSha256
          )
        }
    )

  private fun ControlsBlocker.toBlocker(): WorkpaperBlocker =
    WorkpaperBlocker(code = code, message = message)

  private fun ControlsNextActionView.toNextAction(): WorkpaperNextAction =
    WorkpaperNextAction(code = code.name, path = path, actionable = actionable)

  private fun CurrentWorkpaperStatementKind.toDomainStatementKind(): WorkpaperStatementKind =
    when (this) {
      CurrentWorkpaperStatementKind.BALANCE_SHEET -> WorkpaperStatementKind.BALANCE_SHEET
      CurrentWorkpaperStatementKind.INCOME_STATEMENT -> WorkpaperStatementKind.INCOME_STATEMENT
    }

  private fun CurrentWorkpaperBreakdownType.toDomainBreakdownType(): WorkpaperBreakdownType =
    when (this) {
      CurrentWorkpaperBreakdownType.SECTION -> WorkpaperBreakdownType.SECTION
      CurrentWorkpaperBreakdownType.LEGACY_BUCKET_FALLBACK -> WorkpaperBreakdownType.LEGACY_BUCKET_FALLBACK
    }

  private fun CurrentWorkpaperAnchorProjection.requiredLatestImportVersion(): Int =
    latestImportVersion ?: throw WorkpaperConflictException("latestImportVersion is required to modify workpapers.")

  companion object {
    private val READ_ROLES = setOf("ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN")
    private val MAKER_ROLES = setOf("ACCOUNTANT", "MANAGER", "ADMIN")
    private val REVIEWER_ROLES = setOf("REVIEWER", "MANAGER", "ADMIN")
    private val MAKER_EDITABLE_STATUSES = setOf(WorkpaperStatus.DRAFT, WorkpaperStatus.CHANGES_REQUESTED)
    private val MAKER_ALLOWED_STATUSES = setOf(WorkpaperStatus.DRAFT, WorkpaperStatus.READY_FOR_REVIEW)
    private val REVIEW_ALLOWED_STATUSES = setOf(WorkpaperStatus.CHANGES_REQUESTED, WorkpaperStatus.REVIEWED)
    private val CHECKSUM_PATTERN = Regex("^[0-9a-f]{64}$")
    private val SUMMARY_BUCKET_ORDER = listOf("BS.ASSET", "BS.LIABILITY", "BS.EQUITY", "PL.REVENUE", "PL.EXPENSE")
  }
}

object WorkpaperStatusTransitions {
  private val allowedTransitions = setOf(
    WorkpaperStatus.DRAFT to WorkpaperStatus.READY_FOR_REVIEW,
    WorkpaperStatus.READY_FOR_REVIEW to WorkpaperStatus.CHANGES_REQUESTED,
    WorkpaperStatus.READY_FOR_REVIEW to WorkpaperStatus.REVIEWED,
    WorkpaperStatus.CHANGES_REQUESTED to WorkpaperStatus.DRAFT,
    WorkpaperStatus.CHANGES_REQUESTED to WorkpaperStatus.READY_FOR_REVIEW
  )

  fun isAllowedTransition(from: WorkpaperStatus, to: WorkpaperStatus): Boolean =
    (from to to) in allowedTransitions
}

@ResponseStatus(HttpStatus.BAD_REQUEST)
class WorkpaperBadRequestException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.CONFLICT)
class WorkpaperConflictException(message: String) : RuntimeException(message)

@ResponseStatus(HttpStatus.NOT_FOUND)
class WorkpaperNotFoundException(message: String) : RuntimeException(message)
