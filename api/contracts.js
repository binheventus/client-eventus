import { createClient } from '@supabase/supabase-js'

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Thieu SUPABASE_URL hoac SUPABASE_SERVICE_ROLE_KEY tren Vercel.')
    error.statusCode = 501
    throw error
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function sendError(res, error, fallback = 'Khong xu ly duoc hop dong.') {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    error: error?.message || fallback,
    code: error?.code,
  })
}

function getRequestBody(req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return req.body
}

function getQueryValue(value, fallback = '') {
  if (Array.isArray(value)) return value[0] ?? fallback
  return value ?? fallback
}

function nowIso() {
  return new Date().toISOString()
}

async function getQuoteById(supabase, id) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

async function getQuoteByShareToken(supabase, shareToken) {
  const { data, error } = await supabase
    .from('quotes')
    .select('id, deleted_at')
    .eq('share_token', shareToken)
    .maybeSingle()

  if (error) throw error
  if (!data || data.deleted_at) return null
  return data
}

async function listTemplates(supabase) {
  const { data, error } = await supabase
    .from('contract_templates')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

async function saveTemplate(supabase, template = {}) {
  const payload = {
    name: String(template.name || '').trim(),
    description: String(template.description || '').trim() || null,
    title: String(template.title || '').trim() || 'HOP DONG CUNG CAP DICH VU',
    seller_entity_code: template.seller_entity_code || template.entity_code || null,
    party_role_config: template.party_role_config || {},
    contract_number_pattern: template.contract_number_pattern || 'HD-{{quote_code}}',
    preamble: Array.isArray(template.preamble) ? template.preamble : [],
    service_scope: template.service_scope || '',
    schedule_rows: Array.isArray(template.schedule_rows) ? template.schedule_rows : [],
    quote_table_config: template.quote_table_config || {},
    payment_config: template.payment_config || {},
    content_sections: Array.isArray(template.content_sections) ? template.content_sections : [],
    terms_text: String(template.terms_text || '').trim(),
    is_default: Boolean(template.is_default),
    is_active: template.is_active !== false,
    sort_order: Number(template.sort_order || 100),
  }

  if (!payload.name) {
    const error = new Error('Thieu ten mau hop dong.')
    error.statusCode = 400
    throw error
  }

  if (!payload.terms_text) {
    const error = new Error('Thieu noi dung dieu khoan hop dong.')
    error.statusCode = 400
    throw error
  }

  if (payload.is_default) {
    let query = supabase.from('contract_templates').update({ is_default: false })
    if (template.id) query = query.neq('id', template.id)
    const { error } = await query
    if (error) throw error
  }

  if (template.id) {
    const { data, error } = await supabase
      .from('contract_templates')
      .update({ ...payload, updated_at: nowIso() })
      .eq('id', template.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('contract_templates')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

async function deleteTemplate(supabase, id) {
  const { error } = await supabase
    .from('contract_templates')
    .delete()
    .eq('id', id)

  if (error) throw error
  return { ok: true }
}

async function deleteContract(supabase, { id, quoteId } = {}) {
  if (!id && !quoteId) {
    const error = new Error('Thieu contract id hoac quote id.')
    error.statusCode = 400
    throw error
  }

  let query = supabase.from('contracts').delete()
  query = id ? query.eq('id', id) : query.eq('quote_id', quoteId)

  const { error } = await query
  if (error) throw error
  return { ok: true }
}

async function getContractByQuoteId(supabase, quoteId) {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('quote_id', quoteId)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function getPublicContractByToken(supabase, shareToken) {
  const quote = await getQuoteByShareToken(supabase, shareToken)
  if (!quote?.id) return null
  return getContractByQuoteId(supabase, quote.id)
}

function cleanContractPayload(contract = {}) {
  const { email, phone, ...sellerSnapshot } = contract.seller_snapshot || {}

  return {
    quote_id: contract.quote_id,
    quote_number: contract.quote_number || null,
    contract_number: contract.contract_number,
    status: contract.status || 'draft',
    template_id: contract.template_id || null,
    title: contract.title || 'HOP DONG CUNG CAP DICH VU',
    seller_entity_code: contract.seller_entity_code || null,
    seller_snapshot: sellerSnapshot,
    customer_snapshot: contract.customer_snapshot || {},
    party_role_config: contract.party_role_config || {},
    contract_number_pattern: contract.contract_number_pattern || 'HD-{{quote_code}}',
    preamble: Array.isArray(contract.preamble) ? contract.preamble : [],
    service_scope: contract.service_scope || '',
    schedule_rows: Array.isArray(contract.schedule_rows) ? contract.schedule_rows : [],
    quote_table_config: contract.quote_table_config || {},
    payment_config: contract.payment_config || {},
    content_sections: Array.isArray(contract.content_sections) ? contract.content_sections : [],
    terms_text: contract.terms_text || '',
    quote_snapshot: contract.quote_snapshot || {},
  }
}

async function saveContract(supabase, contract = {}) {
  const payload = cleanContractPayload(contract)
  if (!payload.quote_id) {
    const error = new Error('Thieu quote id.')
    error.statusCode = 400
    throw error
  }

  if (!payload.contract_number || !payload.terms_text) {
    const error = new Error('Thieu so hop dong hoac noi dung hop dong.')
    error.statusCode = 400
    throw error
  }

  const existing = await getContractByQuoteId(supabase, payload.quote_id)
  if (!existing) {
    const quote = await getQuoteById(supabase, payload.quote_id)
    if (String(quote.status || 'draft').toLowerCase() === 'draft') {
      const error = new Error('Chi bao gia da luu hoan thien moi duoc tao hop dong.')
      error.statusCode = 400
      throw error
    }
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from('contracts')
      .update({ ...payload, updated_at: nowIso() })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) throw error
    return data
  }

  const { data, error } = await supabase
    .from('contracts')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

export default async function handler(req, res) {
  let supabase
  try {
    supabase = getSupabaseAdminClient()
  } catch (error) {
    return sendError(res, error, 'Thieu cau hinh Supabase.')
  }

  try {
    if (req.method === 'GET') {
      const resource = getQueryValue(req.query?.resource, 'templates')
      if (resource === 'templates') {
        return res.status(200).json({ templates: await listTemplates(supabase) })
      }

      if (resource === 'contract') {
        const quoteId = getQueryValue(req.query?.quote_id, '')
        if (!quoteId) return res.status(400).json({ error: 'Thieu quote id.' })
        return res.status(200).json({ contract: await getContractByQuoteId(supabase, quoteId) })
      }

      if (resource === 'public_contract') {
        const token = getQueryValue(req.query?.token || req.query?.share_token, '')
        if (!token) return res.status(400).json({ error: 'Thieu share token.' })
        return res.status(200).json({ contract: await getPublicContractByToken(supabase, token) })
      }

      return res.status(400).json({ error: 'Resource khong hop le.' })
    }

    if (req.method === 'POST') {
      const body = getRequestBody(req)
      if (body.resource === 'template') {
        return res.status(200).json({ template: await saveTemplate(supabase, body.template || {}) })
      }

      if (body.resource === 'contract') {
        return res.status(200).json({ contract: await saveContract(supabase, body.contract || {}) })
      }

      return res.status(400).json({ error: 'Resource khong hop le.' })
    }

    if (req.method === 'DELETE') {
      const resource = getQueryValue(req.query?.resource, '')
      const id = getQueryValue(req.query?.id, '')
      if (resource === 'template') {
        if (!id) return res.status(400).json({ error: 'Thieu template id.' })
        return res.status(200).json(await deleteTemplate(supabase, id))
      }

      if (resource === 'contract') {
        const quoteId = getQueryValue(req.query?.quote_id, '')
        return res.status(200).json(await deleteContract(supabase, { id, quoteId }))
      }

      return res.status(400).json({ error: 'Resource khong hop le.' })
    }

    res.setHeader('Allow', 'GET, POST, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
