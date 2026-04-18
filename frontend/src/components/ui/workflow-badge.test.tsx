import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { WorkflowBadge } from "./workflow-badge";

describe("WorkflowBadge", () => {
  it("renders the workflow label accessibly", async () => {
    const { container } = render(<WorkflowBadge status="PREVIEW_READY" />);

    expect(screen.getByText("PREVIEW READY")).toBeInTheDocument();
    expect((await axe(container)).violations).toEqual([]);
  });
});
