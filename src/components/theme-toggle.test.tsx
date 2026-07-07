import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
vi.mock("next-themes", () => ({ useTheme }));

import { ThemeToggle } from "./theme-toggle";

beforeEach(() => {
  useTheme.mockReset();
});

describe("ThemeToggle", () => {
  it("switches from dark to light when clicked", async () => {
    const setTheme = vi.fn();
    useTheme.mockReturnValue({ resolvedTheme: "dark", setTheme });
    const user = userEvent.setup();

    render(<ThemeToggle label="Toggle theme" />);
    await user.click(await screen.findByRole("button", { name: "Toggle theme" }));

    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("switches from light to dark when clicked", async () => {
    const setTheme = vi.fn();
    useTheme.mockReturnValue({ resolvedTheme: "light", setTheme });
    const user = userEvent.setup();

    render(<ThemeToggle label="Toggle theme" />);
    await user.click(await screen.findByRole("button", { name: "Toggle theme" }));

    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
