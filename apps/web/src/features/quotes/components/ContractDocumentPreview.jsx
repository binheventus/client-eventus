import {
  formatDocumentCurrency,
  formatDocumentDate,
  getAcceptanceLiquidationContent,
  getAcceptanceSummary,
  getAdvanceRequestContent,
  getBankAccountDetails,
  getContractFromDocument,
  getCustomerProfile,
  getDocumentTitle,
  getDocumentTypeLabel,
  getPaymentRequestContent,
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

function A4DocumentPage({ children, className = '' }) {
  return (
    <article className={`mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[18mm] py-[16mm] shadow-sm ${className}`}>
      {children}
    </article>
  )
}

function getBankDetailLineParts(line = '') {
  const match = String(line || '').match(/^(\s*(?:Tài khoản chuyển khoản|Ngân hàng|Chủ tài khoản)\s*:\s*)(.+)$/i)
  if (!match) return null
  return {
    label: match[1],
    value: match[2],
  }
}

function BankAwareParagraph({ line = '' }) {
  const bankLine = getBankDetailLineParts(line)
  if (!bankLine) return <>{line}</>

  return (
    <>
      {bankLine.label}
      <span className="font-bold text-slate-950">{bankLine.value}</span>
    </>
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

function AcceptanceAmountTable({ title, rows = [], totals = {}, vatConfig = {} }) {
  return (
    <section className="space-y-2">
      <p className="font-semibold">{title}:</p>
      <div className="overflow-x-auto border border-slate-300">
        <table className="w-full min-w-[720px] text-left text-[12px] leading-5">
          <thead className="bg-slate-100">
            <tr>
              <th className="w-[54px] border border-slate-300 px-2 py-1 text-center">STT</th>
              <th className="border border-slate-300 px-2 py-1">Hạng mục</th>
              <th className="w-[90px] border border-slate-300 px-2 py-1">ĐVT</th>
              <th className="w-[90px] border border-slate-300 px-2 py-1 text-right">Số lượng</th>
              <th className="w-[140px] border border-slate-300 px-2 py-1 text-right">Đơn giá (VNĐ)</th>
              <th className="w-[150px] border border-slate-300 px-2 py-1 text-right">Thành tiền (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id || index}>
                <td className="border border-slate-300 px-2 py-1 text-center">{index + 1}</td>
                <td className="border border-slate-300 px-2 py-1">{row.description || '-'}</td>
                <td className="border border-slate-300 px-2 py-1">{row.unit || '-'}</td>
                <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{row.quantity || 0}</td>
                <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{formatDocumentCurrency(row.unit_price, '')}</td>
                <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{formatDocumentCurrency(row.amount, '')}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="border border-slate-300 px-2 py-4 text-center text-slate-400">Chưa có hạng mục.</td>
              </tr>
            )}
            <tr>
              <td colSpan={5} className="border border-slate-300 px-2 py-1 text-right font-semibold">Tổng (chưa bao gồm thuế GTGT)</td>
              <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{formatDocumentCurrency(totals.subtotal, '')}</td>
            </tr>
            <tr>
              <td colSpan={5} className="border border-slate-300 px-2 py-1 text-right font-semibold">{getVatLabel(vatConfig)}</td>
              <td className="border border-slate-300 px-2 py-1 text-right tabular-nums">{formatDocumentCurrency(totals.vat_amount, '')}</td>
            </tr>
            <tr>
              <td colSpan={5} className="border border-slate-300 px-2 py-1 text-right font-semibold">Tổng chi phí (Đã bao gồm VAT)</td>
              <td className="border border-slate-300 px-2 py-1 text-right font-semibold tabular-nums">{formatDocumentCurrency(totals.total_amount, '')}</td>
            </tr>
          </tbody>
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
  const bank = getBankAccountDetails(document)
  const content = getAdvanceRequestContent(document)
  const closingLines = String(content.closing || '').split(/\n+/).filter(Boolean)

  return (
    <div className="space-y-4 text-[13px] leading-6 text-slate-950">
      {content.greeting ? <p>{content.greeting}</p> : null}
      {content.basis ? <p>{content.basis}</p> : null}
      {content.request ? <p>{content.request}</p> : null}
      {content.amount_words ? <p>{content.amount_words}</p> : null}
      {content.method ? <p>{content.method}</p> : null}
      <div className="space-y-1">
        {content.bank_intro ? <p>{content.bank_intro}</p> : null}
        <p>Tài khoản chuyển khoản: <span className="font-bold text-slate-950">{bank.account_number || '-'}</span></p>
        <p>Ngân hàng: <span className="font-bold text-slate-950">{bank.bank_name || '-'}</span></p>
        <p>Chủ tài khoản: <span className="font-bold text-slate-950">{bank.account_holder || '-'}</span></p>
      </div>
      {closingLines.length ? (
        <p>
          {closingLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < closingLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}

function AcceptanceBody({ document }) {
  const content = getAcceptanceLiquidationContent(document)
  return (
    <div className="space-y-4 text-[13px] leading-6 text-slate-950">
      {content.basis_contract ? <p>{content.basis_contract}</p> : null}
      {content.basis_completed ? <p>{content.basis_completed}</p> : null}
      {content.party_intro ? <p>{content.party_intro}</p> : null}
      {content.signing_intro ? <p>{content.signing_intro}</p> : null}
      {content.articles.map(section => (
        <section key={section.id} className="space-y-2">
          <h3 className="text-[14px] font-bold uppercase text-slate-950">{section.title}</h3>
          {String(section.body || '').split(/\n+/).filter(Boolean).map((line, index) => (
            <p key={`${section.id}-${index}`}>{line}</p>
          ))}
        </section>
      ))}
    </div>
  )
}

function PaymentBody({ document }) {
  const bank = getBankAccountDetails(document)
  const content = getPaymentRequestContent(document)
  const closingLines = String(content.closing || '').split(/\n+/).filter(Boolean)

  return (
    <div className="space-y-4 text-[13px] leading-6 text-slate-950">
      {content.greeting ? <p>{content.greeting}</p> : null}
      {content.basis ? <p>{content.basis}</p> : null}
      {content.request ? <p>{content.request}</p> : null}
      {content.amount_words ? <p>{content.amount_words}</p> : null}
      {content.method ? <p>{content.method}</p> : null}
      <div className="space-y-1">
        {content.bank_intro ? <p>{content.bank_intro}</p> : null}
        <p>Tài khoản chuyển khoản: <span className="font-bold text-slate-950">{bank.account_number || '-'}</span></p>
        <p>Ngân hàng: <span className="font-bold text-slate-950">{bank.bank_name || '-'}</span></p>
        <p>Chủ tài khoản: <span className="font-bold text-slate-950">{bank.account_holder || '-'}</span></p>
      </div>
      {closingLines.length ? (
        <p>
          {closingLines.map((line, index) => (
            <span key={`${line}-${index}`}>
              {line}
              {index < closingLines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      ) : null}
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

  if (document.document_type === 'advance_request') {
    return (
      <A4DocumentPage>
        <header className="text-[13px] leading-6 text-slate-950">
          <div className="text-center font-bold">
            <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p>Độc lập - Tự do - Hạnh phúc</p>
          </div>
          <p className="mt-6 text-right italic">Ngày {issuedDate || '-'}</p>
          <h1 className="mt-7 text-center text-[20px] font-bold uppercase tracking-wide">{getDocumentTitle(document)}</h1>
          <p className="mt-1 text-center">Số: <Value>{document.document_number}</Value></p>
        </header>

        <div className="py-8">
          <AdvanceBody document={document} />
        </div>

        <footer className="mt-4 flex justify-end pr-12 text-center text-[13px] font-bold leading-6 text-slate-950">
          <div>
            <p>ĐẠI DIỆN</p>
            <div className="h-24" />
            <p>{seller.representative || ''}</p>
          </div>
        </footer>
      </A4DocumentPage>
    )
  }

  if (document.document_type === 'payment_request') {
    return (
      <A4DocumentPage>
        <header className="text-[13px] leading-6 text-slate-950">
          <div className="text-center font-bold">
            <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p>Độc lập - Tự do - Hạnh phúc</p>
          </div>
          <p className="mt-6 text-right italic">Ngày {issuedDate || '-'}</p>
          <h1 className="mt-7 text-center text-[20px] font-bold uppercase tracking-wide">{getDocumentTitle(document)}</h1>
          <p className="mt-1 text-center">Số: <Value>{document.document_number}</Value></p>
        </header>

        <div className="py-8">
          <PaymentBody document={document} />
        </div>

        <footer className="mt-4 flex justify-end pr-12 text-center text-[13px] font-bold leading-6 text-slate-950">
          <div>
            <p>ĐẠI DIỆN</p>
            <div className="h-24" />
            <p>{seller.representative || ''}</p>
          </div>
        </footer>
      </A4DocumentPage>
    )
  }

  if (document.document_type === 'acceptance_liquidation') {
    const content = getAcceptanceLiquidationContent(document)
    const bank = getBankAccountDetails(document)
    const summary = getAcceptanceSummary(document)

    return (
      <A4DocumentPage>
        <header className="text-[13px] leading-6 text-slate-950">
          <div className="text-center font-bold">
            <p>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p>Độc lập - Tự do - Hạnh phúc</p>
          </div>
          <h1 className="mt-7 whitespace-nowrap text-center text-[19px] font-bold uppercase tracking-wide">
            BIÊN BẢN NGHIỆM THU VÀ THANH LÝ HỢP ĐỒNG
          </h1>
        </header>

        <div className="space-y-5 py-8 text-[13px] leading-6 text-slate-950">
          {content.basis_contract ? <p>{content.basis_contract}</p> : null}
          {content.basis_completed ? <p>{content.basis_completed}</p> : null}
          {content.party_intro ? <p>{content.party_intro}</p> : null}

          <section className="space-y-1">
            <PartyBlock title="BÊN A" profile={customer} />
          </section>
          <p>Và</p>
          <section className="space-y-1">
            <PartyBlock title="BÊN B" profile={seller} />
            {bank.account_number ? <InfoLine label="Số tài khoản" value={bank.account_number} /> : null}
            {bank.bank_name ? <InfoLine label="Ngân hàng" value={bank.bank_name} /> : null}
          </section>

          {content.signing_intro ? <p>{content.signing_intro}</p> : null}
          {content.articles.map(section => (
            <section key={section.id} className="space-y-2">
              <h3 className="text-[14px] font-bold uppercase text-slate-950">{section.title}</h3>
              {String(section.body || '').split(/\n+/).filter(Boolean).map((line, index) => (
                <p key={`${section.id}-${index}`}><BankAwareParagraph line={line} /></p>
              ))}
              {content.has_cost_difference && section.id === 'acceptance-article-2' ? (
                <div className="space-y-4">
                  <AcceptanceAmountTable title="Chi tiết hạng mục trên hợp đồng" rows={summary.contract_rows} totals={summary.contract_totals} vatConfig={summary.vat_config} />
                  <AcceptanceAmountTable title="Chi tiết hạng mục nghiệm thu" rows={summary.actual_rows} totals={summary.actual_totals} vatConfig={summary.vat_config} />
                  {content.cost_difference_note ? <p>{content.cost_difference_note}</p> : null}
                </div>
              ) : null}
            </section>
          ))}
        </div>

        <footer className="mt-6 grid gap-8 pt-4 text-center text-[13px] font-bold leading-6 text-slate-950 sm:grid-cols-2">
          <div>
            <p>ĐẠI DIỆN BÊN A</p>
            <div className="h-32" />
            <p>{customer.representative || ''}</p>
          </div>
          <div>
            <p>ĐẠI DIỆN BÊN B</p>
            <div className="h-32" />
            <p>{seller.representative || ''}</p>
          </div>
        </footer>
      </A4DocumentPage>
    )
  }

  return (
    <A4DocumentPage>
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
    </A4DocumentPage>
  )
}
