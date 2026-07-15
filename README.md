# Data Warga RT/RW

Aplikasi Vue 3 + Supabase untuk mengelola data warga dari level superadmin, RW, sampai RT. RT mengisi Kartu Keluarga dan anggota warga, RW mengelola RT dan melihat rekap wilayahnya, sedangkan superadmin bisa mengelola seluruh wilayah lengkap sampai kecamatan/kelurahan/RW/RT.

## Stack

- Frontend: Vue 3, Vite, Pinia, Vue Router
- Hosting: Vercel
- Auth: Supabase Auth email/password
- Database: Supabase Postgres
- Storage: Supabase Storage bucket `resident-documents`
- Export: ExcelJS dengan template di `public/dokumensementara/`

## Setup Lokal

```sh
npm install
cp .env.example .env.local
npm run dev
```

Isi `.env.local` dengan konfigurasi Supabase dari Project Settings atau Connect dialog:

```sh
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Untuk project lama yang belum punya publishable key baru, legacy anon key bisa dipakai sementara di `VITE_SUPABASE_PUBLISHABLE_KEY`. Jangan pernah menaruh `service_role` atau secret key di frontend.

## Setup Supabase

1. Buka Supabase Dashboard dan buat project baru.
2. Buka Authentication, aktifkan provider Email.
3. Buka SQL Editor dan jalankan seluruh isi `supabase/schema.sql`.
4. Pastikan tabel public terekspos ke Data API. Schema SQL sudah menyertakan explicit `GRANT` untuk role `authenticated`, sesuai perubahan Supabase 2026.
5. Buat user pertama di Authentication.
6. Buka SQL Editor, lalu buat profil superadmin untuk user pertama:

```sql
insert into public.profiles (id, email, display_name, role)
values (
  'UID_DARI_AUTH_USERS',
  'admin@example.com',
  'Superadmin',
  'superadmin'
);
```

Setelah superadmin login, buat data wilayah dari provinsi, kota/kabupaten, kecamatan, kelurahan, RW, lalu RT. Untuk akun RW/RT, buat user di Supabase Auth dan tambahkan baris `profiles` dengan `role`, `rw_id`, `rt_id`, serta scope wilayah yang sesuai.

## Struktur Supabase

- `profiles`: profil akun, role, dan scope wilayah.
- `regions`: provinsi, kota/kabupaten, kecamatan, kelurahan, RW, RT.
- `family_cards`: Kartu Keluarga per RT/RW.
- `residents`: data warga mengikuti isian Kartu Keluarga Indonesia.
- `resident_mutations`: catatan LAMPID.
- `report_exports`: audit ringan export laporan.
- Storage bucket `resident-documents`: dokumen pendukung warga/KK. Upload wajib memakai path `{rw_id}/{rt_id}/nama_file` supaya RLS storage bisa scoped per RW/RT.

## Role dan Akses

- Superadmin: baca/tulis semua wilayah, RW, RT, KK, warga, dan mutasi.
- RW: baca data RW sendiri, membuat RT dalam RW sendiri, melihat rekap/export RW.
- RT: mengisi KK, warga, dan mutasi dalam RT sendiri.

Pembatasan akses dilakukan di UI, query Supabase, dan Row Level Security di `supabase/schema.sql`.

## Export Laporan

Halaman Export memakai template XLSX di `public/dokumensementara/`:

- `LAMPID.xlsx`
- `Model A.1. Buku Induk Penduduk Tetap - Penduduk Tetap.xlsx`
- `Model A.2. Buku Induk Penduduk Tetap - Penduduk Sementara atau Musiman Dalam Kota Bandung.xlsx`
- `Model A.3. Buku Peubahan Penduduk Tetap - Karena LAMPID - Penduduk Tetap.xlsx`
- `Model A.4. Buku Perubahan Penduduk Tetap - Karena LAMPID - Penduduk Sementara atau Musiman.xlsx`
- `Model A.5. Buku Perkembangan Penduduk.xlsx`

Export saat ini mengisi kolom inti dan rekap utama. Jika kecamatan meminta format yang lebih ketat, mapper di `src/services/reports.ts` adalah tempat utama untuk menyesuaikan sel template.

## Deploy Vercel

1. Push repo ke GitHub/GitLab.
2. Import project di Vercel.
3. Set framework preset ke Vite.
4. Tambahkan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_PUBLISHABLE_KEY` ke environment variables Vercel.
5. Build command: `npm run build`.
6. Output directory: `dist`.

## Validasi

```sh
npm run build
npm run test:unit
```

Catatan: `npm install` di project ini menjalankan script `prepare` untuk Cypress. Jika hanya menambah dependency di lingkungan lambat, gunakan `npm install --ignore-scripts`, lalu jalankan instalasi Cypress terpisah bila perlu.
