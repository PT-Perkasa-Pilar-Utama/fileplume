# Acceptance Criteria — Sprint 3

**Sprint focus:** Klasifikasi Otomatis dan Metadata  

## User Stories in Scope

- **US-44** Pipeline Pemrosesan Dokumen — Member Team
- **US-45** Mengelola Daftar Kategori — Head of Team
- **US-02** Menentukan Kategori Tiap Dokumen — Member Team
- **US-06** Pengkategorian & Klasifikasi Dokumen Otomatis via AI — Member Team
- **US-04** Melihat Metadata Dokumen — Member Team
- **US-05** Memfilter Hasil Pencarian dengan Tag Otomatis — Member Team
- **US-47** Mengoreksi Hasil Ekstraksi AI — Member Team

---

## US-44 — Pipeline Pemrosesan Dokumen (Member Team)

### AC-44.01 — Status pemrosesan tampil pada dokumen

```gherkin
Given Saya seorang Member Team
  And saya baru saja mengunggah satu file PDF
When Saya melihat dokumen tersebut di daftar dokumen
Then Dokumen menampilkan salah satu status:
  - Antre
  - Diproses
  - Siap
  - Gagal
  And status berubah menjadi "Siap" setelah seluruh pemrosesan selesai
```

### AC-44.02 — Kegagalan sementara diulang otomatis

```gherkin
Given Saya seorang Member Team
  And dokumen saya sedang diproses
  And layanan AI mengembalikan kegagalan sementara
When Sistem mendeteksi kegagalan tersebut
Then Sistem mengulang pemrosesan secara otomatis maksimal 3 kali dengan jeda bertingkat
  And status dokumen tetap "Diproses" selama pengulangan berlangsung
```

### AC-44.03 — Kegagalan permanen ditandai dan dokumen tetap dapat digunakan

```gherkin
Given Saya seorang Member Team
  And dokumen saya gagal diproses setelah seluruh pengulangan habis
When Saya melihat dokumen tersebut di daftar dokumen
Then Dokumen menampilkan status "Gagal" beserta alasan kegagalan
  And dokumen tetap dapat dibuka di viewer
  And dokumen tetap dapat diunduh sesuai perizinan kategorinya
```

### AC-44.04 — Dokumen PDF terproteksi password

```gherkin
Given Saya seorang Member Team
  And saya mengunggah file PDF yang terproteksi password
When Sistem mencoba mengekstrak isi dokumen
Then Dokumen tersimpan dengan status "Gagal" dan alasan "Dokumen terproteksi password"
  And dokumen tidak muncul di hasil pencarian isi konten
  And dokumen tetap dapat diunduh
```

### AC-44.05 — Dokumen rusak atau kosong

```gherkin
Given Saya seorang Member Team
  And saya mengunggah file PDF yang rusak
When Sistem mencoba mengekstrak isi dokumen
Then Dokumen tersimpan dengan status "Gagal" dan alasan "Isi dokumen tidak dapat dibaca"
  And sistem tidak menampilkan halaman error
```

---

## US-45 — Mengelola Daftar Kategori (Head of Team)

### AC-45.01 — Menambahkan kategori baru

```gherkin
Given Saya seorang Head of Team
  And saya berada di halaman Permission Category
When Saya mengklik tombol "Tambah Kategori"
  And saya mengisi field "Nama Kategori" dengan "Reporting"
  And saya mengklik tombol "Simpan"
Then Sistem menampilkan pesan sukses: "Kategori berhasil ditambahkan"
  And kategori "Reporting" muncul di tabel daftar kategori
  And perizinan download kategori tersebut berstatus "Inactive" secara default
```

### AC-45.02 — Menolak nama kategori duplikat (Negative Path)

```gherkin
Given Saya seorang Head of Team
  And kategori "Reporting" sudah ada di tenant saya
When Saya menambahkan kategori dengan nama "Reporting"
Then Sistem menampilkan pesan error: "Kategori dengan nama tersebut sudah ada"
  And tidak ada kategori baru yang tersimpan
```

### AC-45.03 — Melihat antrean dokumen tanpa kategori

```gherkin
Given Saya seorang Head of Team
  And terdapat dokumen yang tidak dapat diklasifikasikan oleh AI
When Saya membuka antrean "Uncategorized"
Then Sistem menampilkan daftar dokumen tanpa kategori beserta nama pengunggah dan tanggal unggah
```

---

## US-02 — Menentukan Kategori Tiap Dokumen (Member Team)

### AC-02.01 — Dokumen baru tampil dengan kategori saran

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
When Saya menyeret satu file PDF ke area unggah
  And proses pemrosesan selesai
Then Dokumen tersebut tampil di daftar "UPLOADED DOCUMENT"
  And menampilkan kategori saran dari sistem beserta penanda "Saran"
  And dokumen berstatus belum dikonfirmasi
```

### AC-02.02 — Tampil daftar kategori pada dokumen yang belum dikonfirmasi

```gherkin
Given Saya seorang Member Team
  And sebelumnya sudah berhasil mengunggah dokumen
  And kategori dokumen belum saya konfirmasi
  And sedang berada di halaman Dasbor
When Saya meng-klik salah satu dokumen pada daftar "UPLOADED DOCUMENT"
Then Sistem menampilkan daftar kategori yang tersedia di tenant saya
  And kategori saran ditandai sebagai pilihan terpilih
```

### AC-02.03 — Menerima kategori saran

```gherkin
Given Saya seorang Member Team
  And dokumen saya memiliki kategori saran "Technical Spec"
  And sedang berada di halaman Dasbor
When Saya meng-klik dokumen tersebut
  And saya mengklik tombol "Konfirmasi"
Then Kategori dokumen menjadi "Technical Spec" dan berstatus terkonfirmasi
  And penanda "Saran" hilang dari dokumen
  And dokumen tidak ditampilkan lagi di daftar "UPLOADED DOCUMENT"
```

### AC-02.04 — Mengubah kategori saran

```gherkin
Given Saya seorang Member Team
  And dokumen saya memiliki kategori saran "Proposal"
  And sedang berada di halaman Dasbor
When Saya meng-klik dokumen tersebut
  And saya memilih "Technical Spec"
  And saya mengklik tombol "Konfirmasi"
Then Kategori dokumen berubah menjadi "Technical Spec"
  And sistem menyimpan kategori saran semula beserta identitas dan waktu perubahan
  And dokumen tidak ditampilkan lagi di daftar "UPLOADED DOCUMENT"
```

### AC-02.05 — Dokumen yang belum dikonfirmasi hanya tampil di dasbor pengunggahnya

```gherkin
Given Saya seorang Member Team
  And rekan saya mengunggah file laporan.pdf kurang dari 7 hari yang lalu
  And kategori dokumen tersebut belum dikonfirmasi
When Saya menginput di kolom pencarian dengan value "laporan.pdf"
Then Sistem tidak menampilkan dokumen tersebut
  And menampilkan pesan "Dokumen tidak ditemukan"
```

### AC-02.06 — Dokumen tampil ke seluruh tenant setelah melewati batas waktu

```gherkin
Given Saya seorang Member Team
  And rekan saya mengunggah file laporan.pdf lebih dari 7 hari yang lalu
  And kategori dokumen tersebut belum dikonfirmasi
When Saya menginput di kolom pencarian dengan value "laporan.pdf"
Then Sistem menampilkan dokumen tersebut dengan kategori "Uncategorized"
```

### AC-02.07 — Head of Team melihat dokumen yang belum dikonfirmasi

```gherkin
Given Saya seorang Head of Team
  And seorang Member Team mengunggah dokumen hari ini
  And kategori dokumen tersebut belum dikonfirmasi
When Saya membuka antrean "Uncategorized"
Then Sistem menampilkan dokumen tersebut beserta nama pengunggah
```

---

## US-06 — Pengkategorian & Klasifikasi Dokumen Otomatis via AI (Member Team)

### AC-06.01 — Dokumen mendapat saran kategori yang tepat

```gherkin
Given Saya seorang Member Team
  And kategori "Reporting" sudah ada di daftar kategori tenant saya
When Saya mengunggah dokumen uji fixture-reporting-01.pdf
  And proses pemrosesan selesai
Then Dokumen menampilkan kategori saran "Reporting"
  And kategori tersebut berstatus belum dikonfirmasi
```

### AC-06.02 — AI mengenali tipe dokumen secara otomatis saat pengunggahan

```gherkin
Given Saya seorang Member Team
  And saya mengunggah file invoice dari vendor
When Proses pemrosesan selesai
Then Sistem menandai tipe dokumen sebagai "Invoice" di kolom Tipe Dokumen
  And label tipe muncul di card dokumen di daftar
```

### AC-06.03 — AI tidak dapat menentukan kategori

```gherkin
Given Saya seorang Member Team
  And isi dokumen yang saya unggah tidak cocok dengan kategori mana pun di tenant saya
When Proses pemrosesan selesai
Then Dokumen menampilkan kategori "Uncategorized"
  And dokumen muncul di antrean review Head of Team
  And sistem tidak membuat kategori baru
```

---

## US-04 — Melihat Metadata Dokumen (Member Team)

### AC-04.01 — Metadata penulis berhasil diekstrak otomatis

```gherkin
Given Saya seorang Member Team
  And sistem selesai memproses dokumen yang memiliki data penulis di metadata file
When Saya mengklik nama dokumen tersebut di daftar dokumen
Then Halaman detail dokumen menampilkan nama penulis yang benar di section Metadata
  And menampilkan tanggal pembuatan dokumen yang terekstrak
```

### AC-04.02 — Metadata penulis tidak berhasil diekstrak

```gherkin
Given Saya seorang Member Team
  And dokumen yang saya unggah tidak memiliki informasi penulis
When Saya mengklik nama dokumen tersebut di daftar dokumen
Then Halaman detail dokumen menampilkan field Penulis dengan nilai "Tidak diketahui"
  And dokumen tetap dapat dibuka dan dicari
```

---

## US-05 — Memfilter Hasil Pencarian dengan Tag Otomatis (Member Team)

### AC-05.01 — Melihat panel Top Tags di dasbor

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And dokumen telah diunggah dan diproses AI
When Saya melihat area panel filter di atas daftar dokumen
Then Panel "Top Tags" menampilkan 10 tag yang paling banyak digunakan di tenant saya
  And tag diurutkan berdasarkan jumlah dokumen secara menurun
  And setiap dokumen menampilkan maksimal 3 tag
```

### AC-05.02 — Melakukan filtering dengan single tag

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And panel Top Tags menampilkan beberapa tag
When Saya mengklik tag "Strategy" di panel Top Tags
Then Daftar dokumen diperbarui hanya menampilkan dokumen dengan tag "Strategy"
  And tag "Strategy" berubah warna (highlighted)
```

### AC-05.03 — Melakukan filtering dengan multi-tag

```gherkin
Given Saya seorang Member Team
  And saya berada di halaman Dasbor
  And tag "Strategy" sudah aktif (highlighted)
When Saya mengklik tag "Legal" di panel Top Tags
Then Daftar dokumen diperbarui menampilkan dokumen yang memiliki tag "Strategy" DAN "Legal"
  And kedua tag berubah warna (highlighted)
```

### AC-05.04 — Filter tag tidak menemukan hasil

```gherkin
Given Saya seorang Member Team
  And tidak ada dokumen yang memiliki kombinasi tag "Strategy" dan "Legal"
When Saya mengaktifkan kedua tag tersebut
Then Sistem menampilkan pesan: "Tidak ada dokumen dengan kombinasi tag ini"
```

### AC-05.05 — AI menghasilkan lebih dari 3 tag

```gherkin
Given Saya seorang Member Team
  And proses AI menghasilkan 5 tag untuk satu dokumen
When Dokumen selesai diproses
Then Dokumen menyimpan dan menampilkan hanya 3 tag dengan tingkat keyakinan tertinggi
```

---

## US-47 — Mengoreksi Hasil Ekstraksi AI (Member Team)

### AC-47.01 — Mengoreksi field hasil ekstraksi

```gherkin
Given Saya seorang Member Team
  And saya adalah pengunggah dokumen invoice tersebut
  And field "Total Nilai" terisi dengan nilai yang salah
When Saya mengklik field tersebut
  And saya mengisi nilai yang benar
  And saya menyimpan perubahan
Then Field menampilkan nilai yang saya masukkan
  And sistem menyimpan nilai asli hasil AI beserta identitas dan waktu perubahan
  And perubahan tercatat di audit log
```

### AC-47.02 — Mengoreksi tag dokumen

```gherkin
Given Saya seorang Member Team
  And dokumen saya memiliki tag "Legal" yang tidak relevan
When Saya menghapus tag tersebut dan menambahkan tag "Finance"
Then Dokumen menampilkan tag yang telah saya perbarui
  And panel Top Tags diperbarui mengikuti perubahan
```

### AC-47.03 — Member Team lain tidak dapat mengoreksi (Negative Path)

```gherkin
Given Saya seorang Member Team
  And dokumen tersebut diunggah oleh rekan saya
When Saya mengakses endpoint pengubahan field dokumen tersebut secara langsung
Then Sistem mengembalikan status 403
  And nilai field tidak berubah
```

### AC-47.04 — Head of Team dapat mengoreksi dokumen milik siapa pun

```gherkin
Given Saya seorang Head of Team
  And dokumen tersebut diunggah oleh seorang Member Team
When Saya mengoreksi field "Nama Vendor" pada dokumen tersebut
Then Field menampilkan nilai yang saya masukkan
  And perubahan tercatat di audit log beserta identitas saya
```
