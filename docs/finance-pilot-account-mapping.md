# Usulan konfigurasi awal Finance Pilot

Keputusan owner pada 7 Oktober 2026: transaksi **Rp1.000.000 ke atas** wajib approval CEO; tahun fiskal **Januari–Desember**. Ini sudah diterapkan pada kode development dan fixture, bukan kebijakan aktif produksi. Perubahan threshold berikutnya tetap melalui versi kebijakan COO → CEO → COO apply.

Mapping di bawah adalah usulan review berdasarkan katalog COA produksi yang telah dibaca. Tidak ada akun atau saldo produksi yang dibuat/diubah. Kode baru perlu dicek ulang sebelum penerapan dan ditambahkan melalui approval akun. Jangan mengganti nama/klasifikasi akun lama hanya untuk menyesuaikan pilot.

| Mapping | Akun usulan | Dasar / hal yang harus ditinjau |
| --- | --- | --- |
| Trade AR | `2000` Piutang Usaha (existing, Aset) | Identitas COA cocok; invoice/receipt pilot menggunakan ledger accrual |
| Related-party AR | `2001` Piutang Pihak Terkait (existing, Aset) | Wajib pihak terkait, due date dan approval |
| Fixed asset | `7000` Pembelian Aset Tetap (existing, Aset) | Pilot menghubungkan posting ke finance_assets existing; tidak mengubah aset historis |
| Trade AP | `8002` Pengakuan Kewajiban / Utang (existing, Kewajiban) | Vendor bill/payment memakai akun kontrol yang sama; pembayaran mengurangi AP, bukan expense kedua kali |
| Cash/bank | `1010` (usulan baru, Aset) | Katalog existing belum memiliki akun cash ledger murni. Nama dan bank yang menjadi rekening pilot harus dipilih; 9100 snapshot bukan ledger cash |
| Customer advance | `8100` (usulan baru, Kewajiban) | Uang muka bukan revenue; settlement advance belum lengkap |
| Taxes payable | `8101` (usulan baru, Kewajiban) | Nilai pajak manual tervalidasi; tidak menetapkan aturan pajak otomatis |
| Retained earnings | `6100` (usulan baru, Ekuitas) | Saldo laba; bukan penerimaan modal 6000 atau pembayaran distribusi 6001 |
| Distribution payable | `8102` (usulan baru, Kewajiban) | Pisahkan dari 8003 yang namanya memuat 40%; jangan mengasumsikan rasio 40% sebagai keputusan PRD terbaru |

Revenue mapping enam service line tetap mengikuti finance_next_service_lines existing dan COA Pendapatan yang valid; tidak dibuat pipeline baru. Saldo awal/cutover dan bank sebenarnya belum diputuskan. Tidak ada opening balance otomatis, penyalinan bank snapshot, atau pengujian menggunakan transaksi produksi.

Konfigurasi usulan yang dapat diajukan setelah akun baru disetujui dan rekening kas dipilih:

```json
{
  "approval_threshold": 1000000,
  "fiscal_start": 1,
  "accounts": {
    "cash": "1010",
    "receivable": "2000",
    "payable": "8002",
    "advance": "8100",
    "tax_payable": "8101",
    "retained_earnings": "6100",
    "distribution_payable": "8102",
    "fixed_asset": "7000",
    "related_receivable": "2001"
  }
}
```

Ini bukan migration seed dan belum dapat diposting langsung: akun kontrol baru harus benar-benar ada/aktif, mapping tidak boleh memakai satu akun untuk dua saldo, alasan perubahan wajib, CEO menyetujui dan COO menerapkan. Kebijakan distribusi serta pembagian profit tetap belum ditetapkan.
