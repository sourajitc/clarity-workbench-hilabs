import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CheckCircle2, ChevronDown, FileText, Flag, Info, ShieldAlert, Sparkles, X } from 'lucide-react'
import { AI_LABEL } from '../data'
import { fmtDate, humanAge, isDate } from '../lib/clock'
import type { Confidence, Freshness } from '../lib/rules'
import { useApp } from '../state/reducer'
import { resolve } from '../lib/records'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------- semantic tones (soft tints only)

export type Tone = 'red' | 'amber' | 'green' | 'blue' | 'slate'
export const TONE: Record<Tone, { bg: string; text: string; dot: string; ring: string }> = {
  red: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', ring: 'ring-red-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500', ring: 'ring-amber-100' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-100' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', ring: 'ring-blue-100' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', dot: 'bg-slate-400', ring: 'ring-slate-200' },
}

export function Tag({ tone = 'slate', children, icon, className, title }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string; title?: string }) {
  return (
    <span className={cx('badge', TONE[tone].bg, TONE[tone].text, className)} title={title}>
      {icon}
      {children}
    </span>
  )
}

/** Dot + word. Colour is never the only signal. */
export function Dot({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]', TONE[tone].text, className)}>
      <span className={cx('h-1.5 w-1.5 shrink-0 rounded-full', TONE[tone].dot)} />
      {children}
    </span>
  )
}

// ---------------------------------------------------------------- badges

const FRESH_TONE: Record<Freshness, Tone> = { fresh: 'green', aging: 'amber', stale: 'red' }
const FRESH_WORD: Record<Freshness, string> = { fresh: 'Fresh', aging: 'Aging', stale: 'Stale' }

export function FreshBadge({ f, asOf, title }: { f: Freshness | null; asOf?: string; title?: string }) {
  const age = asOf && isDate(asOf) ? humanAge(asOf) : ''
  if (!f)
    return asOf && isDate(asOf) ? (
      <span className="whitespace-nowrap text-[12px] text-slate-400" title={title ?? 'No freshness rule for this source'}>
        as of {fmtDate(asOf)}
      </span>
    ) : null
  return (
    <span title={title}>
      <Dot tone={FRESH_TONE[f]}>
        {FRESH_WORD[f]}
        {age && <span className="text-slate-400">· {age}</span>}
      </Dot>
    </span>
  )
}

const SEV: Record<string, [Tone, string]> = {
  safety: ['red', 'Safety'],
  clinical: ['amber', 'Clinical'],
  data: ['slate', 'Data'],
  high: ['amber', 'High'],
  medium: ['amber', 'Medium'],
  low: ['slate', 'Low'],
  ok: ['green', 'OK'],
}
export const sevTone = (sev: string): Tone => (SEV[sev] ?? SEV.data)[0]

export function SeverityBadge({ sev }: { sev: string }) {
  const [t, w] = SEV[sev] ?? SEV.data
  return (
    <Tag tone={t} icon={sev === 'safety' ? <ShieldAlert size={11} /> : undefined}>
      {w}
    </Tag>
  )
}

export function ConfidenceBadge({ c }: { c: Confidence }) {
  return <Dot tone={c === 'High' ? 'green' : c === 'Medium' ? 'amber' : 'red'}>{c} confidence</Dot>
}

export const BAND_TONE: Record<string, Tone> = { Urgent: 'red', Today: 'amber', 'This week': 'blue', Monitor: 'slate' }

export function ScorePill({ score, band, size = 'md' }: { score: number; band: string; size?: 'md' | 'lg' }) {
  const t = TONE[BAND_TONE[band] ?? 'slate']
  return (
    <span className={cx('inline-flex items-center gap-2 rounded-lg ring-1 ring-inset', t.bg, t.ring, size === 'lg' ? 'px-3 py-1.5' : 'px-2 py-1')}>
      <span className={cx('font-semibold tabular-nums text-slate-900', size === 'lg' ? 'text-[20px] leading-6' : 'text-[14px] leading-4')}>{score.toFixed(1)}</span>
      <span className={cx('font-medium', t.text, size === 'lg' ? 'text-[12px]' : 'text-[11px]')}>{band}</span>
    </span>
  )
}

// ---------------------------------------------------------------- citations

/** Numbered citation; with `mark` it renders as a tiny source icon (for facts rather than AI text). */
export function Cite({ id, n, memberId, mark }: { id: string; n?: number; memberId?: string; mark?: boolean }) {
  const { d } = useApp()
  return (
    <button
      type="button"
      className="cite"
      title={`Open source record ${id}`}
      onClick={(e) => {
        e.stopPropagation()
        d({ type: 'OPEN_RECORD', cite: id, memberId })
      }}
    >
      {mark ? <FileText size={9} /> : n != null ? n : id}
    </button>
  )
}

export function RecordLink({ id, memberId, className }: { id: string; memberId?: string; className?: string }) {
  const { d } = useApp()
  return (
    <button
      type="button"
      className={cx('whitespace-nowrap font-mono text-[11px] text-slate-400 hover:text-blue-700 hover:underline', className)}
      title={`Open source record ${id}`}
      onClick={(e) => {
        e.stopPropagation()
        d({ type: 'OPEN_RECORD', cite: id, memberId })
      }}
    >
      {id}
    </button>
  )
}

/** Footer used on every AI-drafted block. */
export function AiFooter({ onFlag, flagged, children }: { onFlag?: () => void; flagged?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-blue-100 px-5 py-2.5 text-[12px] text-blue-700">
      <span className="inline-flex items-center gap-1 font-medium">
        <Sparkles size={12} /> {AI_LABEL}
      </span>
      {children}
      {onFlag && (
        <button className={cx('ml-auto inline-flex items-center gap-1 hover:underline', flagged ? 'text-red-700' : 'text-slate-400')} onClick={onFlag}>
          <Flag size={12} /> {flagged ? 'Flagged for review' : 'Flag inaccurate'}
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- layout bits

export function Card({ title, right, children, className, bodyClass }: { title: ReactNode; right?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={cx('card overflow-hidden', className)}>
      <header className="card-h">
        <h2 className="card-t">{title}</h2>
        {right}
      </header>
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

/** Collapsible section: a one-line summary when closed. */
export function Section({
  title,
  icon,
  summary,
  children,
  defaultOpen = false,
  testid,
}: {
  title: string
  icon?: ReactNode
  summary?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
  testid?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-b border-slate-100 last:border-0" data-testid={testid}>
      <button className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50/70" onClick={() => setOpen(!open)}>
        {icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>}
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-slate-900">{title}</span>
          {summary && <span className="mt-0.5 block truncate text-[12px] text-slate-500">{summary}</span>}
        </span>
        <ChevronDown size={16} className={cx('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-5 pb-4">{children}</div>}
    </section>
  )
}

export function Callout({ tone, children, icon = true }: { tone: 'red' | 'amber' | 'blue' | 'green'; children: ReactNode; icon?: boolean }) {
  const t = TONE[tone]
  const I = tone === 'red' ? ShieldAlert : tone === 'amber' ? AlertTriangle : tone === 'green' ? CheckCircle2 : Info
  return (
    <div className={cx('flex items-start gap-2 rounded-lg px-3 py-2 text-[13px]', t.bg, t.text)}>
      {icon && <I size={15} className="mt-0.5 shrink-0" />}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Hover tooltip rendered in a portal so it is never clipped by scroll containers. */
export function Hover({ content, children, width = 360, className }: { content: ReactNode; children: ReactNode; width?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  useLayoutEffect(() => {
    if (!open || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const h = tip.current?.offsetHeight ?? 200
    let top = r.bottom + 6
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    setPos({ top, left })
  }, [open, width])
  return (
    <span ref={ref} className={cx('inline-flex', className)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open &&
        createPortal(
          <div
            ref={tip}
            style={{ top: pos.top, left: pos.left, width }}
            className="pointer-events-none fixed z-[80] rounded-xl border border-slate-200 bg-white p-4 text-[13px] text-slate-700 shadow-xl"
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  )
}

export function Modal({ children, onClose, width = 720 }: { children: ReactNode; onClose?: () => void; width?: number }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-900/30 p-8 backdrop-blur-[2px]" onClick={onClose}>
      <div className="relative w-full rounded-2xl bg-white shadow-2xl animate-fadeUp" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}>
        {onClose && (
          <button className="icon-btn absolute right-3 top-3" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function Shimmer({ lines = 4 }: { lines?: number }) {
  return (
    <div className="space-y-2.5 py-1" aria-label="Analyzing">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="shimmer h-3.5" style={{ width: `${92 - ((i * 17) % 35)}%` }} />
      ))}
    </div>
  )
}

export function Analyzing({ label = 'Clarity is analyzing sources…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-[12px] text-blue-700">
      <Sparkles size={13} className="animate-pulse" /> {label}
    </div>
  )
}

/** Reveal after `ms`; skip when `instant`. */
export function useReveal(ms: number, instant = false) {
  const [done, setDone] = useState(instant)
  useEffect(() => {
    if (instant) return
    const t = setTimeout(() => setDone(true), ms)
    return () => clearTimeout(t)
  }, [ms, instant])
  return done
}

/** Render text with any resolvable record ids as quiet clickable record links. */
export function Linkify({ text, memberId }: { text: string; memberId?: string }) {
  const parts = text.split(/\b([A-Z]{1,4}-\d{4}|D11:\d{10})\b/)
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 && resolve(p, memberId) ? <RecordLink key={i} id={p} memberId={memberId} className="text-[12px]" /> : <span key={i}>{p}</span>,
      )}
    </>
  )
}

/** Big glanceable number tile. */
export function Stat({ label, value, sub, tone = 'slate', icon, testid }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; icon?: ReactNode; testid?: string }) {
  return (
    <div className="card flex items-start gap-3 px-4 py-3.5" data-testid={testid}>
      {icon && <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONE[tone].bg, TONE[tone].text)}>{icon}</span>}
      <div className="min-w-0">
        <div className="text-[12px] text-slate-500">{label}</div>
        <div className="mt-0.5 truncate text-[18px] font-semibold leading-6 text-slate-900">{value}</div>
        {sub && <div className="mt-0.5 truncate text-[12px] text-slate-500">{sub}</div>}
      </div>
    </div>
  )
}
