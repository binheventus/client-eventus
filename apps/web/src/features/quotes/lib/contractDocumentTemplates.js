export const CONTRACT_DOCUMENT_TEMPLATE_SNAPSHOT_RULE = 'Chứng từ đã tạo lưu template_snapshot riêng, nên thay đổi mẫu form không ảnh hưởng chứng từ cũ.'

export const CONTRACT_DOCUMENT_TYPES = {
  advance_request: {
    label: 'Đề nghị tạm ứng',
    actionLabel: 'Tạo đề nghị tạm ứng',
    defaultTitle: 'Đề nghị tạm ứng',
    code: 'DNTU',
  },
  acceptance_liquidation: {
    label: 'BBNT kiêm thanh lý',
    actionLabel: 'Tạo BBNT kiêm thanh lý',
    defaultTitle: 'Biên bản nghiệm thu kiêm thanh lý',
    code: 'BBNTTL',
  },
  payment_request: {
    label: 'Đề nghị thanh toán',
    actionLabel: 'Tạo đề nghị thanh toán',
    defaultTitle: 'Đề nghị thanh toán',
    code: 'DNTT',
  },
}

export const CONTRACT_DOCUMENT_TYPE_ORDER = [
  'advance_request',
  'acceptance_liquidation',
  'payment_request',
]

export const DEFAULT_DOCUMENT_NUMBER_PATTERN = '{{sequence}}/{{document_type_code}}-{{seller}}/{{customer}}/{{year}}'

export const DEFAULT_CONTRACT_DOCUMENT_TEMPLATES = [
  {
    id: 'system-advance-request-template',
    document_type: 'advance_request',
    name: 'Mẫu đề nghị tạm ứng mặc định',
    description: 'Mẫu cơ bản để đề nghị khách hàng thanh toán tạm ứng theo hợp đồng.',
    title: 'Đề nghị tạm ứng',
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      amount_field: 'advance_amount',
      required_fields: ['amount', 'issued_date'],
      suggested_amount_source: 'contract.payment_config.deposit_percent',
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [
      {
        id: 'advance-summary',
        title: 'Nội dung đề nghị',
        body: 'Căn cứ Hợp đồng đã ký, Bên B kính đề nghị Bên A thanh toán khoản tạm ứng theo giá trị và tiến độ đã thỏa thuận.',
      },
      {
        id: 'advance-payment-info',
        title: 'Thông tin thanh toán',
        body: 'Số tiền tạm ứng, thời hạn thanh toán và thông tin chuyển khoản được ghi nhận theo dữ liệu chứng từ khi lập.',
      },
    ],
    terms_text: 'Bên A thanh toán khoản tạm ứng theo hợp đồng sau khi nhận được đề nghị tạm ứng hợp lệ từ Bên B.',
    is_default: true,
    is_active: true,
    sort_order: 10,
  },
  {
    id: 'system-acceptance-liquidation-template',
    document_type: 'acceptance_liquidation',
    name: 'Mẫu BBNT kiêm thanh lý mặc định',
    description: 'Mẫu nghiệm thu kết quả dịch vụ và xác nhận thanh lý nghĩa vụ theo hợp đồng.',
    title: 'Biên bản nghiệm thu kiêm thanh lý',
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      amount_field: 'acceptance_amount',
      required_fields: ['amount', 'issued_date'],
      suggested_amount_source: 'contract.total_amount',
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [
      {
        id: 'acceptance-scope',
        title: 'Nội dung nghiệm thu',
        body: 'Hai bên xác nhận Bên B đã hoàn thành phạm vi dịch vụ theo hợp đồng và các phụ lục/thỏa thuận liên quan.',
      },
      {
        id: 'liquidation-confirmation',
        title: 'Xác nhận thanh lý',
        body: 'Sau khi hoàn tất các nghĩa vụ thanh toán còn lại, hai bên thống nhất thanh lý hợp đồng theo nội dung biên bản này.',
      },
    ],
    terms_text: 'Hai bên thống nhất nghiệm thu khối lượng dịch vụ đã hoàn thành và làm cơ sở thanh toán/ thanh lý hợp đồng.',
    is_default: true,
    is_active: true,
    sort_order: 20,
  },
  {
    id: 'system-payment-request-template',
    document_type: 'payment_request',
    name: 'Mẫu đề nghị thanh toán mặc định',
    description: 'Mẫu đề nghị thanh toán phần giá trị còn lại, bắt buộc liên kết với BBNT.',
    title: 'Đề nghị thanh toán',
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      amount_field: 'payment_amount',
      required_fields: ['amount', 'issued_date', 'acceptance_document_id'],
      related_document_type: 'acceptance_liquidation',
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [
      {
        id: 'payment-basis',
        title: 'Cơ sở thanh toán',
        body: 'Căn cứ hợp đồng và biên bản nghiệm thu đã được hai bên xác nhận, Bên B đề nghị Bên A thanh toán giá trị còn lại.',
      },
      {
        id: 'payment-request-detail',
        title: 'Chi tiết đề nghị',
        body: 'Giá trị thanh toán, chứng từ liên quan và ghi chú bổ sung được lấy từ dữ liệu chứng từ khi lập.',
      },
    ],
    terms_text: 'Đề nghị thanh toán này được lập trên cơ sở BBNT đã liên kết và các điều khoản thanh toán trong hợp đồng.',
    is_default: true,
    is_active: true,
    sort_order: 30,
  },
]

export function normalizeDocumentTemplate(template = {}) {
  const documentType = CONTRACT_DOCUMENT_TYPES[template.document_type] ? template.document_type : 'advance_request'
  const contentSections = Array.isArray(template.content_sections) ? template.content_sections : []

  return {
    id: template.id || '',
    document_type: documentType,
    name: String(template.name || '').trim(),
    description: String(template.description || '').trim(),
    title: String(template.title || CONTRACT_DOCUMENT_TYPES[documentType].defaultTitle).trim(),
    seller_entity_code: String(template.seller_entity_code || 'EVT').trim(),
    document_number_pattern: String(template.document_number_pattern || DEFAULT_DOCUMENT_NUMBER_PATTERN).trim(),
    fields_config: template.fields_config && typeof template.fields_config === 'object' ? template.fields_config : {},
    numbering_config: template.numbering_config && typeof template.numbering_config === 'object' ? template.numbering_config : {},
    content_sections: contentSections,
    terms_text: String(template.terms_text || sectionsToDocumentTermsText(contentSections)).trim(),
    is_default: Boolean(template.is_default),
    is_active: template.is_active !== false,
    sort_order: Number(template.sort_order || 100),
    is_system_default: Boolean(template.is_system_default),
    created_at: template.created_at,
    updated_at: template.updated_at,
    deleted_at: template.deleted_at,
  }
}

export function mergeDefaultDocumentTemplates(rows = []) {
  const byId = new Map(rows.map(row => [row.id, normalizeDocumentTemplate(row)]))
  DEFAULT_CONTRACT_DOCUMENT_TEMPLATES.forEach(template => {
    const existing = byId.get(template.id)
    const runtimeDefault = existing?.is_system_default && !existing?.created_at && !existing?.updated_at
    if (existing) {
      byId.set(template.id, normalizeDocumentTemplate({
        ...template,
        ...(runtimeDefault ? {} : existing),
        is_system_default: true,
      }))
    } else {
      byId.set(template.id, normalizeDocumentTemplate({ ...template, is_system_default: true }))
    }
  })

  return Array.from(byId.values()).sort((left, right) => {
    if (left.document_type !== right.document_type) {
      return CONTRACT_DOCUMENT_TYPE_ORDER.indexOf(left.document_type) - CONTRACT_DOCUMENT_TYPE_ORDER.indexOf(right.document_type)
    }
    return Number(left.sort_order || 100) - Number(right.sort_order || 100)
  })
}

export function getDefaultDocumentTemplate(templates = [], documentType = 'advance_request') {
  const rows = templates
    .map(normalizeDocumentTemplate)
    .filter(template => template.document_type === documentType && template.is_active !== false)

  return rows.find(template => template.is_default) || rows[0] || normalizeDocumentTemplate({
    ...DEFAULT_CONTRACT_DOCUMENT_TEMPLATES.find(template => template.document_type === documentType),
  })
}

export function sectionsToDocumentTermsText(sections = []) {
  return (Array.isArray(sections) ? sections : [])
    .map(section => {
      const title = String(section.title || '').trim()
      const body = String(section.body || '').trim()
      return [title, body].filter(Boolean).join('\n')
    })
    .filter(Boolean)
    .join('\n\n')
}

export function documentTermsTextToSections(value = '') {
  const blocks = String(value || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)

  return blocks.map((block, index) => {
    const lines = block.split('\n')
    const title = lines.length > 1 ? lines[0].trim() : `Mục ${index + 1}`
    const body = lines.length > 1 ? lines.slice(1).join('\n').trim() : block
    return {
      id: `section-${index + 1}`,
      title,
      body,
    }
  })
}

export function buildDocumentTemplateSnapshot(template = {}) {
  const normalized = normalizeDocumentTemplate(template)
  const {
    created_at: templateCreatedAt,
    updated_at: templateUpdatedAt,
    deleted_at: _deletedAt,
    is_system_default: _isSystemDefault,
    ...snapshot
  } = normalized

  return {
    ...snapshot,
    template_created_at: templateCreatedAt || null,
    template_updated_at: templateUpdatedAt || null,
    snapshot_created_at: new Date().toISOString(),
  }
}
