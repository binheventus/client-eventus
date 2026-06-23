import { Fragment, useState } from 'react'
import legalEntitiesData from '../../../data/pricing/legal_entities.json'
import { getMatchedEquipmentRules } from '../lib/equipmentRules'
import {
  QUOTE_ACTUAL_PRODUCT_PREFIX,
  QUOTE_ACTUAL_PRODUCT_TITLE,
  QUOTE_ACTUAL_PRODUCT_URL,
  getQuotePaymentTerms,
  getQuoteTerms,
} from '../lib/quoteTerms'
import { findLegalEntityByAlias, isMediaMonsterEntityCode, normalizeLegalEntityCode } from '../lib/entityCodes'
import { formatVatLabel } from '../lib/pricingCalculator'

const SIGNATURE_IMAGE_SRC = '/signatures/nguyen-thu-huyen.png'
const STAMP_IMAGE_BY_ENTITY = {
  EVT: '/stamps/Stamp-eventus.png',
  MMT: '/stamps/Stamp-mediamonster.png',
}

function getStampImageSrc(entityCode) {
  return STAMP_IMAGE_BY_ENTITY[normalizeLegalEntityCode(entityCode)] || STAMP_IMAGE_BY_ENTITY.EVT
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatQuoteDate(value) {
  const date = value ? new Date(value) : new Date()
  return date.toLocaleDateString('vi-VN')
}

function getEntity(entityCode, entities = []) {
  return findLegalEntityByAlias(entityCode, entities)
}

function getEntityName(entityCode, entities = []) {
  return 'Báo giá dịch vụ'
}

function getLegalName(entity, entityCode) {
  return entity?.legal_name || entity?.entity_name_full || entity?.name || (isMediaMonsterEntityCode(entityCode) ? 'Công ty TNHH MediaMonster' : 'Công ty TNHH Eventus Việt Nam')
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

function getEntityMobileContactRows(entity, entityCode) {
  const legalName = getLegalName(entity, entityCode)
  return [
    legalName,
    entity?.address || null,
    [entity?.email || null, entity?.hotline || null].filter(Boolean).join(' | '),
  ].filter(Boolean)
}

function getItemName(item) {
  return item.service_name || item.service?.quote_display_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

function getItemUnit(item) {
  return item.unit || item.service?.unit || item.pricing_unit || 'Người'
}

function getItemGroupLabel(item = {}) {
  return String(item.group_label || item.event_day || item.day_index || item.day || 'Hạng mục').trim() || 'Hạng mục'
}

function getItemGroupSortOrder(item = {}) {
  const sortOrder = Number(item.group_sort_order)
  return Number.isFinite(sortOrder) ? sortOrder : 99
}

function groupQuoteItems(items = []) {
  const groups = new Map()
  items.forEach((item, index) => {
    const label = getItemGroupLabel(item)
    const key = `${item.group_code || label}-${label}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label,
        sortOrder: getItemGroupSortOrder(item),
        firstIndex: index,
        items: [],
      })
    }
    groups.get(key).items.push(item)
  })

  return Array.from(groups.values()).sort((a, b) => (a.sortOrder - b.sortOrder) || (a.firstIndex - b.firstIndex))
}

function getGroupTotal(items = []) {
  return items.reduce((sum, item) => sum + Number(item.total_price || 0), 0)
}

function getPreDiscountTotal(totals = {}) {
  const explicitTotal = Number(totals.pre_discount_total)
  if (Number.isFinite(explicitTotal) && explicitTotal > 0) return explicitTotal
  return Number(totals.subtotal || 0) + Number(totals.travel_fee_total || 0) + Number(totals.overtime_fee_total || 0)
}

function getTaxableAmount(totals = {}) {
  const explicitAmount = Number(totals.taxable_amount)
  if (Number.isFinite(explicitAmount) && explicitAmount >= 0) return explicitAmount
  return Math.max(0, getPreDiscountTotal(totals) - getDiscountAmount(totals))
}

function getDiscountAmount(totals = {}) {
  return Math.min(Math.max(0, Number(totals.discount_amount || 0)), getPreDiscountTotal(totals))
}

function ContactRow({ row, highlight = false }) {
  if (row.includes(' | ')) {
    const [first, second] = row.split(' | ')
    return (
      <div className="break-words sm:whitespace-nowrap">
        <span>{first}</span>
        <span className="hidden sm:inline"> | </span>
        <span className="block sm:inline">{second}</span>
      </div>
    )
  }

  return (
    <div className={`break-words sm:whitespace-nowrap ${highlight ? 'font-semibold uppercase tracking-[0.06em] text-black' : ''}`}>
      {row}
    </div>
  )
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

function QuoteEndNotes({ quote = {}, items = [], equipmentRules = [] }) {
  const matchedEquipmentRules = getMatchedEquipmentRules(items, equipmentRules)
  const terms = getQuoteTerms(quote)
  const paymentTerms = getQuotePaymentTerms()

  return (
    <section className="space-y-2.5 rounded-lg border border-slate-300 bg-slate-100 px-3 py-3 text-[10px] leading-[1.22] text-black">
      {matchedEquipmentRules.length ? (
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-black">THIẾT BỊ SỬ DỤNG</h3>
          <ul className="mt-1 list-disc space-y-0.5 pl-3">
            {matchedEquipmentRules.map(rule => (
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

      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-[0.04em] text-black">{QUOTE_ACTUAL_PRODUCT_TITLE}</h3>
        <ul className="mt-1 list-disc space-y-0.5 pl-3">
          <li>
            {QUOTE_ACTUAL_PRODUCT_PREFIX}{' '}
            <a
              href={QUOTE_ACTUAL_PRODUCT_URL}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#f8981d] underline decoration-[#f8981d]/50 underline-offset-2"
            >
              {QUOTE_ACTUAL_PRODUCT_URL}
            </a>
          </li>
        </ul>
      </div>
    </section>
  )
}

function QuoteItemsMobileCards({ items = [], tableOnly = false, lineItemAmountSuffix = 'đ' }) {
  const groups = groupQuoteItems(items)
  const showGroupHeaders = groups.length > 1
  const cardTitleClass = tableOnly ? 'text-[11pt] leading-[1.5]' : 'text-[13px] leading-5'
  const cardMetaClass = tableOnly ? 'text-[11pt] leading-[1.5]' : 'text-[11px] leading-4'
  const cardGroupClass = tableOnly ? 'text-[11pt]' : 'text-[12px]'
  const cardGroupBadgeClass = tableOnly ? 'text-[11pt]' : 'text-[10px]'

  if (!items.length) {
    return (
      <section className={`rounded-xl border border-slate-300 px-4 py-8 text-center text-black sm:hidden ${tableOnly ? 'text-[11pt]' : 'text-[12px]'}`}>
        Chưa có hạng mục.
      </section>
    )
  }

  return (
    <section className="space-y-3 sm:hidden">
      {groups.map(group => (
        <div key={group.key} className="overflow-hidden rounded-xl border border-slate-300 bg-white text-black">
          {showGroupHeaders ? (
            <div className="border-b border-slate-200 bg-slate-50 px-3.5 py-2.5">
              <div className={`flex flex-wrap items-center justify-between gap-2 font-bold uppercase tracking-[0.04em] text-black ${cardGroupClass}`}>
                <span className="min-w-0">{group.label}</span>
                <span className={`shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 tracking-normal text-amber-800 ${cardGroupBadgeClass}`}>
                  {formatCurrency(getGroupTotal(group.items))}đ
                </span>
              </div>
            </div>
          ) : null}
          <div className="divide-y divide-slate-100">
            {group.items.map((item, index) => (
              <article key={item.local_id || `${group.key}-${index}`} className="px-3.5 py-3 text-black">
                <h3 className={`${cardTitleClass} font-semibold text-black`}>{getItemName(item)}</h3>
                <div className={`mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 text-slate-600 ${cardMetaClass}`}>
                  <span>{item.quantity} {getItemUnit(item)} • {item.num_sessions || 1} buổi</span>
                  <span className="max-w-[130px] text-right">{formatCurrency(item.unit_price)}{lineItemAmountSuffix}/{getItemUnit(item).toLowerCase()}</span>
                </div>
                <dl className={`mt-3 border-t border-slate-100 pt-2 text-black ${cardMetaClass}`}>
                  <div className="flex items-center justify-between gap-4 font-bold">
                    <dt>Thành tiền</dt>
                    <dd>{formatCurrency(item.total_price)}{lineItemAmountSuffix}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

export default function QuotePreview({
  quote = {},
  items = [],
  totals = {},
  entities = [],
  equipmentRules = [],
  client,
  sticky = true,
  tableOnly = false,
  showStamp,
  subtotalLabel = 'Cộng tiền dịch vụ',
  lineItemAmountSuffix = 'đ',
}) {
  const entityRows = entities.length ? entities : legalEntitiesData
  const entity = getEntity(quote.entity_code, entityRows)
  const entityName = getEntityName(quote.entity_code, entities)
  const logoUrl = entity?.logo_file ? `/logos/${entity.logo_file}` : null
  const contactRows = getEntityContactRows(entity, quote.entity_code)
  const mobileContactRows = getEntityMobileContactRows(entity, quote.entity_code)
  const showTravelFee = Number(totals.travel_fee_total || 0) > 0
  const showOvertimeFee = Number(totals.overtime_fee_total || 0) > 0
  const discountAmount = getDiscountAmount(totals)
  const showDiscount = discountAmount > 0
  const showVat = Boolean(quote.has_vat)
  const vatLabel = formatVatLabel(totals)
  const clientName = client?.name || quote.client_name || 'Quý khách hàng'
  const quoteCode = quote.quote_number || quote.id || quote.share_token || ''
  const displayedQuoteCode = quoteCode ? `#${String(quoteCode).replace(/^#/, '')}` : ''
  const itemGroups = groupQuoteItems(items)
  const showGroupHeaders = itemGroups.length > 1
  const shouldShowStamp = showStamp ?? quote.show_stamp !== false
  const tableTextClass = tableOnly ? 'text-[11pt]' : 'text-[13px]'
  const tableHeaderTextClass = tableOnly ? 'text-[11pt]' : 'text-[9px]'
  const totalTextClass = tableOnly ? 'text-[11pt]' : 'text-[13px]'
  const grandTotalTextClass = tableOnly ? 'text-[11pt]' : 'text-[15px]'

  return (
    <div className={`${sticky ? 'sticky top-6' : ''} w-full min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm`}>
      {!tableOnly ? (
        <div className="grid items-center gap-3 bg-slate-100 px-6 py-4 text-black sm:gap-5 sm:px-14 sm:py-6 sm:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
          <div className="flex min-w-0 items-start justify-between gap-4 sm:block">
            {logoUrl ? (
              <img src={logoUrl} alt={entity?.display_name || entityName} className="order-2 h-10 w-auto shrink-0 object-contain sm:h-14" />
            ) : (
              <div className="order-2 flex h-7 w-24 shrink-0 items-center justify-end text-[10px] font-semibold uppercase tracking-[0.14em] text-black">Logo</div>
            )}
            <h2 className="order-1 mt-0 min-w-0 text-left text-[22px] font-bold tracking-tight text-black sm:mt-3">{entityName}</h2>
          </div>
          <div className="min-w-0 space-y-0.5 text-left text-[10px] leading-4 text-black sm:space-y-1 sm:text-right">
            <div className="sm:hidden">
              {mobileContactRows.map((row, index) => (
                <div key={`${row}-${index}`} className={`break-words ${row.includes(' | ') ? 'whitespace-nowrap' : ''} ${index === 0 ? 'font-semibold uppercase tracking-[0.06em] text-black' : ''}`}>
                  {row}
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
              {contactRows.map((row, index) => (
                <ContactRow key={`${row}-${index}`} row={row} highlight={index === 0} />
              ))}
            </div>
            {displayedQuoteCode ? (
              <div className="text-[10px] font-medium leading-4 text-black sm:pt-0.5">{displayedQuoteCode}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={`${tableOnly ? 'space-y-4 px-4 py-4 sm:px-5' : 'flex flex-col gap-3 px-6 py-6 sm:px-14 sm:py-7'}`}>
        {!tableOnly ? (
          <section className="space-y-3 text-[13px] leading-6 text-black">
            <p className="font-semibold text-black">Kính gửi: {clientName}</p>
            <p>Dựa trên thông tin trao đổi, chúng tôi xin gửi báo giá chi tiết dịch vụ như sau:</p>
          </section>
        ) : null}

        <QuoteItemsMobileCards items={items} tableOnly={tableOnly} lineItemAmountSuffix={lineItemAmountSuffix} />

        <section className="hidden overflow-hidden rounded-xl border border-slate-300 sm:block">
          <table className={`w-full table-fixed text-left ${tableTextClass}`}>
            <thead className={`bg-slate-50 uppercase ${tableOnly ? 'tracking-[0.04em]' : 'tracking-[0.08em]'} text-black ${tableHeaderTextClass}`}>
              <tr>
                <th className={`w-[36%] ${showGroupHeaders ? 'pl-6' : 'pl-3'} py-2.5 pr-3 font-semibold`}>Hạng mục</th>
                <th className="w-[11%] whitespace-nowrap px-1 py-2.5 text-center font-semibold">ĐVT</th>
                <th className="w-[11%] whitespace-nowrap px-2 py-2.5 text-center font-semibold">Số lượng</th>
                <th className="w-[10%] whitespace-nowrap px-2 py-2.5 text-center font-semibold">Số buổi</th>
                <th className="w-[15%] px-1.5 py-2.5 text-right font-semibold">Đơn giá</th>
                <th className="w-[17%] px-3 py-2.5 text-right font-semibold">Thành tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length ? itemGroups.map(group => (
                <Fragment key={group.key}>
                  {showGroupHeaders ? (
                    <tr>
                      <td colSpan={6} className={`bg-slate-100 px-3 py-2 font-bold uppercase tracking-[0.05em] text-black ${tableHeaderTextClass}`}>
                        <div className="flex items-center gap-2">
                          <span>{group.label}</span>
                          <span className={`inline-flex shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-bold tracking-normal text-amber-800 ${tableHeaderTextClass}`}>
                            {formatCurrency(getGroupTotal(group.items))}{lineItemAmountSuffix}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {group.items.map((item, index) => (
                    <tr key={item.local_id || `${group.key}-${index}`}>
                      <td className={`${showGroupHeaders ? 'pl-6' : 'pl-3'} py-2.5 pr-3 font-medium leading-4 text-black`}>{getItemName(item)}</td>
                      <td className="px-1 py-2.5 text-center text-black">{getItemUnit(item)}</td>
                      <td className="px-2 py-2.5 text-center text-black">{item.quantity}</td>
                      <td className="px-2 py-2.5 text-center text-black">{item.num_sessions || 1}</td>
                      <td className="px-1.5 py-2.5 text-right text-black">{formatCurrency(item.unit_price)}{lineItemAmountSuffix}</td>
                      <td className="px-3 py-2.5 text-right text-black">{formatCurrency(item.total_price)}{lineItemAmountSuffix}</td>
                    </tr>
                  ))}
                </Fragment>
              )) : (
                <tr>
                  <td colSpan={6} className={`px-3 py-8 text-center text-black ${tableOnly ? 'text-[11pt]' : 'text-[12px]'}`}>Chưa có hạng mục.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className={`${tableOnly ? 'ml-auto' : 'mt-2 ml-auto'} w-full max-w-[360px] space-y-1.5 ${totalTextClass} sm:pr-3`}>
          <div className="flex justify-between gap-6 text-black">
            <span>{subtotalLabel}</span>
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
          {showDiscount ? (
            <>
              <div className="flex justify-between gap-6 text-black">
                <span>Chiết khấu ưu đãi</span>
                <span>-{formatCurrency(discountAmount)}đ</span>
              </div>
              <div className="flex justify-between gap-6 font-semibold text-black">
                <span>Giá trị sau chiết khấu</span>
                <span>{formatCurrency(getTaxableAmount(totals))}đ</span>
              </div>
            </>
          ) : null}
          {showVat ? (
            <div className="flex justify-between gap-6 text-black">
              <span>{vatLabel}</span>
              <span>{formatCurrency(totals.vat_amount)}đ</span>
            </div>
          ) : null}
          <div className="border-t border-slate-200 pt-2">
            <div className={`flex justify-between font-bold text-black ${grandTotalTextClass}`}>
              <span>Tổng thanh toán</span>
              <span>{formatCurrency(totals.total_amount)}đ</span>
            </div>
          </div>
        </section>

        {!tableOnly ? (
          <>
            <div className="mt-2">
              <QuoteEndNotes quote={quote} items={items} equipmentRules={equipmentRules} />
            </div>
            <SignatureBlock quote={quote} showStamp={shouldShowStamp} />
          </>
        ) : null}
      </div>
    </div>
  )
}
