import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LanguageProvider } from "@/lib/i18n/LanguageProvider";

const { signInWithPassword } = vi.hoisted(() => ({ signInWithPassword: vi.fn() }));
const { push, refresh } = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

import LoginPage from "./page";

function renderLoginPage() {
  return render(
    <LanguageProvider>
      <LoginPage />
    </LanguageProvider>
  );
}

beforeEach(() => {
  signInWithPassword.mockReset();
  push.mockReset();
  refresh.mockReset();
  localStorage.setItem("ps-crm.locale", "en");
});

describe("LoginPage", () => {
  it("shows an error message when sign-in fails", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const user = userEvent.setup();

    renderLoginPage();
    await user.type(screen.getByPlaceholderText("Email"), "owner@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("redirects to /clubs when sign-in succeeds", async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    const user = userEvent.setup();

    renderLoginPage();
    await user.type(screen.getByPlaceholderText("Email"), "owner@example.com");
    await user.type(screen.getByPlaceholderText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/clubs"));
  });
});
