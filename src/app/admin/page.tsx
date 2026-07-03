import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createClub, inviteMember } from "./actions";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/clubs");
  }

  const clubs = await prisma.tenant.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-white">Admin</h1>

      <section className="mb-8 rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Create a club</h2>
        <form action={createClub} className="flex gap-3">
          <input
            name="name"
            placeholder="Club name"
            required
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Create
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
        <h2 className="mb-3 text-lg font-semibold text-white">Invite a member</h2>
        <form action={inviteMember} className="flex flex-col gap-3">
          <input
            name="email"
            type="email"
            placeholder="Email"
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          />
          <select
            name="tenantId"
            required
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-brand"
          >
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">
            Send invite
          </button>
        </form>
      </section>
    </div>
  );
}
