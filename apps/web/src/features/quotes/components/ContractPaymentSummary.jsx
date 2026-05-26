import { DEFAULT_PAYMENT_CONFIG, numberToVietnameseWords } from '../lib/contractDefaults'

function formatCurrency(value) {
  const number = Number(value || 0)
  return number > 0 ? new Intl.NumberFormat('vi-VN').format(number) : ''
}

export default function ContractPaymentSummary({ quote = {}, paymentConfig = {}, className = '' }) {
  const depositPercent = paymentConfig.deposit_percent ?? DEFAULT_PAYMENT_CONFIG.deposit_percent
  const finalDueDays = paymentConfig.final_due_days ?? DEFAULT_PAYMENT_CONFIG.final_due_days
  const totalAmount = Number(quote.total_amount || 0)
  const depositAmount = totalAmount * Number(depositPercent || 0) / 100
  const totalWords = totalAmount > 0 ? numberToVietnameseWords(totalAmount) : ''

  return (
    <div className={`text-[13px] leading-6 text-slate-700 ${className}`}>
      <h3 className="text-[14px] font-semibold text-slate-900">ĐIỀU 2: GIÁ TRỊ HỢP ĐỒNG</h3>
      <div className="mt-3 space-y-2">
        <p>
          Giá trị của hợp đồng là:{' '}
          <span className="font-bold text-slate-950">{formatCurrency(totalAmount) || 'Giá trị hợp đồng'} VNĐ {quote.has_vat === false ? '(Chưa bao gồm VAT)' : '(Đã bao gồm VAT)'}</span>
        </p>
        <p className="italic">(Bằng chữ: {totalWords || 'Số tiền bằng chữ'} ./. )</p>
        <p>Phương thức thanh toán: Việc thanh toán Hợp đồng sẽ thực hiện thành 02 lần:</p>
        <p>
          Lần 1: Bên A đặt cọc {depositPercent}% giá trị hợp đồng tương ứng{' '}
          <span className="font-bold text-slate-950">{formatCurrency(depositAmount) || 'Số tiền tạm ứng'} VNĐ</span>{' '}
          cho Bên B sau khi ký hợp đồng{paymentConfig.issue_invoice_on_deposit === false ? '.' : ' và trước ngày thực hiện tối thiểu 02 ngày, đồng thời bên B xuất hóa đơn cho bên A sau khi nhận được thanh toán lần 1.'}
        </p>
        <p>
          Lần 2: Bên A thanh toán nốt số tiền còn lại cho Bên B trong vòng {finalDueDays} ngày sau khi Bên B bàn giao cho Bên A đầy đủ sản phẩm & hóa đơn tài chính theo yêu cầu của Bên A.
        </p>
      </div>
    </div>
  )
}
