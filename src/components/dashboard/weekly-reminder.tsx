'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function WeeklyLogReminder({
  count,
  projectCount,
}: {
  count: number;
  projectCount: number;
}) {
  if (count === 0) {
    return (
      <div className="border border-line rounded-sm bg-panel p-4 text-center text-sm text-ink-muted">
        Semua Pekerjaan sudah memiliki log minggu ini.
      </div>
    );
  }

  return (
    <section className="mb-6 border border-line rounded-sm bg-ews-yellow-soft p-4">
      <h2 className="text-base font-semibold text-ews-yellow mb-2">
        Pengingat Log Mingguan
      </h2>
      <p className="text-sm text-ink mb-2">
        {count} Pekerjaan di {projectCount} proyek belum memiliki log progres
        minggu ini.
      </p>
      <Button asChild size="sm">
        <Link href="/proyek">Lihat daftar proyek</Link>
      </Button>
    </section>
  );
}
