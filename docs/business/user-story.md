# Archiva User Stories

**Version:** 1.0  
**Date:** 2026-09-10  
**Status:** Release 1  
**Source:** `docs/us-ac/User-Stories-and-AC.md`  

> Note: US-15 to US-20 and US-22 to US-32 are absent from this list. They are roadmap items held in the source document and are out of scope for release 1.

> Note: Story ID order does not imply build order. US-43 to US-47 are foundation stories and several must land before US-01. Sequencing is in `sprint-breakdown.md`.

---

### US-01 — Mengunggah Dokumen

- **Persona:** Member Team
- **Action:** Mengunggah satu atau beberapa dokumen ke dalam sistem melalui mekanisme drag and drop
- **Business value:** Proses penambahan pengetahuan menjadi cepat dan mudah tanpa navigasi yang rumit

### US-02 — Menentukan Kategori Tiap Dokumen

- **Persona:** Member Team
- **Action:** Mengonfirmasi atau mengubah kategori yang disarankan sistem untuk tiap dokumen yang diunggah
- **Business value:** Dokumen terklasifikasi dengan benar tanpa pengguna harus mengisi kategori dari nol

### US-03 — Mencegah Unggahan Duplikat

- **Persona:** Member Team
- **Action:** Mendapatkan peringatan jika mencoba mengunggah file yang kontennya sama persis dengan file yang sudah ada di sistem
- **Business value:** Basis pengetahuan tetap bersih dan tidak ada kebingungan versi

### US-04 — Melihat Metadata Dokumen

- **Persona:** Member Team
- **Action:** Melihat metadata seperti penulis dan tanggal yang diekstrak secara otomatis oleh AI/OCR dari dokumen yang diunggah
- **Business value:** Tidak perlu mengisi data secara manual dan informasi menjadi konsisten

### US-05 — Memfilter Hasil Pencarian dengan Tag Otomatis

- **Persona:** Member Team
- **Action:** Menemukan dokumen berdasarkan tag relevan yang dibuat otomatis oleh AI dengan maksimal 3 tag per dokumen
- **Business value:** Penemuan dokumen berdasarkan topik menjadi lebih mudah dan terstruktur

### US-06 — Pengkategorian & Klasifikasi Dokumen Otomatis via AI

- **Persona:** Member Team
- **Action:** Melihat sistem menyarankan kategori dan tipe dokumen yang tepat (invoice, kontrak, laporan, memo) secara otomatis berdasarkan isi konten
- **Business value:** Kerja manual merapikan folder dan pengkategorian berkurang drastis

### US-07 — Mencari Judul & Metadata Dokumen

- **Persona:** Member Team
- **Action:** Mencari dokumen berdasarkan kata kunci dari judul atau metadata melalui bar pencarian
- **Business value:** Informasi yang dibutuhkan ditemukan dalam hitungan detik

### US-08 — Menemukan Dokumen Terkait

- **Persona:** Member Team
- **Action:** Melihat daftar saran dokumen lain yang berkaitan berdasarkan kesamaan kategori atau tag saat membuka sebuah dokumen
- **Business value:** Pengetahuan terkait yang mungkin tidak terpikirkan untuk dicari dapat ditemukan secara otomatis

### US-09 — Melihat Preview Dokumen

- **Persona:** Member Team
- **Action:** Melihat isi dokumen secara utuh melalui viewer dalam aplikasi tanpa mengunduh file
- **Business value:** Verifikasi informasi menjadi lebih cepat

### US-10 — Mengunduh Dokumen

- **Persona:** Member Team
- **Action:** Mengunduh dokumen asli sesuai format ke perangkat lokal melalui tombol Download
- **Business value:** Dokumen dapat dibagikan ke platform lain

### US-11 — Mengunduh Dokumen Massal

- **Persona:** Member Team
- **Action:** Memilih beberapa dokumen sekaligus dan mengunduhnya dalam satu file format .zip
- **Business value:** Waktu terhemat saat membutuhkan banyak referensi sekaligus

### US-12 — Melihat Dasbor Analitik

- **Persona:** Head of Team
- **Action:** Melihat dasbor berisi metrik penggunaan sistem oleh tim
- **Business value:** Adopsi tim terhadap sistem terpahami dan nilai sistem dapat ditunjukkan

### US-13 — Melihat Audit Trail

- **Persona:** Head of Team
- **Action:** Melihat log aktivitas pada dokumen beserta pelaku dan waktunya
- **Business value:** Tracking aktivitas data sensitif terlaksana secara transparan

### US-14 — Mengatur Perizinan Dokumen

- **Persona:** Head of Team
- **Action:** Membatasi hak akses download berdasarkan kategori dokumen melalui toggle switch aktif/nonaktif
- **Business value:** Keamanan data sensitif terjaga sesuai kebijakan organisasi

### US-21 — Versioning Dokumen Otomatis

- **Persona:** Member Team
- **Action:** Mengunggah revisi dokumen dan melihat sistem menetapkan nomor versi baru serta menampilkan satu item di daftar dengan version picker
- **Business value:** Pengguna selalu bekerja dengan versi terbaru tanpa kehilangan histori revisi sebelumnya

### US-33 — Mencari Teks di Dalam Isi Berkas (Deep Content Search)

- **Persona:** Member Team
- **Action:** Mencari kata atau frasa spesifik yang berada di dalam isi konten berkas (PDF, DOCX, XLSX, TXT, Scan PDF) melalui bar pencarian
- **Business value:** Informasi di bagian dalam halaman berkas ditemukan secara presisi dengan highlight lokasi pencocokan tanpa membuka dan membaca dokumen satu per satu

### US-34 — Memfilter Dokumen Berdasarkan Kategori

- **Persona:** Member Team
- **Action:** Memfilter daftar dokumen yang ditampilkan berdasarkan kategori tertentu seperti Proposal, Technical Spec, Contract Agreement, atau Financial
- **Business value:** Dokumen yang dicari ditemukan lebih cepat karena lingkup pencarian dipersempit sesuai klasifikasi

### US-35 — Melihat Kapasitas Penyimpanan

- **Persona:** Member Team
- **Action:** Melihat informasi persentase penggunaan ruang penyimpanan dan sisa kuota yang tersedia
- **Business value:** Keputusan untuk menghapus atau mengarsipkan dokumen lama diambil sebelum kuota penuh dan proses upload gagal

### US-36 — Mengganti Tema Antarmuka

- **Persona:** Member Team
- **Action:** Mengganti tampilan antarmuka antara mode terang (light) dan mode gelap (dark)
- **Business value:** Kenyamanan membaca dokumen meningkat sesuai preferensi dan kondisi pencahayaan lingkungan kerja

### US-37 — Memfilter Data pada Tabel (Lokal Filter)

- **Persona:** Member Team
- **Action:** Memfilter data di tabel daftar dokumen maupun tabel administrasi secara langsung menggunakan kata kunci yang diketik pada kolom filter tabel
- **Business value:** Dokumen atau record spesifik ditemukan dengan cepat dari daftar yang panjang tanpa harus scroll manual

### US-38 — Melihat Dokumen dalam Tampilan Kartu Visual

- **Persona:** Member Team
- **Action:** Melihat dokumen yang baru diunggah ditampilkan sebagai kartu visual berisi ikon tipe file, judul, tanggal unggah, dan nama pengunggah
- **Business value:** Status dokumen terbaru dikenali secara visual dengan lebih cepat dibandingkan format tabel

### US-39 — Menavigasi Halaman Data dengan Paginasi

- **Persona:** Member Team
- **Action:** Menavigasi data yang berjumlah besar melalui kontrol paginasi yang menampilkan jumlah total data dan nomor halaman
- **Business value:** Data ditampilkan dalam porsi yang ringan dan mudah di-review tanpa membebani waktu muat halaman

### US-40 — Masuk ke Sistem (Login dan Logout)

- **Persona:** Member Team
- **Action:** Masuk ke dalam sistem menggunakan kredensial akun (email dan password) dan melihat informasi profil serta peran (role) yang melekat pada akunnya
- **Business value:** Akses ke sistem terkontrol dan setiap tindakan terekam atas identitas pengguna yang terverifikasi

### US-41 — Melihat Menu Navigasi Sesuai Peran (Role-Based Navigation)

- **Persona:** Member Team
- **Action:** Melihat menu navigasi yang ditampilkan sesuai dengan peran (role) yang melekat pada akunnya
- **Business value:** Pengguna hanya mengakses fitur yang relevan dengan tanggung jawabnya dan tidak terdistraksi oleh fitur yang bukan wewenangnya

### US-42 — Menentukan Batas Maksimal Ukuran Dokumen yang Dapat Diunggah

- **Persona:** Admin Tenant
- **Action:** Menentukan ukuran dokumen yang bisa diunggah oleh Member Team
- **Business value:** Memberikan batasan dokumen yang diunggah untuk memastikan memori penyimpanan tidak bengkak

### US-43 — Isolasi Data Antar Tenant

- **Persona:** Super Admin
- **Action:** Memastikan setiap organisasi memiliki ruang data yang terisolasi penuh dari organisasi lain
- **Business value:** Satu platform dapat melayani banyak organisasi tanpa risiko kebocoran data antar organisasi

### US-44 — Pipeline Pemrosesan Dokumen

- **Persona:** Member Team
- **Action:** Mengetahui status pemrosesan dokumen yang diunggah dan tetap dapat menggunakan dokumen tersebut walaupun pemrosesan otomatis gagal
- **Business value:** Dokumen tidak pernah hilang tanpa penjelasan dan pengguna tahu apa yang sedang terjadi

### US-45 — Mengelola Daftar Kategori

- **Persona:** Head of Team
- **Action:** Menambah, mengubah, dan menonaktifkan kategori dokumen yang tersedia di organisasinya
- **Business value:** Klasifikasi dokumen mengikuti struktur organisasi dan AI hanya memilih dari daftar yang sudah disetujui

### US-46 — Pemindaian Malware saat Unggah

- **Persona:** Head of Team
- **Action:** Memastikan setiap file yang diunggah dipindai dari malware sebelum dapat diakses rekan tim
- **Business value:** Sistem tidak menjadi jalur penyebaran file berbahaya di dalam organisasi

### US-47 — Mengoreksi Hasil Ekstraksi AI

- **Persona:** Member Team
- **Action:** Memperbaiki tag dan field hasil ekstraksi AI yang salah pada dokumennya
- **Business value:** Informasi yang ditampilkan sistem dapat dipercaya dan akurasi AI dapat diukur
