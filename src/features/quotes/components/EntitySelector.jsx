const DEFAULT_ENTITIES = [
  { entity_code: 'EVENTUS', name: 'Eventus' },
  { entity_code: 'MEDIAMONSTER', name: 'Mediamonster' },
]

function getEntityLabel(entity) {
  return entity?.display_name || entity?.legal_name || entity?.name || entity?.entity_code
}

export default function EntitySelector({ entities = [], value, onChange, disabled = false }) {
  const options = entities.length ? entities : DEFAULT_ENTITIES

  return (
    <div className="space-y-2">
      <label className="text-[12px] font-semibold uppercase tracking-[0.12em] text-slate-500">
        Pháp nhân
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(entity => {
          const code = entity.entity_code || entity.code
          const active = value === code

          return (
            <button
              key={code}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(code)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                active
                  ? 'border-[#f8981d] bg-orange-50 text-slate-950 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <div className="text-[14px] font-semibold">{getEntityLabel(entity)}</div>
              <div className="mt-0.5 text-[11px] text-slate-400">{code}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
