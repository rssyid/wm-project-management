# AGENTS.md — WM Project Management

Aplikasi web internal untuk mencatat dan memantau proyek Water Management perkebunan: survei → AFCE/approval (dari SAP) → pengadaan (tender, swakelola, pembelian) → pelaksanaan (log progres, kiriman) → BAST. Satu Gantt matriks mingguan, EWS terhadap baseline, progres berbobot.

## Sumber kebenaran (urutan prioritas)

1. `docs/01-domain.md` — istilah, state machine, aturan bisnis.
2. `prisma/schema.prisma` + `prisma/sql/constraints.sql` — struktur data.
3. `docs/04-api.md` — endpoint, role, kode error.
4. `docs/02-architecture.md` — stack, struktur kode, alur request.
5. `docs/05-ui.md` — layar, form, Gantt, design system.
6. `docs/06-phases-acceptance.md` — fase F0–F7 dan acceptance criteria (AC-xx).
7. `docs/03-database.md`, `docs/07-decisions.md` — penjelasan dan asal keputusan.

Jika dua sumber bertentangan atau ada yang tidak tercakup: berhenti, jelaskan konfliknya, dan tanyakan ke pengguna. Jangan memilih diam-diam dan jangan mengarang aturan bisnis.

## Stack

Next.js 16 (App Router, runtime Node.js, TypeScript strict) · Better Auth (email/password) · Prisma 7 + `@prisma/adapter-pg` · PostgreSQL Neon · Cloudflare R2 (presigned URL) · Zod · shadcn/ui + Tailwind v4 · React Hook Form · TanStack Query/Table/Virtual · Recharts · date-fns (Asia/Jakarta) · ExcelJS · @react-pdf/renderer · Vitest · Playwright · axe-core · pnpm · Vercel Hobby.

## Perintah

- `pnpm dev` · `pnpm build` · `pnpm start`
- `pnpm lint` · `pnpm typecheck` · `pnpm test` (Vitest) · `pnpm test:e2e` (Playwright)
- `pnpm prisma migrate dev` · `pnpm prisma db seed` · `pnpm prisma studio`

(Script dibuat di fase F0; perbarui bagian ini bila namanya berubah.)

## Aturan kerja

- Kerjakan satu fase per sesi sesuai `task.md`. Mulai dengan `/start-phase` (agen Plan), akhiri dengan `/verify-phase` (perintah ada di `.kilo/commands/`). Aturan rinci ada di `.kilo/rules/` dan dimuat lewat `kilo.jsonc`. Untuk aturan yang belum jelas pakai `/decision`; untuk perubahan database pakai `/db-change`. Sebelum menutup fase, `/slop-check` wajib bersih.
- Buat rencana dan minta persetujuan sebelum menulis kode untuk fase atau perubahan besar.
- Jangan mencentang `task.md` tanpa bukti: lint, typecheck, test dan build lulus, dan AC terkait punya test.
- UI dan pesan error dalam bahasa Indonesia; kode, nama variabel dan commit dalam bahasa Inggris.
- Jangan memakai fitur khusus Vercel (KV, Blob, Cron, Edge). Semua route runtime Node.js.
- Jangan mengubah `Project.status` di luar modul `project-transition`.
- Jangan menghitung progres/EWS di luar modul `progress-ews`.
- Jangan menghapus atau mengubah baris di tabel riwayat (lihat `docs/03-database.md` §3).
- Jangan menyimpan rahasia di repo; semua konfigurasi lewat environment variable (`.env.example` wajib diperbarui).
- Jangan membaca atau menampilkan isi `.env.local`; rujuk `.env.example` untuk nama variabel.
- Jangan menjalankan perintah yang menulis ke database produksi atau Vercel produksi tanpa persetujuan eksplisit.
- Kualitas di atas kelengkapan semu: lebih baik melaporkan sesuatu belum selesai daripada mengisi dengan kode atau teks generik (rule 05-quality).
