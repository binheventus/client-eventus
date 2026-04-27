import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ADMIN_PASSWORD } from '../config'
import Header from '../components/Header'
import data from '../data/competency.json'

/* ─── Danh mục sidebar ─── */
const CATEGORIES = [
  {
    id: 'quy_trinh',
    label: 'Quy trình',
    icon: '⚙️',
    items: [
      'Đội Quay', 'Đội Chụp', 'Đội Dựng', 'Đội hậu kì ảnh',
      'Đội Flycam-FPV', 'Đội Account', 'Hanoigimbal',
      'Hướng dẫn đội quay set máy',
      'Quy định chung khi đi job',
      'Service Standard – Hướng dẫn làm việc với khách hàng',
    ],
  },
  {
    id: 'noi_quy',
    label: 'Nội quy',
    icon: '📋',
    items: [
      'Nội quy văn phòng',
      'Quy định sử dụng xe ôtô',
      'Trang phục',
      'Quy định về bảo mật & an ninh',
      'Chính sách tìm kiếm khách hàng 2026',
      'Quy định Bảo quản và chịu trách nhiệm thiết bị',
      'Nội dung phạt',
    ],
  },
  {
    id: 'huong_dan',
    label: 'Hướng dẫn',
    icon: '📖',
    items: ['Hướng dẫn tân binh', 'Tổng hợp slide Growday'],
  },
  {
    id: 'khung_nang_luc',
    label: 'Khung năng lực',
    icon: '🏆',
  },
]

/* ─── Competency grid ─── */
const POSITION_META = {
  cameraman:    { icon: '🎬' },
  editor:       { icon: '🎞️' },
  photographer: { icon: '📷' },
  account:      { icon: '🤝' },
  leader:       { icon: '🧭' },
  ketoan:       { icon: '📊' },
}

const PLACEHOLDER_POSITION = {
  id: 'ketoan',
  name: 'Kế toán',
  levels: [{ level: 1 }, { level: 2 }, { level: 3 }],
  placeholder: true,
}

function PositionNode({ position }) {
  const navigate = useNavigate()
  const meta = POSITION_META[position.id] || POSITION_META.leader

  return (
    <button
      onClick={() => !position.placeholder && navigate(`/position/${position.id}`)}
      className={`group w-full text-left bg-white rounded-2xl shadow-sm px-5 py-4 border border-slate-200 transition-all duration-200
        ${position.placeholder
          ? 'opacity-50 cursor-default'
          : 'hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="text-[14px] font-bold text-slate-800">{position.name}</div>
      </div>
      <div className="flex items-center gap-1">
        {position.levels.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-blue-500"
            style={{ opacity: 0.15 + i * 0.17 }} />
        ))}
      </div>
      {!position.placeholder && (
        <div className="flex items-center gap-1 mt-3 text-xs font-medium text-slate-400 group-hover:text-blue-700 transition-colors">
          Xem khung năng lực
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  )
}

function CompetencyGrid() {
  const positions = [...data.competency_framework.positions, PLACEHOLDER_POSITION]
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="bg-gradient-to-r from-blue-700 to-teal-600 rounded-2xl shadow-lg px-8 py-5 text-white mb-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-200 mb-1">
          Eventus Production Competency Framework
        </p>
        <h1 className="text-[24px] font-semibold tracking-tight">Khung năng lực nội bộ</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {positions.map(position => (
          <PositionNode key={position.id} position={position} />
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 tracking-wide mt-6">
        Cập nhật nội dung tại{' '}
        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
          src/data/competency.json
        </code>
        <span className="mx-3 text-slate-200">|</span>
        Eventus Production · Built by Phạm Thanh Bình · 2026
      </p>
    </div>
  )
}

/* ─── Markdown renderer ─── */
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-800 mt-6 mb-3">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold text-slate-800 mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-5 list-disc text-slate-600 mb-1.5 leading-relaxed">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-5 list-decimal text-slate-600 mb-1.5 leading-relaxed">$2</li>')
    .replace(/`(.+?)`/g, '<code class="font-mono text-[12px] bg-slate-100 text-blue-700 px-1.5 py-0.5 rounded">$1</code>')
    .replace(/\n\n/g, '</p><p class="mb-4 text-slate-600 leading-relaxed">')
}

/* ─── AI Format ─── */
async function aiFormat(rawText, title) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `Bạn là trợ lý format nội dung wiki nội bộ cho công ty Eventus Production (dịch vụ quay phim, chụp ảnh, dựng phim).
Nhiệm vụ: Nhận text thô từ người dùng, format lại thành Markdown rõ ràng, dễ đọc.

Quy tắc bắt buộc:
- Dùng # cho tiêu đề chính, ## cho mục, ### cho tiểu mục
- Dùng - cho danh sách gạch đầu dòng
- Dùng **text** để in đậm các điểm quan trọng
- Giữ nguyên 100% nội dung gốc, KHÔNG thêm, KHÔNG bớt, KHÔNG diễn giải lại
- Xuống dòng hợp lý giữa các đoạn
- Chỉ trả về nội dung Markdown, không giải thích gì thêm`,
      messages: [{
        role: 'user',
        content: `Tên trang: ${title}\n\nNội dung cần format:\n${rawText}`
      }]
    })
  })
  const data = await response.json()
  return data.content?.[0]?.text || rawText
}

/* ─── Admin gate hook ─── */
function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [showGate, setShowGate] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const tryLogin = () => {
    if (input === ADMIN_PASSWORD) {
      setIsAdmin(true); setShowGate(false); setError(''); setInput('')
    } else {
      setError('Sai mật khẩu')
    }
  }

  return { isAdmin, showGate, setShowGate, input, setInput, error, tryLogin }
}

/* ─── Main WikiPage ─── */
export default function WikiPage() {
  const [pages, setPages] = useState([])
  const [activeCat, setActiveCat] = useState('khung_nang_luc')
  const [selectedTitle, setSelectedTitle] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [formatting, setFormatting] = useState(false)
  const [loading, setLoading] = useState(true)
  const admin = useAdmin()

  useEffect(() => {
    supabase.from('wiki_pages').select('*').then(({ data: rows, error }) => {
      if (!error && rows) setPages(rows)
      setLoading(false)
    })
  }, [])

  const currentCat = CATEGORIES.find(c => c.id === activeCat)
  const currentPage = pages.find(p => p.category === activeCat && p.title === selectedTitle)

  async function handleAiFormat() {
    if (!draft.trim()) return
    setFormatting(true)
    try {
      const formatted = await aiFormat(draft, selectedTitle)
      setDraft(formatted)
    } catch (e) {
      alert('Lỗi kết nối AI. Thử lại sau.')
    }
    setFormatting(false)
  }

  async function savePage() {
    setSaving(true)
    if (currentPage) {
      const { data: updated } = await supabase
        .from('wiki_pages')
        .update({ content: draft, updated_at: new Date().toISOString() })
        .eq('id', currentPage.id).select().single()
      if (updated) setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    } else {
      const { data: inserted } = await supabase
        .from('wiki_pages')
        .insert({ category: activeCat, title: selectedTitle, content: draft })
        .select().single()
      if (inserted) setPages(prev => [...prev, inserted])
    }
    setSaving(false)
    setEditing(false)
  }

  function selectCat(id) { setActiveCat(id); setSelectedTitle(null); setEditing(false) }
  function openPage(title) { setSelectedTitle(title); setEditing(false) }
  function startEdit() { setDraft(currentPage?.content || ''); setEditing(true) }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <Header />

      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Menu</p>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 space-y-1">
            {CATEGORIES.map(cat => (
              <button key={cat.id} onClick={() => selectCat(cat.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors
                  ${activeCat === cat.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                <span>{cat.icon}</span><span>{cat.label}</span>
              </button>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-slate-100">
            {admin.isAdmin ? (
              <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-semibold">
                <span>✅</span> Admin mode
              </div>
            ) : (
              <button onClick={() => admin.setShowGate(true)}
                className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors">
                🔒 Đăng nhập Admin
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col">

          {activeCat === 'khung_nang_luc' && <CompetencyGrid />}

          {activeCat !== 'khung_nang_luc' && !selectedTitle && (
            <div className="flex-1 overflow-y-auto p-6">
              <h2 className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                {currentCat?.icon} {currentCat?.label}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {currentCat?.items?.map(title => {
                  const page = pages.find(p => p.category === activeCat && p.title === title)
                  return (
                    <button key={title} onClick={() => openPage(title)}
                      className="group text-left bg-white rounded-xl border border-slate-200 px-4 py-4 hover:border-blue-400 hover:shadow-sm transition-all">
                      <div className="text-[13px] font-semibold text-slate-700 group-hover:text-blue-700 mb-2 leading-snug">{title}</div>
                      {page
                        ? <div className="text-[11px] text-slate-400">Cập nhật {new Date(page.updated_at).toLocaleDateString('vi-VN')}</div>
                        : <div className="text-[11px] text-slate-300 italic">Chưa có nội dung</div>
                      }
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeCat !== 'khung_nang_luc' && selectedTitle && !editing && (
            <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
              <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-4">
                <button onClick={() => setSelectedTitle(null)} className="hover:text-blue-600 transition-colors">
                  {currentCat?.label}
                </button>
                <span>/</span>
                <span className="text-slate-600 font-medium">{selectedTitle}</span>
              </div>
              <div className="flex items-start justify-between mb-6">
                <h1 className="text-xl font-bold text-slate-800">{selectedTitle}</h1>
                {admin.isAdmin && (
                  <button onClick={startEdit}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
                    ✏️ Chỉnh sửa
                  </button>
                )}
              </div>
              {currentPage ? (
                <div className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(currentPage.content) }} />
              ) : (
                <div className="text-slate-400 italic text-sm">
                  Chưa có nội dung.{admin.isAdmin ? ' Nhấn "Chỉnh sửa" để thêm.' : ''}
                </div>
              )}
              {currentPage && (
                <div className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-300">
                  Cập nhật lần cuối: {new Date(currentPage.updated_at).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          )}

          {/* Editor với nút AI Format */}
          {activeCat !== 'khung_nang_luc' && selectedTitle && editing && (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold text-slate-700">✏️ {selectedTitle}</h2>
                <div className="flex gap-2">
                  {/* Nút AI Format */}
                  <button
                    onClick={handleAiFormat}
                    disabled={formatting || !draft.trim()}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 font-semibold hover:bg-violet-100 transition-colors disabled:opacity-50"
                  >
                    {formatting ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Đang format...
                      </>
                    ) : '✨ Format bằng AI'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                    Huỷ
                  </button>
                  <button onClick={savePage} disabled={saving}
                    className="text-[12px] px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60">
                    {saving ? 'Đang lưu...' : '💾 Lưu'}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mb-2">
                Paste text thô vào đây → nhấn <span className="text-violet-600 font-semibold">✨ Format bằng AI</span> → kiểm tra → Lưu
              </p>

              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                className="flex-1 w-full border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Paste nội dung vào đây..."
              />
            </div>
          )}
        </div>
      </div>

      {/* Admin modal */}
      {admin.showGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-80">
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">🔒 Admin Login</h3>
            <p className="text-[12px] text-slate-400 mb-4">Nhập mật khẩu để mở chế độ chỉnh sửa</p>
            <input type="password" value={admin.input} onChange={e => admin.setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && admin.tryLogin()}
              placeholder="Mật khẩu"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus />
            {admin.error && <p className="text-[12px] text-red-500 mb-2">{admin.error}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => admin.setShowGate(false)}
                className="flex-1 text-[13px] py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                Huỷ
              </button>
              <button onClick={admin.tryLogin}
                className="flex-1 text-[13px] py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                Đăng nhập
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
