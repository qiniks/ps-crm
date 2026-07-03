import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /auth/callback — lands here from the invite email's link. Exchanges the
// one-time code for a real session, then hands off to /set-password.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = request.nextUrl.searchParams.get("next") ?? "/set-password";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
