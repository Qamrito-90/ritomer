import type {
  DocumentVerificationDecision,
  MakerWorkpaperStatus
} from "../../lib/api/workpapers";

export type WorkpaperDraft = {
  noteText: string;
  status: MakerWorkpaperStatus;
};

export type DocumentUploadDraft = {
  file: File | null;
  selectedFileCount: number;
  sourceLabel: string;
  documentDate: string;
};

export type DocumentDecisionDraft = {
  decision: DocumentVerificationDecision;
  comment: string;
};

export type WorkpaperMutationState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; refreshFailed: boolean }
  | { kind: "read_only_archived" }
  | { kind: "read_only_not_ready" }
  | { kind: "read_only_role" }
  | { kind: "stale_read_only" }
  | { kind: "item_read_only" }
  | { kind: "invalid_workpaper" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_not_ready" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "invalid_workpapers_payload" }
  | { kind: "unexpected" };

export type DocumentUploadState =
  | { kind: "idle" }
  | { kind: "submitting"; anchorCode: string }
  | { kind: "success"; anchorCode: string; refreshFailed: boolean }
  | { kind: "bad_request"; anchorCode: string }
  | { kind: "bad_request_invalid_media_type"; anchorCode: string }
  | { kind: "bad_request_empty_file"; anchorCode: string }
  | { kind: "bad_request_source_required"; anchorCode: string }
  | { kind: "auth_required"; anchorCode: string }
  | { kind: "forbidden"; anchorCode: string }
  | { kind: "not_found"; anchorCode: string }
  | { kind: "conflict_archived"; anchorCode: string }
  | { kind: "conflict_not_ready"; anchorCode: string }
  | { kind: "conflict_stale"; anchorCode: string }
  | { kind: "conflict_workpaper_read_only"; anchorCode: string }
  | { kind: "conflict_other"; anchorCode: string }
  | { kind: "payload_too_large"; anchorCode: string }
  | { kind: "server_error"; anchorCode: string }
  | { kind: "network_error"; anchorCode: string }
  | { kind: "timeout"; anchorCode: string }
  | { kind: "invalid_payload"; anchorCode: string }
  | { kind: "unexpected"; anchorCode: string };

export type DocumentDownloadState =
  | { kind: "idle" }
  | { kind: "local_invalid"; documentId: string }
  | { kind: "submitting"; documentId: string }
  | { kind: "auth_required"; documentId: string }
  | { kind: "forbidden"; documentId: string }
  | { kind: "not_found"; documentId: string }
  | { kind: "server_error"; documentId: string }
  | { kind: "network_error"; documentId: string }
  | { kind: "timeout"; documentId: string }
  | { kind: "unexpected"; documentId: string };

export type DocumentDecisionState =
  | { kind: "idle" }
  | { kind: "submitting"; documentId: string }
  | { kind: "success"; documentId: string; refreshFailed: boolean }
  | { kind: "comment_required"; documentId: string }
  | { kind: "read_only_archived"; documentId: string }
  | { kind: "read_only_not_ready"; documentId: string }
  | { kind: "read_only_role"; documentId: string }
  | { kind: "workpaper_not_ready"; documentId: string }
  | { kind: "local_invalid"; documentId: string }
  | { kind: "bad_request"; documentId: string }
  | { kind: "auth_required"; documentId: string }
  | { kind: "forbidden"; documentId: string }
  | { kind: "not_found"; documentId: string }
  | { kind: "conflict_archived"; documentId: string }
  | { kind: "conflict_not_ready"; documentId: string }
  | { kind: "conflict_stale"; documentId: string }
  | { kind: "conflict_workpaper_status"; documentId: string }
  | { kind: "conflict_other"; documentId: string }
  | { kind: "server_error"; documentId: string }
  | { kind: "network_error"; documentId: string }
  | { kind: "timeout"; documentId: string }
  | { kind: "invalid_payload"; documentId: string }
  | { kind: "unexpected"; documentId: string };
