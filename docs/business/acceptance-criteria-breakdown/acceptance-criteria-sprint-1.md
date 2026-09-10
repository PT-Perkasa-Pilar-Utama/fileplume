# Acceptance Criteria — Sprint 1

**Sprint focus:** Fondasi Tenant dan Akses Pengguna  

## User Stories in Scope

- **US-43** Isolasi Data Antar Tenant — Super Admin
- **US-40** Masuk ke Sistem (Login dan Logout) — Member Team
- **US-41** Melihat Menu Navigasi Sesuai Peran (Role-Based Navigation) — Member Team

---

## US-43 — Isolasi Data Antar Tenant (Super Admin)

### AC-43.01 — Membuat tenant pertama

```gherkin
Given Saya seorang Super Admin
  And saya berada di halaman Manajemen Tenant
When Saya mengisi field "Nama Organisasi" dengan "PT Contoh Baru"
  And saya mengisi field "Subdomain" dengan "contohbaru"
  And saya mengklik tombol "Simpan"
Then Sistem menampilkan pesan sukses: "Tenant berhasil ditambahkan"
  And tenant "PT Contoh Baru" muncul di tabel daftar tenant dengan status Active
  And kuota penyimpanan default tenant tersimpan
```

### AC-43.02 — Isolasi data pada pencarian

```gherkin
Given Saya seorang Member Team dari Tenant A
  And Tenant B memiliki dokumen rahasia-b.pdf
When Saya mengetik "rahasia-b" di bar pencarian
  And saya menekan tombol Enter
Then Sistem menampilkan pesan: "Tidak ada hasil yang ditemukan"
```

### AC-43.03 — Isolasi data pada akses langsung (Negative Path)

```gherkin
Given Saya seorang Member Team dari Tenant A
  And dokumen rahasia-b.pdf milik Tenant B memiliki ID dokumen yang diketahui
When Saya mengakses endpoint detail dokumen menggunakan ID milik Tenant B secara langsung
Then Sistem mengembalikan status 403
  And tidak ada metadata atau isi dokumen yang dikembalikan
  And upaya akses tercatat di audit log
```

### AC-43.04 — Isolasi data pada endpoint unduhan (Negative Path)

```gherkin
Given Saya seorang Member Team dari Tenant A
  And dokumen milik Tenant B memiliki ID dokumen yang diketahui
When Saya mengakses endpoint unduhan menggunakan ID milik Tenant B secara langsung
Then Sistem mengembalikan status 403
  And tidak ada file yang terunduh
  And upaya akses tercatat di audit log
```

---

## US-40 — Masuk ke Sistem (Login dan Logout) (Member Team)

### AC-40.01 — Login dengan kredensial yang valid

```gherkin
Given Saya seorang pengguna terdaftar
  And saya berada di halaman Login
  And akun saya memiliki role "Member"
When Saya mengisi field "Email" dengan email terdaftar
  And saya mengisi field "Password" dengan password yang benar
  And saya mengklik tombol "Login"
Then Halaman Dasbor ditampilkan
  And informasi profil saya ditampilkan berisi:
  - nama pengguna
  - role ("MEMBER")
  - avatar
```

### AC-40.02 — Login dengan kredensial yang salah (Negative Path)

```gherkin
Given Saya seorang pengguna
  And saya berada di halaman Login
When Saya mengisi field "Email" dengan email terdaftar
  And saya mengisi field "Password" dengan password yang salah
  And saya mengklik tombol "Login"
Then Sistem menampilkan pesan error: "Email atau password salah"
  And saya tetap berada di halaman Login
```

### AC-40.03 — Logout dari sistem

```gherkin
Given Saya seorang Member Team
  And saya telah berhasil login
  And informasi profil saya ditampilkan
When Saya mengklik ikon pengaturan pada profil saya
  And saya memilih opsi "Logout"
Then Sesi saya berakhir
  And halaman Login ditampilkan kembali
```

### AC-40.04 — Sesi berakhir karena tidak aktif

```gherkin
Given Saya seorang Member Team
  And saya telah berhasil login
  And saya tidak melakukan aktivitas apa pun melebihi batas waktu sesi
When Saya mengklik menu apa pun di antarmuka
Then Sistem menampilkan pesan: "Sesi Anda telah berakhir. Silakan login kembali"
  And halaman Login ditampilkan
```

---

## US-41 — Melihat Menu Navigasi Sesuai Peran (Role-Based Navigation) (Member Team)

### AC-41.01 — Member Team melihat menu sesuai perannya

```gherkin
Given Saya seorang Member Team
  And saya telah berhasil login
When Saya melihat daftar menu navigasi yang tersedia
Then Menu yang ditampilkan hanya berisi:
  - Dashboard
  - Document
  And menu "Permission Category", "Audit Trail" dan "Configuration" tidak ditampilkan
```

### AC-41.02 — Head of Team melihat menu administrasi

```gherkin
Given Saya seorang Head of Team
  And saya telah berhasil login
When Saya melihat daftar menu navigasi yang tersedia
Then Menu yang ditampilkan berisi seluruh menu Member Team
  And ditambah:
  - Permission Category
  - Audit Trail
  - Analitik
```

### AC-41.03 — Admin Tenant melihat seluruh menu tenant

```gherkin
Given Saya seorang Admin Tenant
  And saya telah berhasil login
When Saya melihat daftar menu navigasi yang tersedia
Then Menu yang ditampilkan berisi seluruh menu Head of Team
  And ditambah:
  - Configuration
```

### AC-41.04 — Super Admin melihat menu lintas tenant

```gherkin
Given Saya seorang Super Admin
  And saya telah berhasil login
When Saya melihat daftar menu navigasi yang tersedia
Then Menu yang ditampilkan berisi:
  - Manajemen Tenant
  And menu dokumen milik tenant tidak ditampilkan
```

### AC-41.05 — Menolak akses rute administrasi melalui akses langsung (Negative Path)

```gherkin
Given Saya seorang Member Team
  And saya telah berhasil login
When Saya mengakses endpoint halaman "Permission Category" secara langsung
Then Sistem mengembalikan status 403
  And tidak ada data administrasi yang dikembalikan
  And upaya akses tercatat di audit log
```
