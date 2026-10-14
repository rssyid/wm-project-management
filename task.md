# task.md — WM Project Management

Semua item belum dikerjakan. Centang hanya dengan bukti (lihat perintah `/verify-phase`). Tulis tanggal dan ringkasan bukti di bawah setiap fase saat selesai.

## F0 — Persiapan

- [x] Scaffold Next.js 16 (App Router, TS strict), pnpm, ESLint, Prettier; kunci versi patch semua library di `package.json`.
- [x] Hapus sisa template create-next-app: halaman contoh, aset logo, README bawaan (rule 05 #19).
- [x] Tailwind v4 + shadcn/ui (new-york); token warna dan tipografi persis rule 35-design di `globals.css`; font Inter lewat `next/font`.
- [x] Fondasi UI sesuai rule 35-design: shell (Sidebar shadcn + top bar + breadcrumb, sheet di mobile), `PageHeader`, `DataTable`, `FormSection`, `StatusBadge`, `EmptyState`. Komponen shadcn ditambah hanya yang dipakai.
- [x] Prisma 7: `prisma.config.ts` (URL dari `DIRECT_URL`), client singleton dengan `PrismaPg` (`DATABASE_URL`). Salin `prisma/schema.prisma` dari paket ini. Perintah seed ditunda ke F1 bersama seed script (D-26).
- [x] Vitest, Playwright (desktop + 375 px), axe-core; script `lint`, `typecheck`, `test`, `test:e2e`.
- [x] Repo GitHub + workflow CI (lint, typecheck, test, build). Workflow `.github/workflows/ci.yml` sudah dijalankan GitHub Actions: run `38365588543` hijau, job `verify` 41 dtk dan `e2e` 1 mnt 9 dtk.
- [x] Neon: project region Asia, branch `dev`/`preview`/`main`, autoscaling maks. 0,25 CU. Menunggu pengguna.
- [x] R2: bucket `dev`, `prod`, `backup`; kredensial terpisah untuk backup. Menunggu pengguna.
- [x] Vercel: project terhubung repo, region fungsi Asia (sama dengan Neon), env variable. Menunggu pengguna.
- [x] `.env.example` lengkap; `AGENTS.md` bagian perintah diperbarui.
- [x] Prototipe layar utama memakai fondasi UI dan data contoh; **sudah ada dan diuji otomatis sebagai tiga role** (e2e `prototype-roles.spec.ts`: MV tanpa tombol aksi, SP dengan tombol aksi, SA melihat menu admin penuh). Screenshot 1440 px dan 375 px sudah diambil (`pnpm exec playwright test screenshots` → `test-results/screenshots/`) dan **sudah ditinjau manusia terhadap rule 35 §8 tanpa temuan** (14 Oktober 2026). Data contoh dihapus sebelum F2.
- Bukti (13 Oktober 2026, `81be27b`):

  | Gerbang `docs/06` §2 | Uji | Hasil |
  | --- | --- | --- |
  | CI hijau | `pnpm lint` · `pnpm typecheck` · `pnpm format:check` · `pnpm test` · `pnpm build` | lulus semua |
  | CI hijau | `pnpm test:e2e` (desktop 1440×900 + mobile 375×812, chromium) | 16/16 lulus |
  | App kosong ter-deploy | `pnpm build` → `pnpm start --port 3100`; route `/`, `/dashboard`, `/proyek`, `/proyek/[kode]`, `/portofolio`, `/laporan`, `/master`, `/admin` | semua prerender statis tanpa error |
  | Root ke dashboard | `shell.spec.ts` root diarahkan ke dashboard | lulus di kedua viewport |
  | Prototipe dicoba sebagai tiga role | `prototype-roles.spec.ts`: viewer melihat daftar proyek tanpa tombol aksi · specialist melihat tombol aksi · admin hanya menampilkan audit log untuk specialist dan viewer | lulus di kedua viewport |
  | Aksesibilitas | `shell.spec.ts` axe `wcag2a`/`wcag2aa` di **7 route** (`/dashboard`, `/proyek`, `/proyek/[kode]`, `/portofolio`, `/laporan`, `/master`, `/admin`) | nihil pelanggaran serious/critical |
  | Keyboard & Gantt mobile | `shell.spec.ts`: menu utama via keyboard; kolom identitas Gantt tetap di kiri saat tabel digeser 375 px; wadah Gantt bisa difokus | lulus |

  - 13/13 unit test lulus: `format.test.ts` (tanggal WIB, rupiah, persen, desimal) dan `prototype-gantt.test.ts` (lebar baris seragam, id unik, karakter tak dikenal tidak hilang diam-diam, revisi kuning sebelum oranye).
  - `grep` hex di `src/**/*.tsx|ts`: nihil (rule 35 §8 butir 2).
  - Commit: `42bd50b` scaffold · `d94918d` template · `b1f6799` token · `4fed899` fondasi UI · `f123c50` Prisma · `c8a88ae` test tooling · `5a1e850` prototipe · `5c6eff6` CI + dokumen · `93cf95b` screenshot · `a138770` rule 35 · `d52fe0f` bukti · `95c112d` slop-check · `81be27b` Gantt W11.
  - Deviasi dari rencana: route prototipe memakai route group `(prototype)` pada path asli (`/dashboard`, `/proyek`, dst.), bukan prefix `/prototipe`; perintah seed Prisma ditunda ke F1 (D-26); D-22 label status; D-23/D-24 gelaskan token EWS; D-25 ganti `@date-fns/tz` dengan `Intl`.
  - `/slop-check`: 4 temuan, semua diperbaiki — `SuperAdminOnly` kode mati (05 #5), `APP_TIME_ZONE` ekspor tak perlu (05 #1), `pnpm format` tidak pernah dijalankan sehingga 40 file tidak rapi dan tidak ada penjaga (05 #9), Prettier merapikan `.kilo/` yang tidak disentuh (05 #9). `FormSection` sengaja dipertahankan karena diminta `task.md` item 4 meski belum ada yang memakainya.
  - Deviasi lintas dokumen (laporan, bukan perubahan kode): `docs/05-ui.md` §5 "Dashboard: kartu jumlah per status" bertentangan dengan rule 35 §5 dan §7; sudah diselaraskan menjadi baris angka KPI. `docs/05-ui.md` §8 (tooltip Gantt, tombol "Ke minggu ini", lipatan baris) dan §5 (Kurva S, daftar pekerjaan tanpa log minggu ini) belum di prototipe — sengaja, dikerjakan F4–F5.
  - Audit 14 Oktober 2026 (`bddf88a`): memperluas axe dari 2 ke 7 route menemukan dua cacat nyata — wadah Gantt tidak bisa difokus (WCAG 2.1.1, pengguna keyboard tidak bisa menggeser kolom minggu di 375 px) dan label tab tak aktif `text-foreground/60` hanya 4,14:1. Keduanya diperbaiki. Ditambah 6 unit test invarian data Gantt karena decoder `row()` menelan error (simbol hilang diam-diam bila panjang string beda, typo karakter jadi sel kosong).
  - Selesai: screenshot ditinjau pemilik proyek 14 Oktober 2026 terhadap rule 35 §8, tanpa temuan; gerbang F0 ditutup dan F1 dimulai.
  - Peringatan CI (bukan kegagalan): `pnpm/action-setup@v4` menargetkan Node.js 20 yang sudah deprecated di runner GitHub dan dipaksa jalan di Node.js 24; `ubuntu-latest` akan migrasi ke Ubuntu 26 pada 19 Oktober 2026. Keduanya untuk diperiksa saat F7.

## F1 — Fondasi (AC-01–06, AC-60–62)

- [x] Migration awal dari schema + migration `constraints` dari `prisma/sql/constraints.sql`.
- [x] Better Auth (email/password, session DB, `nextCookies`), field role/isActive/mustChangePassword; bandingkan dengan output CLI Better Auth.
- [x] `proxy.ts`, validasi session per route, `assertCan` + permission matrix, halaman login & ganti password (AC-01–04).
- [x] Error domain + pemetaan HTTP + envelope; util Decimal, tanggal WIB, format Indonesia.
- [x] Service audit dalam transaksi (AC-05) dan pola transaksi + version (409).
- [x] Upload/unduh R2 presigned + konfirmasi + batas ukuran (AC-62).
- [x] CRUD master: Region, Wilayah, Company, Estate, Block, Vendor (+quick), Unit, Kategori, Material (+quick), Alat berat, Jabatan approver; nonaktif vs hapus (AC-60).
- [x] Seed lokasi & master dari `prisma/seed-data/*.json` + Super Admin pertama (AC-61).
- [x] Menu Admin: user (buat, role, nonaktif, reset password).
- Bukti (14 Oktober 2026):

  | AC / gerbang | Uji | Hasil |
  | --- | --- | --- |
  | AC-01 401 + redirect login | `tests/integration/auth.test.ts`, `tests/e2e/auth.spec.ts` | lulus |
  | AC-02 viewer 403 + UI tanpa tombol aksi | `tests/integration/master.test.ts`, `tests/e2e/master.spec.ts`, `tests/e2e/admin-user.spec.ts` | lulus |
  | AC-03 SP 403 pada aksi SA | `tests/integration/master.test.ts`, `tests/integration/users.test.ts`, `tests/e2e/admin-user.spec.ts` | lulus |
  | AC-04 wajib ganti password, reset mencabut session | `tests/integration/auth.test.ts`, `tests/integration/users.test.ts`, `tests/e2e/auth.spec.ts` | lulus |
  | AC-05 satu `AuditLog` per mutasi dalam transaksi | `tests/integration/audit.test.ts` | lulus |
  | AC-06 gate/prasyarat 409 bukan 403 | `tests/unit/api-errors.test.ts`, `tests/integration/master.test.ts` | lulus |
  | AC-60 `IN_USE` + nonaktifkan | `tests/integration/master.test.ts`, `tests/e2e/master.spec.ts` | lulus |
  | AC-61 seed 8/18/27/63 idempoten | `tests/integration/seed.test.ts` | lulus |
  | AC-62 batas ukuran, PENDING 24 jam, URL berumur pendek | `tests/integration/files.test.ts` (bucket R2 `dev` sungguhan) | lulus |
  | Constraint & trigger `constraints.sql` | `tests/integration/constraints.test.ts` | lulus |
  | Seluruh test | `pnpm test` (unit + integrasi) | 89/89 lulus (12 file) |
  | Seluruh alur UI | `pnpm test:e2e` (1440×900 + 375×812) | 56 lulus, 1 dilewati (uji khusus mobile) |
  | Aksesibilitas | axe `wcag2a`/`wcag2aa` di `/login`, `/admin/user`, dan 8 halaman aplikasi | nihil pelanggaran serious/critical |
  | Gerbang kualitas | `pnpm format:check` · `pnpm lint` · `pnpm typecheck` · `pnpm build` | lulus tanpa peringatan |

  - Perbandingan schema Better Auth (`npx @better-auth/cli generate`) tidak menemukan field yang kurang: `User`, `Session`, `Account`, `Verification` sudah cocok. Kolom `role`, `isActive`, `mustChangePassword` tetap non-null dengan default.
  - `grep -rn "#[0-9A-Fa-f]\{6\}" src/components src/app` hanya menemukan `globals.css`; token warna tidak ditulis ulang di komponen.
  - Dependensi F1: `better-auth` 1.7.7, `zod` 4.6.7, `react-hook-form` 7.90.0, `@hookform/resolvers` 5.9.1, `sonner` 2.0.8, `@aws-sdk/client-s3` + `s3-request-presigner` 3.1150.0, `tsx` 4.23.15 (dev). `@tanstack/react-query`, `next-themes`, dan komponen shadcn `select` sempat terpasang lalu dilepas karena belum dipakai (rule 05 #11).
  - Keputusan baru: D-37 … D-46 di `docs/07-decisions.md`.
  - Slop-check 14 Oktober 2026: tidak ada `any`, `as unknown as`, `@ts-ignore`, `eslint-disable`, `TODO`, atau `catch` yang menelan error di kode tulis tangan (`src/generated/**` adalah hasil generate Prisma dan tidak dihitung). Tiga `console.log` hanya ada di skrip CLI (`scripts/*`) yang memang mencetak hasil ke terminal dan sudah dikecualikan `eslint.config.mjs`.
  - Audit aksesibilitas 14 Oktober 2026 menemukan satu cacat nyata: wadah tab workspace proyek memakai `overflow-x-auto` tanpa fokus keyboard, sehingga di 375 px isi tab tidak bisa digeser dengan keyboard (WCAG 2.1.1). Diperbaiki dengan `tabIndex` + `role="group"` dan `aria-label`, sama seperti pola wadah Gantt; kini `/login`, `/admin/user`, `/master/vendors`, dan delapan halaman aplikasi masuk pemindaian axe.
  - Lintas dokumen: tidak ada penyimpangan dari `docs/01-domain.md` §3 ("master tidak dihapus permanen setelah dipakai; nonaktif lewat `isActive`") maupun `docs/04-api.md` §1–2, §9, §11 — kode, status HTTP, envelope, `{type}` master, dan aturan role cocok dengan implementasi.
  - Deviasi dari rencana: (a) `GET /api/me` belum dibuat — data session tersedia lewat Server Component, endpoint baru berguna saat klien perlu menyegarkan session; (b) `src/infra/decimal.ts` dan `src/shared/date.ts` belum dibuat karena F1 belum punya field Decimal atau tanggal bisnis — dibuat bersama konsumen pertamanya di F2/F6; (c) komponen UI upload dan kompresi foto ditunda ke F2 (konsumen pertama survei); (d) CORS bucket R2 belum diatur — dibutuhkan saat UI upload ada.
  - Catatan untuk F2: skema update master memakai `updateSchemaFor()` agar `isActive` diterima; `PATCH` memisahkan aksi aktif/nonaktif dari body mentah (D-42, D-43); setiap wadah `overflow-x-auto` baru wajib punya `tabIndex={0}` dan `aria-label`.
  - Tampilan `/master`, `/master/[type]`, `/admin/user`, dan `/login` **sudah ditinjau manusia** (14 Oktober 2026) dan dinyatakan sesuai. Screenshot 1440 px dan 375 px dihasilkan `screenshots.spec.ts` di `test-results/screenshots/`.
- Commit: `05002a4` migration + seed + harness · `de66955` auth, error, audit · `e527312` master data · `bbe552c` R2 files + admin user · `25f4fca` shell session + e2e · `fa4b051` CI, dependensi, dokumen.
- Sisa pekerjaan F1: tidak ada. Yang tersisa di luar coder: push branch `main` agar job CI berjalan dan nomor run-nya diisi di sini.
  - CI GitHub Actions F1 **hijau** (14 Oktober 2026): run [38581726775](https://github.com/rssyid/wm-project-management/actions/runs/38581726775) pada `a4e03f3`, job `verify` dan `e2e` sukses. Run sebelumnya yang gagal tercatat sebagai riwayat: [38548036945](https://github.com/rssyid/wm-project-management/actions/runs/38548036945) (persetujuan build `esbuild`, diperbaiki di `8af1ec9`) dan [38579529265](https://github.com/rssyid/wm-project-management/actions/runs/38579529265) (secrets belum dipasang).

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
