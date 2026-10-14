import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { getSessionUser } from "@/infra/session";
import { can } from "@/shared/permissions";

import { MASTER_GROUPS, MASTER_LABEL } from "./master-config";

/** docs/05 §10: daftar master per kelompok; tiap baris membuka halaman tabelnya. */
export default async function MasterIndexPage() {
  const user = await getSessionUser();
  const canWrite = can(user?.role ?? "MANAGEMENT_VIEWER", "master.write");

  return (
    <>
      <PageHeader
        title="Master data"
        description={
          canWrite
            ? "Data terpakai hanya bisa dinonaktifkan."
            : "Peran Anda hanya bisa melihat master."
        }
      />

      <div className="flex flex-col gap-6">
        {MASTER_GROUPS.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="mb-2 text-base font-semibold text-ink">
              {group.title}
            </h2>
            <ul className="divide-y rounded-lg border bg-panel">
              {group.types.map((type) => (
                <li key={type} className="px-4 py-3">
                  <Link
                    href={`/master/${type}`}
                    className="text-canal hover:underline"
                  >
                    {MASTER_LABEL[type]}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
