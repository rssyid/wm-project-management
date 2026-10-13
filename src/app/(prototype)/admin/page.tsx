"use client";

import { adminMenuFor } from "@/components/app-shell/nav";
import { PageHeader } from "@/components/page-header";
import { usePrototypeRole } from "@/prototype/role";

export default function AdminPage() {
  const items = adminMenuFor(usePrototypeRole());
  return (
    <>
      <PageHeader title="Admin" />
      <ul
        aria-label="Menu admin"
        className="max-w-[720px] divide-y rounded-lg border bg-panel"
      >
        {items.map((item) => (
          <li key={item.label} className="px-4 py-3">
            {item.label}
          </li>
        ))}
      </ul>
    </>
  );
}
