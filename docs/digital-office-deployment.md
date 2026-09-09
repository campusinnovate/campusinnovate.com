# Deploy Digital Office

Finalisasi PDF memerlukan Edge Function; deploy website saja tidak memasangnya.
Pada pemeriksaan 9 September 2026, endpoint proyek `lxwqhtuhlddgwfxjtlas`
mengembalikan HTTP 404 `Requested function was not found` bahkan untuk OPTIONS.
Browser dapat menampilkan `Failed to fetch` ketika preflight tersebut gagal.

1. Terapkan migrasi `20260908150000_digital_office.sql` jika belum terpasang,
   kemudian `20260909120000_office_direct_signing.sql` melalui SQL Editor atau
   alur migrasi Supabase yang dipakai proyek.
2. Dengan Supabase CLI yang sudah login ke akun proyek, jalankan dari root repo:

   ```sh
   supabase functions deploy digital-office --project-ref lxwqhtuhlddgwfxjtlas
   ```

   `supabase/config.toml` menonaktifkan verifikasi JWT gateway untuk fungsi ini.
   Handler tetap memvalidasi sesi lewat `auth.getUser()`, keanggotaan aktif,
   dan kepemilikan dokumen sebelum menggunakan service role.
   Secret bawaan Supabase menyediakan URL, anon key, dan service role key.
   Jika domain berbeda, set `APP_ORIGIN` ke URL website untuk tautan QR.
3. Deploy website dengan build terbaru.
4. Uji OPTIONS ke `/functions/v1/digital-office/finalize`: harus HTTP 200.
   Uji dari website: unggah PDF, pilih TTD, simpan, finalisasi, unduh, dan
   periksa QR/hash. Uji mode persetujuan serta mode langsung tanpa approval.

Alternatif tanpa CLI lokal: tambahkan repository secret `SUPABASE_ACCESS_TOKEN`
(personal access token Supabase milik akun yang dapat mengakses proyek), kemudian
jalankan workflow **Deploy Digital Office Edge Function** di GitHub Actions.
Workflow ini hanya memasang fungsi Digital Office, lalu memeriksa preflight CORS
dan penolakan permintaan tanpa sesi. Migrasi database tetap mengikuti langkah 1.
Jangan masukkan token tersebut ke kode frontend atau variabel `NEXT_PUBLIC_*`.

Untuk memeriksa deployment tanpa mengubah dokumen:

```sh
node scripts/check-digital-office.mjs
```

HTTP 404 `Requested function was not found` berarti fungsi belum tersedia pada
proyek tujuan; mengubah header frontend atau menjalankan migrasi SQL saja tidak
memperbaikinya.

Mode langsung hanya menerima TTD sendiri atau TTD yang dibagikan anggota aktif.
TTD privat tetap tidak dapat dipilih. Kolom `approved_at` tidak diisi otomatis;
mode dan riwayat mencatat penggunaan tanpa persetujuan per dokumen. Dokumen lama
mempertahankan mode persetujuan. Finalisasi dan penyimpanan hash tetap dilakukan
oleh backend.

Pemeriksaan lokal:

```sh
npx tsc --noEmit
node --test tests/office-database.test.cjs tests/office-geometry.test.cjs
npm run build
```
