# Archiva User Stories and Acceptance Criteria

## US-01: Mengunggah Dokumen

**As a** Member Team,
**I want to** mengunggah satu atau beberapa dokumen ke dalam sistem melalui mekanisme drag and drop,
**So that** proses penambahan pengetahuan menjadi cepat dan mudah tanpa navigasi yang rumit.

### Acceptance Criteria

#### AC-01.01: Mengunggah satu file PDF yang valid
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya menyeret satu file PDF ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan sukses: "File diterima untuk diproses"<br>AND file muncul di progress upload bar

#### AC-01.02: Memastikan file yang diunggah tersimpan di daftar dokumen
- **GIVEN** Saya berhasil mengunggah file 'laporan.pdf'<br>AND proses upload selesai
- **WHEN** Saya mengklik menu Daftar Dokumen di sidebar<br>AND saya me-refresh halaman
- **THEN** File 'laporan.pdf' muncul di daftar dokumen terbaru<br>AND menampilkan tanggal unggah hari ini

#### AC-01.03: Mencoba mengunggah file tipe tidak didukung
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya menyeret file gambar (.JPG) ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan error: "Tipe file tidak didukung"<br>AND file tidak tersimpan ke dalam sistem

#### AC-01.04: Mengunggah beberapa file sekaligus
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya menyeret tiga file DOCX sekaligus ke area unggah<br>AND saya melepaskan file-file tersebut
- **THEN** Sistem menampilkan notifikasi sukses untuk ketiga file<br>AND ketiga file muncul di progress upload bar

## US-02: Menentukan Kategori Tiap Dokumen

**As a** Member Team,
**I want to** memberikan kategori tiap dokumen yang diunggah ke sistem,
**So that** memudahkan pencarian berdasarkan kategori dokumen.

### Acceptance Criteria

#### AC-02.01: Daftar dokumen yang belum memiliki kategori
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya menyeret satu file PDF ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Dokumen tersebut tampil di daftar "UPLOADED DOCUMENT"<br>AND dengan kategori "Uncategorized"

#### AC-02.02: Tampil daftar kategori pada dokumen yang belum memiliki kategori
- **GIVEN** Saya seorang Member Team<br>AND sebelumnya sudah berhasil mengunggah dokumen<br>AND belum menentukan kategori dokumen<br>AND sedang berada di halaman Dasbor
- **WHEN** Saya meng-klik salah satu dokumen pada daftar "UPLOADED DOCUMENT"
- **THEN** Sistem menampilkan daftar kategori

#### AC-02.03: Menentukan kategori pada dokumen yang telah diunggah
- **GIVEN** Saya seorang Member Team<br>AND sebelumnya sudah berhasil mengunggah dokumen<br>AND belum menentukan kategori dokumen<br>AND sedang berada di halaman Dasbor
- **WHEN** Saya meng-klik salah satu dokumen pada daftar "UPLOADED DOCUMENT"<br>AND saya memilih "Technical Spec"
- **THEN** Kategori dokumen berubah dari "Uncategorized" ke "Technical Spec"

#### AC-02.04: Dokumen yang telah dikategorikan tidak lagi ditampilkan di halaman Dasbor
- **GIVEN** Saya seorang Member Team<br>AND sebelumnya sudah berhasil mengunggah dokumen<br>AND belum menentukan kategori dokumen<br>AND sedang berada di halaman Dasbor
- **WHEN** Saya meng-klik salah satu dokumen pada daftar "UPLOADED DOCUMENT"<br>AND saya memilih "Technical Spec"
- **THEN** Dokumen tersebut tidak ditampilkan lagi di daftar "UPLOADED DOCUMENT"

#### AC-02.05: Dokumen yang belum memiliki kategori hanya tampil di dasbor pengunggah dokumen tersebut
- **GIVEN** Saya seorang Member Team<br>AND rekan saya sebelumnya berhasil mengunggah dokumen<br>AND rekan saya mengunggah file dokumen yang bernama "laporan.pdf"<br>AND dokumen tersebut belum diberi kategori
- **WHEN** Saya menginput di kolom pencarian dengan value "laporan.pdf"
- **THEN** Sistem tidak menampilkan dokumen spesifik<br>AND menampilkan pesan "Document not found"

## US-03: Mencegah Unggahan Duplikat

**As a** Member Team,
**I want to** mendapatkan peringatan jika mencoba mengunggah file yang kontennya sama persis dengan file yang sudah ada di sistem,
**So that** basis pengetahuan tetap bersih dan tidak ada kebingungan versi.

### Acceptance Criteria

#### AC-03.01: Mencoba mengunggah file duplikat (konten identik)
- **GIVEN** Saya seorang Member Team<br>AND file 'laporan-keuangan.pdf' sudah ada di sistem
- **WHEN** Saya menyeret file lain dengan konten yang sama persis (hash identik) ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan error: "File ini sudah ada"<br>AND file duplikat tidak tersimpan ke dalam sistem

#### AC-03.02: Mengunggah file bukan duplikat saat file lain sudah ada
- **GIVEN** Saya seorang Member Team<br>AND file 'laporan-keuangan.pdf' sudah ada di sistem
- **WHEN** Saya menyeret file 'presentasi-baru.pdf' dengan konten yang berbeda ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan sukses: "File diterima untuk diproses"<br>AND file baru tersimpan di daftar dokumen

## US-04: Melihat Metadata Dokumen

**As a** Member Team,
**I want to** melihat metadata seperti penulis dan tanggal yang diekstrak secara otomatis oleh AI/OCR dari dokumen yang diunggah,
**So that** tidak perlu mengisi data secara manual dan informasi menjadi konsisten.

### Acceptance Criteria

#### AC-04.01: Metadata penulis berhasil diekstrak otomatis
- **GIVEN** Saya seorang Member Team<br>AND sistem selesai memproses dokumen yang memiliki data penulis di metadata file
- **WHEN** Saya mengklik nama dokumen tersebut di daftar dokumen
- **THEN** Halaman detail dokumen menampilkan nama penulis yang benar di section Metadata<br>AND menampilkan tanggal pembuatan dokumen yang terekstrak

#### AC-04.02: Metadata penulis tidak berhasik diekstrak
- **GIVEN** Saya seorang Member Team<br>AND dokumen yang saya unggah tidak ada informasi spesifik tentang penulis
- **WHEN** Saya mengklik nama dokumen tersebut di daftar dokumen
- **THEN** Halaman detail dkumen tidak menampilkan nama penulis di section Metadata

## US-05: Memfilter Hasil Pencarian dengan Tag Otomatis

**As a** Member Team,
**I want to** menemukan dokumen berdasarkan tag relevan yang dibuat otomatis oleh AI dengan maksimal 3 tag per dokumen,
**So that** penemuan dokumen berdasarkan topik menjadi lebih mudah dan terstruktur.

### Acceptance Criteria

#### AC-05.01: Melihat panel Top Tags di dasbor
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND dokumen telah diunggah dan diproses AI
- **WHEN** Saya melihat area panel filter di atas daftar dokumen
- **THEN** Panel "Top Tags" menampilkan daftar tag yang relevan<br>AND setiap dokumen menampilkan maksimal 3 Smart Tags

#### AC-05.02: Melakukan filtering dengan single tag
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND panel Top Tags menampilkan beberapa tag
- **WHEN** Saya mengklik tag "Strategy" di panel Top Tags
- **THEN** Daftar dokumen diperbarui hanya menampilkan dokumen dengan tag "Strategy"<br>AND tag "Strategy" berubah warna (highlighted)

#### AC-05.03: Melakukan filtering dengan multi-tag
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND tag "Strategy" sudah aktif (highlighted)
- **WHEN** Saya mengklik tag "Legal" di panel Top Tags
- **THEN** Daftar dokumen diperbarui menampilkan dokumen yang memiliki tag "Strategy" DAN "Legal"<br>AND kedua tag berubah warna (highlighted)

## US-06: Pengkategorian & Klasifikasi Dokumen Otomatis via AI

**As a** Member Team,
**I want to** melihat dokumen terorganisir ke kategori dan tipe dokumen yang tepat (invoice, kontrak, laporan, memo) secara otomatis berdasarkan isi konten,
**So that** kerja manual merapikan folder dan pengkategorian tereliminasi sepenuhnya.

### Acceptance Criteria

#### AC-06.01: Dokumen otomatis masuk ke kategori yang tepat
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya menyeret dokumen dengan isi konten bertema 'Reporting' ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Kategori "Reporting" muncul di menu kategori utama<br>AND dokumen tersebut masuk ke dalam kategori "Reporting"<br>AND kategori baru default berstatus nonaktif untuk perizinan download

#### AC-06.02: AI mengenali tipe dokumen secara otomatis saat pengunggahan
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah file invoice dari vendor
- **WHEN** Saya menyeret file invoice ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menandai tipe dokumen sebagai "Invoice" di kolom Tipe Dokumen<br>AND label tipe muncul di card dokumen di daftar

## US-07: Mencari Judul & Metadata Dokumen

**As a** Member Team,
**I want to** mencari dokumen berdasarkan kata kunci dari judul atau metadata melalui bar pencarian,
**So that** informasi yang dibutuhkan ditemukan dalam hitungan detik.

### Acceptance Criteria

#### AC-07.01: Pencarian berhasil menemukan dokumen
- **GIVEN** Saya seorang Member Team<br>AND ada dokumen yang berisi kata "API" di dalam sistem
- **WHEN** Saya mengklik bar pencarian<br>AND saya mengetik "API"<br>AND saya menekan tombol Enter
- **THEN** Setidaknya satu dokumen relevan muncul di hasil pencarian<br>AND setiap item menampilkan nama file dan cuplikan teks yang cocok<br>AND hasil muncul dalam waktu kurang dari 3 detik

#### AC-07.02: Pencarian tidak menemukan hasil
- **GIVEN** Saya seorang Member Team<br>AND tidak ada dokumen yang berisi kata "xyzabc"
- **WHEN** Saya mengklik bar pencarian<br>AND saya mengetik "xyzabc"<br>AND saya menekan tombol Enter
- **THEN** Sistem menampilkan pesan: "Tidak ada hasil yang ditemukan"

## US-08: Menemukan Dokumen Terkait

**As a** Member Team,
**I want to** melihat daftar saran dokumen lain yang berkaitan berdasarkan kesamaan kategori atau tag saat membuka sebuah dokumen,
**So that** pengetahuan terkait yang mungkin tidak terpikirkan untuk dicari dapat ditemukan secara otomatis.

### Acceptance Criteria

#### AC-08.01: Menampilkan daftar dokumen terkait berdasarkan kategori/tag
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail dokumen 'bds-requirement.xlsx' dengan kategori "Technical Spec"<br>AND terdapat dokumen lain dengan kategori atau tag yang sama di dalam sistem
- **WHEN** Saya melihat section informasi dokumen terkait pada halaman detail
- **THEN** Section "Dokumen Terkait" menampilkan daftar dokumen yang memiliki kesamaan kategori atau tag<br>AND setiap item menampilkan nama file dan nama pengunggah

#### AC-08.02: Tidak ada dokumen terkait
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail sebuah dokumen<br>AND tidak ada dokumen lain dengan kategori atau tag yang sama
- **WHEN** Saya melihat section informasi dokumen terkait pada halaman detail
- **THEN** Section "Dokumen Terkait" menampilkan pesan: "Tidak ada dokumen terkait"

#### AC-08.03: Navigasi ke dokumen terkait
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail dokumen<br>AND section "Dokumen Terkait" menampilkan dokumen 'technical-proposal-test.pdf'
- **WHEN** Saya mengklik nama file 'technical-proposal-test.pdf' pada daftar dokumen terkait
- **THEN** Halaman detail dokumen 'technical-proposal-test.pdf' terbuka dengan metadata dan preview-nya

## US-09: Melihat Preview Dokumen

**As a** Member Team,
**I want to** melihat isi dokumen secara utuh melalui viewer dalam aplikasi tanpa mengunduh file,
**So that** verifikasi informasi menjadi lebih cepat.

### Acceptance Criteria

#### AC-08.01: Melihat preview dokumen tanpa download
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mengklik nama dokumen di daftar dokumen
- **THEN** Viewer menampilkan isi dokumen secara utuh<br>AND tidak ada file yang terunduh ke perangkat lokal

## US-10: Mengunduh Dokumen

**As a** Member Team,
**I want to** mengunduh dokumen asli sesuai format ke perangkat lokal melalui tombol Download,
**So that** dokumen dapat dibagikan ke platform lain.

### Acceptance Criteria

#### AC-10.01: Mengunduh single dokumen dari halaman preview
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman preview dokumen
- **WHEN** Saya mengklik tombol "Download"
- **THEN** File terunduh ke perangkat lokal dengan format asli (PDF/DOCX/dll)

#### AC-10.02: Mencoba mengunduh dokumen pada kategori yang berstatus nonaktif (Negative Path)
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman preview dokumen pada kategori "Offering Letter"<br>AND kategori "Offering Letter" berstatus "Inactive" pada perizinan download
- **WHEN** Saya mengarahkan kursor dan mengklik tombol "Download"
- **THEN** Tombol "Download" dalam kondisi nonaktif (disabled)<br>AND sistem menampilkan pesan warning: "Kategori ini tidak diizinkan untuk diunduh"<br>AND tidak ada file yang terunduh

#### AC-10.01: Mengunduh dokumen secara massal
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mencentang checkbox pada tiga dokumen<br>AND saya mengklik tombol "Download Selected"
- **THEN** Sistem menggabungkan ketiga file ke dalam satu file .zip<br>AND file .zip terunduh ke perangkat lokal

## US-11: Mengunduh Dokumen Massal

**As a** Member Team,
**I want to** memilih beberapa dokumen sekaligus dan mengunduhnya dalam satu file format .zip,
**So that** waktu terhemat saat membutuhkan banyak referensi sekaligus.

### Acceptance Criteria

#### AC-11.01: Melihat metrik total dokumen di dasbor analitik
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Analitik
- **WHEN** Saya melihat dasbor analitik
- **THEN** Kartu data menampilkan jumlah total dokumen di sistem<br>AND kartu data menampilkan jumlah dokumen yang diunggah dalam 7 hari terakhir

## US-12: Melihat Dasbor Analitik

**As a** Head of Team,
**I want to** melihat dasbor sederhana berisi metrik total dokumen dan unggahan 7 hari terakhir,
**So that** adopsi tim terhadap sistem terpahami dan nilai sistem dapat ditunjukkan.

*(No acceptance criteria defined)*

## US-13: Melihat Audit Trail

**As a** Head of Team,
**I want to** melihat log siapa saja yang telah mengunduh dokumen tertentu beserta waktu unduhan,
**So that** tracking aktivitas unduhan data sensitif terlaksana secara transparan.

### Acceptance Criteria

#### AC-13.01: Melihat log unduhan di halaman Audit Trail
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mengklik menu "Audit Trail" di sidebar
- **THEN** Halaman Audit Trail menampilkan tabel log dengan kolom: Siapa (User), Apa (Nama Dokumen), dan Kapan (Waktu) download dilakukan

## US-14: Mengatur Perizinan Dokumen

**As a** Head of Team,
**I want to** membatasi hak akses download berdasarkan kategori dokumen melalui toggle switch aktif/nonaktif,
**So that** keamanan data sensitif terjaga sesuai kebijakan organisasi.

### Acceptance Criteria

#### AC-14.01: Mengaktifkan perizinan download pada kategori
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di menu Permission Category
- **WHEN** Saya mengklik toggle switch dari status "Inactive" menjadi "Active" pada kategori "Reporting"
- **THEN** Toggle berubah menjadi status Active<br>AND Member Team sekarang dapat melakukan download dokumen pada kategori "Reporting"

#### AC-14.01: Menambahkan tenant baru
- **GIVEN** Saya seorang Super Admin<br>AND saya berada di halaman Manajemen Tenant
- **WHEN** Saya mengklik tombol "Tambah Tenant"<br>AND saya mengisi field "Nama Organisasi" dengan "PT Contoh Baru"<br>AND saya mengisi field "Subdomain" dengan "contohbaru"<br>AND saya mengklik tombol "Simpan"
- **THEN** Notifikasi sukses muncul: "Tenant berhasil ditambahkan"<br>AND tenant "PT Contoh Baru" muncul di tabel daftar tenant dengan status Active

#### AC-14.02: Memastikan isolasi data antar tenant
- **GIVEN** Saya seorang Member Team dari Tenant A<br>AND saya berada di halaman Dasbor<br>AND Tenant B memiliki dokumen 'rahasia-b.pdf'
- **WHEN** Saya mengetik "rahasia-b" di bar pencarian<br>AND saya menekan tombol Enter
- **THEN** Sistem menampilkan pesan: "Tidak ada hasil yang ditemukan"<br>AND dokumen milik Tenant B tidak muncul di hasil pencarian

## US-15: Mengelola Tenant Multi-tenant

**As a** Super Admin,
**I want to** menambah, mengedit, menonaktifkan, atau menghapus tenant/organisasi di dasbor Super Admin,
**So that** platform melayani banyak organisasi secara aman dengan isolasi data mutlak antar tenant.

### Acceptance Criteria

#### AC-15.01: Membuat paket tiering SaaS baru
- **GIVEN** Saya seorang Super Admin<br>AND saya berada di halaman Konfigurasi Tiering
- **WHEN** Saya mengklik tombol "Tambah Tier"<br>AND saya mengisi field "Nama Tier" dengan "Professional"<br>AND saya mencentang modul "Upload", "Search", "E-Signature"<br>AND saya mengklik tombol "Simpan"
- **THEN** Tier "Professional" muncul di daftar tier<br>AND menampilkan 3 modul yang diaktifkan

#### AC-15.02: Pengguna tenant hanya melihat fitur sesuai tier
- **GIVEN** Saya seorang Member Team dari tenant dengan tier "Basic"<br>AND tier Basic hanya mencakup modul Upload dan Search
- **WHEN** Saya melihat sidebar navigasi di halaman Dasbor
- **THEN** Menu "E-Signature" dan "Analitik" tidak muncul di sidebar<br>AND hanya menu yang sesuai tier Basic yang ditampilkan

## US-16: Mengonfigurasi Tiering SaaS dan Feature Flags

**As a** Super Admin,
**I want to** membuat paket tiering SaaS dan mengaktifkan atau menonaktifkan modul microservice per tenant secara real-time,
**So that** fleksibilitas monetisasi bisnis SaaS dan komersialisasi berjenjang tercapai.

### Acceptance Criteria

#### AC-16.01: Membuat task penandatanganan dengan mapping berjenjang
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman E-Signature<br>AND dokumen 'kontrak-vendor.pdf' tersedia di sistem
- **WHEN** Saya mengklik tombol "Buat Task Signature"<br>AND saya memilih dokumen 'kontrak-vendor.pdf'<br>AND saya menambahkan penanda tangan Level 1: "Manager A"<br>AND saya menambahkan penanda tangan Level 2: "Direktur B"<br>AND saya mengklik tombol "Kirim Task"
- **THEN** Notifikasi sukses muncul: "Task signature berhasil dibuat"<br>AND task muncul di daftar dengan status "Pending"<br>AND dokumen terkunci (locked) dari pengeditan

## US-17: Membuat Task Penandatanganan Dokumen

**As a** Admin Tenant,
**I want to** memilih dokumen, menentukan posisi tanda tangan, dan memetakan daftar penanda tangan secara berjenjang (Level 1 hingga Level 3),
**So that** proses persetujuan dan penandatanganan dokumen terdigitalisasi secara resmi dan terstruktur.

### Acceptance Criteria

#### AC-17.01: Memantau progress penandatanganan
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman E-Signature<br>AND task 'kontrak-vendor.pdf' berstatus In Progress
- **WHEN** Saya mengklik nama task 'kontrak-vendor.pdf' di daftar
- **THEN** Halaman detail menampilkan visual progress bar<br>AND menampilkan timestamp kapan Level 1 menandatangani<br>AND menampilkan status Level 2 sebagai "Menunggu Tanda Tangan"

## US-18: Memantau Progress Penandatanganan Dokumen

**As a** Admin Tenant,
**I want to** memantau status dan progres penandatanganan dokumen secara real-time melalui dashboard pemantauan,
**So that** transparansi alur persetujuan terwujud dan bottleneck teridentifikasi lebih cepat.

### Acceptance Criteria

#### AC-18.01: Menetapkan deadline dan menerima alert overdue
- **GIVEN** Saya seorang Admin Tenant<br>AND saya sedang membuat task signature baru
- **WHEN** Saya memilih tanggal deadline di field "Batas Waktu"<br>AND saya mengklik tombol "Kirim Task"
- **THEN** Task tersimpan dengan deadline yang ditentukan<br>AND sistem menjadwalkan pengiriman notifikasi reminder H-1<br>AND jika melewati deadline, alert overdue dikirim ke Admin dan penanda tangan

## US-19: Mengelola Deadline dan Notifikasi Penandatanganan

**As a** Admin Tenant,
**I want to** menetapkan deadline penandatanganan dan mengonfigurasi pengiriman notifikasi reminder serta alert overdue otomatis,
**So that** dokumen tertandatangani tepat waktu dan penumpukan berkas pending tercegah.

### Acceptance Criteria

#### AC-19.01: Membuat role mapping penandatanganan baru
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Role Mapping
- **WHEN** Saya mengklik tombol "Tambah Role"<br>AND saya mengisi field "Nama Role" dengan "Finance Approver"<br>AND saya mencentang kewenangan "Menandatangani" dan "Memantau"<br>AND saya mengklik tombol "Simpan"
- **THEN** Notifikasi sukses muncul: "Role berhasil ditambahkan"<br>AND role "Finance Approver" muncul di tabel daftar role

## US-20: Mengonfigurasi Role Mapping Penandatanganan

**As a** Admin Tenant,
**I want to** membuat pemetaan peran khusus signature dan menetapkan kewenangan akses secara dinamis tanpa hardcoding,
**So that** tata kelola kewenangan penandatanganan sesuai struktur organisasi terjaga.

*(No acceptance criteria defined)*

## US-21: Versioning Dokumen Otomatis

**As a** Member Team,
**I want to** mengunggah revisi dokumen dan melihat sistem secara otomatis menetapkan nomor versi baru serta menampilkan satu item di daftar dengan version picker,
**So that** pengguna selalu bekerja dengan versi terbaru tanpa kehilangan histori revisi sebelumnya.

### Acceptance Criteria

#### AC-21.01: Unggahan revisi otomatis mendapat nomor versi baru v1.1
- **GIVEN** Saya seorang Member Team<br>AND dokumen 'proposal.pdf' versi v1.0 sudah ada di sistem
- **WHEN** Saya menyeret file revisi 'proposal.pdf' dengan konten berbeda ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem mendeteksi dokumen sebagai revisi<br>AND secara otomatis menetapkan nomor versi v1.1<br>AND di daftar dokumen tetap tampil 1 item 'proposal.pdf' (versi terbaru)

#### AC-21.02: Mengakses versi lama melalui version picker
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman detail dokumen 'proposal.pdf'<br>AND dokumen memiliki 3 versi (v1.0, v1.1, v1.2)
- **WHEN** Saya mengklik dropdown version picker<br>AND saya memilih versi "v1.0"
- **THEN** Viewer menampilkan isi dokumen versi v1.0<br>AND tombol "Download" mengunduh file versi v1.0

#### AC-21.01: Menavigasi dokumen melalui metadata view
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND ada beberapa dokumen dengan metadata Klien, Proyek, dan Tipe berbeda
- **WHEN** Saya mengklik tab "Metadata View" di atas daftar dokumen<br>AND saya memilih filter "Klien: PT ABC"
- **THEN** Daftar dokumen diperbarui menampilkan hanya dokumen milik klien PT ABC<br>AND navigasi tidak menggunakan struktur folder hirarkis

## US-22: Menavigasi Dokumen via Metadata View (Folderless)

**As a** Member Team,
**I want to** mengakses dan menavigasi seluruh dokumen melalui metadata view tanpa bergantung pada struktur folder hirarkis,
**So that** penemuan dokumen lebih intuitif karena berbasis konteks konten bukan lokasi penyimpanan.

### Acceptance Criteria

#### AC-22.01: Menangkap dokumen dari email inbox
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Capture Source<br>AND email inbox sudah terhubung ke DMS
- **WHEN** Saya mengklik tombol "Capture from Email"<br>AND saya memilih email dengan attachment 'kontrak.pdf'<br>AND saya mengklik tombol "Import"
- **THEN** File 'kontrak.pdf' muncul di daftar dokumen<br>AND metadata pengirim email terekstrak otomatis

## US-23: Menangkap Dokumen dari Multi-Source (Email dan Scanner)

**As a** Member Team,
**I want to** mengunggah dokumen langsung dari email inbox atau scanner hardware selain melalui drag-and-drop web,
**So that** semua sumber dokumen tercakup tanpa proses manual download-lalu-upload ulang.

### Acceptance Criteria

#### AC-23.01: Menyimpan dokumen ke DMS dari plugin Outlook
- **GIVEN** Saya seorang Member Team<br>AND saya membuka email dengan attachment di Outlook<br>AND plugin DMS sudah terinstal di Outlook
- **WHEN** Saya mengklik tombol "Save to DMS" di toolbar plugin Outlook<br>AND saya memilih attachment 'laporan.pdf'<br>AND saya mengklik tombol "Simpan"
- **THEN** Notifikasi sukses muncul di plugin: "Dokumen berhasil disimpan ke DMS"<br>AND file muncul di daftar dokumen saat membuka web DMS

## US-24: Menyimpan dan Menandatangani Dokumen via Plugin Email/Office

**As a** Member Team,
**I want to** menyimpan dokumen ke DMS dan memulai permintaan tanda tangan langsung dari plugin di Outlook, Word, atau Gmail tanpa membuka portal web DMS,
**So that** friction berpindah aplikasi terhilangkan dan tingkat adopsi DMS meningkat.

*(No acceptance criteria defined)*

## US-25: Mengekstrak Field Spesifik dari Dokumen Terstruktur

**As a** Member Team,
**I want to** melihat sistem secara otomatis mengekstrak field spesifik dari dokumen terstruktur seperti nomor invoice, tanggal jatuh tempo, nilai pajak, dan nama vendor,
**So that** input data manual dari dokumen keuangan dan legal tereliminasi dan akurasi data meningkat.

### Acceptance Criteria

#### AC-25.01: Mengekstrak field spesifik dari invoice
- **GIVEN** Saya seorang Member Team<br>AND saya mengunggah file invoice PDF<br>AND proses ekstraksi AI selesai
- **WHEN** Saya mengklik nama dokumen invoice tersebut di daftar dokumen
- **THEN** Halaman detail dokumen menampilkan section "Extracted Fields" berisi: Nomor Invoice, Tanggal Jatuh Tempo, Total Nilai, Nama Vendor (terisi otomatis)

## US-26: Mengelola Kebijakan Retensi Dokumen (CRUD)

**As a** Admin Tenant,
**I want to** menetapkan, mengedit, dan menghapus kebijakan retensi dokumen per kategori (periode aktif, arsip pasif, pemusnahan) serta memantau jadwal pemusnahan otomatis,
**So that** kepatuhan regulasi kearsipan terpenuhi dan risiko penyimpanan dokumen kadaluarsa termitigasi.

### Acceptance Criteria

#### AC-26.01: Menetapkan kebijakan retensi baru pada kategori dokumen
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Retention Policy
- **WHEN** Saya mengklik tombol "Tambah Kebijakan"<br>AND saya memilih kategori "Kontrak"<br>AND saya mengisi field "Periode Aktif" dengan "5 tahun"<br>AND saya mengisi field "Periode Arsip Pasif" dengan "5 tahun"<br>AND saya mengisi field "Pemusnahan" dengan "Otomatis setelah 10 tahun"<br>AND saya mengklik tombol "Simpan"
- **THEN** Notifikasi sukses muncul: "Kebijakan retensi berhasil disimpan"<br>AND kebijakan muncul di tabel daftar retention policy

#### AC-26.02: Mengedit periode retensi pada kebijakan yang sudah ada
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Retention Policy<br>AND kebijakan kategori "Contract" dengan Active Period "5 Tahun" sudah ada di tabel
- **WHEN** Saya mengklik ikon menu aksi (⋯) pada baris kebijakan "Contract"<br>AND saya memilih opsi "Edit"<br>AND saya mengubah field "Active Period" dari "5 Tahun" menjadi "7 Tahun"<br>AND saya mengklik tombol "Save Changes"
- **THEN** Notifikasi sukses muncul: "Kebijakan retensi berhasil diperbarui"<br>AND baris "Contract" di tabel menampilkan Active Period "7 Tahun"

#### AC-26.03: Menghapus kebijakan retensi dengan konfirmasi
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Retention Policy<br>AND kebijakan kategori "Pact" sudah ada di tabel
- **WHEN** Saya mengklik ikon menu aksi (⋯) pada baris kebijakan "Pact"<br>AND saya memilih opsi "Delete"<br>AND saya mengklik tombol konfirmasi penghapusan
- **THEN** Notifikasi sukses muncul: "Kebijakan retensi berhasil dihapus"<br>AND baris "Pact" hilang dari tabel

#### AC-26.01: Merancang alur approval dengan visual builder
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Workflow Designer
- **WHEN** Saya menyeret node "Start" ke canvas<br>AND saya menyeret node "Approval: Manager" dan menghubungkannya<br>AND saya menyeret node "Condition: Nilai > 500 juta" dan menghubungkan branch Ya ke "Approval: Direktur"<br>AND saya mengklik tombol "Simpan Workflow"
- **THEN** Workflow tersimpan dengan diagram visual yang menampilkan alur berjenjang<br>AND notifikasi sukses muncul: "Workflow berhasil disimpan"

## US-27: Merancang Alur Approval secara Visual

**As a** Admin Tenant,
**I want to** merancang alur persetujuan berjenjang secara visual menggunakan drag-and-drop node dengan branching logic dan kondisi,
**So that** kesalahan konfigurasi alur persetujuan berkurang drastis dan setup alur baru menjadi lebih cepat.

### Acceptance Criteria

#### AC-27.01: Mencatat peminjaman arsip fisik
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Peminjaman Arsip
- **WHEN** Saya mengklik tombol "Catat Peminjaman"<br>AND saya memilih dokumen "Kontrak-2024-001"<br>AND saya mengisi field "Peminjam" dengan "John Doe"<br>AND saya memilih tanggal pengembalian di datepicker<br>AND saya mengklik tombol "Simpan"
- **THEN** Record peminjaman muncul di tabel dengan status "Dipinjam"<br>AND menampilkan nama peminjam dan tanggal pengembalian yang ditentukan

## US-28: Mengelola Peminjaman Arsip Fisik

**As a** Admin Tenant,
**I want to** mencatat peminjaman dan pengembalian dokumen fisik (kertas) serta melacak status sirkulasi arsip,
**So that** tracking dokumen fisik terpusat dan kehilangan arsip tercegah.

### Acceptance Criteria

#### AC-28.01: Mengakses dokumen dari Google Drive melalui DMS
- **GIVEN** Saya seorang Member Team<br>AND koneksi Google Drive sudah dikonfigurasi oleh Admin<br>AND saya berada di halaman Dasbor
- **WHEN** Saya mengklik tab "External Sources"<br>AND saya memilih "Google Drive" dari daftar sumber<br>AND saya mengetik "proposal" di field pencarian
- **THEN** Daftar menampilkan file dari Google Drive yang mengandung kata "proposal"<br>AND saya dapat melakukan preview dan download langsung dari tampilan DMS

## US-29: Mengakses Dokumen dari Repositori Eksternal

**As a** Member Team,
**I want to** mencari dan mengakses dokumen dari repositori eksternal (SharePoint, Google Drive, Network Drive) melalui satu tampilan tunggal DMS,
**So that** dokumen tidak lagi tersebar di banyak platform dan satu sumber kebenaran terwujud.

### Acceptance Criteria

#### AC-29.01: Mengakses DMS dari aplikasi mobile
- **GIVEN** Saya seorang Member Team<br>AND saya membuka aplikasi DMS di perangkat mobile (iOS/Android)
- **WHEN** Saya melakukan login dengan kredensial yang sama dengan web<br>AND saya mengetik "laporan" di bar pencarian<br>AND saya menekan tombol cari
- **THEN** Hasil pencarian menampilkan dokumen yang relevan<br>AND saya dapat melakukan preview dan download dokumen dari aplikasi mobile

## US-30: Mengakses DMS via Aplikasi Desktop dan Mobile

**As a** Member Team,
**I want to** mengakses seluruh fitur DMS melalui aplikasi desktop native (Windows/Mac) dan aplikasi mobile (iOS/Android),
**So that** produktivitas tidak terhambat oleh keterbatasan browser dan akses mobile terfasilitasi.

### Acceptance Criteria

#### AC-30.01: Melakukan deployment DMS ke server on-premises
- **GIVEN** Saya seorang Super Admin<br>AND server on-premises perusahaan sudah memenuhi spesifikasi minimum
- **WHEN** Saya menjalankan installer DMS on-premises<br>AND saya mengisi konfigurasi database lokal<br>AND saya mengklik tombol "Install"
- **THEN** Proses instalasi selesai dengan notifikasi: "DMS berhasil diinstal"<br>AND dashboard DMS dapat diakses melalui URL jaringan internal perusahaan

## US-31: Melakukan Deployment On-Premises atau Hybrid

**As a** Super Admin,
**I want to** menginstalasi dan mengoperasikan DMS di server lokal perusahaan (on-premises) atau dalam arsitektur hybrid (cloud + on-premises),
**So that** organisasi dengan kebijakan data residency ketat tetap dapat menggunakan DMS.

### Acceptance Criteria

#### AC-31.01: Mengonfigurasi koneksi ERP via API gateway
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Integrasi
- **WHEN** Saya mengklik tombol "Tambah Integrasi"<br>AND saya memilih "ERP - SAP" dari dropdown<br>AND saya mengisi field "API Endpoint" dan "API Key"<br>AND saya mengklik tombol "Test Koneksi"<br>AND saya mengklik tombol "Simpan"
- **THEN** Status koneksi menampilkan "Connected" dengan indikator<br>AND integrasi SAP muncul di daftar integrasi aktif

## US-32: Mengintegrasikan DMS dengan Sistem ERP/CRM

**As a** Admin Tenant,
**I want to** menghubungkan DMS ke sistem ERP atau CRM perusahaan (SAP, Oracle, Odoo) melalui konfigurasi API gateway,
**So that** data dokumen sinkron dengan sistem bisnis utama dan duplikasi kerja antar platform terhilangkan.

*(No acceptance criteria defined)*

## US-33: Mencari Teks di Dalam Isi Berkas (Deep Content Search)

**As a** Member Team,
**I want to** mencari kata atau frasa spesifik yang berada di dalam isi konten berkas (PDF, DOCX, XLSX, TXT, Scan PDF) melalui bar pencarian,
**So that** informasi di bagian dalam halaman berkas ditemukan secara presisi dengan highlight lokasi pencocokan tanpa membuka dan membaca dokumen satu per satu.

### Acceptance Criteria

#### AC-33.01: Pencarian Kata Kunci di Dalam Isi Konten Berkas
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND dokumen 'kontrak-kerjasama.pdf' yang berisi kata "klausul-kerahasiaan" di halaman 15 sudah terindeks di sistem
- **WHEN** Saya mengklik bar pencarian<br>AND saya mengetik "klausul-kerahasiaan"<br>AND saya menekan tombol Enter
- **THEN** Berkas 'kontrak-kerjasama.pdf' muncul di daftar hasil pencarian<br>AND menampilkan cuplikan teks halaman 15 yang disorot (highlighted)<br>AND waktu respons pencarian kurang dari 3 detik

#### AC-33.02: Sorotan pencocokan kata kunci pada Document Viewer
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman hasil pencarian teks mendalam
- **WHEN** Saya mengklik dokumen 'kontrak-kerjasama.pdf' dari hasil pencarian
- **THEN** Document Viewer terbuka dan langsung melompat ke posisi teks yang cocok (halaman untuk PDF / paragraf untuk DOCX/TXT)<br>AND kata kunci ditandai dengan warna kuning (highlighted)

## US-34: Memfilter Dokumen Berdasarkan Kategori

**As a** Member Team,
**I want to** memfilter daftar dokumen yang ditampilkan berdasarkan kategori tertentu seperti Proposal, Technical Spec, Contract Agreement, atau Financial,
**So that** dokumen yang dicari ditemukan lebih cepat karena lingkup pencarian dipersempit sesuai klasifikasi.

### Acceptance Criteria

#### AC-34.01: Memfilter dokumen berdasarkan satu kategori
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman yang menampilkan daftar dokumen<br>AND terdapat dokumen dengan berbagai kategori (Proposal, Technical Spec, Contract Agreement, Financial)
- **WHEN** Saya memilih kategori "Proposal" pada filter kategori
- **THEN** Hanya dokumen dengan kategori "Proposal" yang ditampilkan<br>AND dokumen dari kategori lain tidak terlihat

#### AC-34.02: Menampilkan kembali semua dokumen
- **GIVEN** Saya seorang Member Team<br>AND saya sedang memfilter dokumen pada kategori "Proposal"
- **WHEN** Saya memilih opsi untuk menampilkan semua kategori
- **THEN** Seluruh dokumen dari semua kategori ditampilkan kembali

#### AC-34.03: Filter kategori pada kondisi kosong
- **GIVEN** Saya seorang Member Team<br>AND tidak ada dokumen dengan kategori "Financial" di dalam sistem
- **WHEN** Saya memilih kategori "Financial" pada filter kategori
- **THEN** Sistem menampilkan pesan: "Tidak ada dokumen pada kategori ini"

## US-35: Melihat Kapasitas Penyimpanan

**As a** Member Team,
**I want to** melihat informasi persentase penggunaan ruang penyimpanan dan sisa kuota yang tersedia,
**So that** keputusan untuk menghapus atau mengarsipkan dokumen lama diambil sebelum kuota penuh dan proses upload gagal.

### Acceptance Criteria

#### AC-35.01: Melihat informasi kapasitas penyimpanan
- **GIVEN** Saya seorang Member Team<br>AND saya telah masuk ke dalam sistem<br>AND total penyimpanan yang telah terpakai adalah 25% dari kuota
- **WHEN** Saya melihat informasi kapasitas penyimpanan yang tersedia di antarmuka
- **THEN** Sistem menampilkan indikator kapasitas penyimpanan berisi: persentase penggunaan (25%)<br>AND indikator visual (progress bar) yang merepresentasikan proporsi pemakaian

#### AC-35.02: Mendapat peringatan kapasitas hampir penuh
- **GIVEN** Saya seorang Member Team<br>AND total penyimpanan yang telah terpakai mencapai 80% atau lebih dari kuota
- **WHEN** Saya melihat informasi kapasitas penyimpanan
- **THEN** Indikator penyimpanan berubah warna menjadi kuning/oranye (warning)<br>AND sistem menampilkan pesan peringatan: "Kapasitas penyimpanan hampir penuh"

#### AC-35.03: Upload ditolak saat kapasitas penuh
- **GIVEN** Saya seorang Member Team<br>AND total penyimpanan telah mencapai 100% dari kuota
- **WHEN** Saya menyeret satu file PDF ke area unggah<br>AND saya melepaskan file tersebut
- **THEN** Sistem menampilkan pesan error: "Kapasitas penyimpanan penuh. Hapus atau arsipkan dokumen lama untuk melanjutkan"<br>AND file tidak tersimpan ke dalam sistem

## US-36: Mengganti Tema Antarmuka

**As a** Member Team,
**I want to** mengganti tampilan antarmuka antara mode terang (light) dan mode gelap (dark),
**So that** kenyamanan membaca dokumen meningkat sesuai preferensi dan kondisi pencahayaan lingkungan kerja.

### Acceptance Criteria

#### AC-36.01: Mengaktifkan mode gelap
- **GIVEN** Saya seorang Member Team<br>AND antarmuka sedang menampilkan tema terang (light mode)
- **WHEN** Saya mengklik tombol "Dark" untuk mengganti tema
- **THEN** Seluruh antarmuka berubah ke tema gelap (dark mode)<br>AND teks tombol berubah menjadi "Light"<br>AND perubahan tema berlaku untuk seluruh halaman

#### AC-36.02: Preferensi tema tersimpan
- **GIVEN** Saya seorang Member Team<br>AND saya telah mengaktifkan mode gelap (dark mode)
- **WHEN** Saya menutup browser<br>AND saya membuka kembali aplikasi Archiva
- **THEN** Antarmuka tetap menampilkan tema gelap (dark mode) sesuai preferensi terakhir yang dipilih

## US-37: Memfilter Data pada Tabel (Lokal Filter)

**As a** Member Team,
**I want to** memfilter data di tabel daftar dokumen maupun tabel administrasi secara langsung menggunakan kata kunci yang diketik pada kolom filter tabel,
**So that** dokumen atau record spesifik ditemukan dengan cepat dari daftar yang panjang tanpa harus scroll manual.

### Acceptance Criteria

#### AC-37.01: Memfilter tabel daftar dokumen berdasarkan kata kunci judul
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman daftar dokumen (Document Management)<br>AND terdapat dokumen bernama 'bds-requirement.xlsx' di dalam tabel
- **WHEN** Saya mengetik "req" di kolom filter tabel
- **THEN** Tabel hanya menampilkan dokumen yang judulnya mengandung kata "req"<br>AND dokumen yang tidak relevan tersembunyi

#### AC-37.02: Memfilter data di halaman administrasi (Audit Trail / Retention Policy)
- **GIVEN** Saya seorang Head of Team<br>AND saya berada di halaman Audit Trail<br>AND terdapat log aktivitas dari user "Zayd Almasi"
- **WHEN** Saya mengetik "Zayd" di kolom filter halaman Audit Trail
- **THEN** Tabel hanya menampilkan record yang mengandung kata "Zayd" pada kolom User atau Document Name<br>AND record lain tersembunyi

#### AC-37.03: Filter tabel tidak menemukan hasil
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman daftar dokumen (Document Management)
- **WHEN** Saya mengetik "xyznotexist" di kolom filter tabel
- **THEN** Tabel menampilkan pesan: "Tidak ada dokumen yang sesuai"

## US-38: Melihat Dokumen dalam Tampilan Kartu Visual

**As a** Member Team,
**I want to** melihat dokumen yang baru diunggah ditampilkan sebagai kartu visual berisi ikon tipe file, judul, tanggal unggah, dan nama pengunggah,
**So that** status dokumen terbaru dikenali secara visual dengan lebih cepat dibandingkan format tabel.

### Acceptance Criteria

#### AC-37.01: Melihat dokumen terbaru sebagai kartu visual
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND terdapat beberapa dokumen yang sudah diunggah
- **WHEN** Saya melihat section daftar dokumen yang telah diunggah
- **THEN** Setiap dokumen ditampilkan sebagai kartu visual berisi: ikon tipe file (PDF/DOCX/XLSX), judul dokumen, tanggal unggah, dan nama pengunggah

#### AC-37.02: Navigasi dari kartu ke detail dokumen
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman Dasbor<br>AND dokumen 'bds-contract-agree..' ditampilkan sebagai kartu
- **WHEN** Saya mengklik kartu dokumen 'bds-contract-agree..'
- **THEN** Halaman detail dokumen terbuka menampilkan metadata, extracted fields, dan preview dokumen tersebut

## US-39: Menavigasi Halaman Data dengan Paginasi

**As a** Member Team,
**I want to** menavigasi data yang berjumlah besar melalui kontrol paginasi yang menampilkan jumlah total data dan nomor halaman,
**So that** data ditampilkan dalam porsi yang ringan dan mudah di-review tanpa membebani waktu muat halaman.

### Acceptance Criteria

#### AC-39.01: Melihat informasi jumlah data dan paginasi
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman yang menampilkan 123 record data
- **WHEN** Saya melihat kontrol paginasi pada halaman tersebut
- **THEN** Sistem menampilkan informasi jumlah data (contoh: "Showing 1 - 10 of 123 records")<br>AND menampilkan kontrol navigasi halaman (Previous, 1, 2, 3, ..., Next)

#### AC-39.02: Berpindah ke halaman berikutnya
- **GIVEN** Saya seorang Member Team<br>AND saya berada di halaman 1 dari 13 halaman<br>AND halaman saat ini menampilkan record 1-10
- **WHEN** Saya mengklik tombol "Next" atau mengklik nomor halaman "2"
- **THEN** Tabel menampilkan record 11-20<br>AND informasi berubah menjadi "Showing 11 - 20 of 123 records"<br>AND nomor halaman "2" menjadi aktif (highlighted)

## US-40: Masuk ke Sistem (Login & Logout)

**As a** Member Team,
**I want to** masuk ke dalam sistem menggunakan kredensial akun (email dan password) dan melihat informasi profil serta peran (role) yang melekat pada akunnya,
**So that** akses ke sistem terkontrol dan setiap tindakan terekam atas identitas pengguna yang terverifikasi.

### Acceptance Criteria

#### AC-40.01: Login dengan kredensial yang valid
- **GIVEN** Saya seorang pengguna terdaftar<br>AND saya berada di halaman Login<br>AND akun saya memiliki role "Member"
- **WHEN** Saya mengisi field "Email" dengan email terdaftar<br>AND saya mengisi field "Password" dengan password yang benar<br>AND saya mengklik tombol "Login"
- **THEN** Halaman Dasbor ditampilkan<br>AND informasi profil saya ditampilkan berisi: nama pengguna, role ("MEMBER"), dan avatar

#### AC-40.02: Login dengan kredensial yang salah
- **GIVEN** Saya seorang pengguna<br>AND saya berada di halaman Login
- **WHEN** Saya mengisi field "Email" dengan email terdaftar<br>AND saya mengisi field "Password" dengan password yang salah<br>AND saya mengklik tombol "Login"
- **THEN** Sistem menampilkan pesan error: "Email atau password salah"<br>AND saya tetap berada di halaman Login

#### AC-40.03: Logout dari sistem
- **GIVEN** Saya seorang Member Team<br>AND saya telah berhasil login<br>AND informasi profil saya ditampilkan
- **WHEN** Saya mengklik ikon pengaturan (⚙️) pada profil saya<br>AND saya memilih opsi "Logout"
- **THEN** Sesi saya berakhir<br>AND halaman Login ditampilkan kembali

## US-41: Melihat Menu Navigasi Sesuai Peran (Role-Based Navigation)

**As a** Member Team,
**I want to** melihat menu navigasi yang ditampilkan sesuai dengan peran (role) yang melekat pada akunnya,
**So that** pengguna hanya mengakses fitur yang relevan dengan tanggung jawabnya dan tidak terdistraksi oleh fitur yang bukan wewenangnya.

### Acceptance Criteria

#### AC-41.01: Member Team melihat menu sesuai perannya
- **GIVEN** Saya seorang Member Team<br>AND saya telah berhasil login
- **WHEN** Saya melihat daftar menu navigasi yang tersedia
- **THEN** Menu yang ditampilkan hanya berisi: "Dashboard" dan "Document"<br>AND menu "Permission Category", "Audit Trail", "Configuration" dan "Retention Policy" tidak ditampilkan

#### AC-41.02: Head of Team melihat menu administrasi
- **GIVEN** Saya seorang Head of Team<br>AND saya telah berhasil login
- **WHEN** Saya melihat daftar menu navigasi yang tersedia
- **THEN** Menu yang ditampilkan berisi: "Document", "Permission Category", "Configuration" dan "Audit Trail"

#### AC-41.03: Admin Tenant melihat seluruh menu
- **GIVEN** Saya seorang Admin Tenant<br>AND saya telah berhasil login
- **WHEN** Saya melihat daftar menu navigasi yang tersedia
- **THEN** Menu yang ditampilkan berisi: "Document", "Permission Category", "Audit Trail", "Configuration", dan "Retention Policy"

## US-42: Menentukan batas maksimal ukuran dokumen yang dapat diunggah

**As a** Admin Tenant,
**I want to** menentukan ukuran dokumen yang bisa diunggah oleh Member Team,
**So that** memberikan batasan dokumen yang diunggah untuk memastikan memori penyimpanan tidak bengkak.

### Acceptance Criteria

#### AC-42.01: Menu konfigurasi yang dapat dikustomisasi
- **GIVEN** Saya seorang Admin Tenant<br>AND saya telah berhasil login<br>AND saya berada di halaman "Document"
- **WHEN** Saya menekan menu "Configuration"
- **THEN** Sistem mengarahkan ke halaman "Configuration" yang berisi tabel dengan field :<br>Parameter Type | Parameter Value<br>AND terdapat tombol edit dan hapus di sebelah kanan tiap row field<br>AND terdapat tombol add new

#### AC-42.02: Menambahkan row baru pada tabel di menu Konfigurasi
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Konfigurasi
- **WHEN** Saya menekan tombol "add new"
- **THEN** Tampil row baru di list tabel

#### AC-42.03: Pesan tampil berhasil menambah pengaturan konfigurasi baru
- **GIVEN** Saya seorang Admin Tenant<br>AND saya berada di halaman Konfigurasi<br>AND saya telah menekan tombol "add new"<br>AND row baru telah tampil dengan Parameter Type & Parameter Value kosong
- **WHEN** Saya mengisi row baru dengan value<br>Parameter Type = "Max File Size"<br>Parameter Value = "20"<br>AND klik icon centang
- **THEN** Sistem menampilkan pesan "Success adding new configuration"

#### AC-42-04: Pengaturan baru berhasil tersimpan dan tampil di tabel
- **GIVEN** Saya seorang Admin Tenant<br>AND saya telah mengisi Parameter Type & Parameter Value<br>
- **WHEN** Saya meng-klik icon centang
- **THEN** Sistem secara otomatis menyegarkan halaman<br>AND pengaturan yang sebelumnya saya tambahkan sekarang tampil di tabel

