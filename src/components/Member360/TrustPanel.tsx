import { useState } from 'react'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { scripted, type Conflict } from '../../data'
import { fmtDate, workTime } from '../../lib/clock'
import { resolve, SOURCE_SHORT } from '../../lib/records'
import { DATASET_FRESHNESS, freshness } from '../../lib/rules'
import { useApp, type Action } from '../../state/reducer'
import { conflictsOf, openConflicts } from '../../state/selectors'
import { cx, FreshBadge, SeverityBadge, Tag } from '../ui'

export default function TrustPanel({ id }: { id: string }) {
  const { s } = useApp()
  const all = conflictsOf(id)
  const open = openConflicts(s, id)
  const safety = open.some((c) => c.severity === 'safety')
  // Unresolved first, safety on top.
  const order = [...all].sort((a, b) => Number(!!s.resolved[a.id]) - Number(!!s.resolved[b.id]) || Number(b.severity === 'safety') - Number(a.severity === 'safety'))
  return (
    <section className="card overflow-hidden" data-testid="trust-panel">
      <header className="flex items-center justify-between gap-2 px-5 pb-1 pt-4">
        <div>
          <h2 className="card-t">Trust panel</h2>
          <p className="text-[12px] text-slate-500">{open.length ? 'Where sources disagree. Pick what is true.' : 'All sources reconciled.'}</p>
        </div>
        <span data-testid="conflict-count">
          <Tag tone={open.length === 0 ? 'green' : safety ? 'red' : 'amber'} className="px-2 py-1 text-[12px]">
            {open.length} open conflict{open.length === 1 ? '' : 's'}
          </Tag>
        </span>
      </header>
      <div className="space-y-3 p-4">
        {order.map((c) => (
          <ConflictCard key={c.id} c={c} memberId={id} />
        ))}
        {all.length === 0 && <p className="text-[13px] text-slate-500">Sources agree on everything Clarity checked.</p>}
      </div>
    </section>
  )
}

/** Side effects of a resolution on the contact list (real state change). */
function contactEffect(c: Conflict, choice: string): Extract<Action, { type: 'RESOLVE_CONFLICT' }>['demoteContact'] {
  const contact = c.values.map((v) => resolve(v.record)).find((l) => l?.key === 'D02')
  if (!contact) return undefined
  if (/invalid/i.test(choice)) return { id: contact.id, confidence: 'Low', note: 'Marked invalid by Maria' }
  if (/re-label/i.test(choice)) return { id: contact.id, confidence: 'Low', note: 'Not member’s number — removed from outreach', removed: true }
  return undefined
}

function ConflictCard({ c, memberId }: { c: Conflict; memberId: string }) {
  const { s, d } = useApp()
  const [pending, setPending] = useState<string | null>(null)
  const res = s.resolved[c.id]

  if (res)
    return (
      <div className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3.5 py-2.5 text-[13px] animate-fadeUp" data-testid={`conflict-${c.id}`}>
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
        <div className="min-w-0">
          <div className="text-slate-800">
            <b className="font-semibold">{c.entity}</b> <span className="text-slate-400">·</span> {res.choice}
          </div>
          <div className="text-[12px] text-slate-500">
            Resolved by Maria · {workTime(+res.at)} · {c.result}
          </div>
        </div>
      </div>
    )

  const choose = (opt: string) => {
    setPending(opt)
    setTimeout(() => d({ type: 'RESOLVE_CONFLICT', cf: c.id, choice: opt, demoteContact: contactEffect(c, opt) }), scripted.animation_ms.conflict)
  }

  return (
    <div className={cx('rounded-lg border border-slate-200 bg-white', c.severity === 'safety' && 'border-l-[3px] border-l-red-500')} data-testid={`conflict-${c.id}`}>
      <div className="px-4 pt-3">
        <div className="flex items-center gap-2">
          <SeverityBadge sev={c.severity} />
          <b className="text-[14px] font-semibold text-slate-900">{c.entity}</b>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-slate-600">{c.explanation}</p>
      </div>

      <ul className="mx-4 mt-2.5 divide-y divide-slate-100 rounded-lg border border-slate-100">
        {c.values.map((v) => {
          const loc = resolve(v.record, memberId)
          const rule = loc && DATASET_FRESHNESS[loc.key]?.rule
          const f = rule ? freshness(rule, v.date) : null
          return (
            <li key={v.label + v.record}>
              <button
                className="grid w-full grid-cols-[110px_1fr_auto] items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                onClick={() => d({ type: 'OPEN_RECORD', cite: v.record, memberId })}
                title={`Open source record ${v.record}`}
              >
                <span className="text-[12px] text-slate-500">
                  {v.label}
                  {loc && loc.key !== 'D01' && <span className="block text-[11px] text-slate-400">{SOURCE_SHORT[loc.key]}</span>}
                </span>
                <span className="text-[13px] font-medium text-slate-900">{v.value}</span>
                <span className="text-right">
                  <span className="block text-[12px] text-slate-500">{fmtDate(v.date, true)}</span>
                  {f && <FreshBadge f={f} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="px-4 pb-3.5 pt-3">
        <div className="mb-2 flex items-start gap-1.5 text-[13px] text-blue-800">
          <Sparkles size={13} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-medium">Clarity suggests:</span> {c.suggested}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {c.options.map((o) => (
            <button
              key={o}
              disabled={!!pending}
              onClick={() => choose(o)}
              className={cx(
                'btn btn-sm',
                pending === o ? 'border-navy-700 bg-navy-700 text-white' : o === c.demo_choice ? 'border-navy-700 bg-white text-navy-700 hover:bg-navy-50' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
              )}
              data-testid={`opt-${c.id}-${o}`}
            >
              {pending === o && <Loader2 size={12} className="animate-spin" />}
              {o}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
