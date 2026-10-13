---
description: "Audit perubahan terhadap rule 05-quality dan 35-design sebelum fase ditutup"
agent: code
---

# slop-check

1. Tentukan cakupan: perubahan sejak awal fase (`git diff <commit awal fase>...HEAD --stat`). Jika tidak tahu commit awalnya, tanyakan.
2. Cari dengan grep di file yang berubah, lalu catat setiap temuan beserta file dan baris:
   - `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`
   - `console.log`, `TODO`, `FIXME`, kode yang dikomentari
   - `catch {}` atau catch tanpa lempar ulang / tanpa error domain
   - kode warna hex atau `rgb(` di luar `src/app/globals.css`
   - teks UI berisi: "Selamat datang", "dengan mudah", "solusi", "canggih", "seamless", "powerful", "Lorem", emoji, tanda seru
   - nama di luar glossary (`task`, `job`, `package`, `order` untuk konsep domain)
3. Periksa `package.json`: dependensi baru → masih dipakai? ada di stack? sudah disetujui?
4. Periksa file baru: ada markdown yang tidak diminta, helper yang menduplikasi `src/shared`, komponen shadcn yang tidak dipakai, sisa template create-next-app?
5. Periksa test baru: ada test "renders" saja, snapshot besar, atau mock Prisma untuk aturan database?
6. Jika fase menyentuh UI: jalankan aplikasi, ambil screenshot setiap halaman yang berubah di 1440 px dan 375 px, bandingkan dengan rule 35-design (token, PageHeader, pola tabel/form, tidak ada grid kartu generik, angka tabular rata kanan). Jika Anda tidak bisa mengambil screenshot, katakan terus terang dan minta pengguna memeriksa halamannya.
7. Tulis tabel temuan: No · File:baris · Aturan (nomor di 05-quality / bagian 35-design) · Perbaikan.
8. Perbaiki semua temuan, lalu jalankan ulang `pnpm lint`, `pnpm typecheck`, `pnpm test`. Laporkan tabel temuan dan hasil perintahnya. Jika tidak ada temuan, katakan begitu dengan daftar pemeriksaan yang dijalankan.
