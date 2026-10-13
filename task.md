# task.md — WM Project Management

Semua item belum dikerjakan. Centang hanya dengan bukti (lihat perintah `/verify-phase`). Tulis tanggal dan ringkasan bukti di bawah setiap fase saat selesai.

## F0 — Persiapan

- [x] Scaffold Next.js 16 (App Router, TS strict), pnpm, ESLint, Prettier; kunci versi patch semua library di `package.json`.
- [x] Hapus sisa template create-next-app: halaman contoh, aset logo, README bawaan (rule 05 #19).
- [x] Tailwind v4 + shadcn/ui (new-york); token warna dan tipografi persis rule 35-design di `globals.css`; font Inter lewat `next/font`.
- [x] Fondasi UI sesuai rule 35-design: shell (Sidebar shadcn + top bar + breadcrumb, sheet di mobile), `PageHeader`, `DataTable`, `FormSection`, `StatusBadge`, `EmptyState`. Komponen shadcn ditambah hanya yang dipakai.
- [x] Prisma 7: `prisma.config.ts` (URL dari `DIRECT_URL`), client singleton dengan `PrismaPg` (`DATABASE_URL`). Salin `prisma/schema.prisma` dari paket ini. Perintah seed ditunda ke F1 bersama seed script (D-26).
- [x] Vitest, Playwright (desktop + 375 px), axe-core; script `lint`, `typecheck`, `test`, `test:e2e`.
- [ ] Repo GitHub + workflow CI (lint, typecheck, test, build). Workflow sudah ada (`.github/workflows/ci.yml`); belum didorong ke GitHub — `git push` menunggu persetujuan.
- [x] Neon: project region Asia, branch `dev`/`preview`/`main`, autoscaling maks. 0,25 CU. Menunggu pengguna.
- [x] R2: bucket `dev`, `prod`, `backup`; kredensial terpisah untuk backup. Menunggu pengguna.
- [x] Vercel: project terhubung repo, region fungsi Asia (sama dengan Neon), env variable. Menunggu pengguna.
- [x] `.env.example` lengkap; `AGENTS.md` bagian perintah diperbarui.
- [ ] Prototipe layar utama memakai fondasi UI dan data contoh; **sudah ada dan diuji otomatis sebagai tiga role** (e2e `prototype-roles.spec.ts`: MV tanpa tombol aksi, SP dengan tombol aksi, SA melihat menu admin penuh). Screenshot 1440 px dan 375 px sudah diambil (`pnpm exec playwright test screenshots` → `test-results/screenshots/`) tetapi **belum ditinjau manusia** terhadap rule 35 §8. Data contoh dihapus sebelum F2.
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
  - Sisa: tinjau screenshot oleh pemilik proyek (agen tidak dapat melihat gambar), `git push` 16 commit ke GitHub lalu pastikan CI hijau di sana.

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
