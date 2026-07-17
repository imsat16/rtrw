<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

type PrimaryRole = 'ketua_rt' | 'ketua_rw'

const auth = useAuthStore()
const activeRole = ref<PrimaryRole>('ketua_rt')
const updatedAt = new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())
const appTarget = computed(() => auth.isAuthenticated ? '/' : '/login')
const appTargetLabel = computed(() => auth.isAuthenticated ? 'Kembali ke dashboard' : 'Masuk ke aplikasi')

const roleSummary = computed(() => activeRole.value === 'ketua_rt'
  ? {
      title: 'Panduan Ketua RT',
      description: 'Mengelola KK, warga, LAMPID, dan laporan khusus RT yang menjadi tanggung jawab Anda.',
      scope: 'Ketua RT hanya dapat melihat dan mengelola data pada RT miliknya.',
    }
  : {
      title: 'Panduan Ketua RW',
      description: 'Memantau seluruh RT dalam satu RW, membandingkan data antar-RT, dan menyiapkan laporan tingkat RW.',
      scope: 'Ketua RW dapat melihat data seluruh RT dalam RW miliknya, tetapi tidak dapat membuka RW lain.',
    })

function printGuide() {
  window.print()
}
</script>

<template>
  <div class="guide-page">
    <header class="guide-topbar">
      <RouterLink class="guide-brand" to="/panduan">
        <span class="brand-mark">RW</span>
        <span><strong>Data Warga</strong><small>Panduan RT/RW Digital</small></span>
      </RouterLink>
      <nav class="guide-top-actions">
        <button class="secondary-button guide-print" type="button" @click="printGuide">Cetak panduan</button>
        <RouterLink class="primary-button guide-app-link" :to="appTarget">{{ appTargetLabel }}</RouterLink>
      </nav>
    </header>

    <main class="guide-content">
      <section class="guide-hero">
        <div>
          <p class="eyebrow">Panduan pengguna publik</p>
          <h1>Kelola data warga dengan alur yang benar</h1>
          <p>Panduan langkah demi langkah untuk Ketua RT dan Ketua RW, mulai dari memeriksa dashboard sampai menyiapkan laporan.</p>
        </div>
        <div class="guide-hero-note">
          <span>Versi panduan</span><strong>{{ updatedAt }}</strong>
          <small>Tidak memerlukan login untuk dibaca.</small>
        </div>
      </section>

      <section class="guide-role-picker" aria-label="Pilih panduan berdasarkan role">
        <button :class="{ active: activeRole === 'ketua_rt' }" type="button" @click="activeRole = 'ketua_rt'">
          <span>RT</span><div><strong>Ketua RT</strong><small>Kelola KK dan warga RT</small></div>
        </button>
        <button :class="{ active: activeRole === 'ketua_rw' }" type="button" @click="activeRole = 'ketua_rw'">
          <span>RW</span><div><strong>Ketua RW</strong><small>Pantau seluruh RT dalam RW</small></div>
        </button>
      </section>

      <section class="guide-intro-card">
        <div><p class="eyebrow">Panduan aktif</p><h2>{{ roleSummary.title }}</h2><p>{{ roleSummary.description }}</p></div>
        <p class="guide-scope"><strong>Batas akses</strong>{{ roleSummary.scope }}</p>
      </section>

      <div class="guide-layout">
        <aside class="guide-toc">
          <strong>Daftar isi</strong>
          <a href="#mulai">1. Memulai</a>
          <a href="#dashboard">2. Membaca dashboard</a>
          <a v-if="activeRole === 'ketua_rw'" href="#wilayah">3. Mengelola RT</a>
          <a href="#kk">{{ activeRole === 'ketua_rw' ? '4' : '3' }}. Kartu Keluarga</a>
          <a href="#warga">{{ activeRole === 'ketua_rw' ? '5' : '4' }}. Data warga</a>
          <a href="#lampid">{{ activeRole === 'ketua_rw' ? '6' : '5' }}. LAMPID</a>
          <a href="#laporan">{{ activeRole === 'ketua_rw' ? '7' : '6' }}. Export laporan</a>
          <a href="#keamanan">Keamanan akun</a>
        </aside>

        <div class="guide-sections">
          <section id="mulai" class="guide-section">
            <span class="guide-step-number">01</span>
            <div><h2>Memulai dan masuk</h2><ol>
              <li>Buka halaman masuk aplikasi dan masukkan email serta password akun.</li>
              <li>Pastikan nama, role, dan wilayah pada bagian kanan atas sudah sesuai.</li>
              <li>Jika wilayah atau role salah, hentikan pengisian data dan hubungi administrator.</li>
            </ol><div class="guide-tip"><strong>Tip</strong>Gunakan akun pribadi. Jangan menggunakan akun Ketua RT/RW lain meskipun berada di wilayah yang sama.</div></div>
          </section>

          <section id="dashboard" class="guide-section">
            <span class="guide-step-number">02</span>
            <div><h2>Membaca dashboard</h2>
              <template v-if="activeRole === 'ketua_rt'"><p>Dashboard Ketua RT hanya berisi data RT Anda. Gunakan untuk memeriksa:</p><ul>
                <li>Total KK dan warga yang sudah terdaftar.</li><li>Komposisi jenis kelamin dan status penduduk.</li>
                <li>Kelompok usia untuk kebutuhan layanan warga.</li><li>Tren lahir, meninggal, pindah, dan datang selama enam bulan.</li>
              </ul></template>
              <template v-else><p>Dashboard Ketua RW merangkum seluruh RT dalam RW Anda. Gunakan untuk:</p><ul>
                <li>Membandingkan jumlah KK dan warga setiap RT.</li><li>Menemukan RT yang datanya belum lengkap atau berbeda jauh.</li>
                <li>Memantau komposisi warga dan tren LAMPID tingkat RW.</li>
              </ul></template>
              <p>Klik <strong>Refresh</strong> setelah melakukan perubahan besar agar ringkasan terbaru ditampilkan.</p>
            </div>
          </section>

          <section v-if="activeRole === 'ketua_rw'" id="wilayah" class="guide-section">
            <span class="guide-step-number">03</span>
            <div><h2>Mengelola RT dalam RW</h2><ol>
              <li>Buka <strong>Master Wilayah</strong>.</li><li>Klik <strong>Tambah Wilayah</strong> dan pilih jenis <strong>RT</strong>.</li>
              <li>Pilih RW induk yang tersedia, isi nama/nomor RT, lalu simpan.</li><li>Gunakan Edit jika penamaan RT perlu diperbaiki.</li>
            </ol><div class="guide-warning"><strong>Perhatian</strong>Jangan menghapus RT yang sudah memiliki KK atau warga sebelum data dependensinya ditangani.</div></div>
          </section>

          <section id="kk" class="guide-section">
            <span class="guide-step-number">{{ activeRole === 'ketua_rw' ? '04' : '03' }}</span>
            <div><h2>Mengelola Kartu Keluarga</h2><ol>
              <li>Buka <strong>Kartu Keluarga</strong>. {{ activeRole === 'ketua_rw' ? 'Gunakan filter RW/RT untuk memilih wilayah kerja.' : 'Daftar otomatis dibatasi ke RT Anda.' }}</li>
              <li>Klik <strong>Tambah KK</strong>, kemudian isi nomor KK, data kepala keluarga, alamat, dan wilayah.</li>
              <li>Saat disimpan, kepala keluarga otomatis dibuat sebagai data warga pertama dalam KK tersebut.</li>
              <li>Gunakan <strong>Lihat</strong> untuk membuka jumlah dan accordion detail anggota keluarga.</li>
            </ol><div class="guide-tip"><strong>Pemeriksaan</strong>Pastikan nomor KK dan NIK berjumlah 16 digit serta tidak tertukar.</div></div>
          </section>

          <section id="warga" class="guide-section">
            <span class="guide-step-number">{{ activeRole === 'ketua_rw' ? '05' : '04' }}</span>
            <div><h2>Menambah dan memperbarui warga</h2><ol>
              <li>Buka <strong>Data Warga</strong>, lalu klik <strong>Tambah Warga</strong>.</li>
              <li>Pada field Kartu Keluarga, ketik nomor KK, NIK anggota, atau nama kepala keluarga, kemudian pilih hasilnya.</li>
              <li>Isi identitas warga dan hubungan dalam keluarga, lalu simpan.</li>
              <li>Gunakan tombol <strong>Lihat</strong>, <strong>Edit</strong>, atau <strong>Hapus</strong> pada baris warga.</li>
            </ol><div class="guide-warning"><strong>Sebelum menghapus</strong>Pastikan data warga memang salah/duplikat dan bukan warga yang seharusnya dicatat sebagai pindah atau meninggal.</div></div>
          </section>

          <section id="lampid" class="guide-section">
            <span class="guide-step-number">{{ activeRole === 'ketua_rw' ? '06' : '05' }}</span>
            <div><h2>Mencatat LAMPID</h2><p>LAMPID digunakan untuk mencatat <strong>lahir, meninggal, pindah, dan datang</strong>.</p><ol>
              <li>Dari halaman Data Warga, klik <strong>Catat LAMPID</strong>.</li><li>Pilih warga, jenis kejadian, tanggal, dan isi catatan bila diperlukan.</li>
              <li>Simpan dan periksa perubahan pada dashboard serta laporan.</li>
            </ol><p>Untuk kejadian pindah atau meninggal, sistem menandai tanggal keluar pada data warga tanpa menghilangkan riwayat mutasinya.</p></div>
          </section>

          <section id="laporan" class="guide-section">
            <span class="guide-step-number">{{ activeRole === 'ketua_rw' ? '07' : '06' }}</span>
            <div><h2>Menyiapkan laporan</h2><ol>
              <li>Periksa dashboard, data KK, warga, dan LAMPID sebelum membuat laporan.</li><li>Buka <strong>Export Laporan</strong>.</li>
              <li>Pilih jenis laporan dan periode yang dibutuhkan.</li><li>{{ activeRole === 'ketua_rw' ? 'Pilih RT bila laporan hanya untuk satu RT, atau gunakan cakupan RW untuk rekap keseluruhan.' : 'Pastikan cakupan laporan menunjukkan RT Anda.' }}</li>
              <li>Unduh file dan periksa kembali angka total sebelum dikirim.</li>
            </ol></div>
          </section>

          <section id="keamanan" class="guide-section guide-section--compact">
            <span class="guide-step-number">!</span><div><h2>Keamanan akun dan data</h2><ul>
              <li>Jangan membagikan password melalui grup chat.</li><li>Selalu klik <strong>Keluar</strong> setelah memakai perangkat bersama.</li>
              <li>Jangan mengubah atau menghapus data di luar dokumen pendukung yang sah.</li><li>Laporkan segera jika akun dapat melihat wilayah yang bukan tanggung jawabnya.</li>
            </ul></div>
          </section>
        </div>
      </div>

      <section class="guide-other-roles">
        <div><strong>Staff RT / Staff RW</strong><p>Mengikuti scope wilayah atasannya. Menu yang tersedia bergantung pada permission yang diberikan.</p></div>
        <div><strong>Superadmin</strong><p>Dapat mengelola seluruh wilayah, pengguna, role/permission, KK, warga, dan laporan.</p></div>
      </section>
    </main>

    <footer class="guide-footer"><span>Data Warga RT/RW Digital</span><RouterLink :to="appTarget">{{ appTargetLabel }} →</RouterLink></footer>
  </div>
</template>
