import { requireAdmin } from './_adminAuth.js'
import { getSupabaseAdmin } from './_supabaseAdmin.js'

function handleError(res, error) {
  const status = error?.statusCode || 500
  return res.status(status).json({ error: error?.message || 'Không lưu được HR Insights.' })
}

export default async function handler(req, res) {
  try {
    requireAdmin(req)

    if (req.method !== 'PUT') {
      res.setHeader('Allow', 'PUT')
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const { employeeId, insight } = req.body || {}
    if (!employeeId || !insight) return res.status(400).json({ error: 'Thiếu employeeId hoặc insight.' })

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('hr_employee_insights')
      .upsert({
        employee_id: employeeId,
        remember_tags: Array.isArray(insight.rememberTags) ? insight.rememberTags : [],
        goals: Array.isArray(insight.goals) ? insight.goals : [],
        overview: insight.overview || '',
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) throw error
    return res.status(200).json({ insight: data })
  } catch (error) {
    return handleError(res, error)
  }
}

