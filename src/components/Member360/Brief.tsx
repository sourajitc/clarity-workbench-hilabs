import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, EyeOff, Sparkles } from 'lucide-react'
import { personas, scripted } from '../../data'
import { resolve, SOURCE_SHORT } from '../../lib/records'
import { useApp } from '../../state/reducer'
import { AiFooter, Analyzing, Cite, cx, Shimmer } from '../ui'

/** Datasets a claims-only system would see (no pharmacy, lab, ADT or HIE feeds). */
export const CLAIMS_VISIBLE = new Set(['D01', 'D03', 'D06', 'D13', 'D16', 'D20'])

export default function Brief({ id }: { id: string }) {
  const { s, d } = useApp()
  const p = personas[id]
  const seen = !!s.briefSeen[id]
  const [phase, setPhase] = useState<'loading' | 'reveal' | 'done'>(seen ? 'done' : 'loading')
  const [shown, setShown] = useState(seen ? p.brief.length : 0)
  const [sources, setSources] = useState(false)
  const claimsOnly = !!s.claimsOnly[id]

  useEffect(() => {
    if (seen) return
    const t = setTimeout(() => setPhase('reveal'), scripted.animation_ms.brief)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (phase !== 'reveal') return
    if (shown >= p.brief.length) {
      setPhase('done')
      d({ type: 'BRIEF_SEEN', id })
      return
    }
    const t = setTimeout(() => setShown((n) => n + 1), 220)
    return () => clearTimeout(t)
  }, [phase, shown])

  // Number citations in order of first appearance.
  const numbering = useMemo(() => {
    const m = new Map<string, number>()
    p.brief.forEach((b) => b.cites.forEach((c) => !m.has(c) && m.set(c, m.size + 1)))
    return m
  }, [id])

  return (
    <section className="ai-block overflow-hidden" data-testid="brief">
      <header className="flex items-center gap-2 px-5 pt-4">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-100 text-blue-700">
          <Sparkles size={14} />
        </span>
        <h2 className="card-t">Pre-call brief</h2>
      </header>
      <div className="px-5 pb-4 pt-3">
        {phase === 'loading' ? (
          <div className="space-y-3">
            <Analyzing label={`Reading ${numbering.size} records across feeds…`} />
            <Shimmer lines={6} />
          </div>
        ) : (
          <>
            <p className="mb-3 text-[17px] font-semibold leading-snug text-slate-900 animate-fadeUp">{p.headline}</p>
            <ul className="space-y-2">
              {p.brief.slice(0, shown).map((b, i) => {
                const hidden = claimsOnly && !b.cites.some((c) => CLAIMS_VISIBLE.has(resolve(c, id)?.key ?? ''))
                return (
                  <li key={i} className={cx('flex gap-2.5 text-[14px] leading-relaxed text-slate-700 animate-fadeUp', hidden && 'opacity-40')} data-testid="brief-bullet">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                    <span>
                      {b.text.slice(0, b.text.lastIndexOf(' ') + 1)}
                      <span className="whitespace-nowrap">
                        {b.text.slice(b.text.lastIndexOf(' ') + 1)}
                        {b.cites.map((c) => (
                          <Cite key={c} id={c} n={numbering.get(c)} memberId={id} />
                        ))}
                      </span>
                      {hidden && (
                        <span className="ml-2 inline-flex items-center gap-1 text-[12px] font-medium text-slate-500">
                          <EyeOff size={11} /> not visible from claims
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
            {phase === 'done' && (
              <div className="mt-3">
                <button className="inline-flex items-center gap-1 text-[12px] font-medium text-slate-500 hover:text-slate-800" onClick={() => setSources(!sources)}>
                  {numbering.size} sources <ChevronDown size={12} className={cx('transition-transform', sources && 'rotate-180')} />
                </button>
                {sources && (
                  <div className="mt-1.5 grid grid-cols-3 gap-x-4 gap-y-0.5 text-[12px] text-slate-500">
                    {Array.from(numbering.entries()).map(([c, n]) => {
                      const loc = resolve(c, id)
                      return (
                        <button key={c} className="truncate text-left hover:text-blue-700" onClick={() => d({ type: 'OPEN_RECORD', cite: c, memberId: id })}>
                          <span className="tabular-nums text-slate-400">{n}.</span> {loc ? SOURCE_SHORT[loc.key] : '?'} <span className="font-mono text-[11px] text-slate-400">{loc && !/^D\d+$/.test(c) ? loc.id : c}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <AiFooter flagged={s.briefFlagged[id]} onFlag={() => d({ type: 'FLAG_BRIEF', id })} />
    </section>
  )
}
