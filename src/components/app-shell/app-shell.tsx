import type { ReactNode } from "react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

import { AppBreadcrumb } from "./app-breadcrumb";
import { AppSidebar } from "./app-sidebar";

type AppShellProps = {
  /** Right side of the top bar: user name and role. */
  userArea: ReactNode;
  children: ReactNode;
};

export function AppShell({ userArea, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 bg-surface">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-panel px-4 md:px-6">
          <SidebarTrigger aria-label="Buka atau tutup menu" className="-ml-1" />
          <AppBreadcrumb />
          <div className="flex shrink-0 items-center gap-2">{userArea}</div>
        </header>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
