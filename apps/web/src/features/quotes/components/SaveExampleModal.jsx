import { useEffect, useMemo, useState } from 'react'
import { BookMarked, Save, X } from 'lucide-react'
import { redirectToLoginIfAuthRequired } from '../lib/authRedirect'

const EXPECTED_OUTPUT_ITEM_FIELDS = [
  'service_code',
  'quantity',
  'service_name',
  'service_name_raw',
  'is_custom',
  'unit_price',
  'is_overridden',
  'override_reason',
  'group_code',
  'group_label',
]

function pad(value, length = 2) {
  return String(value).padStart(length, '0')
}

function makeDefaultExampleName() {
  const now = new Date()
  const dateToken = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const random = Math.random().toString(36).slice(2, 6)
  return `chat-${dateToken}-${random}`
}

function pickItemFields(item = {}) {
  const result = {}
  for (const key of EXPECTED_OUTPUT_ITEM_FIELDS) {
    const value = item[key]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && !value.trim()) continue
    result[key] = value
  }
  return result
}

export function buildExpectedOutputSnapshot({ items = [], quote = {} } = {}) {
  const cleanItems = (Array.isArray(items) ? items : []).map(pickItemFields)
  return {
    items: cleanItems,
    location: quote.location || '',
    duration_hours: Number(quote.duration_hours) || 0,
    tier_code: quote.tier_code || 'TIER_2',
    num_days: Number(quote.num_days) || 1,
  }
}

export default function SaveExampleModal({
  open,
  onClose,
  inputText = '',
  items = [],
  quote = {},
  onSaved,
}) {
  const initialOutput = useMemo(
    () => JSON.stringify(buildExpectedOutputSnapshot({ items, quote }), null, 2),
    [items, quote],
  )
  const [name, setName] = useState(() => makeDefaultExampleName())
  const [draftInput, setDraftInput] = useState(inputText)
  const [draftOutput, setDraftOutput] = useState(initialOutput)
  const [notes, setNotes] = useState('')
  const [sortOrder, setSortOrder] = useState(500)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(makeDefaultExampleName())
    setDraftInput(inputText)
    setDraftOutput(initialOutput)
    setNotes('')
    setSortOrder(500)
    setError('')
  }, [open, inputText, initialOutput])

  useEffect(() => {
    if (!open) return undefined
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !saving) onClose?.()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, saving, onClose])

  if (!open) return null

  function formatExpectedOutput() {
    try {
      const parsed = JSON.parse(draftOutput || '{}')
      setDraftOutput(JSON.stringify(parsed, null, 2))
      setError('')
    } catch {
      setError('Không format được — JSON hiện không hợp lệ.')
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving) return

    const trimmedName = String(name || '').trim()
    if (!trimmedName) {
      setError('Vui lòng nhập tên ví dụ (kebab-case).')
      return
    }

    let parsedOutput
    try {
      parsedOutput = JSON.parse(draftOutput || '{}')
    } catch {
      setError('expected_output không phải JSON hợp lệ.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const response = await fetch('/api/pricing-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: 'ai_parse_examples',
          record: {
            name: trimmedName,
            input_text: draftInput || '',
            expected_output: parsedOutput,
            notes: notes || null,
            is_active: true,
            sort_order: Number(sortOrder) || 500,
          },
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        redirectToLoginIfAuthRequired(response, payload)
        throw new Error(payload?.error || 'Không lưu được ví dụ.')
      }
      onSaved?.(payload?.record)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Không lưu được ví dụ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[88vh] w-full max-w-[860px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <BookMarked className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-slate-950">Lưu thành ví dụ huấn luyện</p>
              <p className="mt-1 text-[12px] leading-5 text-slate-600">
                Snapshot brief + bảng hạng mục hiện tại. Lần parse AI tiếp theo sẽ học từ ví dụ này.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-50"
            title="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="text-[12px] font-semibold text-slate-500">name <span className="text-orange-500">*</span></span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              placeholder="chat-20260622-a4f9"
            />
          </label>

          <label>
            <span className="text-[12px] font-semibold text-slate-500">sort_order</span>
            <input
              type="number"
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </label>

          <div className="md:col-span-2">
            <label className="block">
              <span className="text-[12px] font-semibold text-slate-500">input_text (brief sales paste vào)</span>
              <textarea
                value={draftInput}
                onChange={event => setDraftInput(event.target.value)}
                rows={5}
                className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>

          <div className="md:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-500">expected_output (JSON snapshot)</span>
              <button
                type="button"
                onClick={formatExpectedOutput}
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Format JSON
              </button>
            </div>
            <textarea
              value={draftOutput}
              onChange={event => setDraftOutput(event.target.value)}
              rows={14}
              spellCheck={false}
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] leading-5 text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>

          <label className="md:col-span-2">
            <span className="text-[12px] font-semibold text-slate-500">notes (tuỳ chọn)</span>
            <textarea
              value={notes}
              onChange={event => setNotes(event.target.value)}
              rows={2}
              className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              placeholder="Ghi chú gì đặc biệt về ví dụ này (vd: dạy AI nhận MC ngoài khung)..."
            />
          </label>
        </div>

        {error ? (
          <p className="mx-5 mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Đang lưu...' : 'Lưu ví dụ'}
          </button>
        </div>
      </form>
    </div>
  )
}
