import { query, tables } from './lib/mysql.js'

function sendError(res, error, fallback = 'Khong xu ly duoc noi dung client portal.') {
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

async function listPages() {
  return query(`select * from ${tables.pages} order by category asc, title asc`)
}

async function upsertPage(page = {}) {
  const id = page.id || null
  const category = String(page.category || '').trim()
  const title = String(page.title || '').trim()
  const content = page.content ?? ''

  if (!category || !title) {
    const error = new Error('Thieu category hoac title.')
    error.statusCode = 400
    throw error
  }

  if (id) {
    await query(
      `update ${tables.pages}
       set category = ?, title = ?, content = ?, updated_at = current_timestamp(3)
       where id = ?`,
      [category, title, content, id],
    )
    const rows = await query(`select * from ${tables.pages} where id = ? limit 1`, [id])
    return rows?.[0] || null
  }

  await query(
    `insert into ${tables.pages} (category, title, content)
     values (?, ?, ?)
     on duplicate key update content = values(content), updated_at = current_timestamp(3)`,
    [category, title, content],
  )
  const rows = await query(
    `select * from ${tables.pages} where category = ? and title = ? limit 1`,
    [category, title],
  )
  return rows?.[0] || null
}

async function deletePage(id) {
  if (!id) {
    const error = new Error('Thieu page id.')
    error.statusCode = 400
    throw error
  }
  await query(`delete from ${tables.pages} where id = ?`, [id])
  return { ok: true }
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ pages: await listPages() })
    }

    if (req.method === 'POST' || req.method === 'PATCH') {
      const body = getRequestBody(req)
      return res.status(200).json({ page: await upsertPage(body.page || body) })
    }

    if (req.method === 'DELETE') {
      const id = getQueryValue(req.query?.id, '')
      return res.status(200).json(await deletePage(id))
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    return sendError(res, error)
  }
}
