import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react'

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN').format(Number(value) || 0)
}

function parseCurrencyInput(value) {
  const clean = String(value || '').replace(/[^\d]/g, '')
  return clean ? Number(clean) : 0
}

function formatHourInput(value) {
  if (value === undefined || value === null || value === '') return ''
  const number = Number(value)
  if (!Number.isFinite(number)) return ''
  return Number.isInteger(number) ? String(number) : String(number).replace(/\.0+$/, '')
}

function getGroupCode(value = '') {
  return String(value || '').trim().toUpperCase()
}

function getServiceName(item) {
  return item.service_name || item.service?.quote_display_name || item.service?.service_name || item.service?.name || item.service_name_raw || item.service_code || 'Hạng mục'
}

function getServiceCode(item) {
  return item.resolved_service_code || item.service_code || 'CUSTOM'
}

function getServiceRawName(item) {
  return item.service?.service_name || item.service_name_raw || ''
}

function getGroupSortOrder(group = {}) {
  const sortOrder = Number(group.group_sort_order)
  return Number.isFinite(sortOrder) ? sortOrder : 99
}

function getGroupTotal(items = []) {
  return items.reduce((sum, entry) => sum + Number(entry.item.total_price || 0), 0)
}

function buildGroups(items = [], groupOptions = []) {
  const groups = new Map()
  const optionMap = new Map()

  groupOptions.forEach((group, index) => {
    const code = getGroupCode(group.group_code)
    if (!code) return
    const option = {
      ...group,
      group_code: code,
      group_label: Object.prototype.hasOwnProperty.call(group, 'group_label') ? String(group.group_label ?? '') : code,
      group_sort_order: getGroupSortOrder(group),
      firstIndex: index,
    }
    optionMap.set(code, option)
    if (group.is_custom_group) {
      groups.set(code, {
        ...option,
        items: [],
      })
    }
  })

  items.forEach((item, index) => {
    const code = getGroupCode(item.group_code) || 'OTHER'
    if (!groups.has(code)) {
      const configuredGroup = optionMap.get(code)
      groups.set(code, {
        ...configuredGroup,
        group_code: code,
        group_label: item.group_label || configuredGroup?.group_label || 'Hạng mục',
        group_sort_order: getGroupSortOrder(item.group_sort_order !== undefined ? item : configuredGroup),
        firstIndex: configuredGroup?.firstIndex ?? index,
        items: [],
      })
    }
    groups.get(code).items.push({ item, index })
  })

  return Array.from(groups.values()).sort((a, b) => (getGroupSortOrder(a) - getGroupSortOrder(b)) || (a.firstIndex - b.firstIndex))
}

function IconButton({ title, disabled, onClick, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  )
}

function RowIconButton({ title, disabled, muted = false, onClick, children }) {
  const colorClass = muted
    ? 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:bg-slate-100 focus:text-slate-600 disabled:hover:text-slate-400'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus:bg-slate-100 focus:text-slate-800 disabled:hover:text-slate-500'

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded focus:outline-none disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${colorClass}`}
    >
      {children}
    </button>
  )
}

function MoveItemControls({ canMoveUp, canMoveDown, onMoveUp, onMoveDown }) {
  return (
    <div className="flex shrink-0 flex-col items-center leading-none">
      <RowIconButton title="Đưa dịch vụ lên" disabled={!canMoveUp} onClick={onMoveUp}>
        <ArrowUp className="h-3 w-3" strokeWidth={2.5} />
      </RowIconButton>
      <RowIconButton title="Đưa dịch vụ xuống" disabled={!canMoveDown} onClick={onMoveDown}>
        <ArrowDown className="h-3 w-3" strokeWidth={2.5} />
      </RowIconButton>
    </div>
  )
}

function QuoteItemRow({
  item,
  index,
  canMoveUp,
  canMoveDown,
  onChangeItem,
  onMoveUp,
  onMoveDown,
  onRemoveItem,
}) {
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const nameInputRef = useRef(null)

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  function startNameEdit() {
    setNameDraft(getServiceName(item))
    setEditingName(true)
  }

  function commitNameEdit() {
    const nextName = nameDraft.trim()
    setEditingName(false)

    if (!nextName) {
      if (item.service_name) onChangeItem?.(index, { service_name: '' })
      return
    }

    if (nextName !== item.service_name) {
      onChangeItem?.(index, { service_name: nextName })
    }
  }

  function cancelNameEdit() {
    setEditingName(false)
    setNameDraft('')
  }

  return (
    <tr className="align-top">
      <td className="py-2 pl-5 pr-3">
        {item.is_custom ? (
          <div className="flex items-start gap-1">
            <textarea
              value={item.service_name || ''}
              rows={1}
              placeholder="Nhập tên hạng mục tùy chỉnh..."
              onChange={event => onChangeItem?.(index, { service_name: event.target.value })}
              className="min-h-8 min-w-0 flex-1 resize-none rounded-lg border border-transparent bg-transparent px-2 py-1 font-medium leading-5 text-black outline-none placeholder:text-slate-400 focus:border-slate-200 focus:bg-white"
            />
            <MoveItemControls
              canMoveUp={canMoveUp}
              canMoveDown={canMoveDown}
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
            />
          </div>
        ) : (
          <div className="grid min-h-8 grid-cols-[minmax(150px,1.7fr)_minmax(90px,1fr)] items-start gap-x-3 gap-y-1.5">
            <div className="min-w-[150px] shrink grow-0">
              {editingName ? (
                <div className="px-2 py-1">
                  <input
                    ref={nameInputRef}
                    value={nameDraft}
                    onChange={event => setNameDraft(event.target.value)}
                    onBlur={commitNameEdit}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        commitNameEdit()
                      } else if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelNameEdit()
                      }
                    }}
                    className="min-h-8 w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-medium leading-5 text-black outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
                  />
                </div>
              ) : (
                <div className="flex items-start gap-1 px-2 py-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start gap-0.5">
                      <span className="min-w-0 break-words font-medium leading-5 text-black">
                        {getServiceName(item)}
                      </span>
                      <RowIconButton title="Sửa tên dịch vụ" muted onClick={startNameEdit}>
                        <Pencil className="h-3 w-3" strokeWidth={2.5} />
                      </RowIconButton>
                    </div>
                    <span
                      title="Mã dịch vụ"
                      className="mt-0.5 inline-flex w-fit rounded-full border border-orange-100/70 bg-orange-50/60 px-1.5 py-0 text-[9px] font-semibold leading-3 text-orange-300"
                    >
                      {getServiceCode(item)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex shrink-0 items-center">
                    <MoveItemControls
                      canMoveUp={canMoveUp}
                      canMoveDown={canMoveDown}
                      onMoveUp={onMoveUp}
                      onMoveDown={onMoveDown}
                    />
                  </div>
                </div>
              )}
            </div>
            {getServiceRawName(item) ? (
              <span className="min-w-0 break-words px-2 py-1 text-[12px] font-medium leading-5 text-slate-500">
                {getServiceRawName(item)}
              </span>
            ) : null}
            {item.is_overridden ? (
              <span className="col-start-2 w-fit rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-semibold leading-4 text-orange-600">
                Đã sửa giá
              </span>
            ) : null}
          </div>
        )}
      </td>
      <td className="px-1.5 py-2">
        <input
          type="number"
          min="0"
          value={item.quantity}
          onChange={event => onChangeItem?.(index, { quantity: Number(event.target.value) })}
          className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
        />
      </td>
      <td className="px-1.5 py-2">
        <input
          type="number"
          min="1"
          value={item.num_sessions}
          onChange={event => onChangeItem?.(index, { num_sessions: Number(event.target.value) })}
          className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
        />
      </td>
      <td className="px-1.5 py-2">
        {item.is_custom ? (
          <div className="rounded-lg border border-transparent px-1.5 py-1.5 text-center text-slate-300">-</div>
        ) : (
          <input
            type="number"
            min="0"
            step="0.5"
            value={formatHourInput(item.billable_duration_hours)}
            onChange={event => onChangeItem?.(index, { billable_duration_hours: Number(event.target.value) || '' })}
            className="w-full rounded-lg border border-slate-200 px-1.5 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
          />
        )}
      </td>
      <td className="px-2 py-2">
        <input
          type="text"
          inputMode="numeric"
          value={formatCurrency(item.unit_price)}
          onChange={event => onChangeItem?.(index, { unit_price: parseCurrencyInput(event.target.value) }, { priceChanged: true })}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-right outline-none focus:border-[#f8981d] focus:ring-2 focus:ring-orange-100"
        />
      </td>
      <td className="py-3 pl-0 pr-0 text-right font-semibold text-slate-900">
        {formatCurrency(item.total_price)}đ
      </td>
      <td className="py-2 pl-0 pr-1 text-right">
        <button
          type="button"
          title="Xóa hạng mục"
          aria-label="Xóa hạng mục"
          onClick={() => onRemoveItem?.(index)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 hover:bg-red-50"
        >
          <Trash2 size={15} strokeWidth={2.2} />
        </button>
      </td>
    </tr>
  )
}

export default function QuoteItemsTable({
  items = [],
  groupOptions = [],
  onChangeItem,
  onRemoveItem,
  onAddService,
  onAddCustomItem,
  onAddGroup,
  onRenameGroup,
  onMoveGroup,
  onMoveItem,
  onRemoveGroup,
}) {
  const groups = buildGroups(items, groupOptions)
  const useCompactSingleGroup = groups.length === 1 && groups[0]?.is_implicit_group
  const showGroupControls = !useCompactSingleGroup

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold text-slate-900">Hạng mục báo giá</h3>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {useCompactSingleGroup ? (
            <>
              <button
                type="button"
                onClick={() => onAddService?.(groups[0])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-700 hover:bg-orange-100"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm dịch vụ
              </button>
              <button
                type="button"
                onClick={() => onAddCustomItem?.(groups[0])}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Custom item
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onAddGroup}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm nhóm
          </button>
        </div>
      </div>

      <div>
        {groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-[13px] text-slate-400">
            Chưa có hạng mục.
          </div>
        ) : groups.map((group, groupIndex) => (
          <section key={group.group_code} className="overflow-hidden border-t border-slate-200 first:border-t-0">
            {showGroupControls ? (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-4 py-3">
                <div className="flex min-w-[220px] flex-[0_1_360px] items-center gap-2">
                  <input
                    value={group.group_label || ''}
                    onChange={event => onRenameGroup?.(group, event.target.value)}
                    className="min-w-0 flex-[0_1_80%] rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-semibold text-slate-900 outline-none focus:border-[#f8981d] focus:bg-white focus:ring-2 focus:ring-orange-100"
                  />
                  <div className="flex shrink-0 gap-1">
                    <IconButton title="Đưa nhóm lên" disabled={groupIndex === 0} onClick={() => onMoveGroup?.(group, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton title="Đưa nhóm xuống" disabled={groupIndex === groups.length - 1} onClick={() => onMoveGroup?.(group, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton title="Xóa nhóm" onClick={() => onRemoveGroup?.(group, group.items.length)}>
                      <Trash2 className="h-3.5 w-3.5 text-slate-500" />
                    </IconButton>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onAddService?.(group)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[12px] font-semibold text-orange-700 hover:bg-orange-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Thêm dịch vụ
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddCustomItem?.(group)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Custom item
                  </button>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden">
              <table className="w-full table-fixed text-left text-[13px]">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="w-[51%] py-3 pl-5 pr-3 font-semibold">Dịch vụ</th>
                    <th className="w-[6%] px-1.5 py-3 text-center font-semibold">SL</th>
                    <th className="w-[7%] px-1.5 py-3 text-center font-semibold">Số buổi</th>
                    <th className="w-[8%] px-1.5 py-3 text-center font-semibold">Giờ tính</th>
                    <th className="w-[13%] px-2 py-3 text-right font-semibold">Đơn giá</th>
                    <th className="w-[10%] py-3 pl-0 pr-0 text-right font-semibold">Thành tiền</th>
                    <th className="w-[4%] py-3 pl-0 pr-1" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {group.items.length ? group.items.map(({ item, index }, itemIndex) => {
                    const previousItem = group.items[itemIndex - 1]
                    const nextItem = group.items[itemIndex + 1]

                    return (
                      <QuoteItemRow
                        key={item.local_id || index}
                        item={item}
                        index={index}
                        canMoveUp={Boolean(previousItem)}
                        canMoveDown={Boolean(nextItem)}
                        onChangeItem={onChangeItem}
                        onMoveUp={() => onMoveItem?.(index, previousItem?.index)}
                        onMoveDown={() => onMoveItem?.(index, nextItem?.index)}
                        onRemoveItem={onRemoveItem}
                      />
                    )
                  }) : (
                    <tr>
                      <td colSpan={7} className="px-5 py-5 text-center text-[13px] text-slate-400">
                        Chưa có hạng mục trong nhóm này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-4 border-t border-slate-100 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700">
              <span>Tạm tính nhóm</span>
              <span>{formatCurrency(getGroupTotal(group.items))}đ</span>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
