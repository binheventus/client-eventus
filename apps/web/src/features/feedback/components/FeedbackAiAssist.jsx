import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Copy, HelpCircle, RefreshCw, Sparkles, X } from 'lucide-react'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'
import { formatTimeline } from '../lib/feedbackFormat'
import {
  probeFeedbackAi,
  rewriteFeedbackReply,
  summarizeFeedbackComments,
} from '../hooks/useFeedbackAi'

const MIN_UNRESOLVED_COMMENTS = 6

const CATEGORY_META = {
  audio: { emoji: '🎵', label: 'Âm thanh' },
  color: { emoji: '🎨', label: 'Màu' },
  cut: { emoji: '✂️', label: 'Cắt dựng' },
  text: { emoji: '🔤', label: 'Chữ' },
  branding: { emoji: '🏷️', label: 'Branding' },
  content: { emoji: '📝', label: 'Nội dung' },
  other: { emoji: '📌', label: 'Khác' },
}

const TONE_OPTIONS = [
  { value: 'ngắn gọn hơn', label: 'Ngắn gọn hơn' },
  { value: 'thân thiện hơn', label: 'Thân thiện hơn' },
  { value: 'trang trọng hơn', label: 'Trang trọng hơn' },
]

function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.other
}

export default function FeedbackAiAssist({ open = false, onClose, feedback, comments = [], access = {}, onSeek }) {
  const feedbackId = feedback?.share_token || feedback?.id || ''

  const [aiProbe, setAiProbe] = useState({ checked: false, available: false })
  const [summaryState, setSummaryState] = useState({ loading: false, error: '', data: null })
  const [rawText, setRawText] = useState('')
  const [rewriteContext, setRewriteContext] = useState('')
  const [rewriteState, setRewriteState] = useState({ loading: false, error: '', replies: [], unavailable: false })
  const [copiedIndex, setCopiedIndex] = useState(-1)
  const rewriteRef = useRef(null)

  const unresolvedCount = useMemo(
    () => (Array.isArray(comments) ? comments.filter(comment => !comment?.is_done_1).length : 0),
    [comments],
  )

  const commentTimeById = useMemo(() => {
    const map = new Map()
    ;(Array.isArray(comments) ? comments : []).forEach(comment => {
      const seconds = Number(comment?.time_comment_1)
      map.set(String(comment?.id), Number.isFinite(seconds) ? seconds : null)
    })
    return map
  }, [comments])

  useEscapeToClose(onClose, open)

  // Probe khả dụng một lần khi mount (không gọi mô hình).
  useEffect(() => {
    let active = true
    probeFeedbackAi().then(result => {
      if (active) setAiProbe({ checked: true, available: Boolean(result?.ai_available) })
    })
    return () => { active = false }
  }, [])

  const runSummary = useCallback(async () => {
    if (!feedbackId) return
    setSummaryState({ loading: true, error: '', data: null })
    try {
      const result = await summarizeFeedbackComments(feedbackId, access)
      if (result?.source === 'ai') {
        setSummaryState({ loading: false, error: '', data: result })
      } else {
        setSummaryState({ loading: false, error: 'Trợ lý AI hiện không khả dụng. Hãy thử lại sau.', data: null })
      }
    } catch (error) {
      setSummaryState({ loading: false, error: error?.message || 'Không tóm tắt được.', data: null })
    }
  }, [feedbackId, access])

  const eligible = aiProbe.available && unresolvedCount >= MIN_UNRESOLVED_COMMENTS

  // Tự tóm tắt khi mở panel đủ điều kiện (đây là hành động chủ động của Editor khi bấm trigger).
  useEffect(() => {
    if (open && eligible && !summaryState.data && !summaryState.loading && !summaryState.error) {
      runSummary()
    }
  }, [open, eligible, summaryState.data, summaryState.loading, summaryState.error, runSummary])

  // AI không khả dụng → trigger không làm gì (degrade an toàn, coi như ẩn).
  if (!open || (aiProbe.checked && !aiProbe.available)) return null

  function seekToSeconds(seconds) {
    if (Number.isFinite(seconds) && typeof onSeek === 'function') onSeek(seconds)
  }

  function getItemTimecodes(item) {
    const direct = (Array.isArray(item?.timecodes) ? item.timecodes : []).filter(value => Number.isFinite(Number(value)))
    if (direct.length) return direct.map(Number)
    return (Array.isArray(item?.comment_ids) ? item.comment_ids : [])
      .map(id => commentTimeById.get(String(id)))
      .filter(value => Number.isFinite(value))
  }

  function startRewriteForTask(task) {
    setRewriteContext(task || '')
    setRewriteState({ loading: false, error: '', replies: [], unavailable: false })
    if (rewriteRef.current) {
      rewriteRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
      rewriteRef.current.focus()
    }
  }

  async function runRewrite(tone = '') {
    const text = rawText.trim()
    if (!text) return
    setRewriteState(prev => ({ ...prev, loading: true, error: '', unavailable: false }))
    try {
      const result = await rewriteFeedbackReply(feedbackId, { rawText: text, context: rewriteContext, tone }, access)
      if (result?.source === 'ai' && Array.isArray(result.replies) && result.replies.length) {
        setRewriteState({ loading: false, error: '', replies: result.replies, unavailable: false })
      } else {
        setRewriteState({ loading: false, error: '', replies: [], unavailable: true })
      }
    } catch (error) {
      setRewriteState({ loading: false, error: error?.message || 'Không viết lại được.', replies: [], unavailable: false })
    }
  }

  async function copyReply(text, index) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIndex(index)
      window.setTimeout(() => setCopiedIndex(current => (current === index ? -1 : current)), 1500)
    } catch {
      /* clipboard không khả dụng — bỏ qua */
    }
  }

  const summary = summaryState.data

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-slate-950/50 px-4 py-6">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-ai-title"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#f79820]" />
            <h2 id="feedback-ai-title" className="text-sm font-semibold text-slate-800">Tóm tắt Feedback bằng AI</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng trợ lý AI"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-slate-700">
          {!eligible ? (
            <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-500">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <span>
                {`Chỉ có ${unresolvedCount} góp ý thì chưa bõ công AI trổ tài phân tích rồi. Bạn đọc qua một chút là xong ngay, khi nào nhiều hơn 5 dòng feedback hãy gọi mình nhé!`}
              </span>
            </div>
          ) : (
            <>
              <section className="mb-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tóm tắt việc cần sửa</h3>
                  <button
                    type="button"
                    onClick={runSummary}
                    disabled={summaryState.loading}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-500 transition hover:border-[#f79820]/40 hover:text-[#f79820] disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3 w-3 ${summaryState.loading ? 'animate-spin' : ''}`} />
                    Tóm tắt lại
                  </button>
                </div>

                {summaryState.loading && <p className="text-[13px] text-slate-400">Đang tóm tắt các góp ý…</p>}
                {summaryState.error && !summaryState.loading && (
                  <p className="flex items-center gap-1.5 text-[13px] text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> {summaryState.error}
                  </p>
                )}

                {summary && !summaryState.loading && (
                  <div className="space-y-3">
                    {summary.summary && (
                      <p className="rounded-lg bg-[#f79820]/5 px-3 py-2 text-[13px] text-slate-700">
                        {summary.summary}
                        <span className="ml-1 font-semibold text-[#f79820]">· {summary.task_count} việc</span>
                      </p>
                    )}

                    {summary.groups?.map((group, groupIndex) => {
                      const meta = getCategoryMeta(group.category)
                      return (
                        <div key={`${group.category}-${groupIndex}`} className="rounded-lg border border-slate-100">
                          <div className="border-b border-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600">
                            <span className="mr-1">{meta.emoji}</span>{group.label || meta.label}
                          </div>
                          <ul className="divide-y divide-slate-50">
                            {group.items?.map((item, itemIndex) => {
                              const timecodes = getItemTimecodes(item)
                              return (
                                <li key={itemIndex} className="px-3 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-[13px] text-slate-700">{item.task}</span>
                                    <button
                                      type="button"
                                      onClick={() => startRewriteForTask(item.task)}
                                      className="shrink-0 rounded text-[11px] font-medium text-slate-400 transition hover:text-[#f79820]"
                                    >
                                      Soạn lời nhắn
                                    </button>
                                  </div>
                                  {timecodes.length > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {timecodes.map((seconds, idx) => (
                                        <button
                                          key={idx}
                                          type="button"
                                          onClick={() => seekToSeconds(Number(seconds))}
                                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition hover:bg-[#f79820]/15 hover:text-[#f79820]"
                                        >
                                          {formatTimeline(Number(seconds))}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )
                    })}

                    {summary.conflicts?.length > 0 && (
                      <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                        <h4 className="mb-1 text-[12px] font-semibold text-amber-700">⚠️ Mâu thuẫn / trùng lặp</h4>
                        <ul className="space-y-1">
                          {summary.conflicts.map((conflict, index) => (
                            <li key={index} className="text-[13px] text-amber-800">
                              {conflict.description}
                              {conflict.comment_ids?.length > 0 && (
                                <span className="ml-1 text-[11px] text-amber-500">[{conflict.comment_ids.join(', ')}]</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {summary.unclear?.length > 0 && (
                      <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <h4 className="mb-1 text-[12px] font-semibold text-slate-500">❓ Chưa rõ</h4>
                        <ul className="space-y-1">
                          {summary.unclear.map((item, index) => (
                            <li key={index} className="text-[13px] text-slate-600">
                              {Number.isFinite(Number(item.timecode)) && (
                                <button
                                  type="button"
                                  onClick={() => seekToSeconds(Number(item.timecode))}
                                  className="mr-1 rounded bg-slate-100 px-1 py-0.5 text-[11px] font-medium text-slate-500 transition hover:text-[#f79820]"
                                >
                                  {formatTimeline(Number(item.timecode))}
                                </button>
                              )}
                              <span className="italic">“{item.original}”</span>
                              {item.why && <span className="text-slate-400"> — {item.why}</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </section>

              <section ref={rewriteRef} tabIndex={-1} className="border-t border-slate-100 pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">AI viết lại lời nhắn</h3>
                {rewriteContext && (
                  <div className="mb-2 flex items-center gap-1 text-[11px] text-slate-500">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5">Ngữ cảnh: {rewriteContext}</span>
                    <button type="button" onClick={() => setRewriteContext('')} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                )}
                <textarea
                  value={rawText}
                  onChange={event => setRawText(event.target.value)}
                  rows={3}
                  placeholder="Gõ lý do thô (ví dụ: không làm nét logo được vì file gốc phân giải thấp)…"
                  className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 focus:border-[#f79820]/50 focus:outline-none focus:ring-1 focus:ring-[#f79820]/30"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => runRewrite('')}
                    disabled={!rawText.trim() || rewriteState.loading}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#f79820] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#e0851a] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {rewriteState.loading ? 'Đang viết…' : 'Viết lại bằng AI'}
                  </button>
                </div>

                {rewriteState.error && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-amber-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> {rewriteState.error}
                  </p>
                )}
                {rewriteState.unavailable && (
                  <p className="mt-2 text-[12px] text-slate-400">Trợ lý AI hiện không khả dụng. Hãy thử lại sau.</p>
                )}

                {rewriteState.replies.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {rewriteState.replies.map((reply, index) => (
                      <div key={index} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                        <p className="whitespace-pre-wrap text-[13px] text-slate-700">{reply}</p>
                        <button
                          type="button"
                          onClick={() => copyReply(reply, index)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 transition hover:text-[#f79820]"
                        >
                          <Copy className="h-3 w-3" />
                          {copiedIndex === index ? 'Đã copy' : 'Copy'}
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-400">Đổi cách nói:</span>
                      {TONE_OPTIONS.map(tone => (
                        <button
                          key={tone.value}
                          type="button"
                          onClick={() => runRewrite(tone.value)}
                          disabled={rewriteState.loading}
                          className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-500 transition hover:border-[#f79820]/40 hover:text-[#f79820] disabled:opacity-50"
                        >
                          {tone.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
