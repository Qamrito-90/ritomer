import type {
  DownloadWorkpaperDocumentState,
  ReviewDocumentVerificationDecisionState,
  UpsertWorkpaperState,
  UploadWorkpaperDocumentState,
  WorkpaperDocument
} from "../../lib/api/workpapers";
import { getReadableDocumentId, validateDocumentUploadDraft } from "./model";
import type {
  DocumentDecisionDraft,
  DocumentDecisionState,
  DocumentDownloadState,
  DocumentUploadDraft,
  DocumentUploadState,
  WorkpaperMutationState
} from "./types";

export function getDocumentDownloadStatusLine(
  document: WorkpaperDocument,
  state: DocumentDownloadState
) {
  const documentId = getReadableDocumentId(document);

  if (documentId === null) {
    return "telechargement indisponible";
  }

  if (state.kind === "idle" || state.documentId !== documentId) {
    return null;
  }

  if (state.kind === "submitting") {
    return "telechargement document en cours";
  }

  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces documents refuse";
  }

  if (state.kind === "not_found") {
    return "document introuvable pour telechargement";
  }

  if (state.kind === "server_error") {
    return "erreur serveur documents";
  }

  if (state.kind === "network_error") {
    return "erreur reseau documents";
  }

  if (state.kind === "timeout") {
    return "timeout documents";
  }

  return "telechargement indisponible";
}

export function getDocumentDecisionStatusLines(
  documentId: string,
  draft: DocumentDecisionDraft,
  state: DocumentDecisionState
) {
  if (state.kind !== "idle" && state.documentId === documentId) {
    if (state.kind === "submitting") {
      return ["decision document en cours"];
    }

    if (state.kind === "success") {
      return state.refreshFailed
        ? ["decision document enregistree avec succes", "rafraichissement workpapers impossible"]
        : ["decision document enregistree avec succes"];
    }

    if (state.kind === "comment_required") {
      return ["commentaire reviewer requis"];
    }

    if (state.kind === "read_only_archived") {
      return ["dossier archive, verification document en lecture seule"];
    }

    if (state.kind === "read_only_not_ready") {
      return ["verification document non modifiable tant que les controles ne sont pas READY"];
    }

    if (state.kind === "read_only_role") {
      return ["verification reviewer en lecture seule"];
    }

    if (state.kind === "workpaper_not_ready") {
      return ["decision document disponible quand le workpaper est READY_FOR_REVIEW"];
    }

    if (state.kind === "bad_request") {
      return ["decision document invalide"];
    }

    if (state.kind === "auth_required") {
      return ["authentification requise"];
    }

    if (state.kind === "forbidden") {
      return ["acces verification document refuse"];
    }

    if (state.kind === "not_found") {
      return ["document introuvable pour decision"];
    }

    if (state.kind === "conflict_archived") {
      return ["dossier archive, verification document non modifiable"];
    }

    if (state.kind === "conflict_not_ready") {
      return ["verification document non modifiable tant que les controles ne sont pas READY"];
    }

    if (state.kind === "conflict_stale") {
      return ["document indisponible sur un workpaper stale"];
    }

    if (state.kind === "conflict_workpaper_status") {
      return ["decision document disponible quand le workpaper est READY_FOR_REVIEW"];
    }

    if (state.kind === "conflict_other") {
      return ["decision document impossible"];
    }

    if (state.kind === "server_error") {
      return ["erreur serveur documents"];
    }

    if (state.kind === "network_error") {
      return ["erreur reseau documents"];
    }

    if (state.kind === "timeout") {
      return ["timeout documents"];
    }

    if (state.kind === "invalid_payload") {
      return ["payload decision document invalide"];
    }

    return ["decision document indisponible"];
  }

  if (draft.decision === "REJECTED" && draft.comment.trim().length === 0) {
    return ["commentaire reviewer requis"];
  }

  return [];
}

export function getDocumentUploadStatusLines(
  anchorCode: string,
  draft: DocumentUploadDraft,
  state: DocumentUploadState
) {
  if (state.kind !== "idle" && state.anchorCode === anchorCode) {
    if (state.kind === "submitting") {
      return ["upload document en cours"];
    }

    if (state.kind === "success") {
      return state.refreshFailed
        ? ["document uploade avec succes", "rafraichissement workpapers impossible"]
        : ["document uploade avec succes"];
    }

    if (state.kind === "bad_request") {
      return ["document invalide"];
    }

    if (state.kind === "bad_request_invalid_media_type") {
      return ["format de fichier non autorise"];
    }

    if (state.kind === "bad_request_empty_file") {
      return ["fichier vide"];
    }

    if (state.kind === "bad_request_source_required") {
      return ["source du document requise"];
    }

    if (state.kind === "auth_required") {
      return ["authentification requise"];
    }

    if (state.kind === "forbidden") {
      return ["acces documents refuse"];
    }

    if (state.kind === "not_found") {
      return ["workpaper introuvable pour upload document"];
    }

    if (state.kind === "conflict_archived") {
      return ["dossier archive, document non modifiable"];
    }

    if (state.kind === "conflict_not_ready") {
      return ["document non modifiable tant que les controles ne sont pas READY"];
    }

    if (state.kind === "conflict_stale") {
      return ["document indisponible sur un workpaper stale"];
    }

    if (state.kind === "conflict_workpaper_read_only") {
      return ["document non modifiable pour ce workpaper"];
    }

    if (state.kind === "conflict_other") {
      return ["upload document impossible"];
    }

    if (state.kind === "payload_too_large") {
      return ["fichier trop volumineux (25 MiB max)"];
    }

    if (state.kind === "server_error") {
      return ["erreur serveur documents"];
    }

    if (state.kind === "network_error") {
      return ["erreur reseau documents"];
    }

    if (state.kind === "timeout") {
      return ["timeout documents"];
    }

    if (state.kind === "invalid_payload") {
      return ["payload upload document invalide"];
    }

    return ["upload document indisponible"];
  }

  const validation = validateDocumentUploadDraft(draft);
  return [validation.kind === "valid" ? "fichier pret pour upload" : validation.message];
}

export function mapWorkpaperMutationResult(
  result: Exclude<UpsertWorkpaperState, { kind: "success" }>
): WorkpaperMutationState {
  if (result.kind === "bad_request") {
    return { kind: "invalid_workpaper" };
  }

  if (result.kind === "auth_required") {
    return { kind: "auth_required" };
  }

  if (result.kind === "forbidden") {
    return { kind: "forbidden" };
  }

  if (result.kind === "not_found") {
    return { kind: "not_found" };
  }

  if (result.kind === "conflict_archived") {
    return { kind: "conflict_archived" };
  }

  if (result.kind === "conflict_not_ready") {
    return { kind: "conflict_not_ready" };
  }

  if (result.kind === "conflict_other") {
    return { kind: "conflict_other" };
  }

  if (result.kind === "server_error") {
    return { kind: "server_error" };
  }

  if (result.kind === "network_error") {
    return { kind: "network_error" };
  }

  if (result.kind === "timeout") {
    return { kind: "timeout" };
  }

  if (result.kind === "invalid_payload") {
    return { kind: "invalid_payload" };
  }

  return { kind: "unexpected" };
}

export function mapDocumentUploadResult(
  result: Exclude<UploadWorkpaperDocumentState, { kind: "success" }>,
  anchorCode: string
): DocumentUploadState {
  return {
    ...result,
    anchorCode
  };
}

export function mapDocumentDownloadResult(
  result: Exclude<DownloadWorkpaperDocumentState, { kind: "success" }>,
  documentId: string
): DocumentDownloadState {
  return {
    ...result,
    documentId
  };
}

export function mapDocumentDecisionResult(
  result: Exclude<ReviewDocumentVerificationDecisionState, { kind: "success" }>,
  documentId: string
): DocumentDecisionState {
  return {
    ...result,
    documentId
  };
}

export function formatWorkpaperMutationState(
  state: Exclude<WorkpaperMutationState, { kind: "idle" | "success" }>
) {
  if (state.kind === "submitting") {
    return "enregistrement workpaper en cours";
  }

  if (state.kind === "read_only_archived") {
    return "dossier archive, workpaper en lecture seule";
  }

  if (state.kind === "read_only_not_ready") {
    return "workpaper non modifiable tant que les controles ne sont pas READY";
  }

  if (state.kind === "read_only_role") {
    return "lecture seule";
  }

  if (state.kind === "stale_read_only") {
    return "workpapers stale en lecture seule";
  }

  if (state.kind === "item_read_only") {
    return "workpaper en lecture seule";
  }

  if (state.kind === "invalid_workpaper") {
    return "workpaper invalide";
  }

  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces workpapers refuse";
  }

  if (state.kind === "not_found") {
    return "dossier introuvable";
  }

  if (state.kind === "conflict_archived") {
    return "dossier archive, workpaper non modifiable";
  }

  if (state.kind === "conflict_not_ready") {
    return "workpaper non modifiable tant que les controles ne sont pas READY";
  }

  if (state.kind === "conflict_other") {
    return "mise a jour workpaper impossible";
  }

  if (state.kind === "server_error") {
    return "erreur serveur workpapers";
  }

  if (state.kind === "network_error") {
    return "erreur reseau workpapers";
  }

  if (state.kind === "timeout") {
    return "timeout workpapers";
  }

  if (state.kind === "invalid_payload") {
    return "payload workpaper invalide";
  }

  if (state.kind === "invalid_workpapers_payload") {
    return "payload workpapers invalide";
  }

  return "workpaper indisponible";
}
