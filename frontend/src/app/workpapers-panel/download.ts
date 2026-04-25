import type { WorkpaperDocument } from "../../lib/api/workpapers";

export function triggerDocumentDownload(
  rawBlob: Blob,
  resolvedMediaType: string | null,
  resolvedFileName: string
) {
  const typedBlob =
    resolvedMediaType !== null && rawBlob.type === ""
      ? new Blob([rawBlob], { type: resolvedMediaType })
      : rawBlob;
  const objectUrl = URL.createObjectURL(typedBlob);
  const link = document.createElement("a");

  try {
    link.href = objectUrl;
    link.download = resolvedFileName;
    document.body.append(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }
}

export function resolveDocumentDownloadFileName(
  contentDisposition: string | null,
  fallbackFileName: string | null,
  documentId: string
) {
  const contentDispositionFileName =
    parseContentDispositionFilenameStar(contentDisposition) ??
    parseContentDispositionFilename(contentDisposition);

  if (contentDispositionFileName !== null) {
    return contentDispositionFileName;
  }

  if (fallbackFileName !== null) {
    return fallbackFileName;
  }

  return `document-${documentId}`;
}

export function resolveDocumentDownloadMediaType(
  contentType: string | null,
  fallbackMediaType: string | null
) {
  return normalizeNonEmptyString(contentType) ?? normalizeNonEmptyString(fallbackMediaType);
}

export function getFallbackDocumentFileName(document: WorkpaperDocument) {
  return normalizeNonEmptyString(document.fileName);
}

export function getFallbackDocumentMediaType(document: WorkpaperDocument) {
  return normalizeNonEmptyString(document.mediaType);
}

export function parseContentDispositionFilenameStar(value: string | null) {
  if (value === null) {
    return null;
  }

  const match = value.match(/filename\*\s*=\s*([^;]+)/i);

  if (match?.[1] === undefined) {
    return null;
  }

  const rawValue = stripWrappedQuotes(match[1].trim());
  const separatorIndex = rawValue.indexOf("''");

  if (separatorIndex < 0) {
    return null;
  }

  const encodedFileName = rawValue.slice(separatorIndex + 2);

  try {
    return normalizeNonEmptyString(decodeURIComponent(encodedFileName));
  } catch {
    return null;
  }
}

export function parseContentDispositionFilename(value: string | null) {
  if (value === null) {
    return null;
  }

  const match = value.match(/filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i);

  if (match?.[1] === undefined) {
    return null;
  }

  return normalizeNonEmptyString(unescapeQuotedString(stripWrappedQuotes(match[1].trim())));
}

export function stripWrappedQuotes(value: string) {
  if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) {
    return value.slice(1, -1);
  }

  return value;
}

export function unescapeQuotedString(value: string) {
  return value.replace(/\\(.)/g, "$1");
}

export function normalizeNonEmptyString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
