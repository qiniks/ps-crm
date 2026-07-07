import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/session";
import { createClub, inviteMember } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.email !== process.env.ADMIN_EMAIL) {
    redirect("/clubs");
  }

  const clubs = await prisma.tenant.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold text-foreground">Admin</h1>

      <Card className="mb-8 p-5">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg">Create a club</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form action={createClub} className="flex gap-3">
            <Input name="name" placeholder="Club name" required className="flex-1" />
            <Button>Create</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="p-5">
        <CardHeader className="p-0 pb-3">
          <CardTitle className="text-lg">Invite a member</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <form action={inviteMember} className="flex flex-col gap-3">
            <Input name="email" type="email" placeholder="Email" required />
            <Select name="tenantId" required>
              <SelectTrigger>
                <SelectValue placeholder="Select a club" />
              </SelectTrigger>
              <SelectContent>
                {clubs.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button>Send invite</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
