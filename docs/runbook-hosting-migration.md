# Runbook: Migrasi Hosting & Operasional Sistem

Dokumen ini adalah panduan resmi prosedur pemindahan hosting (*hosting migration*) aplikasi Water Management Project Management dari lingkungan Vercel ke lingkungan Node.js mandiri (VPS / Server Fisik / Private Cloud / Docker Container) serta panduan pemeliharaan operasional mingguan basis data Neon.

---

## 1. Latar Belakang & Prinsip Arsitektur (AC-75)

Sesuai `docs/02-architecture.md` (§1 & §8), aplikasi ini dirancang dengan prinsip **portabel tanpa vendor lock-in**:
- **Framework & Runtime**: Next.js 16 (App Router) dengan target Node.js murni di seluruh route.
- **Bebas Fitur Spesifik Vercel**: Aplikasi tidak memakai Vercel KV, Vercel Blob, Vercel Cron, atau Vercel Edge Middleware. Seluruh middleware autentikasi dan route handler dieksekusi di runtime Node.js standar.
- **Build & Start Standar**: Aplikasi sepenuhnya dapat dibangun dan dijalankan dengan perintah standar:
  ```bash
  pnpm build
  pnpm start
  ```
- **Kemandirian Penyimpanan & Basis Data**:
  - Berkas/dokumen tersimpan di Cloudflare R2 (S3-compatible) via presigned URL langsung dari peramban.
  - Basis data menggunakan PostgreSQL (Neon Cloud) melalui pooling connection adapter `@prisma/adapter-pg`.

---

## 2. Persyaratan Lingkungan Target (Prerequisites)

### 2.1 Perangkat Keras / Server
- **Sistem Operasi**: Linux (Ubuntu 22.04 LTS / 24.04 LTS atau Debian 12 direkomendasikan).
- **CPU & RAM**:
  - Minimum: 1 vCPU, 2 GB RAM (disarankan swap 2 GB saat menjalankan `pnpm build`).
  - Rekomendasi: 2 vCPU, 4 GB RAM untuk performa konkurensi optimal.
- **Penyimpanan**: SSD minimal 20 GB untuk OS, dependensi Node, berkas build `.next`, dan log.

### 2.2 Perangkat Lunak Pendukung
- **Node.js**: Versi LTS v20.x atau v22.x.
- **Package Manager**: `pnpm` v9.x atau v10.x (`corepack enable && corepack prepare pnpm@latest --activate`).
- **Process Manager**: PM2 (`npm install -g pm2`) atau Systemd service.
- **Reverse Proxy**: Nginx 1.20+ atau Caddy dengan sertifikat SSL/TLS aktif (misal Let's Encrypt).

---

## 3. Checklist Environment Variables

Seluruh variabel konfigurasi disalurkan melalui file `.env` di server target. **Dilarang mencantumkan credential rahasia ke dalam repositori git.**

| Variabel | Keterangan & Format Contoh | Wajib? |
| --- | --- | --- |
| `DATABASE_URL` | Connection string pooler Neon (`postgresql://user:pass@ep-xyz-pooler.region.neon.tech/neondb?sslmode=require`) | Ya |
| `DIRECT_URL` | Connection string koneksi langsung Neon untuk migrasi schema (`postgresql://user:pass@ep-xyz.region.neon.tech/neondb?sslmode=require`) | Ya |
| `BETTER_AUTH_SECRET` | Kunci acak minimum 32 karakter hexadecimal / base64 (`openssl rand -hex 32`) | Ya |
| `BETTER_AUTH_URL` | Domain publik aplikasi **tanpa trailing slash** (contoh: `https://wm.company.co.id`) | Ya |
| `R2_ACCOUNT_ID` | Cloudflare Account ID | Ya |
| `R2_ACCESS_KEY_ID` | Cloudflare R2 Access Key ID | Ya |
| `R2_SECRET_ACCESS_KEY` | Cloudflare R2 Secret Access Key | Ya |
| `R2_BUCKET` | Nama bucket file R2 privat (contoh: `wm-prjct-files-prod`) | Ya |
| `APP_TIMEZONE` | Zona waktu operasional (`Asia/Jakarta`) | Ya |
| `SEED_ADMIN_EMAIL` | Email akun Super Admin awal (hanya dipakai saat seed awal) | Ya |
| `SEED_ADMIN_PASSWORD` | Password akun Super Admin awal (wajib segera diubah saat login pertama) | Ya |

> [!IMPORTANT]
> Nilai `BETTER_AUTH_URL` harus sama persis dengan origin URL yang diketikkan pengguna pada peramban (termasuk protokol `https://`). Bila berbeda, Better Auth akan menolak otentikasi karena perlindungan CSRF.

---

## 4. Prosedur Deploy: PM2 + Nginx (Rekomendasi Linux VPS)

### Langkah 1: Kloning Repositori & Instal Dependensi
```bash
# Kloning ke direktori aplikasi
sudo mkdir -p /var/www/wm-project-management
sudo chown -R $USER:$USER /var/www/wm-project-management
git clone <URL_REPO> /var/www/wm-project-management
cd /var/www/wm-project-management

# Instal dependensi terkunci
pnpm install --frozen-lockfile
```

### Langkah 2: Konfigurasi Environment & Migrasi Basis Data
```bash
# Siapkan berkas .env dari template
cp .env.example .env
nano .env   # Masukkan seluruh kredensial produksi yang valid

# Jalankan migrasi Prisma dan generate client
pnpm prisma migrate deploy
pnpm prisma db seed   # Hanya jika database baru dan membutuhkan master data awal
```

### Langkah 3: Build Aplikasi Next.js
```bash
pnpm build
```
Pastikan kompilasi berakhir dengan output:
`✓ Generating static pages using ...` tanpa error fatal.

### Langkah 4: Setup Process Manager PM2
Buat berkas konfigurasi `ecosystem.config.cjs` di root proyek:
```javascript
module.exports = {
  apps: [
    {
      name: "wm-project-management",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/var/www/wm-project-management",
      instances: "max",
      exec_mode: "cluster",
      autorestart: true,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
```

Jalankan service:
```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

### Langkah 5: Konfigurasi Nginx Reverse Proxy
Buat file `/etc/nginx/sites-available/wm-project-management`:
```nginx
server {
    listen 80;
    server_name wm.company.co.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name wm.company.co.id;

    # Konfigurasi Sertifikat SSL
    ssl_certificate /etc/letsencrypt/live/wm.company.co.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wm.company.co.id/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Ukuran maksimum unggah berkas (foto survei 5MB, dokumen/spasial 10MB)
    client_max_body_size 15M;

    # Header pengaman
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
        proxy_connect_timeout 30s;
    }

    # Cache untuk static asset Next.js
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

Aktifkan konfigurasi dan reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/wm-project-management /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Prosedur Deploy Alternatif: Docker Container

Bila ingin menggunakan Docker (Docker Swarm / Kubernetes / Coolify):

### 5.1 Dockerfile Standar Multi-Stage
```dockerfile
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# 1. Dependensi
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 2. Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN pnpm prisma generate
RUN pnpm build

# 3. Runner
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## 6. Prosedur Pemeliharaan Rutin & Jadwal Cron

Di luar Vercel, task otomatis harus dijadwalkan via cron server (`crontab -e`):

### 6.1 Pembersihan Berkas PENDING > 24 Jam
Jalankan setiap dini hari pukul 03:00 WIB:
```cron
0 20 * * * cd /var/www/wm-project-management && pnpm cleanup:pending-files >> /var/log/wm-cleanup.log 2>&1
```
*(Waktu cron di atas mengasumsikan server dalam UTC, di mana 20:00 UTC = 03:00 WIB).*

### 6.2 Backup Harian Basis Data ke Cloudflare R2
Bila tidak menggunakan GitHub Actions bawaan (`.github/workflows/db-backup.yml`), backup lokal/cron dapat dipasang:
```cron
0 19 * * * cd /var/www/wm-project-management && tsx scripts/db-backup.ts >> /var/log/wm-backup.log 2>&1
```

---

## 7. Template Monitoring Neon Mingguan (AC-76)

Berdasarkan `docs/02-architecture.md` (§9) dan `docs/06-phases-acceptance.md` (AC-76), kapasitas paket Neon Free Tier adalah 100 CU-hours per bulan dengan batas autoscaling 0,25 CU.

### 7.1 Prosedur Pengecekan Mingguan
Petugas Operasional / Super Admin wajib memeriksa console Neon setiap awal pekan (Senin pagi):
1. Buka [https://console.neon.tech](https://console.neon.tech) dan masuk ke project Water Management.
2. Navigasi ke menu **Usage & Billing**.
3. Catat nilai metrik berikut ke log operasional:
   - **Compute Hours Consumed**: total CU-hours yang telah digunakan dalam siklus berjalan.
   - **Active Storage**: ukuran penyimpanan (maksimum 0,5 GiB pada tier gratis).
   - **Connection Pool Spikes**: periksa grafik koneksi terhadap endpoint pooler.

### 7.2 Log Template Operasional Mingguan
Format tabel pencatatan mingguan:

| Tanggal Cek | Minggu Ke- | Compute Digunakan (CU-hours) | Persentase Pemakaian (%) | Storage (MB) | Status / Evaluasi | Catatan Petugas |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-02 | W1 | 14,2 CU-h | 14,2% | 85 MB | Normal (< 25%) | Beban kerja stabil |
| 2026-11-09 | W2 | 32,5 CU-h | 32,5% | 110 MB | Normal (< 50%) | Log mingguan aktif |
| 2026-11-16 | W3 | 54,0 CU-h | 54,0% | 140 MB | Normal (< 75%) | - |
| 2026-11-23 | W4 | 72,1 CU-h | 72,1% | 165 MB | **Waspada (> 70%)** | Evaluasi upgrade |

### 7.3 Kriteria Eskalasi & Rencana Upgrade
- **Bila Konsumsi Compute > 70% sebelum tanggal 24 setiap bulan**:
  1. Periksa apakah terdapat lonjakan trafik abnormal atau query lambat melalui tab **Operations / Query Performance**.
  2. Pastikan tidak ada script testing/looping yang tertinggal berjalan terhadap database produksi.
  3. Lakukan upgrade akun Neon dari **Free Tier** ke **Neon Launch / Scale Plan** (biaya variabel per CU-hour) untuk mencegah database mengalami suspend otomatis (*throttling*).
- **Bila Terjadi Connection Limit / Timeout**:
  - Pastikan runtime aplikasi selalu memakai `DATABASE_URL` dengan host `-pooler` (PgBouncer Neon).
  - Verifikasi bahwa batas timeout transaksi pada `src/infra/tx.ts` telah dikonfigurasi 15.000 ms.

---

## 8. Verifikasi Pasca-Migrasi (Verification Checklist)

Setelah aplikasi aktif di hosting baru, lakukan smoke test berikut:

- [ ] **Akses Halaman Login**: Buka `https://<domain>/login`, pastikan status HTTP 200 dan tampilan UI bersih.
- [ ] **Login Akun Admin**: Masuk dengan kredensial Super Admin (`SEED_ADMIN_EMAIL`), pastikan redirect mulus ke `/dashboard`.
- [ ] **Akses Halaman Portofolio & Gantt**: Periksa `/portofolio`, pastikan matriks timeline dan grafik batang termuat tanpa error.
- [ ] **Presigned URL Upload**: Coba upload foto survei / lampiran pada salah satu proyek draft, pastikan status berkas berubah dari `PENDING` menjadi `READY`.
- [ ] **Ekspor Laporan**: Klik tombol unduh laporan Excel dan PDF di `/laporan`, pastikan berkas `.xlsx` dan `.pdf` terunduh dan terbaca utuh.
- [ ] **Responsifitas Mobile**: Buka melalui peramban ponsel pintar (lebar layar 375 px), pastikan layout fleksibel dan kolom identitas Gantt sticky.
