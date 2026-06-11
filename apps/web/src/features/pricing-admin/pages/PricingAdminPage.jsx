import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CheckCircle2, Database, Pencil, Plus, RefreshCw, Save, Search, Trash2, X, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { redirectToLoginIfAuthRequired } from '../../quotes/lib/authRedirect'
import { clearPricingContextCache } from '../../quotes/lib/pricingContextClient'

const DATASETS = [
  {
    resource: 'services',
    keyField: 'service_code',
    summaryField: 'service_name',
    defaultRecord: {
      service_code: '',
      service_name: '',
      quote_display_name: '',
      unit: 'Người',
      sort_order: 100,
    },
    formFields: [
      ['service_code', 'service_code', 'text', true],
      ['service_name', 'service_name', 'text', true],
      ['quote_display_name', 'quote_display_name'],
      ['equipment_group', 'equipment_group'],
      ['duration_tier', 'duration_tier'],
      ['unit', 'unit'],
      ['price_tier_1', 'price_tier_1', 'number'],
      ['price_tier_2', 'price_tier_2', 'number'],
      ['price_tier_3', 'price_tier_3', 'number'],
      ['price_tier_4', 'price_tier_4', 'number'],
      ['price_tier_5', 'price_tier_5', 'number'],
      ['price_tier_6', 'price_tier_6', 'number'],
      ['sort_order', 'sort_order', 'number'],
      ['description', 'description', 'textarea'],
      ['internal_note', 'internal_note', 'textarea'],
    ],
  },
  {
    resource: 'travel_fees',
    keyField: 'location',
    summaryField: 'note',
    defaultRecord: {
      location: '',
      fee_per_person_per_day: 0,
      includes_accommodation: false,
      includes_transport: false,
      sort_order: 100,
    },
    formFields: [
      ['location', 'location', 'text', true],
      ['fee_per_person_per_day', 'fee_per_person_per_day', 'number'],
      ['condition', 'condition', 'textarea'],
      ['note', 'note', 'textarea'],
      ['includes_accommodation', 'includes_accommodation', 'checkbox'],
      ['includes_transport', 'includes_transport', 'checkbox'],
      ['sort_order', 'sort_order', 'number'],
    ],
  },
  {
    resource: 'customer_tiers',
    keyField: 'tier_code',
    summaryField: 'tier_name',
    defaultRecord: {
      tier_code: '',
      tier_name: '',
      default_discount: 0,
      sort_order: 100,
    },
    formFields: [
      ['tier_code', 'tier_code', 'text', true],
      ['tier_name', 'tier_name', 'text', true],
      ['price_column_used', 'price_column_used'],
      ['default_discount', 'default_discount', 'number'],
      ['payment_terms', 'payment_terms', 'textarea'],
      ['description', 'description', 'textarea'],
      ['special_note', 'special_note', 'textarea'],
      ['sort_order', 'sort_order', 'number'],
    ],
  },
  {
    resource: 'business_rules',
    keyField: 'rule_code',
    summaryField: 'rule_name',
    defaultRecord: {
      rule_code: '',
      category: 'Pricing',
      rule_name: '',
      value: '',
      rule_value: '',
      derived: false,
      sort_order: 100,
    },
    formFields: [
      ['rule_code', 'rule_code', 'text', true],
      ['category', 'category'],
      ['rule_name', 'rule_name'],
      ['value', 'value'],
      ['rule_value', 'rule_value'],
      ['description', 'description', 'textarea'],
      ['derived', 'derived', 'checkbox'],
      ['sort_order', 'sort_order', 'number'],
    ],
  },
  {
    resource: 'legal_entities',
    keyField: 'entity_code',
    summaryField: 'entity_name_full',
    defaultRecord: {
      entity_code: '',
      entity_name_full: '',
      is_default: false,
      sort_order: 100,
    },
    formFields: [
      ['entity_code', 'entity_code', 'text', true],
      ['entity_name_full', 'entity_name_full', 'text', true],
      ['display_name', 'display_name'],
      ['tax_code', 'tax_code'],
      ['address', 'address', 'textarea'],
      ['representative', 'representative'],
      ['position', 'position'],
      ['email', 'email'],
      ['hotline', 'hotline'],
      ['website', 'website'],
      ['bank_account', 'bank_account'],
      ['bank_name', 'bank_name'],
      ['logo_file', 'logo_file'],
      ['is_default', 'is_default', 'checkbox'],
      ['sort_order', 'sort_order', 'number'],
    ],
  },
  {
    resource: 'equipment_rules',
    keyField: 'match_prefixes',
    summaryField: 'equipment_title',
    defaultRecord: {
      match_prefixes: '',
      equipment_title: '',
      sort_order: 100,
    },
    formFields: [
      ['match_prefixes', 'match_prefixes', 'text', true],
      ['equipment_title', 'equipment_title', 'text', true],
      ['equipment_description', 'equipment_description', 'textarea'],
      ['internal_note', 'internal_note', 'textarea'],
      ['sort_order', 'sort_order', 'number'],
    ],
  },
]

const DATASET_MAP = Object.fromEntries(DATASETS.map(dataset => [dataset.resource, dataset]))
const NUMBER_INPUT_FORMATTER = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 6 })
const FORM_FIELD_LAYOUTS = {
  services: {
    description: 'md:col-span-2 lg:col-start-1',
    internal_note: 'md:col-span-2',
  },
  travel_fees: {
    condition: 'md:col-span-2 lg:col-start-1',
    note: 'md:col-span-2',
  },
  customer_tiers: {
    payment_terms: 'md:col-span-2 lg:col-start-1',
    description: 'md:col-span-2',
    special_note: 'md:col-span-2 lg:col-span-4',
  },
  business_rules: {
    description: 'md:col-span-2 lg:col-span-4',
  },
  legal_entities: {
    address: 'md:col-span-2 lg:col-start-1',
  },
  equipment_rules: {
    equipment_description: 'md:col-span-2 lg:col-start-1',
    internal_note: 'md:col-span-2',
  },
}
const COLUMN_WIDTHS = {
  service_code: '34ch',
  service_name: '31ch',
  quote_display_name: '22ch',
  equipment_group: '14ch',
  duration_tier: '12ch',
  unit: '10ch',
  price_tier_1: '13ch',
  price_tier_2: '13ch',
  price_tier_3: '13ch',
  price_tier_4: '13ch',
  price_tier_5: '13ch',
  price_tier_6: '13ch',
  sort_order: '10ch',
  description: '24ch',
  internal_note: '24ch',
}
const DEFAULT_COLUMN_WIDTH = '18ch'
const SCROLLABLE_COLUMN_WIDTHS = {
  legal_entities: {
    entity_code: '14ch',
    entity_name_full: '32ch',
    display_name: '18ch',
    tax_code: '16ch',
    address: '42ch',
    representative: '18ch',
    position: '14ch',
    email: '26ch',
    hotline: '16ch',
    website: '22ch',
    bank_account: '20ch',
    bank_name: '32ch',
    logo_file: '18ch',
    is_default: '12ch',
    sort_order: '10ch',
  },
}
const FIT_TO_VIEWPORT_COLUMN_WIDTHS = {
  travel_fees: {
    location: '12%',
    fee_per_person_per_day: '12%',
    condition: '26%',
    note: '24%',
    includes_accommodation: '7%',
    includes_transport: '7%',
    sort_order: '4%',
  },
  customer_tiers: {
    tier_code: '10%',
    tier_name: '14%',
    price_column_used: '10%',
    default_discount: '8%',
    payment_terms: '18%',
    description: '16%',
    special_note: '12%',
    sort_order: '4%',
  },
  business_rules: {
    rule_code: '12%',
    category: '10%',
    rule_name: '15%',
    value: '13%',
    rule_value: '13%',
    description: '20%',
    derived: '5%',
    sort_order: '4%',
  },
  equipment_rules: {
    match_prefixes: '18%',
    equipment_title: '18%',
    equipment_description: '34%',
    internal_note: '18%',
    sort_order: '4%',
  },
}

function getDatasetTableColumns(dataset) {
  return dataset.formFields
    .map(([fieldName, , type = 'text']) => [fieldName, fieldName, type])
}

function getTableMinWidth(columns) {
  return columns.reduce((sum, [fieldName]) => {
    const width = COLUMN_WIDTHS[fieldName] || DEFAULT_COLUMN_WIDTH
    return sum + (parseInt(width, 10) || 18) * 8
  }, 88)
}

function getScrollableTableMinWidth(resource, columns) {
  const widths = SCROLLABLE_COLUMN_WIDTHS[resource] || COLUMN_WIDTHS
  return columns.reduce((sum, [fieldName]) => {
    const width = widths[fieldName] || COLUMN_WIDTHS[fieldName] || DEFAULT_COLUMN_WIDTH
    return sum + (parseInt(width, 10) || 18) * 8
  }, 88)
}

function shouldFitTableToViewport(resource) {
  return resource !== 'services' && !SCROLLABLE_COLUMN_WIDTHS[resource]
}

function getTableStyle(resource, columns) {
  if (shouldFitTableToViewport(resource)) return { width: '100%', minWidth: '100%' }
  return { minWidth: SCROLLABLE_COLUMN_WIDTHS[resource] ? getScrollableTableMinWidth(resource, columns) : getTableMinWidth(columns) }
}

function getColumnWidth(resource, fieldName) {
  if (SCROLLABLE_COLUMN_WIDTHS[resource]) return SCROLLABLE_COLUMN_WIDTHS[resource][fieldName] || COLUMN_WIDTHS[fieldName] || DEFAULT_COLUMN_WIDTH
  return FIT_TO_VIEWPORT_COLUMN_WIDTHS[resource]?.[fieldName] || COLUMN_WIDTHS[fieldName] || DEFAULT_COLUMN_WIDTH
}

function getActionColumnWidth(resource) {
  return shouldFitTableToViewport(resource) ? '7%' : '88px'
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '-'
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return new Intl.NumberFormat('vi-VN').format(number)
}

function formatNumberInputValue(value) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return String(value)
  return NUMBER_INPUT_FORMATTER.format(number)
}

function parseNumberInputValue(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const normalized = raw
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
  const number = Number(normalized)
  return Number.isFinite(number) ? number : ''
}

function formatCell(value, type) {
  if (type === 'number') return formatNumber(value)
  if (type === 'boolean') {
    return value ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Bật
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-500">
        <XCircle className="h-3 w-3" />
        Tắt
      </span>
    )
  }
  if (value === undefined || value === null || value === '') return '-'
  return String(value)
}

async function requestPricingAdmin(path = '', { method = 'GET', body } = {}) {
  const response = await fetch(`/api/pricing-admin${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    redirectToLoginIfAuthRequired(response, payload)
    throw new Error(payload?.error || 'Không gọi được Pricing Admin API.')
  }

  return payload
}

function getDatasetPath(resource, { search = '' } = {}) {
  const params = new URLSearchParams({ resource })
  if (search) params.set('search', search)
  return `?${params.toString()}`
}

function getFieldLayoutClass(resource, field) {
  const [name, , type = 'text'] = field
  return FORM_FIELD_LAYOUTS[resource]?.[name] || (type === 'textarea' ? 'md:col-span-2' : '')
}

function FieldInput({ field, value, onChange, className = '' }) {
  const [name, label, type = 'text', required = false] = field
  const inputId = `pricing-field-${name}`
  const displayLabel = name || label
  const baseClass = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100'

  if (type === 'checkbox') {
    return (
      <label htmlFor={inputId} className={`flex min-h-[64px] items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 ${className}`}>
        <input
          id={inputId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={event => onChange(name, event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-200"
        />
        <span className="text-[13px] font-semibold text-slate-700">{displayLabel}</span>
      </label>
    )
  }

  return (
    <label htmlFor={inputId} className={className}>
      <span className="text-[12px] font-semibold text-slate-500">
        {displayLabel}
        {required ? <span className="text-orange-500"> *</span> : null}
      </span>
      {type === 'textarea' ? (
        <textarea
          id={inputId}
          value={value ?? ''}
          onChange={event => onChange(name, event.target.value)}
          rows={3}
          className={`${baseClass} resize-y leading-5`}
        />
      ) : (
        <input
          id={inputId}
          type={type === 'number' ? 'text' : type}
          inputMode={type === 'number' ? 'decimal' : undefined}
          value={type === 'number' ? formatNumberInputValue(value) : (value ?? '')}
          onChange={event => onChange(name, type === 'number' ? parseNumberInputValue(event.target.value) : event.target.value)}
          className={baseClass}
        />
      )}
    </label>
  )
}

function makeNewDraft(dataset, records = []) {
  const maxSort = records.reduce((max, record) => Math.max(max, Number(record.sort_order || record.group_sort_order || 0)), 0)
  const draft = {
    ...dataset.defaultRecord,
  }
  if ('sort_order' in draft) draft.sort_order = maxSort + 1
  return draft
}

function getEditorTitle(dataset, mode) {
  if (dataset.resource === 'services' && mode === 'edit') return 'Thay đổi hạng mục báo giá chi tiết'
  return mode === 'create' ? `Thêm ${dataset.resource}` : `Sửa ${dataset.resource}`
}

function getEditorSubtitle(dataset, draft) {
  if (!draft) return 'Dòng mới'
  if (dataset.resource === 'services') return draft.service_name || draft.service_code || 'Dòng mới'
  return draft[dataset.keyField] || draft[dataset.summaryField] || 'Dòng mới'
}

function getDeleteConfirmRows(dataset, draft) {
  if (!draft) return []
  const baseRows = [
    ['Bảng dữ liệu', dataset.resource],
    ['ID', draft.id],
    [dataset.keyField, draft[dataset.keyField]],
  ]
  if (dataset.summaryField !== dataset.keyField) baseRows.push([dataset.summaryField, draft[dataset.summaryField]])

  const serviceRows = dataset.resource === 'services'
    ? [
      ['Tên hiển thị báo giá', draft.quote_display_name],
      ['Đơn vị', draft.unit],
      ['Giá tier 1', draft.price_tier_1],
      ['Giá tier 2', draft.price_tier_2],
      ['Giá tier 3', draft.price_tier_3],
      ['Thứ tự', draft.sort_order],
    ]
    : []

  return [...baseRows, ...serviceRows].filter(([, value]) => value !== null && value !== undefined && value !== '')
}

function formatConfirmValue(label, value) {
  if (typeof value === 'boolean') return value ? 'Bật' : 'Tắt'
  if (/giá|tier|fee|discount|thứ tự|sort/i.test(label)) return formatNumber(value)
  return String(value)
}

export default function PricingAdminPage() {
  const navigate = useNavigate()
  const [datasetStats, setDatasetStats] = useState([])
  const [activeResource, setActiveResource] = useState(DATASETS[0].resource)
  const [records, setRecords] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(null)
  const [mode, setMode] = useState('idle')
  const [search, setSearch] = useState('')
  const [submittedSearch, setSubmittedSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeDataset = DATASET_MAP[activeResource]
  const tableColumns = useMemo(() => getDatasetTableColumns(activeDataset), [activeDataset])

  async function loadStats() {
    const payload = await requestPricingAdmin()
    setDatasetStats(payload.datasets || [])
  }

  async function loadRecords({ keepSelection = true } = {}) {
    setLoading(true)
    setError('')
    try {
      const payload = await requestPricingAdmin(getDatasetPath(activeResource, {
        search: submittedSearch,
      }))
      const nextRecords = payload.records || []
      setRecords(nextRecords)
      if (!keepSelection || !nextRecords.some(record => String(record.id) === String(selectedId))) {
        const firstRecord = nextRecords[0] || null
        setSelectedId(firstRecord ? String(firstRecord.id) : '')
        setDraft(null)
        setMode('idle')
      }
    } catch (err) {
      setError(err?.message || 'Không tải được dữ liệu bảng giá.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats().catch(err => setError(err?.message || 'Không tải được thống kê bảng giá.'))
  }, [])

  useEffect(() => {
    setRecords([])
    setSelectedId('')
    setDraft(null)
    setMode('idle')
    setDeleteConfirmOpen(false)
    loadRecords({ keepSelection: false })
  }, [activeResource, submittedSearch])

  useEffect(() => {
    if (!draft) return undefined

    function handleKeyDown(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (saving) return
      if (deleteConfirmOpen) {
        setDeleteConfirmOpen(false)
        return
      }
      setDraft(null)
      setMode('idle')
      setDeleteConfirmOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [draft, deleteConfirmOpen, saving])

  function submitSearch(event) {
    event.preventDefault()
    setSubmittedSearch(search.trim())
  }

  function startCreate() {
    setSelectedId('')
    setDraft(makeNewDraft(activeDataset, records))
    setMode('create')
    setDeleteConfirmOpen(false)
    setError('')
    setNotice('')
  }

  function startEdit(record) {
    setSelectedId(String(record.id))
    setDraft({ ...record })
    setMode('edit')
    setDeleteConfirmOpen(false)
    setError('')
    setNotice('')
  }

  function closeEditor() {
    setDraft(null)
    setMode('idle')
    setDeleteConfirmOpen(false)
  }

  function updateDraft(fieldName, value) {
    setDraft(prev => ({
      ...(prev || {}),
      [fieldName]: value,
    }))
  }

  async function saveDraft() {
    if (!draft) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const payload = mode === 'create'
        ? await requestPricingAdmin('', {
          method: 'POST',
          body: {
            resource: activeResource,
            record: draft,
          },
        })
        : await requestPricingAdmin('', {
          method: 'PATCH',
          body: {
            resource: activeResource,
            id: draft.id,
            patch: draft,
          },
        })
      const saved = payload.record
      clearPricingContextCache()
      await loadStats()
      await loadRecords({ keepSelection: true })
      setSelectedId(String(saved.id))
      setDraft(null)
      setMode('idle')
      setDeleteConfirmOpen(false)
      setNotice(mode === 'create' ? 'Đã tạo dữ liệu bảng giá.' : 'Đã lưu thay đổi.')
    } catch (err) {
      setError(err?.message || 'Không lưu được dữ liệu.')
    } finally {
      setSaving(false)
    }
  }

  function requestDeleteDraft() {
    if (!draft?.id || mode === 'create') return
    setDeleteConfirmOpen(true)
  }

  async function confirmDeleteDraft() {
    if (!draft?.id || mode === 'create') return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await requestPricingAdmin('', {
        method: 'DELETE',
        body: {
          resource: activeResource,
          id: draft.id,
        },
      })
      clearPricingContextCache()
      await loadStats()
      await loadRecords({ keepSelection: false })
      setDraft(null)
      setMode('idle')
      setDeleteConfirmOpen(false)
      setNotice('Đã xóa dữ liệu bảng giá.')
    } catch (err) {
      setError(err?.message || 'Không xóa được dữ liệu.')
    } finally {
      setSaving(false)
    }
  }

  const statsByResource = useMemo(
    () => Object.fromEntries(datasetStats.map(dataset => [dataset.resource, dataset])),
    [datasetStats],
  )
  const deleteConfirmRows = useMemo(() => getDeleteConfirmRows(activeDataset, draft), [activeDataset, draft])

  return (
    <div className="mx-auto flex h-full max-w-[1700px] flex-col gap-3 overflow-hidden pb-[44px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[14px] font-semibold uppercase text-orange-600">
            <Database className="h-4 w-4" />
            Pricing Admin
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <form onSubmit={submitSearch} className="flex min-w-[260px] rounded-lg border border-orange-200 bg-white shadow-sm">
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="min-w-0 flex-1 rounded-l-lg px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-orange-100"
              placeholder="Tìm mã, tên, ghi chú..."
            />
            <button
              type="submit"
              className="inline-flex w-10 items-center justify-center rounded-r-lg text-orange-600 hover:bg-orange-50"
              title="Tìm kiếm"
            >
              <Search className="h-4 w-4" />
            </button>
          </form>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-[#f8981d] px-3 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500"
            title="Tạo dòng mới"
          >
            <Plus className="h-4 w-4" />
            Thêm
          </button>
          <button
            type="button"
            onClick={() => navigate('/quotes')}
            className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-[13px] font-semibold text-orange-700 shadow-sm hover:bg-orange-50"
            title="Quay về danh sách báo giá"
          >
            <ArrowLeft className="h-4 w-4" />
            Báo giá
          </button>
          <button
            type="button"
            onClick={() => {
              loadStats().catch(err => setError(err?.message || 'Không tải được thống kê bảng giá.'))
              loadRecords()
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[#f8981d] px-3 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
            title="Tải lại dữ liệu"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Tải lại
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {error ? <p className="mx-4 mt-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">{error}</p> : null}
          {notice ? <p className="mx-4 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-700">{notice}</p> : null}

          <div className="min-h-0 flex-1 overflow-auto">
            <table
              className="table-fixed border-separate border-spacing-0 text-left text-[13px]"
              style={getTableStyle(activeResource, tableColumns)}
            >
              <colgroup>
                {tableColumns.map(([fieldName]) => (
                  <col key={fieldName} style={{ width: getColumnWidth(activeResource, fieldName) }} />
                ))}
                <col style={{ width: getActionColumnWidth(activeResource) }} />
              </colgroup>
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-700">
                <tr>
                  {tableColumns.map(([fieldName, label]) => (
                    <th key={fieldName} className="sticky top-0 z-10 whitespace-normal border-b border-slate-200 bg-slate-50 px-3 py-3 font-extrabold [overflow-wrap:anywhere]">
                      {label}
                    </th>
                  ))}
                  <th className="sticky right-0 top-0 z-30 whitespace-nowrap border-b border-l border-slate-200 bg-slate-50 px-3 py-3 text-center font-extrabold">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="px-4 py-10 text-center font-semibold text-slate-500">
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : records.length ? records.map(record => {
                  const active = String(record.id) === String(selectedId)
                  return (
                    <tr
                      key={record.id}
                      className={`group border-b border-slate-100 ${active ? 'bg-orange-50/70' : 'hover:bg-slate-50'}`}
                    >
                      {tableColumns.map(([fieldName, , type]) => (
                        <td key={fieldName} className="border-b border-slate-100 px-3 py-2.5 align-top text-slate-700">
                          <div className="whitespace-normal [overflow-wrap:anywhere]">{formatCell(record[fieldName], type)}</div>
                        </td>
                      ))}
                      <td className={`sticky right-0 border-b border-l border-slate-100 px-2 py-2.5 align-top ${active ? 'bg-orange-50' : 'bg-white group-hover:bg-slate-50'}`}>
                        <button
                          type="button"
                          onClick={() => startEdit(record)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-orange-200 bg-white px-2 py-1.5 text-[12px] font-semibold text-orange-700 shadow-sm hover:bg-orange-50"
                          title="Sửa dòng"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Sửa
                        </button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="px-4 py-10 text-center font-semibold text-slate-500">
                      Chưa có dữ liệu.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white shadow-[0_-8px_18px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex min-h-[42px] max-w-[1700px] items-center gap-2 overflow-x-auto px-5 py-1 lg:px-7">
          <p className="shrink-0 px-1 text-[11px] font-semibold uppercase text-slate-500">Loại dữ liệu</p>
          {DATASETS.map(dataset => {
            const active = dataset.resource === activeResource
            const count = statsByResource[dataset.resource]?.count ?? '-'
            return (
              <button
                key={dataset.resource}
                type="button"
                onClick={() => setActiveResource(dataset.resource)}
                className={`inline-flex min-w-max items-center gap-1.5 rounded-md border px-2 py-1 text-left text-[12px] font-semibold transition ${
                  active
                    ? 'border-orange-500 bg-[#f8981d] text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-orange-50 hover:text-orange-700'
                }`}
              >
                <span>{dataset.resource}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </footer>

      {draft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="flex max-h-[88vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-[16px] font-semibold text-slate-950">
                  {getEditorTitle(activeDataset, mode)}
                </p>
                <p className="mt-1 truncate text-[12px] font-semibold text-slate-500">
                  {getEditorSubtitle(activeDataset, draft)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                title="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
                {activeDataset.formFields.map(field => (
                  <FieldInput
                    key={field[0]}
                    field={field}
                    value={draft[field[0]]}
                    onChange={updateDraft}
                    className={getFieldLayoutClass(activeResource, field)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={requestDeleteDraft}
                disabled={saving || mode === 'create'}
                className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                title="Xóa dòng"
              >
                <Trash2 className="h-4 w-4" />
                Xóa
              </button>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-[13px] font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                  title="Hủy"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={saveDraft}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#f8981d] px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50"
                  title="Lưu"
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>

            {deleteConfirmOpen ? (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4 py-6">
                <div className="w-full max-w-[560px] overflow-hidden rounded-lg bg-white shadow-2xl">
                  <div className="flex items-start gap-3 border-b border-red-100 px-5 py-4">
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-700">
                      <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[16px] font-semibold text-slate-950">Xác nhận xóa hạng mục</p>
                      <p className="mt-1 text-[13px] leading-5 text-slate-600">
                        Dữ liệu này sẽ bị xóa khỏi Pricing Admin. Vui lòng kiểm tra lại thông tin trước khi xác nhận.
                      </p>
                    </div>
                  </div>
                  <div className="max-h-[45vh] overflow-y-auto px-5 py-4">
                    <dl className="grid grid-cols-[150px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
                      {deleteConfirmRows.map(([label, value]) => (
                        <div key={label} className="contents">
                          <dt className="font-semibold text-slate-500">{label}</dt>
                          <dd className="min-w-0 break-words font-semibold text-slate-900">{formatConfirmValue(label, value)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(false)}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-white px-3 py-2 text-[13px] font-semibold text-orange-700 hover:bg-orange-50 disabled:opacity-50"
                      title="Hủy xóa"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteDraft}
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
                      title="Xác nhận xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                      {saving ? 'Đang xóa...' : 'Xóa hạng mục'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
