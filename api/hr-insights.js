import { requireAdmin } from './_adminAuth.js'
import { getSupabaseAdmin } from './_supabaseAdmin.js'

function handleError(res, error) {
  const status = error?.statusCode || 500
  return res.status(status).json({ error: error?.message || 'Không xử lý được HR Insights.' })
}

export default async function handler(req, res) {
  try {
    requireAdmin(req)

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const supabase = getSupabaseAdmin()
    const employeeId = String(req.query.employeeId || '').trim()

    if (employeeId) {
      const [{ data: employee, error: employeeError }, { data: insight, error: insightError }, { data: notes, error: notesError }] = await Promise.all([
        supabase.from('hr_employees').select('*').eq('id', employeeId).single(),
        supabase.from('hr_employee_insights').select('*').eq('employee_id', employeeId).maybeSingle(),
        supabase.from('hr_employee_notes').select('*').eq('employee_id', employeeId).order('note_date', { ascending: false }),
      ])

      if (employeeError) throw employeeError
      if (insightError) throw insightError
      if (notesError) throw notesError

      return res.status(200).json({ employee, insight, notes: notes || [] })
    }

    const { data: employees, error } = await supabase
      .from('hr_employees')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) throw error
    const employeeIds = (employees || []).map(item => item.id)

    if (!employeeIds.length) {
      return res.status(200).json({ employees: [], insights: [], notes: [] })
    }

    const [{ data: insights, error: insightError }, { data: notes, error: noteError }] = await Promise.all([
      supabase
        .from('hr_employee_insights')
        .select('employee_id, remember_tags, goals')
        .in('employee_id', employeeIds),
      supabase
        .from('hr_employee_notes')
        .select('employee_id, note_date, note_type, points')
        .in('employee_id', employeeIds)
        .order('note_date', { ascending: false }),
    ])

    if (insightError) throw insightError
    if (noteError) throw noteError

    return res.status(200).json({ employees, insights: insights || [], notes: notes || [] })
  } catch (error) {
    return handleError(res, error)
  }
}

