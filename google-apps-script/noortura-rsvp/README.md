# Noortura RSVP Apps Script

Backend Google Apps Script untuk RSVP Noortura Open House 2026. Kode ini:

- menulis tamu ber-ID ke tab `Guest List`;
- menulis pendaftar umum ke tab `RSVP Publik`;
- mempertahankan kapasitas `8` keluarga per slot;
- menonaktifkan slot penuh pada website;
- mengirim hasil sukses/gagal kembali ke website tanpa Supabase.

## Deploy

1. Tempel isi `Code.gs` ke proyek Apps Script yang terhubung dengan spreadsheet Noortura.
2. Pilih **Deploy → Manage deployments**.
3. Edit deployment aktif, pilih **New version**, lalu **Deploy**.
4. Pertahankan deployment ID yang sama agar URL `/exec` di website tidak berubah.

Jangan membuat deployment baru kecuali URL di `public/noortura/index.html` juga akan diganti.
