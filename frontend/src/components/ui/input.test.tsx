import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Input } from "./input";

describe("Input", () => {
  it("accepts typed content and stays accessible", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div>
        <label htmlFor="folder-name">Nom</label>
        <Input id="folder-name" />
      </div>
    );

    await user.type(screen.getByLabelText("Nom"), "Closing FY26");

    expect(screen.getByLabelText("Nom")).toHaveValue("Closing FY26");
    expect((await axe(container)).violations).toEqual([]);
  });
});
