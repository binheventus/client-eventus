import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ADMIN_PASSWORD } from '../config'
import Header from '../components/Header'
import data from '../data/competency.json'

const CATEGORIES = [
  {
    id: 'quy_trinh',
    label: 'Quy trinh',
    icon: '\u2699\uFE0F',
    items: [
      '\u0110\u1ED9i Quay', '\u0110\u1ED9i Ch\u1EE5p', '\u0110\u1ED9i D\u1EF1ng', '\u0110\u1ED9i h\u1EADu k\u00EC \u1EA3nh',
      '\u0110\u1ED9i Flycam-FPV', '\u0110\u1ED9i Account', 'Hanoigimbal',
      'H\u01B0\u1EDBng d\u1EABn \u0111\u1ED9i quay set m\u00E1y',
      'Quy \u0111\u1ECBnh chung khi \u0111i job',
      'Service Standard \u2013 H\u01B0\u1EDBng d\u1EABn l\u00E0m vi\u1EC7c v\u1EDBi kh\u00E1ch h\u00E0ng',
    ],
  },
  {
    id: 'noi_quy',
    label: 'N\u1ED9i quy',
    icon: '\uD83D\uDCCB',
    items: [
      'N\u1ED9i quy v\u0103n ph\u00F2ng',
      'Quy \u0111\u1ECBnh s\u1EED d\u1EE5ng xe \u00F4t\u00F4',
      'Trang ph\u1EE5c',
      'Quy \u0111\u1ECBnh v\u1EC1 b\u1EA3o m\u1EADt & an ninh',
      'Ch\u00EDnh s\u00E1ch t\u00ECm ki\u1EBFm kh\u00E1ch h\u00E0ng 2026',
      'Quy \u0111\u1ECBnh B\u1EA3o qu\u1EA3n v\u00E0 ch\u1ECBu tr\u00E1ch nhi\u1EC7m thi\u1EBFt b\u1ECB',
      'N\u1ED9i dung ph\u1EA1t',
    ],
  },
  {
    id: 'huong_dan',
    label: 'H\u01B0\u1EDBng d\u1EABn',
    icon: '\uD83D\uDCD6',
    items: ['H\u01B0\u1EDBng d\u1EABn t\u00E2n binh', 'T\u1ED5ng h\u1EE3p slide Growday'],
  },
  {
    id: 'khung_nang_luc',
    label: 'Khung n\u0103ng l\u1EF1c',
    icon: '\uD83C\uDFC6',
  },
]

const POSITION_META = {
  cameraman:    { icon: '\uD83C\uDFAC' },
  editor:       { icon: '\uD83C\uDF9E\uFE0F' },
  photographer: { icon: '\uD83D\uDCF7' },
  account:      { icon: '\uD83E\uDD1D' },
  leader:       { icon: '\uD83E\uDDED' },
  ketoan:       { icon: '\uD83D\uDCCA' },
}

const PLACEHOLDER_POSITION = {
  id: 'ketoan',
  name: 'K\u1EBF to\u00E1n',
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
        ${position.placeholder ? 'opacity-50 cursor-default' : 'hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{meta.icon}</span>
        <div className="text-[14px] font-bold text-slate-800">{position.name}</div>
      </div>
      <div className="flex items-center gap-1">
        {position.levels.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-blue-500" style={{ opacity: 0.15 + i * 0.17 }} />
        ))}
      </div>
      {!position.placeholder && (
        <div className="flex items-center gap-1 mt-3 text-xs font-medium text-slate-400 group-hover:text-blue-700 transition-colors">
          Xem khung n&#x103;ng l&#x1EF1;c
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
        <h1 className="text-[24px] font-semibold tracking-tight">Khung n&#x103;ng l&#x1EF1;c n&#x1ED9;i b&#x1ED9;</h1>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {positions.map(position => (
          <PositionNode key={position.id} position={position} />
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 tracking-wide mt-6">
        C&#x1EAD;p nh&#x1EAD;t n&#x1ED9;i dung t&#x1EA1;i{' '}
        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">src/data/competency.json</code>
        <span className="mx-3 text-slate-200">|</span>
        Eventus Production &middot; Built by Ph&#x1EA1;m Thanh B&#xEC;nh &middot; 2026
      </p>
    </div>
  )
}

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

function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [showGate, setShowGate] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const tryLogin = () => {
    if (input === ADMIN_PASSWORD) { setIsAdmin(true); setShowGate(false); setError(''); setInput('') }
    else setError('Sai m&#x1EAD;t kh&#x1EA9;u')
  }
  return { isAdmin, showGate, setShowGate, input, setInput, error, tryLogin }
}

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
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + import.meta.env.VITE_OPENROUTER_KEY,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://eventus-competency.vercel.app',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [{
            role: 'user',
            content: 'Ban la tro ly format noi dung wiki noi bo cho cong ty Eventus Production.\nNhiem vu: Nhan text tho, format lai thanh Markdown ro rang, de doc.\n\nQuy tac:\n- Dung # cho tieu de chinh, ## cho muc, ### cho tieu muc\n- Dung - cho danh sach gach dau dong\n- Dung **text** de in dam cac diem quan trong\n- Giu nguyen 100% noi dung goc, KHONG them, KHONG bot\n- Chi tra ve Markdown thuan, khong giai thich, khong boc trong code block\n\nTen trang: ' + selectedTitle + '\n\nNoi dung:\n' + draft
          }]
        })
      })
      const json = await res.json()
      const result = json.choices?.[0]?.message?.content
      if (result) {
        setDraft(result)
      } else {
        console.error('OpenRouter response:', JSON.stringify(json))
        alert('AI khong tra ve ket qua. Mo Console de xem chi tiet.')
      }
    } catch (e) {
      console.error(e)
      alert('Loi ket noi: ' + e.message)
    }
    setFormatting(false)
  }

  async function savePage() {
    setSaving(true)
    if (currentPage) {
      const { data: updated } = await supabase
        .from('wiki_pages').update({ content: draft, updated_at: new Date().toISOString() })
        .eq('id', currentPage.id).select().single()
      if (updated) setPages(prev => prev.map(p => p.id === updated.id ? updated : p))
    } else {
      const { data: inserted } = await supabase
        .from('wiki_pages').insert({ category: activeCat, title: selectedTitle, content: draft })
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
                <span>&#x2705;</span> Admin mode
              </div>
            ) : (
              <button onClick={() => admin.setShowGate(true)} className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors">
                &#x1F512; &#x0110;&#x0103;ng nh&#x1EAD;p Admin
              </button>
            )}
          </div>
        </aside>

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
                        ? <div className="text-[11px] text-slate-400">C&#x1EAD;p nh&#x1EAD;t {new Date(page.updated_at).toLocaleDateString('vi-VN')}</div>
                        : <div className="text-[11px] text-slate-300 italic">Ch&#x01B0;a c&#xF3; n&#x1ED9;i dung</div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {activeCat !== 'khung_nang_luc' && selectedTitle && !editing && (
            <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
              <div className="flex items-center gap-2 text-[12px] text-slate-400 mb-4">
                <button onClick={() => setSelectedTitle(null)} className="hover:text-blue-600 transition-colors">{currentCat?.label}</button>
                <span>/</span>
                <span className="text-slate-600 font-medium">{selectedTitle}</span>
              </div>
              <div className="flex items-start justify-between mb-6">
                <h1 className="text-xl font-bold text-slate-800">{selectedTitle}</h1>
                {admin.isAdmin && (
                  <button onClick={startEdit}
                    className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
                    &#x270F;&#xFE0F; Ch&#x1EC9;nh s&#x1EED;a
                  </button>
                )}
              </div>
              {currentPage
                ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: renderMarkdown(currentPage.content) }} />
                : <div className="text-slate-400 italic text-sm">Ch&#x01B0;a c&#xF3; n&#x1ED9;i dung.{admin.isAdmin ? ' Nh&#x1EA5;n "Ch&#x1EC9;nh s&#x1EED;a" &#x111;&#x1EC3; th&#xEA;m.' : ''}</div>
              }
              {currentPage && (
                <div className="mt-8 pt-4 border-t border-slate-100 text-[11px] text-slate-300">
                  C&#x1EAD;p nh&#x1EAD;t l&#x1EA7;n cu&#x1ED1;i: {new Date(currentPage.updated_at).toLocaleString('vi-VN')}
                </div>
              )}
            </div>
          )}

          {activeCat !== 'khung_nang_luc' && selectedTitle && editing && (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold text-slate-700">&#x270F;&#xFE0F; {selectedTitle}</h2>
                <div className="flex gap-2">
                  <button onClick={handleAiFormat} disabled={formatting || !draft.trim()}
                    className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-700 font-semibold hover:bg-violet-100 transition-colors disabled:opacity-50">
                    {formatting ? (
                      <>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        &#x0110;ang format...
                      </>
                    ) : '&#x2728; Format b&#x1EB1;ng AI'}
                  </button>
                  <button onClick={() => setEditing(false)}
                    className="text-[12px] px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                    Hu&#x1EF7;
                  </button>
                  <button onClick={savePage} disabled={saving}
                    className="text-[12px] px-4 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-60">
                    {saving ? '&#x0110;ang l&#x01B0;u...' : '&#x1F4BE; L&#x01B0;u'}
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mb-2">
                Paste text th&#xF4; &#x2192; nh&#x1EA5;n <span className="text-violet-600 font-semibold">&#x2728; Format b&#x1EB1;ng AI</span> &#x2192; ki&#x1EC3;m tra &#x2192; L&#x01B0;u
              </p>
              <textarea value={draft} onChange={e => setDraft(e.target.value)}
                className="flex-1 w-full border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Paste n&#x1ED9;i dung v&#xE0;o &#x111;&#xE2;y..." />
            </div>
          )}
        </div>
      </div>

      {admin.showGate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-80">
            <h3 className="text-[15px] font-bold text-slate-800 mb-1">&#x1F512; Admin Login</h3>
            <p className="text-[12px] text-slate-400 mb-4">Nh&#x1EAD;p m&#x1EAD;t kh&#x1EA9;u &#x111;&#x1EC3; m&#x1EDF; ch&#x1EBF; &#x111;&#x1ED9; ch&#x1EC9;nh s&#x1EED;a</p>
            <input type="password" value={admin.input} onChange={e => admin.setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && admin.tryLogin()}
              placeholder="M&#x1EAD;t kh&#x1EA9;u"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              autoFocus />
            {admin.error && <p className="text-[12px] text-red-500 mb-2">{admin.error}</p>}
            <div className="flex gap-2 mt-2">
              <button onClick={() => admin.setShowGate(false)}
                className="flex-1 text-[13px] py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">Hu&#x1EF7;</button>
              <button onClick={admin.tryLogin}
                className="flex-1 text-[13px] py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700">
                &#x0110;&#x0103;ng nh&#x1EAD;p
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
