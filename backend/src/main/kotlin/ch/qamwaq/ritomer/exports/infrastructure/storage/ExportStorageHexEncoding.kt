package ch.qamwaq.ritomer.exports.infrastructure.storage

internal fun ByteArray.toHexLowercase(): String =
  joinToString(separator = "") { eachByte -> "%02x".format(eachByte) }
