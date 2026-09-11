# Pengelolaan dan review Prospect

Pengembangan ini melengkapi tahap sesudah discovery/impor pada Prospect Harvester existing, sebelum promosi ke Pipeline BD.

## Tersedia

- Edit nama account, jenis, industri, kota, alamat, website, telepon, email, PIC, jabatan, dan kebutuhan/service.
- Catatan review manual, terpisah dari AI summary dan skor existing.
- Tandai sudah direview, arsipkan, atau pulihkan ke status Baru dari detail prospect.
- Riwayat 20 perubahan manual terbaru: actor, waktu, field yang berubah, dan transisi status. Riwayat tidak menyalin isi kontak/catatan lama.
- Pencarian mencakup telepon/email; daftar filter sumber mengikuti sumber yang tersedia.
- Proteksi stale update menggunakan `updated_at`; data yang sudah berubah ditolak, bukan ditimpa.
- Akses baca memakai `pipeline.view`; edit/status memerlukan `pipeline.view` dan `pipeline.manage_self`. Scope shared prospect mengikuti fitur existing, bukan ownership baru.
- Prospect yang sudah dipromosikan tidak dapat diubah melalui editor ini; gunakan Pipeline BD.

## Aktivasi

1. Terapkan migrasi baru `supabase/migrations/20260911140000_prospect_review_workflow.sql` sesudah migrasi Prospect Harvester existing.
2. Deploy frontend lewat proses existing. Tidak memerlukan Edge Function, secret, atau API baru.
3. Buka `/ruang-kawan/prospects/`, pilih Detail, lalu gunakan bagian Review prospect.

Migrasi menambah `prospects.review_notes`, tabel riwayat `prospect_review_events`, RPC edit/concurrency, dan memperluas RPC status existing dengan audit. `prospect_workspace` existing sudah mengembalikan seluruh field prospect melalui `to_jsonb`, sehingga tidak diduplikasi.

Nomor Indonesia dengan awalan `0` dinormalisasi menjadi `62` saat diedit. Nomor internasional harus memakai kode negara. Nomor yang sama tidak otomatis digabung: prospect adalah account/perusahaan yang dapat berbagi nomor kantor. Proses canonical Contact matching tetap terpisah.

Riwayat hanya merekam perubahan manual melalui RPC review sejak migrasi aktif; tidak mengklaim audit historis impor, AI, atau promosi. Catatan review tersimpan pada prospect, belum disalin ke notes Pipeline. Tidak ada pesan outreach yang dikirim otomatis.

## Pemeriksaan

- `node --test tests/prospect-review.test.cjs tests/prospect-google.test.cjs`
- `npx tsc --noEmit`
- `npm run build`

Uji dua tab: buka prospect sama, simpan perubahan pada tab pertama, lalu simpan tab kedua. Tab kedua harus menerima pesan konflik dan meminta muat ulang. Uji akun baca saja, status arsip/pulihkan, dan prospect yang sudah dipromosikan.
