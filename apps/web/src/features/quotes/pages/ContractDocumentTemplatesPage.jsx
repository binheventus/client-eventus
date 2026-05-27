import { useEffect, useMemo, useState } from 'react'
import { CopyPlus, Eye, Plus, Save, Trash2 } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import {
  deleteContractDocumentTemplate,
  listContractDocumentTemplates,
  saveContractDocumentTemplate,
} from '../hooks/useContracts'
import {
  CONTRACT_DOCUMENT_TEMPLATE_SNAPSHOT_RULE,
  CONTRACT_DOCUMENT_TYPES,
  CONTRACT_DOCUMENT_TYPE_ORDER,
  DEFAULT_DOCUMENT_NUMBER_PATTERN,
  documentTermsTextToSections,
  normalizeDocumentTemplate,
  sectionsToDocumentTermsText,
} from '../lib/contractDocumentTemplates'

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

function buildEmptyTemplate(documentType = 'advance_request') {
  const typeConfig = CONTRACT_DOCUMENT_TYPES[documentType] || CONTRACT_DOCUMENT_TYPES.advance_request
  return normalizeDocumentTemplate({
    document_type: documentType,
    name: '',
    description: '',
    title: typeConfig.defaultTitle,
    seller_entity_code: 'EVT',
    document_number_pattern: DEFAULT_DOCUMENT_NUMBER_PATTERN,
    fields_config: {
      required_fields: documentType === 'payment_request'
        ? ['amount', 'issued_date', 'acceptance_document_id']
        : ['amount', 'issued_date'],
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [],
    terms_text: '',
    is_default: false,
    is_active: true,
    sort_order: 100,
  })
}

function DeleteConfirmModal({ templateName, saving, onCancel, onConfirm }) {
  useEscapeToClose(() => {
    if (!saving) onCancel?.()
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-[18px] font-semibold text-slate-950">Xoá mẫu chứng từ</h2>
        <p className="mt-3 text-[13px] leading-6 text-slate-600">
          Bạn có muốn xoá mẫu chứng từ <span className="font-semibold text-slate-950">{templateName || 'này'}</span> này không?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            Huỷ
          </button>
          <button type="button" onClick={onConfirm} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-50">
            <Trash2 className="h-4 w-4" />
            {saving ? 'Đang xoá...' : 'Xoá mẫu'}
          </button>
        </div>
      </section>
    </div>
  )
}

function PreviewPanel({ template }) {
  const sections = Array.isArray(template.content_sections) ? template.content_sections : []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4">
        <p className="text-center text-[13px] uppercase text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p className="text-center text-[13px] text-slate-950">Độc lập - Tự do - Hạnh phúc</p>
        <p className="mt-4 text-center text-[18px] font-bold uppercase tracking-wide text-slate-950">{template.title || 'Tiêu đề chứng từ'}</p>
        <p className="mt-2 text-center text-[13px] font-semibold text-slate-600">Số: {template.document_number_pattern || DEFAULT_DOCUMENT_NUMBER_PATTERN}</p>
      </div>
      <div className="mt-4 space-y-4">
        {sections.length ? sections.map((section, index) => (
          <div key={section.id || `${section.title}-${index}`} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
            <p className="text-[13px] font-semibold text-slate-900">{section.title || `Mục ${index + 1}`}</p>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-slate-600">{section.body || 'Nội dung mục chứng từ.'}</p>
          </div>
        )) : (
          <p className="rounded-xl bg-slate-50 px-4 py-4 text-[13px] text-slate-400">Chưa có section nội dung để preview.</p>
        )}
      </div>
    </section>
  )
}

export default function ContractDocumentTemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [selectedType, setSelectedType] = useState('advance_request')
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(() => buildEmptyTemplate('advance_request'))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [fieldsConfigText, setFieldsConfigText] = useState('{}')
  const [numberingConfigText, setNumberingConfigText] = useState('{}')

  const selectedTemplate = useMemo(
    () => templates.find(template => template.id === selectedId) || null,
    [templates, selectedId],
  )
  const templatesByType = useMemo(
    () => templates
      .filter(template => template.document_type === selectedType)
      .sort((left, right) => Number(left.sort_order || 100) - Number(right.sort_order || 100)),
    [templates, selectedType],
  )
  const isSystemDefault = Boolean(draft.is_system_default)
  const canDelete = Boolean(draft.id) && !isSystemDefault

  async function loadTemplates(nextSelectedId = '', nextType = selectedType) {
    setLoading(true)
    setError('')
    try {
      const rows = await listContractDocumentTemplates()
      setTemplates(rows)
      const selected = rows.find(row => row.id === nextSelectedId)
        || rows.find(row => row.document_type === nextType && row.is_default)
        || rows.find(row => row.document_type === nextType)
        || buildEmptyTemplate(nextType)
      setSelectedType(selected.document_type || nextType)
      setSelectedId(selected.id || '')
      setDraft(normalizeDocumentTemplate(selected))
    } catch (err) {
      setError(err?.message || 'Không tải được mẫu chứng từ.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  useEffect(() => {
    setFieldsConfigText(JSON.stringify(draft.fields_config || {}, null, 2))
    setNumberingConfigText(JSON.stringify(draft.numbering_config || {}, null, 2))
  }, [selectedId, draft.document_type])

  function selectType(documentType) {
    const next = templates.find(row => row.document_type === documentType && row.is_default)
      || templates.find(row => row.document_type === documentType)
      || buildEmptyTemplate(documentType)
    setSelectedType(documentType)
    setSelectedId(next.id || '')
    setDraft(normalizeDocumentTemplate(next))
    setNotice('')
    setError('')
    setPreviewOpen(false)
    setDeleteConfirmOpen(false)
  }

  function selectTemplate(template) {
    setSelectedId(template.id)
    setSelectedType(template.document_type)
    setDraft(normalizeDocumentTemplate(template))
    setNotice('')
    setError('')
    setPreviewOpen(false)
    setDeleteConfirmOpen(false)
  }

  function updateDraft(patch) {
    setDraft(prev => normalizeDocumentTemplate({ ...prev, ...patch }))
    setNotice('')
  }

  function updateTermsText(value) {
    updateDraft({
      terms_text: value,
      content_sections: documentTermsTextToSections(value),
    })
  }

  function createNew() {
    const nextDraft = normalizeDocumentTemplate({
      ...buildEmptyTemplate(selectedType),
      name: `Mẫu ${CONTRACT_DOCUMENT_TYPES[selectedType]?.label || 'chứng từ'} mới`,
      sort_order: templatesByType.length + 10,
    })
    setSelectedId('')
    setDraft(nextDraft)
    setFieldsConfigText(JSON.stringify(nextDraft.fields_config || {}, null, 2))
    setNumberingConfigText(JSON.stringify(nextDraft.numbering_config || {}, null, 2))
    setNotice('')
    setError('')
    setPreviewOpen(false)
    setDeleteConfirmOpen(false)
  }

  function duplicateCurrent() {
    const source = normalizeDocumentTemplate(draft)
    const nextDraft = normalizeDocumentTemplate({
      ...source,
      id: '',
      name: `${source.name || CONTRACT_DOCUMENT_TYPES[source.document_type]?.label || 'Mẫu chứng từ'} - bản sao`,
      is_default: false,
      is_system_default: false,
      sort_order: Number(source.sort_order || 100) + 1,
      created_at: undefined,
      updated_at: undefined,
    })
    setSelectedId('')
    setDraft(nextDraft)
    setFieldsConfigText(JSON.stringify(nextDraft.fields_config || {}, null, 2))
    setNumberingConfigText(JSON.stringify(nextDraft.numbering_config || {}, null, 2))
    setNotice('')
    setError('')
    setDeleteConfirmOpen(false)
  }

  async function saveDraft() {
    if (!draft.name.trim()) {
      setError('Tên mẫu chứng từ là bắt buộc.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const termsText = String(draft.terms_text || sectionsToDocumentTermsText(draft.content_sections)).trim()
      const payload = {
        ...draft,
        id: draft.id || undefined,
        terms_text: termsText,
        content_sections: termsText ? documentTermsTextToSections(termsText) : draft.content_sections,
        is_system_default: undefined,
      }
      const saved = await saveContractDocumentTemplate(payload)
      setNotice('Đã lưu mẫu chứng từ.')
      await loadTemplates(saved?.id || draft.id, draft.document_type)
    } catch (err) {
      setError(err?.message || 'Không lưu được mẫu chứng từ.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSelected() {
    if (!canDelete) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await deleteContractDocumentTemplate(draft.id)
      setNotice('Đã xoá mẫu chứng từ.')
      setDeleteConfirmOpen(false)
      await loadTemplates('', selectedType)
    } catch (err) {
      setError(err?.message || 'Không xoá được mẫu chứng từ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <QuoteBreadcrumb root={{ label: 'Hợp đồng', to: '/contracts' }} items={[{ label: 'Mẫu chứng từ' }]} />
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-slate-950">Mẫu chứng từ hợp đồng</h1>
          <p className="mt-1 text-[13px] text-slate-500">Quản lý form cho tạm ứng, nghiệm thu kiêm thanh lý và đề nghị thanh toán.</p>
          <p className="mt-2 inline-flex rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
            {CONTRACT_DOCUMENT_TEMPLATE_SNAPSHOT_RULE}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={duplicateCurrent} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <CopyPlus className="h-4 w-4" />
            Nhân bản
          </button>
          <button type="button" onClick={createNew} className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-3 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500">
            <Plus className="h-4 w-4" />
            Mẫu mới
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {CONTRACT_DOCUMENT_TYPE_ORDER.map(documentType => (
          <button
            key={documentType}
            type="button"
            onClick={() => selectType(documentType)}
            className={`rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
              selectedType === documentType ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {CONTRACT_DOCUMENT_TYPES[documentType].label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-[13px] text-emerald-700">{notice}</p>}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 py-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-400">Danh sách mẫu chứng từ</div>
          <div className="mt-2 space-y-2">
            {loading ? (
              <p className="px-2 py-6 text-center text-[13px] text-slate-400">Đang tải...</p>
            ) : templatesByType.length ? templatesByType.map(template => {
              const isSelected = selectedTemplate?.id === template.id
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => selectTemplate(template)}
                  className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                    isSelected ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold text-slate-900">{template.name}</span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {template.is_default ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Default</span> : null}
                      {!template.is_active ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Tắt</span> : null}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-slate-500">{template.description || template.document_number_pattern}</p>
                </button>
              )
            }) : (
              <p className="px-2 py-6 text-center text-[13px] text-slate-400">Chưa có mẫu chứng từ.</p>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_180px_90px_94px_94px]">
              <Field label="Tên mẫu">
                <Input value={draft.name} onChange={event => updateDraft({ name: event.target.value })} />
              </Field>
              <Field label="Loại chứng từ">
                <Select value={draft.document_type} onChange={event => {
                  setSelectedType(event.target.value)
                  updateDraft({
                    ...buildEmptyTemplate(event.target.value),
                    name: draft.name,
                    description: draft.description,
                  })
                }}>
                  {CONTRACT_DOCUMENT_TYPE_ORDER.map(documentType => (
                    <option key={documentType} value={documentType}>{CONTRACT_DOCUMENT_TYPES[documentType].label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Thứ tự">
                <Input type="number" value={draft.sort_order} onChange={event => updateDraft({ sort_order: Number(event.target.value) })} className="text-center" />
              </Field>
              <label className="block">
                <span className="mb-1.5 block text-center text-[12px] font-semibold text-slate-600">Default</span>
                <span className="flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50">
                  <input type="checkbox" checked={Boolean(draft.is_default)} onChange={event => updateDraft({ is_default: event.target.checked })} className="h-4 w-4 accent-[#f8981d]" />
                </span>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-center text-[12px] font-semibold text-slate-600">Active</span>
                <span className="flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50">
                  <input type="checkbox" checked={draft.is_active !== false} onChange={event => updateDraft({ is_active: event.target.checked })} className="h-4 w-4 accent-[#f8981d]" />
                </span>
              </label>
            </div>
            <Field label="Mô tả" className="mt-4">
              <Textarea rows={3} value={draft.description || ''} onChange={event => updateDraft({ description: event.target.value })} />
            </Field>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
              <Field label="Tiêu đề chứng từ">
                <Input value={draft.title || ''} onChange={event => updateDraft({ title: event.target.value })} />
              </Field>
              <Field label="Mã pháp nhân">
                <Input value={draft.seller_entity_code || ''} onChange={event => updateDraft({ seller_entity_code: event.target.value })} />
              </Field>
            </div>
            <Field label="Pattern số chứng từ" className="mt-4">
              <Input value={draft.document_number_pattern || ''} onChange={event => updateDraft({ document_number_pattern: event.target.value })} />
            </Field>
            <p className="mt-2 text-[12px] text-slate-500">
              Token hỗ trợ: {'{{sequence}}'}, {'{{document_type_code}}'}, {'{{seller}}'}, {'{{customer}}'}, {'{{year}}'}. Ví dụ: {'{{sequence}}/DNTT-EVT/{{customer}}/{{year}}'}.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Field label="Fields config (JSON)">
              <Textarea
                rows={8}
                value={fieldsConfigText}
                onChange={event => {
                  setFieldsConfigText(event.target.value)
                  try {
                    updateDraft({ fields_config: JSON.parse(event.target.value || '{}') })
                    setError('')
                  } catch {
                    setError('Fields config phải là JSON hợp lệ.')
                  }
                }}
              />
            </Field>
            <Field label="Numbering config (JSON)" className="mt-4">
              <Textarea
                rows={5}
                value={numberingConfigText}
                onChange={event => {
                  setNumberingConfigText(event.target.value)
                  try {
                    updateDraft({ numbering_config: JSON.parse(event.target.value || '{}') })
                    setError('')
                  } catch {
                    setError('Numbering config phải là JSON hợp lệ.')
                  }
                }}
              />
            </Field>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <Field label="Content/form sections">
              <Textarea
                rows={16}
                value={draft.terms_text ?? sectionsToDocumentTermsText(draft.content_sections)}
                onChange={event => updateTermsText(event.target.value)}
              />
            </Field>
          </section>

          {previewOpen ? <PreviewPanel template={draft} /> : null}

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[12px] text-slate-500">{formatLastEdited(draft)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPreviewOpen(prev => !prev)} className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500">
                <Eye className="h-4 w-4" />
                Preview
              </button>
              <button type="button" onClick={saveDraft} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-orange-200 px-4 py-2.5 text-[13px] font-semibold text-[#d97706] hover:bg-orange-50 disabled:opacity-50">
                <Save className="h-4 w-4" />
                {saving ? 'Đang lưu...' : 'Lưu mẫu'}
              </button>
              <button type="button" onClick={() => setDeleteConfirmOpen(true)} disabled={!canDelete || saving} className="inline-flex items-center gap-2 rounded-xl bg-slate-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                <Trash2 className="h-4 w-4" />
                Xoá
              </button>
            </div>
          </section>
        </div>
      </div>

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
