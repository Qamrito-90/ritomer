import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkpaperDocument } from "../../lib/api/workpapers";
import {
  getFallbackDocumentFileName,
  getFallbackDocumentMediaType,
  normalizeNonEmptyString,
  parseContentDispositionFilename,
  parseContentDispositionFilenameStar,
  resolveDocumentDownloadFileName,
  resolveDocumentDownloadMediaType,
  stripWrappedQuotes,
  triggerDocumentDownload,
  unescapeQuotedString
} from "./download";

const DOCUMENT_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";

function createDocument(overrides: Partial<WorkpaperDocument> = {}): WorkpaperDocument {
  return {
    id: DOCUMENT_ID,
    fileName: "support.pdf",
    mediaType: "application/pdf",
    sourceLabel: "ERP",
    verificationStatus: "UNVERIFIED",
    reviewComment: null,
    ...overrides
  };
}

describe("workpapers-panel download helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses Content-Disposition filename variants without inventing names", () => {
    expect(
      parseContentDispositionFilenameStar("attachment; filename*=UTF-8''support%20audit.pdf")
    ).toBe("support audit.pdf");
    expect(parseContentDispositionFilenameStar("attachment; filename*=UTF-8''%E0%A4%A")).toBe(
      null
    );
    expect(parseContentDispositionFilename('attachment; filename="support \\"audit\\".pdf"')).toBe(
      'support "audit".pdf'
    );
    expect(parseContentDispositionFilename("attachment; filename=plain.csv")).toBe("plain.csv");
    expect(stripWrappedQuotes('"support.pdf"')).toBe("support.pdf");
    expect(unescapeQuotedString('support \\"audit\\".pdf')).toBe('support "audit".pdf');
  });

  it("resolves download filename and MIME fallbacks in the existing priority order", () => {
    expect(
      resolveDocumentDownloadFileName(
        "attachment; filename*=UTF-8''support%20audit.pdf",
        "fallback.pdf",
        DOCUMENT_ID
      )
    ).toBe("support audit.pdf");
    expect(resolveDocumentDownloadFileName(null, " fallback.pdf ", DOCUMENT_ID)).toBe(
      " fallback.pdf "
    );
    expect(resolveDocumentDownloadFileName(null, null, DOCUMENT_ID)).toBe(
      `document-${DOCUMENT_ID}`
    );
    expect(resolveDocumentDownloadMediaType(" application/pdf ", "text/csv")).toBe(
      "application/pdf"
    );
    expect(resolveDocumentDownloadMediaType(" ", " text/csv ")).toBe("text/csv");
    expect(resolveDocumentDownloadMediaType(null, " ")).toBe(null);
  });

  it("normalizes fallback values from the visible document metadata", () => {
    expect(getFallbackDocumentFileName(createDocument({ fileName: " support.pdf " }))).toBe(
      "support.pdf"
    );
    expect(getFallbackDocumentFileName(createDocument({ fileName: " " }))).toBe(null);
    expect(getFallbackDocumentMediaType(createDocument({ mediaType: " application/pdf " }))).toBe(
      "application/pdf"
    );
    expect(normalizeNonEmptyString(undefined)).toBe(null);
  });

  it("triggers a browser download through an object URL and cleans it up", () => {
    const createObjectUrl = vi.fn<(blob: Blob) => string>(() => "blob:ritomer");
    const revokeObjectUrl = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrl
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrl
    });

    try {
      triggerDocumentDownload(new Blob(["content"]), "application/pdf", "support.pdf");
    } finally {
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: originalCreateObjectUrl
      });
      Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: originalRevokeObjectUrl
      });
    }

    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(createObjectUrl.mock.calls[0]?.[0]).toBeInstanceOf(Blob);
    expect((createObjectUrl.mock.calls[0]?.[0] as Blob).type).toBe("application/pdf");
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:ritomer");
  });
});
