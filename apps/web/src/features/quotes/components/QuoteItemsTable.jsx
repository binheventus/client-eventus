import { Trash2 } from 'lucide-react'

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function parseCurrencyInput(value) {
  const clean = String(value || '').replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

function formatHourInput(value) {
  if (value === undefined || value === null || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return Number.isInteger(number) ? String(number) : String(number).replace(/\.0+$/, '')
}

function getServiceName(item) {
  return item.service_name || item.service?.quote_display_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

function getServiceCode(item) {
  return item.resolved_service_code || item.service_code || 'CUSTOM'
}

function getServiceRawName(item) {
  return item.service?.service_name || item.service_name_raw || ''
}

export default function QuoteItemsTable({
  items = [],
  onChangeItem,
  onRemoveItem,
  onAddService,
  onAddCustomItem,
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">Hạng mục báo giá</h3>
          <p className="mt-0.5 text-[12px] text-slate-500">Giá snapshot tại thời điểm tạo báo giá.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAddService}
            className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-700 hover:bg-orange-100"
          >
            + Thêm hạng mục
          </button>
          <button
            type="button"
            onClick={onAddCustomItem}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            + Thêm custom item
          </button>
        </div>
      </div>

      <div className="overflow-hidden">
        <table className="w-full table-fixed text-left text-[13px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="w-[51%] py-3 pl-5 pr-3 font-semibold">Dịch vụ</th>
              <th className="w-[6%] px-1.5 py-3 text-center font-semibold">SL</th>
              <th className="w-[7%] px-1.5 py-3 text-center font-semibold">Số buổi</th>
              <th className="w-[8%] px-1.5 py-3 text-center font-semibold">Giờ tính</th>
              <th className="w-[13%] px-2 py-3 text-right font-semibold">Đơn giá</th>
              <th className="w-[10%] py-3 pl-0 pr-0 text-right font-semibold">Thành tiền</th>
              <th className="w-[5%] py-3 pl-0 pr-1" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[13px] text-slate-400">
                  Chưa có hạng mục.
                </td>
              </tr>
            ) : items.map((item, index) => (
              <tr key={item.local_id || index} className="align-top">
                <td className="py-2 pl-5 pr-3">
                  {item.is_custom ? (
                    <textarea
                      value={item.service_name || ''}
                      rows={1}
                      placeholder="Nhập tên hạng mục tùy chỉnh..."
                      onChange={event => onChangeItem?.(index, { service_name: event.target.value })}
                      className="min-h-8 w-full resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 font-medium leading-5 text-black outline-none placeholder:text-slate-400 focus:border-slate-200 focus:bg-white"
                    />
                  ) : (
                    <div className="grid min-h-8 grid-cols-[130px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5">
                      <div className="min-w-[120px] basis-[130px] shrink grow-0">
                        <span className="block break-words px-2 py-1 font-medium leading-5 text-black">
                          {getServiceName(item)}
                        </span>
                        <span
                          title="Mã dịch vụ"
                          className="ml-2 mt-0.5 inline-flex w-fit rounded-full border border-orange-100/70 bg-orange-50/60 px-1.5 py-0 text-[9px] font-semibold leading-3 text-orange-300"
                        >
                          {getServiceCode(item)}
                        </span>
                      </div>
                      {getServiceRawName(item) ? (
                        <span className="min-w-0 break-words px-2 py-1 text-[12px] font-medium leading-5 text-slate-500">
                          {getServiceRawName(item)}
                        </span>
                      ) : null}
                      {item.is_overridden ? (
                        <span className="col-start-2 w-fit rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-orange-600">
                          Đã sửa giá
                        </span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="px-1.5 py-2">
                  <input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={event => onChangeItem?.(index, { quantity: Number(event.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </td>
                <td className="px-1.5 py-2">
                  <input
                    type="number"
                    min="1"
                    value={item.num_sessions}
                    onChange={event => onChangeItem?.(index, { num_sessions: Number(event.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </td>
                <td className="px-1.5 py-2">
                  {item.is_custom ? (
                    <div className="rounded-lg border border-transparent px-1.5 py-1.5 text-center text-slate-300">-</div>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={formatHourInput(item.billable_duration_hours)}
                      onChange={event => onChangeItem?.(index, { billable_duration_hours: Number(event.target.value) || '' })}
                      className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                    />
                  )}
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatCurrency(item.unit_price)}
                    onChange={event => onChangeItem?.(index, { unit_price: parseCurrencyInput(event.target.value) }, { priceChanged: true })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </td>
                <td className="py-3 pl-0 pr-0 text-right font-semibold text-slate-900">
                  {formatCurrency(item.total_price)}đ
                </td>
                <td className="py-2 pl-0 pr-1 text-right">
                  <button
                    type="button"
                    title="Xóa hạng mục"
                    aria-label="Xóa hạng mục"
                    onClick={() => onRemoveItem?.(index)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={15} strokeWidth={2.2} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
