import { useMemo, useState } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Check, Copy, Download, FileText, X } from 'lucide-react'
import ContractPDFDocument, { getContractPdfFilename } from './ContractPDFDocument'
import { downloadContractDocx } from '../lib/contractDocx'
import {
  DEFAULT_CONTRACT_PREAMBLE,
  DEFAULT_PAYMENT_CONFIG,
  numberToVietnameseWords,
  sectionsToTermsText,
  termsTextToSections,
} from '../lib/contractDefaults'

function hasText(value) {
  return String(value ?? '').trim().length > 0
}

function getServiceScopeDetail(value = '') {
  return String(value || '').replace(/^cung cấp\s+/i, '').trim()
}

function formatCurrency(value) {
  const number = Number(value || 0)
  return number > 0 ? new Intl.NumberFormat('vi-VN').format(number) : ''
}

function formatContractDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('vi-VN').format(date)
}

function getPartyRole(contract = {}, partyKey = 'party_a') {
  return contract.party_role_config?.[partyKey] || (partyKey === 'party_a' ? 'customer' : 'seller')
}

function getPartyProfile(contract = {}, partyKey = 'party_a') {
  const role = getPartyRole(contract, partyKey)
  return role === 'seller' ? contract.seller_snapshot || {} : contract.customer_snapshot || {}
}

function getProfileName(profile = {}) {
  return profile.company_name || profile.legal_name || ''
}

function PreviewValue({ value, fallback, className = '' }) {
  const missing = !hasText(value)
  return (
    <span className={missing ? 'font-semibold text-red-600' : className}>
      {missing ? fallback : value}
    </span>
  )
}

function PreviewLine({ label, value, fallback = label }) {
  return (
    <p className="text-[13px] leading-6 text-slate-700">
      <span className="font-semibold text-slate-900">{label}:</span>{' '}
      <PreviewValue value={value} fallback={fallback} />
    </p>
  )
}

function PartyPreview({ heading, profile = {}, fallbackPrefix }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[13px] leading-6 text-slate-950">
        <span className="font-bold">{heading}</span>{' '}
        <PreviewValue value={getProfileName(profile)} fallback={`Tên ${fallbackPrefix}`} className="font-semibold text-slate-950" />
      </p>
      <PreviewLine label="Đại diện" value={profile.representative} fallback={`Người đại diện ${fallbackPrefix}`} />
      {profile.position ? <PreviewLine label="Chức vụ" value={profile.position} /> : null}
      <PreviewLine label="Địa chỉ" value={profile.address} fallback={`Địa chỉ ${fallbackPrefix}`} />
      {profile.phone ? <PreviewLine label="Điện thoại" value={profile.phone} /> : null}
      <PreviewLine label="Mã số thuế" value={profile.tax_code} fallback={`Mã số thuế ${fallbackPrefix}`} />
      {profile.bank_account ? <PreviewLine label="Số tài khoản" value={`${profile.bank_account}${profile.bank_name ? ` - ${profile.bank_name}` : ''}`} /> : null}
    </div>
  )
}

function SchedulePreview({ row = {} }) {
  return (
    <div className="space-y-1">
      <p className="text-[13px] leading-6 text-slate-700">
        <span className="font-semibold text-slate-900">Thời gian:</span>{' '}
        <PreviewValue value={row.time_range} fallback="Thời gian" />{' '}
        <span>ngày</span>{' '}
        <PreviewValue value={row.date_text} fallback="Ngày triển khai" />
      </p>
      <PreviewLine label="Địa điểm" value={row.location} />
    </div>
  )
}

function getContractPreviewShareUrl(contract = {}) {
  const shareToken = contract.quote_snapshot?.share_token || contract.share_token
  if (!shareToken || typeof window === 'undefined') return ''
  return `${window.location.origin}/c/${shareToken}`
}

export function PreviewDownloadActions({ contract = {}, showShareButton = false }) {
  const [copied, setCopied] = useState(false)
  const shareUrl = useMemo(() => getContractPreviewShareUrl(contract), [contract])
  const actionClass = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold transition'

  async function copyShareLink() {
    if (!shareUrl) return
    await navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`grid gap-3 ${showShareButton && shareUrl ? 'lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {showShareButton && shareUrl ? (
          <button
            type="button"
            onClick={copyShareLink}
            className={`${actionClass} bg-[#f8981d] text-white shadow-sm hover:bg-orange-500`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Đã copy link' : 'Copy link hợp đồng'}
          </button>
        ) : null}
        <PDFDownloadLink
          document={<ContractPDFDocument contract={contract} />}
          fileName={getContractPdfFilename(contract)}
          className={`${actionClass} bg-[#f8981d] text-white shadow-sm hover:bg-orange-500`}
        >
          {({ loading }) => (
            <>
              <Download className="h-4 w-4" />
              {loading ? 'Đang tạo PDF...' : 'Tải PDF'}
            </>
          )}
        </PDFDownloadLink>
        <button
          type="button"
          onClick={() => downloadContractDocx(contract)}
          className={`${actionClass} bg-[#f8981d] text-white shadow-sm hover:bg-orange-500`}
        >
          <FileText className="h-4 w-4" />
          Tải DOCX
        </button>
      </div>
    </div>
  )
}

export function ContractPreviewDocument({ contract = {} }) {
  const termsText = String(contract.terms_text ?? sectionsToTermsText(contract.content_sections) ?? '')
  const contentSections = hasText(termsText) ? termsTextToSections(termsText) : []
  const scheduleRows = Array.isArray(contract.schedule_rows) ? contract.schedule_rows : []
  const paymentConfig = contract.payment_config || {}
  const paymentDocuments = Array.isArray(paymentConfig.payment_documents)
    ? paymentConfig.payment_documents
    : []
  const depositPercent = paymentConfig.deposit_percent ?? DEFAULT_PAYMENT_CONFIG.deposit_percent
  const finalDueDays = paymentConfig.final_due_days ?? DEFAULT_PAYMENT_CONFIG.final_due_days
  const quote = contract.quote_snapshot || {}
  const totalAmount = Number(quote.total_amount || 0)
  const depositAmount = totalAmount * Number(depositPercent || 0) / 100
  const serviceScopeDetail = getServiceScopeDetail(contract.service_scope)
  const partyA = getPartyProfile(contract, 'party_a')
  const partyB = getPartyProfile(contract, 'party_b')
  const signingDate = formatContractDate(contract.updated_at || contract.created_at)
  const totalWords = totalAmount > 0 ? numberToVietnameseWords(totalAmount) : ''

  return (
    <div className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 pb-7">
      <section className="rounded-xl bg-white p-5 pb-6">
        <div className="text-center">
          <p className="text-[13px] uppercase text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
          <p className="text-[13px] text-slate-950">Độc lập – Tự do – Hạnh phúc</p>
        </div>
        <h3 className="mt-4 text-center text-[20px] font-bold uppercase tracking-wide text-slate-950">
          <PreviewValue value={contract.title} fallback="Tiêu đề hợp đồng" />
        </h3>
        <p className="mt-1 text-center text-[13px] font-semibold text-slate-700">
          Số: <PreviewValue value={contract.contract_number} fallback="Số hợp đồng" />
        </p>
        <div className="mt-4 space-y-1">
          {DEFAULT_CONTRACT_PREAMBLE.map((line, index) => (
            <p key={`${line}-${index}`} className="text-[13px] leading-6 text-slate-700">{line}</p>
          ))}
          <p className="pt-2 text-[13px] leading-6 text-slate-700">
            Hợp đồng cung cấp dịch vụ (sau đây gọi tắt là “Hợp đồng”) được lập và ký kết ngày <PreviewValue value={signingDate} fallback="Ngày ký hợp đồng" /> giữa các bên gồm:
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <PartyPreview heading="BÊN A:" profile={partyA} fallbackPrefix="khách hàng" />
          <PartyPreview heading="BÊN B:" profile={partyB} fallbackPrefix="Bên B" />
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 pb-6">
        <p className="text-[13px] leading-6 text-slate-700">Sau khi thỏa thuận, Các Bên đồng ý ký kết Hợp Đồng này theo các điều khoản sau:</p>
        <h3 className="mt-3 text-[14px] font-semibold text-slate-900">ĐIỀU 1: NỘI DUNG HỢP ĐỒNG</h3>
        <div className="mt-3 space-y-2">
          <p className="text-[13px] leading-6 text-slate-700">
            Bên A đề nghị Bên B và Bên B đồng ý cung cấp <PreviewValue value={serviceScopeDetail} fallback="Nội dung dịch vụ" /> cho Bên A, chi tiết như sau:
          </p>
          {scheduleRows.length ? (
            <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
              {scheduleRows.map((row, index) => (
                <SchedulePreview key={`${row.date_text}-${index}`} row={row} />
              ))}
            </div>
          ) : (
            <PreviewLine label="Thời gian / Địa điểm" value="" />
          )}
          <p className="text-[13px] font-semibold text-slate-900">Chi tiết hạng mục: Theo Phụ lục cuối hợp đồng.</p>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 pb-6">
        <h3 className="text-[14px] font-semibold text-slate-900">ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG</h3>
        <div className="mt-3 space-y-2">
          <p className="text-[13px] leading-6 text-slate-700">
            Giá trị của hợp đồng là:{' '}
            <span className="font-bold text-slate-950">
              <PreviewValue value={formatCurrency(totalAmount)} fallback="Giá trị hợp đồng" /> VNĐ {quote.has_vat === false ? '(Chưa bao gồm VAT)' : '(Đã bao gồm VAT)'}
            </span>
          </p>
          <p className="text-[13px] leading-6 text-slate-700">(Bằng chữ: <PreviewValue value={totalWords} fallback="Số tiền bằng chữ" /> ./. )</p>
          <p className="text-[13px] leading-6 text-slate-700">Phương thức thanh toán: Việc thanh toán Hợp đồng sẽ thực hiện thành 02 lần:</p>
          <p className="text-[13px] leading-6 text-slate-700">
            Lần 1: Bên A đặt cọc {depositPercent}% giá trị hợp đồng tương ứng <PreviewValue value={formatCurrency(depositAmount)} fallback="Số tiền tạm ứng" /> VNĐ cho Bên B sau khi ký hợp đồng{paymentConfig.issue_invoice_on_deposit === false ? '.' : ' và Bên B xuất hóa đơn cho Bên A sau khi nhận được thanh toán lần 1.'}
          </p>
          <p className="text-[13px] leading-6 text-slate-700">
            Lần 2: Bên A thanh toán nốt số tiền còn lại cho Bên B trong vòng {finalDueDays} ngày sau khi Bên B bàn giao cho Bên A đầy đủ sản phẩm & hóa đơn tài chính theo yêu cầu của Bên A.
          </p>
        </div>
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-slate-900">Hồ sơ thanh toán:</p>
          {paymentDocuments.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-700">
              {paymentDocuments.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] font-semibold text-red-600">Hồ sơ thanh toán</p>
          )}
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 pb-6">
        {contentSections.length ? (
          <div className="space-y-4">
            {contentSections.map((section, index) => (
              <div key={section.id || `${section.article_no}-${index}`}>
                <p className="text-[13px] font-bold uppercase text-slate-950">ĐIỀU {section.article_no || index + 3}: {section.title || 'ĐIỀU KHOẢN'}</p>
                <div className="mt-1 whitespace-pre-wrap text-[13px] leading-6 text-slate-700">{section.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-[13px] font-semibold leading-6 text-red-600">Nội dung từ ĐIỀU 3 trở đi</p>
        )}
      </section>

      <section className="rounded-xl bg-white p-5 pb-6">
        <div className="grid gap-3 text-center md:grid-cols-2">
          <div>
            <p className="text-[13px] font-bold text-slate-950">ĐẠI DIỆN BÊN A</p>
            <div className="h-16" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-950">ĐẠI DIỆN BÊN B</p>
            <div className="h-16" aria-hidden="true" />
          </div>
        </div>
      </section>
    </div>
  )
}

export default function ContractPreviewModal({ contract, title = 'Preview', showShareButton = false, onClose }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-3">
      <section className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-2">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-400">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Đóng preview"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[calc(90vh-49px)] overflow-y-auto px-5 py-3">
          <ContractPreviewDocument contract={contract} />
          <div className="mt-4">
            <PreviewDownloadActions contract={contract} showShareButton={showShareButton} />
          </div>
        </div>
      </section>
    </div>
  )
}
