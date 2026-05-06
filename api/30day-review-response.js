import { getSupabaseAdmin } from './_supabaseAdmin.js'

function handleError(res, error) {
  const status = error?.statusCode || 500
  return res.status(status).json({ error: error?.message || 'Không xử lý được 30-Day Review.' })
}

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin()

    if (req.method === 'GET') {
      const accessToken = String(req.query.accessToken || '').trim()
      const sdt = String(req.query.sdt || '').trim()

      if (accessToken) {
        const { data, error } = await supabase
          .from('responses')
          .select('*')
          .eq('access_token', accessToken)
          .single()

        if (error) throw error
        return res.status(200).json({ response: data })
      }

      if (sdt) {
        const { data, error } = await supabase
          .from('responses')
          .select('*')
          .eq('sdt', sdt)
          .order('created_at', { ascending: false })
          .limit(1)

        if (error) throw error
        return res.status(200).json({ responses: data || [] })
      }

      return res.status(400).json({ error: 'Thiếu accessToken hoặc sdt.' })
    }

    if (req.method === 'POST') {
      const body = req.body || {}
      const { data, error } = await supabase
        .from('responses')
        .insert({
          access_token: body.access_token,
          ho_ten: body.ho_ten,
          sdt: body.sdt,
          vi_tri: body.vi_tri,
          ngay_gia_nhap: body.ngay_gia_nhap,
          question_version: body.question_version,
          data: body.data || {},
          status: body.status || 'draft',
        })
        .select()
        .single()

      if (error) throw error
      return res.status(200).json({ response: data })
    }

    if (req.method === 'PATCH') {
      const { accessToken, updates } = req.body || {}
      if (!accessToken || !updates) return res.status(400).json({ error: 'Thiếu accessToken hoặc updates.' })

      const allowedUpdates = {}
      if ('data' in updates) allowedUpdates.data = updates.data || {}
      if ('status' in updates) allowedUpdates.status = updates.status
      if ('submitted_at' in updates) allowedUpdates.submitted_at = updates.submitted_at

      const { data, error } = await supabase
        .from('responses')
        .update(allowedUpdates)
        .eq('access_token', accessToken)
        .select()
        .single()

      if (error) throw error
      return res.status(200).json({ response: data })
    }

    res.setHeader('Allow', 'GET, POST, PATCH')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return handleError(res, error)
  }
}

