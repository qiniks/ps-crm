import { NextResponse, type NextRequest } from "next/server";
import { resolveSafeRedirect } from "@/lib/auth/resolveSafeRedirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /auth/callback — lands here from the invite email's link. Exchanges the
// one-time code for a real session, then hands off to /set-password.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const rawNext = request.nextUrl.searchParams.get("next");
  // `next` is attacker-influenceable via a crafted invite link. Delegate to
  // resolveSafeRedirect, which returns a validated URL object directly — do
  // NOT convert it back to a string (e.g. pathname + search + hash) and
  // re-parse it later, since that reopens the same vulnerability class (see
  // resolveSafeRedirect's doc comment for why).
  const next = resolveSafeRedirect(rawNext, request.url, "/set-password");

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(next);
}
