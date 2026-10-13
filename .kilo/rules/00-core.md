# Rule 00 — Inti proyek (selalu aktif)

Kamu membangun WM Project Management sesuai dokumen yang sudah disetujui. Dokumen adalah kontrak; kode mengikuti dokumen, bukan sebaliknya.

## Rujukan wajib

- Domain dan state machine: `docs/01-domain.md`
- Struktur data: `prisma/schema.prisma` dan `prisma/sql/constraints.sql`
- API: `docs/04-api.md`
- Arsitektur: `docs/02-architecture.md`
- UI: `docs/05-ui.md`
- Fase dan acceptance criteria: `docs/06-phases-acceptance.md`
- Daftar tugas: `task.md`

Baca bagian yang relevan sebelum mengubah kode di area tersebut.

## Perilaku

1. Konflik antar dokumen, aturan yang tidak tercakup, atau permintaan yang bertentangan dengan dokumen: berhenti dan tanyakan. Jangan mengarang aturan bisnis.
2. Buat rencana singkat (file yang diubah, model/endpoint/komponen, test yang ditambah, AC yang dipenuhi) dan tunggu persetujuan sebelum perubahan besar.
3. Kerjakan hanya lingkup fase aktif di `task.md`. Pekerjaan di luar fase dicatat sebagai catatan, tidak dikerjakan.
4. Centang `task.md` hanya dengan bukti: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` lulus, dan AC terkait punya test atau langkah UAT tertulis.
5. Setiap keputusan teknis baru yang memengaruhi perilaku dicatat di `docs/07-decisions.md` dengan kode baru dan tanggal, setelah disetujui pengguna.
6. Commit kecil per langkah, pesan dalam bahasa Inggris, menyebut ID AC bila relevan.

## Bahasa dan istilah

- UI, pesan error, label: bahasa Indonesia. Kode, identifier, komentar teknis, commit: bahasa Inggris.
- Istilah domain dipakai apa adanya: AFCE, AR, RAB, BOQ, USPK, SPK, PR, PO, BAST. Jangan menebak kepanjangannya.
- "Pekerjaan" = `WorkItem`; "Paket Kerja" = `WorkPackage`. Jangan tertukar.

## Larangan

- Fitur khusus Vercel (KV, Blob, Cron, Edge runtime).
- Rahasia di repo. Semua konfigurasi lewat env; perbarui `.env.example`.
- Library baru di luar stack tanpa persetujuan.
- Menghapus riwayat: attempt batal, SPK batal, revisi, log digantikan, approval, audit.
