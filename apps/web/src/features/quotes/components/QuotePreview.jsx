import { useState } from 'react'
import equipmentRulesData from '../../../data/pricing/equipment_rules.json'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'
import { getMatchedEquipmentRules } from '../lib/equipmentRules'
import { getQuoteTerms } from '../lib/quoteTerms'

const SIGNATURE_IMAGE_SRC = '/signatures/nguyen-thu-huyen.png'
const STAMP_IMAGE_BY_ENTITY = {
  EVENTUS: '/stamps/Stamp-eventus.png',
  MEDIAMONSTER: '/stamps/Stamp-mediamonster.png',
}

function getStampImageSrc(entityCode) {
  return STAMP_IMAGE_BY_ENTITY[entityCode] || STAMP_IMAGE_BY_ENTITY.EVENTUS
}

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

function SignatureBlock({ quote, showStamp = true }) {
  const [imageFailed, setImageFailed] = useState(false)
  const [stampFailed, setStampFailed] = useState(false)
  const stampImageSrc = getStampImageSrc(quote?.entity_code)

  return (
    <section className="flex justify-end pr-8 pt-1">
      <div className="w-full max-w-[180px] text-right text-[12px] leading-5 text-black">
        <p className="text-black">Ngày lập: {formatQuoteDate(quote?.created_at)}</p>
        <div className="relative mt-7 ml-auto flex aspect-[500/301] w-[120px] items-center justify-center text-center text-[10px] leading-4 text-black">
          {showStamp && !stampFailed ? (
            <img
              src={stampImageSrc}
              alt="Con dấu pháp nhân"
              onError={() => setStampFailed(true)}
              className="pointer-events-none absolute -left-2 -top-8 z-10 h-36 w-36 max-w-none object-contain"
            />
          ) : null}
          {!imageFailed ? (
            <img
              src={SIGNATURE_IMAGE_SRC}
              alt="Chữ ký Nguyễn Thu Huyền"
              onError={() => setImageFailed(true)}
              className="relative z-0 w-[138px] max-w-none translate-x-8 object-contain"
            />
          ) : (
            <span className="rounded border border-dashed border-slate-300 px-2 py-1">Đặt ảnh chữ ký tại public/signatures/nguyen-thu-huyen.png</span>
          )}
        </div>
        <p className="mt-4 text-[10px] font-bold text-black">Nguyễn Thu Huyền</p>
        <p className="text-[9px] text-black">Account Manager</p>
      </div>
    </section>
  )
}

function QuoteEndNotes({ quote = {}, items = [] }) {
  const equipmentRules = getMatchedEquipmentRules(items, equipmentRulesData)
  const terms = getQuoteTerms(quote)
  const paymentTerms = [
    'Đợt 1 (Tạm ứng): Quý khách vui lòng thanh toán 50% tổng giá trị báo giá sau khi xác nhận báo giá để giữ lịch nhân sự và chuẩn bị thiết bị.',
    'Đợt 2 (Tất toán): Thanh toán 50% giá trị còn lại trong vòng 03 ngày làm việc sau khi bàn giao đầy đủ sản phẩm cuối cùng.',
  ]

  return (
    <section className="space-y-2.5 rounded-lg border border-slate-300 bg-white px-3 py-3 text-[10px] leading-[1.22] text-black">
      {equipmentRules.length ? (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-black">THIẾT BỊ SỬ DỤNG</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-3">
            {equipmentRules.map(rule => (
              <li key={`${rule.equipment_title}-${rule.sort_order}`}>
                <span className="font-semibold text-black">{rule.equipment_title}:</span> {rule.equipment_description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-black">ĐIỀU KHOẢN & ĐIỀU KIỆN</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-3">
          {terms.map(term => <li key={term}>{term}</li>)}
        </ul>
      </div>

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-black">ĐIỀU KHOẢN THANH TOÁN</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-3">
          {paymentTerms.map(term => <li key={term}>{term}</li>)}
        </ul>
      </div>
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
  tableOnly = false,
  showStamp = true,
}) {
  const entityRows = entities.length ? entities : legalEntitiesData
  const entity = getEntity(quote.entity_code, entityRows)
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
      {!tableOnly ? (
        <div className="grid items-center gap-5 bg-slate-100 px-10 py-6 text-black sm:px-14 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
          <div className="min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt={entity?.display_name || entityName} className="h-14 w-auto object-contain" />
            ) : (
              <div className="flex h-7 w-24 items-center text-[10px] font-semibold uppercase tracking-[0.14em] text-black">Logo</div>
            )}
            <h2 className="mt-3 text-[22px] font-bold tracking-tight text-black">{entityName}</h2>
          </div>
          <div className="min-w-0 space-y-1 text-left text-[10px] leading-4 text-black sm:text-right">
            {contactRows.map((row, index) => (
              <div key={`${row}-${index}`} className={`whitespace-nowrap ${index === 0 ? 'font-semibold uppercase tracking-[0.06em] text-black' : ''}`}>
                {row}
              </div>
            ))}
            {displayedQuoteCode ? (
              <div className="pt-0.5 text-[10px] font-medium leading-4 text-black">{displayedQuoteCode}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`${tableOnly ? 'space-y-4 px-4 py-4 sm:px-5' : 'flex flex-col gap-3 px-10 py-6 sm:px-14 sm:py-7'}`}>
        {!tableOnly ? (
          <section className="space-y-3 text-[13px] leading-6 text-black">
            <p className="font-semibold text-black">Kính gửi: {clientName}</p>
            <p>Dựa trên thông tin trao đổi, chúng tôi xin gửi báo giá chi tiết dịch vụ như sau:</p>
          </section>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-slate-300">
          <table className="w-full table-fixed text-left text-[13px]">
            <thead className="bg-slate-50 text-[8px] uppercase tracking-[0.08em] text-black">
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
                  <td className="px-3 py-2.5 font-medium leading-4 text-black">{getItemName(item)}</td>
                  <td className="px-1 py-2.5 text-center text-black">{getItemUnit(item)}</td>
                  <td className="px-1 py-2.5 text-center text-black">{item.quantity}</td>
                  <td className="px-1 py-2.5 text-center text-black">{item.num_sessions || 1}</td>
                  <td className="px-1.5 py-2.5 text-right text-black">{formatCurrency(item.unit_price)}đ</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-black">{formatCurrency(item.total_price)}đ</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-[12px] text-black">Chưa có hạng mục.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className={`${tableOnly ? 'ml-auto' : 'mt-2 ml-auto'} w-full max-w-[360px] space-y-1.5 pr-3 text-[13px]`}>
          <div className="flex justify-between gap-6 text-black">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}đ</span>
          </div>
          {!tableOnly && showTravelFee ? (
            <div className="flex justify-between gap-6 text-black">
              <span>Phụ phí di chuyển</span>
              <span>{formatCurrency(totals.travel_fee_total)}đ</span>
            </div>
          ) : null}
          {!tableOnly && showOvertimeFee ? (
            <div className="flex justify-between gap-6 text-black">
              <span>Phụ phí Over-time</span>
              <span>{formatCurrency(totals.overtime_fee_total)}đ</span>
            </div>
          ) : null}
          {showVat ? (
            <div className="flex justify-between gap-6 text-black">
              <span>Thuế GTGT 8%</span>
              <span>{formatCurrency(totals.vat_amount)}đ</span>
            </div>
          ) : null}
          <div className="border-t border-slate-200 pt-2">
            <div className={`flex justify-between font-bold text-black ${tableOnly ? 'text-[14px]' : 'text-[15px]'}`}>
              <span>Tổng cộng</span>
              <span>{formatCurrency(totals.total_amount)}đ</span>
            </div>
          </div>
        </section>

        {!tableOnly ? (
          <>
            <div className="mt-2">
              <QuoteEndNotes quote={quote} items={items} />
            </div>
            <SignatureBlock quote={quote} showStamp={showStamp} />
          </>
        ) : null}
      </div>
    </div>
  )
}
