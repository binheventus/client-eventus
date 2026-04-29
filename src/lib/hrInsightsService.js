import { hasSupabaseConfig, supabase } from './supabase'

export const canUseHrInsightsBackend = hasSupabaseConfig && Boolean(supabase)

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

  const { data, error } = await supabase
    .from('hr_employees')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeEmployee)
}

export async function fetchHrEmployeeDetail(employeeId) {
  if (!canUseHrInsightsBackend || !employeeId) return null

  const [{ data: employee, error: employeeError }, { data: insight, error: insightError }, { data: notes, error: notesError }] = await Promise.all([
    supabase.from('hr_employees').select('*').eq('id', employeeId).single(),
    supabase.from('hr_employee_insights').select('*').eq('employee_id', employeeId).maybeSingle(),
    supabase.from('hr_employee_notes').select('*').eq('employee_id', employeeId).order('note_date', { ascending: false }),
  ])

  if (employeeError) throw employeeError
  if (insightError) throw insightError
  if (notesError) throw notesError

  return {
    employee: normalizeEmployee(employee),
    insight: normalizeInsight(insight),
    notes: (notes || []).map(normalizeNote),
  }
}

export async function addHrEmployeeNote(employeeId, note) {
  if (!canUseHrInsightsBackend || !employeeId) return null

  const { data, error } = await supabase
    .from('hr_employee_notes')
    .insert({
      employee_id: employeeId,
      note_date: note.date,
      note_type: note.type,
      author: note.author,
      points: note.points,
    })
    .select()
    .single()

  if (error) throw error
  return normalizeNote(data)
}

export async function updateHrEmployeeNote(noteId, note) {
  if (!canUseHrInsightsBackend || !noteId) return null

  const { data, error } = await supabase
    .from('hr_employee_notes')
    .update({
      note_date: note.date,
      note_type: note.type,
      points: note.points,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
    .select()
    .single()

  if (error) throw error
  return normalizeNote(data)
}

export async function deleteHrEmployeeNote(noteId) {
  if (!canUseHrInsightsBackend || !noteId) return

  const { error } = await supabase
    .from('hr_employee_notes')
    .delete()
    .eq('id', noteId)

  if (error) throw error
}

export async function saveHrEmployeeInsight(employeeId, insight) {
  if (!canUseHrInsightsBackend || !employeeId) return null

  const { data, error } = await supabase
    .from('hr_employee_insights')
    .upsert({
      employee_id: employeeId,
      remember_tags: insight.rememberTags,
      goals: insight.goals,
      overview: insight.overview,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return normalizeInsight(data)
}
