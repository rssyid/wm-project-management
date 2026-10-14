import { redirect } from "next/navigation";

import { AdminUserView } from "@/components/admin/admin-user-view";
import { PageHeader } from "@/components/page-header";
import { listUsers } from "@/domain/admin/service";
import { getSessionUser } from "@/infra/session";
import { can } from "@/shared/permissions";

/** docs/05 §10: daftar user dengan panel ubah di samping, bukan grid kartu. */
export default async function AdminUserPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!can(user.role, "user.manage")) redirect("/dashboard");

  const users = await listUsers();

  return (
    <>
      <PageHeader
        title="User"
        description="Password diberikan Super Admin sebagai password sementara dan wajib diganti saat login pertama."
      />
      <AdminUserView
        users={users.map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          role: row.role,
          isActive: row.isActive,
          mustChangePassword: row.mustChangePassword,
        }))}
        currentUserId={user.id}
      />
    </>
  );
}
