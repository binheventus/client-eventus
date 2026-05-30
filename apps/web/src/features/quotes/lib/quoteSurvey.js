const SURVEY_RESPONSE_LABELS = {
  budget_fit: 'Hợp ngân sách',
  optimize_cost: 'Muốn tối ưu chi phí',
  premium_upgrade: 'Muốn gói cao cấp hơn',
}

const SURVEY_RESPONSE_TONES = {
  budget_fit: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  optimize_cost: 'border-amber-200 bg-amber-50 text-amber-700',
  premium_upgrade: 'border-sky-200 bg-sky-50 text-sky-700',
}

const SURVEY_RESPONSE_SUGGESTIONS = {
  budget_fit:
    'Dạ em thấy mình vừa duyệt gói chi phí trên web rồi ạ. Để bên em sớm chuẩn bị mọi thứ cho sự kiện, mình có cần em soạn hợp đồng trước không ạ? Nếu anh/chị sẵn sàng, em xin phép gửi thông tin chuyển khoản tạm ứng để mình kịp giữ lịch nhé.',
  optimize_cost:
    'Em nhận được yêu cầu tối ưu chi phí của mình rồi ạ. Nếu sự kiện này mình bớt 1 máy quay phụ đi thì giá sẽ giảm được [X] triệu, anh/chị thấy phương án này ổn hơn không ạ?',
  premium_upgrade:
    'Em gửi anh/chị xem thêm một số dự án phân khúc cao cấp hơn bên em từng làm cho các tập đoàn lớn để mình tham khảo về chất lượng hình ảnh ạ...',
}

export function getQuoteSurveyResponseLabel(response = {}) {
  const type = response?.response_type || ''
  return SURVEY_RESPONSE_LABELS[type] || response?.response_label || 'Đã phản hồi'
}

export function getQuoteSurveyResponseTone(response = {}) {
  return SURVEY_RESPONSE_TONES[response?.response_type] || 'border-slate-200 bg-slate-50 text-slate-600'
}

export function getQuoteSurveySuggestion(response = {}) {
  return SURVEY_RESPONSE_SUGGESTIONS[response?.response_type] || ''
}

export function hasQuoteSurveyResponse(response = {}) {
  return Boolean(response?.response_type || response?.response_label || response?.selected_tag)
}
