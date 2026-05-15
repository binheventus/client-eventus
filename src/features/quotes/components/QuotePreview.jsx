function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function formatDate(value) {
  if (!value) return 'Chưa chọn'
  return new Date(value).toLocaleDateString('vi-VN')
}

function getEntityName(entityCode, entities = []) {
  const entity = entities.find(row => (row.entity_code || row.code) === entityCode)
  return entity?.display_name || entity?.legal_name || entity?.name || (entityCode === 'MEDIAMONSTER' ? 'Mediamonster' : 'Eventus')
}

function getItemName(item) {
  return item.service_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

export default function QuotePreview({
  quote = {},
  items = [],
  totals = {},
  entities = [],
  client,
}) {
  const entityName = getEntityName(quote.entity_code, entities)

  return (
    <div className="sticky top-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-[#f8981d] px-6 py-5 text-white">
        <div className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/80">Báo giá dịch vụ</div>
        <h2 className="mt-2 text-[26px] font-bold tracking-tight">{entityName}</h2>
        <p className="mt-1 text-[13px] text-white/85">Eventus AI Lab</p>
      </div>

      <div className="space-y-5 px-6 py-5">
        <section className="grid gap-3 text-[13px] text-slate-600 sm:grid-cols-2">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Sự kiện</div>
            <div className="mt-1 font-semibold text-slate-900">{quote.event_name || 'Chưa nhập'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Ngày</div>
            <div className="mt-1 font-semibold text-slate-900">{formatDate(quote.event_date)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Khách hàng</div>
            <div className="mt-1 font-semibold text-slate-900">{client?.name || quote.client_name || 'Chưa chọn'}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Địa điểm</div>
            <div className="mt-1 font-semibold text-slate-900">{quote.location || 'Chưa nhập'}</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Hạng mục</th>
                <th className="w-14 px-2 py-2 text-right font-semibold">SL</th>
                <th className="w-24 px-2 py-2 text-right font-semibold">Đơn giá</th>
                <th className="w-24 px-3 py-2 text-right font-semibold">Tiền</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length ? items.map((item, index) => (
                <tr key={item.local_id || index}>
                  <td className="px-3 py-2 font-medium text-slate-800">{getItemName(item)}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{item.quantity}</td>
                  <td className="px-2 py-2 text-right text-slate-600">{formatCurrency(item.unit_price)}đ</td>
                  <td className="px-3 py-2 text-right font-semibold text-slate-900">{formatCurrency(item.total_price)}đ</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-slate-400">Chưa có hạng mục.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="space-y-2 text-[13px]">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(totals.subtotal)}đ</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Phụ phí di chuyển</span>
            <span>{formatCurrency(totals.travel_fee_total)}đ</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Phụ phí giờ vượt</span>
            <span>{formatCurrency(totals.overtime_fee_total)}đ</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>VAT</span>
            <span>{formatCurrency(totals.vat_amount)}đ</span>
          </div>
          <div className="border-t border-slate-200 pt-3">
            <div className="flex justify-between text-[18px] font-bold text-slate-950">
              <span>Tổng cộng</span>
              <span>{formatCurrency(totals.total_amount)}đ</span>
            </div>
          </div>
        </section>

        <section className="rounded-xl bg-slate-50 px-4 py-3 text-[12px] leading-5 text-slate-500">
          Báo giá có hiệu lực trong {quote.validity_days || 15} ngày. Chi phí phát sinh ngoài phạm vi công việc sẽ được xác nhận trước khi triển khai.
        </section>
      </div>
    </div>
  )
}
