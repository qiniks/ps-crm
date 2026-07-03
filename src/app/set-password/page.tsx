"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (updateError) {
      setError("Could not set password. Try again.");
      return;
    }

    router.push("/clubs");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4">
      <h1 className="mb-2 text-2xl font-bold text-white">Set your password</h1>
      <p className="mb-6 text-sm text-slate-400">
        Choose a password to finish setting up your account.
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          required
          minLength={8}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-brand"
        />
        {error && <div className="text-sm text-red-400">{error}</div>}
        <button
          disabled={submitting}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Save password"}
        </button>
      </form>
    </div>
  );
}
