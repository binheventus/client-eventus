import {
  QUOTE_STATUS_OPTIONS,
  QUOTE_TIER_OPTIONS,
} from '../lib/quoteList'

const FILTER_CONTROL_CLASS = 'min-w-0 rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] outline-none focus:border-[#f8981d]'

function SelectFilter({ value, options, onChange }) {
  return (
    <select value={value} onChange={event => onChange(event.target.value)} className={FILTER_CONTROL_CLASS}>
      {options.map(option => (
        <option key={option.value || option.label} value={option.value}>{option.label}</option>
      ))}
    </select>
  )
}

export default function QuoteListFilters({ filters, onFilterChange, onSearchSubmit }) {
  function handleSearchKeyDown(event) {
    if (event.key === 'Enter') onSearchSubmit()
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_190px_120px_145px_145px]">
        <input
          value={filters.search}
          onChange={event => onFilterChange('search', event.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Tìm mã BG, khách, sự kiện..."
          className={FILTER_CONTROL_CLASS}
        />
        <SelectFilter
          value={filters.status}
          options={QUOTE_STATUS_OPTIONS}
          onChange={value => onFilterChange('status', value)}
        />
        <SelectFilter
          value={filters.tier_code}
          options={QUOTE_TIER_OPTIONS}
          onChange={value => onFilterChange('tier_code', value)}
        />
        <input
          type="date"
          value={filters.date_from}
          onChange={event => onFilterChange('date_from', event.target.value)}
          className={FILTER_CONTROL_CLASS}
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={event => onFilterChange('date_to', event.target.value)}
          className={FILTER_CONTROL_CLASS}
        />
      </div>
    </section>
  )
}
