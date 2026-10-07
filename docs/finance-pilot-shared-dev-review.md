# Paket DEV terisolasi dalam proyek Ruang Kawan — review sebelum pemasangan

**Update:** disetujui dan dipasang 7 Oktober 2026. Status/bukti aktual: [finance-pilot-shared-dev-installation.md](finance-pilot-shared-dev-installation.md). Bagian berikut mempertahankan proposal yang disetujui, bukan status terkini.

Target: **lxwqhtuhlddgwfxjtlas**, Campus-Innovate/ruang-kawan. Ini database produksi bersama, bukan proyek/branch Supabase DEV mandiri. Tidak ada paket Pro/branch berbayar, perubahan billing, atau penggunaan Ruang Ayat. Installer belum dijalankan terhadap Supabase.

## Paket konkret untuk ditinjau

- `supabase/dev/finance-pilot/install.sql`: SQL generated, pemasangan sekali dalam satu transaction; menolak namespace/RPC/bucket yang sudah ada. Tidak berada dalam direktori migration produksi otomatis.
- `scripts/build-finance-pilot-shared-dev.mjs`: membangun installer dari fixture schema serta empat migration sumber. Perintah ini hanya menulis file lokal.
- `supabase/dev/finance-pilot/disable.sql`: recovery yang mempertahankan data DEV dan memblokir akses API/Storage DEV.
- `scripts/check-finance-pilot-shared-dev.mjs`: uji isolasi di PostgreSQL/PGlite dengan sentinel produksi sintetis.
- `scripts/check-finance-pilot-api-target.mjs`: menjalankan adapter client yang benar-benar dikompilasi dan memeriksa routing, private bucket, retry key dan fail-closed behavior.

## Perubahan yang akan dipasang jika disetujui

| Bagian | Perubahan | Batas |
| --- | --- | --- |
| Database | Schema `finance_pilot_dev` dan `finance_pilot_dev_private`; fixture tabel kosong dan COA master untuk data uji | Tidak ada salinan transaksi, invoice, proyek, pipeline atau profil produksi |
| API | 18 endpoint baru `public.finance_pilot_dev_*` | Tidak mengganti fungsi/RPC Finance produksi; tidak mengubah exposed-schemas Data API |
| Auth | Login existing; allowlist DEV hanya COO dan CEO aktif, berdasarkan UUID user dan position key | Tidak membuat/mengubah auth.users, membership produksi, role, permission, atau profil produksi |
| Role DEV | Membership DEV terpisah saat pengguna allowlisted membuka preview; COO operasional, CEO approve-only | Perubahan/deaktivasi posisi produksi langsung membatalkan otorisasi DEV; tidak ada impersonation UI |
| Storage | Bucket privat `finance-pilot-dev-evidence`, maksimum 10 MB/file, PDF/PNG/JPEG; empat guard restrictive plus policy bucket khusus | Tidak menggunakan bucket dokumen produksi; broad policy lama tidak boleh membuka DEV; tidak ada update/delete file oleh client |
| Dokumen | Nomor berawalan DEV-INV/DEV-RCPT/DEV-TX/DEV-QUO, sequence DEV | Tidak memakan nomor atau membuat finance_documents produksi |
| Frontend preview | `NEXT_PUBLIC_FINANCE_PILOT_TARGET=shared-dev`; route/layout existing dipakai | RPC dan bucket selalu DEV, target host dikunci; gagal bila bind/target salah, tanpa fallback produksi; tidak deploy produksi |
| Transaksi | Threshold >= Rp1.000.000; Januari–Desember sebagai usulan policy; workflow approval tetap diuji | Installer tidak seed policy approved atau saldo awal; akun uji harus dipersiapkan lewat workflow COO/CEO |

Tabel bernama serupa di schema DEV adalah fixture uji sementara, bukan sistem finance operasional kedua. Setelah penerimaan, produksi tetap memakai tabel canonical existing serta migration utama yang ditinjau terpisah. Data dan saldo DEV tidak akan digabungkan ke produksi.

## Bukti pemeriksaan sebelum pemasangan

Read-only pada 7 Oktober 2026: tidak ada schema finance_pilot_dev*, endpoint finance_pilot_dev_* atau bucket DEV. Ada satu COO dan satu CEO aktif yang memenuhi allowlist. Produksi memiliki 209 finance_transactions, 27 finance_documents, dan 0 pilot journals saat pemeriksaan; angka meningkat dibanding penemuan sebelumnya, sehingga produksi sedang digunakan. Fingerprint lima RPC terkait pada saat itu: `0516bfc3ecf532e6c725eaf4eb701590`.

Periksa ulang metadata/preflight tepat sebelum pemasangan; perubahan jumlah karena aktivitas pengguna tidak boleh dianggap sebagai efek installer tanpa penelusuran. Jangan menghentikan/mengubah transaksi nyata untuk membuat angka cocok. Cocokkan definisi RPC/policy existing, validasi setiap DDL installer dan catat instalasi yang dilakukan.

Uji lokal membandingkan fingerprint **seluruh** tabel public dan definisi fungsi public existing sebelum install, setelah install, setelah posting DEV, dan setelah disable. Invoice DEV Rp1.000.000 serta receipt Rp400.000 merekonsiliasi kas Rp400.000/AR Rp600.000/trial difference nol, sementara sentinel produksi tetap sama. Uji juga memberi Storage policy lama yang sengaja broad untuk memastikan guard DEV tetap menolak outsider/overwrite.

Hasil ini belum membuktikan hosted Auth/Storage, concurrency multi-koneksi, browser semua tombol atau seluruh constraint/trigger legacy. Fixture schema hanya mereproduksi kolom relevan; DEV di proyek bersama tidak menggantikan regresi migration utama terhadap schema produksi lengkap. Kesenjangan PRD lainnya tetap ada di finance-pilot-setup.md.

## Risiko yang masih ada

- CPU, koneksi database, Auth dan layanan Storage tetap berbagi proyek. Namespace memisahkan data/nama, bukan sumber daya atau gangguan layanan. Gunakan dataset kecil, tanpa load/stress test, dan lakukan DDL pada waktu yang disepakati.
- Pembuatan policy baru pada storage.objects dapat memerlukan lock singkat. Installer memakai lock_timeout 3 detik dan statement_timeout 90 detik; contention membatalkan transaction, bukan retry otomatis.
- Endpoint public baru menambah permukaan API. Anon tidak mendapat EXECUTE; setiap operasi memeriksa membership DEV serta allowlist/posisi live. RLS aktif pada semua tabel DEV, akses tabel langsung dicabut, schema DEV tidak ditambahkan ke exposed-schemas.
- Anggota COO/CEO yang allowlisted dapat memposting **data DEV saja**, menggunakan login existing. Jangan mengunggah dokumen keuangan nyata ke DEV. Role lain belum di-enroll; pengujian positif mereka memerlukan perluasan allowlist yang ditinjau kemudian.
- Kebijakan Storage existing belum diperiksa lewat hosted request. Guard restrictive harus diuji setelah pemasangan, termasuk upload/read dokumen produksi normal. Jangan deploy frontend produksi sampai uji ini lolos.

## Pemasangan setelah persetujuan

1. Verifikasi target project, namespace/bucket/RPC collisions serta definisi fungsi/policy existing. Simpan metadata snapshot sebelum perubahan, bukan financial data export publik.
2. Review ulang generated install.sql; jalankan hanya installer DEV dalam satu transaction. Jangan menjalankan ketiga migration utama terhadap public produksi.
3. Periksa advisors, seluruh grants/RLS, new RPC existence, bucket private dan fingerprint fungsi produksi existing. Bandingkan counts/control totals sambil memperhitungkan penulisan normal pengguna yang tercatat.
4. Build preview dengan target shared-dev dan writes DEV enabled. Jangan mengubah domain/branch deployment produksi. Akses memakai login COO/CEO existing; jangan meminta password atau service-role key di percakapan.
5. Lakukan data uji sintetis kecil, hosted Storage/Auth tests dan regresi old Finance yang read-only terhadap data nyata. Jika tanda gangguan terlihat, nonaktifkan DEV dan hentikan uji.

## Pemulihan

Jika transaction installer gagal, rollback membatalkan seluruh penambahan. Bila install sukses tetapi ada masalah, jalankan disable.sql yang ditinjau: matikan enabled flag, cabut EXECUTE endpoint DEV, dan biarkan restrictive Storage guards menolak akses bucket DEV. Aplikasi produksi tidak diarahkan ulang; frontend preview dimatikan. Tidak ada restore/penghapusan transaksi produksi.

Jangan DROP schema/tabel atau menghapus metadata Storage sebagai langkah pertama. Data DEV/audit/evidence dipertahankan untuk investigasi. Cleanup permanen membutuhkan review dependensi dan penanganan file melalui Storage API; tidak dilakukan otomatis. Jika kode asli produksi berubah selama proses oleh pengguna/developer lain, jangan menimpa perubahan tersebut memakai snapshot lama.

## Persetujuan yang diminta

**Pemasangan paket DEV di atas saja di proyek lxwqhtuhlddgwfxjtlas**, termasuk schema terpisah, 18 endpoint baru, private bucket/policies dan allowlist awal COO/CEO. Ini tidak mencakup migration utama, pengujian memakai transaksi nyata, perubahan role produksi, merge/deploy website produksi, atau cutover historis.
