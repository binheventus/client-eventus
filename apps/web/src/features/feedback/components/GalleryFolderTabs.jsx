// Adaptive folder tab bar: [Tất cả] + one tab per subfolder group, each with
// its photo count. Render only when there are 2+ groups (caller checks
// hasMultiple). tabId 'all' = combined view.
export default function GalleryFolderTabs({ groups, total, activeTab, onSelect }) {
  if (!groups?.length) return null

  const tabs = [{ id: 'all', name: 'Tất cả', count: total }, ...groups.map(g => ({ id: g.id, name: g.name, count: g.photos.length }))]

  return (
    <div className="-mx-1 mb-4 flex flex-wrap gap-2 px-1">
      {tabs.map(tab => {
        const active = tab.id === activeTab
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect?.(tab.id)}
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold transition',
              active
                ? 'bg-[#f79820] text-white shadow-[0_6px_14px_rgba(247,152,32,0.22)]'
                : 'bg-white text-[#5b6577] ring-1 ring-[#e5e9f1] hover:ring-[#f79820]/50',
            ].join(' ')}
          >
            <span>{tab.name}</span>
            <span className={active ? 'text-white/80' : 'text-[#9aa4b4]'}>{tab.count}</span>
          </button>
        )
      })}
    </div>
  )
}
