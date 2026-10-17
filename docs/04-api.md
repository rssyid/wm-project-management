# 04 — API

Status: disetujui 10 Oktober 2026. REST JSON di `/api`, dipakai UI sendiri dan test. Role: SA = Super Admin, SP = Specialist, MV = Viewer, Semua = ketiganya.

## 1. Konvensi

- Handler: autentikasi → `assertCan` → Zod → domain service (transaksi + audit) → response.
- Sukses: `{ "data": …, "meta"?: { "page", "pageSize", "total" } }`. Error: `{ "error": { "code", "message", "fields"? } }` (pesan Indonesia).
- Paginasi `?page=1&pageSize=25` (maks. 100). Tanggal bisnis `YYYY-MM-DD`; timestamp ISO UTC. Uang/qty sebagai string desimal.
- Mutasi entitas ber-`version` wajib kirim `version`.
- Semua mutasi di bawah proyek ditolak `PROJECT_LOCKED` bila proyek `COMPLETED`, `CANCELLED`, terarsip, ter-soft delete.
- Saat `ON_HOLD`: Mulai Tender, release SPK, Mulai Pekerjaan Fisik, Ajukan BAST ditolak `INVALID_TRANSITION`; revisi, kiriman, koreksi, pembayaran, AR tambahan, log minggu sebelum ditahan diterima.
- Saat `WAITING_BAST`: kiriman, koreksi, log, revisi ditolak `FIELD_INPUT_LOCKED`.
- Respons mutasi yang memicu transisi memuat `projectStatus` terbaru.

| HTTP | Kode | Arti |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Input tidak lolos Zod |
| 401 | UNAUTHENTICATED | Belum login |
| 403 | FORBIDDEN_ROLE | Role tidak berhak (hanya untuk role) |
| 404 | NOT_FOUND | Tidak ada / ter-soft delete |
| 409 | INVALID_TRANSITION | Aksi tidak sah untuk status |
| 409 | PRECONDITION_FAILED | Prasyarat belum terpenuhi (pesan menyebutnya) |
| 409 | PROJECT_LOCKED, FIELD_INPUT_LOCKED | Proyek/input terkunci |
| 409 | WEIGHT_MISMATCH | Total bobot tidak tepat |
| 409 | TYPE_LOCKED | Tipe entitas terkunci setelah dibuat (tipe Pekerjaan, AC-33) |
| 409 | DUPLICATE, ACTIVE_CONFLICT | Melanggar unik / sudah ada yang aktif |
| 409 | VERSION_CONFLICT | Data diubah orang lain |
| 409 | IN_USE | Master sudah dipakai |
| 413 | FILE_TOO_LARGE | Melebihi batas ukuran |
| 500 | INTERNAL_ERROR | Error tak terduga |

## 2. Master dan matriks approval

`{type}` = `regions`, `wilayah`, `companies`, `estates`, `blocks`, `vendors`, `units`, `project-categories`, `materials`, `heavy-equipment-types`, `approval-positions`.

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| GET | `/api/master/{type}?active=&q=&regionId=&companyId=&wilayahId=&estateId=` | Semua | Pilihan berantai |
| POST | `/api/master/{type}` | SA, SP | DUPLICATE bila kode ada |
| PATCH | `/api/master/{type}/{id}` | SA, SP | Termasuk `isActive` |
| DELETE | `/api/master/{type}/{id}` | SA, SP | Hanya bila belum dipakai, selain itu IN_USE |
| POST | `/api/master/vendors/quick` | SA, SP | Dari nama saja, `isComplete=false` |
| POST | `/api/master/materials/quick` | SA, SP | Dari nama + satuan, `isComplete=false` |
| GET | `/api/approval-tiers` | Semua | Tier + level |
| POST | `/api/approval-tiers` | SA | Nama, berlaku AFCE/AR, min, max?, jabatan berurutan (≤ 9, unik); tidak tumpang tindih |
| PATCH | `/api/approval-tiers/{id}` | SA | Tidak mengubah snapshot yang sudah ada |
| GET | `/api/approval-tiers/match?doc=AFCE\|AR&amount=` | Semua | 409 bila tidak ada yang cocok |

## 3. Proyek, lokasi, transisi, survei

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| GET | `/api/projects?status=&companyIds=&regionIds=&wilayahIds=&ops=&categoryId=&ews=&q=&archived=` | Semua | Arsip disembunyikan kecuali `archived=true` |
| POST | `/api/projects` | SA, SP | Nama, Company, kategori, Estate[] (satu utama, Block?), deskripsi, PIC, target, anggaran rencana; kode otomatis; status DRAFT |
| GET | `/api/projects/{id}` | Semua | Termasuk lokasi turunan, anggaran, progres/EWS ringkas |
| PATCH | `/api/projects/{id}` | SA, SP | Anggaran rencana hanya sebelum AFCE diajukan |
| PUT | `/api/projects/{id}/estates` | SA, SP | Hanya sebelum PROCUREMENT |
| POST | `/api/projects/{id}/start-survey` | SA, SP | DRAFT → SURVEY, data dasar lengkap |
| POST | `/api/projects/{id}/hold` | SA, SP | Alasan; dari SURVEY s.d. WAITING_BAST |
| POST | `/api/projects/{id}/resume` | SA, SP | Ke previousStatus |
| POST | `/api/projects/{id}/cancel` | SA | Alasan; dari non-terminal |
| GET | `/api/projects/{id}/history` | Semua | Riwayat status + audit |
| GET, PUT | `/api/projects/{id}/survey` | GET Semua, PUT SA/SP | Terkunci setelah AFCE pertama diajukan |

## 4. AFCE, BOQ, AR tambahan, approval

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| GET | `/api/projects/{id}/afce-attempts` | Semua | |
| POST | `/api/projects/{id}/afce-attempts` | SA, SP | Proyek SURVEY/RAB_READY; ACTIVE_CONFLICT bila ada aktif; menyalin BOQ attempt ditolak |
| PATCH | `/api/afce-attempts/{id}` | SA, SP | DRAFT; `rabReady=true` saat SURVEY → RAB_READY |
| PUT | `/api/afce-attempts/{id}/boq` | SA, SP | DRAFT; ganti semua baris (nama bangunan, kegiatan, harga, catatan); nilai & level dihitung ulang |
| PUT | `/api/afce-attempts/{id}/levels` | SA, SP | DRAFT; diaudit |
| POST | `/api/afce-attempts/{id}/submit` | SA, SP | Tanggal pengajuan + tanggal email; RAB_READY; BOQ ≥ 1; tier cocok → WAITING_AFCE_AR |
| GET | `/api/projects/{id}/ar-supplements` | Semua | |
| POST | `/api/projects/{id}/ar-supplements` | SA, SP | Nominal, alasan, tanggal; bukan COMPLETED/CANCELLED |
| PATCH | `/api/ar-supplements/{id}` | SA, SP | DRAFT |
| PUT | `/api/ar-supplements/{id}/levels` | SA, SP | DRAFT; diaudit |
| POST | `/api/ar-supplements/{id}/submit` | SA, SP | Tanggal pengajuan + tanggal email |
| POST | `/api/approval-levels/{levelId}/decision` | SA, SP | Hasil, nama approver, tanggal keputusan, catatan, fileId bukti; urutan level; aturan tanggal; efek ke dokumen/proyek/anggaran |
| GET | `/api/projects/{id}/budget` | Semua | Rencana, resmi, riwayat |

Tidak ada endpoint untuk approver.

## 5. Pekerjaan, tender, SPK

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| GET | `/api/projects/{id}/work-items` | Semua | |
| POST | `/api/projects/{id}/work-items` | SA, SP | ≥ AFCE_AR_APPROVED; kirim bobot semua Pekerjaan aktif (tepat 100); fisik dibuat otomatis untuk TENDER/SWAKELOLA |
| PATCH | `/api/work-items/{id}` | SA, SP | Fisik + material = 100; `type` dikunci `TYPE_LOCKED` (AC-33) |
| PUT | `/api/projects/{id}/work-item-weights` | SA, SP | Tepat 100,00 |
| POST | `/api/work-items/{id}/cancel` | SA, SP | Alasan + bobot pengganti |
| POST | `/api/work-items/{id}/tender-attempts` | SA, SP | USPK baru + plan tender + plan fisik; baseline dikunci; USPK pertama → PROCUREMENT |
| POST | `/api/tender-attempts/{id}/start` | SA, SP | PLANNED → IN_PROGRESS |
| PUT | `/api/tender-attempts/{id}/winner` | SA, SP | `vendorId` atau `vendorName` baru |
| POST | `/api/tender-attempts/{id}/cancel` | SA, SP | Tanggal + alasan; hanya PLANNED/IN_PROGRESS |
| GET | `/api/work-items/{id}/spks` | Semua | |
| POST | `/api/work-items/{id}/spks` | SA, SP | DRAFT; tender: attempt punya pemenang; swakelola: vendor INTERNAL + plan fisik; SPK swakelola pertama → PROCUREMENT |
| PATCH | `/api/spks/{id}` | SA, SP | DRAFT |
| POST | `/api/spks/{id}/release` | SA, SP | Release pertama → attempt COMPLETED; swakelola: kunci baseline fisik |
| POST | `/api/spks/{id}/cancel` | SA, SP | Tanggal + alasan; jeda fisik bila tak ada SPK aktif lain |

## 6. Fisik dan log progres

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| POST | `/api/work-items/{id}/physical/start` | SA, SP | ≥ 1 SPK RELEASED aktif; BELUM_MULAI/JEDA → BERJALAN; PROCUREMENT → EXECUTION |
| GET | `/api/work-items/{id}/progress-logs` | Semua | Termasuk yang digantikan |
| POST | `/api/work-items/{id}/progress-logs` | SA, SP | weekStart (Senin), persen, volume?, catatan, decreaseReason?, alat berat[], foto fileId[]; 100% → SELESAI |
| POST | `/api/progress-logs/{id}/supersede` | SA, SP | Log pengganti minggu yang sama |

## 7. Paket Kerja

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| GET | `/api/work-items/{id}/work-packages` | Semua | |
| POST | `/api/work-items/{id}/work-packages` | SA, SP | Item (material, satuan, qty) + bobot semua paket aktif (= bobot material) |
| PATCH | `/api/work-packages/{id}` | SA, SP | Item hanya sebelum kiriman pertama |
| POST | `/api/work-packages/{id}/pr` | SA, SP | Nomor, tanggal, plan → PR_SUBMITTED; baseline dikunci; PR pertama → PROCUREMENT |
| POST | `/api/work-packages/{id}/po` | SA, SP | → PO_ISSUED |
| POST | `/api/work-packages/{id}/production` | SA, SP | → PRODUKSI (opsional) |
| POST | `/api/work-packages/{id}/deliveries` | SA, SP | PO ada; qty positif; status otomatis; kiriman pertama → EXECUTION |
| POST | `/api/work-packages/{id}/deliveries/correction` | SA, SP | Qty negatif + alasan; total ≥ 0 |
| POST | `/api/work-packages/{id}/cancel` | SA, SP | Sebelum kiriman pertama; alasan + bobot pengganti |
| PATCH | `/api/work-packages/{id}/payment` | SA, SP | Sampai COMPLETED; diaudit |

## 8. Jadwal dan BAST

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| GET | `/api/projects/{id}/schedules` | Semua | |
| PATCH | `/api/schedule-baselines/{id}` | SA, SP | Hanya sebelum dikunci |
| POST | `/api/schedule-baselines/{id}/revisions` | SA, SP | Alasan wajib; hanya setelah dikunci |
| POST | `/api/projects/{id}/bast` | SA, SP | EXECUTION; fisik 100%; nomor, tanggal, fileId lampiran → WAITING_BAST |
| POST | `/api/bast/{id}/verify` | SA | → COMPLETED |
| POST | `/api/bast/{id}/cancel` | SA | Alasan → EXECUTION |

## 9. File

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| POST | `/api/files/upload-url` | SA, SP | kind, projectId, ownerType, ownerId, nama, MIME, ukuran → fileId PENDING + URL |
| POST | `/api/files/{id}/confirm` | SA, SP | Cek objek → READY |
| GET | `/api/files/{id}/download-url` | Semua | URL berumur pendek |

## 10. Tampilan baca dan ekspor

| Method | Path | Isi |
| --- | --- | --- |
| GET | `/api/projects/{id}/gantt` | Baris hierarki, kolom minggu, data sel (warna, simbol, tooltip) |
| GET | `/api/portfolio/gantt` | Filter seperti daftar proyek |
| GET | `/api/projects/{id}/s-curve` | Rencana & aktual kumulatif per minggu |
| GET | `/api/projects/{id}/ews` | Per proses, Pekerjaan, proyek |
| GET | `/api/dashboard` | Jumlah per status, EWS, progres, 10 deviasi terbesar, Kurva S portofolio |
| GET | `/api/reports/{portfolio\|project-detail\|work-packages\|ews-red}?format=json\|xlsx\|pdf` | Sinkron, tidak disimpan |

Semua role boleh membaca bagian ini.

## 11. Admin dan user

| Method | Path | Role | Aturan |
| --- | --- | --- | --- |
| `*` | `/api/auth/*` | — | Handler Better Auth |
| GET | `/api/me` | Semua | |
| POST | `/api/me/password` | Semua | Menghapus `mustChangePassword` |
| GET, POST | `/api/users` | SA | Buat: nama, email, role, password sementara |
| PATCH | `/api/users/{id}` | SA | Nama, role, isActive (tidak pernah dihapus) |
| POST | `/api/users/{id}/reset-password` | SA | Password sementara; cabut session |
| GET, PATCH | `/api/settings` | GET Semua, PATCH SA | Hari kerja, ambang EWS |
| GET, POST, DELETE | `/api/holidays` | GET Semua, ubah SA | |
| DELETE | `/api/projects/{id}` | SA | Soft delete + alasan |
| POST | `/api/projects/{id}/restore` | SA | |
| POST | `/api/projects/{id}/purge` | SA | Hanya ter-soft delete; body berisi kode proyek |
| GET | `/api/audit-logs?projectId=&entityType=&actorId=&from=&to=` | Semua | |
