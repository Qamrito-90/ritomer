package ch.qamwaq.ritomer.identity.api

import ch.qamwaq.ritomer.ClosingFolderTestStore
import ch.qamwaq.ritomer.DocumentTestStore
import ch.qamwaq.ritomer.ExportPackTestStore
import ch.qamwaq.ritomer.IdentityTestConfiguration
import ch.qamwaq.ritomer.WorkpaperTestStore
import ch.qamwaq.ritomer.closing.domain.ClosingFolder
import ch.qamwaq.ritomer.closing.domain.ClosingFolderStatus
import ch.qamwaq.ritomer.exports.api.ExportPacksController
import ch.qamwaq.ritomer.exports.application.ExportPackService
import ch.qamwaq.ritomer.exports.application.StoreExportPackCommand
import ch.qamwaq.ritomer.exports.domain.ExportPack
import ch.qamwaq.ritomer.exports.infrastructure.storage.LocalFileSystemExportPackStorage
import ch.qamwaq.ritomer.identity.access.CurrentTenantAccessResolver
import ch.qamwaq.ritomer.shared.application.AuditCorrelationContextProvider
import ch.qamwaq.ritomer.shared.application.AuditTrail
import ch.qamwaq.ritomer.workpapers.api.DocumentsController
import ch.qamwaq.ritomer.workpapers.application.DocumentService
import ch.qamwaq.ritomer.workpapers.application.StoreBinaryObjectCommand
import ch.qamwaq.ritomer.workpapers.domain.*
import ch.qamwaq.ritomer.workpapers.infrastructure.storage.LocalFileSystemBinaryObjectStore
import com.fasterxml.jackson.databind.ObjectMapper
import java.time.LocalDate
import java.time.OffsetDateTime
import java.util.UUID
import org.mockito.Mockito
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.core.env.Environment

@TestConfiguration(proxyBeanMethods = false)
@Import(CurrentTenantAccessResolver::class, DocumentsController::class, ExportPacksController::class)
class BrowserQualificationFiles(env: Environment) {
  private val folders = ClosingFolderTestStore()
  private val papers = WorkpaperTestStore()
  private val documents = DocumentTestStore()
  private val exports = ExportPackTestStore()
  private val factories = IdentityTestConfiguration()
  private val binaries = LocalFileSystemBinaryObjectStore(env.getRequiredProperty("m12.test.files"))
  private val archives = LocalFileSystemExportPackStorage(env.getRequiredProperty("m12.test.files"))

  // Only GETs are exercised. Any call into a write-side collaborator fails the test.
  private inline fun <reified T> unused(): T = Mockito.mock(T::class.java) { error("UNEXPECTED_BUSINESS_OPERATION") }

  @Bean fun documentReads(audit: AuditTrail, context: AuditCorrelationContextProvider) =
    DocumentService(unused(), unused(), factories.workpaperRepository(papers), factories.documentRepository(documents, papers),
      binaries, audit, context, unused())

  @Bean fun exportReads(audit: AuditTrail, context: AuditCorrelationContextProvider) =
    ExportPackService(factories.closingFolderAccess(folders), unused(), unused(), unused(), unused(),
      factories.exportPackRepository(exports), archives, ObjectMapper(), audit, context, unused())

  fun seed(label: String, tenant: UUID, actor: UUID): Map<String, String> {
    val now = OffsetDateTime.now()
    val day = LocalDate.now()
    val folder = UUID.randomUUID()
    val paper = UUID.randomUUID()
    val doc = UUID.randomUUID()
    val pack = UUID.randomUUID()
    folders.save(ClosingFolder(folder,tenant,label,day,day,null,ClosingFolderStatus.DRAFT,null,null,now,now))
    papers.save(Workpaper(paper,tenant,folder,label,label,label,WorkpaperStatementKind.BALANCE_SHEET,
      WorkpaperBreakdownType.SECTION,"",WorkpaperStatus.DRAFT,null,1,1,now,actor,now,actor,null,null,emptyList()))
    val content = binaries.store(StoreBinaryObjectCommand("docs/$doc","text/plain","document-$label".byteInputStream()))
    documents.save(Document(doc,tenant,paper,content.storageBackend,content.storageObjectKey,"piece.txt","text/plain",
      content.byteSize,content.checksumSha256,label,day,now,actor))
    val archive = archives.store(StoreExportPackCommand("exports/$pack","application/zip","export-$label".byteInputStream()))
    exports.create(ExportPack(pack,tenant,folder,label,label,archive.storageBackend,archive.storageObjectKey,
      "export.zip","application/zip",archive.byteSize,archive.checksumSha256,1,1,now,actor))
    return mapOf("folder" to folder.toString(), "document" to doc.toString(), "export" to pack.toString(),
      "documentSha" to content.checksumSha256, "exportSha" to archive.checksumSha256,
      "documentSize" to content.byteSize.toString(), "exportSize" to archive.byteSize.toString())
  }
}
