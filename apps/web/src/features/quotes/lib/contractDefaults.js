import legalEntitiesData from '../../../data/pricing/legal_entities.json' with { type: 'json' }

export const MEDIAMONSTER_SAMPLE_TEMPLATE_ID = 'system-mediamonster-service-contract'
export const DEFAULT_CONTRACT_TEMPLATE_ID = MEDIAMONSTER_SAMPLE_TEMPLATE_ID
export const DEFAULT_CONTRACT_TITLE = 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ MEDIA'
export const CONTRACT_APPENDIX_DETAIL_TEXT = 'Chi tiết hạng mục: Theo Phụ lục đính kèm hợp đồng'
export const CONTRACT_SUBTOTAL_LABEL = 'Tổng cộng chưa bao gồm Thuế GTGT'
export const CONTRACT_TEMPLATE_SNAPSHOT_RULE = 'Mẫu hợp đồng chỉ áp dụng cho hợp đồng tạo mới; hợp đồng đã lưu sẽ không bị cập nhật theo mẫu.'
const LEGACY_DEFAULT_CONTRACT_TEMPLATE_IDS = new Set(['system-default-service-contract'])

export const CONTRACT_TABLE_PLACEMENTS = {
  ARTICLE_1: 'article_1',
  APPENDIX: 'appendix',
}

export const DEFAULT_PARTY_ROLE_CONFIG = {
  party_a: 'customer',
  party_b: 'seller',
}

export const DEFAULT_PAYMENT_CONFIG = {
  deposit_percent: 50,
  final_due_days: 7,
  issue_invoice_on_deposit: true,
  payment_documents: [
    'Đề nghị thanh toán có xác nhận của Bên B',
    'Biên bản nghiệm thu và thanh lý hợp đồng',
    'Hóa đơn tài chính hợp lệ do Bên B phát hành cho Bên A.',
  ],
}

export const DEFAULT_QUOTE_TABLE_CONFIG = {
  placement: CONTRACT_TABLE_PLACEMENTS.APPENDIX,
  group_by_day: true,
  show_vat: true,
}

export const DEFAULT_CONTRACT_PREAMBLE = [
  'Căn cứ theo Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015;',
  'Căn cứ theo Luật Thương mại số 36/2005/QH11 ngày 14 tháng 6 năm 2005;',
  'Căn cứ theo nhu cầu hợp tác và khả năng của hai bên.',
]

export const WORK_DURATION_PLACEHOLDER = '[Số giờ/buổi hoặc Số giờ/ngày]'
export const DEFAULT_WORK_DURATION_TEXT = '04 giờ/buổi'

export const DEFAULT_WORK_PROGRESS_NOTES = [
  `Thời gian làm việc tiêu chuẩn của nhân sự Bên B là tối đa ${WORK_DURATION_PLACEHOLDER} theo thỏa thuận. Các yêu cầu phát sinh ngoài khung giờ này sẽ được tính phí ngoài giờ là 500.000 đồng/giờ/nhân sự, với điều kiện phải được Bên A xác nhận qua văn bản hoặc email/Zalo trước khi thực hiện.`,
  'Đối với sản phẩm hậu kỳ: Ảnh sự kiện (đã chỉnh sửa màu sắc và bố cục) được bàn giao trong vòng 24 giờ và Video Recap trong vòng 03 ngày kể từ khi kết thúc sự kiện (nếu có). Tiến độ bàn giao Video được tính kể từ thời điểm Bên A cung cấp đầy đủ các tài liệu cần thiết (brief, logo, font, nhạc hoặc tư liệu liên quan tùy theo hạng mục). Trường hợp Bên A chậm cung cấp tài liệu, thời hạn bàn giao sẽ được gia hạn tương ứng.',
]

function normalizeTextArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback
  const rows = value.map(item => String(item || '').trim()).filter(Boolean)
  return rows.length ? rows : fallback
}

function normalizeEditableTextArray(value, fallback = []) {
  if (!Array.isArray(value)) return fallback
  return value.map(item => String(item ?? ''))
}

export function getContractPreamble(contract = {}) {
  return normalizeTextArray(contract.preamble, DEFAULT_CONTRACT_PREAMBLE)
}

const DEFAULT_SECTIONS = [
  {
    id: 'article-3-rights-obligations',
    article_no: 3,
    title: 'NGHĨA VỤ VÀ QUYỀN LỢI CỦA CÁC BÊN',
    body: `Nghĩa vụ và quyền lợi của Bên A
Bên A có các nghĩa vụ, quyền lợi sau:
Cung cấp cho Bên B đầy đủ các tư liệu và thông tin về công việc nhằm hỗ trợ Bên B thực hiện và hoàn thiện sản phẩm. Trong vòng 5 ngày sau khi nhận được clip từ Bên B, Bên A có nghĩa vụ xem và gửi lại góp ý để hỗ trợ Bên B hoàn thiện sản phẩm. Quá thời hạn này, nếu Bên A không phản hồi, clip được coi là đã hoàn thiện và được nghiệm thu.
Nếu thay đổi ngày làm việc, Bên A phải thông báo cho Bên B trước ít nhất 03 ngày.
Trong quá trình sản xuất nếu có phát sinh bất kì yêu cầu nào ngoài hợp đồng mà đã được sự thống nhất của hai bên thì Bên A sẽ có trách nhiệm chi trả các khoản phát sinh đó cho Bên B.

Nghĩa vụ và quyền lợi của Bên B
Bên B có các nghĩa vụ, quyền lợi sau:
Đảm bảo nhân sự và trang thiết bị cho việc quay & dựng phim đúng thời gian, hình ảnh và nội dung không sai với ý tưởng và những gì Bên A mong muốn. Trong mọi trường hợp có sự thay đổi, Bên B phải thông báo cho Bên A trước khi thực hiện ít nhất 01 ngày.
Tôn trọng những ý tưởng, góp ý của Bên A trong thời gian thực hiện và đảm bảo giữ bí mật tuyệt đối những thông tin do Bên A cung cấp.
Thực hiện chỉnh sửa video theo các góp ý của Bên A. Trường hợp sau 5 ngày Bên B gửi clip, nếu Bên A không có phản hồi về video, Bên B có quyền tự động nghiệm thu sản phẩm.
Không sử dụng hình ảnh, tư liệu.. của Bên A để quảng bá nếu chưa được sự đồng ý từ Bên A bằng văn bản.
Bên B không chịu trách nhiệm & có quyền từ chối quay những cảnh liên quan đến chính trị, tôn giáo, thuần phong mĩ tục hoặc mang tính chất nguy hiểm.`,
  },
  {
    id: 'article-4-penalty',
    article_no: 4,
    title: 'PHẠT VI PHẠM HỢP ĐỒNG – BỒI THƯỜNG THIỆT HẠI',
    body: `Các bên cam kết nỗ lực thực hiện Hợp đồng đầy đủ và chính xác theo các nội dung đã thống nhất tại Hợp đồng này.
Trường hợp một Bên vi phạm các quy định tại Hợp đồng, Bên bị vi phạm có quyền thông báo bằng văn bản (Sau đây gọi tắt là “Thông báo vi phạm”) cho Bên vi phạm yêu cầu Bên vi phạm khắc phục hành vi vi phạm trong một thời hạn do Bên bị vi phạm ấn định. Thời hạn khắc phục hành vi vi phạm tối thiểu là 15 ngày kể từ ngày nhận được Thông báo vi phạm. Hết thời hạn khắc phục hành vi vi phạm do Bên bị vi phạm ấn định theo quy định tại Khoản này, nếu Bên vi phạm không khắc phục, sửa chữa hành vi vi phạm, Bên bị vi phạm có quyền đơn phương chấm dứt Hợp đồng trước thời hạn;
Bên bị vi phạm có quyền áp dụng một khoản phạt vi phạm hợp đồng đối với Bên vi phạm tương ứng với 8% giá trị của phần Hợp đồng bị vi phạm và yêu cầu bồi thường thiệt hại (nếu có);
Bên vi phạm gây thiệt hại phải bồi thường cho bên kia toàn bộ các chi phí, phí tổn, tổn thất, thiệt hại mà bên kia phải chịu do hậu quả của vi phạm đó, bao gồm cả chi phí pháp lý, tư vấn và luật sư.`,
  },
  {
    id: 'article-5-force-majeure',
    article_no: 5,
    title: 'SỰ KIỆN BẤT KHẢ KHÁNG',
    body: `Sự Kiện Bất Khả Kháng là sự kiện không lường trước được và nằm ngoài sự kiểm soát hợp lý của các Bên, bao gồm, nhưng không giới hạn ở các tai họa thiên nhiên như cháy, nổ, lụt lội hoặc động đất, dịch bệnh, các sự kiện khác như chiến tranh, phong toả hoặc cấm vận, chiếm đóng, nội chiến, nổi loạn, phá hoại hay rối loạn xã hội, đình công hay náo động lao động khác hoặc bất kỳ việc luật áp dụng, công bố, quy định, pháp lệnh hay nghị định nào được các cơ quan Chính phủ ban hành mà có ảnh hưởng làm gián đoạn, gây trở ngại hoặc ngăn cản việc thực hiện nghĩa vụ của các bên phát sinh từ Hợp đồng này.
Các Bên thoả thuận rằng cả hai Bên với nỗ lực cao nhất của mình sẽ tiến hành các biện pháp phù hợp để ngăn chặn hoặc khắc phục hậu quả của Sự Kiện Bất Khả Kháng.
Không bên nào bị coi là vi phạm Hợp đồng này, hoặc phải chịu trách nhiệm trước bên kia do bất cứ sự chậm trễ nào trong việc thực hiện hoặc không thực hiện bất kỳ nghĩa vụ nào của mình theo Hợp đồng này do Sự Kiện Bất Khả Kháng gây ra, với điều kiện là:
Sự Kiện Bất Khả Kháng là nguyên nhân trực tiếp và gần nhất làm cho bên đó bị cản trở hoặc chậm trễ trong việc thực hiện Hợp đồng;
Bên bị ảnh hưởng thông báo ngay cho bên kia biết về việc xảy ra Sự Kiện Bất Khả Kháng đó trong thời hạn ba (03) ngày hoặc trong một khoảng thời gian dài hơn khi tình huống cụ thể đòi hỏi như vậy, gửi cho Bên kia thông báo bằng văn bản, trong đó nêu ra các biện pháp khắc phục được thực hiện và nêu các chi tiết của sự cố đã ngăn cản việc thực hiện Hợp đồng này.
Nghĩa vụ của Các Bên theo Hợp đồng này chỉ được giải phóng trong khoảng thời gian của Sự Kiện Bất Khả Kháng và trong chừng mực Sự Kiện Bất Khả Kháng ngăn trở việc thực hiện các nghĩa vụ của Bên đó, với điều kiện là các biện pháp ngăn ngừa đã được thực hiện nhưng không đạt kết quả.
Trong trường hợp xảy ra Sự Kiện Bất Khả Kháng mà theo đánh giá của Các Bên là không thể khắc phục được hoặc thời gian khắc phục vượt quá 30 (ba mươi) ngày thì Hợp đồng này sẽ được chấm dứt do Sự Kiện Bất Khả Kháng theo quy định tại Điều này. Các Bên được miễn trừ trách nhiệm và không Bên nào được quyền khiếu nại hoặc yêu cầu Bên kia bồi thường thiệt hại.
Không phụ thuộc vào quy định tại Điều 5.4 trên đây, không Bên nào được miễn trách nhiệm đối với các khoản nợ hoặc bồi thường phát sinh ra trước khi Hợp Đồng này bị chấm dứt theo khoản 5.4 nêu trên.`,
  },
  {
    id: 'article-6-termination',
    article_no: 6,
    title: 'CHẤM DỨT HỢP ĐỒNG',
    body: `Hợp đồng này sẽ chấm dứt trong các trường hợp sau:
Hợp đồng hết hạn mà các bên không có thỏa thuận gia hạn Hợp đồng.
Các Bên thỏa thuận chấm dứt Hợp đồng trước thời hạn bằng văn bản. Trong trường hợp này, Các Bên sẽ thỏa thuận về điều kiện và thời điểm chấm dứt;
Một bên đơn phương chấm dứt Hợp đồng theo quy định tại Hợp đồng này;
Xảy ra Sự Kiện Bất Khả Kháng và Sự Kiện Bất Khả Kháng kéo dài hơn thời hạn quy định tại khoản 5.4 Điều 5 của Hợp đồng này.
Một Bên bị phá sản hoặc giải thể (trừ trường hợp nhằm tái cơ cấu) hoặc bị yêu cầu tuyên bố phá sản hoặc mất khả năng thanh toán hoặc trong trường hợp Bên đó bị tịch thu tài sản bởi cơ quan nhà nước có thẩm quyền.
Việc chấm dứt Hợp đồng theo Điều này sẽ không làm ảnh hưởng hay giải phóng Các Bên khỏi các quyền, nghĩa vụ và trách nhiệm phát sinh từ trước thời điểm chấm dứt Hợp đồng này.
Trong trường hợp Hợp đồng bị chấm dứt theo mục (d) mục (e) khoản 6.1 nêu trên (trừ trường hợp có thỏa thuận khác), trong thời hạn bảy (07) ngày mỗi bên có nghĩa vụ hoàn trả lại cho nhau tất cả những gì đã nhận, và mỗi Bên sẽ gánh chịu phần thiệt hại của mình (nếu có), cũng như không được yêu cầu Bên kia bồi thường.`,
  },
  {
    id: 'article-7-confidentiality',
    article_no: 7,
    title: 'BẢO MẬT VÀ QUYỀN SỞ HỮU ĐỐI VỚI SẢN PHẨM DỊCH VỤ',
    body: `Mọi Thông Tin Mật sẽ:
Được coi là tài sản của Bên A.
Được Bên B có trách nhiệm giữ bí mật trước, trong và cả sau khi Hợp đồng này chấm dứt.
Được hoàn trả tức thì khi Bên A yêu cầu.
Bên B cam kết rằng sẽ không tiết lộ, để lộ ra hoặc cung cho bất kỳ bên thứ ba nào nếu không được sự đồng ý bằng văn bản của Bên A.
Bên B cam kết sẽ không sử dụng bất kỳ, toàn bộ hoặc một phần Thông tin Mật nào của Bên A cung cấp cho bất kỳ mục đích nào khác ngoài mục đích thực hiện dịch vụ cho Bên A theo quy định của Hợp đồng này.
Bất kỳ Bên nào vi phạm quy định bảo mật thông tin tại điều này được xem như một hành vi vi phạm Hợp Đồng và phải chịu chế tài như được đề cập tại Điều 4 của Hợp đồng này.`,
  },
  {
    id: 'article-8-dispute',
    article_no: 8,
    title: 'GIẢI QUYẾT TRANH CHẤP',
    body: `Hợp Đồng này được điều chỉnh và giải thích theo quy định của pháp luật Việt Nam.
Trong trường hợp có tranh chấp phát sinh từ Hợp Đồng, Các Bên sẽ cố gắng giải quyết bằng con đường thương lượng, hòa giải. Nếu tranh chấp không giải quyết được bằng thương lượng, hòa giải thì một bên có quyền đưa ra Toà án có thẩm quyền để giải quyết. Quyết định của Toà án sẽ là quyết định cuối cùng và có giá trị bắt buộc đối với Các Bên. Án Phí sẽ do Bên thua kiện chịu.`,
  },
  {
    id: 'article-9-general',
    article_no: 9,
    title: 'ĐIỀU KHOẢN CHUNG',
    body: `Hợp Đồng này có hiệu lực kể từ ngày ký. Các bên cam kết có đầy đủ thẩm quyền ký kết hợp đồng này.
Bất kỳ sửa đổi, bổ sung nào đối với Hợp Đồng này sẽ chỉ có hiệu lực nếu được lập thành văn bản được ký xác nhận bởi đại diện có thẩm quyền của Các Bên, trừ trưởng hợp Hợp Đồng này có quy định khác. Mọi tài liệu, văn bản, email trao đổi và phát hành giữa Các Bên trong quá trình thực hiện Hợp Đồng này sẽ là những bộ phận không tách rời của Hợp Đồng này
Nếu bất kỳ điều khoản nào của Hợp Đồng này có toàn bộ hay một phần nội dung bị vô hiệu do bị trái pháp luật hoặc không thể thi hành được vì bất kỳ lý do nào, phần còn lại của điều khoản đó và các điều khoản khác tại Hợp Đồng này sẽ không bị ảnh hưởng và giữ nguyên hiệu lực và vẫn có hiệu lực thi hành.
Hợp đồng được tự động thanh lý khi các bên hoàn thành nghĩa vụ của mình theo Hợp đồng đã kí.
Hợp đồng này được lập thành hai (02) bản, có hiệu lực ngang nhau. Mỗi bên giữ một (01) bản để thực hiện.`,
  },
]

export const DEFAULT_CONTRACT_TERMS = DEFAULT_SECTIONS
  .map(section => `ĐIỀU ${section.article_no}: ${section.title}\n${section.body}`)
  .join('\n\n')

const MEDIAMONSTER_SAMPLE_SCHEDULE = [
  {
    time_range: '07:45 - 17:00',
    date_text: '08.06.2026',
    location: 'Học viện Ngoại giao, 69 Chùa Láng, Phường Láng, Thành phố Hà Nội',
  },
  {
    time_range: '07:45 - 17:00',
    date_text: '09.06 và ngày 10.06.2026',
    location: 'Khách sạn Melia Hà Nội, 44B Lý Thường Kiệt, Cửa Nam, Hà Nội',
  },
]

export const DEFAULT_CONTRACT_TEMPLATES = [
  {
    id: MEDIAMONSTER_SAMPLE_TEMPLATE_ID,
    name: 'Mẫu Mediamonster theo form 18.05.2026',
    description: 'Mẫu cấu trúc lại từ file Form hợp đồng Mediamonster_18.05.2026.',
    title: DEFAULT_CONTRACT_TITLE,
    seller_entity_code: 'MEDIAMONSTER',
    party_role_config: DEFAULT_PARTY_ROLE_CONFIG,
    contract_number_pattern: '{{dd}}{{mm}}/HDMMT-{{customer_short_code}}/{{yyyy}}',
    preamble: DEFAULT_CONTRACT_PREAMBLE,
    service_scope: 'cung cấp dịch vụ quay phim, chụp ảnh, dựng video sự kiện Asean Future Forum 2026',
    schedule_rows: MEDIAMONSTER_SAMPLE_SCHEDULE,
    quote_table_config: DEFAULT_QUOTE_TABLE_CONFIG,
    payment_config: DEFAULT_PAYMENT_CONFIG,
    content_sections: DEFAULT_SECTIONS,
    terms_text: DEFAULT_CONTRACT_TERMS,
    is_default: true,
    is_active: true,
    is_system_default: true,
    sort_order: 1,
  },
]

export const CONTRACT_STATUS_LABELS = {
  draft: 'Nháp',
  generated: 'Đã tạo file',
}

function normalizeText(value = '') {
  return String(value || '').trim()
}

function stripDiacritics(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[Đđ]/g, 'D')
}

export function sanitizeFilenamePart(value) {
  return stripDiacritics(normalizeText(value))
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'Hop-dong'
}

export function getQuoteCode(quote = {}) {
  return normalizeText(quote.quote_number || quote.id || quote.share_token || 'DRAFT').replace(/^#/, '')
}

function getCustomerShortCode(quote = {}) {
  const ignored = new Set(['CONG', 'TY', 'TNHH', 'CP', 'CO', 'PHAN', 'TAP', 'DOAN', 'MTV', 'LIMITED', 'COMPANY'])
  const words = stripDiacritics(quote.client_name || quote.customer_name || quote.client?.name || 'KHACH')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(word => word && !ignored.has(word))

  const initials = words.map(word => word[0]).join('').slice(0, 4)
  return initials || 'KH'
}

export function getTodayInputDate() {
  const date = new Date()
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 10)
}

export function applySellerEntityToContractNumberPattern(pattern = 'HD-{{quote_code}}', entityCode = '') {
  const prefixByEntity = {
    EVENTUS: 'HDEVT',
    MEDIAMONSTER: 'HDMMT',
  }
  const prefix = prefixByEntity[String(entityCode || '').toUpperCase()]
  const normalizedPattern = String(pattern || 'HD-{{quote_code}}')

  return prefix ? normalizedPattern.replace(/HD(?:EVT|MMT)(?=-)/g, prefix) : normalizedPattern
}

export function applySellerEntityToContractNumber(contractNumber = '', entityCode = '') {
  const prefixByEntity = {
    EVENTUS: 'HDEVT',
    MEDIAMONSTER: 'HDMMT',
  }
  const prefix = prefixByEntity[String(entityCode || '').toUpperCase()]
  const normalizedContractNumber = String(contractNumber || '')

  return prefix ? normalizedContractNumber.replace(/HD(?:EVT|MMT)(?=-)/g, prefix) : normalizedContractNumber
}

export function generateContractNumber(pattern = 'HD-{{quote_code}}', quote = {}, dateValue = new Date()) {
  const date = dateValue ? new Date(dateValue) : new Date()
  const sourceCode = quote.source_code || (quote.external_job_id ? `JOB${quote.external_job_id}` : getQuoteCode(quote))
  const replacements = {
    quote_code: getQuoteCode(quote),
    source_code: sourceCode,
    job_code: quote.external_job_id ? `JOB${quote.external_job_id}` : sourceCode,
    customer_short_code: getCustomerShortCode(quote),
    dd: String(date.getDate()).padStart(2, '0'),
    mm: String(date.getMonth() + 1).padStart(2, '0'),
    yyyy: String(date.getFullYear()),
    yy: String(date.getFullYear()).slice(-2),
  }

  return String(pattern || 'HD-{{quote_code}}').replace(/\{\{([a-z_]+)\}\}/g, (_, key) => replacements[key] || '')
}

export function getContractNumber(quote = {}, template = {}) {
  return generateContractNumber(template.contract_number_pattern || 'HD-{{quote_code}}', quote)
}

export function canCreateContractFromQuote(quote = {}) {
  return Boolean(quote?.id) && !quote.deleted_at
}

function normalizeEntityCode(value = '') {
  return String(value || '').trim().toUpperCase()
}

export function getLegalEntityCode(entity = {}) {
  return entity.entity_code || entity.code || entity.source_entity_code || ''
}

export function getLegalEntityLabel(entity = {}) {
  return entity.display_name || entity.legal_name || entity.entity_name_full || entity.name || getLegalEntityCode(entity)
}

export function findLegalEntityByCode(entityCode = '', legalEntities = legalEntitiesData) {
  const normalizedCode = normalizeEntityCode(entityCode || 'EVENTUS')
  return (Array.isArray(legalEntities) ? legalEntities : []).find(row => (
    [row?.entity_code, row?.code, row?.source_entity_code]
      .filter(Boolean)
      .map(normalizeEntityCode)
      .includes(normalizedCode)
  )) || null
}

export function getEntityBankDetails(entity = {}) {
  return {
    account_number: entity.bank_account || entity.account_number || '',
    bank_name: entity.bank_name || '',
    account_holder: entity.account_holder || entity.legal_name || entity.entity_name_full || entity.company_name || entity.name || '',
  }
}

export function formatEntityBankDetails(details = {}) {
  return [details.account_number, details.bank_name, details.account_holder].filter(Boolean).join(' - ')
}

export function getEntityProfile(entityCode = 'EVENTUS') {
  const code = entityCode || 'EVENTUS'
  const entity = findLegalEntityByCode(code, legalEntitiesData) || legalEntitiesData[0] || {}
  const legalName = entity.entity_name_full || entity.legal_name || entity.name || entity.display_name || ''

  return {
    entity_code: getLegalEntityCode(entity) || code,
    entity_name_full: legalName,
    legal_name: legalName,
    name: legalName,
    company_name: legalName,
    tax_code: entity.tax_code || '',
    address: entity.address || '',
    website: entity.website || '',
    representative: entity.representative || '',
    position: entity.position || '',
    bank_account: entity.bank_account || '',
    bank_name: entity.bank_name || '',
    account_holder: entity.account_holder || entity.legal_name || entity.entity_name_full || entity.name || '',
  }
}

export function getCustomerProfileFromQuote(quote = {}) {
  return {
    customer_code: quote.customer_code || '',
    company_name: quote.company_name || quote.client_name || quote.customer_name || quote.client?.name || '',
    tax_code: quote.client_tax_code || '',
    address: quote.client_address || '',
    representative: quote.client_representative || '',
    position: quote.client_position || '',
    authorization_number: quote.client_authorization_number || '',
    authorization_date: quote.client_authorization_date || '',
    email: quote.client_email || quote.client?.email || '',
    phone_number: quote.client_phone || quote.client?.phone || '',
  }
}

export function getDefaultTemplate(templates = []) {
  const systemIds = new Set(DEFAULT_CONTRACT_TEMPLATES.map(template => template.id))
  const isUsableCustomTemplate = template => template.is_active !== false && !systemIds.has(template.id) && !template.is_system_default

  return templates.find(template => template.is_default && isUsableCustomTemplate(template)) ||
    templates.find(isUsableCustomTemplate) ||
    templates.find(template => template.is_active !== false) ||
    DEFAULT_CONTRACT_TEMPLATES[0]
}

function normalizeArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback
}

export function termsTextToSections(termsText = '') {
  const raw = String(termsText || '').trim()
  if (!raw) return DEFAULT_SECTIONS

  const matches = [...raw.matchAll(/(?:^|\n)\s*(?:ĐIỀU|Điều)\s+(\d+)[:.]\s*([^\n]+)\n?/g)]
  if (!matches.length) {
    return [{
      id: 'article-custom',
      article_no: 1,
      title: 'NỘI DUNG HỢP ĐỒNG',
      body: raw,
    }]
  }

  return matches.map((match, index) => {
    const start = match.index + match[0].length
    const end = matches[index + 1]?.index ?? raw.length
    return {
      id: `article-${match[1]}`,
      article_no: Number(match[1]),
      title: normalizeText(match[2]).toUpperCase(),
      body: raw.slice(start, end).trim(),
    }
  })
}

export function sectionsToTermsText(sections = []) {
  return normalizeArray(sections, DEFAULT_SECTIONS)
    .map((section, index) => {
      const articleNo = Number(section.article_no || index + 1)
      return `ĐIỀU ${articleNo}: ${section.title || 'ĐIỀU KHOẢN'}\n${section.body || ''}`.trim()
    })
    .join('\n\n')
}

function formatHourValue(value) {
  const number = Number(String(value ?? '').replace(',', '.'))
  if (!Number.isFinite(number) || number <= 0) return ''
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(number)
}

export function getContractWorkDurationText(contract = {}) {
  const customDurationText = normalizeText(contract.quote_table_config?.work_duration_text || contract.work_duration_text)
  if (customDurationText) return customDurationText

  const durationHours = contract.quote_snapshot?.duration_hours ?? contract.duration_hours
  const hourText = formatHourValue(durationHours)
  if (!hourText) return DEFAULT_WORK_DURATION_TEXT

  const durationNumber = Number(String(durationHours).replace(',', '.'))
  const unit = durationNumber >= 8 ? 'ngày' : 'buổi'
  return `${hourText} giờ/${unit}`
}

export function getContractWorkProgressNotes(contract = {}) {
  const workDurationText = getContractWorkDurationText(contract)
  const workProgressNotes = normalizeEditableTextArray(
    contract.quote_table_config?.work_progress_notes,
    DEFAULT_WORK_PROGRESS_NOTES,
  )

  return workProgressNotes
    .map(note => note.trim())
    .filter(Boolean)
    .map(note => note.replaceAll(WORK_DURATION_PLACEHOLDER, workDurationText))
}

export function numberToVietnameseCardinal(value) {
  const number = Math.round(Number(value) || 0)
  if (number === 0) return 'không'
  return readTriple(number, false).replace(/\s+/g, ' ').trim()
}

export function getContractDepositPercent(paymentConfig = {}) {
  const number = Number(paymentConfig.deposit_percent ?? DEFAULT_PAYMENT_CONFIG.deposit_percent)
  if (!Number.isFinite(number)) return DEFAULT_PAYMENT_CONFIG.deposit_percent
  return Math.max(0, number)
}

export function hasContractAdvance(paymentConfig = {}) {
  return getContractDepositPercent(paymentConfig) > 0
}

export function getContractPaymentDueDays(paymentConfig = {}) {
  const number = Number(paymentConfig.final_due_days ?? DEFAULT_PAYMENT_CONFIG.final_due_days)
  if (!Number.isFinite(number)) return DEFAULT_PAYMENT_CONFIG.final_due_days
  return Math.max(0, Math.round(number))
}

export function getContractPaymentNotes(paymentConfig = {}) {
  const finalDueDays = getContractPaymentDueDays(paymentConfig)
  const finalDueDaysText = `${String(finalDueDays).padStart(2, '0')} (${numberToVietnameseCardinal(finalDueDays)})`
  const invoiceAcceptanceNote = 'Trường hợp Bên A có khiếu nại về tính hợp lệ của hóa đơn, phải thông báo bằng văn bản cho Bên B trong vòng 02 ngày làm việc kể từ ngày nhận hóa đơn, nêu rõ lý do. Quá thời hạn này, hóa đơn được coi là đã được Bên A chấp nhận và nghĩa vụ thanh toán được kích hoạt theo điều khoản nêu trên.'

  if (!hasContractAdvance(paymentConfig)) {
    return [
      `Thời hạn thanh toán được hiểu là ${finalDueDaysText} ngày làm việc kể từ ngày Bên B bàn giao đầy đủ sản phẩm và xuất hóa đơn.`,
      invoiceAcceptanceNote,
    ]
  }

  return [
    `Thời hạn thanh toán Lần 2 được hiểu là ${finalDueDaysText} ngày làm việc kể từ ngày Bên B bàn giao đầy đủ sản phẩm và xuất hóa đơn.`,
    invoiceAcceptanceNote,
  ]
}

export function normalizeContractTemplate(template = {}) {
  const contentSections = normalizeArray(template.content_sections, null) || termsTextToSections(template.terms_text)
  const sellerEntityCode = template.seller_entity_code || template.entity_code || 'EVENTUS'
  const quoteTableConfig = {
    ...DEFAULT_QUOTE_TABLE_CONFIG,
    ...(template.quote_table_config || {}),
  }
  quoteTableConfig.work_progress_notes = normalizeEditableTextArray(
    template.quote_table_config?.work_progress_notes,
    DEFAULT_WORK_PROGRESS_NOTES,
  )

  return {
    ...template,
    seller_entity_code: sellerEntityCode,
    party_role_config: {
      ...DEFAULT_PARTY_ROLE_CONFIG,
      ...(template.party_role_config || {}),
    },
    contract_number_pattern: applySellerEntityToContractNumberPattern(template.contract_number_pattern || 'HD-{{quote_code}}', sellerEntityCode),
    preamble: getContractPreamble(template),
    service_scope: template.service_scope || 'cung cấp dịch vụ theo nội dung báo giá đính kèm',
    schedule_rows: normalizeArray(template.schedule_rows, []),
    quote_table_config: quoteTableConfig,
    payment_config: {
      ...DEFAULT_PAYMENT_CONFIG,
      ...(template.payment_config || {}),
      payment_documents: normalizeArray(template.payment_config?.payment_documents, DEFAULT_PAYMENT_CONFIG.payment_documents),
    },
    content_sections: contentSections,
    terms_text: template.terms_text !== undefined ? String(template.terms_text) : sectionsToTermsText(contentSections),
  }
}

export function mergeDefaultContractTemplates(templates = []) {
  const rows = Array.isArray(templates) ? templates.map(normalizeContractTemplate) : []
  const systemIds = new Set(DEFAULT_CONTRACT_TEMPLATES.map(template => template.id))
  const withoutSystem = rows.filter(template => !systemIds.has(template.id) && !LEGACY_DEFAULT_CONTRACT_TEMPLATE_IDS.has(template.id))
  const systemTemplates = DEFAULT_CONTRACT_TEMPLATES.map(template => {
    const override = rows.find(row => row.id === template.id)
    return normalizeContractTemplate({
      ...template,
      ...(override || {}),
      is_system_default: true,
      is_default: false,
    })
  })

  return [...systemTemplates, ...withoutSystem]
    .filter(template => template.is_active !== false)
    .sort((a, b) => Number(a.sort_order || 999) - Number(b.sort_order || 999))
}

export function buildQuoteSnapshot(quote = {}) {
  const items = Array.isArray(quote.items) ? quote.items : []

  return {
    id: quote.id || '',
    quote_number: quote.quote_number || '',
    share_token: quote.share_token || '',
    entity_code: quote.entity_code || '',
    client_name: quote.client_name || quote.customer_name || quote.client?.name || '',
    event_name: quote.event_name || '',
    event_date: quote.event_date || '',
    location: quote.location || '',
    duration_hours: quote.duration_hours || '',
    validity_days: quote.validity_days || '',
    has_vat: quote.has_vat !== false,
    terms_text: quote.terms_text || '',
    subtotal: Number(quote.subtotal || 0),
    travel_fee_total: Number(quote.travel_fee_total || 0),
    overtime_fee_total: Number(quote.overtime_fee_total || 0),
    vat_amount: Number(quote.vat_amount || 0),
    total_amount: Number(quote.total_amount || 0),
    items: items.map((item, index) => ({
      service_code: item.service_code || item.resolved_service_code || '',
      service_name: item.service_name || item.service_name_raw || item.service?.quote_display_name || item.service?.service_name || '',
      unit: item.unit || item.pricing_unit || item.service?.unit || 'Người',
      quantity: Number(item.quantity || 0),
      num_sessions: Number(item.num_sessions || 1),
      billable_duration_hours: item.billable_duration_hours ?? '',
      unit_price: Number(item.unit_price || 0),
      total_price: Number(item.total_price || 0),
      sort_order: item.sort_order ?? index + 1,
      group_code: item.group_code || '',
      group_label: item.group_label || item.event_day || item.day_index || '',
      group_sort_order: item.group_sort_order ?? null,
    })),
  }
}

export function getContractVatMode(snapshot = {}, patch = {}) {
  if (patch.vat_mode === 'included' || patch.vat_mode === 'excluded') return patch.vat_mode
  if (snapshot.vat_mode === 'included' || snapshot.vat_mode === 'excluded') return snapshot.vat_mode
  if (typeof patch.has_vat === 'boolean') return patch.has_vat ? 'included' : 'excluded'
  if (snapshot.has_vat === false) return 'excluded'
  return 'included'
}

export function buildSingleLineQuoteSnapshot(snapshot = {}, patch = {}) {
  const currentItems = Array.isArray(snapshot.items) ? snapshot.items : []
  const firstItem = currentItems[0] || {}
  const quantity = Number(patch.quantity ?? firstItem.quantity ?? 1) || 1
  const numSessions = Number(patch.num_sessions ?? firstItem.num_sessions ?? 1) || 1
  const vatRate = 0.08
  const currentVatMode = getContractVatMode(snapshot)
  const vatMode = getContractVatMode(snapshot, patch)
  const fallbackInputAmount = Number(snapshot.contract_value_input || 0) ||
    (currentVatMode === 'included'
      ? Number(snapshot.total_amount || firstItem.total_price || firstItem.unit_price || 0)
      : Number(snapshot.subtotal || firstItem.total_price || firstItem.unit_price || snapshot.total_amount || 0))
  const inputAmount = Number(patch.amount ?? patch.unit_price ?? fallbackInputAmount) || 0
  const subtotal = vatMode === 'included'
    ? Math.round(inputAmount / (1 + vatRate))
    : inputAmount
  const vatAmount = vatMode === 'included'
    ? inputAmount - subtotal
    : Math.round(subtotal * vatRate)
  const totalAmount = vatMode === 'included'
    ? inputAmount
    : subtotal + vatAmount
  const unitPrice = Math.round(subtotal / Math.max(1, quantity * numSessions))

  const nextItem = {
    service_code: firstItem.service_code || 'CONTRACT_TOTAL',
    service_name: patch.service_name ?? firstItem.service_name ?? 'Dịch vụ media theo thỏa thuận',
    unit: patch.unit ?? firstItem.unit ?? 'Gói',
    quantity,
    num_sessions: numSessions,
    unit_price: unitPrice,
    total_price: subtotal,
    sort_order: 1,
  }

  return {
    ...snapshot,
    has_vat: true,
    vat_mode: vatMode,
    contract_value_input: inputAmount,
    subtotal,
    vat_amount: vatAmount,
    total_amount: totalAmount,
    items: [nextItem],
  }
}

function inferServiceScope(quote = {}, template = {}) {
  if (template.service_scope) return template.service_scope
  const itemNames = [...new Set((quote.items || []).map(item => item.service_name || item.service_name_raw).filter(Boolean))]
  if (!itemNames.length) return 'cung cấp dịch vụ theo nội dung báo giá đính kèm'
  return `cung cấp ${itemNames.slice(0, 4).join(', ')}`
}

function buildScheduleRows(quote = {}, template = {}) {
  if (quote.event_date || quote.location) {
    return [{
      time_range: quote.duration_hours ? `${quote.duration_hours} giờ` : '',
      date_text: quote.event_date || '',
      location: quote.location || '',
    }]
  }

  return normalizeArray(template.schedule_rows, [])
}

export function buildInitialContractDraft(quote = {}, templateInput = DEFAULT_CONTRACT_TEMPLATES[0]) {
  const template = normalizeContractTemplate(templateInput)
  const sellerEntityCode = quote.entity_code || template.seller_entity_code || 'EVENTUS'
  const contractNumberPattern = applySellerEntityToContractNumberPattern(template.contract_number_pattern, sellerEntityCode)

  return {
    id: '',
    quote_id: quote.id || '',
    quote_number: quote.quote_number || '',
    source_type: quote.source_type || 'quote',
    external_job_id: quote.external_job_id || null,
    share_token: '',
    contract_number: generateContractNumber(contractNumberPattern, quote),
    status: 'draft',
    template_id: template.id || DEFAULT_CONTRACT_TEMPLATE_ID,
    title: template.title || DEFAULT_CONTRACT_TITLE,
    seller_entity_code: sellerEntityCode,
    seller_snapshot: getEntityProfile(sellerEntityCode),
    customer_snapshot: getCustomerProfileFromQuote(quote),
    party_role_config: template.party_role_config,
    contract_number_pattern: contractNumberPattern,
    signing_date: quote.signing_date || quote.quote_table_config?.signing_date || getTodayInputDate(),
    preamble: template.preamble,
    service_scope: inferServiceScope(quote, template),
    schedule_rows: buildScheduleRows(quote, template),
    quote_table_config: template.quote_table_config,
    payment_config: template.payment_config,
    content_sections: template.content_sections,
    terms_text: template.terms_text || sectionsToTermsText(template.content_sections),
    quote_snapshot: buildQuoteSnapshot(quote),
    source_snapshot: quote.source_snapshot || {},
  }
}

export function buildInitialContractDraftFromSource(source = {}, templateInput = DEFAULT_CONTRACT_TEMPLATES[0]) {
  const template = normalizeContractTemplate(templateInput)
  const quoteSnapshot = source.quote_snapshot || {}
  const sourceSnapshot = source.source_snapshot || {}
  const sourceType = source.source_type || sourceSnapshot.source_type || 'manual'
  const sellerEntityCode = source.entity_code || quoteSnapshot.entity_code || template.seller_entity_code || 'EVENTUS'
  const customerSnapshot = source.customer_snapshot || sourceSnapshot.customer_snapshot || getCustomerProfileFromQuote(quoteSnapshot)
  const contractNumberPattern = applySellerEntityToContractNumberPattern(template.contract_number_pattern, sellerEntityCode)
  const contractNumberSource = {
    ...quoteSnapshot,
    source_code: source.source_code || (source.external_job_id ? `JOB${source.external_job_id}` : ''),
    external_job_id: source.external_job_id,
    client_name: customerSnapshot.company_name || quoteSnapshot.client_name,
  }

  return {
    id: '',
    quote_id: source.quote_id || '',
    quote_number: source.quote_number || '',
    source_type: sourceType,
    external_job_id: source.external_job_id || null,
    share_token: '',
    contract_number: source.contract_number || generateContractNumber(contractNumberPattern, contractNumberSource),
    status: 'draft',
    template_id: template.id || DEFAULT_CONTRACT_TEMPLATE_ID,
    title: template.title || DEFAULT_CONTRACT_TITLE,
    seller_entity_code: sellerEntityCode,
    seller_snapshot: getEntityProfile(sellerEntityCode),
    customer_snapshot: customerSnapshot,
    party_role_config: template.party_role_config,
    contract_number_pattern: contractNumberPattern,
    signing_date: source.signing_date || source.quote_table_config?.signing_date || getTodayInputDate(),
    preamble: template.preamble,
    service_scope: source.service_scope || inferServiceScope(quoteSnapshot, template),
    schedule_rows: Array.isArray(source.schedule_rows) && source.schedule_rows.length
      ? source.schedule_rows
      : buildScheduleRows(quoteSnapshot, template),
    quote_table_config: template.quote_table_config,
    payment_config: template.payment_config,
    content_sections: template.content_sections,
    terms_text: template.terms_text || sectionsToTermsText(template.content_sections),
    quote_snapshot: {
      ...buildQuoteSnapshot(quoteSnapshot),
      ...(quoteSnapshot || {}),
    },
    source_snapshot: sourceSnapshot,
  }
}

const SMALL_NUMBERS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín']

function readTriple(number, full = false) {
  const hundred = Math.floor(number / 100)
  const ten = Math.floor((number % 100) / 10)
  const unit = number % 10
  const parts = []

  if (hundred > 0 || full) parts.push(hundred > 0 ? `${SMALL_NUMBERS[hundred]} trăm` : 'không trăm')
  if (ten > 1) {
    parts.push(`${SMALL_NUMBERS[ten]} mươi`)
    if (unit === 1) parts.push('mốt')
    else if (unit === 5) parts.push('lăm')
    else if (unit > 0) parts.push(SMALL_NUMBERS[unit])
  } else if (ten === 1) {
    parts.push('mười')
    if (unit === 5) parts.push('lăm')
    else if (unit > 0) parts.push(SMALL_NUMBERS[unit])
  } else if (unit > 0) {
    if (hundred > 0 || full) parts.push('lẻ')
    parts.push(SMALL_NUMBERS[unit])
  }

  return parts.join(' ')
}

export function numberToVietnameseWords(value) {
  const number = Math.round(Number(value) || 0)
  if (number === 0) return 'Không đồng'

  const units = ['', 'nghìn', 'triệu', 'tỷ']
  const groups = []
  let rest = number
  while (rest > 0) {
    groups.push(rest % 1000)
    rest = Math.floor(rest / 1000)
  }

  const words = []
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index]
    if (group === 0) continue
    words.push(readTriple(group, index < groups.length - 1))
    if (units[index]) words.push(units[index])
  }

  const text = words.join(' ').replace(/\s+/g, ' ').trim()
  return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`
}
