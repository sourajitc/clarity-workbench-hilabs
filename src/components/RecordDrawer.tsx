import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Database, X } from 'lucide-react'
import { freshnessRuleText, recordFreshness } from '../lib/rules'
import { docMedLines, impById, resolve, SOURCE_SHORT } from '../lib/records'
import { useApp } from '../state/reducer'
import { FreshBadge, cx } from './ui'

const label = (k: string) => k.replace(/_/g, ' ').replace(/\b(npi|ndc|id|dx|pcp|hipaa|loinc|icd10|cpt|pdc|ytd)\b/gi, (m) => m.toUpperCase())

export default function RecordDrawer() {
  const { s, d } = useApp()
  const open = s.drawer
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && d({ type: 'CLOSE_RECORD' })
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [d])
  if (!open) return null
  const loc = resolve(open.cite, open.memberId)

  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={() => d({ type: 'CLOSE_RECORD' })}>
      <div className="absolute inset-0 bg-navy-900/20" />
      <aside
        className="absolute right-0 top-0 flex h-full w-[540px] flex-col border-l border-slate-200 bg-white shadow-2xl animate-slideIn"
        onClick={(e) => e.stopPropagation()}
        data-testid="record-drawer"
      >
        <header className="flex items-start gap-3 border-b border-slate-100 px-6 py-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"><Database size={16} /></span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] text-slate-500">Source record</div>
            <div className="font-mono text-[16px] font-semibold text-slate-900">{loc?.id ?? open.cite}</div>
            {loc && (
              <div className="text-[12px] text-slate-500">
                {loc.key} · {loc.datasetName}
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={() => d({ type: 'CLOSE_RECORD' })} aria-label="Close record">
            <X size={18} />
          </button>
        </header>
        {!loc ? (
          <div className="p-5 text-slate-500">Record {open.cite} is not in the prototype datasets.</div>
        ) : (
          <Body loc={loc} />
        )}
      </aside>
    </div>,
    document.body,
  )
}

function Body({ loc }: { loc: NonNullable<ReturnType<typeof resolve>> }) {
  const r = loc.record
  const flags = r._flags ?? {}
  const fr = recordFreshness(loc.key, r)
  const fields = Object.entries(r).filter(([k]) => k !== '_flags')
  const impIds = Array.from(new Set(Object.values(flags)))
  const meds = loc.key === 'D05' ? docMedLines(loc.id) : []

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-wrap items-center gap-3 px-6 pt-3">
        <span className="chip bg-slate-100 text-slate-600">{SOURCE_SHORT[loc.key] ?? loc.key}</span>
        <FreshBadge f={fr.f} asOf={fr.asOf} />
        {fr.rule && <span className="meta">{freshnessRuleText(fr.rule)}</span>}
      </div>

      {impIds.length > 0 && (
        <div className="space-y-2 px-6 pt-4">
          {impIds.map((id) => {
            const imp = impById(id)
            if (!imp) return null
            const onFields = Object.entries(flags)
              .filter(([, v]) => v === id)
              .map(([k]) => label(k))
            return (
              <div key={id} className="rounded-xl bg-amber-50 p-4 text-[13px]" data-testid={`imp-${id}`}>
                <div className="mb-1 flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle size={14} /> {imp.imp_id} · {imp.problem_type}
                </div>
                <div className="meta mb-1.5 text-amber-800">Flagged field: {onFields.join(', ')}</div>
                <dl className="grid grid-cols-[92px_1fr] gap-x-2 gap-y-1 text-slate-700">
                  <dt className="font-medium text-slate-500">What's wrong</dt>
                  <dd>{imp.what_is_wrong}</dd>
                  <dt className="font-medium text-slate-500">Truth</dt>
                  <dd>{imp.truth}</dd>
                  <dt className="font-medium text-slate-500">Caught by</dt>
                  <dd>{imp.caught_by}</dd>
                </dl>
              </div>
            )
          })}
        </div>
      )}

      <div className="px-6 py-4">
        <table className="w-full text-[13px]">
          <tbody>
            {fields.map(([k, v]) => {
              const flag = flags[k]
              return (
                <tr key={k} className={cx('border-b border-slate-100', flag && 'bg-amber-50/70')}>
                  <td className={cx('w-[38%] px-3 py-1.5 align-top text-slate-500', flag && 'shadow-[inset_3px_0_0_#f59e0b] font-medium text-amber-900')}>{label(k)}</td>
                  <td className={cx('px-3 py-1.5 align-top font-mono text-[12px] text-slate-800 break-words', flag && 'font-semibold')}>
                    {v === '' ? <span className="text-slate-400">(empty)</span> : String(v)}
                    {flag && <span className="badge ml-2 bg-amber-100 font-sans text-amber-900">{flag}</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {meds.length > 0 && (
          <div className="mt-4">
            <div className="card-t mb-1.5">Discharge medication lines (D05b)</div>
            <table className="w-full text-[12px]">
              <thead>
                <tr>
                  <th className="th">Drug</th>
                  <th className="th">Dose</th>
                  <th className="th">Freq</th>
                  <th className="th">Action</th>
                  <th className="th">Note</th>
                </tr>
              </thead>
              <tbody>
                {meds.map((m, i) => (
                  <tr key={i}>
                    <td className="td font-medium">{m.drug}</td>
                    <td className="td">{m.dose}</td>
                    <td className="td">{m.frequency}</td>
                    <td className="td font-semibold">{m.action}</td>
                    <td className="td text-slate-500">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <details className="mt-4">
          <summary className="meta cursor-pointer">Raw JSON</summary>
          <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-3 text-[11px] text-slate-100">{JSON.stringify(r, null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}
