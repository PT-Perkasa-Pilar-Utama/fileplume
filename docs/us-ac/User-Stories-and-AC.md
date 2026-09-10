# Archiva User Stories and Acceptance Criteria

**Version:** 2.0  
**Date:** 2026-09-10  
**Status:** Refined after grooming  
**Grooming record:** `docs/grooming/grooming-archiva-interview.md`  
**Previous version:** `docs/us-ac/User-Stories-and-AC.pre-grooming.md`  

## Scope

Release 1 is the document management core: US-01 to US-14 and US-33 to US-47.

US-15 to US-32 are roadmap. They are retained at the end of this document with their acceptance criteria remapped to the correct stories, but they are not in scope for release 1 and are not estimated. See decision D1 in the grooming record.

Story ID order does not imply build order. US-43 to US-47 are foundation stories added during grooming, and several of them must land before US-01. Sequencing belongs in the sprint breakdown, not in the numbering.

Interface language is Indonesian throughout (D15).

---

# Release 1

## US-43: Isolasi Data Antar Tenant

**As a** Super Admin,
**I want to** memastikan setiap organisasi memiliki ruang data yang terisolasi penuh dari organisasi lain,
**So that** satu platform dapat melayani banyak organisasi tanpa risiko kebocoran data antar organisasi.

> Foundation story (D1, D10). Identitas tenant harus ada di setiap tabel sejak migrasi pertama. Harus selesai sebelum US-01.

### Acceptance Criteria

#### AC-43.01: Membuat tenant pertama
- **GIVEN** Saya seorang Super Admin<br>AND saya berada di halaman Manajemen Tenant
- **WHEN** Saya mengisi field "Nama Organisasi" dengan "PT Contoh Baru"<br>AND saya mengisi field "Subdomain" dengan "contohbaru"<br>AND saya mengklik tombol "Simpan"
- **THEN** Sistem menampilkan pesan sukses: "Tenant berhasil ditambahkan"<br>AND tenant "PT Contoh Baru" muncul di tabel daftar tenant dengan status Active<br>AND kuota penyimpanan default tenant tersimpan

#### AC-43.02: Isolasi data pada pencarian
- **GIVEN** Saya seorang Member Team dari Tenant A<br>AND Tenant B memiliki dokumen 'rahasia-b.pdf'
- **WHEN** Saya mengetik "rahasia-b" di bar pencarian<br>AND saya menekan tombol Enter
- **THEN** Sistem menampilkan pesan: "Tidak ada hasil yang ditemukan"

#### AC-43.03: Isolasi data pada akses langsung (Negative Path)
- **GIVEN** Saya seorang Member Team dari Tenant A<br>AND dokumen 'rahasia-b.pdf' milik Tenant B memiliki ID dokumen yang diketahui
- **WHEN** Saya mengakses endpoint detail dokumen menggunakan ID milik Tenant B secara langsung
- **THEN** Sistem mengembalikan status 403<br>AND tidak ada metadata atau isi dokumen yang dikembalikan<br>AND upaya akses tercatat di audit log

#### AC-43.04: Isolasi data pada endpoint unduhan (Negative Path)
- **GIVEN** Saya seorang Member Team dari Tenant A<br>AND dokumen milik Tenant B memiliki ID dokumen yang diketahui
- **WHEN** Saya mengakses endpoint unduhan menggunakan ID milik Tenant B secara langsung
- **THEN** Sistem mengembalikan status 403<br>AND tidak ada file yang terunduh<br>AND upaya akses tercatat di audit log

## US-44: Pipeline Pemrosesan Dokumen

**As a** Member Team,
**I want to** mengetahui status pemrosesan dokumen yang saya unggah dan tetap dapat menggunakan dokumen tersebut walaupun pemrosesan otomatis gagal,
**So that** dokumen tidak pernah hilang tanpa penjelasan dan saya tahu apa yang sedang terjadi.

> Foundation story (D8, D13). Satu pipeline bersama untuk US-04, US-05, US-06, US-25 dan US-33. Menyimpan status pemindaian (D11), status konfirmasi kategori (D4), dan status pemrosesan AI. Penyedia inferensi wajib berada di balik lapisan abstraksi (D8).

### Acceptance Criteria

#### AC-44.01: Status pemrosesan tampil pada dokumen
- **GIVEN** Saya seorang Member Team<br>AND saya baru saja mengunggah satu file PDF
- **WHEN** Saya melihat dokumen tersebut di daftar dokumen
- **THEN** Dokumen menampilkan salah satu status: "Antre", "Diproses", "Siap", atau "Gagal"<br>AND status berubah menjadi "Siap" setelah seluruh pemrosesan selesai

#### AC-44.02: Kegagalan sementara diulang otomatis
- **GIVEN** Saya seorang Member Team<br>AND dokumen saya sedang diproses<br>AND layanan AI mengembalikan kegagalan sementara
- **WHEN** Sistem mendeteksi kegagalan tersebut
- **THEN** Sistem mengulang pemrosesan secara otomatis maksimal 3 kali dengan jeda bertingkat<br>AND status dokumen tetap "Diproses" selama pengulangan berlangsung

#### AC-44.03: Kegagalan permanen ditandai dan dokumen tetap dapat digunakan
- **GIVEN** Saya seorang Member Team<br>AND dokumen saya gagal diproses setelah seluruh pengulangan habis
- **WHEN** Saya melihat dokumen tersebut di daftar dokumen
- **THEN** Dokumen menampilkan status "Gagal" beserta alasan kegagalan<br>AND dokumen tetap dapat dibuka di viewer<br>AND dokumen tetap dapat diunduh sesuai perizinan kategorinya

#### AC-44.04: Dokumen PDF terproteksi password
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah file PDF yang terproteksi password
- **WHEN** Sistem mencoba mengekstrak isi dokumen
- **THEN** Dokumen tersimpan dengan status "Gagal" dan alasan "Dokumen terproteksi password"<br>AND dokumen tidak muncul di hasil pencarian isi konten<br>AND dokumen tetap dapat diunduh

#### AC-44.05: Dokumen rusak atau kosong
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah file PDF yang rusak
- **WHEN** Sistem mencoba mengekstrak isi dokumen
- **THEN** Dokumen tersimpan dengan status "Gagal" dan alasan "Isi dokumen tidak dapat dibaca"<br>AND sistem tidak menampilkan halaman error

## US-46: Pemindaian Malware saat Unggah

**As a** Head of Team,
**I want to** memastikan setiap file yang diunggah dipindai dari malware sebelum dapat diakses rekan tim,
**So that** sistem tidak menjadi jalur penyebaran file berbahaya di dalam organisasi.

> Foundation story (D11). Harus selesai sebelum dokumen apa pun dapat dibuka atau diunduh oleh pengguna lain.

### Acceptance Criteria

#### AC-46.01: File bersih lolos pemindaian
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah satu file PDF yang bersih
- **WHEN** Proses pemindaian selesai
- **THEN** Dokumen melanjutkan ke tahap pemrosesan berikutnya<br>AND dokumen menjadi dapat diakses sesuai aturan visibilitas

#### AC-46.02: File terinfeksi ditolak (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah file yang terdeteksi mengandung malware
- **WHEN** Proses pemindaian selesai
- **THEN** Sistem menampilkan pesan error: "File terdeteksi mengandung malware dan tidak dapat diunggah"<br>AND file tidak tersimpan ke dalam sistem<br>AND file tidak pernah dapat diakses oleh pengguna lain<br>AND kejadian tercatat di audit log

## US-45: Mengelola Daftar Kategori

**As a** Head of Team,
**I want to** menambah, mengubah, dan menonaktifkan kategori dokumen yang tersedia di organisasi saya,
**So that** klasifikasi dokumen mengikuti struktur organisasi dan AI hanya memilih dari daftar yang sudah disetujui.

> Foundation story (D3). Menggantikan pembuatan kategori otomatis oleh AI. Harus selesai sebelum US-06.

### Acceptance Criteria

#### AC-45.01: Menambahkan kategori baru
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Permission Category
- **WHEN** Saya mengklik tombol "Tambah Kategori"<br>AND saya mengisi field "Nama Kategori" dengan "Reporting"<br>AND saya mengklik tombol "Simpan"
- **THEN** Sistem menampilkan pesan sukses: "Kategori berhasil ditambahkan"<br>AND kategori "Reporting" muncul di tabel daftar kategori<br>AND perizinan download kategori tersebut berstatus "Inactive" secara default

#### AC-45.02: Menolak nama kategori duplikat (Negative Path)
- **GIVEN** Saya seorang Head of Team<br>AND kategori "Reporting" sudah ada di tenant saya
- **WHEN** Saya menambahkan kategori dengan nama "Reporting"
- **THEN** Sistem menampilkan pesan error: "Kategori dengan nama tersebut sudah ada"<br>AND tidak ada kategori baru yang tersimpan

#### AC-45.03: Melihat antrean dokumen tanpa kategori
- **GIVEN** Saya seorang Head of Team<br>AND terdapat dokumen yang tidak dapat diklasifikasikan oleh AI
- **WHEN** Saya membuka antrean "Uncategorized"
- **THEN** Sistem menampilkan daftar dokumen tanpa kategori beserta nama pengunggah dan tanggal unggah

## US-01: Mengunggah Dokumen

**As a** Member Team,
**I want to** mengunggah satu atau beberapa dokumen ke dalam sistem melalui mekanisme drag and drop,
**So that** proses penambahan pengetahuan menjadi cepat dan mudah tanpa navigasi yang rumit.

### Acceptance Criteria

#### AC-01.01: Mengunggah satu file PDF yang valid
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya menyeret satu file PDF ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan sukses: "File diterima untuk diproses"<br>AND indikator progres unggahan mencapai 100 persen<br>AND dokumen muncul di daftar "UPLOADED DOCUMENT" dengan status "Diproses" dalam waktu kurang dari 5 detik

#### AC-01.02: Memastikan file yang diunggah tersimpan di daftar dokumen
- **GIVEN** Saya berhasil mengunggah file 'laporan.pdf'<br>AND status dokumen sudah "Siap"
- **WHEN** Saya mengklik menu Daftar Dokumen di sidebar<br>AND saya me-refresh halaman
- **THEN** File 'laporan.pdf' muncul di daftar dokumen terbaru<br>AND menampilkan tanggal unggah hari ini

#### AC-01.03: Mencoba mengunggah file tipe tidak didukung (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND tipe file yang didukung adalah PDF, DOCX, XLSX dan TXT
- **WHEN** Saya menyeret file gambar (.JPG) ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan error: "Tipe file tidak didukung. Tipe yang diterima: PDF, DOCX, XLSX, TXT"<br>AND file tidak tersimpan ke dalam sistem

#### AC-01.04: Mengunggah beberapa file sekaligus
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND batas maksimal unggahan sekaligus adalah 20 file
- **WHEN** Saya menyeret tiga file DOCX sekaligus ke area unggah<br>AND saya melepaskan file-file tersebut
- **THEN** Sistem menampilkan notifikasi sukses untuk ketiga file<br>AND ketiga file muncul di daftar "UPLOADED DOCUMENT" dengan status masing-masing

#### AC-01.05: Melebihi batas jumlah file sekaligus (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND batas maksimal unggahan sekaligus adalah 20 file
- **WHEN** Saya menyeret 25 file sekaligus ke area unggah
- **THEN** Sistem menampilkan pesan error: "Maksimal 20 file per unggahan"<br>AND tidak ada file yang tersimpan

#### AC-01.06: Melebihi batas ukuran file (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND Admin Tenant telah menetapkan Max File Size sebesar 20 MB
- **WHEN** Saya menyeret file PDF berukuran 25 MB ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan error: "Ukuran file melebihi batas 20 MB"<br>AND file tidak tersimpan ke dalam sistem

#### AC-01.07: Unggahan terputus di tengah proses (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND unggahan file sedang berjalan pada 60 persen
- **WHEN** Koneksi jaringan saya terputus
- **THEN** Sistem menampilkan pesan error: "Unggahan terputus. Silakan coba lagi"<br>AND tidak ada dokumen parsial yang tersimpan di daftar dokumen<br>AND kuota penyimpanan tidak berkurang

#### AC-01.08: Sesi berakhir saat unggahan berlangsung (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND unggahan file sedang berjalan<br>AND sesi login saya berakhir
- **WHEN** Sistem mencoba menyelesaikan unggahan
- **THEN** Sistem menampilkan pesan: "Sesi Anda telah berakhir. Silakan login kembali"<br>AND tidak ada dokumen parsial yang tersimpan

## US-02: Menentukan Kategori Tiap Dokumen

**As a** Member Team,
**I want to** mengonfirmasi atau mengubah kategori yang disarankan sistem untuk tiap dokumen yang saya unggah,
**So that** dokumen terklasifikasi dengan benar tanpa saya harus mengisi kategori dari nol.

> Direvisi setelah D2. Sistem menyarankan, pengguna mengonfirmasi. Bekerja bersama US-06, bukan bertentangan dengannya.

### Acceptance Criteria

#### AC-02.01: Dokumen baru tampil dengan kategori saran
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya menyeret satu file PDF ke area unggah<br>AND proses pemrosesan selesai
- **THEN** Dokumen tersebut tampil di daftar "UPLOADED DOCUMENT"<br>AND menampilkan kategori saran dari sistem beserta penanda "Saran"<br>AND dokumen berstatus belum dikonfirmasi

#### AC-02.02: Tampil daftar kategori pada dokumen yang belum dikonfirmasi
- **GIVEN** Saya seorang Member Team<br>AND sebelumnya sudah berhasil mengunggah dokumen<br>AND kategori dokumen belum saya konfirmasi<br>AND sedang berada di halaman Dasbor
- **WHEN** Saya meng-klik salah satu dokumen pada daftar "UPLOADED DOCUMENT"
- **THEN** Sistem menampilkan daftar kategori yang tersedia di tenant saya<br>AND kategori saran ditandai sebagai pilihan terpilih

#### AC-02.03: Menerima kategori saran
- **GIVEN** Saya seorang Member Team<br>AND dokumen saya memiliki kategori saran "Technical Spec"<br>AND sedang berada di halaman Dasbor
- **WHEN** Saya meng-klik dokumen tersebut<br>AND saya mengklik tombol "Konfirmasi"
- **THEN** Kategori dokumen menjadi "Technical Spec" dan berstatus terkonfirmasi<br>AND penanda "Saran" hilang dari dokumen<br>AND dokumen tidak ditampilkan lagi di daftar "UPLOADED DOCUMENT"

#### AC-02.04: Mengubah kategori saran
- **GIVEN** Saya seorang Member Team<br>AND dokumen saya memiliki kategori saran "Proposal"<br>AND sedang berada di halaman Dasbor
- **WHEN** Saya meng-klik dokumen tersebut<br>AND saya memilih "Technical Spec"<br>AND saya mengklik tombol "Konfirmasi"
- **THEN** Kategori dokumen berubah menjadi "Technical Spec"<br>AND sistem menyimpan kategori saran semula beserta identitas dan waktu perubahan<br>AND dokumen tidak ditampilkan lagi di daftar "UPLOADED DOCUMENT"

#### AC-02.05: Dokumen yang belum dikonfirmasi hanya tampil di dasbor pengunggahnya
- **GIVEN** Saya seorang Member Team<br>AND rekan saya mengunggah file "laporan.pdf" kurang dari 7 hari yang lalu<br>AND kategori dokumen tersebut belum dikonfirmasi
- **WHEN** Saya menginput di kolom pencarian dengan value "laporan.pdf"
- **THEN** Sistem tidak menampilkan dokumen tersebut<br>AND menampilkan pesan "Dokumen tidak ditemukan"

#### AC-02.06: Dokumen tampil ke seluruh tenant setelah melewati batas waktu
- **GIVEN** Saya seorang Member Team<br>AND rekan saya mengunggah file "laporan.pdf" lebih dari 7 hari yang lalu<br>AND kategori dokumen tersebut belum dikonfirmasi
- **WHEN** Saya menginput di kolom pencarian dengan value "laporan.pdf"
- **THEN** Sistem menampilkan dokumen tersebut dengan kategori "Uncategorized"

#### AC-02.07: Head of Team melihat dokumen yang belum dikonfirmasi
- **GIVEN** Saya seorang Head of Team<br>AND seorang Member Team mengunggah dokumen hari ini<br>AND kategori dokumen tersebut belum dikonfirmasi
- **WHEN** Saya membuka antrean "Uncategorized"
- **THEN** Sistem menampilkan dokumen tersebut beserta nama pengunggah

## US-03: Mencegah Unggahan Duplikat

**As a** Member Team,
**I want to** mendapatkan peringatan jika mencoba mengunggah file yang kontennya sama persis dengan file yang sudah ada di sistem,
**So that** basis pengetahuan tetap bersih dan tidak ada kebingungan versi.

> Aturan pembeda duplikat, versi baru, dan dokumen baru ditetapkan pada D5.

### Acceptance Criteria

#### AC-03.01: Mencoba mengunggah file duplikat (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND file 'laporan-keuangan.pdf' sudah ada di tenant saya
- **WHEN** Saya menyeret file lain dengan konten yang sama persis (hash identik) ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan error: "File ini sudah ada di sistem"<br>AND pesan menampilkan tautan ke dokumen yang sudah ada<br>AND file duplikat tidak tersimpan ke dalam sistem

#### AC-03.02: Mengunggah file bukan duplikat saat file lain sudah ada
- **GIVEN** Saya seorang Member Team<br>AND file 'laporan-keuangan.pdf' sudah ada di sistem
- **WHEN** Saya menyeret file 'presentasi-baru.pdf' dengan konten yang berbeda ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan sukses: "File diterima untuk diproses"<br>AND file baru tersimpan di daftar dokumen

#### AC-03.03: Nama file sama dengan konten berbeda menjadi dokumen terpisah
- **GIVEN** Saya seorang Member Team<br>AND rekan saya sudah mengunggah dokumen bernama 'laporan.pdf'
- **WHEN** Saya menyeret file 'laporan.pdf' milik saya dengan konten yang berbeda ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menyimpan file saya sebagai dokumen baru yang terpisah<br>AND dokumen milik rekan saya tidak berubah dan tidak menjadi versi lama

#### AC-03.04: Dua pengguna mengunggah konten identik secara bersamaan
- **GIVEN** Saya dan rekan saya berada di tenant yang sama<br>AND kami mengunggah file dengan konten identik pada saat yang bersamaan
- **WHEN** Kedua unggahan diproses
- **THEN** Hanya satu dokumen yang tersimpan di sistem<br>AND unggahan kedua menampilkan pesan: "File ini sudah ada di sistem"

## US-04: Melihat Metadata Dokumen

**As a** Member Team,
**I want to** melihat metadata seperti penulis dan tanggal yang diekstrak secara otomatis oleh AI/OCR dari dokumen yang diunggah,
**So that** tidak perlu mengisi data secara manual dan informasi menjadi konsisten.

### Acceptance Criteria

#### AC-04.01: Metadata penulis berhasil diekstrak otomatis
- **GIVEN** Saya seorang Member Team<br>AND sistem selesai memproses dokumen yang memiliki data penulis di metadata file
- **WHEN** Saya mengklik nama dokumen tersebut di daftar dokumen
- **THEN** Halaman detail dokumen menampilkan nama penulis yang benar di section Metadata<br>AND menampilkan tanggal pembuatan dokumen yang terekstrak

#### AC-04.02: Metadata penulis tidak berhasil diekstrak
- **GIVEN** Saya seorang Member Team<br>AND dokumen yang saya unggah tidak memiliki informasi penulis
- **WHEN** Saya mengklik nama dokumen tersebut di daftar dokumen
- **THEN** Halaman detail dokumen menampilkan field Penulis dengan nilai "Tidak diketahui"<br>AND dokumen tetap dapat dibuka dan dicari

## US-05: Memfilter Hasil Pencarian dengan Tag Otomatis

**As a** Member Team,
**I want to** menemukan dokumen berdasarkan tag relevan yang dibuat otomatis oleh AI dengan maksimal 3 tag per dokumen,
**So that** penemuan dokumen berdasarkan topik menjadi lebih mudah dan terstruktur.

### Acceptance Criteria

#### AC-05.01: Melihat panel Top Tags di dasbor
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND dokumen telah diunggah dan diproses AI
- **WHEN** Saya melihat area panel filter di atas daftar dokumen
- **THEN** Panel "Top Tags" menampilkan 10 tag yang paling banyak digunakan di tenant saya<br>AND tag diurutkan berdasarkan jumlah dokumen secara menurun<br>AND setiap dokumen menampilkan maksimal 3 tag

#### AC-05.02: Melakukan filtering dengan single tag
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND panel Top Tags menampilkan beberapa tag
- **WHEN** Saya mengklik tag "Strategy" di panel Top Tags
- **THEN** Daftar dokumen diperbarui hanya menampilkan dokumen dengan tag "Strategy"<br>AND tag "Strategy" berubah warna (highlighted)

#### AC-05.03: Melakukan filtering dengan multi-tag
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND tag "Strategy" sudah aktif (highlighted)
- **WHEN** Saya mengklik tag "Legal" di panel Top Tags
- **THEN** Daftar dokumen diperbarui menampilkan dokumen yang memiliki tag "Strategy" DAN "Legal"<br>AND kedua tag berubah warna (highlighted)

#### AC-05.04: Filter tag tidak menemukan hasil
- **GIVEN** Saya seorang Member Team<br>AND tidak ada dokumen yang memiliki kombinasi tag "Strategy" dan "Legal"
- **WHEN** Saya mengaktifkan kedua tag tersebut
- **THEN** Sistem menampilkan pesan: "Tidak ada dokumen dengan kombinasi tag ini"

#### AC-05.05: AI menghasilkan lebih dari 3 tag
- **GIVEN** Saya seorang Member Team<br>AND proses AI menghasilkan 5 tag untuk satu dokumen
- **WHEN** Dokumen selesai diproses
- **THEN** Dokumen menyimpan dan menampilkan hanya 3 tag dengan tingkat keyakinan tertinggi

## US-06: Pengkategorian & Klasifikasi Dokumen Otomatis via AI

**As a** Member Team,
**I want to** melihat sistem menyarankan kategori dan tipe dokumen yang tepat (invoice, kontrak, laporan, memo) secara otomatis berdasarkan isi konten,
**So that** kerja manual merapikan folder dan pengkategorian berkurang drastis.

> Direvisi setelah D2 dan D3. AI memilih dari taksonomi yang dikelola Head of Team (US-45) dan tidak membuat kategori baru.

### Acceptance Criteria

#### AC-06.01: Dokumen mendapat saran kategori yang tepat
- **GIVEN** Saya seorang Member Team<br>AND kategori "Reporting" sudah ada di daftar kategori tenant saya
- **WHEN** Saya mengunggah dokumen uji 'fixture-reporting-01.pdf'<br>AND proses pemrosesan selesai
- **THEN** Dokumen menampilkan kategori saran "Reporting"<br>AND kategori tersebut berstatus belum dikonfirmasi

#### AC-06.02: AI mengenali tipe dokumen secara otomatis saat pengunggahan
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah file invoice dari vendor
- **WHEN** Proses pemrosesan selesai
- **THEN** Sistem menandai tipe dokumen sebagai "Invoice" di kolom Tipe Dokumen<br>AND label tipe muncul di card dokumen di daftar

#### AC-06.03: AI tidak dapat menentukan kategori
- **GIVEN** Saya seorang Member Team<br>AND isi dokumen yang saya unggah tidak cocok dengan kategori mana pun di tenant saya
- **WHEN** Proses pemrosesan selesai
- **THEN** Dokumen menampilkan kategori "Uncategorized"<br>AND dokumen muncul di antrean review Head of Team<br>AND sistem tidak membuat kategori baru

## US-07: Mencari Judul & Metadata Dokumen

**As a** Member Team,
**I want to** mencari dokumen berdasarkan kata kunci dari judul atau metadata melalui bar pencarian,
**So that** informasi yang dibutuhkan ditemukan dalam hitungan detik.

### Acceptance Criteria

#### AC-07.01: Pencarian berhasil menemukan dokumen
- **GIVEN** Saya seorang Member Team<br>AND ada dokumen yang berisi kata "API" di dalam sistem<br>AND tenant saya berisi 100.000 dokumen<br>AND terdapat 20 pencarian bersamaan pada saat yang sama
- **WHEN** Saya mengklik bar pencarian<br>AND saya mengetik "API"<br>AND saya menekan tombol Enter
- **THEN** Setidaknya satu dokumen relevan muncul di hasil pencarian<br>AND setiap item menampilkan nama file dan cuplikan teks yang cocok<br>AND hasil muncul dalam waktu kurang dari 3 detik

#### AC-07.02: Pencarian tidak menemukan hasil
- **GIVEN** Saya seorang Member Team<br>AND tidak ada dokumen yang berisi kata "xyzabc"
- **WHEN** Saya mengklik bar pencarian<br>AND saya mengetik "xyzabc"<br>AND saya menekan tombol Enter
- **THEN** Sistem menampilkan pesan: "Tidak ada hasil yang ditemukan"

#### AC-07.03: Kata kunci terlalu pendek (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND panjang minimal kata kunci adalah 2 karakter
- **WHEN** Saya mengetik "a" di bar pencarian<br>AND saya menekan tombol Enter
- **THEN** Sistem menampilkan pesan: "Masukkan minimal 2 karakter untuk mencari"<br>AND sistem tidak menjalankan pencarian

## US-08: Menemukan Dokumen Terkait

**As a** Member Team,
**I want to** melihat daftar saran dokumen lain yang berkaitan berdasarkan kesamaan kategori atau tag saat membuka sebuah dokumen,
**So that** pengetahuan terkait yang mungkin tidak terpikirkan untuk dicari dapat ditemukan secara otomatis.

### Acceptance Criteria

#### AC-08.01: Menampilkan daftar dokumen terkait berdasarkan kategori/tag
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail dokumen 'bds-requirement.xlsx' dengan kategori "Technical Spec"<br>AND terdapat dokumen lain dengan kategori atau tag yang sama di dalam sistem
- **WHEN** Saya melihat section informasi dokumen terkait pada halaman detail
- **THEN** Section "Dokumen Terkait" menampilkan maksimal 5 dokumen yang memiliki kesamaan kategori atau tag<br>AND setiap item menampilkan nama file dan nama pengunggah

#### AC-08.02: Tidak ada dokumen terkait
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail sebuah dokumen<br>AND tidak ada dokumen lain dengan kategori atau tag yang sama
- **WHEN** Saya melihat section informasi dokumen terkait pada halaman detail
- **THEN** Section "Dokumen Terkait" menampilkan pesan: "Tidak ada dokumen terkait"

#### AC-08.03: Navigasi ke dokumen terkait
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail dokumen<br>AND section "Dokumen Terkait" menampilkan dokumen 'technical-proposal-test.pdf'
- **WHEN** Saya mengklik nama file 'technical-proposal-test.pdf' pada daftar dokumen terkait
- **THEN** Halaman detail dokumen 'technical-proposal-test.pdf' terbuka dengan metadata dan preview-nya

#### AC-08.04: Dokumen terkait tidak menampilkan dokumen tenant lain
- **GIVEN** Saya seorang Member Team dari Tenant A<br>AND Tenant B memiliki dokumen dengan kategori yang sama
- **WHEN** Saya melihat section "Dokumen Terkait"
- **THEN** Hanya dokumen milik Tenant A yang ditampilkan

## US-09: Melihat Preview Dokumen

**As a** Member Team,
**I want to** melihat isi dokumen secara utuh melalui viewer dalam aplikasi tanpa mengunduh file,
**So that** verifikasi informasi menjadi lebih cepat.

### Acceptance Criteria

#### AC-09.01: Melihat preview dokumen PDF tanpa download
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mengklik nama dokumen PDF di daftar dokumen
- **THEN** Viewer menampilkan seluruh halaman dokumen<br>AND tidak ada file yang terunduh ke perangkat lokal

#### AC-09.02: Melihat preview dokumen DOCX, XLSX dan TXT
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mengklik nama dokumen DOCX di daftar dokumen
- **THEN** Viewer menampilkan isi dokumen hasil konversi di sisi server<br>AND tidak ada file yang terunduh ke perangkat lokal

#### AC-09.03: Preview gagal dimuat (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND dokumen berstatus "Gagal" dengan alasan isi tidak dapat dibaca
- **WHEN** Saya mengklik nama dokumen tersebut
- **THEN** Viewer menampilkan pesan: "Preview tidak tersedia untuk dokumen ini"<br>AND tombol Download tetap dapat digunakan sesuai perizinan kategorinya

## US-10: Mengunduh Dokumen

**As a** Member Team,
**I want to** mengunduh dokumen asli sesuai format ke perangkat lokal melalui tombol Download,
**So that** dokumen dapat dibagikan ke platform lain.

### Acceptance Criteria

#### AC-10.01: Mengunduh single dokumen dari halaman preview
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman preview dokumen<br>AND kategori dokumen berstatus "Active" pada perizinan download
- **WHEN** Saya mengklik tombol "Download"
- **THEN** File terunduh ke perangkat lokal dengan format asli (PDF/DOCX/dll)<br>AND satu record unduhan tercatat di audit log

#### AC-10.02: Mencoba mengunduh dokumen pada kategori yang berstatus nonaktif (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman preview dokumen pada kategori "Offering Letter"<br>AND kategori "Offering Letter" berstatus "Inactive" pada perizinan download
- **WHEN** Saya mengarahkan kursor dan mengklik tombol "Download"
- **THEN** Tombol "Download" dalam kondisi nonaktif (disabled)<br>AND sistem menampilkan pesan warning: "Kategori ini tidak diizinkan untuk diunduh"<br>AND tidak ada file yang terunduh

#### AC-10.03: Menolak unduhan melalui akses endpoint langsung (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND dokumen berada pada kategori berstatus "Inactive" pada perizinan download
- **WHEN** Saya mengakses endpoint unduhan dokumen tersebut secara langsung tanpa melalui antarmuka
- **THEN** Sistem mengembalikan status 403<br>AND tidak ada file yang terunduh<br>AND upaya unduhan tercatat di audit log

#### AC-10.04: Klik ganda pada tombol Download
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman preview dokumen yang diizinkan untuk diunduh
- **WHEN** Saya mengklik tombol "Download" dua kali secara cepat
- **THEN** Hanya satu file yang terunduh<br>AND hanya satu record unduhan tercatat di audit log

## US-11: Mengunduh Dokumen Massal

**As a** Member Team,
**I want to** memilih beberapa dokumen sekaligus dan mengunduhnya dalam satu file format .zip,
**So that** waktu terhemat saat membutuhkan banyak referensi sekaligus.

### Acceptance Criteria

#### AC-11.01: Mengunduh dokumen secara massal
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND ketiga dokumen berada pada kategori yang diizinkan untuk diunduh
- **WHEN** Saya mencentang checkbox pada tiga dokumen<br>AND saya mengklik tombol "Download Selected"
- **THEN** Sistem menggabungkan ketiga file ke dalam satu file .zip<br>AND file .zip terunduh ke perangkat lokal<br>AND tiga record unduhan tercatat di audit log

#### AC-11.02: Sebagian dokumen tidak diizinkan untuk diunduh (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND saya mencentang tiga dokumen<br>AND satu di antaranya berada pada kategori berstatus "Inactive"
- **WHEN** Saya mengklik tombol "Download Selected"
- **THEN** Sistem menampilkan pesan: "1 dokumen tidak diizinkan untuk diunduh dan tidak disertakan"<br>AND file .zip berisi dua dokumen yang diizinkan<br>AND dua record unduhan tercatat di audit log

#### AC-11.03: Melebihi batas jumlah dokumen unduhan massal (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND batas maksimal unduhan massal adalah 50 dokumen
- **WHEN** Saya mencentang 60 dokumen<br>AND saya mengklik tombol "Download Selected"
- **THEN** Sistem menampilkan pesan: "Maksimal 50 dokumen per unduhan massal"<br>AND tidak ada file .zip yang dibuat

## US-12: Melihat Dasbor Analitik

**As a** Head of Team,
**I want to** melihat dasbor berisi metrik penggunaan sistem oleh tim,
**So that** adopsi tim terhadap sistem terpahami dan nilai sistem dapat ditunjukkan.

> Metrik diperluas pada D17. Jumlah unggahan saja mengukur pemasukan dokumen, bukan adopsi.

### Acceptance Criteria

#### AC-12.01: Melihat metrik total dokumen di dasbor analitik
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Analitik
- **WHEN** Saya melihat dasbor analitik
- **THEN** Kartu data menampilkan jumlah total dokumen di sistem<br>AND kartu data menampilkan jumlah dokumen yang diunggah dalam 7 hari terakhir

#### AC-12.02: Melihat metrik pencarian dan penemuan dokumen
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Analitik
- **WHEN** Saya melihat dasbor analitik
- **THEN** Kartu data menampilkan jumlah pencarian dalam 7 hari terakhir<br>AND menampilkan persentase pencarian yang tidak menghasilkan hasil<br>AND menampilkan jumlah dokumen yang dibuka dalam 7 hari terakhir

#### AC-12.03: Melihat metrik kualitas hasil AI
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Analitik
- **WHEN** Saya melihat dasbor analitik
- **THEN** Kartu data menampilkan persentase kategori saran yang diubah pengguna dalam 30 hari terakhir<br>AND menampilkan persentase field hasil ekstraksi yang dikoreksi pengguna

#### AC-12.04: Dasbor analitik pada tenant baru
- **GIVEN** Saya seorang Head of Team<br>AND tenant saya belum memiliki dokumen sama sekali
- **WHEN** Saya membuka halaman Analitik
- **THEN** Seluruh kartu data menampilkan nilai 0<br>AND sistem menampilkan pesan: "Belum ada aktivitas untuk ditampilkan"

## US-13: Melihat Audit Trail

**As a** Head of Team,
**I want to** melihat log aktivitas pada dokumen beserta pelaku dan waktunya,
**So that** tracking aktivitas data sensitif terlaksana secara transparan.

> Model event generik ditetapkan pada D14. Unduhan adalah tampilan pertama, bukan satu-satunya event yang dicatat.

### Acceptance Criteria

#### AC-13.01: Melihat log unduhan di halaman Audit Trail
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mengklik menu "Audit Trail" di sidebar
- **THEN** Halaman Audit Trail menampilkan tabel log dengan kolom: Siapa (User), Apa (Nama Dokumen), Aksi, dan Kapan (Waktu)

#### AC-13.02: Log mencatat upaya akses yang ditolak
- **GIVEN** Saya seorang Head of Team<br>AND seorang Member Team mencoba mengunduh dokumen pada kategori berstatus "Inactive"
- **WHEN** Saya membuka halaman Audit Trail
- **THEN** Tabel log menampilkan record dengan aksi "Unduhan ditolak" beserta nama pengguna dan waktu

#### AC-13.03: Audit Trail pada tenant tanpa aktivitas
- **GIVEN** Saya seorang Head of Team<br>AND belum ada aktivitas apa pun di tenant saya
- **WHEN** Saya membuka halaman Audit Trail
- **THEN** Sistem menampilkan pesan: "Belum ada aktivitas tercatat"

## US-14: Mengatur Perizinan Dokumen

**As a** Head of Team,
**I want to** membatasi hak akses download berdasarkan kategori dokumen melalui toggle switch aktif/nonaktif,
**So that** keamanan data sensitif terjaga sesuai kebijakan organisasi.

### Acceptance Criteria

#### AC-14.01: Mengaktifkan perizinan download pada kategori
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di menu Permission Category
- **WHEN** Saya mengklik toggle switch dari status "Inactive" menjadi "Active" pada kategori "Reporting"
- **THEN** Toggle berubah menjadi status Active<br>AND Member Team sekarang dapat melakukan download dokumen pada kategori "Reporting"<br>AND perubahan perizinan tercatat di audit log

#### AC-14.02: Menonaktifkan perizinan download pada kategori
- **GIVEN** Saya seorang Head of Team<br>AND kategori "Offering Letter" berstatus "Active"
- **WHEN** Saya mengklik toggle switch menjadi "Inactive"
- **THEN** Toggle berubah menjadi status Inactive<br>AND permintaan unduhan pada kategori tersebut ditolak dengan status 403 sejak saat itu

#### AC-14.03: Member Team tidak dapat mengubah perizinan (Negative Path)
- **GIVEN** Saya seorang Member Team
- **WHEN** Saya mengakses endpoint pengubahan perizinan kategori secara langsung
- **THEN** Sistem mengembalikan status 403<br>AND perizinan kategori tidak berubah<br>AND upaya tersebut tercatat di audit log

## US-47: Mengoreksi Hasil Ekstraksi AI

**As a** Member Team,
**I want to** memperbaiki tag dan field hasil ekstraksi AI yang salah pada dokumen saya,
**So that** informasi yang ditampilkan sistem dapat dipercaya dan akurasi AI dapat diukur.

> Story baru dari D12. Sumber tunggal metrik akurasi AI pada AC-12.03.

### Acceptance Criteria

#### AC-47.01: Mengoreksi field hasil ekstraksi
- **GIVEN** Saya seorang Member Team<br>AND saya adalah pengunggah dokumen invoice tersebut<br>AND field "Total Nilai" terisi dengan nilai yang salah
- **WHEN** Saya mengklik field tersebut<br>AND saya mengisi nilai yang benar<br>AND saya menyimpan perubahan
- **THEN** Field menampilkan nilai yang saya masukkan<br>AND sistem menyimpan nilai asli hasil AI beserta identitas dan waktu perubahan<br>AND perubahan tercatat di audit log

#### AC-47.02: Mengoreksi tag dokumen
- **GIVEN** Saya seorang Member Team<br>AND dokumen saya memiliki tag "Legal" yang tidak relevan
- **WHEN** Saya menghapus tag tersebut dan menambahkan tag "Finance"
- **THEN** Dokumen menampilkan tag yang telah saya perbarui<br>AND panel Top Tags diperbarui mengikuti perubahan

#### AC-47.03: Member Team lain tidak dapat mengoreksi (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND dokumen tersebut diunggah oleh rekan saya
- **WHEN** Saya mengakses endpoint pengubahan field dokumen tersebut secara langsung
- **THEN** Sistem mengembalikan status 403<br>AND nilai field tidak berubah

#### AC-47.04: Head of Team dapat mengoreksi dokumen milik siapa pun
- **GIVEN** Saya seorang Head of Team<br>AND dokumen tersebut diunggah oleh seorang Member Team
- **WHEN** Saya mengoreksi field "Nama Vendor" pada dokumen tersebut
- **THEN** Field menampilkan nilai yang saya masukkan<br>AND perubahan tercatat di audit log beserta identitas saya

## US-21: Versioning Dokumen Otomatis

**As a** Member Team,
**I want to** mengunggah revisi dokumen dan melihat sistem menetapkan nomor versi baru serta menampilkan satu item di daftar dengan version picker,
**So that** pengguna selalu bekerja dengan versi terbaru tanpa kehilangan histori revisi sebelumnya.

> Dipindahkan ke Release 1 sebagai prasyarat skema (D5, D6). Skema dokumen dan versi harus ada sejak migrasi pertama, atau seluruh dokumen lama perlu backfill. Versi dibuat melalui aksi eksplisit, bukan melalui kecocokan nama file.

### Acceptance Criteria

#### AC-21.01: Mengunggah versi baru melalui aksi eksplisit
- **GIVEN** Saya seorang Member Team<br>AND dokumen proposal.pdf versi v1 sudah ada di sistem<br>AND saya berada di halaman detail dokumen tersebut
- **WHEN** Saya mengklik tombol "Unggah Versi Baru"<br>AND saya memilih file revisi dengan konten berbeda<br>AND saya mengklik tombol "Simpan"
- **THEN** Sistem menetapkan nomor versi v2<br>AND di daftar dokumen tetap tampil 1 item proposal.pdf yang menunjukkan versi terbaru

#### AC-21.02: Mengakses versi lama melalui version picker
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail dokumen proposal.pdf<br>AND dokumen memiliki 3 versi (v1, v2, v3)
- **WHEN** Saya mengklik dropdown version picker<br>AND saya memilih versi "v1"
- **THEN** Viewer menampilkan isi dokumen versi v1<br>AND tombol "Download" mengunduh file versi v1

#### AC-21.03: Menolak versi baru dengan konten identik (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail dokumen proposal.pdf versi v1
- **WHEN** Saya mengklik tombol "Unggah Versi Baru"<br>AND saya memilih file dengan konten yang identik dengan versi v1
- **THEN** Sistem menampilkan pesan error: "Isi file sama dengan versi yang sudah ada"<br>AND tidak ada versi baru yang dibuat

#### AC-21.04: Dua pengguna mengunggah versi baru secara bersamaan
- **GIVEN** Saya dan rekan saya membuka dokumen yang sama<br>AND kami mengunggah versi baru pada saat yang bersamaan
- **WHEN** Kedua unggahan diproses
- **THEN** Kedua versi tersimpan dengan nomor versi berurutan tanpa duplikasi<br>AND version picker menampilkan kedua versi tersebut

## US-33: Mencari Teks di Dalam Isi Berkas (Deep Content Search)

**As a** Member Team,
**I want to** mencari kata atau frasa spesifik yang berada di dalam isi konten berkas (PDF, DOCX, XLSX, TXT, Scan PDF) melalui bar pencarian,
**So that** informasi di bagian dalam halaman berkas ditemukan secara presisi dengan highlight lokasi pencocokan tanpa membuka dan membaca dokumen satu per satu.

> Bahasa OCR yang didukung: Indonesia dan Inggris (D8).

### Acceptance Criteria

#### AC-33.01: Pencarian kata kunci di dalam isi konten berkas
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND dokumen kontrak-kerjasama.pdf yang berisi kata "klausul-kerahasiaan" di halaman 15 sudah terindeks<br>AND tenant saya berisi 100.000 dokumen<br>AND terdapat 20 pencarian bersamaan pada saat yang sama
- **WHEN** Saya mengklik bar pencarian<br>AND saya mengetik "klausul-kerahasiaan"<br>AND saya menekan tombol Enter
- **THEN** Berkas kontrak-kerjasama.pdf muncul di daftar hasil pencarian<br>AND menampilkan cuplikan teks halaman 15 yang disorot (highlighted)<br>AND waktu respons pencarian kurang dari 3 detik

#### AC-33.02: Sorotan pencocokan kata kunci pada Document Viewer
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman hasil pencarian teks mendalam
- **WHEN** Saya mengklik dokumen kontrak-kerjasama.pdf dari hasil pencarian
- **THEN** Document Viewer terbuka dan langsung melompat ke posisi teks yang cocok (halaman untuk PDF / paragraf untuk DOCX/TXT)<br>AND kata kunci ditandai dengan warna kuning (highlighted)

#### AC-33.03: Dokumen belum selesai terindeks
- **GIVEN** Saya seorang Member Team<br>AND dokumen yang saya unggah masih berstatus "Diproses"
- **WHEN** Saya mencari kata kunci yang ada di dalam isi dokumen tersebut
- **THEN** Dokumen tersebut belum muncul di hasil pencarian<br>AND sistem menampilkan catatan: "Sebagian dokumen masih diproses dan belum dapat dicari"

## US-34: Memfilter Dokumen Berdasarkan Kategori

**As a** Member Team,
**I want to** memfilter daftar dokumen yang ditampilkan berdasarkan kategori tertentu seperti Proposal, Technical Spec, Contract Agreement, atau Financial,
**So that** dokumen yang dicari ditemukan lebih cepat karena lingkup pencarian dipersempit sesuai klasifikasi.

### Acceptance Criteria

#### AC-34.01: Memfilter dokumen berdasarkan satu kategori
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman yang menampilkan daftar dokumen<br>AND terdapat dokumen dengan berbagai kategori
- **WHEN** Saya memilih kategori "Proposal" pada filter kategori
- **THEN** Hanya dokumen dengan kategori "Proposal" yang ditampilkan<br>AND dokumen dari kategori lain tidak terlihat

#### AC-34.02: Menampilkan kembali semua dokumen
- **GIVEN** Saya seorang Member Team<br>AND saya sedang memfilter dokumen pada kategori "Proposal"
- **WHEN** Saya memilih opsi untuk menampilkan semua kategori
- **THEN** Seluruh dokumen dari semua kategori ditampilkan kembali

#### AC-34.03: Filter kategori pada kondisi kosong
- **GIVEN** Saya seorang Member Team<br>AND tidak ada dokumen dengan kategori "Financial" di dalam sistem
- **WHEN** Saya memilih kategori "Financial" pada filter kategori
- **THEN** Sistem menampilkan pesan: "Tidak ada dokumen pada kategori ini"

## US-35: Melihat Kapasitas Penyimpanan

**As a** Member Team,
**I want to** melihat informasi persentase penggunaan ruang penyimpanan dan sisa kuota yang tersedia,
**So that** keputusan untuk menghapus atau mengarsipkan dokumen lama diambil sebelum kuota penuh dan proses upload gagal.

> Kuota adalah nilai per tenant yang ditetapkan Super Admin (D10, D16). Tidak bergantung pada US-16 yang berada di roadmap.

### Acceptance Criteria

#### AC-35.01: Melihat informasi kapasitas penyimpanan
- **GIVEN** Saya seorang Member Team<br>AND saya telah masuk ke dalam sistem<br>AND total penyimpanan yang telah terpakai adalah 25% dari kuota
- **WHEN** Saya melihat informasi kapasitas penyimpanan yang tersedia di antarmuka
- **THEN** Sistem menampilkan indikator kapasitas penyimpanan berisi persentase penggunaan (25%)<br>AND indikator visual (progress bar) yang merepresentasikan proporsi pemakaian

#### AC-35.02: Mendapat peringatan kapasitas hampir penuh
- **GIVEN** Saya seorang Member Team<br>AND total penyimpanan yang telah terpakai mencapai 80% atau lebih dari kuota
- **WHEN** Saya melihat informasi kapasitas penyimpanan
- **THEN** Indikator penyimpanan berubah warna menjadi kuning atau oranye (warning)<br>AND sistem menampilkan pesan peringatan: "Kapasitas penyimpanan hampir penuh"

#### AC-35.03: Upload ditolak saat kapasitas penuh (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND total penyimpanan telah mencapai 100% dari kuota
- **WHEN** Saya menyeret satu file PDF ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan error: "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan"<br>AND file tidak tersimpan ke dalam sistem

#### AC-35.04: Kuota habis di tengah unggahan beberapa file (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND sisa kuota hanya cukup untuk dua dari tiga file yang saya unggah
- **WHEN** Saya menyeret tiga file sekaligus ke area unggah
- **THEN** Dua file pertama tersimpan<br>AND file ketiga ditolak dengan pesan: "Kapasitas penyimpanan penuh"<br>AND sistem menampilkan ringkasan: "2 dari 3 file berhasil diunggah"

## US-36: Mengganti Tema Antarmuka

**As a** Member Team,
**I want to** mengganti tampilan antarmuka antara mode terang (light) dan mode gelap (dark),
**So that** kenyamanan membaca dokumen meningkat sesuai preferensi dan kondisi pencahayaan lingkungan kerja.

### Acceptance Criteria

#### AC-36.01: Mengaktifkan mode gelap
- **GIVEN** Saya seorang Member Team<br>AND antarmuka sedang menampilkan tema terang (light mode)
- **WHEN** Saya mengklik tombol "Dark" untuk mengganti tema
- **THEN** Seluruh antarmuka berubah ke tema gelap (dark mode)<br>AND teks tombol berubah menjadi "Light"<br>AND perubahan tema berlaku untuk seluruh halaman

#### AC-36.02: Preferensi tema tersimpan
- **GIVEN** Saya seorang Member Team<br>AND saya telah mengaktifkan mode gelap (dark mode)
- **WHEN** Saya menutup browser<br>AND saya membuka kembali aplikasi Archiva
- **THEN** Antarmuka tetap menampilkan tema gelap sesuai preferensi terakhir yang dipilih

## US-37: Memfilter Data pada Tabel (Lokal Filter)

**As a** Member Team,
**I want to** memfilter data di tabel daftar dokumen maupun tabel administrasi secara langsung menggunakan kata kunci yang diketik pada kolom filter tabel,
**So that** dokumen atau record spesifik ditemukan dengan cepat dari daftar yang panjang tanpa harus scroll manual.

### Acceptance Criteria

#### AC-37.01: Memfilter tabel daftar dokumen berdasarkan kata kunci judul
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman daftar dokumen<br>AND terdapat dokumen bernama bds-requirement.xlsx di dalam tabel
- **WHEN** Saya mengetik "req" di kolom filter tabel
- **THEN** Tabel hanya menampilkan dokumen yang judulnya mengandung kata "req"<br>AND dokumen yang tidak relevan tersembunyi

#### AC-37.02: Memfilter data di halaman Audit Trail
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Audit Trail<br>AND terdapat log aktivitas dari user "Zayd Almasi"
- **WHEN** Saya mengetik "Zayd" di kolom filter halaman Audit Trail
- **THEN** Tabel hanya menampilkan record yang mengandung kata "Zayd" pada kolom User atau Document Name<br>AND record lain tersembunyi

#### AC-37.03: Filter tabel tidak menemukan hasil
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman daftar dokumen
- **WHEN** Saya mengetik "xyznotexist" di kolom filter tabel
- **THEN** Tabel menampilkan pesan: "Tidak ada dokumen yang sesuai"

## US-38: Melihat Dokumen dalam Tampilan Kartu Visual

**As a** Member Team,
**I want to** melihat dokumen yang baru diunggah ditampilkan sebagai kartu visual berisi ikon tipe file, judul, tanggal unggah, dan nama pengunggah,
**So that** status dokumen terbaru dikenali secara visual dengan lebih cepat dibandingkan format tabel.

### Acceptance Criteria

#### AC-38.01: Melihat dokumen terbaru sebagai kartu visual
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND terdapat beberapa dokumen yang sudah diunggah
- **WHEN** Saya melihat section daftar dokumen yang telah diunggah
- **THEN** Setiap dokumen ditampilkan sebagai kartu visual berisi ikon tipe file (PDF/DOCX/XLSX/TXT), judul dokumen, tanggal unggah, nama pengunggah, dan status pemrosesan

#### AC-38.02: Navigasi dari kartu ke detail dokumen
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND sebuah dokumen ditampilkan sebagai kartu
- **WHEN** Saya mengklik kartu dokumen tersebut
- **THEN** Halaman detail dokumen terbuka menampilkan metadata, extracted fields, dan preview dokumen tersebut

#### AC-38.03: Dasbor tanpa dokumen
- **GIVEN** Saya seorang Member Team<br>AND tenant saya belum memiliki dokumen sama sekali
- **WHEN** Saya membuka halaman Dasbor
- **THEN** Sistem menampilkan pesan: "Belum ada dokumen. Seret file ke area unggah untuk memulai"

## US-39: Menavigasi Halaman Data dengan Paginasi

**As a** Member Team,
**I want to** menavigasi data yang berjumlah besar melalui kontrol paginasi yang menampilkan jumlah total data dan nomor halaman,
**So that** data ditampilkan dalam porsi yang ringan dan mudah di-review tanpa membebani waktu muat halaman.

### Acceptance Criteria

#### AC-39.01: Melihat informasi jumlah data dan paginasi
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman yang menampilkan 123 record data<br>AND jumlah baris per halaman adalah 10
- **WHEN** Saya melihat kontrol paginasi pada halaman tersebut
- **THEN** Sistem menampilkan informasi jumlah data: "Menampilkan 1 - 10 dari 123 data"<br>AND menampilkan kontrol navigasi halaman (Sebelumnya, 1, 2, 3, Berikutnya)

#### AC-39.02: Berpindah ke halaman berikutnya
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman 1 dari 13 halaman<br>AND halaman saat ini menampilkan record 1-10
- **WHEN** Saya mengklik tombol "Berikutnya" atau mengklik nomor halaman "2"
- **THEN** Tabel menampilkan record 11-20<br>AND informasi berubah menjadi "Menampilkan 11 - 20 dari 123 data"<br>AND nomor halaman "2" menjadi aktif (highlighted)

#### AC-39.03: Hasil filter kurang dari satu halaman
- **GIVEN** Saya seorang Member Team<br>AND saya memfilter data sehingga tersisa 4 record
- **WHEN** Saya melihat kontrol paginasi
- **THEN** Sistem menampilkan "Menampilkan 1 - 4 dari 4 data"<br>AND kontrol navigasi halaman tidak ditampilkan

## US-40: Masuk ke Sistem (Login dan Logout)

**As a** Member Team,
**I want to** masuk ke dalam sistem menggunakan kredensial akun (email dan password) dan melihat informasi profil serta peran (role) yang melekat pada akunnya,
**So that** akses ke sistem terkontrol dan setiap tindakan terekam atas identitas pengguna yang terverifikasi.

### Acceptance Criteria

#### AC-40.01: Login dengan kredensial yang valid
- **GIVEN** Saya seorang pengguna terdaftar<br>AND saya berada di halaman Login<br>AND akun saya memiliki role "Member"
- **WHEN** Saya mengisi field "Email" dengan email terdaftar<br>AND saya mengisi field "Password" dengan password yang benar<br>AND saya mengklik tombol "Login"
- **THEN** Halaman Dasbor ditampilkan<br>AND informasi profil saya ditampilkan berisi nama pengguna, role ("MEMBER"), dan avatar

#### AC-40.02: Login dengan kredensial yang salah (Negative Path)
- **GIVEN** Saya seorang pengguna<br>AND saya berada di halaman Login
- **WHEN** Saya mengisi field "Email" dengan email terdaftar<br>AND saya mengisi field "Password" dengan password yang salah<br>AND saya mengklik tombol "Login"
- **THEN** Sistem menampilkan pesan error: "Email atau password salah"<br>AND saya tetap berada di halaman Login

#### AC-40.03: Logout dari sistem
- **GIVEN** Saya seorang Member Team<br>AND saya telah berhasil login<br>AND informasi profil saya ditampilkan
- **WHEN** Saya mengklik ikon pengaturan pada profil saya<br>AND saya memilih opsi "Logout"
- **THEN** Sesi saya berakhir<br>AND halaman Login ditampilkan kembali

#### AC-40.04: Sesi berakhir karena tidak aktif
- **GIVEN** Saya seorang Member Team<br>AND saya telah berhasil login<br>AND saya tidak melakukan aktivitas apa pun melebihi batas waktu sesi
- **WHEN** Saya mengklik menu apa pun di antarmuka
- **THEN** Sistem menampilkan pesan: "Sesi Anda telah berakhir. Silakan login kembali"<br>AND halaman Login ditampilkan

## US-41: Melihat Menu Navigasi Sesuai Peran (Role-Based Navigation)

**As a** Member Team,
**I want to** melihat menu navigasi yang ditampilkan sesuai dengan peran (role) yang melekat pada akunnya,
**So that** pengguna hanya mengakses fitur yang relevan dengan tanggung jawabnya dan tidak terdistraksi oleh fitur yang bukan wewenangnya.

> Model peran bertingkat, satu peran per pengguna per tenant (D10). Menu "Retention Policy" dihapus dari Release 1 karena US-26 berada di roadmap. Penyembunyian menu adalah tampilan, bukan pengamanan: setiap rute wajib memvalidasi peran di sisi server (D14).

### Acceptance Criteria

#### AC-41.01: Member Team melihat menu sesuai perannya
- **GIVEN** Saya seorang Member Team<br>AND saya telah berhasil login
- **WHEN** Saya melihat daftar menu navigasi yang tersedia
- **THEN** Menu yang ditampilkan hanya berisi "Dashboard" dan "Document"<br>AND menu "Permission Category", "Audit Trail" dan "Configuration" tidak ditampilkan

#### AC-41.02: Head of Team melihat menu administrasi
- **GIVEN** Saya seorang Head of Team<br>AND saya telah berhasil login
- **WHEN** Saya melihat daftar menu navigasi yang tersedia
- **THEN** Menu yang ditampilkan berisi seluruh menu Member Team<br>AND ditambah "Permission Category", "Audit Trail" dan "Analitik"

#### AC-41.03: Admin Tenant melihat seluruh menu tenant
- **GIVEN** Saya seorang Admin Tenant<br>AND saya telah berhasil login
- **WHEN** Saya melihat daftar menu navigasi yang tersedia
- **THEN** Menu yang ditampilkan berisi seluruh menu Head of Team<br>AND ditambah "Configuration"

#### AC-41.04: Super Admin melihat menu lintas tenant
- **GIVEN** Saya seorang Super Admin<br>AND saya telah berhasil login
- **WHEN** Saya melihat daftar menu navigasi yang tersedia
- **THEN** Menu yang ditampilkan berisi "Manajemen Tenant"<br>AND menu dokumen milik tenant tidak ditampilkan

#### AC-41.05: Menolak akses rute administrasi melalui akses langsung (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND saya telah berhasil login
- **WHEN** Saya mengakses endpoint halaman "Permission Category" secara langsung
- **THEN** Sistem mengembalikan status 403<br>AND tidak ada data administrasi yang dikembalikan<br>AND upaya akses tercatat di audit log

## US-42: Menentukan Batas Maksimal Ukuran Dokumen yang Dapat Diunggah

**As a** Admin Tenant,
**I want to** menentukan ukuran dokumen yang bisa diunggah oleh Member Team,
**So that** memberikan batasan dokumen yang diunggah untuk memastikan memori penyimpanan tidak bengkak.

> Direvisi setelah D16. Halaman Configuration menampilkan daftar parameter tetap yang benar-benar dibaca sistem, masing-masing bertipe dan bernilai default. Administrator mengubah nilai, bukan nama parameter. Penegakan batas ukuran diuji pada AC-01.06.

### Acceptance Criteria

#### AC-42.01: Melihat daftar parameter konfigurasi
- **GIVEN** Saya seorang Admin Tenant<br>AND saya telah berhasil login
- **WHEN** Saya menekan menu "Configuration"
- **THEN** Sistem menampilkan halaman "Configuration" berisi tabel dengan kolom Parameter, Nilai, Satuan, dan Nilai Default<br>AND tabel berisi parameter "Max File Size" (MB, default 20), "Batas Waktu Konfirmasi Kategori" (hari, default 7), dan "Kuota Penyimpanan" (GB)<br>AND terdapat tombol edit di sebelah kanan tiap baris

#### AC-42.02: Mengubah nilai parameter
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Configuration<br>AND parameter "Max File Size" bernilai 20
- **WHEN** Saya mengklik tombol edit pada baris tersebut<br>AND saya mengubah nilai menjadi 50<br>AND saya mengklik ikon centang
- **THEN** Sistem menampilkan pesan: "Konfigurasi berhasil disimpan"<br>AND baris "Max File Size" menampilkan nilai 50<br>AND perubahan tercatat di audit log

#### AC-42.03: Menolak nilai yang tidak valid (Negative Path)
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Configuration
- **WHEN** Saya mengubah nilai "Max File Size" menjadi "dua puluh"<br>AND saya mengklik ikon centang
- **THEN** Sistem menampilkan pesan error: "Nilai harus berupa angka"<br>AND nilai parameter tidak berubah

#### AC-42.04: Menolak nilai di luar rentang yang diizinkan (Negative Path)
- **GIVEN** Saya seorang Admin Tenant<br>AND rentang yang diizinkan untuk "Max File Size" adalah 1 sampai 200 MB
- **WHEN** Saya mengubah nilai menjadi 500<br>AND saya mengklik ikon centang
- **THEN** Sistem menampilkan pesan error: "Nilai harus antara 1 dan 200 MB"<br>AND nilai parameter tidak berubah

#### AC-42.05: Mengembalikan parameter ke nilai default
- **GIVEN** Saya seorang Admin Tenant<br>AND parameter "Max File Size" bernilai 50
- **WHEN** Saya mengklik opsi "Kembalikan ke Default" pada baris tersebut
- **THEN** Nilai parameter kembali menjadi 20<br>AND sistem menampilkan pesan: "Konfigurasi berhasil disimpan"

---

# Roadmap (Not in Release 1)

US-15 to US-32 are out of scope for release 1 (D1). They are retained here with their acceptance criteria remapped to the correct story: in version 1.0 of this document every AC block from US-09 onward was attached to the story above it rather than its own.

Each of these stories carries a single happy-path criterion and is not refined. Several are epics rather than stories and must be split before estimation. Do not estimate any of them in their current form.

## US-15: Mengelola Tenant Multi-tenant

**As a** Super Admin,
**I want to** menambah, mengedit, menonaktifkan, atau menghapus tenant/organisasi di dasbor Super Admin,
**So that** platform melayani banyak organisasi secara aman dengan isolasi data mutlak antar tenant.

> Fondasi isolasi data dan pembuatan tenant sudah dipindahkan ke US-43 di Release 1. Sisa story ini adalah siklus hidup tenant (edit, nonaktif, hapus) dan harus dipecah sebelum diestimasi.

### Acceptance Criteria

#### AC-15.01: Memastikan isolasi data antar tenant
- **GIVEN** Saya seorang Member Team dari Tenant A<br>AND saya berada di halaman Dasbor<br>AND Tenant B memiliki dokumen rahasia-b.pdf
- **WHEN** Saya mengetik "rahasia-b" di bar pencarian<br>AND saya menekan tombol Enter
- **THEN** Sistem menampilkan pesan: "Tidak ada hasil yang ditemukan"<br>AND dokumen milik Tenant B tidak muncul di hasil pencarian

## US-16: Mengonfigurasi Tiering SaaS dan Feature Flags

**As a** Super Admin,
**I want to** membuat paket tiering SaaS dan mengaktifkan atau menonaktifkan modul microservice per tenant secara real-time,
**So that** fleksibilitas monetisasi bisnis SaaS dan komersialisasi berjenjang tercapai.

> Epic. Perlu dipecah menjadi definisi tier dan evaluasi feature flag pada navigasi serta API.

### Acceptance Criteria

#### AC-16.01: Membuat paket tiering SaaS baru
- **GIVEN** Saya seorang Super Admin<br>AND saya berada di halaman Konfigurasi Tiering
- **WHEN** Saya mengklik tombol "Tambah Tier"<br>AND saya mengisi field "Nama Tier" dengan "Professional"<br>AND saya mencentang modul "Upload", "Search", "E-Signature"<br>AND saya mengklik tombol "Simpan"
- **THEN** Tier "Professional" muncul di daftar tier<br>AND menampilkan 3 modul yang diaktifkan

#### AC-16.02: Pengguna tenant hanya melihat fitur sesuai tier
- **GIVEN** Saya seorang Member Team dari tenant dengan tier "Basic"<br>AND tier Basic hanya mencakup modul Upload dan Search
- **WHEN** Saya melihat sidebar navigasi di halaman Dasbor
- **THEN** Menu "E-Signature" dan "Analitik" tidak muncul di sidebar<br>AND hanya menu yang sesuai tier Basic yang ditampilkan

## US-17: Membuat Task Penandatanganan Dokumen

**As a** Admin Tenant,
**I want to** memilih dokumen, menentukan posisi tanda tangan, dan memetakan daftar penanda tangan secara berjenjang (Level 1 hingga Level 3),
**So that** proses persetujuan dan penandatanganan dokumen terdigitalisasi secara resmi dan terstruktur.

> Ruang lingkup e-signature belum ditetapkan: tanda tangan elektronik tersertifikasi (UU ITE, PSrE) atau alur persetujuan internal. Selisih biaya antara keduanya sangat besar dan harus diputuskan sebelum estimasi.

### Acceptance Criteria

#### AC-17.01: Membuat task penandatanganan dengan mapping berjenjang
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman E-Signature<br>AND dokumen kontrak-vendor.pdf tersedia di sistem
- **WHEN** Saya mengklik tombol "Buat Task Signature"<br>AND saya memilih dokumen kontrak-vendor.pdf<br>AND saya menambahkan penanda tangan Level 1: "Manager A"<br>AND saya menambahkan penanda tangan Level 2: "Direktur B"<br>AND saya mengklik tombol "Kirim Task"
- **THEN** Notifikasi sukses muncul: "Task signature berhasil dibuat"<br>AND task muncul di daftar dengan status "Pending"<br>AND dokumen terkunci (locked) dari pengeditan

## US-18: Memantau Progress Penandatanganan Dokumen

**As a** Admin Tenant,
**I want to** memantau status dan progres penandatanganan dokumen secara real-time melalui dashboard pemantauan,
**So that** transparansi alur persetujuan terwujud dan bottleneck teridentifikasi lebih cepat.

### Acceptance Criteria

#### AC-18.01: Memantau progress penandatanganan
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman E-Signature<br>AND task kontrak-vendor.pdf berstatus In Progress
- **WHEN** Saya mengklik nama task kontrak-vendor.pdf di daftar
- **THEN** Halaman detail menampilkan visual progress bar<br>AND menampilkan timestamp kapan Level 1 menandatangani<br>AND menampilkan status Level 2 sebagai "Menunggu Tanda Tangan"

## US-19: Mengelola Deadline dan Notifikasi Penandatanganan

**As a** Admin Tenant,
**I want to** menetapkan deadline penandatanganan dan mengonfigurasi pengiriman notifikasi reminder serta alert overdue otomatis,
**So that** dokumen tertandatangani tepat waktu dan penumpukan berkas pending tercegah.

### Acceptance Criteria

#### AC-19.01: Menetapkan deadline dan menerima alert overdue
- **GIVEN** Saya seorang Admin Tenant<br>AND saya sedang membuat task signature baru
- **WHEN** Saya memilih tanggal deadline di field "Batas Waktu"<br>AND saya mengklik tombol "Kirim Task"
- **THEN** Task tersimpan dengan deadline yang ditentukan<br>AND sistem menjadwalkan pengiriman notifikasi reminder H-1<br>AND jika melewati deadline, alert overdue dikirim ke Admin dan penanda tangan

## US-20: Mengonfigurasi Role Mapping Penandatanganan

**As a** Admin Tenant,
**I want to** membuat pemetaan peran khusus signature dan menetapkan kewenangan akses secara dinamis tanpa hardcoding,
**So that** tata kelola kewenangan penandatanganan sesuai struktur organisasi terjaga.

> Tumpang tindih dengan US-17 dan US-27. Ketiganya mengonfigurasi alur persetujuan yang sama.

### Acceptance Criteria

#### AC-20.01: Membuat role mapping penandatanganan baru
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Role Mapping
- **WHEN** Saya mengklik tombol "Tambah Role"<br>AND saya mengisi field "Nama Role" dengan "Finance Approver"<br>AND saya mencentang kewenangan "Menandatangani" dan "Memantau"<br>AND saya mengklik tombol "Simpan"
- **THEN** Notifikasi sukses muncul: "Role berhasil ditambahkan"<br>AND role "Finance Approver" muncul di tabel daftar role

## US-22: Menavigasi Dokumen via Metadata View (Folderless)

**As a** Member Team,
**I want to** mengakses dan menavigasi seluruh dokumen melalui metadata view tanpa bergantung pada struktur folder hirarkis,
**So that** penemuan dokumen lebih intuitif karena berbasis konteks konten bukan lokasi penyimpanan.

### Acceptance Criteria

#### AC-22.01: Menavigasi dokumen melalui metadata view
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND ada beberapa dokumen dengan metadata Klien, Proyek, dan Tipe berbeda
- **WHEN** Saya mengklik tab "Metadata View" di atas daftar dokumen<br>AND saya memilih filter "Klien: PT ABC"
- **THEN** Daftar dokumen diperbarui menampilkan hanya dokumen milik klien PT ABC<br>AND navigasi tidak menggunakan struktur folder hirarkis

## US-23: Menangkap Dokumen dari Multi-Source (Email dan Scanner)

**As a** Member Team,
**I want to** mengunggah dokumen langsung dari email inbox atau scanner hardware selain melalui drag-and-drop web,
**So that** semua sumber dokumen tercakup tanpa proses manual download-lalu-upload ulang.

> Perlu dipecah menjadi capture dari email dan capture dari scanner. Protokol scanner (TWAIN, network scanner, atau watched folder) belum ditentukan. Jalur scanner menghasilkan gambar, sehingga daftar tipe file pada D7 perlu ditinjau ulang saat story ini masuk sprint.

### Acceptance Criteria

#### AC-23.01: Menangkap dokumen dari email inbox
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Capture Source<br>AND email inbox sudah terhubung ke DMS
- **WHEN** Saya mengklik tombol "Capture from Email"<br>AND saya memilih email dengan attachment kontrak.pdf<br>AND saya mengklik tombol "Import"
- **THEN** File kontrak.pdf muncul di daftar dokumen<br>AND metadata pengirim email terekstrak otomatis

## US-24: Menyimpan dan Menandatangani Dokumen via Plugin Email/Office

**As a** Member Team,
**I want to** menyimpan dokumen ke DMS dan memulai permintaan tanda tangan langsung dari plugin di Outlook, Word, atau Gmail tanpa membuka portal web DMS,
**So that** friction berpindah aplikasi terhilangkan dan tingkat adopsi DMS meningkat.

> Perlu dipecah per plugin (Outlook, Word, Gmail). Masing-masing menempuh review marketplace Microsoft atau Google dengan waktu kalender di luar siklus sprint.

### Acceptance Criteria

#### AC-24.01: Menyimpan dokumen ke DMS dari plugin Outlook
- **GIVEN** Saya seorang Member Team<br>AND saya membuka email dengan attachment di Outlook<br>AND plugin DMS sudah terinstal di Outlook
- **WHEN** Saya mengklik tombol "Save to DMS" di toolbar plugin Outlook<br>AND saya memilih attachment laporan.pdf<br>AND saya mengklik tombol "Simpan"
- **THEN** Notifikasi sukses muncul di plugin: "Dokumen berhasil disimpan ke DMS"<br>AND file muncul di daftar dokumen saat membuka web DMS

## US-25: Mengekstrak Field Spesifik dari Dokumen Terstruktur

**As a** Member Team,
**I want to** melihat sistem secara otomatis mengekstrak field spesifik dari dokumen terstruktur seperti nomor invoice, tanggal jatuh tempo, nilai pajak, dan nama vendor,
**So that** input data manual dari dokumen keuangan dan legal tereliminasi dan akurasi data meningkat.

> Jalur koreksi hasil ekstraksi sudah dipindahkan ke US-47 di Release 1. Story ini memerlukan spike akurasi terhadap sampel dokumen nyata sebelum diestimasi.

### Acceptance Criteria

#### AC-25.01: Mengekstrak field spesifik dari invoice
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah file invoice PDF<br>AND proses ekstraksi AI selesai
- **WHEN** Saya mengklik nama dokumen invoice tersebut di daftar dokumen
- **THEN** Halaman detail dokumen menampilkan section "Extracted Fields" berisi Nomor Invoice, Tanggal Jatuh Tempo, Total Nilai, dan Nama Vendor yang terisi otomatis

## US-26: Mengelola Kebijakan Retensi Dokumen (CRUD)

**As a** Admin Tenant,
**I want to** menetapkan, mengedit, dan menghapus kebijakan retensi dokumen per kategori (periode aktif, arsip pasif, pemusnahan) serta memantau jadwal pemusnahan otomatis,
**So that** kepatuhan regulasi kearsipan terpenuhi dan risiko penyimpanan dokumen kadaluarsa termitigasi.

> Pemusnahan otomatis harus berupa soft delete dengan periode purge yang terdokumentasi, record audit pemusnahan yang tetap bertahan setelah dokumen dimusnahkan, dan mekanisme legal hold yang dapat menunda pemusnahan. Data pribadi diasumsikan berada dalam lingkup UU PDP.

### Acceptance Criteria

#### AC-26.01: Menetapkan kebijakan retensi baru pada kategori dokumen
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Retention Policy
- **WHEN** Saya mengklik tombol "Tambah Kebijakan"<br>AND saya memilih kategori "Kontrak"<br>AND saya mengisi field "Periode Aktif" dengan "5 tahun"<br>AND saya mengisi field "Periode Arsip Pasif" dengan "5 tahun"<br>AND saya mengisi field "Pemusnahan" dengan "Otomatis setelah 10 tahun"<br>AND saya mengklik tombol "Simpan"
- **THEN** Notifikasi sukses muncul: "Kebijakan retensi berhasil disimpan"<br>AND kebijakan muncul di tabel daftar retention policy

#### AC-26.02: Mengedit periode retensi pada kebijakan yang sudah ada
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Retention Policy<br>AND kebijakan kategori "Kontrak" dengan Periode Aktif "5 Tahun" sudah ada di tabel
- **WHEN** Saya mengklik ikon menu aksi pada baris kebijakan "Kontrak"<br>AND saya memilih opsi "Edit"<br>AND saya mengubah field "Periode Aktif" dari "5 Tahun" menjadi "7 Tahun"<br>AND saya mengklik tombol "Simpan Perubahan"
- **THEN** Notifikasi sukses muncul: "Kebijakan retensi berhasil diperbarui"<br>AND baris "Kontrak" di tabel menampilkan Periode Aktif "7 Tahun"

#### AC-26.03: Menghapus kebijakan retensi dengan konfirmasi
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Retention Policy<br>AND kebijakan kategori "Pact" sudah ada di tabel
- **WHEN** Saya mengklik ikon menu aksi pada baris kebijakan "Pact"<br>AND saya memilih opsi "Hapus"<br>AND saya mengklik tombol konfirmasi penghapusan
- **THEN** Notifikasi sukses muncul: "Kebijakan retensi berhasil dihapus"<br>AND baris "Pact" hilang dari tabel

## US-27: Merancang Alur Approval secara Visual

**As a** Admin Tenant,
**I want to** merancang alur persetujuan berjenjang secara visual menggunakan drag-and-drop node dengan branching logic dan kondisi,
**So that** kesalahan konfigurasi alur persetujuan berkurang drastis dan setup alur baru menjadi lebih cepat.

> Epic. Menggantikan US-17 dan US-20 jika dibangun. Salah satu dari keduanya harus dipilih, bukan ketiganya.

### Acceptance Criteria

#### AC-27.01: Merancang alur approval dengan visual builder
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Workflow Designer
- **WHEN** Saya menyeret node "Start" ke canvas<br>AND saya menyeret node "Approval: Manager" dan menghubungkannya<br>AND saya menyeret node "Condition: Nilai lebih dari 500 juta" dan menghubungkan branch Ya ke "Approval: Direktur"<br>AND saya mengklik tombol "Simpan Workflow"
- **THEN** Workflow tersimpan dengan diagram visual yang menampilkan alur berjenjang<br>AND notifikasi sukses muncul: "Workflow berhasil disimpan"

## US-28: Mengelola Peminjaman Arsip Fisik

**As a** Admin Tenant,
**I want to** mencatat peminjaman dan pengembalian dokumen fisik (kertas) serta melacak status sirkulasi arsip,
**So that** tracking dokumen fisik terpusat dan kehilangan arsip tercegah.

### Acceptance Criteria

#### AC-28.01: Mencatat peminjaman arsip fisik
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Peminjaman Arsip
- **WHEN** Saya mengklik tombol "Catat Peminjaman"<br>AND saya memilih dokumen "Kontrak-2024-001"<br>AND saya mengisi field "Peminjam" dengan "John Doe"<br>AND saya memilih tanggal pengembalian di datepicker<br>AND saya mengklik tombol "Simpan"
- **THEN** Record peminjaman muncul di tabel dengan status "Dipinjam"<br>AND menampilkan nama peminjam dan tanggal pengembalian yang ditentukan

## US-29: Mengakses Dokumen dari Repositori Eksternal

**As a** Member Team,
**I want to** mencari dan mengakses dokumen dari repositori eksternal (SharePoint, Google Drive, Network Drive) melalui satu tampilan tunggal DMS,
**So that** dokumen tidak lagi tersebar di banyak platform dan satu sumber kebenaran terwujud.

> Perlu dipecah per repositori. Bangun satu terlebih dahulu, lalu putuskan sisanya.

### Acceptance Criteria

#### AC-29.01: Mengakses dokumen dari Google Drive melalui DMS
- **GIVEN** Saya seorang Member Team<br>AND koneksi Google Drive sudah dikonfigurasi oleh Admin<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mengklik tab "External Sources"<br>AND saya memilih "Google Drive" dari daftar sumber<br>AND saya mengetik "proposal" di field pencarian
- **THEN** Daftar menampilkan file dari Google Drive yang mengandung kata "proposal"<br>AND saya dapat melakukan preview dan download langsung dari tampilan DMS

## US-30: Mengakses DMS via Aplikasi Desktop dan Mobile

**As a** Member Team,
**I want to** mengakses seluruh fitur DMS melalui aplikasi desktop native (Windows/Mac) dan aplikasi mobile (iOS/Android),
**So that** produktivitas tidak terhambat oleh keterbatasan browser dan akses mobile terfasilitasi.

> Perlu dipecah menjadi mobile dan desktop. Konfirmasi terlebih dahulu apakah aplikasi web responsif sudah memenuhi kebutuhan, karena hal itu menghilangkan kedua jalur review app store.

### Acceptance Criteria

#### AC-30.01: Mengakses DMS dari aplikasi mobile
- **GIVEN** Saya seorang Member Team<br>AND saya membuka aplikasi DMS di perangkat mobile (iOS/Android)
- **WHEN** Saya melakukan login dengan kredensial yang sama dengan web<br>AND saya mengetik "laporan" di bar pencarian<br>AND saya menekan tombol cari
- **THEN** Hasil pencarian menampilkan dokumen yang relevan<br>AND saya dapat melakukan preview dan download dokumen dari aplikasi mobile

## US-31: Melakukan Deployment On-Premises atau Hybrid

**As a** Super Admin,
**I want to** menginstalasi dan mengoperasikan DMS di server lokal perusahaan (on-premises) atau dalam arsitektur hybrid (cloud + on-premises),
**So that** organisasi dengan kebijakan data residency ketat tetap dapat menggunakan DMS.

> Story ini membatasi seluruh pilihan arsitektur. Karena Release 1 berjalan cloud-only (D1), setiap dependensi infrastruktur yang dipilih sekarang wajib memiliki padanan yang dapat di-host sendiri: object storage, search index, OCR, dan inferensi model (D8).

### Acceptance Criteria

#### AC-31.01: Melakukan deployment DMS ke server on-premises
- **GIVEN** Saya seorang Super Admin<br>AND server on-premises perusahaan sudah memenuhi spesifikasi minimum
- **WHEN** Saya menjalankan installer DMS on-premises<br>AND saya mengisi konfigurasi database lokal<br>AND saya mengklik tombol "Install"
- **THEN** Proses instalasi selesai dengan notifikasi: "DMS berhasil diinstal"<br>AND dashboard DMS dapat diakses melalui URL jaringan internal perusahaan

## US-32: Mengintegrasikan DMS dengan Sistem ERP/CRM

**As a** Admin Tenant,
**I want to** menghubungkan DMS ke sistem ERP atau CRM perusahaan (SAP, Oracle, Odoo) melalui konfigurasi API gateway,
**So that** data dokumen sinkron dengan sistem bisnis utama dan duplikasi kerja antar platform terhilangkan.

> Perlu dipecah per ERP. Tidak dapat dibangun tanpa sandbox pelanggan, sehingga setiap integrasi memerlukan spike akses kredensial dan kontrak API sebelum diestimasi.

### Acceptance Criteria

#### AC-32.01: Mengonfigurasi koneksi ERP via API gateway
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Integrasi
- **WHEN** Saya mengklik tombol "Tambah Integrasi"<br>AND saya memilih "ERP - SAP" dari dropdown<br>AND saya mengisi field "API Endpoint" dan "API Key"<br>AND saya mengklik tombol "Test Koneksi"<br>AND saya mengklik tombol "Simpan"
- **THEN** Status koneksi menampilkan "Connected" dengan indikator<br>AND integrasi SAP muncul di daftar integrasi aktif

---

# Change Log (v1.0 to v2.0)

Every change traces to a decision in `docs/grooming/grooming-archiva-interview.md`.

## Structural repair

In v1.0 every acceptance criteria block from US-09 onward was attached to the story above it instead of its own, shifting the second half of the document by one story. All 22 affected blocks are remapped. Duplicate IDs (`AC-10.01`, `AC-14.01`, `AC-21.01`, `AC-26.01` each appearing twice), the US-08 ID used on US-09, the US-37 IDs used on US-38, and the `AC-42-04` separator are all corrected.

## Added

| ID | Story | Driven by |
|---|---|---|
| US-43 | Isolasi Data Antar Tenant | D1, D10 |
| US-44 | Pipeline Pemrosesan Dokumen | D8, D13 |
| US-45 | Mengelola Daftar Kategori | D3 |
| US-46 | Pemindaian Malware saat Unggah | D11 |
| US-47 | Mengoreksi Hasil Ekstraksi AI | D12 |

New criteria: AC-01.05 through AC-01.08 (batch limit, size limit, interrupted upload, session expiry, from D16 and the unhappy paths in D13); AC-02.06 and AC-02.07 (visibility window, from D4); AC-03.03 and AC-03.04 (filename collision, concurrent identical upload, from D5); AC-05.04 and AC-05.05 (empty tag filter, tag truncation); AC-06.03 (AI cannot classify, from D3); AC-07.03 (minimum query length); AC-08.04 (cross-tenant exclusion, from D14); AC-09.02 and AC-09.03 (converted formats, failed preview, from D7 and D13); AC-10.03 and AC-10.04 (direct endpoint denial, double click, from D14); AC-11.02 and AC-11.03 (partial permission, bulk limit); AC-12.02 through AC-12.04 (retrieval and AI metrics, empty state, from D17); AC-13.02 and AC-13.03 (denied access logging, empty state); AC-14.02 and AC-14.03 (deactivation, direct endpoint denial, from D14); AC-21.03 and AC-21.04 (identical version rejected, concurrent version allocation, from D5); AC-33.03 (document not yet indexed); AC-35.04 (quota exhausted mid-batch); AC-38.03 (empty dashboard); AC-39.03 (results below one page); AC-40.04 (session timeout); AC-41.04 and AC-41.05 (Super Admin navigation, direct route denial, from D10 and D14); AC-42.03 through AC-42.05 (type validation, range validation, reset to default, from D16).

## Removed

- The clause in AC-06.01 creating a new category at runtime and defaulting it to inactive. Categories now exist only after a Head of Team creates them (D3).
- The "Retention Policy" menu from the US-41 criteria, since US-26 is roadmap (D1, D10).
- The v1.0 and v1.1 numbering from the US-21 criteria, replaced by a simple counter (D6).

## Edited

- US-02 and US-06 rewritten to describe one flow: the system suggests, the user confirms (D2). US-02's title and narrative changed accordingly.
- AC-01.01 given a terminal state rather than a progress bar assertion (D13).
- AC-01.03 now names the accepted file types (D7).
- AC-02.05 bounded by a 7 day window with an exemption for Head of Team and above (D4).
- AC-03.01 now links to the existing document instead of only reporting the collision (D5).
- AC-04.02 shows "Tidak diketahui" rather than leaving the behaviour unstated.
- AC-05.01 given a fixed panel size and ordering (D9 testability).
- AC-06.01 anchored to a named fixture rather than a thematic judgement.
- AC-07.01 and AC-33.01 now state the corpus size and concurrency the 3 second target is measured against (D9).
- AC-08.01 given a maximum of 5 related documents.
- AC-10.02 kept, with server-side enforcement added at AC-10.03 (D14).
- AC-13.01 column set extended with Aksi, reflecting the generic event model (D14).
- US-41 criteria rewritten to describe a permission floor rather than enumerate per role (D10).
- US-42 criteria rewritten around a fixed, typed parameter list; enforcement of the limit moved to AC-01.06 (D16).
- All interface strings normalised to Indonesian (D15): "Document not found", "Showing 1 - 10 of 123 records", "Success adding new configuration", and the English field labels in the retention criteria.
- US-21 moved into Release 1 as a schema prerequisite, and its versioning trigger changed from filename match to an explicit action (D5).

## Open items

1. Spike: AI classification and extraction accuracy against a labelled sample of the customer's real documents. Blocks US-06 and US-25.
2. Spike: deep content search latency against a synthetic 100,000 document corpus. Blocks US-33.
3. Commercial: which inference provider sees tenant documents, and under what retention terms (D8). Does not block engineering.
