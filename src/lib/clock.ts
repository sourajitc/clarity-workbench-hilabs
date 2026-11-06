// Frozen clock. All business logic measures against meta.clock (Mon 9 Nov 2026 08:00 ET).
// Timestamps in the data are ET wall-clock strings; we parse them as UTC so no timezone shifts apply.
import { meta } from '../data'

const DAY = 86_400_000
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Parse 'YYYY-MM-DD', 'YYYY-MM-DD HH:MM' or ISO 'YYYY-MM-DDTHH:MM:SS' into epoch ms (wall clock as UTC). */
export function toMs(s: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s.trim())
  if (!m) return NaN
  return Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0)
}

export const CLOCK_MS = toMs(meta.clock)
export const CLOCK_DATE = meta.clock.slice(0, 10)

export const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s)

const dayStart = (ms: number) => Math.floor(ms / DAY) * DAY

/** Whole calendar days from a to b (b - a). */
export function calDays(a: string, b: string = CLOCK_DATE): number {
  return Math.round((dayStart(toMs(b)) - dayStart(toMs(a))) / DAY)
}

/** Fractional days elapsed from timestamp to the frozen clock. */
export function ageDays(ts: string): number {
  return (CLOCK_MS - toMs(ts)) / DAY
}

export function addDays(s: string, n: number): string {
  return isoDate(dayStart(toMs(s)) + n * DAY)
}

export function addBusinessDays(s: string, n: number): string {
  let ms = dayStart(toMs(s))
  let left = n
  while (left > 0) {
    ms += DAY
    const dow = new Date(ms).getUTCDay()
    if (dow !== 0 && dow !== 6) left--
  }
  return isoDate(ms)
}

/** Business days from the clock to a future date (0 = today). */
export function businessDaysUntil(s: string): number {
  let ms = dayStart(CLOCK_MS)
  const end = dayStart(toMs(s))
  let n = 0
  while (ms < end) {
    ms += DAY
    const dow = new Date(ms).getUTCDay()
    if (dow !== 0 && dow !== 6) n++
  }
  return n
}

function isoDate(ms: number): string {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

const hhmm = (d: Date) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

/** "Fri 6 Nov" */
export function fmtDay(s: string): string {
  const d = new Date(toMs(s))
  return `${DOW[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`
}
/** "6 Nov 2026" or "6 Nov" when in the clock's year */
export function fmtDate(s: string, forceYear = false): string {
  const d = new Date(toMs(s))
  const sameYear = d.getUTCFullYear() === new Date(CLOCK_MS).getUTCFullYear()
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}${forceYear || !sameYear ? ' ' + d.getUTCFullYear() : ''}`
}
/** "Sat 7 Nov 22:40" (time only when present in the source string) */
export function fmtDateTime(s: string): string {
  const hasTime = /[ T]\d{2}:\d{2}/.test(s)
  return hasTime ? `${fmtDay(s)} ${hhmm(new Date(toMs(s)))}` : fmtDay(s)
}
export function fmtMonthYear(s: string): string {
  const d = new Date(toMs(s))
  return `${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
export function fmtTime(s: string): string {
  return hhmm(new Date(toMs(s)))
}

/** Clock label in the header: "Mon 9 Nov 2026 · 08:00 ET" */
export const CLOCK_LABEL = `${fmtDay(meta.clock)} ${new Date(CLOCK_MS).getUTCFullYear()} · ${fmtTime(meta.clock)} ET`

/** Simulated wall time for audit stamps: frozen clock + minutes of demo work. */
export function workTime(minutes: number): string {
  return hhmm(new Date(CLOCK_MS + minutes * 60_000))
}

/** "Day N of 7" after a discharge date (discharge day = day 0). */
export function dayOfWindow(dischargeTs: string): number {
  return calDays(dischargeTs.slice(0, 10))
}

/** Age in whole years at the frozen clock. */
export function ageYears(dob: string): number {
  const c = new Date(CLOCK_MS)
  const b = new Date(toMs(dob))
  let a = c.getUTCFullYear() - b.getUTCFullYear()
  if (c.getUTCMonth() < b.getUTCMonth() || (c.getUTCMonth() === b.getUTCMonth() && c.getUTCDate() < b.getUTCDate())) a--
  return a
}

/** Human age of a timestamp: "3 d", "9 mo", "17 mo" */
export function humanAge(ts: string): string {
  const d = ageDays(ts)
  if (d < 1) return `${Math.max(0, Math.round(d * 24))} h`
  if (d < 60) return `${Math.floor(d)} d`
  return `${Math.floor(d / 30.44)} mo`
}
