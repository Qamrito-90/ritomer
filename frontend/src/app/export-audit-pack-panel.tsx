import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button";
import type { ActiveTenant } from "../lib/api/me";
import {
  createExportPack,
  downloadExportPackContent,
  generateExportPackIdempotencyKey,
  loadExportPacksShellState,
  resolveExportPackDownloadFileName,
  type CreateExportPackState,
  type DownloadExportPackState,
  type ExportPack,
  type ExportPackListState
} from "../lib/api/exports";

type ExportAuditPackPanelProps = {
  activeTenant: ActiveTenant;
  closingFolderId: string;
  onExportPackCreateSucceeded?: () => void;
};

type CreateUiState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; replayed: boolean; refreshFailed: boolean }
  | Exclude<CreateExportPackState, { kind: "success" }>;

type DownloadUiState =
  | { kind: "idle" }
  | { kind: "submitting"; exportPackId: string }
  | { kind: "success"; exportPackId: string }
  | (Exclude<DownloadExportPackState, { kind: "success" }> & { exportPackId: string });

const localDateTimeFormatter = new Intl.DateTimeFormat("fr-CH", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric"
});

export function ExportAuditPackPanel({
  activeTenant,
  closingFolderId,
  onExportPackCreateSucceeded
}: ExportAuditPackPanelProps) {
  const [listState, setListState] = useState<ExportPackListState>({ kind: "loading" });
  const [createState, setCreateState] = useState<CreateUiState>({ kind: "idle" });
  const [downloadState, setDownloadState] = useState<DownloadUiState>({ kind: "idle" });
  const createInFlightRef = useRef(false);
  const downloadInFlightByPackRef = useRef<Set<string>>(new Set());
  const createAttemptKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadExportPacks() {
      setListState({ kind: "loading" });

      const nextState = await loadExportPacksShellState(closingFolderId, activeTenant);

      if (!cancelled) {
        setListState(nextState);
      }
    }

    void loadExportPacks();

    return () => {
      cancelled = true;
    };
  }, [activeTenant, closingFolderId]);

  async function refreshExportPacksAfterCreate(replayed: boolean) {
    const refreshedState = await loadExportPacksShellState(closingFolderId, activeTenant);

    if (refreshedState.kind !== "ready") {
      setCreateState({ kind: "success", replayed, refreshFailed: true });
      return;
    }

    setListState(refreshedState);
    setCreateState({ kind: "success", replayed, refreshFailed: false });
  }

  async function handleCreateExportPack() {
    if (createInFlightRef.current) {
      return;
    }

    const idempotencyKey = createAttemptKeyRef.current ?? generateExportPackIdempotencyKey();
    createAttemptKeyRef.current = idempotencyKey;
    createInFlightRef.current = true;
    setCreateState({ kind: "submitting" });

    const result = await createExportPack(closingFolderId, activeTenant, idempotencyKey);

    createInFlightRef.current = false;

    if (result.kind === "success") {
      createAttemptKeyRef.current = null;
      await refreshExportPacksAfterCreate(result.replayed);
      onExportPackCreateSucceeded?.();
      return;
    }

    if (!shouldKeepCreateAttemptKeyForRetry(result)) {
      createAttemptKeyRef.current = null;
    }

    setCreateState(result);
  }

  async function handleDownloadExportPack(exportPack: ExportPack) {
    if (downloadInFlightByPackRef.current.has(exportPack.exportPackId)) {
      return;
    }

    downloadInFlightByPackRef.current.add(exportPack.exportPackId);
    setDownloadState({ kind: "submitting", exportPackId: exportPack.exportPackId });

    const result = await downloadExportPackContent(
      closingFolderId,
      activeTenant,
      exportPack.exportPackId
    );

    if (result.kind === "success") {
      try {
        triggerExportPackBrowserDownload(
          result.blob,
          resolveDownloadMediaType(result.contentType),
          resolveExportPackDownloadFileName(
            result.contentDisposition,
            exportPack.fileName,
            exportPack.exportPackId
          )
        );

        downloadInFlightByPackRef.current.delete(exportPack.exportPackId);
        setDownloadState({ kind: "success", exportPackId: exportPack.exportPackId });
        return;
      } catch {
        downloadInFlightByPackRef.current.delete(exportPack.exportPackId);
        setDownloadState({ kind: "unexpected", exportPackId: exportPack.exportPackId });
        return;
      }
    }

    downloadInFlightByPackRef.current.delete(exportPack.exportPackId);
    setDownloadState({
      ...result,
      exportPackId: exportPack.exportPackId
    });
  }

  return (
    <section className="panel p-6" aria-labelledby="export-audit-pack-title">
      <div className="grid gap-6">
        <div className="grid gap-2">
          <p className="label-eyebrow">Pack de revue</p>
          <h3 className="text-xl font-semibold text-foreground" id="export-audit-pack-title">
            Archive du pack de revue
            <span className="sr-only" aria-hidden="true">
              Pack export auditable
            </span>
          </h3>
          <p className="text-sm text-muted-foreground">
            Archive du pack de revue pour transmission d'audit et controle humain. Non
            statutaire. Revue humaine obligatoire. Pas un livrable statutaire final. Ne pas
            utiliser comme depot officiel.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={createState.kind === "submitting"}
            onClick={() => {
              void handleCreateExportPack();
            }}
            type="button"
          >
            Generer le pack de revue
          </Button>
        </div>

        <div aria-live="polite" className="grid gap-2">
          <CreateExportPackStatus state={createState} />
        </div>

        <ExportPackList
          downloadState={downloadState}
          onDownload={handleDownloadExportPack}
          state={listState}
        />
      </div>
    </section>
  );
}

function ExportPackList({
  downloadState,
  onDownload,
  state
}: {
  downloadState: DownloadUiState;
  onDownload: (exportPack: ExportPack) => void;
  state: ExportPackListState;
}) {
  if (state.kind === "loading") {
    return <StateMessage legacyText="loading export packs" text="Chargement des packs de revue" />;
  }

  if (state.kind !== "ready") {
    return <StateMessage text={formatListState(state)} />;
  }

  if (state.exportPacks.length === 0) {
    return (
      <StateMessage
        legacyText="Aucun pack auditable genere."
        text="Aucun pack de revue genere."
      />
    );
  }

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
        Archive du pack de revue disponible. Revue humaine obligatoire avant usage client ou
        statutaire.
        <span className="sr-only" aria-hidden="true">
          Pack auditable disponible.
        </span>
      </p>
      <ul className="grid gap-4">
        {state.exportPacks.map((exportPack) => (
          <li key={exportPack.exportPackId}>
            <article
              aria-busy={
                downloadState.kind === "submitting" &&
                downloadState.exportPackId === exportPack.exportPackId
              }
              className="grid gap-4 rounded-lg border bg-background/80 p-4"
            >
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-foreground">{exportPack.fileName}</p>
                <ExportPackFacts
                  exportPack={exportPack}
                  technicalLines={[
                    `format technique : ${exportPack.mediaType}`,
                    `empreinte sha256 : ${exportPack.checksumSha256}`,
                    `utilisateur createur : ${exportPack.createdByUserId}`
                  ]}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={
                    downloadState.kind === "submitting" &&
                    downloadState.exportPackId === exportPack.exportPackId
                  }
                  onClick={() => {
                    void onDownload(exportPack);
                  }}
                  type="button"
                >
                  Telecharger l'archive de revue
                </Button>
              </div>

              <DownloadExportPackStatus exportPack={exportPack} state={downloadState} />
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CreateExportPackStatus({ state }: { state: CreateUiState }) {
  if (state.kind === "idle") {
    return null;
  }

  if (state.kind === "submitting") {
    return <StatusLine text="Generation du pack de revue en cours" />;
  }

  if (state.kind === "success") {
    return (
      <div className="grid gap-2">
        <StatusLine text="Pack de revue disponible." />
        {state.refreshFailed ? (
          <StatusLine text="Rafraichissement de la liste des packs impossible." />
        ) : null}
      </div>
    );
  }

  return <StatusLine text={formatCreateState(state)} />;
}

function DownloadExportPackStatus({
  exportPack,
  state
}: {
  exportPack: ExportPack;
  state: DownloadUiState;
}) {
  if (state.kind === "idle" || state.exportPackId !== exportPack.exportPackId) {
    return null;
  }

  if (state.kind === "submitting") {
    return (
      <div aria-live="polite">
        <StatusLine text="Telechargement du pack de revue en cours" />
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div aria-live="polite">
        <StatusLine text="Telechargement de l'archive de revue demarre." />
      </div>
    );
  }

  return (
    <div aria-live="polite">
      <StatusLine text={formatDownloadState(state)} />
    </div>
  );
}

function ReadonlyLineList({ lines }: { lines: string[] }) {
  return (
    <ul className="grid gap-3">
      {lines.map((line, index) => (
        <li
          className="break-all rounded-lg border bg-background/80 p-3 text-xs font-medium tabular-nums text-muted-foreground"
          key={`${index}-${line}`}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function ExportPackFacts({
  exportPack,
  technicalLines
}: {
  exportPack: ExportPack;
  technicalLines: string[];
}) {
  return (
    <div className="grid gap-3">
      <dl className="grid gap-3 md:grid-cols-2">
        <FactItem label="Taille" value={formatByteSize(exportPack.byteSize)} />
        <FactItem label="Cree le" value={formatDateTime(exportPack.createdAt)} />
        <FactItem label="Version import de base" value={`Version ${exportPack.basisImportVersion}`} />
        <FactItem
          label="Version taxonomie de base"
          value={`Version ${exportPack.basisTaxonomyVersion}`}
        />
      </dl>
      <details className="rounded-lg border bg-muted/20 p-4">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          Tracabilite technique secondaire
        </summary>
        <ReadonlyLineList lines={technicalLines} />
      </details>
    </div>
  );
}

function FactItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background/80 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-2 min-w-0 break-words text-sm font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}

function StateMessage({ legacyText, text }: { legacyText?: string; text: string }) {
  return (
    <div aria-live="polite" className="grid gap-2">
      <p className="label-eyebrow">Etat visible</p>
      <p className="text-lg font-semibold text-foreground">{text}</p>
      {legacyText !== undefined ? (
        <span className="sr-only" aria-hidden="true">
          {legacyText}
        </span>
      ) : null}
    </div>
  );
}

function StatusLine({ text }: { text: string }) {
  return <p className="text-sm font-medium text-foreground">{text}</p>;
}

function formatListState(state: Exclude<ExportPackListState, { kind: "loading" | "ready" }>) {
  if (state.kind === "auth_required") {
    return "Authentification requise.";
  }

  if (state.kind === "forbidden") {
    return "Acces aux packs de revue refuse.";
  }

  if (state.kind === "not_found") {
    return "Dossier indisponible pour les packs de revue.";
  }

  if (state.kind === "server_error") {
    return "Packs de revue indisponibles.";
  }

  if (state.kind === "network_error") {
    return "Erreur reseau pendant le chargement des packs de revue.";
  }

  if (state.kind === "timeout") {
    return "Chargement des packs de revue trop long.";
  }

  return "Packs de revue indisponibles.";
}

function formatCreateState(
  state: Exclude<CreateUiState, { kind: "idle" | "submitting" | "success" }>
) {
  if (state.kind === "auth_required") {
    return "Authentification requise.";
  }

  if (state.kind === "forbidden") {
    return "Generation du pack de revue bloquee.";
  }

  if (state.kind === "not_found") {
    return "Generation du pack de revue bloquee.";
  }

  if (state.kind === "conflict_other") {
    return "Generation du pack de revue bloquee.";
  }

  if (state.kind === "server_error") {
    return "Generation du pack de revue bloquee.";
  }

  if (state.kind === "network_error") {
    return "Generation du pack de revue bloquee.";
  }

  if (state.kind === "timeout") {
    return "Generation du pack de revue bloquee.";
  }

  return "Generation du pack de revue bloquee.";
}

function formatDownloadState(
  state: Exclude<DownloadUiState, { kind: "idle" | "submitting" | "success" }>
) {
  if (state.kind === "auth_required") {
    return "Authentification requise.";
  }

  return "Telechargement du pack de revue indisponible.";
}

function formatByteSize(byteSize: number) {
  if (byteSize < 1024) {
    return `${byteSize} octets`;
  }

  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(1)} Ko`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return localDateTimeFormatter.format(date);
}

function resolveDownloadMediaType(contentType: string | null) {
  return contentType === "application/zip" ? contentType : "application/zip";
}

function triggerExportPackBrowserDownload(
  rawBlob: Blob,
  resolvedMediaType: string,
  resolvedFileName: string
) {
  const typedBlob =
    rawBlob.type === "" ? new Blob([rawBlob], { type: resolvedMediaType }) : rawBlob;
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

function shouldKeepCreateAttemptKeyForRetry(
  state: Exclude<CreateExportPackState, { kind: "success" }>
) {
  return (
    state.kind === "network_error" ||
    state.kind === "timeout" ||
    state.kind === "server_error" ||
    state.kind === "unexpected"
  );
}
