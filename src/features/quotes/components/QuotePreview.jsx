import { useState } from 'react'
import equipmentRulesData from '../../../data/pricing/equipment_rules.json'
import { getMatchedEquipmentRules } from '../lib/equipmentRules'
import { normalizeQuoteValidityDays } from '../lib/quoteValidity'

const SIGNATURE_IMAGE_SRC = '/signatures/nguyen-thu-huyen.png'

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatQuoteDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
}

function getEntity(entityCode, entities = []) {
  return entities.find(row => (row.entity_code || row.code) === entityCode) || null
}

function getEntityName(entityCode, entities = []) {
  return 'Báo giá dịch vụ'
}

function getLegalName(entity, entityCode) {
  return entity?.legal_name || entity?.entity_name_full || entity?.name || (entityCode === 'MEDIAMONSTER' ? 'Công ty TNHH MediaMonster' : 'Công ty TNHH Eventus Việt Nam')
}

function getEntityContactRows(entity, entityCode) {
  const legalName = getLegalName(entity, entityCode)
  return [
    legalName,
    entity?.tax_code ? `MST: ${entity.tax_code}` : null,
    entity?.address ? `Địa chỉ: ${entity.address}` : null,
    [entity?.email ? `Email: ${entity.email}` : null, entity?.hotline ? `Hotline: ${entity.hotline}` : null].filter(Boolean).join(' | '),
  ].filter(Boolean)
}

function getItemName(item) {
  return item.service_name || item.service?.quote_display_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

function getItemUnit(item) {
  return item.unit || item.service?.unit || item.pricing_unit || 'Người'
}

function SignatureBlock({ quote }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <section className="flex justify-end pt-1">
      <div className="w-full max-w-[180px] text-right text-[12px] leading-5 text-slate-700">
        <p className="font-semibold text-slate-900">Ngày lập: {formatQuoteDate(quote?.created_at)}</p>
        <div className="mt-2 ml-auto flex aspect-[500/301] w-[120px] items-center justify-center text-center text-[10px] leading-4 text-slate-400">
          {!imageFailed ? (
            <img
              src={SIGNATURE_IMAGE_SRC}
              alt="Chữ ký Nguyễn Thu Huyền"
              onError={() => setImageFailed(true)}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="rounded border border-dashed border-slate-300 px-2 py-1">Đặt ảnh chữ ký tại public/signatures/nguyen-thu-huyen.png</span>
          )}
        </div>
        <p className="mt-1 text-[10px] font-bold text-slate-950">Nguyễn Thu Huyền</p>
        <p className="text-[9px] text-slate-500">Account Manager</p>
      </div>
    </section>
  )
}

function QuoteEndNotes({ quote = {}, items = [], validityDays = 15 }) {
  const equipmentRules = getMatchedEquipmentRules(items, equipmentRulesData)
  const terms = [
    `Báo giá có hiệu lực trong ${validityDays} ngày. Thời gian làm việc tiêu chuẩn tối đa 04 tiếng/buổi và 08 tiếng/ngày. Thời gian Overtime sẽ được tính phí theo thỏa thuận riêng.`,
    ...(!quote.has_vat ? ['Báo giá trên chưa bao gồm VAT.'] : []),
    'Báo giá trên chưa bao gồm chi phí mua bản quyền âm nhạc, hình ảnh nếu có.',
    'Báo giá đã bao gồm tối đa 03 lần chỉnh sửa sản phẩm hậu kỳ dựa trên format đã thống nhất.',
    'Trong vòng 05 ngày làm việc kể từ ngày bàn giao bản Demo, nếu Khách hàng không có phản hồi hoặc yêu cầu chỉnh sửa bằng văn bản, sản phẩm được coi là đã hoàn thành & tự động được nghiệm thu.',
  ]
  const paymentTerms = [
    'Đợt 1 (Tạm ứng): Quý khách vui lòng thanh toán 50% tổng giá trị báo giá sau khi xác nhận báo giá để giữ lịch nhân sự và chuẩn bị thiết bị.',
    'Đợt 2 (Tất toán): Thanh toán 50% giá trị còn lại trong vòng 03 ngày làm việc sau khi bàn giao đầy đủ sản phẩm cuối cùng.',
  ]

  return (
    <section className="space-y-2.5 rounded-lg bg-slate-50 px-3 py-3 text-[10px] leading-[1.22] text-slate-600">
      {equipmentRules.length ? (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-900">THIẾT BỊ SỬ DỤNG</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-3">
            {equipmentRules.map(rule => (
              <li key={`${rule.equipment_title}-${rule.sort_order}`}>
                <span className="font-semibold text-slate-800">{rule.equipment_title}:</span> {rule.equipment_description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-900">ĐIỀU KHOẢN & ĐIỀU KIỆN</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-3">
          {terms.map(term => <li key={term}>{term}</li>)}
        </ul>
      </div>

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-slate-900">ĐIỀU KHOẢN THANH TOÁN</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-3">
          {paymentTerms.map(term => <li key={term}>{term}</li>)}
        </ul>
      </div>

      <SignatureBlock quote={quote} />
    </section>
  )
}

export default function QuotePreview({
  quote = {},
  items = [],
  totals = {},
  entities = [],
  client,
  sticky = true,
}) {
  const entity = getEntity(quote.entity_code, entities)
  const entityName = getEntityName(quote.entity_code, entities)
  const logoUrl = entity?.logo_file ? `/logos/${entity.logo_file}` : null
  const contactRows = getEntityContactRows(entity, quote.entity_code)
  const showTravelFee = Number(totals.travel_fee_total || 0) > 0
  const showOvertimeFee = Number(totals.overtime_fee_total || 0) > 0
  const showVat = Boolean(quote.has_vat)
  const clientName = client?.name || quote.client_name || 'Quý khách hàng'
  const quoteCode = quote.quote_number || quote.id || quote.share_token || ''
  const displayedQuoteCode = quoteCode ? `#${String(quoteCode).replace(/^#/, '')}` : ''

  return (
    <div className={`${sticky ? 'sticky top-6' : ''} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}>
      <div className="grid items-center gap-5 bg-slate-100 px-10 py-6 text-slate-900 sm:px-14 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
        <div className="min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt={entity?.display_name || entityName} className="h-14 w-auto object-contain" />
          ) : (
            <div className="flex h-7 w-24 items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Logo</div>
          )}
          <h2 className="mt-3 text-[22px] font-bold tracking-tight text-slate-950">{entityName}</h2>
        </div>
        <div className="min-w-0 space-y-1 text-left text-[10px] leading-4 text-slate-500 sm:text-right">
          {contactRows.map((row, index) => (
            <div key={`${row}-${index}`} className={`whitespace-nowrap ${index === 0 ? 'font-semibold uppercase tracking-[0.06em] text-slate-600' : ''}`}>
              {row}
            </div>
          ))}
          {displayedQuoteCode ? (
            <div className="pt-0.5 text-[10px] font-medium leading-4 text-slate-400">{displayedQuoteCode}</div>
          ) : null}
        </div>
      </div>

      <div className="space-y-6 px-10 py-6 sm:px-14 sm:py-7">
        <section className="space-y-3 text-[13px] leading-6 text-slate-700">
          <p className="font-semibold text-slate-900">Kính gửi: {clientName}</p>
          <p>Dựa trên thông tin trao đổi, chúng tôi xin gửi báo giá chi tiết dịch vụ như sau:</p>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full table-fixed text-left text-[10.5px]">
            <thead className="bg-slate-50 text-[8px] uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="w-[39%] px-3 py-2.5 font-semibold">Hạng mục</th>
                <th className="w-[12%] whitespace-nowrap px-1 py-2.5 text-center font-semibold">Đơn vị tính</th>
                <th className="w-[10%] whitespace-nowrap px-1 py-2.5 text-center font-semibold">Số lượng</th>
                <th className="w-[8%] whitespace-nowrap px-1 py-2.5 text-center font-semibold">Số buổi</th>
                <th className="w-[15%] px-1.5 py-2.5 text-right font-semibold">Đơn giá</th>
                <th className="w-[17%] px-3 py-2.5 text-right font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length ? items.map((item, index) => (
                <tr key={item.local_id || index}>
                  <td className="px-3 py-2.5 font-medium leading-4 text-slate-800">{getItemName(item)}</td>
                  <td className="px-1 py-2.5 text-center text-slate-600">{getItemUnit(item)}</td>
                  <td className="px-1 py-2.5 text-center text-slate-600">{item.quantity}</td>
                  <td className="px-1 py-2.5 text-center text-slate-600">{item.num_sessions || 1}</td>
                  <td className="px-1.5 py-2.5 text-right text-slate-600">{formatCurrency(item.unit_price)}đ</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(item.total_price)}đ</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-slate-400">Chưa có hạng mục.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="-mt-6 ml-auto w-full max-w-[360px] space-y-1.5 text-[13px]">
          <div className="flex justify-between gap-6 text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}đ</span>
          </div>
          {showTravelFee ? (
            <div className="flex justify-between gap-6 text-slate-600">
              <span>Phụ phí di chuyển</span>
              <span>{formatCurrency(totals.travel_fee_total)}đ</span>
            </div>
          ) : null}
          {showOvertimeFee ? (
            <div className="flex justify-between gap-6 text-slate-600">
              <span>Phụ phí Over-time</span>
              <span>{formatCurrency(totals.overtime_fee_total)}đ</span>
            </div>
          ) : null}
          {showVat ? (
            <div className="flex justify-between gap-6 text-slate-600">
              <span>VAT</span>
              <span>{formatCurrency(totals.vat_amount)}đ</span>
            </div>
          ) : null}
          <div className="border-t border-slate-200 pt-2">
            <div className="flex justify-between text-[16px] font-bold text-slate-950">
              <span>Tổng cộng</span>
              <span>{formatCurrency(totals.total_amount)}đ</span>
            </div>
          </div>
        </section>

        <QuoteEndNotes quote={quote} items={items} validityDays={normalizeQuoteValidityDays(quote.validity_days)} />
      </div>
    </div>
  )
}
