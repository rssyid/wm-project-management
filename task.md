# task.md — WM Project Management

Semua item belum dikerjakan. Centang hanya dengan bukti (lihat perintah `/verify-phase`). Tulis tanggal dan ringkasan bukti di bawah setiap fase saat selesai.

## F0 — Persiapan

- [ ] Scaffold Next.js 16 (App Router, TS strict), pnpm, ESLint, Prettier; kunci versi patch semua library di `package.json`.
- [ ] Hapus sisa template create-next-app: halaman contoh, aset logo, README bawaan (rule 05 #19).
- [ ] Tailwind v4 + shadcn/ui (new-york); token warna dan tipografi persis rule 35-design di `globals.css`; font Inter lewat `next/font`.
- [ ] Fondasi UI sesuai rule 35-design: shell (Sidebar shadcn + top bar + breadcrumb, sheet di mobile), `PageHeader`, `DataTable`, `FormSection`, `StatusBadge`, `EmptyState`. Komponen shadcn ditambah hanya yang dipakai.
- [ ] Prisma 7: `prisma.config.ts` (URL dari `DIRECT_URL`, perintah seed), client singleton dengan `PrismaPg` (`DATABASE_URL`). Salin `prisma/schema.prisma` dari paket ini.
- [ ] Vitest, Playwright (desktop + 375 px), axe-core; script `lint`, `typecheck`, `test`, `test:e2e`.
- [ ] Repo GitHub + workflow CI (lint, typecheck, test, build).
- [ ] Neon: project region Asia, branch `dev`/`preview`/`main`, autoscaling maks. 0,25 CU.
- [ ] R2: bucket `dev`, `prod`, `backup`; kredensial terpisah untuk backup.
- [ ] Vercel: project terhubung repo, region fungsi Asia (sama dengan Neon), env variable.
- [ ] `.env.example` lengkap; `AGENTS.md` bagian perintah diperbarui.
- [ ] Prototipe layar utama (dashboard, daftar proyek, workspace, Gantt) memakai fondasi UI dan data contoh; dicoba sebagai tiga role; screenshot 1440 px dan 375 px ditinjau terhadap rule 35-design; temuan dicatat. Data contoh dihapus sebelum F2.
- Bukti:

## F1 — Fondasi (AC-01–06, AC-60–62)

- [ ] Migration awal dari schema + migration `constraints` dari `prisma/sql/constraints.sql`.
- [ ] Better Auth (email/password, session DB, `nextCookies`), field role/isActive/mustChangePassword; bandingkan dengan output CLI Better Auth.
- [ ] `proxy.ts`, validasi session per route, `assertCan` + permission matrix, halaman login & ganti password (AC-01–04).
- [ ] Error domain + pemetaan HTTP + envelope; util Decimal, tanggal WIB, format Indonesia.
- [ ] Service audit dalam transaksi (AC-05) dan pola transaksi + version (409).
- [ ] Upload/unduh R2 presigned + konfirmasi + batas ukuran (AC-62).
- [ ] CRUD master: Region, Wilayah, Company, Estate, Block, Vendor (+quick), Unit, Kategori, Material (+quick), Alat berat, Jabatan approver; nonaktif vs hapus (AC-60).
- [ ] Seed lokasi & master dari `prisma/seed-data/*.json` + Super Admin pertama (AC-61).
- [ ] Menu Admin: user (buat, role, nonaktif, reset password).
- Bukti:

## F2 — Proyek dan AFCE (AC-10–25)

- [ ] Transition service + riwayat status (AC-15) dan semua gate di dokumen domain §5.
- [ ] Buat/ubah proyek: multi-Estate, kategori, data dasar, kode atomik (AC-10–13).
- [ ] Survei + foto/dokumen/spasial, kunci setelah AFCE diajukan (AC-14).
- [ ] Matriks approval: editor tier (SA), validasi rentang, endpoint match.
- [ ] AFCE: attempt, BOQ, nilai = total, salin level dari tier, ubah level saat DRAFT, ajukan (tanggal pengajuan + email) (AC-16–20).
- [ ] Catat keputusan SAP per level, aturan urutan/tanggal, durasi, efek ditolak/approved, anggaran INITIAL (AC-21–24).
- [ ] AR tambahan (AC-25); halaman anggaran.
- [ ] UI: daftar proyek, form proyek, workspace (header, panel langkah berikutnya, tab Ringkasan/Survei/AFCE).
- Bukti:

## F3 — Pengadaan (AC-30–44)

- [ ] Pekerjaan + bobot (tepat 100,00, bagi rata, default 70/30 saat paket pertama) (AC-30–33).
- [ ] USPK + tender attempt + baseline + mulai + pemenang + batal (AC-34–36).
- [ ] SPK: buat, release, batal, multi aktif, swakelola (AC-37–39).
- [ ] Paket Kerja: item, bobot, PR, PO, produksi, kiriman, koreksi, batal, pembayaran (AC-40–44).
- [ ] UI tab Pekerjaan dan Paket Kerja; dialog pembatalan per jenis.
- Bukti:

## F4 — Jadwal dan progres (AC-45–52)

- [ ] Baseline (edit sebelum kunci) + revisi beralasan (AC-45–46).
- [ ] Mulai fisik, log mingguan, log pengganti, alat berat, foto (AC-47–48).
- [ ] Service `progress-ews`: bobot, progres, rencana linear hari kerja, deviasi, ambang, freeze, Kurva S, data sel Gantt (AC-49–52).
- [ ] Setting hari kerja, libur, ambang EWS (SA).
- Bukti:

## F5 — Tampilan (AC-53–58)

- [ ] Komponen Gantt matriks desktop + mobile, legenda, tooltip/panel (AC-53–56).
- [ ] Portofolio Gantt dengan filter bersama.
- [ ] Dashboard (kartu status, EWS, 10 deviasi terbesar, Kurva S, pengingat log mingguan).
- [ ] Empat laporan + ekspor Excel (ExcelJS) dan PDF (react-pdf) (AC-57–58).
- Bukti:

## F6 — Penutupan dan admin (AC-63–70)

- [ ] Ajukan, verifikasi, batal pengajuan BAST; kunci WAITING_BAST dan COMPLETED (AC-63–66).
- [ ] Tahan/lanjutkan dan aturan ON_HOLD; batal proyek (AC-67–68).
- [ ] Arsip saat query + filter arsip (AC-69).
- [ ] Soft delete, restore, purge dengan tombstone & hapus file R2 (AC-70).
- [ ] Halaman audit log.
- Bukti:

## F7 — UAT dan go-live (AC-71–76)

- [ ] Uji performa halaman dan ekspor (AC-58, AC-71).
- [ ] Uji mobile dan aksesibilitas (AC-72–73).
- [ ] Workflow GitHub Actions harian: `pg_dump` → R2 backup, bersihkan file PENDING, lifecycle retensi; uji restore (AC-74).
- [ ] Uji build & jalan di luar Vercel; runbook pindah hosting (AC-75).
- [ ] Catatan pemakaian Neon mingguan (AC-76).
- [ ] 16 skenario UAT (docs/06 §4) lulus dan ditandatangani.
- [ ] Checklist go-live: env produksi, seed produksi, akun Super Admin, ganti password, backup pertama berhasil.
- Bukti:
