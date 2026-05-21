export function redirectToLoginIfAuthRequired(response, payload = {}) {
  if (response?.status !== 401 || payload?.code !== 'AUTH_REQUIRED' || !payload?.login_url) return false
  if (typeof window === 'undefined') return false

  window.location.assign(payload.login_url)
  return true
}
