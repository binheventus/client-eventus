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

  return {
    role: stored?.role || stored?.user_role || 'sales',
    userId: stored?.id || stored?.user_id || stored?.uuid || null,
    name: stored?.name || stored?.full_name || stored?.email || '',
  }
}

export function canViewAllQuotes(role) {
  return ['leader', 'admin'].includes(String(role || '').toLowerCase())
}

export function canUseQuoteTrash(role) {
  return ['leader', 'admin'].includes(String(role || '').toLowerCase())
}
