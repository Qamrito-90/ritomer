package ch.qamwaq.ritomer.workpapers.infrastructure.persistence

import ch.qamwaq.ritomer.workpapers.application.WorkpaperRepository
import ch.qamwaq.ritomer.workpapers.domain.Workpaper
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperBreakdownType
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidence
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperEvidenceVerificationStatus
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatementKind
import ch.qamwaq.ritomer.workpapers.domain.WorkpaperStatus
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.springframework.context.annotation.Profile
import org.springframework.jdbc.core.RowMapper
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository

@Repository
@Profile("!test")
class JdbcWorkpaperRepository(
  private val jdbcClient: JdbcClient
) : WorkpaperRepository {
  override fun findByClosingFolder(tenantId: UUID, closingFolderId: UUID): List<Workpaper> {
    val workpapers = jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             anchor_code,
             anchor_label,
             summary_bucket_code,
             statement_kind,
             breakdown_type,
             note_text,
             status,
             review_comment,
             basis_import_version,
             basis_taxonomy_version,
             created_at,
             created_by_user_id,
             updated_at,
             updated_by_user_id,
             reviewed_at,
             reviewed_by_user_id
      from workpaper
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
      order by anchor_code asc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .query(WORKPAPER_ROW_MAPPER)
      .list()

    if (workpapers.isEmpty()) {
      return emptyList()
    }

    val evidencesByWorkpaperId = queryEvidencesByClosingFolder(tenantId, closingFolderId)
    return workpapers.map { workpaper -> workpaper.copy(evidences = evidencesByWorkpaperId[workpaper.id].orEmpty()) }
  }

  override fun findByAnchorCode(tenantId: UUID, closingFolderId: UUID, anchorCode: String): Workpaper? {
    val workpaper = jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             anchor_code,
             anchor_label,
             summary_bucket_code,
             statement_kind,
             breakdown_type,
             note_text,
             status,
             review_comment,
             basis_import_version,
             basis_taxonomy_version,
             created_at,
             created_by_user_id,
             updated_at,
             updated_by_user_id,
             reviewed_at,
             reviewed_by_user_id
      from workpaper
      where tenant_id = :tenantId
        and closing_folder_id = :closingFolderId
        and anchor_code = :anchorCode
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .param("anchorCode", anchorCode)
      .query(WORKPAPER_ROW_MAPPER)
      .optional()
      .orElse(null)
      ?: return null

    return workpaper.copy(evidences = queryEvidencesByWorkpaperId(tenantId, workpaper.id))
  }

  override fun findById(tenantId: UUID, workpaperId: UUID): Workpaper? {
    val workpaper = jdbcClient.sql(
      """
      select id,
             tenant_id,
             closing_folder_id,
             anchor_code,
             anchor_label,
             summary_bucket_code,
             statement_kind,
             breakdown_type,
             note_text,
             status,
             review_comment,
             basis_import_version,
             basis_taxonomy_version,
             created_at,
             created_by_user_id,
             updated_at,
             updated_by_user_id,
             reviewed_at,
             reviewed_by_user_id
      from workpaper
      where tenant_id = :tenantId
        and id = :workpaperId
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("workpaperId", workpaperId)
      .query(WORKPAPER_ROW_MAPPER)
      .optional()
      .orElse(null)
      ?: return null

    return workpaper.copy(evidences = queryEvidencesByWorkpaperId(tenantId, workpaper.id))
  }

  override fun create(workpaper: Workpaper): Workpaper {
    jdbcClient.sql(
      """
      insert into workpaper (
        id,
        tenant_id,
        closing_folder_id,
        anchor_code,
        anchor_label,
        summary_bucket_code,
        statement_kind,
        breakdown_type,
        note_text,
        status,
        review_comment,
        basis_import_version,
        basis_taxonomy_version,
        created_at,
        created_by_user_id,
        updated_at,
        updated_by_user_id,
        reviewed_at,
        reviewed_by_user_id
      ) values (
        :id,
        :tenantId,
        :closingFolderId,
        :anchorCode,
        :anchorLabel,
        :summaryBucketCode,
        :statementKind,
        :breakdownType,
        :noteText,
        :status,
        :reviewComment,
        :basisImportVersion,
        :basisTaxonomyVersion,
        :createdAt,
        :createdByUserId,
        :updatedAt,
        :updatedByUserId,
        :reviewedAt,
        :reviewedByUserId
      )
      """.trimIndent()
    )
      .withWorkpaper(workpaper)
      .update()

    replaceEvidences(workpaper)
    return workpaper
  }

  override fun update(workpaper: Workpaper): Workpaper {
    jdbcClient.sql(
      """
      update workpaper
      set anchor_label = :anchorLabel,
          summary_bucket_code = :summaryBucketCode,
          statement_kind = :statementKind,
          breakdown_type = :breakdownType,
          note_text = :noteText,
          status = :status,
          review_comment = :reviewComment,
          basis_import_version = :basisImportVersion,
          basis_taxonomy_version = :basisTaxonomyVersion,
          updated_at = :updatedAt,
          updated_by_user_id = :updatedByUserId,
          reviewed_at = :reviewedAt,
          reviewed_by_user_id = :reviewedByUserId
      where tenant_id = :tenantId
        and id = :id
      """.trimIndent()
    )
      .withWorkpaper(workpaper)
      .update()

    replaceEvidences(workpaper)
    return workpaper
  }

  private fun replaceEvidences(workpaper: Workpaper) {
    jdbcClient.sql(
      """
      delete from workpaper_evidence
      where tenant_id = :tenantId
        and workpaper_id = :workpaperId
      """.trimIndent()
    )
      .param("tenantId", workpaper.tenantId)
      .param("workpaperId", workpaper.id)
      .update()

    workpaper.evidences.sortedBy { it.position }.forEach { evidence ->
      jdbcClient.sql(
        """
        insert into workpaper_evidence (
          id,
          tenant_id,
          workpaper_id,
          position,
          file_name,
          media_type,
          document_date,
          source_label,
          verification_status,
          external_reference,
          checksum_sha256
        ) values (
          :id,
          :tenantId,
          :workpaperId,
          :position,
          :fileName,
          :mediaType,
          :documentDate,
          :sourceLabel,
          :verificationStatus,
          :externalReference,
          :checksumSha256
        )
        """.trimIndent()
      )
        .param("id", evidence.id)
        .param("tenantId", evidence.tenantId)
        .param("workpaperId", evidence.workpaperId)
        .param("position", evidence.position)
        .param("fileName", evidence.fileName)
        .param("mediaType", evidence.mediaType)
        .param("documentDate", evidence.documentDate)
        .param("sourceLabel", evidence.sourceLabel)
        .param("verificationStatus", evidence.verificationStatus.name)
        .param("externalReference", evidence.externalReference)
        .param("checksumSha256", evidence.checksumSha256)
        .update()
    }
  }

  private fun queryEvidencesByClosingFolder(tenantId: UUID, closingFolderId: UUID): Map<UUID, List<WorkpaperEvidence>> =
    jdbcClient.sql(
      """
      select e.id,
             e.tenant_id,
             e.workpaper_id,
             e.position,
             e.file_name,
             e.media_type,
             e.document_date,
             e.source_label,
             e.verification_status,
             e.external_reference,
             e.checksum_sha256
      from workpaper_evidence e
      join workpaper w
        on w.id = e.workpaper_id
       and w.tenant_id = e.tenant_id
      where w.tenant_id = :tenantId
        and w.closing_folder_id = :closingFolderId
      order by e.workpaper_id asc, e.position asc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("closingFolderId", closingFolderId)
      .query(WORKPAPER_EVIDENCE_ROW_MAPPER)
      .list()
      .groupBy { it.workpaperId }

  private fun queryEvidencesByWorkpaperId(tenantId: UUID, workpaperId: UUID): List<WorkpaperEvidence> =
    jdbcClient.sql(
      """
      select id,
             tenant_id,
             workpaper_id,
             position,
             file_name,
             media_type,
             document_date,
             source_label,
             verification_status,
             external_reference,
             checksum_sha256
      from workpaper_evidence
      where tenant_id = :tenantId
        and workpaper_id = :workpaperId
      order by position asc
      """.trimIndent()
    )
      .param("tenantId", tenantId)
      .param("workpaperId", workpaperId)
      .query(WORKPAPER_EVIDENCE_ROW_MAPPER)
      .list()

  companion object {
    private val WORKPAPER_ROW_MAPPER = RowMapper<Workpaper> { rs, _ ->
      Workpaper(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        closingFolderId = rs.getObject("closing_folder_id", UUID::class.java),
        anchorCode = rs.getString("anchor_code"),
        anchorLabel = rs.getString("anchor_label"),
        summaryBucketCode = rs.getString("summary_bucket_code"),
        statementKind = WorkpaperStatementKind.valueOf(rs.getString("statement_kind")),
        breakdownType = WorkpaperBreakdownType.valueOf(rs.getString("breakdown_type")),
        noteText = rs.getString("note_text"),
        status = WorkpaperStatus.valueOf(rs.getString("status")),
        reviewComment = rs.getString("review_comment"),
        basisImportVersion = rs.getInt("basis_import_version"),
        basisTaxonomyVersion = rs.getInt("basis_taxonomy_version"),
        createdAt = rs.getObject("created_at", OffsetDateTime::class.java),
        createdByUserId = rs.getObject("created_by_user_id", UUID::class.java),
        updatedAt = rs.getObject("updated_at", OffsetDateTime::class.java),
        updatedByUserId = rs.getObject("updated_by_user_id", UUID::class.java),
        reviewedAt = rs.getObject("reviewed_at", OffsetDateTime::class.java),
        reviewedByUserId = rs.getObject("reviewed_by_user_id", UUID::class.java),
        evidences = emptyList()
      )
    }

    private val WORKPAPER_EVIDENCE_ROW_MAPPER = RowMapper<WorkpaperEvidence> { rs, _ ->
      WorkpaperEvidence(
        id = rs.getObject("id", UUID::class.java),
        tenantId = rs.getObject("tenant_id", UUID::class.java),
        workpaperId = rs.getObject("workpaper_id", UUID::class.java),
        position = rs.getInt("position"),
        fileName = rs.getString("file_name"),
        mediaType = rs.getString("media_type"),
        documentDate = rs.getObject("document_date", LocalDate::class.java),
        sourceLabel = rs.getString("source_label"),
        verificationStatus = WorkpaperEvidenceVerificationStatus.valueOf(rs.getString("verification_status")),
        externalReference = rs.getString("external_reference"),
        checksumSha256 = rs.getString("checksum_sha256"),
      )
    }
  }
}

private fun JdbcClient.StatementSpec.withWorkpaper(workpaper: Workpaper): JdbcClient.StatementSpec =
  param("id", workpaper.id)
    .param("tenantId", workpaper.tenantId)
    .param("closingFolderId", workpaper.closingFolderId)
    .param("anchorCode", workpaper.anchorCode)
    .param("anchorLabel", workpaper.anchorLabel)
    .param("summaryBucketCode", workpaper.summaryBucketCode)
    .param("statementKind", workpaper.statementKind.name)
    .param("breakdownType", workpaper.breakdownType.name)
    .param("noteText", workpaper.noteText)
    .param("status", workpaper.status.name)
    .param("reviewComment", workpaper.reviewComment)
    .param("basisImportVersion", workpaper.basisImportVersion)
    .param("basisTaxonomyVersion", workpaper.basisTaxonomyVersion)
    .param("createdAt", workpaper.createdAt)
    .param("createdByUserId", workpaper.createdByUserId)
    .param("updatedAt", workpaper.updatedAt)
    .param("updatedByUserId", workpaper.updatedByUserId)
    .param("reviewedAt", workpaper.reviewedAt)
    .param("reviewedByUserId", workpaper.reviewedByUserId)
