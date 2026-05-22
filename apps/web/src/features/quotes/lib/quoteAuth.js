const FALLBACK_ACTOR_IDS = {
  admin: '00000000-0000-0000-0000-000000000001',
  leader: '00000000-0000-0000-0000-000000000002',
  sales: '00000000-0000-0000-0000-000000000003',
  system: '00000000-0000-0000-0000-000000000000',
}

function compactName(parts = []) {
  return parts.map(part => String(part || '').trim()).filter(Boolean).join(' ')
}

export function normalizeQuoteUserContext(user = {}, fallback = {}) {
  const role = user?.role || user?.user_role || fallback?.role || 'sales'
  const userId = user?.id || user?.user_id || user?.uuid || fallback?.userId || null
  const name = (
    user?.name ||
    user?.full_name ||
    user?.display_name ||
    user?.username ||
    compactName([user?.first_name, user?.last_name]) ||
    user?.email ||
    fallback?.name ||
    ''
  )

  return { role, userId, name }
}

export function getQuoteUserContext() {
  if (typeof window === 'undefined') {
    return { role: 'sales', userId: null, name: '' }
  }

  let isAdmin = false
  try {
    isAdmin = window.localStorage.getItem('eventus_admin') === '1'
  } catch {
    isAdmin = false
  }
  if (isAdmin) return { role: 'admin', userId: null, name: 'Admin' }

  const stored = [
    'eventus_user',
    'current_user',
    'user',
    'auth_user',
  ].reduce((matched, key) => {
    if (matched) return matched
    try {
      return JSON.parse(window.localStorage.getItem(key) || 'null')
    } catch {
      return null
    }
  }, null)

  return normalizeQuoteUserContext(stored)
}

export function getQuoteActorPayload(userContext = getQuoteUserContext()) {
  const role = String(userContext?.role || 'sales').toLowerCase()
  const fallbackId = FALLBACK_ACTOR_IDS[role] || FALLBACK_ACTOR_IDS.sales
  const fallbackName = role === 'admin' ? 'Admin' : role === 'leader' ? 'Leader' : 'Sales Eventus'
  const actorName = userContext?.name || fallbackName

  return {
    created_by: userContext?.userId || fallbackId,
    created_by_name: actorName,
    sales_name: actorName,
  }
}

export function canUseQuoteTrash(role) {
  return ['leader', 'admin'].includes(String(role || '').toLowerCase())
}
