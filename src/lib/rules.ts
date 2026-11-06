// Real (non-scripted) logic: priority score + band, freshness badges, contact confidence, reason chips.
import { meta, queue, personas, type Band, type Comp, type Rec } from '../data'
import { ageDays } from './clock'

const COMPS: Comp[] = ['R', 'D', 'S', 'E']

/** score = round_half_up(0.35R + 0.30D + 0.25S + 0.10E, 1). Integer maths so .x5 never drifts. */
export function score(c: Record<Comp, number>): number {
  const raw100 = COMPS.reduce((sum, k) => sum + Math.round(meta.weights[k] * 100) * c[k], 0)
  return Math.floor((raw100 + 5) / 10) / 10
}

export function band(s: number): Band {
  return (meta.bands.find((b) => s >= b.min) ?? meta.bands[meta.bands.length - 1]).name
}

export const BANDS: Band[] = meta.bands.map((b) => b.name)

/** Each weighted term for the tooltip, e.g. { k:'R', w:0.35, v:92, pts:32.2 } */
export function breakdown(c: Record<Comp, number>) {
  return COMPS.map((k) => ({ k, w: meta.weights[k], v: c[k], pts: Math.round(meta.weights[k] * c[k] * 100) / 100 }))
}

/** Dev assert: runtime score() reproduces every stored score in queue.json and meta.after_action. */
export function assertScores(): string[] {
  const errors: string[] = []
  for (const r of queue) {
    const s = score(r)
    if (s !== r.score || band(s) !== r.band) errors.push(`${r.member_id}: computed ${s}/${band(s)} vs stored ${r.score}/${r.band}`)
  }
  for (const [id, a] of Object.entries(meta.after_action)) {
    const s = score(a)
    if (s !== a.score || band(s) !== a.band) errors.push(`after_action ${id}: computed ${s} vs stored ${a.score}`)
  }
  for (const p of Object.values(personas)) {
    if (!p.claims_only_view) continue
    const row = queue.find((q) => q.member_id === p.member_id)!
    const s = score({ ...row, S: 0 })
    if (s !== p.claims_only_view.score) errors.push(`claims-only ${p.member_id}: computed ${s} vs scripted ${p.claims_only_view.score}`)
  }
  const due = queue.filter((q) => q.due_today).length
  const fresh = queue.filter((q) => q.new_since_friday).length
  if (due !== meta.counts.due_today) errors.push(`due_today ${due} vs meta ${meta.counts.due_today}`)
  if (fresh !== meta.counts.new_since_friday) errors.push(`new_since_friday ${fresh} vs meta ${meta.counts.new_since_friday}`)
  return errors
}

// ---------------------------------------------------------------- freshness

export type Freshness = 'fresh' | 'aging' | 'stale'

/** Which meta.freshness rule applies to each dataset, and which field is its "as of" timestamp. */
export const DATASET_FRESHNESS: Record<string, { rule: string; field: string }> = {
  D02: { rule: 'Phone number', field: 'last_verified' },
  D04: { rule: 'ADT alerts', field: 'received_datetime' },
  D05: { rule: 'HIE / discharge summary', field: 'received_datetime' },
  D06: { rule: 'Medical claims', field: 'service_date' },
  D07: { rule: 'Pharmacy fills', field: 'fill_date' },
  D09: { rule: 'Labs', field: 'collected_date' },
  D14: { rule: 'SDOH / HRA screen', field: 'screen_date' },
}

/** The record field that best answers "as of when?" for datasets without a freshness rule. */
export const DATASET_ASOF: Record<string, string> = {
  D01: 'record_updated',
  D03: 'datetime',
  D05b: '',
  D08: 'last_reconciled_date',
  D10: 'appt_datetime',
  D11: 'verified_date',
  D12: 'requested_date',
  D13: 'run_date',
  D15: 'auth_expiry',
  D16: 'last_assessment_date',
  D17: 'due_date',
  D18: 'reading_datetime',
  D19: 'encounter_date',
  D20: 'datetime',
}

export function freshness(ruleName: string, ts: string): Freshness | null {
  const rule = meta.freshness.find((f) => f.source === ruleName)
  if (!rule || !ts) return null
  const d = ageDays(ts)
  if (d < rule.fresh_days) return 'fresh'
  if (d <= rule.stale_days) return 'aging'
  return 'stale'
}

/** Phone numbers use last_verified and status; a failed number is always stale. */
export function phoneFreshness(c: Rec): Freshness {
  if (c.status === 'failed') return 'stale'
  return freshness('Phone number', c.last_verified) ?? 'stale'
}

export function recordFreshness(datasetKey: string, r: Rec): { f: Freshness | null; asOf: string; rule?: string } {
  const m = DATASET_FRESHNESS[datasetKey]
  if (m) {
    const asOf = r[m.field] ?? ''
    return { f: datasetKey === 'D02' ? phoneFreshness(r) : freshness(m.rule, asOf), asOf, rule: m.rule }
  }
  const field = DATASET_ASOF[datasetKey]
  return { f: null, asOf: (field && r[field]) || '' }
}

export function freshnessRuleText(ruleName: string): string {
  const r = meta.freshness.find((f) => f.source === ruleName)
  return r ? `${r.source}: fresh ${r.fresh} · aging ${r.aging} · stale ${r.stale}` : ''
}

// ---------------------------------------------------------------- confidence

export type Confidence = 'High' | 'Medium' | 'Low'
const CONF: Confidence[] = ['High', 'Medium', 'Low']
export function demote(c: Confidence): Confidence {
  return CONF[Math.min(CONF.indexOf(c) + 1, CONF.length - 1)]
}
export const confidenceRank = (c: Confidence) => CONF.indexOf(c)

// ---------------------------------------------------------------- reason chips

export type ReasonKind = 'clinical' | 'deadline' | 'contact' | 'risk' | 'done'
export function reasonKind(text: string): ReasonKind {
  const t = text.toLowerCase()
  if (/booked|completed|cancelled|restored|in progress|flagged|escalated/.test(t)) return 'done'
  if (/contact|call|text|reply|unanswered|reach/.test(t)) return 'contact'
  if (/due|closes|deadline|day \d+ of|ends|overdue|today/.test(t)) return 'deadline'
  if (/risk|percentile/.test(t)) return 'risk'
  return 'clinical'
}
export function reasonChips(reasons: string[]) {
  return reasons.slice(0, 3).map((text) => ({ text, kind: reasonKind(text) }))
}
