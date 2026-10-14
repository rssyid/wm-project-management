# 01 — Domain: Glossary, State Machine, Aturan Bisnis

Status: disetujui 10 Oktober 2026. Dokumen ini sumber kebenaran untuk istilah, status dan aturan bisnis. Jika bertentangan dengan dokumen lain, dokumen ini menang; database detail ada di `prisma/schema.prisma`.

Istilah AFCE, AR, RAB, BOQ, USPK, SPK, PR, PO, BAST dipakai apa adanya. Bahasa UI: Indonesia.

## 1. Glossary

| Istilah UI | Entitas | Arti |
| --- | --- | --- |
| Proyek | `Project` | Proyek Water Management di satu atau beberapa Estate milik satu Company, dengan satu kategori dan kode `WM-{Company.code}-{YYYY}-{SEQ4}`. |
| Pekerjaan | `WorkItem` | Pekerjaan utama dalam proyek. Jenis: `TENDER_CONTRACT`, `SWAKELOLA`, `PURCHASE`. Bobot semua Pekerjaan aktif = 100%. |
| Paket Kerja | `WorkPackage` | Pembelian material lewat PR → PO → (produksi) → kiriman berulang. Mendukung tepat satu Pekerjaan. |
| Survei | `Survey` | Tanggal, surveyor, kondisi eksisting, rekomendasi, koordinat opsional, foto, dokumen, data spasial (SHP .zip / GeoJSON). |
| AFCE | `AfceAttempt` | Pengajuan anggaran proyek. Setiap pengajuan = satu attempt; attempt ditolak tetap tersimpan. |
| BOQ | `BoqItem` | Baris per bangunan atau kegiatan/paket kerja dengan harga total. Nilai AFCE = total BOQ. |
| AR tambahan | `ArSupplement` | Dokumen penambah anggaran, paralel, tidak mengubah status proyek. |
| Jabatan approver | `ApprovalPosition` | Master: EM, GEM, RH, HP, MCA (Merchant Cash Advance), CFO, COO, CEO, Chairman. |
| Matriks approval | `ApprovalMatrixTier` | Tier per rentang nominal berisi urutan jabatan (maks. 9 level). Contoh: < Rp500 juta → EM, GEM, RH. |
| Level approval | `ApprovalLevelSnapshot` | Salinan tier ke dokumen (AFCE/AR) saat dibuat; bisa diubah selama `DRAFT`. |
| Catatan approval | `ApprovalRecord` | Keputusan satu level dari SAP, dicatat user. Approver tidak login. |
| Anggaran rencana | `Project.plannedBudget` | Diinput saat membuat proyek; bisa diubah sampai AFCE diajukan. |
| Anggaran resmi | `BudgetEntry` | INITIAL = nilai AFCE Approved; + setiap AR tambahan Approved. Tidak pernah ditimpa. |
| USPK | `Uspk` | Dokumen sebelum tender; setiap tender attempt butuh USPK baru. |
| Tender attempt | `TenderAttempt` | Satu putaran tender. Attempt batal tetap tampil. |
| SPK | `Spk` | Penunjukan pelaksana. Bisa banyak per attempt (termasuk pengganti) dan boleh lebih dari satu aktif. Swakelola: SPK langsung ke Pekerjaan, vendor `INTERNAL`. |
| SPK - Batal | `PhysicalStatus.JEDA_SPK_BATAL` | Jeda fisik karena SPK aktif terakhir dibatalkan saat fisik berjalan. |
| Proses fisik | `PhysicalProcess` | Pelaksanaan fisik Pekerjaan `TENDER_CONTRACT`/`SWAKELOLA`. |
| Log progres | `ProgressLog` | Satu log aktif per Pekerjaan per minggu (Senin): persen kumulatif, volume opsional, foto, alat berat. |
| PR / PO | `PurchaseRequest` / `PurchaseOrder` | Satu PR dan satu PO per Paket Kerja. |
| Produksi | `WorkPackageStatus.PRODUKSI` | Vendor memproduksi/menyiapkan barang. Opsional. |
| Kiriman / koreksi | `PackageDelivery` | Penerimaan barang; koreksi = qty negatif dengan alasan. |
| Pembayaran | field `WorkPackage` | `BELUM_LUNAS`/`LUNAS`, nilai tagihan, tanggal lunas, catatan. Tidak menghalangi BAST. |
| Baseline / Revisi | `ScheduleBaseline` / `ScheduleRevision` | Plan pertama yang dikunci; perubahan sesudahnya lewat revisi beralasan. |
| EWS | hasil hitung | Deviasi = % rencana baseline − % aktual. Hijau < 5, kuning 5–10, merah > 10 (ambang bisa diubah). |
| BAST | `BastDocument` | Nomor, tanggal, lampiran. Diverifikasi Super Admin. |
| Arsip | hasil hitung | 1 tahun setelah `COMPLETED`/`CANCELLED`: disembunyikan dari daftar aktif, read-only, tidak dihapus. |
| Soft delete / Purge | `deletedAt` / operasi | Hapus administratif (bisa restore) / hapus permanen dengan tombstone. Super Admin saja. |
| ops, Region, Wilayah, Company, Estate, Block | master lokasi | Lihat §3. |

## 2. Role

| Aksi | SUPER_ADMIN | WM_HO_SPECIALIST | MANAGEMENT_VIEWER |
| --- | --- | --- | --- |
| Baca semua data, Gantt, dashboard, laporan, ekspor, audit log | Ya | Ya | Ya |
| Buat/ubah proyek, survei, AFCE/BOQ, Pekerjaan, tender, SPK, Paket Kerja, jadwal, log, kiriman, pembayaran | Ya | Ya | Tidak |
| Catat keputusan approval dari SAP; ubah level dokumen saat DRAFT | Ya | Ya | Tidak |
| Master data (lokasi, vendor, satuan, kategori, material, alat berat, jabatan approver) | Ya | Ya | Tidak |
| Ajukan BAST, tahan/lanjutkan proyek | Ya | Ya | Tidak |
| Verifikasi/batalkan pengajuan BAST, batal proyek | Ya | Tidak | Tidak |
| Matriks approval, user, hari kerja/libur, ambang EWS, soft delete, restore, purge | Ya | Tidak | Tidak |

Akses data global; `companyId` disimpan untuk pembatasan per company di masa depan.

## 3. Lokasi

- Hierarki: ops → Region → Wilayah → Estate → Block; Company memiliki Estate. Region/ops Estate diturunkan dari Wilayah.
- Satu Company bisa punya Estate di beberapa Region (THIP). Company = unit operasional.
- Proyek ↔ Estate N:N lewat `ProjectEstate`: minimal satu Estate, tepat satu utama, semua milik Company proyek; Block opsional satu per Estate.
- Pemilihan berantai: Region → Company → satu/lebih Estate → Block opsional. Wilayah tampil otomatis.
- Proyek lintas Wilayah/Region muncul di setiap filter yang relevan (filter di level Estate).
- Master tidak dihapus permanen setelah dipakai; nonaktif lewat `isActive`. Data awal dari `prisma/seed-data/lokasi.json` (8 Region, 18 Wilayah, 27 Company, 63 Estate); `Estate.code` dipakai apa adanya, `legacyCode` dan nama Estate boleh kembar.
- Kode proyek: urutan per Company per tahun pembuatan, atomik, tidak pernah dipakai ulang, tidak berubah walau kode Company berubah, tidak pernah diurai dengan memecah tanda hubung.

## 4. Jenis Pekerjaan dan baseline

| Jenis | Jalur | Baris Gantt | Paket Kerja |
| --- | --- | --- | --- |
| `TENDER_CONTRACT` | USPK → tender attempt → pemenang → SPK → fisik | Semua tender attempt + fisik | Opsional (material pendukung) |
| `SWAKELOLA` | SPK ke vendor `INTERNAL` → fisik | Fisik | Opsional |
| `PURCHASE` | PR → PO → produksi → kiriman | Tanpa fisik | Wajib ≥ 1; progres 100% dari material |

Baris pengelompok (Proyek, Pekerjaan) tidak punya baseline sendiri sehingga tidak membawa bar abu-abu. Bar pada baris Proyek adalah roll-up rentang anak-anaknya, sama seperti Start/End proyek; bukan baseline proses (D-36).

| Proses | Baseline dikunci saat | Actual start | Actual end |
| --- | --- | --- | --- |
| Tender attempt | USPK attempt dibuat | Mulai Tender | SPK release pertama pada attempt |
| Fisik tender | USPK dibuat (plan fisik per attempt; EWS pakai baseline attempt yang menghasilkan SPK) | Mulai Pekerjaan Fisik | Progres 100% |
| Fisik swakelola | SPK release pertama (SPK pengganti tidak mengubah) | Mulai Pekerjaan Fisik | Progres 100% |
| Paket Kerja | PR terbit | PR terbit | Paket `COMPLETED` |

Sebelum dikunci plan bebas diubah; sesudahnya hanya revisi dengan alasan.

## 5. State machine Project

Status: `DRAFT, SURVEY, RAB_READY, WAITING_AFCE_AR, AFCE_AR_APPROVED, PROCUREMENT, EXECUTION, WAITING_BAST, COMPLETED, ON_HOLD, CANCELLED`. Hanya transition service yang mengubah status; setiap perubahan dicatat di `ProjectStatusHistory`. Status tidak pernah mundur otomatis (semua PR/USPK batal → tetap `PROCUREMENT`; SPK batal saat fisik berjalan → tetap `EXECUTION`).

| Dari | Ke | Pemicu | Pelaku | Gate (gagal = 409) |
| --- | --- | --- | --- | --- |
| DRAFT | SURVEY | Mulai Survei | SA, SP | Lokasi, kategori, PIC, target mulai/selesai, anggaran rencana lengkap |
| SURVEY | RAB_READY | AFCE ditandai `rabReady=true` | Otomatis | — |
| RAB_READY | WAITING_AFCE_AR | Ajukan AFCE | SA, SP | Tanggal pengajuan + tanggal email approval; BOQ ≥ 1 baris; ada tier cocok; nilai & level dikunci |
| WAITING_AFCE_AR | AFCE_AR_APPROVED | Level terakhir Approved | Otomatis | Level N hanya setelah N-1 Approved; anggaran resmi INITIAL dibuat |
| WAITING_AFCE_AR | RAB_READY | Satu level Ditolak | Otomatis | Attempt `DITOLAK` immutable; attempt baru menyalin BOQ |
| AFCE_AR_APPROVED | PROCUREMENT | USPK pertama, PR pertama, atau SPK swakelola pertama dibuat | SA, SP | AFCE Approved |
| PROCUREMENT | EXECUTION | Mulai Pekerjaan Fisik (tender/swakelola) | SA, SP | Minimal satu SPK `RELEASED` aktif pada Pekerjaan itu |
| PROCUREMENT | EXECUTION | Kiriman pertama di proyek (termasuk parsial) | Otomatis | PO ada; terpicu tepat sekali |
| EXECUTION | WAITING_BAST | Ajukan BAST | SA, SP | Fisik 100% di semua Pekerjaan TENDER/SWAKELOLA aktif; pembayaran & material tidak disyaratkan |
| WAITING_BAST | EXECUTION | Batalkan pengajuan BAST + alasan | SA | BAST → `DIBATALKAN`, tetap tersimpan |
| WAITING_BAST | COMPLETED | Verifikasi BAST | SA | Setelah ini semua mutasi ditolak 409 |
| SURVEY…WAITING_BAST | ON_HOLD | Tahan + alasan | SA, SP | Simpan `previousStatus` |
| ON_HOLD | previousStatus | Lanjutkan | SA, SP | — |
| Non-terminal (termasuk DRAFT, ON_HOLD) | CANCELLED | Batalkan proyek + alasan | SA | Riwayat tetap read-only |

Proyek campuran bisa `EXECUTION` karena kiriman sementara tender Pekerjaan lain belum SPK.

Selama `ON_HOLD`: boleh revisi jadwal, kiriman, koreksi, pembayaran, AR tambahan, log progres untuk minggu sebelum ditahan. Ditolak: Mulai Tender, release SPK, Mulai Pekerjaan Fisik, Ajukan BAST. EWS proyek dibekukan.

Selama `WAITING_BAST`: kiriman, koreksi, log progres, revisi jadwal ditolak (409 `FIELD_INPUT_LOCKED`); pembayaran tetap boleh.

## 6. AFCE, approval, AR tambahan

- Approval diputuskan di SAP; aplikasi mencatat hasilnya. Label UI: "keputusan di SAP, dicatat oleh user".
- Status dokumen AFCE/AR: `DRAFT → DIAJUKAN → APPROVED | DITOLAK`. Satu AFCE `DRAFT`/`DIAJUKAN` per proyek.
- AFCE dibuat saat `SURVEY`/`RAB_READY`. Nilai AFCE = total BOQ; dihitung ulang selama DRAFT, dikunci saat diajukan.
- Level disalin dari tier yang cocok dengan nilai (AFCE: nilai AFCE; AR: nominal tambahan). Batas tier: bawah inklusif, atas eksklusif. Tidak ada tier cocok → pengajuan ditolak 409.
- Level boleh diubah (tambah, hapus, geser) selama DRAFT; diaudit; UI menandai "berbeda dari matriks". Jika perubahan BOQ memindahkan nilai ke tier lain, level disalin ulang (peringatan dulu).
- Ajukan: wajib tanggal pengajuan dan tanggal email approval (boleh berbeda; tanpa aturan urutan).
- Catat keputusan per level: hasil, nama approver, tanggal keputusan sesuai SAP, catatan, bukti opsional. Tanggal tidak di masa depan, tidak lebih awal dari keputusan level sebelumnya; level 1 tidak lebih awal dari tanggal email.
- Durasi per level (hari kalender, dihitung saat dibaca): level 1 dari tanggal email; level berikutnya dari keputusan level sebelumnya.
- Ditolak → dokumen `DITOLAK`; AFCE: proyek → `RAB_READY`, attempt baru (level boleh diubah lagi). AR ditolak: buat dokumen baru.
- AR tambahan: nominal, alasan, tanggal; boleh di semua status kecuali `COMPLETED`/`CANCELLED`; Approved → `BudgetEntry AR_SUPPLEMENT`.
- Tier matriks dikelola Super Admin; rentang aktif per jenis dokumen tidak tumpang tindih/berlubang; perubahan tier tidak mengubah snapshot yang sudah ada.

## 7. Tender, SPK, swakelola

- Tender attempt: `PLANNED → IN_PROGRESS → COMPLETED`, atau `CANCELLED`. Satu attempt aktif per Pekerjaan; attempt `COMPLETED` tidak bisa dibatalkan (batalkan SPK-nya).
- Attempt dibuat dengan USPK baru (nomor, tanggal) + plan tender + plan fisik. Mulai Tender → actual start.
- Pemenang: vendor dipilih atau dibuat dari nama saja (`isComplete=false`); nama disimpan sebagai snapshot.
- SPK: `DRAFT → RELEASED`, atau `BATAL`. SPK release pertama → attempt `COMPLETED`, actualEnd = tanggal release. Boleh lebih dari satu SPK `RELEASED` aktif per Pekerjaan; SPK pengganti tanpa USPK baru dan tidak mengubah baseline.
- Batal SPK wajib tanggal + alasan. Jika fisik `BERJALAN` dan tidak ada SPK aktif lain → fisik `JEDA_SPK_BATAL`, `PhysicalPause` dibuka, EWS fisik dibekukan; mulai ulang manual setelah SPK pengganti release.
- Swakelola: SPK langsung ke Pekerjaan, vendor `INTERNAL`; SPK swakelola pertama memicu `PROCUREMENT`; release pertama mengunci baseline fisik.
- Proses fisik: `BELUM_MULAI → BERJALAN ⇄ JEDA_SPK_BATAL → SELESAI` (otomatis saat log 100%).

## 8. Log progres mingguan

- Progres fisik hanya dari log mingguan per Pekerjaan (Senin–Minggu): persen kumulatif diinput langsung; realisasi volume opsional (informasi).
- Satu log aktif per minggu; salah input → log pengganti (log lama tetap, ditandai digantikan).
- Persen turun wajib alasan. Backdate ke minggu tanpa log diizinkan, diaudit.
- Alat berat per log: jenis, jumlah unit, jam kerja, vendor opsional (informasi saja). Foto maks. 5 MB setelah kompres.

## 9. Paket Kerja

| Status | Masuk saat | Gantt |
| --- | --- | --- |
| DRAFT | Paket dibuat (setelah AFCE Approved) | plan |
| PR_SUBMITTED | PR terbit; baseline dikunci; PR pertama di proyek → `PROCUREMENT` | # |
| PO_ISSUED | PO dicatat (wajib sebelum kiriman) | # |
| PRODUKSI | Tanggal mulai produksi (opsional) | # |
| PARTIALLY_DELIVERED | Kiriman pertama; kiriman pertama di proyek → `EXECUTION` | # |
| DELIVERED → COMPLETED | Semua item terpenuhi, dalam transaksi yang sama | ✓ |
| CANCELLED | Batal + alasan, hanya sebelum kiriman pertama | plan tetap tampil |

- Item (material, satuan, qty rencana) hanya bisa diubah sebelum kiriman pertama.
- Koreksi: qty negatif + alasan, hanya SA/SP, ditolak saat `WAITING_BAST`; total per item ≥ 0; jika di bawah rencana, `COMPLETED` kembali ke `PARTIALLY_DELIVERED`.
- Pembayaran per paket; bisa diubah sampai proyek `COMPLETED`; diaudit.

## 10. Bobot dan progres

- Bobot Pekerjaan aktif per proyek tepat 100,00 (dua desimal; pembagian otomatis memberi sisa ke baris terakhir).
- TENDER/SWAKELOLA tanpa paket: fisik 100/material 0. Paket pertama → default 70/30 (bisa diubah, jumlah 100). PURCHASE: 0/100.
- Bobot paket aktif per Pekerjaan tepat = bobot material Pekerjaan; paket pertama mengambil seluruh alokasi; paket baru mewajibkan pembagian ulang.
- Membatalkan Pekerjaan/paket wajib pembagian bobot baru dalam transaksi yang sama.
- Progres paket = rata-rata (per item) dari min(diterima/rencana, 1) × 100.
- Progres Pekerjaan = fisik × wFisik/100 + Σ paket_p × w_p/100. Progres proyek = Σ Pekerjaan_i × w_i/100.
- Contoh uji: A (60%, fisik 70% @50%, paket 20% @100%, paket 10% @40%) = 59,0; B (40%, PURCHASE @75%) = 75,0; proyek = 65,4%.

## 11. Jadwal, EWS, Gantt

- % rencana(t) = hari kerja dari baseline start s.d. t ÷ total hari kerja baseline × 100 (0–100). Hari kerja: `SystemSetting.workingWeekdays` (default Senin–Sabtu) dikurangi `Holiday`.
- EWS selalu terhadap baseline awal, bukan revisi; per proses, Pekerjaan (berbobot), proyek (berbobot).
- Freeze: selama `ON_HOLD` (seluruh proyek) dan `JEDA_SPK_BATAL` (fisik terkait), hari kerja tidak dihitung — rencana linear digeser sejumlah hari freeze.
- Kurva S: rencana = kumulatif berbobot rencana linear baseline per minggu; aktual = progres berbobot per akhir minggu.
- Gantt matriks mingguan (satu-satunya visualisasi jadwal), hierarki Proyek → Pekerjaan → tender attempt / fisik / Paket Kerja. W1 = Senin minggu tanggal paling awal dari baseline, revisi, actual semua proses.
- Warna: baseline abu-abu (tidak dihapus, bagian yang dilepas tetap abu-abu); tambahan revisi pertama kuning; tambahan revisi berikutnya oranye; tambahan lama tetap kuning; sel revisi bewarna solid tanpa pola garis (D-27). Simbol `#` berjalan, `✓` selesai; simbol tidak mengganti warna. Tender `#` sejak Mulai Tender, USPK milestone; paket `#` PR → COMPLETED lalu `✓`; fisik `✓` saat 100%.
- Penanda waktu: garis vertikal merah penuh setinggi tabel pada batas kanan minggu berjalan (minggu dengan tanggal hari ini). Dihitung saat render di sisi klien, bukan konstanta, supaya tetap benar saat tanggal berganti.

## 12. BAST, tahan, batal, arsip, hapus

- BAST: `DIAJUKAN → TERVERIFIKASI | DIBATALKAN`; satu `DIAJUKAN` per proyek; pengajuan berikutnya = dokumen baru.
- Batal proyek, batal attempt, batal SPK, batal paket, batal Pekerjaan, batal pengajuan BAST = aksi berbeda dengan dialog dan alasan sendiri.
- Arsip dihitung saat query (tanpa job). Soft delete (SA, alasan) → 404, bisa restore. Purge (SA) hanya untuk proyek ter-soft delete dengan konfirmasi kode proyek: tombstone dibuat, data dan file R2 dihapus, `AuditLog` tetap, kode tidak dipakai ulang.

## 13. Di luar lingkup

Approver login di aplikasi; integrasi SAP/ERP; notifikasi email; aplikasi native; mode offline; pembatasan akses per company; tampilan peta data spasial; mode gelap.
