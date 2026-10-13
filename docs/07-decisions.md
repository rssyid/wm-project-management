# 07 — Log Keputusan

Ringkasan semua keputusan planning (10 Oktober 2026). Isinya sudah dituangkan ke dokumen 01–06; file ini untuk menelusuri asal aturan. Keputusan baru ditambahkan di bawah dengan kode baru, tanggal, dan dokumen yang diubah.

## Handover (sesi sebelumnya)

| Kode | Keputusan |
| --- | --- |
| Q1 | Pembelian murni = Pekerjaan `PURCHASE`, ikut bobot proyek, progres 100% dari material. |
| Q2 | SPK entitas terpisah, bisa banyak per attempt; SPK pengganti tanpa USPK baru. |
| Q3 | Jenis Pekerjaan: TENDER_CONTRACT, SWAKELOLA, PURCHASE. |
| Q4 | Baseline per attempt dan per proses, dikunci saat dokumen pemicu dibuat. |
| Q5/R1 | Rencana linear per hari kerja; deviasi = % rencana − % aktual; hijau < 5, kuning 5–10, merah > 10; ambang bisa diubah. |
| Q6 | ON_HOLD dari SURVEY s.d. WAITING_BAST dengan previousStatus; CANCELLED dari non-terminal. |
| Q7/R4 | Fisik 100% sebelum BAST; WAITING_BAST mengunci input lapangan kecuali pembayaran; SA bisa batalkan pengajuan BAST. |
| Q8/R3 | Status paket tanpa IN_DELIVERY; COMPLETED otomatis saat lengkap; PO wajib sebelum kiriman; koreksi negatif. |
| Q9/R6 | Bobot default 70/30; bobot material antar paket sama persis. |
| Q10/R5 | Level approval maks. 9; setelah ditolak kembali RAB_READY dengan attempt baru. (Template global diganti matriks per nominal — lihat D-08 dst.) |
| S2 | Swakelola memakai SPK ke vendor INTERNAL; fisik mulai manual setelah release. |
| S3 | AR tambahan menambah anggaran, paralel, tidak mengubah status. |
| S4 | Pembayaran per Paket Kerja; BELUM_LUNAS/LUNAS. |
| S5 | Gantt mulai Senin. |
| R7 | 403 hanya role, gate 409; purge mempertahankan audit + tombstone; istilah Paket Kerja/Pekerjaan. |

## Sesi planning ini

| Kode | Keputusan |
| --- | --- |
| T1 | Retensi 1 tahun = arsip, tanpa penghapusan otomatis. |
| T2 | Lokasi dari data lama, bisa diedit lewat master. |
| T3 | AR tambahan: matriks approval, nominal/alasan/tanggal, riwayat anggaran, di semua status kecuali COMPLETED/CANCELLED. |
| T4 | Pembayaran: tagihan, tanggal lunas, catatan, diaudit. |
| I1–I3 | Baseline swakelola saat SPK release; pembayaran dua status; AR Approved otomatis menambah anggaran. |
| U-01–U-28 | Lihat dokumen 01 (ops di Region, filter di Estate, kode proyek tetap, status SPK/fisik/BAST, satu attempt aktif, PRODUKSI, koreksi, rata-rata item, bobot saat batal, freeze, aksi saat ON_HOLD, status tidak mundur, W1, log mingguan, Kurva S, soft delete SA, arsip saat query, laporan, multi SPK). |
| U-29–U-33 | Data lokasi dipakai apa adanya; group = Wilayah (level master); Company = unit operasional. |
| Region | Region dicatat lewat Wilayah di Estate (satu PT bisa dua region). |
| AR-01–07 | Better Auth; Neon Free di produksi; reset password oleh SA; Vercel Hobby di produksi; ExcelJS + react-pdf; region Asia; version + hitung saat baca. |
| D-01–D-07 | Satu PR/PO per paket; Senin–Sabtu; vendor lengkap bila semua field terisi; nilai SPK opsional; bobot 2 desimal; log pengganti; trigger immutable. |
| D-08–D-11 | Nominal acuan tier (AFCE: nilai AFCE; AR: nominal tambahan); batas tier bawah inklusif/atas eksklusif, tier dibuat di aplikasi; level bisa diubah saat DRAFT; MCA = Merchant Cash Advance. |
| D-12–D-16 | Satu kategori per proyek; material dibuat cepat; seed master disusun; proyek multi-Estate satu Company; Block opsional per Estate. |
| D-17–D-19 | Anggaran rencana vs resmi (= nilai AFCE); progres fisik diinput persen; data spasial disimpan sebagai file. |
| U-20 | Data dasar (deskripsi, PIC, target, anggaran); survei + spasial; AFCE = total BOQ; BOQ per bangunan/kegiatan + harga; alat berat per log. |
| Approval | Jabatan approver master data; tanggal keputusan per level dari SAP; durasi dihitung; tanggal email approval wajib saat ajukan (AFCE & AR), terpisah dari tanggal pengajuan. |
| A-01–A-06 | Survei terkunci setelah AFCE pertama; lokasi terkunci saat PROCUREMENT; BOQ pindah tier menyalin ulang level; purge setelah soft delete + konfirmasi kode; item paket terkunci setelah kiriman; reset password mencabut session. |
| UI-01–05 | Filter disimpan di browser; pengingat log mingguan; pola garis sel revisi; dashboard 10 deviasi terbesar + Kurva S; prototipe dicoba sebelum UI. |
| S-01–08 | shadcn/ui + Tailwind v4; RHF + Zod; RSC + TanStack Query; TanStack Table + Gantt sendiri; Recharts; date-fns WIB; mode terang, biru tua, Inter; Vitest/Playwright/axe, pnpm. |
| R-01–04 | Proyek pribadi via agen AI (Antigravity, lalu Claude Code), fase berurutan; halaman < 3 detik; cek Neon manual mingguan; UAT oleh pemilik dengan tiga akun. |
| S-09 | Design system konkret di rule 35-design (token warna kanal, tipografi, shell, pola halaman, larangan UI generik); fondasi UI dibuat di F0, bukan direvamp belakangan. |
| Q-01 | Rule 05-quality dan perintah `/slop-check`: aturan anti AI slop untuk kode, test, teks UI, file, dan laporan; wajib bersih sebelum fase ditutup. |
| T-01 | Agen pindah dari Google Antigravity ke Claude Code; proyek dimulai ulang dari nol (11 Oktober 2026). |
| T-02 | Agen pindah dari Claude Code ke Kilo Desktop; rules di `.kilo/rules/` (dimuat lewat `kilo.jsonc`), prosedur fase menjadi slash command di `.kilo/commands/`; isi aturan tidak berubah (13 Oktober 2026). |
