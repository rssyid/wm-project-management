# Lembar Verifikasi UAT & Checklist Go-Live

Dokumen ini memuat **16 Skenario Pengujian Penerimaan Pengguna (User Acceptance Testing / UAT)** dan **Checklist Kesiapan Go-Live** untuk aplikasi Water Management Project Management sesuai spesifikasi `docs/06-phases-acceptance.md` §4 dan `docs/01-domain.md`.

---

## 1. Lembar Persetujuan (Sign-off Sheet)

| Peran | Nama | Jabatan | Tanggal | Tanda Tangan / Status |
| --- | --- | --- | --- | --- |
| **Product Owner** | ____________________ | VP Water Management & Infrastructure | ____________ | [ ] Disetujui |
| **Lead Engineer** | ____________________ | Fullstack System Architect | ____________ | [ ] Disetujui |
| **Super Admin** | ____________________ | Head of IT Application | ____________ | [ ] Disetujui |

---

## 2. 16 Skenario UAT

Setiap skenario mencakup alur uji pengguna, peran yang berwenang, kriteria penerimaan (AC), dan verifikasi otomatis yang mendasarinya.

### Skenario 1: Tender Normal dari Awal hingga Verifikasi BAST
- **Peran**: Specialist (SP), Super Admin (SA)
- **AC Terkait**: AC-10 s.d. AC-24, AC-34 s.d. AC-37, AC-47, AC-63, AC-65
- **Langkah Pengujian**:
  1. Login sebagai SP, buat proyek baru di `/proyek/baru`.
  2. Input survei, data spasial `.geojson`, dan data hidrologi.
  3. Buka tab AFCE, buat BOQ (bangunan/kegiatan + harga), ajukan AFCE dengan tanggal email persetujuan SAP.
  4. Login sebagai approver / SA, setujui seluruh level approval tier hingga status proyek berubah menjadi `APPROVED`.
  5. Buat Pekerjaan tender (`TENDER_CONTRACT`), buat nomor USPK, klik Mulai Tender.
  6. Catat penawaran vendor baru, tentukan pemenang tender.
  7. Terbitkan (release) SPK, klik Mulai Fisik (status menjadi `EXECUTION`).
  8. Isi log progres mingguan bertahap sampai akumulasi fisik mencapai 100%.
  9. Klik Ajukan BAST (status menjadi `WAITING_BAST`).
  10. Login sebagai SA, verifikasi BAST (status menjadi `COMPLETED`).
- **Hasil yang Diharapkan**: Seluruh transisi status berjalan mulus, riwayat tercatat lengkap, proyek terkunci (`PROJECT_LOCKED`) setelah selesai.
- **Uji Otomatis**: `tests/e2e/project-flow.spec.ts`, `tests/integration/bast.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 2: Penolakan AFCE & Attempt Baru
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-21 s.d. AC-24
- **Langkah Pengujian**:
  1. Ajukan AFCE attempt 1 pada proyek status `RAB_READY`.
  2. Tolak AFCE pada level 2 approval dengan catatan revisi.
  3. Periksa status proyek kembali menjadi `RAB_READY`.
  4. Klik Buat Attempt Baru; pastikan seluruh baris BOQ dari attempt 1 tersalin otomatis.
  5. Sesuaikan volume/harga, lalu ajukan attempt 2 hingga Approved.
- **Hasil yang Diharapkan**: Attempt 1 tersimpan sebagai arsip dengan status DITOLAK; attempt 2 disetujui dan total BOQ mengupdate Anggaran Resmi.
- **Uji Otomatis**: `tests/integration/afce.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 3: Pembatalan Tender & Tender Ulang
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-35, AC-53
- **Langkah Pengujian**:
  1. Buka Pekerjaan tender yang sedang dalam status `TENDER`.
  2. Batalkan tender dengan alasan yang valid (misal: "Penawaran melebihi OE").
  3. Masukkan nomor USPK baru untuk tender ulang.
  4. Lanjutkan proses tender hingga mendapatkan pemenang.
- **Hasil yang Diharapkan**: Matriks Gantt dan workspace menampilkan attempt tender yang dibatalkan maupun attempt baru secara transparan.
- **Uji Otomatis**: `tests/integration/tender.test.ts`, `tests/unit/gantt.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 4: Pembatalan SPK saat Fisik Berjalan & SPK Pengganti
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-37, AC-39, AC-52
- **Langkah Pengujian**:
  1. Pada proyek yang sedang berjalan (`EXECUTION`), batalkan salah satu SPK aktif.
  2. Periksa status fisik pekerjaan: status beralih ke `JEDA_SPK_BATAL` dan perhitungan deviasi EWS membeku (*freeze*).
  3. Buat SPK pengganti tanpa perlu membuat USPK baru (memakai vendor terpilih/lain).
  4. Release SPK pengganti dan mulai ulang pekerjaan fisik.
- **Hasil yang Diharapkan**: Deviasi rencana harian tidak membengkak selama jeda; pekerjaan fisik dapat dilanjutkan normal.
- **Uji Otomatis**: `tests/integration/spk.test.ts`, `tests/unit/progress-ews.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 5: Swakelola dengan Paket Kerja Pendukung
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-38, AC-40 s.d. AC-43
- **Langkah Pengujian**:
  1. Tambahkan Pekerjaan tipe `SWAKELOLA` (vendor otomatis terisi INTERNAL).
  2. Hubungkan Pekerjaan dengan Paket Kerja material pendukung (tipe `PURCHASE`).
  3. Rilis SPK swakelola, mulai fisik mandiri, dan pantau bobot progres gabungan.
- **Hasil yang Diharapkan**: Progres fisik dan material terkalkulasi dengan proporsi bobot yang benar (default 70% fisik / 30% material).
- **Uji Otomatis**: `tests/integration/work-item.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 6: Pembelian Murni (Material)
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-40 s.d. AC-43
- **Langkah Pengujian**:
  1. Buat Pekerjaan dengan tipe `PURCHASE`.
  2. Buat nomor PR (Purchase Requisition), lalu nomor PO (Purchase Order).
  3. Catat status produksi vendor (`PRODUKSI`).
  4. Catat kiriman barang parsial (misal: 60 batang dari total 100 batang gorong-gorong).
  5. Lakukan koreksi penerimaan barang (misal: -5 karena pecah saat bongkar muat).
  6. Catat kiriman sisa hingga kuantitas akumulasi 100%.
- **Hasil yang Diharapkan**: Status paket otomatis berubah menjadi `COMPLETED` saat kuantitas netto lengkap 100%.
- **Uji Otomatis**: `tests/integration/delivery.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 7: Proyek Campuran (Kombinasi Tender & Pembelian)
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-42
- **Langkah Pengujian**:
  1. Buat proyek dengan 2 Pekerjaan: 1 Tender dan 1 Pembelian pipa MDPE.
  2. Saat tender masih dalam proses negosiasi, catat kiriman pertama material pipa.
- **Hasil yang Diharapkan**: Status proyek secara otomatis bertransisi menjadi `EXECUTION` karena telah ada aktivitas lapangan pertama.
- **Uji Otomatis**: `tests/integration/project-transition.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 8: Revisi Jadwal & Pewarnaan Gantt
- **Peran**: Specialist (SP), Viewer (MV)
- **AC Terkait**: AC-45, AC-50, AC-54
- **Langkah Pengujian**:
  1. Kunci baseline jadwal proyek.
  2. Ajukan Revisi 1 dengan alasan cuaca ekstrem; verifikasi tanggal target bergeser.
  3. Ajukan Revisi 2 dengan alasan keterlambatan logistik vendor.
  4. Buka Matriks Gantt: periksa pewarnaan sel (Baseline = Abu-abu, Revisi 1 = Kuning, Revisi 2+ = Oranye).
- **Hasil yang Diharapkan**: Seluruh baris rencana awal tetap dapat dilacak; indikator EWS tetap mengacu pada baseline awal.
- **Uji Otomatis**: `tests/unit/gantt.test.ts`, `tests/integration/schedule-revision.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 9: AR Tambahan Approved
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-25
- **Langkah Pengujian**:
  1. Pada proyek yang sedang berjalan, klik tab Anggaran Tambahan (AR).
  2. Buat AR dengan nominal penambahan dana dan alasan pekerjaan tambah galian.
  3. Ajukan dan setujui seluruh level approval tier AR.
- **Hasil yang Diharapkan**: Anggaran Resmi proyek otomatis bertambah sesuai nominal AR tanpa mengganggu jalannya status fisik `EXECUTION`.
- **Uji Otomatis**: `tests/integration/ar-supplement.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 10: Proyek Multi-Estate Lintas Wilayah
- **Peran**: Viewer (MV)
- **AC Terkait**: AC-11, AC-13
- **Langkah Pengujian**:
  1. Buat proyek yang mencakup Estate A (Wilayah 1) dan Estate B (Wilayah 2).
  2. Buka daftar proyek `/proyek`, filter berdasarkan Wilayah 1: pastikan proyek muncul.
  3. Ganti filter ke Wilayah 2: pastikan proyek tetap muncul.
- **Hasil yang Diharapkan**: Filter multi-estate bekerja akurat tanpa duplikasi baris.
- **Uji Otomatis**: `tests/integration/project-estate.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 11: Tahan Proyek (ON_HOLD) & Pembatalan Proyek
- **Peran**: Specialist (SP), Super Admin (SA)
- **AC Terkait**: AC-67, AC-68
- **Langkah Pengujian**:
  1. Pada proyek `EXECUTION`, SP klik Tahan Proyek dengan alasan sengketa lahan (status menjadi `ON_HOLD`).
  2. Pastikan input kiriman dan log progres mingguan terkunci.
  3. SP klik Lanjutkan Proyek; pastikan status kembali ke `EXECUTION`.
  4. Login sebagai SA, klik Batalkan Proyek dengan alasan pembatalan strategis.
- **Hasil yang Diharapkan**: Status proyek beralih ke `CANCELLED`, seluruh riwayat audit tersimpan, aksi mutasi berikutnya ditolak.
- **Uji Otomatis**: `tests/integration/project-hold-resume-cancel.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 12: Pengajuan & Pembatalan BAST
- **Peran**: Specialist (SP), Super Admin (SA)
- **AC Terkait**: AC-63 s.d. AC-66
- **Langkah Pengujian**:
  1. Proyek mencapai fisik 100% namun masih ada sisa pembayaran vendor (BELUM_LUNAS).
  2. SP mengajukan BAST (status proyek beralih ke `WAITING_BAST`).
  3. SA membatalkan pengajuan BAST karena dokumen fisik belum lengkap (status kembali ke `EXECUTION`).
  4. SP melengkapi lampiran, mengajukan kembali BAST.
  5. SA memverifikasi BAST (status menjadi `COMPLETED`).
- **Hasil yang Diharapkan**: BAST dapat diajukan walau belum lunas; status transisi akurat bolak-balik antara EXECUTION dan WAITING_BAST.
- **Uji Otomatis**: `tests/integration/bast.test.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 13: Hak Akses Role & Isolasi Viewer
- **Peran**: Viewer (MV), Specialist (SP), Super Admin (SA)
- **AC Terkait**: AC-02, AC-03
- **Langkah Pengujian**:
  1. Login sebagai MV: tombol edit, buat proyek, dan mutasi data harus hilang dari antarmuka.
  2. Uji tembak langsung ke endpoint mutasi (`POST /api/projects` via cURL / Postman): pastikan HTTP 403 Forbidden.
  3. Login sebagai SP: coba akses menu `/admin`: pastikan ditolak 403.
- **Hasil yang Diharapkan**: Penegakan otorisasi role matriks berjalan konsisten di UI dan API.
- **Uji Otomatis**: `tests/integration/permissions.test.ts`, `tests/e2e/auth.spec.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 14: Akses Smartphone (375 px) & Unggah Foto
- **Peran**: Specialist (SP)
- **AC Terkait**: AC-56, AC-72
- **Langkah Pengujian**:
  1. Buka aplikasi melalui peramban ponsel pintar (lebar 375 px).
  2. Masuk ke halaman detail proyek -> tab Progres Fisik.
  3. Ambil foto progres dari kamera HP dan simpan log mingguan.
  4. Buka Matriks Gantt di HP: geser timeline mingguan, pastikan kolom identitas tetap menempel (*sticky*) di sisi kiri.
- **Hasil yang Diharapkan**: Seluruh elemen UI fleksibel tanpa overflow horizontal yang merusak layout; foto terkompres dan tersimpan di R2.
- **Uji Otomatis**: `tests/e2e/mobile.spec.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 15: Ekspor 4 Format Laporan (Excel & PDF)
- **Peran**: Viewer (MV)
- **AC Terkait**: AC-57, AC-58
- **Langkah Pengujian**:
  1. Navigasi ke menu `/laporan`.
  2. Unduh 4 jenis laporan: Portofolio, Detail Proyek, Paket Kerja, dan EWS Merah dalam format `.xlsx`.
  3. Unduh 4 laporan yang sama dalam format `.pdf`.
  4. Periksa kecocokan data angka progres, status, dan EWS antara layar dan berkas unduhan.
- **Hasil yang Diharapkan**: Berkas utuh, sel berwarna pada Excel sesuai EWS, rendering PDF rapi dalam format standar A4.
- **Uji Otomatis**: `tests/integration/dashboard.test.ts`, `scripts/benchmark-50-projects.ts`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

### Skenario 16: Backup Basis Data & Pengujian Restore
- **Peran**: Super Admin (SA)
- **AC Terkait**: AC-74
- **Langkah Pengujian**:
  1. Trigger manual workflow GitHub Actions `Database Backup to Cloudflare R2`.
  2. Verifikasi berkas backup `.sql` tersimpan di bucket R2 `backups/`.
  3. Jalankan script restore (`scripts/db-restore.ts`) ke branch database Neon uji terpisah.
- **Hasil yang Diharapkan**: Proses restore berhasil tanpa error constraint dan seluruh data tabel master/proyek utuh.
- **Uji Otomatis**: `scripts/db-backup.ts`, `.github/workflows/db-backup.yml`.
- **Status UAT**: [ ] Lulus | Catatan: ________________________

---

## 3. Checklist Kesiapan Go-Live

Checklist ini wajib dipenuhi oleh Tim IT sebelum aplikasi dibuka untuk operasional harian:

- [ ] **1. Basis Data Produksi (Neon)**:
  - Branch Neon `main` aktif di region Singapore (`ap-southeast-1`).
  - Autoscaling compute dibatasi 0,25 CU.
  - Skema termigrasi penuh via `pnpm prisma migrate deploy`.
  - Data master awal (Region, Wilayah, Company, Estate, Kategori, Material, Satuan) tersemut melalui `pnpm prisma db seed`.

- [ ] **2. Cloudflare R2 Storage**:
  - Bucket file privat produksi (`wm-prjct-files-prod`) dan bucket backup (`wm-prjct-backup-prod`) siap.
  - Kebijakan CORS bucket mengizinkan domain produksi (`PUT`, `GET`, `HEAD`).
  - Lifecycle rule 30 hari untuk folder backup harian terkonfigurasi.

- [ ] **3. Akun Super Admin & Keamanan**:
  - Super Admin pertama disemai dengan email resmi IT.
  - Password default diganti pada saat sesi login pertama kali.
  - Nilai `BETTER_AUTH_SECRET` dibuat menggunakan string acak kriptografis 64-char.
  - Nilai `BETTER_AUTH_URL` disetel persis ke URL domain publik tanpa trailing slash.

- [ ] **4. Monitoring & Backup Otomatis**:
  - Secret GitHub Actions (`TEST_DATABASE_URL`, `R2_BACKUP_*`) terisi pada repositori.
  - Jadwal cron harian backup basis data (02:00 WIB) aktif.
  - Template monitoring compute mingguan telah dijadwalkan di kalender tim operasional.
