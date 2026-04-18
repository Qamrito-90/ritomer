import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { vi } from "vitest";
import { ToastUndo } from "./toast-undo";

describe("ToastUndo", () => {
  it("renders the toast and invokes undo", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    const { container } = render(
      <ToastUndo
        description="Description"
        onOpenChange={() => {}}
        onUndo={onUndo}
        open={true}
        title="Suppression locale"
      />
    );

    await user.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.getByText("Suppression locale")).toBeInTheDocument();
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect((await axe(container)).violations).toEqual([]);
  });
});
