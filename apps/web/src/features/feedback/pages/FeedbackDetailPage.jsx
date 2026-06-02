import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Film,
  FileUp,
  Plus,
  Save,
  SendHorizontal,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import {
  createFeedback,
  createFeedbackComment,
  deleteFeedback,
  deleteFeedbackAttachment,
  deleteFeedbackComment,
  getFeedbackDetail,
  markFeedbackDone,
  saveFeedbackSetup,
  updateFeedbackComment,
  updateOverallFeedback,
  uploadFeedbackAttachment,
} from '../hooks/useFeedback'
import {
  buildDefaultFeedbackName,
  formatFeedbackDateTime,
  formatTimeline,
  getFeedbackAccessFromSearch,
  getFeedbackPublicPath,
  getFeedbackVideoEmbedUrl,
  parseTimeToSeconds,
  readFileAsDataUrl,
} from '../lib/feedbackFormat'
import { useEscapeToClose } from '../../../hooks/useEscapeToClose'

function Alert({ type = 'info', children, className = '' }) {
  const styles = type === 'error'
    ? 'border-[#f79820]/30 bg-[#f79820]/10 text-[#b86414]'
    : type === 'success'
      ? 'border-[#f79820]/30 bg-[#f79820]/10 text-[#f79820]'
      : 'border-[#f79820]/30 bg-[#f79820]/10 text-[#f79820]'

  return <div className={`rounded-lg border px-4 py-3 text-[13px] font-semibold ${styles} ${className}`}>{children}</div>
}

function FieldLabel({ children }) {
  return <label className="text-[12px] font-semibold uppercase text-slate-500">{children}</label>
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-[#f79820] focus:ring-2 focus:ring-[#f79820]/20 ${props.className || ''}`}
    />
  )
}

function SetupPanel({ detail, access, onSaved }) {
  const feedback = detail.feedback
  const employees = detail.employees || []
  const existingEditorName = feedback.editor_name || feedback.job?.editor_name || ''
  const [feedbackName, setFeedbackName] = useState(feedback.name || '')
  const [editorId, setEditorId] = useState('')
  const [videoUrl, setVideoUrl] = useState(feedback.video_url || '')
  const [driveUrl, setDriveUrl] = useState(feedback.drive_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setFeedbackName(feedback.name || '')
    setVideoUrl(feedback.video_url || '')
    setDriveUrl(feedback.drive_url || '')
  }, [feedback.id, feedback.name, feedback.video_url, feedback.drive_url])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const nextDetail = await saveFeedbackSetup(feedback.id, {
        name: feedbackName.trim(),
        editor_employee_id: editorId || undefined,
        video_url: videoUrl.trim(),
        drive_url: driveUrl.trim(),
      }, access)
      onSaved(nextDetail)
    } catch (err) {
      setError(err?.message || 'Không lưu được thông tin feedback.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="h-full rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 p-5">
      <div className="flex items-center">
        <h2 className="text-[12px] font-semibold uppercase text-slate-950">Thêm bản feedback mới</h2>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(140px,0.75fr)_minmax(180px,1fr)_minmax(160px,0.8fr)_auto]">
        {!existingEditorName && (
          <div className="md:col-span-2 xl:col-span-4">
            <FieldLabel>Editor</FieldLabel>
            <select
              value={editorId}
              onChange={event => setEditorId(event.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none focus:border-[#f79820] focus:ring-2 focus:ring-[#f79820]/20"
            >
              <option value="">Chọn nhân sự Editor</option>
              {employees.map(employee => (
                <option key={employee.id} value={employee.id}>{employee.zalo_name || employee.name}</option>
              ))}
            </select>
          </div>
        )}

        <div>
          <FieldLabel>Tên bản mới</FieldLabel>
          <TextInput
            value={feedbackName}
            onChange={event => setFeedbackName(event.target.value)}
            placeholder={buildDefaultFeedbackName()}
            className="mt-1"
          />
        </div>

        <div>
          <FieldLabel>Youtube URL</FieldLabel>
          <TextInput
            value={videoUrl}
            onChange={event => setVideoUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            required
            className="mt-1"
          />
        </div>

        <div>
          <FieldLabel>Link Google Drive tải file</FieldLabel>
          <TextInput
            value={driveUrl}
            onChange={event => setDriveUrl(event.target.value)}
            placeholder="Google Drive, Dropbox..."
            className="mt-1"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#f79820] px-5 text-[13px] font-semibold whitespace-nowrap text-white hover:bg-[#df861d] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Đang lưu...' : 'Lưu và vào Feedback'}
          </button>
        </div>

        {error && <div className="md:col-span-2 xl:col-span-4"><Alert type="error">{error}</Alert></div>}
      </form>
    </section>
  )
}

function AttachmentList({ attachments = [], access, onChanged }) {
  if (!attachments.length) return null

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {attachments.map(file => (
        <div key={file.id} className="flex max-w-full items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1">
          {file.file_type === 'image' && file.preview_url ? (
            <a href={file.url} target="_blank" rel="noreferrer" className="block h-6 w-8 shrink-0 overflow-hidden rounded border border-slate-200 bg-white">
              <img src={file.preview_url} alt={file.file_name} className="h-full w-full object-cover" />
            </a>
          ) : (
            <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-white text-[9px] font-bold text-slate-400">
              FILE
            </span>
          )}
          <a href={file.url} target="_blank" rel="noreferrer" className="min-w-0 max-w-[180px] truncate text-[11px] font-semibold text-[#f79820] hover:underline">
            {file.file_name}
          </a>
          <button
            type="button"
            onClick={async () => {
              await deleteFeedbackAttachment(file.id, access)
              onChanged()
            }}
            className="shrink-0 rounded px-1 text-[11px] font-semibold text-slate-400 hover:bg-[#f79820]/10 hover:text-[#f79820]"
            aria-label="Xóa file"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function InlineFeedbackField({ comment, column, access, className = '', placeholder = '' }) {
  const [value, setValue] = useState(comment[column] || '')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  function fitTextareaHeight() {
    const node = textareaRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }

  useEffect(() => {
    setValue(comment[column] || '')
  }, [comment.id, comment[column]])

  useEffect(() => {
    fitTextareaHeight()
  }, [value])

  useEffect(() => {
    if (value === (comment[column] || '')) return undefined

    const timer = window.setTimeout(async () => {
      setSaving(true)
      try {
        await updateFeedbackComment(comment.id, column, value, access)
      } finally {
        setSaving(false)
      }
    }, 700)

    return () => window.clearTimeout(timer)
  }, [access, column, comment, value])

  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={event => setValue(event.target.value)}
        placeholder={placeholder}
        rows={1}
        className={`min-h-[34px] flex-1 resize-none overflow-hidden border-0 bg-transparent p-0 text-[13px] leading-5 text-slate-900 outline-none placeholder:text-slate-400 ${className}`}
      />
      {saving && <span className="mt-1 shrink-0 text-[10px] font-semibold text-slate-400">Đang lưu</span>}
    </>
  )
}

function getTimecodeColor(comment) {
  return comment?.is_done_1 ? 'blue' : 'orange'
}

function getTimecodeButtonClass(comment) {
  return getTimecodeColor(comment) === 'blue'
    ? 'bg-blue-500 ring-blue-500 hover:bg-blue-600'
    : 'bg-[#f79820] ring-[#f79820] hover:bg-[#df861d]'
}

function getTimelineDotClass(comment) {
  return getTimecodeColor(comment) === 'blue'
    ? 'border-blue-500 bg-blue-500 shadow-blue-500/25 hover:bg-blue-600 focus:ring-blue-200'
    : 'border-[#f79820] bg-[#f79820] shadow-[#f79820]/25 hover:bg-[#df861d] focus:ring-[#f79820]/30'
}

function TimelineDotTooltip({ comment, seconds, align = 'center' }) {
  const authorName = String(comment.author_name || '').trim()
  const primaryText = String(comment.comment_1 || '').trim()
  const secondaryText = String(comment.comment_2 || '').trim()
  const image = comment.image_comment_1 || comment.image_comment_2
  const attachments = comment.attachments || []
  const alignClass = align === 'left'
    ? 'left-0 translate-x-0'
    : align === 'right'
      ? 'right-0 translate-x-0'
      : 'left-1/2 -translate-x-1/2'

  return (
    <div className={`pointer-events-none absolute bottom-full z-30 mb-2 hidden w-[260px] max-w-[70vw] rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-xl group-hover:block group-focus-within:block ${alignClass}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ${getTimecodeButtonClass(comment)}`}>
            {formatTimeline(seconds)}
          </span>
          {authorName && <span className="min-w-0 truncate text-[11px] font-semibold text-slate-500">{authorName}</span>}
        </div>
        {comment.is_done_1 && (
          <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            Đã sửa
          </span>
        )}
      </div>
      {image && (
        <img src={image} alt="Ảnh preview feedback" className="mt-2 max-h-[90px] w-full rounded-md border border-slate-200 object-cover" />
      )}
      <div className="mt-2 space-y-1.5 text-[12px] leading-4 text-slate-800">
        {primaryText ? <p className="max-h-16 overflow-hidden whitespace-pre-wrap">{primaryText}</p> : <p className="text-slate-400">Chưa có nội dung feedback.</p>}
        {secondaryText && <p className="max-h-12 overflow-hidden whitespace-pre-wrap border-t border-slate-100 pt-1.5 text-slate-600">{secondaryText}</p>}
      </div>
      {attachments.length > 0 && (
        <div className="mt-2 text-[10px] font-semibold text-slate-400">
          {attachments.length} file đính kèm
        </div>
      )}
    </div>
  )
}

function FeedbackTimelineBar({ comments = [], duration = 0, onSelect }) {
  const points = useMemo(() => comments
    .map(comment => ({
      comment,
      seconds: parseTimeToSeconds(comment.time_comment_1),
    }))
    .filter(point => Number.isFinite(point.seconds) && point.seconds >= 0)
    .sort((a, b) => a.seconds - b.seconds), [comments])

  const maxPointTime = points.reduce((max, point) => Math.max(max, point.seconds), 0)
  const timelineDuration = Math.max(Number(duration) || 0, maxPointTime, 1)

  if (!points.length) return null

  return (
    <div className="mt-1.5 rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1 shadow-sm lg:rounded-l-none">
      <div className="relative h-4">
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 rounded-full bg-slate-200" />
        {points.map(({ comment, seconds }, index) => {
          const position = Math.min(100, Math.max(0, (seconds / timelineDuration) * 100))
          const align = position < 10 ? 'left' : position > 90 ? 'right' : 'center'
          return (
            <div
              key={`${comment.id || index}-${seconds}`}
              className="group absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${position}%` }}
            >
              <button
                type="button"
                onClick={() => onSelect(comment, seconds)}
                className={`block h-2.5 w-2.5 rounded-full border shadow-sm transition focus:outline-none focus:ring-2 ${getTimelineDotClass(comment)}`}
                aria-label={`Tới feedback tại ${formatTimeline(seconds)}`}
              />
              <TimelineDotTooltip comment={comment} seconds={seconds} align={align} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CommentCard({ comment, showSecondColumn, access, onChanged, onSeek, cardRef, isHighlighted = false }) {
  const image = comment.image_comment_1 || comment.image_comment_2
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const authorName = String(comment.author_name || '').trim()

  async function deleteComment() {
    await deleteFeedbackComment(comment.id, access)
    onChanged()
  }

  async function markDone() {
    await updateFeedbackComment(comment.id, 'is_done_1', !comment.is_done_1, access)
    onChanged()
  }

  async function upload(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || uploading) return
    setUploading(true)
    setUploadError('')
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await uploadFeedbackAttachment(comment.id, {
        file_name: file.name,
        data_url: dataUrl,
        field_name: 'comment_1',
      }, access)
      onChanged()
    } catch (err) {
      setUploadError(err?.message || 'Không upload được file.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <article ref={cardRef} className="group scroll-mt-3">
      <div className={`rounded-lg border bg-white px-2.5 py-2 transition ${isHighlighted ? 'border-[#f79820] shadow-[0_0_0_3px_rgba(247,152,32,0.18),0_10px_24px_rgba(15,23,42,0.10)]' : 'border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:border-slate-300'}`}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSeek(comment.time_comment_1)}
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ${getTimecodeButtonClass(comment)}`}
            >
              {formatTimeline(comment.time_comment_1)}
            </button>
            {authorName && (
              <span className="truncate text-[11px] font-semibold text-slate-500">{authorName}</span>
            )}
            {comment.is_done_1 && (
              <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                Đã sửa
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={markDone}
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${comment.is_done_1 ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 bg-white hover:border-blue-400'}`}
              title={comment.is_done_1 ? 'Bỏ đánh dấu đã sửa' : 'Đánh dấu đã sửa'}
              aria-label={comment.is_done_1 ? 'Bỏ đánh dấu đã sửa' : 'Đánh dấu đã sửa'}
              aria-pressed={comment.is_done_1}
            >
              {comment.is_done_1 && <Check className="h-4 w-4 stroke-[3]" />}
            </button>
            <label className={`inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-[#f79820]/40 bg-white px-2 text-[11px] font-semibold text-[#f79820] hover:bg-[#f79820]/10 ${uploading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`} title="Upload file">
              <FileUp className="h-3 w-3" />
              <span>{uploading ? 'Đang upload' : 'Upload'}</span>
              <input type="file" className="hidden" onChange={upload} disabled={uploading} />
            </label>
            <button
              type="button"
              onClick={deleteComment}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[#f79820]/40 bg-white text-[#f79820] hover:bg-[#f79820]/10"
              title="Xóa"
              aria-label="Xóa feedback"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {image && (
          <button type="button" onClick={() => onSeek(comment.time_comment_1)} className="mb-1.5 block overflow-hidden rounded-md border border-slate-200">
            <img src={image} alt="Ảnh preview feedback" className="max-h-[120px] w-full object-cover" />
          </button>
        )}

        <div className={`grid gap-1.5 ${showSecondColumn ? 'min-[1800px]:grid-cols-2' : ''}`}>
          <InlineFeedbackField comment={comment} column="comment_1" access={access} />

          {showSecondColumn && (
            <InlineFeedbackField comment={comment} column="comment_2" access={access} />
          )}
        </div>

        <AttachmentList attachments={comment.attachments} access={access} onChanged={onChanged} />
        {uploadError && (
          <div className="mt-2 rounded-md border border-[#f79820]/30 bg-[#f79820]/10 px-2.5 py-2 text-[12px] font-semibold text-[#b86414]">
            {uploadError}
          </div>
        )}
      </div>
    </article>
  )
}

function OverallFeedbackPanel({ feedback, access, onChanged, fillHeight = false }) {
  const initialValue = (feedback.overall_feedback || []).join('\n')
  const textareaRef = useRef(null)
  const saveStatusTimerRef = useRef(null)
  const lastSavedValueRef = useRef(initialValue.trim())
  const [value, setValue] = useState(initialValue)
  const [saveStatus, setSaveStatus] = useState('')

  useEffect(() => {
    const nextValue = (feedback.overall_feedback || []).join('\n')
    lastSavedValueRef.current = nextValue.trim()
    setValue(nextValue)
  }, [feedback.id, feedback.overall_feedback])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [value])

  useEffect(() => () => {
    if (saveStatusTimerRef.current) window.clearTimeout(saveStatusTimerRef.current)
  }, [])

  function showSavedStatus() {
    setSaveStatus('Đã lưu')
    if (saveStatusTimerRef.current) window.clearTimeout(saveStatusTimerRef.current)
    saveStatusTimerRef.current = window.setTimeout(() => setSaveStatus(''), 3500)
  }

  async function save() {
    const nextValue = value.trim()
    if (nextValue === lastSavedValueRef.current) {
      showSavedStatus()
      return
    }

    setSaveStatus('')
    try {
      await updateOverallFeedback(feedback.id, { type: 'replace', value: nextValue }, access)
      lastSavedValueRef.current = nextValue
      showSavedStatus()
      onChanged()
    } catch {
      setSaveStatus('')
    }
  }

  return (
    <section onMouseLeave={save} className={`${fillHeight ? 'h-full p-5' : 'p-2.5'} rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase text-slate-950">Feedback tổng quan</h2>
        {saveStatus && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-right text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            {saveStatus}
          </span>
        )}
      </div>
      <div className="mt-2">
        <div className="rounded-md border border-slate-200 bg-white px-2.5 py-2 focus-within:border-[#f79820] focus-within:ring-2 focus-within:ring-[#f79820]/20">
          <textarea
            ref={textareaRef}
            value={value}
            onBlur={save}
            onChange={event => {
              setValue(event.target.value)
              setSaveStatus('')
            }}
            placeholder="Nhập nhận xét tổng quan..."
            rows={3}
            className="block min-h-[60px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[13px] leading-5 text-slate-900 outline-none placeholder:text-slate-400"
          />
        </div>
      </div>
    </section>
  )
}

function groupSurveyAnswers(answers = []) {
  const groups = new Map()
  answers.forEach(answer => {
    const key = answer.question_id || answer.question || answer.id
    if (!groups.has(key)) {
      groups.set(key, {
        question: answer.question || 'Câu hỏi',
        values: [],
      })
    }

    const value = String(answer.answer_text || answer.answer || '').trim()
    if (value) groups.get(key).values.push(value)
  })
  return [...groups.values()]
}

function FeedbackSurveyResponsesPanel({ responses = [] }) {
  if (!responses.length) return null

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase text-slate-950">
          <ClipboardCheck className="h-3.5 w-3.5 text-[#f79820]" />
          Survey khách hàng
        </h2>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
          {responses.length} lượt
        </span>
      </div>

      <div className="mt-2 space-y-2">
        {responses.map((response, index) => {
          const answerGroups = groupSurveyAnswers(response.answers || [])
          return (
            <details key={response.id} open={index === 0} className="rounded-lg border border-slate-200 bg-slate-50">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left marker:hidden">
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-bold text-slate-900">{response.display_name || `Khảo sát #${response.submission_no || index + 1}`}</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">{formatFeedbackDateTime(response.created_at)}</span>
                </span>
                <span className="shrink-0 rounded-full border border-[#f79820]/25 bg-[#fff7ed] px-2 py-0.5 text-[11px] font-semibold text-[#f79820]">
                  {response.answer_count || answerGroups.length} câu
                </span>
              </summary>
              <div className="border-t border-slate-200 bg-white px-3 py-2">
                {answerGroups.length ? (
                  <div className="space-y-2">
                    {answerGroups.map(group => (
                      <div key={group.question}>
                        <p className="text-[12px] font-semibold leading-5 text-slate-700">{group.question}</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-5 text-slate-500">{group.values.join(', ') || '-'}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] font-semibold text-slate-400">Chưa có câu trả lời.</p>
                )}
              </div>
            </details>
          )
        })}
      </div>
    </section>
  )
}

export default function FeedbackDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const access = useMemo(() => getFeedbackAccessFromSearch(location.search, id), [id, location.search])
  const videoShellRef = useRef(null)
  const feedbackMenuRef = useRef(null)
  const footerStatusTimerRef = useRef(null)
  const selectedTimelineTimerRef = useRef(null)
  const seekPauseTimerRef = useRef(null)
  const youtubePlayerStateRef = useRef(-1)
  const commentCardRefs = useRef({})
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [footerStatus, setFooterStatus] = useState('')
  const [footerEditorOpen, setFooterEditorOpen] = useState(false)
  const [footerFeedbackName, setFooterFeedbackName] = useState('')
  const [footerVideoUrl, setFooterVideoUrl] = useState('')
  const [footerDriveUrl, setFooterDriveUrl] = useState('')
  const [savingFooterLinks, setSavingFooterLinks] = useState(false)
  const [footerEditorError, setFooterEditorError] = useState('')
  const [deleteFeedbackDialogOpen, setDeleteFeedbackDialogOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteFeedbackError, setDeleteFeedbackError] = useState('')
  const [deletingFeedback, setDeletingFeedback] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [feedbackAuthorName, setFeedbackAuthorName] = useState('')
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const [videoDuration, setVideoDuration] = useState(0)
  const [selectedTimelineCommentId, setSelectedTimelineCommentId] = useState('')
  const [notifyingEditor, setNotifyingEditor] = useState(false)
  const [creatingFeedbackVersion, setCreatingFeedbackVersion] = useState(false)
  const [feedbackMenuOpen, setFeedbackMenuOpen] = useState(false)
  const [newFeedbackName, setNewFeedbackName] = useState('')

  const feedback = detail?.feedback
  const comments = detail?.comments || []
  const feedbackVersions = detail?.feedbacks || []
  const surveyResponses = detail?.survey_responses || []
  const sortedFeedbackVersions = useMemo(() => [...feedbackVersions].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [feedbackVersions])
  const permissions = detail?.permissions || {}
  const embedUrl = getFeedbackVideoEmbedUrl(feedback?.video_url)
  const fourKDownloadUrl = feedback?.drive_url || ''
  const videoSurveyUrl = feedback?.job_id ? `/survey?type=video&job=${encodeURIComponent(feedback.job_id)}` : ''
  const canDeleteFeedback = Boolean(permissions.can_delete_feedback)
  const showFeedbackStatusPanel = Boolean(message || error || !feedback?.video_url)

  async function load() {
    setLoading(true)
    setError('')
    try {
      setDetail(await getFeedbackDetail(id, access))
    } catch (err) {
      setError(err?.message || 'Không tải được feedback.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id, access.zalo, access.token])

  useEffect(() => {
    setFeedbackAuthorName(window.localStorage?.getItem(`eventus.feedbackAuthorName.${id}`) || '')
  }, [id])

  useEffect(() => () => {
    if (footerStatusTimerRef.current) window.clearTimeout(footerStatusTimerRef.current)
    if (selectedTimelineTimerRef.current) window.clearTimeout(selectedTimelineTimerRef.current)
    if (seekPauseTimerRef.current) {
      const timers = Array.isArray(seekPauseTimerRef.current) ? seekPauseTimerRef.current : [seekPauseTimerRef.current]
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    setNewFeedbackName(buildDefaultFeedbackName(feedbackVersions.length + 1))
  }, [feedback?.id, feedbackVersions.length])

  useEffect(() => {
    if (!feedbackMenuOpen) return undefined

    function closeOnOutsideClick(event) {
      if (feedbackMenuRef.current?.contains(event.target)) return
      setFeedbackMenuOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setFeedbackMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [feedbackMenuOpen])

  useEscapeToClose(() => {
    if (deleteFeedbackDialogOpen) {
      setDeleteFeedbackDialogOpen(false)
      return
    }
    setFooterEditorOpen(false)
  }, footerEditorOpen)

  useEffect(() => {
    if (!embedUrl) return undefined
    setVideoDuration(0)
    setCurrentVideoTime(0)
    youtubePlayerStateRef.current = -1

    function handleMessage(event) {
      const eventOrigin = String(event.origin || '')
      if (!eventOrigin.includes('youtube.com') && !eventOrigin.includes('youtube-nocookie.com')) return

      let data = event.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch {
          return
        }
      }

      const nextTime = data?.info?.currentTime
      if (Number.isFinite(nextTime)) setCurrentVideoTime(nextTime)
      const nextDuration = data?.info?.duration
      if (Number.isFinite(nextDuration) && nextDuration > 0) setVideoDuration(nextDuration)
      const nextPlayerState = data?.info?.playerState
      if (Number.isFinite(nextPlayerState)) {
        youtubePlayerStateRef.current = nextPlayerState

        if (nextPlayerState === 0) {
          window.setTimeout(() => {
            const iframe = document.getElementById('feedback-youtube-player')
            if (!iframe?.contentWindow) return
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'seekTo', args: [0, true] }), '*')
            iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*')
          }, 80)
        }
      }
    }

    function requestCurrentTime() {
      const iframe = document.getElementById('feedback-youtube-player')
      if (!iframe?.contentWindow) return
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'feedback-youtube-player' }), '*')
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), '*')
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getDuration', args: [] }), '*')
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getPlayerState', args: [] }), '*')
    }

    window.addEventListener('message', handleMessage)
    const timer = window.setInterval(requestCurrentTime, 500)
    requestCurrentTime()

    return () => {
      window.removeEventListener('message', handleMessage)
      window.clearInterval(timer)
    }
  }, [embedUrl])

  useEffect(() => {
    const shell = videoShellRef.current
    if (!shell) return undefined

    function isInsideVideo(clientX, clientY) {
      const rect = shell.getBoundingClientRect()
      return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
    }

    function preventVideoWheel(event) {
      if (!isInsideVideo(event.clientX, event.clientY)) return
      event.preventDefault()
      event.stopPropagation()
    }

    function preventVideoTouch(event) {
      const touch = event.touches?.[0]
      if (!touch || !isInsideVideo(touch.clientX, touch.clientY)) return
      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('wheel', preventVideoWheel, { passive: false, capture: true })
    window.addEventListener('touchmove', preventVideoTouch, { passive: false, capture: true })

    return () => {
      window.removeEventListener('wheel', preventVideoWheel, { capture: true })
      window.removeEventListener('touchmove', preventVideoTouch, { capture: true })
    }
  }, [embedUrl])

  async function refresh() {
    const next = await getFeedbackDetail(id, access)
    setDetail(next)
  }

  async function addComment(event) {
    event.preventDefault()
    const time = Math.max(0, Math.floor(Number(currentVideoTime) || 0))

    setError('')
    try {
      const result = await createFeedbackComment(feedback.id, {
        text: commentText,
        time,
        author_name: feedbackAuthorName.trim(),
      }, access)
      setDetail(prev => ({ ...prev, comments: result.comments || prev.comments }))
      setCommentText('')
    } catch (err) {
      setError(err?.message || 'Không tạo được feedback.')
    }
  }

  function sendYoutubeCommand(func, args = []) {
    const iframe = document.getElementById('feedback-youtube-player')
    if (!iframe?.contentWindow || !embedUrl) return false
    iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
    return true
  }

  function seekTo(seconds) {
    const iframe = document.getElementById('feedback-youtube-player')
    if (!iframe?.contentWindow || !embedUrl) return
    const nextSeconds = Math.max(0, parseTimeToSeconds(seconds) || 0)
    setCurrentVideoTime(nextSeconds)
    const isColdPlayer = youtubePlayerStateRef.current === -1 || youtubePlayerStateRef.current === 5
    if (seekPauseTimerRef.current) {
      const timers = Array.isArray(seekPauseTimerRef.current) ? seekPauseTimerRef.current : [seekPauseTimerRef.current]
      timers.forEach(timer => window.clearTimeout(timer))
    }

    if (isColdPlayer) {
      const url = new URL(embedUrl)
      url.searchParams.set('start', String(Math.floor(nextSeconds)))
      url.searchParams.set('autoplay', '1')
      url.searchParams.set('mute', '1')
      url.searchParams.set('playsinline', '1')
      iframe.src = url.toString()
      youtubePlayerStateRef.current = 1
    } else {
      sendYoutubeCommand('seekTo', [nextSeconds, true])
      sendYoutubeCommand('pauseVideo')
      youtubePlayerStateRef.current = 2
    }

    const pauseDelays = isColdPlayer ? [500, 900, 1400, 2200] : [250]
    seekPauseTimerRef.current = pauseDelays.map(delay => window.setTimeout(() => {
      sendYoutubeCommand('pauseVideo')
      if (isColdPlayer) {
        sendYoutubeCommand('unMute')
      }
      youtubePlayerStateRef.current = 2
    }, delay))
  }

  function selectTimelineComment(comment, seconds) {
    seekTo(seconds)
    setSelectedTimelineCommentId(comment.id)
    if (selectedTimelineTimerRef.current) window.clearTimeout(selectedTimelineTimerRef.current)
    selectedTimelineTimerRef.current = window.setTimeout(() => setSelectedTimelineCommentId(''), 3500)
    const card = commentCardRefs.current[comment.id]
    if (!card) return
    card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  async function addFeedbackVersion() {
    if (!feedback?.id || creatingFeedbackVersion) return
    const name = newFeedbackName.trim() || buildDefaultFeedbackName(feedbackVersions.length + 1)
    setFeedbackMenuOpen(false)
    setCreatingFeedbackVersion(true)
    setError('')
    try {
      const nextFeedback = await createFeedback({
        feedbackId: feedback.id,
        access,
        feedback: { name },
      })
      navigate(getFeedbackPublicPath(nextFeedback))
    } catch (err) {
      setError(err?.message || 'Không tạo được bản feedback mới.')
    } finally {
      setCreatingFeedbackVersion(false)
    }
  }

  function openFooterEditor() {
    setFooterFeedbackName(feedback?.name || '')
    setFooterVideoUrl(feedback?.video_url || '')
    setFooterDriveUrl(feedback?.drive_url || '')
    setDeleteFeedbackDialogOpen(false)
    setDeleteConfirmText('')
    setDeleteFeedbackError('')
    setFooterEditorError('')
    setFooterEditorOpen(true)
  }

  async function saveFooterLinks(event) {
    event.preventDefault()
    setSavingFooterLinks(true)
    setFooterStatus('')
    setFooterEditorError('')
    try {
      const nextDetail = await saveFeedbackSetup(feedback.id, {
        name: footerFeedbackName.trim(),
        video_url: footerVideoUrl.trim(),
        drive_url: footerDriveUrl.trim(),
      }, access)
      setDetail(nextDetail)
      setFooterEditorOpen(false)
      setFooterStatus('Đã cập nhật Feedback')
      if (footerStatusTimerRef.current) window.clearTimeout(footerStatusTimerRef.current)
      footerStatusTimerRef.current = window.setTimeout(() => setFooterStatus(''), 2000)
    } catch (err) {
      setFooterEditorError(err?.message || 'Không cập nhật được link.')
    } finally {
      setSavingFooterLinks(false)
    }
  }

  async function removeCurrentFeedback() {
    if (!feedback?.id || !canDeleteFeedback || deleteConfirmText.trim() !== 'Delete') return

    setDeletingFeedback(true)
    setDeleteFeedbackError('')
    try {
      const result = await deleteFeedback(feedback.id)
      setDeleteFeedbackDialogOpen(false)
      setFooterEditorOpen(false)
      if (result.feedback) {
        navigate(getFeedbackPublicPath(result.feedback), { replace: true })
        return
      }
      navigate('/feedbacks', { replace: true })
    } catch (err) {
      setDeleteFeedbackError(err?.message || 'Không xóa được bản feedback.')
    } finally {
      setDeletingFeedback(false)
    }
  }

  function prepareVideoSurvey() {
    if (!videoSurveyUrl) return
    window.setTimeout(() => window.location.assign(videoSurveyUrl), 0)
  }

  async function doneFeedback() {
    setNotifyingEditor(true)
    setError('')
    setMessage('')
    try {
      const next = await markFeedbackDone(feedback.id, access)
      setDetail(next)
      const editorName = feedback.editor_name || feedback.job?.editor_name || 'Editor'
      setMessage(`Đã ghi nhận Feedback hoàn tất và thông báo tới Editor ${editorName}.`)
    } catch (err) {
      setError(err?.message || 'Không thông báo được tới Editor.')
    } finally {
      setNotifyingEditor(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-50 p-6 text-[13px] font-semibold text-slate-400">Đang tải Feedback...</div>
  }

  if (error && !detail) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-4">
        <div className="max-w-lg rounded-lg border border-rose-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-[22px] font-semibold text-slate-950">Không mở được Feedback</h1>
          <p className="mt-2 text-[13px] leading-6 text-rose-600">{error}</p>
          <Link to="/feedbacks" className="mt-5 inline-flex h-10 items-center justify-center rounded-lg bg-[#f79820] px-4 text-[13px] font-semibold text-white hover:bg-[#df861d]">
            Nhập lại mã Job
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen overflow-hidden bg-slate-50">
      <div className="flex h-full flex-col px-3 py-2 lg:pl-0 lg:pr-3">
        <header className="shrink-0 rounded-lg border border-slate-200 bg-white shadow-sm lg:rounded-l-none">
          <div className="flex flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-3 lg:px-4 lg:py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-start gap-2 lg:items-center lg:gap-3">
                <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f79820] text-white shadow-sm lg:flex">
                  <Film className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 flex-col items-stretch justify-start gap-1.5 lg:flex-row lg:items-center lg:gap-2">
                    <h1 className="min-w-0 text-[13px] font-semibold leading-snug text-slate-950 lg:truncate lg:text-[16px]">{feedback.job?.title || `Job #${feedback.job_id}`}</h1>
                    <div ref={feedbackMenuRef} className="relative inline-block w-full lg:w-auto lg:max-w-[260px] lg:shrink-0">
                      <button
                        type="button"
                        onClick={() => setFeedbackMenuOpen(value => !value)}
                        className={`inline-flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold leading-none transition lg:text-[13px] ${
                          feedbackMenuOpen
                            ? 'bg-[#df861d] text-white ring-2 ring-[#f79820]/20'
                            : 'bg-[#f79820] text-white shadow-sm hover:bg-[#df861d]'
                        }`}
                        aria-expanded={feedbackMenuOpen}
                        aria-haspopup="menu"
                      >
                        <span className="min-w-0 truncate">{feedback.name || 'Feedback'}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-white transition ${feedbackMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {feedbackMenuOpen && (
                        <div className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="menu">
                          {sortedFeedbackVersions.map(item => (
                            <Link
                              key={item.id}
                              to={getFeedbackPublicPath(item)}
                              onClick={() => setFeedbackMenuOpen(false)}
                              className={`block px-3 py-2 text-[12px] font-semibold ${item.id === feedback.id ? 'bg-[#fff7ed] text-slate-950' : 'text-slate-700 hover:bg-[#fff7ed] hover:text-slate-950'}`}
                              role="menuitem"
                            >
                              {item.name || 'Feedback'}
                            </Link>
                          ))}
                          <button
                            type="button"
                            onClick={addFeedbackVersion}
                            disabled={creatingFeedbackVersion}
                            className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-[12px] font-semibold text-[#f79820] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                            role="menuitem"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            {creatingFeedbackVersion ? 'Đang thêm...' : 'Thêm bản mới'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5 lg:flex lg:flex-wrap lg:gap-2">
              {fourKDownloadUrl && (
                <a
                  href={fourKDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={prepareVideoSurvey}
                  className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-[#f79820]/30 bg-white px-2 py-1 text-[11px] font-semibold leading-tight text-[#f79820] hover:bg-[#f79820]/10 lg:h-8 lg:gap-2 lg:px-2.5 lg:text-[13px]"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" />
                  <span className="text-center">Link Google Drive tải file</span>
                </a>
              )}
              <button
                type="button"
                onClick={doneFeedback}
                disabled={notifyingEditor}
                className={`${fourKDownloadUrl ? '' : 'col-span-2'} inline-flex min-h-8 max-w-full items-center justify-center gap-1.5 rounded-lg bg-[#f79820] px-2 py-1 text-[11px] font-semibold leading-tight text-white hover:bg-[#df861d] disabled:cursor-not-allowed disabled:opacity-70 lg:gap-2 lg:px-2.5 lg:text-[13px]`}
              >
                {notifyingEditor ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" /> : <BellRing className="h-3.5 w-3.5 shrink-0 lg:h-4 lg:w-4" />}
                {notifyingEditor ? (
                  <span className="text-center lg:text-left">Đang thông báo...</span>
                ) : (
                  <span className="text-center lg:text-left">
                    <span className="block lg:inline">Thông báo tới Editor:</span>
                    <span className="block lg:ml-1 lg:inline">Tôi đã hoàn tất Feedback</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {showFeedbackStatusPanel && (
          <div className="mt-2 shrink-0 space-y-2">
            {message && <Alert type="success" className="text-center !text-slate-950">{message}</Alert>}
            {error && <Alert type="error">{error}</Alert>}
            {!feedback.video_url && (
              <div className="lg:grid lg:gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(380px,0.85fr)] xl:grid-cols-[minmax(0,2.35fr)_minmax(410px,0.9fr)]">
                <SetupPanel detail={detail} access={access} onSaved={setDetail} />
                <OverallFeedbackPanel feedback={feedback} access={access} onChanged={refresh} fillHeight />
              </div>
            )}
          </div>
        )}

        <section className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:grid lg:gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(380px,0.85fr)] xl:grid-cols-[minmax(0,2.35fr)_minmax(410px,0.9fr)]">
	          <div ref={videoShellRef} className="shrink-0 overscroll-none lg:sticky lg:top-2 lg:self-start">
	            <div className="overflow-hidden overscroll-none rounded-lg border border-slate-200 bg-white shadow-sm lg:rounded-l-none">
	              {embedUrl ? (
	                <div className="relative aspect-video overflow-hidden bg-white">
	                  <iframe
	                    id="feedback-youtube-player"
	                    title={feedback.video_title || feedback.name || 'Feedback video'}
	                    src={embedUrl}
	                    className="absolute -top-px left-0 block h-[calc(100%+2px)] w-full border-0 bg-white overscroll-none"
	                    scrolling="no"
		                    allow="accelerometer; autoplay; encrypted-media; gyroscope"
		                    referrerPolicy="strict-origin-when-cross-origin"
			                  />
			                </div>
	              ) : (
	                <div className="grid aspect-video place-items-center bg-slate-100 text-center">
	                  <div>
	                    <Video className="mx-auto h-10 w-10 text-slate-300" />
	                    <p className="mt-2 text-[13px] font-semibold text-slate-500">Chưa có video để hiển thị.</p>
	                  </div>
	                </div>
	              )}
	            </div>
            <FeedbackTimelineBar comments={comments} duration={videoDuration} onSelect={selectTimelineComment} />
            <footer className="mt-2 hidden rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-400 lg:block lg:rounded-l-none">
              <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center">
                <div className="shrink-0">
                  <button type="button" onClick={openFooterEditor} className="flex h-5 cursor-pointer items-center" aria-label="Cập nhật link Feedback">
                    <img src="/logos/logo_eventus.png" alt="Eventus Production" className="h-5 w-auto opacity-100" />
                  </button>
                </div>
                <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1 lg:pl-3">
                  <span><span className="font-semibold text-slate-500">Editor:</span> {feedback.editor_name || feedback.job?.editor_name || '-'}</span>
                  <span><span className="font-semibold text-slate-500">Điện thoại:</span> {feedback.editor_phone || feedback.job?.editor_phone || '-'}</span>
                  <span><span className="font-semibold text-slate-500">Cập nhật:</span> {formatFeedbackDateTime(feedback.updated_at)}</span>
                  <span><span className="font-semibold text-slate-500">Trạng thái:</span> {feedback.done_feedback ? 'Khách hàng đã hoàn tất feedback' : 'Đang feedback'}</span>
                </div>
                <div className="shrink-0 text-left lg:text-right">
                  <span>{footerStatus || 'Copyright © 2017 - 2026 Eventus Production. All rights reserved.'}</span>
                </div>
              </div>
            </footer>
          </div>

          <aside className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full lg:pr-1">
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-0">
              {feedback.video_url && <OverallFeedbackPanel feedback={feedback} access={access} onChanged={refresh} />}
              <FeedbackSurveyResponsesPanel responses={surveyResponses} />

	              {comments.length ? comments.map(comment => (
	                <CommentCard
	                  key={comment.id}
	                  comment={comment}
	                  showSecondColumn={feedback.more_column}
	                  access={access}
	                  onChanged={refresh}
	                  onSeek={seekTo}
	                  isHighlighted={selectedTimelineCommentId === comment.id}
	                  cardRef={node => {
	                    if (node) commentCardRefs.current[comment.id] = node
	                    else delete commentCardRefs.current[comment.id]
	                  }}
	                />
	              )) : (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white px-5 py-10 text-center">
                  <p className="text-[14px] font-semibold text-slate-800">Chưa có feedback timeline</p>
                  <p className="mt-1 text-[13px] text-slate-500">Nhập nội dung góp ý ở ô bên dưới để bắt đầu.</p>
                </div>
              )}

            </div>

            <form onSubmit={addComment} className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_-2px_10px_rgba(15,23,42,0.06)]">
              <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold text-slate-500">
                <span className="shrink-0 rounded-md bg-[#f79820]/10 px-2 py-1 text-[11px] font-bold text-[#f79820] ring-1 ring-[#f79820]/25">
                  {formatTimeline(currentVideoTime)}
                </span>
                <label className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="shrink-0">Tên người feedback:</span>
                  <input
                    type="text"
                    value={feedbackAuthorName}
                    onChange={event => {
                      const nextName = event.target.value
                      setFeedbackAuthorName(nextName)
                      window.localStorage?.setItem(`eventus.feedbackAuthorName.${id}`, nextName)
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter') event.preventDefault()
                    }}
                    placeholder="Nhập tên"
                    className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[12px] font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#f79820] focus:ring-2 focus:ring-[#f79820]/20"
                  />
                </label>
              </div>
              <div className="relative rounded-md border border-slate-200 bg-white px-2.5 pb-2 pt-1.5 focus-within:border-[#f79820] focus-within:ring-2 focus-within:ring-[#f79820]/20">
                <textarea
                  value={commentText}
                  onChange={event => setCommentText(event.target.value)}
                  placeholder="Nhập feedback..."
                  rows={5}
                  className="block min-h-[100px] w-full resize-none border-0 bg-transparent p-0 pr-10 text-[13px] leading-5 text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button type="submit" className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-[#f79820] text-white hover:bg-[#df861d]" aria-label="Gửi feedback">
                  <SendHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </aside>
        </section>
      </div>
      {footerEditorOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 px-4 py-6">
          <section className="w-full max-w-xl rounded-lg border border-slate-200 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="feedback-link-editor-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="feedback-link-editor-title" className="text-[16px] font-semibold text-[#f79820]">Cài đặt Feedback</h2>
              {canDeleteFeedback && (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmText('')
                    setDeleteFeedbackError('')
                    setDeleteFeedbackDialogOpen(true)
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-[#f79820]/40 bg-white text-[#f79820] hover:bg-[#fff7ed]"
                  aria-label="Mở popup xóa feedback"
                  title="Xóa feedback"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <form onSubmit={saveFooterLinks} className="mt-4 space-y-4">
              <div>
                <FieldLabel>Tên feedback</FieldLabel>
                <TextInput
                  value={footerFeedbackName}
                  onChange={event => setFooterFeedbackName(event.target.value)}
                  placeholder="Feedback #4 02.06.2026"
                  className="mt-1"
                />
              </div>
              <div>
                <FieldLabel>Youtube URL</FieldLabel>
                <TextInput
                  value={footerVideoUrl}
                  onChange={event => setFooterVideoUrl(event.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="mt-1"
                />
              </div>
              <div>
                <FieldLabel>Link Google Drive tải file</FieldLabel>
                <TextInput
                  value={footerDriveUrl}
                  onChange={event => setFooterDriveUrl(event.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="mt-1"
                />
              </div>
              {footerEditorError && <Alert type="error">{footerEditorError}</Alert>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setFooterEditorOpen(false)}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={savingFooterLinks}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#f79820] px-4 text-[13px] font-semibold text-white hover:bg-[#df861d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {savingFooterLinks ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {deleteFeedbackDialogOpen && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 px-4 py-6">
          <section className="w-full max-w-md rounded-lg border border-[#f79820]/40 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="feedback-delete-title">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#f79820]/10 text-[#f79820] ring-1 ring-[#f79820]/30">
                  <Trash2 className="h-4 w-4" />
                </span>
                <div>
                  <h2 id="feedback-delete-title" className="text-[16px] font-semibold text-slate-950">Xóa bản feedback này</h2>
                  <p className="mt-1 text-[12px] leading-5 text-slate-600">Bản feedback sẽ được ẩn khỏi danh sách. Các bản feedback khác của cùng job vẫn được giữ lại.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteFeedbackDialogOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Đóng popup xóa"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <FieldLabel>Nhập Delete để xác nhận</FieldLabel>
              <TextInput
                value={deleteConfirmText}
                onChange={event => setDeleteConfirmText(event.target.value)}
                placeholder="Delete"
                className="mt-1 border-[#f79820]/30 focus:border-[#f79820] focus:ring-[#f79820]/20"
              />
            </div>
            {deleteFeedbackError && (
              <div className="mt-4 rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 px-4 py-3 text-[13px] font-semibold text-[#b86414]">
                {deleteFeedbackError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteFeedbackDialogOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={removeCurrentFeedback}
                disabled={deletingFeedback || deleteConfirmText.trim() !== 'Delete'}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[#f79820] px-4 text-[13px] font-semibold text-white hover:bg-[#df861d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {deletingFeedback ? 'Đang xóa...' : 'Xóa feedback'}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
