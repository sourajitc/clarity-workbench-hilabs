import { meta, personas, queue, type QueueRow } from '../data'
import { band, confidenceRank, score, type Confidence } from '../lib/rules'
import type { State } from './reducer'

export interface ViewRow extends QueueRow {
  completed: boolean
  override?: State['overrides'][string]
  baseScore: number
}

/** Queue with after-action states applied, re-sorted by runtime score, then Maria's overrides. */
export function queueView(s: State): ViewRow[] {
  const rows: ViewRow[] = queue.map((q) => {
    const done = !!s.completed[q.member_id]
    const after = done ? meta.after_action[q.member_id] : undefined
    const comps = after ?? q
    const sc = score(comps)
    return {
      ...q,
      R: comps.R,
      D: comps.D,
      S: comps.S,
      E: comps.E,
      score: sc,
      band: band(sc),
      reasons: after?.reasons ?? q.reasons,
      next_deadline: after?.next_deadline ?? q.next_deadline,
      derivation: after ? undefined : q.derivation,
      completed: done,
      override: s.overrides[q.member_id],
      baseScore: q.score,
    }
  })
  rows.sort((a, b) => b.score - a.score || a.rank - b.rank)
  for (const [id, o] of Object.entries(s.overrides)) {
    const i = rows.findIndex((r) => r.member_id === id)
    if (i < 0) continue
    const [row] = rows.splice(i, 1)
    let to = i
    if (o.mode === 'top') to = rows.findIndex((r) => r.band === row.band)
    else to = Math.max(0, i - o.steps)
    if (to < 0) to = i
    rows.splice(to, 0, row)
  }
  return rows.map((r, i) => ({ ...r, rank: i + 1 }))
}

export const conflictsOf = (id: string) => personas[id]?.conflicts ?? []
export const openConflicts = (s: State, id: string) => conflictsOf(id).filter((c) => !s.resolved[c.id])
export const openSafety = (s: State, id: string) => openConflicts(s, id).filter((c) => c.severity === 'safety')

/** A completed member counts as a conversation if a call connected or an SMS reply came back. */
export const conversationsToday = (s: State) =>
  Object.keys(s.completed).filter((id) => s.callDone[id] || s.sms[id] === 'replied').length

export const timeSaved = (s: State) =>
  Object.keys(s.completed).reduce((m, id) => m + (personas[id]?.wrap_up?.time_saved_min ?? 0), 0)

export interface ContactView {
  contact_id: string
  label: string
  value: string
  why: string
  best_window: string
  confidence: Confidence
  baseConfidence: Confidence
  note?: string
  removed?: boolean
}

/** Persona contacts with Maria's demotions applied; lower confidence sinks, removed numbers go last. */
export function contactsView(s: State, id: string): ContactView[] {
  const list = (personas[id]?.contacts ?? []).map((c, i) => {
    const o = s.contactConf[c.contact_id]
    return { ...c, baseConfidence: c.confidence, confidence: o?.confidence ?? c.confidence, note: o?.note, removed: o?.removed, i }
  })
  list.sort((a, b) => Number(!!a.removed) - Number(!!b.removed) || confidenceRank(a.confidence) - confidenceRank(b.confidence) || a.i - b.i)
  return list
}

export interface FieldView {
  section: string
  field: string
  status: 'prefilled' | 'call' | 'maria'
  source: string
  value: string
  original: string
  edited: boolean
  suggestion?: string
}

export function fieldsView(s: State, id: string): FieldView[] {
  const doc = personas[id]?.documentation
  if (!doc) return []
  const called = !!s.callDone[id]
  return doc.fields.map((f) => {
    const st = s.fields[id]?.[f.field]
    const base = f.status === 'prefilled' ? f.value : f.status === 'call' ? (called ? f.value : '') : ''
    return {
      section: f.section,
      field: f.field,
      status: f.status,
      source: f.source,
      original: f.value,
      value: st ? st.value : base,
      edited: !!st?.edited,
      suggestion: doc.maria_answers[f.field],
    }
  })
}

export function fieldCounts(id: string) {
  const fields = personas[id]?.documentation?.fields ?? []
  return {
    prefilled: fields.filter((f) => f.status === 'prefilled').length,
    call: fields.filter((f) => f.status === 'call').length,
    maria: fields.filter((f) => f.status === 'maria').length,
    total: fields.length,
  }
}
