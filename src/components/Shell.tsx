import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { ChevronDown, Clock3, RotateCcw, Sparkle } from 'lucide-react'
import { meta, queue } from '../data'
import { ageDays, CLOCK_LABEL, fmtDate, fmtTime } from '../lib/clock'
import { useApp } from '../state/reducer'
import { conversationsToday, timeSaved } from '../state/selectors'
import { cx, Dot, Hover } from './ui'

function feedExplain(source: string, ts: string): string {
  const days = Math.floor(ageDays(ts))
  const mins = Math.round(ageDays(ts) * 24 * 60)
  if (/claims/i.test(source))
    return `${days} days behind. Claims arrive only after adjudication, so the weekend's ED visits and discharges aren't in them yet. Clarity ranks on ADT, pharmacy and lab data instead.`
  if (/ADT/.test(source)) return `Real-time HL7 feed from the HIE, last message ${mins} min ago. Admits and discharges arrive within minutes, days before a claim.`
  if (/Scheduling/.test(source)) return 'Only some practices send scheduling data, so a missing appointment may just mean the practice isn\'t connected.'
  return ''
}

export default function Shell({ children }: { children: ReactNode }) {
  const { s, d } = useApp()
  const hdr = useRef<HTMLElement>(null)
  // Expose the header height so full-height screens (Act) fit below it at any width.
  useLayoutEffect(() => {
    const el = hdr.current
    if (!el) return
    const set = () => document.documentElement.style.setProperty('--hdr', `${el.offsetHeight}px`)
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const due = queue.filter((q) => q.due_today).length
  const fresh = queue.filter((q) => q.new_since_friday).length
  const convo = conversationsToday(s)
  const saved = timeSaved(s)
  const firstName = meta.user.name.split(',')[0]
  const delayed = meta.feed_health.filter((f) => f.status !== 'fresh')

  return (
    <div className="min-h-full">
      <header ref={hdr} className="sticky top-0 z-40">
        <div className="flex h-14 items-center gap-4 bg-navy-700 px-6 text-white">
          <button className="flex items-center gap-2.5" onClick={() => d({ type: 'NAV', screen: { name: 'queue' } })}>
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-navy-700">
              <Sparkle size={17} strokeWidth={2.5} />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Clarity</span>
            <span className="hidden text-[12px] text-navy-200 xl:inline">· Brightwater Health</span>
          </button>
          <div className="mx-auto flex items-center gap-2 text-[13px] text-navy-100 tabular-nums">
            <Clock3 size={14} /> {CLOCK_LABEL}
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <span className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-white/15 text-[12px] font-semibold">MA</span>
              <span className="font-medium">{firstName}</span>
            </span>
            <button className="btn btn-sm border-white/20 bg-transparent text-navy-100 hover:bg-white/10" onClick={() => d({ type: 'RESET' })} data-testid="reset">
              <RotateCcw size={13} /> Reset demo
            </button>
          </div>
        </div>

        <div className="flex h-10 items-center gap-6 border-b border-slate-200 bg-white px-6 text-[13px] text-slate-500">
          <div className="flex items-center gap-5" data-testid="capacity">
            <Num v={queue.length} label="cases" />
            <Num v={due} label="due today" />
            <Num v={fresh} label="new since Fri" />
            <span className="h-4 w-px bg-slate-200" />
            <Num v={convo} label="conversations today" on={convo > 0} />
            <Num v={`${saved} min`} label="prep time saved" on={saved > 0} />
          </div>
          <Hover width={380} className="ml-auto" content={<FeedTip />}>
            <span className="flex cursor-default items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-50" data-testid="feeds">
              <span className="text-slate-500">Data feeds</span>
              <Dot tone="green">{meta.feed_health.length - delayed.length} current</Dot>
              {delayed.length > 0 && <Dot tone="amber">{delayed.length} delayed</Dot>}
              <ChevronDown size={13} className="text-slate-400" />
            </span>
          </Hover>
        </div>
      </header>
      {children}
    </div>
  )
}

function FeedTip() {
  return (
    <div>
      <div className="mb-2 font-semibold text-slate-900">Data feed health</div>
      <ul className="divide-y divide-slate-100">
        {meta.feed_health.map((f) => {
          const why = feedExplain(f.source, f.last_refresh)
          return (
            <li key={f.source} className="py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-700">{f.source}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[12px] tabular-nums text-slate-400">{/claims/i.test(f.source) ? fmtDate(f.last_refresh) : fmtTime(f.last_refresh)}</span>
                  <Dot tone={f.status === 'fresh' ? 'green' : 'amber'}>{f.status === 'fresh' ? 'Current' : 'Delayed'}</Dot>
                </span>
              </div>
              {why && <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{why}</p>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Num({ v, label, on }: { v: ReactNode; label: string; on?: boolean }) {
  return (
    <span className={cx('whitespace-nowrap', on && 'text-blue-700')}>
      <b className={cx('font-semibold tabular-nums', on ? 'text-blue-700' : 'text-slate-900')}>{v}</b> {label}
    </span>
  )
}
