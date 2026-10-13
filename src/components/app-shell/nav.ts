import {
  BarChart3,
  Database,
  FolderKanban,
  GanttChart,
  LayoutDashboard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/shared/role";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// docs/05 §3. Every role reads every menu; only Admin content differs (SA all, SP/MV audit log).
export const NAV_ITEMS: readonly NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Proyek", href: "/proyek", icon: FolderKanban },
  { label: "Portofolio", href: "/portofolio", icon: GanttChart },
  { label: "Laporan", href: "/laporan", icon: BarChart3 },
  { label: "Master data", href: "/master", icon: Database },
  { label: "Admin", href: "/admin", icon: ShieldCheck },
];

export type AdminMenu = { label: string; saOnly: boolean };

export const ADMIN_MENU: readonly AdminMenu[] = [
  { label: "User", saOnly: true },
  { label: "Matriks approval", saOnly: true },
  { label: "Hari kerja & libur", saOnly: true },
  { label: "Ambang EWS", saOnly: true },
  { label: "Proyek terhapus", saOnly: true },
  { label: "Audit log", saOnly: false },
];

export function adminMenuFor(role: Role): readonly AdminMenu[] {
  return role === "SUPER_ADMIN"
    ? ADMIN_MENU
    : ADMIN_MENU.filter((item) => !item.saOnly);
}

export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
