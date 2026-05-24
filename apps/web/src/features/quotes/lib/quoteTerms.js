import { normalizeQuoteValidityDays } from './quoteValidity'

export function getDefaultQuoteTerms(quote = {}) {
  const validityDays = normalizeQuoteValidityDays(quote.validity_days)

  return [
    `Báo giá có hiệu lực trong ${validityDays} ngày. Thời gian làm việc tiêu chuẩn tối đa 04 tiếng/buổi và 08 tiếng/ngày. Thời gian Overtime sẽ được tính phí theo thỏa thuận riêng.`,
    ...(!quote.has_vat ? ['Báo giá trên chưa bao gồm Thuế GTGT 8%.'] : []),
    'Báo giá trên chưa bao gồm chi phí mua bản quyền âm nhạc, hình ảnh nếu có.',
    'Báo giá đã bao gồm tối đa 03 lần chỉnh sửa sản phẩm hậu kỳ dựa trên format đã thống nhất.',
    'Trong vòng 05 ngày làm việc kể từ ngày bàn giao bản Demo, nếu Khách hàng không có phản hồi hoặc yêu cầu chỉnh sửa bằng văn bản, sản phẩm được coi là đã hoàn thành & tự động được nghiệm thu.',
  ]
}

export function normalizeQuoteTermsText(value = '') {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .join('\n')
}

export function splitQuoteTermsText(value = '') {
  return normalizeQuoteTermsText(value).split('\n').filter(Boolean)
}

export function formatQuoteTermsText(terms = []) {
  return terms.map(term => String(term || '').trim()).filter(Boolean).join('\n')
}

export function getDefaultQuoteTermsText(quote = {}) {
  return formatQuoteTermsText(getDefaultQuoteTerms(quote))
}

export function getQuoteTerms(quote = {}) {
  const customTerms = splitQuoteTermsText(quote.terms_text)
  return customTerms.length ? customTerms : getDefaultQuoteTerms(quote)
}
