import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, Copy, Plus, Search, Trash2, X } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import NoticePopup from './NoticePopup'
import { useLegalEntities } from '../hooks/useLegalEntities'
import {
  createContractDraftFromQuote,
  createContractDraftFromSource,
  createSharedCustomer,
  deleteContract,
  getContractById,
  getContractByJobId,
  getContractByQuoteId,
  getSharedCustomerByCode,
  listSharedCustomers,
  listContractTemplates,
  saveContract,
} from '../hooks/useContracts'
import {
  applySellerEntityToContractNumber,
  applySellerEntityToContractNumberPattern,
  buildQuoteSnapshot,
  canCreateContractFromQuote,
  buildSingleLineQuoteSnapshot,
  CONTRACT_SUBTOTAL_LABEL,
  DEFAULT_CONTRACT_TITLE,
  DEFAULT_PAYMENT_CONFIG,
  generateContractNumber,
  getContractVatMode,
  getContractPreamble,
  getContractPaymentNotes,
  getContractWorkDurationText,
  getContractWorkProgressNotes,
  getDefaultTemplate,
  getEntityProfile,
  getTodayInputDate,
  hasContractAdvance,
  normalizeContractTemplate,
  sectionsToTermsText,
  termsTextToSections,
} from '../lib/contractDefaults'
import { getQuoteActorPayload, getQuoteUserContext } from '../lib/quoteAuth'
import ContractDocumentDownloads from './ContractDocumentDownloads'
import { ContractDocumentsSidebarCard } from './ContractDocumentsPanel'
import ContractPaymentSummary from './ContractPaymentSummary'
import QuoteBreadcrumb from './QuoteBreadcrumb'
import QuotePreview from './QuotePreview'

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
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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
      <div className="mt-3">{children}</div>
    </section>
  )
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

function parseCurrencyInput(value) {
  const clean = String(value || '').replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function formatSavedContractTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour12: false,
  }).format(date).replace(',', '')
}

function todayInputDate() {
  const date = new Date()
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 10)
}

function SummaryRow({ label, value, strong = false, compact = false }) {
  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-b-0">
        <dt className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
        <dd className={`min-w-0 truncate text-right text-[13px] leading-5 ${strong ? 'font-semibold text-slate-950' : 'text-slate-700'}`}>
          {hasText(value) ? value : '-'}
        </dd>
      </div>
    )
  }

  return (
    <div className="border-b border-slate-100 py-2 last:border-b-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</dt>
      <dd className={`mt-1 text-[13px] leading-5 ${strong ? 'font-semibold text-slate-950' : 'text-slate-700'}`}>
        {hasText(value) ? value : '-'}
      </dd>
    </div>
  )
}

function LegalNoteList({ title, items = [] }) {
  return (
    <div className="mt-4">
      <p className="text-[13px] font-semibold text-slate-900">{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-700">
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

function mapSharedCustomerToProfile(customer = {}, current = {}) {
  return {
    ...current,
    customer_id: customer.id || '',
    customer_code: customer.customer_code || '',
    company_name: customer.company_name || '',
    tax_code: customer.tax_code || '',
    address: customer.address || '',
    representative: customer.representative || '',
    position: customer.position || '',
    authorization_number: customer.authorization_number || '',
    authorization_date: customer.authorization_date || '',
    email: customer.email || '',
    phone_number: customer.phone_number || '',
  }
}

function normalizeCustomerProfile(profile = {}) {
  return {
    ...(profile || {}),
    company_name: profile?.company_name || '',
    phone_number: profile?.phone_number || '',
  }
}

function buildCustomerCreateDraft(profile = {}) {
  return {
    customer_code: profile.customer_code || '',
    company_name: profile.company_name || '',
    tax_code: profile.tax_code || '',
    address: profile.address || '',
    representative: profile.representative || '',
    position: profile.position || '',
    authorization_number: profile.authorization_number || '',
    authorization_date: profile.authorization_date || '',
    phone_number: profile.phone_number || '',
    contact_name: '',
    email: profile.email || '',
    entry_date: todayInputDate(),
    note: '',
  }
}

function CustomerCreateForm({ initialProfile = {}, creating = false, onCreate, onCopyTaxLookup, onCancel }) {
  const [form, setForm] = useState(() => buildCustomerCreateDraft(initialProfile))

  useEffect(() => {
    setForm(buildCustomerCreateDraft(initialProfile))
  }, [initialProfile.customer_code])

  function update(key, nextValue) {
    setForm(prev => ({ ...prev, [key]: nextValue }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onCreate?.(form)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] font-semibold text-slate-900">Thêm mã khách hàng mới</p>
        <button type="button" onClick={onCancel} className="inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-[12px] font-semibold text-slate-500 hover:bg-white hover:text-slate-800">
          Đóng
        </button>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-6">
        <Field label="Mã khách hàng" className="md:col-span-2">
          <TextInput required value={form.customer_code || ''} onChange={event => update('customer_code', event.target.value)} />
        </Field>
        <Field label="Mã số thuế" className="md:col-span-3">
          <TextInput value={form.tax_code || ''} onChange={event => update('tax_code', event.target.value)} />
        </Field>
        <div className="flex items-end">
          <button type="button" onClick={() => onCopyTaxLookup?.(form.tax_code)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
            <Copy className="h-3.5 w-3.5" />
            Copy MST & tra cứu
          </button>
        </div>
        <Field label="Tên công ty" className="md:col-span-4">
          <TextInput value={form.company_name || ''} onChange={event => update('company_name', event.target.value)} />
        </Field>
        <Field label="Số điện thoại" className="md:col-span-2">
          <TextInput value={form.phone_number || ''} onChange={event => update('phone_number', event.target.value)} />
        </Field>
        <Field label="Địa chỉ" className="md:col-span-6">
          <TextInput value={form.address || ''} onChange={event => update('address', event.target.value)} />
        </Field>
        <Field label="Người đại diện" className="md:col-span-3">
          <TextInput value={form.representative || ''} onChange={event => update('representative', event.target.value)} />
        </Field>
        <Field label="Chức vụ" className="md:col-span-3">
          <TextInput value={form.position || ''} onChange={event => update('position', event.target.value)} />
        </Field>
        <Field label="Giấy uỷ quyền số" className="md:col-span-3">
          <TextInput value={form.authorization_number || ''} onChange={event => update('authorization_number', event.target.value)} />
        </Field>
        <Field label="Ngày giấy uỷ quyền" className="md:col-span-3">
          <TextInput type="date" value={form.authorization_date || ''} onChange={event => update('authorization_date', event.target.value)} />
        </Field>
        <Field label="Người liên hệ" className="md:col-span-2">
          <TextInput value={form.contact_name || ''} onChange={event => update('contact_name', event.target.value)} />
        </Field>
        <Field label="Email" className="md:col-span-2">
          <TextInput type="email" value={form.email || ''} onChange={event => update('email', event.target.value)} />
        </Field>
        <Field label="Ngày nhập" className="md:col-span-2">
          <TextInput type="date" value={form.entry_date || ''} onChange={event => update('entry_date', event.target.value)} />
        </Field>
        <Field label="Ghi chú khách hàng" className="md:col-span-6">
          <Textarea rows={3} value={form.note || ''} onChange={event => update('note', event.target.value)} />
        </Field>
      </div>
      <div className="mt-3 flex justify-end">
        <button type="submit" disabled={creating} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f8981d] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#e88912] disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {creating ? 'Đang tạo...' : 'Thêm mới'}
        </button>
      </div>
    </form>
  )
}

function ProfileFields({
  title,
  eyebrow,
  value = {},
  onChange,
  companyLabel = 'Tên pháp nhân',
  type = 'customer',
  headerAction = null,
  customerOptions = [],
  customerLookupState = {},
  onLookupCustomer,
  onCreateCustomer,
  onCopyTaxLookup,
  footer = null,
}) {
  const companyKey = 'company_name'
  const gridClass = type === 'seller' ? 'md:grid-cols-6' : 'md:grid-cols-2'
  const halfClass = type === 'seller' ? 'md:col-span-3' : ''
  const addressClass = type === 'seller' ? 'md:col-span-6' : 'md:col-span-2'
  const fieldsLocked = type === 'seller'
  const lockedInputClass = fieldsLocked ? 'bg-slate-50 text-slate-500' : ''
  const isCustomer = type === 'customer'
  const [createOpen, setCreateOpen] = useState(false)

  function update(key, nextValue) {
    onChange?.({ ...value, [key]: nextValue })
  }

  function handleCustomerCodeChange(nextValue) {
    const matchedCustomer = customerOptions.find(customer => String(customer.customer_code || '').trim() === String(nextValue || '').trim())
    if (matchedCustomer) {
      onChange?.(mapSharedCustomerToProfile(matchedCustomer, value))
      setCreateOpen(false)
      return
    }

    update('customer_code', nextValue)
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {headerAction || (
        <div>
          {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{eyebrow}</p> : null}
          <h3 className="mt-1 text-[16px] font-semibold text-slate-900">{title}</h3>
        </div>
      )}

      {isCustomer ? (
        <div className="mt-4">
          <div className="grid gap-3 md:grid-cols-[minmax(200px,300px)_auto_auto]">
            <Field label="Mã khách hàng">
              <TextInput
                list="contract-customer-codes"
                value={value.customer_code || ''}
                onChange={event => handleCustomerCodeChange(event.target.value)}
                onBlur={event => {
                  const code = String(event.target.value || '').trim()
                  if (code) onLookupCustomer?.(code)
                }}
              />
              <datalist id="contract-customer-codes">
                {customerOptions.map(customer => (
                  <option key={customer.id || customer.customer_code} value={customer.customer_code}>
                    {customer.company_name || customer.tax_code || customer.customer_code}
                  </option>
                ))}
              </datalist>
            </Field>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onLookupCustomer?.(value.customer_code)}
                disabled={customerLookupState.loading}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#f8981d] px-4 text-[13px] font-semibold text-white shadow-sm hover:bg-[#e88912] disabled:opacity-50"
              >
                <Search className="h-4 w-4" />
                {customerLookupState.loading ? 'Đang tìm...' : 'Tìm'}
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 text-[13px] font-semibold text-orange-700 hover:bg-orange-100"
              >
                <Plus className="h-4 w-4" />
                Tạo mới
              </button>
            </div>
          </div>
          {customerLookupState.error ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
              <span>{customerLookupState.error}</span>
              <button type="button" onClick={() => setCreateOpen(true)} className="font-semibold text-amber-900 underline">
                Tạo mã mới
              </button>
            </div>
          ) : null}
          {customerLookupState.notice ? (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[13px] text-emerald-700">{customerLookupState.notice}</p>
          ) : null}
        </div>
      ) : null}

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
        {type === 'customer' ? (
          <>
            <Field label="Email" className={halfClass}>
              <TextInput value={value.email || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('email', event.target.value)} />
            </Field>
            <Field label="Số điện thoại" className={halfClass}>
              <TextInput value={value.phone_number || ''} readOnly={fieldsLocked} className={lockedInputClass} onChange={event => update('phone_number', event.target.value)} />
            </Field>
          </>
        ) : null}
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

      {isCustomer && createOpen ? (
        <CustomerCreateForm
          initialProfile={value}
          creating={customerLookupState.creating}
          onCreate={async payload => {
            const created = await onCreateCustomer?.(payload)
            if (created) setCreateOpen(false)
          }}
          onCopyTaxLookup={onCopyTaxLookup}
          onCancel={() => setCreateOpen(false)}
        />
      ) : null}

      {footer ? <div className="mt-3 -mb-2">{footer}</div> : null}
    </section>
  )
}

function getHydratedContractNumberSource(contract = {}, quoteSnapshot = {}, customerSnapshot = {}) {
  return {
    ...quoteSnapshot,
    external_job_id: contract.external_job_id,
    source_code: contract.external_job_id ? `JOB${contract.external_job_id}` : '',
    client_name: customerSnapshot.company_name || quoteSnapshot.client_name,
  }
}

function syncHydratedContractNumber(contractNumber, contractNumberPattern, contract = {}, quoteSnapshot = {}, customerSnapshot = {}) {
  const current = String(contractNumber || '').trim()
  if (!current) return current

  const nextPattern = applySellerEntityToContractNumberPattern(contractNumberPattern, contract.seller_entity_code)
  const source = getHydratedContractNumberSource(contract, quoteSnapshot, customerSnapshot)
  const nextGenerated = generateContractNumber(nextPattern, source)
  const candidatePatterns = [
    contract.contract_number_pattern,
    contractNumberPattern,
    nextPattern,
    applySellerEntityToContractNumberPattern(nextPattern, 'EVT'),
    applySellerEntityToContractNumberPattern(nextPattern, 'MEDIAMONSTER'),
  ].filter(Boolean)
  const wasGenerated = Array.from(new Set(candidatePatterns))
    .some(pattern => generateContractNumber(pattern, source) === current)

  return wasGenerated ? nextGenerated : applySellerEntityToContractNumber(current, contract.seller_entity_code)
}

function getHydratedSellerSnapshot(contract = {}, quote = {}) {
  const sellerEntityCode = contract.seller_entity_code || quote?.entity_code || 'EVT'
  return {
    ...(contract.seller_snapshot || {}),
    ...getEntityProfile(sellerEntityCode),
  }
}

function hydrateContract(contract, quote) {
  const normalized = normalizeContractTemplate(contract)
  const customerSnapshot = normalizeCustomerProfile(contract.customer_snapshot || {})
  const quoteSnapshot = contract.quote_snapshot || buildQuoteSnapshot(quote)
  const signingDate = contract.signing_date || contract.quote_table_config?.signing_date || getTodayInputDate()

  return {
    ...contract,
    ...normalized,
    quote_id: contract.quote_id || quote?.id || '',
    quote_number: contract.quote_number || quote?.quote_number || '',
    seller_snapshot: getHydratedSellerSnapshot(contract, quote),
    customer_snapshot: customerSnapshot,
    contract_number: syncHydratedContractNumber(contract.contract_number, normalized.contract_number_pattern, { ...contract, seller_entity_code: normalized.seller_entity_code }, quoteSnapshot, customerSnapshot),
    signing_date: signingDate,
    quote_table_config: {
      ...normalized.quote_table_config,
      signing_date: signingDate,
    },
    quote_snapshot: quoteSnapshot,
  }
}

function DeleteContractConfirmModal({ contractNumber, deleting, onCancel, onConfirm }) {
  useEscapeToClose(() => {
    if (!deleting) onCancel?.()
  })

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 px-4 py-6">
      <section className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold text-slate-950">Xoá hợp đồng đã lưu</h2>
            <p className="mt-2 text-[13px] leading-6 text-slate-600">
              Hợp đồng <span className="font-semibold text-slate-950">{contractNumber || 'này'}</span> sẽ bị xoá khỏi báo giá. Báo giá vẫn được giữ nguyên để tạo lại hợp đồng mới.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Đang xoá...' : 'Xoá hợp đồng'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default function ContractEditorModal({
  open,
  quote,
  sourceType = 'quote',
  sourceDraft = null,
  contractId = '',
  initialContract = null,
  variant = 'modal',
  onClose,
  onSaved,
  onDeleted,
}) {
  const isPage = variant === 'page'
  useEscapeToClose(onClose, open && !isPage)

  const { legalEntities } = useLegalEntities()
  const userContext = useMemo(() => getQuoteUserContext(), [])
  const [templates, setTemplates] = useState([])
  const [draft, setDraft] = useState(null)
  const [savedContract, setSavedContract] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [customerOptions, setCustomerOptions] = useState([])
  const [customerLookupState, setCustomerLookupState] = useState({
    loading: false,
    creating: false,
    error: '',
    notice: '',
  })

  const isQuoteSource = sourceType === 'quote'
  const contractSourceReady = !isQuoteSource || canCreateContractFromQuote(quote)
  const quoteIsReady = contractSourceReady
  const quoteSnapshot = useMemo(() => buildQuoteSnapshot(quote || {}), [quote])
  const previewSavedByName = useMemo(() => getQuoteActorPayload(userContext).created_by_name, [userContext])
  const savedContractTimeText = formatSavedContractTime(savedContract?.updated_at || savedContract?.created_at)
  const savedContractMetaText = savedContract && savedContractTimeText
    ? `Đã lưu lúc ${savedContractTimeText} bởi ${previewSavedByName}`
    : ''

  useEffect(() => {
    if (!open) return
    if (isQuoteSource && !quote?.id && !contractId) return
    if (sourceType === 'job' && !sourceDraft?.external_job_id && !contractId) return
    let mounted = true

    async function loadContractContext() {
      setLoading(true)
      setError('')
      setNotice('')
      setDeleteConfirmOpen(false)

      try {
        const existingLoader = contractId
          ? (initialContract ? Promise.resolve(initialContract) : getContractById(contractId))
          : sourceType === 'job'
            ? getContractByJobId(sourceDraft.external_job_id)
            : isQuoteSource && quote?.id
              ? getContractByQuoteId(quote.id)
              : Promise.resolve(null)
        const [templateRows, existingContract] = await Promise.all([
          listContractTemplates(),
          existingLoader,
        ])
        const customers = await listSharedCustomers().catch(() => [])

        if (!mounted) return
        const defaultTemplate = getDefaultTemplate(templateRows)
        const nextDraft = existingContract
          ? hydrateContract(existingContract, quote || existingContract.quote_snapshot)
          : isQuoteSource
            ? createContractDraftFromQuote(quote, defaultTemplate)
            : createContractDraftFromSource(sourceDraft || { source_type: sourceType }, defaultTemplate)

        setTemplates(templateRows)
        setCustomerOptions(customers)
        setCustomerLookupState({ loading: false, creating: false, error: '', notice: '' })
        setDraft(nextDraft)
        setSavedContract(existingContract ? hydrateContract(existingContract, quote || existingContract.quote_snapshot) : null)
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
  }, [open, quote?.id, sourceType, sourceDraft?.external_job_id, contractId, initialContract?.id])

  function updateDraft(patch) {
    setDraft(prev => normalizeContractTemplate({ ...prev, ...patch }))
    setDirty(true)
    setNotice('')
  }

  function updateSeller(profile) {
    updateDraft({ seller_snapshot: profile })
  }

  function updateCustomer(profile) {
    updateDraft({ customer_snapshot: normalizeCustomerProfile(profile) })
    setCustomerLookupState(prev => ({ ...prev, error: '', notice: '' }))
  }

  function applySharedCustomer(customer) {
    if (!customer) return
    updateDraft({
      customer_snapshot: mapSharedCustomerToProfile(customer, draft?.customer_snapshot || {}),
    })
    setCustomerLookupState(prev => ({
      ...prev,
      loading: false,
      creating: false,
      error: '',
      notice: `Đã lấy thông tin khách hàng ${customer.customer_code}.`,
    }))
  }

  async function handleLookupCustomer(customerCode) {
    const code = String(customerCode || '').trim()
    if (!code) {
      setCustomerLookupState(prev => ({ ...prev, error: 'Nhập mã khách hàng trước khi tìm.', notice: '' }))
      return null
    }

    const cached = customerOptions.find(customer => String(customer.customer_code || '').trim() === code)
    if (cached) {
      applySharedCustomer(cached)
      return cached
    }

    setCustomerLookupState(prev => ({ ...prev, loading: true, error: '', notice: '' }))
    try {
      const customer = await getSharedCustomerByCode(code)
      if (!customer) {
        setCustomerLookupState(prev => ({
          ...prev,
          loading: false,
          error: 'Khách hàng chưa tồn tại.',
          notice: '',
        }))
        return null
      }

      setCustomerOptions(prev => {
        const withoutCurrent = prev.filter(row => row.id !== customer.id && row.customer_code !== customer.customer_code)
        return [customer, ...withoutCurrent]
      })
      applySharedCustomer(customer)
      return customer
    } catch (err) {
      setCustomerLookupState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || 'Không tìm được khách hàng.',
        notice: '',
      }))
      return null
    }
  }

  async function handleCreateCustomer(payload) {
    setCustomerLookupState(prev => ({ ...prev, creating: true, error: '', notice: '' }))
    try {
      const customer = await createSharedCustomer(payload)
      if (customer) {
        setCustomerOptions(prev => {
          const withoutCurrent = prev.filter(row => row.id !== customer.id && row.customer_code !== customer.customer_code)
          return [customer, ...withoutCurrent]
        })
        applySharedCustomer(customer)
      }
      return customer
    } catch (err) {
      setCustomerLookupState(prev => ({
        ...prev,
        creating: false,
        error: err?.message || 'Không thể tạo mã khách hàng mới.',
        notice: '',
      }))
      return null
    }
  }

  async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        // Fall through to the textarea copy fallback.
      }
    }

    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '0'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)

    let copied = false
    try {
      copied = document.execCommand('copy')
    } catch {
      copied = false
    }
    document.body.removeChild(textarea)
    return copied
  }

  async function handleCopyTaxLookup(taxCode) {
    const value = String(taxCode || '').trim()
    if (!value) {
      setCustomerLookupState(prev => ({ ...prev, error: 'Nhập mã số thuế trước khi tra cứu.', notice: '' }))
      return
    }

    const copied = await copyTextToClipboard(value)
    setCustomerLookupState(prev => ({
      ...prev,
      error: copied ? '' : 'Không copy được mã số thuế, bạn vẫn có thể tra cứu thủ công.',
      notice: copied ? 'Đã copy mã số thuế. Đang mở trang tra cứu.' : '',
    }))
    window.open('https://tracuunnt.gdt.gov.vn/tcnnt/mstdn.jsp', '_blank', 'noopener')
  }

  function handleSellerEntityChange(entityCode) {
    const nextPattern = applySellerEntityToContractNumberPattern(draft.contract_number_pattern, entityCode)
    const nextDraft = {
      ...draft,
      seller_entity_code: entityCode,
      seller_snapshot: getEntityProfile(entityCode),
      contract_number_pattern: nextPattern,
    }

    updateDraft({
      ...nextDraft,
      contract_number: getSyncedContractNumber(draft.contract_number, draft.contract_number_pattern, nextPattern, nextDraft),
    })
  }

  function handleTemplateChange(templateId) {
    const template = templates.find(row => row.id === templateId)
    if (!template) return
    const normalizedTemplate = normalizeContractTemplate(template)
    const sellerEntityCode = draft.seller_entity_code || quote?.entity_code || normalizedTemplate.seller_entity_code
    const nextPattern = applySellerEntityToContractNumberPattern(normalizedTemplate.contract_number_pattern, sellerEntityCode)
    const nextDraft = {
      ...draft,
      template_id: normalizedTemplate.id,
      title: normalizedTemplate.title || draft.title,
      seller_entity_code: sellerEntityCode,
      seller_snapshot: getEntityProfile(sellerEntityCode),
      party_role_config: normalizedTemplate.party_role_config,
      contract_number_pattern: nextPattern,
      preamble: normalizedTemplate.preamble,
      service_scope: draft.service_scope,
      schedule_rows: normalizedTemplate.schedule_rows.length ? normalizedTemplate.schedule_rows : draft.schedule_rows,
      quote_table_config: normalizedTemplate.quote_table_config,
      payment_config: normalizedTemplate.payment_config,
      content_sections: normalizedTemplate.content_sections,
      terms_text: normalizedTemplate.terms_text || sectionsToTermsText(normalizedTemplate.content_sections),
    }

    updateDraft({
      ...nextDraft,
      contract_number: getSyncedContractNumber(draft.contract_number, draft.contract_number_pattern, nextPattern, nextDraft),
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

  function updateQuoteTableConfig(patch) {
    updateDraft({
      quote_table_config: {
        ...draft.quote_table_config,
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

  function updateSourceQuoteSnapshot(patch) {
    updateDraft({
      quote_snapshot: buildSingleLineQuoteSnapshot(draft.quote_snapshot || {}, patch),
    })
  }

  function validate() {
    if (!draft) return 'Chưa có dữ liệu hợp đồng.'
    if (!draft.id && !quoteIsReady) return 'Không thể tạo hợp đồng từ báo giá này.'
    if (!String(draft.customer_snapshot?.company_name || '').trim()) return 'Cần nhập tên công ty khách hàng.'
    if (!String(draft.service_scope || '').trim()) return 'Cần nhập nội dung dịch vụ.'
    if (!String(draft.terms_text ?? sectionsToTermsText(draft.content_sections)).trim()) return 'Cần nhập nội dung từ ĐIỀU 3 trở đi.'
    return ''
  }

  async function handleSave() {
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return null
    }

    setSaving(true)
    setError('')
    setNotice('')

    try {
      const termsText = String(draft.terms_text ?? sectionsToTermsText(draft.content_sections)).trim()
      const finalQuoteSnapshot = quote ? quoteSnapshot : buildSingleLineQuoteSnapshot(draft.quote_snapshot || {})
      const finalContractNumberPattern = applySellerEntityToContractNumberPattern(draft.contract_number_pattern, draft.seller_entity_code)
      const finalContractNumber = getSyncedContractNumber(
        draft.contract_number,
        draft.contract_number_pattern,
        finalContractNumberPattern,
        { ...draft, quote_snapshot: finalQuoteSnapshot },
      )
      const saved = await saveContract({
        ...draft,
        contract_number: finalContractNumber,
        contract_number_pattern: finalContractNumberPattern,
        signing_date: draft.signing_date || getTodayInputDate(),
        status: draft.status === 'draft' ? 'generated' : draft.status,
        terms_text: termsText,
        content_sections: termsTextToSections(termsText),
        quote_snapshot: finalQuoteSnapshot,
      }, { quote })
      const hydrated = hydrateContract(saved, quote || saved.quote_snapshot)
      setDraft(hydrated)
      setSavedContract(hydrated)
      setDirty(false)
      setNotice('Đã lưu hợp đồng. Bạn có thể tải PDF hoặc DOCX.')
      onSaved?.(hydrated)
      return hydrated
    } catch (err) {
      setError(err?.message || 'Không lưu được hợp đồng.')
      return null
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteContract() {
    if (!savedContract && !draft?.id) return

    setDeleting(true)
    setError('')
    setNotice('')

    try {
      await deleteContract({
        id: savedContract?.id || draft?.id,
        quoteId: isQuoteSource ? quote?.id : undefined,
      })
      const nextDraft = isQuoteSource
        ? createContractDraftFromQuote(quote, getDefaultTemplate(templates))
        : createContractDraftFromSource(sourceDraft || { source_type: sourceType }, getDefaultTemplate(templates))
      setDraft(nextDraft)
      setSavedContract(null)
      setDirty(false)
      setDeleteConfirmOpen(false)
      setNotice('Đã xoá hợp đồng. Bạn có thể tạo lại hợp đồng mới từ báo giá này.')
      onDeleted?.()
    } catch (err) {
      setError(err?.message || 'Không xoá được hợp đồng.')
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  const draftQuoteSnapshot = draft?.quote_snapshot || {}
  const baseQuoteSnapshot = quote ? quoteSnapshot : buildSingleLineQuoteSnapshot(draftQuoteSnapshot)
  const savedQuoteSnapshot = savedContract?.quote_snapshot || {}
  const currentQuoteSnapshot = {
    ...baseQuoteSnapshot,
    ...savedQuoteSnapshot,
    share_token: savedQuoteSnapshot.share_token || baseQuoteSnapshot.share_token,
  }
  const downloadableContract = savedContract && !dirty ? {
    ...draft,
    share_token: savedContract.share_token || draft.share_token,
    quote_snapshot: currentQuoteSnapshot,
  } : null
  const previewContract = draft ? {
    ...draft,
    share_token: savedContract?.share_token || draft.share_token,
    quote_snapshot: savedContract ? currentQuoteSnapshot : baseQuoteSnapshot,
  } : null
  const documentContract = savedContract || (draft?.id ? draft : null)
  const serviceScopeDetail = getServiceScopeDetail(draft?.service_scope)
  const termsText = draft?.terms_text ?? sectionsToTermsText(draft?.content_sections || [])
  const preambleLines = getContractPreamble(draft || {})
  const paymentDocuments = Array.isArray(draft?.payment_config?.payment_documents)
    ? draft.payment_config.payment_documents
    : DEFAULT_PAYMENT_CONFIG.payment_documents
  const paymentNotes = getContractPaymentNotes(draft?.payment_config)
  const workProgressNotes = getContractWorkProgressNotes(draft || {})
  const workDurationText = draft?.quote_table_config && Object.prototype.hasOwnProperty.call(draft.quote_table_config, 'work_duration_text')
    ? draft.quote_table_config.work_duration_text
    : getContractWorkDurationText(draft || {})
  const quotePreviewQuote = { ...(quote || {}), ...baseQuoteSnapshot }
  const quotePreviewItems = Array.isArray(baseQuoteSnapshot.items) ? baseQuoteSnapshot.items : []
  const quotePreviewTotals = {
    subtotal: baseQuoteSnapshot.subtotal,
    travel_fee_total: baseQuoteSnapshot.travel_fee_total,
    overtime_fee_total: baseQuoteSnapshot.overtime_fee_total,
    discount_amount: baseQuoteSnapshot.discount_amount,
    vat_amount: baseQuoteSnapshot.vat_amount,
    total_amount: baseQuoteSnapshot.total_amount,
  }
  const summaryQuote = quote || baseQuoteSnapshot || {}
  const paymentConfig = draft?.payment_config || {}
  const hasPaymentAdvance = hasContractAdvance(paymentConfig)
  const contractVatMode = getContractVatMode(baseQuoteSnapshot)
  const contractValueInput = Number(baseQuoteSnapshot.contract_value_input || 0) ||
    (contractVatMode === 'included'
      ? Number(baseQuoteSnapshot.total_amount || 0)
      : Number(baseQuoteSnapshot.subtotal || baseQuoteSnapshot.total_amount || 0))
  const quoteLinkId = quote?.id || draft?.quote_id || summaryQuote.id || baseQuoteSnapshot.id || ''
  const quoteDisplayText = summaryQuote.quote_number || draft?.quote_number || quoteLinkId
  const quoteSummaryValue = quoteLinkId ? (
    <a
      href={`/quotes/${encodeURIComponent(quoteLinkId)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#d97706] underline-offset-2 hover:underline"
    >
      {quoteDisplayText || quoteLinkId}
    </a>
  ) : 'Chưa tạo'

  function getContractNumberSource(sourceDraft = draft) {
    const sourceSnapshot = quote
      ? quoteSnapshot
      : buildSingleLineQuoteSnapshot(sourceDraft?.quote_snapshot || {})

    return {
      ...sourceSnapshot,
      external_job_id: sourceDraft?.external_job_id,
      source_code: sourceDraft?.external_job_id ? `JOB${sourceDraft.external_job_id}` : '',
      client_name: sourceDraft?.customer_snapshot?.company_name || sourceSnapshot.client_name,
    }
  }

  function getGeneratedContractNumber(pattern, sourceDraft = draft) {
    return generateContractNumber(pattern, getContractNumberSource(sourceDraft))
  }

  function getSyncedContractNumber(currentNumber, previousPattern, nextPattern, sourceDraft = draft) {
    const current = String(currentNumber || '').trim()
    const normalizedNextPattern = String(nextPattern || '').trim()
    const nextGenerated = getGeneratedContractNumber(normalizedNextPattern, sourceDraft)

    if (!current) return nextGenerated

    const candidatePatterns = [
      previousPattern,
      normalizedNextPattern,
      applySellerEntityToContractNumberPattern(normalizedNextPattern, 'EVT'),
      applySellerEntityToContractNumberPattern(normalizedNextPattern, 'MEDIAMONSTER'),
    ].filter(Boolean)

    const wasGenerated = Array.from(new Set(candidatePatterns))
      .some(pattern => getGeneratedContractNumber(pattern, sourceDraft) === current)

    return wasGenerated ? nextGenerated : applySellerEntityToContractNumber(current, sourceDraft?.seller_entity_code)
  }

  function renderContractSetupControls() {
    if (!draft) return null

    return (
      <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
        <label className="flex items-center gap-2">
          <span className="w-[88px] shrink-0 text-[12px] font-semibold text-slate-600">Số hợp đồng</span>
          <TextInput value={draft.contract_number || ''} onChange={event => updateDraft({ contract_number: event.target.value })} />
        </label>
        <label className="flex items-center gap-2">
          <span className="w-[88px] shrink-0 text-[12px] font-semibold text-slate-600">Ngày ký</span>
          <TextInput type="date" value={draft.signing_date || getTodayInputDate()} onChange={event => updateDraft({ signing_date: event.target.value })} />
        </label>
        <Field label="Mẫu hợp đồng">
          <Select value={draft.template_id || ''} onChange={event => handleTemplateChange(event.target.value)}>
            {templates.map(template => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </Select>
        </Field>
      </div>
    )
  }

  function renderActionPanel({ embedded = false } = {}) {
    const content = (
      <>
        {dirty ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
            Có thay đổi chưa lưu
          </div>
        ) : null}
        {savedContractMetaText ? (
          <p className="text-[12px] leading-5 text-slate-400">
            {savedContractMetaText}
          </p>
        ) : null}
        <div className={`flex gap-2 ${savedContractMetaText ? 'mt-3' : ''}`}>
          {savedContract ? (
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={saving || loading || deleting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Xóa
            </button>
          ) : null}
          <ContractDocumentDownloads
            contract={downloadableContract}
            previewContract={previewContract}
            disabled={saving || loading || deleting || !draft || (!quoteIsReady && !savedContract)}
            showShareButton
            previewSavedByName={previewSavedByName}
            className="min-w-0 flex-[2]"
            buttonClassName="w-full justify-center px-3"
            onBeforePreview={handleSave}
            buttonLabel="Lưu & Preview"
            loadingLabel="Đang lưu..."
          />
        </div>
      </>
    )

    if (embedded) {
      return <div className="mt-3">{content}</div>
    }

    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:shadow-none">
        {content}
      </section>
    )
  }

  const shellClass = isPage
    ? 'min-h-screen bg-slate-50'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45'
  const panelClass = isPage
    ? 'flex min-h-screen w-full flex-col overflow-hidden bg-slate-50'
    : 'flex h-screen max-h-screen w-full flex-col overflow-hidden bg-slate-50 shadow-2xl'

  return (
    <div className={shellClass}>
      <NoticePopup message={notice} onClose={() => setNotice('')} />
      <section className={panelClass}>
        <header className="border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <QuoteBreadcrumb
                items={[
                  isQuoteSource && quote?.id
                    ? { label: quote.quote_number || quote.id || 'Chi tiết báo giá', to: `/quotes/${quote.id}` }
                    : { label: 'Hợp đồng', to: '/contracts' },
                  { label: draft?.contract_number || savedContract?.contract_number || 'Hợp đồng' },
                ]}
              />
              {isPage ? (
                <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-slate-950">
                  {draft?.contract_number || savedContract?.contract_number || 'Hợp đồng'}
                </h1>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className={isPage
                ? 'inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-600 hover:bg-slate-50'
                : 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}
              aria-label={isPage ? 'Quay lại danh sách hợp đồng' : 'Đóng'}
            >
              {isPage ? (
                <>
                  <ArrowLeft className="h-4 w-4" />
                  Quay lại
                </>
              ) : (
                <X className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="hidden overflow-y-auto border-r border-slate-200 bg-white p-4 xl:block">
            <div className="sticky top-0 space-y-4">
              <section className="rounded-2xl border border-slate-200 p-4">
                <dl>
                  <SummaryRow label="Báo giá" value={quoteSummaryValue} strong compact />
                  <SummaryRow label="Tổng giá trị hợp đồng" value={`${formatCurrency(baseQuoteSnapshot.total_amount)}đ`} strong compact />
                </dl>
                {renderContractSetupControls()}
                {renderActionPanel({ embedded: true })}
              </section>

              <ContractDocumentsSidebarCard
                contract={documentContract}
                comparisonContract={previewContract}
                quote={quote}
              />
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto px-4 pb-5 pt-0 xl:px-5">
            <div className="flex flex-col gap-5">
              {loading && <p className="rounded-xl bg-white px-4 py-3 text-[13px] text-slate-500">Đang tải hợp đồng...</p>}
              {!quoteIsReady && !savedContract && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] font-semibold text-amber-800">
                  Không thể tạo hợp đồng từ báo giá này.
                </div>
              )}
              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}

              {draft && !loading && (
                <>
                  <section className="grid gap-3 xl:hidden">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <SummaryRow label="Báo giá" value={quoteSummaryValue} strong />
                        <SummaryRow label="Tổng giá trị hợp đồng" value={`${formatCurrency(baseQuoteSnapshot.total_amount)}đ`} strong />
                      </div>
                      {renderContractSetupControls()}
                      {renderActionPanel({ embedded: true })}
                    </div>
                    <ContractDocumentsSidebarCard
                      contract={documentContract}
                      comparisonContract={previewContract}
                      quote={quote}
                    />
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-center text-[13px] uppercase text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                      <p className="text-center text-[13px] text-slate-950">Độc lập – Tự do – Hạnh phúc</p>
                      <p className="mt-3 text-center text-[18px] font-bold uppercase tracking-wide text-slate-950">{draft.title || DEFAULT_CONTRACT_TITLE}</p>
                      <p className="mt-1 text-center text-[13px] font-semibold text-slate-700">Số: {draft.contract_number || 'Số hợp đồng'}</p>
                      <div className="mt-3 space-y-1 text-[13px] leading-6 text-slate-700">
                        {preambleLines.map(line => <p key={line}>{line}</p>)}
                        <p className="pt-1">Hợp đồng cung cấp dịch vụ (sau đây gọi tắt là “Hợp đồng”) được lập và ký kết ngày <span className="font-semibold text-slate-950">{formatDate(draft.signing_date || getTodayInputDate())}</span> giữa các bên gồm:</p>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-5 xl:grid-cols-2">
                    <ProfileFields
                      title="Thông tin khách hàng"
                      eyebrow="Bên A"
                      value={draft.customer_snapshot}
                      onChange={updateCustomer}
                      companyLabel="Tên công ty / cá nhân"
                      type="customer"
                      customerOptions={customerOptions}
                      customerLookupState={customerLookupState}
                      onLookupCustomer={handleLookupCustomer}
                      onCreateCustomer={handleCreateCustomer}
                      onCopyTaxLookup={handleCopyTaxLookup}
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
                          <Select className="appearance-none border-orange-300 bg-orange-50 text-center font-semibold text-orange-700 focus:border-[#f8981d] sm:max-w-[132px]" value={draft.seller_entity_code || quote?.entity_code || 'EVT'} onChange={event => handleSellerEntityChange(event.target.value)}>
                            {legalEntities.map(entity => {
                              const code = entity.entity_code || entity.code
                              return <option key={code} value={code}>{entity.display_name || entity.legal_name || code}</option>
                            })}
                          </Select>
                        </div>
                      )}
                      footer={<p className="text-[13px] leading-6 text-slate-700">Sau khi thỏa thuận, Các Bên đồng ý ký kết Hợp Đồng này theo các điều khoản sau:</p>}
                    />
                  </div>

                  <section className="-mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 text-[13px] leading-6 text-slate-700">
                      <h3 className="text-[14px] font-semibold text-slate-900">ĐIỀU 1: NỘI DUNG HỢP ĐỒNG</h3>
                      <p className="mt-2">
                        <span>Bên A đề nghị Bên B và Bên B đồng ý cung cấp </span>
                        <span className="font-semibold text-slate-950">{serviceScopeDetail || 'Nội dung dịch vụ'}</span>
                        <span> cho Bên A, chi tiết như sau:</span>
                      </p>
                    </div>
                    <Field label="Nội dung dịch vụ sau chữ “cung cấp”" className="mt-3">
                      <Textarea rows={3} value={serviceScopeDetail} onChange={event => updateDraft({ service_scope: composeServiceScope(event.target.value) })} />
                    </Field>

                    <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left text-[13px]">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                            <tr>
                              <th className="w-[180px] px-4 py-3">Giờ</th>
                              <th className="w-[220px] px-4 py-3">Ngày</th>
                              <th className="px-4 py-3">Địa điểm</th>
                              <th className="w-[170px] px-4 py-3 text-right">Thao tác</th>
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
                                  <div className="flex justify-end gap-1.5">
                                    <button type="button" onClick={addScheduleRow} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                                      <Plus className="h-3.5 w-3.5" />
                                      Thêm lịch
                                    </button>
                                    <button type="button" onClick={() => removeScheduleRow(index)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 hover:bg-red-50" aria-label="Xoá lịch">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )) : (
                              <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                                  <div className="flex flex-col items-center gap-3">
                                    <span>Chưa có lịch triển khai.</span>
                                    <button type="button" onClick={addScheduleRow} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                                      <Plus className="h-3.5 w-3.5" />
                                      Thêm lịch
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    <p className="mt-4 text-[13px] font-semibold text-slate-900">Chi tiết hạng mục</p>
                    {!isQuoteSource ? (
                      <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(260px,1fr)_120px_160px_190px]">
                        <Field label="Tên hạng mục">
                          <TextInput
                            value={quotePreviewItems[0]?.service_name || ''}
                            onChange={event => updateSourceQuoteSnapshot({ service_name: event.target.value })}
                          />
                        </Field>
                        <Field label="Đơn vị">
                          <TextInput
                            value={quotePreviewItems[0]?.unit || 'Gói'}
                            onChange={event => updateSourceQuoteSnapshot({ unit: event.target.value })}
                          />
                        </Field>
                        <Field label="Giá trị">
                          <TextInput
                            inputMode="numeric"
                            value={formatCurrency(contractValueInput)}
                            onChange={event => updateSourceQuoteSnapshot({ amount: parseCurrencyInput(event.target.value) })}
                          />
                        </Field>
                        <Field label="VAT">
                          <Select
                            value={contractVatMode}
                            onChange={event => updateSourceQuoteSnapshot({ vat_mode: event.target.value })}
                          >
                            <option value="included">Đã bao gồm VAT</option>
                            <option value="excluded">Chưa bao gồm VAT</option>
                          </Select>
                        </Field>
                      </div>
                    ) : null}
                    <div className="mt-3">
                      <QuotePreview
                        quote={quotePreviewQuote}
                        items={quotePreviewItems}
                        totals={quotePreviewTotals}
                        entities={legalEntities}
                        sticky={false}
                        tableOnly
                        subtotalLabel={CONTRACT_SUBTOTAL_LABEL}
                      />
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-[13px] font-semibold text-slate-900">Lưu ý về thời gian làm việc và tiến độ bàn giao:</p>
                      <label className="mb-3 flex items-center gap-2 text-[12px] font-semibold text-slate-600">
                        <span className="shrink-0">Số giờ/buổi hoặc Số giờ/ngày</span>
                        <input
                          className="h-9 w-[150px] shrink-0 rounded-xl border border-slate-200 px-2.5 py-1.5 text-[12px] font-normal text-slate-900 outline-none transition placeholder:text-slate-300 focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                          value={workDurationText}
                          placeholder="Ví dụ: 4 giờ/buổi"
                          onChange={event => updateQuoteTableConfig({ work_duration_text: event.target.value })}
                        />
                      </label>
                      <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-700">
                        {workProgressNotes.map(item => <li key={item}>{item}</li>)}
                      </ul>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="grid items-end gap-3 lg:grid-cols-[110px_repeat(3,minmax(0,1fr))]">
                      <h2 className="pb-2 text-[16px] font-semibold text-slate-900">Thanh toán</h2>
                      <Field label="Tạm ứng (%)">
                        <TextInput type="number" min="0" max="100" value={draft.payment_config?.deposit_percent ?? 50} onChange={event => updatePaymentConfig({ deposit_percent: Number(event.target.value) })} />
                      </Field>
                      <Field label={hasPaymentAdvance ? 'Hạn thanh toán lần 2' : 'Hạn thanh toán'}>
                        <TextInput type="number" min="0" value={draft.payment_config?.final_due_days ?? 7} onChange={event => updatePaymentConfig({ final_due_days: Number(event.target.value) })} />
                      </Field>
                      {hasPaymentAdvance ? (
                        <Field label="Xuất hoá đơn sau tạm ứng">
                          <Select value={draft.payment_config?.issue_invoice_on_deposit ? 'yes' : 'no'} onChange={event => updatePaymentConfig({ issue_invoice_on_deposit: event.target.value === 'yes' })}>
                            <option value="yes">Có</option>
                            <option value="no">Không</option>
                          </Select>
                        </Field>
                      ) : null}
                    </div>
                    <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
                      <ContractPaymentSummary
                        quote={baseQuoteSnapshot}
                        paymentConfig={paymentConfig}
                      />
                      <p className="mt-3 text-[13px] font-semibold text-slate-900">Hồ sơ thanh toán:</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-700">
                        {paymentDocuments.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
                      </ul>
                      <LegalNoteList title="Lưu ý về thanh toán:" items={paymentNotes} />
                    </div>
                  </section>

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

      </section>
      {deleteConfirmOpen ? (
        <DeleteContractConfirmModal
          contractNumber={savedContract?.contract_number || draft?.contract_number}
          deleting={deleting}
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDeleteContract}
        />
      ) : null}
    </div>
  )
}
