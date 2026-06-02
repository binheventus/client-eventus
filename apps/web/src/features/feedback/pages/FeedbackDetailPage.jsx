import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  BellRing,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Film,
  FileUp,
  Save,
  SendHorizontal,
  Trash2,
  Video,
  X,
} from 'lucide-react'
import {
  createFeedback,
  createFeedbackComment,
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
  formatFeedbackDate,
  formatFeedbackDateTime,
  formatTimeline,
  getFeedbackAccessFromSearch,
  getFeedbackPublicPath,
  getFeedbackVideoEmbedUrl,
  readFileAsDataUrl,
} from '../lib/feedbackFormat'

function Alert({ type = 'info', children, className = '' }) {
  const styles = type === 'error'
    ? 'border-rose-200 bg-rose-50 text-rose-700'
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
  const [editorId, setEditorId] = useState('')
  const [videoUrl, setVideoUrl] = useState(feedback.video_url || '')
  const [driveUrl, setDriveUrl] = useState(feedback.drive_url || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const nextDetail = await saveFeedbackSetup(feedback.id, {
        editor_employee_id: editorId || undefined,
        video_url: videoUrl,
        drive_url: driveUrl,
      }, access)
      onSaved(nextDetail)
    } catch (err) {
      setError(err?.message || 'Không lưu được thông tin feedback.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f79820] text-white">
          <Video className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-[16px] font-semibold text-slate-950">Hoàn tất thông tin để mở Feedback</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        {!existingEditorName && (
          <div className="md:col-span-3">
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

        {error && <div className="md:col-span-3"><Alert type="error">{error}</Alert></div>}
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

function CommentCard({ comment, showSecondColumn, access, onChanged, onSeek }) {
  const image = comment.image_comment_1 || comment.image_comment_2
  const [uploading, setUploading] = useState(false)
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
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await readFileAsDataUrl(file)
      await uploadFeedbackAttachment(comment.id, {
        file_name: file.name,
        data_url: dataUrl,
        field_name: 'comment_1',
      }, access)
      onChanged()
    } finally {
      setUploading(false)
    }
  }

  return (
    <article className="group">
      <div className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:border-slate-300">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSeek(comment.time_comment_1)}
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ring-1 ${
                comment.is_done_1
                  ? 'bg-blue-500 ring-blue-500 hover:bg-blue-600'
                  : 'bg-[#f79820] ring-[#f79820] hover:bg-[#df861d]'
              }`}
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
            <label className="inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#f79820]/40 bg-white px-2 text-[11px] font-semibold text-[#f79820] hover:bg-[#f79820]/10" title="Upload file">
              <FileUp className="h-3 w-3" />
              <span>{uploading ? 'Đang upload' : 'Upload'}</span>
              <input type="file" className="hidden" onChange={upload} />
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
      </div>
    </article>
  )
}

function OverallFeedbackPanel({ feedback, access, onChanged }) {
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
    <section onMouseLeave={save} className="rounded-lg border border-[#f79820]/30 bg-[#f79820]/10 p-2.5 shadow-sm">
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

export default function FeedbackDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const access = useMemo(() => getFeedbackAccessFromSearch(location.search, id), [id, location.search])
  const videoShellRef = useRef(null)
  const feedbackMenuRef = useRef(null)
  const footerStatusTimerRef = useRef(null)
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [footerStatus, setFooterStatus] = useState('')
  const [footerEditorOpen, setFooterEditorOpen] = useState(false)
  const [footerVideoUrl, setFooterVideoUrl] = useState('')
  const [footerDriveUrl, setFooterDriveUrl] = useState('')
  const [savingFooterLinks, setSavingFooterLinks] = useState(false)
  const [footerEditorError, setFooterEditorError] = useState('')
  const [commentText, setCommentText] = useState('')
  const [feedbackAuthorName, setFeedbackAuthorName] = useState('')
  const [currentVideoTime, setCurrentVideoTime] = useState(0)
  const [notifyingEditor, setNotifyingEditor] = useState(false)
  const [creatingFeedbackVersion, setCreatingFeedbackVersion] = useState(false)
  const [feedbackMenuOpen, setFeedbackMenuOpen] = useState(false)

  const feedback = detail?.feedback
  const comments = detail?.comments || []
  const feedbackVersions = detail?.feedbacks || []
  const embedUrl = getFeedbackVideoEmbedUrl(feedback?.video_url)
  const fourKDownloadUrl = feedback?.drive_url || ''
  const videoSurveyUrl = feedback?.job_id ? `/survey?type=video&job=${encodeURIComponent(feedback.job_id)}` : ''
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
  }, [])

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

  useEffect(() => {
    if (!embedUrl) return undefined

    function handleMessage(event) {
      if (!String(event.origin || '').includes('youtube.com')) return

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
    }

    function requestCurrentTime() {
      const iframe = document.getElementById('feedback-youtube-player')
      if (!iframe?.contentWindow) return
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'feedback-youtube-player' }), '*')
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }), '*')
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

  function seekTo(seconds) {
    const iframe = document.getElementById('feedback-youtube-player')
    if (!iframe || !embedUrl) return
    setCurrentVideoTime(Math.max(0, Number(seconds) || 0))
    const video = embedUrl.replace('enablejsapi=1', `enablejsapi=1&start=${Math.floor(Number(seconds) || 0)}`)
    iframe.src = video
  }

  async function addFeedbackVersion() {
    if (!feedback?.id) return
    setFeedbackMenuOpen(false)
    setCreatingFeedbackVersion(true)
    setError('')
    try {
      const nextFeedback = await createFeedback({
        feedbackId: feedback.id,
        access,
        feedback: { name: `Feedback ${feedbackVersions.length + 1}` },
      })
      navigate(getFeedbackPublicPath(nextFeedback))
    } catch (err) {
      setError(err?.message || 'Không tạo được bản feedback mới.')
    } finally {
      setCreatingFeedbackVersion(false)
    }
  }

  function openFooterEditor() {
    setFooterVideoUrl(feedback?.video_url || '')
    setFooterDriveUrl(feedback?.drive_url || '')
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
        video_url: footerVideoUrl.trim(),
        drive_url: footerDriveUrl.trim(),
      }, access)
      setDetail(nextDetail)
      setFooterEditorOpen(false)
      setFooterStatus('Đã cập nhật link')
      if (footerStatusTimerRef.current) window.clearTimeout(footerStatusTimerRef.current)
      footerStatusTimerRef.current = window.setTimeout(() => setFooterStatus(''), 2000)
    } catch (err) {
      setFooterEditorError(err?.message || 'Không cập nhật được link.')
    } finally {
      setSavingFooterLinks(false)
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
                        <span className="min-w-0 truncate">{feedback.name || 'Feedback'} · {formatFeedbackDate(feedback.job?.job_date)}</span>
                        <ChevronDown className={`h-4 w-4 shrink-0 text-white transition ${feedbackMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {feedbackMenuOpen && (
                        <div className="absolute left-0 z-20 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg" role="menu">
                          {(detail.feedbacks || []).map(item => (
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
                            className="block w-full border-t border-slate-100 px-3 py-2 text-left text-[12px] font-semibold text-[#f79820] hover:bg-[#fff7ed] disabled:cursor-not-allowed disabled:opacity-60"
                            role="menuitem"
                          >
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
            {!feedback.video_url && <SetupPanel detail={detail} access={access} onSaved={setDetail} />}
          </div>
        )}

        <section className="mt-2 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden lg:grid lg:gap-3 lg:grid-cols-[minmax(0,2.2fr)_minmax(380px,0.85fr)] xl:grid-cols-[minmax(0,2.35fr)_minmax(410px,0.9fr)]">
          <div ref={videoShellRef} className="shrink-0 overscroll-none lg:sticky lg:top-2 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:self-start">
            <div className="min-h-0 overflow-hidden overscroll-none rounded-lg border border-slate-200 bg-white shadow-sm lg:flex-1 lg:rounded-l-none">
              {embedUrl ? (
                <div className="aspect-video bg-slate-950 lg:h-full lg:aspect-auto">
                  <iframe
                    id="feedback-youtube-player"
                    title={feedback.video_title || feedback.name || 'Feedback video'}
                    src={embedUrl}
                    className="h-full w-full overscroll-none"
                    scrolling="no"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="grid aspect-video place-items-center bg-slate-100 text-center lg:h-full lg:aspect-auto">
                  <div>
                    <Video className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-[13px] font-semibold text-slate-500">Chưa có video để hiển thị.</p>
                  </div>
                </div>
              )}
            </div>
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
              <OverallFeedbackPanel feedback={feedback} access={access} onChanged={refresh} />

              {comments.length ? comments.map(comment => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  showSecondColumn={feedback.more_column}
                  access={access}
                  onChanged={refresh}
                  onSeek={seekTo}
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
              <h2 id="feedback-link-editor-title" className="text-[16px] font-semibold text-slate-950">Cập nhật link Feedback</h2>
              <button
                type="button"
                onClick={() => setFooterEditorOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Đóng popup"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={saveFooterLinks} className="mt-4 space-y-4">
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
    </main>
  )
}
