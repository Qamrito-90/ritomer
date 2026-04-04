package ch.qamwaq.ritomer.workpapers.application

import ch.qamwaq.ritomer.workpapers.domain.DocumentStorageBackend
import java.io.InputStream

data class StoreBinaryObjectCommand(
  val objectKey: String,
  val mediaType: String,
  val inputStream: InputStream
)

data class StoredBinaryObject(
  val storageBackend: DocumentStorageBackend,
  val storageObjectKey: String,
  val mediaType: String,
  val byteSize: Long,
  val checksumSha256: String
)

data class BinaryObjectContent(
  val inputStream: InputStream
)

interface BinaryObjectStore {
  fun storageBackend(): DocumentStorageBackend

  fun store(command: StoreBinaryObjectCommand): StoredBinaryObject

  fun open(objectKey: String): BinaryObjectContent

  fun deleteIfExists(objectKey: String)
}
