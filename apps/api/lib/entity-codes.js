const EVENTUS_ALIASES = new Set(['EVENTUS', 'EVT', 'EVENTUS VIET NAM', 'CONG TY TNHH EVENTUS VIET NAM'])
const MEDIAMONSTER_ALIASES = new Set(['MEDIAMONSTER', 'MEDIA_MONSTER', 'MMS', 'MMT'])

function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase()
}

export function normalizeQuoteEntityCode(value, fallback = 'EVT') {
  const code = normalizeCode(value || fallback)
  if (EVENTUS_ALIASES.has(code)) return 'EVT'
  if (MEDIAMONSTER_ALIASES.has(code)) return 'MMT'
  return code || fallback
}

export function normalizeDocumentSellerEntityCode(value = '') {
  const code = normalizeCode(value)
  if (EVENTUS_ALIASES.has(code)) return 'EVT'
  if (MEDIAMONSTER_ALIASES.has(code)) return 'MMT'
  return String(value || '').trim()
}

export function expandQuoteEntityFilterValues(values = []) {
  const expanded = values.flatMap(value => (
    normalizeQuoteEntityCode(value) === 'MMT'
      ? ['MMT', 'MEDIAMONSTER', 'MMS']
      : normalizeQuoteEntityCode(value) === 'EVT'
        ? ['EVT', 'EVENTUS']
        : [value]
  ))
  return Array.from(new Set(expanded.filter(Boolean)))
}
