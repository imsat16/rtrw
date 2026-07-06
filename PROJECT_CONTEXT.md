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
- Tidak ada backend custom pada tahap awal; role dan scope disimpan di tabel `profiles`.

## Role

- `superadmin`: semua data.
- `rw`: data dengan `rwId` yang sama.
- `rt`: data dengan `rtId` yang sama.

## Data Utama

- `regions`: provinsi, kota/kabupaten, kecamatan, kelurahan, RW, RT.
- `family_cards`: nomor KK, kepala keluarga, alamat, scope wilayah.
- `residents`: NIK, nama, jenis kelamin, TTL, agama, pendidikan, pekerjaan, status kawin, hubungan keluarga, kewarganegaraan, orang tua, alamat, status penduduk.
- `resident_mutations`: LAMPID lahir, mati, pindah, datang.

## File Penting

- `src/lib/supabase.ts`: konfigurasi Supabase client.
- `src/stores/auth.ts`: session, profil role, dan guard.
- `src/services/data.ts`: akses tabel Supabase dan mapper snake_case/camelCase.
- `src/services/reports.ts`: statistik dan export XLSX template.
- `supabase/schema.sql`: tabel, grants, RLS policies, dan storage bucket.

## Arah Pengembangan Berikutnya

- Tambah manajemen user RW/RT dari UI superadmin/RW.
- Perketat mapper XLSX per cell bila format kecamatan sudah final.
- Tambah upload dokumen pendukung per warga atau KK.
- Tambah test RLS di Supabase SQL/RLS tester.
