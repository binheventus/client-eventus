import { useEffect, useMemo, useState } from 'react'
import { FileSignature, Plus, Save, X } from 'lucide-react'
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
  generateContractNumber,
  getDefaultTemplate,
  getEntityProfile,
  normalizeContractTemplate,
  sectionsToTermsText,
} from '../lib/contractDefaults'
import ContractDocumentDownloads from './ContractDocumentDownloads'

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
      className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none transition focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 ${props.className || ''}`}
    />
  )
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-xl border border-slate-200 px-3 py-3 text-[13px] leading-6 outline-none transition focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100 ${props.className || ''}`}
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

function ProfileFields({ title, value = {}, onChange, companyLabel = 'Tên pháp nhân', type = 'customer' }) {
  function update(key, nextValue) {
    onChange?.({ ...value, [key]: nextValue })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="text-[14px] font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label={companyLabel} className="md:col-span-2">
          <TextInput value={value.company_name || value.legal_name || ''} onChange={event => update(value.company_name !== undefined ? 'company_name' : 'legal_name', event.target.value)} />
        </Field>
        <Field label="Mã số thuế / CCCD">
          <TextInput value={value.tax_code || ''} onChange={event => update('tax_code', event.target.value)} />
        </Field>
        <Field label="Người đại diện">
          <TextInput value={value.representative || ''} onChange={event => update('representative', event.target.value)} />
        </Field>
        <Field label="Chức vụ">
          <TextInput value={value.position || ''} onChange={event => update('position', event.target.value)} />
        </Field>
        <Field label="Email">
          <TextInput value={value.email || ''} onChange={event => update('email', event.target.value)} />
        </Field>
        <Field label={type === 'seller' ? 'Hotline' : 'Số điện thoại'}>
          <TextInput value={value.phone || ''} onChange={event => update('phone', event.target.value)} />
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
            <Field label="Số tài khoản">
              <TextInput value={value.bank_account || ''} onChange={event => update('bank_account', event.target.value)} />
            </Field>
            <Field label="Ngân hàng">
              <TextInput value={value.bank_name || ''} onChange={event => update('bank_name', event.target.value)} />
            </Field>
            <Field label="Chủ tài khoản" className="md:col-span-2">
              <TextInput value={value.bank_account_holder || ''} onChange={event => update('bank_account_holder', event.target.value)} />
            </Field>
          </>
        )}
        <Field label="Địa chỉ" className="md:col-span-2">
          <TextInput value={value.address || ''} onChange={event => update('address', event.target.value)} />
        </Field>
      </div>
    </section>
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

function getRoleLabel(role) {
  return role === 'seller' ? 'Công ty mình' : 'Khách hàng'
}

function getPartySummary(draft = {}) {
  const partyA = draft.party_role_config?.party_a || 'customer'
  const partyB = draft.party_role_config?.party_b || 'seller'
  return `Bên A: ${getRoleLabel(partyA)} · Bên B: ${getRoleLabel(partyB)}`
}

function splitLines(value = '') {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
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
  const selectedTemplate = templates.find(template => template.id === draft?.template_id) || null

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
      terms_text: sectionsToTermsText(normalizedTemplate.content_sections),
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

  function updateSection(index, patch) {
    updateDraft({
      content_sections: draft.content_sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
    })
  }

  function validate() {
    if (!draft) return 'Chưa có dữ liệu hợp đồng.'
    if (!draft.id && !quoteIsReady) return 'Chỉ báo giá đã lưu hoàn thiện mới được tạo hợp đồng.'
    if (!String(draft.customer_snapshot?.legal_name || '').trim()) return 'Cần nhập tên pháp nhân khách hàng.'
    if (!String(draft.service_scope || '').trim()) return 'Cần nhập nội dung dịch vụ.'
    if (!draft.content_sections?.length) return 'Cần có ít nhất một điều khoản.'
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
      const saved = await saveContract({
        ...draft,
        status: draft.status === 'draft' ? 'generated' : draft.status,
        terms_text: sectionsToTermsText(draft.content_sections),
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

  const downloadableContract = savedContract && !dirty ? {
    ...draft,
    quote_snapshot: savedContract.quote_snapshot || quoteSnapshot,
  } : null

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-slate-950/45">
      <div className="h-full w-full max-w-6xl overflow-y-auto bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                <FileSignature className="h-4 w-4" />
                Hợp đồng từ báo giá
              </div>
              <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-slate-950">
                {draft?.contract_number || 'Tạo hợp đồng'}
              </h2>
              <p className="mt-1 text-[13px] text-slate-500">
                Báo giá {quote?.quote_number || quote?.id || '-'} · {quote?.client_name || quote?.customer_name || 'Khách hàng'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="space-y-4 px-5 py-5">
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
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
                  <Field label="Mẫu hợp đồng">
                    <Select value={draft.template_id || ''} onChange={event => handleTemplateChange(event.target.value)}>
                      {templates.map(template => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tiêu đề hợp đồng">
                    <TextInput value={draft.title || ''} onChange={event => updateDraft({ title: event.target.value })} />
                  </Field>
                  <Field label="Số hợp đồng">
                    <TextInput value={draft.contract_number || ''} onChange={event => updateDraft({ contract_number: event.target.value })} />
                  </Field>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <Field label="Format số hợp đồng">
                    <TextInput value={draft.contract_number_pattern || ''} onChange={event => updateDraft({ contract_number_pattern: event.target.value })} />
                  </Field>
                  <Field label="Vai trò">
                    <TextInput value={getPartySummary(draft)} readOnly className="bg-slate-50 text-slate-500" />
                  </Field>
                </div>
                {selectedTemplate?.description ? (
                  <p className="mt-2 text-[12px] text-slate-500">{selectedTemplate.description}</p>
                ) : null}
              </section>

              <div className="grid gap-4 xl:grid-cols-2">
                <section className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <Field label="Pháp nhân bên mình">
                      <Select value={draft.seller_entity_code || quote?.entity_code || 'EVENTUS'} onChange={event => handleSellerEntityChange(event.target.value)}>
                        {legalEntities.map(entity => {
                          const code = entity.entity_code || entity.code
                          return <option key={code} value={code}>{entity.display_name || entity.legal_name || code}</option>
                        })}
                      </Select>
                    </Field>
                  </div>
                  <ProfileFields title="Thông tin bên mình" value={draft.seller_snapshot} onChange={updateSeller} type="seller" />
                </section>

                <ProfileFields
                  title="Thông tin pháp nhân khách hàng"
                  value={draft.customer_snapshot}
                  onChange={updateCustomer}
                  companyLabel="Tên công ty / cá nhân"
                  type="customer"
                />
              </div>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-[14px] font-semibold text-slate-900">Nội dung dịch vụ & lịch triển khai</h3>
                <Field label="Mô tả dịch vụ" className="mt-4">
                  <Textarea rows={3} value={draft.service_scope || ''} onChange={event => updateDraft({ service_scope: event.target.value })} />
                </Field>
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[12px] font-semibold text-slate-600">Lịch triển khai</span>
                    <button type="button" onClick={addScheduleRow} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                      <Plus className="h-3.5 w-3.5" />
                      Thêm lịch
                    </button>
                  </div>
                  {draft.schedule_rows.length ? draft.schedule_rows.map((row, index) => (
                    <div key={`${row.date_text}-${index}`} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[150px_180px_minmax(0,1fr)_70px]">
                      <TextInput placeholder="Giờ" value={row.time_range || ''} onChange={event => updateScheduleRow(index, { time_range: event.target.value })} />
                      <TextInput placeholder="Ngày" value={row.date_text || ''} onChange={event => updateScheduleRow(index, { date_text: event.target.value })} />
                      <TextInput placeholder="Địa điểm" value={row.location || ''} onChange={event => updateScheduleRow(index, { location: event.target.value })} />
                      <button type="button" onClick={() => removeScheduleRow(index)} className="rounded-lg px-2 text-[12px] font-semibold text-red-600 hover:bg-red-50">Xoá</button>
                    </div>
                  )) : (
                    <p className="rounded-xl bg-slate-50 px-3 py-3 text-[12px] text-slate-400">Chưa có lịch triển khai.</p>
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-[14px] font-semibold text-slate-900">Thanh toán</h3>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
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
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-[14px] font-semibold text-slate-900">Điều khoản</h3>
                <div className="mt-4 space-y-4">
                  {draft.content_sections.map((section, index) => (
                    <div key={section.id || index} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)]">
                        <Field label="Điều số">
                          <TextInput type="number" min="1" value={section.article_no || index + 1} onChange={event => updateSection(index, { article_no: Number(event.target.value) })} />
                        </Field>
                        <Field label="Tiêu đề">
                          <TextInput value={section.title || ''} onChange={event => updateSection(index, { title: event.target.value })} />
                        </Field>
                      </div>
                      <Field label="Nội dung" className="mt-3">
                        <Textarea rows={6} value={section.body || ''} onChange={event => updateSection(index, { body: event.target.value })} />
                      </Field>
                    </div>
                  ))}
                </div>
              </section>

              <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <h3 className="text-[14px] font-semibold text-slate-900">Xuất hợp đồng</h3>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {dirty || !savedContract ? 'Lưu hợp đồng trước khi tải file mới.' : 'Bản PDF và DOCX dùng dữ liệu hợp đồng đã lưu.'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={saving || loading || (!quoteIsReady && !savedContract)}
                    onClick={handleSave}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    {saving ? 'Đang lưu...' : 'Lưu hợp đồng'}
                  </button>
                  <ContractDocumentDownloads contract={downloadableContract} disabled={!downloadableContract} />
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  )
}
