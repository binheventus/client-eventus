import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { submitQuoteSurveyResponse } from '../hooks/useQuotes'
import './QuoteMicroSurvey.css'

const SURVEY_TEXT = {
  introTitle: 'Báo giá này có đang vừa vặn với ngân sách dự kiến của bạn không?',
  positiveEnd:
    'Rất vui vì gói chi phí này phù hợp với bạn. Account của chúng tôi sẽ liên hệ lại qua Zalo để chúng ta bắt đầu triển khai các bước tiếp theo.',
  optimizeQuestion:
    "Không sao cả, ngân sách luôn có thể 'may đo' lại. Bạn muốn Eventus giảm bớt nhân sự/thiết bị để hạ chi phí không?",
  optimizeEnd:
    'Cảm ơn bạn đã chia sẻ. Eventus đã nắm được mong muốn tối ưu ngân sách của bạn. Account sẽ nhắn tin qua Zalo để tư vấn phương án chỉnh sửa vừa vặn nhất với bạn nhé.',
  premiumEnd:
    'Dự án của bạn chắc chắn cần những tiêu chuẩn khắt khe hơn. Chúng tôi rất hào hứng với các dự án đòi hỏi sản phẩm có tính thẩm mỹ và nghệ thuật cao. Gói giải pháp cao cấp hơn sẽ được Account của chúng tôi gửi đến bạn qua luồng chat Zalo nhé.',
}

const INITIAL_OPTIONS = [
  {
    key: 'fit',
    label: 'Khá hợp lý, tôi cần tư vấn thêm',
    nextView: 'positiveEnd',
    responseType: 'budget_fit',
  },
  {
    key: 'optimize',
    label: 'Giá hơi cao, tôi muốn tối ưu chi phí',
    nextView: 'optimize',
  },
  {
    key: 'premium',
    label: 'Thấp hơn dự kiến, tôi cần gói cao cấp hơn',
    nextView: 'premiumEnd',
    responseType: 'premium_upgrade',
  },
]

const OPTIMIZE_TAGS = [
  'Giảm bớt số lượng máy quay / máy chụp',
  'Giảm thời gian ekip làm việc tại hiện trường (Ví dụ: chỉ quay nửa ngày thay vì cả ngày).',
  'Tôi chưa biết nên bớt phần nào, cần Account tư vấn xem bớt phần nào thì hợp lý.',
]

export default function QuoteMicroSurvey({ quote = {} }) {
  const [view, setView] = useState('intro')
  const [viewHistory, setViewHistory] = useState([])

  function goToView(nextView) {
    setViewHistory(prev => [...prev, view])
    setView(nextView)
  }

  function goBack() {
    setViewHistory(prev => {
      const nextHistory = prev.slice(0, -1)
      setView(prev[prev.length - 1] || 'intro')
      return nextHistory
    })
  }

  const canGoBack = viewHistory.length > 0

  function recordSurveyResponse({ responseType, responseLabel, selectedTag = '' }) {
    if (!quote?.share_token || !responseType) return

    submitQuoteSurveyResponse({
      share_token: quote.share_token,
      response_type: responseType,
      response_label: responseLabel,
      selected_tag: selectedTag,
    }).catch(error => {
      console.warn('Không lưu được phản hồi survey.', error)
    })
  }

  function selectInitialOption(option) {
    goToView(option.nextView)
    if (option.responseType) {
      recordSurveyResponse({
        responseType: option.responseType,
        responseLabel: option.label,
      })
    }
  }

  function selectOptimizeTag(tag) {
    goToView('optimizeEnd')
    recordSurveyResponse({
      responseType: 'optimize_cost',
      responseLabel: 'Giá hơi cao, tôi muốn tối ưu chi phí',
      selectedTag: tag,
    })
  }

  return (
    <section className="quote-micro-survey" aria-live="polite">
      {view === 'intro' ? (
        <div className="quote-micro-survey__panel">
          <h2 className="quote-micro-survey__title">{SURVEY_TEXT.introTitle}</h2>
          <div className="quote-micro-survey__actions" role="group" aria-label={SURVEY_TEXT.introTitle}>
            {INITIAL_OPTIONS.map(option => (
              <button
                key={option.key}
                type="button"
                className="quote-micro-survey__button"
                onClick={() => selectInitialOption(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === 'optimize' ? (
        <div className="quote-micro-survey__panel quote-micro-survey__panel--soft">
          <SurveyBackButton onClick={goBack} show={canGoBack} />
          <h2 className="quote-micro-survey__title">{SURVEY_TEXT.optimizeQuestion}</h2>
          <div className="quote-micro-survey__tags" role="group" aria-label="Chọn phương án tối ưu chi phí">
            {OPTIMIZE_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                className="quote-micro-survey__tag"
                onClick={() => selectOptimizeTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === 'positiveEnd' ? <SurveyMessage onBack={goBack} showBack={canGoBack}>{SURVEY_TEXT.positiveEnd}</SurveyMessage> : null}
      {view === 'optimizeEnd' ? <SurveyMessage onBack={goBack} showBack={canGoBack}>{SURVEY_TEXT.optimizeEnd}</SurveyMessage> : null}
      {view === 'premiumEnd' ? <SurveyMessage onBack={goBack} showBack={canGoBack}>{SURVEY_TEXT.premiumEnd}</SurveyMessage> : null}
    </section>
  )
}

function SurveyMessage({ children, onBack, showBack }) {
  return (
    <div className="quote-micro-survey__panel quote-micro-survey__message">
      <SurveyBackButton onClick={onBack} show={showBack} />
      <p>{children}</p>
    </div>
  )
}

function SurveyBackButton({ onClick, show }) {
  if (!show) return null

  return (
    <button type="button" className="quote-micro-survey__back" onClick={onClick} aria-label="Quay lại câu hỏi trước">
      <ArrowLeft aria-hidden="true" size={14} strokeWidth={2.2} />
      <span>Quay lại</span>
    </button>
  )
}
