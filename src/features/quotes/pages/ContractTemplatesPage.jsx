import { useEffect, useMemo, useState } from 'react'
import { CopyPlus, Eye, Plus, Save, Trash2 } from 'lucide-react'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import {
  deleteContractTemplate,
  listContractTemplates,
  saveContractTemplate,
} from '../hooks/useContracts'
import {
  DEFAULT_CONTRACT_PREAMBLE,
  DEFAULT_PARTY_ROLE_CONFIG,
  DEFAULT_CONTRACT_TEMPLATES,
  DEFAULT_PAYMENT_CONFIG,
  DEFAULT_QUOTE_TABLE_CONFIG,
  normalizeContractTemplate,
  sectionsToTermsText,
  termsTextToSections,
} from '../lib/contractDefaults'
import ContractPreviewModal from '../components/ContractPreviewModal'

const EMPTY_TEMPLATE = normalizeContractTemplate({
  id: '',
  name: '',
  description: '',
  title: 'HỢP ĐỒNG CUNG CẤP DỊCH VỤ',
  seller_entity_code: 'EVENTUS',
  is_default: false,
  is_active: true,
  sort_order: 100,
})

function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">{label}</span>
      {children}
    </label>
  )
}

function Input(props) {
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

function splitLines(value = '') {
  return String(value || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

function formatLastEdited(template = {}) {
  const rawDate = template.updated_at || template.created_at
  if (!rawDate) return 'Chỉnh sửa lần cuối lúc chưa có dữ liệu'

  const date = new Date(rawDate)
  if (Number.isNaN(date.getTime())) return 'Chỉnh sửa lần cuối lúc chưa có dữ liệu'

  return `Chỉnh sửa lần cuối lúc ${new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)}`
}

function getServiceScopeDetail(value = '') {
  return String(value || '').replace(/^cung cấp\s+/i, '').trim()
}

function composeServiceScope(detail = '') {
  const text = String(detail || '').trim()
  return text ? `cung cấp ${text}` : ''
}

function DeleteConfirmModal({ templateName, saving, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-[18px] font-semibold text-slate-950">Xoá mẫu hợp đồng</h2>
        <p className="mt-3 text-[13px] leading-6 text-slate-600">
          Bạn có muốn xoá mẫu hợp đồng <span className="font-semibold text-slate-950">{templateName || 'này'}</span> này không?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {saving ? 'Đang xoá...' : 'Xoá mẫu'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function ContractTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(EMPTY_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)

  const selectedTemplate = useMemo(
    () => templates.find(template => template.id === selectedId) || null,
    [templates, selectedId],
  )
  const systemTemplateIds = useMemo(() => new Set(DEFAULT_CONTRACT_TEMPLATES.map(template => template.id)), [])
  const isSystemDefault = systemTemplateIds.has(draft.id) || draft.is_system_default

  async function loadTemplates(nextSelectedId = '') {
    setLoading(true)
    setError('')
    try {
      const rows = await listContractTemplates()
      setTemplates(rows)
      const selected = rows.find(row => row.id === nextSelectedId) || rows[0] || EMPTY_TEMPLATE
      setSelectedId(selected.id || '')
      setDraft(normalizeContractTemplate({ ...EMPTY_TEMPLATE, ...selected }))
    } catch (err) {
      setError(err?.message || 'Không tải được mẫu hợp đồng.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  function selectTemplate(template) {
    setSelectedId(template.id)
    setDraft(normalizeContractTemplate({ ...EMPTY_TEMPLATE, ...template }))
    setNotice('')
    setError('')
    setPreviewOpen(false)
    setDeleteConfirmOpen(false)
  }

  function updateDraft(patch) {
    setDraft(prev => normalizeContractTemplate({ ...prev, ...patch }))
    setNotice('')
  }

  function updatePaymentConfig(patch) {
    updateDraft({
      payment_config: {
        ...draft.payment_config,
        ...patch,
      },
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

  function updateTermsText(value) {
    updateDraft({
      terms_text: value,
      content_sections: termsTextToSections(value),
    })
  }

  function createNew() {
    setSelectedId('')
    setDraft(normalizeContractTemplate({
      ...EMPTY_TEMPLATE,
      name: 'Mẫu hợp đồng mới',
      is_default: false,
      sort_order: templates.length + 10,
    }))
    setNotice('')
    setError('')
    setPreviewOpen(false)
    setDeleteConfirmOpen(false)
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      setError('Tên mẫu hợp đồng là bắt buộc.')
      return
    }
    const termsText = String(draft.terms_text ?? sectionsToTermsText(draft.content_sections)).trim()
    if (!termsText) {
      setError('Nội dung từ ĐIỀU 3 trở đi là bắt buộc.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const payload = {
        ...draft,
        party_role_config: DEFAULT_PARTY_ROLE_CONFIG,
        quote_table_config: {
          ...DEFAULT_QUOTE_TABLE_CONFIG,
          ...(draft.quote_table_config || {}),
          placement: DEFAULT_QUOTE_TABLE_CONFIG.placement,
        },
        preamble: DEFAULT_CONTRACT_PREAMBLE,
        terms_text: termsText,
        content_sections: termsTextToSections(termsText),
      }
      const saved = await saveContractTemplate(payload)
      setNotice(isSystemDefault ? 'Đã lưu thành mẫu hợp đồng mới.' : 'Đã lưu mẫu hợp đồng.')
      await loadTemplates(saved.id)
    } catch (err) {
      setError(err?.message || 'Không lưu được mẫu hợp đồng.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelected() {
    if (!draft.id || isSystemDefault) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await deleteContractTemplate(draft.id)
      setNotice('Đã xoá mẫu hợp đồng.')
      setDeleteConfirmOpen(false)
      await loadTemplates()
    } catch (err) {
      setError(err?.message || 'Không xoá được mẫu hợp đồng.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <QuoteBreadcrumb items={[{ label: 'Mẫu hợp đồng' }]} />
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">Mẫu hợp đồng</h1>
          <p className="mt-1 text-[13px] text-slate-500">Quản lý cấu trúc hợp đồng: lịch triển khai, thanh toán và điều khoản.</p>
        </div>
        <button
          type="button"
          onClick={createNew}
          className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500"
        >
          <CopyPlus className="h-4 w-4" />
          Mẫu mới
        </button>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{notice}</p>}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Danh sách Form Hợp đồng</div>
          <div className="mt-2 space-y-2">
            {loading ? (
              <p className="px-2 py-6 text-center text-[13px] text-slate-400">Đang tải...</p>
            ) : templates.length ? templates.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => selectTemplate(template)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${selectedTemplate?.id === template.id ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-white hover:bg-slate-50'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-slate-900">{template.name}</span>
                  {template.is_default ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Default</span> : null}
                </div>
                {template.title ? <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-slate-500">{template.title}</p> : null}
              </button>
            )) : (
              <p className="px-2 py-6 text-center text-[13px] text-slate-400">Chưa có mẫu hợp đồng.</p>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Tên mẫu">
                <Input value={draft.name} onChange={event => updateDraft({ name: event.target.value })} />
              </Field>
              <Field label="Thứ tự">
                <Input type="number" value={draft.sort_order} onChange={event => updateDraft({ sort_order: Number(event.target.value) })} />
              </Field>
              <Field label="Tiêu đề hợp đồng">
                <Input value={draft.title || ''} onChange={event => updateDraft({ title: event.target.value })} />
              </Field>
              <Field label="Format số hợp đồng">
                <Input value={draft.contract_number_pattern || ''} onChange={event => updateDraft({ contract_number_pattern: event.target.value })} />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-700">
                <input type="checkbox" checked={Boolean(draft.is_default)} onChange={event => updateDraft({ is_default: event.target.checked })} className="h-4 w-4 accent-[#f8981d]" />
                Đặt làm mẫu mặc định
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold text-slate-900">Phần mở đầu</h2>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-center">
              <p className="text-[13px] uppercase text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
              <p className="text-[13px] text-slate-950">Độc lập – Tự do – Hạnh phúc</p>
            </div>
            <div className="mt-4 rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-400">Căn cứ hợp đồng</p>
              <div className="mt-2 space-y-1 text-[13px] leading-6 text-slate-700">
                {DEFAULT_CONTRACT_PREAMBLE.map(line => <p key={line}>{line}</p>)}
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-slate-100 bg-white px-4 py-3 text-[13px] leading-6 text-slate-700">
              <p>Hợp đồng cung cấp dịch vụ (sau đây gọi tắt là “Hợp đồng”) được lập và ký kết ngày <span className="font-semibold text-red-600">Ngày ký hợp đồng</span> giữa các bên gồm:</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[13px] leading-6 text-slate-700">Sau khi thỏa thuận, Các Bên đồng ý ký kết Hợp Đồng này theo các điều khoản sau:</p>
            <h2 className="mt-3 text-[16px] font-semibold text-slate-900">ĐIỀU 1: NỘI DUNG HỢP ĐỒNG</h2>
            <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-700">
              <span>Bên A đề nghị Bên B và Bên B đồng ý cung cấp </span>
              <span className="font-semibold text-slate-900">{getServiceScopeDetail(draft.service_scope) || 'Nội dung dịch vụ'}</span>
              <span> cho Bên A, chi tiết như sau:</span>
            </div>
            <Field label="Nội dung dịch vụ sau chữ “cung cấp”" className="mt-4">
              <Textarea rows={3} value={getServiceScopeDetail(draft.service_scope)} onChange={event => updateDraft({ service_scope: composeServiceScope(event.target.value) })} />
            </Field>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[13px] font-semibold text-slate-700">Thời gian / Địa điểm</h3>
                <button type="button" onClick={addScheduleRow} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                  <Plus className="h-3.5 w-3.5" />
                  Thêm lịch
                </button>
              </div>
              {draft.schedule_rows.length ? draft.schedule_rows.map((row, index) => (
                <div key={`${row.date_text}-${index}`} className="grid gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[150px_180px_minmax(0,1fr)_70px]">
                  <Input placeholder="Giờ" value={row.time_range || ''} onChange={event => updateScheduleRow(index, { time_range: event.target.value })} />
                  <Input placeholder="Ngày" value={row.date_text || ''} onChange={event => updateScheduleRow(index, { date_text: event.target.value })} />
                  <Input placeholder="Địa điểm" value={row.location || ''} onChange={event => updateScheduleRow(index, { location: event.target.value })} />
                  <button type="button" onClick={() => removeScheduleRow(index)} className="rounded-lg px-2 text-[12px] font-semibold text-red-600 hover:bg-red-50">Xoá</button>
                </div>
              )) : (
                <p className="rounded-xl bg-slate-50 px-3 py-3 text-[12px] text-slate-400">Chưa có thời gian / địa điểm. Khi tạo hợp đồng, hệ thống sẽ gợi ý từ ngày/địa điểm trong quote nếu có.</p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-[16px] font-semibold text-slate-900">Thanh toán</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Field label="Tạm ứng (%)">
                <Input type="number" min="0" max="100" value={draft.payment_config?.deposit_percent ?? DEFAULT_PAYMENT_CONFIG.deposit_percent} onChange={event => updatePaymentConfig({ deposit_percent: Number(event.target.value) })} />
              </Field>
              <Field label="Hạn thanh toán lần 2">
                <Input type="number" min="0" value={draft.payment_config?.final_due_days ?? DEFAULT_PAYMENT_CONFIG.final_due_days} onChange={event => updatePaymentConfig({ final_due_days: Number(event.target.value) })} />
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Field label="Nội dung từ ĐIỀU 3 trở đi">
              <Textarea
                rows={18}
                value={draft.terms_text ?? sectionsToTermsText(draft.content_sections)}
                onChange={event => updateTermsText(event.target.value)}
              />
            </Field>
          </section>

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[12px] text-slate-500">
              {formatLastEdited(draft)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={!draft.id || isSystemDefault || saving}
                className="inline-flex items-center gap-2 rounded-xl border border-red-100 px-4 py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
                Xoá
              </button>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-4 py-2.5 text-[13px] font-semibold text-[#d97706] hover:bg-orange-50"
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {saving ? 'Đang lưu...' : (isSystemDefault ? 'Lưu thành mẫu mới' : 'Lưu mẫu')}
              </button>
            </div>
          </section>
        </div>
      </div>
      {previewOpen ? <ContractPreviewModal contract={draft} onClose={() => setPreviewOpen(false)} /> : null}
      {deleteConfirmOpen ? (
        <DeleteConfirmModal
          templateName={draft.name}
          saving={saving}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={deleteSelected}
        />
      ) : null}
    </div>
  )
}
