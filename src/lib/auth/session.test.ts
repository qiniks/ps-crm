import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser } }),
}));

import { getSessionUser } from "./session";

beforeEach(() => {
  getUser.mockReset();
});

describe("getSessionUser", () => {
  it("returns the user on a valid session", async () => {
    const user = { id: "user-1" };
    getUser.mockResolvedValue({ data: { user } });

    expect(await getSessionUser()).toEqual(user);
  });

  it("returns null when getUser() rejects with an invalid refresh token error", async () => {
    getUser.mockRejectedValue(
      Object.assign(new Error("Invalid Refresh Token: Refresh Token Not Found"), {
        __isAuthError: true,
        status: 400,
        code: "refresh_token_not_found",
      })
    );

    expect(await getSessionUser()).toBeNull();
  });
});
