# RAB Generator: setup operasional

Generator berada di Marketing → RAB Generator. Sumbernya adalah **Campus Innovate — Project Pricing Template V.2**, sebuah Google Sheet native dengan tujuh tab. Backend membuat salinan Drive dari master dan hanya mengisi sel input melalui Sheets `values.batchUpdate` dengan `RAW`; rumus, format, validasi, dan tab lain tetap dari master.

## Drive

- Master Sheet V2: `1lfWWXxrAnNB3K_J9pql_TbSggrO8aIkOFHrgLiB3jns`
- Folder hasil: `1zwXQYDu5q-I65iNPA1w7H6mS0oKmoa0T` (`03_FIN/RAB Generated`)
- Akun Google yang dihubungkan staf harus punya akses baca master dan hak menambah file pada folder hasil. File hasil mengikuti izin folder Drive tersebut.

## Google Cloud dan Supabase

1. Aktifkan Google Drive API dan Google Sheets API di project Google Cloud organisasi.
2. Buat OAuth client jenis Web application. Tambahkan authorized redirect URI `https://lxwqhtuhlddgwfxjtlas.supabase.co/functions/v1/rab-generator/callback` dan pastikan consent screen mengizinkan akun staf. Aplikasi meminta `openid`, `email`, `drive`, dan `spreadsheets`; scope Drive penuh diperlukan untuk menyalin master yang sudah ada. Proses verifikasi Google mungkin diperlukan sebelum pengguna di luar daftar test users bisa memberi izin.
3. Jalankan migrasi `20261004110000_marketing_rab_generator.sql`, lalu `20261004130000_rab_approval_workflow.sql`, dan deploy Edge Function `rab-generator` dengan `verify_jwt=false`. Function tetap memvalidasi JWT pengguna untuk seluruh POST; hanya OAuth callback memakai state sekali pakai dan PKCE.
4. Isi Supabase Edge Function secrets di project yang sama:

   | Secret | Nilai |
   | --- | --- |
   | `GOOGLE_RAB_CLIENT_ID` | OAuth client ID baru |
   | `GOOGLE_RAB_CLIENT_SECRET` | OAuth client secret baru |
   | `GOOGLE_RAB_ENCRYPTION_KEY` | 32 byte acak dalam hex (64 karakter); simpan aman, jangan ganti tanpa migrasi token |
   | `GOOGLE_RAB_TEMPLATE_ID` | Tidak dipakai: function mematok master V2 `1lfWWXxrAnNB3K_J9pql_TbSggrO8aIkOFHrgLiB3jns` agar env V1 lama tidak bisa terpakai tanpa sengaja. |
   | `GOOGLE_RAB_OUTPUT_FOLDER_ID` | `1zwXQYDu5q-I65iNPA1w7H6mS0oKmoa0T` |
   | `APP_ORIGIN` | `https://campusinnovate.com` |

   `SUPABASE_URL`, `SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY` disediakan oleh Supabase. Jangan menaruh client secret, service role, atau encryption key di Next.js/browser.

## Pemeriksaan sebelum aktif

1. Login bergantian sebagai CEO, CTO, COO, dan BD. Keempat posisi harus melihat Marketing → RAB Generator dan bisa menghubungkan Google Drive. Pengguna di luar empat posisi tidak mendapat tab dari izin role umum.
2. Buat RAB uji dengan satu komponen dan satu baris HPP. Pastikan file ada di folder hasil dan tujuh tab tetap berurutan: Dashboard, Pricing Control, RAB Internal, Client Proposal, Project P&L, Component Library, Read Me.
3. Bandingkan formula dan format sel hasil dengan master, serta cek hasil angka di Dashboard, Client Proposal, dan Project P&L. Coba buka di tab baru dan ekspor Excel.
4. Periksa sebagai pengguna tanpa izin: tab tidak muncul dan POST Function mengembalikan 403. Akun lain tidak dapat melihat riwayat atau mengunduh RAB pengguna tersebut dari aplikasi.

Ekspor `.xlsx` dilakukan oleh Google Drive dari file native. Fungsi Sheets tertentu mungkin tidak dihitung identik oleh Excel setelah diunduh; versi Google Sheet adalah sumber angka final.

## V2 input map dan approval

- Input komersial ditulis ke `Pricing Control!E5:E8`, `H5:H6`, `H8`, `H11:H13`, `M6:M8`, dan `B5:B10`. `E9:E12`, kalkulasi overhead/marketing, dan pricing summary tetap formula master.
- Cost rows diinisialisasi kosong dengan hanya menulis `RAB Internal!B:C`, `F:H`, dan `J` pada rows 10–39. Kolom lookup/formula D, E, I, K tidak disentuh.
- Formula daftar komponen V2 memfilter Service Family secara exact, sementara katalog memiliki satu komponen berkeluarga `All`. Generator menambahkan komponen `All` resmi ke baris kosong berikutnya sebagai input library tanpa mengubah formula master; ini memungkinkan biaya Project Management & Coordination dipetakan ke Pricing Control dan RAB Internal.
- Approval submission membaca ulang sheet yang sudah diedit dan membekukan `Pricing Control!B5:B10`, `A15:B27`, `A29:J41`, serta `RAB Internal!A9:J39` ke snapshot versi.
- Alur review berurutan COO kemudian CEO. Keputusan dicatat atas akun aktif; perubahan pada sumber setelah submission membuat approval perlu diajukan ulang. Dokumen dapat dicetak/simpan PDF dan mengambil angka hanya dari snapshot; sistem tidak menandatangani atas nama pejabat.
