// Workflow + UI state. Everything the demo changes lives here so "Reset demo" restores it exactly.
import { createContext, useContext, type Dispatch } from 'react'
import type { Band } from '../data'
import type { Confidence } from '../lib/rules'

export type Screen = { name: 'queue' } | { name: 'member'; id: string } | { name: 'act'; id: string }
export type NbaStatus = { status: 'accepted' | 'snoozed' | 'dismissed'; reason?: string }
export type CallOutcome = 'Connected' | 'Voicemail' | 'No answer' | 'Wrong number'
export type OverrideReason = 'Clinical judgment' | 'Member request' | 'Already handled' | 'Data wrong'

export interface State {
  screen: Screen
  workMin: number
  drawer: { cite: string; memberId?: string } | null
  wrapUp: string | null
  toast: { text: string; n: number } | null
  filters: { band: Band | 'All'; program: string; language: string; newSinceFri: boolean; dueToday: boolean }
  collapsed: Partial<Record<Band, boolean>>
  overrides: Record<string, { reason: OverrideReason; mode: 'up' | 'top'; steps: number }>
  briefSeen: Record<string, boolean>
  briefFlagged: Record<string, boolean>
  resolved: Record<string, { choice: string; at: string }>
  sdohRescreen: Record<string, boolean>
  claimsOnly: Record<string, boolean>
  nba: Record<string, Record<string, NbaStatus>>
  attempts: Record<string, { contactId: string; outcome: CallOutcome | 'SMS sent' | 'SMS reply'; at: string }[]>
  contactConf: Record<string, { confidence: Confidence; note: string; removed?: boolean }>
  sms: Record<string, 'sent' | 'replied'>
  callDone: Record<string, { contactId: string }>
  note: Record<string, { S: string; O: string; A: string; P: string; accepted: boolean }>
  fields: Record<string, Record<string, { value: string; edited: boolean }>>
  carePlan: Record<string, Record<number, boolean>>
  submitted: Record<string, boolean>
  completed: Record<string, { at: string; order: number }>
  lastMoved: string | null
}

export const initialState: State = {
  screen: { name: 'queue' },
  workMin: 0,
  drawer: null,
  wrapUp: null,
  toast: null,
  filters: { band: 'All', program: 'All', language: 'All', newSinceFri: false, dueToday: false },
  collapsed: {},
  overrides: {},
  briefSeen: {},
  briefFlagged: {},
  resolved: {},
  sdohRescreen: {},
  claimsOnly: {},
  nba: {},
  attempts: {},
  contactConf: {},
  sms: {},
  callDone: {},
  note: {},
  fields: {},
  carePlan: {},
  submitted: {},
  completed: {},
  lastMoved: null,
}

export type Action =
  | { type: 'NAV'; screen: Screen }
  | { type: 'OPEN_RECORD'; cite: string; memberId?: string }
  | { type: 'CLOSE_RECORD' }
  | { type: 'TOAST'; text: string }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SET_FILTER'; patch: Partial<State['filters']> }
  | { type: 'TOGGLE_BAND'; band: Band }
  | { type: 'OVERRIDE'; id: string; reason: OverrideReason; mode: 'up' | 'top' }
  | { type: 'CLEAR_OVERRIDE'; id: string }
  | { type: 'BRIEF_SEEN'; id: string }
  | { type: 'FLAG_BRIEF'; id: string }
  | { type: 'RESOLVE_CONFLICT'; cf: string; choice: string; demoteContact?: { id: string; confidence: Confidence; note: string; removed?: boolean } }
  | { type: 'TOGGLE_RESCREEN'; id: string }
  | { type: 'TOGGLE_CLAIMS_ONLY'; id: string }
  | { type: 'NBA'; member: string; nba: string; status: NbaStatus | null }
  | { type: 'CALL'; member: string; contactId: string; outcome: CallOutcome; demoteTo?: { confidence: Confidence; note: string } }
  | { type: 'SMS'; member: string; contactId: string; phase: 'sent' | 'replied' }
  | { type: 'CALL_DONE'; member: string; contactId: string; note: State['note'][string] }
  | { type: 'EDIT_NOTE'; member: string; part: 'S' | 'O' | 'A' | 'P'; value: string }
  | { type: 'ACCEPT_NOTE'; member: string }
  | { type: 'SET_FIELD'; member: string; field: string; value: string; edited: boolean }
  | { type: 'CARE_PLAN'; member: string; idx: number; accepted: boolean }
  | { type: 'SUBMIT'; member: string }
  | { type: 'OPEN_WRAPUP'; member: string }
  | { type: 'COMPLETE'; member: string; next: Screen }
  | { type: 'RESET' }

/** Simulated minutes added to the frozen clock for audit stamps ("Resolved by Maria · 08:14"). */
const MIN = { open: 10, action: 2, call: 12 }

export function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'NAV': {
      const opening = a.screen.name === 'member' && s.screen.name === 'queue'
      return { ...s, screen: a.screen, drawer: null, lastMoved: opening ? null : s.lastMoved, workMin: s.workMin + (opening ? MIN.open : 0) }
    }
    case 'OPEN_RECORD':
      return { ...s, drawer: { cite: a.cite, memberId: a.memberId } }
    case 'CLOSE_RECORD':
      return { ...s, drawer: null }
    case 'TOAST':
      return { ...s, toast: { text: a.text, n: (s.toast?.n ?? 0) + 1 } }
    case 'CLEAR_TOAST':
      return { ...s, toast: null }
    case 'SET_FILTER':
      return { ...s, filters: { ...s.filters, ...a.patch } }
    case 'TOGGLE_BAND':
      return { ...s, collapsed: { ...s.collapsed, [a.band]: !s.collapsed[a.band] } }
    case 'OVERRIDE': {
      const prev = s.overrides[a.id]
      const steps = a.mode === 'top' ? 0 : (prev?.mode === 'up' ? prev.steps : 0) + 1
      return { ...s, overrides: { ...s.overrides, [a.id]: { reason: a.reason, mode: a.mode, steps } }, lastMoved: a.id }
    }
    case 'CLEAR_OVERRIDE': {
      const { [a.id]: _, ...rest } = s.overrides
      return { ...s, overrides: rest, lastMoved: a.id }
    }
    case 'BRIEF_SEEN':
      return { ...s, briefSeen: { ...s.briefSeen, [a.id]: true } }
    case 'FLAG_BRIEF':
      return { ...s, briefFlagged: { ...s.briefFlagged, [a.id]: !s.briefFlagged[a.id] } }
    case 'RESOLVE_CONFLICT': {
      const workMin = s.workMin + MIN.action
      const at = String(workMin)
      const contactConf = a.demoteContact
        ? { ...s.contactConf, [a.demoteContact.id]: { confidence: a.demoteContact.confidence, note: a.demoteContact.note, removed: a.demoteContact.removed } }
        : s.contactConf
      return { ...s, workMin, resolved: { ...s.resolved, [a.cf]: { choice: a.choice, at } }, contactConf }
    }
    case 'TOGGLE_RESCREEN':
      return { ...s, sdohRescreen: { ...s.sdohRescreen, [a.id]: !s.sdohRescreen[a.id] } }
    case 'TOGGLE_CLAIMS_ONLY':
      return { ...s, claimsOnly: { ...s.claimsOnly, [a.id]: !s.claimsOnly[a.id] } }
    case 'NBA': {
      const cur = { ...(s.nba[a.member] ?? {}) }
      if (a.status) cur[a.nba] = a.status
      else delete cur[a.nba]
      return { ...s, nba: { ...s.nba, [a.member]: cur }, workMin: s.workMin + (a.status ? 1 : 0) }
    }
    case 'CALL': {
      const workMin = s.workMin + (a.outcome === 'Connected' ? 0 : MIN.action)
      const attempts = [...(s.attempts[a.member] ?? []), { contactId: a.contactId, outcome: a.outcome, at: String(workMin) }]
      const contactConf = a.demoteTo
        ? { ...s.contactConf, [a.contactId]: { confidence: a.demoteTo.confidence, note: a.demoteTo.note } }
        : s.contactConf
      return { ...s, workMin, attempts: { ...s.attempts, [a.member]: attempts }, contactConf }
    }
    case 'SMS': {
      const workMin = s.workMin + 1
      const attempts = [...(s.attempts[a.member] ?? []), { contactId: a.contactId, outcome: a.phase === 'sent' ? 'SMS sent' as const : 'SMS reply' as const, at: String(workMin) }]
      return { ...s, workMin, sms: { ...s.sms, [a.member]: a.phase }, attempts: { ...s.attempts, [a.member]: attempts } }
    }
    case 'CALL_DONE':
      return {
        ...s,
        workMin: s.workMin + MIN.call,
        callDone: { ...s.callDone, [a.member]: { contactId: a.contactId } },
        note: { ...s.note, [a.member]: a.note },
      }
    case 'EDIT_NOTE':
      return { ...s, note: { ...s.note, [a.member]: { ...s.note[a.member], [a.part]: a.value } } }
    case 'ACCEPT_NOTE':
      return { ...s, note: { ...s.note, [a.member]: { ...s.note[a.member], accepted: true } } }
    case 'SET_FIELD':
      return {
        ...s,
        fields: { ...s.fields, [a.member]: { ...(s.fields[a.member] ?? {}), [a.field]: { value: a.value, edited: a.edited } } },
      }
    case 'CARE_PLAN':
      return { ...s, carePlan: { ...s.carePlan, [a.member]: { ...(s.carePlan[a.member] ?? {}), [a.idx]: a.accepted } } }
    case 'SUBMIT':
      return { ...s, workMin: s.workMin + MIN.action, submitted: { ...s.submitted, [a.member]: true }, wrapUp: a.member }
    case 'OPEN_WRAPUP':
      return { ...s, workMin: s.workMin + MIN.action, wrapUp: a.member }
    case 'COMPLETE':
      return {
        ...s,
        wrapUp: null,
        completed: { ...s.completed, [a.member]: { at: String(s.workMin), order: Object.keys(s.completed).length + 1 } },
        lastMoved: a.member,
        screen: a.next,
        workMin: s.workMin + (a.next.name === 'member' ? MIN.open : 0),
      }
    case 'RESET':
      return initialState
  }
}

export const Ctx = createContext<{ s: State; d: Dispatch<Action> }>(null as never)
export const useApp = () => useContext(Ctx)
