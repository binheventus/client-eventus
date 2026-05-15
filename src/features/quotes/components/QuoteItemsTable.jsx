function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function getServiceName(item) {
  return item.service_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
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

      <div className="overflow-x-auto">
        <table className="min-w-[760px] w-full text-left text-[13px]">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Dịch vụ</th>
              <th className="w-24 px-3 py-3 font-semibold">SL</th>
              <th className="w-28 px-3 py-3 font-semibold">Buổi/ngày</th>
              <th className="w-40 px-3 py-3 font-semibold">Đơn giá</th>
              <th className="w-40 px-3 py-3 text-right font-semibold">Thành tiền</th>
              <th className="w-16 px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[13px] text-slate-400">
                  Chưa có hạng mục.
                </td>
              </tr>
            ) : items.map((item, index) => (
              <tr key={item.local_id || index} className="align-top">
                <td className="px-4 py-3">
                  <input
                    value={getServiceName(item)}
                    disabled={!item.is_custom}
                    onChange={event => onChangeItem?.(index, { service_name: event.target.value })}
                    className="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 font-medium text-slate-800 outline-none focus:border-slate-200 focus:bg-white disabled:text-slate-800"
                  />
                  <div className="px-2 text-[11px] text-slate-400">
                    {item.resolved_service_code || item.service_code || 'CUSTOM'}
                    {item.is_overridden ? <span className="ml-2 text-orange-600">Đã sửa giá</span> : null}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={event => onChangeItem?.(index, { quantity: Number(event.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="1"
                    value={item.num_sessions}
                    onChange={event => onChangeItem?.(index, { num_sessions: Number(event.target.value) })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min="0"
                    value={item.unit_price}
                    onChange={event => onChangeItem?.(index, { unit_price: Number(event.target.value) }, { priceChanged: true })}
                    className="w-full rounded-lg border border-slate-200 px-2 py-2 outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </td>
                <td className="px-3 py-5 text-right font-semibold text-slate-900">
                  {formatCurrency(item.total_price)}đ
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onRemoveItem?.(index)}
                    className="rounded-lg px-2 py-2 text-[12px] font-semibold text-red-500 hover:bg-red-50"
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
