# Rule 20 — Backend dan data (aktif saat mengerjakan server, API, Prisma)

Rujukan: `docs/02-architecture.md` · `docs/04-api.md` · `docs/03-database.md`

## Struktur

- `src/app/api/**/route.ts`: hanya autentikasi, `assertCan`, validasi Zod, panggil service, bentuk response.
- `src/domain/<modul>/`: aturan bisnis. Setiap mutasi dalam `prisma.$transaction` dan menulis `AuditLog` (before/after) di transaksi yang sama.
- `src/infra/`: Prisma client (singleton, `PrismaPg` dengan `DATABASE_URL`), repository, R2, Better Auth, renderer ekspor.
- `src/shared/`: skema Zod, enum, kode error, util tanggal & format. Dipakai klien dan server.

## Urutan handler

1. Session via Better Auth (`auth.api.getSession({ headers: await headers() })`) → 401.
2. `assertCan(user, action)` → 403 `FORBIDDEN_ROLE` (hanya untuk role).
3. Zod → 400 `VALIDATION_ERROR` dengan `fields`.
4. Service → error domain bertipe dengan kode; dipetakan ke HTTP di satu tempat (409 untuk gate/prasyarat/konflik).
5. Envelope: `{ data, meta? }` atau `{ error: { code, message, fields? } }`; pesan Indonesia.

## Data

- Prisma 7: generator `prisma-client` dengan `output`, URL di `prisma.config.ts` (pakai `DIRECT_URL` untuk CLI/migrasi), runtime pakai `DATABASE_URL` pooled lewat adapter. Tidak ada `url` di `schema.prisma`.
- Perubahan schema: ubah `schema.prisma`, buat migration, perbarui `docs/03-database.md` bila konsepnya berubah. Constraint tambahan ditambahkan sebagai migration SQL, jangan diedit di migration lama.
- Uang/kuantitas/persen: `Decimal`; kirim ke klien sebagai string. Jangan pakai `number` floating untuk perhitungan uang/bobot; gunakan Decimal (mis. `Prisma.Decimal`) atau integer basis poin.
- Tanggal bisnis `@db.Date`; gunakan helper tanggal di `src/shared` yang sadar zona Asia/Jakarta.
- Optimistic locking: update `where: { id, version }` + `version: { increment: 1 }`; 0 baris → 409 `VERSION_CONFLICT`.
- Purge: dalam satu transaksi `SET LOCAL app.allow_purge = 'on'`, buat tombstone, hapus anak secara eksplisit, hapus objek R2 setelah commit.
- Jangan pernah UPDATE/DELETE tabel riwayat (trigger akan menolak).

## File

- Presigned PUT/GET R2 berumur pendek. Validasi ukuran (foto 5 MB, lainnya 10 MB), MIME, dan ekstensi spasial (.zip/.geojson) sebelum membuat URL. Konfirmasi upload memeriksa objek di R2.

## Keamanan

- Setiap route dan server action memvalidasi session sendiri; `proxy.ts` hanya redirect berdasarkan cookie.
- Jangan pernah mengembalikan hash password, token, atau kredensial R2 ke klien.
