import { ADMIN_PASSWORD } from '../config'

export const canUseHrInsightsBackend = true

async function requestHrApi(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-password': ADMIN_PASSWORD,
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload?.error || 'Không kết nối được HR Insights API.')
  return payload
}

function normalizeEmployee(row) {
  return {
    id: row.id,
    name: row.full_name || '',
    role: row.role || '',
    birthday: row.birthday || null,
    joinedAt: row.joined_at || null,
    hometown: row.hometown || '',
    education: row.education || '',
    interests: row.interests || '',
    analysis: row.analysis || '',
    motivateAction: row.motivate_action || '',
    developAction: row.develop_action || '',
    initials: row.avatar_initials || getInitials(row.full_name),
    avatarBg: row.avatar_theme || 'from-slate-300 via-slate-100 to-teal-100',
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function summarizeList(items = [], fallback = '') {
  const cleanItems = Array.isArray(items)
    ? items.map(item => String(item || '').trim()).filter(Boolean)
    : []
  return cleanItems.slice(0, 2).join(', ') || fallback
}

function normalizeInsight(row) {
  return {
    rememberTags: Array.isArray(row?.remember_tags) ? row.remember_tags : [],
    goals: Array.isArray(row?.goals) ? row.goals : [],
    overview: row?.overview || '',
  }
}

function normalizeNote(row) {
  return {
    id: row.id,
    date: row.note_date || row.created_at || null,
    type: row.note_type || '1-1 định kỳ',
    author: row.author || '',
    points: Array.isArray(row.points) ? row.points : [],
  }
}

export function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'NV'
}

export async function fetchHrEmployees() {
  if (!canUseHrInsightsBackend) return []

  const { employees: employeeRows, insights: insightRows, notes: noteRows } = await requestHrApi('/api/hr-insights')
  const employees = (employeeRows || []).map(normalizeEmployee)
  if (!employees.length) return employees

  const insightByEmployee = new Map((insightRows || []).map(row => [row.employee_id, row]))
  const latestNoteByEmployee = new Map()
  ;(noteRows || []).forEach(row => {
    if (!latestNoteByEmployee.has(row.employee_id)) latestNoteByEmployee.set(row.employee_id, row)
  })

  return employees.map(employee => {
    const insight = insightByEmployee.get(employee.id)
    const latestNote = latestNoteByEmployee.get(employee.id)
    return {
      ...employee,
      rememberSummary: summarizeList(insight?.remember_tags, employee.interests),
      goalsSummary: summarizeList(insight?.goals, employee.analysis),
      latestNoteSummary: summarizeList(latestNote?.points),
      latestOneOnOneDate: latestNote?.note_date || null,
    }
  })
}

export async function fetchHrEmployeeDetail(employeeId) {
  if (!canUseHrInsightsBackend || !employeeId) return null

  const { employee, insight, notes } = await requestHrApi(`/api/hr-insights?employeeId=${encodeURIComponent(employeeId)}`)

  return {
    employee: normalizeEmployee(employee),
    insight: normalizeInsight(insight),
    notes: (notes || []).map(normalizeNote),
  }
}

export async function addHrEmployeeNote(employeeId, note) {
  if (!canUseHrInsightsBackend || !employeeId) return null

  const { note: savedNote } = await requestHrApi('/api/hr-insights-note', {
    method: 'POST',
    body: JSON.stringify({ employeeId, note }),
  })
  return normalizeNote(savedNote)
}

export async function updateHrEmployeeNote(noteId, note) {
  if (!canUseHrInsightsBackend || !noteId) return null

  const { note: savedNote } = await requestHrApi('/api/hr-insights-note', {
    method: 'PATCH',
    body: JSON.stringify({ noteId, note }),
  })
  return normalizeNote(savedNote)
}

export async function deleteHrEmployeeNote(noteId) {
  if (!canUseHrInsightsBackend || !noteId) return

  await requestHrApi(`/api/hr-insights-note?noteId=${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
  })
}

export async function saveHrEmployeeInsight(employeeId, insight) {
  if (!canUseHrInsightsBackend || !employeeId) return null

  const { insight: savedInsight } = await requestHrApi('/api/hr-insights-insight', {
    method: 'PUT',
    body: JSON.stringify({ employeeId, insight }),
  })
  return normalizeInsight(savedInsight)
}
