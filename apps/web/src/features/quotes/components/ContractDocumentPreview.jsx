import {
  formatDocumentCurrency,
  formatDocumentDate,
  getAcceptanceLiquidationContent,
  getAcceptanceSummary,
  getAdvanceRequestContent,
  getBankAccountDetails,
  getContractFromDocument,
  getCustomerProfile,
  getDisplayDocumentIssuedDate,
  getDocumentTitle,
  getDocumentTypeLabel,
  getPaymentRequestContent,
  getPaymentSummary,
  getProfileLegalName,
  getProfileName,
  getSellerProfile,
  getVatLabel,
  hasDocumentText,
  shouldShowAcceptanceAmountTables,
} from '../lib/contractDocumentRender'

function Value({ children, fallback = '-' }) {
  return hasDocumentText(children) ? children : fallback
}

function InfoLine({ label, value, compact = false }) {
  return (
    <p className={`break-words text-slate-700 ${compact ? 'text-[12px] leading-5' : 'text-[13px] leading-6'}`}>
      <span className="font-semibold text-slate-950">{label}:</span>{' '}
      <Value>{value}</Value>
    </p>
  )
}

function A4DocumentPage({ children, className = '' }) {
  return (
    <article className={`mx-auto min-h-[297mm] w-[210mm] max-w-full bg-white px-[18mm] py-[10mm] shadow-sm ${className}`}>
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

function HighlightedText({ text = '', highlights = [] }) {
  const source = String(text || '')
  const highlightValues = highlights
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)

  if (!source || !highlightValues.length) return <>{source}</>

  const parts = []
  let cursor = 0

  while (cursor < source.length) {
    let nextMatch = null

    highlightValues.forEach(value => {
      const index = source.indexOf(value, cursor)
      if (index === -1) return
      if (!nextMatch || index < nextMatch.index || (index === nextMatch.index && value.length > nextMatch.value.length)) {
        nextMatch = { index, value }
      }
    })

    if (!nextMatch) {
      parts.push({ text: source.slice(cursor), highlighted: false })
      break
    }

    if (nextMatch.index > cursor) {
      parts.push({ text: source.slice(cursor, nextMatch.index), highlighted: false })
    }
    parts.push({ text: nextMatch.value, highlighted: true })
    cursor = nextMatch.index + nextMatch.value.length
  }

  return (
    <>
      {parts.map((part, index) => (
        part.highlighted
          ? <span key={`${part.text}-${index}`} className="font-bold text-slate-950">{part.text}</span>
          : <span key={`${part.text}-${index}`}>{part.text}</span>
      ))}
    </>
  )
}

function RepresentativePositionLine({ profile = {}, compact = false }) {
  return (
    <p className={`break-words text-slate-700 ${compact ? 'text-[12px] leading-5' : 'text-[13px] leading-6'}`}>
      <span className="font-semibold text-slate-950">Đại diện:</span>{' '}
      <Value>{profile.representative}</Value>
      <span className="font-semibold text-slate-950"> | Chức vụ:</span>{' '}
      <Value>{profile.position}</Value>
    </p>
  )
}

function PartyBlock({ title, profile = {}, compact = false, displayName = '' }) {
  return (
    <div className={`min-w-0 ${compact ? 'space-y-0.5' : 'space-y-1'}`}>
      <p className={`break-words font-bold uppercase text-slate-950 ${compact ? 'text-[12px] leading-5' : 'text-[13px]'}`}>{title}: {displayName || getProfileName(profile) || '-'}</p>
      <RepresentativePositionLine profile={profile} compact={compact} />
      <InfoLine label="Địa chỉ" value={profile.address} compact={compact} />
      <InfoLine label="Mã số thuế" value={profile.tax_code} compact={compact} />
    </div>
  )
}

function AcceptanceArticleLines({ section }) {
  const lines = String(section.body || '').split(/\n+/).filter(Boolean)

  return lines.map((line, index) => {
    const isBankLine = Boolean(getBankDetailLineParts(line))
    const previousIsBankLine = Boolean(getBankDetailLineParts(lines[index - 1] || ''))
    const marginClass = index === 0 ? '' : isBankLine && previousIsBankLine ? 'mt-0' : 'mt-1'

    return (
      <p key={`${section.id}-${index}`} className={marginClass}>
        <BankAwareParagraph line={line} />
      </p>
    )
  })
}

function AcceptanceAmountTable({ title, rows = [], totals = {}, vatConfig = {} }) {
  const cellClass = 'border border-slate-300 px-1 py-0.5 align-top [overflow-wrap:anywhere]'
  const numberCellClass = `${cellClass} text-right tabular-nums`
  const totalLabelClass = `${cellClass} text-right font-semibold`
  const totalValueClass = `${numberCellClass} font-semibold`

  return (
    <section className="space-y-1">
      <p className="font-semibold">{title}:</p>
      <div className="w-full overflow-hidden">
        <table className="w-full table-fixed border-collapse text-left text-[13px] leading-5">
          <colgroup>
            <col className="w-[7%]" />
            <col className="w-[37%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[17%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead>
            <tr>
              <th className={`${cellClass} text-center`}>STT</th>
              <th className={cellClass}>Hạng mục</th>
              <th className={cellClass}>ĐVT</th>
              <th className={`${cellClass} text-right`}>Số lượng</th>
              <th className={`${cellClass} text-right`}>Đơn giá (VNĐ)</th>
              <th className={`${cellClass} text-right`}>Thành tiền (VNĐ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={row.id || index}>
                <td className={`${cellClass} text-center`}>{index + 1}</td>
                <td className={`${cellClass} break-words`}>{row.description || '-'}</td>
                <td className={`${cellClass} break-words`}>{row.unit || '-'}</td>
                <td className={numberCellClass}>{row.quantity || 0}</td>
                <td className={numberCellClass}>{formatDocumentCurrency(row.unit_price, '')}</td>
                <td className={numberCellClass}>{formatDocumentCurrency(row.amount, '')}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className={`${cellClass} py-3 text-center text-slate-400`}>Chưa có hạng mục.</td>
              </tr>
            )}
            <tr>
              <td colSpan={5} className={totalLabelClass}>
                <div>Tổng</div>
                <div>{getVatLabel(vatConfig)}</div>
                <div>Tổng chi phí</div>
              </td>
              <td className={totalValueClass}>
                <div>{formatDocumentCurrency(totals.subtotal, '')}</div>
                <div>{formatDocumentCurrency(totals.vat_amount, '')}</div>
                <div>{formatDocumentCurrency(totals.total_amount, '')}</div>
              </td>
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
      {content.amount_words ? <p className="italic">{content.amount_words}</p> : null}
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
      <div>
        {content.basis_contract ? <p>{content.basis_contract}</p> : null}
        {content.basis_completed ? <p>{content.basis_completed}</p> : null}
        {content.party_intro ? <p>{content.party_intro}</p> : null}
      </div>
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
  const summary = getPaymentSummary(document)
  const paymentAmountText = formatDocumentCurrency(summary.payment_amount, '')
  const paymentAmountWithCurrencyText = paymentAmountText ? `${paymentAmountText} VNĐ` : ''
  const closingLines = String(content.closing || '').split(/\n+/).filter(Boolean)

  return (
    <div className="space-y-4 text-[13px] leading-6 text-slate-950">
      {content.greeting ? <p>{content.greeting}</p> : null}
      {content.basis ? <p>{content.basis}</p> : null}
      {content.request ? <p><HighlightedText text={content.request} highlights={[paymentAmountWithCurrencyText, paymentAmountText]} /></p> : null}
      {content.amount_words ? <p className="italic"><HighlightedText text={content.amount_words} highlights={[summary.amount_words]} /></p> : null}
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
  const issuedDate = getDisplayDocumentIssuedDate(document)

  if (document.document_type === 'advance_request') {
    return (
      <A4DocumentPage>
        <header className="text-[12px] leading-5 text-slate-950">
          <div className="text-center font-bold">
            <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p>Độc lập - Tự do - Hạnh phúc</p>
          </div>
          {issuedDate ? <p className="mt-6 text-right italic">Ngày {issuedDate}</p> : null}
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
          {issuedDate ? <p className="mt-6 text-right italic">Ngày {issuedDate}</p> : null}
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
          </div>
        </footer>
      </A4DocumentPage>
    )
  }

  if (document.document_type === 'acceptance_liquidation') {
    const content = getAcceptanceLiquidationContent(document)
    const bank = getBankAccountDetails(document)
    const summary = getAcceptanceSummary(document)
    const showAmountTables = shouldShowAcceptanceAmountTables(document, summary)

    return (
      <A4DocumentPage>
        <header className="text-[13px] leading-6 text-slate-950">
          <div className="text-center font-bold">
            <p>CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p>Độc lập - Tự do - Hạnh phúc</p>
          </div>
          <h1 className="mt-5 whitespace-nowrap text-center text-[18px] font-bold uppercase tracking-wide">
            BIÊN BẢN NGHIỆM THU VÀ THANH LÝ HỢP ĐỒNG
          </h1>
        </header>

        <div className="space-y-3 py-4 text-[12px] leading-5 text-slate-950">
          <div>
            {content.basis_contract ? <p>{content.basis_contract}</p> : null}
            {content.basis_completed ? <p>{content.basis_completed}</p> : null}
            {content.party_intro ? <p>{content.party_intro}</p> : null}
          </div>

          <div className="space-y-0.5">
            <section className="space-y-0.5">
              <PartyBlock title="BÊN A" profile={customer} compact />
            </section>
            <p className="leading-5">Và</p>
            <section className="space-y-0.5">
              <PartyBlock title="BÊN B" profile={seller} compact displayName={getProfileLegalName(seller)} />
              {bank.account_number ? <InfoLine label="Số tài khoản" value={bank.account_number} compact /> : null}
              {bank.bank_name ? <InfoLine label="Ngân hàng" value={bank.bank_name} compact /> : null}
            </section>
          </div>

          {content.signing_intro ? <p>{content.signing_intro}</p> : null}
          {content.articles.map(section => (
            <section key={section.id}>
              <h3 className="mb-1 text-[13px] font-bold uppercase text-slate-950">{section.title}</h3>
              <AcceptanceArticleLines section={section} />
              {showAmountTables && section.id === 'acceptance-article-2' ? (
                <div className="space-y-2">
                  <AcceptanceAmountTable title="Bảng giá trị theo hợp đồng" rows={summary.contract_rows} totals={summary.contract_totals} vatConfig={summary.vat_config} />
                  <AcceptanceAmountTable title="Bảng giá trị nghiệm thu/thực tế" rows={summary.actual_rows} totals={summary.actual_totals} vatConfig={summary.vat_config} />
                  {content.cost_difference_note ? <p>{content.cost_difference_note}</p> : null}
                </div>
              ) : null}
            </section>
          ))}
        </div>

        <footer className="mt-4 grid gap-6 pt-2 text-center text-[12px] font-bold leading-5 text-slate-950 sm:grid-cols-2">
          <div>
            <p>ĐẠI DIỆN BÊN A</p>
            <div className="h-24" />
          </div>
          <div>
            <p>ĐẠI DIỆN BÊN B</p>
            <div className="h-24" />
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
