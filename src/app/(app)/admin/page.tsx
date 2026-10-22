import Link from "next/link";
import { redirect } from "next/navigation";

import { adminMenuFor, type AdminMenu } from "@/components/app-shell/nav";
import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/infra/session";

/** Halaman yang sudah dibuat per fase; sisanya menyusul sesuai docs/06 §2. */
const ADMIN_ROUTES: Partial<Record<AdminMenu["label"], string>> = {
  User: "/admin/user",
  "Matriks approval": "/admin/matriks-approval",
  "Audit log": "/admin/audit-logs",
};

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const items = adminMenuFor(user.role);
  return (
    <>
      <PageHeader title="Admin" />
      <ul
        aria-label="Menu admin"
        className="max-w-[720px] divide-y rounded-lg border bg-panel"
      >
        {items.map((item) => {
          const href = ADMIN_ROUTES[item.label];
          return (
            <li key={item.label} className="px-4 py-3">
              {href ? (
                <Link href={href} className="text-canal hover:underline">
                  {item.label}
                </Link>
              ) : (
                <span className="text-ink-muted">{item.label}</span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
