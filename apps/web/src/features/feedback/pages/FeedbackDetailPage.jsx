import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  BellRing,
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
  buildFeedbackClonePromptText,
  buildFeedbackCloneTitleText,
  buildDefaultFeedbackName,
  formatFeedbackDateDots,
  formatFeedbackDayMonth,
  formatFeedbackDateTime,
  formatFeedbackCloneCount,
  formatTimeline,
  getFeedbackAccessFromSearch,
  getFeedbackNameParts,
  getFeedbackPublicPath,
  getFeedbackVideoEmbedUrl,
  linkifyFeedbackText,
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

function FeedbackDateBadge({ dateBadge, className = '', inParens = false }) {
  if (!dateBadge) return null
  const label = inParens ? `(${dateBadge})` : dateBadge
  const styles = className || 'text-[11px] font-normal leading-4 text-black'
  return (
    <span className={`shrink-0 ${styles}`}>
      {label}
    </span>
  )
}

function FeedbackNameInput({ value, onChange, placeholder, dateBadge, dateBadgeClassName = '', className = '' }) {
  return (
    <div className={`flex h-10 w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-[#f79820] focus-within:ring-2 focus-within:ring-[#f79820]/20 ${className}`}>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-slate-900 outline-none placeholder:text-slate-400"
      />
      <FeedbackDateBadge dateBadge={dateBadge} className={dateBadgeClassName} />
    </div>
  )
}

function FeedbackNameInline({ feedback, fallbackDate, className = '', nameClassName = '', badgeClassName = '', dateInParens = false }) {
  const { name, dateBadge } = getFeedbackNameParts(feedback, fallbackDate)
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className={`min-w-0 truncate ${nameClassName}`}>{name}</span>
      <FeedbackDateBadge dateBadge={dateBadge} className={badgeClassName} inParens={dateInParens} />
    </span>
  )
}

function LinkifiedFeedbackText({ value }) {
  const parts = useMemo(() => linkifyFeedbackText(value), [value])
  return (
    <>
      {parts.map((part, index) => part.type === 'link' ? (
        <a
          key={`${part.href}-${index}`}
          href={part.href}
          target="_blank"
          rel="noreferrer"
          onClick={event => event.stopPropagation()}
          className="text-[13px] font-normal text-blue-600 underline-offset-2 hover:underline"
        >
          {part.text}
        </a>
      ) : (
        <span key={`text-${index}`}>{part.text}</span>
      ))}
    </>
  )
}

function LinkedEditableText({
  value,
  onChange,
  onBlur,
  placeholder = '',
  rows = 1,
  minHeightClass = 'min-h-[34px]',
  className = '',
  autoResize = true,
}) {
  const [editing, setEditing] = useState(false)
  const textareaRef = useRef(null)
  const hasValue = String(value || '').trim().length > 0

  const fitTextareaHeight = useCallback((node = textareaRef.current) => {
    if (!node || !autoResize) return
    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }, [autoResize])

  function startEditing() {
    setEditing(true)
  }

  useLayoutEffect(() => {
    if (!editing) return
    const node = textareaRef.current
    if (!node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
    fitTextareaHeight(node)
  }, [editing, fitTextareaHeight])

  useLayoutEffect(() => {
    if (editing) fitTextareaHeight()
  }, [editing, fitTextareaHeight, value])

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={value}
        onBlur={event => {
          onBlur?.(event)
          setEditing(false)
        }}
        onChange={event => onChange?.(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`block ${minHeightClass} w-full resize-none ${autoResize ? 'overflow-hidden' : 'overflow-y-auto'} border-0 bg-transparent p-0 text-[13px] leading-5 text-slate-900 outline-none placeholder:text-slate-400 ${className}`}
      />
    )
  }

  return (
    <div
      role="textbox"
      tabIndex={0}
      onClick={startEditing}
      onKeyDown={event => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        startEditing()
      }}
      className={`block ${minHeightClass} w-full cursor-text whitespace-pre-wrap break-words text-[13px] leading-5 outline-none focus:ring-2 focus:ring-[#f79820]/20 ${hasValue ? 'text-slate-900' : 'text-slate-400'} ${className}`}
    >
      {hasValue ? <LinkifiedFeedbackText value={value} /> : placeholder}
    </div>
  )
}

function SetupPanel({
  detail,
  access,
  mode = 'edit',
  defaultName = '',
  dateBadge = '',
  cloneUnresolved = false,
  cloneUnresolvedFromFeedbackId = '',
  cloneUnresolvedCount = 0,
  onSaved,
  onCreated,
  onCancel,
}) {
  const feedback = detail.feedback
  const employees = detail.employees || []
  const existingEditorName = feedback.editor_name || feedback.job?.editor_name || ''
  const feedbackNameParts = getFeedbackNameParts(feedback)
  const isCreateMode = mode === 'create'
  const displayDateBadge = dateBadge || feedbackNameParts.dateBadge
  const [feedbackName, setFeedbackName] = useState(isCreateMode ? defaultName : feedbackNameParts.name)
  const [editorId, setEditorId] = useState('')
  const [videoUrl, setVideoUrl] = useState(isCreateMode ? '' : feedback.video_url || '')
  const [driveUrl, setDriveUrl] = useState(isCreateMode ? '' : feedback.drive_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setFeedbackName(isCreateMode ? defaultName : getFeedbackNameParts(feedback).name)
    setVideoUrl(isCreateMode ? '' : feedback.video_url || '')
    setDriveUrl(isCreateMode ? '' : feedback.drive_url || '')
  }, [defaultName, feedback.id, feedback.name, feedback.video_url, feedback.drive_url, isCreateMode])

  async function createNewFeedback(payload) {
    setSaving(true)
    setError('')
    try {
      const nextFeedback = await createFeedback({
        jobId: feedback.job_id,
        feedbackId: feedback.id,
        access,
        feedback: payload,
        cloneUnresolved,
        cloneUnresolvedFromFeedbackId: cloneUnresolved ? cloneUnresolvedFromFeedbackId : '',
      })
      onCreated?.(nextFeedback)
    } catch (err) {
      setError(err?.message || 'Không tạo được bản feedback mới.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return
    setError('')
    const payload = {
      name: feedbackName.trim(),
      editor_employee_id: editorId || undefined,
      video_url: videoUrl.trim(),
      drive_url: driveUrl.trim(),
    }

    try {
      if (isCreateMode) {
        await createNewFeedback(payload)
      } else {
        setSaving(true)
        const nextDetail = await saveFeedbackSetup(feedback.id, payload, access)
        onSaved?.(nextDetail)
      }
    } catch (err) {
      setError(err?.message || (isCreateMode ? 'Không tạo được bản feedback mới.' : 'Không lưu được thông tin feedback.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="h-full rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 p-5">
      <div className="flex items-center">
        <h2 className="text-[12px] font-semibold uppercase text-slate-950">
          {isCreateMode ? 'Thêm bản feedback mới' : 'Cài đặt bản feedback'}
          {isCreateMode && cloneUnresolved && (
            <span className="normal-case text-slate-950">
              {' '}(Bản này sẽ clone {formatFeedbackCloneCount(cloneUnresolvedCount)} feedback từ bản trước chưa sửa.)
            </span>
          )}
        </h2>
        {isCreateMode && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label="Đóng form thêm feedback"
          >
            <X className="h-4 w-4" />
          </button>
        )}
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
          <FeedbackNameInput
            value={feedbackName}
            onChange={event => setFeedbackName(event.target.value)}
            placeholder={buildDefaultFeedbackName()}
            dateBadge={displayDateBadge}
            dateBadgeClassName={isCreateMode ? 'rounded-md bg-[#f79820]/10 px-2 py-1 text-[11px] font-semibold leading-none text-[#f79820] ring-1 ring-[#f79820]/25' : ''}
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
  const saveTimerRef = useRef(null)
  const lastSavedValueRef = useRef(comment[column] || '')

  useEffect(() => {
    const nextValue = comment[column] || ''
    lastSavedValueRef.current = nextValue
    setValue(nextValue)
  }, [comment.id, column, comment[column]])

  useEffect(() => {
    if (value === lastSavedValueRef.current) return undefined

    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(async () => {
      const nextValue = value
      setSaving(true)
      try {
        await updateFeedbackComment(comment.id, column, nextValue, access)
        lastSavedValueRef.current = nextValue
      } finally {
        setSaving(false)
        saveTimerRef.current = null
      }
    }, 700)

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [access, column, comment.id, value])

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
  }, [])

  async function saveNow() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    const nextValue = value
    if (nextValue === lastSavedValueRef.current) return
    setSaving(true)
    try {
      await updateFeedbackComment(comment.id, column, nextValue, access)
      lastSavedValueRef.current = nextValue
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <LinkedEditableText
        value={value}
        onChange={setValue}
        onBlur={saveNow}
        placeholder={placeholder}
        rows={1}
        minHeightClass="min-h-[34px]"
        className={`flex-1 ${className}`}
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

function DoneSwitch({ checked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition focus:outline-none focus:ring-2 focus:ring-blue-200 ${
        checked
          ? 'border-blue-500 bg-blue-500'
          : 'border-slate-300 bg-slate-200 hover:border-blue-300 hover:bg-slate-300'
      }`}
      title={checked ? 'Bỏ đánh dấu đã sửa' : 'Đánh dấu đã sửa'}
      aria-label={checked ? 'Bỏ đánh dấu đã sửa' : 'Đánh dấu đã sửa'}
      aria-checked={checked}
      role="switch"
    >
      <span
        className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
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
            <DoneSwitch checked={Boolean(comment.is_done_1)} onClick={markDone} />
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
  const saveStatusTimerRef = useRef(null)
  const lastSavedValueRef = useRef(initialValue.trim())
  const [value, setValue] = useState(initialValue)
  const [saveStatus, setSaveStatus] = useState('')

  useEffect(() => {
    const nextValue = (feedback.overall_feedback || []).join('\n')
    lastSavedValueRef.current = nextValue.trim()
    setValue(nextValue)
  }, [feedback.id, feedback.overall_feedback])

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
    <section onMouseLeave={save} className={`${fillHeight ? 'flex h-full min-h-0 flex-col overflow-hidden p-3' : 'p-2.5'} rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 shadow-sm`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[12px] font-semibold uppercase text-slate-950">Feedback tổng quan</h2>
        {saveStatus && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-right text-[11px] font-semibold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            {saveStatus}
          </span>
        )}
      </div>
      <div className={`${fillHeight ? 'flex min-h-0 flex-1 flex-col' : ''} mt-2`}>
        <div className={`${fillHeight ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''} rounded-md border border-slate-200 bg-white px-2.5 py-2 focus-within:border-[#f79820] focus-within:ring-2 focus-within:ring-[#f79820]/20`}>
          <LinkedEditableText
            value={value}
            onBlur={save}
            onChange={nextValue => {
              setValue(nextValue)
              setSaveStatus('')
            }}
            placeholder="Nhập nhận xét tổng quan..."
            rows={fillHeight ? 2 : 3}
            minHeightClass={fillHeight ? 'min-h-[42px]' : 'min-h-[60px]'}
            className={fillHeight ? 'min-h-0 flex-1 overflow-y-auto' : ''}
            autoResize={!fillHeight}
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
  const feedbackWorkspaceRef = useRef(null)
  const videoShellRef = useRef(null)
  const videoTimelineRef = useRef(null)
  const feedbackOverviewSlotRef = useRef(null)
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
  const [videoClickToPlayActive, setVideoClickToPlayActive] = useState(false)
  const [selectedTimelineCommentId, setSelectedTimelineCommentId] = useState('')
  const [notifyingEditor, setNotifyingEditor] = useState(false)
  const [feedbackMenuOpen, setFeedbackMenuOpen] = useState(false)
  const [newFeedbackName, setNewFeedbackName] = useState('')
  const [newFeedbackDraftOpen, setNewFeedbackDraftOpen] = useState(false)
  const [newFeedbackClonePromptOpen, setNewFeedbackClonePromptOpen] = useState(false)
  const [newFeedbackCloneUnresolved, setNewFeedbackCloneUnresolved] = useState(false)
  const [newFeedbackCloneSourceId, setNewFeedbackCloneSourceId] = useState('')

  const feedback = detail?.feedback
  const comments = detail?.comments || []
  const feedbackVersions = detail?.feedbacks || []
  const surveyResponses = detail?.survey_responses || []
  const cloneSuggestion = detail?.clone_suggestion || {}
  const cloneSourceFeedback = cloneSuggestion.source_feedback || null
  const unresolvedCloneCount = Math.max(0, Math.floor(Number(cloneSuggestion.unresolved_count) || 0))
  const cloneSourceFeedbackName = getFeedbackNameParts(cloneSourceFeedback || {}).name
  const cloneEditorName = feedback?.editor_name || feedback?.job?.editor_name || ''
  const sortedFeedbackVersions = useMemo(() => [...feedbackVersions].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [feedbackVersions])
  const currentFeedbackNameParts = getFeedbackNameParts(feedback || {})
  const permissions = detail?.permissions || {}
  const embedUrl = getFeedbackVideoEmbedUrl(feedback?.video_url)
  const fourKDownloadUrl = feedback?.drive_url || ''
  const surveyJobIdentifier = feedback?.job?.public_token || feedback?.job_id || ''
  const videoSurveyUrl = surveyJobIdentifier ? `/survey?job=${encodeURIComponent(surveyJobIdentifier)}` : ''
  const canDeleteFeedback = Boolean(permissions.can_delete_feedback)
  const showFeedbackStatusPanel = Boolean(message || error || !feedback?.video_url || newFeedbackDraftOpen)
  const jobTitle = feedback?.job?.title || `Job #${feedback?.job_id || ''}`
  const jobDateTitle = formatFeedbackDateDots(feedback?.job?.job_date)
  const pageJobTitle = jobDateTitle ? `${jobDateTitle} ${jobTitle}` : jobTitle
  const newFeedbackDateBadge = formatFeedbackDayMonth(new Date())
  const shouldOfferNewFeedbackClone = Boolean(cloneSourceFeedback?.id) && unresolvedCloneCount > 0
  const footerCopyright = footerStatus || 'Copyright © 2017 - 2026 Eventus Production. All rights reserved.'

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

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined

    let measureTimerId = 0
    const layoutReadyAttribute = 'data-feedback-layout-ready'

    function resetMeasuredLayout() {
      const workspace = feedbackWorkspaceRef.current
      if (!(workspace instanceof window.HTMLElement)) return
      workspace.style.removeProperty('--feedback-video-column-width')
      workspace.style.removeProperty('--feedback-detail-form-offset')
      workspace.removeAttribute(layoutReadyAttribute)
    }

    function getOuterHeight(node) {
      if (!node) return 0
      const rect = node.getBoundingClientRect()
      if (rect.height <= 0) return 0
      const styles = window.getComputedStyle(node)
      const marginTop = Number.parseFloat(styles.marginTop) || 0
      const marginBottom = Number.parseFloat(styles.marginBottom) || 0
      return rect.height + marginTop + marginBottom
    }

    function measureVideoStack() {
      measureTimerId = 0

      if (!window.matchMedia('(min-width: 1024px)').matches) {
        resetMeasuredLayout()
        return
      }

      const workspace = feedbackWorkspaceRef.current
      const shell = videoShellRef.current
      if (!workspace || !shell) return

      const workspaceRect = workspace.getBoundingClientRect()
      const overviewNode = feedbackOverviewSlotRef.current
      const videoCard = shell.querySelector('.aspect-video')?.parentElement || null
      const workspaceStyles = window.getComputedStyle(workspace)
      const overviewStyles = overviewNode ? window.getComputedStyle(overviewNode) : null
      const videoCardStyles = videoCard ? window.getComputedStyle(videoCard) : null
      const columnGap = Number.parseFloat(workspaceStyles.columnGap) || 12
      const feedbackColumnMinWidth = 360
      const overallFeedbackMinHeight = feedback?.video_url ? 120 : 0
      const bottomBreathingRoom = 8
      const timelineHeight = getOuterHeight(videoTimelineRef.current)
      const overviewMarginTop = overviewStyles ? Number.parseFloat(overviewStyles.marginTop) || 0 : 0
      const videoCardBorderX = videoCardStyles
        ? (Number.parseFloat(videoCardStyles.borderLeftWidth) || 0) + (Number.parseFloat(videoCardStyles.borderRightWidth) || 0)
        : 0
      const videoCardBorderY = videoCardStyles
        ? (Number.parseFloat(videoCardStyles.borderTopWidth) || 0) + (Number.parseFloat(videoCardStyles.borderBottomWidth) || 0)
        : 0
      const availableVideoHeight = workspaceRect.height - timelineHeight - overallFeedbackMinHeight - bottomBreathingRoom
      const maxVideoWidthByHeight = availableVideoHeight * (16 / 9)
      const maxVideoWidthByLayout = workspaceRect.width - columnGap - feedbackColumnMinWidth
      const nextWidth = Math.floor(Math.min(maxVideoWidthByHeight, maxVideoWidthByLayout))

      if (!Number.isFinite(nextWidth) || nextWidth <= 0) {
        resetMeasuredLayout()
        return
      }

      const videoCardHeight = Math.max(0, nextWidth - videoCardBorderX) * (9 / 16) + videoCardBorderY
      const nextDetailFormOffset = overviewNode
        ? Math.max(0, Math.round(videoCardHeight + timelineHeight + overviewMarginTop))
        : null

      workspace.style.setProperty('--feedback-video-column-width', `${nextWidth}px`)
      if (nextDetailFormOffset === null) workspace.style.removeProperty('--feedback-detail-form-offset')
      else workspace.style.setProperty('--feedback-detail-form-offset', `${nextDetailFormOffset}px`)
      workspace.setAttribute(layoutReadyAttribute, 'true')
    }

    function scheduleMeasure() {
      if (measureTimerId) return
      measureTimerId = window.setTimeout(measureVideoStack, 0)
    }

    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleMeasure) : null
    const observe = node => {
      if (resizeObserver && node instanceof window.Element) resizeObserver.observe(node)
    }
    observe(feedbackWorkspaceRef.current)
    observe(videoShellRef.current)
    observe(videoTimelineRef.current)
    observe(feedbackOverviewSlotRef.current)
    window.addEventListener('resize', scheduleMeasure)
    window.visualViewport?.addEventListener('resize', scheduleMeasure)
    measureVideoStack()

    return () => {
      if (measureTimerId) window.clearTimeout(measureTimerId)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', scheduleMeasure)
      window.visualViewport?.removeEventListener('resize', scheduleMeasure)
    }
  }, [comments.length, embedUrl, feedback?.id, footerStatus, showFeedbackStatusPanel, videoDuration])

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

  useEscapeToClose(() => {
    setNewFeedbackClonePromptOpen(false)
  }, newFeedbackClonePromptOpen)

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
        if (nextPlayerState === 1) setVideoClickToPlayActive(false)

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

  function clearSeekPauseTimers() {
    if (!seekPauseTimerRef.current) return
    const timers = Array.isArray(seekPauseTimerRef.current) ? seekPauseTimerRef.current : [seekPauseTimerRef.current]
    timers.forEach(timer => window.clearTimeout(timer))
    seekPauseTimerRef.current = null
  }

  function playVideoFromShell() {
    clearSeekPauseTimers()
    sendYoutubeCommand('unMute')
    if (!sendYoutubeCommand('playVideo')) return
    youtubePlayerStateRef.current = 1
    setVideoClickToPlayActive(false)
  }

  function seekTo(seconds) {
    const iframe = document.getElementById('feedback-youtube-player')
    if (!iframe?.contentWindow || !embedUrl) return
    const nextSeconds = Math.max(0, parseTimeToSeconds(seconds) || 0)
    setCurrentVideoTime(nextSeconds)
    const isColdPlayer = youtubePlayerStateRef.current === -1 || youtubePlayerStateRef.current === 5
    clearSeekPauseTimers()
    setVideoClickToPlayActive(true)

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

  function addFeedbackVersion() {
    if (!feedback?.id) return
    setFeedbackMenuOpen(false)
    setNewFeedbackName(current => current.trim() || buildDefaultFeedbackName(feedbackVersions.length + 1))
    setNewFeedbackCloneUnresolved(false)
    setNewFeedbackCloneSourceId('')
    setError('')
    if (shouldOfferNewFeedbackClone) {
      setNewFeedbackDraftOpen(false)
      setNewFeedbackClonePromptOpen(true)
      return
    }
    setNewFeedbackDraftOpen(true)
  }

  function cancelNewFeedbackClonePrompt() {
    setNewFeedbackClonePromptOpen(false)
    setNewFeedbackCloneUnresolved(false)
    setNewFeedbackCloneSourceId('')
  }

  function chooseNewFeedbackClonePreference(cloneUnresolved) {
    setNewFeedbackClonePromptOpen(false)
    setNewFeedbackCloneUnresolved(cloneUnresolved)
    setNewFeedbackCloneSourceId(cloneUnresolved ? cloneSourceFeedback?.id || '' : '')
    setNewFeedbackDraftOpen(true)
    setError('')
  }

  function cancelNewFeedbackDraft() {
    setNewFeedbackDraftOpen(false)
    setNewFeedbackCloneUnresolved(false)
    setNewFeedbackCloneSourceId('')
  }

  function handleNewFeedbackCreated(nextFeedback) {
    setNewFeedbackDraftOpen(false)
    setNewFeedbackClonePromptOpen(false)
    setNewFeedbackCloneUnresolved(false)
    setNewFeedbackCloneSourceId('')
    navigate(getFeedbackPublicPath(nextFeedback))
  }

  function openFooterEditor() {
    setFooterFeedbackName(getFeedbackNameParts(feedback || {}).name)
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
      const result = await deleteFeedback(feedback.id, access)
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
      setMessage(next.notification?.sent
        ? `Đã ghi nhận Feedback hoàn tất và thông báo tới Editor ${editorName}.`
        : `Đã ghi nhận Feedback hoàn tất, nhưng chưa xác nhận được thông báo tới Editor ${editorName}.`)
    } catch (err) {
      refresh().catch(() => {})
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
    <main className="h-[100dvh] overflow-hidden bg-slate-50">
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
                    <h1 className="min-w-0 text-[13px] font-semibold leading-snug text-slate-950 lg:truncate lg:text-[16px]">{pageJobTitle}</h1>
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
                        <FeedbackNameInline
                          feedback={feedback}
                          className="flex-1"
                          badgeClassName="text-[12px] font-semibold leading-none text-white lg:text-[13px]"
                          dateInParens
                        />
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
                              <FeedbackNameInline feedback={item} />
                            </Link>
                          ))}
                          <button
                            type="button"
                            onClick={addFeedbackVersion}
                            disabled={newFeedbackDraftOpen}
                            className="flex w-full items-center gap-1.5 border-t border-slate-100 px-3 py-2 text-left text-[12px] font-semibold text-[#f79820] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                            role="menuitem"
                          >
                            <Plus className="h-3.5 w-3.5 shrink-0" />
                            {newFeedbackDraftOpen ? 'Đang nhập...' : 'Thêm bản mới'}
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
            {newFeedbackDraftOpen ? (
              <div className="lg:grid lg:gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(380px,0.85fr)] xl:grid-cols-[minmax(0,2.35fr)_minmax(410px,0.9fr)]">
                <SetupPanel
                  detail={detail}
                  access={access}
	                  mode="create"
	                  defaultName={newFeedbackName}
	                  dateBadge={newFeedbackDateBadge}
	                  cloneUnresolved={newFeedbackCloneUnresolved}
	                  cloneUnresolvedFromFeedbackId={newFeedbackCloneSourceId}
	                  cloneUnresolvedCount={unresolvedCloneCount}
	                  onCreated={handleNewFeedbackCreated}
	                  onCancel={cancelNewFeedbackDraft}
	                />
                <OverallFeedbackPanel feedback={feedback} access={access} onChanged={refresh} fillHeight />
              </div>
            ) : !feedback.video_url && (
              <div className="lg:grid lg:gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(380px,0.85fr)] xl:grid-cols-[minmax(0,2.35fr)_minmax(410px,0.9fr)]">
                <SetupPanel detail={detail} access={access} onSaved={setDetail} />
                <OverallFeedbackPanel feedback={feedback} access={access} onChanged={refresh} fillHeight />
              </div>
            )}
          </div>
        )}

        <section
          ref={feedbackWorkspaceRef}
          className="feedback-detail-workspace mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:grid lg:gap-3"
        >
	          <div ref={videoShellRef} className="min-w-0 shrink-0 overscroll-none lg:h-full lg:self-start">
              <div className="feedback-detail-video-stack mx-auto w-full max-w-full lg:flex lg:h-full lg:flex-col">
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
                    {videoClickToPlayActive && (
                      <button
                        type="button"
                        onClick={playVideoFromShell}
                        className="absolute inset-0 z-10 cursor-pointer bg-transparent focus:outline-none"
                        aria-label="Phát video từ timecode đã chọn"
                      />
                    )}
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
            <div ref={videoTimelineRef}>
              <FeedbackTimelineBar comments={comments} duration={videoDuration} onSelect={selectTimelineComment} />
            </div>
            {feedback.video_url && (
              <div ref={feedbackOverviewSlotRef} className="feedback-overview-slot mt-2 min-h-[120px] lg:min-h-0 lg:flex-1 lg:overflow-hidden">
                <OverallFeedbackPanel feedback={feedback} access={access} onChanged={refresh} fillHeight />
              </div>
            )}
              </div>
          </div>

          <aside className="flex min-h-0 flex-1 flex-col overflow-hidden lg:h-full lg:pr-1">
            <div className="feedback-detail-comment-list min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pb-0">
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

            <form onSubmit={addComment} className="shrink-0 rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 p-2 shadow-[0_-2px_10px_rgba(15,23,42,0.06)] lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
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
              <div className="relative rounded-md border border-slate-200 bg-white px-2.5 pb-2 pt-1.5 focus-within:border-[#f79820] focus-within:ring-2 focus-within:ring-[#f79820]/20 lg:flex lg:min-h-0 lg:flex-1 lg:flex-col">
                <textarea
                  value={commentText}
                  onChange={event => setCommentText(event.target.value)}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent?.isComposing) return
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }}
                  placeholder={'Nhập feedback rồi bấm Enter để gửi\nShift+Enter để xuống dòng'}
                  rows={5}
                  className="block min-h-[100px] w-full resize-none border-0 bg-transparent p-0 pr-10 text-[13px] leading-5 text-slate-900 outline-none placeholder:text-slate-400 lg:min-h-0 lg:flex-1"
                />
                <button type="submit" className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-[#f79820] text-white hover:bg-[#df861d]" aria-label="Gửi feedback">
                  <SendHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          </aside>
	        </section>
        <footer className="mt-2 hidden shrink-0 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-1.5 text-[11px] text-slate-400 lg:block lg:rounded-l-none">
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
              <span>{footerCopyright}</span>
            </div>
          </div>
        </footer>
	      </div>
	      {newFeedbackClonePromptOpen && (
	        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 px-4 py-6">
	          <section className="w-full max-w-[36rem] rounded-lg border border-[#f79820]/40 bg-white p-5 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="feedback-clone-title">
	            <div className="flex items-start gap-3">
	              <span className="mt-0.5 flex h-6 w-5 shrink-0 items-center justify-center text-[#f79820]">
	                <AlertTriangle className="h-4 w-4" />
	              </span>
	              <div className="min-w-0">
	                <h2 id="feedback-clone-title" className="whitespace-nowrap text-[16px] font-semibold leading-6 text-slate-950">
	                  {buildFeedbackCloneTitleText({
	                    editorName: cloneEditorName,
	                    feedbackName: cloneSourceFeedbackName,
	                    count: unresolvedCloneCount,
	                  })}
	                </h2>
	              </div>
	            </div>
	            <p className="mt-3 text-[13px] leading-6 text-slate-600">
	              {buildFeedbackClonePromptText(unresolvedCloneCount)}
	            </p>
	            <div className="mt-5 flex flex-nowrap justify-end gap-2">
	              <button
	                type="button"
	                onClick={cancelNewFeedbackClonePrompt}
	                className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
	              >
	                Hủy
	              </button>
	              <button
	                type="button"
	                onClick={() => chooseNewFeedbackClonePreference(false)}
	                className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-4 text-[13px] font-semibold text-slate-700 hover:bg-slate-50"
	              >
	                Tạo mới mà không clone
	              </button>
	              <button
	                type="button"
	                onClick={() => chooseNewFeedbackClonePreference(true)}
	                className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-[#f79820] px-4 text-[13px] font-semibold text-white hover:bg-[#df861d]"
	              >
	                <Plus className="h-4 w-4" />
	                Có, clone feedback
	              </button>
	            </div>
	          </section>
	        </div>
	      )}
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
                <FeedbackNameInput
                  value={footerFeedbackName}
                  onChange={event => setFooterFeedbackName(event.target.value)}
                  placeholder={buildDefaultFeedbackName(4)}
                  dateBadge={currentFeedbackNameParts.dateBadge}
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
