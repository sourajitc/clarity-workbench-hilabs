import { CheckCircle2, Circle, CircleAlert } from 'lucide-react'
import { meta, records } from '../../data'
import { calDays, CLOCK_DATE, fmtDate, fmtDay } from '../../lib/clock'
import { deadlines, elig } from '../../lib/member'
import { cx, Dot } from '../ui'

export function gapSummary(id: string) {
  const gaps = records('D17', id)
  const open = gaps.filter((g) => g.status !== 'closed').length
  return `${open} open quality gap${open === 1 ? '' : 's'}${gaps.length > open ? ` · ${gaps.length - open} closed` : ''}`
}

/** Quality gaps (D17), other deadlines and PDC bars. The headline countdown lives in the glance tiles. */
export default function Deadlines({ id }: { id: string }) {
  const dl = deadlines(id)
  const gaps = records('D17', id)
  const pdcKey = elig(id).first_name.toLowerCase() + '_'
  const pdc = Object.entries(meta.pdc).filter(([k]) => k.startsWith(pdcKey))

  return (
    <div className="space-y-4" data-testid="countdown">
      {dl.length > 0 && (
        <ul className="space-y-1.5">
          {dl.map((x) => (
            <li key={x.label} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="text-slate-700">{x.window ? `${x.label} · day ${x.window.day} of ${x.window.of}` : x.label}</span>
              <span className="whitespace-nowrap text-slate-500">
                {fmtDay(x.due)} · <b className={cx('font-medium', x.daysLeft <= 1 ? 'text-amber-700' : 'text-slate-700')}>{x.daysLeft <= 0 ? 'today' : `${x.daysLeft} d`}</b>
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-2">
        {gaps.map((g) => {
          const closed = g.status === 'closed'
          const atRisk = /risk|review/.test(g.status)
          return (
            <li key={g.gap_id} className="flex items-start gap-2.5 text-[13px]">
              {closed ? (
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-600" />
              ) : atRisk ? (
                <CircleAlert size={15} className="mt-0.5 shrink-0 text-amber-600" />
              ) : (
                <Circle size={15} className="mt-0.5 shrink-0 text-slate-300" />
              )}
              <span className="min-w-0 flex-1">
                <span className={cx(closed ? 'text-slate-400 line-through' : 'text-slate-800')}>{g.measure}</span>
                <span className="block text-[12px] text-slate-400">
                  {g.status} · due {fmtDate(g.due_date)} ({calDays(CLOCK_DATE, g.due_date)} d)
                </span>
              </span>
            </li>
          )
        })}
      </ul>

      {pdc.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[12px] text-slate-500">Proportion of days covered, year to date (target 80%)</div>
          {pdc.map(([k, v]) => (
            <div key={k}>
              <div className="flex justify-between text-[13px]">
                <span className="capitalize text-slate-700">{k.slice(pdcKey.length)}</span>
                <Dot tone={v.pct < 80 ? 'red' : 'green'}>
                  {v.pct}% · {v.covered}/{v.days} d
                </Dot>
              </div>
              <div className="relative mt-1 h-1.5 rounded-full bg-slate-100">
                <div className={cx('h-1.5 rounded-full', v.pct < 80 ? 'bg-red-400' : 'bg-emerald-500')} style={{ width: `${v.pct}%` }} />
                <span className="absolute -top-1 h-3.5 w-px bg-slate-500" style={{ left: '80%' }} title="80% Star threshold" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
