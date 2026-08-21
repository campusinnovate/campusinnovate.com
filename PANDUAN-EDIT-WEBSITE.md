# Panduan Edit Manual Website Campus Innovate

## Membuka project

1. Buka Antigravity IDE.
2. Pilih **Open Folder**.
3. Pilih folder `/Users/mac/Desktop/campus-innovate`.

## Menyalakan preview saat mengedit

Buka Terminal di Antigravity, lalu jalankan:

```bash
cd "/Users/mac/Desktop/campus-innovate"
npm run dev
```

Buka `http://localhost:2242/home`. Biarkan Terminal tetap menyala selama mengedit. Perubahan yang disimpan akan muncul otomatis.

## File yang paling sering diedit

- `src/data/homepage.ts`: menu, logo client, daftar layanan, Workfolio, dan daftar community.
- `src/components/public/Homepage.tsx`: teks Home, Vision & Mission, Kawan Inovasi, Instagram, dan Contact.
- `src/app/globals.css`: warna, ukuran, jarak, efek glossy, serta tampilan desktop/mobile.
- `public/assets/site-2026/`: foto dan logo yang tampil di website.

## Cara mengganti teks

Cari kalimat yang terlihat di website, ubah hanya isi di antara tanda kutip atau teks di dalam tag, lalu simpan.

Contoh:

```tsx
<h2>Have an idea worth building?</h2>
```

Menjadi:

```tsx
<h2>Let's build something meaningful.</h2>
```

Jangan menghapus tanda seperti `<div>`, `</div>`, `{}`, `()`, atau koma jika hanya ingin mengganti tulisan.

## Cara mengganti foto atau logo

1. Masukkan file baru ke folder `public/assets/site-2026/`.
2. Gunakan nama file sederhana tanpa spasi, misalnya `wunproq-event.jpg`.
3. Ganti alamat gambarnya di `src/data/homepage.ts` atau `Homepage.tsx`.

Contoh:

```ts
image: '/assets/site-2026/wunproq-event.jpg'
```

## Menghubungkan feed Instagram otomatis

Salin `.env.example` menjadi `.env.local`, lalu isi:

```text
INSTAGRAM_USER_ID=ID_AKUN_INSTAGRAM_PROFESIONAL
INSTAGRAM_ACCESS_TOKEN=TOKEN_DARI_META
```

Token hanya disimpan di `.env.local`. Jangan menuliskan token di `Homepage.tsx`, mengirimkannya lewat chat, atau mengunggah `.env.local` ke GitHub.

Setelah mengubah `.env.local`, hentikan preview dengan `Control + C`, kemudian jalankan lagi `npm run dev`.

## Memeriksa sebelum dianggap selesai

Jalankan:

```bash
npm run build
```

Jika muncul `Compiled successfully`, struktur website aman untuk dilanjutkan.
