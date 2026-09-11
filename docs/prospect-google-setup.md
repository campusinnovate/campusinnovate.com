# Prospect Harvester: Google

## Status akun

Pada 10 September 2026, konektor Google Drive di sesi pengembangan mengidentifikasi
`innovatecampus@gmail.com` sebagai **Campus Innovate**. Kode integrasi Calendar
juga merujuk `kawanberinovasi@gmail.com`; akun kedua belum diverifikasi melalui
login. Ini bukan bukti bahwa kedua akun sudah terhubung ke website.

Koneksi Google Drive di aplikasi asisten tidak memberikan OAuth client, refresh
token, atau akses Google Cloud administratif kepada website. Setiap akun perlu
login melalui tombol **Hubungkan akun Google** di Prospect Harvester setelah
deployment. Aplikasi menampilkan sumber yang diizinkan untuk akun tersebut;
tidak mengklaim dapat menemukan seluruh akun Google milik organisasi.

## Yang tersedia

| Sumber | Data / tindakan |
| --- | --- |
| Google Maps / Places | Pencarian query bebas dan preset, masuk ke staging prospek melalui API key backend yang sudah ada |
| Drive & Sheets | Daftar spreadsheet yang dapat diakses, termasuk shared drives; pemilihan tab, pratinjau A1:Z101, pemetaan kolom, impor sampai 100 baris |
| Search Console | Daftar properti dan laporan query/halaman, klik, impresi, CTR, posisi untuk periode pilihan, sampai 100 hasil teratas |
| Analytics GA4 | Daftar properti; laporan sumber/medium, sesi, pengguna aktif, key events, sampai 100 baris |
| Cloud Console | Inventaris project ID, nama, status, dan tautan console yang dapat diakses akun |
| Calendar | Inventaris kalender dan peran akses; koneksi Calendar/Meet yang lama tetap terpisah |
| YouTube | Channel akun yang diberikan Google, jumlah video, dan tautan channel |

Search Console dan Analytics menampilkan data agregat. Keduanya tidak
mengidentifikasi pengunjung anonim sebagai calon pelanggan. Gmail, Ads, Business
Profile, dan seluruh isi Drive tidak otomatis dibaca atau diimpor.

## Google Cloud Console

Login ke [Google Cloud Console](https://console.cloud.google.com/) dengan akun
yang berwenang, lalu pilih project Campus Innovate yang akan digunakan.

1. Aktifkan API sesuai layanan yang akan dipakai: **Google Drive API**, **Google
   Sheets API**, **Google Search Console API**, **Google Analytics Admin API**,
   **Google Analytics Data API**, **Cloud Resource Manager API**, **Google Calendar
   API**, dan **YouTube Data API v3**. **Places API (New)** memakai API key backend
   terpisah dan memerlukan konfigurasi billing/kuota pada project pemilik key.
2. Atur Google Auth Platform (branding, audience, data access). Saat status aplikasi
   masih Testing, tambahkan akun yang akan login sebagai test users. Scope yang
   diminta harus sesuai layanan yang dicentang di aplikasi. Scope sensitif dapat
   membutuhkan proses verifikasi Google sebelum akses produksi umum.
3. Buat OAuth Client **Web application** khusus Prospect Harvester. Tambahkan
   authorized redirect URI persis:

   ```text
   https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/prospect-google/callback
   ```

4. Simpan Client ID dan Client Secret sebagai secrets Supabase. Jangan mengganti
   konfigurasi OAuth Supabase login atau client Calendar yang sudah berjalan.

Scope layanan didefinisikan di `src/lib/prospects/google.ts`; semua scope data
bersifat read-only. Identitas berasal dari `openid` dan `userinfo.email`.
Google tetap memeriksa akses aktual akun ke spreadsheet, properti, dan project.

## Supabase

Prasyarat: migrasi Prospect Harvester
`20260904113000_ruang_kawan_prospect_harvester.sql` sudah terpasang.
Jalankan **migrasi baru** berikut melalui SQL Editor atau alur migrasi proyek:

```text
supabase/migrations/20260910140000_prospect_google_connections.sql
```

Di **Edge Functions > Secrets**, tambahkan:

| Secret | Isi |
| --- | --- |
| `GOOGLE_PROSPECT_CLIENT_ID` | OAuth Web Client ID |
| `GOOGLE_PROSPECT_CLIENT_SECRET` | OAuth Web Client Secret |
| `GOOGLE_PROSPECT_ENCRYPTION_KEY` | 32 byte acak dalam format 64 karakter hex |
| `GOOGLE_PLACES_API_KEY` | API key khusus backend untuk Places API (New), jika memakai Maps |
| `APP_ORIGIN` | `https://campusinnovate.com` |

Kunci enkripsi dapat dibuat dengan `openssl rand -hex 32` di terminal milik
pengelola. Simpan di pengelola secret; jangan memasukkan key atau token ke chat,
Git, browser storage, atau variabel `NEXT_PUBLIC_*`. Pertahankan kunci yang sama:
menggantinya tanpa migrasi ciphertext mengharuskan koneksi lama dihapus dan login
ulang. Token dienkripsi AES-GCM dengan pemilik akun sebagai authenticated data.

Deploy dari root repo:

```sh
npx supabase login
npx supabase functions deploy prospect-google --project-ref lxwqhtuhlddgwfxjtlas --use-api
npx supabase functions deploy prospect-harvest --project-ref lxwqhtuhlddgwfxjtlas --use-api
node scripts/check-prospect-google.mjs
```

`supabase/config.toml` menonaktifkan JWT gateway untuk callback Google dan
preflight. Handler memvalidasi sesi Supabase serta izin `pipeline.manage_self`
sebelum mengakses data. Callback memakai state satu kali, kedaluwarsa 10 menit,
PKCE, dan tujuan redirect tetap. Tabel token tidak memiliki grant pengguna;
backend membatasi semua operasi koneksi berdasarkan `owner_user_id`.

Deploy website terbaru. Masuk sebagai pengguna berizin kelola Pipeline BD,
pilih layanan, lalu hubungkan `innovatecampus@gmail.com`. Ulangi untuk akun lain
yang memang dikelola Campus Innovate. Daftar akun berlaku untuk pengguna Ruang
Kawan yang menghubungkannya; token tidak dibagikan otomatis ke anggota lain.
Hasil impor prospek mengikuti visibilitas Pipeline BD yang sudah ada.

Tombol **Putuskan** menghapus token lokal koneksi ini. Untuk mencabut grant Google
secara menyeluruh gunakan [koneksi pihak ketiga Google](https://myaccount.google.com/connections).
Grant tidak dicabut otomatis karena dapat memengaruhi sesi lain pada OAuth client
yang sama. Impor yang sudah disimpan tetap mengikuti database prospek.

## Uji penerimaan

1. Jalankan pemeriksaan endpoint: OPTIONS berhasil dan POST tanpa sesi ditolak.
2. Login Google, pilih akun dan layanan, lalu **Muat sumber**. Status API key
   hanya menandakan secret tersedia, bukan bukti API key valid atau billing aktif.
3. Pilih spreadsheet, tab, dan **Pratinjau**. Baris pertama adalah header.
   Petakan nama account (wajib) dan kolom kontak sesuai kebutuhan.
4. Pilih baris dan impor. Retry memakai identitas account untuk deduplikasi,
   tidak memakai posisi baris sebagai identitas. Satu kegagalan membatalkan batch.
5. Ubah isi sheet setelah pratinjau dan pastikan impor ditolak sampai pratinjau
   dimuat ulang. Verifikasi pengguna lain tidak bisa memakai ID koneksi tersebut.
6. Periksa laporan Search Console dan GA4 pada periode yang memiliki data;
   API mungkin mengembalikan data terbatas atau kosong untuk tanggal terbaru.
7. Putuskan salah satu akun dan pastikan akun lain serta Calendar lama tetap ada.

Pemeriksaan pengembangan:

```sh
npx tsc --noEmit
node --test tests/prospect-google.test.cjs
npx deno test --allow-env supabase/functions/prospect-google/index.test.ts
npm run build
```

Referensi API resmi: [OAuth](https://developers.google.com/identity/protocols/oauth2/web-server),
[Sheets](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get),
[Search Console](https://developers.google.com/webmaster-tools/v1/searchanalytics/query),
[Analytics](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport),
[Cloud projects](https://docs.cloud.google.com/resource-manager/reference/rest/v3/projects/search).

## Perbaikan 404/CORS dan Places 503

Pemeriksaan endpoint pada 11 September 2026 menunjukkan `prospect-google` merespons
OPTIONS dengan 404 `NOT_FOUND`, sedangkan preflight `prospect-harvest` sudah 204
dengan origin `https://campusinnovate.com`. Pesan CORS pertama disebabkan function
belum tersedia, bukan pengaturan browser. Error `GOOGLE_PLACES_API_KEY belum
dikonfigurasi` adalah masalah secret backend yang terpisah.

Untuk deployment dari Codespace/terminal:

```sh
npx supabase login
npx supabase functions deploy prospect-google --project-ref lxwqhtuhlddgwfxjtlas --use-api
npx supabase functions deploy prospect-harvest --project-ref lxwqhtuhlddgwfxjtlas --use-api
node scripts/check-prospect-google.mjs
```

Alternatif: setelah file workflow tersedia di GitHub, jalankan Actions →
**Deploy Prospect Edge Functions** → Run workflow pada branch yang memuat kode
Prospects terbaru. Workflow menggunakan repository secret `SUPABASE_ACCESS_TOKEN`.
Workflow website GitHub Pages hanya menerbitkan frontend, bukan Edge Functions.

Untuk error Places 503, buka Supabase project → Edge Functions → Secrets dan
simpan `GOOGLE_PLACES_API_KEY` dengan key dari project Google Cloud yang telah
mengaktifkan **Places API (New)** dan billing. Batasi key ke API tersebut. Key
dipakai server Supabase, sehingga jangan menggunakan pembatasan HTTP referrer
website pada key server ini. Jangan memasukkan nilainya ke source code, chat,
atau `NEXT_PUBLIC_*`. Konfigurasi OAuth `GOOGLE_PROSPECT_*` tidak menggantikan key
Places; keduanya perlu diatur sesuai fitur yang dipakai.

Setelah key tersimpan, coba query Maps sekali lagi. Pemeriksaan endpoint hanya
memeriksa transport/CORS dan penolakan request tanpa login; uji pencarian setelah
login tetap diperlukan untuk memvalidasi key, billing, dan kuota Google.
