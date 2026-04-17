import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { z } from "zod";
import { Link, createBrowserRouter, createMemoryRouter, useParams } from "react-router-dom";
import { AppShell } from "../components/workbench/app-shell";
import { Button } from "../components/ui/button";
import { DataTable } from "../components/ui/data-table";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { ToastUndo } from "../components/ui/toast-undo";
import { WorkflowBadge } from "../components/ui/workflow-badge";
import {
  loadClosingFolderShellState,
  type ClosingFolderSummary
} from "../lib/api/closing-folders";
import { loadMeShellState, type ActiveTenant } from "../lib/api/me";
import { formatLocalDate } from "../lib/format/date";
import { formatOptionalText } from "../lib/format/text";

const demoFormSchema = z.object({
  closingFolderId: z.string().min(1, "identifiant requis"),
  density: z.enum(["comfortable", "default", "compact"])
});

type DemoFormValues = z.infer<typeof demoFormSchema>;

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
  | { kind: "closing_ready"; activeTenant: ActiveTenant; closingFolder: ClosingFolderSummary };

interface DemoRow {
  item: string;
  owner: string;
  status: string;
}

const demoRows: DemoRow[] = [
  { item: "Checklist dossier", owner: "Maker", status: "DRAFT" },
  { item: "Revue evidence", owner: "Checker", status: "REVIEW" },
  { item: "Pack export", owner: "Manager", status: "FINALIZED" }
];

const demoColumns: Array<ColumnDef<DemoRow>> = [
  {
    accessorKey: "item",
    header: "Element"
  },
  {
    accessorKey: "owner",
    header: "Responsable"
  },
  {
    accessorKey: "status",
    header: "Statut",
    cell: ({ row }) => <WorkflowBadge status={row.original.status} />
  }
];

function DemoRoute() {
  const [toastOpen, setToastOpen] = useState(false);
  const form = useForm<DemoFormValues>({
    resolver: zodResolver(demoFormSchema),
    defaultValues: {
      closingFolderId: "11111111-1111-1111-1111-111111111111",
      density: "default"
    }
  });
  const closingFolderId = form.watch("closingFolderId");
  const density = form.watch("density");

  return (
    <AppShell
      actionZone={
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-medium text-foreground">Surface de demonstration interne</p>
            <p className="text-muted-foreground">Aucun appel API n est autorise sur cette route.</p>
          </div>
          <Button asChild size="sm">
            <Link to={`/closing-folders/${closingFolderId}`}>Ouvrir le shell dossier</Link>
          </Button>
        </div>
      }
      breadcrumb={[{ label: "Demonstration" }]}
      description="Preuve locale des composants exacts 004, des tokens et des etats sans frontend metier riche."
      eyebrow="Route interne"
      sidebarItems={[
        { href: "/", label: "Demonstration" },
        { href: `/closing-folders/${closingFolderId}`, label: "Shell dossier" }
      ]}
      title="Design system minimal"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="panel p-6">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="label-eyebrow">Formulaire local</p>
              <h3 className="text-xl font-semibold">Input, Select et Button</h3>
              <p className="text-sm text-muted-foreground">
                Le formulaire reste purement local et pilote seulement la navigation SPA.
              </p>
            </div>
            <form
              className="grid gap-4"
              onSubmit={form.handleSubmit(() => {
                setToastOpen(true);
              })}
            >
              <div className="grid gap-2">
                <label className="text-sm font-medium text-foreground" htmlFor="closing-folder-id">
                  Closing folder id
                </label>
                <Input
                  id="closing-folder-id"
                  {...form.register("closingFolderId")}
                  aria-invalid={form.formState.errors.closingFolderId ? "true" : "false"}
                  placeholder="uuid du dossier"
                />
                {form.formState.errors.closingFolderId ? (
                  <p className="text-sm text-[hsl(var(--error-default))]">
                    {form.formState.errors.closingFolderId.message}
                  </p>
                ) : null}
              </div>
              <Controller
                control={form.control}
                name="density"
                render={({ field }) => (
                  <Select
                    description="Lecture locale de la densite d affichage du workbench."
                    label="Densite"
                    name="density"
                    onValueChange={field.onChange}
                    options={[
                      { label: "Comfortable", value: "comfortable" },
                      { label: "Default", value: "default" },
                      { label: "Compact", value: "compact" }
                    ]}
                    value={field.value}
                  />
                )}
              />
              <div className="flex flex-wrap gap-3">
                <Button type="submit">Afficher ToastUndo</Button>
                <Button type="button" variant="secondary">
                  lecture seule
                </Button>
              </div>
            </form>
          </div>
        </section>

        <section className="panel p-6">
          <div className="grid gap-4">
            <div>
              <p className="label-eyebrow">WorkflowBadge</p>
              <h3 className="text-xl font-semibold">Statuts codables</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {["DRAFT", "REVIEW", "VALIDATED", "FINALIZED", "EXPORTED"].map((status) => (
                <WorkflowBadge key={status} status={status} />
              ))}
            </div>
            <dl className="grid gap-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Densite</dt>
                <dd className="font-medium text-foreground">{density}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted-foreground">Route shell cible</dt>
                <dd className="font-medium text-foreground">{closingFolderId}</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="xl:col-span-2">
          <DataTable
            caption="Table de demonstration interne"
            columns={demoColumns}
            data={demoRows}
            emptyMessage="Aucune ligne de demonstration."
          />
        </section>
      </div>

      <ToastUndo
        actionLabel="Annuler"
        description="Aucune mutation backend n a eu lieu sur la route de demonstration."
        onOpenChange={setToastOpen}
        onUndo={() => setToastOpen(false)}
        open={toastOpen}
        title="ToastUndo actif"
      />
    </AppShell>
  );
}

function ClosingFolderRoute() {
  const { closingFolderId = "" } = useParams();
  const [state, setState] = useState<ClosingRouteState>({ kind: "loading" });

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
        case "ready":
          setState({
            kind: "closing_ready",
            activeTenant: meState.activeTenant,
            closingFolder: closingFolderState.closingFolder
          });
      }
    }

    void loadShellState();

    return () => {
      cancelled = true;
    };
  }, [closingFolderId]);

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
            <p className="text-muted-foreground">lecture seule</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/">Retour demonstration</Link>
          </Button>
        </div>
      }
      breadcrumb={[
        { label: "Closing folders", href: "/" },
        { label: "Dossier" }
      ]}
      description="Shell produit minimal borne a GET /api/me puis GET /api/closing-folders/{id}."
      eyebrow="Route shell produit"
      sidebarItems={[
        { href: "/", label: "Demonstration" },
        { href: `/closing-folders/${closingFolderId}`, label: "Dossier" }
      ]}
      tenant={tenant}
      title="Closing folder shell"
    >
      <section className="panel p-6">
        {state.kind === "loading" ? (
          <div aria-live="polite" className="grid gap-2">
            <p className="label-eyebrow">Chargement</p>
            <p className="text-lg font-semibold text-foreground">chargement dossier</p>
          </div>
        ) : null}

        {state.kind === "auth_required" ? <StateMessage text="authentification requise" /> : null}
        {state.kind === "tenant_context_required" ? (
          <StateMessage text="contexte tenant requis" />
        ) : null}
        {state.kind === "profile_unavailable" ? <StateMessage text="profil indisponible" /> : null}
        {state.kind === "closing_auth_required" ? (
          <StateMessage text="authentification requise" />
        ) : null}
        {state.kind === "closing_forbidden" ? <StateMessage text="acces dossier refuse" /> : null}
        {state.kind === "closing_not_found" ? <StateMessage text="dossier introuvable" /> : null}
        {state.kind === "closing_unavailable" ? (
          <StateMessage text="dossier indisponible" />
        ) : null}
        {state.kind === "closing_tenant_mismatch" ? (
          <StateMessage text="incoherence tenant dossier" />
        ) : null}
        {state.kind === "closing_ready" ? (
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
        ) : null}
      </section>
    </AppShell>
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

const routeDefinitions = [
  {
    path: "/",
    element: <DemoRoute />
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
