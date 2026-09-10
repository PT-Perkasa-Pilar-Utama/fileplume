# Acceptance Criteria — Sprint 5

**Sprint focus:** Tata Kelola, Unduhan, dan Pemantauan  

## User Stories in Scope

- **US-10** Mengunduh Dokumen — Member Team
- **US-11** Mengunduh Dokumen Massal — Member Team
- **US-14** Mengatur Perizinan Dokumen — Head of Team
- **US-13** Melihat Audit Trail — Head of Team
- **US-12** Melihat Dasbor Analitik — Head of Team
- **US-36** Mengganti Tema Antarmuka — Member Team

---

## US-10 — Mengunduh Dokumen (Member Team)

### AC-10.01 — Mengunduh single dokumen dari halaman preview

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman preview dokumen
  And kategori dokumen berstatus "Active" pada perizinan download
When Saya mengklik tombol "Download"
Then File terunduh ke perangkat lokal dengan format asli (PDF/DOCX/dll)
  And satu record unduhan tercatat di audit log
```

### AC-10.02 — Mencoba mengunduh dokumen pada kategori yang berstatus nonaktif (Negative Path)

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman preview dokumen pada kategori "Offering Letter"
  And kategori "Offering Letter" berstatus "Inactive" pada perizinan download
When Saya mengarahkan kursor dan mengklik tombol "Download"
Then Tombol "Download" dalam kondisi nonaktif (disabled)
  And sistem menampilkan pesan warning: "Kategori ini tidak diizinkan untuk diunduh"
  And tidak ada file yang terunduh
```

### AC-10.03 — Menolak unduhan melalui akses endpoint langsung (Negative Path)

```gherkin
Given Saya seorang Member Team
  And dokumen berada pada kategori berstatus "Inactive" pada perizinan download
When Saya mengakses endpoint unduhan dokumen tersebut secara langsung tanpa melalui antarmuka
Then Sistem mengembalikan status 403
  And tidak ada file yang terunduh
  And upaya unduhan tercatat di audit log
```

### AC-10.04 — Klik ganda pada tombol Download

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman preview dokumen yang diizinkan untuk diunduh
When Saya mengklik tombol "Download" dua kali secara cepat
Then Hanya satu file yang terunduh
  And hanya satu record unduhan tercatat di audit log
```

---

## US-11 — Mengunduh Dokumen Massal (Member Team)

### AC-11.01 — Mengunduh dokumen secara massal

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And ketiga dokumen berada pada kategori yang diizinkan untuk diunduh
When Saya mencentang checkbox pada tiga dokumen
  And saya mengklik tombol "Download Selected"
Then Sistem menggabungkan ketiga file ke dalam satu file .zip
  And file .zip terunduh ke perangkat lokal
  And tiga record unduhan tercatat di audit log
```

### AC-11.02 — Sebagian dokumen tidak diizinkan untuk diunduh (Negative Path)

```gherkin
Given Saya seorang Member Team
  And saya mencentang tiga dokumen
  And satu di antaranya berada pada kategori berstatus "Inactive"
When Saya mengklik tombol "Download Selected"
Then Sistem menampilkan pesan: "1 dokumen tidak diizinkan untuk diunduh dan tidak disertakan"
  And file .zip berisi dua dokumen yang diizinkan
  And dua record unduhan tercatat di audit log
```

### AC-11.03 — Melebihi batas jumlah dokumen unduhan massal (Negative Path)

```gherkin
Given Saya seorang Member Team
  And batas maksimal unduhan massal adalah 50 dokumen
When Saya mencentang 60 dokumen
  And saya mengklik tombol "Download Selected"
Then Sistem menampilkan pesan: "Maksimal 50 dokumen per unduhan massal"
  And tidak ada file .zip yang dibuat
```

---

## US-14 — Mengatur Perizinan Dokumen (Head of Team)

### AC-14.01 — Mengaktifkan perizinan download pada kategori

```gherkin
Given Saya seorang Head of Team
  And saya berada di menu Permission Category
When Saya mengklik toggle switch dari status "Inactive" menjadi "Active" pada kategori "Reporting"
Then Toggle berubah menjadi status Active
  And Member Team sekarang dapat melakukan download dokumen pada kategori "Reporting"
  And perubahan perizinan tercatat di audit log
```

### AC-14.02 — Menonaktifkan perizinan download pada kategori

```gherkin
Given Saya seorang Head of Team
  And kategori "Offering Letter" berstatus "Active"
When Saya mengklik toggle switch menjadi "Inactive"
Then Toggle berubah menjadi status Inactive
  And permintaan unduhan pada kategori tersebut ditolak dengan status 403 sejak saat itu
```

### AC-14.03 — Member Team tidak dapat mengubah perizinan (Negative Path)

```gherkin
Given Saya seorang Member Team
When Saya mengakses endpoint pengubahan perizinan kategori secara langsung
Then Sistem mengembalikan status 403
  And perizinan kategori tidak berubah
  And upaya tersebut tercatat di audit log
```

---

## US-13 — Melihat Audit Trail (Head of Team)

### AC-13.01 — Melihat log unduhan di halaman Audit Trail

```gherkin
Given Saya seorang Head of Team
  And saya berada di halaman Dasbor
When Saya mengklik menu "Audit Trail" di sidebar
Then Halaman Audit Trail menampilkan tabel log dengan kolom:
  - Siapa (User)
  - Apa (Nama Dokumen)
  - Aksi
  - Kapan (Waktu)
```

### AC-13.02 — Log mencatat upaya akses yang ditolak

```gherkin
Given Saya seorang Head of Team
  And seorang Member Team mencoba mengunduh dokumen pada kategori berstatus "Inactive"
When Saya membuka halaman Audit Trail
Then Tabel log menampilkan record dengan aksi "Unduhan ditolak" beserta nama pengguna dan waktu
```

### AC-13.03 — Audit Trail pada tenant tanpa aktivitas

```gherkin
Given Saya seorang Head of Team
  And belum ada aktivitas apa pun di tenant saya
When Saya membuka halaman Audit Trail
Then Sistem menampilkan pesan: "Belum ada aktivitas tercatat"
```

---

## US-12 — Melihat Dasbor Analitik (Head of Team)

### AC-12.01 — Melihat metrik total dokumen di dasbor analitik

```gherkin
Given Saya seorang Head of Team
  And saya berada di halaman Analitik
When Saya melihat dasbor analitik
Then Kartu data menampilkan jumlah total dokumen di sistem
  And kartu data menampilkan jumlah dokumen yang diunggah dalam 7 hari terakhir
```

### AC-12.02 — Melihat metrik pencarian dan penemuan dokumen

```gherkin
Given Saya seorang Head of Team
  And saya berada di halaman Analitik
When Saya melihat dasbor analitik
Then Kartu data menampilkan:
  - jumlah pencarian dalam 7 hari terakhir
  - persentase pencarian yang tidak menghasilkan hasil
  - jumlah dokumen yang dibuka dalam 7 hari terakhir
```

### AC-12.03 — Melihat metrik kualitas hasil AI

```gherkin
Given Saya seorang Head of Team
  And saya berada di halaman Analitik
When Saya melihat dasbor analitik
Then Kartu data menampilkan persentase kategori saran yang diubah pengguna dalam 30 hari terakhir
  And menampilkan persentase field hasil ekstraksi yang dikoreksi pengguna
```

### AC-12.04 — Dasbor analitik pada tenant baru

```gherkin
Given Saya seorang Head of Team
  And tenant saya belum memiliki dokumen sama sekali
When Saya membuka halaman Analitik
Then Seluruh kartu data menampilkan nilai 0
  And sistem menampilkan pesan: "Belum ada aktivitas untuk ditampilkan"
```

---

## US-36 — Mengganti Tema Antarmuka (Member Team)

### AC-36.01 — Mengaktifkan mode gelap

```gherkin
Given Saya seorang Member Team
  And antarmuka sedang menampilkan tema terang (light mode)
When Saya mengklik tombol "Dark" untuk mengganti tema
Then Seluruh antarmuka berubah ke tema gelap (dark mode)
  And teks tombol berubah menjadi "Light"
  And perubahan tema berlaku untuk seluruh halaman
```

### AC-36.02 — Preferensi tema tersimpan

```gherkin
Given Saya seorang Member Team
  And saya telah mengaktifkan mode gelap (dark mode)
When Saya menutup browser
  And saya membuka kembali aplikasi Archiva
Then Antarmuka tetap menampilkan tema gelap sesuai preferensi terakhir yang dipilih
```
