import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";
import { RoleSwitcher } from "@/prototype/role";

// D-21: the whole (prototype) route group is deleted before F2.
export default function PrototypeLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell
      userArea={
        <>
          <span className="hidden text-dense text-ink-muted sm:inline">Pengguna contoh</span>
          <RoleSwitcher />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
