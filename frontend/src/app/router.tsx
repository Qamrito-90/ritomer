import type { ChangeEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createBrowserRouter, createMemoryRouter, useParams } from "react-router-dom";
import { AppShell } from "../components/workbench/app-shell";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { WorkflowBadge } from "../components/ui/workflow-badge";
import {
  AiMappingSuggestionsPanel,
  type ManualMappingRefreshWarnings
} from "./ai-mapping-suggestions-panel";
import {
  BalanceImportHistoryPanel,
  type BalanceImportHistoryPanelState
} from "./balance-import-history-panel";
import { ExportAuditPackPanel } from "./export-audit-pack-panel";
import { MinimalAnnexPanel } from "./minimal-annex-panel";
import { WorkpapersPanel } from "./workpapers-panel";
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
  loadWorkpapersShellState,
  type WorkpapersShellState
} from "../lib/api/workpapers";
import {
  loadBalanceImportDiffPreviousShellState,
  loadBalanceImportVersionsShellState,
  uploadBalanceImport,
  type BalanceImportDiffState,
  type BalanceImportVersionSummary,
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
      refreshWarnings: ImportRefreshWarnings;
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
      refreshWarnings: ManualMappingRefreshWarnings;
    }
  | {
      kind: "delete_success";
      refreshWarnings: ManualMappingRefreshWarnings;
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
      manualMappingState: ManualMappingShellState;
      manualMappingSelectedTargets: Record<string, string | undefined>;
      manualMappingMutationState: ManualMappingMutationState;
      manualMappingRefreshPending: boolean;
      workpapersPanelRefreshKey: number;
      mappingSuggestionsRefreshRequestId: number;
      mappingSuggestionsRefreshOwner: "import" | "manual_mapping" | null;
      minimalAnnexRefreshRequestId: number;
      importState: ImportBalanceState;
      balanceImportHistoryState: BalanceImportHistoryPanelState;
      selectedImportFile: File | null;
    };

type ClosingReadyState = Extract<ClosingRouteState, { kind: "closing_ready" }>;

type ImportRefreshWarnings = ManualMappingRefreshWarnings & {
  closingFailed?: boolean;
  importDiffFailed?: boolean;
  importHistoryFailed?: boolean;
  suggestionsFailed?: boolean;
};

type CockpitTone = "error" | "info" | "neutral" | "success" | "warning";

type CockpitBlocker = {
  detail: string;
  href: string;
  sectionLabel: string;
  title: string;
  tone: CockpitTone;
};

type CockpitModel = {
  blockers: CockpitBlocker[];
  closingFolder: ClosingFolderSummary;
  evidenceReview: string;
  nextAction: {
    detail: string;
    href: string;
    label: string;
  };
  previewExport: string;
  readySummary: string;
  status: {
    detail: string;
    label: string;
    tone: CockpitTone;
  };
  steps: CockpitStep[];
};

type CockpitStep = {
  detail: string;
  href: string;
  label: string;
  stateLabel: string;
  tone: CockpitTone;
};

const cockpitSectionLinks = [
  { href: "#vue-closing", label: "Vue closing" },
  { href: "#import-balance", label: "Import" },
  { href: "#mapping", label: "Mapping" },
  { href: "#controls", label: "Controls" },
  { href: "#previews", label: "Previews" },
  { href: "#evidence", label: "Evidence" },
  { href: "#export-review", label: "Export" }
] as const;

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

  useEffect(() => {
    let cancelled = false;

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
            manualMappingState: { kind: "loading" },
            manualMappingSelectedTargets: {},
            manualMappingMutationState: { kind: "idle" },
            manualMappingRefreshPending: false,
            workpapersPanelRefreshKey: 0,
            mappingSuggestionsRefreshRequestId: 0,
            mappingSuggestionsRefreshOwner: null,
            minimalAnnexRefreshRequestId: 0,
            importState: { kind: "idle" },
            balanceImportHistoryState: { kind: "loading" },
            selectedImportFile: null
          });

          const [
            controlsState,
            manualMappingState,
            financialSummaryState,
            financialStatementsStructuredState,
            workpapersState,
            balanceImportHistoryState
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
            ),
            loadInitialBalanceImportHistoryState(closingFolderId, meState.activeTenant)
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
              balanceImportHistoryState,
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
        refreshWarnings: {}
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

      await refreshAfterImportSuccess(
        activeTenant,
        closingFolder,
        requestId,
        importState.balanceImport.version
      );
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
            refreshWarnings: {}
          }
        };
      });

      await refreshManualMappingCoreSurfaces(
        state.activeTenant,
        state.closingFolder,
        "put_success",
        { refreshSuggestions: true }
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
            refreshWarnings: {}
          }
        };
      });

      await refreshManualMappingCoreSurfaces(
        state.activeTenant,
        state.closingFolder,
        "delete_success",
        { refreshSuggestions: true }
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

  async function refreshAfterImportSuccess(
    activeTenant: ActiveTenant,
    closingFolder: ClosingFolderSummary,
    requestId: number,
    importedVersion: number
  ) {
    const refreshedClosingFolderState = await loadClosingFolderShellState(closingFolderId, activeTenant);
    const nextClosingFolder =
      refreshedClosingFolderState.kind === "ready"
        ? refreshedClosingFolderState.closingFolder
        : closingFolder;

    const [
      refreshedControlsState,
      refreshedManualMappingState,
      refreshedFinancialSummaryState,
      refreshedFinancialStatementsStructuredState,
      refreshedWorkpapersState,
      refreshedBalanceImportHistoryResult
    ] = await Promise.all([
      loadControlsShellState(closingFolderId, nextClosingFolder, activeTenant),
      loadManualMappingShellState(closingFolderId, nextClosingFolder, activeTenant),
      loadFinancialSummaryShellState(closingFolderId, nextClosingFolder, activeTenant),
      loadFinancialStatementsStructuredShellState(closingFolderId, nextClosingFolder, activeTenant),
      loadWorkpapersShellState(closingFolderId, nextClosingFolder, activeTenant),
      refreshBalanceImportHistoryAfterImport(closingFolderId, activeTenant, importedVersion)
    ]);

    const refreshWarnings: ImportRefreshWarnings = {
      closingFailed: refreshedClosingFolderState.kind !== "ready",
      controlsFailed: refreshedControlsState.kind !== "ready",
      mappingFailed: refreshedManualMappingState.kind !== "ready",
      financialSummaryFailed: refreshedFinancialSummaryState.kind !== "ready",
      financialStatementsFailed: refreshedFinancialStatementsStructuredState.kind !== "ready",
      workpapersFailed: refreshedWorkpapersState.kind !== "ready",
      importHistoryFailed: !refreshedBalanceImportHistoryResult.versionsSucceeded,
      importDiffFailed: !refreshedBalanceImportHistoryResult.diffSucceeded
    };

    setState((currentState) => {
      if (currentState.kind !== "closing_ready" || currentState.importState.kind !== "success") {
        return currentState;
      }

      const nextImportState = updateImportSuccessRefreshWarnings(
        currentState.importState,
        requestId,
        refreshWarnings
      );

      if (nextImportState === currentState.importState) {
        return currentState;
      }

      return {
        ...currentState,
        closingFolder:
          refreshedClosingFolderState.kind === "ready"
            ? refreshedClosingFolderState.closingFolder
            : currentState.closingFolder,
        controlsState:
          refreshedControlsState.kind === "ready"
            ? refreshedControlsState
            : currentState.controlsState,
        financialSummaryState:
          refreshedFinancialSummaryState.kind === "ready"
            ? refreshedFinancialSummaryState
            : currentState.financialSummaryState,
        financialStatementsStructuredState:
          refreshedFinancialStatementsStructuredState.kind === "ready"
            ? refreshedFinancialStatementsStructuredState
            : currentState.financialStatementsStructuredState,
        workpapersState:
          refreshedWorkpapersState.kind === "ready"
            ? refreshedWorkpapersState
            : currentState.workpapersState,
        balanceImportHistoryState: refreshedBalanceImportHistoryResult.state,
        manualMappingState:
          refreshedManualMappingState.kind === "ready"
            ? refreshedManualMappingState
            : currentState.manualMappingState,
        manualMappingSelectedTargets:
          refreshedManualMappingState.kind === "ready"
            ? createManualMappingSelectedTargets(refreshedManualMappingState.projection)
            : currentState.manualMappingSelectedTargets,
        importState: nextImportState,
        workpapersPanelRefreshKey:
          refreshedWorkpapersState.kind === "ready"
            ? currentState.workpapersPanelRefreshKey + 1
            : currentState.workpapersPanelRefreshKey,
        mappingSuggestionsRefreshRequestId: currentState.mappingSuggestionsRefreshRequestId + 1,
        mappingSuggestionsRefreshOwner: "import"
      };
    });
  }

  async function refreshManualMappingCoreSurfaces(
    activeTenant: ActiveTenant,
    closingFolder: ClosingFolderSummary,
    successKind: Extract<ManualMappingMutationState, { kind: "put_success" | "delete_success" }>["kind"],
    options: { refreshSuggestions: boolean }
  ): Promise<ManualMappingRefreshWarnings> {
    const [
      refreshedManualMappingState,
      refreshedControlsState,
      refreshedFinancialSummaryState,
      refreshedFinancialStatementsStructuredState,
      refreshedWorkpapersState
    ] = await Promise.all([
      loadManualMappingShellState(closingFolderId, closingFolder, activeTenant),
      loadControlsShellState(closingFolderId, closingFolder, activeTenant),
      loadFinancialSummaryShellState(closingFolderId, closingFolder, activeTenant),
      loadFinancialStatementsStructuredShellState(closingFolderId, closingFolder, activeTenant),
      loadWorkpapersShellState(closingFolderId, closingFolder, activeTenant)
    ]);
    const refreshWarnings: ManualMappingRefreshWarnings = {
      mappingFailed: refreshedManualMappingState.kind !== "ready",
      controlsFailed: refreshedControlsState.kind !== "ready",
      financialSummaryFailed: refreshedFinancialSummaryState.kind !== "ready",
      financialStatementsFailed: refreshedFinancialStatementsStructuredState.kind !== "ready",
      workpapersFailed: refreshedWorkpapersState.kind !== "ready"
    };

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
        financialSummaryState:
          refreshedFinancialSummaryState.kind === "ready"
            ? refreshedFinancialSummaryState
            : currentState.financialSummaryState,
        financialStatementsStructuredState:
          refreshedFinancialStatementsStructuredState.kind === "ready"
            ? refreshedFinancialStatementsStructuredState
            : currentState.financialStatementsStructuredState,
        workpapersState:
          refreshedWorkpapersState.kind === "ready"
            ? refreshedWorkpapersState
            : currentState.workpapersState,
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
          refreshWarnings
        },
        manualMappingRefreshPending: false,
        workpapersPanelRefreshKey:
          refreshedWorkpapersState.kind === "ready"
            ? currentState.workpapersPanelRefreshKey + 1
            : currentState.workpapersPanelRefreshKey,
        mappingSuggestionsRefreshRequestId: options.refreshSuggestions
          ? currentState.mappingSuggestionsRefreshRequestId + 1
          : currentState.mappingSuggestionsRefreshRequestId,
        mappingSuggestionsRefreshOwner: options.refreshSuggestions
          ? "manual_mapping"
          : currentState.mappingSuggestionsRefreshOwner
      };
    });

    return refreshWarnings;
  }

  const handleMappingSuggestionsRefreshSettled = useCallback(
    (requestId: number, succeeded: boolean) => {
      if (succeeded) {
        return;
      }

      setState((currentState) => {
        if (
          currentState.kind !== "closing_ready" ||
          currentState.mappingSuggestionsRefreshRequestId !== requestId
        ) {
          return currentState;
        }

        if (
          currentState.mappingSuggestionsRefreshOwner === "import" &&
          currentState.importState.kind === "success"
        ) {
          return {
            ...currentState,
            importState: {
              ...currentState.importState,
              refreshWarnings: {
                ...currentState.importState.refreshWarnings,
                suggestionsFailed: true
              }
            }
          };
        }

        if (
          currentState.mappingSuggestionsRefreshOwner === "manual_mapping" &&
          (currentState.manualMappingMutationState.kind === "put_success" ||
            currentState.manualMappingMutationState.kind === "delete_success")
        ) {
          return {
            ...currentState,
            manualMappingMutationState: {
              ...currentState.manualMappingMutationState,
              refreshWarnings: {
                ...currentState.manualMappingMutationState.refreshWarnings,
                suggestionsFailed: true
              }
            }
          };
        }

        return currentState;
      });
    },
    []
  );

  const handleExportPackCreateSucceeded = useCallback(() => {
    setState((currentState) => {
      if (currentState.kind !== "closing_ready") {
        return currentState;
      }

      return {
        ...currentState,
        minimalAnnexRefreshRequestId: currentState.minimalAnnexRefreshRequestId + 1
      };
    });
  }, []);

  const tenant =
    "activeTenant" in state
      ? {
          tenantName: state.activeTenant.tenantName,
          tenantSlug: state.activeTenant.tenantSlug
        }
      : undefined;
  const cockpitModel = state.kind === "closing_ready" ? createCockpitModel(state) : null;

  return (
    <AppShell
      actionZone={
        cockpitModel === null ? (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <p className="font-medium text-foreground">Zone d action</p>
              <p className="text-muted-foreground">chargement du contexte dossier</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to="/">Retour dossiers</Link>
            </Button>
          </div>
        ) : (
          <ClosingActionZone model={cockpitModel} />
        )
      }
      breadcrumb={[
        { label: "Dossiers de closing", href: "/" },
        { label: "Dossier" }
      ]}
      description={
        cockpitModel === null
          ? "Cockpit de closing en cours de chargement."
          : `${formatClosingPeriod(
              cockpitModel.closingFolder.periodStartOn,
              cockpitModel.closingFolder.periodEndOn
            )}. Revue humaine requise, sans promesse de livrable statutaire.`
      }
      eyebrow="Cockpit de closing"
      sidebarItems={[
        { href: "/", label: "Dossiers" },
        { href: `/closing-folders/${closingFolderId}`, label: "Dossier" }
      ]}
      tenant={tenant}
      title="Dossier de closing"
    >
      {state.kind === "closing_ready" ? (
        <div className="grid gap-6">
          <ClosingCockpit
            activeTenant={state.activeTenant}
            model={cockpitModel ?? createCockpitModel(state)}
          />

          <section className="panel scroll-mt-28 p-6" id="import-balance">
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
                <BalanceImportHistoryPanel state={state.balanceImportHistoryState} />
              </div>
            </div>
          </section>

          <section className="panel scroll-mt-28 p-6" id="mapping">
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
              <AiMappingSuggestionsPanel
                activeTenant={state.activeTenant}
                closingFolderId={state.closingFolder.id}
                key={`ai-mapping-suggestion-${state.activeTenant.tenantId}-${state.closingFolder.id}`}
                selectableTargets={
                  state.manualMappingState.kind === "ready"
                    ? state.manualMappingState.projection.targets
                    : []
                }
                onManualMappingMutationConfirmed={() =>
                  refreshManualMappingCoreSurfaces(
                    state.activeTenant,
                    state.closingFolder,
                    "put_success",
                    { refreshSuggestions: false }
                  )
                }
                onSuggestionsRefreshSettled={handleMappingSuggestionsRefreshSettled}
                suggestionsRefreshRequestId={state.mappingSuggestionsRefreshRequestId}
              />
            </div>
          </section>

          <section className="panel scroll-mt-28 p-6" id="controls">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Controles</p>
                <h3 className="text-xl font-semibold text-foreground">Cockpit read-only</h3>
              </div>
              <ControlsSlot state={state.controlsState} />
            </div>
          </section>

          <section className="panel scroll-mt-28 p-6" id="previews">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <p className="label-eyebrow">Financial summary</p>
                <h3 className="text-xl font-semibold text-foreground">Preview read-only</h3>
              </div>
              <FinancialSummarySlot state={state.financialSummaryState} />
            </div>
          </section>

          <section className="panel scroll-mt-28 p-6">
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

          <div className="scroll-mt-28" id="evidence">
            <WorkpapersPanel
              activeTenant={state.activeTenant}
              closingFolder={state.closingFolder}
              closingFolderId={state.closingFolder.id}
              effectiveRoles={state.effectiveRoles}
              initialState={state.workpapersState}
              key={`${state.activeTenant.tenantId}-${state.closingFolder.id}-${state.workpapersPanelRefreshKey}`}
            />
          </div>

          <div className="grid scroll-mt-28 gap-6" id="export-review">
            <ExportAuditPackPanel
              activeTenant={state.activeTenant}
              closingFolderId={state.closingFolder.id}
              key={`exports-${state.activeTenant.tenantId}-${state.closingFolder.id}`}
              onExportPackCreateSucceeded={handleExportPackCreateSucceeded}
            />

            <MinimalAnnexPanel
              activeTenant={state.activeTenant}
              closingFolderId={state.closingFolder.id}
              key={`minimal-annex-${state.activeTenant.tenantId}-${state.closingFolder.id}`}
              postExportPackRefreshRequestId={state.minimalAnnexRefreshRequestId}
            />
          </div>
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

function ClosingActionZone({ model }: { model: CockpitModel }) {
  return (
    <div className="flex flex-col gap-3 text-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{model.status.label}</p>
        <p className="text-muted-foreground">{model.nextAction.detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild size="sm">
          <a href={model.nextAction.href}>{model.nextAction.label}</a>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link to="/">Retour dossiers</Link>
        </Button>
      </div>
    </div>
  );
}

function ClosingCockpit({
  activeTenant,
  model
}: {
  activeTenant: ActiveTenant;
  model: CockpitModel;
}) {
  return (
    <section
      aria-labelledby="closing-cockpit-title"
      className="panel scroll-mt-28 p-4"
      id="vue-closing"
    >
      <div className="grid gap-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <p className="label-eyebrow">Dossier courant</p>
            <h3
              className="mt-2 text-2xl font-semibold text-foreground"
              id="closing-cockpit-title"
            >
              {model.closingFolder.name}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Tenant actif : {activeTenant.tenantName} - Periode :{" "}
              <span className="tabular-nums">
                {formatClosingPeriod(
                  model.closingFolder.periodStartOn,
                  model.closingFolder.periodEndOn
                )}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <StatusPill label={model.status.label} tone={model.status.tone} />
            <p className="text-sm font-medium text-foreground">Revue humaine requise</p>
          </div>
        </div>

        <dl className="flex flex-wrap gap-2">
          <CockpitMetaChip label="Statut">
            <WorkflowBadge status={model.closingFolder.status} />
          </CockpitMetaChip>
          <CockpitMetaChip label="Reference dossier">
            <span>{formatOptionalText(model.closingFolder.externalRef)}</span>
          </CockpitMetaChip>
          <CockpitMetaChip label="Debut periode">
            <span className="tabular-nums">{formatLocalDate(model.closingFolder.periodStartOn)}</span>
          </CockpitMetaChip>
          <CockpitMetaChip label="Fin periode">
            <span className="tabular-nums">{formatLocalDate(model.closingFolder.periodEndOn)}</span>
          </CockpitMetaChip>
        </dl>

        <div className="grid gap-3">
          <div className="grid gap-1">
            <p className="label-eyebrow">Progression dossier</p>
            <h4 className="text-lg font-semibold text-foreground">
              Closing - Import - Mapping - Controls - Previews - Evidence - Export
            </h4>
          </div>
          <ol
            aria-label="progression closing"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7"
          >
            {model.steps.map((step) => (
              <li className="min-w-0" key={step.label}>
                <a
                  className="block h-full rounded-lg border bg-background/80 p-2.5 text-foreground no-underline transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  href={step.href}
                >
                  <span className="grid gap-1.5">
                    <span className="text-sm font-semibold">{step.label}</span>
                    <StatusPill label={step.stateLabel} tone={step.tone} />
                    <span className="text-xs text-muted-foreground">{step.detail}</span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="grid gap-2">
              <div className="grid gap-1">
                <p className="label-eyebrow">Prochaine action</p>
                <p className="text-lg font-semibold text-foreground">{model.nextAction.label}</p>
              </div>
              <p className="text-sm text-muted-foreground">{model.nextAction.detail}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="grid gap-2">
              <div className="grid gap-1">
                <p className="label-eyebrow">Blockers principaux</p>
                <p className="text-sm font-semibold text-foreground">
                  {model.blockers.length === 0
                    ? "Aucun blocker principal"
                    : `${model.blockers.length} point(s) a traiter`}
                </p>
              </div>
              <CockpitBlockerList blockers={model.blockers} />
            </div>
          </div>
        </div>

        <dl className="grid gap-3 lg:grid-cols-3">
          <CockpitFactCard label="Ce qui est pret" value={model.readySummary} />
          <CockpitFactCard label="Preuves et revue" value={model.evidenceReview} />
          <CockpitFactCard label="Previews et export" value={model.previewExport} />
        </dl>

        <nav aria-label="Sections du dossier">
          <ul className="flex flex-wrap gap-2">
            {cockpitSectionLinks.map((link) => (
              <li key={link.href}>
                <a
                  className="inline-flex rounded-md border px-3 py-2 text-sm font-medium text-foreground no-underline hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  href={link.href}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}

function CockpitMetaChip({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="inline-flex min-h-9 items-center gap-2 rounded-md border bg-background/80 px-3 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

function CockpitBlockerList({ blockers }: { blockers: CockpitBlocker[] }) {
  if (blockers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Les read-models charges ne remontent pas de blocage prioritaire.
      </p>
    );
  }

  return (
    <ul className="grid gap-1.5">
      {blockers.map((blocker) => (
        <li
          className="rounded-md border bg-background/80 px-2 py-1.5"
          key={`${blocker.href}-${blocker.title}`}
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <StatusPill
              label={blocker.tone === "error" ? "bloquant" : "a verifier"}
              tone={blocker.tone}
            />
            <a className="text-sm font-semibold" href={blocker.href}>
              {blocker.sectionLabel}
            </a>
            <span className="text-sm font-medium text-foreground">{blocker.title}</span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{blocker.detail}</p>
        </li>
      ))}
    </ul>
  );
}

function CockpitFactCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background/80 p-3">
      <dt className="label-eyebrow">{label}</dt>
      <dd className="mt-1.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function StatusPill({ label, tone }: { label: string; tone: CockpitTone }) {
  const className =
    tone === "success"
      ? "border-success/25 bg-success/10 text-success"
      : tone === "warning"
        ? "border-warning/25 bg-warning/10 text-warning"
        : tone === "error"
          ? "border-error/25 bg-error/10 text-error"
          : tone === "info"
            ? "border-info/25 bg-info/10 text-info"
            : "border-border bg-muted/30 text-muted-foreground";

  return (
    <span
      className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-semibold ${className}`}
    >
      {label}
    </span>
  );
}

function createCockpitModel(state: ClosingReadyState): CockpitModel {
  const blockers = createCockpitBlockers(state).slice(0, 3);
  const status = createCockpitStatus(state, blockers);
  const nextAction = createCockpitNextAction(state, blockers);

  return {
    blockers,
    closingFolder: state.closingFolder,
    evidenceReview: formatEvidenceReviewSummary(state.workpapersState),
    nextAction,
    previewExport: formatPreviewExportSummary(
      state.financialSummaryState,
      state.financialStatementsStructuredState
    ),
    readySummary: formatReadySummary(state),
    status,
    steps: createCockpitSteps(state)
  };
}

function createCockpitStatus(
  state: ClosingReadyState,
  blockers: CockpitBlocker[]
): CockpitModel["status"] {
  if (state.closingFolder.status === "ARCHIVED") {
    return {
      detail: "Lecture autorisee sur dossier archive ; les actions d'ecriture restent bloquees par le workflow existant.",
      label: "Dossier archive",
      tone: "info"
    };
  }

  if (blockers.some((blocker) => blocker.tone === "error")) {
    return {
      detail: "Un point bloquant doit etre traite avant de conclure la revue humaine.",
      label: "Dossier bloque",
      tone: "error"
    };
  }

  if (hasLoadingCockpitSurface(state)) {
    return {
      detail: "Les read-models du dossier sont en cours de chargement.",
      label: "Chargement du dossier",
      tone: "neutral"
    };
  }

  if (state.controlsState.kind === "ready" && state.controlsState.controls.readiness === "READY") {
    if (
      state.financialSummaryState.kind === "ready" &&
      state.financialStatementsStructuredState.kind === "ready" &&
      state.financialSummaryState.summary.statementState === "PREVIEW_READY" &&
      state.financialStatementsStructuredState.financialStatements.statementState === "PREVIEW_READY"
    ) {
      return {
        detail: "Les previews sont disponibles pour revue humaine et restent non statutaires.",
        label: "Previews disponibles pour revue",
        tone: "success"
      };
    }

    return {
      detail: "Les controls sont prets ; verifier les preuves et previews avant tout handoff.",
      label: "Controls prets",
      tone: "success"
    };
  }

  return {
    detail: "Le dossier est en preparation avec revue humaine requise.",
    label: "Dossier en preparation",
    tone: "warning"
  };
}

function createCockpitNextAction(
  state: ClosingReadyState,
  blockers: CockpitBlocker[]
): CockpitModel["nextAction"] {
  const primaryBlocker = blockers[0];

  if (primaryBlocker !== undefined) {
    return {
      detail: primaryBlocker.detail,
      href: primaryBlocker.href,
      label:
        primaryBlocker.href === "#import-balance"
          ? "Importer une balance"
          : primaryBlocker.href === "#mapping"
            ? "Reprendre le mapping"
            : primaryBlocker.href === "#controls"
              ? "Ouvrir les controls"
              : primaryBlocker.href === "#evidence"
                ? "Continuer les preuves"
                : primaryBlocker.href === "#previews"
                  ? "Ouvrir les previews"
                  : "Voir le point bloquant"
    };
  }

  if (hasLoadingCockpitSurface(state)) {
    return {
      detail: "Attendre la fin du chargement avant de prendre une decision.",
      href: "#vue-closing",
      label: "Suivre le chargement"
    };
  }

  return {
    detail: "Aucun blocker principal n'est remonte ; consulter le pack et la minimal annex preview pour la revue humaine.",
    href: "#export-review",
    label: "Voir export de revue"
  };
}

function createCockpitBlockers(state: ClosingReadyState): CockpitBlocker[] {
  const blockers: CockpitBlocker[] = [];

  appendSurfaceStateBlocker(blockers, state.controlsState.kind, {
    detail: "Controls indisponibles pour le moment. Reessayez avant de conclure la revue.",
    href: "#controls",
    sectionLabel: "Controls",
    title: "Readiness non exploitable"
  });
  appendSurfaceStateBlocker(blockers, state.manualMappingState.kind, {
    detail: "Le mapping manuel doit etre lisible avant de conclure la couverture du dossier.",
    href: "#mapping",
    sectionLabel: "Mapping",
    title: "Mapping indisponible"
  });
  appendSurfaceStateBlocker(blockers, state.financialSummaryState.kind, {
    detail: "La preview financiere reste bloquee par securite tant que les donnees ne sont pas coherentes.",
    href: "#previews",
    sectionLabel: "Previews",
    title: "Financial summary indisponible"
  });
  appendSurfaceStateBlocker(blockers, state.financialStatementsStructuredState.kind, {
    detail: "La preview structuree des etats financiers n'est pas exploitable pour la revue.",
    href: "#previews",
    sectionLabel: "Previews",
    title: "Preview structuree indisponible"
  });
  appendSurfaceStateBlocker(blockers, state.workpapersState.kind, {
    detail: "Les justifications et preuves ne peuvent pas etre evaluees pour le moment.",
    href: "#evidence",
    sectionLabel: "Evidence",
    title: "Workpapers indisponibles"
  });

  if (state.controlsState.kind === "ready") {
    const { controls } = state.controlsState;

    if (!controls.latestImportPresent) {
      blockers.push({
        detail: "Aucun import valide n'est disponible. Importer une balance avant mapping et controls.",
        href: "#import-balance",
        sectionLabel: "Import",
        title: "Import balance manquant",
        tone: "error"
      });
    }

    if (controls.mappingSummary.unmapped > 0) {
      blockers.push({
        detail: `${controls.mappingSummary.unmapped} compte(s) restent non mappes sur le dernier import.`,
        href: "#mapping",
        sectionLabel: "Mapping",
        title: "Mapping manuel incomplet",
        tone: "error"
      });
    }

    const failedControl = controls.controls.find((control) => control.status === "FAIL");

    if (failedControl !== undefined && controls.mappingSummary.unmapped === 0) {
      blockers.push({
        detail: "Un control bloque la readiness. Ouvrir la section Controls pour le detail metier.",
        href: "#controls",
        sectionLabel: "Controls",
        title: "Readiness bloquee",
        tone: "error"
      });
    }
  }

  if (state.manualMappingState.kind === "ready") {
    const { projection } = state.manualMappingState;

    if (projection.latestImportVersion === null) {
      blockers.push({
        detail: "Le mapping manuel attend un import valide.",
        href: "#import-balance",
        sectionLabel: "Import",
        title: "Import requis pour mapper",
        tone: "error"
      });
    } else if (projection.summary.unmapped > 0) {
      blockers.push({
        detail: `${projection.summary.unmapped} compte(s) attendent une decision humaine de mapping.`,
        href: "#mapping",
        sectionLabel: "Mapping",
        title: "Decisions de mapping a completer",
        tone: "error"
      });
    }
  }

  if (state.workpapersState.kind === "ready") {
    const { summaryCounts } = state.workpapersState.workpapers;
    const documentCounts = getWorkpaperDocumentCounts(state.workpapersState);

    if (summaryCounts.missingCount > 0) {
      blockers.push({
        detail: `${summaryCounts.missingCount} workpaper(s) courant(s) restent a documenter.`,
        href: "#evidence",
        sectionLabel: "Evidence",
        title: "Justifications a completer",
        tone: "warning"
      });
    }

    if (summaryCounts.staleCount > 0) {
      blockers.push({
        detail: `${summaryCounts.staleCount} justification(s) sont rattachees a une ancienne structure.`,
        href: "#evidence",
        sectionLabel: "Evidence",
        title: "Justifications stale",
        tone: "warning"
      });
    }

    if (documentCounts.unverifiedCount > 0) {
      blockers.push({
        detail: `${documentCounts.unverifiedCount} piece(s) restent a verifier par un reviewer.`,
        href: "#evidence",
        sectionLabel: "Evidence",
        title: "Pieces non verifiees",
        tone: "warning"
      });
    }
  }

  if (
    state.financialSummaryState.kind === "ready" &&
    state.financialStatementsStructuredState.kind === "ready" &&
    (state.financialSummaryState.summary.statementState === "PREVIEW_PARTIAL" ||
      state.financialStatementsStructuredState.financialStatements.statementState === "BLOCKED")
  ) {
    blockers.push({
      detail: "Les previews financieres restent partielles ou bloquees et ne sont pas statutaires.",
      href: "#previews",
      sectionLabel: "Previews",
      title: "Previews a revoir",
      tone: "warning"
    });
  }

  return dedupeCockpitBlockers(blockers);
}

function appendSurfaceStateBlocker(
  blockers: CockpitBlocker[],
  kind: string,
  blocker: Omit<CockpitBlocker, "tone">
) {
  if (kind === "loading" || kind === "ready") {
    return;
  }

  blockers.push({
    ...blocker,
    detail:
      kind === "invalid_payload"
        ? `${blocker.detail} Donnees incoherentes : l'ecran reste bloque par securite.`
        : blocker.detail,
    tone: kind === "invalid_payload" ? "error" : "warning"
  });
}

function dedupeCockpitBlockers(blockers: CockpitBlocker[]) {
  const seenKeys = new Set<string>();
  return blockers.filter((blocker) => {
    const key = `${blocker.href}-${blocker.title}`;

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
}

function createCockpitSteps(state: ClosingReadyState): CockpitStep[] {
  return [
    {
      detail: formatClosingPeriod(
        state.closingFolder.periodStartOn,
        state.closingFolder.periodEndOn
      ),
      href: "#vue-closing",
      label: "Closing",
      stateLabel: state.closingFolder.status === "ARCHIVED" ? "archive" : "en cours",
      tone: state.closingFolder.status === "ARCHIVED" ? "info" : "warning"
    },
    createImportStep(state.controlsState),
    createMappingStep(state.manualMappingState),
    createControlsStep(state.controlsState),
    createPreviewsStep(state.financialSummaryState, state.financialStatementsStructuredState),
    createEvidenceStep(state.workpapersState),
    {
      detail: "Etat determine dans la section Export de revue.",
      href: "#export-review",
      label: "Export",
      stateLabel: "indetermine",
      tone: "neutral"
    }
  ];
}

function createImportStep(controlsState: ControlsShellState): CockpitStep {
  if (controlsState.kind === "loading") {
    return {
      detail: "Etat import en chargement.",
      href: "#import-balance",
      label: "Import",
      stateLabel: "chargement",
      tone: "neutral"
    };
  }

  if (controlsState.kind !== "ready") {
    return {
      detail: "Etat import indisponible.",
      href: "#import-balance",
      label: "Import",
      stateLabel: controlsState.kind === "invalid_payload" ? "incoherent" : "indisponible",
      tone: controlsState.kind === "invalid_payload" ? "error" : "warning"
    };
  }

  if (!controlsState.controls.latestImportPresent) {
    return {
      detail: "Aucun import valide.",
      href: "#import-balance",
      label: "Import",
      stateLabel: "manquant",
      tone: "error"
    };
  }

  return {
    detail: `Version ${controlsState.controls.latestImportVersion ?? "non renseignee"}`,
    href: "#import-balance",
    label: "Import",
    stateLabel: "pret",
    tone: "success"
  };
}

function createMappingStep(manualMappingState: ManualMappingShellState): CockpitStep {
  if (manualMappingState.kind === "loading") {
    return {
      detail: "Mapping en chargement.",
      href: "#mapping",
      label: "Mapping",
      stateLabel: "chargement",
      tone: "neutral"
    };
  }

  if (manualMappingState.kind !== "ready") {
    return {
      detail: "Mapping indisponible.",
      href: "#mapping",
      label: "Mapping",
      stateLabel: manualMappingState.kind === "invalid_payload" ? "incoherent" : "indisponible",
      tone: manualMappingState.kind === "invalid_payload" ? "error" : "warning"
    };
  }

  const { projection } = manualMappingState;

  if (projection.latestImportVersion === null) {
    return {
      detail: "Import requis avant mapping.",
      href: "#mapping",
      label: "Mapping",
      stateLabel: "en attente",
      tone: "warning"
    };
  }

  if (projection.summary.unmapped > 0) {
    return {
      detail: `${projection.summary.unmapped} compte(s) non mappes.`,
      href: "#mapping",
      label: "Mapping",
      stateLabel: "incomplet",
      tone: "error"
    };
  }

  return {
    detail: `${projection.summary.mapped}/${projection.summary.total} compte(s) mappes.`,
    href: "#mapping",
    label: "Mapping",
    stateLabel: "pret",
    tone: "success"
  };
}

function createControlsStep(controlsState: ControlsShellState): CockpitStep {
  if (controlsState.kind === "loading") {
    return {
      detail: "Readiness en chargement.",
      href: "#controls",
      label: "Controls",
      stateLabel: "chargement",
      tone: "neutral"
    };
  }

  if (controlsState.kind !== "ready") {
    return {
      detail: "Readiness indisponible.",
      href: "#controls",
      label: "Controls",
      stateLabel: controlsState.kind === "invalid_payload" ? "incoherent" : "indisponible",
      tone: controlsState.kind === "invalid_payload" ? "error" : "warning"
    };
  }

  if (controlsState.controls.readiness === "READY") {
    return {
      detail: "Controls prets pour revue.",
      href: "#controls",
      label: "Controls",
      stateLabel: "pret",
      tone: "success"
    };
  }

  return {
    detail: "Controls bloquants.",
    href: "#controls",
    label: "Controls",
    stateLabel: "bloque",
    tone: "error"
  };
}

function createPreviewsStep(
  financialSummaryState: FinancialSummaryShellState,
  financialStatementsStructuredState: FinancialStatementsStructuredShellState
): CockpitStep {
  if (
    financialSummaryState.kind === "loading" ||
    financialStatementsStructuredState.kind === "loading"
  ) {
    return {
      detail: "Previews en chargement.",
      href: "#previews",
      label: "Previews",
      stateLabel: "chargement",
      tone: "neutral"
    };
  }

  if (
    financialSummaryState.kind !== "ready" ||
    financialStatementsStructuredState.kind !== "ready"
  ) {
    return {
      detail: "Previews indisponibles.",
      href: "#previews",
      label: "Previews",
      stateLabel:
        financialSummaryState.kind === "invalid_payload" ||
        financialStatementsStructuredState.kind === "invalid_payload"
          ? "incoherent"
          : "indisponible",
      tone:
        financialSummaryState.kind === "invalid_payload" ||
        financialStatementsStructuredState.kind === "invalid_payload"
          ? "error"
          : "warning"
    };
  }

  if (
    financialSummaryState.summary.statementState === "PREVIEW_READY" &&
    financialStatementsStructuredState.financialStatements.statementState === "PREVIEW_READY"
  ) {
    return {
      detail: "Non statutaires, pour revue humaine.",
      href: "#previews",
      label: "Previews",
      stateLabel: "disponibles",
      tone: "success"
    };
  }

  if (
    financialSummaryState.summary.statementState === "NO_DATA" &&
    financialStatementsStructuredState.financialStatements.statementState === "NO_DATA"
  ) {
    return {
      detail: "Aucune preview exploitable.",
      href: "#previews",
      label: "Previews",
      stateLabel: "aucune",
      tone: "warning"
    };
  }

  return {
    detail: "Preview partielle ou bloquee.",
    href: "#previews",
    label: "Previews",
    stateLabel: "partiel",
    tone: "warning"
  };
}

function createEvidenceStep(workpapersState: WorkpapersShellState): CockpitStep {
  if (workpapersState.kind === "loading") {
    return {
      detail: "Evidence en chargement.",
      href: "#evidence",
      label: "Evidence",
      stateLabel: "chargement",
      tone: "neutral"
    };
  }

  if (workpapersState.kind !== "ready") {
    return {
      detail: "Evidence indisponible.",
      href: "#evidence",
      label: "Evidence",
      stateLabel: workpapersState.kind === "invalid_payload" ? "incoherent" : "indisponible",
      tone: workpapersState.kind === "invalid_payload" ? "error" : "warning"
    };
  }

  const { summaryCounts } = workpapersState.workpapers;
  const documentCounts = getWorkpaperDocumentCounts(workpapersState);

  if (summaryCounts.totalCurrentAnchors === 0) {
    return {
      detail: "Aucun anchor courant.",
      href: "#evidence",
      label: "Evidence",
      stateLabel: "vide",
      tone: "neutral"
    };
  }

  if (summaryCounts.missingCount > 0 || documentCounts.unverifiedCount > 0) {
    return {
      detail: `${summaryCounts.missingCount} workpaper(s) manquant(s), ${documentCounts.unverifiedCount} piece(s) non verifiee(s).`,
      href: "#evidence",
      label: "Evidence",
      stateLabel: "a completer",
      tone: "warning"
    };
  }

  return {
    detail: `${summaryCounts.withWorkpaperCount} workpaper(s), ${documentCounts.verifiedCount} piece(s) verifiee(s).`,
    href: "#evidence",
    label: "Evidence",
    stateLabel: "pret",
    tone: "success"
  };
}

function formatReadySummary(state: ClosingReadyState) {
  const importText =
    state.controlsState.kind === "ready" && state.controlsState.controls.latestImportPresent
      ? `import v${state.controlsState.controls.latestImportVersion ?? "?"}`
      : "import a verifier";
  const mappingText =
    state.manualMappingState.kind === "ready"
      ? `${state.manualMappingState.projection.summary.mapped}/${state.manualMappingState.projection.summary.total} comptes mappes`
      : "mapping a verifier";
  const controlsText =
    state.controlsState.kind === "ready" && state.controlsState.controls.readiness === "READY"
      ? "controls prets"
      : "controls a verifier";

  return `${importText} - ${mappingText} - ${controlsText}`;
}

function formatEvidenceReviewSummary(workpapersState: WorkpapersShellState) {
  if (workpapersState.kind === "loading") {
    return "Workpapers et preuves en chargement.";
  }

  if (workpapersState.kind !== "ready") {
    return "Workpapers et preuves indisponibles pour le moment.";
  }

  const { summaryCounts } = workpapersState.workpapers;
  const documentCounts = getWorkpaperDocumentCounts(workpapersState);

  return `${summaryCounts.withWorkpaperCount}/${summaryCounts.totalCurrentAnchors} justification(s), ${documentCounts.documentsCount} piece(s), ${summaryCounts.readyForReviewCount} pret(s) pour revue, ${summaryCounts.reviewedCount} revu(s).`;
}

function formatPreviewExportSummary(
  financialSummaryState: FinancialSummaryShellState,
  financialStatementsStructuredState: FinancialStatementsStructuredShellState
) {
  const financialSummaryLabel =
    financialSummaryState.kind === "ready"
      ? formatFinancialSummaryStateLabel(financialSummaryState.summary.statementState)
      : formatShellStateLabel(financialSummaryState.kind);
  const structuredLabel =
    financialStatementsStructuredState.kind === "ready"
      ? formatStructuredPreviewStateLabel(
          financialStatementsStructuredState.financialStatements.statementState
        )
      : formatShellStateLabel(financialStatementsStructuredState.kind);

  return `${financialSummaryLabel} - ${structuredLabel}. Preview non statutaire. Revue humaine requise.`;
}

function getWorkpaperDocumentCounts(workpapersState: Extract<WorkpapersShellState, { kind: "ready" }>) {
  return workpapersState.workpapers.items.reduce(
    (counts, item) => {
      for (const document of item.documents) {
        counts.documentsCount += 1;

        if (document.verificationStatus === "VERIFIED") {
          counts.verifiedCount += 1;
        } else if (document.verificationStatus === "REJECTED") {
          counts.rejectedCount += 1;
        } else {
          counts.unverifiedCount += 1;
        }
      }

      return counts;
    },
    {
      documentsCount: 0,
      rejectedCount: 0,
      unverifiedCount: 0,
      verifiedCount: 0
    }
  );
}

function hasLoadingCockpitSurface(state: ClosingReadyState) {
  return (
    state.controlsState.kind === "loading" ||
    state.manualMappingState.kind === "loading" ||
    state.financialSummaryState.kind === "loading" ||
    state.financialStatementsStructuredState.kind === "loading" ||
    state.workpapersState.kind === "loading"
  );
}

function formatFinancialSummaryStateLabel(state: FinancialSummaryPreview["statementState"]) {
  if (state === "PREVIEW_READY") {
    return "Synthese financiere disponible";
  }

  if (state === "PREVIEW_PARTIAL") {
    return "Synthese financiere partielle";
  }

  return "Synthese financiere sans donnee";
}

function formatStructuredPreviewStateLabel(
  state: StructuredFinancialStatementsPreview["statementState"]
) {
  if (state === "PREVIEW_READY") {
    return "Preview structuree disponible";
  }

  if (state === "BLOCKED") {
    return "Preview structuree bloquee";
  }

  return "Preview structuree sans donnee";
}

function formatShellStateLabel(kind: string) {
  if (kind === "loading") {
    return "chargement";
  }

  if (kind === "invalid_payload") {
    return "donnees incoherentes";
  }

  return "indisponible";
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
        {importState.refreshWarnings.closingFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement dossier impossible</p>
        ) : null}
        {importState.refreshWarnings.controlsFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement controls impossible</p>
        ) : null}
        {importState.refreshWarnings.mappingFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement mapping impossible</p>
        ) : null}
        {importState.refreshWarnings.financialSummaryFailed ? (
          <p className="text-sm font-medium text-foreground">
            rafraichissement financial summary impossible
          </p>
        ) : null}
        {importState.refreshWarnings.financialStatementsFailed ? (
          <p className="text-sm font-medium text-foreground">
            rafraichissement financial statements impossible
          </p>
        ) : null}
        {importState.refreshWarnings.workpapersFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement workpapers impossible</p>
        ) : null}
        {importState.refreshWarnings.importHistoryFailed ? (
          <p className="text-sm font-medium text-foreground">
            rafraichissement historique imports impossible
          </p>
        ) : null}
        {importState.refreshWarnings.importDiffFailed ? (
          <p className="text-sm font-medium text-foreground">
            rafraichissement diff import impossible
          </p>
        ) : null}
        {importState.refreshWarnings.suggestionsFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement suggestions impossible</p>
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
        {state.refreshWarnings.mappingFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement mapping impossible</p>
        ) : null}
        {state.refreshWarnings.controlsFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement controls impossible</p>
        ) : null}
        {state.refreshWarnings.financialSummaryFailed ? (
          <p className="text-sm font-medium text-foreground">
            rafraichissement financial summary impossible
          </p>
        ) : null}
        {state.refreshWarnings.financialStatementsFailed ? (
          <p className="text-sm font-medium text-foreground">
            rafraichissement financial statements impossible
          </p>
        ) : null}
        {state.refreshWarnings.workpapersFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement workpapers impossible</p>
        ) : null}
        {state.refreshWarnings.suggestionsFailed ? (
          <p className="text-sm font-medium text-foreground">rafraichissement suggestions impossible</p>
        ) : null}
      </div>
    );
  }

  return <StateMessage text={formatManualMappingMutationState(state)} />;
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
        Preview non statutaire. Not a final CO deliverable. Do not use as statutory filing.
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
        Preview structuree non statutaire. Not a final CO deliverable. Do not use as
        statutory filing.
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

async function loadInitialBalanceImportHistoryState(
  closingFolderId: string,
  activeTenant: ActiveTenant
): Promise<BalanceImportHistoryPanelState> {
  const versionsState = await loadBalanceImportVersionsShellState(closingFolderId, activeTenant);

  if (versionsState.kind === "invalid_payload") {
    return { kind: "history_invalid_payload" };
  }

  if (versionsState.kind !== "ready") {
    return { kind: "history_error" };
  }

  if (versionsState.versions.length === 0) {
    return { kind: "empty" };
  }

  const currentVersion = versionsState.versions[0]?.version;

  if (currentVersion === undefined) {
    return { kind: "history_invalid_payload" };
  }

  const diffState = await loadBalanceImportDiffPreviousShellState(
    closingFolderId,
    currentVersion,
    activeTenant
  );

  return combineBalanceImportHistoryState(versionsState.versions, currentVersion, diffState);
}

async function refreshBalanceImportHistoryAfterImport(
  closingFolderId: string,
  activeTenant: ActiveTenant,
  importedVersion: number
): Promise<{
  state: BalanceImportHistoryPanelState;
  versionsSucceeded: boolean;
  diffSucceeded: boolean;
}> {
  const [versionsState, diffState] = await Promise.all([
    loadBalanceImportVersionsShellState(closingFolderId, activeTenant),
    loadBalanceImportDiffPreviousShellState(closingFolderId, importedVersion, activeTenant)
  ]);

  if (versionsState.kind === "invalid_payload") {
    return {
      state: { kind: "history_invalid_payload" },
      versionsSucceeded: false,
      diffSucceeded: diffState.kind === "ready"
    };
  }

  if (versionsState.kind !== "ready") {
    return {
      state: { kind: "history_error" },
      versionsSucceeded: false,
      diffSucceeded: diffState.kind === "ready"
    };
  }

  return {
    state: combineBalanceImportHistoryState(versionsState.versions, importedVersion, diffState),
    versionsSucceeded: true,
    diffSucceeded: diffState.kind === "ready"
  };
}

function combineBalanceImportHistoryState(
  versions: BalanceImportVersionSummary[],
  requestedVersion: number,
  diffState: BalanceImportDiffState
): BalanceImportHistoryPanelState {
  if (diffState.kind === "invalid_payload") {
    return {
      kind: "diff_invalid_payload",
      versions,
      requestedVersion
    };
  }

  if (diffState.kind !== "ready") {
    return {
      kind: "diff_error",
      versions,
      requestedVersion
    };
  }

  return {
    kind: "ready",
    versions,
    diff: diffState.diff
  };
}

function updateImportSuccessRefreshWarnings(
  importState: ImportBalanceState,
  requestId: number,
  refreshWarnings: ImportRefreshWarnings
) {
  if (importState.kind !== "success" || importState.requestId !== requestId) {
    return importState;
  }

  return {
    ...importState,
    refreshWarnings: {
      ...importState.refreshWarnings,
      ...refreshWarnings
    }
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
