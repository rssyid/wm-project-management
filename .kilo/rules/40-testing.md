# Rule 40 — Test dan verifikasi (selalu aktif)

Rujukan: `docs/06-phases-acceptance.md`

- Setiap AC punya minimal satu test otomatis; sebut ID di nama test, mis. `it('AC-31 menolak bobot proyek selain 100,00', …)`.
- Unit (Vitest): `progress-ews` (termasuk contoh 65,4%, rencana linear, freeze, ambang EWS), aturan tier, durasi approval, util tanggal, pembagian bobot.
- Integrasi (Vitest + database test): service dan route dengan Postgres nyata (branch Neon test atau Postgres lokal/container) — bukan mock Prisma — karena constraint, trigger dan transaksi ikut diuji. Uji paralel untuk AC-10 dan AC-42.
- E2E (Playwright): alur utama per role, termasuk viewport 375 px; axe-core di halaman utama (AC-73).
- Sebelum menyatakan selesai: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` lulus. Untuk fase dengan UI, jalankan juga `pnpm test:e2e`.
- Jangan melemahkan atau menghapus test agar lulus. Jika test bertentangan dengan dokumen, laporkan.
- Data uji dibuat lewat factory/helper, bukan seed produksi; seed lokasi dipakai hanya untuk AC-61.
