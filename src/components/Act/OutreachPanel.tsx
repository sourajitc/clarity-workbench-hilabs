import { useEffect, useRef, useState } from 'react'
import { MessageSquareText, Phone, Send, Sparkles } from 'lucide-react'
import { personas } from '../../data'
import { fmtDate, workTime } from '../../lib/clock'
import { caregiverForContact, elig } from '../../lib/member'
import { resolve } from '../../lib/records'
import { freshness, phoneFreshness } from '../../lib/rules'
import { useApp } from '../../state/reducer'
import { contactsView, type ContactView } from '../../state/selectors'
import { resolvedValue } from '../Member360/IdentityStrip'
import { AiFooter, Callout, ConfidenceBadge, cx, FreshBadge, RecordLink, Tag } from '../ui'
import CallSimulator, { isSmsLine, NoteDraft, Transcript } from './CallSimulator'

interface SmsConfig {
  contactId: string
  text: string
  reply: string
  replyFrom: string
}

function smsConfig(id: string): SmsConfig | null {
  const p = personas[id]
  if (p.sms_template && p.sms_reply) {
    const c = p.contacts[0]
    return { contactId: c.contact_id, text: p.sms_template, reply: p.sms_reply, replyFrom: `${elig(id).first_name} (SMS)` }
  }
  const sms = (p.call?.transcript ?? []).filter(([sp]) => isSmsLine(sp))
  if (p.call && sms.length >= 2) return { contactId: p.call.contact_id, text: sms[0][1], reply: sms[1][1], replyFrom: sms[1][0] }
  return null
}

export default function OutreachPanel({ id }: { id: string }) {
  const { s } = useApp()
  const p = personas[id]
  const contacts = contactsView(s, id)
  const sms = smsConfig(id)
  const [session, setSession] = useState<{ contactId: string; kind: 'call' | 'sms' } | null>(null)
  const [showTranscript, setShowTranscript] = useState(true)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const called = s.callDone[id]
  const attempts = s.attempts[id] ?? []
  const callLines = (p.call?.transcript ?? []).filter(([sp]) => !isSmsLine(sp))

  return (
    <section className="card flex min-h-0 flex-col overflow-hidden" data-testid="outreach">
      <header className="px-5 pb-2 pt-4">
        <h2 className="card-t">Who to contact</h2>
        <p className="text-[12px] text-slate-500">Ranked by how likely each number is to reach the right person.</p>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5 pt-1">
        <ol className="space-y-2.5">
          {contacts.map((c, i) => (
            <ContactCard
              key={c.contact_id}
              c={c}
              rank={i + 1}
              memberId={id}
              sms={sms?.contactId === c.contact_id ? sms : null}
              busy={!!session}
              onCall={() => setSession({ contactId: c.contact_id, kind: 'call' })}
              onSms={() => setSession({ contactId: c.contact_id, kind: 'sms' })}
            />
          ))}
        </ol>

        {(session?.kind === 'sms' || s.sms[id]) && sms && <SmsThread memberId={id} cfg={sms} onDone={() => setSession(null)} />}

        {session?.kind === 'call' && <CallSimulator memberId={id} contactId={session.contactId} onEnd={() => setSession(null)} />}

        {called && (
          <div className="rounded-xl border border-slate-200" ref={transcriptRef}>
            <button className="flex w-full items-center justify-between px-4 py-2.5 text-left" onClick={() => setShowTranscript(!showTranscript)}>
              <span className="text-[14px] font-semibold text-slate-900">
                Call transcript <span className="font-normal text-slate-400">· {p.call?.duration_min} min · {p.call?.language}</span>
              </span>
              <span className="text-[12px] text-slate-500">{showTranscript ? 'Hide' : 'Show'}</span>
            </button>
            {showTranscript && <Transcript lines={callLines} />}
          </div>
        )}
        {called && (
          <NoteDraft
            memberId={id}
            onShowTranscript={() => {
              setShowTranscript(true)
              transcriptRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
          />
        )}

        {attempts.length > 0 && (
          <div>
            <div className="mb-1 text-[12px] text-slate-400">Outreach log · today</div>
            <ul className="space-y-0.5 text-[12px] text-slate-600">
              {attempts.map((a, i) => {
                const c = contacts.find((x) => x.contact_id === a.contactId)
                return (
                  <li key={i} className="flex gap-2">
                    <span className="tabular-nums text-slate-400">{workTime(+a.at)}</span>
                    <span className="font-medium text-slate-700">{a.outcome}</span>
                    <span className="truncate text-slate-500">{c?.label.split(' - ')[0]} · {c?.value}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

function ContactCard({
  c,
  rank,
  memberId,
  sms,
  busy,
  onCall,
  onSms,
}: {
  c: ContactView
  rank: number
  memberId: string
  sms: SmsConfig | null
  busy: boolean
  onCall: () => void
  onSms: () => void
}) {
  const { s } = useApp()
  const loc = resolve(c.contact_id, memberId)
  const fresh = loc?.key === 'D02' ? phoneFreshness(loc.record) : loc?.key === 'D20' ? freshness('Phone number', loc.record.datetime) : null
  const asOf = loc?.key === 'D02' ? loc.record.last_verified : loc?.record.datetime
  const cg = caregiverForContact(c.contact_id)
  const renewing = Object.entries(s.nba[memberId] ?? {}).some(
    ([nid, st]) => st.status === 'accepted' && /authorization/i.test(personas[memberId].nbas.find((n) => n.id === nid)?.rule ?? ''),
  )
  const langCf = personas[memberId].conflicts.find((x) => /language/i.test(x.entity))
  const memberLang = langCf && s.resolved[langCf.id] ? resolvedValue(langCf.id, s.resolved[langCf.id].choice) : elig(memberId).preferred_language
  const language = cg?.language ?? memberLang
  const noConsent = loc?.key === 'D02' && loc.record.consent_to_call === 'N'
  const scriptedCall = personas[memberId].call?.contact_id === c.contact_id
  const smsDone = s.sms[memberId] === 'replied'
  const smsFirst = !!sms && !smsDone
  const called = !!s.callDone[memberId]

  const [who, kind] = c.label.split(' - ')
  const phi = !!cg && cg.hipaa !== 'valid' && !c.removed
  const cgFirst = cg ? cg.name.split(' ')[0] : ''

  return (
    <li
      className={cx('rounded-xl border px-4 py-3', c.removed ? 'border-dashed border-slate-200 opacity-50' : rank === 1 ? 'border-navy-200 bg-navy-50/30' : 'border-slate-200 bg-white')}
      data-testid={`contact-${c.contact_id}`}
    >
      <div className="flex items-start gap-3">
        <span className={cx('mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[12px] font-semibold', rank === 1 && !c.removed ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-500')}>{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={cx('text-[14px] font-semibold', c.removed ? 'text-slate-500 line-through' : 'text-slate-900')}>{who}</span>
            {kind && <span className="text-[12px] text-slate-500">{kind}</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-mono text-[13px] text-slate-800">{c.value}</span>
            <ConfidenceBadge c={c.confidence} />
            <FreshBadge f={fresh} asOf={asOf} />
          </div>
          <div className="mt-1 truncate text-[12px] text-slate-500" title={c.why}>
            {c.best_window !== '-' && <>{c.best_window} · </>}
            {language} · {c.why} <RecordLink id={c.contact_id} memberId={memberId} />
          </div>
          {c.note && (
            <div className="mt-1 text-[12px] font-medium text-red-700">
              {c.note}
              {c.confidence !== c.baseConfidence && ` (was ${c.baseConfidence})`}
            </div>
          )}
          {phi && (
            <div className="mt-2" data-testid="phi-warning">
              <Callout tone={renewing && cg!.hipaa === 'expired' ? 'amber' : 'red'}>
                <b className="font-semibold">PHI warning:</b>{' '}
                {cg!.hipaa === 'expired' ? `${cgFirst}\u2019s HIPAA authorization expired ${fmtDate(cg!.auth_expiry)}.` : `No HIPAA authorization for ${cgFirst}. Message only.`}
                {renewing && cg!.hipaa === 'expired' && ' Renewal accepted: get verbal consent first.'}
                {noConsent && ' No consent to call on file.'}
              </Callout>
            </div>
          )}
        </div>
        {!c.removed && (
          <div className="flex shrink-0 items-center gap-1.5">
            {sms && (
              <button className={cx('btn btn-sm', smsFirst ? 'btn-primary' : 'btn-secondary')} disabled={busy || !!s.sms[memberId]} onClick={onSms} data-testid="send-sms">
                <MessageSquareText size={13} /> {s.sms[memberId] ? 'SMS sent' : 'Send SMS'}
              </button>
            )}
            <button
              className={cx('btn btn-sm', !smsFirst && scriptedCall && !called ? 'btn-primary' : 'btn-secondary')}
              disabled={busy || (scriptedCall && called)}
              onClick={onCall}
              data-testid={`call-${c.contact_id}`}
            >
              <Phone size={13} /> {scriptedCall && called ? 'Called' : sms && smsDone && scriptedCall && callAt(memberId) ? `Call at ${callAt(memberId)}` : 'Call'}
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function SmsThread({ memberId, cfg, onDone }: { memberId: string; cfg: SmsConfig; onDone: () => void }) {
  const { s, d } = useApp()
  const phase = s.sms[memberId]
  const [text, setText] = useState(cfg.text)
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    if (phase !== 'sent') return
    setTyping(true)
    const t = setTimeout(() => {
      setTyping(false)
      d({ type: 'SMS', member: memberId, contactId: cfg.contactId, phase: 'replied' })
      onDone()
    }, 1600)
    return () => clearTimeout(t)
  }, [phase])

  return (
    <div className="rounded-xl border border-slate-200" data-testid="sms-thread">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-slate-900">
          <MessageSquareText size={13} /> SMS · {personas[memberId].contacts.find((c) => c.contact_id === cfg.contactId)?.value}
        </span>
        {phase === 'replied' && <Tag tone="green">Reply received</Tag>}
      </div>
      {!phase ? (
        <div className="ai-block mx-3 mb-3 overflow-hidden">
          <textarea className="w-full resize-none bg-transparent p-3 text-[13px] focus:outline-none" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <AiFooter>
            <button className="btn-primary btn-sm ml-auto" onClick={() => d({ type: 'SMS', member: memberId, contactId: cfg.contactId, phase: 'sent' })} data-testid="sms-send-confirm">
              <Send size={12} /> Send
            </button>
          </AiFooter>
        </div>
      ) : (
        <div className="space-y-1.5 p-3 text-[13px]">
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-br-md bg-navy-700 px-3 py-2 text-white">
              <div className="text-[11px] font-medium text-navy-200">Maria · SMS</div>
              {text}
            </div>
          </div>
          {typing && (
            <div className="flex">
              <div className="rounded-lg rounded-bl-sm bg-slate-100 px-3 py-2 text-slate-400">
                <span className="animate-pulse">● ● ●</span>
              </div>
            </div>
          )}
          {phase === 'replied' && (
            <div className="flex animate-fadeUp">
              <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-slate-100 px-3 py-2 text-slate-800">
                <div className="text-[11px] font-medium text-slate-500">{cfg.replyFrom}</div>
                {cfg.reply}
              </div>
            </div>
          )}
          {phase === 'replied' && personas[memberId].call && !s.callDone[memberId] && (
            <div className="flex items-center gap-1.5 pt-1 text-[12px] text-blue-700">
              <Sparkles size={12} /> Reply received. Call when the member asked{callAt(memberId) && ` (simulated as ${callAt(memberId)})`}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Simulated call time from the scripted outcome, e.g. "connected at 18:20 (simulated)". */
const callAt = (id: string) => /(\d{2}:\d{2})/.exec(personas[id].call?.outcome ?? '')?.[1]
