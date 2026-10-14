import type { ReactNode } from "react";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { UserMenu } from "@/components/app-shell/user-menu";
import { getSessionUser } from "@/infra/session";

// Suspense diperlukan karena cacheComponents Next 16: session dibaca saat request, bukan
// saat build, jadi halaman tidak bisa di-prerender.
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-surface" />}>
      <SessionShell>{children}</SessionShell>
    </Suspense>
  );
}

async function SessionShell({ children }: { children: ReactNode }) {
  // docs/02 §7: setiap halaman memvalidasi session sendiri; proxy hanya redirect cepat.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/ubah-password");

  return (
    <AppShell userArea={<UserMenu name={user.name} role={user.role} />}>
      {children}
    </AppShell>
  );
}
