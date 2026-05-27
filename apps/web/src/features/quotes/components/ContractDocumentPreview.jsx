import {
  formatDocumentCurrency,
  formatDocumentDate,
  getAcceptanceSummary,
  getAdvanceSummary,
  getContractFromDocument,
  getCustomerProfile,
  getDocumentTitle,
  getDocumentTypeLabel,
  getPaymentSummary,
  getProfileName,
  getSellerProfile,
  getVatLabel,
  hasDocumentText,
} from '../lib/contractDocumentRender'

function Value({ children, fallback = '-' }) {
  return hasDocumentText(children) ? children : fallback
}

function InfoLine({ label, value }) {
  return (
    <p className="break-words text-[13px] leading-6 text-slate-700">
      <span className="font-semibold text-slate-950">{label}:</span>{' '}
      <Value>{value}</Value>
    </p>
  )
}

function PartyBlock({ title, profile = {} }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="break-words text-[13px] font-bold uppercase text-slate-950">{title}: {getProfileName(profile) || '-'}</p>
      <InfoLine label="Đại diện" value={profile.representative} />
      <InfoLine label="Chức vụ" value={profile.position} />
      <InfoLine label="Địa chỉ" value={profile.address} />
      <InfoLine label="Mã số thuế" value={profile.tax_code} />
    </div>
  )
}

function AmountTable({ rows = [], totals = {}, vatConfig = {}, title }) {
  return (
    <section className="space-y-3">
      <h3 className="text-[14px] font-bold uppercase text-slate-950">{title}</h3>
      <div className="overflow-x-auto border border-slate-300">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="bg-slate-100 text-[11px] uppercase tracking-[0.08em] text-slate-600">
            <tr>
              <th className="px-3 py-2">Nội dung</th>
              <th className="w-[90px] px-3 py-2 text-center">ĐVT</th>
              <th className="w-[90px] px-3 py-2 text-right">SL</th>
              <th className="w-[140px] px-3 py-2 text-right">Đơn giá</th>
              <th className="w-[150px] px-3 py-2 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id || index}>
                <td className="break-words px-3 py-2 text-slate-800">{row.description || '-'}</td>
                <td className="px-3 py-2 text-center text-slate-700">{row.unit || '-'}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{row.quantity || 0}</td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700">{formatDocumentCurrency(row.unit_price, '')}</td>
                <td className={`px-3 py-2 text-right font-semibold tabular-nums ${Number(row.amount || 0) < 0 ? 'text-red-700' : 'text-slate-900'}`}>
                  {formatDocumentCurrency(row.amount, '')}
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-400">Chưa có dòng giá trị.</td>
              </tr>
            )}
          </tbody>
          <tfoot className="border-t border-slate-300 bg-slate-50 font-semibold text-slate-800">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right">Trước VAT</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatDocumentCurrency(totals.subtotal, '')}</td>
            </tr>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right">{getVatLabel(vatConfig)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatDocumentCurrency(totals.vat_amount, '')}</td>
            </tr>
            <tr className="text-slate-950">
              <td colSpan={4} className="px-3 py-2 text-right">Tổng cộng</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatDocumentCurrency(totals.total_amount, '')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

function Sections({ document = {} }) {
  const sections = Array.isArray(document.content_sections) ? document.content_sections : []
  if (!sections.length && !hasDocumentText(document.terms_text)) return null

  if (!sections.length) {
    return (
      <section className="space-y-2">
        <h3 className="text-[14px] font-bold uppercase text-slate-950">Điều khoản</h3>
        {String(document.terms_text || '').split(/\n+/).filter(Boolean).map((line, index) => (
          <p key={`${line}-${index}`} className="break-words text-[13px] leading-6 text-slate-700">{line}</p>
        ))}
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {sections.map((section, index) => (
        <div key={section.id || index} className="space-y-1">
          <h3 className="text-[14px] font-bold uppercase text-slate-950">{section.title || `Mục ${index + 1}`}</h3>
          {String(section.body || '').split(/\n+/).filter(Boolean).map((line, lineIndex) => (
            <p key={`${line}-${lineIndex}`} className="break-words text-[13px] leading-6 text-slate-700">{line}</p>
          ))}
        </div>
      ))}
    </section>
  )
}

function AdvanceBody({ document }) {
  const contract = getContractFromDocument(document)
  const summary = getAdvanceSummary(document)
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-6 text-slate-700">
        Căn cứ Hợp đồng số <span className="font-semibold text-slate-950">{contract.contract_number || '-'}</span>, Bên B kính đề nghị Bên A thanh toán khoản tạm ứng như sau:
      </p>
      <p className="text-[13px] leading-6 text-slate-700">{summary.request_content}</p>
      <div className="overflow-x-auto border border-slate-300">
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-slate-200">
            <tr><td className="w-1/2 bg-slate-50 px-3 py-2 font-semibold">Giá trị hợp đồng</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDocumentCurrency(summary.contract_value)}</td></tr>
            <tr><td className="bg-slate-50 px-3 py-2 font-semibold">Tỷ lệ tạm ứng</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{summary.advance_percent}%</td></tr>
            <tr><td className="bg-slate-50 px-3 py-2 font-semibold">Số tiền đề nghị tạm ứng</td><td className="px-3 py-2 text-right font-bold tabular-nums text-orange-700">{formatDocumentCurrency(summary.advance_amount)}</td></tr>
          </tbody>
        </table>
      </div>
      {summary.amount_words ? <p className="text-[13px] leading-6 text-slate-700">Bằng chữ: <span className="font-semibold">{summary.amount_words}</span>.</p> : null}
      <InfoLine label="Tài khoản nhận tiền" value={summary.bank_account} />
    </div>
  )
}

function AcceptanceBody({ document }) {
  const contract = getContractFromDocument(document)
  const summary = getAcceptanceSummary(document)
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-6 text-slate-700">
        Hai bên cùng nghiệm thu khối lượng dịch vụ theo Hợp đồng số <span className="font-semibold text-slate-950">{contract.contract_number || '-'}</span>.
      </p>
      <AmountTable title="Giá trị theo hợp đồng" rows={summary.contract_rows} totals={summary.contract_totals} vatConfig={summary.vat_config} />
      <AmountTable title="Giá trị nghiệm thu/thực tế" rows={summary.actual_rows} totals={summary.actual_totals} vatConfig={summary.vat_config} />
      {summary.amount_words ? <p className="text-[13px] leading-6 text-slate-700">Tổng giá trị nghiệm thu bằng chữ: <span className="font-semibold">{summary.amount_words}</span>.</p> : null}
      <p className="text-[13px] leading-6 text-slate-700">{summary.acceptance_note}</p>
    </div>
  )
}

function PaymentBody({ document }) {
  const contract = getContractFromDocument(document)
  const summary = getPaymentSummary(document)
  return (
    <div className="space-y-5">
      <p className="text-[13px] leading-6 text-slate-700">
        Căn cứ Hợp đồng số <span className="font-semibold text-slate-950">{contract.contract_number || '-'}</span> và BBNT đã liên kết, Bên B kính đề nghị Bên A thanh toán giá trị còn lại.
      </p>
      <p className="text-[13px] leading-6 text-slate-700">{summary.request_content}</p>
      <div className="overflow-x-auto border border-slate-300">
        <table className="w-full text-[13px]">
          <tbody className="divide-y divide-slate-200">
            <tr><td className="w-1/2 bg-slate-50 px-3 py-2 font-semibold">Tổng nghiệm thu</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDocumentCurrency(summary.acceptance_total)}</td></tr>
            <tr><td className="bg-slate-50 px-3 py-2 font-semibold">Khấu trừ tạm ứng</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDocumentCurrency(summary.advance_deduction_total)}</td></tr>
            <tr><td className="bg-slate-50 px-3 py-2 font-semibold">Số tiền đề nghị thanh toán</td><td className="px-3 py-2 text-right font-bold tabular-nums text-orange-700">{formatDocumentCurrency(summary.payment_amount)}</td></tr>
          </tbody>
        </table>
      </div>
      {summary.advance_deductions.length ? (
        <div className="overflow-x-auto border border-slate-300">
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <thead className="bg-slate-100 text-[11px] uppercase tracking-[0.08em] text-slate-600">
              <tr>
                <th className="px-3 py-2">Đề nghị tạm ứng khấu trừ</th>
                <th className="w-[160px] px-3 py-2 text-right">Số tiền gốc</th>
                <th className="w-[160px] px-3 py-2 text-right">Khấu trừ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {summary.advance_deductions.map(row => (
                <tr key={row.document_id}>
                  <td className="break-words px-3 py-2 text-slate-800">{row.document_number || row.document_title || '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatDocumentCurrency(row.original_amount)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatDocumentCurrency(row.deduction_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {summary.amount_words ? <p className="text-[13px] leading-6 text-slate-700">Bằng chữ: <span className="font-semibold">{summary.amount_words}</span>.</p> : null}
      <InfoLine label="Tài khoản nhận tiền" value={summary.bank_account} />
    </div>
  )
}

function DocumentBody({ document }) {
  if (document.document_type === 'acceptance_liquidation') return <AcceptanceBody document={document} />
  if (document.document_type === 'payment_request') return <PaymentBody document={document} />
  return <AdvanceBody document={document} />
}

export default function ContractDocumentPreview({ document = {} }) {
  const contract = getContractFromDocument(document)
  const customer = getCustomerProfile(document)
  const seller = getSellerProfile(document)
  const issuedDate = formatDocumentDate(document.issued_date || document.created_at)

  return (
    <article className="mx-auto max-w-4xl bg-white px-5 py-6 shadow-sm sm:px-8 sm:py-8">
      <header className="border-b border-slate-200 pb-5 text-center">
        <p className="text-[13px] uppercase text-slate-950">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
        <p className="text-[13px] text-slate-950">Độc lập - Tự do - Hạnh phúc</p>
        <h1 className="mt-5 break-words text-[22px] font-bold uppercase tracking-[0.02em] text-slate-950">{getDocumentTitle(document)}</h1>
        <p className="mt-1 break-all text-[13px] font-semibold text-slate-700">Số: <Value>{document.document_number}</Value></p>
        <p className="mt-1 text-[13px] text-slate-600">Ngày lập: <Value>{issuedDate}</Value></p>
      </header>

      <div className="space-y-6 py-5">
        <section className="grid gap-5 md:grid-cols-2">
          <PartyBlock title={document.document_type === 'acceptance_liquidation' ? 'Bên A' : 'Kính gửi'} profile={customer} />
          <PartyBlock title={document.document_type === 'acceptance_liquidation' ? 'Bên B' : 'Bên đề nghị'} profile={seller} />
        </section>

        <section className="grid gap-2 border-y border-slate-200 py-3 text-[13px] sm:grid-cols-2">
          <InfoLine label="Loại chứng từ" value={getDocumentTypeLabel(document.document_type)} />
          <InfoLine label="Hợp đồng" value={contract.contract_number} />
        </section>

        <DocumentBody document={document} />
        <Sections document={document} />
      </div>

      <footer className="mt-6 grid gap-8 border-t border-slate-200 pt-6 text-center sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-bold uppercase text-slate-950">Đại diện bên A</p>
          <div className="h-20" />
          <p className="text-[13px] font-semibold text-slate-950">{customer.representative || ''}</p>
        </div>
        <div>
          <p className="text-[13px] font-bold uppercase text-slate-950">Đại diện bên B</p>
          <div className="h-20" />
          <p className="text-[13px] font-semibold text-slate-950">{seller.representative || ''}</p>
        </div>
      </footer>
    </article>
  )
}
