<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  listFamilyCards,
  listMutations,
  listResidents,
  saveFamilyCard,
  saveMutation,
  saveResident,
} from '@/services/data'
import { createScopePayload } from '@/services/scope'
import { useAuthStore } from '@/stores/auth'
import type { FamilyCard, Gender, MutationType, Resident, ResidentMutation, ResidentStatus } from '@/types/domain'

const auth = useAuthStore()
const cards = ref<FamilyCard[]>([])
const residents = ref<Resident[]>([])
const mutations = ref<ResidentMutation[]>([])
const message = ref('')

const cardForm = reactive({
  kkNumber: '',
  headName: '',
  address: '',
  registeredAt: '',
})

const residentForm = reactive({
  familyCardId: '',
  nik: '',
  fullName: '',
  gender: 'L' as Gender,
  birthPlace: '',
  birthDate: '',
  religion: 'Islam',
  education: '',
  occupation: '',
  maritalStatus: 'Belum Kawin',
  familyRelationship: 'Anak',
  citizenship: 'WNI',
  fatherName: '',
  motherName: '',
  staySince: '',
  residentStatus: 'tetap' as ResidentStatus,
})

const mutationForm = reactive({
  residentId: '',
  mutationType: 'lahir' as MutationType,
  mutationDate: '',
  note: '',
})

const selectedCard = computed(() => cards.value.find((item) => item.id === residentForm.familyCardId))
const selectedResident = computed(() => residents.value.find((item) => item.id === mutationForm.residentId))

async function loadData() {
  const [cardData, residentData, mutationData] = await Promise.all([
    listFamilyCards(auth.profile),
    listResidents(auth.profile),
    listMutations(auth.profile),
  ])
  cards.value = cardData
  residents.value = residentData
  mutations.value = mutationData
}

async function submitCard() {
  await saveFamilyCard({
    ...createScopePayload(auth.profile),
    kkNumber: cardForm.kkNumber,
    headName: cardForm.headName,
    address: cardForm.address,
    registeredAt: cardForm.registeredAt,
  })
  cardForm.kkNumber = ''
  cardForm.headName = ''
  cardForm.address = ''
  cardForm.registeredAt = ''
  message.value = 'Kartu keluarga berhasil disimpan.'
  await loadData()
}

async function submitResident() {
  if (!selectedCard.value) return
  await saveResident({
    ...createScopePayload(auth.profile),
    familyCardId: selectedCard.value.id,
    kkNumber: selectedCard.value.kkNumber,
    nik: residentForm.nik,
    fullName: residentForm.fullName,
    gender: residentForm.gender,
    birthPlace: residentForm.birthPlace,
    birthDate: residentForm.birthDate,
    religion: residentForm.religion,
    education: residentForm.education,
    occupation: residentForm.occupation,
    maritalStatus: residentForm.maritalStatus,
    familyRelationship: residentForm.familyRelationship,
    citizenship: residentForm.citizenship,
    fatherName: residentForm.fatherName,
    motherName: residentForm.motherName,
    address: selectedCard.value.address,
    staySince: residentForm.staySince,
    residentStatus: residentForm.residentStatus,
  })
  residentForm.nik = ''
  residentForm.fullName = ''
  residentForm.birthPlace = ''
  residentForm.birthDate = ''
  residentForm.education = ''
  residentForm.occupation = ''
  residentForm.fatherName = ''
  residentForm.motherName = ''
  message.value = 'Warga berhasil ditambahkan ke KK.'
  await loadData()
}

async function submitMutation() {
  if (!selectedResident.value) return
  await saveMutation({
    ...createScopePayload(auth.profile),
    residentId: selectedResident.value.id,
    residentName: selectedResident.value.fullName,
    gender: selectedResident.value.gender,
    mutationType: mutationForm.mutationType,
    mutationDate: mutationForm.mutationDate,
    note: mutationForm.note,
    residentStatus: selectedResident.value.residentStatus,
  })
  mutationForm.note = ''
  message.value = 'Mutasi LAMPID berhasil dicatat.'
  await loadData()
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <section class="content-stack">
    <p v-if="message" class="success">{{ message }}</p>

    <form class="form-grid" @submit.prevent="submitCard">
      <div class="field">
        <label for="kkNumber">Nomor KK</label>
        <input id="kkNumber" v-model="cardForm.kkNumber" required />
      </div>
      <div class="field">
        <label for="headName">Kepala keluarga</label>
        <input id="headName" v-model="cardForm.headName" required />
      </div>
      <div class="field">
        <label for="registeredAt">Tanggal terdaftar</label>
        <input id="registeredAt" v-model="cardForm.registeredAt" type="date" />
      </div>
      <div class="field">
        <label for="address">Alamat lengkap</label>
        <textarea id="address" v-model="cardForm.address" required />
      </div>
      <button class="primary-button" type="submit">Tambah KK</button>
    </form>

    <form class="form-grid compact" @submit.prevent="submitResident">
      <div class="field">
        <label for="familyCardId">Kartu keluarga</label>
        <select id="familyCardId" v-model="residentForm.familyCardId" required>
          <option value="">Pilih KK</option>
          <option v-for="card in cards" :key="card.id" :value="card.id">
            {{ card.kkNumber }} - {{ card.headName }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="nik">NIK</label>
        <input id="nik" v-model="residentForm.nik" required />
      </div>
      <div class="field">
        <label for="fullName">Nama lengkap</label>
        <input id="fullName" v-model="residentForm.fullName" required />
      </div>
      <div class="field">
        <label for="gender">Jenis kelamin</label>
        <select id="gender" v-model="residentForm.gender">
          <option value="L">Laki-laki</option>
          <option value="P">Perempuan</option>
        </select>
      </div>
      <div class="field">
        <label for="birthPlace">Tempat lahir</label>
        <input id="birthPlace" v-model="residentForm.birthPlace" required />
      </div>
      <div class="field">
        <label for="birthDate">Tanggal lahir</label>
        <input id="birthDate" v-model="residentForm.birthDate" required type="date" />
      </div>
      <div class="field">
        <label for="religion">Agama</label>
        <input id="religion" v-model="residentForm.religion" required />
      </div>
      <div class="field">
        <label for="education">Pendidikan</label>
        <input id="education" v-model="residentForm.education" />
      </div>
      <div class="field">
        <label for="occupation">Pekerjaan</label>
        <input id="occupation" v-model="residentForm.occupation" />
      </div>
      <div class="field">
        <label for="maritalStatus">Status kawin</label>
        <select id="maritalStatus" v-model="residentForm.maritalStatus">
          <option>Belum Kawin</option>
          <option>Kawin</option>
          <option>Cerai Hidup</option>
          <option>Cerai Mati</option>
        </select>
      </div>
      <div class="field">
        <label for="familyRelationship">Hubungan keluarga</label>
        <input id="familyRelationship" v-model="residentForm.familyRelationship" />
      </div>
      <div class="field">
        <label for="citizenship">Kewarganegaraan</label>
        <input id="citizenship" v-model="residentForm.citizenship" />
      </div>
      <div class="field">
        <label for="fatherName">Nama ayah</label>
        <input id="fatherName" v-model="residentForm.fatherName" />
      </div>
      <div class="field">
        <label for="motherName">Nama ibu</label>
        <input id="motherName" v-model="residentForm.motherName" />
      </div>
      <div class="field">
        <label for="staySince">Mulai tinggal</label>
        <input id="staySince" v-model="residentForm.staySince" type="date" />
      </div>
      <div class="field">
        <label for="residentStatus">Status penduduk</label>
        <select id="residentStatus" v-model="residentForm.residentStatus">
          <option value="tetap">Tetap</option>
          <option value="sementara">Sementara/Musiman</option>
        </select>
      </div>
      <button class="primary-button" type="submit">Tambah Warga</button>
    </form>

    <form class="form-grid" @submit.prevent="submitMutation">
      <div class="field">
        <label for="residentId">Warga</label>
        <select id="residentId" v-model="mutationForm.residentId" required>
          <option value="">Pilih warga</option>
          <option v-for="resident in residents" :key="resident.id" :value="resident.id">
            {{ resident.fullName }} - {{ resident.nik }}
          </option>
        </select>
      </div>
      <div class="field">
        <label for="mutationType">Jenis LAMPID</label>
        <select id="mutationType" v-model="mutationForm.mutationType">
          <option value="lahir">Lahir</option>
          <option value="mati">Meninggal</option>
          <option value="pindah">Pindah</option>
          <option value="datang">Datang</option>
        </select>
      </div>
      <div class="field">
        <label for="mutationDate">Tanggal perubahan</label>
        <input id="mutationDate" v-model="mutationForm.mutationDate" required type="date" />
      </div>
      <div class="field">
        <label for="note">Catatan</label>
        <input id="note" v-model="mutationForm.note" />
      </div>
      <button class="primary-button" type="submit">Catat LAMPID</button>
    </form>

    <div class="section-panel">
      <div class="section-header">
        <strong>Data warga</strong>
        <span class="badge">{{ residents.length }} warga</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>NIK</th>
              <th>Nama</th>
              <th>JK</th>
              <th>TTL</th>
              <th>Hubungan</th>
              <th>Status</th>
              <th>Alamat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="resident in residents" :key="resident.id">
              <td>{{ resident.nik }}</td>
              <td>{{ resident.fullName }}</td>
              <td>{{ resident.gender }}</td>
              <td>{{ resident.birthPlace }}, {{ resident.birthDate }}</td>
              <td>{{ resident.familyRelationship }}</td>
              <td>{{ resident.residentStatus }}</td>
              <td>{{ resident.address }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
