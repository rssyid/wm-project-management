# 06 — Fase Implementasi dan Acceptance Criteria

Status: disetujui 10 Oktober 2026. Proyek pribadi, dikerjakan sendiri dengan agen AI di Kilo Desktop (sebelumnya Claude Code dan Google Antigravity); fase berurutan, satu fase per sesi agen, tanpa target tanggal. UAT dijalankan dan ditandatangani pemilik proyek memakai tiga akun uji (SA, SP, MV).

## 1. Aturan kerja

- Baca `docs/01-domain.md` dan dokumen area terkait sebelum mulai.
- Susun rencana teknis fase, minta review, baru tulis kode.
- Satu fase per tugas. Sebelum menandai selesai: lint, typecheck, test, build lulus.
- `task.md` hanya dicentang berdasarkan bukti (test lulus, demo, hasil UAT).
- Setiap AC punya minimal satu test otomatis atau langkah UAT tertulis; sebut ID AC di nama/deskripsi test.

## 2. Fase

| Fase | Isi | Gate selesai |
| --- | --- | --- |
| F0 Persiapan | Scaffold Next.js 16 + TS strict + Tailwind v4 + shadcn; pnpm; ESLint/Prettier; Vitest + Playwright + axe; Prisma 7 + adapter-pg + `prisma.config.ts`; repo GitHub + CI; branch Neon dev/preview/main (region Asia, autoscaling 0,25 CU); bucket R2 dev/prod/backup; project Vercel region Asia; hapus sisa template; fondasi UI sesuai rule 35-design (token, shell, PageHeader, DataTable, FormSection); prototipe layar utama dicoba dengan tiga akun role | CI hijau; app kosong ter-deploy; prototipe dicoba dan temuan dicatat |
| F1 Fondasi | Schema + `constraints.sql`; Better Auth; user/role/`assertCan`; error envelope; audit; upload R2; master data CRUD; seed lokasi & master | AC-01–06, AC-60–62 |
| F2 Proyek & AFCE | Proyek multi-Estate + kode; transition service; survei + spasial; AFCE/BOQ; matriks approval; keputusan SAP; AR tambahan; anggaran | AC-10–25 |
| F3 Pengadaan | Pekerjaan & bobot; USPK/tender; SPK (multi aktif); swakelola; Paket Kerja PR/PO/produksi/kiriman/koreksi/pembayaran | AC-30–44 |
| F4 Jadwal & progres | Baseline/revisi; fisik; log mingguan + alat berat; service progres/EWS (linear, deviasi, freeze); kalender kerja | AC-45–52 |
| F5 Tampilan | Gantt proyek & portofolio (desktop/mobile); dashboard; Kurva S; 4 laporan; ekspor Excel & PDF | AC-53–58 |
| F6 Penutupan & admin | BAST; tahan/lanjutkan; batal proyek; arsip; soft delete/restore/purge; setting & libur | AC-63–70 |
| F7 UAT & go-live | 16 skenario UAT; uji mobile; backup harian + uji restore; runbook pindah hosting; checklist go-live | Semua UAT lulus & ditandatangani; AC-71–76 |

## 3. Acceptance criteria

### Akses dan dasar

| ID | Kriteria | Uji |
| --- | --- | --- |
| AC-01 | Tanpa session → 401; halaman diarahkan ke login. | Integrasi, E2E |
| AC-02 | Viewer → 403 di semua mutasi; UI tanpa tombol aksi. | Integrasi, E2E |
| AC-03 | Specialist → 403 di aksi khusus SA (verifikasi/batal BAST, batal proyek, user, matriks approval, setting, soft delete, purge). | Integrasi |
| AC-04 | User baru/di-reset wajib ganti password dulu; reset mencabut session lama. | E2E |
| AC-05 | Setiap mutasi menulis satu `AuditLog` (pelaku, entitas, before, after) dalam transaksi yang sama. | Integrasi |
| AC-06 | Pelanggaran gate/prasyarat selalu 409 dengan kode yang sesuai, tidak pernah 403. | Integrasi |

### Proyek, AFCE, approval

| ID | Kriteria | Uji |
| --- | --- | --- |
| AC-10 | Kode `WM-{Company}-{YYYY}-{SEQ4}` berurutan per Company per tahun; pembuatan bersamaan tidak menghasilkan nomor sama. | Integrasi paralel |
| AC-11 | Multi-Estate dengan tepat satu utama; Estate Company lain atau Block Estate lain → 409. | Integrasi |
| AC-12 | Tepat satu kategori; PIC, target, anggaran rencana wajib sebelum Mulai Survei. | Integrasi |
| AC-13 | Proyek multi-Estate muncul di filter tiap Region/Wilayah Estate-nya. | Integrasi |
| AC-14 | Survei menyimpan foto, dokumen, `.zip`/`.geojson` ≤ 10 MB; terkunci setelah AFCE pertama diajukan. | Integrasi, E2E |
| AC-15 | `Project.status` hanya berubah lewat transition service; setiap perubahan tercatat di riwayat status. | Unit, Integrasi |
| AC-16 | RAB siap saat SURVEY → RAB_READY. | Integrasi |
| AC-17 | Nilai AFCE = total BOQ, terkunci saat diajukan. | Unit, Integrasi |
| AC-18 | Level dari tier cocok (bawah inklusif, atas eksklusif); tanpa tier cocok pengajuan → 409. | Unit, Integrasi |
| AC-19 | Level bisa diubah selama DRAFT, diaudit, ditandai "berbeda dari matriks"; tidak bisa setelah diajukan. | Integrasi, E2E |
| AC-20 | Pengajuan wajib tanggal pengajuan & tanggal email; proyek → WAITING_AFCE_AR. | Integrasi |
| AC-21 | Level N ditolak bila N-1 belum Approved; tanggal masa depan atau lebih awal dari level sebelumnya (level 1: dari tanggal email) ditolak. | Integrasi |
| AC-22 | Durasi level: level 1 dari tanggal email, berikutnya dari keputusan sebelumnya (hari kalender). | Unit, E2E |
| AC-23 | Ditolak → attempt DITOLAK, proyek RAB_READY; attempt baru menyalin BOQ; attempt lama utuh. | Integrasi |
| AC-24 | Level terakhir Approved → AFCE_AR_APPROVED dan `BudgetEntry INITIAL` = nilai AFCE; anggaran rencana tetap. | Integrasi |
| AC-25 | AR tambahan Approved menambah anggaran tanpa mengubah status; ditolak di COMPLETED/CANCELLED. | Integrasi |

### Pekerjaan, tender, SPK, Paket Kerja

| ID | Kriteria | Uji |
| --- | --- | --- |
| AC-30 | Pekerjaan & Paket Kerja → 409 sebelum AFCE Approved. | Integrasi |
| AC-31 | Bobot Pekerjaan tepat 100,00; bobot paket tepat = bobot material; selain itu WEIGHT_MISMATCH. | Unit, Integrasi |
| AC-32 | Batal Pekerjaan/paket wajib pembagian bobot baru dalam satu transaksi. | Integrasi |
| AC-33 | Perubahan bobot langsung mengubah progres di semua tampilan dan tercatat di audit. | Integrasi |
| AC-34 | USPK pertama → PROCUREMENT; baseline tender & fisik attempt dikunci. | Integrasi |
| AC-35 | Satu attempt aktif per Pekerjaan; attempt batal tetap tampil; attempt baru wajib USPK baru. | Integrasi, E2E |
| AC-36 | Pemenang nama baru → vendor `isComplete=false`; menjadi lengkap otomatis saat semua field terisi. | Integrasi |
| AC-37 | SPK release pertama → attempt COMPLETED, actualEnd = tanggal release; boleh > 1 SPK aktif. | Integrasi |
| AC-38 | SPK swakelola hanya vendor internal; SPK swakelola pertama → PROCUREMENT; release pertama mengunci baseline fisik. | Integrasi |
| AC-39 | Batal SPK saat fisik berjalan → JEDA_SPK_BATAL & EWS fisik beku hanya bila tak ada SPK aktif lain; mulai ulang manual setelah SPK pengganti release. | Integrasi |
| AC-40 | PR → PR_SUBMITTED, baseline paket dikunci, PR pertama → PROCUREMENT. | Integrasi |
| AC-41 | Kiriman sebelum PO → 409; produksi opsional. | Integrasi |
| AC-42 | Kiriman pertama (termasuk parsial) → EXECUTION tepat sekali walau dua kiriman bersamaan. | Integrasi paralel |
| AC-43 | Paket COMPLETED otomatis saat semua item terpenuhi; koreksi di bawah rencana → PARTIALLY_DELIVERED; total per item ≥ 0. | Unit, Integrasi |
| AC-44 | Pembayaran bisa diubah sampai COMPLETED (termasuk WAITING_BAST), diaudit. | Integrasi |

### Jadwal, progres, EWS, Gantt, laporan

| ID | Kriteria | Uji |
| --- | --- | --- |
| AC-45 | Plan bebas sebelum dikunci; sesudahnya hanya revisi beralasan; baseline tidak pernah berubah. | Integrasi |
| AC-46 | Revisi ditolak saat WAITING_BAST, diterima saat ON_HOLD. | Integrasi |
| AC-47 | Satu log aktif per Pekerjaan per minggu; turun wajib alasan; log pengganti tanpa menghapus yang lama; 100% → SELESAI. | Integrasi |
| AC-48 | Alat berat tersimpan per log dan tidak memengaruhi progres. | Integrasi |
| AC-49 | Contoh uji bobot menghasilkan 65,4% (A 59,0%, B 75,0%). | Unit |
| AC-50 | % rencana linear per hari kerja Senin–Sabtu dikurangi libur, dari baseline awal. | Unit |
| AC-51 | Deviasi < 5 hijau, 5–10 kuning, > 10 merah; ubah ambang langsung berlaku. | Unit, Integrasi |
| AC-52 | Selama ON_HOLD dan SPK - Batal, hari kerja tidak dihitung sehingga deviasi tidak bertambah. | Unit |
| AC-53 | Gantt menampilkan semua attempt termasuk batal; W1 = Senin minggu tanggal paling awal dari baseline, revisi, actual. | E2E |
| AC-54 | Warna: baseline abu-abu, revisi pertama kuning, berikutnya oranye, tambahan lama tetap kuning; pola garis; legenda tampil. | Unit, E2E |
| AC-55 | `#` berjalan / `✓` selesai sesuai jenis proses; simbol tidak mengganti warna. | Unit, E2E |
| AC-56 | Gantt 375 px: identitas sticky, timeline geser, semua baris/attempt bisa dibuka. | E2E mobile |
| AC-57 | Untuk data uji sama, progres & EWS identik di Gantt, dashboard, Kurva S, laporan JSON, Excel, PDF. | Integrasi |
| AC-58 | Ekspor tiap laporan untuk 50 proyek selesai < 300 detik di Vercel. | Performa |

### Master, penutupan, admin, non-fungsional

| ID | Kriteria | Uji |
| --- | --- | --- |
| AC-60 | Master terpakai tidak bisa dihapus (IN_USE), hanya dinonaktifkan; nonaktif hilang dari pilihan baru, tetap tampil di data lama. | Integrasi |
| AC-61 | Seed lokasi menghasilkan 8 Region, 18 Wilayah, 27 Company, 63 Estate; idempoten. | Integrasi |
| AC-62 | Foto > 5 MB / lampiran > 10 MB ditolak; PENDING > 24 jam dibersihkan; unduh lewat URL berumur pendek. | Integrasi |
| AC-63 | Ajukan BAST ditolak bila ada fisik < 100%; diterima walau belum lunas/material belum lengkap. | Integrasi |
| AC-64 | WAITING_BAST: kiriman, log, revisi ditolak; pembayaran boleh. | Integrasi |
| AC-65 | Verifikasi BAST → COMPLETED; semua mutasi sesudahnya → 409 PROJECT_LOCKED. | Integrasi |
| AC-66 | Batal pengajuan BAST → EXECUTION; dokumen tersimpan DIBATALKAN. | Integrasi |
| AC-67 | Tahan menyimpan status sebelumnya; lanjutkan mengembalikannya; hanya dari SURVEY s.d. WAITING_BAST; selama ditahan Mulai Tender, release SPK, Mulai Fisik, Ajukan BAST ditolak. | Integrasi |
| AC-68 | Batal proyek hanya SA, alasan wajib, dari non-terminal; riwayat tetap terbaca. | Integrasi |
| AC-69 | Arsip otomatis 1 tahun setelah COMPLETED/CANCELLED; muncul dengan filter arsip; tidak ada data dihapus. | Integrasi |
| AC-70 | Purge hanya untuk ter-soft delete + konfirmasi kode; data & file R2 terhapus; audit & tombstone tetap; kode tidak dipakai ulang. | Integrasi |
| AC-71 | Halaman utama & detail proyek < 3 detik untuk 50 proyek (di luar cold start Neon). | Performa |
| AC-72 | Semua halaman bisa dipakai di 375 px; foto dari kamera HP. | E2E mobile, UAT |
| AC-73 | WCAG AA, keyboard, fokus terlihat, label aksesibel ikon & sel Gantt. | axe + manual |
| AC-74 | Backup harian masuk bucket backup; restore ke branch Neon terpisah berhasil dan tercatat. | Operasional |
| AC-75 | Tanpa fitur khusus Vercel; `next build && next start` jalan di Node.js biasa dengan env yang sama. | Build di luar Vercel |
| AC-76 | Pemakaian compute Neon dicek dan dicatat mingguan; upgrade dipertimbangkan bila > 70%. | Operasional |

## 4. Skenario UAT (F7)

| No | Skenario | Role | AC |
| --- | --- | --- | --- |
| 1 | Tender normal: proyek → survei → AFCE/BOQ → ajukan + email → semua level → Pekerjaan tender → USPK → mulai tender → pemenang baru → release SPK → mulai fisik → log sampai 100% → BAST → verifikasi | SP, SA | 10–24, 34–37, 47, 63, 65 |
| 2 | AFCE ditolak di level 2 → attempt baru (BOQ tersalin) → approved | SP | 21–24 |
| 3 | Tender batal → ulang dengan USPK baru; semua attempt tampil | SP | 35, 53 |
| 4 | SPK batal saat fisik berjalan → jeda & beku → SPK pengganti → mulai ulang; variasi dua SPK aktif, satu batal | SP | 37, 39, 52 |
| 5 | Swakelola dengan Paket Kerja pendukung | SP | 38, 40–43 |
| 6 | Pembelian murni: PR → PO → produksi → kiriman parsial → koreksi → lengkap | SP | 40–43 |
| 7 | Proyek campuran: kiriman memicu EXECUTION, tender lain belum SPK | SP | 42 |
| 8 | Revisi jadwal dua kali; cek warna dan EWS tetap baseline | SP, MV | 45, 50, 54 |
| 9 | AR tambahan Approved menambah anggaran | SP | 25 |
| 10 | Proyek dua Estate beda Wilayah muncul di kedua filter | MV | 11, 13 |
| 11 | Tahan → lanjutkan; batal proyek | SP, SA | 67, 68 |
| 12 | BAST belum lunas → batal pengajuan → ajukan lagi → verifikasi → terkunci | SP, SA | 63–66 |
| 13 | Viewer read-only; SP ditolak di aksi SA; konflik edit bersamaan | MV, SP | 02, 03 |
| 14 | HP: log progres dengan foto kamera; Gantt mobile | SP | 56, 72 |
| 15 | Ekspor 4 laporan Excel & PDF, cocokkan dengan layar | MV | 57, 58 |
| 16 | Restore backup ke branch terpisah | SA | 74 |
