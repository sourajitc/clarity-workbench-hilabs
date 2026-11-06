import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Phone, PhoneOff, Sparkles, Voicemail, XCircle } from 'lucide-react'
import { personas, scripted } from '../../data'
import { demote } from '../../lib/rules'
import { useApp, type CallOutcome } from '../../state/reducer'
import { contactsView } from '../../state/selectors'
import { AiFooter, Analyzing, Cite, cx, Shimmer, Tag } from '../ui'

const OUTCOMES: { o: CallOutcome; icon: typeof Phone }[] = [
  { o: 'Connected', icon: CheckCircle2 },
  { o: 'Voicemail', icon: Voicemail },
  { o: 'No answer', icon: PhoneOff },
  { o: 'Wrong number', icon: XCircle },
]

export const isSmsLine = (speaker: string) => /SMS/.test(speaker)

/** Dialling → outcome → transcript (line by line) → SOAP note draft. */
export default function CallSimulator({ memberId, contactId, onEnd }: { memberId: string; contactId: string; onEnd: () => void }) {
  const { s, d } = useApp()
  const p = personas[memberId]
  const contact = contactsView(s, memberId).find((c) => c.contact_id === contactId)!
  const isScripted = p.call?.contact_id === contactId
  const lines = (p.call?.transcript ?? []).filter(([sp]) => !isSmsLine(sp))
  const [phase, setPhase] = useState<'dialing' | 'outcome' | 'transcript'>('dialing')
  const [shown, setShown] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setPhase('outcome'), 1400)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (phase !== 'transcript') return
    if (shown >= lines.length) {
      d({ type: 'CALL_DONE', member: memberId, contactId, note: { ...p.call!.note_draft, accepted: false } })
      onEnd()
      return
    }
    const t = setTimeout(() => setShown((n) => n + 1), 250)
    return () => clearTimeout(t)
  }, [phase, shown])

  const pick = (o: CallOutcome) => {
    if (o === 'Connected' && isScripted) {
      d({ type: 'CALL', member: memberId, contactId, outcome: o })
      setPhase('transcript')
      return
    }
    const demoteTo =
      o === 'Wrong number'
        ? { confidence: 'Low' as const, note: 'Wrong number reported 9 Nov' }
        : o === 'No answer'
          ? { confidence: demote(contact.confidence), note: 'No answer 9 Nov' }
          : undefined
    d({ type: 'CALL', member: memberId, contactId, outcome: o, demoteTo })
    d({
      type: 'TOAST',
      text:
        o === 'Connected'
          ? `Attempt logged as connected. No scripted conversation for ${contact.value} in this prototype.`
          : `${o}: attempt logged${demoteTo ? `, ${contact.value} demoted to ${demoteTo.confidence} confidence` : ''}.`,
    })
    onEnd()
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" data-testid="call-sim">
      <div className="flex items-center gap-3 bg-navy-700 px-4 py-3 text-white">
        <span className={cx('grid h-8 w-8 place-items-center rounded-full bg-white/15', phase === 'dialing' && 'animate-pulseRing')}>
          <Phone size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">{contact.label}</div>
          <div className="font-mono text-[12px] text-navy-100">{contact.value}</div>
        </div>
        <span className="text-[12px] text-navy-100">{phase === 'dialing' ? 'Dialling…' : phase === 'outcome' ? 'Simulated call: choose outcome' : `Connected · ${p.call?.language}`}</span>
      </div>
      {phase === 'outcome' && (
        <div className="flex flex-wrap gap-2 p-4">
          {OUTCOMES.map(({ o, icon: I }) => {
            const hint = isScripted && o === 'Connected'
            return (
              <button
                key={o}
                className={cx('btn', hint ? 'border-navy-700 bg-navy-700 text-white ring-4 ring-navy-100 hover:bg-navy-800' : 'btn-secondary')}
                onClick={() => pick(o)}
                data-testid={`outcome-${o}`}
              >
                <I size={14} /> {o}
                {hint && <span className="text-[11px] opacity-70">· scripted</span>}
              </button>
            )
          })}
        </div>
      )}
      {phase === 'transcript' && <Transcript lines={lines.slice(0, shown)} live />}
    </div>
  )
}

export function Transcript({ lines, live }: { lines: [string, string][]; live?: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (live) end.current?.scrollIntoView({ block: 'nearest' })
  }, [lines.length, live])
  return (
    <div className="max-h-[320px] space-y-2 overflow-y-auto px-4 pb-4 text-[13px]" data-testid="transcript">
      {lines.map(([who, text], i) => {
        const maria = /^Maria/.test(who) || /Clarity SMS/.test(who)
        return (
          <div key={i} className={cx('flex animate-fadeUp', maria ? 'justify-end' : 'justify-start')}>
            <div className={cx('max-w-[80%] rounded-2xl px-3 py-2 leading-snug', maria ? 'rounded-br-md bg-navy-700 text-white' : 'rounded-bl-md bg-slate-100 text-slate-800')}>
              <div className={cx('text-[11px] font-medium', maria ? 'text-navy-200' : 'text-slate-500')}>{who}</div>
              {text}
            </div>
          </div>
        )
      })}
      <div ref={end} />
    </div>
  )
}

/** SOAP note draft: generates after the call, editable, needs Maria's click to take effect. */
export function NoteDraft({ memberId, onShowTranscript }: { memberId: string; onShowTranscript: () => void }) {
  const { s, d } = useApp()
  const note = s.note[memberId]
  const [ready, setReady] = useState(!!note?.accepted)
  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setReady(true), scripted.animation_ms.note)
    return () => clearTimeout(t)
  }, [])
  if (!note) return null
  const contactId = s.callDone[memberId]?.contactId
  return (
    <div className="ai-block overflow-hidden" data-testid="note-draft">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="card-t flex items-center gap-2">
          <Sparkles size={14} className="text-blue-600" /> Call note draft (SOAP)
        </span>
        {note.accepted && <Tag tone="green">Accepted by Maria</Tag>}
      </div>
      <div className="space-y-2 px-4 py-3">
        {!ready ? (
          <>
            <Analyzing label="Drafting SOAP note from the conversation…" />
            <Shimmer lines={5} />
          </>
        ) : (
          (['S', 'O', 'A', 'P'] as const).map((k) => (
            <label key={k} className="grid grid-cols-[22px_1fr] gap-2 animate-fadeUp">
              <span className="pt-1 text-[13px] font-bold text-navy-700">{k}</span>
              <textarea
                className="input min-h-[52px] resize-y leading-snug"
                rows={k === 'P' ? 4 : 2}
                value={note[k]}
                readOnly={note.accepted}
                onChange={(e) => d({ type: 'EDIT_NOTE', member: memberId, part: k, value: e.target.value })}
              />
            </label>
          ))
        )}
      </div>
      <AiFooter>
        <span className="flex items-center gap-1 text-slate-600">
          Sources:
          <button className="cite" onClick={onShowTranscript}>
            [1]
          </button>
          call transcript
          {contactId && (
            <>
              <Cite id={contactId} n={2} memberId={memberId} /> contact
            </>
          )}
        </span>
        {ready && !note.accepted && (
          <button className="btn-primary btn-sm ml-auto" onClick={() => d({ type: 'ACCEPT_NOTE', member: memberId })} data-testid="accept-note">
            Accept note
          </button>
        )}
      </AiFooter>
    </div>
  )
}
