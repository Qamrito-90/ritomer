package ch.qamwaq.ritomer.workpapers.infrastructure.storage

import ch.qamwaq.ritomer.workpapers.application.BinaryObjectContent
import ch.qamwaq.ritomer.workpapers.application.BinaryObjectStore
import ch.qamwaq.ritomer.workpapers.application.StoreBinaryObjectCommand
import ch.qamwaq.ritomer.workpapers.application.StoredBinaryObject
import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
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
class GcsBinaryObjectStore(
  private val storage: Storage,
  @Value("\${ritomer.workpapers.documents.storage.gcs.bucket}")
  private val bucketName: String
) : BinaryObjectStore {
  override fun storageBackend(): DocumentStorageBackend = DocumentStorageBackend.GCS

  override fun store(command: StoreBinaryObjectCommand): StoredBinaryObject {
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

    return StoredBinaryObject(
      storageBackend = storageBackend(),
      storageObjectKey = command.objectKey,
      mediaType = command.mediaType,
      byteSize = byteCount,
      checksumSha256 = digest.digest().toHexLowercase()
    )
  }

  override fun open(objectKey: String): BinaryObjectContent =
    BinaryObjectContent(
      inputStream = Channels.newInputStream(storage.reader(bucketName, objectKey))
    )

  override fun deleteIfExists(objectKey: String) {
    storage.delete(bucketName, objectKey)
  }
}
