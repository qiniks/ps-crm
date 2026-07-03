import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// GET /auth/callback — lands here from the invite email's link. Exchanges the
// one-time code for a real session, then hands off to /set-password.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const rawNext = request.nextUrl.searchParams.get("next");
  // Only honor `next` when it resolves to the same origin as this request.
  // `next` is attacker-influenceable via a crafted invite link, and string
  // prefix checks (e.g. rejecting "//") are incomplete: WHATWG URL parsing
  // (the same parser browsers use) treats a leading backslash as equivalent
  // to a forward slash at the host boundary, so "/\evil.com" would still
  // resolve off-origin despite passing a "starts with /" check. Resolving
  // against the request's own base URL and comparing origins closes the
  // whole vulnerability class instead of enumerating escape sequences.
  let next = "/set-password";
  if (rawNext) {
    try {
      const resolved = new URL(rawNext, request.url);
      if (resolved.origin === new URL(request.url).origin) {
        next = resolved.pathname + resolved.search + resolved.hash;
      }
    } catch {
      // Malformed `next` value — fall back to /set-password.
    }
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(new URL(next, request.url));
}
