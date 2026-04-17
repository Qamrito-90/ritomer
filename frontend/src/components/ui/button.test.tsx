import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Button } from "./button";

describe("Button", () => {
  it("renders an accessible button", async () => {
    const { container } = render(<Button>Valider</Button>);

    expect(screen.getByRole("button", { name: "Valider" })).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });
});
