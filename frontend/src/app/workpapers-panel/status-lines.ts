import type {
  DownloadWorkpaperDocumentState,
  ReviewDocumentVerificationDecisionState,
  ReviewWorkpaperDecisionState,
  UpsertWorkpaperState,
  UploadWorkpaperDocumentState,
  WorkpaperDocument,
  WorkpaperReadModelItem
} from "../../lib/api/workpapers";
import {
  canMarkWorkpaperReviewed,
  getReadableDocumentId,
  validateDocumentUploadDraft
} from "./model";
import type {
  DocumentDecisionDraft,
  DocumentDecisionState,
  DocumentDownloadState,
  DocumentUploadDraft,
  DocumentUploadState,
  WorkpaperDecisionDraft,
  WorkpaperDecisionState,
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
    return "Telechargement de la piece en cours";
  }

  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces pieces refuse";
  }

  if (state.kind === "not_found") {
    return "piece introuvable pour telechargement";
  }

  if (state.kind === "server_error") {
    return "erreur serveur pieces";
  }

  if (state.kind === "network_error") {
    return "erreur reseau pieces";
  }

  if (state.kind === "timeout") {
    return "Delai depasse pendant le telechargement de la piece";
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
      return ["Verification de la piece en cours"];
    }

    if (state.kind === "success") {
      return state.refreshFailed
        ? ["Verification de la piece enregistree", "rafraichissement justifications impossible"]
        : ["Verification de la piece enregistree"];
    }

    if (state.kind === "comment_required") {
      return ["commentaire de verification requis"];
    }

    if (state.kind === "read_only_archived") {
      return ["dossier archive, verification de piece en lecture seule"];
    }

    if (state.kind === "read_only_not_ready") {
      return ["Verification de la piece non modifiable tant que les controles ne sont pas prets"];
    }

    if (state.kind === "read_only_role") {
      return ["verification de piece en lecture seule"];
    }

    if (state.kind === "workpaper_not_ready") {
      return ["Verification disponible quand la justification est prete pour revue"];
    }

    if (state.kind === "bad_request") {
      return ["verification de piece invalide"];
    }

    if (state.kind === "auth_required") {
      return ["authentification requise"];
    }

    if (state.kind === "forbidden") {
      return ["acces verification de piece refuse"];
    }

    if (state.kind === "not_found") {
      return ["piece introuvable pour verification"];
    }

    if (state.kind === "conflict_archived") {
      return ["dossier archive, verification de piece non modifiable"];
    }

    if (state.kind === "conflict_not_ready") {
      return ["Verification de la piece non modifiable tant que les controles ne sont pas prets"];
    }

    if (state.kind === "conflict_stale") {
      return ["piece indisponible sur une ancienne structure"];
    }

    if (state.kind === "conflict_workpaper_status") {
      return ["Verification disponible quand la justification est prete pour revue"];
    }

    if (state.kind === "conflict_other") {
      return ["verification de piece impossible"];
    }

    if (state.kind === "server_error") {
      return ["erreur serveur pieces"];
    }

    if (state.kind === "network_error") {
      return ["erreur reseau pieces"];
    }

    if (state.kind === "timeout") {
      return ["Delai depasse pendant la verification de la piece"];
    }

    if (state.kind === "invalid_payload") {
      return ["Données de preuves incohérentes. L’écran reste bloqué par sécurité."];
    }

    return ["verification de piece indisponible"];
  }

  if (draft.decision === "REJECTED" && draft.comment.trim().length === 0) {
    return ["commentaire de verification requis"];
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
      return ["Ajout de la piece en cours"];
    }

    if (state.kind === "success") {
      return state.refreshFailed
        ? ["Piece ajoutee avec succes", "rafraichissement justifications impossible"]
        : ["Piece ajoutee avec succes"];
    }

    if (state.kind === "bad_request") {
      return ["piece invalide"];
    }

    if (state.kind === "bad_request_invalid_media_type") {
      return ["format de fichier non autorise"];
    }

    if (state.kind === "bad_request_empty_file") {
      return ["fichier vide"];
    }

    if (state.kind === "bad_request_source_required") {
      return ["origine de la piece requise"];
    }

    if (state.kind === "auth_required") {
      return ["authentification requise"];
    }

    if (state.kind === "forbidden") {
      return ["acces pieces refuse"];
    }

    if (state.kind === "not_found") {
      return ["justification introuvable pour ajout de piece"];
    }

    if (state.kind === "conflict_archived") {
      return ["dossier archive, piece non modifiable"];
    }

    if (state.kind === "conflict_not_ready") {
      return ["Piece non modifiable tant que les controles ne sont pas prets"];
    }

    if (state.kind === "conflict_stale") {
      return ["piece indisponible sur une ancienne structure"];
    }

    if (state.kind === "conflict_workpaper_read_only") {
      return ["piece non modifiable pour cette justification"];
    }

    if (state.kind === "conflict_other") {
      return ["ajout de piece impossible"];
    }

    if (state.kind === "payload_too_large") {
      return ["fichier trop volumineux (25 MiB max)"];
    }

    if (state.kind === "server_error") {
      return ["erreur serveur pieces"];
    }

    if (state.kind === "network_error") {
      return ["erreur reseau pieces"];
    }

    if (state.kind === "timeout") {
      return ["Delai depasse pendant l'ajout de la piece"];
    }

    if (state.kind === "invalid_payload") {
      return ["Données de preuves incohérentes. L’écran reste bloqué par sécurité."];
    }

    return ["ajout de piece indisponible"];
  }

  const validation = validateDocumentUploadDraft(draft);
  return [validation.kind === "valid" ? "Piece prete a ajouter" : validation.message];
}

export function getWorkpaperDecisionStatusLines(
  anchorCode: string,
  item: WorkpaperReadModelItem,
  draft: WorkpaperDecisionDraft,
  state: WorkpaperDecisionState
) {
  if (state.kind !== "idle" && state.anchorCode === anchorCode) {
    if (state.kind === "submitting") {
      return ["Decision de revue en cours"];
    }

    if (state.kind === "success") {
      return state.refreshFailed
        ? ["decision de revue enregistree", "rafraichissement justifications impossible"]
        : ["decision de revue enregistree"];
    }

    if (state.kind === "comment_required") {
      return ["commentaire de revue requis"];
    }

    if (
      state.kind === "read_only_archived" ||
      state.kind === "read_only_not_ready" ||
      state.kind === "unavailable_status"
    ) {
      return ["decision de revue indisponible pour ce statut"];
    }

    if (state.kind === "read_only_role" || state.kind === "bad_request" || state.kind === "forbidden") {
      return ["Revue indisponible pour cette rubrique."];
    }

    if (state.kind === "not_found") {
      return ["justification introuvable pour decision"];
    }

    if (state.kind === "conflict_other" || state.kind === "mark_reviewed_blocked") {
      return ["decision de revue bloquee par les controles de preuve"];
    }

    return ["Revue indisponible pour cette rubrique."];
  }

  if (draft.decision === "CHANGES_REQUESTED" && draft.comment.trim().length === 0) {
    return ["commentaire de revue requis"];
  }

  if (draft.decision === "REVIEWED" && !canMarkWorkpaperReviewed(item)) {
    return ["Revue possible quand les preuves sont verifiees ou quand aucune piece n'est attachee"];
  }

  return [];
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

export function mapWorkpaperDecisionResult(
  result: Exclude<ReviewWorkpaperDecisionState, { kind: "success" }>,
  anchorCode: string
): WorkpaperDecisionState {
  return {
    ...result,
    anchorCode
  };
}

export function formatWorkpaperMutationState(
  state: Exclude<WorkpaperMutationState, { kind: "idle" | "success" }>
) {
  if (state.kind === "submitting") {
    return "enregistrement justification en cours";
  }

  if (state.kind === "read_only_archived") {
    return "dossier archive, justification en lecture seule";
  }

  if (state.kind === "read_only_not_ready") {
    return "justification non modifiable tant que les controles ne sont pas prets";
  }

  if (state.kind === "read_only_role") {
    return "lecture seule";
  }

  if (state.kind === "stale_read_only") {
    return "Justification rattachée à une ancienne structure";
  }

  if (state.kind === "item_read_only") {
    return "justification en lecture seule";
  }

  if (state.kind === "invalid_workpaper") {
    return "justification invalide";
  }

  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces justifications refuse";
  }

  if (state.kind === "not_found") {
    return "dossier introuvable";
  }

  if (state.kind === "conflict_archived") {
    return "dossier archive, justification non modifiable";
  }

  if (state.kind === "conflict_not_ready") {
    return "justification non modifiable tant que les controles ne sont pas prets";
  }

  if (state.kind === "conflict_other") {
    return "mise a jour justification impossible";
  }

  if (state.kind === "server_error") {
    return "erreur serveur justifications";
  }

  if (state.kind === "network_error") {
    return "erreur reseau justifications";
  }

  if (state.kind === "timeout") {
    return "Delai depasse pendant la mise a jour des preuves";
  }

  if (state.kind === "invalid_payload") {
    return "Données de preuves incohérentes. L’écran reste bloqué par sécurité.";
  }

  if (state.kind === "invalid_workpapers_payload") {
    return "Données de preuves incohérentes. L’écran reste bloqué par sécurité.";
  }

  return "justification indisponible";
}
