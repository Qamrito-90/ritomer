package ch.qamwaq.ritomer.exports.infrastructure.storage

import ch.qamwaq.ritomer.exports.application.ExportPackContent
import ch.qamwaq.ritomer.exports.application.ExportPackStorage
import ch.qamwaq.ritomer.exports.application.StoreExportPackCommand
import ch.qamwaq.ritomer.exports.application.StoredExportPackObject
import com.google.cloud.storage.BlobId
import com.google.cloud.storage.BlobInfo
import com.google.cloud.storage.Storage
import java.nio.channels.Channels
import java.security.MessageDigest
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component

@Component
@ConditionalOnProperty(
  prefix = "ritomer.workpapers.documents.storage",
  name = ["backend"],
  havingValue = "GCS"
)
class GcsExportPackStorage(
  private val storage: Storage,
  @Value("\${ritomer.workpapers.documents.storage.gcs.bucket}")
  private val bucketName: String
) : ExportPackStorage {
  override fun storageBackendCode(): String = GCS_BACKEND

  override fun store(command: StoreExportPackCommand): StoredExportPackObject {
    val blobId = BlobId.of(bucketName, command.objectKey)
    val blobInfo = BlobInfo.newBuilder(blobId)
      .setContentType(command.mediaType)
      .build()
    val digest = MessageDigest.getInstance("SHA-256")
    var byteCount = 0L

    storage.writer(blobInfo).use { writer ->
      Channels.newOutputStream(writer).use { outputStream ->
        command.inputStream.use { inputStream ->
          val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
          while (true) {
            val read = inputStream.read(buffer)
            if (read < 0) {
              break
            }
            outputStream.write(buffer, 0, read)
            digest.update(buffer, 0, read)
            byteCount += read.toLong()
          }
        }
      }
    }

    return StoredExportPackObject(
      storageBackend = storageBackendCode(),
      storageObjectKey = command.objectKey,
      mediaType = command.mediaType,
      byteSize = byteCount,
      checksumSha256 = digest.digest().toHexLowercase()
    )
  }

  override fun open(objectKey: String): ExportPackContent =
    ExportPackContent(
      inputStream = Channels.newInputStream(storage.reader(bucketName, objectKey))
    )

  override fun deleteIfExists(objectKey: String) {
    storage.delete(bucketName, objectKey)
  }

  companion object {
    private const val GCS_BACKEND = "GCS"
  }
}
