import { useState } from 'react'
import { AlarmClock, Check, Sparkles, Undo2, X } from 'lucide-react'
import { personas, type Nba } from '../../data'
import { useApp } from '../../state/reducer'
import { AiFooter, cx, Linkify } from '../ui'

const DISMISS = ['Not clinically appropriate', 'Already done', 'Member declined', 'Duplicate']

export default function NbaList({ id }: { id: string }) {
  const { s } = useApp()
  const nbas = [...personas[id].nbas].sort((a, b) => a.rank - b.rank)
  const st = s.nba[id] ?? {}
  const decided = nbas.filter((n) => st[n.id]).length
  return (
    <section className="ai-block flex min-h-0 flex-col overflow-hidden bg-white" data-testid="nba-list">
      <header className="px-5 pb-2 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="card-t flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-100 text-blue-700">
              <Sparkles size={14} />
            </span>
            Next best actions
          </h2>
          <span className="text-[12px] tabular-nums text-slate-500">
            {decided}/{nbas.length} decided
          </span>
        </div>
        <div className="mt-2.5 h-1 rounded-full bg-slate-100">
          <div className="h-1 rounded-full bg-navy-600 transition-all" style={{ width: `${(decided / nbas.length) * 100}%` }} />
        </div>
      </header>
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-2">
        {nbas.map((n) => (
          <NbaCard key={n.id} n={n} memberId={id} />
        ))}
      </div>
      <AiFooter />
    </section>
  )
}

function NbaCard({ n, memberId }: { n: Nba; memberId: string }) {
  const { s, d } = useApp()
  const st = s.nba[memberId]?.[n.id]
  const [dismissing, setDismissing] = useState(false)
  const set = (status: 'accepted' | 'snoozed' | 'dismissed' | null, reason?: string) =>
    d({ type: 'NBA', member: memberId, nba: n.id, status: status ? { status, reason } : null })

  if (st)
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px]" data-testid={`nba-${n.id}`}>
        <span className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full', st.status === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
          {st.status === 'accepted' ? <Check size={12} /> : st.status === 'snoozed' ? <AlarmClock size={11} /> : <X size={11} />}
        </span>
        <span className={cx('min-w-0 flex-1 truncate', st.status === 'accepted' ? 'text-slate-800' : 'text-slate-400')} title={n.title}>
          {n.title}
        </span>
        <span className="shrink-0 text-[12px] text-slate-400">{st.status === 'accepted' ? 'Task created' : st.status === 'snoozed' ? 'Tomorrow' : st.reason}</span>
        <button className="icon-btn h-6 w-6 shrink-0" onClick={() => set(null)} title="Undo">
          <Undo2 size={12} />
        </button>
      </div>
    )

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5" data-testid={`nba-${n.id}`}>
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy-700 text-[11px] font-semibold text-white">{n.rank}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium leading-snug text-slate-900">{n.title}</div>
          <div className="mt-1 text-[12px] leading-snug text-slate-500">
            <Linkify text={n.why} memberId={memberId} />
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Rule: {n.rule} · {n.confirm} confirms
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1 pl-7">
        {dismissing ? (
          <div className="flex flex-wrap items-center gap-1">
            {DISMISS.map((r) => (
              <button key={r} className="btn-secondary btn-sm" onClick={() => set('dismissed', r)}>
                {r}
              </button>
            ))}
            <button className="btn-ghost btn-sm" onClick={() => setDismissing(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button className="btn-primary btn-sm" onClick={() => set('accepted')} data-testid={`accept-${n.id}`}>
              <Check size={12} /> Accept
            </button>
            <button className="btn-ghost btn-sm" onClick={() => set('snoozed')} data-testid={`snooze-${n.id}`}>
              Snooze
            </button>
            <button className="btn-ghost btn-sm" onClick={() => setDismissing(true)}>
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  )
}
