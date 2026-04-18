import { render, screen } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { axe } from "jest-axe";
import { DataTable } from "./data-table";

interface Row {
  item: string;
  owner: string;
}

const columns: Array<ColumnDef<Row>> = [
  { accessorKey: "item", header: "Element" },
  { accessorKey: "owner", header: "Responsable" }
];

describe("DataTable", () => {
  it("renders rows and remains accessible", async () => {
    const { container } = render(
      <DataTable
        caption="Table de test"
        columns={columns}
        data={[{ item: "Dossier", owner: "Maker" }]}
        emptyMessage="Aucune ligne"
      />
    );

    expect(screen.getByRole("columnheader", { name: "Element" })).toBeInTheDocument();
    expect(screen.getByText("Dossier")).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });
});
