import ExcelJS from 'exceljs'

const residentRows = [
  {
    id: 'child-1',
    full_name: 'Anak RT 01',
    birth_date: '2019-05-01',
    rt_id: 'rt1',
    resident_status: 'tetap',
  },
  {
    id: 'child-2',
    full_name: 'Remaja RT 02',
    birth_date: '2007-05-01',
    rt_id: 'rt2',
    resident_status: 'sementara',
  },
  {
    id: 'mother',
    full_name: 'Ibu RT 01',
    birth_date: '1990-05-01',
    rt_id: 'rt1',
    resident_status: 'tetap',
  },
].map((row, index) => ({
  ...row,
  rw_id: 'rw1',
  nik: `327300000000000${index}`,
  kk_number: `327301000000000${index}`,
  family_card_id: `family-${index}`,
  gender: 'P',
  birth_place: 'Bandung',
  address: 'Jl. Melati',
  father_name: 'Ayah',
  mother_name: 'Ibu',
  family_relationship: 'Anak',
  has_birth_certificate: true,
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
let residentReads = 0

beforeEach(() => {
  residentReads = 0
  cy.intercept('POST', '**/auth/v1/token*', {
    body: {
      user,
      access_token: token,
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer',
    },
  })
  cy.intercept('GET', '**/auth/v1/user', { body: user })
  cy.intercept('POST', '**/rest/v1/report_exports', { statusCode: 201, body: {} }).as('exportAudit')
  cy.intercept('GET', '**/rest/v1/**', (req) => {
    const url = new URL(req.url)
    const table = url.pathname.split('/').pop() ?? ''
    if (table === 'profiles') {
      req.reply({
        body: {
          id: user.id,
          email: user.email,
          display_name: 'Petugas RW',
          role_id: 'admin',
          master_roles: { code: 'superadmin' },
        },
      })
      return
    }
    if (table === 'residents') residentReads++
    const datasets: Record<string, Array<Record<string, unknown>>> = {
      residents: residentRows,
      family_cards: [],
      resident_mutations: [
        {
          id: 'birth',
          resident_id: 'child-1',
          resident_name: 'Anak RT 01',
          gender: 'P',
          mutation_type: 'lahir',
          mutation_date: '2026-10-01',
          resident_status: 'tetap',
          rt_id: 'rt1',
        },
        {
          id: 'arrival',
          resident_id: 'child-2',
          resident_name: 'Remaja RT 02',
          gender: 'P',
          mutation_type: 'datang',
          mutation_date: '2026-10-01',
          resident_status: 'sementara',
          rt_id: 'rt2',
        },
        {
          id: 'pregnancy',
          resident_id: 'mother',
          resident_name: 'Ibu RT 01',
          gender: 'P',
          mutation_type: 'hamil',
          mutation_date: '2026-10-01',
          resident_status: 'tetap',
          rt_id: 'rt1',
        },
      ],
      master_rws: [{ id: 'rw1', name: '07' }],
      master_rts: [
        { id: 'rt1', name: '01', rw_id: 'rw1' },
        { id: 'rt2', name: '02', rw_id: 'rw1' },
      ],
    }
    let rows = datasets[table] ?? []
    if (url.searchParams.has('rt_id'))
      rows = rows.filter((row) => row.rt_id === url.searchParams.get('rt_id')!.replace(/^eq\./, ''))
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 500)
    req.reply({ body: rows.slice(offset, offset + limit) })
  })
  cy.visit('/login')
  cy.get('#email').type(user.email)
  cy.get('#password').type('test-password')
  cy.get('button[type="submit"]').click()
  cy.location('pathname').should('eq', '/')
  cy.get('.sidebar').contains('a', 'Export Laporan').click()
  cy.get('.report-action').first().contains('button', 'Preview').should('be.enabled')
  cy.get('[aria-label="Filter laporan"]').click()
  cy.get('#month').select('10')
  cy.get('#year').clear()
  cy.get('#year').type('2026')
  cy.contains('button', 'Terapkan').click()
  cy.get('.report-action').first().contains('button', 'Preview').should('be.enabled')
})

function paarediPreview() {
  cy.get('.report-action').first().contains('button', 'Preview').click()
  cy.get('[role="dialog"]').should('contain.text', 'Preview Data Sasaran PAAREDI')
}

describe('report exports and previews (mocked API)', () => {
  it('previews every report and exposes every PAAREDI sheet', () => {
    cy.get('.toolbar button')
      .should('have.length', 2)
      .each((button) => expect(button.text().trim()).to.eq(''))
    cy.get('.report-action').should('have.length', 7)
    for (let index = 0; index < 7; index++) {
      cy.get('.report-action').eq(index).contains('button', 'Preview').click()
      cy.get('[role="dialog"]').should('be.visible')
      cy.get('.report-preview-table tbody tr').should('have.length.greaterThan', 0)
      cy.get('[role="dialog"]').contains('button', 'Tutup').click()
    }
    paarediPreview()
    cy.get('#previewSheet option').should('have.length', 3)
    cy.get('#previewSheet').select('1')
    cy.get('.report-preview-table')
      .should('contain.text', 'Remaja RT 02')
      .and('not.contain.text', 'Anak RT 01')
    cy.get('#previewSheet').select('2')
    cy.get('.report-preview-table thead th').should('have.length', 12)
    cy.get('.report-preview-table').should('contain.text', 'RT 01').and('contain.text', 'RT 02')
    cy.screenshot('paaredi-preview-rekap', { capture: 'viewport' })
  })

  it('filters export and preview to one RT and refreshes data from the endpoint', () => {
    cy.get('[aria-label="Filter laporan"]').click()
    cy.get('#rtFilter').select('rt2')
    cy.contains('button', 'Terapkan').click()
    cy.get('.toolbar').should('contain.text', 'RT 02')
    cy.get('.report-action').first().contains('button', 'Preview').should('be.enabled')
    paarediPreview()
    cy.get('#previewSheet option').should('have.length', 2)
    cy.get('#previewSheet option').first().should('contain.text', 'RT 02')
    cy.get('.report-preview-table')
      .should('contain.text', 'Remaja RT 02')
      .and('not.contain.text', 'Anak RT 01')
    cy.get('[role="dialog"]').contains('button', 'Tutup').click()
    cy.then(() => {
      const before = residentReads
      cy.get('[aria-label="Refresh data"]').click()
      cy.get('.report-action')
        .first()
        .contains('button', 'Preview')
        .should('be.enabled')
        .then(() => expect(residentReads).to.be.greaterThan(before))
    })
  })

  it('downloads an XLSX whose separate RT sheets match the preview', () => {
    paarediPreview()
    cy.get('[role="dialog"]').contains('button', 'Download XLSX').click()
    cy.wait('@exportAudit')
    cy.readFile('cypress/downloads/paaredi-2026-10.xlsx', 'base64').then(async (encoded) => {
      const buffer = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
      const book = new ExcelJS.Workbook()
      await book.xlsx.load(buffer.buffer as Parameters<typeof book.xlsx.load>[0])
      expect(book.worksheets.map((sheet) => sheet.name)).to.deep.eq(['RT 01', 'RT 02', 'Rekap RT'])
      expect(book.getWorksheet('RT 02')!.getCell('C11').value).to.eq('Remaja RT 02')
      expect(book.getWorksheet('RT 01')!.getCell('C11').value).to.eq('Anak RT 01')
    })
  })
})
