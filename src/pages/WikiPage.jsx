import { useState, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ADMIN_PASSWORD } from '../config'
import data from '../data/competency.json'
import PositionPage from './PositionPage'

/* ─── Danh muc sidebar ─── */
const CATEGORIES = [
  {
    id: 'quy_trinh',
    label: 'Quy trình',
    icon: '⚙️',
    shortDesc: 'Quy trình làm việc',
    banner: 'Quy trình làm việc',
    desc: 'Hướng dẫn quy trình chuẩn cho từng bộ phận — đọc kỹ trước khi đi job.',
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
    shortDesc: 'Quy định nội bộ',
    banner: 'Nội quy công ty',
    desc: 'Các quy định nội bộ áp dụng cho toàn bộ nhân sự Eventus Production.',
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
    shortDesc: 'Tài liệu đào tạo',
    banner: 'Hướng dẫn',
    desc: 'Tài liệu onboarding và đào tạo nội bộ dành cho nhân sự Eventus.',
    items: ['Hướng dẫn tân binh', 'Tổng hợp slide Growday'],
  },
  {
    id: 'khung_nang_luc',
    label: 'Khung năng lực',
    icon: '🏆',
    shortDesc: 'Competency framework',
    banner: 'Khung năng lực nội bộ',
    desc: 'Định nghĩa kỳ vọng theo từng vị trí và cấp bậc — dùng cho đánh giá, thăng cấp và phát triển cá nhân.',
  },
]

const CATEGORY_CARD_META = {
  quy_trinh: { badge: 'Tài liệu vận hành', accent: 'from-blue-50 to-cyan-50', iconBg: 'bg-blue-100', iconText: 'text-blue-700' },
  noi_quy: { badge: 'Quy định nội bộ', accent: 'from-emerald-50 to-teal-50', iconBg: 'bg-emerald-100', iconText: 'text-emerald-700' },
  huong_dan: { badge: 'Đào tạo & onboarding', accent: 'from-amber-50 to-orange-50', iconBg: 'bg-amber-100', iconText: 'text-amber-700' },
}

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
          Xem khung năng lực
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  )
}

/* ─── Banner chung cho moi danh muc ─── */
function CategoryBanner({ cat }) {
  return (
    <div className="bg-gradient-to-r from-blue-700 to-teal-600 rounded-2xl shadow-lg px-8 py-5 text-white mb-5 flex-shrink-0">
      <p className="text-sm font-semibold text-blue-100 mb-1">
        {cat.icon} {cat.banner}
      </p>
      {cat.desc && <p className="text-sm text-blue-100 mt-1">{cat.desc}</p>}
    </div>
  )
}

function CompetencyGrid() {
  const cat = CATEGORIES.find(c => c.id === 'khung_nang_luc')
  const positions = [...data.competency_framework.positions, PLACEHOLDER_POSITION]
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <CategoryBanner cat={cat} />
      <div className="grid grid-cols-3 gap-4">
        {positions.map(position => (
          <PositionNode key={position.id} position={position} />
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 tracking-wide mt-6">
        Cập nhật nội dung tại{' '}
        <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">src/data/competency.json</code>
        <span className="mx-3 text-slate-200">|</span>
        Eventus Production · Built by Phạm Thanh Bình · 2026
      </p>
    </div>
  )
}

/* ─── Article renderer ─── */
function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function stripMarker(line = '') {
  return line
    .replace(/^#{1,3}\s+/, '')
    .replace(/^\d+\.\d+\.?\s+/, '')
    .replace(/^\d+\.\s+/, '')
    .replace(/^[-*•+]\s+/, '')
    .trim()
}

function isUpperTitle(line) {
  const letters = line.replace(/[^A-Za-zÀ-ỹ]/g, '')
  return letters.length > 8 && line === line.toUpperCase()
}

function isMainHeading(line) {
  return /^#\s+/.test(line) || /^Bước\s+\d+\s*:/i.test(line)
}

function isSubHeading(line) {
  return /^##\s+/.test(line) || /^\d+\.\d+\.?\s+/.test(line)
}

function isListItem(line) {
  return /^[-*•+]\s+/.test(line) || /^\d+\.\s+/.test(line)
}

function isCallout(line) {
  return /^[⚠️⛔✅ℹ️*]+\s*/.test(line) || /^Lưu ý/i.test(line)
}

function parseInline(text) {
  const nodes = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g
  let lastIndex = 0
  let match

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${match.index}-b`} className="font-semibold text-slate-900">{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      nodes.push(<em key={`${match.index}-i`} className="italic">{token.slice(1, -1)}</em>)
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={`${match.index}-c`} className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-blue-700">
          {token.slice(1, -1)}
        </code>
      )
    }
    lastIndex = pattern.lastIndex
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))
  return nodes.length ? nodes : text
}

function parseArticle(rawText, fallbackTitle) {
  const lines = String(rawText || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(line => line.trim())

  let title = fallbackTitle
  let lead = []
  const sections = []
  const footerNotes = []
  let currentSection = null
  let currentSubsection = null

  const getTarget = () => {
    if (currentSubsection) return currentSubsection
    if (currentSection) return currentSection
    return null
  }

  const ensureSection = (label = 'Nội dung') => {
    if (currentSection) return currentSection
    currentSection = { id: slugify(label), title: label, blocks: [], subsections: [] }
    sections.push(currentSection)
    currentSubsection = null
    return currentSection
  }

  const pushBlock = (block) => {
    const target = getTarget() || ensureSection()
    target.blocks.push(block)
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line) continue

    if (!title && (isUpperTitle(line) || /^#\s+/.test(line))) {
      title = stripMarker(line)
      continue
    }

    if (/^Cập nhật ngày/i.test(line)) {
      footerNotes.push({ type: 'meta', text: line })
      continue
    }

    if (/bảo mật/i.test(line) && line.length > 50) {
      footerNotes.push({ type: 'warning', text: line.replace(/^\*+|\*+$/g, '').trim() })
      continue
    }

    if (isMainHeading(line)) {
      const sectionTitle = stripMarker(line)
      currentSection = { id: slugify(sectionTitle), title: sectionTitle, blocks: [], subsections: [] }
      sections.push(currentSection)
      currentSubsection = null
      continue
    }

    if (isSubHeading(line)) {
      const subsectionTitle = stripMarker(line)
      ensureSection()
      currentSubsection = { id: slugify(`${currentSection.id}-${subsectionTitle}`), title: subsectionTitle, blocks: [] }
      currentSection.subsections.push(currentSubsection)
      continue
    }

    if (!currentSection && !currentSubsection && line.length > 60) {
      lead.push(line)
      continue
    }

    if (isCallout(line)) {
      pushBlock({ type: 'callout', tone: line.startsWith('⛔') ? 'warning' : 'info', text: line })
      continue
    }

    if (isListItem(line)) {
      const items = [stripMarker(line)]
      while (i + 1 < lines.length && lines[i + 1] && isListItem(lines[i + 1])) {
        i += 1
        items.push(stripMarker(lines[i]))
      }
      pushBlock({ type: 'list', items })
      continue
    }

    if (line.endsWith(':')) {
      const titleText = line.slice(0, -1).trim()
      const items = []
      while (i + 1 < lines.length) {
        const next = lines[i + 1]
        if (!next || isMainHeading(next) || isSubHeading(next) || /^Cập nhật ngày/i.test(next)) break
        if (next.endsWith(':') && items.length > 0) break
        i += 1
        items.push(stripMarker(lines[i]))
      }

      if (items.length >= 2) {
        pushBlock({ type: 'cardList', title: titleText, items })
      } else if (items.length === 1) {
        pushBlock({ type: 'paragraph', text: `${titleText}: ${items[0]}` })
      } else {
        pushBlock({ type: 'miniTitle', text: titleText })
      }
      continue
    }

    let paragraph = line
    while (i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!next || isMainHeading(next) || isSubHeading(next) || isListItem(next) || isCallout(next) || /^Cập nhật ngày/i.test(next)) break
      if (next.endsWith(':')) break
      i += 1
      paragraph += ` ${lines[i]}`
    }
    pushBlock({ type: 'paragraph', text: paragraph })
  }

  return {
    title: title || fallbackTitle,
    lead,
    sections,
    footerNotes,
  }
}

function CalloutBlock({ tone = 'info', children }) {
  const classes = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : 'border-blue-200 bg-blue-50 text-slate-700'

  return (
    <div className={`rounded-2xl border px-4 py-3 text-[13px] leading-relaxed ${classes}`}>
      {children}
    </div>
  )
}

function ContentBlock({ block }) {
  if (block.type === 'paragraph') {
    return <p className="text-[15px] leading-7 text-slate-600">{parseInline(block.text)}</p>
  }

  if (block.type === 'miniTitle') {
    return <h4 className="text-[15px] font-semibold text-slate-900">{block.text}</h4>
  }

  if (block.type === 'callout') {
    return <CalloutBlock tone={block.tone}>{parseInline(block.text)}</CalloutBlock>
  }

  if (block.type === 'list') {
    return (
      <ul className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
        {block.items.map((item, idx) => (
          <li key={idx} className="flex gap-3 text-[14px] leading-6 text-slate-700">
            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
            <span>{parseInline(item)}</span>
          </li>
        ))}
      </ul>
    )
  }

  if (block.type === 'cardList') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-[14px] font-semibold uppercase tracking-[0.12em] text-slate-500">{block.title}</h4>
        <div className="grid gap-3 md:grid-cols-2">
          {block.items.map((item, idx) => (
            <div key={idx} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-[14px] leading-6 text-slate-700">
              {parseInline(item)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

function ArticleDocument({ title, category, page }) {
  const article = useMemo(() => parseArticle(page?.content, title), [page?.content, title])
  const hasSections = article.sections.length > 0
  const updatedLabel = page?.updated_at ? new Date(page.updated_at).toLocaleString('vi-VN') : null
  const bannerDescription = article.lead[0] || 'Thêm phần mô tả mở đầu trong nội dung bài viết để hiển thị tại đây.'
  const editButton = page?.editButton ?? null

  return (
    <div className="px-6 pb-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-6 py-8 text-white md:px-8 md:py-10">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-100">
                  <span>{category?.icon}</span>
                  <span>{category?.label}</span>
                </div>
                {editButton}
              </div>
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">{article.title}</h1>
              <p className="mt-3 max-w-3xl text-[15px] leading-7 text-blue-100/90">
                {parseInline(bannerDescription)}
              </p>
              {updatedLabel && (
                <div className="mt-6 text-right text-[12px] text-blue-100/75">
                  Cập nhật {updatedLabel}
                </div>
              )}
            </div>
          </section>

          {article.lead.length > 1 && (
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="space-y-3">
                {article.lead.slice(1).map((paragraph, idx) => (
                  <p key={idx} className="text-[15px] leading-7 text-slate-600">
                    {parseInline(paragraph)}
                  </p>
                ))}
              </div>
            </section>
          )}

          {hasSections ? article.sections.map((section, index) => (
            <section key={section.id || index} id={section.id} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              <div className="mb-6 flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-semibold text-blue-700">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{section.title}</h2>
                </div>
              </div>

              <div className="space-y-5">
                {section.blocks.map((block, idx) => (
                  <ContentBlock key={idx} block={block} />
                ))}
              </div>

              {section.subsections.length > 0 && (
                <div className="mt-8 space-y-5">
                  {section.subsections.map((subsection, idx) => (
                    <div key={subsection.id || idx} id={subsection.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
                      <h3 className="mb-4 text-lg font-semibold text-slate-900">{subsection.title}</h3>
                      <div className="space-y-4">
                        {subsection.blocks.map((block, blockIdx) => (
                          <ContentBlock key={blockIdx} block={block} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )) : (
            <section className="rounded-[24px] border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-[15px] leading-7 text-slate-600">
                {page?.content ? parseInline(page.content) : 'Chưa có nội dung.'}
              </p>
            </section>
          )}

          {article.footerNotes.length > 0 && (
            <section className="space-y-4">
              {article.footerNotes.map((note, idx) => (
                note.type === 'warning' ? (
                  <CalloutBlock key={idx} tone="warning">{parseInline(note.text)}</CalloutBlock>
                ) : (
                  <div key={idx} className="text-[12px] text-slate-400">{note.text}</div>
                )
              ))}
            </section>
          )}
      </div>
    </div>
  )
}

/* ─── Admin gate — persist qua localStorage ─── */
const ADMIN_KEY = 'eventus_admin'

function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem(ADMIN_KEY) === '1')
  const [showGate, setShowGate] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState('')

  const tryLogin = () => {
    if (input === ADMIN_PASSWORD) {
      localStorage.setItem(ADMIN_KEY, '1')
      setIsAdmin(true); setShowGate(false); setError(''); setInput('')
    } else {
      setError('Sai mật khẩu')
    }
  }

  const logout = () => {
    localStorage.removeItem(ADMIN_KEY)
    setIsAdmin(false)
  }

  return { isAdmin, showGate, setShowGate, input, setInput, error, tryLogin, logout }
}

/* ─── Main WikiPage ─── */
export default function WikiPage() {
  const location = useLocation()
  const { positionId } = useParams()
  const navigate = useNavigate()
  const [pages, setPages] = useState([])
  const [activeCat, setActiveCat] = useState('khung_nang_luc')
  const [selectedTitle, setSelectedTitle] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
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

  useEffect(() => {
    if (positionId) {
      setActiveCat('khung_nang_luc')
      setSelectedTitle(null)
      setEditing(false)
    }
  }, [positionId])

  useEffect(() => {
    if (positionId) return

    if (location.pathname === '/competency') {
      setActiveCat('khung_nang_luc')
      setSelectedTitle(null)
      setEditing(false)
      return
    }

    if (location.pathname === '/' && activeCat === 'khung_nang_luc') {
      setActiveCat('quy_trinh')
      setSelectedTitle(null)
      setEditing(false)
    }
  }, [location.pathname, positionId, activeCat])

  function selectCat(id) {
    if (id === 'khung_nang_luc') {
      navigate('/competency')
    } else if (location.pathname !== '/') {
      navigate('/')
    }
    setActiveCat(id)
    setSelectedTitle(null)
    setEditing(false)
  }
  function openPage(title) { setSelectedTitle(title); setEditing(false) }
  function startEdit() { setDraft(currentPage?.content || ''); setEditing(true) }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="flex flex-1 min-h-0">

        {/* Sidebar */}
        <aside className="w-80 flex-shrink-0 border-r border-slate-200/80 bg-white/95 flex flex-col">
          <div className="border-b border-slate-200/70 px-4 py-4">
            <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-blue-900 to-teal-700 px-4 py-2.5 text-white shadow-lg">
              <p className="text-[15px] font-semibold tracking-tight">Eventus Production Handbook</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => selectCat(cat.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition-all duration-200 ${
                  activeCat === cat.id
                    ? 'border-blue-200 bg-gradient-to-r from-blue-50 via-white to-teal-50 shadow-sm shadow-blue-100/70'
                    : 'border-transparent bg-white text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl text-lg ${
                      activeCat === cat.id
                        ? 'bg-white text-blue-700 ring-1 ring-blue-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-[14px] font-semibold leading-5 ${activeCat === cat.id ? 'text-slate-900' : 'text-slate-700'}`}>
                      {cat.label}
                    </div>
                    <div className={`mt-1 text-[12px] leading-5 ${activeCat === cat.id ? 'text-slate-600' : 'text-slate-400'}`}>
                      {cat.shortDesc}
                    </div>
                  </div>
                  {activeCat === cat.id && (
                    <div className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              </button>
            ))}
          </nav>

          <div className="border-t border-slate-200/70 px-4 py-3">
            {admin.isAdmin ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700">
                      <span>✅</span> Admin mode
                    </div>
                    <p className="mt-1 text-[11px] leading-5 text-emerald-700/80">
                      Bạn đang có thể chỉnh sửa nội dung wiki trực tiếp.
                    </p>
                  </div>
                  <button onClick={admin.logout} className="text-[11px] font-medium text-emerald-700/70 hover:text-red-500 transition-colors">
                    Đăng xuất
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => admin.setShowGate(true)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/60"
              >
                <div className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
                  <span>🔒</span>
                  <span>Đăng nhập Admin</span>
                </div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">
                  Mở chế độ chỉnh sửa để cập nhật nội dung nội bộ.
                </p>
              </button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

          {/* Khung nang luc */}
          {activeCat === 'khung_nang_luc' && (positionId ? <div className="flex-1 overflow-y-auto"><PositionPage embedded /></div> : <CompetencyGrid />)}

          {/* Card grid cac danh muc khac */}
          {activeCat !== 'khung_nang_luc' && !selectedTitle && (
            <div className="flex-1 overflow-y-auto p-6">
              <CategoryBanner cat={currentCat} />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {currentCat?.items?.map(title => {
                  const page = pages.find(p => p.category === activeCat && p.title === title)
                  const cardMeta = CATEGORY_CARD_META[activeCat] || CATEGORY_CARD_META.quy_trinh
                  return (
                    <button
                      key={title}
                      onClick={() => openPage(title)}
                      className={`group relative overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br ${cardMeta.accent} p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg hover:shadow-slate-200/70`}
                    >
                      <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/60 to-transparent pointer-events-none" />
                      <div className="relative flex h-full flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${cardMeta.iconBg} ${cardMeta.iconText} shadow-sm ring-1 ring-white/70`}>
                            <span className="text-lg">{currentCat?.icon}</span>
                          </div>
                          <div className="inline-flex items-center rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200/70">
                            {cardMeta.badge}
                          </div>
                        </div>

                        <div className="mt-5 min-h-[72px]">
                          <div className="text-[16px] font-semibold leading-6 text-slate-800 transition-colors group-hover:text-blue-700">
                            {title}
                          </div>
                        </div>

                        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/70 pt-4">
                          {page ? (
                            <div className="text-[11px] font-medium text-slate-500">
                              Cập nhật: {new Date(page.updated_at).toLocaleDateString('vi-VN')}
                            </div>
                          ) : (
                            <div className="text-[11px] italic text-slate-400">
                              Chưa có nội dung
                            </div>
                          )}
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/85 text-slate-400 ring-1 ring-slate-200/70 transition-all group-hover:translate-x-0.5 group-hover:text-blue-700">
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Content view */}
          {activeCat !== 'khung_nang_luc' && selectedTitle && !editing && (
            <div className="flex-1 overflow-y-auto">
              <div className="px-6 pt-0 pb-5">
                {currentPage ? (
                  <ArticleDocument
                    title={selectedTitle}
                    category={currentCat}
                    page={{
                      ...currentPage,
                      editButton: admin.isAdmin ? (
                        <button
                          onClick={startEdit}
                          className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-white/12 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/15 backdrop-blur transition-colors hover:bg-white/18"
                        >
                          ✏️ Chỉnh sửa
                        </button>
                      ) : null,
                    }}
                  />
                ) : (
                  <div className="mx-auto max-w-4xl rounded-3xl border border-dashed border-slate-200 bg-white px-8 py-12 text-center text-sm italic text-slate-400">
                    Chưa có nội dung.{admin.isAdmin ? ' Nhấn "Chỉnh sửa" để thêm.' : ''}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Editor */}
          {activeCat !== 'khung_nang_luc' && selectedTitle && editing && (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[15px] font-bold text-slate-700">✏️ {selectedTitle}</h2>
                <div className="flex gap-2">
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
                Hỗ trợ cả nội dung text thường lẫn Markdown cơ bản. Nếu có `#`, `##`, `-`, `1.` thì giao diện sẽ lên đẹp và ổn định hơn.
              </p>
              <textarea value={draft} onChange={e => setDraft(e.target.value)}
                className="flex-1 w-full border border-slate-200 rounded-xl p-4 text-[13px] text-slate-700 font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Nhập nội dung Markdown..." />
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
