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
insert into public.profiles (id, email, display_name, role_id)
values (
  'UID_DARI_AUTH_USERS',
  'admin@example.com',
  'Superadmin',
  (select id from public.master_roles where code = 'superadmin')
);
```

Setelah superadmin login, buat data wilayah dari provinsi, kota/kabupaten, kecamatan, kelurahan, RW, lalu RT. Akun berikutnya dibuat langsung melalui halaman Manajemen Pengguna.

Deploy Edge Function agar Superadmin dapat membuat akun langsung dari aplikasi:

```sh
supabase functions deploy create-user --project-ref qnlwdswbraukuxbzunqh --no-verify-jwt
```

Function memakai secret/service key bawaan environment Supabase di sisi server. Jangan menambahkan key tersebut ke `.env.local` frontend. Opsi `--no-verify-jwt` hanya mematikan pemeriksaan JWT legacy di gateway; function tetap memvalidasi access token dengan `auth.getUser()`. Pembuatan akun hanya dapat dilakukan Superadmin, sedangkan perubahan dan penghapusan akun mengikuti role serta scope RW pemanggil. Email, password, dan nama tampilan disinkronkan dengan Supabase Authentication. Akun Superadmin dan akun yang sedang digunakan tidak dapat dihapus; trigger database juga melindungi profil Superadmin dari penghapusan langsung.

## Struktur Supabase

- `master_roles`: master lima role tetap; `profiles.role_id` mereferensikan UUID tabel ini.
- `master_provinces`, `master_cities`, `master_districts`, `master_villages`, `master_rws`, `master_rts`: master wilayah berjenjang.
- `master_permissions`, `role_permissions`, `user_permissions`: default RBAC per role dan override per pengguna.
- `profiles`: profil akun dan scope wilayah.
- `family_cards`: Kartu Keluarga per RT/RW.
- `residents`: data warga mengikuti isian Kartu Keluarga Indonesia.
- `resident_mutations`: catatan LAMPID.
- `report_exports`: audit ringan export laporan.
- Storage bucket `resident-documents`: dokumen pendukung warga/KK. Upload wajib memakai path `{rw_id}/{rt_id}/nama_file` supaya RLS storage bisa scoped per RW/RT.

## Role dan Akses

- Superadmin: baca/tulis semua wilayah, RW, RT, KK, warga, dan mutasi.
- Ketua RW, Ketua RT, Staff RW, dan Staff RT: hak awal mengikuti default role serta scope RW/RT.
- Superadmin dapat mengubah default role dan override akun melalui halaman `Role & Permission`.

Seluruh primary key dan foreign key ID memakai UUID. Kode stabil seperti `ketua_rw` dan `dashboard.view` disimpan pada kolom `code`, bukan sebagai ID. Pembatasan akses dilakukan di UI, query Supabase, dan Row Level Security di `supabase/schema.sql`.

## Kartu Keluarga dan Data Warga

- Halaman `Kartu Keluarga` memiliki filter RW, RT, dan pencarian nomor KK.
- Pembuatan KK meminta data dasar kepala keluarga. Function database `create_family_card_with_head` menyimpan KK dan warga kepala keluarga dalam satu transaksi.
- Halaman `Data Warga` terpisah untuk menambah anggota keluarga, mencari warga, dan mencatat mutasi LAMPID.

Export **Data Sasaran PAAREDI** menghasilkan satu sheet rincian (18 kolom) per RT serta sheet `Rekap RT` (12 kolom), dengan header bertingkat, total otomatis, dan pengaturan cetak A4 landscape. Filter Semua RT menyertakan seluruh RT dalam wilayah akses, termasuk RT tanpa sasaran; filter RT tertentu hanya menyertakan rincian dan rekap RT tersebut. Nomor baris dimulai lagi dari 1 pada setiap RT. RT dengan nomor sama pada RW berbeda dibedakan dengan nama RW. Seluruh sasaran diekspor tanpa batas 200 baris. Sasaran mencakup warga usia 0–24 tahun pada akhir bulan terpilih serta warga dengan catatan LAMPID hamil pada bulan tersebut. Warga yang sudah keluar/meninggal atau belum mulai tinggal pada akhir bulan tidak disertakan. Ini menggunakan data warga terkini, bukan rekonstruksi riwayat penduduk.

Semua jenis laporan menyediakan Preview sesuai filter aktif. Preview PAAREDI menyediakan pilihan sheet rincian per RT dan rekap yang sama dengan XLSX. Tombol Filter dan Refresh menggunakan ikon dengan tooltip; Refresh mengambil ulang data dari endpoint, melewati cache memori.

Nama orang tua berasal dari nama ayah/ibu; Akte, KIA, dan KTP menggunakan nilai 1/0 dari status dokumen warga, lalu dijumlahkan per RT. Status dokumen adalah kondisi terkini. Kolom usia dalam kandungan dibiarkan kosong karena belum tersedia datanya. Terapkan `supabase/migrations/20261016000000_resident_documents.sql` sebelum menggunakan field dokumen di database yang sudah ada.

Template import KK juga menyediakan kolom `Akte (Ya/Tidak)`, `KIA (Ya/Tidak)`, dan `KTP (Ya/Tidak)` di kolom U–W dengan dropdown Ya/Tidak. Import menerima Ya/Tidak, TRUE/FALSE, atau 1/0. Nilai lain ditolak dengan pesan baris/kolom. Kolom kosong atau template lama tanpa kolom tersebut mempertahankan status dokumen warga lama; warga baru mengikuti default database `false`. Isi Tidak/FALSE/0 untuk mengubah status menjadi tidak memiliki.

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

Daftar Warga dan Kartu Keluarga memakai pagination Supabase (`range` dan `count: exact`), dengan pilihan 10, 25, atau 50 data per halaman. Pencarian tampil langsung di atas tabel, memakai debounce 350 ms, dan mengembalikan halaman ke 1 saat filter berubah. Respons lama tidak menggantikan hasil pencarian terbaru. Dashboard dan export tetap membaca seluruh data untuk menjaga rekap lengkap.

Request baca REST yang identik berbagi cache memori selama 2 menit (maksimal 80 entri), termasuk request yang masih berjalan. Kunci cache mencakup URL dan header sesi. Cache dibersihkan saat login, logout, pergantian akun, serta operasi perubahan data REST/Edge Function. Cache tidak disimpan ke disk dan hilang saat halaman di-reload; perubahan dari perangkat lain terlihat setelah cache kedaluwarsa atau reload.

Nama `[object Object]` dapat berasal dari konversi objek sel Excel dengan `String(value)`, khususnya hyperlink. Parser sekarang membaca teks hyperlink, rich text, dan hasil formula, serta menolak objek yang tidak dikenali dan teks rusak dengan nomor baris. Nama yang sudah telanjur tersimpan sebagai `[object Object]` ditandai **Nama perlu diperbaiki** pada daftar: koreksi lewat Edit atau impor ulang file sumber dengan KK/NIK yang sama. Nama asli tidak dapat dipulihkan dari string rusak tersebut saja.

```sh
npm run build
npm run test:unit
```

Regresi browser untuk pagination, cache, pencarian, login, dan layout mobile memakai API mock di `cypress/e2e/pagination.cy.ts`. Jalankan preview pada port 4173, lalu `npx cypress run --spec cypress/e2e/pagination.cy.ts`. Pengujian ini tidak membuktikan akses RLS atau perubahan data pada backend live.

Catatan: `npm install` di project ini menjalankan script `prepare` untuk Cypress. Jika hanya menambah dependency di lingkungan lambat, gunakan `npm install --ignore-scripts`, lalu jalankan instalasi Cypress terpisah bila perlu.
