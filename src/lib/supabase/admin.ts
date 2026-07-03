import { createClient } from "@supabase/supabase-js";

// Service-role client. Never import this from a Client Component or anything
// that ships to the browser — the service-role key bypasses row-level security.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
