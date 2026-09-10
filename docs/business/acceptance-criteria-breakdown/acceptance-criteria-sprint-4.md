# Acceptance Criteria — Sprint 4

**Sprint focus:** Pencarian dan Penemuan Dokumen  

## User Stories in Scope

- **US-07** Mencari Judul & Metadata Dokumen — Member Team
- **US-33** Mencari Teks di Dalam Isi Berkas (Deep Content Search) — Member Team
- **US-34** Memfilter Dokumen Berdasarkan Kategori — Member Team
- **US-37** Memfilter Data pada Tabel (Lokal Filter) — Member Team
- **US-39** Menavigasi Halaman Data dengan Paginasi — Member Team
- **US-08** Menemukan Dokumen Terkait — Member Team
- **US-09** Melihat Preview Dokumen — Member Team

---

## US-07 — Mencari Judul & Metadata Dokumen (Member Team)

### AC-07.01 — Pencarian berhasil menemukan dokumen

```gherkin
Given Saya seorang Member Team
  And ada dokumen yang berisi kata "API" di dalam sistem
  And tenant saya berisi 100.000 dokumen
  And terdapat 20 pencarian bersamaan pada saat yang sama
When Saya mengklik bar pencarian
  And saya mengetik "API"
  And saya menekan tombol Enter
Then Setidaknya satu dokumen relevan muncul di hasil pencarian
  And setiap item menampilkan nama file dan cuplikan teks yang cocok
  And hasil muncul dalam waktu kurang dari 3 detik
```

### AC-07.02 — Pencarian tidak menemukan hasil

```gherkin
Given Saya seorang Member Team
  And tidak ada dokumen yang berisi kata "xyzabc"
When Saya mengklik bar pencarian
  And saya mengetik "xyzabc"
  And saya menekan tombol Enter
Then Sistem menampilkan pesan: "Tidak ada hasil yang ditemukan"
```

### AC-07.03 — Kata kunci terlalu pendek (Negative Path)

```gherkin
Given Saya seorang Member Team
  And panjang minimal kata kunci adalah 2 karakter
When Saya mengetik "a" di bar pencarian
  And saya menekan tombol Enter
Then Sistem menampilkan pesan: "Masukkan minimal 2 karakter untuk mencari"
  And sistem tidak menjalankan pencarian
```

---

## US-33 — Mencari Teks di Dalam Isi Berkas (Deep Content Search) (Member Team)

### AC-33.01 — Pencarian kata kunci di dalam isi konten berkas

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And dokumen kontrak-kerjasama.pdf yang berisi kata "klausul-kerahasiaan" di halaman 15 sudah terindeks
  And tenant saya berisi 100.000 dokumen
  And terdapat 20 pencarian bersamaan pada saat yang sama
When Saya mengklik bar pencarian
  And saya mengetik "klausul-kerahasiaan"
  And saya menekan tombol Enter
Then Berkas kontrak-kerjasama.pdf muncul di daftar hasil pencarian
  And menampilkan cuplikan teks halaman 15 yang disorot (highlighted)
  And waktu respons pencarian kurang dari 3 detik
```

### AC-33.02 — Sorotan pencocokan kata kunci pada Document Viewer

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman hasil pencarian teks mendalam
When Saya mengklik dokumen kontrak-kerjasama.pdf dari hasil pencarian
Then Document Viewer terbuka dan langsung melompat ke posisi teks yang cocok (halaman untuk PDF / paragraf untuk DOCX/TXT)
  And kata kunci ditandai dengan warna kuning (highlighted)
```

### AC-33.03 — Dokumen belum selesai terindeks

```gherkin
Given Saya seorang Member Team
  And dokumen yang saya unggah masih berstatus "Diproses"
When Saya mencari kata kunci yang ada di dalam isi dokumen tersebut
Then Dokumen tersebut belum muncul di hasil pencarian
  And sistem menampilkan catatan: "Sebagian dokumen masih diproses dan belum dapat dicari"
```

---

## US-34 — Memfilter Dokumen Berdasarkan Kategori (Member Team)

### AC-34.01 — Memfilter dokumen berdasarkan satu kategori

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman yang menampilkan daftar dokumen
  And terdapat dokumen dengan berbagai kategori
When Saya memilih kategori "Proposal" pada filter kategori
Then Hanya dokumen dengan kategori "Proposal" yang ditampilkan
  And dokumen dari kategori lain tidak terlihat
```

### AC-34.02 — Menampilkan kembali semua dokumen

```gherkin
Given Saya seorang Member Team
  And saya sedang memfilter dokumen pada kategori "Proposal"
When Saya memilih opsi untuk menampilkan semua kategori
Then Seluruh dokumen dari semua kategori ditampilkan kembali
```

### AC-34.03 — Filter kategori pada kondisi kosong

```gherkin
Given Saya seorang Member Team
  And tidak ada dokumen dengan kategori "Financial" di dalam sistem
When Saya memilih kategori "Financial" pada filter kategori
Then Sistem menampilkan pesan: "Tidak ada dokumen pada kategori ini"
```

---

## US-37 — Memfilter Data pada Tabel (Lokal Filter) (Member Team)

### AC-37.01 — Memfilter tabel daftar dokumen berdasarkan kata kunci judul

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman daftar dokumen
  And terdapat dokumen bernama bds-requirement.xlsx di dalam tabel
When Saya mengetik "req" di kolom filter tabel
Then Tabel hanya menampilkan dokumen yang judulnya mengandung kata "req"
  And dokumen yang tidak relevan tersembunyi
```

### AC-37.02 — Memfilter data di halaman Audit Trail

```gherkin
Given Saya seorang Head of Team
  And saya berada di halaman Audit Trail
  And terdapat log aktivitas dari user "Zayd Almasi"
When Saya mengetik "Zayd" di kolom filter halaman Audit Trail
Then Tabel hanya menampilkan record yang mengandung kata "Zayd" pada kolom User atau Document Name
  And record lain tersembunyi
```

### AC-37.03 — Filter tabel tidak menemukan hasil

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman daftar dokumen
When Saya mengetik "xyznotexist" di kolom filter tabel
Then Tabel menampilkan pesan: "Tidak ada dokumen yang sesuai"
```

---

## US-39 — Menavigasi Halaman Data dengan Paginasi (Member Team)

### AC-39.01 — Melihat informasi jumlah data dan paginasi

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman yang menampilkan 123 record data
  And jumlah baris per halaman adalah 10
When Saya melihat kontrol paginasi pada halaman tersebut
Then Sistem menampilkan informasi jumlah data: "Menampilkan 1 - 10 dari 123 data"
  And menampilkan kontrol navigasi halaman:
  - Sebelumnya
  - 1, 2, 3
  - Berikutnya
```

### AC-39.02 — Berpindah ke halaman berikutnya

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman 1 dari 13 halaman
  And halaman saat ini menampilkan record 1-10
When Saya mengklik tombol "Berikutnya" atau mengklik nomor halaman "2"
Then Tabel menampilkan record 11-20
  And informasi berubah menjadi "Menampilkan 11 - 20 dari 123 data"
  And nomor halaman "2" menjadi aktif (highlighted)
```

### AC-39.03 — Hasil filter kurang dari satu halaman

```gherkin
Given Saya seorang Member Team
  And saya memfilter data sehingga tersisa 4 record
When Saya melihat kontrol paginasi
Then Sistem menampilkan "Menampilkan 1 - 4 dari 4 data"
  And kontrol navigasi halaman tidak ditampilkan
```

---

## US-08 — Menemukan Dokumen Terkait (Member Team)

### AC-08.01 — Menampilkan daftar dokumen terkait berdasarkan kategori/tag

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman detail dokumen bds-requirement.xlsx dengan kategori "Technical Spec"
  And terdapat dokumen lain dengan kategori atau tag yang sama di dalam sistem
When Saya melihat section informasi dokumen terkait pada halaman detail
Then Section "Dokumen Terkait" menampilkan maksimal 5 dokumen yang memiliki kesamaan kategori atau tag
  And setiap item menampilkan nama file dan nama pengunggah
```

### AC-08.02 — Tidak ada dokumen terkait

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman detail sebuah dokumen
  And tidak ada dokumen lain dengan kategori atau tag yang sama
When Saya melihat section informasi dokumen terkait pada halaman detail
Then Section "Dokumen Terkait" menampilkan pesan: "Tidak ada dokumen terkait"
```

### AC-08.03 — Navigasi ke dokumen terkait

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman detail dokumen
  And section "Dokumen Terkait" menampilkan dokumen technical-proposal-test.pdf
When Saya mengklik nama file technical-proposal-test.pdf pada daftar dokumen terkait
Then Halaman detail dokumen technical-proposal-test.pdf terbuka dengan metadata dan preview-nya
```

### AC-08.04 — Dokumen terkait tidak menampilkan dokumen tenant lain

```gherkin
Given Saya seorang Member Team dari Tenant A
  And Tenant B memiliki dokumen dengan kategori yang sama
When Saya melihat section "Dokumen Terkait"
Then Hanya dokumen milik Tenant A yang ditampilkan
```

---

## US-09 — Melihat Preview Dokumen (Member Team)

### AC-09.01 — Melihat preview dokumen PDF tanpa download

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
When Saya mengklik nama dokumen PDF di daftar dokumen
Then Viewer menampilkan seluruh halaman dokumen
  And tidak ada file yang terunduh ke perangkat lokal
```

### AC-09.02 — Melihat preview dokumen DOCX, XLSX dan TXT

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
When Saya mengklik nama dokumen DOCX di daftar dokumen
Then Viewer menampilkan isi dokumen hasil konversi di sisi server
  And tidak ada file yang terunduh ke perangkat lokal
```

### AC-09.03 — Preview gagal dimuat (Negative Path)

```gherkin
Given Saya seorang Member Team
  And dokumen berstatus "Gagal" dengan alasan isi tidak dapat dibaca
When Saya mengklik nama dokumen tersebut
Then Viewer menampilkan pesan: "Preview tidak tersedia untuk dokumen ini"
  And tombol Download tetap dapat digunakan sesuai perizinan kategorinya
```
