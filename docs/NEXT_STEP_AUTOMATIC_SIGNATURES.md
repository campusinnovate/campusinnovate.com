# Next Step Manifest — Tanda Tangan Otomatis

## Tujuan

Menyediakan unggah tanda tangan satu kali pada profil pengguna dan memasangnya otomatis pada dokumen yang membutuhkan tanda tangan, termasuk Document Center, quotation, invoice, payment receipt, serta dokumen dari modul lain.

## Keputusan Alur

1. Pengguna mengunggah tanda tangan melalui **Profil Saya**.
2. File disimpan privat dan hanya dapat dibaca pemilik, sistem pembuat dokumen, serta admin yang memiliki izin khusus.
3. Template menentukan penandatangan berdasarkan pengguna, peran, atau jabatan.
4. Tanda tangan hanya ditempel ketika dokumen berstatus **Final**, **Approved**, atau **Issued**. Draft tidak ditandatangani otomatis.
5. Saat finalisasi, sistem menyimpan snapshot gambar, nama, jabatan, waktu, dan pengguna yang melakukan finalisasi. Perubahan tanda tangan di profil tidak mengubah dokumen lama.
6. Dokumen lama tidak diubah otomatis. Pengguna berizin dapat memilih **Buat ulang dengan tanda tangan**.

## Cakupan Modul

- **Profil Pegawai:** unggah, pratinjau, ganti, dan hapus tanda tangan sendiri.
- **Document Center:** pilih satu atau beberapa penandatangan sesuai template dan tahap approval.
- **Finance:** tanda tangan otomatis pada quotation, invoice, dan payment receipt berdasarkan pengaturan template.
- **Modul lain:** memakai adapter dan placeholder yang sama agar tidak membuat sistem tanda tangan terpisah.

## Placeholder Template

- `{{signature_image}}`
- `{{signer_name}}`
- `{{signer_title}}`
- `{{signed_at}}`
- Untuk banyak penandatangan: `{{signature_1_image}}`, `{{signature_1_name}}`, dan seterusnya.

Jika placeholder gambar tidak tersedia, proses finalisasi harus berhenti dengan pesan yang jelas; sistem tidak boleh menerbitkan dokumen seolah-olah sudah ditandatangani.

## Data dan Keamanan

- Storage privat, bukan URL publik permanen.
- Format awal: PNG atau WebP, maksimal 2 MB; latar transparan direkomendasikan.
- SVG tidak diterima untuk menghindari konten aktif berbahaya.
- Metadata minimum: pemilik, lokasi file, versi, status aktif, waktu unggah, dan audit perubahan.
- Setiap dokumen final menyimpan snapshot tanda tangan dan hash dokumen.
- Hak akses dipisahkan menjadi: `signature.manage_own`, `signature.manage_others`, `signature.apply`, dan `signature.audit`.
- Tanda tangan pengguna lain tidak dapat dilihat atau diunduh tanpa izin khusus, walaupun dokumen final yang sah tetap dapat diakses sesuai izin dokumennya.

## Komponen Teknis

1. Migration untuk profil tanda tangan, snapshot dokumen, izin, RLS, dan audit log.
2. Bucket privat serta proses upload menggunakan signed URL berumur pendek.
3. Pengaturan penandatangan pada template Document Center dan template Finance.
4. Adapter generator Google Docs/PDF untuk mengganti placeholder teks dan gambar.
5. Validasi finalisasi: tanda tangan tersedia, penandatangan berhak, placeholder lengkap, dan versi template sesuai.
6. UI pratinjau sebelum finalisasi serta aksi regenerasi untuk dokumen lama.

## Urutan Implementasi

1. **Fondasi:** tabel, storage, izin/RLS, audit, dan unggah pada Profil Saya.
2. **Document Center:** konfigurasi penandatangan, placeholder, finalisasi, dan snapshot.
3. **Finance:** quotation, invoice, dan payment receipt menggunakan fondasi yang sama.
4. **Ekspansi:** sambungkan generator dokumen dari modul lain.
5. **QA:** pemilik vs pengguna lain, admin berizin, draft vs final, ganti tanda tangan, dokumen lama, banyak penandatangan, Google Docs, dan PDF.

## Gate Produksi

- Tidak ada tanda tangan yang dapat diakses melalui URL publik.
- Draft tidak pernah memiliki tanda tangan final.
- Dokumen final tidak berubah setelah tanda tangan profil diganti.
- Pengguna tidak dapat memasang tanda tangan orang lain tanpa kewenangan.
- Hasil Google Docs dan PDF konsisten serta tidak memotong gambar tanda tangan.
- Semua penerbitan, regenerasi, penggantian, dan penghapusan tercatat dalam audit log.

## Sumber Implementasi Saat Ini

- Document Center: `src/app/ruang-kawan/documents/page.tsx`
- Finance dan pengaturan template: `src/app/ruang-kawan/finance/FinanceWorkspace.tsx`
- Skema Document Center: `supabase/migrations/20260825170000_document_center.sql`
- Generator Google Workspace: `supabase/migrations/20260825230000_google_workspace_generation.sql`
- Template Finance: `supabase/migrations/20260825013000_finance_document_template_settings.sql`

## Di Luar Cakupan Tahap Awal

- Tanda tangan elektronik tersertifikasi PSrE.
- Penandatangan eksternal tanpa akun Ruang Kawan.
- OTP, meterai elektronik, dan alur kontrak hukum penuh.

Fitur awal adalah pemasangan gambar tanda tangan internal dengan kontrol akses dan audit, bukan klaim tanda tangan elektronik tersertifikasi.
