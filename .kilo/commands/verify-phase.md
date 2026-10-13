---
description: "Tutup satu fase: lint, typecheck, test, build, tabel bukti per AC, perbarui task.md"
agent: code
---

# verify-phase

Fase yang dimaksud: $ARGUMENTS (jika kosong, tanyakan fase mana).

1. Jalankan `/slop-check` dan selesaikan semua temuannya.
2. Jalankan `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Untuk fase dengan UI, jalankan juga `pnpm test:e2e`.
3. Buat tabel bukti: setiap AC fase → nama test (atau langkah UAT) → hasil (lulus/gagal).
4. Jika ada yang gagal atau AC tanpa test: perbaiki dulu, jangan centang.
5. Periksa lintas dokumen: apakah ada perilaku yang menyimpang dari `docs/01-domain.md` atau `docs/04-api.md`? Laporkan bila ada.
6. Perbarui `task.md`: centang item yang terbukti, tambahkan tanggal dan ringkasan bukti di bawah fase.
7. Perbarui `AGENTS.md` (perintah) dan `.env.example` bila berubah.
8. Laporkan ringkasan ke pengguna: apa yang selesai, bukti, catatan untuk fase berikutnya.
