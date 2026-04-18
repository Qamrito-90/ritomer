import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { cn } from "../../lib/classnames";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface SidebarItem {
  href: string;
  label: string;
}

interface TenantSummary {
  tenantName: string;
  tenantSlug: string;
}

interface AppShellProps {
  eyebrow: string;
  title: string;
  description: string;
  breadcrumb: BreadcrumbItem[];
  sidebarItems: SidebarItem[];
  tenant?: TenantSummary;
  actionZone?: ReactNode;
  children: ReactNode;
}

export function AppShell({
  eyebrow,
  title,
  description,
  breadcrumb,
  sidebarItems,
  tenant,
  actionZone,
  children
}: AppShellProps) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 lg:grid-cols-[260px_minmax(0,1fr)] lg:px-6">
        <aside className="panel bg-sidebar/90 p-4">
          <div className="grid gap-6">
            <div className="grid gap-2">
              <p className="label-eyebrow">Ritomer</p>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Frontend foundation 004</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Shell lecture seule et design system minimal.
                </p>
              </div>
            </div>
            <nav aria-label="Navigation principale">
              <ul className="grid gap-2">
                {sidebarItems.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      className={({ isActive }) =>
                        cn(
                          "block rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted",
                          isActive && "bg-[hsl(var(--state-selected))]"
                        )
                      }
                      to={item.href}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>
        <div className="flex min-h-screen flex-col gap-4">
          <header className="panel p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="grid gap-3">
                <div className="label-eyebrow">{eyebrow}</div>
                <nav aria-label="Breadcrumb">
                  <ol className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    {breadcrumb.map((item, index) => (
                      <li className="flex items-center gap-2" key={`${item.label}-${index}`}>
                        {item.href ? (
                          <Link to={item.href}>{item.label}</Link>
                        ) : (
                          <span aria-current="page" className="text-foreground">
                            {item.label}
                          </span>
                        )}
                        {index < breadcrumb.length - 1 ? <span>/</span> : null}
                      </li>
                    ))}
                  </ol>
                </nav>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
              </div>
              {tenant ? (
                <div
                  aria-label="tenant actif"
                  className="rounded-lg border bg-[hsl(var(--state-selected))] px-4 py-3 text-sm"
                >
                  <div className="label-eyebrow">Tenant actif</div>
                  <p className="mt-2 font-semibold text-foreground">{tenant.tenantName}</p>
                  <p className="text-muted-foreground">{tenant.tenantSlug}</p>
                </div>
              ) : null}
            </div>
          </header>
          <div className="sticky top-4 z-10 panel border-dashed bg-card/90 p-4 backdrop-blur">
            {actionZone ?? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="font-medium text-foreground">Zone d action</p>
                <p className="text-muted-foreground">lecture seule</p>
              </div>
            )}
          </div>
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
