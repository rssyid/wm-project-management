-- Index unik parsial untuk "satu log progres aktif per minggu" dihilangkan.
-- Aturannya ditekankan pada level aplikasi (createProgressLog menandai log lama
-- sebagai digantikan sebelum membuat log baru), sehingga tidak ada pelanggaran
-- konstrak saat membuat log pengganti dalam satu transaksi.
DROP INDEX IF EXISTS "progresslog_one_active_per_week";
