import { createSupabaseServerClient } from "@/lib/supabase/server";

// Never trust getSession() in server code — it doesn't revalidate the token.
// getUser() sends a request to Supabase Auth to confirm it on every call.
export async function getSessionUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
