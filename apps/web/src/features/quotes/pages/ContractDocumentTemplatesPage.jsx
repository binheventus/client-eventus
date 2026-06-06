import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CopyPlus, Eye, FileText, Plus, Save, ScrollText, Trash2 } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import QuoteBreadcrumb from '../components/QuoteBreadcrumb'
import NoticePopup from '../components/NoticePopup'
import ContractTemplatesPage from './ContractTemplatesPage'
import {
  deleteContractDocumentTemplate,
  listContractDocumentTemplates,
  saveContractDocumentTemplate,
} from '../hooks/useContracts'
import { useLegalEntities } from '../hooks/useLegalEntities'
import {
  findLegalEntityByCode,
  getEntityBankDetails,
  getEntityProfile,
  getLegalEntityCode,
  getLegalEntityLabel,
} from '../lib/contractDefaults'
import {
  ADVANCE_REQUEST_TEMPLATE_BLOCKS,
  ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS,
  ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS,
  CONTRACT_DOCUMENT_TYPES,
  CONTRACT_DOCUMENT_TYPE_ORDER,
  DEFAULT_DOCUMENT_NUMBER_PATTERN,
  PAYMENT_REQUEST_TEMPLATE_BLOCKS,
  documentTermsTextToSections,
  normalizeDocumentTemplate,
  sectionsToDocumentTermsText,
} from '../lib/contractDocumentTemplates'

const CONTRACT_TEMPLATE_KIND = 'contract'
const TEMPLATE_KIND_OPTIONS = [
  {
    id: CONTRACT_TEMPLATE_KIND,
    label: 'Hợp đồng',
    Icon: ScrollText,
  },
  ...CONTRACT_DOCUMENT_TYPE_ORDER.map(documentType => ({
    id: documentType,
    label: CONTRACT_DOCUMENT_TYPES[documentType].label,
    Icon: FileText,
  })),
]

function getTemplateRoute(templateKind) {
  if (templateKind === CONTRACT_TEMPLATE_KIND) return '/contracts/templates/contract'
  return `/contracts/templates/documents/${templateKind}`
}

function getTemplateKindFromRoute(pathname = '', documentType = '') {
  if (pathname === '/contracts/templates/contract') return CONTRACT_TEMPLATE_KIND
  if (CONTRACT_DOCUMENT_TYPES[documentType]) return documentType
  return CONTRACT_TEMPLATE_KIND
}

function getDocumentTemplateListTitle(documentType) {
  const label = CONTRACT_DOCUMENT_TYPES[documentType]?.label || 'chứng từ'
  const normalizedLabel = /^[A-Z]{2,}/.test(label) ? label : label.toLocaleLowerCase('vi-VN')

  return `Danh sách mẫu ${normalizedLabel}`
}

function getTemplateKindTitle(templateKind) {
  if (templateKind === CONTRACT_TEMPLATE_KIND) return 'Mẫu hợp đồng'

  return `Mẫu ${CONTRACT_DOCUMENT_TYPES[templateKind]?.label || 'chứng từ'}`
}

function getAdvanceRequestSections(template = {}) {
  const currentSections = Array.isArray(template.content_sections) ? template.content_sections : []
  const byId = new Map(currentSections.map(section => [section.id, section]))

  return ADVANCE_REQUEST_TEMPLATE_BLOCKS.map(block => ({
    ...block,
    ...(byId.get(block.id) || {}),
    title: byId.get(block.id)?.title || block.title,
    body: byId.get(block.id)?.body ?? block.body,
  }))
}

function getPaymentRequestSections(template = {}) {
  const currentSections = Array.isArray(template.content_sections) ? template.content_sections : []
  const byId = new Map(currentSections.map(section => [section.id, section]))

  return PAYMENT_REQUEST_TEMPLATE_BLOCKS.map(block => ({
    ...block,
    ...(byId.get(block.id) || {}),
    title: byId.get(block.id)?.title || block.title,
    body: byId.get(block.id)?.body ?? block.body,
  }))
}

function getAcceptanceLiquidationSections(template = {}) {
  const currentSections = Array.isArray(template.content_sections) ? template.content_sections : []
  const byId = new Map(currentSections.map(section => [section.id, section]))
  const defaultBlocks = hasAcceptanceCostDifference(template)
    ? ACCEPTANCE_LIQUIDATION_WITH_DIFFERENCE_TEMPLATE_BLOCKS
    : ACCEPTANCE_LIQUIDATION_TEMPLATE_BLOCKS

  return defaultBlocks.map(block => ({
    ...block,
    ...(byId.get(block.id) || {}),
    title: byId.get(block.id)?.title || block.title,
    body: byId.get(block.id)?.body ?? block.body,
  }))
}

function hasAcceptanceCostDifference(template = {}) {
  return Boolean(template.fields_config?.acceptance_cost_difference)
}

function getDocumentNumberPreview(template = {}) {
  const code = CONTRACT_DOCUMENT_TYPES[template.document_type]?.code || 'DNTT'
  const year = String(new Date().getFullYear())
  return String(template.document_number_pattern || DEFAULT_DOCUMENT_NUMBER_PATTERN)
    .replaceAll('{{sequence}}', '001')
    .replaceAll('{{document_type_code}}', code)
    .replaceAll('{{seller}}', template.seller_entity_code || 'EVT')
    .replaceAll('{{customer}}', 'KH')
    .replaceAll('{{year}}', year)
}

function getSellerBankDetails(entityCode = '', legalEntities = []) {
  const entity = findLegalEntityByCode(entityCode, legalEntities) || getEntityProfile(entityCode || 'EVENTUS')
  return getEntityBankDetails(entity)
}

function resolveSellerEntityCode(entityCode = '', legalEntities = []) {
  const selectedEntity = findLegalEntityByCode(entityCode, legalEntities)
  if (selectedEntity) return getLegalEntityCode(selectedEntity)
  return getLegalEntityCode(getSellerPreviewProfile(entityCode, legalEntities)) || entityCode || 'EVENTUS'
}

function getSellerPreviewProfile(entityCode = '', legalEntities = []) {
  const fallback = getEntityProfile(entityCode || 'EVENTUS')
  const entity = findLegalEntityByCode(entityCode, legalEntities) || fallback

  return {
    ...fallback,
    ...entity,
    company_name: entity.entity_name_full || entity.legal_name || entity.name || fallback.company_name || '',
    representative: entity.representative || fallback.representative || '',
    position: entity.position || fallback.position || '',
    address: entity.address || fallback.address || '',
    tax_code: entity.tax_code || fallback.tax_code || '',
  }
}

function getSellerPreviewTokenValues(entityCode = '', legalEntities = []) {
  const seller = getSellerPreviewProfile(entityCode, legalEntities)
  const bank = getEntityBankDetails(seller)

  return {
    seller_name: seller.company_name || '',
    seller_entity_name_full: seller.entity_name_full || seller.legal_name || seller.company_name || '',
    seller_representative: seller.representative || '',
    seller_position: seller.position || '',
    seller_address: seller.address || '',
    seller_tax_code: seller.tax_code || '',
    seller_bank_account: bank.account_number || '',
    seller_bank_name: bank.bank_name || '',
    seller_account_holder: bank.account_holder || '',
  }
}

function formatPreviewToken(token = '') {
  const normalized = String(token || '').trim()
  const label = normalized.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
  return label ? `${label.charAt(0).toUpperCase()}${label.slice(1)}` : ''
}

function PreviewText({ text = '', tokenValues = {} }) {
  const parts = String(text || '').split(/(\{\{[^}]+\}\})/g).filter(part => part !== '')
  return parts.map((part, index) => {
    const match = part.match(/^\{\{([^}]+)\}\}$/)
    if (!match) return <span key={`${part}-${index}`}>{part}</span>
    const token = String(match[1] || '').trim()
    const value = tokenValues[token]
    if (value) {
      return <span key={`${part}-${index}`} className="text-slate-950">{value}</span>
    }
    return (
      <span key={`${part}-${index}`} className="font-semibold text-red-600">
        {formatPreviewToken(token)}
      </span>
    )
  })
}

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
      ...(documentType === 'acceptance_liquidation' ? { acceptance_cost_difference: false } : {}),
    },
    numbering_config: {
      sequence_scope: 'seller_entity_code + document_type + sequence_year',
      sequence_token: '{{sequence}}',
    },
    content_sections: [],
    terms_text: '',
    is_default: false,
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

function PreviewModal({ title = 'Preview', children, onClose }) {
  useEscapeToClose(onClose)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <section className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="text-[18px] font-semibold text-slate-950">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Đóng preview"
          >
            ×
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-5">
          {children}
        </div>
      </section>
    </div>
  )
}

function A4PreviewPage({ children, className = '' }) {
  return (
    <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100 p-4 shadow-sm">
      <div className={`mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[18mm] py-[16mm] text-[13px] leading-6 text-slate-950 shadow-sm ring-1 ring-slate-200 ${className}`}>
        {children}
      </div>
    </section>
  )
}

function BankPreviewValue({ value, token }) {
  return (
    <span className="font-bold text-slate-950">
      {value ? value : <PreviewText text={`{{${token}}}`} />}
    </span>
  )
}

function BankPreviewPlainValue({ value, token }) {
  return value ? <span className="text-slate-950">{value}</span> : <PreviewText text={`{{${token}}}`} />
}

function getBankDetailLineParts(line = '') {
  const match = String(line || '').match(/^(\s*(?:Tài khoản chuyển khoản|Ngân hàng|Chủ tài khoản)\s*:\s*)(.+)$/i)
  if (!match) return null
  return {
    label: match[1],
    value: match[2],
  }
}

function BankAwarePreviewLine({ line = '', tokenValues = {} }) {
  const bankLine = getBankDetailLineParts(line)
  if (!bankLine) return <PreviewText text={line} tokenValues={tokenValues} />

  return (
    <>
      {bankLine.label}
      <span className="font-bold text-slate-950">
        <PreviewText text={bankLine.value} tokenValues={tokenValues} />
      </span>
    </>
  )
}

function PaymentRequestTemplatePreview({ template, legalEntities = [] }) {
  const sectionMap = new Map(getPaymentRequestSections(template).map(section => [section.id, section.body]))
  const getBody = sectionId => sectionMap.get(sectionId) || ''
  const closingLines = String(getBody('payment-closing')).split(/\n+/).filter(Boolean)
  const sellerEntityCode = resolveSellerEntityCode(template.seller_entity_code, legalEntities)
  const bank = getSellerBankDetails(sellerEntityCode, legalEntities)

  return (
    <A4PreviewPage>
      <div className="text-center font-bold">
        <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p>Độc lập - Tự do - Hạnh phúc</p>
      </div>
      <p className="mt-6 text-right italic">Ngày <PreviewText text="{{issued_date}}" /></p>
      <h3 className="mt-7 text-center text-[20px] font-bold uppercase tracking-wide">{template.title || 'Đề nghị thanh toán'}</h3>
      <p className="mt-1 text-center">Số: {getDocumentNumberPreview({ ...template, seller_entity_code: sellerEntityCode })}</p>

      <div className="mt-8 space-y-5">
        {getBody('payment-greeting') ? <p><PreviewText text={getBody('payment-greeting')} /></p> : null}
        {getBody('payment-basis') ? <p><PreviewText text={getBody('payment-basis')} /></p> : null}
        {getBody('payment-request') ? <p><PreviewText text={getBody('payment-request')} /></p> : null}
        {getBody('payment-amount-words') ? <p><PreviewText text={getBody('payment-amount-words')} /></p> : null}
        {getBody('payment-method') ? <p><PreviewText text={getBody('payment-method')} /></p> : null}
        <div className="space-y-1">
          {getBody('payment-bank-intro') ? <p><PreviewText text={getBody('payment-bank-intro')} /></p> : null}
          <p>Tài khoản chuyển khoản: <BankPreviewValue value={bank.account_number} token="seller_bank_account" /></p>
          <p>Ngân hàng: <BankPreviewValue value={bank.bank_name} token="seller_bank_name" /></p>
          <p>Chủ tài khoản: <BankPreviewValue value={bank.account_holder} token="seller_account_holder" /></p>
        </div>
        {closingLines.length ? (
          <p>
            {closingLines.map((line, index) => (
              <span key={`${line}-${index}`}>
                <PreviewText text={line} />
                {index < closingLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="mt-10 flex justify-end pr-12 text-center font-bold">
        <p>ĐẠI DIỆN</p>
      </div>
    </A4PreviewPage>
  )
}

function AdvanceRequestTemplatePreview({ template, legalEntities = [] }) {
  const sectionMap = new Map(getAdvanceRequestSections(template).map(section => [section.id, section.body]))
  const getBody = sectionId => sectionMap.get(sectionId) || ''
  const closingLines = String(getBody('advance-closing')).split(/\n+/).filter(Boolean)
  const sellerEntityCode = resolveSellerEntityCode(template.seller_entity_code, legalEntities)
  const bank = getSellerBankDetails(sellerEntityCode, legalEntities)

  return (
    <A4PreviewPage>
      <div className="text-center font-bold">
        <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p>Độc lập - Tự do - Hạnh phúc</p>
      </div>
      <p className="mt-6 text-right italic">Ngày <PreviewText text="{{issued_date}}" /></p>
      <h3 className="mt-7 text-center text-[20px] font-bold uppercase tracking-wide">{template.title || 'Đề nghị tạm ứng'}</h3>
      <p className="mt-1 text-center">Số: {getDocumentNumberPreview({ ...template, seller_entity_code: sellerEntityCode })}</p>

      <div className="mt-8 space-y-5">
        {getBody('advance-greeting') ? <p><PreviewText text={getBody('advance-greeting')} /></p> : null}
        {getBody('advance-basis') ? <p><PreviewText text={getBody('advance-basis')} /></p> : null}
        {getBody('advance-request') ? <p><PreviewText text={getBody('advance-request')} /></p> : null}
        {getBody('advance-amount-words') ? <p><PreviewText text={getBody('advance-amount-words')} /></p> : null}
        {getBody('advance-method') ? <p><PreviewText text={getBody('advance-method')} /></p> : null}
        <div className="space-y-1">
          {getBody('advance-bank-intro') ? <p><PreviewText text={getBody('advance-bank-intro')} /></p> : null}
          <p>Tài khoản chuyển khoản: <BankPreviewValue value={bank.account_number} token="seller_bank_account" /></p>
          <p>Ngân hàng: <BankPreviewValue value={bank.bank_name} token="seller_bank_name" /></p>
          <p>Chủ tài khoản: <BankPreviewValue value={bank.account_holder} token="seller_account_holder" /></p>
        </div>
        {closingLines.length ? (
          <p>
            {closingLines.map((line, index) => (
              <span key={`${line}-${index}`}>
                <PreviewText text={line} />
                {index < closingLines.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <div className="mt-10 flex justify-end pr-12 text-center font-bold">
        <p>ĐẠI DIỆN</p>
      </div>
    </A4PreviewPage>
  )
}

function PartyPreviewRows({ title, nameToken, representativeToken, positionToken, addressToken, taxCodeToken, bank, tokenValues = {} }) {
  return (
    <div className="space-y-1">
      <p><span className="font-bold">{title}:</span> <PreviewText text={`{{${nameToken}}}`} tokenValues={tokenValues} /></p>
      <p>Đại diện: <PreviewText text={`{{${representativeToken}}}`} tokenValues={tokenValues} /> - Chức vụ: <PreviewText text={`{{${positionToken}}}`} tokenValues={tokenValues} /></p>
      <p>Địa chỉ: <PreviewText text={`{{${addressToken}}}`} tokenValues={tokenValues} /></p>
      <p>Mã số thuế: <PreviewText text={`{{${taxCodeToken}}}`} tokenValues={tokenValues} /></p>
      {bank ? (
        <>
          <p>Số tài khoản: <BankPreviewPlainValue value={bank.account_number} token="seller_bank_account" /></p>
          <p>Ngân hàng: <BankPreviewPlainValue value={bank.bank_name} token="seller_bank_name" /></p>
        </>
      ) : null}
    </div>
  )
}

function TemplateAmountTablePreview({ title, totalToken }) {
  return (
    <div className="space-y-2">
      <p><span className="font-semibold">{title}</span>:</p>
      <div className="overflow-hidden border border-slate-300">
        <table className="w-full text-[12px] leading-5">
          <thead>
            <tr className="bg-slate-100">
              {['STT', 'Hạng mục', 'ĐVT', 'Số lượng', 'Đơn giá (VNĐ)', 'Thành tiền (VNĐ)'].map(label => (
                <th key={label} className="border border-slate-300 px-2 py-1 text-left font-semibold">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-slate-300 px-2 py-1 text-center">1</td>
              <td className="border border-slate-300 px-2 py-1"><PreviewText text="{{service_item_name}}" /></td>
              <td className="border border-slate-300 px-2 py-1"><PreviewText text="{{unit}}" /></td>
              <td className="border border-slate-300 px-2 py-1 text-right"><PreviewText text="{{quantity}}" /></td>
              <td className="border border-slate-300 px-2 py-1 text-right"><PreviewText text="{{unit_price}}" /></td>
              <td className="border border-slate-300 px-2 py-1 text-right"><PreviewText text="{{line_total}}" /></td>
            </tr>
            <tr>
              <td colSpan={5} className="border border-slate-300 px-2 py-1 text-right font-semibold">Tổng chi phí (Đã bao gồm VAT)</td>
              <td className="border border-slate-300 px-2 py-1 text-right font-semibold"><PreviewText text={`{{${totalToken}}}`} /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AcceptanceLiquidationTemplatePreview({ template, legalEntities = [] }) {
  const sectionMap = new Map(getAcceptanceLiquidationSections(template).map(section => [section.id, section.body]))
  const getBody = sectionId => sectionMap.get(sectionId) || ''
  const bank = getSellerBankDetails(template.seller_entity_code, legalEntities)
  const tokenValues = getSellerPreviewTokenValues(template.seller_entity_code, legalEntities)
  const articles = getAcceptanceLiquidationSections(template).filter(section => section.id.startsWith('acceptance-article-'))
  const costDifferenceNote = getAcceptanceLiquidationSections(template).find(section => section.id === 'acceptance-cost-difference-note')
  const showCostDifferenceTables = hasAcceptanceCostDifference(template)

  return (
    <A4PreviewPage>
      <div className="text-center font-bold">
        <p>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p>Độc lập - Tự do - Hạnh phúc</p>
      </div>
      <h3 className="mt-7 whitespace-nowrap text-center text-[19px] font-bold uppercase tracking-wide">
        BIÊN BẢN NGHIỆM THU VÀ THANH LÝ HỢP ĐỒNG
      </h3>

      <div className="mt-8 space-y-4">
        <div>
          {getBody('acceptance-basis-contract') ? <p><PreviewText text={getBody('acceptance-basis-contract')} tokenValues={tokenValues} /></p> : null}
          {getBody('acceptance-basis-completed') ? <p><PreviewText text={getBody('acceptance-basis-completed')} tokenValues={tokenValues} /></p> : null}
          {getBody('acceptance-party-intro') ? <p><PreviewText text={getBody('acceptance-party-intro')} tokenValues={tokenValues} /></p> : null}
        </div>
        <PartyPreviewRows
          title="BÊN A"
          nameToken="customer_name"
          representativeToken="customer_representative"
          positionToken="customer_position"
          addressToken="customer_address"
          taxCodeToken="customer_tax_code"
          tokenValues={tokenValues}
        />
        <p>Và</p>
        <PartyPreviewRows
          title="BÊN B"
          nameToken="seller_name"
          representativeToken="seller_representative"
          positionToken="seller_position"
          addressToken="seller_address"
          taxCodeToken="seller_tax_code"
          bank={bank}
          tokenValues={tokenValues}
        />
        {getBody('acceptance-signing-intro') ? <p><PreviewText text={getBody('acceptance-signing-intro')} tokenValues={tokenValues} /></p> : null}
        {articles.map(section => (
          <div key={section.id} className="space-y-2">
            <p className="font-bold uppercase">{section.title}</p>
            {String(section.body || '').split(/\n+/).filter(Boolean).map((line, index) => (
              <p key={`${section.id}-${index}`}><BankAwarePreviewLine line={line} tokenValues={tokenValues} /></p>
            ))}
            {showCostDifferenceTables && section.id === 'acceptance-article-2' ? (
              <div className="space-y-4">
                <TemplateAmountTablePreview title="Chi tiết hạng mục trên hợp đồng" totalToken="contract_total" />
                <TemplateAmountTablePreview title="Chi tiết hạng mục nghiệm thu" totalToken="acceptance_total" />
                {costDifferenceNote?.body ? <p><PreviewText text={costDifferenceNote.body} tokenValues={tokenValues} /></p> : null}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-8 text-center font-bold">
        <div>
          <p>ĐẠI DIỆN BÊN A</p>
          <div className="h-32" />
        </div>
        <div>
          <p>ĐẠI DIỆN BÊN B</p>
          <div className="h-32" />
        </div>
      </div>
    </A4PreviewPage>
  )
}

function PreviewPanel({ template, legalEntities = [] }) {
  const sections = Array.isArray(template.content_sections) ? template.content_sections : []

  if (template.document_type === 'acceptance_liquidation') {
    return <AcceptanceLiquidationTemplatePreview template={template} legalEntities={legalEntities} />
  }

  if (template.document_type === 'payment_request') {
    return <PaymentRequestTemplatePreview template={template} legalEntities={legalEntities} />
  }

  if (template.document_type === 'advance_request') {
    return <AdvanceRequestTemplatePreview template={template} legalEntities={legalEntities} />
  }

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

function PaymentRequestContentEditor({ template, onChangeSection }) {
  const sections = getPaymentRequestSections(template)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-950">Nội dung form DNTT</h3>
          <p className="mt-1 text-[12px] leading-5 text-slate-500">Các biến trong dấu ngoặc nhọn sẽ được tô đỏ trong Preview và tự điền khi tạo chứng từ.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {sections.map(section => (
          <label key={section.id} className="block rounded-xl border border-slate-200 bg-white p-3">
            <span className="mb-2 block text-[12px] font-semibold text-slate-700">{section.title}</span>
            <Textarea
              rows={section.id === 'payment-basis' ? 4 : 2}
              value={section.body || ''}
              onChange={event => onChangeSection(section.id, event.target.value)}
              className="rounded-lg border-slate-200 bg-slate-50"
            />
          </label>
        ))}
      </div>
    </section>
  )
}

function AdvanceRequestContentEditor({ template, onChangeSection }) {
  const sections = getAdvanceRequestSections(template)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-950">Nội dung form DNTU</h3>
          <p className="mt-1 text-[12px] leading-5 text-slate-500">Bám theo file mẫu Đề nghị tạm ứng. Số tiền, tỷ lệ, khách hàng, hợp đồng và ngân hàng sẽ tự điền khi tạo chứng từ.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {sections.map(section => (
          <label key={section.id} className="block rounded-xl border border-slate-200 bg-white p-3">
            <span className="mb-2 block text-[12px] font-semibold text-slate-700">{section.title}</span>
            <Textarea
              rows={section.id === 'advance-basis' ? 4 : 2}
              value={section.body || ''}
              onChange={event => onChangeSection(section.id, event.target.value)}
              className="rounded-lg border-slate-200 bg-slate-50"
            />
          </label>
        ))}
      </div>
    </section>
  )
}

function AcceptanceLiquidationContentEditor({ template, onChangeSection }) {
  const sections = getAcceptanceLiquidationSections(template)
  const introSectionIds = new Set([
    'acceptance-basis-contract',
    'acceptance-basis-completed',
    'acceptance-party-intro',
  ])
  const introSections = sections.filter(section => introSectionIds.has(section.id))
  const remainingSections = sections.filter(section => !introSectionIds.has(section.id))

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[16px] font-semibold text-slate-950">Nội dung form BBNT kiêm thanh lý</h3>
          <p className="mt-1 text-[12px] leading-5 text-slate-500">Bố cục bám theo file mẫu. Các biến sẽ tự điền khi tạo chứng từ và hiển thị chữ đỏ trong Preview.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {introSections.length ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            {introSections.map(section => (
              <Textarea
                key={section.id}
                aria-label={section.title}
                rows={section.id === 'acceptance-basis-contract' ? 2 : 1}
                value={section.body || ''}
                onChange={event => onChangeSection(section.id, event.target.value)}
                className="resize-y !rounded-none !border-0 !bg-transparent !px-0 !py-0 focus:!border-transparent focus:!ring-0"
              />
            ))}
          </div>
        ) : null}
        {remainingSections.map(section => (
          <label key={section.id} className="block rounded-xl border border-slate-200 bg-white p-3">
            <span className="mb-2 block text-[12px] font-semibold text-slate-700">{section.title}</span>
            <Textarea
              rows={section.id.startsWith('acceptance-article-') || section.id === 'acceptance-cost-difference-note' ? 6 : 2}
              value={section.body || ''}
              onChange={event => onChangeSection(section.id, event.target.value)}
              className="rounded-lg border-slate-200 bg-slate-50"
            />
          </label>
        ))}
      </div>
    </section>
  )
}

function PaymentRequestNumberingPanel({ template, legalEntities = [], onChange }) {
  const selectedEntity = findLegalEntityByCode(template.seller_entity_code, legalEntities)
  const selectedCode = getLegalEntityCode(selectedEntity || {}) || resolveSellerEntityCode(template.seller_entity_code, legalEntities)
  const bank = getSellerBankDetails(selectedCode || template.seller_entity_code, legalEntities)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <Field label="Tiêu đề chứng từ">
          <Input value={template.title || ''} onChange={event => onChange({ title: event.target.value })} />
        </Field>
        <Field label="Pháp nhân">
          <Select value={selectedCode} onChange={event => onChange({ seller_entity_code: event.target.value })}>
            {!legalEntities.length ? <option value={selectedCode}>{selectedCode || 'EVENTUS'}</option> : null}
            {legalEntities.map(entity => {
              const code = getLegalEntityCode(entity)
              return (
                <option key={code} value={code}>
                  {getLegalEntityLabel(entity)}
                </option>
              )
            })}
          </Select>
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[12px] font-semibold text-slate-500">Preview số chứng từ</p>
          <p className="mt-1 break-all font-mono text-[15px] font-semibold text-slate-950">{getDocumentNumberPreview({ ...template, seller_entity_code: selectedCode })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-700">
          <p><span className="font-semibold text-slate-950">Tài khoản chuyển khoản:</span> <span className="font-bold text-slate-950">{bank.account_number || '-'}</span></p>
          <p><span className="font-semibold text-slate-950">Ngân hàng:</span> <span className="font-bold text-slate-950">{bank.bank_name || '-'}</span></p>
          <p><span className="font-semibold text-slate-950">Chủ tài khoản:</span> <span className="font-bold text-slate-950">{bank.account_holder || '-'}</span></p>
        </div>
      </div>
    </section>
  )
}

function AdvanceRequestNumberingPanel({ template, legalEntities = [], onChange }) {
  const selectedEntity = findLegalEntityByCode(template.seller_entity_code, legalEntities)
  const selectedCode = getLegalEntityCode(selectedEntity || {}) || resolveSellerEntityCode(template.seller_entity_code, legalEntities)
  const bank = getSellerBankDetails(selectedCode || template.seller_entity_code, legalEntities)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <Field label="Tiêu đề chứng từ">
          <Input value={template.title || ''} onChange={event => onChange({ title: event.target.value })} />
        </Field>
        <Field label="Pháp nhân">
          <Select value={selectedCode} onChange={event => onChange({ seller_entity_code: event.target.value })}>
            {!legalEntities.length ? <option value={selectedCode}>{selectedCode || 'EVENTUS'}</option> : null}
            {legalEntities.map(entity => {
              const code = getLegalEntityCode(entity)
              return (
                <option key={code} value={code}>
                  {getLegalEntityLabel(entity)}
                </option>
              )
            })}
          </Select>
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[12px] font-semibold text-slate-500">Preview số chứng từ</p>
          <p className="mt-1 break-all font-mono text-[15px] font-semibold text-slate-950">{getDocumentNumberPreview({ ...template, seller_entity_code: selectedCode })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-700">
          <p><span className="font-semibold text-slate-950">Tài khoản chuyển khoản:</span> <span className="font-bold text-slate-950">{bank.account_number || '-'}</span></p>
          <p><span className="font-semibold text-slate-950">Ngân hàng:</span> <span className="font-bold text-slate-950">{bank.bank_name || '-'}</span></p>
          <p><span className="font-semibold text-slate-950">Chủ tài khoản:</span> <span className="font-bold text-slate-950">{bank.account_holder || '-'}</span></p>
        </div>
      </div>
    </section>
  )
}

function AcceptanceLiquidationNumberingPanel({ template, legalEntities = [], onChange }) {
  const selectedEntity = findLegalEntityByCode(template.seller_entity_code, legalEntities)
  const selectedCode = getLegalEntityCode(selectedEntity || {}) || resolveSellerEntityCode(template.seller_entity_code, legalEntities)
  const bank = getSellerBankDetails(selectedCode || template.seller_entity_code, legalEntities)

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
        <Field label="Tiêu đề chứng từ">
          <Input value={template.title || ''} onChange={event => onChange({ title: event.target.value })} />
        </Field>
        <Field label="Pháp nhân">
          <Select value={selectedCode} onChange={event => onChange({ seller_entity_code: event.target.value })}>
            {!legalEntities.length ? <option value={selectedCode}>{selectedCode || 'EVENTUS'}</option> : null}
            {legalEntities.map(entity => {
              const code = getLegalEntityCode(entity)
              return (
                <option key={code} value={code}>
                  {getLegalEntityLabel(entity)}
                </option>
              )
            })}
          </Select>
        </Field>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[12px] font-semibold text-slate-500">Preview số chứng từ</p>
          <p className="mt-1 break-all font-mono text-[15px] font-semibold text-slate-950">{getDocumentNumberPreview({ ...template, seller_entity_code: selectedCode })}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] leading-6 text-slate-700">
          <p><span className="font-semibold text-slate-950">Tài khoản chuyển khoản:</span> <span className="font-bold text-slate-950">{bank.account_number || '-'}</span></p>
          <p><span className="font-semibold text-slate-950">Ngân hàng:</span> <span className="font-bold text-slate-950">{bank.bank_name || '-'}</span></p>
          <p><span className="font-semibold text-slate-950">Chủ tài khoản:</span> <span className="font-bold text-slate-950">{bank.account_holder || '-'}</span></p>
        </div>
      </div>
    </section>
  )
}

export default function ContractDocumentTemplatesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { documentType = '' } = useParams()
  const { legalEntities } = useLegalEntities()
  const invalidDocumentType = Boolean(documentType) && !CONTRACT_DOCUMENT_TYPES[documentType]
  const initialTemplateKind = getTemplateKindFromRoute(location.pathname, documentType)
  const initialDocumentType = CONTRACT_DOCUMENT_TYPES[initialTemplateKind] ? initialTemplateKind : 'advance_request'
  const [templates, setTemplates] = useState([])
  const [selectedKind, setSelectedKind] = useState(initialTemplateKind)
  const [selectedType, setSelectedType] = useState(initialDocumentType)
  const [selectedId, setSelectedId] = useState('')
  const [draft, setDraft] = useState(() => buildEmptyTemplate(initialDocumentType))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [createContractTemplate, setCreateContractTemplate] = useState(null)

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
  const registerContractCreateNew = useCallback(action => {
    setCreateContractTemplate(() => action)
  }, [])

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
    if (invalidDocumentType) return

    const nextKind = getTemplateKindFromRoute(location.pathname, documentType)
    if (nextKind === selectedKind && (!CONTRACT_DOCUMENT_TYPES[nextKind] || selectedType === nextKind)) return

    if (!CONTRACT_DOCUMENT_TYPES[nextKind]) {
      setSelectedKind(CONTRACT_TEMPLATE_KIND)
      setNotice('')
      setError('')
      setPreviewOpen(false)
      setDeleteConfirmOpen(false)
      return
    }

    selectType(nextKind)
  }, [documentType, invalidDocumentType, location.pathname, selectedKind, selectedType, templates])

  function selectTemplateKind(templateKind) {
    setSelectedKind(templateKind)
    navigate(getTemplateRoute(templateKind))

    if (!CONTRACT_DOCUMENT_TYPES[templateKind]) {
      setNotice('')
      setError('')
      setPreviewOpen(false)
      setDeleteConfirmOpen(false)
      return
    }

    selectType(templateKind)
  }

  function selectType(documentType) {
    const next = templates.find(row => row.document_type === documentType && row.is_default)
      || templates.find(row => row.document_type === documentType)
      || buildEmptyTemplate(documentType)
    setSelectedKind(documentType)
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
    setDraft(prev => {
      const normalized = normalizeDocumentTemplate({ ...prev, ...patch })
      const liveTextPatch = {}

      ;['name', 'description', 'title', 'seller_entity_code', 'document_number_pattern', 'terms_text'].forEach(field => {
        if (Object.prototype.hasOwnProperty.call(patch, field)) {
          liveTextPatch[field] = String(patch[field] ?? '')
        }
      })

      return { ...normalized, ...liveTextPatch }
    })
    setNotice('')
  }

  function updateTermsText(value) {
    updateDraft({
      terms_text: value,
      content_sections: documentTermsTextToSections(value),
    })
  }

  function updatePaymentRequestSection(sectionId, body) {
    const nextSections = getPaymentRequestSections(draft).map(section => (
      section.id === sectionId ? { ...section, body } : section
    ))
    updateDraft({
      content_sections: nextSections,
      terms_text: sectionsToDocumentTermsText(nextSections),
    })
  }

  function updateAdvanceRequestSection(sectionId, body) {
    const nextSections = getAdvanceRequestSections(draft).map(section => (
      section.id === sectionId ? { ...section, body } : section
    ))
    updateDraft({
      content_sections: nextSections,
      terms_text: sectionsToDocumentTermsText(nextSections),
    })
  }

  function updateAcceptanceLiquidationSection(sectionId, body) {
    const nextSections = getAcceptanceLiquidationSections(draft).map(section => (
      section.id === sectionId ? { ...section, body } : section
    ))
    updateDraft({
      content_sections: nextSections,
      terms_text: sectionsToDocumentTermsText(nextSections),
    })
  }

  function updateAcceptanceCostDifference(enabled) {
    const fieldsConfig = {
      ...(draft.fields_config || {}),
      acceptance_cost_difference: Boolean(enabled),
    }
    const nextTemplate = {
      ...draft,
      fields_config: fieldsConfig,
    }
    const nextSections = getAcceptanceLiquidationSections(nextTemplate)

    updateDraft({
      fields_config: fieldsConfig,
      content_sections: nextSections,
      terms_text: sectionsToDocumentTermsText(nextSections),
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
      const shouldPreserveStructuredSections = ['advance_request', 'acceptance_liquidation', 'payment_request'].includes(draft.document_type)
      const structuredSections = draft.document_type === 'advance_request'
        ? getAdvanceRequestSections(draft)
        : draft.document_type === 'payment_request'
        ? getPaymentRequestSections(draft)
        : draft.document_type === 'acceptance_liquidation'
          ? getAcceptanceLiquidationSections(draft)
          : []
      const termsText = shouldPreserveStructuredSections
        ? sectionsToDocumentTermsText(structuredSections)
        : String(draft.terms_text || sectionsToDocumentTermsText(draft.content_sections)).trim()
      const payload = {
        ...draft,
        id: draft.id || undefined,
        terms_text: termsText,
        content_sections: shouldPreserveStructuredSections
          ? structuredSections
          : termsText
            ? documentTermsTextToSections(termsText)
            : draft.content_sections,
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

  if (invalidDocumentType) {
    return <Navigate replace to="/contracts/templates/documents/advance_request" />
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <NoticePopup message={notice} onClose={() => setNotice('')} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <QuoteBreadcrumb root={{ label: 'Hợp đồng', to: '/contracts' }} items={[{ label: 'Mẫu tài liệu' }]} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_KIND_OPTIONS.map(option => {
            const Icon = option.Icon
            const isSelected = selectedKind === option.id
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => selectTemplateKind(option.id)}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition ${
                  isSelected ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                {option.label}
              </button>
            )
          })}
        </div>
        {selectedKind === CONTRACT_TEMPLATE_KIND ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => createContractTemplate?.()}
              disabled={!createContractTemplate}
              className="inline-flex items-center gap-2 rounded-xl border border-[#f8981d] bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Mẫu mới
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={duplicateCurrent} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              <CopyPlus className="h-4 w-4" />
              Nhân bản
            </button>
            <button type="button" onClick={createNew} className="inline-flex items-center gap-2 rounded-xl border border-[#f8981d] bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500">
              <Plus className="h-4 w-4" />
              Mẫu mới
            </button>
          </div>
        )}
      </div>

      <h2 className="text-[20px] font-semibold tracking-tight text-slate-950">{getTemplateKindTitle(selectedKind)}</h2>

      {selectedKind === CONTRACT_TEMPLATE_KIND ? (
        <ContractTemplatesPage embedded onCreateNewReady={registerContractCreateNew} onSuccessNotice={setNotice} />
      ) : (
        <>
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p>}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="px-2 py-2 text-[12px] font-semibold text-slate-400">{getDocumentTemplateListTitle(selectedType)}</div>
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
                      {template.document_type === 'acceptance_liquidation' ? (
                        hasAcceptanceCostDifference(template)
                          ? <span className="rounded-full bg-orange-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-orange-700">Có bảng</span>
                          : <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500">Không bảng</span>
                      ) : null}
                      {template.is_default ? <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-emerald-700">Default</span> : null}
                    </span>
                  </div>
                </button>
              )
            }) : (
              <p className="px-2 py-6 text-center text-[13px] text-slate-400">Chưa có mẫu chứng từ.</p>
            )}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-3 xl:grid-cols-[minmax(280px,1fr)_90px_94px]">
              <Field label="Tên mẫu chứng từ">
                <Input value={draft.name} onChange={event => updateDraft({ name: event.target.value })} />
              </Field>
              <Field label="Thứ tự">
                <Input type="number" value={draft.sort_order} onChange={event => updateDraft({ sort_order: Number(event.target.value) })} className="text-center" />
              </Field>
              <label className="block">
                <span className="mb-1.5 block text-center text-[12px] font-semibold text-slate-600">Mặc định</span>
                <span className="flex min-h-[42px] items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50">
                  <input type="checkbox" checked={Boolean(draft.is_default)} onChange={event => updateDraft({ is_default: event.target.checked })} className="h-4 w-4 accent-[#f8981d]" />
                </span>
              </label>
            </div>
            {draft.document_type === 'acceptance_liquidation' ? (
              <div className="mt-4 grid gap-2 md:grid-cols-[340px_minmax(220px,360px)] md:items-center">
                <span className="whitespace-nowrap text-[12px] font-semibold text-slate-600">Cơ chế hiển thị bảng giá trị nghiệm thu/thực tế:</span>
                <Select
                  value={hasAcceptanceCostDifference(draft) ? 'show' : 'hide'}
                  onChange={event => updateAcceptanceCostDifference(event.target.value === 'show')}
                >
                  <option value="show">Hiển thị bảng giá trị nghiệm thu/thực tế</option>
                  <option value="hide">Không hiển thị bảng</option>
                </Select>
              </div>
            ) : null}
          </section>

          {draft.document_type === 'acceptance_liquidation' ? (
            <>
              <AcceptanceLiquidationNumberingPanel template={draft} legalEntities={legalEntities} onChange={updateDraft} />
              <AcceptanceLiquidationContentEditor template={draft} onChangeSection={updateAcceptanceLiquidationSection} />
            </>
          ) : draft.document_type === 'payment_request' ? (
            <>
              <PaymentRequestNumberingPanel template={draft} legalEntities={legalEntities} onChange={updateDraft} />
              <PaymentRequestContentEditor template={draft} onChangeSection={updatePaymentRequestSection} />
            </>
          ) : draft.document_type === 'advance_request' ? (
            <>
              <AdvanceRequestNumberingPanel template={draft} legalEntities={legalEntities} onChange={updateDraft} />
              <AdvanceRequestContentEditor template={draft} onChangeSection={updateAdvanceRequestSection} />
            </>
          ) : (
            <>
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
                <Field label="Content/form sections">
                  <Textarea
                    rows={16}
                    value={draft.terms_text ?? sectionsToDocumentTermsText(draft.content_sections)}
                    onChange={event => updateTermsText(event.target.value)}
                  />
                </Field>
              </section>

            </>
          )}

          {previewOpen ? (
            <PreviewModal
              title={`Preview${draft.name ? ` - ${draft.name}` : ''}`}
              onClose={() => setPreviewOpen(false)}
            >
              <PreviewPanel template={draft} legalEntities={legalEntities} />
            </PreviewModal>
          ) : null}

          <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-[12px] text-slate-500">{formatLastEdited(draft)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#f8981d] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-orange-500">
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
        </>
      )}
    </div>
  )
}
