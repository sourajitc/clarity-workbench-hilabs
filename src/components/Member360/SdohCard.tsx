import { Lock } from 'lucide-react'
import { records } from '../../data'
import { fmtDateTime, fmtMonthYear } from '../../lib/clock'
import { sdoh } from '../../lib/member'
import { freshness } from '../../lib/rules'
import { useApp } from '../../state/reducer'
import { cx, FreshBadge, RecordLink, Tag } from '../ui'

const FIELDS: [string, string][] = [
  ['housing', 'Housing'],
  ['food', 'Food'],
  ['transport', 'Transport'],
  ['utilities', 'Utilities'],
  ['safety', 'Safety'],
  ['social_isolation', 'Isolation'],
  ['phone_access', 'Phone'],
]
const concern = (v: string) => !/^(no|stable|low)\b/i.test(v)

export function SdohSummary({ id }: { id: string }) {
  const r = sdoh(id)
  if (!r) return null
  const n = FIELDS.filter(([k]) => concern(r[k])).length
  return (
    <span className="inline-flex items-center gap-2" data-testid="sdoh-age">
      {n} need{n === 1 ? '' : 's'} flagged · screened {fmtMonthYear(r.screen_date)} <FreshBadge f={freshness('SDOH / HRA screen', r.screen_date)} asOf={r.screen_date} />
    </span>
  )
}

export default function SdohCard({ id }: { id: string }) {
  const { s, d } = useApp()
  const r = sdoh(id)
  if (!r) return null
  const f = freshness('SDOH / HRA screen', r.screen_date)
  const on = !!s.sdohRescreen[id]
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {FIELDS.map(([k, label]) => (
          <span key={k} className={cx('rounded-lg px-2.5 py-1.5 text-[12px]', concern(r[k]) ? 'bg-amber-50 text-amber-900' : 'bg-slate-50 text-slate-500')} title={r[k]}>
            <span className="block text-[11px] opacity-70">{label}</span>
            <span className="font-medium">{r[k]}</span>
          </span>
        ))}
      </div>
      <div className="mt-2 text-[12px] text-slate-400">
        {r.tool} · {r.self_reported === 'Y' ? 'self-reported' : r.self_reported} · <RecordLink id={r.screen_id} memberId={id} />
      </div>
      <label className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-[13px] hover:bg-slate-50">
        <input type="checkbox" checked={on} onChange={() => d({ type: 'TOGGLE_RESCREEN', id })} className="h-4 w-4 accent-navy-700" />
        Re-screen during call
        {on ? <Tag tone="green" className="ml-auto">Added to call agenda</Tag> : f !== 'fresh' && <span className="ml-auto text-[12px] text-slate-400">screen is {f === 'stale' ? 'over a year' : 'over 6 months'} old</span>}
      </label>
    </div>
  )
}

/** Remote monitoring weights (D18). */
export function Rpm({ id }: { id: string }) {
  const rows = records('D18', id)
  const first = rows[0]?.value as number
  return (
    <ul className="space-y-1 text-[13px]">
      {rows.map((r) => (
        <li key={r.reading_id} className="flex items-center gap-3">
          <span className="w-[110px] text-slate-400">{fmtDateTime(r.reading_datetime)}</span>
          <span className="font-medium tabular-nums text-slate-900">
            {r.value} {r.unit}
          </span>
          <span className={cx('tabular-nums', r.value - first >= 1.5 ? 'font-medium text-amber-700' : 'text-slate-400')}>
            {r.value === first ? 'baseline' : `${r.value - first > 0 ? '+' : ''}${(r.value - first).toFixed(1)} kg`}
          </span>
          <RecordLink id={r.reading_id} memberId={id} className="ml-auto" />
        </li>
      ))}
    </ul>
  )
}
export const rpmSummary = (id: string) => {
  const rows = records('D18', id)
  if (!rows.length) return ''
  const delta = (rows[rows.length - 1].value as number) - (rows[0].value as number)
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} kg since discharge · ${rows.length} readings`
}

/** Consent-gated behavioral health data (D19). */
export function Bh({ id }: { id: string }) {
  const rows = records('D19', id)
  return (
    <div className="space-y-2 text-[13px]">
      <Tag tone="green" icon={<Lock size={10} />}>
        {rows[0]?.consent_flag}
      </Tag>
      {rows.map((r) => (
        <div key={r.bh_id} className="flex items-center justify-between gap-2">
          <span className="text-slate-700">{r.type}</span>
          <span className="flex items-center gap-2 text-slate-400">
            {fmtDateTime(r.encounter_date)} <RecordLink id={r.bh_id} memberId={id} />
          </span>
        </div>
      ))}
    </div>
  )
}
