# Rule 30 — Frontend dan UI (aktif saat mengerjakan halaman dan komponen)

Rujukan: `docs/05-ui.md` · `docs/01-domain.md` §11 (Gantt)

## Stack

- shadcn/ui (Tailwind v4, new-york), lucide-react, sonner. Tambah komponen dengan CLI shadcn; jangan menyalin dari sumber lain.
- Form: React Hook Form + `zodResolver` memakai skema dari `src/shared` (sama dengan server).
- Data: baca lewat Server Component; mutasi lewat fetch ke `/api` dengan TanStack Query (`invalidateQueries` setelah sukses). Tangani 409 `VERSION_CONFLICT` dengan dialog muat ulang.
- Tabel: TanStack Table. Gantt: komponen sendiri (CSS grid, kolom identitas sticky, TanStack Virtual). Grafik: Chart shadcn (Recharts).
- Tanggal/angka: helper format Indonesia di `src/shared` (`10 Okt 2026`, `Rp1.250.000.000`, `65,4%`).

## Aturan tampilan

- Teks UI bahasa Indonesia. Tombol menyebut akibatnya ("Release SPK", bukan "Simpan").
- Tampilkan aksi sesuai role & status; aksi yang belum memenuhi syarat nonaktif + alasan (tooltip). Viewer tanpa tombol aksi.
- Badge status berawalan jenis ("Proyek: …", "SPK: …", "Fisik: …"); status proyek dan proses tidak digabung.
- Approval selalu berlabel "keputusan di SAP, dicatat oleh user".
- Pembatalan: dialog terpisah per jenis, alasan wajib.
- Riwayat tidak disembunyikan, termasuk di mobile.
- Gantt: warna & simbol persis seperti dokumen domain §11; sel revisi berpola garis; legenda; tooltip/panel detail. Data sel datang dari API `progress-ews`, UI tidak menghitung ulang.

## Design system

- Mode terang saja. Warna utama biru tua; EWS hijau/kuning/merah; Gantt abu-abu/kuning/oranye. Definisikan sebagai token CSS di satu tempat.
- Font Inter dengan cadangan system font. Tabel desktop compact.
- WCAG AA, keyboard, fokus terlihat, `aria-label` untuk ikon dan sel Gantt.
- Responsif sampai 375 px; form panjang dipecah per bagian; upload foto dari kamera; kompres foto di browser sebelum upload.
