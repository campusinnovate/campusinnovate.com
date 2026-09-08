# Pengembangan Kawan Chat

- Link HTTP/HTTPS dan www dapat diklik pada pesan utama maupun thread.
- Tombol Google Meet kembali ke warna normal pada `ends_at`; meeting cancelled/completed tidak mengaktifkan warna ungu. Pembaruan waktu berjalan otomatis saat halaman terbuka.
- Pembatas tanggal dan jam chat menggunakan Asia/Jakarta (WIB), termasuk pada thread.
- Klik nama/avatar pengirim atau anggota untuk profil singkat (nama, foto, jabatan, email jika tersedia, status online di ruang).
- Klik kanan pesan atau tombol titik tiga untuk reaksi emoji, balasan thread, penerusan, dan aksi pekerjaan yang tersedia.
- Thumbnail gambar dan dialog preview untuk Drive, gambar, PDF, audio, dan video. Format lain menampilkan informasi file dan tautan asli. Preview Drive membutuhkan izin akun Google.

## Penerapan database

Terapkan `supabase/migrations/20260908140000_chat_message_forwarding.sql` pada project Supabase yang digunakan website sebelum menggunakan penerusan pesan. Gunakan alur migrasi project atau jalankan isi file tersebut melalui SQL Editor Supabase.

RPC `forward_chat_message` memeriksa keanggotaan percakapan sumber dan tujuan, menolak pesan terhapus, menyalin isi dan metadata lampiran dalam satu transaksi, kemudian menggunakan pengiriman pesan yang sudah ada untuk notifikasi. Lampiran sumber tidak dipindahkan. Penerusan tidak mengubah izin Google Drive; penerima tetap memerlukan akses file aslinya.

## Verifikasi

- `node --test tests/chat-presentation.test.cjs`
- `npx tsc --noEmit`
- `npm run build`

Uji integrasi dengan dua akun setelah migrasi: kirim teks berisi URL, kirim gambar/PDF, buka preview dan profil, beri/hapus reaksi, balas thread, teruskan teks dan lampiran ke percakapan lain, serta pastikan isi asli tetap ada. Uji penolakan RPC bagi bukan anggota dan pesan terhapus. Periksa pergantian warna ketika meeting melewati waktu selesai dan pembatas tanggal pada tengah malam WIB.
