const EVENTUS_ENTITY_ALIASES = new Set(['EVENTUS', 'EVT'])
const MEDIAMONSTER_ENTITY_ALIASES = new Set(['MEDIAMONSTER', 'MEDIA_MONSTER', 'MMS', 'MMT'])

export function normalizeLegalEntityCode(value = '') {
  const code = String(value || '').trim().toUpperCase()
  if (EVENTUS_ENTITY_ALIASES.has(code)) return 'EVENTUS'
  if (MEDIAMONSTER_ENTITY_ALIASES.has(code)) return 'MMT'
  return code
}

export function normalizeDocumentSellerCode(value = '') {
  const code = String(value || '').trim().toUpperCase()
  if (EVENTUS_ENTITY_ALIASES.has(code)) return 'EVT'
  if (MEDIAMONSTER_ENTITY_ALIASES.has(code)) return 'MMT'
  return String(value || '').trim()
}

export function isMediaMonsterEntityCode(value = '') {
  return normalizeLegalEntityCode(value) === 'MMT'
}

export function findLegalEntityByAlias(entityCode = '', legalEntities = []) {
  const normalizedCode = normalizeLegalEntityCode(entityCode)
  return (Array.isArray(legalEntities) ? legalEntities : []).find(row => (
    [row?.entity_code, row?.code, row?.source_entity_code]
      .filter(Boolean)
      .map(normalizeLegalEntityCode)
      .includes(normalizedCode)
  )) || null
}

export function expandEntityCodeFilterValue(value) {
  const values = Array.isArray(value) ? value : [value]
  const expanded = values.flatMap(item => (
    normalizeLegalEntityCode(item) === 'MMT'
      ? ['MMT', 'MEDIAMONSTER', 'MMS']
      : [item]
  ))
  return Array.from(new Set(expanded.filter(item => item !== undefined && item !== null && item !== '')))
}
