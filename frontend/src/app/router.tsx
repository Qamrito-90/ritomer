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
  uploadBalanceImport,
  type BalanceImportValidationError
} from "../lib/api/import-balance";
import { loadMeShellState, type ActiveTenant } from "../lib/api/me";
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
      closingFolder: ClosingFolderSummary;
      controlsState: ControlsShellState;
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
            closingFolder: closingFolderState.closingFolder,
            controlsState: { kind: "loading" },
            importState: { kind: "idle" },
            selectedImportFile: null
          });

          const controlsState = await loadControlsShellState(
            closingFolderId,
            closingFolderState.closingFolder,
            meState.activeTenant
          );

          if (cancelled) {
            return;
          }

          setState((currentState) => {
            if (currentState.kind !== "closing_ready") {
              return currentState;
            }

            return {
              ...currentState,
              controlsState
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
      description="Shell produit borne a GET /api/me, GET /api/closing-folders/{id}, GET /api/closing-folders/{closingFolderId}/controls puis POST /api/closing-folders/{closingFolderId}/imports/balance."
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
                <p className="label-eyebrow">Controles</p>
                <h3 className="text-xl font-semibold text-foreground">Cockpit read-only</h3>
              </div>
              <ControlsSlot state={state.controlsState} />
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
