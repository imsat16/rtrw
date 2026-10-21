import { addIcon } from '@iconify/vue'

// Register the application's interface icons locally so controls remain legible
// before, or without, a response from Iconify's remote icon service.
const paths: Record<string, string> = {
  menu: 'M4 6h16 M4 12h16 M4 18h16',
  plus: 'M12 5v14 M5 12h14',
  'filter-variant': 'M4 6h16 M7 12h10 M10 18h4',
  'eye-outline':
    'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z M15 12a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  'pencil-outline': 'm15 5 4 4 M3 21l5-1L21 7a2.8 2.8 0 0 0-4-4L4 16z',
  'trash-can-outline': 'M3 6h18 M8 6V3h8v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',
  'clipboard-pulse-outline': 'M9 5H5v16h14V5h-4 M9 3h6v4H9z M7 13h3l2-3 2 6 2-3h2',
  'download-outline': 'M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5',
  'file-excel-outline': 'M14 2H5v20h14V7z M14 2v6h5 M8 12l6 6 M14 12l-6 6',
  'account-outline': 'M16 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0 M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2',
  'account-group-outline':
    'M15 6a3 3 0 1 0-6 0 3 3 0 0 0 6 0 M5 21v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3 M3 9a3 3 0 0 1 3 3 M21 9a3 3 0 0 0-3 3 M1 21v-4a4 4 0 0 1 3-4 M23 21v-4a4 4 0 0 0-3-4',
  'card-account-details-outline':
    'M3 4h18v16H3z M10 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0 M5 17v-1a3 3 0 0 1 6 0v1 M14 9h4 M14 13h4',
  'home-account': 'm3 10 9-7 9 7v11H3z M14 12a2 2 0 1 0-4 0 2 2 0 0 0 4 0 M8 20v-1a4 4 0 0 1 8 0v1',
  'account-clock-outline':
    'M12 6a3 3 0 1 0-6 0 3 3 0 0 0 6 0 M2 21v-4a5 5 0 0 1 5-5h2 M22 16a6 6 0 1 0-12 0 6 6 0 0 0 12 0 M16 13v3l2 1',
  'human-male': 'M15 5a3 3 0 1 0-6 0 3 3 0 0 0 6 0 M7 21v-7a5 5 0 0 1 10 0v7 M12 14v7',
  'human-female': 'M15 5a3 3 0 1 0-6 0 3 3 0 0 0 6 0 M9 10h6l3 8H6z M10 18v4 M14 18v4',
  'information-outline': 'M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0 M12 11v6 M12 7h.01',
  'map-marker-outline':
    'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0 M15 10a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  refresh: 'M20 7a9 9 0 1 0 1 9 M20 2v6h-6',
  'account-search-outline':
    'M13 6a3 3 0 1 0-6 0 3 3 0 0 0 6 0 M3 21v-4a5 5 0 0 1 5-5h2 M20 16a4 4 0 1 0-8 0 4 4 0 0 0 8 0 m-1 3 4 4',
  'shield-check-outline': 'M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z m-4-10 3 3 5-6',
}

for (const [name, path] of Object.entries(paths)) {
  addIcon(`mdi:${name}`, {
    width: 24,
    height: 24,
    body: `<path d="${path}" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>`,
  })
}
