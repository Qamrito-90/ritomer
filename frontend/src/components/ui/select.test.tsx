import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { Select } from "./select";

function SelectHarness() {
  const [value, setValue] = useState("default");

  return (
    <Select
      label="Densite"
      onValueChange={setValue}
      options={[
        { label: "Comfortable", value: "comfortable" },
        { label: "Default", value: "default" },
        { label: "Compact", value: "compact" }
      ]}
      value={value}
    />
  );
}

describe("Select", () => {
  it("selects a value through radix and stays accessible", async () => {
    const user = userEvent.setup();
    const { container } = render(<SelectHarness />);

    await user.click(screen.getByRole("combobox", { name: "Densite" }));
    await user.click(await screen.findByRole("option", { name: "Compact" }));

    expect(screen.getByRole("combobox", { name: "Densite" })).toHaveTextContent("Compact");
    expect((await axe(container)).violations).toEqual([]);
  });
});
