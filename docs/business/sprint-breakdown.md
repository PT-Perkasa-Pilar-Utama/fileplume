# Archiva Sprint Breakdown

**Version:** 1.0  
**Date:** 2026-09-10  
**Status:** Release 1  
**Source:** `docs/us-ac/User-Stories-and-AC.md`  

Release 1 covers 30 stories across 5 sprints. US-15 to US-20 and US-22 to US-32 are roadmap and are not scheduled.

Ordering follows the sequencing constraints recorded in `docs/grooming/grooming-archiva-interview.md`: tenant isolation before any upload, malware scanning before a document reaches another user, the processing pipeline before any AI-facing story, and category taxonomy before automatic classification.

---

## Sprint 1 — Fondasi Tenant dan Akses Pengguna

1. US-43 — Isolasi Data Antar Tenant (Super Admin)
2. US-40 — Masuk ke Sistem (Login dan Logout) (Member Team)
3. US-41 — Melihat Menu Navigasi Sesuai Peran (Role-Based Navigation) (Member Team)

## Sprint 2 — Unggah, Simpan, dan Batas Penyimpanan

1. US-01 — Mengunggah Dokumen (Member Team)
2. US-46 — Pemindaian Malware saat Unggah (Head of Team)
3. US-21 — Versioning Dokumen Otomatis (Member Team)
4. US-03 — Mencegah Unggahan Duplikat (Member Team)
5. US-42 — Menentukan Batas Maksimal Ukuran Dokumen yang Dapat Diunggah (Admin Tenant)
6. US-35 — Melihat Kapasitas Penyimpanan (Member Team)
7. US-38 — Melihat Dokumen dalam Tampilan Kartu Visual (Member Team)

## Sprint 3 — Klasifikasi Otomatis dan Metadata

1. US-44 — Pipeline Pemrosesan Dokumen (Member Team)
2. US-45 — Mengelola Daftar Kategori (Head of Team)
3. US-02 — Menentukan Kategori Tiap Dokumen (Member Team)
4. US-06 — Pengkategorian & Klasifikasi Dokumen Otomatis via AI (Member Team)
5. US-04 — Melihat Metadata Dokumen (Member Team)
6. US-05 — Memfilter Hasil Pencarian dengan Tag Otomatis (Member Team)
7. US-47 — Mengoreksi Hasil Ekstraksi AI (Member Team)

## Sprint 4 — Pencarian dan Penemuan Dokumen

1. US-07 — Mencari Judul & Metadata Dokumen (Member Team)
2. US-33 — Mencari Teks di Dalam Isi Berkas (Deep Content Search) (Member Team)
3. US-34 — Memfilter Dokumen Berdasarkan Kategori (Member Team)
4. US-37 — Memfilter Data pada Tabel (Lokal Filter) (Member Team)
5. US-39 — Menavigasi Halaman Data dengan Paginasi (Member Team)
6. US-08 — Menemukan Dokumen Terkait (Member Team)
7. US-09 — Melihat Preview Dokumen (Member Team)

## Sprint 5 — Tata Kelola, Unduhan, dan Pemantauan

1. US-10 — Mengunduh Dokumen (Member Team)
2. US-11 — Mengunduh Dokumen Massal (Member Team)
3. US-14 — Mengatur Perizinan Dokumen (Head of Team)
4. US-13 — Melihat Audit Trail (Head of Team)
5. US-12 — Melihat Dasbor Analitik (Head of Team)
6. US-36 — Mengganti Tema Antarmuka (Member Team)
