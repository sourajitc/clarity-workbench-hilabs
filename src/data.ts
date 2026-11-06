// Single import point for data/*.json (the source of truth). Nothing in src/ invents data.
import metaJson from '../data/meta.json'
import queueJson from '../data/queue.json'
import datasetsJson from '../data/datasets.json'
import impsJson from '../data/imperfections.json'
import scriptedJson from '../data/scripted.json'

export type Comp = 'R' | 'D' | 'S' | 'E'
export type Band = 'Urgent' | 'Today' | 'This week' | 'Monitor'

export interface QueueRow {
  member_id: string
  name: string
  age: number
  program: string
  language: string
  R: number
  D: number
  S: number
  E: number
  new_since_friday: boolean
  due_today: boolean
  reasons: string[]
  next_deadline: string
  best_time: string
  derivation?: Record<Comp, string>
  filler: boolean
  score: number
  band: string
  rank: number
}

export interface FreshnessRule {
  source: string
  fresh: string
  aging: string
  stale: string
  fresh_days: number
  stale_days: number
}

export interface AfterAction {
  R: number
  D: number
  S: number
  E: number
  reasons: string[]
  next_deadline: string
  score: number
  band: string
}

export interface Meta {
  clock: string
  clock_label: string
  plan: string
  user: { name: string; role: string; caseload: number }
  weights: Record<Comp, number>
  bands: { name: Band; min: number }[]
  deadline_points: [string, number][]
  signal_points: [string, number][]
  engagement_points: [string, number][]
  freshness: FreshnessRule[]
  feed_health: { source: string; last_refresh: string; status: string }[]
  pdc: Record<string, { pct: number; covered: number; days: number }>
  after_action: Record<string, AfterAction>
  counts: { new_since_friday: number; due_today: number }
}

export type Rec = Record<string, any> & { _flags?: Record<string, string> }
export interface Dataset {
  name: string
  priority: string
  records: Rec[]
}

export interface Imperfection {
  imp_id: string
  patient: string
  dataset: string
  record_id: string
  field: string
  problem_type: string
  what_is_wrong: string
  truth: string
  caught_by: string
}

export interface BriefBullet { text: string; cites: string[] }
export interface ConflictValue { label: string; value: string; date: string; record: string }
export interface Conflict {
  id: string
  entity: string
  severity: 'safety' | 'clinical' | 'data'
  explanation: string
  values: ConflictValue[]
  suggested: string
  options: string[]
  demo_choice: string
  result: string
}
export interface MedDiffRow {
  drug: string
  discharge: string
  pharmacy: string
  ehr: string
  category: string
  severity: 'safety' | 'high' | 'medium' | 'low' | 'ok'
  records: string[]
}
export interface Nba { id: string; rank: number; title: string; why: string; rule: string; confirm: string }
export interface Contact { contact_id: string; label: string; value: string; confidence: 'High' | 'Medium' | 'Low'; why: string; best_window: string }
export interface DocField { section: string; field: string; value: string; status: 'prefilled' | 'call' | 'maria'; source: string }
export interface Persona {
  member_id: string
  headline: string
  brief: BriefBullet[]
  conflicts: Conflict[]
  med_diff?: MedDiffRow[]
  nbas: Nba[]
  contacts: Contact[]
  call?: {
    contact_id: string
    outcome: string
    duration_min: number
    language: string
    transcript: [string, string][]
    note_draft: { S: string; O: string; A: string; P: string }
  }
  care_plan_suggestions?: { kind: string; text: string }[]
  documentation?: { template: string; fields: DocField[]; maria_answers: Record<string, string> }
  wrap_up?: {
    written_once_to?: string[]
    deadlines_ticked?: string[]
    tasks_created?: string[]
    booked?: string
    data_corrections?: string[]
    queue_change?: string
    time_saved_min?: number
    conversations_today_after?: number
  }
  claims_only_view?: { score: number; note: string }
  sms_template?: string
  sms_reply?: string
}

export interface Scripted {
  personas: Record<string, Persona>
  demo_paths: Record<string, string[]>
  ai_label: string
  animation_ms: { brief: number; conflict: number; note: number; care_plan: number }
}

export const meta = metaJson as unknown as Meta
export const queue = queueJson as unknown as QueueRow[]
export const datasets = datasetsJson as unknown as Record<string, Dataset>
export const imperfections = impsJson as unknown as Imperfection[]
export const scripted = scriptedJson as unknown as Scripted
export const personas = scripted.personas

/** The AI label as written in scripted.json, rendered with a middle dot. */
export const AI_LABEL = scripted.ai_label.replace(' - ', ' · ')

export const records = (key: string, memberId?: string): Rec[] =>
  (datasets[key]?.records ?? []).filter((r) => !memberId || r.member_id === memberId)
