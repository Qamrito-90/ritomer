import type { ChangeEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link, createBrowserRouter, createMemoryRouter, useParams } from "react-router-dom";
import { AppShell } from "../components/workbench/app-shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { WorkflowBadge } from "../components/ui/workflow-badge";
import {
  loadClosingFolderShellState,
  loadClosingFoldersListState,
  type ClosingFolderListItem,
  type ClosingFolderSummary
} from "../lib/api/closing-folders";
import {
  loadControlsShellState,
  type ClosingControlsSummary,
  type ControlsShellState,
  type ControlStatus
} from "../lib/api/controls";
import {
  loadFinancialStatementsStructuredShellState,
  type FinancialStatementsStructuredShellState,
  type StructuredFinancialStatementsPreview
} from "../lib/api/financial-statements-structured";
import {
  loadFinancialSummaryShellState,
  type FinancialSummaryPreview,
  type FinancialSummaryShellState
} from "../lib/api/financial-summary";
import {
  DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES,
  DOCUMENT_UPLOAD_MAX_BYTES,
  downloadWorkpaperDocument,
  loadWorkpapersShellState,
  uploadWorkpaperDocument,
  upsertWorkpaper,
  type ClosingWorkpapersReadModel,
  type DownloadWorkpaperDocumentState,
  type MakerWorkpaperStatus,
  type UploadWorkpaperDocumentState,
  type WorkpaperDocument,
  type WorkpaperEvidence,
  type WorkpaperReadModelItem,
  type WorkpapersShellState
} from "../lib/api/workpapers";
import {
  uploadBalanceImport,
  type BalanceImportValidationError
} from "../lib/api/import-balance";
import {
  deleteManualMapping,
  loadManualMappingShellState,
  upsertManualMapping,
  type ManualMappingProjection,
  type ManualMappingShellState
} from "../lib/api/manual-mapping";
import {
  loadMeShellState,
  type ActiveTenant,
  type EffectiveRolesHint
} from "../lib/api/me";
import { formatLocalDate } from "../lib/format/date";
import { formatOptionalText } from "../lib/format/text";

type EntrypointListState =
  | { kind: "list_loading"; activeTenant: ActiveTenant }
  | { kind: "list_auth_required"; activeTenant: ActiveTenant }
  | { kind: "list_forbidden"; activeTenant: ActiveTenant }
  | { kind: "list_unavailable"; activeTenant: ActiveTenant }
  | { kind: "list_empty"; activeTenant: ActiveTenant }
  | {
      kind: "list_ready";
      activeTenant: ActiveTenant;
      closingFolders: ClosingFolderListItem[];
    };

type EntrypointRouteState =
  | { kind: "loading" }
  | { kind: "auth_required" }
  | { kind: "tenant_context_required" }
  | { kind: "profile_unavailable" }
  | EntrypointListState;

type ImportBalanceState =
  | { kind: "idle" }
  | { kind: "uploading"; requestId: number }
  | {
      kind: "success";
      requestId: number;
      version: number;
      rowCount: number;
      refreshStatus: "complete" | "closing_failed" | "controls_failed";
    }
  | { kind: "bad_request"; message: string; errors: BalanceImportValidationError[] }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

type ManualMappingMutationState =
  | { kind: "idle" }
  | { kind: "put_submitting" }
  | { kind: "delete_submitting" }
  | {
      kind: "put_success";
      refreshMappingFailed: boolean;
      refreshControlsFailed: boolean;
    }
  | {
      kind: "delete_success";
      refreshMappingFailed: boolean;
      refreshControlsFailed: boolean;
    }
  | { kind: "bad_request_account_absent" }
  | { kind: "bad_request_target_invalid" }
  | { kind: "bad_request" }
  | { kind: "auth_required" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "conflict_archived" }
  | { kind: "conflict_import_required" }
  | { kind: "conflict_other" }
  | { kind: "server_error" }
  | { kind: "network_error" }
  | { kind: "timeout" }
  | { kind: "invalid_payload" }
  | { kind: "unexpected" };

type WorkpaperDraft = {
  noteText: string;
  status: MakerWorkpaperStatus;
};

type DocumentUploadDraft = {
  file: File | null;
  selectedFileCount: number;
  sourceLabel: string;
  documentDate: string;
};

type WorkpaperMutationState =
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

type DocumentUploadState =
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

type DocumentDownloadState =
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

type ClosingRouteState =
  | { kind: "loading" }
  | { kind: "auth_required" }
  | { kind: "tenant_context_required" }
  | { kind: "profile_unavailable" }
  | { kind: "closing_auth_required"; activeTenant: ActiveTenant }
  | { kind: "closing_forbidden"; activeTenant: ActiveTenant }
  | { kind: "closing_not_found"; activeTenant: ActiveTenant }
  | { kind: "closing_unavailable"; activeTenant: ActiveTenant }
  | { kind: "closing_tenant_mismatch"; activeTenant: ActiveTenant }
  | {
      kind: "closing_ready";
      activeTenant: ActiveTenant;
      effectiveRoles: EffectiveRolesHint;
      closingFolder: ClosingFolderSummary;
      controlsState: ControlsShellState;
      financialSummaryState: FinancialSummaryShellState;
      financialStatementsStructuredState: FinancialStatementsStructuredShellState;
      workpapersState: WorkpapersShellState;
      workpaperDrafts: Record<string, WorkpaperDraft>;
      documentUploadDrafts: Record<string, DocumentUploadDraft>;
      workpaperMutationState: WorkpaperMutationState;
      documentUploadState: DocumentUploadState;
      documentDownloadState: DocumentDownloadState;
      manualMappingState: ManualMappingShellState;
      manualMappingSelectedTargets: Record<string, string | undefined>;
      manualMappingMutationState: ManualMappingMutationState;
      manualMappingRefreshPending: boolean;
      importState: ImportBalanceState;
      selectedImportFile: File | null;
    };

const localDateTimeFormatter = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit"
});

const controlLabelByCode = {
  LATEST_VALID_BALANCE_IMPORT_PRESENT: "dernier import valide",
  MANUAL_MAPPING_COMPLETE_ON_LATEST_IMPORT: "mapping manuel complet"
} as const;

const controlStatusLabelByCode: Record<ControlStatus, string> = {
  PASS: "ok",
  FAIL: "bloquant",
  NOT_APPLICABLE: "non applicable"
};

const nextActionLabelByCode = {
  IMPORT_BALANCE: "importer la balance",
  COMPLETE_MANUAL_MAPPING: "completer le mapping manuel"
} as const;

const manualMappingWritableRoles = new Set(["ACCOUNTANT", "MANAGER", "ADMIN"]);
const workpaperWritableRoles = new Set(["ACCOUNTANT", "MANAGER", "ADMIN"]);
const documentReadableRoles = new Set(["ACCOUNTANT", "REVIEWER", "MANAGER", "ADMIN"]);
const documentUploadAllowedExtensions = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".tif",
  ".tiff",
  ".csv",
  ".xls",
  ".xlsx"
]);
const documentUploadInputAccept = [
  ...DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES,
  ...documentUploadAllowedExtensions
].join(",");

function ClosingFoldersEntrypointRoute() {
  const [state, setState] = useState<EntrypointRouteState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function loadEntrypointState() {
      setState({ kind: "loading" });

      const meState = await loadMeShellState();

      if (cancelled) {
        return;
      }

      if (meState.kind === "auth_required") {
        setState({ kind: "auth_required" });
        return;
      }

      if (meState.kind === "tenant_context_required") {
        setState({ kind: "tenant_context_required" });
        return;
      }

      if (meState.kind === "profile_unavailable") {
        setState({ kind: "profile_unavailable" });
        return;
      }

      setState({
        kind: "list_loading",
        activeTenant: meState.activeTenant
      });

      const listState = await loadClosingFoldersListState(meState.activeTenant);

      if (cancelled) {
        return;
      }

      switch (listState.kind) {
        case "auth_required":
          setState({ kind: "list_auth_required", activeTenant: meState.activeTenant });
          return;
        case "forbidden":
          setState({ kind: "list_forbidden", activeTenant: meState.activeTenant });
          return;
        case "unavailable":
          setState({ kind: "list_unavailable", activeTenant: meState.activeTenant });
          return;
        case "ready": {
          const visibleClosingFolders = listState.closingFolders.filter(
            (closingFolder) => closingFolder.tenantId === meState.activeTenant.tenantId
          );

          if (visibleClosingFolders.length === 0) {
            setState({ kind: "list_empty", activeTenant: meState.activeTenant });
            return;
          }

          setState({
            kind: "list_ready",
            activeTenant: meState.activeTenant,
            closingFolders: visibleClosingFolders
          });
          return;
        }
      }
    }

    void loadEntrypointState();

    return () => {
      cancelled = true;
    };
  }, []);

  const tenant = hasActiveTenant(state)
    ? {
        tenantName: state.activeTenant.tenantName,
        tenantSlug: state.activeTenant.tenantSlug
      }
    : undefined;

  return (
    <AppShell
      actionZone={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium text-foreground">Zone d action</p>
            <p className="text-muted-foreground">lecture seule</p>
          </div>
          <p className="text-muted-foreground">Aucune mutation dossier en V1.</p>
        </div>
      }
      breadcrumb={[{ label: "Dossiers de closing" }]}
      description="Entree produit read-only borne a GET /api/me puis GET /api/closing-folders."
      eyebrow="Entree produit V1"
      sidebarItems={[{ href: "/", label: "Dossiers" }]}
      tenant={tenant}
      title="Entree dossiers de closing"
    >
      {hasActiveTenant(state) ? (
        <section className="panel p-6">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="label-eyebrow">Dossiers de closing</p>
              <h3 className="text-xl font-semibold text-foreground">Liste read-only</h3>
            </div>
            <ClosingFoldersSlot state={state} />
          </div>
        </section>
      ) : (
        <section className="panel p-6">
          {state.kind === "loading" ? <StateMessage text="chargement dossiers" /> : null}
          {state.kind === "auth_required" ? <StateMessage text="authentification requise" /> : null}
          {state.kind === "tenant_context_required" ? (
            <StateMessage text="contexte tenant requis" />
          ) : null}
          {state.kind === "profile_unavailable" ? (
            <StateMessage text="profil indisponible" />
          ) : null}
        </section>
      )}
    </AppShell>
  );
}

function ClosingFolderRoute() {
  const { closingFolderId = "" } = useParams();
  const [state, setState] = useState<ClosingRouteState>({ kind: "loading" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importRequestIdRef = useRef(0);
  const workpaperMutationInFlightRef = useRef(false);
  const documentUploadInFlightRef = useRef(false);
  const documentDownloadInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    workpaperMutationInFlightRef.current = false;
    documentUploadInFlightRef.current = false;
    documentDownloadInFlightRef.current = false;

    async function loadShellState() {
      setState({ kind: "loading" });

      const meState = await loadMeShellState();

      if (cancelled) {
        return;
      }

      if (meState.kind === "auth_required") {
        setState({ kind: "auth_required" });
        return;
      }

      if (meState.kind === "tenant_context_required") {
        setState({ kind: "tenant_context_required" });
        return;
      }

      if (meState.kind === "profile_unavailable") {
        setState({ kind: "profile_unavailable" });
        return;
      }

      const closingFolderState = await loadClosingFolderShellState(closingFolderId, meState.activeTenant);

      if (cancelled) {
        return;
      }

      switch (closingFolderState.kind) {
        case "auth_required":
          setState({ kind: "closing_auth_required", activeTenant: meState.activeTenant });
          return;
        case "forbidden":
          setState({ kind: "closing_forbidden", activeTenant: meState.activeTenant });
          return;
        case "not_found":
          setState({ kind: "closing_not_found", activeTenant: meState.activeTenant });
          return;
        case "unavailable":
          setState({ kind: "closing_unavailable", activeTenant: meState.activeTenant });
          return;
        case "tenant_mismatch":
          setState({ kind: "closing_tenant_mismatch", activeTenant: meState.activeTenant });
          return;
        case "ready": {
          setState({
            kind: "closing_ready",
            activeTenant: meState.activeTenant,
            effectiveRoles: meState.effectiveRoles,
            closingFolder: closingFolderState.closingFolder,
            controlsState: { kind: "loading" },
            financialSummaryState: { kind: "loading" },
            financialStatementsStructuredState: { kind: "loading" },
            workpapersState: { kind: "loading" },
            workpaperDrafts: {},
            documentUploadDrafts: {},
            workpaperMutationState: { kind: "idle" },
            documentUploadState: { kind: "idle" },
            documentDownloadState: { kind: "idle" },
            manualMappingState: { kind: "loading" },
            manualMappingSelectedTargets: {},
            manualMappingMutationState: { kind: "idle" },
            manualMappingRefreshPending: false,
            importState: { kind: "idle" },
            selectedImportFile: null
          });

          const [
            controlsState,
            manualMappingState,
            financialSummaryState,
            financialStatementsStructuredState,
            workpapersState
          ] = await Promise.all([
            loadControlsShellState(
              closingFolderId,
              closingFolderState.closingFolder,
              meState.activeTenant
            ),
            loadManualMappingShellState(
              closingFolderId,
              closingFolderState.closingFolder,
              meState.activeTenant
            ),
            loadFinancialSummaryShellState(
              closingFolderId,
              closingFolderState.closingFolder,
              meState.activeTenant
            ),
            loadFinancialStatementsStructuredShellState(
              closingFolderId,
              closingFolderState.closingFolder,
              meState.activeTenant
            ),
            loadWorkpapersShellState(
              closingFolderId,
              closingFolderState.closingFolder,
              meState.activeTenant
            )
          ]);

          if (cancelled) {
            return;
          }

          setState((currentState) => {
            if (currentState.kind !== "closing_ready") {
              return currentState;
            }

            return {
              ...currentState,
              controlsState,
              financialSummaryState,
              financialStatementsStructuredState,
              workpapersState,
              workpaperDrafts:
                workpapersState.kind === "ready"
                  ? createWorkpaperDrafts(workpapersState.workpapers)
                  : {},
              documentUploadDrafts:
                workpapersState.kind === "ready"
                  ? createDocumentUploadDrafts(workpapersState.workpapers)
                  : {},
              manualMappingState,
              manualMappingSelectedTargets:
                manualMappingState.kind === "ready"
                  ? createManualMappingSelectedTargets(manualMappingState.projection)
                  : {}
            };
          });
          return;
        }
      }
    }

    void loadShellState();

    return () => {
      cancelled = true;
      workpaperMutationInFlightRef.current = false;
      documentUploadInFlightRef.current = false;
      documentDownloadInFlightRef.current = false;
    };
  }, [closingFolderId]);

  async function handleImportBalance() {
    if (state.kind !== "closing_ready") {
      return;
    }

    const { activeTenant, closingFolder, selectedImportFile } = state;
    const importBlocked =
      closingFolder.status === "ARCHIVED" || state.importState.kind === "conflict_archived";

    if (
      selectedImportFile === null ||
      !hasCsvFileExtension(selectedImportFile.name) ||
      importBlocked
    ) {
      return;
    }

    const requestId = importRequestIdRef.current + 1;
    importRequestIdRef.current = requestId;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        importState: { kind: "uploading", requestId }
      };
    });

    const importState = await uploadBalanceImport(closingFolderId, activeTenant, selectedImportFile);

    if (importState.kind === "created") {
      if (!isBalanceImportCoherent(importState.balanceImport, closingFolderId, closingFolder)) {
        setState((currentState) => {
          if (currentState.kind !== "closing_ready") {
            return currentState;
          }

          return {
            ...currentState,
            importState: { kind: "invalid_payload" }
          };
        });
        return;
      }

      const successState = {
        kind: "success" as const,
        requestId,
        version: importState.balanceImport.version,
        rowCount: importState.balanceImport.rowCount,
        refreshStatus: "complete" as const
      };

      if (fileInputRef.current !== null) {
        fileInputRef.current.value = "";
      }

      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          importState: successState,
          selectedImportFile: null
        };
      });

      const refreshedClosingFolderState = await loadClosingFolderShellState(closingFolderId, activeTenant);

      if (refreshedClosingFolderState.kind !== "ready") {
        setState((currentState) => {
          if (currentState.kind !== "closing_ready") {
            return currentState;
          }

          return {
            ...currentState,
            importState: updateImportSuccessRefreshStatus(
              currentState.importState,
              requestId,
              "closing_failed"
            )
          };
        });
        return;
      }

      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          closingFolder: refreshedClosingFolderState.closingFolder
        };
      });

      const refreshedControlsState = await loadControlsShellState(
        closingFolderId,
        refreshedClosingFolderState.closingFolder,
        activeTenant
      );

      if (refreshedControlsState.kind !== "ready") {
        setState((currentState) => {
          if (currentState.kind !== "closing_ready") {
            return currentState;
          }

          return {
            ...currentState,
            importState: updateImportSuccessRefreshStatus(
              currentState.importState,
              requestId,
              "controls_failed"
            )
          };
        });
        return;
      }

      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          controlsState: refreshedControlsState,
          importState: updateImportSuccessRefreshStatus(
            currentState.importState,
            requestId,
            "complete"
          )
        };
      });
      return;
    }

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        importState: mapUploadResultToImportState(importState)
      };
    });
  }

  function handleImportFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const nextSelectedFile = getSingleSelectedFile(event.currentTarget.files);

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        selectedImportFile: nextSelectedFile,
        importState:
          currentState.importState.kind === "conflict_archived"
            ? currentState.importState
            : { kind: "idle" }
      };
    });
  }

  function handleManualMappingTargetChange(accountCode: string, targetCode: string) {
    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        manualMappingSelectedTargets: {
          ...currentState.manualMappingSelectedTargets,
          [accountCode]: targetCode === "" ? undefined : targetCode
        }
      };
    });
  }

  async function handleSaveManualMapping(accountCode: string) {
    if (state.kind !== "closing_ready" || state.manualMappingState.kind !== "ready") {
      return;
    }

    const selectedTargetCode = state.manualMappingSelectedTargets[accountCode];
    const currentMapping = findManualMappingForAccount(state.manualMappingState.projection, accountCode);

    if (
      selectedTargetCode === undefined ||
      !canWriteManualMapping(state) ||
      !state.manualMappingState.projection.lines.some((line) => line.accountCode === accountCode) ||
      !getSelectableTargetCodes(state.manualMappingState.projection).has(selectedTargetCode) ||
      currentMapping?.targetCode === selectedTargetCode
    ) {
      return;
    }

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        manualMappingMutationState: { kind: "put_submitting" },
        manualMappingRefreshPending: true
      };
    });

    const result = await upsertManualMapping(
      closingFolderId,
      state.activeTenant,
      {
        accountCode,
        targetCode: selectedTargetCode
      }
    );

    if (result.kind === "success") {
      if (
        result.mapping.accountCode !== accountCode ||
        result.mapping.targetCode !== selectedTargetCode
      ) {
        setState((currentState) => {
          if (currentState.kind !== "closing_ready") {
            return currentState;
          }

          return {
            ...currentState,
            manualMappingMutationState: { kind: "invalid_payload" },
            manualMappingRefreshPending: false
          };
        });
        return;
      }

      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          manualMappingMutationState: {
            kind: "put_success",
            refreshMappingFailed: false,
            refreshControlsFailed: false
          }
        };
      });

      await refreshManualMappingAndControls(state.activeTenant, state.closingFolder, "put_success");
      return;
    }

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        manualMappingMutationState: mapManualMappingMutationResult(result),
        manualMappingRefreshPending: false
      };
    });
  }

  async function handleDeleteManualMapping(accountCode: string) {
    if (state.kind !== "closing_ready" || state.manualMappingState.kind !== "ready") {
      return;
    }

    if (
      !canWriteManualMapping(state) ||
      findManualMappingForAccount(state.manualMappingState.projection, accountCode) === undefined
    ) {
      return;
    }

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        manualMappingMutationState: { kind: "delete_submitting" },
        manualMappingRefreshPending: true
      };
    });

    const result = await deleteManualMapping(closingFolderId, state.activeTenant, accountCode);

    if (result.kind === "success") {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          manualMappingMutationState: {
            kind: "delete_success",
            refreshMappingFailed: false,
            refreshControlsFailed: false
          }
        };
      });

      await refreshManualMappingAndControls(
        state.activeTenant,
        state.closingFolder,
        "delete_success"
      );
      return;
    }

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        manualMappingMutationState: mapManualMappingMutationResult(result),
        manualMappingRefreshPending: false
      };
    });
  }

  function handleWorkpaperNoteChange(anchorCode: string, noteText: string) {
    setState((currentState) => {
      if (
        currentState.kind !== "closing_ready" ||
        currentState.workpapersState.kind !== "ready"
      ) {
        return currentState;
      }

      const item = currentState.workpapersState.workpapers.items.find(
        (candidate) => candidate.anchorCode === anchorCode
      );

      if (item === undefined) {
        return currentState;
      }

      return {
        ...currentState,
        workpaperDrafts: {
          ...currentState.workpaperDrafts,
          [anchorCode]: {
            ...getWorkpaperDraft(currentState.workpaperDrafts, item),
            noteText
          }
        }
      };
    });
  }

  function handleWorkpaperStatusChange(anchorCode: string, status: string) {
    if (!isMakerWorkpaperStatus(status)) {
      return;
    }

    setState((currentState) => {
      if (
        currentState.kind !== "closing_ready" ||
        currentState.workpapersState.kind !== "ready"
      ) {
        return currentState;
      }

      const item = currentState.workpapersState.workpapers.items.find(
        (candidate) => candidate.anchorCode === anchorCode
      );

      if (item === undefined) {
        return currentState;
      }

      return {
        ...currentState,
        workpaperDrafts: {
          ...currentState.workpaperDrafts,
          [anchorCode]: {
            ...getWorkpaperDraft(currentState.workpaperDrafts, item),
            status
          }
        }
      };
    });
  }

  function handleDocumentUploadFileChange(
    anchorCode: string,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = event.currentTarget.files;
    const selectedFileCount = files?.length ?? 0;
    const selectedFile = selectedFileCount === 1 ? (files?.[0] ?? null) : null;

    setState((currentState) => {
      if (
        currentState.kind !== "closing_ready" ||
        currentState.workpapersState.kind !== "ready"
      ) {
        return currentState;
      }

      const item = currentState.workpapersState.workpapers.items.find(
        (candidate) => candidate.anchorCode === anchorCode
      );

      if (item === undefined) {
        return currentState;
      }

      return {
        ...currentState,
        documentUploadDrafts: {
          ...currentState.documentUploadDrafts,
          [anchorCode]: {
            ...getDocumentUploadDraft(currentState.documentUploadDrafts, item),
            file: selectedFile,
            selectedFileCount
          }
        },
        documentUploadState: clearDocumentUploadStateForAnchor(
          currentState.documentUploadState,
          anchorCode
        )
      };
    });
  }

  function handleDocumentUploadSourceLabelChange(anchorCode: string, sourceLabel: string) {
    setState((currentState) => {
      if (
        currentState.kind !== "closing_ready" ||
        currentState.workpapersState.kind !== "ready"
      ) {
        return currentState;
      }

      const item = currentState.workpapersState.workpapers.items.find(
        (candidate) => candidate.anchorCode === anchorCode
      );

      if (item === undefined) {
        return currentState;
      }

      return {
        ...currentState,
        documentUploadDrafts: {
          ...currentState.documentUploadDrafts,
          [anchorCode]: {
            ...getDocumentUploadDraft(currentState.documentUploadDrafts, item),
            sourceLabel
          }
        },
        documentUploadState: clearDocumentUploadStateForAnchor(
          currentState.documentUploadState,
          anchorCode
        )
      };
    });
  }

  function handleDocumentUploadDateChange(anchorCode: string, documentDate: string) {
    setState((currentState) => {
      if (
        currentState.kind !== "closing_ready" ||
        currentState.workpapersState.kind !== "ready"
      ) {
        return currentState;
      }

      const item = currentState.workpapersState.workpapers.items.find(
        (candidate) => candidate.anchorCode === anchorCode
      );

      if (item === undefined) {
        return currentState;
      }

      return {
        ...currentState,
        documentUploadDrafts: {
          ...currentState.documentUploadDrafts,
          [anchorCode]: {
            ...getDocumentUploadDraft(currentState.documentUploadDrafts, item),
            documentDate
          }
        },
        documentUploadState: clearDocumentUploadStateForAnchor(
          currentState.documentUploadState,
          anchorCode
        )
      };
    });
  }

  async function handleSaveWorkpaper(anchorCode: string) {
    if (state.kind !== "closing_ready" || state.workpapersState.kind !== "ready") {
      return;
    }

    if (documentUploadInFlightRef.current) {
      return;
    }

    if (workpaperMutationInFlightRef.current) {
      return;
    }

    const workpapers = state.workpapersState.workpapers;

    if (workpapers.closingFolderStatus === "ARCHIVED") {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "read_only_archived" }
        };
      });
      return;
    }

    if (workpapers.readiness !== "READY") {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "read_only_not_ready" }
        };
      });
      return;
    }

    if (!hasWorkpaperWritableRole(state.effectiveRoles)) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "read_only_role" }
        };
      });
      return;
    }

    const currentItem = workpapers.items.find((item) => item.anchorCode === anchorCode);

    if (currentItem === undefined) {
      const staleItem = workpapers.staleWorkpapers.find((item) => item.anchorCode === anchorCode);

      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState:
            staleItem === undefined ? { kind: "unexpected" } : { kind: "stale_read_only" }
        };
      });
      return;
    }

    if (!currentItem.isCurrentStructure) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "stale_read_only" }
        };
      });
      return;
    }

    if (!isWorkpaperMakerEditable(currentItem)) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "item_read_only" }
        };
      });
      return;
    }

    const draft = getWorkpaperDraft(state.workpaperDrafts, currentItem);
    const trimmedNoteText = draft.noteText.trim();

    if (!isMakerWorkpaperStatus(draft.status) || trimmedNoteText.length === 0) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "invalid_workpaper" }
        };
      });
      return;
    }

    const evidences = createWorkpaperEvidencePayload(currentItem);

    if (evidences === null) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "invalid_workpapers_payload" }
        };
      });
      return;
    }

    if (currentItem.workpaper !== null && !hasWorkpaperDraftChanges(currentItem, draft)) {
      return;
    }

    workpaperMutationInFlightRef.current = true;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        workpaperMutationState: { kind: "submitting" }
      };
    });

    const result = await upsertWorkpaper(closingFolderId, state.activeTenant, {
      anchorCode,
      noteText: trimmedNoteText,
      status: draft.status,
      evidences
    });

    if (result.kind === "success") {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          workpaperMutationState: { kind: "success", refreshFailed: false }
        };
      });

      await refreshWorkpapersAfterWorkpaperMutation(state.activeTenant, state.closingFolder);
      return;
    }

    workpaperMutationInFlightRef.current = false;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        workpaperMutationState: mapWorkpaperMutationResult(result)
      };
    });
  }

  async function handleDocumentUpload(anchorCode: string) {
    if (state.kind !== "closing_ready" || state.workpapersState.kind !== "ready") {
      return;
    }

    if (workpaperMutationInFlightRef.current || documentUploadInFlightRef.current) {
      return;
    }

    const workpapers = state.workpapersState.workpapers;
    const currentItem = workpapers.items.find((item) => item.anchorCode === anchorCode);

    if (currentItem === undefined || !currentItem.isCurrentStructure) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          documentUploadState: { kind: "unexpected", anchorCode }
        };
      });
      return;
    }

    if (currentItem.workpaper === null) {
      return;
    }

    if (!isWorkpaperDocumentUploadEditable(currentItem)) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          documentUploadState: { kind: "conflict_workpaper_read_only", anchorCode }
        };
      });
      return;
    }

    const draft = getDocumentUploadDraft(state.documentUploadDrafts, currentItem);
    const validation = validateDocumentUploadDraft(draft);

    if (validation.kind !== "valid") {
      return;
    }

    documentUploadInFlightRef.current = true;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        documentUploadState: { kind: "submitting", anchorCode }
      };
    });

    const result = await uploadWorkpaperDocument(closingFolderId, state.activeTenant, {
      anchorCode,
      file: validation.file,
      sourceLabel: validation.sourceLabel,
      documentDate: validation.documentDate
    });

    if (result.kind === "success") {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          documentUploadState: { kind: "success", anchorCode, refreshFailed: false }
        };
      });

      await refreshWorkpapersAfterDocumentUpload(
        state.activeTenant,
        state.closingFolder,
        anchorCode
      );
      return;
    }

    documentUploadInFlightRef.current = false;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        documentUploadState: mapDocumentUploadResult(result, anchorCode)
      };
    });
  }

  async function handleDocumentDownload(documentId: string) {
    if (state.kind !== "closing_ready" || state.workpapersState.kind !== "ready") {
      return;
    }

    if (documentDownloadInFlightRef.current) {
      return;
    }

    if (!hasDocumentReadableRole(state.effectiveRoles)) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          documentDownloadState: { kind: "local_invalid", documentId }
        };
      });
      return;
    }

    const resolvedDocument = findDocumentInWorkpapers(state.workpapersState.workpapers, documentId);

    if (resolvedDocument === null) {
      setState((currentState) => {
        if (currentState.kind !== "closing_ready") {
          return currentState;
        }

        return {
          ...currentState,
          documentDownloadState: { kind: "local_invalid", documentId }
        };
      });
      return;
    }

    documentDownloadInFlightRef.current = true;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        documentDownloadState: { kind: "submitting", documentId }
      };
    });

    const result = await downloadWorkpaperDocument(
      closingFolderId,
      state.activeTenant,
      { documentId }
    );

    if (result.kind === "success") {
      try {
        triggerDocumentDownload(
          result.blob,
          resolveDocumentDownloadMediaType(
            result.contentType,
            getFallbackDocumentMediaType(resolvedDocument.document)
          ),
          resolveDocumentDownloadFileName(
            result.contentDisposition,
            getFallbackDocumentFileName(resolvedDocument.document),
            documentId
          )
        );

        documentDownloadInFlightRef.current = false;

        setState((currentState) => {
          if (currentState.kind !== "closing_ready") {
            return currentState;
          }

          return {
            ...currentState,
            documentDownloadState: { kind: "idle" }
          };
        });
        return;
      } catch {
        documentDownloadInFlightRef.current = false;

        setState((currentState) => {
          if (currentState.kind !== "closing_ready") {
            return currentState;
          }

          return {
            ...currentState,
            documentDownloadState: { kind: "unexpected", documentId }
          };
        });
        return;
      }
    }

    documentDownloadInFlightRef.current = false;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        documentDownloadState: mapDocumentDownloadResult(result, documentId)
      };
    });
  }

  async function refreshWorkpapersAfterWorkpaperMutation(
    activeTenant: ActiveTenant,
    closingFolder: ClosingFolderSummary
  ) {
    const refreshedWorkpapersState = await loadWorkpapersShellState(
      closingFolderId,
      closingFolder,
      activeTenant
    );

    workpaperMutationInFlightRef.current = false;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      if (refreshedWorkpapersState.kind !== "ready") {
        return {
          ...currentState,
          workpaperMutationState: { kind: "success", refreshFailed: true }
        };
      }

      return {
        ...currentState,
        workpapersState: refreshedWorkpapersState,
        workpaperDrafts: createWorkpaperDrafts(refreshedWorkpapersState.workpapers),
        documentUploadDrafts: createDocumentUploadDrafts(refreshedWorkpapersState.workpapers),
        workpaperMutationState: { kind: "success", refreshFailed: false },
        documentUploadState: { kind: "idle" }
      };
    });
  }

  async function refreshWorkpapersAfterDocumentUpload(
    activeTenant: ActiveTenant,
    closingFolder: ClosingFolderSummary,
    anchorCode: string
  ) {
    const refreshedWorkpapersState = await loadWorkpapersShellState(
      closingFolderId,
      closingFolder,
      activeTenant
    );

    documentUploadInFlightRef.current = false;

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      if (refreshedWorkpapersState.kind !== "ready") {
        return {
          ...currentState,
          documentUploadState: { kind: "success", anchorCode, refreshFailed: true }
        };
      }

      return {
        ...currentState,
        workpapersState: refreshedWorkpapersState,
        workpaperDrafts: createWorkpaperDrafts(refreshedWorkpapersState.workpapers),
        documentUploadDrafts: createDocumentUploadDrafts(refreshedWorkpapersState.workpapers),
        documentUploadState: { kind: "success", anchorCode, refreshFailed: false }
      };
    });
  }

  async function refreshManualMappingAndControls(
    activeTenant: ActiveTenant,
    closingFolder: ClosingFolderSummary,
    successKind: Extract<ManualMappingMutationState, { kind: "put_success" | "delete_success" }>["kind"]
  ) {
    const [refreshedManualMappingState, refreshedControlsState] = await Promise.all([
      loadManualMappingShellState(closingFolderId, closingFolder, activeTenant),
      loadControlsShellState(closingFolderId, closingFolder, activeTenant)
    ]);

    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        controlsState:
          refreshedControlsState.kind === "ready"
            ? refreshedControlsState
            : currentState.controlsState,
        manualMappingState:
          refreshedManualMappingState.kind === "ready"
            ? refreshedManualMappingState
            : currentState.manualMappingState,
        manualMappingSelectedTargets:
          refreshedManualMappingState.kind === "ready"
            ? createManualMappingSelectedTargets(refreshedManualMappingState.projection)
            : currentState.manualMappingSelectedTargets,
        manualMappingMutationState: {
          kind: successKind,
          refreshMappingFailed: refreshedManualMappingState.kind !== "ready",
          refreshControlsFailed: refreshedControlsState.kind !== "ready"
        },
        manualMappingRefreshPending: false
      };
    });
  }

  const tenant =
    "activeTenant" in state
      ? {
          tenantName: state.activeTenant.tenantName,
          tenantSlug: state.activeTenant.tenantSlug
        }
      : undefined;

  return (
    <AppShell
      actionZone={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium text-foreground">Zone d action</p>
            <p className="text-muted-foreground">import CSV borne</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Retour dossiers</Link>
          </Button>
        </div>
      }
      breadcrumb={[
        { label: "Dossiers de closing", href: "/" },
        { label: "Dossier" }
      ]}
      description="Shell produit borne a GET /api/me, GET /api/closing-folders/{id}, GET /api/closing-folders/{closingFolderId}/controls, GET /api/closing-folders/{closingFolderId}/mappings/manual, GET /api/closing-folders/{closingFolderId}/financial-summary, GET /api/closing-folders/{closingFolderId}/financial-statements/structured, GET /api/closing-folders/{closingFolderId}/workpapers, PUT /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}, POST /api/closing-folders/{closingFolderId}/workpapers/{anchorCode}/documents, GET /api/closing-folders/{closingFolderId}/documents/{documentId}/content puis POST /api/closing-folders/{closingFolderId}/imports/balance."
      eyebrow="Route shell produit"
      sidebarItems={[
        { href: "/", label: "Dossiers" },
        { href: `/closing-folders/${closingFolderId}`, label: "Dossier" }
      ]}
      tenant={tenant}
      title="Dossier de closing"
    >
      {state.kind === "closing_ready" ? (
        <div className="grid gap-6">
          <section className="panel p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Dossier courant</p>
                <h3 className="text-xl font-semibold text-foreground">{state.closingFolder.name}</h3>
              </div>
              <dl className="grid gap-4 md:grid-cols-2">
                <DetailItem label="Status">
                  <WorkflowBadge status={state.closingFolder.status} />
                </DetailItem>
                <DetailItem label="External ref">
                  <span>{formatOptionalText(state.closingFolder.externalRef)}</span>
                </DetailItem>
                <DetailItem label="Period start on">
                  <span>{formatLocalDate(state.closingFolder.periodStartOn)}</span>
                </DetailItem>
                <DetailItem label="Period end on">
                  <span>{formatLocalDate(state.closingFolder.periodEndOn)}</span>
                </DetailItem>
              </dl>
            </div>
          </section>

          <section className="panel p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Import balance</p>
                <h3 className="text-xl font-semibold text-foreground">Upload CSV</h3>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="balance-import-file">
                      Fichier CSV
                    </label>
                    <Input
                      accept=".csv,text/csv"
                      disabled={
                        state.closingFolder.status === "ARCHIVED" ||
                        state.importState.kind === "uploading" ||
                        state.importState.kind === "conflict_archived"
                      }
                      id="balance-import-file"
                      onChange={handleImportFileSelection}
                      ref={fileInputRef}
                      type="file"
                    />
                  </div>
                  <Button
                    disabled={!canImportBalance(state)}
                    onClick={() => {
                      void handleImportBalance();
                    }}
                    type="button"
                  >
                    Importer la balance
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">CSV uniquement</p>
                <ImportBalanceStatus
                  closingFolder={state.closingFolder}
                  importState={state.importState}
                  selectedImportFile={state.selectedImportFile}
                />
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Mapping manuel</p>
                <h3 className="text-xl font-semibold text-foreground">Projection du dernier import</h3>
              </div>
              <ManualMappingSlot
                closingFolder={state.closingFolder}
                effectiveRoles={state.effectiveRoles}
                manualMappingMutationState={state.manualMappingMutationState}
                manualMappingRefreshPending={state.manualMappingRefreshPending}
                selectedTargets={state.manualMappingSelectedTargets}
                state={state.manualMappingState}
                onDelete={handleDeleteManualMapping}
                onSave={handleSaveManualMapping}
                onTargetChange={handleManualMappingTargetChange}
              />
            </div>
          </section>

          <section className="panel p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Controles</p>
                <h3 className="text-xl font-semibold text-foreground">Cockpit read-only</h3>
              </div>
              <ControlsSlot state={state.controlsState} />
            </div>
          </section>

          <section className="panel p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Financial summary</p>
                <h3 className="text-xl font-semibold text-foreground">Preview read-only</h3>
              </div>
              <FinancialSummarySlot state={state.financialSummaryState} />
            </div>
          </section>

          <section className="panel p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Financial statements structured</p>
                <h3 className="text-xl font-semibold text-foreground">Preview read-only</h3>
              </div>
              <FinancialStatementsStructuredSlot
                state={state.financialStatementsStructuredState}
              />
            </div>
          </section>

          <section className="panel p-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Workpapers</p>
                <h3 className="text-xl font-semibold text-foreground">Maker update unitaire</h3>
              </div>
              <WorkpapersSlot
                documentDownloadState={state.documentDownloadState}
                documentUploadDrafts={state.documentUploadDrafts}
                documentUploadState={state.documentUploadState}
                effectiveRoles={state.effectiveRoles}
                onDocumentDownload={handleDocumentDownload}
                mutationState={state.workpaperMutationState}
                onDocumentDateChange={handleDocumentUploadDateChange}
                onDocumentFileChange={handleDocumentUploadFileChange}
                onDocumentUpload={handleDocumentUpload}
                onDocumentUploadSourceLabelChange={handleDocumentUploadSourceLabelChange}
                onNoteChange={handleWorkpaperNoteChange}
                onSave={handleSaveWorkpaper}
                onStatusChange={handleWorkpaperStatusChange}
                state={state.workpapersState}
                workpaperDrafts={state.workpaperDrafts}
              />
            </div>
          </section>
        </div>
      ) : (
        <section className="panel p-6">
          {state.kind === "loading" ? <StateMessage text="chargement dossier" /> : null}
          {state.kind === "auth_required" ? <StateMessage text="authentification requise" /> : null}
          {state.kind === "tenant_context_required" ? (
            <StateMessage text="contexte tenant requis" />
          ) : null}
          {state.kind === "profile_unavailable" ? (
            <StateMessage text="profil indisponible" />
          ) : null}
          {state.kind === "closing_auth_required" ? (
            <StateMessage text="authentification requise" />
          ) : null}
          {state.kind === "closing_forbidden" ? (
            <StateMessage text="acces dossier refuse" />
          ) : null}
          {state.kind === "closing_not_found" ? <StateMessage text="dossier introuvable" /> : null}
          {state.kind === "closing_unavailable" ? (
            <StateMessage text="dossier indisponible" />
          ) : null}
          {state.kind === "closing_tenant_mismatch" ? (
            <StateMessage text="incoherence tenant dossier" />
          ) : null}
        </section>
      )}
    </AppShell>
  );
}

function ClosingFoldersSlot({ state }: { state: EntrypointListState }) {
  if (state.kind === "list_loading") {
    return <StateMessage text="chargement dossiers" />;
  }

  if (state.kind === "list_auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (state.kind === "list_forbidden") {
    return <StateMessage text="acces dossiers refuse" />;
  }

  if (state.kind === "list_unavailable") {
    return <StateMessage text="dossiers indisponibles" />;
  }

  if (state.kind === "list_empty") {
    return <StateMessage text="aucun dossier de closing" />;
  }

  return (
    <ul className="grid gap-4" aria-label="liste dossiers">
      {state.closingFolders.map((closingFolder) => (
        <li key={closingFolder.id}>
          <ClosingFolderListCard closingFolder={closingFolder} />
        </li>
      ))}
    </ul>
  );
}

function ClosingFolderListCard({ closingFolder }: { closingFolder: ClosingFolderListItem }) {
  return (
    <article className="rounded-xl border bg-background/80 p-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <p className="text-lg font-semibold text-foreground">{closingFolder.name}</p>
          </div>
          <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DetailItem label="Statut">
              <WorkflowBadge status={closingFolder.status} />
            </DetailItem>
            <DetailItem label="Periode">
              <span>{formatClosingPeriod(closingFolder.periodStartOn, closingFolder.periodEndOn)}</span>
            </DetailItem>
            <DetailItem label="Reference externe">
              <span>{formatClosingFolderExternalRef(closingFolder.externalRef)}</span>
            </DetailItem>
            {closingFolder.archivedAt !== null ? (
              <DetailItem label="Archive">
                <span>{formatArchivedAt(closingFolder.archivedAt)}</span>
              </DetailItem>
            ) : null}
          </dl>
        </div>
        <div className="flex items-start lg:justify-end">
          <Button asChild size="sm" variant="outline">
            <Link to={`/closing-folders/${closingFolder.id}`}>Ouvrir</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}

function ControlsSlot({ state }: { state: ControlsShellState }) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement controls" />;
  }

  if (state.kind === "auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (state.kind === "forbidden") {
    return <StateMessage text="acces controls refuse" />;
  }

  if (state.kind === "not_found") {
    return <StateMessage text="controls introuvables" />;
  }

  if (state.kind === "server_error") {
    return <StateMessage text="erreur serveur controls" />;
  }

  if (state.kind === "network_error") {
    return <StateMessage text="erreur reseau controls" />;
  }

  if (state.kind === "timeout") {
    return <StateMessage text="timeout controls" />;
  }

  if (state.kind === "invalid_payload") {
    return <StateMessage text="payload controls invalide" />;
  }

  if (state.kind === "unexpected") {
    return <StateMessage text="controles indisponibles" />;
  }

  return <ControlsNominalBlocks controls={state.controls} />;
}

function FinancialSummarySlot({ state }: { state: FinancialSummaryShellState }) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement financial summary" />;
  }

  if (state.kind === "auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (state.kind === "forbidden") {
    return <StateMessage text="acces financial summary refuse" />;
  }

  if (state.kind === "not_found") {
    return <StateMessage text="financial summary introuvable" />;
  }

  if (state.kind === "server_error") {
    return <StateMessage text="erreur serveur financial summary" />;
  }

  if (state.kind === "network_error") {
    return <StateMessage text="erreur reseau financial summary" />;
  }

  if (state.kind === "timeout") {
    return <StateMessage text="timeout financial summary" />;
  }

  if (state.kind === "invalid_payload") {
    return <StateMessage text="payload financial summary invalide" />;
  }

  if (state.kind === "bad_request" || state.kind === "unexpected") {
    return <StateMessage text="financial summary indisponible" />;
  }

  return <FinancialSummaryNominalBlocks summary={state.summary} />;
}

function FinancialStatementsStructuredSlot({
  state
}: {
  state: FinancialStatementsStructuredShellState;
}) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement structured preview" />;
  }

  if (state.kind === "auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (state.kind === "forbidden") {
    return <StateMessage text="acces financial statements structured refuse" />;
  }

  if (state.kind === "not_found") {
    return <StateMessage text="financial statements structured introuvable" />;
  }

  if (state.kind === "server_error") {
    return <StateMessage text="erreur serveur financial statements structured" />;
  }

  if (state.kind === "network_error") {
    return <StateMessage text="erreur reseau financial statements structured" />;
  }

  if (state.kind === "timeout") {
    return <StateMessage text="timeout financial statements structured" />;
  }

  if (state.kind === "invalid_payload") {
    return <StateMessage text="payload financial statements structured invalide" />;
  }

  if (state.kind === "bad_request" || state.kind === "unexpected") {
    return <StateMessage text="financial statements structured indisponible" />;
  }

  return (
    <FinancialStatementsStructuredNominalBlocks
      financialStatements={state.financialStatements}
    />
  );
}

function WorkpapersSlot({
  documentDownloadState,
  documentUploadDrafts,
  documentUploadState,
  effectiveRoles,
  state,
  workpaperDrafts,
  mutationState,
  onDocumentDownload,
  onDocumentDateChange,
  onDocumentFileChange,
  onDocumentUpload,
  onDocumentUploadSourceLabelChange,
  onNoteChange,
  onStatusChange,
  onSave
}: {
  documentDownloadState: DocumentDownloadState;
  documentUploadDrafts: Record<string, DocumentUploadDraft>;
  documentUploadState: DocumentUploadState;
  effectiveRoles: EffectiveRolesHint;
  state: WorkpapersShellState;
  workpaperDrafts: Record<string, WorkpaperDraft>;
  mutationState: WorkpaperMutationState;
  onDocumentDownload: (documentId: string) => void;
  onDocumentDateChange: (anchorCode: string, documentDate: string) => void;
  onDocumentFileChange: (anchorCode: string, event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentUpload: (anchorCode: string) => void;
  onDocumentUploadSourceLabelChange: (anchorCode: string, sourceLabel: string) => void;
  onNoteChange: (anchorCode: string, noteText: string) => void;
  onStatusChange: (anchorCode: string, status: string) => void;
  onSave: (anchorCode: string) => void;
}) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement workpapers" />;
  }

  if (state.kind === "auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (state.kind === "forbidden") {
    return <StateMessage text="acces workpapers refuse" />;
  }

  if (state.kind === "not_found") {
    return <StateMessage text="workpapers introuvables" />;
  }

  if (state.kind === "server_error") {
    return <StateMessage text="erreur serveur workpapers" />;
  }

  if (state.kind === "network_error") {
    return <StateMessage text="erreur reseau workpapers" />;
  }

  if (state.kind === "timeout") {
    return <StateMessage text="timeout workpapers" />;
  }

  if (state.kind === "invalid_payload") {
    return <StateMessage text="payload workpapers invalide" />;
  }

  if (state.kind === "bad_request" || state.kind === "unexpected") {
    return <StateMessage text="workpapers indisponibles" />;
  }

  return (
    <WorkpapersNominalBlocks
      documentDownloadState={documentDownloadState}
      documentUploadDrafts={documentUploadDrafts}
      documentUploadState={documentUploadState}
      effectiveRoles={effectiveRoles}
      mutationState={mutationState}
      onDocumentDownload={onDocumentDownload}
      onDocumentDateChange={onDocumentDateChange}
      onDocumentFileChange={onDocumentFileChange}
      onDocumentUpload={onDocumentUpload}
      onDocumentUploadSourceLabelChange={onDocumentUploadSourceLabelChange}
      onNoteChange={onNoteChange}
      onSave={onSave}
      onStatusChange={onStatusChange}
      workpaperDrafts={workpaperDrafts}
      workpapers={state.workpapers}
    />
  );
}

function ImportBalanceStatus({
  closingFolder,
  importState,
  selectedImportFile
}: {
  closingFolder: ClosingFolderSummary;
  importState: ImportBalanceState;
  selectedImportFile: File | null;
}) {
  const archived =
    closingFolder.status === "ARCHIVED" || importState.kind === "conflict_archived";

  if (archived) {
    return <StateMessage text="dossier archive, import impossible" />;
  }

  if (importState.kind === "uploading") {
    return <StateMessage text="import balance en cours" />;
  }

  if (importState.kind === "success") {
    return (
      <div aria-live="polite" className="grid gap-2">
        <p className="label-eyebrow">Etat visible</p>
        <p className="text-lg font-semibold text-foreground">balance importee avec succes</p>
        <p className="text-sm font-medium text-foreground">version import : {importState.version}</p>
        <p className="text-sm font-medium text-foreground">lignes importees : {importState.rowCount}</p>
        {importState.refreshStatus === "closing_failed" ? (
          <p className="text-sm font-medium text-foreground">rafraichissement dossier impossible</p>
        ) : null}
        {importState.refreshStatus === "controls_failed" ? (
          <p className="text-sm font-medium text-foreground">rafraichissement controls impossible</p>
        ) : null}
      </div>
    );
  }

  if (importState.kind === "bad_request") {
    return (
      <div aria-live="polite" className="grid gap-2">
        <p className="label-eyebrow">Etat visible</p>
        <p className="text-lg font-semibold text-foreground">import invalide</p>
        <p className="text-sm font-medium text-foreground">{importState.message}</p>
        {importState.errors.length > 0 ? (
          <ul className="grid gap-1">
            {importState.errors.map((error, index) => (
              <li className="text-sm text-foreground" key={`${index}-${error.message}`}>
                {formatImportValidationError(error)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  if (importState.kind === "auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (importState.kind === "forbidden") {
    return <StateMessage text="acces import refuse" />;
  }

  if (importState.kind === "not_found") {
    return <StateMessage text="dossier introuvable" />;
  }

  if (importState.kind === "server_error") {
    return <StateMessage text="erreur serveur import" />;
  }

  if (importState.kind === "network_error") {
    return <StateMessage text="erreur reseau import" />;
  }

  if (importState.kind === "timeout") {
    return <StateMessage text="timeout import" />;
  }

  if (importState.kind === "invalid_payload") {
    return <StateMessage text="payload import invalide" />;
  }

  if (importState.kind === "unexpected") {
    return <StateMessage text="import indisponible" />;
  }

  if (selectedImportFile === null) {
    return <StateMessage text="aucun fichier selectionne" />;
  }

  if (!hasCsvFileExtension(selectedImportFile.name)) {
    return <StateMessage text="fichier CSV requis" />;
  }

  return <StateMessage text={`fichier pret : ${selectedImportFile.name}`} />;
}

function ManualMappingSlot({
  closingFolder,
  effectiveRoles,
  state,
  selectedTargets,
  manualMappingMutationState,
  manualMappingRefreshPending,
  onTargetChange,
  onSave,
  onDelete
}: {
  closingFolder: ClosingFolderSummary;
  effectiveRoles: EffectiveRolesHint;
  state: ManualMappingShellState;
  selectedTargets: Record<string, string | undefined>;
  manualMappingMutationState: ManualMappingMutationState;
  manualMappingRefreshPending: boolean;
  onTargetChange: (accountCode: string, targetCode: string) => void;
  onSave: (accountCode: string) => void;
  onDelete: (accountCode: string) => void;
}) {
  if (state.kind === "loading") {
    return <StateMessage text="chargement mapping manuel" />;
  }

  if (state.kind === "auth_required") {
    return <StateMessage text="authentification requise" />;
  }

  if (state.kind === "forbidden") {
    return <StateMessage text="acces mapping refuse" />;
  }

  if (state.kind === "not_found") {
    return <StateMessage text="mapping introuvable" />;
  }

  if (state.kind === "server_error") {
    return <StateMessage text="erreur serveur mapping" />;
  }

  if (state.kind === "network_error") {
    return <StateMessage text="erreur reseau mapping" />;
  }

  if (state.kind === "timeout") {
    return <StateMessage text="timeout mapping" />;
  }

  if (state.kind === "invalid_payload") {
    return <StateMessage text="payload mapping invalide" />;
  }

  if (state.kind === "unexpected") {
    return <StateMessage text="mapping indisponible" />;
  }

  const mappingReadOnlyMessage = getManualMappingReadOnlyMessage(
    closingFolder,
    effectiveRoles,
    state.projection
  );
  const writable = isManualMappingWritable(closingFolder, effectiveRoles, state.projection);
  const controlsDisabled = !writable || manualMappingRefreshPending;
  const targetLabelByCode = createTargetLabelByCode(state.projection);
  const selectableTargets = state.projection.targets.filter((target) => target.selectable);

  return (
    <div className="grid gap-4">
      <ControlsBlock title="Resume mapping">
        <dl className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricItem
            label="version d import"
            value={
              state.projection.latestImportVersion === null
                ? "aucune"
                : String(state.projection.latestImportVersion)
            }
          />
          <MetricItem label="comptes total" value={String(state.projection.summary.total)} />
          <MetricItem label="comptes mappes" value={String(state.projection.summary.mapped)} />
          <MetricItem
            label="comptes non mappes"
            value={String(state.projection.summary.unmapped)}
          />
        </dl>
      </ControlsBlock>

      {mappingReadOnlyMessage !== null ? (
        <p className="text-sm font-medium text-foreground">{mappingReadOnlyMessage}</p>
      ) : null}

      <ManualMappingMutationStatus state={manualMappingMutationState} />

      <ControlsBlock title="Lignes a mapper">
        {state.projection.lines.length === 0 ? (
          <p className="text-sm font-medium text-foreground">aucune ligne a mapper</p>
        ) : (
          <ul className="grid gap-4">
            {state.projection.lines.map((line) => {
              const currentMapping = findManualMappingForAccount(state.projection, line.accountCode);
              const selectedTargetCode = selectedTargets[line.accountCode] ?? "";
              const saveDisabled =
                controlsDisabled ||
                selectedTargetCode === "" ||
                currentMapping?.targetCode === selectedTargetCode;
              const deleteDisabled = controlsDisabled || currentMapping === undefined;

              return (
                <li key={line.accountCode}>
                  <article
                    aria-label={`ligne mapping ${line.accountCode}`}
                    className="rounded-lg border bg-background/80 p-4"
                  >
                    <div className="grid gap-4">
                      <dl className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                        <DetailItem label="Compte">
                          <span className="tabular-nums">{line.accountCode}</span>
                        </DetailItem>
                        <DetailItem label="Libelle">
                          <span>{line.accountLabel}</span>
                        </DetailItem>
                        <DetailItem label="Debit">
                          <span className="tabular-nums">{line.debit}</span>
                        </DetailItem>
                        <DetailItem label="Credit">
                          <span className="tabular-nums">{line.credit}</span>
                        </DetailItem>
                        <DetailItem label="Mapping courant">
                          <span>
                            {currentMapping === undefined
                              ? "aucun"
                              : `${targetLabelByCode.get(currentMapping.targetCode)} (${currentMapping.targetCode})`}
                          </span>
                        </DetailItem>
                      </dl>

                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
                        <div className="grid gap-2">
                          <label
                            className="text-sm font-medium text-foreground"
                            htmlFor={`mapping-target-${line.accountCode}`}
                          >
                            Cible
                          </label>
                          <select
                            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                            disabled={controlsDisabled}
                            id={`mapping-target-${line.accountCode}`}
                            onChange={(event) => {
                              onTargetChange(line.accountCode, event.currentTarget.value);
                            }}
                            value={selectedTargetCode}
                          >
                            <option value="">Choisir une cible</option>
                            {selectableTargets.map((target) => (
                              <option key={target.code} value={target.code}>
                                {formatManualMappingTargetOption(target.label, target.code)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <Button
                          disabled={saveDisabled}
                          onClick={() => {
                            void onSave(line.accountCode);
                          }}
                          type="button"
                        >
                          Enregistrer le mapping
                        </Button>

                        <Button
                          disabled={deleteDisabled}
                          onClick={() => {
                            void onDelete(line.accountCode);
                          }}
                          type="button"
                          variant="outline"
                        >
                          Supprimer le mapping
                        </Button>
                      </div>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </ControlsBlock>
    </div>
  );
}

function ManualMappingMutationStatus({ state }: { state: ManualMappingMutationState }) {
  if (state.kind === "idle") {
    return null;
  }

  if (state.kind === "put_success" || state.kind === "delete_success") {
    return (
      <div aria-live="polite" className="grid gap-2">
        <p className="label-eyebrow">Etat visible</p>
        <p className="text-lg font-semibold text-foreground">
          {state.kind === "put_success"
            ? "mapping enregistre avec succes"
            : "mapping supprime avec succes"}
        </p>
        {state.refreshMappingFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement mapping impossible</p>
        ) : null}
        {state.refreshControlsFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement controls impossible</p>
        ) : null}
      </div>
    );
  }

  return <StateMessage text={formatManualMappingMutationState(state)} />;
}

function WorkpaperMutationStatus({ state }: { state: WorkpaperMutationState }) {
  if (state.kind === "idle") {
    return null;
  }

  return (
    <ControlsBlock title="Etat mutation workpaper">
      {state.kind === "success" ? (
        <div aria-live="polite" className="grid gap-2">
          <p className="label-eyebrow">Etat visible</p>
          <p className="text-lg font-semibold text-foreground">
            workpaper enregistre avec succes
          </p>
          {state.refreshFailed ? (
            <p className="text-sm font-medium text-foreground">
              rafraichissement workpapers impossible
            </p>
          ) : null}
        </div>
      ) : (
        <StateMessage text={formatWorkpaperMutationState(state)} />
      )}
    </ControlsBlock>
  );
}

function ControlsNominalBlocks({ controls }: { controls: ClosingControlsSummary }) {
  return (
    <div className="grid gap-4">
      <ControlsBlock title="Readiness">
        <dl className="grid gap-3 md:grid-cols-2">
          <MetricItem label="readiness" value={controls.readiness === "READY" ? "pret" : "bloque"} />
          <MetricItem
            label="dernier import valide"
            value={controls.latestImportPresent ? "present" : "absent"}
          />
          <MetricItem
            label="version d import"
            value={controls.latestImportVersion === null ? "aucune" : String(controls.latestImportVersion)}
          />
          <MetricItem label="comptes total" value={String(controls.mappingSummary.total)} />
          <MetricItem label="comptes mappes" value={String(controls.mappingSummary.mapped)} />
          <MetricItem label="comptes non mappes" value={String(controls.mappingSummary.unmapped)} />
        </dl>
      </ControlsBlock>

      <ControlsBlock title="Controles">
        <ul className="grid gap-3">
          {controls.controls.map((control) => (
            <li className="rounded-lg border bg-muted/20 p-4" key={control.code}>
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="grid gap-1">
                  <p className="text-sm font-semibold text-foreground">{controlLabelByCode[control.code]}</p>
                  <p className="text-sm text-muted-foreground">{control.message}</p>
                </div>
                <ControlStatusBadge status={control.status} />
              </div>
            </li>
          ))}
        </ul>
      </ControlsBlock>

      <ControlsBlock title="Prochaine action">
        {controls.nextAction === null ? (
          <p className="text-sm font-medium text-foreground">aucune action requise</p>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-foreground">
              {nextActionLabelByCode[controls.nextAction.code]}
            </p>
            <dl className="grid gap-3 md:grid-cols-2">
              <MetricItem label="action possible" value={controls.nextAction.actionable ? "oui" : "non"} />
              <MetricItem label="cible technique" mono value={controls.nextAction.path} />
            </dl>
          </div>
        )}
      </ControlsBlock>

      <ControlsBlock title="Comptes non mappes">
        {controls.unmappedAccounts.length === 0 ? (
          <p className="text-sm font-medium text-foreground">aucun compte non mappe</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-4 py-3 font-semibold text-foreground" scope="col">
                    Compte
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground" scope="col">
                    Libelle
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground" scope="col">
                    Debit
                  </th>
                  <th className="px-4 py-3 font-semibold text-foreground" scope="col">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody>
                {controls.unmappedAccounts.map((account) => (
                  <tr className="border-t" key={`${account.accountCode}-${account.accountLabel}`}>
                    <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                      {account.accountCode}
                    </td>
                    <td className="px-4 py-3 text-foreground">{account.accountLabel}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{account.debit}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{account.credit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ControlsBlock>
    </div>
  );
}

function FinancialSummaryNominalBlocks({ summary }: { summary: FinancialSummaryPreview }) {
  const previewStateLabel =
    summary.statementState === "NO_DATA"
      ? "aucune donnee"
      : summary.statementState === "PREVIEW_PARTIAL"
        ? "preview partielle"
        : "preview prete";

  const previewLines = [
    `etat preview : ${previewStateLabel}`,
    `version d import : ${summary.latestImportVersion === null ? "aucune" : String(summary.latestImportVersion)}`,
    `lignes total : ${summary.coverage.totalLines}`,
    `lignes mappees : ${summary.coverage.mappedLines}`,
    `lignes non mappees : ${summary.coverage.unmappedLines}`,
    `part mappee : ${summary.coverage.mappedShare}`,
    `impact non mappe debit : ${summary.unmappedBalanceImpact.debitTotal}`,
    `impact non mappe credit : ${summary.unmappedBalanceImpact.creditTotal}`,
    `impact non mappe net : ${summary.unmappedBalanceImpact.netDebitMinusCredit}`
  ];

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
        Preview non statutaire. Ne pas utiliser comme export final, annexe officielle ou
        document CO.
      </p>

      <ControlsBlock title="Etat preview">
        <ReadonlyLineList lines={previewLines} />
        {summary.statementState === "NO_DATA" ? (
          <p className="text-sm font-medium text-foreground">
            aucune preview financiere disponible
          </p>
        ) : null}
      </ControlsBlock>

      {summary.balanceSheetSummary !== null ? (
        <ControlsBlock title="Bilan synthetique">
          <ReadonlyLineList
            lines={[
              `actifs : ${summary.balanceSheetSummary.assets}`,
              `passifs : ${summary.balanceSheetSummary.liabilities}`,
              `capitaux propres : ${summary.balanceSheetSummary.equity}`,
              `resultat de la periode : ${summary.balanceSheetSummary.currentPeriodResult}`,
              `total actifs : ${summary.balanceSheetSummary.totalAssets}`,
              `total passifs et capitaux propres : ${summary.balanceSheetSummary.totalLiabilitiesAndEquity}`
            ]}
          />
        </ControlsBlock>
      ) : null}

      {summary.incomeStatementSummary !== null ? (
        <ControlsBlock title="Compte de resultat synthetique">
          <ReadonlyLineList
            lines={[
              `produits : ${summary.incomeStatementSummary.revenue}`,
              `charges : ${summary.incomeStatementSummary.expenses}`,
              `resultat net : ${summary.incomeStatementSummary.netResult}`
            ]}
          />
        </ControlsBlock>
      ) : null}
    </div>
  );
}

function FinancialStatementsStructuredNominalBlocks({
  financialStatements
}: {
  financialStatements: StructuredFinancialStatementsPreview;
}) {
  const previewStateLabel =
    financialStatements.statementState === "NO_DATA"
      ? "aucune donnee"
      : financialStatements.statementState === "BLOCKED"
        ? "bloquee"
        : "preview prete";

  const previewLines = [
    `etat structured preview : ${previewStateLabel}`,
    `version d import : ${financialStatements.latestImportVersion === null ? "aucune" : String(financialStatements.latestImportVersion)}`,
    `lignes total : ${financialStatements.coverage.totalLines}`,
    `lignes mappees : ${financialStatements.coverage.mappedLines}`,
    `lignes non mappees : ${financialStatements.coverage.unmappedLines}`,
    `part mappee : ${financialStatements.coverage.mappedShare}`
  ];

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
        Preview structuree non statutaire. Ne pas utiliser comme export final, annexe
        officielle ou document CO.
      </p>

      <ControlsBlock title="Etat structured preview">
        <ReadonlyLineList lines={previewLines} />
        {financialStatements.statementState === "NO_DATA" ? (
          <p className="text-sm font-medium text-foreground">
            aucune preview structuree disponible
          </p>
        ) : null}
        {financialStatements.statementState === "BLOCKED" ? (
          <p className="text-sm font-medium text-foreground">preview structuree bloquee</p>
        ) : null}
      </ControlsBlock>

      {financialStatements.statementState === "PREVIEW_READY" ? (
        <>
          <ControlsBlock title="Bilan structure">
            <StructuredStatementGroupList groups={financialStatements.balanceSheet.groups} />
            <ReadonlyLineList
              lines={[
                `total actifs : ${financialStatements.balanceSheet.totals.totalAssets}`,
                `total passifs : ${financialStatements.balanceSheet.totals.totalLiabilities}`,
                `total capitaux propres : ${financialStatements.balanceSheet.totals.totalEquity}`,
                `resultat de la periode : ${financialStatements.balanceSheet.totals.currentPeriodResult}`,
                `total passifs et capitaux propres : ${financialStatements.balanceSheet.totals.totalLiabilitiesAndEquity}`
              ]}
            />
          </ControlsBlock>

          <ControlsBlock title="Compte de resultat structure">
            <StructuredStatementGroupList groups={financialStatements.incomeStatement.groups} />
            <ReadonlyLineList
              lines={[
                `total produits : ${financialStatements.incomeStatement.totals.totalRevenue}`,
                `total charges : ${financialStatements.incomeStatement.totals.totalExpenses}`,
                `resultat net : ${financialStatements.incomeStatement.totals.netResult}`
              ]}
            />
          </ControlsBlock>
        </>
      ) : null}
    </div>
  );
}

function WorkpapersNominalBlocks({
  documentDownloadState,
  documentUploadDrafts,
  documentUploadState,
  effectiveRoles,
  mutationState,
  onDocumentDownload,
  onDocumentDateChange,
  onDocumentFileChange,
  onDocumentUpload,
  onDocumentUploadSourceLabelChange,
  onNoteChange,
  onSave,
  onStatusChange,
  workpaperDrafts,
  workpapers
}: {
  documentDownloadState: DocumentDownloadState;
  documentUploadDrafts: Record<string, DocumentUploadDraft>;
  documentUploadState: DocumentUploadState;
  effectiveRoles: EffectiveRolesHint;
  mutationState: WorkpaperMutationState;
  onDocumentDownload: (documentId: string) => void;
  onDocumentDateChange: (anchorCode: string, documentDate: string) => void;
  onDocumentFileChange: (anchorCode: string, event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentUpload: (anchorCode: string) => void;
  onDocumentUploadSourceLabelChange: (anchorCode: string, sourceLabel: string) => void;
  onNoteChange: (anchorCode: string, noteText: string) => void;
  onSave: (anchorCode: string) => void;
  onStatusChange: (anchorCode: string, status: string) => void;
  workpaperDrafts: Record<string, WorkpaperDraft>;
  workpapers: ClosingWorkpapersReadModel;
}) {
  const summaryLines = [
    `anchors courants total : ${workpapers.summaryCounts.totalCurrentAnchors}`,
    `anchors avec workpaper : ${workpapers.summaryCounts.withWorkpaperCount}`,
    `workpapers prets pour revue : ${workpapers.summaryCounts.readyForReviewCount}`,
    `workpapers revus : ${workpapers.summaryCounts.reviewedCount}`,
    `workpapers stale : ${workpapers.summaryCounts.staleCount}`,
    `anchors sans workpaper : ${workpapers.summaryCounts.missingCount}`
  ];
  const globalReadOnlyMessage = getWorkpapersGlobalReadOnlyMessage(workpapers, effectiveRoles);
  const makerControlsDisabled =
    mutationState.kind === "submitting" || documentUploadState.kind === "submitting";
  const downloadControlsDisabled = documentDownloadState.kind === "submitting";

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
        Mise a jour maker unitaire sur les workpapers courants uniquement.
      </p>

      <WorkpaperMutationStatus state={mutationState} />

      <ControlsBlock title="Resume workpapers">
        <ReadonlyLineList lines={summaryLines} />
      </ControlsBlock>

      {globalReadOnlyMessage !== null ? (
        <p className="text-sm font-medium text-foreground">{globalReadOnlyMessage}</p>
      ) : null}

      {workpapers.items.length === 0 && workpapers.staleWorkpapers.length === 0 ? (
        <p className="text-sm font-medium text-foreground">aucun workpaper disponible</p>
      ) : null}

      <ControlsBlock title="Workpapers courants">
        {workpapers.items.length === 0 ? (
          <p className="text-sm font-medium text-foreground">aucun workpaper courant</p>
        ) : (
          <ul className="grid gap-4">
            {workpapers.items.map((item) => {
              const draft = getWorkpaperDraft(workpaperDrafts, item);
              const documentUploadDraft = getDocumentUploadDraft(documentUploadDrafts, item);
              const itemReadOnlyMessage = getCurrentWorkpaperReadOnlyMessage(
                item,
                globalReadOnlyMessage
              );
              const uploadAvailabilityMessage = getCurrentWorkpaperUploadAvailabilityMessage(
                item,
                globalReadOnlyMessage
              );
              const showMakerForm =
                globalReadOnlyMessage === null && itemReadOnlyMessage === null;
              const showDocumentUploadSection =
                globalReadOnlyMessage === null && isWorkpaperDocumentUploadEditable(item);

              return (
                <li key={`${item.anchorCode}-current`}>
                  <WorkpaperCard
                    downloadControlsDisabled={downloadControlsDisabled}
                    documentDownloadState={documentDownloadState}
                    documentUploadDraft={showDocumentUploadSection ? documentUploadDraft : null}
                    documentUploadState={documentUploadState}
                    effectiveRoles={effectiveRoles}
                    controlsDisabled={makerControlsDisabled}
                    draft={showMakerForm ? draft : null}
                    item={item}
                    makerReadOnlyMessage={itemReadOnlyMessage}
                    onDocumentDownload={onDocumentDownload}
                    onDocumentDateChange={
                      showDocumentUploadSection ? onDocumentDateChange : undefined
                    }
                    onDocumentFileChange={
                      showDocumentUploadSection ? onDocumentFileChange : undefined
                    }
                    onDocumentUpload={showDocumentUploadSection ? onDocumentUpload : undefined}
                    onDocumentUploadSourceLabelChange={
                      showDocumentUploadSection
                        ? onDocumentUploadSourceLabelChange
                        : undefined
                    }
                    onNoteChange={showMakerForm ? onNoteChange : undefined}
                    onSave={showMakerForm ? onSave : undefined}
                    onStatusChange={showMakerForm ? onStatusChange : undefined}
                    saveDisabled={
                      !showMakerForm ||
                      !canSaveWorkpaperItem(
                        workpapers,
                        effectiveRoles,
                        item,
                        draft,
                        mutationState
                      )
                    }
                    uploadAvailabilityMessage={uploadAvailabilityMessage}
                    uploadDisabled={
                      !showDocumentUploadSection ||
                      !canUploadDocumentItem(
                        workpapers,
                        effectiveRoles,
                        item,
                        documentUploadDraft,
                        mutationState,
                        documentUploadState
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </ControlsBlock>

      {workpapers.staleWorkpapers.length > 0 ? (
        <p className="text-sm font-medium text-foreground">workpapers stale en lecture seule</p>
      ) : null}

      <ControlsBlock title="Workpapers stale">
        {workpapers.staleWorkpapers.length === 0 ? (
          <p className="text-sm font-medium text-foreground">aucun workpaper stale</p>
        ) : (
          <ul className="grid gap-4">
            {workpapers.staleWorkpapers.map((item) => (
              <li key={`${item.anchorCode}-stale`}>
                <WorkpaperCard
                  documentDownloadState={documentDownloadState}
                  downloadControlsDisabled={downloadControlsDisabled}
                  effectiveRoles={effectiveRoles}
                  item={item}
                  onDocumentDownload={onDocumentDownload}
                />
              </li>
            ))}
          </ul>
        )}
      </ControlsBlock>
    </div>
  );
}

function WorkpaperCard({
  controlsDisabled = false,
  documentDownloadState = { kind: "idle" },
  documentUploadDraft = null,
  documentUploadState = { kind: "idle" },
  downloadControlsDisabled = false,
  draft = null,
  effectiveRoles = null,
  item,
  makerReadOnlyMessage = null,
  onDocumentDownload,
  onDocumentDateChange,
  onDocumentFileChange,
  onDocumentUpload,
  onDocumentUploadSourceLabelChange,
  onNoteChange,
  onSave,
  onStatusChange,
  saveDisabled = true,
  uploadAvailabilityMessage = null,
  uploadDisabled = true
}: {
  controlsDisabled?: boolean;
  documentDownloadState?: DocumentDownloadState;
  documentUploadDraft?: DocumentUploadDraft | null;
  documentUploadState?: DocumentUploadState;
  downloadControlsDisabled?: boolean;
  draft?: WorkpaperDraft | null;
  effectiveRoles?: EffectiveRolesHint;
  item: WorkpaperReadModelItem;
  makerReadOnlyMessage?: string | null;
  onDocumentDownload?: (documentId: string) => void;
  onDocumentDateChange?: (anchorCode: string, documentDate: string) => void;
  onDocumentFileChange?: (anchorCode: string, event: ChangeEvent<HTMLInputElement>) => void;
  onDocumentUpload?: (anchorCode: string) => void;
  onDocumentUploadSourceLabelChange?: (anchorCode: string, sourceLabel: string) => void;
  onNoteChange?: (anchorCode: string, noteText: string) => void;
  onSave?: (anchorCode: string) => void;
  onStatusChange?: (anchorCode: string, status: string) => void;
  saveDisabled?: boolean;
  uploadAvailabilityMessage?: string | null;
  uploadDisabled?: boolean;
}) {
  const lines = [
    `anchor code : ${item.anchorCode}`,
    `statement kind : ${item.statementKind}`,
    `breakdown type : ${item.breakdownType}`,
    `etat workpaper : ${item.workpaper === null ? "aucun" : item.workpaper.status}`
  ];
  const canRenderMakerForm =
    draft !== null &&
    makerReadOnlyMessage === null &&
    onNoteChange !== undefined &&
    onSave !== undefined &&
    onStatusChange !== undefined;
  const canRenderDocumentUploadSection =
    documentUploadDraft !== null &&
    onDocumentDateChange !== undefined &&
    onDocumentFileChange !== undefined &&
    onDocumentUpload !== undefined &&
    onDocumentUploadSourceLabelChange !== undefined;
  const documentUploadStatusLines = canRenderDocumentUploadSection
    ? getDocumentUploadStatusLines(item.anchorCode, documentUploadDraft, documentUploadState)
    : [];

  if (item.workpaper !== null) {
    lines.push(`note workpaper : ${item.workpaper.noteText}`);
  }

  return (
    <article
      aria-label={`workpaper ${item.anchorCode}`}
      className="rounded-lg border bg-background/80 p-4"
    >
      <div className="grid gap-4">
        <p className="text-sm font-semibold text-foreground">{item.anchorLabel}</p>
        <ReadonlyLineList lines={lines} />

        {makerReadOnlyMessage !== null ? (
          <p className="text-sm font-medium text-foreground">{makerReadOnlyMessage}</p>
        ) : null}

        {canRenderMakerForm ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor={`workpaper-note-${item.anchorCode}`}
              >
                Note workpaper
                </label>
                <textarea
                  className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                  disabled={controlsDisabled}
                id={`workpaper-note-${item.anchorCode}`}
                onChange={(event) => {
                  onNoteChange(item.anchorCode, event.currentTarget.value);
                }}
                value={draft.noteText}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-status-${item.anchorCode}`}
                >
                  Statut maker
                </label>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted"
                  disabled={controlsDisabled}
                  id={`workpaper-status-${item.anchorCode}`}
                  onChange={(event) => {
                    onStatusChange(item.anchorCode, event.currentTarget.value);
                  }}
                  value={draft.status}
                >
                  <option value="DRAFT">DRAFT</option>
                  <option value="READY_FOR_REVIEW">READY_FOR_REVIEW</option>
                </select>
              </div>

              <Button
                disabled={controlsDisabled || saveDisabled}
                onClick={() => {
                  void onSave(item.anchorCode);
                }}
                type="button"
              >
                Enregistrer le workpaper
              </Button>
            </div>
          </div>
        ) : null}

        {uploadAvailabilityMessage !== null ? (
          <p className="text-sm font-medium text-foreground">{uploadAvailabilityMessage}</p>
        ) : null}

        {canRenderDocumentUploadSection ? (
          <ControlsBlock title="Upload document">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-document-file-${item.anchorCode}`}
                >
                  Fichier document
                </label>
                <Input
                  accept={documentUploadInputAccept}
                  disabled={controlsDisabled}
                  id={`workpaper-document-file-${item.anchorCode}`}
                  onChange={(event) => {
                    onDocumentFileChange(item.anchorCode, event);
                  }}
                  type="file"
                />
              </div>

              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-document-source-${item.anchorCode}`}
                >
                  Source document
                </label>
                <Input
                  disabled={controlsDisabled}
                  id={`workpaper-document-source-${item.anchorCode}`}
                  onChange={(event) => {
                    onDocumentUploadSourceLabelChange(item.anchorCode, event.currentTarget.value);
                  }}
                  type="text"
                  value={documentUploadDraft.sourceLabel}
                />
              </div>

              <div className="grid gap-2">
                <label
                  className="text-sm font-medium text-foreground"
                  htmlFor={`workpaper-document-date-${item.anchorCode}`}
                >
                  Date document
                </label>
                <Input
                  disabled={controlsDisabled}
                  id={`workpaper-document-date-${item.anchorCode}`}
                  onChange={(event) => {
                    onDocumentDateChange(item.anchorCode, event.currentTarget.value);
                  }}
                  type="date"
                  value={documentUploadDraft.documentDate}
                />
              </div>

              <div aria-live="polite" className="grid gap-2">
                {documentUploadStatusLines.map((line) => (
                  <p className="text-sm font-medium text-foreground" key={`${item.anchorCode}-${line}`}>
                    {line}
                  </p>
                ))}
              </div>

              <div>
                <Button
                  disabled={controlsDisabled || uploadDisabled}
                  onClick={() => {
                    void onDocumentUpload(item.anchorCode);
                  }}
                  type="button"
                >
                  Uploader le document
                </Button>
              </div>
            </div>
          </ControlsBlock>
        ) : null}

        <ControlsBlock title="Documents inclus">
          {item.documents.length === 0 ? (
            <p className="text-sm font-medium text-foreground">aucun document inclus</p>
          ) : (
            <ul className="grid gap-3">
              {item.documents.map((document, index) => {
                const documentId = getReadableDocumentId(document);
                const canRenderDownloadButton =
                  documentId !== null &&
                  onDocumentDownload !== undefined &&
                  hasDocumentReadableRole(effectiveRoles);
                const downloadStatusLine = getDocumentDownloadStatusLine(
                  document,
                  documentDownloadState
                );

                return (
                  <li key={`${item.anchorCode}-${index}-${document.fileName}`}>
                    <div className="grid gap-3 rounded-lg border bg-background/80 p-4">
                      <p className="text-sm font-medium tabular-nums text-foreground">
                        {`${document.fileName} | ${document.mediaType} | ${document.sourceLabel} | verification : ${document.verificationStatus}`}
                      </p>

                      {canRenderDownloadButton ? (
                        <div>
                          <Button
                            disabled={downloadControlsDisabled}
                            onClick={() => {
                              void onDocumentDownload(documentId);
                            }}
                            type="button"
                          >
                            Telecharger le document
                          </Button>
                        </div>
                      ) : null}

                      {downloadStatusLine !== null ? (
                        <div aria-live="polite">
                          <p className="text-sm font-medium text-foreground">
                            {downloadStatusLine}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </ControlsBlock>

        {item.documentVerificationSummary !== null ? (
          <ControlsBlock title="Verification documents">
            <ReadonlyLineList
              lines={[
                `documents total : ${item.documentVerificationSummary.documentsCount}`,
                `documents non verifies : ${item.documentVerificationSummary.unverifiedCount}`,
                `documents verifies : ${item.documentVerificationSummary.verifiedCount}`,
                `documents rejetes : ${item.documentVerificationSummary.rejectedCount}`
              ]}
            />
          </ControlsBlock>
        ) : null}
      </div>
    </article>
  );
}

function StructuredStatementGroupList({
  groups
}: {
  groups: ReadonlyArray<{
    code: string;
    label: string;
    total: string;
    breakdowns: ReadonlyArray<{
      code: string;
      label: string;
      breakdownType: string;
      total: string;
    }>;
  }>;
}) {
  return (
    <ul className="grid gap-4">
      {groups.map((group) => (
        <li key={group.code}>
          <article className="rounded-lg border bg-background/80 p-4">
            <div className="grid gap-4">
              <p className="text-sm font-semibold text-foreground">{group.label}</p>
              <ReadonlyLineList
                lines={[
                  `total groupe : ${group.total}`,
                  ...group.breakdowns.map((breakdown) => `${breakdown.label} : ${breakdown.total}`)
                ]}
              />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function ReadonlyLineList({ lines }: { lines: string[] }) {
  return (
    <ul className="grid gap-3">
      {lines.map((line, index) => (
        <li
          className="rounded-lg border bg-background/80 p-4 text-sm font-medium tabular-nums text-foreground"
          key={`${index}-${line}`}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function ControlsBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="grid gap-3">
        <h4 className="text-lg font-semibold text-foreground">{title}</h4>
        {children}
      </div>
    </section>
  );
}

function MetricItem({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background/80 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`mt-2 text-sm font-medium text-foreground ${mono ? "break-all font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}

function ControlStatusBadge({ status }: { status: ControlStatus }) {
  const className =
    status === "PASS"
      ? "border-success/25 bg-success/10 text-success"
      : status === "FAIL"
        ? "border-error/25 bg-error/10 text-error"
        : "border-border bg-background text-muted-foreground";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${className}`}
    >
      {controlStatusLabelByCode[status]}
    </span>
  );
}

function StateMessage({ text }: { text: string }) {
  return (
    <div aria-live="polite" className="grid gap-2">
      <p className="label-eyebrow">Etat visible</p>
      <p className="text-lg font-semibold text-foreground">{text}</p>
    </div>
  );
}

function DetailItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

function formatClosingPeriod(periodStartOn: string, periodEndOn: string) {
  return `${formatLocalDate(periodStartOn)} au ${formatLocalDate(periodEndOn)}`;
}

function formatClosingFolderExternalRef(externalRef: string | null) {
  return externalRef ?? "aucune";
}

function formatArchivedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return localDateTimeFormatter.format(date);
}

function hasActiveTenant(state: EntrypointRouteState): state is EntrypointListState {
  return "activeTenant" in state;
}

function canImportBalance(state: Extract<ClosingRouteState, { kind: "closing_ready" }>) {
  const importBlocked =
    state.closingFolder.status === "ARCHIVED" || state.importState.kind === "conflict_archived";

  if (importBlocked || state.importState.kind === "uploading") {
    return false;
  }

  if (state.selectedImportFile === null) {
    return false;
  }

  return hasCsvFileExtension(state.selectedImportFile.name);
}

function getSingleSelectedFile(files: FileList | null) {
  if (files === null || files.length !== 1) {
    return null;
  }

  return files[0] ?? null;
}

function hasCsvFileExtension(fileName: string) {
  return fileName.toLowerCase().endsWith(".csv");
}

function canWriteManualMapping(state: Extract<ClosingRouteState, { kind: "closing_ready" }>) {
  return isManualMappingWritable(
    state.closingFolder,
    state.effectiveRoles,
    state.manualMappingState.kind === "ready" ? state.manualMappingState.projection : null
  );
}

function isManualMappingWritable(
  closingFolder: ClosingFolderSummary,
  effectiveRoles: EffectiveRolesHint,
  projection: ManualMappingProjection | null
) {
  return (
    projection !== null &&
    closingFolder.status !== "ARCHIVED" &&
    projection.latestImportVersion !== null &&
    hasManualMappingWritableRole(effectiveRoles)
  );
}

function hasManualMappingWritableRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => manualMappingWritableRoles.has(role)) ?? false;
}

function getManualMappingReadOnlyMessage(
  closingFolder: ClosingFolderSummary,
  effectiveRoles: EffectiveRolesHint,
  projection: ManualMappingProjection
) {
  if (closingFolder.status === "ARCHIVED") {
    return "dossier archive, mapping en lecture seule";
  }

  if (projection.latestImportVersion === null) {
    return "import requis";
  }

  if (!hasManualMappingWritableRole(effectiveRoles)) {
    return "lecture seule";
  }

  return null;
}

function createWorkpaperDrafts(workpapers: ClosingWorkpapersReadModel) {
  return Object.fromEntries(
    workpapers.items.map((item) => [item.anchorCode, createWorkpaperDraft(item)])
  ) as Record<string, WorkpaperDraft>;
}

function createDocumentUploadDrafts(workpapers: ClosingWorkpapersReadModel) {
  return Object.fromEntries(
    workpapers.items.map((item) => [item.anchorCode, createDocumentUploadDraft()])
  ) as Record<string, DocumentUploadDraft>;
}

function createWorkpaperDraft(item: WorkpaperReadModelItem): WorkpaperDraft {
  if (item.workpaper === null) {
    return {
      noteText: "",
      status: "DRAFT"
    };
  }

  if (item.workpaper.status === "CHANGES_REQUESTED") {
    return {
      noteText: item.workpaper.noteText,
      status: "DRAFT"
    };
  }

  return {
    noteText: item.workpaper.noteText,
    status: item.workpaper.status === "READY_FOR_REVIEW" ? "READY_FOR_REVIEW" : "DRAFT"
  };
}

function createDocumentUploadDraft(): DocumentUploadDraft {
  return {
    file: null,
    selectedFileCount: 0,
    sourceLabel: "",
    documentDate: ""
  };
}

function getWorkpaperDraft(
  drafts: Record<string, WorkpaperDraft>,
  item: WorkpaperReadModelItem
) {
  return drafts[item.anchorCode] ?? createWorkpaperDraft(item);
}

function getDocumentUploadDraft(
  drafts: Record<string, DocumentUploadDraft>,
  item: WorkpaperReadModelItem
) {
  return drafts[item.anchorCode] ?? createDocumentUploadDraft();
}

function hasWorkpaperWritableRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => workpaperWritableRoles.has(role)) ?? false;
}

function hasDocumentReadableRole(effectiveRoles: EffectiveRolesHint) {
  return effectiveRoles?.some((role) => documentReadableRoles.has(role)) ?? false;
}

function isMakerWorkpaperStatus(value: string): value is MakerWorkpaperStatus {
  return value === "DRAFT" || value === "READY_FOR_REVIEW";
}

function isWorkpaperMakerEditable(item: WorkpaperReadModelItem) {
  return (
    item.workpaper === null ||
    item.workpaper.status === "DRAFT" ||
    item.workpaper.status === "CHANGES_REQUESTED"
  );
}

function isWorkpaperDocumentUploadEditable(item: WorkpaperReadModelItem) {
  return (
    item.isCurrentStructure &&
    item.workpaper !== null &&
    (item.workpaper.status === "DRAFT" || item.workpaper.status === "CHANGES_REQUESTED")
  );
}

function getWorkpapersGlobalReadOnlyMessage(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint
) {
  if (workpapers.closingFolderStatus === "ARCHIVED") {
    return "dossier archive, workpaper en lecture seule";
  }

  if (workpapers.readiness !== "READY") {
    return "workpaper non modifiable tant que les controles ne sont pas READY";
  }

  if (!hasWorkpaperWritableRole(effectiveRoles)) {
    return "lecture seule";
  }

  return null;
}

function getCurrentWorkpaperUploadAvailabilityMessage(
  item: WorkpaperReadModelItem,
  globalReadOnlyMessage: string | null
) {
  if (globalReadOnlyMessage !== null) {
    return null;
  }

  if (item.workpaper === null) {
    return "upload disponible apres creation du workpaper";
  }

  return null;
}

function getCurrentWorkpaperReadOnlyMessage(
  item: WorkpaperReadModelItem,
  globalReadOnlyMessage: string | null
) {
  if (globalReadOnlyMessage !== null) {
    return null;
  }

  if (
    item.workpaper !== null &&
    (item.workpaper.status === "READY_FOR_REVIEW" || item.workpaper.status === "REVIEWED")
  ) {
    return "workpaper en lecture seule";
  }

  return null;
}

function validateDocumentUploadDraft(
  draft: DocumentUploadDraft
):
  | {
      kind: "valid";
      file: File;
      sourceLabel: string;
      documentDate: string | null;
    }
  | { kind: "invalid"; message: string } {
  if (draft.selectedFileCount > 1) {
    return { kind: "invalid", message: "un seul fichier est autorise" };
  }

  if (draft.file === null) {
    return { kind: "invalid", message: "selectionner un fichier" };
  }

  if (!isDocumentUploadFileAllowed(draft.file)) {
    return { kind: "invalid", message: "format de fichier non autorise" };
  }

  if (draft.file.size <= 0) {
    return { kind: "invalid", message: "fichier vide" };
  }

  if (draft.file.size > DOCUMENT_UPLOAD_MAX_BYTES) {
    return { kind: "invalid", message: "fichier trop volumineux (25 MiB max)" };
  }

  const trimmedSourceLabel = draft.sourceLabel.trim();

  if (trimmedSourceLabel.length === 0) {
    return { kind: "invalid", message: "source du document requise" };
  }

  if (draft.documentDate !== "" && !isIsoDateOnly(draft.documentDate)) {
    return { kind: "invalid", message: "date document invalide" };
  }

  return {
    kind: "valid",
    file: draft.file,
    sourceLabel: trimmedSourceLabel,
    documentDate: draft.documentDate === "" ? null : draft.documentDate
  };
}

function createWorkpaperEvidencePayload(item: WorkpaperReadModelItem): WorkpaperEvidence[] | null {
  if (item.workpaper === null) {
    return [];
  }

  const evidences = item.workpaper.evidences;

  if (!Array.isArray(evidences) || !evidences.every(isWorkpaperEvidencePayload)) {
    return null;
  }

  return evidences.map((evidence) => ({
    position: evidence.position,
    fileName: evidence.fileName,
    mediaType: evidence.mediaType,
    documentDate: evidence.documentDate,
    sourceLabel: evidence.sourceLabel,
    verificationStatus: evidence.verificationStatus,
    externalReference: evidence.externalReference,
    checksumSha256: evidence.checksumSha256
  }));
}

function isWorkpaperEvidencePayload(evidence: WorkpaperEvidence) {
  return (
    Number.isInteger(evidence.position) &&
    evidence.position > 0 &&
    typeof evidence.fileName === "string" &&
    typeof evidence.mediaType === "string" &&
    (typeof evidence.documentDate === "string" || evidence.documentDate === null) &&
    typeof evidence.sourceLabel === "string" &&
    (evidence.verificationStatus === "UNVERIFIED" ||
      evidence.verificationStatus === "VERIFIED" ||
      evidence.verificationStatus === "REJECTED") &&
    (typeof evidence.externalReference === "string" || evidence.externalReference === null) &&
    (typeof evidence.checksumSha256 === "string" || evidence.checksumSha256 === null)
  );
}

function hasWorkpaperDraftChanges(item: WorkpaperReadModelItem, draft: WorkpaperDraft) {
  if (item.workpaper === null) {
    return true;
  }

  return (
    draft.noteText.trim() !== item.workpaper.noteText || draft.status !== item.workpaper.status
  );
}

function canUploadDocumentItem(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint,
  item: WorkpaperReadModelItem,
  draft: DocumentUploadDraft,
  mutationState: WorkpaperMutationState,
  documentUploadState: DocumentUploadState
) {
  if (mutationState.kind === "submitting" || documentUploadState.kind === "submitting") {
    return false;
  }

  if (getWorkpapersGlobalReadOnlyMessage(workpapers, effectiveRoles) !== null) {
    return false;
  }

  if (!isWorkpaperDocumentUploadEditable(item)) {
    return false;
  }

  return validateDocumentUploadDraft(draft).kind === "valid";
}

function canSaveWorkpaperItem(
  workpapers: ClosingWorkpapersReadModel,
  effectiveRoles: EffectiveRolesHint,
  item: WorkpaperReadModelItem,
  draft: WorkpaperDraft,
  mutationState: WorkpaperMutationState
) {
  if (mutationState.kind === "submitting") {
    return false;
  }

  if (getWorkpapersGlobalReadOnlyMessage(workpapers, effectiveRoles) !== null) {
    return false;
  }

  if (!item.isCurrentStructure || !isWorkpaperMakerEditable(item)) {
    return false;
  }

  if (!isMakerWorkpaperStatus(draft.status) || draft.noteText.trim().length === 0) {
    return false;
  }

  if (createWorkpaperEvidencePayload(item) === null) {
    return false;
  }

  if (item.workpaper !== null && !hasWorkpaperDraftChanges(item, draft)) {
    return false;
  }

  return true;
}

function getDocumentDownloadStatusLine(
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

function getDocumentUploadStatusLines(
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
  return [
    validation.kind === "valid" ? "fichier pret pour upload" : validation.message
  ];
}

function createManualMappingSelectedTargets(projection: ManualMappingProjection) {
  const selectableTargetCodes = getSelectableTargetCodes(projection);

  return Object.fromEntries(
    projection.lines.map((line) => {
      const mapping = findManualMappingForAccount(projection, line.accountCode);
      const selectedTargetCode =
        mapping !== undefined && selectableTargetCodes.has(mapping.targetCode)
          ? mapping.targetCode
          : undefined;

      return [line.accountCode, selectedTargetCode];
    })
  ) as Record<string, string | undefined>;
}

function createTargetLabelByCode(projection: ManualMappingProjection) {
  return new Map(projection.targets.map((target) => [target.code, target.label]));
}

function getSelectableTargetCodes(projection: ManualMappingProjection) {
  return new Set(
    projection.targets.filter((target) => target.selectable).map((target) => target.code)
  );
}

function findManualMappingForAccount(projection: ManualMappingProjection, accountCode: string) {
  return projection.mappings.find((mapping) => mapping.accountCode === accountCode);
}

function formatManualMappingTargetOption(label: string, code: string) {
  return `${label} (${code})`;
}

function mapWorkpaperMutationResult(
  result: Exclude<Awaited<ReturnType<typeof upsertWorkpaper>>, { kind: "success" }>
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

function mapDocumentUploadResult(
  result: Exclude<UploadWorkpaperDocumentState, { kind: "success" }>,
  anchorCode: string
): DocumentUploadState {
  return {
    ...result,
    anchorCode
  };
}

function mapDocumentDownloadResult(
  result: Exclude<DownloadWorkpaperDocumentState, { kind: "success" }>,
  documentId: string
): DocumentDownloadState {
  return {
    ...result,
    documentId
  };
}

function mapUploadResultToImportState(
  importState: Exclude<Awaited<ReturnType<typeof uploadBalanceImport>>, { kind: "created" }>
): ImportBalanceState {
  if (importState.kind === "bad_request") {
    return {
      kind: "bad_request",
      message: importState.error.message,
      errors: importState.error.errors
    };
  }

  if (importState.kind === "auth_required") {
    return { kind: "auth_required" };
  }

  if (importState.kind === "forbidden") {
    return { kind: "forbidden" };
  }

  if (importState.kind === "not_found") {
    return { kind: "not_found" };
  }

  if (importState.kind === "conflict_archived") {
    return { kind: "conflict_archived" };
  }

  if (importState.kind === "server_error") {
    return { kind: "server_error" };
  }

  if (importState.kind === "network_error") {
    return { kind: "network_error" };
  }

  if (importState.kind === "timeout") {
    return { kind: "timeout" };
  }

  if (importState.kind === "invalid_payload") {
    return { kind: "invalid_payload" };
  }

  return { kind: "unexpected" };
}

function mapManualMappingMutationResult(
  result:
    | Exclude<Awaited<ReturnType<typeof upsertManualMapping>>, { kind: "success" }>
    | Exclude<Awaited<ReturnType<typeof deleteManualMapping>>, { kind: "success" }>
): ManualMappingMutationState {
  if (result.kind === "bad_request_account_absent") {
    return { kind: "bad_request_account_absent" };
  }

  if (result.kind === "bad_request_target_invalid") {
    return { kind: "bad_request_target_invalid" };
  }

  if (result.kind === "bad_request") {
    return { kind: "bad_request" };
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

  if (result.kind === "conflict_import_required") {
    return { kind: "conflict_import_required" };
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

function formatManualMappingMutationState(
  state: Exclude<
    ManualMappingMutationState,
    { kind: "idle" | "put_success" | "delete_success" }
  >
) {
  if (state.kind === "put_submitting") {
    return "enregistrement mapping en cours";
  }

  if (state.kind === "delete_submitting") {
    return "suppression mapping en cours";
  }

  if (state.kind === "bad_request_account_absent") {
    return "compte absent du dernier import";
  }

  if (state.kind === "bad_request_target_invalid") {
    return "target invalide";
  }

  if (state.kind === "bad_request") {
    return "mapping invalide";
  }

  if (state.kind === "auth_required") {
    return "authentification requise";
  }

  if (state.kind === "forbidden") {
    return "acces mapping refuse";
  }

  if (state.kind === "not_found") {
    return "dossier introuvable";
  }

  if (state.kind === "conflict_archived") {
    return "dossier archive, mapping impossible";
  }

  if (state.kind === "conflict_import_required") {
    return "import requis";
  }

  if (state.kind === "conflict_other") {
    return "mapping impossible";
  }

  if (state.kind === "server_error") {
    return "erreur serveur mapping";
  }

  if (state.kind === "network_error") {
    return "erreur reseau mapping";
  }

  if (state.kind === "timeout") {
    return "timeout mapping";
  }

  if (state.kind === "invalid_payload") {
    return "payload mapping invalide";
  }

  return "mapping indisponible";
}

function formatWorkpaperMutationState(
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

function clearDocumentUploadStateForAnchor(
  state: DocumentUploadState,
  anchorCode: string
): DocumentUploadState {
  if (state.kind === "idle" || state.kind === "submitting" || state.anchorCode !== anchorCode) {
    return state;
  }

  return { kind: "idle" };
}

function getReadableDocumentId(document: WorkpaperDocument) {
  if (typeof document.id !== "string") {
    return null;
  }

  return isUuid(document.id) ? document.id : null;
}

function findDocumentInWorkpapers(
  workpapers: ClosingWorkpapersReadModel,
  documentId: string
) {
  const allItems = [...workpapers.items, ...workpapers.staleWorkpapers];

  for (const item of allItems) {
    const document = item.documents.find(
      (candidate) => getReadableDocumentId(candidate) === documentId
    );

    if (document !== undefined) {
      return {
        item,
        document
      };
    }
  }

  return null;
}

function triggerDocumentDownload(
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

function resolveDocumentDownloadFileName(
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

function resolveDocumentDownloadMediaType(
  contentType: string | null,
  fallbackMediaType: string | null
) {
  return normalizeNonEmptyString(contentType) ?? normalizeNonEmptyString(fallbackMediaType);
}

function getFallbackDocumentFileName(document: WorkpaperDocument) {
  return normalizeNonEmptyString(document.fileName);
}

function getFallbackDocumentMediaType(document: WorkpaperDocument) {
  return normalizeNonEmptyString(document.mediaType);
}

function parseContentDispositionFilenameStar(value: string | null) {
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

function parseContentDispositionFilename(value: string | null) {
  if (value === null) {
    return null;
  }

  const match = value.match(/filename\s*=\s*("(?:[^"\\]|\\.)*"|[^;]+)/i);

  if (match?.[1] === undefined) {
    return null;
  }

  return normalizeNonEmptyString(unescapeQuotedString(stripWrappedQuotes(match[1].trim())));
}

function stripWrappedQuotes(value: string) {
  if (value.startsWith("\"") && value.endsWith("\"") && value.length >= 2) {
    return value.slice(1, -1);
  }

  return value;
}

function unescapeQuotedString(value: string) {
  return value.replace(/\\(.)/g, "$1");
}

function normalizeNonEmptyString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function isDocumentUploadFileAllowed(file: File) {
  const normalizedMediaType = normalizeDocumentUploadMediaType(file.type);

  if (
    normalizedMediaType !== null &&
    !DOCUMENT_UPLOAD_ALLOWED_MEDIA_TYPES.some(
      (allowedMediaType) => allowedMediaType === normalizedMediaType
    )
  ) {
    return false;
  }

  if (normalizedMediaType !== null) {
    return true;
  }

  const extension = getLowercaseDocumentUploadExtension(file.name);
  return extension !== null && documentUploadAllowedExtensions.has(extension);
}

function normalizeDocumentUploadMediaType(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.length === 0) {
    return null;
  }

  return normalized.split(";")[0]?.trim() ?? null;
}

function getLowercaseDocumentUploadExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");

  if (lastDotIndex < 0 || lastDotIndex === fileName.length - 1) {
    return null;
  }

  return fileName.slice(lastDotIndex).toLowerCase();
}

function isIsoDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function updateImportSuccessRefreshStatus(
  importState: ImportBalanceState,
  requestId: number,
  refreshStatus: Extract<ImportBalanceState, { kind: "success" }>["refreshStatus"]
) {
  if (importState.kind !== "success" || importState.requestId !== requestId) {
    return importState;
  }

  return {
    ...importState,
    refreshStatus
  };
}

function isBalanceImportCoherent(
  balanceImport: { closingFolderId: string },
  routeClosingFolderId: string,
  closingFolder: ClosingFolderSummary
) {
  return (
    balanceImport.closingFolderId === routeClosingFolderId &&
    balanceImport.closingFolderId === closingFolder.id
  );
}

function formatImportValidationError(error: BalanceImportValidationError) {
  if (error.line !== null && error.field !== null) {
    return `ligne ${error.line} - ${error.field} : ${error.message}`;
  }

  if (error.line !== null) {
    return `ligne ${error.line} : ${error.message}`;
  }

  if (error.field !== null) {
    return `${error.field} : ${error.message}`;
  }

  return error.message;
}

const routeDefinitions = [
  {
    path: "/",
    element: <ClosingFoldersEntrypointRoute />
  },
  {
    path: "/closing-folders/:closingFolderId",
    element: <ClosingFolderRoute />
  }
];

export const browserRouter = createBrowserRouter(routeDefinitions);

export function createAppMemoryRouter(initialEntries: string[]) {
  return createMemoryRouter(routeDefinitions, { initialEntries });
}
