import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AppSidebar } from "./app-sidebar";

export type Crumb = { label: string; href?: string };

type AppShellProps = {
  breadcrumb: readonly Crumb[];
  /** Right side of the top bar: user name and role. */
  userArea: ReactNode;
  children: ReactNode;
};

export function AppShell({ breadcrumb, userArea, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-surface">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-panel px-4 md:px-6">
          <SidebarTrigger aria-label="Buka atau tutup menu" className="-ml-1" />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList className="flex-nowrap">
              {breadcrumb.map((crumb, index) => {
                const last = index === breadcrumb.length - 1;
                return (
                  <Fragment key={`${crumb.label}-${index}`}>
                    {index > 0 ? <BreadcrumbSeparator /> : null}
                    <BreadcrumbItem className="min-w-0">
                      {last || !crumb.href ? (
                        <BreadcrumbPage className="truncate">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={crumb.href}>{crumb.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="flex shrink-0 items-center gap-2">{userArea}</div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
