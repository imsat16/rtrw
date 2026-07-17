# Konteks Project Data Warga RT/RW

Project ini adalah aplikasi administrasi warga untuk membantu RT/RW mengelola data Kartu Keluarga, warga, mutasi LAMPID, dashboard kependudukan, dan export XLSX untuk laporan ke kecamatan.

## Tujuan Produk

- RT mengisi data KK dan anggota warga dalam wilayah RT-nya.
- RW melihat dashboard warga dalam RW dan menambahkan data RT.
- Superadmin melihat seluruh data dan menambahkan struktur wilayah.
- Laporan bisa diexport menjadi XLSX berdasarkan template kecamatan yang tersimpan di `public/dokumensementara/`.

## Stack dan Batasan

- Frontend di Vercel.
- Supabase Auth untuk login email/password.
- Supabase Postgres untuk database.
- Supabase Storage untuk dokumen pendukung.
- Tidak ada backend custom pada tahap awal; role direferensikan melalui UUID `profiles.role_id`, permission disimpan di tabel RBAC, dan scope wilayah disimpan di `profiles`.

## Role

- `superadmin`: semua data dan pengelola RBAC.
- `ketua_rw` dan `staff_rw`: data dengan `rwId` yang sama.
- `ketua_rt` dan `staff_rt`: data dengan `rtId` yang sama.

## Data Utama

- `master_roles`: lima master role yang direferensikan oleh UUID `profiles.role_id`.
- `master_provinces`, `master_cities`, `master_districts`, `master_villages`, `master_rws`, `master_rts`: master wilayah terpisah dan berjenjang.
- `master_permissions`, `role_permissions`, `user_permissions`: default permission role dan override per pengguna.
- `family_cards`: nomor KK, kepala keluarga, alamat, scope wilayah.
- `residents`: NIK, nama, jenis kelamin, TTL, agama, pendidikan, pekerjaan, status kawin, hubungan keluarga, kewarganegaraan, orang tua, alamat, status penduduk.
- `resident_mutations`: LAMPID lahir, mati, pindah, datang. Insert pada tabel ini memicu trigger `app_private.apply_resident_mutation()` yang otomatis mengisi `residents.moved_out_at` untuk mutasi `pindah`/`mati`, dan mengosongkannya lagi untuk `datang`.
- Storage bucket `resident-documents`: path objek wajib `{rw_id}/{rt_id}/nama_file` agar RLS storage bisa scoped per RW/RT seperti tabel lain.

## File Penting

- `src/lib/supabase.ts`: konfigurasi Supabase client.
- `src/stores/auth.ts`: session, profil role, dan guard.
- `src/services/data.ts`: akses tabel Supabase dan mapper snake_case/camelCase.
- `supabase/functions/create-user/index.ts`: create/update/delete akun Authentication beserta profile; pembuatan hanya oleh Superadmin, update/delete divalidasi berdasarkan role dan scope RW di server, serta akun Superadmin tidak dapat dihapus.
- `src/services/reports.ts`: statistik dan export XLSX template.
- `supabase/schema.sql`: tabel, grants, RLS policies, dan storage bucket.

## Arah Pengembangan Berikutnya

- Perketat mapper XLSX per cell bila format kecamatan sudah final.
- Tambah upload dokumen pendukung per warga atau KK (ikuti konvensi path `{rw_id}/{rt_id}/...` yang sudah disiapkan di RLS storage).
- Tambah test RLS di Supabase SQL/RLS tester.
- Halaman KK dan Data Warga terpisah; pembuatan KK otomatis membuat warga dengan hubungan `Kepala Keluarga` melalui transaksi database.
