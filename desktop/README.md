# Aplikasi macOS Ruang Kawan

## Menjalankan saat pengembangan

Di Terminal pertama jalankan `npm run dev`. Setelah server siap di `http://localhost:2242`, di Terminal kedua jalankan `npm run desktop:open`.

## Membuat aplikasi yang dapat dipasang

Jalankan `npm install`, kemudian `npm run desktop:build`. Berkas `.dmg` untuk Mac akan tersedia di folder `dist/` dan dapat dipindahkan ke folder **Applications**.

Shell desktop memakai `contextIsolation` dan `sandbox`. Antarmuka web tidak diberi akses Node.js atau filesystem secara langsung. Integrasi lokal tersedia melalui `window.ruangKawanDesktop`: pemilih berkas, membuka lokasi berkas, membuka tautan eksternal yang tervalidasi, dan notifikasi macOS.
