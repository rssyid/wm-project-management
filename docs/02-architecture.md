# 02 — Architecture

Status: disetujui 10 Oktober 2026. Versi patch library dikunci saat scaffold (fase F0).

## 1. Stack

| Lapisan | Keputusan |
| --- | --- |
| Framework | Next.js 16 App Router, TypeScript strict, runtime Node.js di semua route (tanpa Edge) |
| Auth | Better Auth, email/password, session di database, adapter Prisma, plugin `nextCookies` |
| ORM | Prisma 7: generator `prisma-client` dengan `output` eksplisit, driver adapter `@prisma/adapter-pg`, URL di `prisma.config.ts` |
| Database | PostgreSQL di Neon (Free di produksi, autoscaling dibatasi 0,25 CU) |
| File | Cloudflare R2 (S3-compatible), bucket privat, presigned URL |
| Validasi | Zod, skema dipakai bersama klien dan server |
| UI | shadcn/ui + Tailwind CSS v4, lucide-react, sonner |
| Form | React Hook Form + resolver Zod |
| Data klien | Baca lewat Server Component; mutasi ke `/api` dengan TanStack Query |
| Tabel / Gantt | TanStack Table; Gantt matriks buatan sendiri (CSS grid, kolom identitas sticky, TanStack Virtual) |
| Grafik | Chart shadcn (Recharts) untuk Kurva S dan dashboard |
| Tanggal | date-fns, zona waktu Asia/Jakarta, format Indonesia (`10 Okt 2026`, `Rp1.250.000.000`) |
| Ekspor | ExcelJS (sel berwarna untuk Gantt), @react-pdf/renderer (render ke buffer di server) |
| Test | Vitest, Playwright (termasuk viewport 375 px), axe-core |
| Tooling | pnpm, GitHub, GitHub Actions |
| Hosting | Vercel Hobby, region fungsi Asia terdekat (Singapura jika tersedia), sama dengan region Neon |

Prinsip portabel: tidak memakai KV, Blob, Cron, Edge atau fitur khusus Vercel. Semua konfigurasi lewat environment variable. Aplikasi harus bisa jalan dengan `next build && next start` di Node.js biasa.

## 2. Komponen

```
Browser (3 role, desktop & HP, foto dikompres di klien)
  │ HTTPS                                   │ upload/unduh langsung (presigned URL)
  ▼                                         ▼
Vercel: Next.js 16 (Node.js)            Cloudflare R2: bucket file (privat)
  proxy.ts (cek cookie saja)
  RSC + Route Handler /api (auth → role → Zod → service)
  Domain services (transition, progress-ews, jadwal, audit, ekspor)
  Akses data (Prisma 7 + adapter-pg, Better Auth)
  │
  ▼
Neon PostgreSQL (data, session, audit) ──► GitHub Actions harian: pg_dump → R2 bucket backup
```

## 3. Struktur kode

| Folder | Isi | Larangan |
| --- | --- | --- |
| `src/app/` | Halaman, layout, Route Handler `/api`, server actions bila perlu | Aturan bisnis, akses Prisma langsung |
| `src/shared/` | Skema Zod, enum, tipe, kode error, util tanggal/kalender kerja, format angka | Akses database |
| `src/domain/` | Service per modul (di bawah); setiap mutasi dalam transaksi + audit | Import dari `app/` |
| `src/infra/` | Prisma client, repository, klien R2, Better Auth, renderer ekspor | Aturan bisnis |
| `src/components/` | Komponen UI (shadcn di `components/ui`), Gantt | Logika domain |
| `prisma/` | schema, migrations, sql tambahan, seed-data, seed script | — |
| `tests/` | unit, integration, e2e | — |

Modul domain: `project-transition` (satu-satunya pengubah `Project.status`), `afce` (attempt, BOQ, snapshot level, keputusan, AR tambahan, anggaran), `approval-matrix`, `tender-spk`, `physical` (status fisik, log progres, alat berat, jeda), `work-package` (PR, PO, produksi, kiriman, koreksi, pembayaran), `schedule` (baseline, revisi, kalender kerja), `progress-ews` (bobot, progres, rencana linear, deviasi, freeze, Kurva S, data sel Gantt), `bast`, `master`, `admin` (user, soft delete, restore, purge), `audit`, `export`, `files`.

## 4. Alur request

1. `proxy.ts`: hanya cek keberadaan cookie session untuk redirect cepat.
2. Handler memvalidasi session di database lewat Better Auth (401).
3. `assertCan(user, action)` berdasarkan permission matrix (403 hanya role).
4. Validasi Zod (400 dengan pesan per field).
5. Domain service: buka transaksi, muat entitas, cek gate dan kunci proyek (409), tulis perubahan.
6. Dalam transaksi yang sama: tulis `AuditLog` (before/after) dan jalankan transisi otomatis.
7. Commit; response dengan envelope standar.

Konkurensi: entitas ber-`version` wajib mengirim `version`; berbeda → 409 `VERSION_CONFLICT`. Counter kode proyek dikunci `SELECT … FOR UPDATE`. Transisi otomatis memakai update bersyarat pada status saat ini sehingga terpicu tepat sekali.

Error domain dilempar sebagai tipe dengan kode (`INVALID_TRANSITION`, `PRECONDITION_FAILED`, `PROJECT_LOCKED`, `FIELD_INPUT_LOCKED`, `WEIGHT_MISMATCH`, `DUPLICATE`, `ACTIVE_CONFLICT`, `VERSION_CONFLICT`, `IN_USE`, `FILE_TOO_LARGE`) dan dipetakan ke HTTP di satu tempat; pesan pengguna dalam bahasa Indonesia.

## 5. Data dan perhitungan

- Schema: `prisma/schema.prisma`; constraint tambahan: `prisma/sql/constraints.sql` (CHECK, partial unique index, trigger immutable).
- Progres dan EWS dihitung saat dibaca oleh satu service `progress-ews`; tidak disimpan. Semua tampilan, laporan, ekspor dan API memakai service ini.
- Tabel riwayat hanya INSERT. Purge memakai `SET LOCAL app.allow_purge = 'on'` di transaksi purge.
- Tanggal bisnis `@db.Date`; timestamp UTC, ditampilkan WIB.

## 6. File (R2)

- Kunci objek: `projects/{projectId}/{progress-photo|approval-evidence|bast|document|spatial-data}/{uuid}.{ext}`.
- Upload: klien minta presigned PUT (server cek role, kunci proyek, ukuran: foto 5 MB, lainnya 10 MB; data spasial hanya `.zip`/`.geojson`) → browser upload → klien konfirmasi → server cek objek dan set `READY`.
- Unduh: presigned GET berumur pendek setelah cek akses.
- Purge menghapus semua objek dengan prefix `projects/{projectId}/`.

## 7. Auth

- Tanpa pendaftaran mandiri. Super Admin membuat user, menetapkan role, menonaktifkan user.
- Lupa password: Super Admin mengatur password sementara; `mustChangePassword=true`; semua session user dicabut. Tanpa layanan email.
- Setiap halaman dan endpoint memvalidasi session sendiri; `proxy.ts` hanya optimasi redirect.

## 8. Lingkungan dan konfigurasi

| Lingkungan | Hosting | Database | File |
| --- | --- | --- | --- |
| Lokal | `pnpm dev` | branch Neon `dev` atau Postgres lokal | bucket R2 `dev` |
| Preview | Vercel preview per PR | branch Neon `preview` | bucket R2 `dev` |
| Produksi | Vercel | branch Neon `main` | bucket `prod` + `backup` |

Environment variable: `DATABASE_URL` (pooled, runtime adapter), `DIRECT_URL` (koneksi langsung, dipakai `prisma.config.ts` untuk migrasi), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `APP_TIMEZONE=Asia/Jakarta`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`. Kredensial backup (`R2_BACKUP_*`) hanya di GitHub Actions.

CI (GitHub Actions): lint → typecheck → unit/integration test → `prisma migrate deploy` → deploy. Workflow harian terpisah: `pg_dump` (format custom, kompres) ke bucket backup; bersihkan `FileObject` PENDING > 24 jam; retensi 30 harian + 12 bulanan via lifecycle R2. Uji restore ke branch Neon terpisah setiap bulan.

## 9. Risiko diterima

- Vercel Hobby untuk pemakaian non-komersial; aplikasi ini proyek pribadi. Jika dipakai resmi oleh perusahaan, pindah ke Vercel Pro atau hosting Node.js lain (siapkan runbook di F7).
- Neon Free: compute ditangguhkan bila 100 CU-hours habis; restore hanya 6 jam; cold start setelah 5 menit idle. Mitigasi: autoscaling 0,25 CU, tidak ada health check yang membangunkan database, cek mingguan di console, upgrade ke Launch bila > 70%, backup harian.
- ExcelJS tidak dirilis > 12 bulan: isolasi di modul `export`.
