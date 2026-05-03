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
  closingFolderId
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
          <p className="label-eyebrow">Exports</p>
          <h3 className="text-xl font-semibold text-foreground" id="export-audit-pack-title">
            Audit-ready export pack
          </h3>
          <p className="text-sm text-muted-foreground">
            Backend-generated ZIP for human review and audit handoff. Non statutory. Not a
            final CO deliverable. Human review required before client or statutory use.
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
            Generate audit-ready pack
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
    return <StateMessage text="loading export packs" />;
  }

  if (state.kind !== "ready") {
    return <StateMessage text={formatListState(state)} />;
  }

  if (state.exportPacks.length === 0) {
    return <StateMessage text="No audit-ready pack generated yet." />;
  }

  return (
    <div className="grid gap-4">
      <p className="rounded-lg border bg-background/80 p-4 text-sm font-medium text-foreground">
        Audit-ready pack available.
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
                <ReadonlyLineList
                  lines={[
                    `media type : ${exportPack.mediaType}`,
                    `size : ${formatByteSize(exportPack.byteSize)}`,
                    `checksum sha256 : ${exportPack.checksumSha256}`,
                    `basis import version : ${exportPack.basisImportVersion}`,
                    `basis taxonomy version : ${exportPack.basisTaxonomyVersion}`,
                    `created at : ${formatDateTime(exportPack.createdAt)}`,
                    `created by user : ${exportPack.createdByUserId}`
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
                  Download ZIP
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
    return <StatusLine text="generating audit-ready pack" />;
  }

  if (state.kind === "success") {
    return (
      <div className="grid gap-2">
        <StatusLine text="Audit-ready pack available." />
        {state.refreshFailed ? (
          <StatusLine text="Export pack list refresh unavailable." />
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
        <StatusLine text="downloading audit-ready pack" />
      </div>
    );
  }

  if (state.kind === "success") {
    return (
      <div aria-live="polite">
        <StatusLine text="Download ZIP started." />
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
          className="rounded-lg border bg-muted/20 p-4 text-sm font-medium tabular-nums text-foreground"
          key={`${index}-${line}`}
        >
          {line}
        </li>
      ))}
    </ul>
  );
}

function StateMessage({ text }: { text: string }) {
  return (
    <div aria-live="polite" className="grid gap-2">
      <p className="label-eyebrow">Visible state</p>
      <p className="text-lg font-semibold text-foreground">{text}</p>
    </div>
  );
}

function StatusLine({ text }: { text: string }) {
  return <p className="text-sm font-medium text-foreground">{text}</p>;
}

function formatListState(state: Exclude<ExportPackListState, { kind: "loading" | "ready" }>) {
  if (state.kind === "auth_required") {
    return "authentication required";
  }

  if (state.kind === "forbidden") {
    return "export packs access refused";
  }

  if (state.kind === "not_found") {
    return "closing folder unavailable for export packs";
  }

  if (state.kind === "server_error") {
    return "export packs unavailable";
  }

  if (state.kind === "network_error") {
    return "export packs network error";
  }

  if (state.kind === "timeout") {
    return "export packs timeout";
  }

  return "export packs unavailable";
}

function formatCreateState(
  state: Exclude<CreateUiState, { kind: "idle" | "submitting" | "success" }>
) {
  if (state.kind === "auth_required") {
    return "authentication required";
  }

  if (state.kind === "forbidden") {
    return "Export pack generation blocked.";
  }

  if (state.kind === "not_found") {
    return "Export pack generation blocked.";
  }

  if (state.kind === "conflict_other") {
    return "Export pack generation blocked.";
  }

  if (state.kind === "server_error") {
    return "Export pack generation blocked.";
  }

  if (state.kind === "network_error") {
    return "Export pack generation blocked.";
  }

  if (state.kind === "timeout") {
    return "Export pack generation blocked.";
  }

  return "Export pack generation blocked.";
}

function formatDownloadState(
  state: Exclude<DownloadUiState, { kind: "idle" | "submitting" | "success" }>
) {
  if (state.kind === "auth_required") {
    return "authentication required";
  }

  return "Export pack download unavailable.";
}

function formatByteSize(byteSize: number) {
  return `${byteSize} bytes`;
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
