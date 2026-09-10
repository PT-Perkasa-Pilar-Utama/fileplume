# Acceptance Criteria — Sprint 2

**Sprint focus:** Unggah, Simpan, dan Batas Penyimpanan  

## User Stories in Scope

- **US-01** Mengunggah Dokumen — Member Team
- **US-46** Pemindaian Malware saat Unggah — Head of Team
- **US-21** Versioning Dokumen Otomatis — Member Team
- **US-03** Mencegah Unggahan Duplikat — Member Team
- **US-42** Menentukan Batas Maksimal Ukuran Dokumen yang Dapat Diunggah — Admin Tenant
- **US-35** Melihat Kapasitas Penyimpanan — Member Team
- **US-38** Melihat Dokumen dalam Tampilan Kartu Visual — Member Team

---

## US-01 — Mengunggah Dokumen (Member Team)

### AC-01.01 — Mengunggah satu file PDF yang valid

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
When Saya menyeret satu file PDF ke area unggah
  And saya melepaskan file tersebut
Then Sistem menampilkan pesan sukses: "File diterima untuk diproses"
  And indikator progres unggahan mencapai 100 persen
  And dokumen muncul di daftar "UPLOADED DOCUMENT" dengan status "Diproses" dalam waktu kurang dari 5 detik
```

### AC-01.02 — Memastikan file yang diunggah tersimpan di daftar dokumen

```gherkin
Given Saya berhasil mengunggah file laporan.pdf
  And status dokumen sudah "Siap"
When Saya mengklik menu Daftar Dokumen di sidebar
  And saya me-refresh halaman
Then File laporan.pdf muncul di daftar dokumen terbaru
  And menampilkan tanggal unggah hari ini
```

### AC-01.03 — Mencoba mengunggah file tipe tidak didukung (Negative Path)

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And tipe file yang didukung adalah PDF, DOCX, XLSX dan TXT
When Saya menyeret file gambar (.JPG) ke area unggah
  And saya melepaskan file tersebut
Then Sistem menampilkan pesan error: "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT"
  And file tidak tersimpan ke dalam sistem
```

### AC-01.04 — Mengunggah beberapa file sekaligus

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And batas maksimal unggahan sekaligus adalah 20 file
When Saya menyeret tiga file DOCX sekaligus ke area unggah
  And saya melepaskan file-file tersebut
Then Sistem menampilkan notifikasi sukses untuk ketiga file
  And ketiga file muncul di daftar "UPLOADED DOCUMENT" dengan status masing-masing
```

### AC-01.05 — Melebihi batas jumlah file sekaligus (Negative Path)

```gherkin
Given Saya seorang Member Team
  And batas maksimal unggahan sekaligus adalah 20 file
When Saya menyeret 25 file sekaligus ke area unggah
Then Sistem menampilkan pesan error: "Maksimal 20 file per unggahan"
  And tidak ada file yang tersimpan
```

### AC-01.06 — Melebihi batas ukuran file (Negative Path)

```gherkin
Given Saya seorang Member Team
  And Admin Tenant telah menetapkan Max File Size sebesar 20 MB
When Saya menyeret file PDF berukuran 25 MB ke area unggah
  And saya melepaskan file tersebut
Then Sistem menampilkan pesan error: "Ukuran file melebihi batas 20 MB"
  And file tidak tersimpan ke dalam sistem
```

### AC-01.07 — Unggahan terputus di tengah proses (Negative Path)

```gherkin
Given Saya seorang Member Team
  And unggahan file sedang berjalan pada 60 persen
When Koneksi jaringan saya terputus
Then Sistem menampilkan pesan error: "Unggahan terputus. Silakan coba lagi"
  And tidak ada dokumen parsial yang tersimpan di daftar dokumen
  And kuota penyimpanan tidak berkurang
```

### AC-01.08 — Sesi berakhir saat unggahan berlangsung (Negative Path)

```gherkin
Given Saya seorang Member Team
  And unggahan file sedang berjalan
  And sesi login saya berakhir
When Sistem mencoba menyelesaikan unggahan
Then Sistem menampilkan pesan: "Sesi Anda telah berakhir. Silakan login kembali"
  And tidak ada dokumen parsial yang tersimpan
```

---

## US-46 — Pemindaian Malware saat Unggah (Head of Team)

### AC-46.01 — File bersih lolos pemindaian

```gherkin
Given Saya seorang Member Team
  And saya mengunggah satu file PDF yang bersih
When Proses pemindaian selesai
Then Dokumen melanjutkan ke tahap pemrosesan berikutnya
  And dokumen menjadi dapat diakses sesuai aturan visibilitas
```

### AC-46.02 — File terinfeksi ditolak (Negative Path)

```gherkin
Given Saya seorang Member Team
  And saya mengunggah file yang terdeteksi mengandung malware
When Proses pemindaian selesai
Then Sistem menampilkan pesan error: "File terdeteksi mengandung malware dan tidak dapat diunggah"
  And file tidak tersimpan ke dalam sistem
  And file tidak pernah dapat diakses oleh pengguna lain
  And kejadian tercatat di audit log
```

---

## US-21 — Versioning Dokumen Otomatis (Member Team)

### AC-21.01 — Mengunggah versi baru melalui aksi eksplisit

```gherkin
Given Saya seorang Member Team
  And dokumen proposal.pdf versi v1 sudah ada di sistem
  And saya berada di halaman detail dokumen tersebut
When Saya mengklik tombol "Unggah Versi Baru"
  And saya memilih file revisi dengan konten berbeda
  And saya mengklik tombol "Simpan"
Then Sistem menetapkan nomor versi v2
  And di daftar dokumen tetap tampil 1 item proposal.pdf yang menunjukkan versi terbaru
```

### AC-21.02 — Mengakses versi lama melalui version picker

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman detail dokumen proposal.pdf
  And dokumen memiliki 3 versi (v1, v2, v3)
When Saya mengklik dropdown version picker
  And saya memilih versi "v1"
Then Viewer menampilkan isi dokumen versi v1
  And tombol "Download" mengunduh file versi v1
```

### AC-21.03 — Menolak versi baru dengan konten identik (Negative Path)

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman detail dokumen proposal.pdf versi v1
When Saya mengklik tombol "Unggah Versi Baru"
  And saya memilih file dengan konten yang identik dengan versi v1
Then Sistem menampilkan pesan error: "Isi file sama dengan versi yang sudah ada"
  And tidak ada versi baru yang dibuat
```

### AC-21.04 — Dua pengguna mengunggah versi baru secara bersamaan

```gherkin
Given Saya dan rekan saya membuka dokumen yang sama
  And kami mengunggah versi baru pada saat yang bersamaan
When Kedua unggahan diproses
Then Kedua versi tersimpan dengan nomor versi berurutan tanpa duplikasi
  And version picker menampilkan kedua versi tersebut
```

---

## US-03 — Mencegah Unggahan Duplikat (Member Team)

### AC-03.01 — Mencoba mengunggah file duplikat (Negative Path)

```gherkin
Given Saya seorang Member Team
  And file laporan-keuangan.pdf sudah ada di tenant saya
When Saya menyeret file lain dengan konten yang sama persis (hash identik) ke area unggah
  And saya melepaskan file tersebut
Then Sistem menampilkan pesan error: "File ini sudah ada di sistem"
  And pesan menampilkan tautan ke dokumen yang sudah ada
  And file duplikat tidak tersimpan ke dalam sistem
```

### AC-03.02 — Mengunggah file bukan duplikat saat file lain sudah ada

```gherkin
Given Saya seorang Member Team
  And file laporan-keuangan.pdf sudah ada di sistem
When Saya menyeret file presentasi-baru.pdf dengan konten yang berbeda ke area unggah
  And saya melepaskan file tersebut
Then Sistem menampilkan pesan sukses: "File diterima untuk diproses"
  And file baru tersimpan di daftar dokumen
```

### AC-03.03 — Nama file sama dengan konten berbeda menjadi dokumen terpisah

```gherkin
Given Saya seorang Member Team
  And rekan saya sudah mengunggah dokumen bernama laporan.pdf
When Saya menyeret file laporan.pdf milik saya dengan konten yang berbeda ke area unggah
  And saya melepaskan file tersebut
Then Sistem menyimpan file saya sebagai dokumen baru yang terpisah
  And dokumen milik rekan saya tidak berubah dan tidak menjadi versi lama
```

### AC-03.04 — Dua pengguna mengunggah konten identik secara bersamaan

```gherkin
Given Saya dan rekan saya berada di tenant yang sama
  And kami mengunggah file dengan konten identik pada saat yang bersamaan
When Kedua unggahan diproses
Then Hanya satu dokumen yang tersimpan di sistem
  And unggahan kedua menampilkan pesan: "File ini sudah ada di sistem"
```

---

## US-42 — Menentukan Batas Maksimal Ukuran Dokumen yang Dapat Diunggah (Admin Tenant)

### AC-42.01 — Melihat daftar parameter konfigurasi

```gherkin
Given Saya seorang Admin Tenant
  And saya telah berhasil login
When Saya menekan menu "Configuration"
Then Sistem menampilkan halaman "Configuration" berisi tabel dengan kolom:
  - Parameter
  - Nilai
  - Satuan
  - Nilai Default
  And tabel berisi parameter:
  - Max File Size (MB, default 20)
  - Batas Waktu Konfirmasi Kategori (hari, default 7)
  - Kuota Penyimpanan (GB)
  And terdapat tombol edit di sebelah kanan tiap baris
```

### AC-42.02 — Mengubah nilai parameter

```gherkin
Given Saya seorang Admin Tenant
  And saya berada di halaman Configuration
  And parameter "Max File Size" bernilai 20
When Saya mengklik tombol edit pada baris tersebut
  And saya mengubah nilai menjadi 50
  And saya mengklik ikon centang
Then Sistem menampilkan pesan: "Konfigurasi berhasil disimpan"
  And baris "Max File Size" menampilkan nilai 50
  And perubahan tercatat di audit log
```

### AC-42.03 — Menolak nilai yang tidak valid (Negative Path)

```gherkin
Given Saya seorang Admin Tenant
  And saya berada di halaman Configuration
When Saya mengubah nilai "Max File Size" menjadi "dua puluh"
  And saya mengklik ikon centang
Then Sistem menampilkan pesan error: "Nilai harus berupa angka"
  And nilai parameter tidak berubah
```

### AC-42.04 — Menolak nilai di luar rentang yang diizinkan (Negative Path)

```gherkin
Given Saya seorang Admin Tenant
  And rentang yang diizinkan untuk "Max File Size" adalah 1 sampai 200 MB
When Saya mengubah nilai menjadi 500
  And saya mengklik ikon centang
Then Sistem menampilkan pesan error: "Nilai harus antara 1 dan 200 MB"
  And nilai parameter tidak berubah
```

### AC-42.05 — Mengembalikan parameter ke nilai default

```gherkin
Given Saya seorang Admin Tenant
  And parameter "Max File Size" bernilai 50
When Saya mengklik opsi "Kembalikan ke Default" pada baris tersebut
Then Nilai parameter kembali menjadi 20
  And sistem menampilkan pesan: "Konfigurasi berhasil disimpan"
```

---

## US-35 — Melihat Kapasitas Penyimpanan (Member Team)

### AC-35.01 — Melihat informasi kapasitas penyimpanan

```gherkin
Given Saya seorang Member Team
  And saya telah masuk ke dalam sistem
  And total penyimpanan yang telah terpakai adalah 25% dari kuota
When Saya melihat informasi kapasitas penyimpanan yang tersedia di antarmuka
Then Sistem menampilkan indikator kapasitas penyimpanan berisi persentase penggunaan (25%)
  And indikator visual (progress bar) yang merepresentasikan proporsi pemakaian
```

### AC-35.02 — Mendapat peringatan kapasitas hampir penuh

```gherkin
Given Saya seorang Member Team
  And total penyimpanan yang telah terpakai mencapai 80% atau lebih dari kuota
When Saya melihat informasi kapasitas penyimpanan
Then Indikator penyimpanan berubah warna menjadi kuning atau oranye (warning)
  And sistem menampilkan pesan peringatan: "Kapasitas penyimpanan hampir penuh"
```

### AC-35.03 — Upload ditolak saat kapasitas penuh (Negative Path)

```gherkin
Given Saya seorang Member Team
  And total penyimpanan telah mencapai 100% dari kuota
When Saya menyeret satu file PDF ke area unggah
  And saya melepaskan file tersebut
Then Sistem menampilkan pesan error: "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan"
  And file tidak tersimpan ke dalam sistem
```

### AC-35.04 — Kuota habis di tengah unggahan beberapa file (Negative Path)

```gherkin
Given Saya seorang Member Team
  And sisa kuota hanya cukup untuk dua dari tiga file yang saya unggah
When Saya menyeret tiga file sekaligus ke area unggah
Then Dua file pertama tersimpan
  And file ketiga ditolak dengan pesan: "Kapasitas penyimpanan penuh"
  And sistem menampilkan ringkasan: "2 dari 3 file berhasil diunggah"
```

---

## US-38 — Melihat Dokumen dalam Tampilan Kartu Visual (Member Team)

### AC-38.01 — Melihat dokumen terbaru sebagai kartu visual

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And terdapat beberapa dokumen yang sudah diunggah
When Saya melihat section daftar dokumen yang telah diunggah
Then Setiap dokumen ditampilkan sebagai kartu visual berisi:
  - ikon tipe file (PDF/DOCX/XLSX/TXT)
  - judul dokumen
  - tanggal unggah
  - nama pengunggah
  - status pemrosesan
```

### AC-38.02 — Navigasi dari kartu ke detail dokumen

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And sebuah dokumen ditampilkan sebagai kartu
When Saya mengklik kartu dokumen tersebut
Then Halaman detail dokumen terbuka menampilkan metadata, extracted fields, dan preview dokumen tersebut
```

### AC-38.03 — Dasbor tanpa dokumen

```gherkin
Given Saya seorang Member Team
  And tenant saya belum memiliki dokumen sama sekali
When Saya membuka halaman Dasbor
Then Sistem menampilkan pesan: "Belum ada dokumen. Seret file ke area unggah untuk memulai"
```
