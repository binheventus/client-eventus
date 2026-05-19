import { useCallback, useState } from 'react'
import { fromQuoteTable, hasSupabaseConfig } from '../../../lib/supabase'
import {
  buildInitialContractDraft,
  buildQuoteSnapshot,
  canCreateContractFromQuote,
  DEFAULT_CONTRACT_TEMPLATE_ID,
  DEFAULT_CONTRACT_TEMPLATES,
  mergeDefaultContractTemplates,
  normalizeContractTemplate,
  sectionsToTermsText,
} from '../lib/contractDefaults'

const LOCAL_CONTRACTS_KEY = 'eventus_local_contracts'
const LOCAL_CONTRACT_TEMPLATES_KEY = 'eventus_local_contract_templates'

function canUseLocalStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

function readLocalJson(key, fallback) {
  if (!canUseLocalStorage()) return fallback
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || 'null')
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeLocalJson(key, value) {
  if (!canUseLocalStorage()) return
  window.localStorage.setItem(key, JSON.stringify(value))
}

function makeLocalId(prefix = 'contract') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function getLocalTemplates() {
  return mergeDefaultContractTemplates(readLocalJson(LOCAL_CONTRACT_TEMPLATES_KEY, []))
}

function getLocalContracts() {
  const rows = readLocalJson(LOCAL_CONTRACTS_KEY, [])
  return Array.isArray(rows) ? rows : []
}

function saveLocalContracts(rows = []) {
  writeLocalJson(LOCAL_CONTRACTS_KEY, rows)
}

function saveLocalTemplates(rows = []) {
  writeLocalJson(LOCAL_CONTRACT_TEMPLATES_KEY, rows.filter(template => !template.is_system_default))
}

function isSchemaMissing(error) {
  const message = String(error?.message || '').toLowerCase()
  return error?.code === 'PGRST205' ||
    error?.code === '42P01' ||
    message.includes('schema cache') ||
    message.includes('could not find') ||
    message.includes('does not exist') ||
    message.includes('contract_templates') ||
    message.includes('contracts')
}

function shouldFallback(error) {
  const message = String(error?.message || '')
  return Boolean(error?.contractApiUnavailable) ||
    [404, 405, 501].includes(Number(error?.status)) ||
    message.includes('Thieu SUPABASE') ||
    message.includes('Thiếu SUPABASE')
}

function canUseContractApi() {
  return typeof window !== 'undefined' && hasSupabaseConfig
}

async function requestContractApi(path = '', { method = 'GET', body } = {}) {
  const response = await fetch(`/api/contracts${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    const error = new Error('Contract API unavailable.')
    error.contractApiUnavailable = true
    throw error
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload?.error || 'Không gọi được Contract API.')
    error.status = response.status
    error.code = payload?.code
    throw error
  }

  return payload
}

function cleanTemplatePayload(payload = {}) {
  const normalized = normalizeContractTemplate(payload)
  return {
    name: String(payload.name || '').trim(),
    description: String(payload.description || '').trim() || null,
    title: String(payload.title || '').trim() || 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ',
    seller_entity_code: normalized.seller_entity_code,
    party_role_config: normalized.party_role_config,
    contract_number_pattern: normalized.contract_number_pattern,
    preamble: normalized.preamble,
    service_scope: normalized.service_scope,
    schedule_rows: normalized.schedule_rows,
    quote_table_config: normalized.quote_table_config,
    payment_config: normalized.payment_config,
    content_sections: normalized.content_sections,
    terms_text: String(payload.terms_text || sectionsToTermsText(normalized.content_sections)).trim(),
    is_default: Boolean(payload.is_default),
    is_active: payload.is_active !== false,
    sort_order: Number(payload.sort_order || 100),
  }
}

function cleanSellerSnapshot(snapshot = {}) {
  const { email, phone, ...sellerSnapshot } = snapshot || {}
  return sellerSnapshot
}

function cleanContractPayload(payload = {}) {
  const normalized = normalizeContractTemplate(payload)
  return {
    quote_id: payload.quote_id,
    quote_number: payload.quote_number || null,
    contract_number: payload.contract_number,
    status: payload.status || 'draft',
    template_id: payload.template_id || null,
    title: payload.title || 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ',
    seller_entity_code: payload.seller_entity_code || normalized.seller_entity_code || null,
    seller_snapshot: cleanSellerSnapshot(payload.seller_snapshot),
    customer_snapshot: payload.customer_snapshot || {},
    party_role_config: normalized.party_role_config,
    contract_number_pattern: payload.contract_number_pattern || normalized.contract_number_pattern,
    preamble: normalized.preamble,
    service_scope: payload.service_scope || normalized.service_scope,
    schedule_rows: Array.isArray(payload.schedule_rows) ? payload.schedule_rows : normalized.schedule_rows,
    quote_table_config: normalized.quote_table_config,
    payment_config: normalized.payment_config,
    content_sections: normalized.content_sections,
    terms_text: payload.terms_text || sectionsToTermsText(normalized.content_sections),
    quote_snapshot: payload.quote_snapshot || {},
  }
}

function createLocalTemplate(payload = {}) {
  const templates = readLocalJson(LOCAL_CONTRACT_TEMPLATES_KEY, [])
  const cleanPayload = cleanTemplatePayload(payload)
  const now = nowIso()
  const template = {
    ...cleanPayload,
    id: makeLocalId('template'),
    created_at: now,
    updated_at: now,
  }

  const nextTemplates = cleanPayload.is_default
    ? templates.map(row => ({ ...row, is_default: false }))
    : templates

  saveLocalTemplates([template, ...nextTemplates])
  return template
}

function updateLocalTemplate(id, payload = {}) {
  const templates = readLocalJson(LOCAL_CONTRACT_TEMPLATES_KEY, [])
  const cleanPayload = cleanTemplatePayload(payload)
  let updated = null
  const now = nowIso()

  const nextTemplates = templates.map(template => {
    if (template.id !== id) {
      return cleanPayload.is_default ? { ...template, is_default: false } : template
    }

    updated = {
      ...template,
      ...cleanPayload,
      updated_at: now,
    }
    return updated
  })

  if (!updated) return createLocalTemplate(payload)
  saveLocalTemplates(nextTemplates)
  return updated
}

function deleteLocalTemplate(id) {
  const templates = readLocalJson(LOCAL_CONTRACT_TEMPLATES_KEY, [])
  saveLocalTemplates(templates.filter(template => template.id !== id))
}

function getLocalContractByQuoteId(quoteId) {
  return getLocalContracts().find(contract => contract.quote_id === quoteId) || null
}

function getLocalContractByShareToken(shareToken) {
  return getLocalContracts().find(contract => contract.quote_snapshot?.share_token === shareToken) || null
}

function saveLocalContract(payload = {}, { quote } = {}) {
  const existing = payload.id
    ? getLocalContracts().find(contract => contract.id === payload.id)
    : getLocalContractByQuoteId(payload.quote_id)

  if (!existing && quote && !canCreateContractFromQuote(quote)) {
    throw new Error('Chỉ báo giá đã lưu hoàn thiện mới được tạo hợp đồng.')
  }

  const contracts = getLocalContracts()
  const now = nowIso()
  const cleanPayload = cleanContractPayload({
    ...payload,
    quote_snapshot: payload.quote_snapshot || buildQuoteSnapshot(quote),
  })
  const contract = {
    ...existing,
    ...cleanPayload,
    id: existing?.id || payload.id || makeLocalId('contract'),
    created_at: existing?.created_at || now,
    updated_at: now,
  }

  const nextContracts = existing
    ? contracts.map(row => (row.id === existing.id ? contract : row))
    : [contract, ...contracts]

  saveLocalContracts(nextContracts)
  return contract
}

function deleteLocalContract({ id, quoteId } = {}) {
  if (!id && !quoteId) return

  saveLocalContracts(getLocalContracts().filter(contract => {
    if (id && contract.id === id) return false
    if (quoteId && contract.quote_id === quoteId) return false
    return true
  }))
}

export async function listContractTemplates() {
  if (!hasSupabaseConfig) return getLocalTemplates()

  if (canUseContractApi()) {
    try {
      const result = await requestContractApi('?resource=templates')
      return mergeDefaultContractTemplates(result.templates || [])
    } catch (error) {
      if (!shouldFallback(error) && !isSchemaMissing(error)) throw error
    }
  }

  try {
    const { data, error } = await fromQuoteTable('contractTemplates')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) throw error
    return mergeDefaultContractTemplates(data || [])
  } catch (error) {
    if (!isSchemaMissing(error)) throw error
    return getLocalTemplates()
  }
}

export async function saveContractTemplate(payload = {}) {
  const systemTemplateIds = new Set(DEFAULT_CONTRACT_TEMPLATES.map(template => template.id))
  const isSystemDefault = systemTemplateIds.has(payload.id) || payload.id === DEFAULT_CONTRACT_TEMPLATE_ID || payload.is_system_default
  const cleanPayload = cleanTemplatePayload(payload)
  if (!cleanPayload.name) throw new Error('Tên mẫu hợp đồng là bắt buộc.')
  if (!cleanPayload.terms_text) throw new Error('Nội dung từ ĐIỀU 3 trở đi là bắt buộc.')

  if (!hasSupabaseConfig) {
    return payload.id && !isSystemDefault
      ? updateLocalTemplate(payload.id, cleanPayload)
      : createLocalTemplate(cleanPayload)
  }

  if (canUseContractApi()) {
    try {
      const result = await requestContractApi('', {
        method: 'POST',
        body: {
          resource: 'template',
          template: {
            ...cleanPayload,
            id: !isSystemDefault ? payload.id : undefined,
          },
        },
      })
      return result.template
    } catch (error) {
      if (!shouldFallback(error) && !isSchemaMissing(error)) throw error
    }
  }

  try {
    if (cleanPayload.is_default) {
      await fromQuoteTable('contractTemplates')
        .update({ is_default: false })
        .neq('id', payload.id || '')
    }

    if (payload.id && !isSystemDefault) {
      const { data, error } = await fromQuoteTable('contractTemplates')
        .update({ ...cleanPayload, updated_at: nowIso() })
        .eq('id', payload.id)
        .select()
        .single()

      if (error) throw error
      return data
    }

    const { data, error } = await fromQuoteTable('contractTemplates')
      .insert(cleanPayload)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    if (!isSchemaMissing(error)) throw error
    return payload.id && !isSystemDefault
      ? updateLocalTemplate(payload.id, cleanPayload)
      : createLocalTemplate(cleanPayload)
  }
}

export async function deleteContractTemplate(id) {
  const systemTemplateIds = new Set(DEFAULT_CONTRACT_TEMPLATES.map(template => template.id))
  if (!id || systemTemplateIds.has(id)) return

  if (!hasSupabaseConfig) {
    deleteLocalTemplate(id)
    return
  }

  if (canUseContractApi()) {
    try {
      await requestContractApi(`?resource=template&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      return
    } catch (error) {
      if (!shouldFallback(error) && !isSchemaMissing(error)) throw error
    }
  }

  try {
    const { error } = await fromQuoteTable('contractTemplates')
      .delete()
      .eq('id', id)
    if (error) throw error
  } catch (error) {
    if (!isSchemaMissing(error)) throw error
    deleteLocalTemplate(id)
  }
}

export async function getContractByQuoteId(quoteId) {
  if (!quoteId) return null
  if (!hasSupabaseConfig) return getLocalContractByQuoteId(quoteId)

  if (canUseContractApi()) {
    try {
      const result = await requestContractApi(`?resource=contract&quote_id=${encodeURIComponent(quoteId)}`)
      return result.contract || null
    } catch (error) {
      if (!shouldFallback(error) && !isSchemaMissing(error) && Number(error?.status) !== 404) throw error
    }
  }

  try {
    const { data, error } = await fromQuoteTable('contracts')
      .select('*')
      .eq('quote_id', quoteId)
      .maybeSingle()

    if (error) throw error
    return data || null
  } catch (error) {
    if (!isSchemaMissing(error)) throw error
    return getLocalContractByQuoteId(quoteId)
  }
}

export async function getPublicContractByToken(shareToken) {
  if (!shareToken) return null
  if (!hasSupabaseConfig) return getLocalContractByShareToken(shareToken)

  if (canUseContractApi()) {
    try {
      const result = await requestContractApi(`?resource=public_contract&token=${encodeURIComponent(shareToken)}`)
      return result.contract || null
    } catch (error) {
      if (!shouldFallback(error) && !isSchemaMissing(error) && Number(error?.status) !== 404) throw error
    }
  }

  return getLocalContractByShareToken(shareToken)
}

export async function saveContract(payload = {}, { quote } = {}) {
  if (!payload.quote_id) throw new Error('Thiếu quote id để tạo hợp đồng.')
  if (!payload.contract_number) throw new Error('Thiếu số hợp đồng.')
  if (!payload.title) throw new Error('Thiếu tiêu đề hợp đồng.')
  if (!payload.terms_text) throw new Error('Thiếu nội dung điều khoản hợp đồng.')

  const existing = payload.id ? payload : await getContractByQuoteId(payload.quote_id)
  if (!existing && quote && !canCreateContractFromQuote(quote)) {
    throw new Error('Chỉ báo giá đã lưu hoàn thiện mới được tạo hợp đồng.')
  }

  const cleanPayload = cleanContractPayload({
    ...payload,
    quote_snapshot: buildQuoteSnapshot(quote || payload.quote_snapshot),
  })

  if (!hasSupabaseConfig) return saveLocalContract({ ...payload, ...cleanPayload }, { quote })

  if (canUseContractApi()) {
    try {
      const result = await requestContractApi('', {
        method: 'POST',
        body: {
          resource: 'contract',
          contract: {
            ...cleanPayload,
            id: payload.id || undefined,
          },
        },
      })
      return result.contract
    } catch (error) {
      if (!shouldFallback(error) && !isSchemaMissing(error)) throw error
    }
  }

  try {
    const stored = await getContractByQuoteId(cleanPayload.quote_id)
    if (stored?.id) {
      const { data, error } = await fromQuoteTable('contracts')
        .update({ ...cleanPayload, updated_at: nowIso() })
        .eq('id', stored.id)
        .select()
        .single()

      if (error) throw error
      return data
    }

    const { data, error } = await fromQuoteTable('contracts')
      .insert(cleanPayload)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    if (!isSchemaMissing(error)) throw error
    return saveLocalContract({ ...payload, ...cleanPayload }, { quote })
  }
}

export async function deleteContract({ id, quoteId } = {}) {
  if (!id && !quoteId) throw new Error('Thiếu hợp đồng để xoá.')

  if (!hasSupabaseConfig) {
    deleteLocalContract({ id, quoteId })
    return
  }

  const queryParams = new URLSearchParams({ resource: 'contract' })
  if (id) queryParams.set('id', id)
  if (quoteId) queryParams.set('quote_id', quoteId)

  if (canUseContractApi()) {
    try {
      await requestContractApi(`?${queryParams.toString()}`, { method: 'DELETE' })
      return
    } catch (error) {
      if (!shouldFallback(error) && !isSchemaMissing(error)) throw error
    }
  }

  try {
    let query = fromQuoteTable('contracts').delete()
    query = id ? query.eq('id', id) : query.eq('quote_id', quoteId)
    const { error } = await query
    if (error) throw error
  } catch (error) {
    if (!isSchemaMissing(error)) throw error
    deleteLocalContract({ id, quoteId })
  }
}

export function useContractTemplates() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await listContractTemplates()
      setTemplates(rows)
      return rows
    } catch (err) {
      setError(err?.message || 'Không tải được mẫu hợp đồng.')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { templates, loading, error, load, setTemplates }
}

export function createContractDraftFromQuote(quote = {}, template) {
  return buildInitialContractDraft(quote, template)
}
