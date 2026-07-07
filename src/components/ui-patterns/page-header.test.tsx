import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeader } from "./page-header";

describe("PageHeader", () => {
  it("renders the title", () => {
    render(<PageHeader title="Clubs" />);
    expect(screen.getByRole("heading", { name: "Clubs" })).toBeInTheDocument();
  });

  it("renders an optional subtitle and actions", () => {
    render(<PageHeader title="Clubs" subtitle="Pick a club" actions={<button>+ Add</button>} />);
    expect(screen.getByText("Pick a club")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Add" })).toBeInTheDocument();
  });

  it("omits the subtitle paragraph when not provided", () => {
    const { container } = render(<PageHeader title="Clubs" />);
    expect(container.querySelector("p")).not.toBeInTheDocument();
  });
});
