import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { getFeedbackSurvey, submitFeedbackSurvey } from '../hooks/useFeedback'

const DEFAULT_COPY = {
  title: 'Chia sẻ trải nghiệm của Anh/Chị cùng Eventus',
  description: 'Cảm ơn anh/chị đã tin tưởng lựa chọn Eventus. Khảo sát này chỉ mất khoảng 2 phút để hoàn\u00a0thành. Những chia sẻ của anh/chị sẽ giúp chúng tôi tiếp tục nâng cao chất lượng dịch vụ và mang đến trải nghiệm tốt hơn trong các dự án sắp tới.',
  thank_you: 'Cảm ơn anh/chị đã dành thời gian chia sẻ ý kiến.\nMỗi phản hồi đều là nguồn thông tin quý giá giúp Eventus Production không ngừng hoàn thiện chất lượng dịch vụ và mang đến những trải nghiệm tốt hơn trong tương lai.\nChúng tôi trân trọng sự đồng hành và tin tưởng của anh/chị. Hẹn gặp lại trong những dự án tiếp theo!',
}

function useSurveyParams() {
  const location = useLocation()
  return useMemo(() => {
    const params = new URLSearchParams(location.search)
    return {
      jobId: params.get('job') || params.get('job_id') || '',
      type: params.get('type') === 'image' ? 'image' : 'video',
    }
  }, [location.search])
}

function formatQuestionNumber(value) {
  return String(value).padStart(2, '0')
}

function getQuestionKind(question = {}) {
  const choiceAnswers = (question.answers || []).filter(answer => !answer.is_star)
  const isFreeText = question.star === null && choiceAnswers.length === 1 && choiceAnswers[0]?.answer === '__free_text__'
  return {
    choiceAnswers: isFreeText ? [] : choiceAnswers.filter(answer => String(answer.answer || '').trim()),
    isFreeText,
    ratingAnswers: (question.answers || [])
      .filter(answer => answer.is_star && String(answer.answer ?? '') !== '')
      .sort((a, b) => Number(a.answer) - Number(b.answer)),
  }
}

function SurveySuccess({ copy = DEFAULT_COPY }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f5f8] px-3 py-7 font-['Montserrat','Segoe_UI',system-ui,sans-serif] text-[#333]">
      <section className="relative w-full max-w-[620px] overflow-hidden rounded-2xl border border-[#e5e9f1] bg-[linear-gradient(135deg,rgba(255,247,237,0.92),rgba(255,255,255,0.96)_46%,rgba(232,246,242,0.92))] px-5 py-7 text-center shadow-[0_18px_46px_rgba(31,45,61,0.1)] sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute right-0 top-0 h-full w-[42%] bg-[repeating-linear-gradient(135deg,rgba(247,152,32,0.08)_0_1px,transparent_1px_16px)]" />
        <div className="relative z-10 mb-6">
          <img src="/logos/logo_eventus.png" alt="Eventus Production" className="mx-auto h-auto w-[min(176px,58vw)]" />
        </div>
        <h1 className="relative z-10 text-[20px] font-bold leading-[1.28] text-[#202b3c] sm:text-[23px]">Cảm ơn Anh/Chị đã thực hiện khảo sát</h1>
        <p className="relative z-10 mx-auto mt-5 max-w-[510px] whitespace-pre-line text-[14px] leading-[1.75] text-[#4b5563]">
          {copy.thank_you || DEFAULT_COPY.thank_you}
        </p>
        <a href="https://eventusproduction.com/" className="relative z-10 mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#f79820] px-6 text-[14px] font-semibold text-white no-underline shadow-[0_10px_20px_rgba(247,152,32,0.18)] transition hover:-translate-y-px hover:bg-[#d97706] hover:text-white">
          Eventus Production
        </a>
      </section>
    </main>
  )
}

function ProgressBar({ answered, total }) {
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0

  return (
    <div className="sticky top-0 z-50 w-full border-b border-[#e8edf5] bg-white/95 px-4 py-3 shadow-[0_8px_24px_rgba(31,45,61,0.06)] backdrop-blur">
      <div className="mx-auto flex max-w-[740px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
        <div className="whitespace-nowrap text-[12px] font-extrabold leading-tight text-[#202b3c]">Câu {answered} / {total}</div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-[#edf1f6] sm:w-[min(520px,58vw)]">
          <div className="h-full rounded-full bg-[#f79820] transition-[width] duration-200" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  )
}

function SurveyHero({ copy, totalQuestions }) {
  return (
    <section className="relative mb-12 overflow-hidden rounded-lg border border-[#e5e9f1] bg-[linear-gradient(135deg,rgba(255,247,237,0.92),rgba(255,255,255,0.96)_46%,rgba(232,246,242,0.92))] p-[18px] shadow-[0_12px_32px_rgba(31,45,61,0.07)] sm:p-[26px]">
      <div className="pointer-events-none absolute right-0 top-0 h-full w-[38%] bg-[repeating-linear-gradient(135deg,rgba(247,152,32,0.08)_0_1px,transparent_1px_16px)]" />
      <div className="relative z-10 mb-[18px] flex items-start">
        <img src="/logos/logo_eventus.png" alt="Eventus Production" className="h-auto w-[min(184px,54vw)]" />
      </div>
      <div className="relative z-10">
        <h1 className="mb-4 text-[22px] font-bold leading-[1.25] text-[#202b3c] sm:text-[26px]">{copy.title}</h1>
        <p className="mb-3 text-[13px] font-bold leading-[1.6] text-[#f79820]">Hơn 2000 khách hàng đã giúp Eventus cải thiện dịch vụ thông qua những phản hồi như thế này.</p>
        <p className="w-full whitespace-pre-line text-justify text-[15px] leading-[1.6] text-[#666]">{copy.description}</p>
      </div>
      <div className="relative z-10 mt-[18px] flex flex-wrap items-center gap-2 sm:flex-nowrap">
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/[0.03] px-3 py-1.5 text-[13px] font-medium leading-[1.3] text-[#334155] sm:whitespace-nowrap"><span className="text-[11px]">⏱</span> 2 phút</span>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-black/[0.03] px-3 py-1.5 text-[13px] font-medium leading-[1.3] text-[#334155] sm:whitespace-nowrap"><span className="text-[11px]">💬</span> {totalQuestions} câu hỏi</span>
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-black/[0.03] px-3 py-1.5 text-[13px] font-medium leading-[1.3] text-[#334155] sm:whitespace-nowrap"><span className="text-[11px]">❤️</span> 100% phản hồi được đọc bởi đội ngũ quản lý Eventus</span>
      </div>
    </section>
  )
}

function SectionDivider({ children }) {
  return (
    <div className="my-2 grid grid-cols-[minmax(24px,1fr)_auto_minmax(24px,1fr)] items-center gap-1.5 sm:grid-cols-[minmax(32px,1fr)_auto_minmax(32px,1fr)] sm:gap-2">
      <span className="h-px bg-[linear-gradient(90deg,transparent,#d8dee8,transparent)]" />
      <h2 className="m-0 text-[13px] font-medium leading-tight text-[#243142] sm:text-[14px]">{children}</h2>
      <span className="h-px bg-[linear-gradient(90deg,transparent,#d8dee8,transparent)]" />
    </div>
  )
}

function RatingQuestion({ question, selectedAnswer, disabled, onSelect }) {
  const { ratingAnswers } = getQuestionKind(question)
  const ratingMax = Math.max(1, ...ratingAnswers.map(answer => Number(answer.answer) || 0))

  return (
    <>
      <div className="mt-0.5 grid grid-cols-[22px_minmax(0,1fr)_22px] items-center gap-1 sm:grid-cols-[34px_minmax(0,1fr)_34px] sm:gap-2">
        <span className="inline-flex h-[34px] w-[22px] items-center justify-center rounded-md bg-white text-[16px] shadow-[inset_0_0_0_1px_#e6ebf2] sm:h-11 sm:w-[34px] sm:text-[20px]">😞</span>
        <div className="grid grid-cols-[repeat(11,minmax(0,1fr))] gap-[3px] sm:grid-cols-[repeat(auto-fit,minmax(38px,1fr))] sm:gap-1.5" role="radiogroup" aria-label={question.question}>
          {ratingAnswers.map(answer => {
            const value = Number(answer.answer) || 0
            const selected = selectedAnswer === answer.id
            return (
              <button
                key={answer.id}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(question.id, answer.id)}
                className={`inline-flex min-h-[34px] min-w-0 items-center justify-center rounded-md border p-0 text-[11px] font-extrabold leading-none transition sm:min-h-[42px] sm:rounded-lg sm:text-[14px] ${
                  selected
                    ? 'scale-105 border-[#f79820] bg-[#f79820] text-white shadow-[0_8px_18px_rgba(247,152,32,0.18)]'
                    : 'border-[#dee2e6] bg-white text-[#495057] hover:border-[#f79820]/40 hover:text-[#343a40] hover:shadow-[0_6px_14px_rgba(31,45,61,0.08)]'
                } disabled:cursor-not-allowed disabled:opacity-60`}
                aria-pressed={selected}
                style={{ '--rating-percent': `${Math.round((value / ratingMax) * 100)}%` }}
              >
                {answer.answer}
              </button>
            )
          })}
        </div>
        <span className="inline-flex h-[34px] w-[22px] items-center justify-center rounded-md bg-white text-[16px] shadow-[inset_0_0_0_1px_#e6ebf2] sm:h-11 sm:w-[34px] sm:text-[20px]">😍</span>
      </div>
      <div className="mt-3 flex justify-between gap-[18px] text-[12px] font-bold leading-[1.35] text-[#667085]">
        <span>{question.text_left}</span>
        <span className="text-right">{question.text_right}</span>
      </div>
    </>
  )
}

function ChoiceQuestion({ question, selectedAnswers = [], disabled, onChange }) {
  const { choiceAnswers } = getQuestionKind(question)

  return (
    <div className="grid gap-[9px] sm:grid-cols-2">
      {choiceAnswers.map(answer => {
        const checked = selectedAnswers.includes(answer.id)
        return (
          <label key={answer.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-[#e6ebf2] bg-[#fbfcfe] px-3 py-2.5 text-[13px] font-semibold leading-[1.35] text-[#4d5b70] transition hover:border-[#ffd8a8] hover:bg-[#fff7ed] hover:text-[#f79820]">
            <input
              type="checkbox"
              checked={checked}
              onChange={event => onChange(question.id, answer.id, event.target.checked)}
              disabled={disabled}
              className="h-5 w-5 shrink-0 appearance-none rounded-md border border-[#ffd8a8] bg-white checked:border-[#f79820] checked:bg-[#f79820] checked:shadow-[0_0_0_3px_rgba(247,152,32,0.12)] disabled:cursor-not-allowed"
            />
            <span>{answer.answer}</span>
          </label>
        )
      })}
    </div>
  )
}

function FreeTextQuestion({ question, value = '', disabled, onChange }) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight + 2}px`
  }, [value])

  return (
    <textarea
      ref={textareaRef}
      value={value}
      disabled={disabled}
      onChange={event => onChange(question.id, event.target.value)}
      rows={3}
      placeholder={question.text_left || 'Anh/chị chia sẻ thêm tại đây...'}
      className="block min-h-[92px] w-full resize-y overflow-hidden rounded-lg border border-[#d9e1ec] bg-[#fbfcfe] px-3.5 py-3 text-[14px] font-medium leading-[1.55] text-[#253044] outline-none transition placeholder:text-[#8a96a8] focus:border-[#f79820] focus:bg-white focus:shadow-[0_0_0_3px_rgba(247,152,32,0.12)] disabled:cursor-not-allowed disabled:opacity-60"
    />
  )
}

export default function FeedbackSurveyPage() {
  const params = useSurveyParams()
  const savedStatusTimerRef = useRef({})
  const [survey, setSurvey] = useState(null)
  const [answers, setAnswers] = useState({})
  const [freeText, setFreeText] = useState({})
  const [savedStatus, setSavedStatus] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const copy = { ...DEFAULT_COPY, ...(survey?.copy || {}) }
  const questions = survey?.questions || []
  const answeredCount = questions.filter(question => {
    const { isFreeText } = getQuestionKind(question)
    if (isFreeText) return Boolean(String(freeText[question.id] || '').trim())
    return (answers[question.id] || []).length > 0
  }).length

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const result = await getFeedbackSurvey(params)
        if (!cancelled) setSurvey(result)
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Không tải được khảo sát.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [params.jobId, params.type])

  useEffect(() => () => {
    Object.values(savedStatusTimerRef.current).forEach(timer => window.clearTimeout(timer))
  }, [])

  function showSavedStatus(questionId) {
    setSavedStatus(prev => ({ ...prev, [questionId]: true }))
    window.clearTimeout(savedStatusTimerRef.current[questionId])
    savedStatusTimerRef.current[questionId] = window.setTimeout(() => {
      setSavedStatus(prev => ({ ...prev, [questionId]: false }))
    }, 1000)
  }

  function selectRating(questionId, answerId) {
    setAnswers(prev => ({ ...prev, [questionId]: answerId ? [answerId] : [] }))
    showSavedStatus(questionId)
  }

  function setChoiceAnswer(questionId, answerId, checked) {
    setAnswers(prev => {
      const current = new Set(prev[questionId] || [])
      if (checked) current.add(answerId)
      else current.delete(answerId)
      return { ...prev, [questionId]: [...current] }
    })
    showSavedStatus(questionId)
  }

  function setFreeTextAnswer(questionId, value) {
    setFreeText(prev => ({ ...prev, [questionId]: value }))
    showSavedStatus(questionId)
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await submitFeedbackSurvey({
        job: params.jobId,
        type: params.type,
        answers,
        free_text: freeText,
      })
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Không lưu được khảo sát.')
    } finally {
      setSaving(false)
    }
  }

  if (done) return <SurveySuccess copy={copy} />

  return (
    <main className="min-h-screen bg-[#f4f5f8] px-2.5 pb-8 font-['Montserrat','Segoe_UI',system-ui,sans-serif] text-[#333] sm:px-3 sm:pb-10">
      <ProgressBar answered={answeredCount} total={questions.length} />
      <div className="mx-auto mt-4 max-w-[740px] sm:mt-7">
        <SurveyHero copy={copy} totalQuestions={questions.length || 7} />

        {loading ? (
          <div className="rounded-2xl border border-[#ececec] bg-white px-5 py-8 text-center text-[13px] font-semibold text-[#7a8597] shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
            Đang tải khảo sát...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-0">
            {survey?.already_submitted && (
              <div className="mb-4 rounded-xl border border-[#dbeafe] bg-[linear-gradient(135deg,rgba(255,247,237,0.92),rgba(255,255,255,0.96)_46%,rgba(232,246,242,0.92))] px-4 py-3 text-[13px] font-semibold italic leading-[1.55] text-[#43556e]">
                Job này đã có khảo sát trước đó. Eventus chỉ nhận một khảo sát cho mỗi job và loại dịch vụ.
              </div>
            )}

            {questions.map((question, index) => {
              const { isFreeText, choiceAnswers, ratingAnswers } = getQuestionKind(question)
              const isScoreSection = index < 3

              return (
                <div key={question.id}>
                  {index === 0 && <SectionDivider>Đánh giá tổng quan</SectionDivider>}
                  {index === 3 && (
                    <>
                      <div className="mb-1.5 rounded-xl border border-[#dbeafe] bg-[linear-gradient(135deg,rgba(255,247,237,0.92),rgba(255,255,255,0.96)_46%,rgba(232,246,242,0.92))] px-4 py-3.5 text-[13px] font-semibold italic leading-[1.55] text-[#43556e]">
                        Cảm ơn Anh/Chị đã hoàn thành phần đánh giá tổng quan. Các câu hỏi tiếp theo là không bắt buộc, nhưng những chia sẻ chi tiết của Anh/Chị đều rất quý giá đối với đội ngũ Eventus.
                      </div>
                      <SectionDivider>Chia sẻ chi tiết</SectionDivider>
                    </>
                  )}

                  <fieldset className={`relative mb-5 rounded-2xl border border-[#ececec] bg-white px-[18px] pb-6 pt-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] sm:px-8 ${isScoreSection ? 'sm:pb-5' : 'sm:pb-6'}`}>
                    <div className="mb-[15px] grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3 text-[14px] font-normal leading-[1.45] text-[#202b3c] sm:text-[16px]">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#f3f4f6] text-[13px] font-bold text-[#6b7280]">{formatQuestionNumber(index + 1)}</span>
                      <span>{question.question}</span>
                    </div>

                    {ratingAnswers.length > 0 ? (
                      <RatingQuestion
                        question={question}
                        selectedAnswer={(answers[question.id] || [])[0] || ''}
                        disabled={saving || survey?.already_submitted}
                        onSelect={selectRating}
                      />
                    ) : isFreeText ? (
                      <FreeTextQuestion
                        question={question}
                        value={freeText[question.id] || ''}
                        disabled={saving || survey?.already_submitted}
                        onChange={setFreeTextAnswer}
                      />
                    ) : choiceAnswers.length > 0 ? (
                      <ChoiceQuestion
                        question={question}
                        selectedAnswers={answers[question.id] || []}
                        disabled={saving || survey?.already_submitted}
                        onChange={setChoiceAnswer}
                      />
                    ) : null}

                    <div className={`absolute bottom-1 right-8 text-[11px] font-medium leading-[18px] text-[#f79820] transition ${savedStatus[question.id] ? 'translate-y-0 opacity-100' : '-translate-y-0.5 opacity-0'}`}>
                      ✓ Đã ghi nhận
                    </div>
                  </fieldset>
                </div>
              )
            })}

            <div className="mt-1">
              <button
                type="submit"
                disabled={saving || survey?.already_submitted}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-lg border-0 bg-[#f79820] px-4 text-center text-[14px] font-extrabold leading-tight text-white shadow-[0_12px_24px_rgba(247,152,32,0.18)] transition hover:-translate-y-px hover:bg-[#d97706] hover:shadow-[0_16px_30px_rgba(247,152,32,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {survey?.already_submitted ? 'Đã gửi khảo sát' : saving ? 'Đang gửi...' : 'Gửi phản hồi tới Eventus'}
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  )
}
