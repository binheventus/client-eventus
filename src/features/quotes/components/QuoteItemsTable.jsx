import { ArrowDown, ArrowUp } from 'lucide-react'

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function getServiceName(item) {
  return item.service_name || item.service?.quote_display_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

export default function QuoteItemsTable({
  items = [],
  onChangeItem,
  onMoveItem,
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
              <th className="w-[8%] px-2 py-3 text-center font-semibold">Thứ tự</th>
              <th className="w-[35%] px-3 py-3 font-semibold">Dịch vụ</th>
              <th className="w-[7%] px-1.5 py-3 text-center font-semibold">SL</th>
              <th className="w-[10%] px-1.5 py-3 text-center font-semibold">Buổi/ngày</th>
              <th className="w-[15%] px-2 py-3 text-right font-semibold">Đơn giá</th>
              <th className="w-[17%] py-3 pl-2 pr-5 text-right font-semibold">Thành tiền</th>
              <th className="w-[8%] px-2 py-3" />
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
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <button
                      type="button"
                      title="Đưa hạng mục lên"
                      aria-label="Đưa hạng mục lên"
                      disabled={index === 0}
                      onClick={() => onMoveItem?.(index, index - 1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ArrowUp size={15} strokeWidth={2.2} />
                    </button>
                    <button
                      type="button"
                      title="Đưa hạng mục xuống"
                      aria-label="Đưa hạng mục xuống"
                      disabled={index === items.length - 1}
                      onClick={() => onMoveItem?.(index, index + 1)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ArrowDown size={15} strokeWidth={2.2} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex min-h-8 flex-wrap items-center gap-1.5">
                    {item.is_custom ? (
                      <textarea
                        value={getServiceName(item)}
                        rows={1}
                        onChange={event => onChangeItem?.(index, { service_name: event.target.value })}
                        className="min-w-[140px] flex-1 resize-none rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-medium leading-5 text-slate-800 outline-none focus:border-slate-200 focus:bg-white"
                      />
                    ) : (
                      <span className="min-w-[140px] flex-1 break-words px-2 py-1.5 font-medium leading-5 text-slate-800">
                        {getServiceName(item)}
                      </span>
                    )}
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold leading-4 text-slate-500">
                      {item.resolved_service_code || item.service_code || 'CUSTOM'}
                    </span>
                    {item.is_overridden ? (
                      <span className="shrink-0 rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-orange-600">
                        Đã sửa giá
                      </span>
                    ) : null}
                  </div>
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
                <td className="px-2 py-2">
                  <input
                    type="number"
                    min="0"
                    value={item.unit_price}
                    onChange={event => onChangeItem?.(index, { unit_price: Number(event.target.value) }, { priceChanged: true })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </td>
                <td className="py-3 pl-2 pr-5 text-right font-semibold text-slate-900">
                  {formatCurrency(item.total_price)}đ
                </td>
                <td className="px-2 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(index)}
                    className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-red-500 hover:bg-red-50"
                  >
                    Xóa
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
