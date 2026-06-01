import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CheckCircle2, Send } from 'lucide-react'
import { getFeedbackSurvey, submitFeedbackSurvey } from '../hooks/useFeedback'

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

function SurveySuccess() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <section className="max-w-2xl rounded-lg border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-[28px] font-semibold text-slate-950">Cảm ơn Anh/Chị đã thực hiện khảo sát</h1>
        <p className="mt-3 text-[14px] leading-7 text-slate-600">
          Eventus chân thành cảm ơn Anh/Chị đã dành thời gian phản hồi. Ý kiến này giúp chúng tôi cải thiện và phục vụ tốt hơn trong các dự án tiếp theo.
        </p>
      </section>
    </main>
  )
}

export default function FeedbackSurveyPage() {
  const params = useSurveyParams()
  const [survey, setSurvey] = useState(null)
  const [answers, setAnswers] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

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

  function setQuestionAnswer(questionId, answerId, checked, single = false) {
    setAnswers(prev => {
      if (single) return { ...prev, [questionId]: answerId ? [answerId] : [] }
      const current = new Set(prev[questionId] || [])
      if (checked) current.add(answerId)
      else current.delete(answerId)
      return { ...prev, [questionId]: [...current] }
    })
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
      })
      setDone(true)
    } catch (err) {
      setError(err?.message || 'Không lưu được khảo sát.')
    } finally {
      setSaving(false)
    }
  }

  if (done) return <SurveySuccess />

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-lg border border-slate-200 bg-white px-6 py-6 text-center shadow-sm">
          <p className="text-[12px] font-semibold uppercase text-amber-600">Eventus Production</p>
          <h1 className="mt-2 text-[28px] font-semibold text-slate-950">Khảo sát sự hài lòng của khách hàng</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[14px] leading-7 text-slate-600">
            Eventus xin cảm ơn Anh/Chị đã tin tưởng sử dụng dịch vụ. Những góp ý dưới đây sẽ giúp chúng tôi nâng cao trải nghiệm trong các dự án tiếp theo.
          </p>
        </header>

        {loading ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-white px-5 py-8 text-center text-[13px] font-semibold text-slate-400">
            Đang tải khảo sát...
          </div>
        ) : error ? (
          <div className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-[13px] font-semibold text-rose-700">
            {error}
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-4">
            {survey?.already_submitted && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] font-semibold text-blue-700">
                Job này đã có khảo sát trước đó. Eventus chỉ nhận một khảo sát cho mỗi job và loại dịch vụ.
              </div>
            )}

            {(survey?.questions || []).map((question, index) => (
              <section key={question.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-[15px] font-semibold leading-6 text-slate-950">
                  {String(index + 1).padStart(2, '0')}. {question.question}
                </h2>

                {question.star ? (
                  <div className="mt-4">
                    <div className="flex flex-wrap gap-2">
                      {question.answers.map(answer => (
                        <button
                          key={answer.id}
                          type="button"
                          onClick={() => setQuestionAnswer(question.id, answer.id, true, true)}
                          disabled={survey?.already_submitted}
                          className={`h-11 min-w-11 rounded-lg border px-3 text-[14px] font-bold ${
                            (answers[question.id] || []).includes(answer.id)
                              ? 'border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          }`}
                        >
                          {answer.answer}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-[12px] text-slate-400">
                      <span>{question.text_left}</span>
                      <span>{question.text_right}</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {question.answers.map(answer => (
                      <label key={answer.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={(answers[question.id] || []).includes(answer.id)}
                          onChange={event => setQuestionAnswer(question.id, answer.id, event.target.checked)}
                          disabled={survey?.already_submitted}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <span>{answer.answer}</span>
                      </label>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <button
              type="submit"
              disabled={saving || survey?.already_submitted}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-[14px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {survey?.already_submitted ? 'Đã gửi khảo sát' : saving ? 'Đang gửi...' : 'Gửi khảo sát'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
