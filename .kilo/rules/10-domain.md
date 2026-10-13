# Rule 10 — Invarian domain (selalu aktif)

Ringkasan aturan yang paling sering dilanggar. Detail lengkap: `docs/01-domain.md`

## Status proyek

- Hanya modul `src/domain/project-transition` yang mengubah `Project.status`, dan setiap perubahan menulis `ProjectStatusHistory`.
- Transisi sah dan gate ada di tabel §5 dokumen domain. Transisi lain → 409 `INVALID_TRANSITION`. Status tidak pernah mundur otomatis.
- Transisi otomatis: rabReady → RAB_READY; level terakhir Approved → AFCE_AR_APPROVED (+ BudgetEntry INITIAL); ditolak → RAB_READY; USPK/PR/SPK swakelola pertama → PROCUREMENT; kiriman pertama → EXECUTION (tepat sekali, update bersyarat).
- Mulai Pekerjaan Fisik (manual) → EXECUTION bila proyek masih PROCUREMENT.
- ON_HOLD: tolak Mulai Tender, release SPK, Mulai Fisik, Ajukan BAST. WAITING_BAST: tolak kiriman, koreksi, log, revisi (pembayaran tetap boleh). COMPLETED/CANCELLED/arsip/soft delete: tolak semua mutasi (`PROJECT_LOCKED`).

## Approval

- Keputusan dari SAP, dicatat SA/SP. Tidak ada akun atau endpoint approver.
- Level disalin dari tier matriks yang cocok (bawah inklusif, atas eksklusif). AFCE memakai nilai AFCE (= total BOQ); AR memakai nominal tambahan.
- Level hanya bisa diubah saat DRAFT. Level N butuh N-1 Approved. Tanggal keputusan: tidak di masa depan, tidak lebih awal dari level sebelumnya; level 1 tidak lebih awal dari tanggal email approval.
- Ajukan AFCE/AR wajib tanggal pengajuan dan tanggal email approval (disimpan terpisah).

## Bobot dan progres

- Bobot Pekerjaan aktif per proyek tepat 100,00; bobot paket aktif per Pekerjaan tepat = bobot material Pekerjaan. Fisik + material = 100. PURCHASE 0/100.
- Progres paket = rata-rata per item dari min(diterima/rencana, 1). Progres Pekerjaan dan proyek berbobot. Contoh uji wajib: 65,4%.
- Semua angka progres/EWS dari satu service `src/domain/progress-ews`. Tidak ada perhitungan ulang di UI, laporan, atau ekspor.
- EWS terhadap baseline awal (bukan revisi), rencana linear per hari kerja (Senin–Sabtu default, minus libur), freeze saat ON_HOLD dan JEDA_SPK_BATAL.

## Jadwal

- Baseline dikunci oleh: USPK (attempt + fisik attempt itu), SPK swakelola release pertama, PR (paket). Sebelum dikunci boleh diubah; sesudahnya hanya `ScheduleRevision` dengan alasan.

## Tender, SPK, Paket Kerja

- Satu tender attempt aktif per Pekerjaan; attempt baru wajib USPK baru; attempt COMPLETED tidak bisa dibatalkan.
- Boleh lebih dari satu SPK RELEASED aktif. Fisik masuk JEDA_SPK_BATAL hanya bila tidak ada SPK aktif lain.
- PO wajib sebelum kiriman. COMPLETED paket otomatis saat semua item terpenuhi. Koreksi negatif wajib alasan; total per item ≥ 0.

## Lokasi

- Proyek punya ≥ 1 Estate (tepat satu utama), semua milik Company proyek; Block opsional per Estate.
- Kode proyek `WM-{Company.code}-{YYYY}-{SEQ4}` dari counter yang dikunci `FOR UPDATE`. Jangan pernah mengurai kode dengan memecah tanda hubung.
