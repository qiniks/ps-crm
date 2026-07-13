import { beforeEach, describe, expect, it, vi } from "vitest";

const { createUser } = vi.hoisted(() => ({ createUser: vi.fn() }));

vi.mock("./admin", () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { createUser } } }),
}));

import { createConfirmedUser } from "./createUser";

beforeEach(() => {
  createUser.mockReset();
});

describe("createConfirmedUser", () => {
  it("creates a user with a confirmed email", async () => {
    const user = { id: "user-1", email: "new@example.com" };
    createUser.mockResolvedValue({ data: { user }, error: null });

    expect(await createConfirmedUser("new@example.com", "hunter22")).toEqual(user);
    expect(createUser).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "hunter22",
      email_confirm: true,
    });
  });

  it("throws a friendly message when the email is already registered", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Email already in use", code: "email_exists" },
    });

    await expect(createConfirmedUser("dup@example.com", "hunter22")).rejects.toThrow(
      "A user with the email dup@example.com already exists"
    );
  });

  it("throws the underlying message for other failures", async () => {
    createUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Password too weak", code: "weak_password" },
    });

    await expect(createConfirmedUser("weak@example.com", "x")).rejects.toThrow("Password too weak");
  });
});
