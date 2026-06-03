import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, FileText, X } from 'lucide-react'
import ContractPDFDownloadButton from './ContractPDFDownloadButton'
import ContractPaymentSummary from './ContractPaymentSummary'
import QuotePreview from './QuotePreview'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import { downloadContractDocx } from '../lib/contractDocx'
import {
  CONTRACT_SUBTOTAL_LABEL,
  getContractPreamble,
  getContractPaymentNotes,
  getContractWorkProgressNotes,
  sectionsToTermsText,
  termsTextToSections,
} from '../lib/contractDefaults'

function hasText(value) {
  return String(value ?? '').trim().length > 0
}

function getServiceScopeDetail(value = '') {
  return String(value || '').replace(/^cung cấp\s+/i, '').trim()
}

function formatContractDate(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
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

function getPartyRole(contract = {}, partyKey = 'party_a') {
  return contract.party_role_config?.[partyKey] || (partyKey === 'party_a' ? 'customer' : 'seller')
}

function getPartyProfile(contract = {}, partyKey = 'party_a') {
  const role = getPartyRole(contract, partyKey)
  return role === 'seller' ? contract.seller_snapshot || {} : contract.customer_snapshot || {}
}

function getProfileName(profile = {}) {
  return profile.company_name || ''
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

function PartyPreview({ heading, profile = {}, fallbackPrefix, role = 'customer' }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-[13px] leading-6 text-slate-950">
        <span className="font-bold">{heading}</span>{' '}
        <PreviewValue value={getProfileName(profile)} fallback={`Tên ${fallbackPrefix}`} className="font-semibold text-slate-950" />
      </p>
      <PreviewLine label="Đại diện" value={profile.representative} fallback={`Người đại diện ${fallbackPrefix}`} />
      {profile.position ? <PreviewLine label="Chức vụ" value={profile.position} /> : null}
      {role === 'customer' && hasText(profile.authorization_number) ? <PreviewLine label="Giấy ủy quyền số" value={profile.authorization_number} /> : null}
      {role === 'customer' && hasText(profile.authorization_date) ? <PreviewLine label="Ngày giấy ủy quyền" value={profile.authorization_date} /> : null}
      <PreviewLine label="Địa chỉ" value={profile.address} fallback={`Địa chỉ ${fallbackPrefix}`} />
      {role === 'customer' && hasText(profile.email) ? <PreviewLine label="Email" value={profile.email} /> : null}
      {role === 'customer' && hasText(profile.phone_number) ? <PreviewLine label="Số điện thoại" value={profile.phone_number} /> : null}
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
  const shareToken = contract.share_token || contract.quote_snapshot?.share_token
  if (!shareToken || typeof window === 'undefined') return ''
  return `${window.location.origin}/c/${shareToken}`
}

export function PreviewDownloadActions({ contract = {}, showShareButton = false, savedByName = '' }) {
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef(null)
  const shareUrl = useMemo(() => getContractPreviewShareUrl(contract), [contract])
  const actionClass = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold transition'
  const savedAtText = formatSavedContractTime(contract.updated_at || contract.created_at)
  const showSavedMeta = Boolean(contract.id && savedAtText && savedByName)

  useEffect(() => () => {
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
  }, [])

  async function copyShareLink() {
    if (!shareUrl) return
    await navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = window.setTimeout(() => {
      setCopied(false)
      copiedTimerRef.current = null
    }, 2400)
  }

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {showSavedMeta ? (
        <p className="mb-3 text-center text-[12px] text-slate-400">
          Đã lưu lúc {savedAtText} bởi {savedByName}
        </p>
      ) : null}
      <div className={`grid gap-3 ${showShareButton && shareUrl ? 'lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {showShareButton && shareUrl ? (
          <button
            type="button"
            onClick={copyShareLink}
            className={`${actionClass} text-white shadow-sm ${copied ? 'bg-slate-500 hover:bg-slate-500' : 'bg-[#f8981d] hover:bg-orange-500'}`}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Đã copy link' : 'Lấy link hợp đồng gửi khách'}
          </button>
        ) : null}
        <ContractPDFDownloadButton
          contract={contract}
          className={`${actionClass} bg-[#f8981d] text-white shadow-sm hover:bg-orange-500`}
        />
        <button
          type="button"
          onClick={() => downloadContractDocx(contract)}
          className={`${actionClass} bg-[#f8981d] text-white shadow-sm hover:bg-orange-500`}
        >
          <FileText className="h-4 w-4" />
          Tải DOCX
        </button>
      </div>
      {copied ? (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-2 text-[13px] font-semibold text-emerald-700" role="status">
          Đã copy link hợp đồng gửi khách
        </p>
      ) : null}
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
  const quote = contract.quote_snapshot || {}
  const quoteItems = Array.isArray(quote.items) ? quote.items : []
  const quoteTotals = {
    subtotal: quote.subtotal,
    travel_fee_total: quote.travel_fee_total,
    overtime_fee_total: quote.overtime_fee_total,
    vat_amount: quote.vat_amount,
    total_amount: quote.total_amount,
  }
  const serviceScopeDetail = getServiceScopeDetail(contract.service_scope)
  const workProgressNotes = getContractWorkProgressNotes(contract)
  const paymentNotes = getContractPaymentNotes(paymentConfig)
  const preambleLines = getContractPreamble(contract)
  const partyA = getPartyProfile(contract, 'party_a')
  const partyB = getPartyProfile(contract, 'party_b')
  const signingDate = formatContractDate(contract.signing_date || contract.updated_at || contract.created_at)

  return (
    <div className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5 pb-7">
      <section className="rounded-xl bg-white p-5 pb-3">
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
          {preambleLines.map((line, index) => (
            <p key={`${line}-${index}`} className="text-[13px] leading-6 text-slate-700">{line}</p>
          ))}
          <p className="pt-2 text-[13px] leading-6 text-slate-700">
            Hợp đồng cung cấp dịch vụ (sau đây gọi tắt là “Hợp đồng”) được lập và ký kết ngày <PreviewValue value={signingDate} fallback="Ngày ký hợp đồng" /> giữa các bên gồm:
          </p>
        </div>
        <div className="mt-4 space-y-3">
          <PartyPreview heading="BÊN A:" profile={partyA} fallbackPrefix="khách hàng" role={getPartyRole(contract, 'party_a')} />
          <PartyPreview heading="BÊN B:" profile={partyB} fallbackPrefix="Bên B" role={getPartyRole(contract, 'party_b')} />
        </div>
        <p className="mt-3 -mb-2 text-[13px] leading-6 text-slate-700">Sau khi thỏa thuận, Các Bên đồng ý ký kết Hợp Đồng này theo các điều khoản sau:</p>
      </section>

      <section className="rounded-xl bg-white px-5 py-4">
        <div className="space-y-2">
          <h3 className="text-[14px] font-semibold text-slate-900">ĐIỀU 1: NỘI DUNG HỢP ĐỒNG</h3>
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
          <p className="text-[13px] font-semibold text-slate-900">Chi tiết hạng mục</p>
          <QuotePreview
            quote={{ ...quote, created_at: quote.created_at || contract.created_at }}
            items={quoteItems}
            totals={quoteTotals}
            sticky={false}
            tableOnly
            subtotalLabel={CONTRACT_SUBTOTAL_LABEL}
          />
          <div className="space-y-1 pt-1">
            <p className="text-[13px] font-semibold text-slate-900">Lưu ý về thời gian làm việc và tiến độ bàn giao:</p>
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-700">
              {workProgressNotes.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white px-5 py-4">
        <ContractPaymentSummary quote={quote} paymentConfig={paymentConfig} />
        <div className="mt-3">
          <p className="text-[13px] font-semibold text-slate-900">Hồ sơ thanh toán:</p>
          {paymentDocuments.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-700">
              {paymentDocuments.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>
          ) : (
            <p className="mt-1 text-[13px] font-semibold text-red-600">Hồ sơ thanh toán</p>
          )}
          <div className="mt-3 space-y-1">
            <p className="text-[13px] font-semibold text-slate-900">Lưu ý về thanh toán:</p>
            <ul className="list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-700">
              {paymentNotes.map(item => <li key={item}>{item}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-xl bg-white px-5 py-4">
        {contentSections.length ? (
          <div className="space-y-3">
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
            <div className="h-24" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-slate-950">ĐẠI DIỆN BÊN B</p>
            <div className="h-24" aria-hidden="true" />
          </div>
        </div>
      </section>

    </div>
  )
}

export default function ContractPreviewModal({ contract, title = 'Preview', showShareButton = false, savedByName = '', onClose }) {
  useEscapeToClose(onClose)

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
            <PreviewDownloadActions contract={contract} showShareButton={showShareButton} savedByName={savedByName} />
          </div>
        </div>
      </section>
    </div>
  )
}
