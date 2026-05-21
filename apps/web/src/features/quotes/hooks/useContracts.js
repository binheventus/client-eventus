import { useCallback, useState } from 'react'
import { redirectToLoginIfAuthRequired } from '../lib/authRedirect'
import {
  buildInitialContractDraft,
  buildQuoteSnapshot,
  canCreateContractFromQuote,
  DEFAULT_CONTRACT_TEMPLATES,
  mergeDefaultContractTemplates,
  normalizeContractTemplate,
  sectionsToTermsText,
} from '../lib/contractDefaults'

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
    throw new Error('Contract API unavailable.')
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    redirectToLoginIfAuthRequired(response, payload)
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

export async function listContractTemplates() {
  const result = await requestContractApi('?resource=templates')
  return mergeDefaultContractTemplates(result.templates || [])
}

export async function saveContractTemplate(payload = {}) {
  const cleanPayload = cleanTemplatePayload(payload)
  const protectedTemplateIds = new Set(DEFAULT_CONTRACT_TEMPLATES.map(template => template.id))
  const isProtectedTemplate = protectedTemplateIds.has(payload.id) || payload.is_system_default
  if (isProtectedTemplate) cleanPayload.is_default = false

  if (!cleanPayload.name) throw new Error('Tên mẫu hợp đồng là bắt buộc.')
  if (!cleanPayload.terms_text) throw new Error('Nội dung từ ĐIỀU 3 trở đi là bắt buộc.')

  const result = await requestContractApi('', {
    method: 'POST',
    body: {
      resource: 'template',
      template: {
        ...cleanPayload,
        id: payload.id || undefined,
      },
    },
  })
  return result.template
}

export async function deleteContractTemplate(id) {
  const systemTemplateIds = new Set(DEFAULT_CONTRACT_TEMPLATES.map(template => template.id))
  if (!id || systemTemplateIds.has(id)) return
  await requestContractApi(`?resource=template&id=${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function getContractByQuoteId(quoteId) {
  if (!quoteId) return null
  const result = await requestContractApi(`?resource=contract&quote_id=${encodeURIComponent(quoteId)}`)
  return result.contract || null
}

export async function getPublicContractByToken(shareToken) {
  if (!shareToken) return null
  const result = await requestContractApi(`?resource=public_contract&token=${encodeURIComponent(shareToken)}`)
  return result.contract || null
}

export async function listSharedCustomers(search = '') {
  const query = new URLSearchParams({ resource: 'customers' })
  if (search) query.set('search', search)
  const result = await requestContractApi(`?${query.toString()}`)
  return result.customers || []
}

export async function getSharedCustomerByCode(customerCode = '') {
  const code = String(customerCode || '').trim()
  if (!code) return null
  const query = new URLSearchParams({ resource: 'customer', customer_code: code })
  const result = await requestContractApi(`?${query.toString()}`)
  return result.customer || null
}

export async function createSharedCustomer(payload = {}) {
  const result = await requestContractApi('', {
    method: 'POST',
    body: {
      resource: 'customer',
      customer: payload,
    },
  })
  return result.customer || null
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
}

export async function deleteContract({ id, quoteId } = {}) {
  if (!id && !quoteId) throw new Error('Thiếu hợp đồng để xoá.')

  const queryParams = new URLSearchParams({ resource: 'contract' })
  if (id) queryParams.set('id', id)
  if (quoteId) queryParams.set('quote_id', quoteId)
  await requestContractApi(`?${queryParams.toString()}`, { method: 'DELETE' })
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
