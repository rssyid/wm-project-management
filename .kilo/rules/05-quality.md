# Rule 05 — Kualitas: tanpa AI slop

"AI slop" = kode, tampilan atau teks yang terlihat lengkap tetapi generik, berlebihan, atau tidak benar-benar dipakai. Setiap aturan di bawah bisa diperiksa; `/slop-check` memeriksanya sebelum fase ditutup.

## Kode

1. Tulis hanya yang dibutuhkan fase aktif. Tidak ada abstraksi, opsi konfigurasi, parameter, atau helper generik "untuk nanti".
2. Sebelum membuat helper, komponen, atau tipe baru, cari dulu yang sudah ada (`src/shared`, `src/components`). Satu konsep, satu implementasi — terutama format tanggal, uang, persen, dan pemetaan error.
3. Nama mengikuti glossary: `WorkItem`, `WorkPackage`, `TenderAttempt`, `Spk`, `BastDocument`, dst. Bukan sinonim (`task`, `job`, `package`, `order`).
4. Dilarang: `any`, `as unknown as`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable` — kecuali benar-benar terpaksa, dengan alasan di baris yang sama.
5. Dilarang: kode mati, kode lama yang dikomentari, `console.log`, `TODO`/`FIXME` tanpa nomor item `task.md`.
6. Komentar hanya menjelaskan **kenapa**, sebaiknya dengan rujukan keputusan (`// U-27: jeda fisik hanya bila tak ada SPK aktif lain`). Jangan menulis komentar yang mengulang isi kode atau komentar pembuka file yang generik.
7. Error tidak ditelan: tidak ada `catch {}` kosong, tidak ada catch yang hanya mencatat log lalu melanjutkan. Lempar error domain berkode atau biarkan naik.
8. Tidak ada data palsu atau hardcoded di kode produksi (daftar contoh, angka dummy, nama orang). Data contoh hanya di test, seed, atau prototipe F0 yang dihapus sebelum F2.
9. Perubahan kecil = edit kecil. Jangan menulis ulang file utuh, jangan memformat ulang bagian yang tidak disentuh.
10. File lebih dari ~300 baris dipecah menurut tanggung jawab, bukan menurut ukuran.
11. Dependensi baru wajib alasan dan persetujuan. Dependensi yang tidak dipakai dihapus. Komponen shadcn ditambahkan satu per satu saat dipakai, bukan sekaligus.

## Test

12. Test membuktikan perilaku pada AC, bukan detail implementasi. Setiap test punya assertion yang akan gagal bila aturannya dilanggar.
13. Dilarang: test yang hanya mengecek komponen "ter-render", snapshot besar, test yang memeriksa mock-nya sendiri, dan mock Prisma untuk aturan yang dijaga database.

## Teks di UI

14. Bahasa Indonesia sederhana, kalimat aktif, sentence case. Istilah dari glossary.
15. Dilarang: kalimat pengisi ("Selamat datang di…", "Kelola proyek Anda dengan mudah", "solusi lengkap"), kata pemasaran ("canggih", "seamless", "powerful"), emoji, tanda seru, teks Lorem ipsum.
16. Tombol menyebut akibatnya; toast memakai kata kerja yang sama ("Release SPK" → "SPK direlease").
17. Pesan error menyebut apa yang salah dan cara memperbaikinya. Empty state: satu kalimat + tombol aksi yang relevan.

## File dan laporan

18. Jangan membuat file markdown baru (README tambahan, SUMMARY.md, NOTES.md, IMPLEMENTATION.md) kecuali diminta. Perubahan aturan masuk ke `docs/` yang sudah ada.
19. Hapus sisa template: halaman dan aset bawaan create-next-app, contoh komponen yang tidak dipakai, README bawaan.
20. Laporan ke pengguna berisi: apa yang berubah, bukti (output perintah), apa yang belum selesai, dan risiko. Jangan memakai klaim seperti "production-ready", "robust", "comprehensive", "fully tested".
