import { requireAdmin } from './_adminAuth.js'
import { getSupabaseAdmin } from './_supabaseAdmin.js'

function handleError(res, error) {
  const status = error?.statusCode || 500
  return res.status(status).json({ error: error?.message || 'Không xử lý được ghi chú HR Insights.' })
}

export default async function handler(req, res) {
  try {
    requireAdmin(req)

    const supabase = getSupabaseAdmin()

    if (req.method === 'POST') {
      const { employeeId, note } = req.body || {}
      if (!employeeId || !note) return res.status(400).json({ error: 'Thiếu employeeId hoặc note.' })

      const { data, error } = await supabase
        .from('hr_employee_notes')
        .insert({
          employee_id: employeeId,
          note_date: note.date,
          note_type: note.type || '1-1 định kỳ',
          author: note.author || '',
          points: Array.isArray(note.points) ? note.points : [],
        })
        .select()
        .single()

      if (error) throw error
      return res.status(200).json({ note: data })
    }

    if (req.method === 'PATCH') {
      const { noteId, note } = req.body || {}
      if (!noteId || !note) return res.status(400).json({ error: 'Thiếu noteId hoặc note.' })

      const { data, error } = await supabase
        .from('hr_employee_notes')
        .update({
          note_date: note.date,
          note_type: note.type || '1-1 định kỳ',
          points: Array.isArray(note.points) ? note.points : [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', noteId)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json({ note: data })
    }

    if (req.method === 'DELETE') {
      const noteId = String(req.query.noteId || '').trim()
      if (!noteId) return res.status(400).json({ error: 'Thiếu noteId.' })

      const { error } = await supabase
        .from('hr_employee_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error
      return res.status(200).json({ ok: true })
    }

    res.setHeader('Allow', 'POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return handleError(res, error)
  }
}

