import { Sparkles } from 'lucide-react'
import { personas } from '../../data'
import { caseRec } from '../../lib/member'
import { useApp } from '../../state/reducer'
import { RecordLink } from '../ui'

const split = (s: string) => s.split(/\s*(?:\d\)\s*|;\s*|\s\|\s)/).map((x) => x.trim()).filter(Boolean)

export function carePlanSummary(id: string) {
  const c = caseRec(id)
  return `${split(c.goals).length} goals · ${c.open_tasks.split(' | ').length} open task${c.open_tasks.includes(' | ') ? 's' : ''} · ${c.status}`
}

export default function CarePlan({ id }: { id: string }) {
  const { s } = useApp()
  const c = caseRec(id)
  const accepted = (personas[id].care_plan_suggestions ?? []).filter((_, i) => s.carePlan[id]?.[i])
  return (
    <dl className="space-y-3 text-[13px]">
      <Item k="Goals" items={split(c.goals)} />
      <Item k="Barriers" items={split(c.barriers)} />
      <Item k="Open tasks" items={c.open_tasks.split(' | ')} />
      {accepted.length > 0 && (
        <div>
          <dt className="mb-0.5 text-[12px] text-slate-400">Added today</dt>
          {accepted.map((a) => (
            <dd key={a.text} className="flex items-start gap-1.5 text-blue-800">
              <Sparkles size={12} className="mt-1 shrink-0" />
              <span>
                <b className="font-medium">{a.kind}:</b> {a.text}
              </span>
            </dd>
          ))}
        </div>
      )}
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
        <span className="font-medium text-slate-700">Last note · </span>
        {c.last_note} <RecordLink id={c.case_id} memberId={id} />
      </div>
    </dl>
  )
}

function Item({ k, items }: { k: string; items: string[] }) {
  return (
    <div>
      <dt className="mb-0.5 text-[12px] text-slate-400">{k}</dt>
      {items.map((i) => (
        <dd key={i} className="flex gap-2 text-slate-700">
          <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-slate-300" />
          {i}
        </dd>
      ))}
    </div>
  )
}
