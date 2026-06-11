const DEFAULT_ENTITIES = [
  { entity_code: 'EVT', name: 'Eventus' },
  { entity_code: 'MMT', name: 'Mediamonster' },
]

function getEntityLabel(entity) {
  return entity?.display_name || entity?.legal_name || entity?.name || entity?.entity_code
}

export default function EntitySelector({ entities = [], value, onChange, disabled = false, compact = false, action = null }) {
  const options = entities.length ? entities : DEFAULT_ENTITIES

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        Pháp nhân
      </label>
      <div className={`flex flex-wrap ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {options.map(entity => {
          const code = entity.entity_code || entity.code
          const active = value === code

          return (
            <button
              key={code}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(code)}
              className={`${compact ? 'w-[104px] px-2 py-2' : 'min-w-[132px] px-3 py-2'} rounded-lg border text-left transition ${
                active
                  ? 'border-orange-300 bg-orange-50 text-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className={`truncate font-semibold ${compact ? 'text-[11px]' : 'text-[12px]'}`}>{getEntityLabel(entity)}</div>
            </button>
          )
        })}
        {action}
      </div>
    </div>
  )
}
