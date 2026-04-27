import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ADMIN_PASSWORD } from '../config'

/* ─── Danh mục cố định ─── */
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
    items: ['Cameraman', 'Photographer', 'Account', 'Video-Editor', 'Kế toán', 'Leader'],
  },
]

/* ─── Markdown renderer đơn giản ─── */
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-slate-800 mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-slate-800 mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-slate-800 mt-6 mb-3">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-600">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-slate-600">$2</li>')
    .replace(/\n\n/g, '</p><p class="mb-3 text-slate-600 leading-relaxed">')
    .replace(/^(?!<[hlu]|<\/[hlu])(.+)$/gm, '<p class="mb-3 text-slate-600 leading-relaxed">$1</p>')
}

/* ─── Admin gate ─── */
function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [showGate, setShowGate] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const tryLogin = () => {
    if (input === ADMIN_PASSWORD) {
      setIsAdmin(true)
      setShowGate(false)
      setError('')
    } else {
      setError('Sai mật khẩu')
    }
  }

  return { isAdmin, showGate, setShowGate, input, setInput, error, tryLogin }
}

/* ─── Main WikiPage ─── */
export default function WikiPage() {
  const [pages, setPages] = useState([])        // all pages from supabase
  const [activeCat, setActiveCat] = useState(CATEGORIES[0].id)
  const [selectedTitle, setSelectedTitle] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const admin = useAdmin()

  /* Fetch tất cả pages 1 lần */
  useEffect(() => {
    supabase
      .from('wiki_pages')
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) setPages(data)
        setLoading(false)
      })
  }, [])

  const currentCat = CATEGORIES.find(c => c.id === activeCat)
  const currentPage = pages.find(
    p => p.category === activeCat && p.title === selectedTitle
  )

  /* Save hoặc Insert */
  async function savePage() {
    setSaving(true)
    if (currentPage) {
      const { data } = await supabase
        .from('wiki_pages')
        .update({ content: draft, updated_at: new Date().toISOString() })
        .eq('id', currentPage.id)
        .select()
        .single()
      if (data) setPages(prev => prev.map(p => p.id === data.id ? data : p))
    } else {
      const { data } = await supabase
        .from('wiki_pages')
        .insert({ category: activeCat, title: selectedTitle, content: draft })
        .select()
        .single()
      if (data) setPages(prev => [...prev, data])
    }
    setSaving(false)
    setEditing(false)
  }

  function openPage(title) {
    setSelectedTitle(title)
    setEditing(false)
  }

  function startEdit() {
    setDraft(currentPage?.content || '')
    setEditing(true)
  }

  /* ── Render ── */
  return (
    <div className="flex h-full min-h-0">

      {/* Sidebar */}
      <aside className="w-52 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto">
        <div className="p-3 border-b border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Danh mục</p>
        </div>
        <nav className="p-2 space-y-1">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setActiveCat(cat.id); setSelectedTitle(null); setEditing(false) }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors
                ${activeCat === cat.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </nav>

        {/* Admin toggle */}
        <div className="p-3 border-t border-slate-100 mt-2">
          {admin.isAdmin ? (
            <div className="flex items-center gap-2 text-[11px] text-emerald-600 font-semibold">
              <span>✅</span> Admin mode
            </div>
          ) : (
            <button
              onClick={() => admin.setShowGate(true)}
              className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors"
            >
              🔒 Đăng nhập Admin
            </button>
          )}
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 min-w-0 flex flex-col">

        {/* No selection: card grid */}
        {!selectedTitle && (
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-[13px] font-bold text-slate-500 uppercase tracking-widest mb-4">
              {currentCat?.icon} {currentCat?.label}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {currentCat?.items.map(title => {
                const page = pages.find(p => p.category === activeCat && p.title === title)
                return (
                  <button
                    key={title}
                    onClick={() => openPage(title)}
                    className="group text-left bg-white rounded-xl border border-slate-200 px-4 py-4 hover:border-blue-400 hover:shadow-sm transition-all"
                  >
                    <div className="text-[13px] font-semibold text-slate-700 group-hover:text-blue-700 mb-2 leading-snug">
                      {title}
                    </div>
                    {page ? (
                      <div className="text-[11px] text-slate-400">
                        Cập nhật {new Date(page.updated_at).toLocaleDateString('vi-VN')}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-300 italic">Chưa có nội dung</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Selected: content view */}
        {selectedTitle && !editing && (
          <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
            {/* Breadcrumb */}
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
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
                >
                  ✏️ Chỉnh sửa
                </button>
              )}
            </div>

            {currentPage ? (
              <div
                className="prose prose-sm max-w-none text-slate-600"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(currentPage.content) }}
              />
            ) : (
              <div className="text-slate-400 italic text-sm">
                Chưa có nội dung.{admin.isAdmin ? ' Nhấn "Chỉnh sửa" để thêm nội dung.' : ''}
              </div>
            )}

            {currentPage && (
              <div className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-300">
                Cập nhật lần cuối: {new Date(currentPage.updated_at).toLocaleString('vi-VN')}
              </div>
            )}
          </div>
        )}

        {/* Editor */}
        {selectedTitle && editing && (
          <div className="flex-1 flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-slate-700">✏️ Chỉnh sửa: {selectedTitle}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="text-[12px] px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  onClick={savePage}
                  disabled={saving}
                  className="text-[12px] px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {saving ? 'Đang lưu...' : '💾 Lưu'}
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">Hỗ trợ Markdown: **bold**, *italic*, # Heading, - list item</p>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="flex-1 w-full border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Nhập nội dung theo định dạng Markdown..."
            />
          </div>
        )}
      </div>

      {/* Admin password gate modal */}
      {admin.showGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-80">
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">🔒 Admin Login</h3>
            <p className="text-[12px] text-slate-400 mb-4">Nhập mật khẩu để mở chế độ chỉnh sửa</p>
            <input
              type="password"
              value={admin.input}
              onChange={e => admin.setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && admin.tryLogin()}
              placeholder="Mật khẩu"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus
            />
            {admin.error && <p className="text-[12px] text-red-500 mb-2">{admin.error}</p>}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => admin.setShowGate(false)}
                className="flex-1 text-[13px] py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={admin.tryLogin}
                className="flex-1 text-[13px] py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                Đăng nhập
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
