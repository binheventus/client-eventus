import { useEffect, useMemo, useState } from 'react'
import {
  addHrEmployeeNote,
  canUseHrInsightsBackend,
  deleteHrEmployeeNote,
  fetchHrEmployeeDetail,
  fetchHrEmployees,
  saveHrEmployeeInsight,
  updateHrEmployeeNote,
} from '../lib/hrInsightsService'

const demoEmployees = [
  {
    id: 'demo-an-nguyen',
    name: 'An Nguyen',
    initials: 'AN',
    role: 'Sales Manager',
    birthday: '1995-06-15',
    joinedAt: '2022-03-01',
    hometown: 'Hải Phòng',
    education: 'Đại học Kinh tế Quốc dân',
    avatarBg: 'from-slate-300 via-slate-100 to-teal-100',
    interests: 'Phát triển kỹ năng lãnh đạo, thể thao',
    analysis: 'Chủ động, cầu tiến, chịu áp lực tốt',
    motivateAction: 'Ghi nhận thành tích trước team (21/05)',
    developAction: 'Tham gia khóa leadership (15/06)',
    updatedAt: '2024-05-18',
  },
  {
    id: 'demo-binh-tran',
    name: 'Binh Trần',
    initials: 'BT',
    role: 'Operations Lead',
    birthday: null,
    joinedAt: null,
    hometown: '',
    education: '',
    avatarBg: 'from-orange-200 via-white to-blue-100',
    interests: 'Công nghệ, tối ưu quy trình',
    analysis: 'Tư duy logic tốt, ít chia sẻ ý kiến',
    motivateAction: '1:1 meeting, feedback (20/05)',
    developAction: 'Đào tạo kỹ năng communication (10/06)',
    updatedAt: '2024-05-17',
  },
  {
    id: 'demo-linh-pham',
    name: 'Linh Phạm',
    initials: 'LP',
    role: 'HR Specialist',
    birthday: null,
    joinedAt: null,
    hometown: '',
    education: '',
    avatarBg: 'from-slate-200 via-white to-emerald-100',
    interests: 'Môi trường làm việc tích cực',
    analysis: 'Tỉ mỉ, chu đáo, đôi khi quá cầu toàn',
    motivateAction: 'Thư cảm ơn cá nhân (22/05)',
    developAction: 'Khóa time management (12/06)',
    updatedAt: '2024-05-16',
  },
  {
    id: 'demo-minh-le',
    name: 'Minh Lê',
    initials: 'ML',
    role: 'Product Owner',
    birthday: null,
    joinedAt: null,
    hometown: '',
    education: '',
    avatarBg: 'from-slate-400 via-slate-100 to-slate-200',
    interests: 'Sản phẩm, người dùng, đổi mới',
    analysis: 'Sáng tạo, nhanh nhạy, đôi khi thiếu kiên nhẫn',
    motivateAction: 'Chia sẻ feedback khách hàng (19/05)',
    developAction: 'Mentor 1:1 với PO senior (08/06)',
    updatedAt: '2024-05-15',
  },
  {
    id: 'demo-phuong-do',
    name: 'Phương Đỗ',
    initials: 'PD',
    role: 'Marketing Lead',
    birthday: null,
    joinedAt: null,
    hometown: '',
    education: '',
    avatarBg: 'from-blue-100 via-white to-pink-100',
    interests: 'Thương hiệu, chiến lược marketing',
    analysis: 'Năng động, giao tiếp tốt, cần định hướng rõ hơn',
    motivateAction: 'Khen trong meeting (18/05)',
    developAction: 'Khóa brand strategy (05/06)',
    updatedAt: '2024-05-14',
  },
]

const demoInsight = {
  rememberTags: [
    'Thích thử thách, mục tiêu cao',
    'Muốn phát triển kỹ năng leadership',
    'Cần công nhận kịp thời',
    'Quan tâm đến chiến lược & tư duy dài hạn',
  ],
  goals: [
    'Phát triển kỹ năng leadership, có cơ hội dẫn dắt team.',
    'Học thêm về chiến lược bán hàng & đàm phán.',
    'Được tham gia các dự án lớn, ảnh hưởng nhiều hơn.',
  ],
  overview:
    'An là nhân sự có xu hướng chủ động, thích mục tiêu rõ ràng và phù hợp với các dự án có độ thử thách cao. Nên tiếp tục giao việc có quyền quyết định để kiểm tra năng lực lead.',
}

const demoNotes = [
  {
    id: 'demo-note-1',
    date: '2024-05-21',
    type: '1-1 định kỳ',
    author: 'Hoàng Nguyễn (Bạn)',
    points: [
      'Cảm thấy gần đây workload khá cao, nhiều việc dồn lại cùng lúc.',
      'Muốn được học thêm về chiến lược bán hàng & kỹ năng đàm phán.',
      'Rất thích dự án mới với khách hàng ABC, muốn tiếp tục tham gia sâu hơn.',
      'Đề xuất cải thiện quy trình báo cáo để tiết kiệm thời gian.',
    ],
  },
  {
    id: 'demo-note-2',
    date: '2024-04-15',
    type: '1-1 định kỳ',
    author: 'Hoàng Nguyễn (Bạn)',
    points: [
      'Chia sẻ đang hơi áp lực vì KPI quý 2 cao hơn quý 1.',
      'Cần hỗ trợ thêm về data khách hàng để tăng hiệu quả chốt deal.',
      'Muốn được công nhận nhiều hơn khi team đạt kết quả tốt.',
    ],
  },
  {
    id: 'demo-note-3',
    date: '2024-03-18',
    type: '1-1 định kỳ',
    author: 'Hoàng Nguyễn (Bạn)',
    points: [
      'Hào hứng với vị trí hiện tại, cảm thấy phù hợp với định hướng phát triển.',
      'Mong muốn trong 6-12 tháng tới có thể lead một nhóm nhỏ.',
      'Thích môi trường tự do, tin tưởng và ít kiểm soát vi mô.',
    ],
  },
]

function formatDate(value) {
  if (!value) return 'Chưa cập nhật'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('vi-VN')
}

function yearsBetween(fromDate) {
  if (!fromDate) return 'Chưa cập nhật'
  const start = new Date(fromDate)
  if (Number.isNaN(start.getTime())) return 'Chưa cập nhật'
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 1) return 'Dưới 1 tháng'
  const years = Math.floor(months / 12)
  const remainMonths = months % 12
  if (!years) return `${remainMonths} tháng`
  if (!remainMonths) return `${years} năm`
  return `${years} năm ${remainMonths} tháng`
}

function listToText(items = []) {
  return items.join('\n')
}

function textToList(value = '') {
  return value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
}

function EditButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-blue-700 transition hover:bg-blue-50"
    >
      <span>✎</span>
      <span>Chỉnh sửa</span>
    </button>
  )
}

function Panel({ title, children, editable = false, onEdit }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold tracking-tight text-slate-900">{title}</h3>
        {editable && <EditButton onClick={onEdit} />}
      </div>
      {children}
    </section>
  )
}

function EditableTextarea({ value, onChange, onDone, rows = 4, saving = false }) {
  return (
    <div className="space-y-3">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="min-h-[120px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
      />
      <button
        onClick={onDone}
        disabled={saving}
        className="rounded-lg bg-slate-900 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
      >
        {saving ? 'Đang lưu...' : 'Xong'}
      </button>
    </div>
  )
}

export default function HRInsightsPage() {
  const [employees, setEmployees] = useState(demoEmployees)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null)
  const [notes, setNotes] = useState(demoNotes)
  const [insight, setInsight] = useState(demoInsight)
  const [editingPanel, setEditingPanel] = useState(null)
  const [editingValue, setEditingValue] = useState('')
  const [loading, setLoading] = useState(canUseHrInsightsBackend)
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteDate, setNoteDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [noteContent, setNoteContent] = useState('')
  const [noteMenuId, setNoteMenuId] = useState(null)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [editingNoteDate, setEditingNoteDate] = useState('')
  const [editingNoteContent, setEditingNoteContent] = useState('')

  useEffect(() => {
    if (!canUseHrInsightsBackend) return

    let mounted = true
    setLoading(true)
    fetchHrEmployees()
      .then(rows => {
        if (!mounted) return
        if (rows.length) setEmployees(rows)
      })
      .catch(() => {
        if (mounted) setError('Chưa tải được dữ liệu HR Insights từ Supabase. Đang hiển thị dữ liệu demo.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const selectedEmployee = useMemo(
    () => employees.find(item => item.id === selectedEmployeeId) || employees[0],
    [employees, selectedEmployeeId]
  )

  useEffect(() => {
    if (!selectedEmployeeId) return

    if (!canUseHrInsightsBackend || String(selectedEmployeeId).startsWith('demo-')) {
      setNotes(demoNotes)
      setInsight(demoInsight)
      return
    }

    let mounted = true
    setDetailLoading(true)
    fetchHrEmployeeDetail(selectedEmployeeId)
      .then(detail => {
        if (!mounted || !detail) return
        setNotes(detail.notes.length ? detail.notes : [])
        setInsight({
          rememberTags: detail.insight.rememberTags,
          goals: detail.insight.goals,
          overview: detail.insight.overview || demoInsight.overview,
        })
      })
      .catch(() => {
        if (mounted) setError('Chưa tải được chi tiết nhân viên. Đang hiển thị dữ liệu demo.')
      })
      .finally(() => {
        if (mounted) setDetailLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [selectedEmployeeId])

  function startEdit(panel) {
    setEditingPanel(panel)
    if (panel === 'remember') setEditingValue(listToText(insight.rememberTags))
    if (panel === 'goals') setEditingValue(listToText(insight.goals))
    if (panel === 'overview') setEditingValue(insight.overview || '')
  }

  async function savePanel() {
    const nextInsight = {
      ...insight,
      rememberTags: editingPanel === 'remember' ? textToList(editingValue) : insight.rememberTags,
      goals: editingPanel === 'goals' ? textToList(editingValue) : insight.goals,
      overview: editingPanel === 'overview' ? editingValue.trim() : insight.overview,
    }

    setSaving(true)
    setInsight(nextInsight)

    try {
      if (canUseHrInsightsBackend && selectedEmployeeId && !String(selectedEmployeeId).startsWith('demo-')) {
        const saved = await saveHrEmployeeInsight(selectedEmployeeId, nextInsight)
        if (saved) setInsight(saved)
      }
      setEditingPanel(null)
      setEditingValue('')
    } catch {
      setError('Chưa lưu được thay đổi lên Supabase.')
    } finally {
      setSaving(false)
    }
  }

  async function saveNewNote() {
    const points = textToList(noteContent)
    if (!noteDate || !points.length) {
      setError('Vui lòng nhập ngày 1-1 và nội dung ghi chú.')
      return
    }

    const draftNote = {
      id: `draft-${Date.now()}`,
      date: noteDate,
      type: '1-1 định kỳ',
      author: 'Hoàng Nguyễn (Bạn)',
      points,
    }

    setNotes(prev => [draftNote, ...prev])
    setShowNoteForm(false)
    setNoteDate(new Date().toISOString().slice(0, 10))
    setNoteContent('')
    setError('')

    try {
      if (canUseHrInsightsBackend && selectedEmployeeId && !String(selectedEmployeeId).startsWith('demo-')) {
        const saved = await addHrEmployeeNote(selectedEmployeeId, draftNote)
        if (saved) {
          setNotes(prev => prev.map(note => (note.id === draftNote.id ? saved : note)))
        }
      }
    } catch {
      setError('Chưa lưu được ghi chú mới lên Supabase.')
    }
  }

  function startEditNote(note) {
    setNoteMenuId(null)
    setEditingNoteId(note.id)
    setEditingNoteDate(note.date ? new Date(note.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10))
    setEditingNoteContent(listToText(note.points))
  }

  async function saveEditedNote(note) {
    const points = textToList(editingNoteContent)
    if (!editingNoteDate || !points.length) {
      setError('Vui lòng nhập ngày 1-1 và nội dung ghi chú.')
      return
    }

    const nextNote = {
      ...note,
      date: editingNoteDate,
      points,
    }

    setNotes(prev => prev.map(item => (item.id === note.id ? nextNote : item)))
    setEditingNoteId(null)
    setEditingNoteDate('')
    setEditingNoteContent('')
    setError('')

    try {
      if (canUseHrInsightsBackend && !String(note.id).startsWith('demo-') && !String(note.id).startsWith('draft-')) {
        const saved = await updateHrEmployeeNote(note.id, nextNote)
        if (saved) setNotes(prev => prev.map(item => (item.id === note.id ? saved : item)))
      }
    } catch {
      setError('Chưa lưu được thay đổi ghi chú lên Supabase.')
    }
  }

  async function deleteNote(note) {
    setNoteMenuId(null)
    const confirmed = window.confirm('Bạn có chắc muốn xóa ghi chú này không?')
    if (!confirmed) return

    setNotes(prev => prev.filter(item => item.id !== note.id))

    try {
      if (canUseHrInsightsBackend && !String(note.id).startsWith('demo-') && !String(note.id).startsWith('draft-')) {
        await deleteHrEmployeeNote(note.id)
      }
    } catch {
      setError('Chưa xóa được ghi chú trên Supabase.')
    }
  }

  if (!selectedEmployeeId) {
    return (
      <EmployeeList
        employees={employees}
        loading={loading}
        error={error}
        onSelectEmployee={(id) => {
          setSelectedEmployeeId(id)
          setError('')
        }}
      />
    )
  }

  const meta = [
    { icon: '▣', label: 'Thâm niên', value: yearsBetween(selectedEmployee.joinedAt) },
    { icon: '◷', label: 'Lần 1:1 gần nhất', value: notes[0]?.date ? formatDate(notes[0].date) : 'Chưa cập nhật' },
    { icon: '⌖', label: 'Quê quán', value: selectedEmployee.hometown || 'Chưa cập nhật' },
    { icon: '◇', label: 'Học vấn', value: selectedEmployee.education || 'Chưa cập nhật' },
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-white text-slate-900">
      <div className="w-full space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px] text-slate-500">
            <button
              onClick={() => setSelectedEmployeeId(null)}
              className="font-medium text-blue-700 transition hover:text-teal-700"
            >
              Hiểu nhân viên
            </button>
            <span>›</span>
            <span>{selectedEmployee.name}</span>
          </div>
          {error && <span className="rounded-full bg-orange-50 px-3 py-1 text-[12px] text-orange-700 ring-1 ring-orange-100">{error}</span>}
        </div>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br ${selectedEmployee.avatarBg} text-[22px] font-semibold text-slate-700 ring-1 ring-slate-200`}>
              {selectedEmployee.initials}
            </div>

            <div className="min-w-0 pt-1">
              <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-slate-950">
                {selectedEmployee.name}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <span className="text-slate-400">▦</span>
                  Ngày sinh: {formatDate(selectedEmployee.birthday)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-slate-400">⌁</span>
                  Nhân viên từ: {formatDate(selectedEmployee.joinedAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {meta.map(item => (
              <div key={item.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[18px] text-blue-700">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] text-slate-500">{item.label}</p>
                    <p className="mt-1 text-[14px] font-semibold leading-5 text-blue-700">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,58fr)_minmax(380px,42fr)]">
          <main className="min-w-0">
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-950">Ghi chú các buổi 1-1</h2>
                    <p className="mt-1 text-[13px] leading-6 text-slate-500">
                      Lưu lại những chia sẻ, cảm xúc, mong muốn và phản hồi từ nhân viên
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowNoteForm(true)
                      setError('')
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm shadow-blue-200/60 transition hover:bg-teal-700"
                  >
                    <span className="text-[16px] leading-none">+</span>
                    Thêm ghi chú
                  </button>
                </div>

                {showNoteForm && (
                  <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                    <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)]">
                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Ngày 1-1</span>
                        <input
                          type="date"
                          value={noteDate}
                          onChange={(event) => setNoteDate(event.target.value)}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Nội dung</span>
                        <textarea
                          value={noteContent}
                          onChange={(event) => setNoteContent(event.target.value)}
                          rows={4}
                          placeholder="Mỗi dòng sẽ hiển thị thành một bullet trong ghi chú."
                          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] leading-6 text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setShowNoteForm(false)
                          setNoteContent('')
                          setError('')
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button
                        onClick={saveNewNote}
                        className="rounded-lg bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-5 py-2 text-[13px] font-semibold text-white shadow-sm shadow-blue-200/60 transition hover:bg-teal-700"
                      >
                        Lưu ghi chú
                      </button>
                    </div>
                  </div>
                )}

                {detailLoading ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-[13px] text-slate-500">Đang tải ghi chú...</div>
                ) : (
                  <div className="relative space-y-4 pl-7 before:absolute before:bottom-0 before:left-[9px] before:top-2 before:w-px before:bg-slate-200">
                    {notes.map(note => (
                      <article key={note.id} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <span className="absolute -left-[30px] top-4 h-3 w-3 rounded-full border-2 border-blue-600 bg-white ring-4 ring-white" />
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="text-[13px] text-slate-500">
                            <span>{formatDate(note.date)}</span>
                            <span className="mx-2">•</span>
                            <span>{note.type}</span>
                          </div>
                          <div className="relative">
                            <button
                              onClick={() => setNoteMenuId(noteMenuId === note.id ? null : note.id)}
                              className="rounded-full px-2 text-[20px] leading-none text-slate-500 transition hover:bg-slate-100"
                            >
                              ⋯
                            </button>
                            {noteMenuId === note.id && (
                              <div className="absolute right-0 top-7 z-10 w-32 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-[13px] shadow-lg">
                                <button
                                  onClick={() => startEditNote(note)}
                                  className="block w-full px-3 py-2 text-left text-slate-700 hover:bg-slate-50"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => deleteNote(note)}
                                  className="block w-full px-3 py-2 text-left text-red-600 hover:bg-red-50"
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {editingNoteId === note.id ? (
                          <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
                            <label className="block">
                              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Ngày 1-1</span>
                              <input
                                type="date"
                                value={editingNoteDate}
                                onChange={(event) => setEditingNoteDate(event.target.value)}
                                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100 md:w-48"
                              />
                            </label>
                            <label className="block">
                              <span className="mb-1.5 block text-[12px] font-semibold text-slate-600">Nội dung</span>
                              <textarea
                                value={editingNoteContent}
                                onChange={(event) => setEditingNoteContent(event.target.value)}
                                rows={4}
                                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] leading-6 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                              />
                            </label>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setEditingNoteId(null)
                                  setEditingNoteDate('')
                                  setEditingNoteContent('')
                                }}
                                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                              >
                                Hủy
                              </button>
                              <button
                                onClick={() => saveEditedNote(note)}
                                className="rounded-lg bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-4 py-2 text-[12px] font-semibold text-white"
                              >
                                Lưu
                              </button>
                            </div>
                          </div>
                        ) : (
                          <ul className="space-y-2 pl-4 text-[13px] leading-6 text-slate-800">
                            {note.points.map(point => (
                              <li key={point} className="list-disc">{point}</li>
                            ))}
                          </ul>
                        )}

                      </article>
                    ))}
                  </div>
                )}
              </section>
          </main>

          <aside className="space-y-4">
            <Panel title="Điểm cần nhớ" editable onEdit={() => startEdit('remember')}>
              {editingPanel === 'remember' ? (
                <EditableTextarea
                  value={editingValue}
                  onChange={setEditingValue}
                  onDone={savePanel}
                  rows={8}
                  saving={saving}
                />
              ) : (
                <ul className="space-y-2 pl-4 text-[13px] leading-6 text-slate-700">
                  {(insight.rememberTags || []).map(tag => <li key={tag} className="list-disc break-words">{tag}</li>)}
                  {!insight.rememberTags?.length && <li className="list-none text-slate-500">Chưa có điểm cần nhớ.</li>}
                </ul>
              )}
            </Panel>

            <Panel title="Mong muốn & mục tiêu" editable onEdit={() => startEdit('goals')}>
              {editingPanel === 'goals' ? (
                <EditableTextarea
                  value={editingValue}
                  onChange={setEditingValue}
                  onDone={savePanel}
                  rows={8}
                  saving={saving}
                />
              ) : (
                <ul className="space-y-2 pl-4 text-[13px] leading-6 text-slate-700">
                  {(insight.goals || []).map(goal => <li key={goal} className="list-disc">{goal}</li>)}
                  {!insight.goals?.length && <li className="list-none text-slate-500">Chưa có mục tiêu.</li>}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  )
}

function EmployeeList({ employees, loading, error, onSelectEmployee }) {
  const [query, setQuery] = useState('')

  const filteredEmployees = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return employees
    return employees.filter(item =>
      [item.name, item.role, item.interests, item.analysis]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(keyword))
    )
  }, [employees, query])

  return (
    <div className="flex-1 overflow-y-auto bg-white text-slate-900">
      <div className="w-full space-y-6 p-5 md:p-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight text-slate-950">
              Hiểu nhân viên
            </h1>
            <p className="mt-2 text-[14px] leading-6 text-slate-600">
              Danh sách nhân viên và các thông tin hiểu nhân viên
            </p>
            {error && <p className="mt-2 text-[12px] text-orange-700">{error}</p>}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-[14px] text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 sm:w-[300px]"
                placeholder="Tìm kiếm nhân viên..."
              />
            </label>
            <button className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 text-[15px] font-semibold text-white shadow-sm shadow-blue-200/60 transition hover:bg-teal-700">
              <span className="text-[24px] font-light leading-none">+</span>
              Thêm
            </button>
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[70px_minmax(220px,1.2fr)_1.1fr_1.2fr_1.2fr_1.2fr_120px_44px] border-b border-slate-200 px-6 py-5 text-[13px] font-semibold text-slate-700 lg:grid">
            <div>STT</div>
            <div>Tên nhân viên</div>
            <div>Mối quan tâm</div>
            <div>Phân tích nhân viên</div>
            <div className="text-center">Hành động để động viên<br />(ngày)</div>
            <div className="text-center">Hành động để phát triển<br />(ngày)</div>
            <div>Cập nhật cuối</div>
            <div />
          </div>

          {loading ? (
            <div className="px-6 py-10 text-center text-[14px] text-slate-500">Đang tải danh sách nhân viên...</div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredEmployees.map((item, index) => (
                <button
                  key={item.id}
                  onClick={() => onSelectEmployee(item.id)}
                  className="grid w-full gap-4 px-6 py-5 text-left transition hover:bg-slate-50 lg:grid-cols-[70px_minmax(220px,1.2fr)_1.1fr_1.2fr_1.2fr_1.2fr_120px_44px] lg:items-center"
                >
                  <div className="hidden text-[14px] text-slate-800 lg:block">{index + 1}</div>

                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${item.avatarBg} text-[13px] font-semibold text-slate-800 ring-1 ring-slate-200`}>
                      {item.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-slate-950">{item.name}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 lg:hidden">#{index + 1}</span>
                      </div>
                      <p className="mt-1 text-[13px] text-slate-500">{item.role}</p>
                    </div>
                  </div>

                  <TableCell label="Mối quan tâm" value={item.interests} />
                  <TableCell label="Phân tích nhân viên" value={item.analysis} />
                  <TableCell label="Hành động để động viên" value={item.motivateAction} />
                  <TableCell label="Hành động để phát triển" value={item.developAction} />
                  <TableCell label="Cập nhật cuối" value={formatDate(item.updatedAt)} />

                  <div className="hidden justify-self-end text-[20px] leading-none text-slate-900 lg:block">...</div>
                </button>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-slate-200 px-6 py-4 text-[14px] text-slate-600 md:flex-row md:items-center md:justify-between">
            <span>Hiển thị {filteredEmployees.length ? `1 - ${filteredEmployees.length}` : '0'} của {employees.length}</span>
            <div className="flex items-center gap-2">
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-300">‹</button>
              {[1, 2, 3, 4, 5].map(page => (
                <button
                  key={page}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-[14px] font-medium ${
                    page === 1 ? 'bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 text-white shadow-sm shadow-blue-200/60' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {page}
                </button>
              ))}
              <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600">›</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function TableCell({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 lg:hidden">{label}</p>
      <p className="text-[14px] leading-7 text-slate-700 lg:text-[13px]">{value || 'Chưa cập nhật'}</p>
    </div>
  )
}
