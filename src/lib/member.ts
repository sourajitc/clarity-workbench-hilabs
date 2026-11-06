// Per-member derived facts (real logic over datasets.json).
import { datasets, records, type Rec } from '../data'
import { addBusinessDays, addDays, calDays, CLOCK_DATE, toMs } from './clock'
import { recordFreshness, type Freshness } from './rules'

export const elig = (id: string) => records('D01', id)[0]
export const caseRec = (id: string) => records('D16', id)[0]
export const risk = (id: string) => records('D13', id)[0]
export const sdoh = (id: string) => records('D14', id)[0]
export const provider = (npi: string) => datasets.D11.records.find((p) => p.provider_npi === npi)
export const pcp = (id: string) => provider(elig(id)?.pcp_npi)

export type HipaaStatus = 'valid' | 'expired' | 'none'
export type Caregiver = Rec & { hipaa: HipaaStatus }
export function hipaaStatus(cg: Rec | undefined): HipaaStatus {
  if (!cg || cg.hipaa_auth_on_file !== 'Y') return 'none'
  if (cg.auth_expiry && cg.auth_expiry < CLOCK_DATE) return 'expired'
  return 'valid'
}

/** Caregivers with a contact on file, best first (valid auth, then lives-with). */
export function caregivers(id: string) {
  return records('D15', id)
    .map((c): Caregiver => ({ ...c, hipaa: hipaaStatus(c) }))
    .sort((a, b) => Number(b.contact_id !== '') - Number(a.contact_id !== '') || Number(a.relationship === 'Spouse') - Number(b.relationship === 'Spouse'))
}

export const caregiverForContact = (contactId: string) => {
  const cg = datasets.D15.records.find((c) => c.contact_id === contactId)
  return cg ? ({ ...cg, hipaa: hipaaStatus(cg) } as Caregiver) : undefined
}

/** Most recent inpatient discharge (ADT A03 with an inpatient class). */
export function lastDischarge(id: string): Rec | undefined {
  return records('D04', id)
    .filter((r) => /^A03/.test(r.event) && /^Inpatient/.test(r.patient_class))
    .sort((a, b) => toMs(b.event_datetime) - toMs(a.event_datetime))[0]
}

export interface Deadline {
  label: string
  due: string
  daysLeft: number
  window?: { day: number; of: number }
  source: string
}

/** Deadlines computed from records, soonest first. */
export function deadlines(id: string): Deadline[] {
  const out: Deadline[] = []
  const dc = lastDischarge(id)
  const gaps = records('D17', id)
  if (dc) {
    const dcDate = dc.event_datetime.slice(0, 10)
    const day = calDays(dcDate)
    const isBH = /psych/i.test(dc.patient_class)
    const due7 = addDays(dcDate, 7)
    out.push({
      label: isBH ? 'FUH 7-day follow-up visit' : 'PCP visit within 7 days',
      due: due7,
      daysLeft: calDays(CLOCK_DATE, due7),
      window: { day, of: 7 },
      source: dc.adt_id,
    })
    if (!isBH) {
      const toc = addBusinessDays(dcDate, 2)
      out.push({ label: 'TOC contact (2 business days)', due: toc, daysLeft: calDays(CLOCK_DATE, toc), source: dc.adt_id })
    }
  }
  const c = caseRec(id)
  if (c?.next_reassessment_due) {
    const left = calDays(CLOCK_DATE, c.next_reassessment_due)
    if (left <= 30) out.push({ label: left < 0 ? 'Reassessment overdue' : 'Annual reassessment', due: c.next_reassessment_due, daysLeft: left, source: c.case_id })
  }
  if (c && /auto-closure/i.test(c.open_tasks)) {
    const m = /(Mon|Tue|Wed|Thu|Fri|Sat|Sun) (\d{1,2}) (Nov|Dec)/.exec(c.open_tasks)
    if (m) {
      const due = `${CLOCK_DATE.slice(0, 4)}-${m[3] === 'Nov' ? '11' : '12'}-${m[2].padStart(2, '0')}`
      out.push({ label: 'Case auto-closure (unable to reach)', due, daysLeft: calDays(CLOCK_DATE, due), source: c.case_id })
    }
  }
  for (const g of gaps) {
    if (g.status === 'closed' || !g.due_date) continue
    const left = calDays(CLOCK_DATE, g.due_date)
    if (left <= 7 && !out.some((o) => o.due === g.due_date)) out.push({ label: g.measure, due: g.due_date, daysLeft: left, source: g.gap_id })
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft)
}

// ---------------------------------------------------------------- timeline

export interface TimelineItem {
  key: string
  ds: string
  id: string
  ids: string[]
  ts: string
  received?: string
  title: string
  detail: string
  merged?: string
  fresh: Freshness | null
  asOf: string
  alert?: boolean
}

const TL_SETS = ['D04', 'D05', 'D06', 'D07', 'D09', 'D03', 'D20']

function dedupeKey(ds: string, r: Rec): string | null {
  if (ds === 'D04') return `${r.event}|${r.event_datetime}`
  if (ds === 'D07') return `${r.ndc}|${r.fill_date}`
  if (ds === 'D05') return `${r.facility}|${r.admit_date}`
  return null
}

const mergeLabel = (ds: string, group: Rec[]) =>
  ds === 'D04'
    ? `${group.length} messages merged`
    : ds === 'D07'
      ? 'Reversal + re-bill merged'
      : 'Original + amended summary merged'

export function timeline(id: string): TimelineItem[] {
  const items: TimelineItem[] = []
  for (const ds of TL_SETS) {
    const groups = new Map<string, Rec[]>()
    for (const r of records(ds, id)) {
      const k = dedupeKey(ds, r) ?? `${ds}|${Object.values(r)[0]}`
      groups.set(k, [...(groups.get(k) ?? []), r])
    }
    for (const group of groups.values()) {
      // keep the paid / latest-received / first record as primary
      const primary =
        ds === 'D07' ? (group.find((g) => g.claim_status !== 'reversed') ?? group[0]) : ds === 'D05' ? group[group.length - 1] : group[0]
      items.push(toItem(ds, primary, group))
    }
  }
  return items.sort((a, b) => toMs(b.ts) - toMs(a.ts))
}

function toItem(ds: string, r: Rec, group: Rec[]): TimelineItem {
  const ids = group.map((g) => Object.values(g)[0] as string)
  const fr = recordFreshness(ds, r)
  const base = { key: `${ds}-${ids.join('+')}`, ds, id: ids[0], ids, merged: group.length > 1 ? mergeLabel(ds, group) : undefined, fresh: fr.f, asOf: fr.asOf }
  switch (ds) {
    case 'D04':
      return {
        ...base,
        ts: r.event_datetime,
        received: r.received_datetime,
        title: `${r.event.replace(/^A\d\d /, '')} · ${r.facility}`,
        detail: [r.patient_class, r.dx_text || 'no diagnosis yet', r.discharge_disposition].filter(Boolean).join(' · '),
        alert: !r.dx_text,
      }
    case 'D05':
      return {
        ...base,
        ts: r.received_datetime,
        title: `${r.doc_type} · ${r.facility}`,
        detail: `${r.primary_dx} · discharged ${r.discharge_date}`,
      }
    case 'D06':
      return {
        ...base,
        ts: r.service_date,
        title: `${r.claim_type} claim · ${r.place_of_service}`,
        detail: `${r.icd10_codes} · ${r.status} ${r.paid_date}`,
      }
    case 'D07': {
      const rejected = r.claim_status !== 'paid'
      return {
        ...base,
        ts: r.fill_date,
        title: `${r.drug_name} · ${r.qty} / ${r.days_supply} days`,
        detail: `${r.pharmacy} · ${r.claim_status}${r.auto_refill === 'Y' ? ' · auto-refill' : ''}${r.pdc_ytd_pct ? ` · PDC ${r.pdc_ytd_pct}%` : ''}`,
        alert: rejected && group.length === 1,
      }
    }
    case 'D09':
      return {
        ...base,
        ts: r.collected_date,
        title: `${r.test_name} ${r.value} ${r.unit}${r.normalized_value ? ` → ${r.normalized_value}` : ''}`,
        detail: `ref ${r.ref_range} · ${r.flag} · ${r.source}${r.normalized_value ? ' · unit normalized' : ''}`,
        alert: r.flag === 'H' || r.flag === 'L',
      }
    case 'D03':
      return {
        ...base,
        ts: r.datetime,
        title: `Outreach ${r.channel} · ${r.outcome}`,
        detail: [r.note, r.language_used, r.duration_min ? `${r.duration_min} min` : '', r.staff_id].filter(Boolean).join(' · '),
        alert: !['connected', 'replied'].includes(r.outcome),
      }
    default:
      return {
        ...base,
        ts: r.datetime,
        title: `Member services call · ${r.reason}`,
        detail: [r.new_contact_value && `New contact: ${r.new_contact_value}`, r.propagated_to_case_system === 'N' && 'not propagated to case system']
          .filter(Boolean)
          .join(' · '),
        alert: r.propagated_to_case_system === 'N' && !!r.new_contact_value,
      }
  }
}
