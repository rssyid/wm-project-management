"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export function WeeklyLogReminder({
  count,
  projectCount,
}: {
  count: number;
  projectCount: number;
}) {
  if (count === 0) {
    return (
      <div className="rounded-sm border border-line bg-panel p-4 text-center text-sm text-ink-muted">
        Semua Pekerjaan sudah memiliki log minggu ini.
      </div>
    );
  }

  return (
    <section className="mb-6 rounded-sm border border-line bg-ews-yellow-soft p-4">
      <h2 className="mb-2 text-base font-semibold text-ews-yellow">
        Pengingat Log Mingguan
      </h2>
      <p className="mb-2 text-sm text-ink">
        {count} Pekerjaan di {projectCount} proyek belum memiliki log progres
        minggu ini.
      </p>
      <Button asChild size="sm">
        <Link href="/proyek">Lihat daftar proyek</Link>
      </Button>
    </section>
  );
}
