import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createClub, inviteMember } from "./actions";
import { AdminPageClient } from "./AdminPageClient";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/clubs");
  }

  const clubs = await prisma.tenant.findMany({ orderBy: { name: "asc" } });

  return <AdminPageClient clubs={clubs} createClub={createClub} inviteMember={inviteMember} />;
}
