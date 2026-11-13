# OpenWA di Google Cloud

Konfigurasi pilot OpenWA satu nomor WhatsApp Business pada Compute Engine. Target awal memakai kuota Free Tier: VM `e2-micro`, disk standar maksimal 30 GB, dan region `us-central1`, `us-east1`, atau `us-west1`. Kuota Compute Engine ini mensyaratkan Cloud Billing aktif; pemakaian yang melewati batas Free Tier dapat ditagih. Pasang budget alert sebelum membuat resource. Budget alert hanya memberi notifikasi, bukan mematikan resource otomatis.

## Catatan kapasitas dan biaya

- `e2-micro` memiliki 1 GB RAM. Ini cocok untuk uji coba satu sesi, tetapi sempit untuk OpenWA + Chromium; bisa lambat atau restart saat beban tinggi. Jika butuh stabil, naikkan RAM setelah menyetujui biaya.
- Jangan pasang external IPv4 pada VM. IP publik yang sedang digunakan dihargai sekitar US$0.005/jam (sekitar US$3.65 untuk bulan 730 jam). Konfigurasi ini memakai Cloudflare Tunnel untuk menghindari biaya IPv4.
- Cloudflare Tunnel butuh akun Cloudflare dan hostname/domain yang DNS-nya dikelola Cloudflare. Jika belum ada, jangan mengganti nameserver domain produksi tanpa rencana migrasi.
- Traffic keluar Google Cloud di atas kuota gratis dapat dikenai biaya. Pantau pemakaian.
- Cloudflare Tunnel token adalah rahasia. Jangan masukkan ke GitHub atau chat.

## 1. Buat VM

Di Google Cloud Console:

1. Pilih/buat project dan aktifkan Compute Engine. Hubungkan billing hanya bila siap menerima kemungkinan biaya di luar batas gratis.
2. Buat VM non-preemptible `e2-micro` di salah satu region Free Tier yang didukung: `us-central1`, `us-east1`, atau `us-west1`.
3. Pilih Ubuntu 24.04 LTS, boot disk Standard persistent disk 30 GB atau kurang.
4. Jangan tetapkan external IPv4. Gunakan SSH lewat tombol SSH browser di Console atau IAP.
5. Buat budget alert untuk project sebelum menyalakan workload.

## 2. Siapkan Cloudflare Tunnel

Buat remotely-managed tunnel di Cloudflare Zero Trust. Tambahkan public hostname, misalnya `wa-api.campusinnovate.com`, dan arahkan service ke `http://openwa-api:2785`. Catat tunnel token untuk disimpan hanya di file `.env` pada VM.

Sebelum membuka endpoint ke publik, amankan dashboard/API dengan Cloudflare Access atau kebijakan akses lain. OpenWA API key tetap wajib disimpan sebagai secret di sisi server Kawan; jangan pernah taruh di browser.

## 3. Install Docker dan jalankan OpenWA

Masuk ke VM melalui SSH, lalu:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo mkdir -p /opt/openwa
sudo chown "$USER":"$USER" /opt/openwa
cd /opt/openwa
git clone https://github.com/rmyndharis/OpenWA.git app
git clone --depth 1 --branch codex/openwa-gcp-setup https://github.com/campusinnovate/campusinnovate.com.git campus
cp campus/deploy/openwa-gcp/docker-compose.override.yml app/docker-compose.override.yml
cp campus/deploy/openwa-gcp/.env.example app/.env
```

Edit `app/.env` di VM, masukkan tunnel token, lalu kunci permission file:

```bash
chmod 600 app/.env
cd /opt/openwa/app
docker compose pull
docker compose up -d
docker compose ps
```

Jangan menyalin tunnel token atau API key ke issue, commit, log, atau chat.

## 4. Hubungkan WhatsApp Business

Buka hostname yang sudah dibuat, masuk ke OpenWA, buat satu session, lalu scan QR melalui WhatsApp Business → Perangkat tertaut. Data session tersimpan pada volume Docker OpenWA dan akan dipulihkan setelah container/VM restart.

API key admin dibuat saat first boot dan tersimpan di `/app/data/.api-key`:

```bash
sudo docker exec openwa-api cat /app/data/.api-key
```

Simpan sebagai secret server-side. Setelah VM dan hostname tersedia, baru sambungkan endpoint ini ke Edge Function Kawan Inovasi. Pengiriman pesan dari Kawan belum aktif oleh konfigurasi ini saja.

## Pembersihan resource

Untuk menghentikan biaya, hentikan/hapus VM dan resource yang tidak diperlukan, serta lepaskan disk/tunnel bila memang sudah tidak dipakai. Menghentikan VM tidak selalu menghentikan biaya disk atau resource terpisah.
