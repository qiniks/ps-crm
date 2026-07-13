import { createSupabaseServerClient } from "@/lib/supabase/server";

// Never trust getSession() in server code — it doesn't revalidate the token.
// getUser() sends a request to Supabase Auth to confirm it on every call.
//
// A stale/rotated refresh token cookie makes getUser() throw (AuthApiError:
// "Invalid Refresh Token: Refresh Token Not Found") instead of returning a
// null user like an expired-but-present session would. Treat that the same
// as unauthenticated so callers fall back to the normal signed-out path
// (middleware redirects to /login, API routes 401) instead of crashing.
export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
