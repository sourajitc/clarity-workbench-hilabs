// Look up any record by id across datasets.json (for citations and the record drawer).
import { datasets, imperfections, type Rec } from '../data'

export interface Located {
  cite: string
  key: string
  datasetName: string
  id: string
  record: Rec
}

/** First field of a record that identifies it within its dataset. */
export function recordId(key: string, r: Rec): string {
  if (key === 'D11') return r.provider_npi
  if (key === 'D01' || key === 'D13') return r.member_id
  const k = Object.keys(r).find((f) => f.endsWith('_id') && f !== 'member_id')
  return k ? r[k] : ''
}

const index = new Map<string, { key: string; record: Rec }>()
for (const [key, ds] of Object.entries(datasets)) {
  if (key === 'D05b') continue // medication lines belong to their D05 document
  if (key === 'D13') continue // keyed by member, resolved via "D13"
  for (const r of ds.records) {
    const id = recordId(key, r)
    if (id && !index.has(id)) index.set(id, { key, record: r })
  }
}

const mk = (cite: string, key: string, record: Rec): Located => ({
  cite,
  key,
  datasetName: datasets[key].name,
  id: recordId(key, record),
  record,
})

/** Resolve a citation: "RX-1002", "D11:9900000142", "D01" / "D13" (member's row), "BW-10005" (eligibility row). */
export function resolve(cite: string, memberId?: string): Located | null {
  const c = cite.trim()
  const provider = /^D11:(\d+)$/.exec(c)
  if (provider) {
    const r = datasets.D11.records.find((x) => x.provider_npi === provider[1])
    return r ? mk(c, 'D11', r) : null
  }
  if (c === 'D11' && memberId) {
    const npi = datasets.D01.records.find((x) => x.member_id === memberId)?.pcp_npi
    const r = datasets.D11.records.find((x) => x.provider_npi === npi)
    return r ? mk(c, 'D11', r) : null
  }
  if (/^D\d+b?$/.test(c) && memberId) {
    const r = datasets[c]?.records.find((x) => x.member_id === memberId)
    return r ? mk(c, c, r) : null
  }
  if (/^BW-\d+$/.test(c)) {
    const r = datasets.D01.records.find((x) => x.member_id === c)
    return r ? mk(c, 'D01', r) : null
  }
  const hit = index.get(c)
  return hit ? mk(c, hit.key, hit.record) : null
}

/** Split a provenance string ("RX-1002, RX-1003", "RX-5001..5003", "Call 9 Nov + D11") into resolvable ids. */
export function parseCites(source: string, memberId?: string): string[] {
  const out: string[] = []
  for (const tok of source.split(/[,+]/).map((t) => t.trim()).filter(Boolean)) {
    const range = /^([A-Z]+-)(\d+)\.\.(\d+)$/.exec(tok)
    if (range) {
      const [, pre, a, b] = range
      const width = a.length
      const lo = +a
      const hi = +(a.slice(0, width - b.length) + b)
      for (let n = lo; n <= hi; n++) out.push(pre + String(n).padStart(width, '0'))
      continue
    }
    const id = tok.split(' ')[0]
    if (resolve(id, memberId)) out.push(id)
  }
  return out
}

export const impById = (id: string) => imperfections.find((i) => i.imp_id === id)

/** Discharge medication lines attached to a D05 document. */
export const docMedLines = (docId: string) => datasets.D05b.records.filter((r) => r.doc_id === docId)

/** Short source label for chips. */
export const SOURCE_SHORT: Record<string, string> = {
  D01: 'Eligibility',
  D02: 'Contacts',
  D03: 'Outreach',
  D04: 'ADT',
  D05: 'HIE doc',
  D05b: 'Discharge meds',
  D06: 'Claims',
  D07: 'Pharmacy',
  D08: 'PCP EHR',
  D09: 'Lab',
  D10: 'Scheduling',
  D11: 'HiLabs directory',
  D12: 'Prior auth',
  D13: 'Risk model',
  D14: 'SDOH',
  D15: 'Caregiver',
  D16: 'Case record',
  D17: 'Quality gaps',
  D18: 'RPM',
  D19: 'BH (consent-gated)',
  D20: 'Member services',
}
