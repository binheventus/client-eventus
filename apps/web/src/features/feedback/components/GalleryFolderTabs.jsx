// Folder switcher: one item per Drive subfolder. There is intentionally no
// "all" tab so the page only renders the currently selected folder.
export default function GalleryFolderTabs({ groups, activeTab, onSelect }) {
  if (!groups?.length) return null

  const activeGroup = groups.find(group => group.id === activeTab) || groups[0]
  const parentGroups = groups.reduce((items, group) => {
    if (!group.parentGroupId || items.some(item => item.id === group.parentGroupId)) return items
    return [...items, { id: group.parentGroupId, name: group.parentGroupName || group.fullName || group.name }]
  }, [])
  const hasParentTabs = parentGroups.length >= 2
  const activeParentId = activeGroup?.parentGroupId || null
  const visibleGroups = hasParentTabs
    ? groups.filter(group => group.parentGroupId === activeParentId)
    : groups
  const activeFileCount = activeGroup?.photos?.length || 0
  const activeDownloadLabel = activeGroup
    ? `Tải xuống Folder ${activeGroup.fullName || activeGroup.name} (${activeFileCount} Files)`
    : 'Tải xuống Folder'

  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col items-start gap-2">
        {hasParentTabs && (
          <div className="mb-1 flex flex-wrap items-center gap-3">
            {parentGroups.map(parent => {
              const active = parent.id === activeParentId
              const firstChild = groups.find(group => group.parentGroupId === parent.id)
              return (
                <button
                  key={parent.id}
                  type="button"
                  onClick={() => firstChild && onSelect?.(firstChild.id)}
                  className={[
                    'inline-flex min-h-7 items-center rounded-md px-1.5 text-left text-[12px] font-extrabold transition',
                    active ? 'text-[#f79820]' : 'text-[#5b6577] hover:bg-[#fff7ed] hover:text-[#d97706]',
                  ].join(' ')}
                >
                  {parent.name}
                </button>
              )
            })}
          </div>
        )}
        {visibleGroups.map(group => {
          const active = group.id === activeTab
          const count = group.photos?.length || 0
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect?.(group.id)}
              className={[
                'inline-flex min-h-7 items-center gap-1.5 rounded-md px-1.5 text-left text-[12px] font-bold transition',
                active
                  ? 'text-[#f79820]'
                  : 'text-[#5b6577] hover:bg-[#fff7ed] hover:text-[#d97706]',
              ].join(' ')}
            >
              <span>{group.name}</span>
              <span className={active ? 'text-[#f79820]/75' : 'text-[#9aa4b4]'}>· {count} ảnh</span>
            </button>
          )
        })}
      </div>
      <div className="flex justify-start lg:justify-end">
        {activeGroup?.folderUrl ? (
          <a
            href={activeGroup.folderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d97706] bg-[#f79820] px-5 text-[12px] font-extrabold text-white ring-2 ring-[#f79820]/20 shadow-[0_12px_28px_rgba(247,152,32,0.38)] transition hover:-translate-y-0.5 hover:bg-[#d97706] hover:ring-[#f79820]/30 hover:shadow-[0_14px_32px_rgba(247,152,32,0.48)]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span>{activeDownloadLabel}</span>
          </a>
        ) : (
          <span
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#f79820]/40 bg-[#fff7ed] px-5 text-[12px] font-extrabold text-[#d97706] ring-2 ring-[#f79820]/10"
            title="Chưa có link folder con"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <span>{activeDownloadLabel}</span>
          </span>
        )}
      </div>
    </div>
  )
}
