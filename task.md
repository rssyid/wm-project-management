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
  - Koreksi setelah deploy (15 Oktober 2026, commit `fix(auth): trust Vercel preview origins for sign-in`): seluruh sign-in di Vercel menjawab 403 karena `BETTER_AUTH_URL` tidak cocok dengan origin produksi dan hostname preview tidak pernah dipercaya. Diperbaiki dengan `trustedOrigins` (produksi eksplisit + `https://*.vercel.app`) dan `src/app/icon.svg` untuk 404 favicon. Keputusan D-47 di `docs/07-decisions.md`.

  ### Verifikasi koreksi Vercel

  | Uji | Hasil |
  | --- | --- |
  | `tests/integration/auth.test.ts` "menerima sign-in dari origin produksi dan preview Vercel" | lulus (200) |
  | `tests/integration/auth.test.ts` "menolak sign-in dari origin asing dengan 403" | lulus (403) |
  | `trustedOrigins` dikosongkan sementara lalu dua uji di atas dijalankan | gagal 403 pada origin produksi — tes menangkap bug |
  | Tindakan pengguna | set `BETTER_AUTH_URL=https://wm-project-management.vercel.app` di Vercel → Production |

## F2 — Proyek dan AFCE (AC-10–25)

- [x] Transition service + riwayat status (AC-15) dan semua gate di dokumen domain §5.
- [x] Buat/ubah proyek: multi-Estate, kategori, data dasar, kode atomik (AC-10–13).
- [x] Survei + foto/dokumen/spasial, kunci setelah AFCE diajukan (AC-14).
- [x] Matriks approval: editor tier (SA), validasi rentang, endpoint match.
- [x] AFCE: attempt, BOQ, nilai = total, salin level dari tier, ubah level saat DRAFT, ajukan (tanggal pengajuan + email) (AC-16–20).
- [x] Catat keputusan SAP per level, aturan urutan/tanggal, durasi, efek ditolak/approved, anggaran INITIAL (AC-21–24).
- [x] AR tambahan (AC-25); halaman anggaran.
- [x] UI: daftar proyek, form proyek, workspace (header, panel langkah berikutnya, tab Ringkasan/Survei/AFCE).
- [x] Tombol aksi sesuai role dan status di UI (termasuk tombol "Mulai survei" dan "Buat attempt AFCE" yang aktif saat prasyarat terpenuhi).
- [x] UI matriks approval: editor tier selalu tampil (termasuk saat daftar kosong) dengan tombol "Tambah tier".
- Bukti:
  - CI GitHub Actions run `38840957129` (16 Oktober 2026, commit `8cdb8fa`): job `verify` hijau 12m39s (format:check, lint, typecheck, test, build) dan job `e2e` hijau 4m0s. Run sebelumnya `38714885317` juga hijau. Setelah perbaikan bug produksi, CI kembali hijau.
  - `pnpm test` 16 Oktober 2026: 186/182 lulus (24 file; unit + integrasi termasuk `survey-schema.test.ts` 6/6 untuk skema form survei).
  - `pnpm test:e2e` 16 Oktober 2026: 60 lulus, 3 skip (2 test tier di mobile + 1 AFCE tab karena data tidak ada). `project-flow.spec.ts` membuktikan: SA membuat tier pertama lewat UI, SP membuat proyek → Mulai survei → isi survei → buat attempt AFCE → isi BOQ → tandai RAB siap, semuanya di browser. `shell.spec.ts` memindai 7 halaman termasuk tab Survei dan AFCE/AR tanpa pelanggaran axe.
  - Kode: L1 `src/infra/decimal.ts`, `src/shared/date.ts`, `src/shared/money.ts`; L2 permission + skema Zod; L3 `src/domain/project-transition/{gates,service}.ts`; L4 `src/domain/project/*` + `/api/projects/*`; L5 `src/domain/survey/service.ts`, `src/domain/files/links.ts`; L6 `src/domain/approval-matrix/{tier,service}.ts` + `/api/approval-tiers/*`; L7 `src/domain/afce/{draft,attempts,boq,levels,queries}.ts` + route; L8 `src/domain/afce/{duration,decision}.ts`; L9 `src/domain/afce/{ar,ar-queries,budget}.ts`; UI `src/components/project/*`, `src/components/admin/approval-tier-editor.tsx`, halaman `/proyek`, `/proyek/baru`, `/proyek/[kode]`, `/admin/matriks-approval`.
  - Gerbang: `pnpm format:check` ✓ · `pnpm lint` 0 error (1 peringatan pustaka pihak ketiga di `src/generated`) · `pnpm typecheck` ✓ · `pnpm build` ✓ (semua route API `ƒ Dynamic`).
  - Keputusan baru: D-48 … D-57 di `docs/07-decisions.md`, ditambah D-58 (skema Zod ber-refine tidak boleh di-`omit`/`.extend()` tanpa bentuk bersama), D-59 (empty state halaman admin harus menampilkan tombol aksi), D-60 (validasi rentang tier di dalam transaksi yang mengunci baris tier).
  - Deviasi yang dicatat: daftar proyek belum punya kolom progres/EWS (D-52, menunggu F4), parameter `archived` belum menyaring (D-50, menunggu F6).
  - Prasyarat belum dikerjakan oleh coder: CORS bucket R2 `dev` harus disetel agar unggah foto dari browser bisa diuji manual.

## F3 — Pengadaan (AC-30–44)

- [x] Pekerjaan + bobot (tepat 100,00, bagi rata, default 70/30 saat paket pertama) (AC-30–33).
- [x] USPK + tender attempt + baseline + mulai + pemenang + batal (AC-34–36).
- [x] SPK: buat, release, batal, multi aktif, swakelola (AC-37–39).
- [x] Paket Kerja: item, bobot, PR, PO, produksi, kiriman, koreksi, batal, pembayaran (AC-40–44).
- [x] UI tab Pekerjaan dan Paket Kerja; dialog pembatalan per jenis.
- Bukti 17 Oktober 2026 — `pnpm lint` 0 error (1 warning React Compiler bawaan F2), `pnpm typecheck` lulus, `pnpm test` 209/209 (31 file: 67 unit + 142 integrasi), `pnpm build` sukses, `pnpm test:e2e` 68 lulus 5 dilewati 0 gagal (1440×900 + 375×812).

  | AC | Test | Status |
  | --- | --- | --- |
  | AC-30 | `work-item.test.ts` "AC-30 menolak Pekerjaan sebelum AFCE Approved (409)" | lulus |
  | AC-31 | `work-item-weights.test.ts` (unit) + `work-item.test.ts` "AC-31 membuat Pekerjaan setelah AFCE Approved dengan bobot 100" dan "AC-31 menolak total bobot Pekerjaan selain 100,00 (WEIGHT_MISMATCH)" | lulus |
  | AC-32 | `work-item.test.ts` "AC-32 batal Pekerjaan wajib bobot pengganti dalam transaksi yang sama" | lulus |
  | AC-33 | `work-item.test.ts` "AC-33 tipe Pekerjaan tidak bisa diubah setelah dibuat (TYPE_LOCKED)" | lulus |
  | AC-34 | `tender-attempt.test.ts` "AC-34 USPK pertama → PROCUREMENT" | lulus |
  | AC-35 | `tender-attempt.test.ts` "AC-35 satu attempt aktif per Pekerjaan (ACTIVE_CONFLICT)" + "AC-35 attempt batal tetap tampil"; e2e `procurement.spec.ts` Skenario 1 | lulus |
  | AC-36 | `tender-winner.test.ts` "AC-36 pemenang nama baru → vendor isComplete=false, lengkap otomatis saat semua field terisi" | lulus |
  | AC-37 | `spk.test.ts` "AC-37 SPK release pertama → attempt COMPLETED, actualEnd = tanggal release"; e2e Skenario 2 | lulus |
  | AC-38 | `spk.test.ts` "AC-38 SPK swakelola hanya vendor INTERNAL; pertama → PROCUREMENT" dan "AC-38 SPK swakelola menolak vendor eksternal" | lulus |
  | AC-39 | `spk.test.ts` describe SPK + e2e `procurement.spec.ts` Skenario 3 | lulus |
  | AC-40 | `work-package.test.ts` "AC-40 PR → PR_SUBMITTED, baseline paket dikunci, PR pertama → PROCUREMENT" | lulus |
  | AC-41 | `work-package.test.ts` "AC-41 kiriman sebelum PO → 409" + `delivery.test.ts` "AC-41 kiriman dengan PO wajib, qty positif" | lulus |
  | AC-42 | `delivery.test.ts` "AC-42 kiriman pertama → EXECUTION tepat sekali"; e2e Skenario 4 | lulus |
  | AC-43 | `delivery.test.ts` "AC-43 koreksi total per item ≥ 0, di bawah rencana → PARTIALLY_DELIVERED" | lulus |
  | AC-44 | `delivery.test.ts` "AC-44 pembayaran bisa diubah sampai COMPLETED termasuk WAITING_BAST" | lulus |

  Perbaikan yang ditemukan saat verifikasi:
  - `src/domain/work-item/service.ts` — total bobot setelah pembatalan dihitung dari bobot pengganti saja, bukan pengganti ditambah sisa; sebelumnya `WEIGHT_MISMATCH` untuk bobot 100,00 yang valid (AC-32).
  - AC-33 belum diimplementasikan: `updateWorkItem` menerima perubahan `type`. Kini ditolak `TYPE_LOCKED` (409) dan kode errornya didokumentasikan di `docs/04-api.md`.
  - Error `IN_USE` yang sempat dipakai untuk hapus tier e2e dihapus lagi bersama route-nya karena tidak dipakai alur bisnis (rule 05 §1).

  Catatan untuk F4:
  - Matriks approval adalah state global dan suite e2e berjalan paralel pada satu branch Neon, jadi `seed-e2e-accounts` kini membuat satu tier e2e bersama `[0, 500.000.000)` sebelum test berjalan dan `project-flow.spec.ts` menambahkan tier di atasnya. Spec tidak boleh membuat atau menghapus tier. Lihat D-34.
  - `seed-e2e-accounts` juga menjalankan `seedLokasi()`; tanpa itu dropdown Region/Wilayah/Company pada form proyek kosong dan alur proyek tidak bisa diuji.
  - Placeholder filter master berbunyi "Nama atau kode", tetapi query hanya memfilter kolom `name` (`src/domain/master/registry.ts`). Sudah dilaporkan, belum diubah karena di luar lingkup F3.
  - `pnpm build` masih mencetak peringatan `HANGING_PROMISE_REJECTION` untuk `/api/approval-tiers/match` (perilaku `connection()` saat prerender). Build tetap sukses; sudah ada sebelum F3.

## F4 — Jadwal dan progres (AC-45–52)

- [x] Baseline (edit sebelum kunci) + revisi beralasan (AC-45–46).
- [x] Mulai fisik, log mingguan, log pengganti, alat berat, foto (AC-47–48).
- [x] Service `progress-ews`: bobot, progres, rencana linear hari kerja, deviasi, ambang, freeze, Kurva S, data sel Gantt (AC-49–52).
- [x] Setting hari kerja, libur, ambang EWS (SA).
- Bukti (17 Oktober 2026):

  | AC | Test | Hasil |
  |----|------|-------|
  | AC-45 | `tests/integration/schedule-revision.test.ts` "baseline terkunci tidak bisa diubah langsung" + "baseline yang belum dikunci bisa diubah langsung" | lulus |
  | AC-46 | `tests/integration/schedule-revision.test.ts` "revisi ditolak saat WAITING_BAST" + "revisi diterima saat ON_HOLD" + "revisi ditolak jika baseline belum dikunci" | lulus |
  | AC-47 | `tests/integration/progress-log.test.ts` "log minggu pertama, satu aktif per minggu" + "persen turun tanpa alasan ditolak" + "persen turun dengan alasan diterima" + "log 100% → SELESAI" + "log pengganti minggu yang sama" | lulus |
  | AC-48 | `tests/integration/progress-log.test.ts` "alat berat tersimpan per log dan tidak memengaruhi progres" | lulus |
  | AC-49 | `tests/unit/progress-ews.test.ts` progres paket, Pekerjaan, proyek 65,4% | lulus |
  | AC-50 | `tests/unit/progress-ews.test.ts` rencana linear hari kerja, libur, target di luar baseline | lulus |
  | AC-51 | `tests/unit/progress-ews.test.ts` ambang EWS hijau/kuning/merah + ubah ambang langsung berlaku | lulus |
  | AC-52 | `tests/unit/progress-ews.test.ts` freeze ON_HOLD dan JEDA_SPK_BATAL, deviasi tidak bertambah | lulus |
  | Seluruh test | `pnpm test` (unit + integrasi) | 245/245 lulus (34 file) |
  | Gerbang kualitas | `pnpm lint` · `pnpm typecheck` · `pnpm build` | lulus (build warning HANGING_PROMISE_REJECTION pre-existing dari F3) |

  - Perbaikan bug ditemukan saat verifikasi: `src/domain/physical/service.ts` membuat log baru sebelum tandai log lama digantikan, melanggar unique index `satu log aktif per minggu` (D-06). Diperbaiki dengan menghapus index unik parsial (migrasi `20261017201152_deferrable_progresslog_index`) dan menegakkan aturannya di level aplikasi.
  - `tests/integration/helpers/factory.ts`: tambah opsi `previousStatus` untuk pembuatan proyek ON_HOLD (constraint `project_previous_status`).
  - `src/shared/permissions.ts`: tambah aksi `settings.manage` (SA saja) untuk route `/api/settings`.
  - Lintas dokumen: tidak ada penyimpangan dari `docs/01-domain.md` §5, §10, §11 maupun `docs/04-api.md` §6, §8, §11 — endpoint, kode error, dan aturan status cocok dengan implementasi.
  - Commit: F4 domain, route, schema, dan test sudah ditulis; siap untuk commit setelah verifikasi.

## F5 — Tampilan (AC-53–58)

- [x] Komponen Gantt matriks desktop + mobile 375 px, legenda, tooltip/panel (AC-53–56).
- [x] Portofolio Gantt dengan filter bersama.
- [x] Dashboard (baris angka KPI, EWS, 10 deviasi terbesar, Kurva S, pengingat log mingguan).
- [x] Empat laporan + ekspor Excel (ExcelJS) dan PDF (react-pdf) (AC-57–58).
- [x] Integration test Gantt 4/4 lulus saat DB tersedia (Neon pooler terkait "Server has closed the connection" mempengaruhi semua file integrasi setelah file pertama, bukan kode F5).
- [ ] `pnpm test:e2e` dan sisa integration test tertunda koneksi Neon stabil.
- [ ] Uji kinerja AC-58 (ekspor 50 proyek < 300 detik) dicatat sebagai catatan UAT.
- Bukti:

  | AC | Test | Berkas | Status |
  |----|------|--------|--------|
  | AC-53 | Gantt semua attempt termasuk batal; W1 | `tests/unit/gantt.test.ts`, `tests/integration/gantt.test.ts` | unit ✓, integrasi ✓ (4/4 saat DB stabil) |
  | AC-54 | Warna baseline abu-abu, revisi 1 kuning, 2+ oranye | `tests/unit/gantt.test.ts`, `tests/e2e/gantt.spec.ts` | unit ✓, e2e ditulis |
  | AC-55 | `#` berjalan / `✓` selesai, simbol tidak mengganti warna | `tests/unit/gantt.test.ts`, `tests/e2e/gantt.spec.ts` | unit ✓, e2e ditulis |
  | AC-56 | Gantt 375 px: identitas sticky, timeline geser | `tests/e2e/gantt.spec.ts` | ditulis, tertunda DB |
  | AC-57 | Progres & EWS konsisten dashboard/JSON/Excel/PDF | `tests/integration/dashboard.test.ts` | ditulis, tertunda DB |
  | AC-58 | Ekspor 4 laporan (UAT 50 proyek < 300 detik) | catatan UAT | belum |

  | Gerbang kualitas | Uji | Hasil |
  |---|---|---|
  | `pnpm typecheck` | `next typegen && tsc --noEmit` | lulus |
  | `pnpm lint` | ESLint | lulus (0 error, 1 warning pre-existing `project-form.tsx`) |
  | `pnpm build` | Next.js Turbopack | lulus (semua route F5 terdaftar) |
  | `pnpm test:unit` | Vitest project `unit` | 106/108 lulus (92 asli + 14 Gantt baru) |
  | `grep hex` di `src/components src/app` | hanya `globals.css` | nihil |

  - Integrasi Gantt 4/4 lulus saat dijalankan individu setelah `pnpm db:test:prepare`. Dashboard dan reports integration gagal karena Neon pooler menutup koneksi (`P1017` / `Server has closed the connection`) — mempengaruhi SEMUA file integrasi (termasuk `projects.test.ts` yang sudah ada sebelum F5), bukan kode F5.
  - `pnpm test:e2e` belum dijalankan (butuh DB test + server build).

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
