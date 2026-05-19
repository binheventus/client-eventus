import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, FileSignature, Landmark, Plus, Save, Trash2, X } from 'lucide-react'
import { useLegalEntities } from '../hooks/useLegalEntities'
import {
  createContractDraftFromQuote,
  getContractByQuoteId,
  listContractTemplates,
  saveContract,
} from '../hooks/useContracts'
import {
  buildQuoteSnapshot,
  canCreateContractFromQuote,
  DEFAULT_CONTRACT_PREAMBLE,
  generateContractNumber,
  getDefaultTemplate,
  getEntityProfile,
  normalizeContractTemplate,
  sectionsToTermsText,
  termsTextToSections,
} from '../lib/contractDefaults'
import ContractDocumentDownloads from './ContractDocumentDownloads'
import QuoteBreadcrumb from './QuoteBreadcrumb'

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none transition placeholder:text-slate-300 focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-50 disabled:text-slate-400 ${props.className || ''}`}
    />
  )
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] leading-6 outline-none transition placeholder:text-slate-300 focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 ${props.className || ''}`}
    />
  )
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none transition focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 ${props.className || ''}`}
    />
  )
}

function SectionCard({ icon: Icon, title, children, action }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-orange-50 text-[#d97706]">
              <Icon className="h-4 w-4" />
            </span>
          ) : null}
          <h3 className="text-[16px] font-semibold text-slate-900">{title}</h3>
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function splitLines(value = '') {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function hasText(value) {
  return String(value ?? '').trim().length > 0
}

function getServiceScopeDetail(value = '') {
  return String(value || '').replace(/^cung cấp\s+/i, '').trim()
}

function composeServiceScope(detail = '') {
  const text = String(detail || '').trim()
  return text ? `cung cấp ${text}` : ''
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function getQuoteItemName(item = {}) {
  return item.service_name || item.service_name_raw || item.service?.quote_display_name || item.service?.service_name || item.service_code || 'Hạng mục'
}

function SummaryRow({ label, value, strong = false }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className={`mt-1 text-[13px] leading-5 ${strong ? 'font-semibold text-slate-950' : 'text-slate-700'}`}>
        {hasText(value) ? value : '-'}
      </dd>
    </div>
  )
}

function ProfileFields({ title, eyebrow, value = {}, onChange, companyLabel = 'Tên pháp nhân', type = 'customer', headerAction = null }) {
  const companyKey = value.company_name !== undefined ? 'company_name' : 'legal_name'
  const gridClass = type === 'seller' ? 'md:grid-cols-6' : 'md:grid-cols-2'
  const halfClass = type === 'seller' ? 'md:col-span-3' : ''
  const addressClass = type === 'seller' ? 'md:col-span-6' : 'md:col-span-2'
  const fieldsLocked = type === 'seller'
  const lockedInputClass = fieldsLocked ? 'bg-slate-50 text-slate-500' : ''

  function update(key, nextValue) {
    onChange?.({ ...value, [key]: nextValue })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {headerAction || (
        <div>
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</p> : null}
          <h3 className="mt-1 text-[16px] font-semibold text-slate-900">{title}</h3>
        </div>
      )}

      <div className={`mt-4 grid gap-3 ${gridClass}`}>
        <Field label={companyLabel} className={halfClass}>
          <TextInput value={value[companyKey] || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update(companyKey, event.target.value)} />
        </Field>
        <Field label="Mã số thuế / CCCD" className={halfClass}>
          <TextInput value={value.tax_code || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('tax_code', event.target.value)} />
        </Field>
        <Field label="Người đại diện" className={halfClass}>
          <TextInput value={value.representative || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('representative', event.target.value)} />
        </Field>
        <Field label="Chức vụ" className={halfClass}>
          <TextInput value={value.position || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('position', event.target.value)} />
        </Field>
        <Field label="Email" className={halfClass}>
          <TextInput value={value.email || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('email', event.target.value)} />
        </Field>
        <Field label={type === 'seller' ? 'Hotline' : 'Số điện thoại'} className={halfClass}>
          <TextInput value={value.phone || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('phone', event.target.value)} />
        </Field>
        {type === 'customer' ? (
          <>
            <Field label="Giấy uỷ quyền số">
              <TextInput value={value.authorization_number || ''} onChange={event => update('authorization_number', event.target.value)} />
            </Field>
            <Field label="Ngày giấy uỷ quyền">
              <TextInput value={value.authorization_date || ''} onChange={event => update('authorization_date', event.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Số tài khoản" className="md:col-span-2">
              <TextInput value={value.bank_account || ''} readOnly className={lockedInputClass} onChange={event => update('bank_account', event.target.value)} />
            </Field>
            <Field label="Ngân hàng" className="md:col-span-4">
              <TextInput value={value.bank_name || ''} readOnly className={lockedInputClass} onChange={event => update('bank_name', event.target.value)} />
            </Field>
          </>
        )}
        <Field label="Địa chỉ" className={addressClass}>
          <TextInput value={value.address || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('address', event.target.value)} />
        </Field>
      </div>
    </section>
  )
}

function QuoteItemsTable({ quoteSnapshot = {} }) {
  const items = Array.isArray(quoteSnapshot.items) ? quoteSnapshot.items : []

  return (
    <SectionCard icon={FileSignature} title="Phụ lục báo giá">
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="sticky top-0 z-[1] bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="w-12 px-4 py-3">#</th>
                <th className="px-4 py-3">Hạng mục</th>
                <th className="px-4 py-3 text-right">SL</th>
                <th className="px-4 py-3 text-right">Buổi</th>
                <th className="px-4 py-3 text-right">Đơn giá</th>
                <th className="px-4 py-3 text-right">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.length ? items.map((item, index) => (
                <tr key={`${item.service_code || 'item'}-${index}`} className="hover:bg-orange-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-400">{index + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{getQuoteItemName(item)}</div>
                    {item.service_code ? <div className="mt-0.5 text-[11px] text-slate-400">{item.service_code}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.quantity || 0}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.num_sessions || 1}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(item.unit_price)}đ</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatCurrency(item.total_price)}đ</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Chưa có hạng mục báo giá.</td>
                </tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-600">Tổng hợp đồng</td>
                <td className="px-4 py-3 text-right text-[15px] font-bold text-slate-950">{formatCurrency(quoteSnapshot.total_amount)}đ</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </SectionCard>
  )
}

function hydrateContract(contract, quote) {
  const normalized = normalizeContractTemplate(contract)
  return {
    ...contract,
    ...normalized,
    quote_id: contract.quote_id || quote?.id || '',
    quote_number: contract.quote_number || quote?.quote_number || '',
    seller_snapshot: contract.seller_snapshot || getEntityProfile(contract.seller_entity_code || quote?.entity_code),
    customer_snapshot: contract.customer_snapshot || {},
    quote_snapshot: contract.quote_snapshot || buildQuoteSnapshot(quote),
  }
}

export default function ContractEditorModal({
  open,
  quote,
  onClose,
}) {
  const { legalEntities } = useLegalEntities()
  const [templates, setTemplates] = useState([])
  const [draft, setDraft] = useState(null)
  const [savedContract, setSavedContract] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)

  const quoteIsReady = canCreateContractFromQuote(quote)
  const quoteSnapshot = useMemo(() => buildQuoteSnapshot(quote || {}), [quote])

  useEffect(() => {
    if (!open || !quote?.id) return
    let mounted = true

    async function loadContractContext() {
      setLoading(true)
      setError('')
      setNotice('')

      try {
        const [templateRows, existingContract] = await Promise.all([
          listContractTemplates(),
          getContractByQuoteId(quote.id),
        ])

        if (!mounted) return
        const defaultTemplate = getDefaultTemplate(templateRows)
        const nextDraft = existingContract
          ? hydrateContract(existingContract, quote)
          : createContractDraftFromQuote(quote, defaultTemplate)

        setTemplates(templateRows)
        setDraft(nextDraft)
        setSavedContract(existingContract ? hydrateContract(existingContract, quote) : null)
        setDirty(false)
      } catch (err) {
        if (mounted) setError(err?.message || 'Không tải được dữ liệu hợp đồng.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadContractContext()
    return () => {
      mounted = false
    }
  }, [open, quote?.id])

  function updateDraft(patch) {
    setDraft(prev => normalizeContractTemplate({ ...prev, ...patch }))
    setDirty(true)
    setNotice('')
  }

  function updateSeller(profile) {
    updateDraft({ seller_snapshot: profile })
  }

  function updateCustomer(profile) {
    updateDraft({ customer_snapshot: profile })
  }

  function handleSellerEntityChange(entityCode) {
    updateDraft({
      seller_entity_code: entityCode,
      seller_snapshot: getEntityProfile(entityCode),
    })
  }

  function handleTemplateChange(templateId) {
    const template = templates.find(row => row.id === templateId)
    if (!template) return
    const normalizedTemplate = normalizeContractTemplate(template)
    const sellerEntityCode = draft.seller_entity_code || quote?.entity_code || normalizedTemplate.seller_entity_code

    updateDraft({
      template_id: normalizedTemplate.id,
      title: normalizedTemplate.title || draft.title,
      seller_entity_code: sellerEntityCode,
      seller_snapshot: getEntityProfile(sellerEntityCode),
      party_role_config: normalizedTemplate.party_role_config,
      contract_number_pattern: normalizedTemplate.contract_number_pattern,
      contract_number: generateContractNumber(normalizedTemplate.contract_number_pattern, quote),
      preamble: normalizedTemplate.preamble,
      service_scope: normalizedTemplate.service_scope || draft.service_scope,
      schedule_rows: normalizedTemplate.schedule_rows.length ? normalizedTemplate.schedule_rows : draft.schedule_rows,
      quote_table_config: normalizedTemplate.quote_table_config,
      payment_config: normalizedTemplate.payment_config,
      content_sections: normalizedTemplate.content_sections,
      terms_text: normalizedTemplate.terms_text || sectionsToTermsText(normalizedTemplate.content_sections),
    })
  }

  function updateScheduleRow(index, patch) {
    updateDraft({
      schedule_rows: draft.schedule_rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row),
    })
  }

  function addScheduleRow() {
    updateDraft({
      schedule_rows: [
        ...draft.schedule_rows,
        { time_range: '', date_text: '', location: '' },
      ],
    })
  }

  function removeScheduleRow(index) {
    updateDraft({
      schedule_rows: draft.schedule_rows.filter((_, rowIndex) => rowIndex !== index),
    })
  }

  function updatePaymentConfig(patch) {
    updateDraft({
      payment_config: {
        ...draft.payment_config,
        ...patch,
      },
    })
  }

  function updateTermsText(value) {
    updateDraft({
      terms_text: value,
      content_sections: termsTextToSections(value),
    })
  }

  function validate() {
    if (!draft) return 'Chưa có dữ liệu hợp đồng.'
    if (!draft.id && !quoteIsReady) return 'Chỉ báo giá đã lưu hoàn thiện mới được tạo hợp đồng.'
    if (!String(draft.customer_snapshot?.legal_name || '').trim()) return 'Cần nhập tên pháp nhân khách hàng.'
    if (!String(draft.service_scope || '').trim()) return 'Cần nhập nội dung dịch vụ.'
    if (!String(draft.terms_text ?? sectionsToTermsText(draft.content_sections)).trim()) return 'Cần nhập nội dung từ ĐIỀU 3 trở đi.'
    return ''
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const termsText = String(draft.terms_text ?? sectionsToTermsText(draft.content_sections)).trim()
      const saved = await saveContract({
        ...draft,
        status: draft.status === 'draft' ? 'generated' : draft.status,
        terms_text: termsText,
        content_sections: termsTextToSections(termsText),
        quote_snapshot: quoteSnapshot,
      }, { quote })
      const hydrated = hydrateContract(saved, quote)
      setDraft(hydrated)
      setSavedContract(hydrated)
      setDirty(false)
      setNotice('Đã lưu hợp đồng. Bạn có thể tải PDF hoặc DOCX.')
    } catch (err) {
      setError(err?.message || 'Không lưu được hợp đồng.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const savedQuoteSnapshot = savedContract?.quote_snapshot || {}
  const currentQuoteSnapshot = {
    ...quoteSnapshot,
    ...savedQuoteSnapshot,
    share_token: savedQuoteSnapshot.share_token || quoteSnapshot.share_token,
  }
  const downloadableContract = savedContract && !dirty ? {
    ...draft,
    quote_snapshot: currentQuoteSnapshot,
  } : null
  const previewContract = draft ? {
    ...draft,
    quote_snapshot: quoteSnapshot,
  } : null
  const serviceScopeDetail = getServiceScopeDetail(draft?.service_scope)
  const termsText = draft?.terms_text ?? sectionsToTermsText(draft?.content_sections || [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45">
      <section className="flex h-screen max-h-screen w-full flex-col overflow-hidden bg-slate-50 shadow-2xl">
        <header className="border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <QuoteBreadcrumb
                items={[
                  { label: quote?.quote_number || quote?.id || 'Chi tiết báo giá', to: `/quotes/${quote?.id}` },
                  { label: 'Hợp đồng' },
                ]}
              />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="hidden overflow-y-auto border-r border-slate-200 bg-white p-4 xl:block">
            <div className="sticky top-0 space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-[14px] font-semibold text-slate-900">Tổng quan</h3>
                <dl className="mt-3">
                  <SummaryRow label="Hợp đồng" value={draft?.contract_number || 'Tạo hợp đồng'} strong />
                  <SummaryRow label="Báo giá" value={quote?.quote_number || quote?.id} strong />
                  <SummaryRow label="Sự kiện" value={quote?.event_name} />
                  <SummaryRow label="Khách hàng" value={quote?.client_name || quote?.customer_name} />
                  <SummaryRow label="Ngày sự kiện" value={formatDate(quote?.event_date)} />
                  <SummaryRow label="Địa điểm" value={quote?.location} />
                  <SummaryRow label="Tổng tiền" value={`${formatCurrency(quoteSnapshot.total_amount)}đ`} strong />
                </dl>
              </section>

              <section className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-[14px] font-semibold text-slate-900">Trạng thái</h3>
                <div className="mt-3 space-y-2 text-[13px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Hợp đồng</span>
                    <span className="font-semibold text-slate-900">{savedContract ? 'Đã lưu' : 'Chưa lưu'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Thay đổi</span>
                    <span className={`font-semibold ${dirty ? 'text-amber-700' : 'text-emerald-700'}`}>{dirty ? 'Chưa lưu' : 'Đã đồng bộ'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Hạng mục</span>
                    <span className="font-semibold text-slate-900">{quoteSnapshot.items?.length || 0}</span>
                  </div>
                </div>
              </section>
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto px-4 pb-5 pt-0 xl:px-5">
            <div className="space-y-5">
              {loading && <p className="rounded-xl bg-white px-4 py-3 text-[13px] text-slate-500">Đang tải hợp đồng...</p>}
              {!quoteIsReady && !savedContract && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                  Báo giá đang ở trạng thái nháp. Hãy lưu hoàn thiện hoặc tạo link gửi khách trước khi tạo hợp đồng.
                </div>
              )}
              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}
              {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{notice}</p>}

              {draft && !loading && (
                <>
                  <section className="grid gap-3 xl:hidden">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SummaryRow label="Hợp đồng" value={draft?.contract_number || 'Tạo hợp đồng'} strong />
                        <SummaryRow label="Báo giá" value={quote?.quote_number || quote?.id} strong />
                        <SummaryRow label="Tổng tiền" value={`${formatCurrency(quoteSnapshot.total_amount)}đ`} strong />
                      </div>
                    </div>
                  </section>

                  <SectionCard icon={FileSignature} title="Tổng quan hợp đồng">
                    <div className="grid gap-3 lg:grid-cols-[minmax(180px,0.8fr)_minmax(150px,0.65fr)_minmax(260px,1.15fr)]">
                      <Field label="Số hợp đồng">
                        <TextInput value={draft.contract_number || ''} onChange={event => updateDraft({ contract_number: event.target.value })} />
                      </Field>
                      <Field label="Trạng thái">
                        <TextInput value={savedContract ? 'Đã lưu hợp đồng' : 'Hợp đồng mới'} readOnly className="bg-slate-50 text-slate-500" />
                      </Field>
                      <Field label="Format số hợp đồng">
                        <TextInput value={draft.contract_number_pattern || ''} onChange={event => updateDraft({ contract_number_pattern: event.target.value })} />
                      </Field>
                      <Field label="Mẫu hợp đồng">
                        <Select value={draft.template_id || ''} onChange={event => handleTemplateChange(event.target.value)}>
                          {templates.map(template => (
                            <option key={template.id} value={template.id}>{template.name}</option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Tiêu đề hợp đồng" className="lg:col-span-2">
                        <TextInput value={draft.title || ''} onChange={event => updateDraft({ title: event.target.value })} />
                      </Field>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Landmark} title="Phần mở đầu">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
                      <p className="text-[13px] uppercase text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                      <p className="text-[13px] text-slate-950">Độc lập - Tự do - Hạnh phúc</p>
                    </div>
                    <div className="mt-4 rounded-xl border border-slate-100 bg-white px-4 py-3">
                      <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-400">Căn cứ hợp đồng</p>
                      <div className="mt-2 space-y-1 text-[13px] leading-6 text-slate-700">
                        {DEFAULT_CONTRACT_PREAMBLE.map(line => <p key={line}>{line}</p>)}
                      </div>
                    </div>
                  </SectionCard>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <ProfileFields
                      title="Thông tin khách hàng"
                      eyebrow="Bên A"
                      value={draft.customer_snapshot}
                      onChange={updateCustomer}
                      companyLabel="Tên công ty / cá nhân"
                      type="customer"
                    />

                    <ProfileFields
                      title="Thông tin bên mình"
                      eyebrow="Bên B"
                      value={draft.seller_snapshot}
                      onChange={updateSeller}
                      type="seller"
                      headerAction={(
                        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
                          <span className="shrink-0 text-[12px] font-semibold text-slate-600">Chọn pháp nhân bên B</span>
                          <Select className="appearance-none border-orange-300 bg-orange-50 text-center font-semibold text-orange-700 focus:border-[#f8981d] sm:max-w-[108px]" value={draft.seller_entity_code || quote?.entity_code || 'EVENTUS'} onChange={event => handleSellerEntityChange(event.target.value)}>
                            {legalEntities.map(entity => {
                              const code = entity.entity_code || entity.code
                              return <option key={code} value={code}>{entity.display_name || entity.legal_name || code}</option>
                            })}
                          </Select>
                        </div>
                      )}
                    />
                  </div>

                  <SectionCard
                    icon={CalendarDays}
                    title="ĐIỀU 1: Nội dung hợp đồng"
                    action={(
                      <button type="button" onClick={addScheduleRow} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                        <Plus className="h-3.5 w-3.5" />
                        Thêm lịch
                      </button>
                    )}
                  >
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-700">
                      <span>Bên A đề nghị Bên B và Bên B đồng ý cung cấp </span>
                      <span className="font-semibold text-slate-950">{serviceScopeDetail || 'Nội dung dịch vụ'}</span>
                      <span> cho Bên A, chi tiết như sau:</span>
                    </div>
                    <Field label="Nội dung dịch vụ sau chữ “cung cấp”" className="mt-4">
                      <Textarea rows={3} value={serviceScopeDetail} onChange={event => updateDraft({ service_scope: composeServiceScope(event.target.value) })} />
                    </Field>

                    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-[13px]">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                            <tr>
                              <th className="w-[180px] px-4 py-3">Giờ</th>
                              <th className="w-[220px] px-4 py-3">Ngày</th>
                              <th className="px-4 py-3">Địa điểm</th>
                              <th className="w-16 px-4 py-3 text-right">Xoá</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {draft.schedule_rows.length ? draft.schedule_rows.map((row, index) => (
                              <tr key={`${row.date_text}-${index}`}>
                                <td className="px-3 py-3">
                                  <TextInput placeholder="07:45 - 17:00" value={row.time_range || ''} onChange={event => updateScheduleRow(index, { time_range: event.target.value })} />
                                </td>
                                <td className="px-3 py-3">
                                  <TextInput placeholder="08.06.2026" value={row.date_text || ''} onChange={event => updateScheduleRow(index, { date_text: event.target.value })} />
                                </td>
                                <td className="px-3 py-3">
                                  <TextInput placeholder="Địa điểm triển khai" value={row.location || ''} onChange={event => updateScheduleRow(index, { location: event.target.value })} />
                                </td>
                                <td className="px-3 py-3 text-right">
                                  <button type="button" onClick={() => removeScheduleRow(index)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50" aria-label="Xoá lịch">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Chưa có lịch triển khai.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard icon={Landmark} title="Thanh toán">
                    <div className="grid gap-3 md:grid-cols-3">
                      <Field label="Tạm ứng (%)">
                        <TextInput type="number" min="0" max="100" value={draft.payment_config?.deposit_percent ?? 50} onChange={event => updatePaymentConfig({ deposit_percent: Number(event.target.value) })} />
                      </Field>
                      <Field label="Hạn thanh toán lần 2">
                        <TextInput type="number" min="0" value={draft.payment_config?.final_due_days ?? 7} onChange={event => updatePaymentConfig({ final_due_days: Number(event.target.value) })} />
                      </Field>
                      <Field label="Xuất hoá đơn sau tạm ứng">
                        <Select value={draft.payment_config?.issue_invoice_on_deposit ? 'yes' : 'no'} onChange={event => updatePaymentConfig({ issue_invoice_on_deposit: event.target.value === 'yes' })}>
                          <option value="yes">Có</option>
                          <option value="no">Không</option>
                        </Select>
                      </Field>
                    </div>
                    <Field label="Hồ sơ thanh toán, mỗi dòng một mục" className="mt-4">
                      <Textarea
                        rows={4}
                        value={(draft.payment_config?.payment_documents || []).join('\n')}
                        onChange={event => updatePaymentConfig({ payment_documents: splitLines(event.target.value) })}
                      />
                    </Field>
                  </SectionCard>

                  <QuoteItemsTable quoteSnapshot={quoteSnapshot} />

                  <SectionCard title="Nội dung từ ĐIỀU 3 trở đi">
                    <Textarea
                      rows={18}
                      value={termsText}
                      onChange={event => updateTermsText(event.target.value)}
                    />
                  </SectionCard>
                </>
              )}
            </div>
          </main>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <p className="text-[12px] text-slate-500">
            {dirty || !savedContract ? 'Lưu hợp đồng trước khi tải file mới.' : 'Bản PDF và DOCX dùng dữ liệu hợp đồng đã lưu.'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={saving || loading || !draft || (!quoteIsReady && !savedContract)}
              onClick={handleSave}
              className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu...' : 'Lưu hợp đồng'}
            </button>
            <ContractDocumentDownloads contract={downloadableContract} previewContract={previewContract} disabled={!downloadableContract} />
          </div>
        </footer>
      </section>
    </div>
  )
}
