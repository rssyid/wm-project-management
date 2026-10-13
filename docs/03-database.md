# 03 — Database

Status: disetujui 10 Oktober 2026. Struktur lengkap ada di `prisma/schema.prisma` (sumber kebenaran). Dokumen ini menjelaskan kelompok tabel, aturan yang dijaga database vs service, dan data awal.

## 1. Konvensi

| Hal | Aturan |
| --- | --- |
| Primary key | `id` cuid (Better Auth: id string dari library) |
| Uang / kuantitas / persen | `Decimal(18,2)` / `Decimal(18,3)` / `Decimal(5,2)`; dikirim API sebagai string desimal |
| Tanggal bisnis | `@db.Date`; timestamp UTC |
| Edit bersamaan | kolom `version` (naik setiap update) |
| Riwayat | tabel immutable hanya INSERT (trigger di `constraints.sql`) |
| Relasi | FK `Restrict`; tidak ada cascade delete kecuali `Session/Account → User` dan `ApprovalMatrixTierLevel → Tier` |
| Hapus master | hanya bila belum dipakai; selain itu `isActive=false` |

## 2. Kelompok tabel

| Kelompok | Tabel |
| --- | --- |
| Auth | `User` (+ role, isActive, mustChangePassword), `Session`, `Account`, `Verification` |
| Lokasi | `Region` → `Wilayah` → `Estate` ← `Company`; `Estate` → `Block` |
| Master lain | `Vendor`, `Unit`, `ProjectCategory`, `Material`, `HeavyEquipmentType`, `Holiday`, `SystemSetting` |
| Matriks approval | `ApprovalPosition`, `ApprovalMatrixTier`, `ApprovalMatrixTierLevel` |
| Proyek | `Project`, `ProjectEstate`, `ProjectCodeCounter`, `ProjectStatusHistory`, `BudgetEntry`, `Survey` |
| AFCE/AR | `AfceAttempt`, `BoqItem`, `ArSupplement`, `ApprovalLevelSnapshot`, `ApprovalRecord` |
| Pekerjaan | `WorkItem`, `Uspk`, `TenderAttempt`, `Spk`, `PhysicalProcess`, `PhysicalPause`, `ProgressLog`, `HeavyEquipmentUsage` |
| Paket Kerja | `WorkPackage`, `PurchaseRequest`, `PurchaseOrder`, `WorkPackageItem`, `PackageDelivery`, `PackageDeliveryItem` |
| Jadwal & BAST | `ScheduleBaseline`, `ScheduleRevision`, `BastDocument` |
| Sistem | `FileObject`, `AuditLog` (tanpa FK ke Project), `ProjectTombstone` |

Relasi kunci:

- `Project` 1–N `ProjectEstate` N–1 `Estate`; `ProjectEstate.blockId` opsional.
- `Project` 1–N `AfceAttempt` 1–N `BoqItem` dan 1–N `ApprovalLevelSnapshot` 1–1 `ApprovalRecord`.
- `Project` 1–N `ArSupplement` 1–1 `BudgetEntry` (AR_SUPPLEMENT).
- `Project` 1–N `WorkItem`; `WorkItem` 1–N `TenderAttempt` (1–1 `Uspk`, 1–N `Spk`), 1–N `Spk`, 1–1 `PhysicalProcess` (1–N `ProgressLog` 1–N `HeavyEquipmentUsage`, 1–N `PhysicalPause`), 1–N `WorkPackage`.
- `WorkPackage` 1–1 `PurchaseRequest`, 1–1 `PurchaseOrder`, 1–N `WorkPackageItem`, 1–N `PackageDelivery` 1–N `PackageDeliveryItem`.
- `ScheduleBaseline` dimiliki tepat satu dari: `TenderAttempt` (1–1), `PhysicalProcess` (per attempt sumber), `WorkPackage` (1–1); 1–N `ScheduleRevision`.

## 3. Dijaga database (`prisma/sql/constraints.sql`)

- CHECK: rentang bobot 0–100, fisik + material = 100, PURCHASE 0/100; `plannedQty > 0`; qty kiriman ≠ 0; alasan koreksi wajib; persen log 0–100; tanggal akhir ≥ awal (baseline, revisi, target proyek); `previousStatus` terisi iff `ON_HOLD`; tepat satu pemilik snapshot level dan baseline; level 1–9; urutan nominal tier; tipe `BudgetEntry` sesuai link AR.
- Partial unique: satu tender attempt aktif per Pekerjaan; satu AFCE DRAFT/DIAJUKAN per proyek; satu BAST DIAJUKAN per proyek; satu log progres aktif per minggu; satu baseline fisik swakelola; satu Estate utama per proyek; satu anggaran INITIAL per proyek.
- Trigger immutable: `ProjectStatusHistory`, `BudgetEntry`, `ApprovalRecord`, `ScheduleRevision`, `PackageDelivery`, `PackageDeliveryItem` (UPDATE/DELETE ditolak; DELETE diizinkan saat purge); `AuditLog`, `ProjectTombstone` (tidak pernah); `ProgressLog` (hanya `supersededById` sekali); `PhysicalPause` (hanya `endDate` sekali); `ScheduleBaseline` (terkunci setelah `lockedAt`).

## 4. Dijaga domain service (diuji otomatis)

- Total bobot Pekerjaan aktif = 100,00; total bobot paket aktif = bobot material Pekerjaan; pembagian ulang saat pembatalan.
- Semua Estate proyek milik Company proyek; minimal satu Estate; Block milik Estate barisnya.
- SPK swakelola hanya ke vendor `INTERNAL`; SPK tender wajib attempt.
- Total diterima per item paket ≥ 0.
- Rentang tier aktif tidak tumpang tindih/berlubang per jenis dokumen.
- Kunci proyek: tolak mutasi saat `COMPLETED`, `CANCELLED`, terarsip, ter-soft delete; input lapangan saat `WAITING_BAST`; aksi tertentu saat `ON_HOLD`.
- Integritas pemilik `FileObject` (ownerType/ownerId).

## 5. Data awal (seed)

- `prisma/seed-data/lokasi.json`: 8 Region, 18 Wilayah, 27 Company, 63 Estate. Urutan muat: Region → Wilayah → Company → Estate. Idempoten (kunci natural). Block kosong.
- `prisma/seed-data/master.json`: 16 satuan, 6 kategori proyek, 13 material (`isComplete=false`), 7 jenis alat berat, 9 jabatan approver, `SystemSetting` (Senin–Sabtu, EWS 5/10). Tier matriks approval dan hari libur kosong (diisi lewat aplikasi).
- Super Admin pertama dari env `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, `mustChangePassword=true`.
- Prisma 7 tidak menjalankan seed otomatis setelah migrate; jalankan `pnpm prisma db seed` (perintah seed didefinisikan di `prisma.config.ts`).
- Setiap impor/seed menulis `AuditLog` aksi `IMPORT`.

## 6. Cara menerapkan

1. `pnpm prisma migrate dev --name init` (dari `schema.prisma`).
2. `pnpm prisma migrate dev --create-only --name constraints`, salin `prisma/sql/constraints.sql` ke migration tersebut, lalu `pnpm prisma migrate dev`.
3. Bandingkan model Better Auth dengan `npx auth@latest generate`; sesuaikan bila ada field yang kurang, tanpa menghapus field tambahan.
4. `pnpm prisma db seed`.
