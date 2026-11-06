import { useState } from 'react'
import { ArrowLeft, Check, FileText, LogOut, ShieldAlert } from 'lucide-react'
import { personas, queue } from '../../data'
import { useApp } from '../../state/reducer'
import { fieldCounts, fieldsView, openSafety } from '../../state/selectors'
import { cx } from '../ui'
import DocDrawer from './DocDrawer'
import NbaList from './NbaList'
import OutreachPanel from './OutreachPanel'

export default function Act({ id }: { id: string }) {
  const { s, d } = useApp()
  const p = personas[id]
  const row = queue.find((q) => q.member_id === id)!
  const hasDoc = !!p.documentation
  const [docOpen, setDocOpen] = useState(false)
  const [flashCall, setFlashCall] = useState<boolean | null>(null)
  const safety = openSafety(s, id)
  const counts = fieldCounts(id)
  const filled = fieldsView(s, id).filter((f) => f.value.trim()).length
  const contacted = !!s.callDone[id] || s.sms[id] === 'replied' || (s.attempts[id]?.length ?? 0) > 0
  const decided = p.nbas.every((n) => s.nba[id]?.[n.id])

  // Guided steps: what to do, in order.
  const steps = hasDoc
    ? [
        { label: 'Review actions', done: decided },
        { label: 'Contact', done: !!s.callDone[id] },
        { label: 'Document', done: filled === counts.total },
        { label: 'Sign & submit', done: !!s.submitted[id] },
      ]
    : [
        { label: 'Review actions', done: decided },
        { label: 'Contact', done: contacted },
        { label: 'Log & close', done: false },
      ]
  const current = steps.findIndex((x) => !x.done)

  const openDoc = () => {
    setDocOpen(true)
    if (s.callDone[id] && flashCall === null) setFlashCall(true)
    else setFlashCall(false)
  }

  return (
    <main className="mx-auto flex h-[calc(100vh-var(--hdr,96px))] max-w-[1360px] flex-col px-6 py-4">
      <div className="mb-3 flex items-center gap-4">
        <button className="btn-ghost btn-sm -ml-2.5" onClick={() => d({ type: 'NAV', screen: { name: 'member', id } })}>
          <ArrowLeft size={14} /> {row.name}
        </button>

        <ol className="mx-auto flex items-center gap-2" data-testid="steps">
          {steps.map((st, i) => (
            <li key={st.label} className="flex items-center gap-2">
              {i > 0 && <span className={cx('h-px w-8', steps[i - 1].done ? 'bg-navy-600' : 'bg-slate-200')} />}
              <span
                className={cx(
                  'grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold',
                  st.done ? 'bg-navy-700 text-white' : i === current ? 'bg-white text-navy-700 ring-2 ring-navy-700' : 'bg-slate-100 text-slate-400',
                )}
              >
                {st.done ? <Check size={13} /> : i + 1}
              </span>
              <span className={cx('text-[13px]', i === current ? 'font-semibold text-slate-900' : st.done ? 'text-slate-600' : 'text-slate-400')}>{st.label}</span>
            </li>
          ))}
        </ol>

        <div className="flex items-center gap-2">
          {safety.length > 0 && (
            <button className="btn btn-sm border-red-200 bg-red-50 text-red-700 hover:bg-red-100" onClick={() => d({ type: 'NAV', screen: { name: 'member', id } })}>
              <ShieldAlert size={13} /> {safety.length} safety conflict open
            </button>
          )}
          {hasDoc ? (
            <button className="btn-primary" onClick={openDoc} data-testid="open-doc">
              <FileText size={14} /> Documentation
              <span className="rounded bg-white/20 px-1.5 text-[11px] tabular-nums">
                {filled}/{counts.total}
              </span>
            </button>
          ) : (
            <button className="btn-primary" disabled={!contacted} title={contacted ? '' : 'Log at least one outreach attempt first'} onClick={() => d({ type: 'OPEN_WRAPUP', member: id })} data-testid="log-close">
              <LogOut size={14} /> Log contact &amp; close
            </button>
          )}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(340px,400px)_minmax(0,1fr)] gap-4">
        <NbaList id={id} />
        <OutreachPanel id={id} />
      </div>
      {hasDoc && docOpen && !s.wrapUp && <DocDrawer id={id} flashCall={!!flashCall} onClose={() => setDocOpen(false)} />}
    </main>
  )
}
