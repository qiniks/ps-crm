import { createSupabaseAdminClient } from "./admin";

// Creates a real, immediately-usable account without Supabase's invite-email
// flow: email_confirm marks the address verified up front, so the caller can
// hand the password to the new user directly and they can sign in right away.
export async function createConfirmedUser(email: string, password: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error || !data.user) {
    if (error?.code === "email_exists") {
      throw new Error(`A user with the email ${email} already exists`);
    }
    throw new Error(`Failed to create ${email}: ${error?.message ?? "unknown error"}`);
  }

  return data.user;
}
