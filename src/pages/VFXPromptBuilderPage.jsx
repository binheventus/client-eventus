import { useMemo, useState } from 'react'

const SECTIONS = [
  {
    num: '01',
    title: 'Thông tin cơ bản',
    fields: [
      { label: 'Platform', type: 'text', placeholder: 'Veo 3 / Kling 2.0 / cả hai...' },
      { label: 'Shot length', type: 'text', placeholder: 'vd: 5s, 8s, 10s...' },
      { label: 'Aspect ratio', type: 'tags', mode: 'single', options: ['16:9', '9:16', '1:1', '4:3', '2.39:1'] },
      { label: 'Resolution', type: 'text', placeholder: 'optional · vd: 4K, 1080p...' },
    ],
  },
  {
    num: '02',
    title: 'Input hình ảnh',
    fields: [
      { label: 'Frame đầu', type: 'text', placeholder: 'mô tả ngắn ảnh đầu...' },
      { label: 'Frame cuối', type: 'text', placeholder: 'mô tả ngắn ảnh cuối...' },
      { label: 'Match layout', type: 'tags', mode: 'single', options: ['Có', 'Không', 'Linh hoạt'] },
      { label: 'Focus chính', type: 'text', placeholder: 'vật thể / nhân vật trung tâm...' },
      { label: 'Điểm cổng', displayLabel: 'Điểm cổng chuyển', type: 'text', placeholder: 'vd: line sáng, màn hình, đèn, logo...' },
    ],
  },
  {
    num: '03',
    title: 'Ý tưởng Transition Flow',
    important: '⚡ Quan trọng nhất',
    steps: [
      { name: 'Bắt đầu', type: 'text', field: 'Step 1 - Bắt đầu', placeholder: 'Camera + trạng thái ban đầu...' },
      { name: 'Kích hoạt', type: 'text', field: 'Step 2 - Kích hoạt', placeholder: 'Hiệu ứng bắt đầu từ đâu, cái gì trigger...' },
      { name: 'Biến đổi', type: 'tags', field: 'Step 3 - Biến đổi', options: ['stretch', 'explode', 'dissolve', 'morph', 'energy', 'tunnel'] },
      { name: 'Di chuyển chính', type: 'tags', field: 'Step 4 - Di chuyển chính', options: ['FPV', 'zoom', 'xuyên', 'rơi', 'bay', 'orbit'] },
      { name: 'Reveal', type: 'tags', field: 'Step 5 - Reveal', options: ['tối → sáng', 'assemble', 'emerge', 'fade'] },
    ],
  },
  {
    num: '04',
    title: 'Camera Choreography',
    fields: [
      { label: 'Loại camera', type: 'tags', options: ['cinematic', 'FPV', 'drone', 'virtual crane'] },
      { label: 'Chuyển động camera', displayLabel: 'Chuyển động', type: 'tags', options: ['push-in', 'pull-out', 'orbit', 'dive', 'glide', 'whip'] },
      { label: 'Nhịp camera', displayLabel: 'Nhịp', type: 'tags', mode: 'single', options: ['slow → fast → slow', 'constant', 'burst'] },
      { label: 'Motion đặc biệt', type: 'tags', options: ['roll', 'tilt', 'drop', 'acceleration mạnh', 'không'] },
    ],
  },
  {
    num: '05',
    title: 'Style hình ảnh',
    fields: [
      { label: 'Genre', type: 'tags', mode: 'single', options: ['Cinematic', 'Trailer', 'Commercial'] },
      { label: 'Mood', type: 'tags', options: ['Futuristic', 'High-tech', 'Luxury', 'Minimal'] },
      { label: 'Realism style', type: 'tags', mode: 'single', options: ['Realistic', 'Hyper-realistic', 'Stylized'] },
      { label: 'Density', type: 'tags', mode: 'single', options: ['Clean', 'Dense VFX', 'Atmospheric'] },
    ],
  },
  {
    num: '06',
    title: 'Hệ VFX chính',
    note: '💡 Chọn 3–6 cái phù hợp nhất, không cần chọn tất cả.',
    directTags: {
      field: 'VFX chính',
      options: ['Light trails', 'Volumetric light', 'Beams', 'Glow / bloom', 'Energy pulse', 'Holographic lines', 'Particle dust', 'Particle spark', 'Particle digital', 'Smoke / haze', 'Shockwave', 'Grid / tech lines'],
    },
  },
  {
    num: '07',
    title: 'VFX phụ',
    optional: true,
    directTags: {
      field: 'VFX phụ',
      options: ['Lens flare', 'Motion streak', 'Floating dust', 'Subtle sparks', 'Atmosphere fog'],
    },
  },
  {
    num: '08',
    title: 'Màu sắc & Ánh sáng',
    fields: [
      { label: 'Main color', type: 'text', placeholder: 'vd: cyan, deep blue, gold...' },
      { label: 'Secondary color', type: 'text', placeholder: 'vd: magenta, white, amber...' },
      { label: 'Light type', type: 'tags', mode: 'single', options: ['cold', 'warm', 'neutral'] },
      { label: 'Contrast', type: 'tags', mode: 'single', options: ['low', 'medium', 'high'] },
      { label: 'Glow intensity', type: 'tags', mode: 'single', options: ['nhẹ', 'vừa', 'mạnh'] },
    ],
  },
  {
    num: '09',
    title: 'Nhịp & Timing',
    timing: ['Build-up', 'Acceleration', 'Reveal'],
    fields: [
      { label: 'Hit beat', type: 'tags', mode: 'single', options: ['Có', 'Không'] },
    ],
  },
  {
    num: '10',
    title: 'Mức độ Realism',
    directTags: {
      field: 'Realism',
      options: ['Ultra realistic', 'Cinematic realistic', 'Semi-stylized', 'Abstract'],
      mode: 'single',
    },
  },
  {
    num: '11',
    title: 'Ràng buộc bắt buộc',
    fields: [
      { label: 'Giữ nguyên', type: 'text', placeholder: 'vd: logo, màu thương hiệu, layout...' },
      { label: 'Không được thay đổi', displayLabel: 'Không được đổi', type: 'text', placeholder: 'vd: tỉ lệ logo, vị trí text...' },
      { label: 'Không thêm', type: 'text', placeholder: 'vd: text, watermark, người...' },
    ],
  },
  {
    num: '12',
    title: 'Negative Prompt',
    important: '⚠ Cực quan trọng',
    negativeItems: ['Fake CGI', 'Game-like visuals', 'Quá nhiều particle', 'Blur mạnh', 'Rung handheld', 'Cháy sáng quá mức', 'Fantasy quá đà'],
    fields: [
      { label: 'Negative thêm', type: 'text', placeholder: 'vd: cartoon, anime, low resolution...' },
    ],
  },
  {
    num: '13',
    title: 'Reference',
    optional: true,
    directTags: {
      field: 'Reference',
      options: ['Trailer công nghệ', 'Opening event lớn', 'Sci-fi cinematic', 'Automotive spot', 'Fashion film'],
    },
    fields: [
      { label: 'Reference khác', displayLabel: 'Link / mô tả', type: 'text', placeholder: 'link YouTube hoặc mô tả ngắn...' },
    ],
  },
  {
    num: '14',
    title: 'Output mong muốn',
    outputCards: ['Prompt tiếng Anh', 'Có negative prompt', 'Viết theo beat'],
    fields: [
      { label: 'Ghi chú', displayLabel: 'Ghi chú thêm', type: 'text', placeholder: 'optional · yêu cầu đặc biệt cho prompt...' },
    ],
  },
]

const EMPTY_STATE = { fields: {}, tags: {}, cards: [] }

function hasSectionData(section, formState) {
  return Boolean(
    sectionFieldKeys(section).some(key => String(formState.fields[key] || '').trim()) ||
    sectionTagKeys(section).some(key => formState.tags[key]?.length) ||
    (section.outputCards && formState.cards.length > 0)
  )
}

function sectionFieldKeys(section) {
  return [
    ...(section.fields || []).map(field => field.label),
    ...(section.steps || []).filter(step => step.type === 'text').map(step => step.field),
    ...(section.timing || []),
  ]
}

function sectionTagKeys(section) {
  return [
    ...(section.fields || []).filter(field => field.type === 'tags').map(field => field.label),
    ...(section.steps || []).filter(step => step.type === 'tags').map(step => step.field),
    ...(section.directTags ? [section.directTags.field] : []),
  ]
}

function buildBrief(formState) {
  const lines = ['=== EVENTUS VFX TRANSITION BRIEF ===', '']

  SECTIONS.forEach(section => {
    const sectionLines = []

    ;(section.fields || []).forEach(field => {
      if (field.type === 'text') {
        const value = String(formState.fields[field.label] || '').trim()
        if (value) sectionLines.push(`- ${field.displayLabel || field.label}: ${value}`)
      }

      if (field.type === 'tags') {
        const active = formState.tags[field.label] || []
        if (active.length) sectionLines.push(`- ${field.displayLabel || field.label}: ${active.join(', ')}`)
      }
    })

    ;(section.steps || []).forEach(step => {
      if (step.type === 'text') {
        const value = String(formState.fields[step.field] || '').trim()
        if (value) sectionLines.push(`- ${step.name}: ${value}`)
      }

      if (step.type === 'tags') {
        const active = formState.tags[step.field] || []
        if (active.length) sectionLines.push(`- ${step.name}: ${active.join(', ')}`)
      }
    })

    if (section.directTags) {
      const active = formState.tags[section.directTags.field] || []
      if (active.length) sectionLines.push(`- ${active.join(', ')}`)
    }

    if (section.num === '09') {
      ;(section.timing || []).forEach(label => {
        const value = String(formState.fields[label] || '').trim()
        if (value) sectionLines.push(`- ${label}: ${value}s`)
      })
    }

    if (section.num === '12') {
      sectionLines.push(`- Negative cố định: ${section.negativeItems.join(', ')}`)
      const negativeCustom = String(formState.fields['Negative thêm'] || '').trim()
      if (negativeCustom) sectionLines.push(`- Negative thêm: ${negativeCustom}`)
    }

    if (section.num === '14' && formState.cards.length) {
      sectionLines.push(`- Format: ${formState.cards.join(', ')}`)
    }

    if (sectionLines.length) {
      lines.push(`[${section.num}] ${section.title.toUpperCase()}`)
      lines.push(...sectionLines)
      lines.push('')
    }
  })

  lines.push('=== END OF BRIEF ===')
  return lines.join('\n')
}

function TagGrid({ field, options, mode, value = [], onChange }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {options.map(option => {
        const active = value.includes(option)
        return (
          <button
            key={option}
            type="button"
            onClick={() => {
              if (mode === 'single') onChange(active ? [] : [option])
              else onChange(active ? value.filter(item => item !== option) : [...value, option])
            }}
            className={`rounded-md border px-3.5 py-1.5 font-['JetBrains_Mono'] text-[13px] font-medium transition ${
              active
                ? 'border-[#0052cc] bg-[#0052cc] font-bold text-white'
                : 'border-[#d4d1c7] bg-white text-[#6b6b6b] hover:border-[#0052cc] hover:bg-[#e6efff] hover:text-[#0052cc]'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

function TextInput({ value = '', onChange, placeholder, type = 'text' }) {
  return (
    <input
      type={type}
      value={value}
      min={type === 'number' ? '0' : undefined}
      step={type === 'number' ? '0.5' : undefined}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-md border px-3.5 py-2.5 font-['Manrope'] text-[15px] text-[#1a1a1a] outline-none transition placeholder:text-[#9a9a9a] focus:border-[#0052cc] focus:bg-white focus:shadow-[0_0_0_3px_#e6efff] ${
        String(value || '').trim() ? 'border-[#d4d1c7] bg-white' : 'border-[#e5e3dc] bg-[#fafaf7]'
      } ${type === 'number' ? 'text-center font-[' + "'JetBrains_Mono'" + '] text-3xl font-bold text-[#0052cc]' : ''}`}
    />
  )
}

function SectionCard({ section, formState, setField, setTags, toggleCard }) {
  return (
    <section className="mb-5 rounded-xl border border-[#e5e3dc] bg-white px-8 py-7 shadow-[0_1px_3px_rgba(0,0,0,0.02)] max-sm:px-5 max-sm:py-6">
      <div className="mb-5 flex items-center gap-3.5 border-b border-[#e5e3dc] pb-4">
        <span className="shrink-0 rounded bg-[#e6efff] px-2.5 py-1 font-['JetBrains_Mono'] text-[13px] font-bold tracking-wider text-[#0052cc]">
          {section.num}
        </span>
        <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[#1a1a1a]">{section.title}</h2>
        {section.important && (
          <span className="ml-auto shrink-0 rounded border border-[#d2691e] bg-[#fdf3ea] px-2.5 py-1 font-['JetBrains_Mono'] text-[10px] font-bold uppercase tracking-[0.15em] text-[#d2691e]">
            {section.important}
          </span>
        )}
        {section.optional && <span className="ml-auto font-['JetBrains_Mono'] text-[11px] font-medium text-[#9a9a9a]">optional</span>}
      </div>

      {section.note && <div className="mb-4 rounded-md border border-[#f0e9b8] bg-[#fefbe9] px-3.5 py-2.5 text-[14px] leading-6 text-[#7a6311]">{section.note}</div>}

      {(section.fields || []).map(field => (
        <div key={field.label} className="grid grid-cols-[180px_1fr] items-start gap-x-6 border-b border-[#e5e3dc] py-3.5 last:border-b-0 last:pb-0 first:pt-0 max-sm:grid-cols-1 max-sm:gap-y-2">
          <span className="pt-2 font-['JetBrains_Mono'] text-[12px] font-semibold uppercase leading-5 tracking-[0.03em] text-[#6b6b6b] max-sm:pt-0">
            {field.displayLabel || field.label}
          </span>
          {field.type === 'text' ? (
            <TextInput
              value={formState.fields[field.label] || ''}
              onChange={value => setField(field.label, value)}
              placeholder={field.placeholder}
            />
          ) : (
            <TagGrid
              field={field.label}
              options={field.options}
              mode={field.mode}
              value={formState.tags[field.label] || []}
              onChange={value => setTags(field.label, value)}
            />
          )}
        </div>
      ))}

      {section.steps && (
        <div className="flex flex-col gap-4">
          {section.steps.map((step, index) => (
            <div key={step.field} className="flex items-start gap-3.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0052cc] bg-[#e6efff] font-['JetBrains_Mono'] text-[13px] font-bold text-[#0052cc]">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="mb-2 font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-[0.15em] text-[#0052cc]">{step.name}</div>
                {step.type === 'text' ? (
                  <TextInput value={formState.fields[step.field] || ''} onChange={value => setField(step.field, value)} placeholder={step.placeholder} />
                ) : (
                  <TagGrid options={step.options} value={formState.tags[step.field] || []} onChange={value => setTags(step.field, value)} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {section.directTags && (
        <TagGrid
          options={section.directTags.options}
          mode={section.directTags.mode}
          value={formState.tags[section.directTags.field] || []}
          onChange={value => setTags(section.directTags.field, value)}
        />
      )}

      {section.timing && (
        <div className="grid grid-cols-3 gap-3.5 max-sm:grid-cols-1">
          {section.timing.map(label => (
            <div key={label} className="rounded-[10px] border border-[#e5e3dc] bg-[#fafaf7] px-4 py-4 text-center transition focus-within:border-[#0052cc] focus-within:bg-white focus-within:shadow-[0_0_0_3px_#e6efff]">
              <div className="mb-2.5 font-['JetBrains_Mono'] text-[11px] font-bold uppercase tracking-[0.15em] text-[#6b6b6b]">{label}</div>
              <input
                type="number"
                min="0"
                step="0.5"
                value={formState.fields[label] || ''}
                onChange={event => setField(label, event.target.value)}
                placeholder="—"
                className="w-full bg-transparent text-center font-['JetBrains_Mono'] text-3xl font-bold leading-none text-[#0052cc] outline-none placeholder:text-[#9a9a9a]"
              />
              <div className="mt-1.5 font-['JetBrains_Mono'] text-[12px] text-[#6b6b6b]">giây</div>
            </div>
          ))}
        </div>
      )}

      {section.negativeItems && (
        <>
          <div className="flex flex-col gap-2">
            {section.negativeItems.map(item => (
              <div key={item} className="flex items-center gap-3 rounded-md bg-[#fce8e6] px-3 py-2 font-['JetBrains_Mono'] text-[13px] font-medium text-[#c0392b] before:flex before:h-5 before:w-5 before:items-center before:justify-center before:rounded before:bg-[#c0392b] before:text-xs before:font-bold before:text-white before:content-['✕']">
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3.5 rounded-md border border-[#f0e9b8] bg-[#fefbe9] px-3.5 py-2.5 text-[14px] leading-6 text-[#7a6311]">+ Thêm negative riêng (ngăn cách bằng dấu phẩy):</div>
        </>
      )}

      {section.outputCards && (
        <div className="grid grid-cols-3 gap-3 max-sm:grid-cols-1">
          {section.outputCards.map(label => {
            const active = formState.cards.includes(label)
            const icon = label.includes('negative') ? '🚫' : label.includes('beat') ? '🔀' : '📝'
            return (
              <button
                key={label}
                type="button"
                onClick={() => toggleCard(label)}
                className={`rounded-[10px] border px-3.5 py-5 text-center text-[14px] font-semibold leading-6 transition ${
                  active ? 'border-[#0052cc] bg-[#e6efff] text-[#0052cc]' : 'border-[#e5e3dc] bg-[#fafaf7] text-[#6b6b6b] hover:border-[#0052cc] hover:bg-[#e6efff] hover:text-[#0052cc]'
                }`}
              >
                <div className="text-xl">{icon}</div>
                {label}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function VFXPromptBuilderPage() {
  const [formState, setFormState] = useState(EMPTY_STATE)
  const [modalOpen, setModalOpen] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState('')

  const progress = useMemo(() => SECTIONS.filter(section => hasSectionData(section, formState)).length, [formState])

  const setField = (field, value) => {
    setFormState(prev => ({ ...prev, fields: { ...prev.fields, [field]: value } }))
  }

  const setTags = (field, value) => {
    setFormState(prev => ({ ...prev, tags: { ...prev.tags, [field]: value } }))
  }

  const toggleCard = (label) => {
    setFormState(prev => ({
      ...prev,
      cards: prev.cards.includes(label) ? prev.cards.filter(item => item !== label) : [...prev.cards, label],
    }))
  }

  const showToast = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2000)
  }

  const generatePrompt = async () => {
    const brief = buildBrief(formState)
    setModalOpen(true)
    setGeneratedPrompt('')
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/generate-vfx-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload?.error || 'Không generate được prompt.')
      setGeneratedPrompt(payload.prompt || '')
    } catch (err) {
      setError(err?.message || 'Có lỗi khi gọi Claude API.')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    if (!window.confirm('Xóa hết lựa chọn và quay về form trống?')) return
    setFormState(EMPTY_STATE)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(generatedPrompt)
      showToast('Đã copy vào clipboard')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = generatedPrompt
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      showToast('Đã copy vào clipboard')
    }
  }

  return (
    <div className="relative flex-1 overflow-y-auto bg-[#f6f5f0] px-6 pb-36 pt-12 text-[#1a1a1a] [font-family:'Manrope',system-ui,sans-serif] max-sm:px-4 max-sm:pt-8">
      <div className="mx-auto max-w-[880px]">
        <header className="mb-10 text-center before:mx-auto before:mb-6 before:block before:h-[3px] before:w-20 before:rounded before:bg-[#0052cc] before:content-['']">
          <div className="mb-5 inline-block rounded border border-[#0052cc] bg-[#e6efff] px-3.5 py-1.5 font-['JetBrains_Mono'] text-[12px] font-bold uppercase tracking-[0.18em] text-[#0052cc]">
            Eventus · Prompt Builder
          </div>
          <h1 className="mb-3.5 text-[38px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#1a1a1a] max-sm:text-[29px]">
            VFX Transition<br /><span className="text-[#0052cc]">Prompt Builder</span>
          </h1>
          <p className="font-['JetBrains_Mono'] text-[15px] text-[#6b6b6b]">// điền form → tạo brief → Claude → prompt tiếng Anh</p>
        </header>

        <section className="mb-8 rounded-lg border border-[#e5e3dc] border-l-[#0052cc] border-l-[3px] bg-white px-5 py-4 text-[15px] leading-8 text-[#1a1a1a]">
          <div className="mb-2 font-['JetBrains_Mono'] text-[12px] font-bold uppercase tracking-[0.15em] text-[#0052cc]">// Cách dùng</div>
          {['Tick các tag phù hợp · điền các ô text quan trọng (không cần điền hết).', 'Click "Generate Prompt" để Claude viết prompt tiếng Anh chuẩn.', 'Kiểm tra prompt trong popup rồi copy paste vào Veo / Kling.'].map((step, index) => (
            <div key={step}>
              <span className="mr-2 inline-block h-[22px] w-[22px] rounded-full bg-[#e6efff] text-center font-['JetBrains_Mono'] text-[12px] font-bold leading-[22px] text-[#0052cc]">{index + 1}</span>
              {step}
            </div>
          ))}
        </section>

        {SECTIONS.map(section => (
          <SectionCard
            key={section.num}
            section={section}
            formState={formState}
            setField={setField}
            setTags={setTags}
            toggleCard={toggleCard}
          />
        ))}

        <footer className="mt-10 border-t border-[#e5e3dc] pt-6 text-center font-['JetBrains_Mono'] text-[12px] font-medium tracking-[0.18em] text-[#9a9a9a]">
          EVENTUS · VFX TRANSITION TEMPLATE · v1.0
        </footer>
      </div>

      <div className="fixed bottom-6 left-1/2 z-40 flex w-[calc(100%-48px)] max-w-[880px] -translate-x-1/2 items-center gap-3 rounded-[14px] border border-[#d4d1c7] bg-white px-[18px] py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] max-sm:w-[calc(100%-32px)] max-sm:gap-2 max-sm:px-3 max-sm:py-2.5">
        <span className="whitespace-nowrap rounded-full border border-[#e5e3dc] bg-[#fafaf7] px-3.5 py-2 font-['JetBrains_Mono'] text-[12px] font-semibold text-[#6b6b6b]">
          <span className="font-bold text-[#0052cc]">{progress}</span> / 14 mục
        </span>
        <button type="button" onClick={resetForm} className="rounded-lg border border-[#d4d1c7] bg-white px-5 py-3 font-['JetBrains_Mono'] text-[13px] font-bold uppercase tracking-[0.08em] text-[#6b6b6b] transition hover:border-[#1a1a1a] hover:text-[#1a1a1a] max-sm:px-3">
          Reset
        </button>
        <button type="button" onClick={generatePrompt} disabled={loading} className="flex-1 rounded-lg border border-[#0052cc] bg-[#0052cc] px-5 py-3 font-['JetBrains_Mono'] text-[13px] font-bold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:bg-[#003d99] hover:shadow-[0_6px_20px_rgba(0,82,204,0.3)] disabled:cursor-not-allowed disabled:opacity-70">
          {loading ? 'Generating...' : 'Generate Prompt'}
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,20,20,0.5)] p-6 backdrop-blur-md" onClick={(event) => event.target === event.currentTarget && setModalOpen(false)}>
          <div className="flex max-h-[88vh] w-full max-w-[760px] flex-col rounded-[14px] border border-[#d4d1c7] bg-white shadow-[0_20px_60px_rgba(0,0,0,0.2)]">
            <div className="flex items-center justify-between border-b border-[#e5e3dc] px-6 py-5">
              <span className="font-['JetBrains_Mono'] text-[14px] font-bold uppercase tracking-[0.15em] text-[#0052cc]">// Prompt đã sẵn sàng</span>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md px-2.5 py-1 text-2xl leading-none text-[#6b6b6b] transition hover:bg-[#fafaf7] hover:text-[#1a1a1a]">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-6">
              <pre className={`max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border p-5 font-['JetBrains_Mono'] text-[13px] leading-7 ${
                error ? 'border-[#c0392b] bg-[#fce8e6] text-[#c0392b]' : 'border-[#e5e3dc] bg-[#fafaf7] text-[#1a1a1a]'
              }`}>
                {loading ? 'Đang gọi Claude API để viết prompt tiếng Anh...' : error || generatedPrompt}
              </pre>
            </div>
            <div className="flex gap-3 border-t border-[#e5e3dc] px-6 py-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-[#d4d1c7] bg-white px-5 py-3 font-['JetBrains_Mono'] text-[13px] font-bold uppercase tracking-[0.08em] text-[#6b6b6b] transition hover:border-[#1a1a1a] hover:text-[#1a1a1a]">
                Đóng
              </button>
              <button type="button" onClick={copyPrompt} disabled={!generatedPrompt || loading} className="flex-1 rounded-lg border border-[#0052cc] bg-[#0052cc] px-5 py-3 font-['JetBrains_Mono'] text-[13px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-[#003d99] disabled:cursor-not-allowed disabled:opacity-60">
                Copy vào clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`fixed bottom-[110px] left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-[#1a1a1a] px-6 py-3 font-['JetBrains_Mono'] text-[13px] font-semibold tracking-wide text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition ${toast ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
        {toast}
      </div>
    </div>
  )
}
