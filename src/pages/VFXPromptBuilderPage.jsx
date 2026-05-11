import { useEffect, useMemo, useRef, useState } from 'react'
import { Copy, FileText, ImagePlus, RefreshCcw, Sparkles, Wand2, X } from 'lucide-react'
import { VFX_TECHNIQUE_LIBRARY } from '../lib/vfxTechniqueLibrary'

const FIELD_KEYS = ['platform', 'context', 'director', 'preserve', 'exclude', 'avoid']
const STORAGE_PREFIX = 'eventus_vfx_v7_'

const INITIAL_FIELDS = {
 platform: '',
 context: '',
 director: '',
 preserve: '',
 exclude: '',
 avoid: '',
}

const DIRECTION_META = {
 camera: { label: 'Camera', icon: '▣', desc: 'Move, lens, frame', focus: 'movement, lens behavior, framing, perspective' },
 visual: { label: 'Visual', icon: '◐', desc: 'VFX, color, light', focus: 'visual effects, color, light, distortion, masking' },
 narrative: { label: 'Narrative', icon: '⌖', desc: 'Story, callback', focus: 'story device, callback, conceptual bridge' },
 energy: { label: 'Energy', icon: '≋', desc: 'Pacing, beat', focus: 'pacing, rhythm, kinetic feel, beat synchronization' },
 subtle: { label: 'Subtle', icon: '○', desc: 'Premium, micro', focus: 'premium restraint, micro-animation, organic feel' },
 mood: { label: 'Mood/Style', icon: '✦', desc: 'Aesthetic, ref', focus: 'aesthetic world, cinematic reference, overall vibe (e.g. Ironman-MCU, Wes Anderson)' },
}

const INTENSITY_NAMES = {
 1: 'Whisper',
 2: 'Subtle',
 3: 'Noticeable',
 4: 'Bold',
 5: 'Signature',
}

const INTENSITY_RULES = {
 1: 'WHISPER. Effect barely perceptible. Single micro-element only. Brand-conservative. Pick from library: items in "subtle" range only.',
 2: 'SUBTLE. Refined, premium. One clean enhancement, executed precisely. Safe for any commercial context.',
 3: 'NOTICEABLE. Clear creative beat that registers but does not dominate. Standard sweet spot for recap/TVC.',
 4: 'BOLD. Strong creative statement. Viewers will notice and comment on the transition itself.',
 5: 'SIGNATURE. The transition is the hero moment. Designed to be screenshot-worthy and shareable.',
}

const AVOID_SUGGESTIONS = [
 'whip pan',
 'light flash',
 'particle storm',
 'lens flare',
 'generic dolly',
 'zoom punch-in',
 'cliche morph',
 'rgb split',
 'glitch effect',
]

const MODES = [
 { id: 'quick', title: 'Quick', tag: '~30 dòng', desc: 'Brief gọn dạng template. Dùng khi AI đã có context.' },
 { id: 'standalone', title: 'Standalone', tag: '~200 dòng', desc: 'Full brief có nhúng technique library.' },
]

function readStoredState() {
 if (typeof window === 'undefined') {
 return {
 fields: INITIAL_FIELDS,
 directions: ['camera'],
 intensity: 3,
 mode: 'standalone',
 images: { start: null, end: null },
 }
 }

 const fields = FIELD_KEYS.reduce((next, key) => {
 next[key] = window.localStorage.getItem(`${STORAGE_PREFIX}${key}`) || ''
 return next
 }, {})

 let directions = ['camera']
 try {
 const savedDirections = JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}directions`) || 'null')
 if (Array.isArray(savedDirections) && savedDirections.length) directions = savedDirections.filter(key => VFX_TECHNIQUE_LIBRARY[key])
 } catch {
 directions = ['camera']
 }

 let images = { start: null, end: null }
 try {
 images = {
 start: JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}img_start`) || 'null'),
 end: JSON.parse(window.localStorage.getItem(`${STORAGE_PREFIX}img_end`) || 'null'),
 }
 } catch {
 images = { start: null, end: null }
 }

 const savedIntensity = Number(window.localStorage.getItem(`${STORAGE_PREFIX}intensity`))
 const savedMode = window.localStorage.getItem(`${STORAGE_PREFIX}mode`)

 return {
 fields: { ...INITIAL_FIELDS, ...fields },
 directions: directions.length ? directions : ['camera'],
 intensity: savedIntensity >= 1 && savedIntensity <= 5 ? savedIntensity : 3,
 mode: savedMode === 'quick' ? 'quick' : 'standalone',
 images,
 }
}

function saveLocal(key, value) {
 if (typeof window === 'undefined') return
 if (value === null || value === undefined) {
 window.localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
 return
 }
 window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, typeof value === 'string' ? value : JSON.stringify(value))
}

function getAspectRatio(width, height) {
 const ratio = width / height
 if (Math.abs(ratio - 16 / 9) < 0.05) return '16:9'
 if (Math.abs(ratio - 9 / 16) < 0.05) return '9:16'
 if (Math.abs(ratio - 1) < 0.05) return '1:1'
 if (Math.abs(ratio - 4 / 5) < 0.05) return '4:5'
 if (Math.abs(ratio - 4 / 3) < 0.05) return '4:3'
 return `${ratio.toFixed(2)}:1`
}

function aspectMatch(images) {
 if (!images.start || !images.end) return false
 const startRatio = images.start.width / images.start.height
 const endRatio = images.end.width / images.end.height
 return Math.abs(startRatio - endRatio) < 0.1
}

function getImageInfo(images) {
 if (!images.start && !images.end) return null
 const lines = []
 if (images.start) {
 lines.push(` - Frame START (A): ${images.start.name} (${images.start.width}x${images.start.height}, ${getAspectRatio(images.start.width, images.start.height)})`)
 }
 if (images.end) {
 lines.push(` - Frame END (B): ${images.end.name} (${images.end.width}x${images.end.height}, ${getAspectRatio(images.end.width, images.end.height)})`)
 }
 if (images.start && images.end && !aspectMatch(images)) {
 lines.push(' - WARNING: Aspect ratio mismatch detected. Recommend alignment before generation.')
 }
 return lines.join('\n')
}

function getTotalPoolSize(directions) {
 return directions.reduce((sum, direction) => sum + VFX_TECHNIQUE_LIBRARY[direction].length, 0)
}

function getDirectionsInfo(directions) {
 const labels = directions.map(direction => DIRECTION_META[direction].label)
 const focuses = directions.map(direction => `${DIRECTION_META[direction].label}: ${DIRECTION_META[direction].focus}`)
 return {
 labels: labels.join(' + '),
 labelsList: labels,
 focuses: focuses.join('\n - '),
 }
}

function buildLibraryPool(directions) {
 return directions
 .map(direction => {
 const items = VFX_TECHNIQUE_LIBRARY[direction]
 const lines = items.map((item, index) => {
 const ref = item.source ? ` [ref: ${item.source}]` : ''
 return ` ${index + 1}. ${item.name} - ${item.desc}${ref}`
 })
 return `### ${DIRECTION_META[direction].label} pool (${items.length} items)\n${lines.join('\n')}`
 })
 .join('\n\n')
}

function getData({ fields, directions, intensity }) {
 return {
 platform: fields.platform.trim() || '[NOT FILLED]',
 context: fields.context.trim() || '[NOT FILLED]',
 director: fields.director.trim(),
 preserve: fields.preserve.trim() || '[NOT FILLED]',
 exclude: fields.exclude.trim() || '[NOT FILLED]',
 avoid: fields.avoid.trim(),
 directions,
 intensity,
 }
}

function buildQuick({ fields, directions, intensity, images }) {
 const data = getData({ fields, directions, intensity })
 const dirInfo = getDirectionsInfo(directions)
 const director = data.director || '(blank - AI to propose)'
 const imgInfo = getImageInfo(images) || '[Attach 2 images: start / end]'
 const avoidLine = data.avoid || '(none specified)'
 const totalPool = getTotalPoolSize(directions)
 const dirCount = directions.length

 return `=== TRANSITION REQUEST ===

Role context: Senior prompt engineer for image-to-video AI (Veo/Kling/Runway/Luma/Pika),
with 7+ years VFX/compositing + cinematography/post-production background.
User: Vietnamese video editor, 7+ years (recap, highlight, MV).

Platform: ${data.platform}
Context: ${data.context}
Director's note: ${director}
DO-NOT-CHANGE: ${data.preserve}
DO-NOT-ADD: ${data.exclude}

Wow Engine:
 - Direction${dirCount > 1 ? 's (combined)' : ''}: ${dirInfo.labels}
 Focus areas:
 - ${dirInfo.focuses}
 - Intensity: ${data.intensity}/5 (${INTENSITY_NAMES[data.intensity]})
 - Avoid clichés: ${avoidLine}
 - Technique pool: ${totalPool} items across ${dirCount} direction${dirCount > 1 ? 's' : ''} (251 total in library)
 AI to pick 1-3 techniques from pool that fit the scene best.
 If multiple directions selected, blend techniques coherently (e.g. one camera move + one visual effect that supports it).

Reference frames:
${imgInfo}`
}

function getPlatformNotes(platform) {
 const platformLower = platform.toLowerCase()
 if (platformLower.includes('veo')) {
 return '- Veo prefers long prose descriptions in screenplay style.\n- Veo 3.1 supports native audio generation - include audio cues.\n- Use "Frames to Video" mode with first/last frame inputs.\n- Max duration: 8 seconds.'
 }
 if (platformLower.includes('kling')) {
 return '- Kling prefers concise keyword-rich prompts.\n- Strong with physical motion and human action.\n- Use first-last frame mode.\n- Recommend 5-10 second duration.'
 }
 if (platformLower.includes('runway')) {
 return '- Runway prefers explicit camera language (dolly, pan, tilt, crane).\n- Strong with stylized and animated content.\n- Use Gen-4 image-to-video with start/end frames.'
 }
 if (platformLower.includes('luma')) {
 return '- Luma Ray 2 strong with dreamy/abstract motion.\n- Weaker with text and logo preservation - emphasize preservation explicitly.\n- Use keyframes feature.'
 }
 if (platformLower.includes('pika')) {
 return '- Pika prefers simple direct descriptions.\n- Use Pikaframes for first/last frame transitions.'
 }
 return '- Adapt prompt syntax to the platform conventions.\n- Use first-frame/last-frame mode if available.'
}

function buildStandalone({ fields, directions, intensity, images }) {
 const data = getData({ fields, directions, intensity })
 const dirInfo = getDirectionsInfo(directions)
 const director = data.director || '(blank - AI to propose full transition concept)'
 const imgInfo = getImageInfo(images) || '[Attach 2 images: Frame START (A) and Frame END (B)]'
 const poolSize = getTotalPoolSize(directions)
 const dirCount = directions.length
 const isMulti = dirCount > 1
 const avoidLine = data.avoid
 ? `User-specified clichés to AVOID: ${data.avoid}`
 : 'User did not specify clichés. Avoid the most overused obvious choices in your direction.'

 return `# IMAGE-TO-VIDEO TRANSITION PROMPT REQUEST

---

## YOUR ROLE

You are a senior prompt engineer specialized in image-to-video AI generation platforms (Veo, Kling, Runway, Luma, Pika). You bring three complementary expertise streams that must inform every decision you make:

**1. PROMPT ENGINEERING for video AI** - Deep knowledge of each platform's syntax conventions, strengths, failure modes, and ideal prompt structure (prose vs keyword, length, audio support, frame-to-frame mode).

**2. VFX & COMPOSITING (7+ years professional)** - Hands-on understanding of:
- Particle systems, simulation, dynamics (count, lifespan, motion blur, depth)
- Compositing layer logic (alpha, matte, holdouts, plate locks)
- Camera tracking and 3D integration (parallax, depth, occlusion)
- Lighting and color match between plates
- Plate preservation techniques (rotoscope, garbage matte, frozen layer)
- Practical vs CGI decision-making
- You think in terms of "what would break this shot in Nuke/After Effects" and pre-empt those failures inside the prompt itself.

**3. CINEMATOGRAPHY & POST-PRODUCTION (7+ years)** - Lens choice, camera moves, lighting design, color grading. Final Cut Pro workflow, edit handles, beat sync, delivery to YouTube/Facebook/Instagram and direct client.

This combination matters: VFX experience tells you which AI generations will "break the comp" (warped logos, drifting tracking points, unrealistic particle physics, contact shadows missing) and how to prompt against those failures. Risk Flags section must reflect this VFX-aware perspective.

---

## USER PROFILE

Vietnamese video editor, 7+ years professional experience, specializing in event recap, highlight reels, and music videos. Fluent in editing and post terminology - do not over-explain basics.

---

## INPUT BRIEF

### Platform
${data.platform}

### Project Context
${data.context}

### Director's Note (user's transition idea)
${director}

### Hard Constraints

**DO-NOT-CHANGE** (must preserve exactly, prevent mutation):
${data.preserve}

**DO-NOT-ADD** (must not hallucinate or insert):
${data.exclude}

### Reference Frames
${imgInfo}

---

## WOW ENGINE (Creative Direction)

### LAYER 1 - Direction${isMulti ? 's (multi-select, combined)' : ''}: **${dirInfo.labels.toUpperCase()}**
${isMulti
 ? `User selected ${dirCount} directions. Treat them as combined creative scope - pick techniques from any of the pools below, and PREFER blending across directions when it serves the scene (e.g. one camera move + one visual effect + one mood layer that all reinforce each other).\n\nDirection focus areas:\n - ${dirInfo.focuses}`
 : `Focus: ${DIRECTION_META[directions[0]].focus}`}

### LAYER 2 - Intensity: **${data.intensity}/5 (${INTENSITY_NAMES[data.intensity]})**
${INTENSITY_RULES[data.intensity]}

Calibrate ALL creative decisions to this intensity:
- Number of effects: 1 for intensity 1-2, up to 2 for 3-4, max 3 for 5
- Scale of moves: micro for 1-2, full motion for 3-5
- Color/light shifts: minimal for 1-2, dramatic for 4-5

### LAYER 3 - Avoid Clichés
${avoidLine}

---

## TECHNIQUE LIBRARY (${poolSize} curated items across ${dirCount} direction${isMulti ? 's' : ''}: ${dirInfo.labels})

All technique names below are standard filmmaking/post-production terms. Definitions paraphrased.

**You MUST select your transition concept primarily from this pool. Do not default to vocabulary outside this pool unless director's note explicitly demands it.**

${buildLibraryPool(directions)}

### Selection rules
1. Read the two reference frames first. Identify which 3-5 techniques from the pool above could plausibly bridge them.
2. Cross-check candidates against the avoid-clichés list - drop anything matching.
3. Cross-check against intensity level - drop anything too heavy/light.
4. Pick 1-2 techniques (max 3 only at intensity 5) that genuinely fit the scene's logic, lighting, and brand context.
5. ${isMulti ? 'Since user selected multiple directions, prefer COMBINING techniques across the different pools - pick 1 from each direction when it makes sense, rather than 2-3 from the same direction.' : 'If picking 2-3, layer them coherently (e.g., one camera move + one visual effect that supports it).'}
6. AVOID picking the most obvious 2-3 items in any pool. Reach into the less-used items if they fit.

---

## PROCESSING LOGIC

### Constraint Mapping Rules

Map DO-NOT-CHANGE items into the POSITIVE prompt as preservation clauses:
- Pattern: "preserve [item] exactly - no morphing, warping, or distortion of [item]"
- For logos and text: "must remain perfectly legible and unchanged"
- For human faces: "frozen, no facial drift or morphing"

Map DO-NOT-ADD items into the NEGATIVE prompt with "no [item]" phrasing.

### Auto-Add Negative Prompt Baseline (always include)
warped logos, distorted text, melting typography, drifting faces, morphing faces, 6-fingered hands, foot sliding, duplicated subjects, text artifacts.

### Platform-Specific Notes
${getPlatformNotes(data.platform)}

### Image Analysis Required
Before writing the prompt, analyze the two reference frames:
1. Subject, lighting, framing, color palette of each.
2. Camera movement logic implied by framing differences.
3. Continuity gaps that need bridging.
4. DO-NOT-CHANGE elements requiring extra preservation emphasis.

---

## REQUIRED OUTPUT FORMAT

Respond in **Vietnamese** with exactly these four sections, in this order:

### 1. ĐÃ QUYẾT GÌ (Decisions made)
Bullet list of technical decisions with brief rationale:
- Duration, fps, aspect ratio
- Camera move logic
- Pacing structure
- Color grade direction
- Audio cues (if Veo 3.1)

### 2. TECHNIQUE PICK (from library)
Explicitly state:
- Which technique(s) you picked from the ${poolSize}-item ${dirInfo.labels} pool above
- Why this technique fits THIS specific scene (refer to actual visual elements in the frames)
- Which obvious/cliché choice you considered and rejected (if any)
- How the pick respects the intensity ${data.intensity}/${INTENSITY_NAMES[data.intensity]} level

### 3. PROMPT
- Full positive prompt as a single block, ready to paste into the platform
- Negative prompt as a separate block
- Suggested run settings (mode, batch count, seed strategy)

### 4. RISK FLAGS (VFX-aware)
List 2-3 specific failures that could break the shot, viewed through a VFX compositor's lens:
- Plate integrity risks (logo warp, text mutation, face drift, edge tracking failure)
- Particle/dynamics realism (physics inconsistency, lighting mismatch, depth occlusion)
- Camera-tracking continuity (parallax breakdown, motion blur mismatch)
- Audio-visual sync (for Veo 3.1)
For each risk, provide a backup plan: alternate prompt phrasing OR technical fallback (e.g. "if logo warps at 60% frame fill, reduce to 40% and add 'logo perfectly legible and sharp' to positive prompt").

---

## TONE GUIDELINES

- Professional and concise. The user is a pro - no fluff, no over-explaining.
- Use editing/cinematography terminology naturally.
- Do not add disclaimers about AI limitations unless directly relevant to a risk flag.

---

**END OF BRIEF - Begin your analysis and response now.**`
}

function FieldLabel({ index, label, required, optional, hint }) {
 return (
 <div className="mb-2">
 <div className="flex items-baseline gap-3">
 <span className="text-[12px] font-bold tracking-[0.12em] text-slate-400">[{index}]</span>
<span className="text-[15px] font-semibold text-slate-900">{label}</span>
 {required && <span className="ml-auto text-[12px] font-bold uppercase tracking-[0.14em] text-blue-700">Required</span>}
 {optional && <span className="ml-auto text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Optional</span>}
 </div>
{hint && <div className="mt-1 pl-9 text-[13px] leading-6 text-slate-500">{hint}</div>}
 </div>
 )
}

function TextInput({ value, onChange, placeholder }) {
 return (
 <input
 type="text"
 value={value}
 onChange={event => onChange(event.target.value)}
 placeholder={placeholder}
className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
 />
 )
}

function TextArea({ value, onChange, placeholder }) {
 return (
 <textarea
 value={value}
 onChange={event => onChange(event.target.value)}
 placeholder={placeholder}
 rows={4}
className="min-h-[104px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
 />
 )
}

function Divider({ label }) {
 return (
 <div className="my-6 flex items-center gap-4">
 <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-slate-400">{label}</span>
 <div className="h-px flex-1 bg-slate-200" />
 </div>
 )
}

function ImageSlot({ kind, image, onFile, onRemove }) {
 const inputRef = useRef(null)
 const title = kind === 'start' ? 'Frame Start' : 'Frame End'
 const tag = kind === 'start' ? 'START · A' : 'END · B'

 const handleDrop = (event) => {
 event.preventDefault()
 const file = event.dataTransfer.files?.[0]
 if (file?.type?.startsWith('image/')) onFile(kind, file)
 }

 return (
 <div
 onClick={() => !image && inputRef.current?.click()}
 onDragOver={event => event.preventDefault()}
 onDrop={handleDrop}
 className={`group relative flex aspect-video min-h-[150px] items-center justify-center overflow-hidden rounded-2xl border transition ${
 image
 ? 'border-slate-200 bg-slate-100'
 : 'cursor-pointer border-dashed border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50'
 }`}
 >
 <span className="absolute left-3 top-3 z-10 rounded-lg border border-blue-200 bg-white/90 px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.12em] text-blue-700 shadow-sm">
 {tag}
 </span>
 {image && (
 <button
 type="button"
 onClick={(event) => {
 event.stopPropagation()
 onRemove(kind)
 }}
 className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-red-100 bg-white/90 text-red-500 shadow-sm transition hover:border-red-200 hover:bg-red-50"
 aria-label={`Remove ${title}`}
 >
 <X size={16} />
 </button>
 )}
 {image ? (
 <>
 <img src={image.dataUrl} alt={title} className="h-full w-full object-cover" />
 <div className="absolute inset-x-3 bottom-3 rounded-lg bg-slate-950/75 px-3 py-2 text-[12px] leading-5 text-white backdrop-blur">
 {image.width}x{image.height} · {getAspectRatio(image.width, image.height)}
 </div>
 </>
 ) : (
 <div className="px-5 text-center">
 <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-700 shadow-sm ring-1 ring-slate-200">
 <ImagePlus size={20} />
 </div>
 <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-600">{title}</div>
 <div className="mt-1 text-[12px] text-slate-400">click / drop / paste</div>
 </div>
 )}
 <input ref={inputRef} type="file" accept="image/*" hidden onChange={event => event.target.files?.[0] && onFile(kind, event.target.files[0])} />
 </div>
 )
}

function DirectionGrid({ directions, onToggle }) {
 return (
 <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
 {Object.entries(DIRECTION_META).map(([key, meta]) => {
 const active = directions.includes(key)
 return (
 <button
 key={key}
 type="button"
 onClick={() => onToggle(key)}
 className={`relative rounded-2xl border px-3 py-4 text-center transition hover:-translate-y-0.5 ${
 active
 ? 'border-blue-200 bg-blue-50 text-blue-800 shadow-sm shadow-blue-100/80'
 : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
 }`}
 >
 <span className={`absolute right-2.5 top-2 rounded-full border px-2 py-0.5 text-[12px] font-bold ${active ? 'border-blue-200 bg-white text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
 {VFX_TECHNIQUE_LIBRARY[key].length}
 </span>
 <div className={`mb-2 text-[22px] ${active ? 'text-blue-700' : 'text-slate-400'}`}>{meta.icon}</div>
 <div className="text-[12px] font-bold uppercase tracking-[0.08em]">{meta.label}</div>
 <div className="mt-1 text-[12px] leading-5 text-slate-500">{meta.desc}</div>
 </button>
 )
 })}
 </div>
 )
}

function LibraryBrowser({ directions }) {
 const [open, setOpen] = useState(false)
 const total = getTotalPoolSize(directions)
 const labels = directions.map(direction => DIRECTION_META[direction].label).join(' + ')

 return (
 <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50">
 <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
 <div className="text-[14px] leading-6 text-slate-600">
 <span className="font-bold uppercase tracking-[0.12em] text-blue-700">Library:</span> {total} techniques · direction: {labels}.
 </div>
 <button
 type="button"
 onClick={() => setOpen(prev => !prev)}
 className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-slate-600 transition hover:border-blue-200 hover:text-blue-700"
 >
 {open ? 'Close' : 'Browse'}
 </button>
 </div>
 {open && (
 <div className="max-h-[430px] overflow-y-auto border-t border-slate-200 px-4 py-4">
 {directions.map(direction => (
 <div key={direction} className="mb-5 last:mb-0">
 <div className="mb-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
 {DIRECTION_META[direction].label} · {VFX_TECHNIQUE_LIBRARY[direction].length}
 </div>
 <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
 {VFX_TECHNIQUE_LIBRARY[direction].map(item => (
 <div key={`${direction}-${item.name}`} className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
 <div className="text-[13px] font-semibold text-slate-900">{item.name}</div>
 <div className="mt-1 text-[12px] leading-5 text-slate-500">{item.desc}</div>
 {item.source && (
 <a className="mt-2 inline-block text-[12px] font-bold uppercase tracking-[0.1em] text-blue-700" href={`https://${item.source}`} target="_blank" rel="noreferrer">
 Reference
 </a>
 )}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )
}

function AvoidPills({ value, onChange }) {
 const activeText = value.toLowerCase()

 const toggleTerm = (term) => {
 const parts = value.split(',').map(item => item.trim()).filter(Boolean)
 const exists = parts.some(item => item.toLowerCase() === term.toLowerCase())
 const next = exists ? parts.filter(item => item.toLowerCase() !== term.toLowerCase()) : [...parts, term]
 onChange(next.join(', '))
 }

 return (
 <div className="mt-3 flex flex-wrap gap-2">
 {AVOID_SUGGESTIONS.map(term => {
 const active = activeText.includes(term.toLowerCase())
 return (
 <button
 key={term}
 type="button"
 onClick={() => toggleTerm(term)}
 className={`rounded-full border px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.08em] transition ${
 active
 ? 'border-rose-200 bg-rose-50 text-rose-700'
 : 'border-slate-200 bg-white text-slate-500 hover:border-rose-200 hover:text-rose-700'
 }`}
 >
 {term}
 </button>
 )
 })}
 </div>
 )
}

function ModeToggle({ mode, onChange }) {
 return (
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 {MODES.map(item => {
 const active = mode === item.id
 return (
 <button
 key={item.id}
 type="button"
 onClick={() => onChange(item.id)}
 className={`rounded-2xl border p-4 text-left transition ${
 active
 ? 'border-blue-200 bg-blue-50 shadow-sm shadow-blue-100/70'
 : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
 }`}
 >
 <div className="mb-1 flex items-center justify-between gap-3">
 <span className={`text-[13px] font-bold uppercase tracking-[0.12em] ${active ? 'text-blue-700' : 'text-slate-700'}`}>{item.title}</span>
 <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-400">{item.tag}</span>
 </div>
 <div className="text-[13px] leading-5 text-slate-500">{item.desc}</div>
 </button>
 )
 })}
 </div>
 )
}

function StatusChip({ ok, warn, label }) {
 return (
 <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.1em] ${
 ok
 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
 : warn
 ? 'border-amber-200 bg-amber-50 text-amber-700'
 : 'border-slate-200 bg-slate-50 text-slate-400'
 }`}>
 <span className="h-1.5 w-1.5 rounded-full bg-current" />
 {label}
 </div>
 )
}

function OutputPanel({ brief, mode, images, onCopy, onGenerateAi }) {
 if (!brief) return null
 return (
 <section className="mt-5 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
 <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
 <div>
 <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-blue-700">
 {mode === 'standalone' ? 'Standalone Brief · có nhúng technique library' : 'Quick Brief · Cho cuộc chat hiện tại'}
 </div>
 <div className="mt-1 text-[12px] text-slate-500">{brief.split('\n').length} dòng</div>
 </div>
 <div className="flex flex-wrap gap-2">
 <button type="button" onClick={onCopy} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[12px] font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
 <Copy size={15} /> Copy
 </button>
 <button type="button" onClick={onGenerateAi} className="inline-flex items-center gap-2 rounded-xl border border-blue-700 bg-blue-700 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-blue-800">
 <Wand2 size={15} /> Gọi AI viết prompt
 </button>
 </div>
 </div>
 <div className="max-h-[520px] overflow-y-auto bg-slate-950 px-5 py-5">
 <pre className="whitespace-pre-wrap break-words text-[13px] leading-6 text-slate-100">{brief}</pre>
 </div>
 {(images.start || images.end) && (
 <div className="border-t border-slate-100 px-5 py-4">
 <div className="mb-3 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Attached Frames</div>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
 {images.start && <img src={images.start.dataUrl} alt="Start frame" className="aspect-video rounded-xl border border-slate-200 object-cover" />}
 {images.end && <img src={images.end.dataUrl} alt="End frame" className="aspect-video rounded-xl border border-slate-200 object-cover" />}
 </div>
 </div>
 )}
 </section>
 )
}

export default function VFXPromptBuilderPage() {
 const storedState = useMemo(readStoredState, [])
 const [fields, setFields] = useState(storedState.fields)
 const [directions, setDirections] = useState(storedState.directions)
 const [intensity, setIntensity] = useState(storedState.intensity)
 const [mode, setMode] = useState(storedState.mode)
 const [images, setImages] = useState(storedState.images)
 const [generatedBrief, setGeneratedBrief] = useState('')
 const [modalOpen, setModalOpen] = useState(false)
 const [generatedPrompt, setGeneratedPrompt] = useState('')
 const [error, setError] = useState('')
 const [loading, setLoading] = useState(false)
 const [toast, setToast] = useState('')

 const activeBrief = useMemo(
 () => (mode === 'standalone' ? buildStandalone({ fields, directions, intensity, images }) : buildQuick({ fields, directions, intensity, images })),
 [fields, directions, intensity, images, mode]
 )

 const status = useMemo(() => ({
 frames: Boolean(images.start && images.end),
 platform: Boolean(fields.platform.trim()),
 context: Boolean(fields.context.trim()),
 preserve: Boolean(fields.preserve.trim()),
 exclude: Boolean(fields.exclude.trim()),
 aspect: aspectMatch(images),
 }), [fields, images])

 const completeCount = Object.values(status).filter(Boolean).length
 const poolSize = getTotalPoolSize(directions)

 useEffect(() => {
 const handlePaste = (event) => {
 const items = event.clipboardData?.items
 if (!items) return
 for (const item of items) {
 if (!item.type.startsWith('image/')) continue
 const file = item.getAsFile()
 const target = !images.start ? 'start' : !images.end ? 'end' : null
 if (target && file) {
 handleImageFile(target, file)
 showToast(`Đã paste vào ${target.toUpperCase()}`)
 } else {
 showToast('Hai frame đã có ảnh', 'warn')
 }
 break
 }
 }

 document.addEventListener('paste', handlePaste)
 return () => document.removeEventListener('paste', handlePaste)
 }, [images])

 const showToast = (message) => {
 setToast(message)
 window.setTimeout(() => setToast(''), 1900)
 }

 const setField = (key, value) => {
 setFields(prev => ({ ...prev, [key]: value }))
 saveLocal(key, value)
 }

 const toggleDirection = (key) => {
 setDirections(prev => {
 const active = prev.includes(key)
 if (active && prev.length === 1) return prev
 const next = active ? prev.filter(item => item !== key) : [...prev, key]
 saveLocal('directions', next)
 return next
 })
 }

 const updateIntensity = (value) => {
 const next = Number(value)
 setIntensity(next)
 saveLocal('intensity', String(next))
 }

 const updateMode = (value) => {
 setMode(value)
 saveLocal('mode', value)
 }

 const handleImageFile = (kind, file) => {
 if (file.size > 10 * 1024 * 1024) {
 showToast('File quá lớn (max 10MB)', 'warn')
 return
 }

 const reader = new FileReader()
 reader.onload = (event) => {
 const img = new Image()
 img.onload = () => {
 const data = {
 dataUrl: event.target.result,
 name: file.name,
 width: img.width,
 height: img.height,
 size: file.size,
 }
 setImages(prev => ({ ...prev, [kind]: data }))
 try {
 saveLocal(`img_${kind}`, data)
 } catch {
 showToast('Ảnh quá lớn để auto-save', 'warn')
 }
 }
 img.src = event.target.result
 }
 reader.readAsDataURL(file)
 }

 const removeImage = (kind) => {
 setImages(prev => ({ ...prev, [kind]: null }))
 saveLocal(`img_${kind}`, null)
 }

 const generateBrief = (nextMode) => {
 updateMode(nextMode)
 const brief = nextMode === 'standalone'
 ? buildStandalone({ fields, directions, intensity, images })
 : buildQuick({ fields, directions, intensity, images })
 setGeneratedBrief(brief)
 showToast(nextMode === 'standalone' ? 'Đã tạo Standalone brief' : 'Đã tạo Quick brief')
 }

 const copyText = async (text, message = 'Đã copy vào clipboard') => {
 try {
 await navigator.clipboard.writeText(text)
 showToast(message)
 } catch {
 const textarea = document.createElement('textarea')
 textarea.value = text
 document.body.appendChild(textarea)
 textarea.select()
 document.execCommand('copy')
 document.body.removeChild(textarea)
 showToast(message)
 }
 }

 const generateAiPrompt = async () => {
 const brief = generatedBrief || activeBrief
 setGeneratedBrief(brief)
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
 setError(err?.message || 'Có lỗi khi gọi AI provider.')
 } finally {
 setLoading(false)
 }
 }

 const resetForm = () => {
 if (!window.confirm('Xóa toàn bộ field và ảnh?')) return
 setFields(INITIAL_FIELDS)
 setDirections(['camera'])
 setIntensity(3)
 setMode('standalone')
 setImages({ start: null, end: null })
 setGeneratedBrief('')
 FIELD_KEYS.forEach(key => saveLocal(key, null))
 ;['directions', 'intensity', 'mode', 'img_start', 'img_end'].forEach(key => saveLocal(key, null))
 showToast('Đã reset form')
 }

 return (
 <div className="relative flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 to-blue-50 px-6 pb-10 pt-6 text-slate-900 [font-family:'Manrope',system-ui,sans-serif] max-sm:px-4 max-sm:pt-4">
 <div className="mx-auto max-w-[1180px]">
 <header className="mb-5 overflow-hidden rounded-[30px] border border-slate-200 bg-white px-7 py-7 shadow-sm max-sm:px-5">
 <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
 <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-[12px] font-bold uppercase tracking-[0.16em] text-blue-700">
 <span className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]" />
 Brief Generator / v7
 </div>
 <div className="text-[12px] font-bold uppercase tracking-[0.16em] text-slate-400">Multi-direction</div>
 </div>
 <div className="grid gap-5 lg:grid-cols-[1fr_280px] lg:items-end">
 <div>
 <h1 className="mb-3 text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] text-slate-950 max-sm:text-[28px]">
 AI Transition Brief Builder
 </h1>
 <p className="max-w-3xl text-[15px] leading-6 text-slate-600">
 Research by Vu Quang Minh
 </p>
 </div>
 <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
 <div className="mb-2 flex items-center justify-between">
 <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-slate-400">Readiness</span>
 <span className="text-[12px] font-bold text-blue-700">{completeCount}/6</span>
 </div>
 <div className="h-2 overflow-hidden rounded-full bg-slate-200">
 <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${(completeCount / 6) * 100}%` }} />
 </div>
 </div>
 </div>
 </header>

 <section className="rounded-[24px] border border-slate-200 bg-white px-6 py-5 shadow-sm max-sm:px-5">
 <FieldLabel index="0" label="Reference Frames" required hint="Drag-drop, click, hoặc Cmd+V paste ảnh start/end." />
 <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
 <ImageSlot kind="start" image={images.start} onFile={handleImageFile} onRemove={removeImage} />
 <ImageSlot kind="end" image={images.end} onFile={handleImageFile} onRemove={removeImage} />
 </div>

 <Divider label="Context" />

 <div className="grid gap-5 lg:grid-cols-2">
 <div>
 <FieldLabel index="1" label="Platform" required hint="Veo 3.1 / Kling 2.1 / Runway Gen-4 / Luma Ray 2 / Pika" />
 <TextInput value={fields.platform} onChange={value => setField('platform', value)} placeholder="e.g. Veo 3.1" />
 </div>
 <div>
 <FieldLabel index="2" label="Context" required hint="Project type + vai trò trong timeline" />
 <TextInput value={fields.context} onChange={value => setField('context', value)} placeholder="e.g. Recap Halida event, opening reveal" />
 </div>
 </div>

 <div className="mt-5">
 <FieldLabel index="3" label="Director's Note" optional hint="Mô tả transition bạn muốn. Để trống = AI tự đề xuất." />
 <TextArea value={fields.director} onChange={value => setField('director', value)} placeholder="e.g. Lấy con voi trên màn hình làm chuyển động, particle bia bay vào, reveal sang cảnh 2" />
 </div>

 <Divider label="Constraints" />

 <div className="grid gap-5 lg:grid-cols-2">
 <div>
 <FieldLabel index="4" label="Do-Not-Change" required hint="Element phải giữ nguyên 100% (mutation guard)." />
 <TextArea value={fields.preserve} onChange={value => setField('preserve', value)} placeholder="e.g. logo Halida, mặt nhân vật, text 'BIA TƯƠI NGON'" />
 </div>
 <div>
 <FieldLabel index="5" label="Do-Not-Add" required hint="Element AI không được tự thêm (hallucination guard)." />
 <TextArea value={fields.exclude} onChange={value => setField('exclude', value)} placeholder="e.g. không thêm người, không particle effect khác" />
 </div>
 </div>

 <Divider label="Wow Engine + Library" />

 <FieldLabel index="6" label="Creative Wow Engine" optional hint="Direction chọn pool technique · Intensity 1-5 · Avoid clichés." />
 <div className="rounded-[22px] border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-4">
 <div className="mb-5">
 <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
 <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-700 text-white">1</span>
 Direction · Hướng wow
 </div>
 <DirectionGrid directions={directions} onToggle={toggleDirection} />
 <LibraryBrowser directions={directions} />
 </div>

 <div className="mb-5">
 <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
 <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-700 text-white">2</span>
 Intensity · Cường độ
 </div>
 <div className="rounded-2xl border border-slate-200 bg-white p-4">
 <div className="mb-3 flex items-center justify-between">
 <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">{INTENSITY_NAMES[intensity]}</span>
 <span className="text-[28px] font-extrabold leading-none text-blue-700">{intensity}</span>
 </div>
 <input
 type="range"
 min="1"
 max="5"
 step="1"
 value={intensity}
 onChange={event => updateIntensity(event.target.value)}
 className="h-2 w-full cursor-pointer accent-blue-700"
 />
 <div className="mt-2 grid grid-cols-5 gap-1 text-[12px] font-bold uppercase tracking-[0.05em] text-slate-400 max-md:grid-cols-1 max-md:gap-0.5">
 <span>1 · Whisper</span>
 <span className="text-center">2 · Subtle</span>
 <span className="text-center">3 · Noticeable</span>
 <span className="text-center">4 · Bold</span>
 <span className="text-right">5 · Signature</span>
 </div>
 </div>
 </div>

 <div>
 <div className="mb-3 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.14em] text-slate-500">
 <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-700 text-white">3</span>
 Avoid Clichés · Cấm dùng
 </div>
 <TextArea value={fields.avoid} onChange={value => setField('avoid', value)} placeholder="e.g. no whip pan, no light flash, no particle storm" />
 <AvoidPills value={fields.avoid} onChange={value => setField('avoid', value)} />
 </div>
 </div>

 <Divider label="Output Format" />

 <FieldLabel index="7" label="Brief Mode" optional hint="Quick = trong cuộc chat hiện tại · Standalone = paste vào AI lạ." />
 <ModeToggle mode={mode} onChange={updateMode} />

 <div className="mt-5 flex flex-wrap gap-2">
 <StatusChip label="Frames" ok={status.frames} />
 <StatusChip label="Platform" ok={status.platform} />
 <StatusChip label="Context" ok={status.context} />
 <StatusChip label="Preserve" ok={status.preserve} />
 <StatusChip label="Exclude" ok={status.exclude} />
 <StatusChip label="Aspect Match" ok={status.aspect} warn={images.start && images.end && !status.aspect} />
 <StatusChip label={`${poolSize} techniques`} ok />
 </div>
 </section>

 <section className="mt-5 rounded-[24px] border border-slate-200 bg-white px-5 py-4 shadow-sm">
 <div className="flex flex-wrap items-center gap-3">
 <button type="button" onClick={resetForm} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
 <RefreshCcw size={15} /> Reset
 </button>
 <button type="button" onClick={() => generateBrief('quick')} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-blue-700 transition hover:bg-blue-100">
 <FileText size={15} /> Generate Quick
 </button>
 <button type="button" onClick={() => generateBrief('standalone')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-700 bg-blue-700 px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-lg hover:shadow-blue-200 max-sm:flex-none">
 <Sparkles size={15} /> Generate Standalone
 </button>
 </div>
 </section>

 <OutputPanel
 brief={generatedBrief}
 mode={mode}
 images={images}
 onCopy={() => copyText(generatedBrief || activeBrief)}
 onGenerateAi={generateAiPrompt}
 />

 <footer className="mt-8 border-t border-slate-200 pt-6 text-center text-[12px] font-medium tracking-[0.12em] text-slate-400">
 EVENTUS · VFX TRANSITION TEMPLATE · v7 · 251 TECHNIQUES
 </footer>
 </div>

 {modalOpen && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-6 backdrop-blur-md" onClick={(event) => event.target === event.currentTarget && setModalOpen(false)}>
 <div className="flex max-h-[88vh] w-full max-w-[820px] flex-col rounded-[24px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
 <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
 <span className="text-[12px] font-bold uppercase tracking-[0.15em] text-blue-700">Prompt đã sẵn sàng</span>
 <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg px-2.5 py-1 text-2xl leading-none text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">×</button>
 </div>
 <div className="flex-1 overflow-y-auto px-6 py-6">
 <pre className={`max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words rounded-lg border p-5 text-[13px] leading-6 ${
 error ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-slate-50 text-slate-900'
 }`}>
 {loading ? 'Đang gọi AI provider để viết prompt tiếng Anh...' : error || generatedPrompt}
 </pre>
 </div>
 <div className="flex gap-3 border-t border-slate-100 px-6 py-4 max-sm:flex-col">
 <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
 Đóng
 </button>
 <button type="button" onClick={() => copyText(generatedPrompt)} disabled={!generatedPrompt || loading} className="flex-1 rounded-xl border border-blue-700 bg-blue-700 px-5 py-3 text-[12px] font-bold uppercase tracking-[0.08em] text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
 Copy vào clipboard
 </button>
 </div>
 </div>
 </div>
 )}

 <div className={`fixed bottom-8 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-950 px-6 py-3 text-[12px] font-semibold tracking-wide text-white shadow-xl shadow-slate-950/20 transition ${toast ? 'translate-y-0 opacity-100' : 'translate-y-5 opacity-0'}`}>
 {toast}
 </div>
 </div>
 )
}
