import { useEffect, useMemo, useState } from 'react'
import { BookMarked, ChevronDown, ChevronRight, Save, X } from 'lucide-react'
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

const VND_FORMATTER = new Intl.NumberFormat('vi-VN')

function formatPrice(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return 'Theo bảng giá'
  return VND_FORMATTER.format(number)
}

function formatTier(code) {
  const raw = String(code || '').trim()
  if (!raw) return '—'
  const match = raw.match(/^TIER_(\d+)$/i)
  return match ? `Tier ${match[1]}` : raw
}

function buildContextSummary(quote = {}) {
  const parts = []
  if (quote.location) parts.push(String(quote.location))
  const hours = Number(quote.duration_hours) || 0
  if (hours > 0) parts.push(`${hours} tiếng`)
  parts.push(formatTier(quote.tier_code))
  const days = Number(quote.num_days) || 1
  parts.push(`${days} ngày`)
  return parts.join(' · ')
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
  const [sortOrder, setSortOrder] = useState(500)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(makeDefaultExampleName())
    setDraftInput(inputText)
    setDraftOutput(initialOutput)
    setSortOrder(500)
    setAdvancedOpen(false)
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

  const cleanedItems = useMemo(
    () => (Array.isArray(items) ? items : []).map(pickItemFields).filter(item => item && (item.service_code || item.service_name)),
    [items],
  )
  const hasItems = cleanedItems.length > 0
  const hasBrief = String(draftInput || '').trim().length > 0
  const canSubmit = hasItems && hasBrief && !saving

  const validationHint = (() => {
    if (!hasBrief) return 'Cần dán brief gốc thì AI mới biết khi nào áp dụng ví dụ này.'
    if (!hasItems) return 'Bảng hạng mục đang trống — chưa có gì để dạy AI.'
    return ''
  })()

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
    if (!canSubmit) return

    const trimmedName = String(name || '').trim()
    if (!trimmedName) {
      setError('Vui lòng nhập tên ví dụ (kebab-case).')
      setAdvancedOpen(true)
      return
    }

    let parsedOutput
    try {
      parsedOutput = JSON.parse(draftOutput || '{}')
    } catch {
      setError('expected_output không phải JSON hợp lệ.')
      setAdvancedOpen(true)
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
            notes: null,
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

  const contextSummary = buildContextSummary(quote)

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
                Lần parse AI tiếp theo sẽ học theo cách bạn vừa sửa bảng hạng mục.
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

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
          <div className="rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 text-[12px] leading-5 text-slate-700">
            <p className="font-semibold text-slate-800">Khi nào nên lưu?</p>
            <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
              <li>Kiểm tra bảng <span className="font-semibold">Hạng mục báo giá</span> bên dưới.</li>
              <li>Nếu AI parse sai → sửa tay (số lượng, dịch vụ, giá…) trước khi mở popup này.</li>
              <li>Khi bảng đã đúng → bấm <span className="font-semibold">Lưu ví dụ</span> để dạy AI.</li>
            </ol>
          </div>

          <div>
            <label className="block">
              <span className="text-[12px] font-semibold text-slate-500">① Brief gốc của khách</span>
              <textarea
                value={draftInput}
                onChange={event => setDraftInput(event.target.value)}
                rows={5}
                placeholder="Dán đoạn chat / brief sales nhận được từ khách ở đây."
                className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] leading-5 text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </label>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold text-slate-500">
                ② AI sẽ học {cleanedItems.length} hạng mục bạn đã sửa
              </span>
              <span className="text-[11px] text-slate-400">(chỉ xem — sửa ở bảng Hạng mục báo giá bên ngoài)</span>
            </div>
            {hasItems ? (
              <div className="mt-1 overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-slate-50 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Hạng mục</th>
                      <th className="px-3 py-2 text-right">SL</th>
                      <th className="px-3 py-2 text-right">Đơn giá</th>
                      <th className="px-3 py-2 text-left">Nhóm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cleanedItems.map((item, index) => {
                      const displayName = item.service_name || item.service_name_raw || item.service_code || '—'
                      const overridden = Boolean(item.is_overridden)
                      const custom = Boolean(item.is_custom)
                      return (
                        <tr key={`${item.service_code || displayName}-${index}`} className="text-slate-700">
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-slate-800">{displayName}</span>
                              {custom ? (
                                <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                                  custom
                                </span>
                              ) : null}
                              {overridden ? (
                                <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                                  giá chốt
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{Number(item.quantity) || 0}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatPrice(item.unit_price)}</td>
                          <td className="px-3 py-2 text-slate-500">{item.group_label || item.group_code || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-1 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[12px] text-slate-500">
                Bảng hạng mục đang trống — chưa có gì để dạy AI.
              </div>
            )}
            {contextSummary ? (
              <p className="mt-2 text-[12px] text-slate-500">
                <span className="font-semibold text-slate-600">Bối cảnh:</span> {contextSummary}
              </p>
            ) : null}
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/60">
            <button
              type="button"
              onClick={() => setAdvancedOpen(value => !value)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-[12px] font-semibold text-slate-600 hover:text-slate-800"
            >
              <span className="inline-flex items-center gap-1.5">
                {advancedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                Tuỳ chọn nâng cao
              </span>
              <span className="text-[11px] font-normal text-slate-400">
                Tên ví dụ · thứ tự ưu tiên · JSON thô
              </span>
            </button>

            {advancedOpen ? (
              <div className="grid gap-3 border-t border-slate-200 px-4 py-3 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">name (slug)</span>
                  <input
                    value={name}
                    onChange={event => setName(event.target.value)}
                    spellCheck={false}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] font-mono text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                    placeholder="chat-20260622-a4f9"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">Auto-gen kebab-case. Đổi nếu muốn slug riêng.</span>
                </label>

                <label>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">sort_order</span>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={event => setSortOrder(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">Số nhỏ = ưu tiên cao trong prompt.</span>
                </label>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">expected_output (JSON snapshot)</span>
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
                    rows={10}
                    spellCheck={false}
                    className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12px] leading-5 text-slate-800 outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">JSON này được tự sinh từ bảng hạng mục. Chỉ chỉnh khi cần debug.</span>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <p className="mx-5 mb-3 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          <p className="text-[11.5px] text-slate-500">
            {validationHint || '💡 Ví dụ tốt = brief khó + bảng đã sửa đúng. Bỏ qua nếu AI đã parse sẵn đúng.'}
          </p>
          <div className="flex items-center gap-2">
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
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              title={canSubmit ? 'Lưu ví dụ huấn luyện' : validationHint}
            >
              <Save className="h-4 w-4" />
              {saving ? 'Đang lưu...' : 'Lưu ví dụ'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
