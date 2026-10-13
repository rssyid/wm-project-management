# Rule 35 — Design system WM Project Management

Aplikasi ini alat kerja operasional untuk tim Water Management perkebunan: padat data, dipakai berjam-jam, dibaca di laptop kantor dan HP di lapangan. Tampilannya harus tenang, rapi, dan cepat dipindai — bukan landing page. Bagian paling menonjol hanya satu: **status dan jadwal** (badge status, EWS, Gantt). Sisanya diam dan disiplin.

Rujukan perilaku UI: `docs/05-ui.md`

## 1. Token warna

Definisikan sekali di `src/app/globals.css` (Tailwind v4 `@theme` + variabel shadcn). Jangan menulis hex langsung di komponen.

| Token | Hex | Pakai untuk |
| --- | --- | --- |
| `--ink` | `#1C2422` | Teks utama, judul |
| `--ink-muted` | `#5A6662` | Teks sekunder, label field, keterangan |
| `--canal` (primary) | `#1E4A6B` | Tombol utama, link, item menu aktif, fokus |
| `--canal-soft` | `#E6EEF4` | Latar item menu aktif, baris terpilih |
| `--surface` | `#F5F6F4` | Latar halaman |
| `--panel` | `#FFFFFF` | Latar tabel, form, panel |
| `--line` | `#DCE1DE` | Garis tabel, border input, pemisah |
| `--ews-green` | `#2B7848` (teks) / `#E8F2EC` (latar) | EWS hijau, status selesai |
| `--ews-yellow` | `#7A5F08` (teks) / `#FBF3D5` (latar) | EWS kuning |
| `--ews-red` | `#B3261E` (teks) / `#FBE9E7` (latar) | EWS merah, aksi destruktif |
| `--gantt-base` | `#C8CDCB` | Sel baseline |
| `--gantt-rev1` | `#FFFF00` | Tambahan revisi pertama (D-33) |
| `--gantt-rev2` | `#FFC000` | Tambahan revisi berikutnya (D-33) |
| `--gantt-edge` | `#FF0000` (rgb 255 0 0) | Garis penanda minggu berjalan di Gantt, hanya Gantt (D-35) |

Badge status memakai latar lembut + teks gelap dari keluarga warna yang sama, bukan blok warna penuh. Kontras teks minimal WCAG AA.

## 2. Tipografi

- Satu keluarga: **Inter** (variable), cadangan `system-ui`. Muat lewat `next/font`.
- Angka (uang, persen, qty, tanggal di tabel) wajib `font-variant-numeric: tabular-nums` dan rata kanan di kolom tabel.
- Skala (px): 12 keterangan · 13 isi tabel · 14 isi form dan teks umum · 16 judul bagian · 20 judul halaman · 24 hanya untuk angka KPI di dashboard.
- Bobot: 400 isi, 500 label dan header tabel, 600 judul. Tidak ada 700+ selain angka KPI.
- Sentence case di semua judul, label, tombol. **Tidak ada** label huruf kapital semua.
- Lebar teks paragraf maks. ~72 karakter.

## 3. Ruang, bentuk, bayangan

- Skala jarak 4 px: 4, 8, 12, 16, 24, 32. Antar field form 16; antar bagian halaman 24–32.
- Radius: 4 px untuk input, tombol, badge; 8 px untuk panel dan dialog. Tidak lebih.
- Bayangan hanya untuk elemen yang mengambang (dialog, popover, dropdown). Panel di halaman memakai border `--line`, tanpa bayangan.
- Tanpa gradien, tanpa ilustrasi dekoratif, tanpa animasi masuk per bagian. Animasi hanya untuk respons aksi (buka dialog, expand baris), maks. 150 ms, hormati `prefers-reduced-motion`.

## 4. Shell aplikasi

```
┌──────────────┬──────────────────────────────────────────────────────┐
│ WM Project   │ Proyek / WM-THIP-2026-0001            [Nama] [Role ▾]│  ← top bar 56 px: breadcrumb + user
│              ├──────────────────────────────────────────────────────┤
│ Dashboard    │                                                      │
│ Proyek     ◀ │   Konten halaman (padding 24 desktop, 16 mobile)     │
│ Portofolio   │                                                      │
│ Laporan      │                                                      │
│ Master data  │                                                      │
│ Admin        │                                                      │
│              │                                                      │
│ (240 px,     │                                                      │
│  bisa dilipat│                                                      │
│  jadi ikon)  │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

- Pakai komponen **Sidebar** shadcn. Item aktif: latar `--canal-soft`, teks `--canal`, ikon lucide 16 px. Menu yang tidak berhak tidak ditampilkan.
- Mobile (< 768 px): sidebar menjadi sheet dari kiri lewat tombol menu di top bar.
- Satu komponen `PageHeader` untuk semua halaman: judul (20 px), keterangan opsional (13 px muted), aksi utama di kanan. Tidak ada judul ganda.

## 5. Pola halaman

**Daftar (proyek, master):** bar filter satu baris di atas tabel → tabel penuh lebar di panel putih ber-border → paginasi di bawah. Bukan grid kartu. Mobile: baris tabel menjadi daftar ringkas (nama, status, angka utama).

**Form:** satu kolom, lebar maks. 720 px, dikelompokkan per bagian dengan judul 16 px dan garis pemisah. Label di atas field, keterangan di bawah, pesan error merah di bawah field. Tombol utama di kiri bawah form (bukan tengah), tombol sekunder di sebelahnya.

**Workspace proyek:**

```
PageHeader: WM-THIP-2026-0001 · Normalisasi kanal blok A      [Aksi utama] [Lainnya ▾]
Baris ringkas: [Proyek: Pengadaan] [EWS: Kuning 6,2]  Progres 42,5%  Anggaran Rp1,25 M  PIC …
┌ Langkah berikutnya ───────────────────────────────────────────────┐
│ 1 aksi utama + prasyarat yang belum terpenuhi (teks biasa)        │
└───────────────────────────────────────────────────────────────────┘
Tab: Ringkasan | Survei | AFCE/AR | Pekerjaan | Paket Kerja | Jadwal | BAST | Riwayat
Isi tab
```

**Dashboard:** baris angka KPI (angka 24 px, label 13 px) tanpa kartu berbayang — cukup dipisah garis vertikal; di bawahnya tabel "10 deviasi terbesar" dan Kurva S. Tidak ada grafik dekoratif.

## 6. Komponen

- **Tombol:** satu tombol utama (`--canal`) per area; lainnya `outline` atau `ghost`. Destruktif (batal, hapus, purge) memakai varian merah dan selalu lewat dialog konfirmasi.
- **Tabel:** header 13 px/500 di latar `--surface`, baris 40 px (compact), garis horizontal saja, hover baris `--canal-soft`, kolom angka rata kanan tabular. Kolom aksi di kanan berupa menu `⋯`.
- **Badge status:** awalan jenis ("Proyek:", "SPK:", …), latar lembut, radius 4, teks 12 px/500.
- **Field kosong / empty state:** satu kalimat apa yang belum ada + tombol aksi yang relevan. Tanpa ilustrasi.
- **Pesan error:** sebut apa yang salah dan cara memperbaikinya ("Total bobot 98,50%. Harus tepat 100,00%."). Tidak meminta maaf.
- **Toast (sonner):** konfirmasi singkat dengan kata kerja yang sama dengan tombol ("SPK direlease").

## 7. Dilarang (ciri UI generik)

- Grid kartu identik dengan radius dan bayangan sama untuk konten yang sebenarnya tabel.
- Label kecil huruf kapital semua di atas judul, teks dipisah titik tengah berderet, panah `→` di setiap tombol/link.
- Gradien, latar krem, aksen terakota, mode gelap.
- Ikon besar dekoratif di setiap kartu, emoji di UI.
- Lebih dari satu tombol utama berwarna penuh dalam satu area.

## 8. Cek sebelum menyatakan UI selesai

1. Ambil screenshot halaman di 1440 px dan 375 px; bandingkan dengan aturan ini.
2. Semua warna dari token; tidak ada hex di komponen (`grep -rn "#[0-9A-Fa-f]\{6\}" src/components src/app` hanya boleh menemukan `globals.css`).
3. Angka tabular dan rata kanan; status punya teks, bukan hanya warna.
4. axe-core tanpa pelanggaran serius.
