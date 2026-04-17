import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { AppShell } from "./app-shell";

describe("AppShell", () => {
  it("renders header, sidebar, breadcrumb, sticky action zone, and tenant context", async () => {
    const { container } = render(
      <MemoryRouter>
        <AppShell
          actionZone={<p>lecture seule</p>}
          breadcrumb={[
            { label: "Closing folders", href: "/" },
            { label: "Folder 1" }
          ]}
          description="Shell lecture seule"
          eyebrow="Route shell produit"
          sidebarItems={[
            { href: "/", label: "Demonstration" },
            { href: "/closing-folders/folder-1", label: "Dossier" }
          ]}
          tenant={{ tenantName: "Tenant Alpha", tenantSlug: "tenant-alpha" }}
          title="Closing folder shell"
        >
          <div>Contenu</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole("navigation", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByText("lecture seule")).toBeInTheDocument();
    expect(screen.getByLabelText("tenant actif")).toHaveTextContent("Tenant Alpha");
    expect((await axe(container)).violations).toEqual([]);
  });
});
