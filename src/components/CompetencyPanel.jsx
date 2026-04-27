const GROUP_META = {
  'chuyen_mon': {
    label: 'Năng lực chuyên môn',
    icon: '⚙️',
    color: 'border-blue-300 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
  },
  'nghien_cuu_sang_tao': {
    label: 'Nghiên cứu, sáng tạo & đề xuất',
    icon: '💡',
    color: 'border-violet-300 bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
  },
  'trach_nhiem': {
    label: 'Trách nhiệm',
    icon: '✅',
    color: 'border-emerald-300 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  'xu_ly_tinh_huong': {
    label: 'Kỹ năng xử lý tình huống',
    icon: '⚡',
    color: 'border-amber-300 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
  },
  'lam_viec_khach_hang': {
    label: 'Kỹ năng làm việc với khách hàng',
    icon: '🤝',
    color: 'border-rose-300 bg-rose-50',
    badge: 'bg-rose-100 text-rose-700',
  },
}

function parseItems(text) {
  if (!text) return []
  return text
    .split('\n')
    .map(line => line.replace(/^[-•+]\s*/, '').trim())
    .filter(Boolean)
}

function CompetencyGroup({ groupId, content }) {
  const meta = GROUP_META[groupId] || {
    label: groupId,
    icon: '📌',
    color: 'border-gray-300 bg-gray-50',
    badge: 'bg-gray-100 text-gray-700',
  }

  const items = parseItems(content)
  if (!items.length) return null

  return (
    <div className={`rounded-xl border-l-4 ${meta.color} p-4`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">{meta.icon}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
          {meta.label}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-soft leading-relaxed">
            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-ink-faint flex-shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function CompetencyPanel({ competencies, dimensions }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {dimensions.map(dim => (
        <CompetencyGroup
          key={dim.id}
          groupId={dim.id}
          content={competencies[dim.id]}
        />
      ))}
    </div>
  )
}
