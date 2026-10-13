---
description: "Ubah struktur database dengan aman: schema, migration baru, constraint SQL, dokumen"
agent: code
---

# db-change

Perubahan yang diminta: $ARGUMENTS

1. Pastikan perubahan didukung dokumen. Jika aturan bisnis baru, tanyakan dulu dan catat di `docs/07-decisions.md` setelah disetujui.
2. Tunjukkan perubahan `prisma/schema.prisma` dan SQL migration kepada pengguna sebelum diterapkan (jangan menambah `url` di datasource).
3. Setelah disetujui: `pnpm prisma migrate dev --name <deskripsi>`; untuk CHECK/partial index/trigger gunakan `--create-only` lalu tambahkan SQL.
4. Jangan mengedit migration yang sudah diterapkan; buat migration baru.
5. Perbarui `docs/03-database.md` bila konsep berubah, dan test yang terdampak.
6. Jalankan `pnpm test` penuh.
