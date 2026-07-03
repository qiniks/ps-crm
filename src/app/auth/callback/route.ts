import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /auth/callback — lands here from the invite email's link. Exchanges the
// one-time code for a real session, then hands off to /set-password.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const rawNext = request.nextUrl.searchParams.get("next");
  // Only honor `next` when it's a genuine relative path. Without this check,
  // `next` (attacker-influenceable via a crafted invite link) could be an
  // absolute URL or a protocol-relative "//evil.com" and cause an open
  // redirect off-site.
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : "/set-password";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
