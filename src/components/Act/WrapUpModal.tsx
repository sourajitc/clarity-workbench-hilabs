import type { ReactNode } from 'react'
import { ArrowRight, CalendarCheck, Check, CheckCircle2, ClipboardCheck, Database, ListChecks, ListOrdered, Timer, Wrench } from 'lucide-react'
import { meta, personas, queue } from '../../data'
import { fieldCounts, queueView } from '../../state/selectors'
import { useApp } from '../../state/reducer'
import { Modal, ScorePill } from '../ui'

export default function WrapUpModal({ id }: { id: string }) {
  const { s, d } = useApp()
  const p = personas[id]
  const w = p.wrap_up ?? {}
  const row = queue.find((q) => q.member_id === id)!
  const doc = p.documentation

  // Real re-rank: compute the queue as it will be once this member is completed.
  const before = queueView(s)
  const after = queueView({ ...s, completed: { ...s.completed, [id]: { at: '0', order: 0 } } })
  const mine = after.find((r) => r.member_id === id)!
  const prevMine = before.find((r) => r.member_id === id)!
  const newTop = after[0]
  const nextPersona = after.find((r) => personas[r.member_id] && !s.completed[r.member_id] && r.member_id !== id)

  const written =
    w.written_once_to ??
    [
      doc && s.submitted[id] && doc.template,
      Object.values(s.carePlan[id] ?? {}).some(Boolean) && 'Care plan',
      s.note[id] && 'Call note (SOAP)',
      (s.attempts[id]?.length ?? 0) > 0 && `Contact log (${s.attempts[id].length} entr${s.attempts[id].length > 1 ? 'ies' : 'y'})`,
      doc && `Audit log (${fieldCounts(id).total} field provenance)`,
    ].filter((x): x is string => !!x)

  const conflictTasks = p.conflicts.filter((c) => s.resolved[c.id] && /task/i.test(c.result + s.resolved[c.id].choice)).map((c) => c.result)
  const accepted = p.nbas.filter((n) => s.nba[id]?.[n.id]?.status === 'accepted').map((n) => n.title)
  const snoozed = p.nbas.filter((n) => s.nba[id]?.[n.id]?.status === 'snoozed').map((n) => n.title)
  const tasks = [...conflictTasks, ...accepted.map((t) => `${t} (accepted NBA)`), ...(w.tasks_created ?? [])]
  const resolvedCount = p.conflicts.filter((c) => s.resolved[c.id]).length
  const afterAction = meta.after_action[id]

  const finish = (next: 'queue' | 'member') =>
    d({ type: 'COMPLETE', member: id, next: next === 'member' && nextPersona ? { name: 'member', id: nextPersona.member_id } : { name: 'queue' } })

  return (
    <Modal width={760}>
      <div data-testid="wrap-up">
        <div className="flex items-center gap-4 px-7 pb-2 pt-6">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 size={24} />
          </span>
          <div>
            <div className="text-[12px] text-slate-500">Wrap-up</div>
            <div className="text-[20px] font-semibold text-slate-900">{row.name} is done for today</div>
          </div>
          {w.time_saved_min != null && (
            <div className="ml-auto mr-6 flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-[13px] text-blue-800">
              <Timer size={14} /> <b>{w.time_saved_min} min</b> prep time saved
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-5 px-7 py-5 text-[13px]">
          <Block icon={<Database size={14} />} title={`Written once to ${written.length} places`}>
            {written.map((x) => (
              <Li key={x}>{x}</Li>
            ))}
          </Block>
          <Block icon={<ClipboardCheck size={14} />} title={`${(w.deadlines_ticked ?? []).length} deadlines ticked`}>
            {(w.deadlines_ticked ?? []).length ? w.deadlines_ticked!.map((x) => <Li key={x}>{x}</Li>) : <span className="meta">No deadline closed by this contact.</span>}
          </Block>
          <Block icon={<ListChecks size={14} />} title={`${tasks.length} tasks created`} wide>
            {tasks.map((x) => (
              <Li key={x}>{x}</Li>
            ))}
            {snoozed.map((x) => (
              <li key={x} className="text-slate-500">
                Snoozed: {x}
              </li>
            ))}
          </Block>
          {w.booked && (
            <Block icon={<CalendarCheck size={14} />} title="Booked" wide>
              <Li>{w.booked}</Li>
            </Block>
          )}
          <Block icon={<Wrench size={14} />} title={`${(w.data_corrections ?? []).length} data-correction tickets · ${resolvedCount} conflicts resolved`} wide>
            {(w.data_corrections ?? []).map((x) => (
              <Li key={x}>{x}</Li>
            ))}
          </Block>
        </div>

        <div className="mx-7 mb-6 rounded-xl bg-slate-50 px-5 py-4" data-testid="queue-change">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-slate-900">
            <ListOrdered size={14} /> Queue change
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[14px]">
            <b className="text-navy-700">{row.name}</b>
            <ScorePill score={prevMine.score} band={prevMine.band} />
            <ArrowRight size={14} className="text-slate-400" />
            <ScorePill score={mine.score} band={mine.band} />
            <span className="text-slate-600">
              rank #{prevMine.rank} → #{mine.rank}
            </span>
            {newTop.member_id !== before[0].member_id && (
              <span className="text-slate-700">
                · <b>{newTop.name}</b> moves to #1
              </span>
            )}
          </div>
          {afterAction ? (
            <div className="meta mt-1">New reasons: {afterAction.reasons.join(' · ')}</div>
          ) : (
            <div className="meta mt-1">No re-score for this member in the prototype; marked completed today.</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 rounded-b-2xl border-t border-slate-100 px-7 py-4">
          <button className="btn-secondary" onClick={() => finish('queue')} data-testid="back-to-queue">
            Back to queue
          </button>
          {nextPersona && (
            <button className="btn-primary" onClick={() => finish('member')} data-testid="next-member">
              Next member: {nextPersona.name} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

function Block({ icon, title, children, wide }: { icon: ReactNode; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="mb-1.5 flex items-center gap-2 text-[14px] font-semibold text-slate-900">
        <span className="text-slate-400">{icon}</span>
        {title}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-slate-700">
      <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />
      <span>{children}</span>
    </li>
  )
}
