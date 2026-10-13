---
description: "Mulai satu fase (F0–F7): baca dokumen, susun rencana per AC, tunggu persetujuan"
agent: plan
---

# start-phase

Fase yang dimaksud: $ARGUMENTS (jika kosong, tanyakan fase mana).

1. Baca `task.md` dan pastikan fase sebelumnya sudah dicentang lengkap dengan bukti. Jika belum, berhenti dan laporkan.
2. Baca `docs/06-phases-acceptance.md` bagian fase ini dan daftar AC-nya.
3. Baca dokumen area terkait: `docs/01-domain.md` (selalu), lalu `docs/04-api.md`, `docs/05-ui.md`, `prisma/schema.prisma` sesuai isi fase.
4. Tulis rencana fase:
   - langkah berurutan (kecil, bisa di-commit terpisah);
   - file/modul yang dibuat atau diubah;
   - perubahan schema/migration (jika ada);
   - test yang akan ditulis, dipetakan ke setiap AC fase;
   - pertanyaan atau konflik dokumen yang ditemukan;
   - komponen, helper, dan pola yang sudah ada dan akan dipakai ulang;
   - hal yang sengaja **tidak** dibuat di fase ini (untuk mencegah pekerjaan di luar lingkup).
5. Tunggu persetujuan pengguna. Jangan menulis kode sebelum disetujui.
6. Setelah disetujui (pengguna akan pindah ke agen Code), kerjakan langkah demi langkah; jalankan test terkait setiap selesai satu langkah; commit per langkah.
