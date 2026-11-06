import { personas, records, type MedDiffRow } from '../../data'
import { addDays, calDays, CLOCK_DATE, fmtDate } from '../../lib/clock'
import { provider } from '../../lib/member'
import { useApp } from '../../state/reducer'
import { cx, Dot, RecordLink, sevTone, Tag } from '../ui'

const ORDER: MedDiffRow['severity'][] = ['safety', 'high', 'medium', 'low', 'ok']
const SEV_WORD: Record<string, string> = { safety: 'Safety', high: 'High', medium: 'Medium', low: 'Low', ok: 'OK' }

/** Latest non-reversed fill per drug, with run-out math (real logic). */
export function fillsOnHand(id: string) {
  const fills = records('D07', id)
    .filter((r) => r.claim_status !== 'reversed')
    .sort((a, b) => b.fill_date.localeCompare(a.fill_date))
  const latest = new Map<string, (typeof fills)[number]>()
  fills.forEach((f) => !latest.has(f.ingredient) && latest.set(f.ingredient, f))
  return Array.from(latest.values()).map((f) => {
    const out = addDays(f.fill_date, f.days_supply)
    return { f, out, daysLeft: calDays(CLOCK_DATE, out), doc: provider(f.prescriber_npi) }
  })
}

/** One-line summary for the glance tile. */
export function medSummary(id: string): { value: string; sub: string; tone: 'red' | 'amber' | 'green' } {
  const diff = personas[id].med_diff
  if (diff) {
    const issues = diff.filter((r) => r.severity !== 'ok').sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
    return {
      value: issues.length ? `${issues.length} discrepanc${issues.length > 1 ? 'ies' : 'y'}` : 'All match',
      sub: issues[0] ? `${issues[0].drug.split(' ')[0]}: ${issues[0].category.toLowerCase()}` : 'Discharge, pharmacy and PCP agree',
      tone: issues.some((i) => i.severity === 'safety') ? 'red' : issues.length ? 'amber' : 'green',
    }
  }
  const late = fillsOnHand(id).filter((x) => x.daysLeft <= 7)
  return {
    value: late.length ? `${late.length} refill${late.length > 1 ? 's' : ''} due` : 'Supply OK',
    sub: late[0] ? `${late[0].f.drug_name.split(' ')[0]} ${late[0].daysLeft < 0 ? `ran out ${-late[0].daysLeft} d ago` : `runs out in ${late[0].daysLeft} d`}` : 'No gaps in pharmacy fills',
    tone: late.length ? 'amber' : 'green',
  }
}

export default function MedDiff({ id }: { id: string }) {
  const { d } = useApp()
  const rows = personas[id].med_diff
  if (!rows) return <FillsTable id={id} />
  const sorted = [...rows].sort((a, b) => ORDER.indexOf(a.severity) - ORDER.indexOf(b.severity))
  return (
    <table className="w-full text-[13px]" data-testid="med-diff">
      <thead>
        <tr>
          <th className="th w-[26%]">Drug</th>
          <th className="th">Discharge</th>
          <th className="th">Pharmacy</th>
          <th className="th">PCP list</th>
          <th className="th">Category · severity</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.drug} className="cursor-pointer hover:bg-slate-50" onClick={() => d({ type: 'OPEN_RECORD', cite: r.records[0], memberId: id })}>
            <td className={cx('td', r.severity === 'safety' && 'shadow-[inset_3px_0_0_#ef4444]')}>
              <div className="font-medium text-slate-900">{r.drug}</div>
              <div className="mt-0.5 flex flex-wrap gap-x-1.5">
                {r.records.map((x) => (
                  <RecordLink key={x} id={x} memberId={id} />
                ))}
              </div>
            </td>
            <td className={cx('td', /STOP|NEW|CHANGE/.test(r.discharge) ? 'font-medium text-slate-900' : 'text-slate-500')}>{r.discharge}</td>
            <td className="td text-slate-600">{r.pharmacy}</td>
            <td className="td text-slate-500">{r.ehr}</td>
            <td className="td">
              <div className="flex flex-col items-start gap-1">
                <Tag tone={sevTone(r.severity)}>{r.category}</Tag>
                {r.severity !== 'ok' && <Dot tone={sevTone(r.severity)}>{SEV_WORD[r.severity]}</Dot>}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** For members without a discharge med list: pharmacy fills with run-out dates and prescriber check. */
function FillsTable({ id }: { id: string }) {
  const { d } = useApp()
  const rows = fillsOnHand(id)
  return (
    <table className="w-full text-[13px]" data-testid="fills">
      <thead>
        <tr>
          <th className="th">Drug</th>
          <th className="th">Last fill</th>
          <th className="th">Supply</th>
          <th className="th">PDC YTD</th>
          <th className="th">Prescriber</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ f, out, daysLeft, doc }) => (
          <tr key={f.fill_id} className="cursor-pointer hover:bg-slate-50" onClick={() => d({ type: 'OPEN_RECORD', cite: f.fill_id, memberId: id })}>
            <td className="td">
              <div className="font-medium text-slate-900">{f.drug_name}</div>
              <RecordLink id={f.fill_id} memberId={id} />
            </td>
            <td className="td text-slate-600">
              {fmtDate(f.fill_date)} · {f.days_supply} d
            </td>
            <td className="td">
              <Dot tone={daysLeft < 0 ? 'red' : daysLeft <= 7 ? 'amber' : 'green'}>{daysLeft < 0 ? `Ran out ${fmtDate(out)}` : `${daysLeft} d left`}</Dot>
            </td>
            <td className="td tabular-nums">
              {f.pdc_ytd_pct !== '' ? <Dot tone={f.pdc_ytd_pct < 80 ? 'red' : 'green'}>{f.pdc_ytd_pct}%</Dot> : <span className="text-slate-300">—</span>}
            </td>
            <td className="td text-slate-600">
              {doc ? (
                <>
                  {doc.name}
                  {doc.specialty === 'Urgent Care' && (
                    <Tag tone="amber" className="ml-1.5">
                      Not PCP
                    </Tag>
                  )}
                </>
              ) : (
                <Tag tone="amber">Unknown prescriber</Tag>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
