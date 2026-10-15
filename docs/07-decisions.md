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

## F0 Persiapan (13 Oktober 2026)

| Kode | Keputusan |
| --- | --- |
| D-20 | Daftar proyek di 375 px adalah daftar ringkas (nama, kode, status, progres), bukan kartu. `docs/05-ui.md` §5 diubah dari "Mobile: kartu". |
| D-21 | Sebelum Better Auth (F1), peran prototipe disimulasikan lewat pemilih peran di top bar yang menulis cookie `wm_prototype_role`; MV tidak melihat tombol aksi. Semua dihapus bersama data contoh sebelum F2. |
| D-22 | Label UI `ProjectStatus` disetuskan di `src/shared/project-status.ts`: Draf, Survei, RAB siap, Menunggu AFCE/AR, AFCE/AR disetujui, Pengadaan, Pelaksanaan, Menunggu BAST, Selesai, Ditahan, Dibatalkan. |
| D-23 | `--ews-yellow` digelapkan dari `#8A6D0B` menjadi `#7A5F08`. Nilai lama hanya 4,41:1 di atas `#FBF3D5` dan gagal WCAG AA yang juga diminta rule 35. |
| D-24 | `--ews-green` digelapkan dari `#2E7D4F` menjadi `#2B7848` dan diberi latar sendiri `--ews-green-soft: #E8F2EC`. Pasangan lama hanya 4,3:1 dan memakai latar kebiruan (`--canal-soft`), padahal rule 35 §6 meminta latar lembut dari keluarga warna yang sama. |
| D-25 | Format tanggal memakai `Intl.DateTimeFormat` dengan `timeZone: Asia/Jakarta`, bukan `@date-fns/tz`. Konstruktor `TZDate` memanggil `new Date()` dan ditolak `cacheComponents` Next 16 saat prerender. Month date-fns tetap dipakai untuk aritmetika (`addWeeks`). |
| D-26 | `prisma.config.ts` membaca `DIRECT_URL` lewat `process.env` dengan fallback kosong, bukan helper `env()`, agar `prisma generate` jalan di CI tanpa kredensial database. |
| D-27 | Sel revisi Gantt bewarna solid tanpa pola garis, menggantikan UI-03 di `docs/01` §11. Warna tetap membedakan revisi pertama (kuning) dan berikutnya (oranye). Dasar: contoh referensi yang dipakai pemilik proyek. |
| D-28 | Gantt menandai batas kanan minggu berjalan dengan garis vertikal merah penuh setinggi tabel, dan legenda diletakkan di bawah tabel dengan label Bahasa Indonesia: Rencana, Target revisi, Revisi minggu ini, Progres, Selesai. |
| D-29 | Gantt memakai tanggal numerik `dd/mm/yy` (Plan mulai, Plan selesai) dan `dd/mm` (kolom minggu). Tabel di luar Gantt tetap memakai format panjang berbahasa Indonesia seperti `13 Okt 2026`. Dilakukan karena kolom minggu Gantt sempit dan label bulan panjang tidak muat. |
| D-30 | Header Gantt memakai tiga baris: `No.` dan `Job Item` membentang tiga baris, grup `Plan` membentang `Start` + `End`, grup `Timeline` membentang seluruh kolom minggu, dan baris ketiga berisi tanggal `dd/mm`. |
| D-31 | Nomor baris dihitung otomatis dari jenjang, bukan ditulis manual: jenjang 0 `#`, jenjang 1 angka, jenjang 2 huruf yang mengulang dari `a` di setiap anak jenjang 1. Dasar: contoh referensi pemilik proyek. |
| D-32 | Gantt punya switcher jumlah minggu 8 / 16 / 26 / 52 di atas tabel, default 16, selalu mulai dari W1. Garis merah minggu berjalan hanya dirender bila minggu itu masuk rentang aktif, jadi memilih 8 minggu menyembunyikannya. |
| D-33 | `--gantt-rev1` diganti `#F2D16B` → `#FFFF00` dan `--gantt-rev2` diganti `#F0A04B` → `#FFC000`, hanya untuk pewarnaan Gantt. Badge EWS tidak ikut — kuning di badge (`--ews-yellow` di atas `--ews-yellow-soft`) tetap keluarga lama supaya teks lolos AA. Latar header Gantt diganti dari `bg-surface` (`#F5F6F4`) ke `bg-panel` (`#FFFFFF`). Risiko yang tidak ditutup: batas sel Gantt menjadi tipis di atas kuning murni dan kontras non-teks 3:1 tidak diaktifkan di axe. |
| D-35 | Token `--gantt-edge: rgb(255 0 0)` khusus Gantt, dipakai untuk garis penanda minggu berjalan. `--ews-red` global tidak ikut supaya badge EWS tetap lulus AA (4,9:1); `rgb(255 0 0)` di atas `--ews-red-soft` hanya 4,1:1. Baris 1 header (No., Job Item, Plan, Timeline) tidak lagi membawa garis merah — pemecahan th Timeline tidak diperlukan, sehingga `edgeClass` cukup dipakai di baris 2 (W1..Wn), baris 3 (tanggal), dan `<td>` badan. |
| D-36 | Baris pengelompok di Gantt tidak membawa bar baseline. `docs/01` §4 menetapkan hanya Tender attempt, Fisik, dan Paket Kerja yang punya baseline terkunci, sehingga baris `#` dan `1`/`2` tidak boleh menampilkan abu-abu. Baris Proyek tetap menampilkan bar sebagai roll-up rentang anak-anaknya, konsisten dengan Start/End proyek; Start/End pada baris pekerjaan dipertahankan. Berbeda dari contoh referensi yang memakai abu-abu di kedua jenjang. |

## F1 Fondasi (14 Oktober 2026)

| Kode | Keputusan |
| --- | --- |
| D-37 | Master data memakai satu registry (`src/domain/master/registry.ts` + `registry-catalog.ts`) berisi 11 tipe: label, skema Zod, kolom, pencarian, dan pengecekan keterpakuan. Dasar: `docs/04` §2 sudah menetapkan satu path `/api/master/{type}` dan `docs/05` §10 meminta satu pola tabel + panel. |
| D-38 | `src/prototype/role.tsx` dihapus; peran dibaca dari session lewat `getSessionUser()` dan komponen server `MutationsOnly`. Data contoh tetap sampai F2 sesuai `task.md`, tetapi Route group `(prototype)` berganti nama menjadi `(app)`. |
| D-39 | Integration test dan e2e memakai branch Neon `test` yang dipisah dari `dev`. Skrip `pnpm db:test:prepare` menerapkan migration dan seed ke cabang itu; job CI `e2e` memakai `needs: verify` karena keduanya memakai database yang sama. |
| D-40 | User dibuat Super Admin langsung lewat Prisma (User + Account `credential`) dengan `hashPassword` dari `better-auth/crypto`, bukan plugin admin Better Auth. Plugin itu menambah kolom `banned`/`banReason` yang tidak ada di `prisma/schema.prisma`, dan kita sudah punya `isActive` yang dijaga `databaseHooks.session.create`. |
| D-41 | Rate limit Better Auth dinaikkan dari default (3 percobaan sign-in / 10 detik / IP) menjadi 20 per menit untuk `/sign-in/*` dan `/sign-up/*`, 60 per menit untuk endpoint lain. Dasar: seluruh kantor keluar dari satu IP, sehingga batas default mengunci user sah; batas baru tetap menahan brute force. |
| D-42 | `PATCH /api/master/{type}/{id}` mengenali aksi aktif/nonaktif dari body mentah (satu field `isActive`), bukan dari hasil parse Zod. Skema update memberi nilai default untuk field lain (mis. `Vendor.type`), sehingga pengecekan setelah parse akan salah mengenali permintaan. |
| D-43 | Skema update master dibuat lewat `updateSchemaFor(schema)` = `schema.partial().extend({ isActive })`. Tanpa `isActive` di skema, Zod membuang field itu dan permintaan nonaktifkan hanya menaikkan `version` tanpa mengubah status (ditemukan oleh e2e, ditutup dengan test integrasi). |
| D-44 | Tabel master di bawah 768 px diganti daftar ringkas (satu baris per data: nama, keterangan, status, aksi) seperti pola D-20, supaya tidak perlu geser horizontal di ponsel. |
| D-45 | Jumlah worker Playwright dibatasi 4 lokal dan 2 di CI. Dasar: compute Neon kecil sehingga transaksi paralel yang banyak membuat `prisma.$transaction` gagal dengan P2028 ("Unable to start a transaction in the given time"). |
| D-46 | Batas ukuran berkas foto memakai 5 MB untuk `PROGRESS_PHOTO` dan `APPROVAL_EVIDENCE`, 10 MB untuk `BAST`, `DOCUMENT`, dan `SPATIAL_DATA`. Nama `FileKind` mengikuti enum Prisma (`SPATIAL_DATA`, bukan `SPATIAL`), sedangkan `docs/04` §9 hanya menyebut "spasial". |
| D-47 | `trustedOrigins` Better Auth diisi dengan origin produksi dan wildcard `https://*.vercel.app`, karena hostname preview Vercel berbeda setiap PR sehingga satu `BETTER_AUTH_URL` tidak cukup. Deploy pertama ditolak 403 karena kedua origin tidak dipercaya. Pengujian memakai route HTTP `/api/auth/sign-in/email` dengan header `origin` dan `cookie`, karena Better Auth hanya memvalidasi origin bila request membawa cookie (`form-csrf`); pemanggilan `auth.api.signInEmail` langsung melewati pengecekan itu. |
