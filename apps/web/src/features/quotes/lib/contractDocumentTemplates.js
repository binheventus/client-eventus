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

export const ADVANCE_REQUEST_TEMPLATE_BLOCKS = [
  {
    id: 'advance-greeting',
    title: 'Kính gửi',
    body: 'Kính gửi: {{customer_name}}',
  },
  {
    id: 'advance-basis',
    title: 'Căn cứ tạm ứng',
    body: 'Căn cứ vào yêu cầu của Quý khách hàng về việc cung cấp dịch vụ {{project_event_name}} theo hợp đồng số {{contract_number}} ký ngày {{contract_signing_date}}.',
  },
  {
    id: 'advance-request',
    title: 'Nội dung đề nghị',
    body: 'Bằng công văn này, chúng tôi kính đề nghị Quý khách hàng tạm ứng cho chúng tôi {{advance_percent}}% giá trị đơn hàng tương ứng với số tiền là: {{advance_amount}} VNĐ.',
  },
  {
    id: 'advance-amount-words',
    title: 'Số tiền bằng chữ',
    body: '(Bằng chữ: {{advance_amount_words}} ./.)',
  },
  {
    id: 'advance-method',
    title: 'Hình thức thanh toán',
    body: 'Hình thức thanh toán: Chuyển khoản.',
  },
  {
    id: 'advance-bank-intro',
    title: 'Thông tin chuyển khoản',
    body: 'Quý khách vui lòng chuyển vào tài khoản:',
  },
  {
    id: 'advance-closing',
    title: 'Lời kết',
    body: 'Kính mong nhận được sự hợp tác của Quý Khách hàng.\nTrân trọng!',
  },
]

export const PAYMENT_REQUEST_TEMPLATE_BLOCKS = [
  {
    id: 'payment-greeting',
    title: 'Kính gửi',
    body: 'Kính gửi: {{customer_name}}',
  },
  {
    id: 'payment-basis',
    title: 'Căn cứ thanh toán',
    body: 'Căn cứ vào yêu cầu của Quý khách hàng về việc cung cấp {{service_scope}} Hợp Đồng số {{contract_number}} ký ngày {{contract_signing_date}} và biên bản nghiệm thu hợp đồng số {{acceptance_document_number}} ký ngày {{acceptance_issued_date}}.',
  },
  {
    id: 'payment-request',
    title: 'Nội dung đề nghị',
    body: 'Bằng công văn này, chúng tôi kính đề nghị Quý khách hàng thanh toán cho chúng tôi tổng chi phí tương ứng với số tiền là: {{payment_amount}} VNĐ.',
  },
  {
    id: 'payment-amount-words',
    title: 'Số tiền bằng chữ',
    body: '(Bằng chữ: {{payment_amount_words}} ./.)',
  },
  {
    id: 'payment-method',
    title: 'Hình thức thanh toán',
    body: 'Hình thức thanh toán: Chuyển khoản.',
  },
  {
    id: 'payment-bank-intro',
    title: 'Thông tin chuyển khoản',
    body: 'Quý khách vui lòng chuyển vào tài khoản:',
  },
  {
    id: 'payment-closing',
    title: 'Lời kết',
    body: 'Kính mong nhận được sự hợp tác của Quý Khách hàng.\nTrân trọng!',
  },
]

export const ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS = [
  {
    id: 'acceptance-basis-contract',
    title: 'Căn cứ hợp đồng',
    body: 'Căn cứ vào Hợp Đồng dịch vụ số: {{contract_number}} ký ngày {{contract_signing_date}} giữa {{customer_name}} và {{seller_entity_name_full}};',
  },
  {
    id: 'acceptance-basis-completed',
    title: 'Căn cứ hoàn thành công việc',
    body: 'Căn cứ các công việc hai bên đã hoàn thành;',
  },
  {
    id: 'acceptance-party-intro',
    title: 'Dẫn nhập thông tin hai bên',
    body: 'Hôm nay, ngày {{issued_date}} chúng tôi gồm có:',
  },
  {
    id: 'acceptance-signing-intro',
    title: 'Nội dung thống nhất',
    body: 'Hai bên thống nhất ký biên bản nghiệm thu công việc và thanh lý Hợp Đồng số: {{contract_number}} ký ngày {{contract_signing_date}} với các nội dung sau:',
  },
  {
    id: 'acceptance-article-1',
    title: 'ĐIỀU I: NỘI DUNG NGHIỆM THU THANH LÝ',
    body: 'Bên A xác nhận Bên B đã hoàn thành các nghĩa vụ của mình và đã thực hiện đầy đủ các hạng mục công việc theo Hợp Đồng số: {{contract_number}}.\nBên A xác nhận bên B đã đạt được các yêu cầu của công việc đảm bảo về cả chất lượng và tiến độ và đã bàn giao File gốc qua hệ thống lưu trữ online Google Drive như đã cam kết với các hạng mục công việc.\nBên A và Bên B đồng thuận để nghiệm thu và tiến hành các thủ tục thanh toán theo nội dung quy định trong Hợp Đồng.',
  },
  {
    id: 'acceptance-article-2',
    title: 'ĐIỀU II: TỔNG GIÁ TRỊ HỢP ĐỒNG',
    body: 'Tổng giá trị Hợp Đồng: {{contract_total}} VNĐ (Đã bao gồm VAT)\nTổng giá trị nghiệm thu: {{acceptance_total}} VNĐ (Đã bao gồm VAT)\nBên A đã tạm ứng cho bên B: {{advance_paid}} VNĐ\nBên A phải thanh toán cho bên B: {{remaining_amount}} VNĐ (Đã bao gồm VAT)',
  },
  {
    id: 'acceptance-article-3',
    title: 'ĐIỀU III: THANH TOÁN',
    body: 'Bên A có trách nhiệm thanh toán nốt số tiền còn lại cho bên B theo như điều 2 của biên bản nghiệm thu công việc thanh lý Hợp Đồng này trong vòng {{payment_due_days}} kể từ ngày nhận được nghiệm thu.\nTrường hợp Bên A chậm thanh toán quá thời hạn nêu trên, Bên A có nghĩa vụ thanh toán lãi chậm trả với mức lãi suất 0,05%/ngày (tương đương khoảng 18%/năm) tính trên số tiền chậm trả, kể từ ngày thứ 08 cho đến ngày Bên A thanh toán thực tế cho Bên B.\nBên B có trách nhiệm cung cấp đầy đủ hóa đơn tài chính cho bên A. Trường hợp Bên A có khiếu nại về tính hợp lệ của hóa đơn, Bên A phải thông báo bằng văn bản cho Bên B trong vòng 03 (ba) ngày làm việc kể từ ngày nhận hóa đơn, nêu rõ lý do. Quá thời hạn này, hóa đơn được coi là đã được Bên A chấp nhận và nghĩa vụ thanh toán được kích hoạt theo điều khoản nêu trên.\nQuyền sở hữu và quyền sử dụng đầy đủ đối với toàn bộ sản phẩm đã bàn giao (bao gồm file gốc, video thành phẩm và các tài liệu liên quan) chính thức chuyển giao cho Bên A sau khi Bên A hoàn tất nghĩa vụ thanh toán 100% giá trị nghiệm thu cho Bên B.\nBên A thanh toán cho Bên B thông qua hình thức: Chuyển khoản\nTài khoản chuyển khoản: {{seller_bank_account}}\nNgân hàng: {{seller_bank_name}}\nChủ tài khoản : {{seller_account_holder}}',
  },
  {
    id: 'acceptance-article-4',
    title: 'ĐIỀU IV: ĐIỀU KHOẢN CHUNG',
    body: 'Hai bên đã hoàn thành trách nhiệm như trong Hợp Đồng đã ký và thống nhất nghiệm thu thanh lý Hợp Đồng dịch vụ số: {{contract_number}}.\nBiên bản thanh lý Hợp Đồng này là căn cứ để kết thúc Hợp Đồng dịch vụ số: {{contract_number}}.\nHợp Đồng số: {{contract_number}} được thanh lý ngay khi Bên A hoàn tất nghĩa vụ thanh toán số còn lại cho bên B.\nBiên bản này được lập thành hai (02) bản có giá trị pháp lý như nhau, mỗi bên giữ một (01) bản, có hiệu lực kể từ ngày ký.',
  },
]

export const ACCEPTANCE_COST_DIFFERENCE_NOTE_BLOCK = {
  id: 'acceptance-cost-difference-note',
  title: 'Ghi chú phát sinh',
  body: 'Hai bên xác nhận khoản phát sinh đã được Bên A phê duyệt qua email/tin nhắn của người đại diện có thẩm quyền của Bên A trước khi Bên B thực hiện. Khoản phát sinh này được xem là một phần không tách rời của Hợp Đồng số {{contract_number}} và có giá trị pháp lý tương đương Phụ lục Hợp đồng điều chỉnh giá trị.',
}

export const ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS = [
  ...ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS.slice(0, 6),
  ACCEPTANCE_COST_DIFFERENCE_NOTE_BLOCK,
  ...ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS.slice(6),
]

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
    content_sections: ADVANCE_REQUEST_TEMPLATE_BLOCKS,
    terms_text: sectionsToDocumentTermsText(ADVANCE_REQUEST_TEMPLATE_BLOCKS),
    is_default: true,
    sort_order: 10,
  },
  {
    id: 'system-acceptance-liquidation-template',
    document_type: 'acceptance_liquidation',
    name: 'Mẫu BBNT kiêm thanh lý mặc định',
    description: 'Mẫu BBNT kiêm thanh lý theo form chuẩn không có chênh lệch chi phí với hợp đồng.',
    title: 'Biên bản nghiệm thu và thanh lý hợp đồng',
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
    content_sections: ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS,
    terms_text: sectionsToDocumentTermsText(ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS),
    is_default: true,
    sort_order: 20,
  },
  {
    id: 'system-acceptance-liquidation-cost-difference-template',
    document_type: 'acceptance_liquidation',
    name: 'Mẫu BBNT có chênh lệch chi phí',
    description: 'Mẫu BBNT kiêm thanh lý có bảng hạng mục hợp đồng và bảng hạng mục nghiệm thu thực tế.',
    title: 'Biên bản nghiệm thu và thanh lý hợp đồng',
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      amount_field: 'acceptance_amount',
      required_fields: ['amount', 'issued_date'],
      suggested_amount_source: 'contract.total_amount',
      acceptance_cost_difference: true,
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS,
    terms_text: sectionsToDocumentTermsText(ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS),
    is_default: false,
    sort_order: 21,
  },
  {
    id: 'system-payment-request-template',
    document_type: 'payment_request',
    name: 'Mẫu đề nghị thanh toán mặc định',
    description: 'Mẫu công văn đề nghị thanh toán theo form DNTT đang sử dụng.',
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
    content_sections: PAYMENT_REQUEST_TEMPLATE_BLOCKS,
    terms_text: sectionsToDocumentTermsText(PAYMENT_REQUEST_TEMPLATE_BLOCKS),
    is_default: true,
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
    .filter(template => template.document_type === documentType)

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
