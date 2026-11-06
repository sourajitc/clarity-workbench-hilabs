import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, CheckCircle2, ChevronDown, MoreHorizontal, Pin, X } from 'lucide-react'
import { meta, personas, queue, type Band, type Comp } from '../data'
import { BANDS, breakdown } from '../lib/rules'
import { useApp, type OverrideReason } from '../state/reducer'
import { queueView, type ViewRow } from '../state/selectors'
import { BAND_TONE, cx, Hover, ScorePill, Tag, TONE } from './ui'

const COMP_NAME: Record<Comp, string> = { R: 'Risk', D: 'Deadline', S: 'New signal', E: 'Engagement gap' }
const REASONS: OverrideReason[] = ['Clinical judgment', 'Member request', 'Already handled', 'Data wrong']
const GRID = 'grid grid-cols-[28px_minmax(210px,250px)_120px_minmax(0,1fr)_minmax(150px,200px)_minmax(110px,150px)_32px] items-center gap-4'
const BAND_HINT: Record<Band, string> = { Urgent: 'Act now', Today: 'Before end of day', 'This week': 'Plan for this week', Monitor: 'No action needed' }

export default function Queue() {
  const { s, d } = useApp()
  // After a wrap-up, render the pre-completion order first so the re-rank visibly animates.
  const [replay, setReplay] = useState(() => !!(s.lastMoved && s.completed[s.lastMoved]))
  useEffect(() => {
    if (!replay) return
    const t = setTimeout(() => setReplay(false), 500)
    return () => clearTimeout(t)
  }, [])
  const rows = useMemo(() => {
    if (!replay || !s.lastMoved) return queueView(s)
    const { [s.lastMoved]: _, ...completed } = s.completed
    return queueView({ ...s, completed })
  }, [s.completed, s.overrides, replay])

  const f = s.filters
  const programs = useMemo(() => ['All', ...Array.from(new Set(queue.map((q) => q.program))).sort()], [])
  const languages = useMemo(() => ['All', ...Array.from(new Set(queue.map((q) => q.language))).sort()], [])
  const visible = (r: ViewRow) =>
    (f.band === 'All' || r.band === f.band) &&
    (f.program === 'All' || r.program === f.program) &&
    (f.language === 'All' || r.language === f.language) &&
    (!f.newSinceFri || r.new_since_friday) &&
    (!f.dueToday || r.due_today)

  const listRef = useRef<HTMLDivElement>(null)
  useFlip(listRef, rows.map((r) => r.member_id).join(','))
  const anyFilter = f.band !== 'All' || f.program !== 'All' || f.language !== 'All' || f.newSinceFri || f.dueToday
  const urgent = rows.filter((r) => r.band === 'Urgent' && !r.completed).length
  const firstName = meta.user.name.split(' ')[0]

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-6">
      <div className="mb-5">
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">Good morning, {firstName}</h1>
        <p className="mt-0.5 text-[14px] text-slate-500">
          {urgent > 0 ? (
            <>
              <b className="font-semibold text-slate-800">{urgent} members</b> need you first. Clarity has ranked everyone by need, so start at the top.
            </>
          ) : (
            'No urgent members left. Nice work.'
          )}
        </p>
      </div>

      {/* Band tiles double as the band filter */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {BANDS.map((b) => {
          const n = rows.filter((r) => r.band === b).length
          const on = f.band === b
          const t = TONE[BAND_TONE[b]]
          return (
            <button
              key={b}
              onClick={() => d({ type: 'SET_FILTER', patch: { band: on ? 'All' : b } })}
              className={cx('card flex items-center gap-3 px-4 py-3 text-left transition-shadow hover:shadow-md', on && 'ring-2 ring-navy-700')}
            >
              <span className={cx('h-9 w-1.5 rounded-full', t.dot)} />
              <span className="flex-1">
                <span className="block text-[13px] font-medium text-slate-700">{b}</span>
                <span className="block text-[12px] text-slate-400">{BAND_HINT[b]}</span>
              </span>
              <span className="text-[24px] font-semibold tabular-nums text-slate-900" data-testid={`band-count-${b}`}>
                {n}
              </span>
            </button>
          )
        })}
      </div>

      <div className="card overflow-visible">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <span className="text-[15px] font-semibold text-slate-900">Today queue</span>
          <span className="text-[13px] text-slate-400">· hover a score to see why</span>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-[13px]">
            <Select label="Program" value={f.program} options={programs} onChange={(v) => d({ type: 'SET_FILTER', patch: { program: v } })} />
            <Select label="Language" value={f.language} options={languages} onChange={(v) => d({ type: 'SET_FILTER', patch: { language: v } })} />
            <Pill on={f.newSinceFri} onClick={() => d({ type: 'SET_FILTER', patch: { newSinceFri: !f.newSinceFri } })}>
              New since Fri
            </Pill>
            <Pill on={f.dueToday} onClick={() => d({ type: 'SET_FILTER', patch: { dueToday: !f.dueToday } })}>
              Due today
            </Pill>
            {anyFilter && (
              <button
                className="btn-ghost btn-sm"
                onClick={() => d({ type: 'SET_FILTER', patch: { band: 'All', program: 'All', language: 'All', newSinceFri: false, dueToday: false } })}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>
        <div className={cx(GRID, 'px-5 py-2 text-[12px] text-slate-400')}>
          <span>#</span>
          <span>Member</span>
          <span>Score</span>
          <span>Why now</span>
          <span>Next deadline</span>
          <span>Best time</span>
          <span />
        </div>
        <div ref={listRef}>
          {BANDS.map((b) => {
            const shown = rows.filter((r) => r.band === b).filter(visible)
            if (!shown.length) return null
            const collapsed = !!s.collapsed[b]
            return (
              <div key={b} data-band={b}>
                <button
                  className="flex w-full items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-2 text-left"
                  onClick={() => d({ type: 'TOGGLE_BAND', band: b })}
                  data-testid={`band-${b}`}
                >
                  <span className={cx('h-2 w-2 rounded-full', TONE[BAND_TONE[b]].dot)} />
                  <span className="text-[13px] font-semibold text-slate-700">{b}</span>
                  <span className="text-[12px] text-slate-400">{shown.length}</span>
                  <ChevronDown size={14} className={cx('ml-auto text-slate-400 transition-transform', collapsed && '-rotate-90')} />
                </button>
                {!collapsed && shown.map((r) => <Row key={r.member_id} r={r} />)}
              </div>
            )
          })}
          {rows.filter(visible).length === 0 && <div className="px-5 py-8 text-center text-slate-400">No members match these filters.</div>}
        </div>
      </div>
    </main>
  )
}

function Row({ r }: { r: ViewRow }) {
  const { s, d } = useApp()
  const [menu, setMenu] = useState(false)
  const persona = !!personas[r.member_id]
  const moved = s.lastMoved === r.member_id
  const open = () =>
    persona
      ? d({ type: 'NAV', screen: { name: 'member', id: r.member_id } })
      : d({ type: 'TOAST', text: `${r.name}: no detailed record in this prototype. Try Harold, Marcus, Esperanza, Leah or Devon.` })
  const [main, ...more] = r.reasons

  return (
    <div
      data-row={r.member_id}
      data-testid={`row-${r.member_id}`}
      className={cx(GRID, 'group relative cursor-pointer border-t border-slate-100 bg-white px-5 py-3 transition-colors hover:bg-blue-50/40', moved && 'animate-flash')}
      onClick={open}
    >
      <span className="text-[13px] tabular-nums text-slate-400">{r.rank}</span>

      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {r.completed && <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-label="Completed today" />}
          <span className={cx('truncate text-[14px] font-semibold', r.completed ? 'text-slate-500' : 'text-slate-900', persona && 'group-hover:text-navy-700')}>{r.name}</span>
          {r.new_since_friday && !r.completed && <Tag tone="blue">New</Tag>}
        </div>
        <div className="truncate text-[12px] text-slate-500">
          {r.completed ? 'Completed today' : `${r.age} · ${r.program}${r.language !== 'English' ? ` · ${r.language}` : ''}`}
        </div>
      </div>

      <div onClick={(e) => e.stopPropagation()}>
        <Hover width={400} content={<ScoreTip r={r} />}>
          <span data-testid={`score-${r.member_id}`} className="cursor-help">
            <ScorePill score={r.score} band={r.band} />
          </span>
        </Hover>
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cx('truncate text-[13px]', r.completed ? 'text-slate-500' : 'text-slate-700')} title={main}>
            {main}
          </span>
          {more.length > 0 && (
            <span onClick={(e) => e.stopPropagation()}>
              <Hover
                width={320}
                content={
                  <ul className="space-y-1">
                    {r.reasons.map((x) => (
                      <li key={x} className="flex gap-2">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                        {x}
                      </li>
                    ))}
                  </ul>
                }
              >
                <span className="chip cursor-help bg-slate-100 text-slate-500">+{more.length}</span>
              </Hover>
            </span>
          )}
        </div>
        {r.override && (
          <div className="mt-0.5 flex items-center gap-1 text-[12px] text-navy-600">
            <Pin size={11} /> Overridden by Maria · {r.override.reason}
          </div>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        {r.due_today && !r.completed && <Tag tone="amber">Due today</Tag>}
        {!(r.due_today && !r.completed && /^due today$/i.test(r.next_deadline)) && (
          <span className={cx('truncate', r.next_deadline ? 'text-slate-700' : 'text-slate-300')} title={r.next_deadline}>
            {r.next_deadline || '—'}
          </span>
        )}
      </div>

      <span className="truncate text-[13px] text-slate-500" title={r.best_time}>
        {r.completed ? '—' : r.best_time}
      </span>

      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn opacity-40 group-hover:opacity-100" onClick={() => setMenu(!menu)} aria-label="Override rank">
          <MoreHorizontal size={16} />
        </button>
        {menu && <OverrideMenu r={r} onClose={() => setMenu(false)} />}
      </div>
    </div>
  )
}

function OverrideMenu({ r, onClose }: { r: ViewRow; onClose: () => void }) {
  const { d } = useApp()
  const [mode, setMode] = useState<'up' | 'top'>('up')
  const [reason, setReason] = useState<OverrideReason | null>(null)
  return (
    <div className="absolute right-0 top-9 z-30 w-64 rounded-xl border border-slate-200 bg-white p-4 text-[13px] shadow-xl">
      <div className="mb-3 font-semibold text-slate-900">Change position</div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {(['up', 'top'] as const).map((m) => (
          <button key={m} className={cx('rounded-md py-1 text-[12px] font-medium', mode === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')} onClick={() => setMode(m)}>
            {m === 'up' ? (
              <>
                <ArrowUp size={12} className="mr-1 inline" />
                Move up
              </>
            ) : (
              'Top of band'
            )}
          </button>
        ))}
      </div>
      <div className="mb-1 text-[12px] text-slate-500">Why? (required)</div>
      <div className="space-y-0.5">
        {REASONS.map((x) => (
          <label key={x} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
            <input type="radio" name={`reason-${r.member_id}`} checked={reason === x} onChange={() => setReason(x)} className="accent-navy-700" />
            {x}
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-between gap-2">
        <button
          className="btn-ghost btn-sm"
          onClick={() => {
            if (r.override) d({ type: 'CLEAR_OVERRIDE', id: r.member_id })
            onClose()
          }}
        >
          {r.override ? 'Remove override' : 'Cancel'}
        </button>
        <button
          className="btn-primary btn-sm"
          disabled={!reason}
          onClick={() => {
            d({ type: 'OVERRIDE', id: r.member_id, reason: reason!, mode })
            onClose()
          }}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

function ScoreTip({ r }: { r: ViewRow }) {
  const parts = breakdown(r)
  const tables: [string, [string, number][]][] = [
    ['Deadline (D)', meta.deadline_points],
    ['New signal (S)', meta.signal_points],
    ['Days since contact (E)', meta.engagement_points],
  ]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">Why {r.name.split(' ')[0]} scores {r.score.toFixed(1)}</span>
        <ScorePill score={r.score} band={r.band} />
      </div>
      <div className="rounded-lg bg-slate-50 px-3 py-1.5 font-mono text-[12px] text-slate-600" data-testid="score-formula">
        {parts.map((p, i) => (
          <span key={p.k}>
            {i > 0 && ' + '}
            {p.w.toFixed(2)}×{p.v}
          </span>
        ))}{' '}
        = {r.score.toFixed(1)}
      </div>
      <div className="space-y-2">
        {parts.map((p) => (
          <div key={p.k}>
            <div className="flex items-center gap-2 text-[12px]">
              <span className="w-[110px] text-slate-600">{COMP_NAME[p.k]}</span>
              <span className="h-1.5 flex-1 rounded-full bg-slate-100">
                <span className="block h-1.5 rounded-full bg-navy-600" style={{ width: `${p.v}%` }} />
              </span>
              <span className="w-[54px] text-right tabular-nums text-slate-500">+{p.pts.toFixed(1)}</span>
            </div>
            {r.derivation?.[p.k] && <div className="ml-[118px] text-[11px] text-slate-400">{r.derivation[p.k]}</div>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-2.5 text-[11px] text-slate-400">
        {tables.map(([t, rows]) => (
          <div key={t}>
            <div className="mb-0.5 font-medium text-slate-500">{t}</div>
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-1">
                <span className="truncate">{k}</span>
                <span className="tabular-nums">{v}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className={cx('flex items-center gap-1 rounded-full border px-3 py-1', value !== 'All' ? 'border-navy-700 bg-navy-50 text-navy-700' : 'border-slate-200 text-slate-600')}>
      <span className="text-slate-400">{label}</span>
      <select className="bg-transparent font-medium focus:outline-none" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      className={cx('rounded-full border px-3 py-1 text-[13px] font-medium transition-colors', on ? 'border-navy-700 bg-navy-700 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/** FLIP animation: rows glide to their new position when the order changes. */
function useFlip(ref: React.RefObject<HTMLDivElement>, orderKey: string) {
  const prev = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-row]'))
    const next = new Map<string, number>()
    nodes.forEach((n) => next.set(n.dataset.row!, n.getBoundingClientRect().top + window.scrollY))
    if (prev.current.size) {
      nodes.forEach((n) => {
        const before = prev.current.get(n.dataset.row!)
        const after = next.get(n.dataset.row!)!
        if (before == null || Math.abs(before - after) < 1) return
        n.style.transition = 'none'
        n.style.transform = `translateY(${before - after}px)`
        n.style.zIndex = '5'
        n.style.position = 'relative'
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            n.style.transition = 'transform 900ms cubic-bezier(.2,.7,.2,1)'
            n.style.transform = ''
            setTimeout(() => (n.style.zIndex = ''), 950)
          })
        })
      })
    }
    prev.current = next
  }, [orderKey])
}
