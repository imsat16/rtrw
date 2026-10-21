const residents = Array.from({ length: 36 }, (_, index) => ({
  id: `resident-${index}`,
  family_card_id: `family-${index}`,
  kk_number: `327300000000${String(index).padStart(4, '0')}`,
  nik: `327301000000${String(index).padStart(4, '0')}`,
  full_name: index === 2 ? '[object Object]' : `Warga ${String(index + 1).padStart(3, '0')}`,
  gender: 'L',
  birth_place: 'Bandung',
  birth_date: '1990-01-01',
  family_relationship: 'Kepala Keluarga',
  resident_status: 'tetap',
  address: 'Jl. Melati No. 12',
  rw_id: 'rw-07',
  rt_id: 'rt-04',
}))
const families = residents.map((row, index) => ({
  id: row.family_card_id,
  kk_number: row.kk_number,
  head_name: `Kepala keluarga ${index + 1}`,
  address: row.address,
  rw_id: row.rw_id,
  rt_id: row.rt_id,
  residents: [{ nik: row.nik }],
}))
const user = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'petugas@example.test',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: new Date().toISOString(),
}
const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }))}.test-signature`

let requests: string[]
let searchRequests: string[]
beforeEach(() => {
  requests = []
  searchRequests = []
  cy.intercept('POST', '**/auth/v1/token*', {
    delay: 500,
    body: {
      user,
      access_token: token,
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      token_type: 'bearer',
    },
  }).as('login')
  cy.intercept('GET', '**/auth/v1/user', { body: user })
  cy.intercept('GET', '**/rest/v1/**', (req) => {
    const url = new URL(req.url)
    const table = url.pathname.split('/').pop()
    requests.push(table ?? '')
    if (table === 'profiles') {
      req.reply({
        body: {
          id: user.id,
          email: user.email,
          display_name: 'Petugas RW',
          role_id: 'role-admin',
          master_roles: { code: 'superadmin' },
        },
      })
      return
    }
    const datasets: Record<string, object[]> = {
      residents,
      family_cards: families,
      master_rws: [{ id: 'rw-07', name: '07', village_id: 'village' }],
      master_rts: [{ id: 'rt-04', name: '04', rw_id: 'rw-07' }],
    }
    let data = datasets[table ?? ''] ?? []
    const limit = Number(url.searchParams.get('limit') ?? 500)
    const offset = Number(url.searchParams.get('offset') ?? 0)
    if (url.searchParams.has('or')) {
      searchRequests.push(url.searchParams.get('or')!)
      if (url.searchParams.get('or')!.includes('TidakAda')) data = []
    }
    if (table === 'residents' && limit <= 50) req.alias = 'residentPage'
    req.reply({
      body: data.slice(offset, offset + limit),
      headers: {
        'Content-Range': data.length
          ? `${offset}-${Math.min(offset + limit, data.length) - 1}/${data.length}`
          : '*/0',
      },
    })
  })
  cy.visit('/login')
  cy.get('#email').type(user.email)
  cy.get('#password').type('password-test')
  cy.get('button[type="submit"]').click()
})

function openResidents() {
  cy.location('pathname').should('eq', '/')
  cy.get('.sidebar').contains('a', 'Data Warga').click()
  cy.wait('@residentPage')
  cy.get('.data-list-panel tbody tr').should('have.length', 10)
}

describe('paginated lists and login feedback (mocked API)', () => {
  it('shows immediate login feedback and prevents duplicate submissions', () => {
    cy.contains('button', 'Sedang masuk').should('be.disabled')
    cy.get('form').trigger('submit')
    cy.location('pathname').should('eq', '/')
    cy.get('@login.all').should('have.length', 1)
    cy.then(() => expect(requests.filter((table) => table === 'profiles')).to.have.length(1))
  })

  it('uses endpoint limits, caches visited pages and reuses metadata across views', () => {
    openResidents()
    cy.contains('Nama perlu diperbaiki').should('be.visible')
    cy.get('[aria-label="Halaman berikutnya"]').click()
    cy.wait('@residentPage').its('request.url').should('include', 'limit=10')
    cy.contains('Halaman 2 dari 4').should('be.visible')
    cy.then(() => {
      const count = requests.filter((table) => table === 'residents').length
      cy.get('[aria-label="Halaman sebelumnya"]').click()
      cy.contains('Halaman 1 dari 4')
        .should('be.visible')
        .then(() => expect(requests.filter((table) => table === 'residents')).to.have.length(count))
    })
    cy.get('[aria-label="Data per halaman"]').select('25')
    cy.get('.data-list-panel tbody tr').should('have.length', 25)
    cy.get('[aria-label="Halaman berikutnya"]').click()
    cy.get('.data-list-panel tbody tr').should('have.length', 11)
    cy.contains('Halaman 2 dari 2').should('be.visible')
    cy.get('[aria-label="Data per halaman"]').select('50')
    cy.get('.data-list-panel tbody tr').should('have.length', 36)
    cy.contains('Halaman 1 dari 1').should('be.visible')
    cy.get('.sidebar').contains('a', 'Kartu Keluarga').click()
    cy.get('.data-list-panel tbody tr').should('have.length', 10)
    cy.get('.sidebar').contains('a', 'Data Warga').click()
    cy.get('.data-list-panel tbody tr').should('have.length', 10)
    cy.then(() => expect(requests.filter((table) => table === 'master_rws')).to.have.length(1))
    cy.screenshot('warga-desktop', { capture: 'viewport' })
  })

  it('shows search directly and sends one request after typing, including empty results', () => {
    openResidents()
    cy.get('#residentSearch').should('be.visible').type('Warga', { delay: 20 })
    cy.wait('@residentPage')
    cy.then(() => expect(searchRequests).to.have.length(1))
    cy.get('#residentSearch').clear()
    cy.get('#residentSearch').type('TidakAda', { delay: 20 })
    cy.contains('Data warga tidak ditemukan.').should('be.visible')
    cy.contains('0 data').should('be.visible')
    cy.then(() => expect(searchRequests).to.have.length(2))
  })

  it('keeps filters and pagination usable on mobile', () => {
    openResidents()
    cy.viewport(390, 844)
    cy.get('#residentSearch').should('be.visible')
    cy.get('#residentRw').should('be.visible')
    cy.get('[aria-label="Halaman berikutnya"]').should('be.visible')
    cy.document().then((doc) => expect(doc.documentElement.scrollWidth).to.be.at.most(390))
    cy.screenshot('warga-mobile', { capture: 'viewport' })
  })
})
