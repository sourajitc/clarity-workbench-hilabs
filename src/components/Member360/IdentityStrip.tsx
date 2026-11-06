import { AlertTriangle, ShieldCheck, ShieldOff, ShieldX } from 'lucide-react'
import type { ReactNode } from 'react'
import { personas, queue } from '../../data'
import { ageYears } from '../../lib/clock'
import { caregivers, elig, pcp, risk } from '../../lib/member'
import { band, score } from '../../lib/rules'
import { useApp } from '../../state/reducer'
import { conflictsOf } from '../../state/selectors'
import { Cite, cx, Hover, ScorePill, Tag } from '../ui'
import { fmtDate } from '../../lib/clock'

/** Value Maria picked when resolving a conflict ("Accept outreach log" -> that source's value). */
export function resolvedValue(cfId: string, choice: string): string | null {
  const cf = Object.values(personas).flatMap((p) => p.conflicts).find((c) => c.id === cfId)
  const m = /^Accept (.+)$/i.exec(choice)
  const v = m && cf?.values.find((x) => x.label.toLowerCase().startsWith(m[1].toLowerCase()))
  return v ? v.value.replace(/\s+x\d+$/, '') : null
}

export default function IdentityStrip({ id }: { id: string }) {
  const { s, d } = useApp()
  const e = elig(id)
  const row = queue.find((q) => q.member_id === id)!
  const doc = pcp(id)
  const cg = caregivers(id)[0]
  const rk = risk(id)
  const p = personas[id]
  const langCf = conflictsOf(id).find((c) => /language/i.test(c.entity))
  const addrCf = conflictsOf(id).find((c) => /address/i.test(c.entity))
  const claimsOnly = !!s.claimsOnly[id]
  const sc = claimsOnly ? score({ ...row, S: 0 }) : score(row)

  const conflicted = (cf: typeof langCf, base: string) => {
    if (!cf) return base
    const r = s.resolved[cf.id]
    if (r) return <span className="text-navy-700">{resolvedValue(cf.id, r.choice) ?? base}</span>
    return (
      <span className="inline-flex items-center gap-1.5">
        {base}
        <Tag tone="amber" icon={<AlertTriangle size={10} />}>
          Unconfirmed
        </Tag>
      </span>
    )
  }

  return (
    <section className="card px-6 py-5" data-testid="identity">
      <div className="flex items-start gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-50 text-[16px] font-semibold text-navy-700">
          {e.first_name[0]}
          {e.last_name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-slate-900">{row.name}</h1>
          <div className="mt-0.5 text-[13px] text-slate-500">
            {ageYears(e.dob)} y · {e.sex === 'M' ? 'Male' : 'Female'} · {e.program} · {conflicted(addrCf, `${e.address}, ${e.city}`)} · <span className="font-mono text-[12px]">{id}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {p.claims_only_view && (
            <Hover width={300} content={<span>{p.claims_only_view.note}</span>}>
              <button className="flex items-center gap-2 text-[13px] text-slate-600" onClick={() => d({ type: 'TOGGLE_CLAIMS_ONLY', id })} data-testid="claims-only">
                <span className={cx('relative inline-block h-5 w-9 rounded-full transition-colors', claimsOnly ? 'bg-navy-700' : 'bg-slate-200')}>
                  <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all', claimsOnly ? 'left-[18px]' : 'left-0.5')} />
                </span>
                Claims-only view
              </button>
            </Hover>
          )}
          <div className="text-right">
            <div className="mb-1 text-[12px] text-slate-400">{claimsOnly ? 'Score from claims only' : 'Priority score'}</div>
            <ScorePill score={sc} band={band(sc)} size="lg" />
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-5 divide-x divide-slate-100 rounded-lg bg-slate-50/80 py-2.5 text-[13px]">
        <Fact k="Plan">
          {e.plan_product} · {e.dual_status}
          <Cite id="D01" mark memberId={id} />
        </Fact>
        <Fact k="Language">{conflicted(langCf, e.preferred_language)}</Fact>
        <Fact k="PCP">
          {doc ? (
            <span className="inline-flex items-center gap-1" title={`Verified by HiLabs on ${fmtDate(doc.verified_date)}`}>
              {doc.name}
              <ShieldCheck size={13} className="text-emerald-600" aria-label="Verified by HiLabs" />
              <Cite id={`D11:${doc.provider_npi}`} mark />
            </span>
          ) : (
            '—'
          )}
          {doc && <div className="text-[11px] text-emerald-700">Verified by HiLabs</div>}
        </Fact>
        <Fact k="Caregiver">
          {cg ? (
            <>
              <span>
                {cg.name.split(' ')[0]} ({cg.relationship.toLowerCase()})
                <Cite id={cg.caregiver_id} mark />
              </span>
              <HipaaBadge status={cg.hipaa} expiry={cg.auth_expiry} />
            </>
          ) : (
            <span className="text-slate-400">None on file</span>
          )}
        </Fact>
        <Fact k="Risk">
          {rk.percentile}th percentile
          <Cite id="D13" mark memberId={id} />
          <div className="truncate text-[11px] text-slate-400">{rk.model}</div>
        </Fact>
      </dl>
    </section>
  )
}

export function HipaaBadge({ status, expiry }: { status: 'valid' | 'expired' | 'none'; expiry?: string }) {
  if (status === 'valid')
    return (
      <div className="flex items-center gap-1 text-[11px] text-emerald-700">
        <ShieldCheck size={11} /> HIPAA valid{expiry && ` to ${fmtDate(expiry, true)}`}
      </div>
    )
  if (status === 'expired')
    return (
      <div className="flex items-center gap-1 text-[11px] font-medium text-red-700">
        <ShieldX size={11} /> HIPAA expired {expiry && fmtDate(expiry)}
      </div>
    )
  return (
    <div className="flex items-center gap-1 text-[11px] font-medium text-red-700">
      <ShieldOff size={11} /> No HIPAA auth
    </div>
  )
}

function Fact({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="min-w-0 px-4">
      <dt className="text-[11px] text-slate-400">{k}</dt>
      <dd className="truncate text-slate-800">{children}</dd>
    </div>
  )
}
