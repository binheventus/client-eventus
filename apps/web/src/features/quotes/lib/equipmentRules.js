function normalizeCode(value = '') {
  return String(value || '').trim().toUpperCase()
}

function getItemCodes(item = {}) {
  return [
    item.resolved_service_code,
    item.service_code,
    item.service?.service_code,
    item.service?.code,
  ].map(normalizeCode).filter(Boolean)
}

function getRulePrefixes(rule = {}) {
  if (Array.isArray(rule.match_prefix_list)) {
    return rule.match_prefix_list.map(normalizeCode).filter(Boolean)
  }

  return String(rule.match_prefixes || '')
    .split(',')
    .map(normalizeCode)
    .filter(Boolean)
}

function itemMatchesRule(item, rule) {
  const itemCodes = getItemCodes(item)
  const prefixes = getRulePrefixes(rule)

  return itemCodes.some(code => prefixes.some(prefix => code.startsWith(prefix)))
}

export function getMatchedEquipmentRules(items = [], equipmentRules = []) {
  return (equipmentRules || [])
    .filter(rule => rule.is_active !== false)
    .filter(rule => items.some(item => itemMatchesRule(item, rule)))
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
}
