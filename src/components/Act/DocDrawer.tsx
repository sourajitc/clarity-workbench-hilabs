import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileSignature, Mic, PenLine, ShieldAlert, Sparkles, Wand2, X } from 'lucide-react'
import { personas, records, scripted } from '../../data'
import { parseCites } from '../../lib/records'
import { useApp } from '../../state/reducer'
import { fieldCounts, fieldsView, openSafety, type FieldView } from '../../state/selectors'
import { AiFooter, Analyzing, Cite, cx, RecordLink, Shimmer } from '../ui'

export default function DocDrawer({ id, onClose, flashCall }: { id: string; onClose: () => void; flashCall?: boolean }) {
  const { s, d } = useApp()
  const doc = personas[id].documentation!
  const fields = fieldsView(s, id)
  const counts = fieldCounts(id)
  const empty = fields.filter((f) => !f.value.trim())
  const safety = openSafety(s, id)
  const canSign = empty.length === 0 && safety.length === 0 && !s.submitted[id]
  const sections = useMemo(() => Array.from(new Set(fields.map((f) => f.section))), [id])
  const called = !!s.callDone[id]
  const suggestions = personas[id].care_plan_suggestions ?? []

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-full w-[640px] flex-col border-l border-slate-200 bg-white shadow-2xl animate-slideIn" data-testid="doc-drawer">
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] text-slate-500">Documentation · write once</div>
            <div className="text-[17px] font-semibold text-slate-900">{doc.template}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close documentation">
            <X size={18} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[13px]" data-testid="field-counts">
          <span className="rounded-lg bg-slate-50 px-3 py-2 text-slate-600">
            <b className="block text-[18px] font-semibold text-slate-900">{counts.prefilled}</b> pre-filled
          </span>
          <span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">
            <b className="block text-[18px] font-semibold text-blue-900">{counts.call}</b> from call
          </span>
          <span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            <b className="block text-[18px] font-semibold text-amber-900">{counts.maria}</b> need you
          </span>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 rounded-full bg-slate-100">
            <div className="h-1.5 rounded-full bg-navy-600 transition-all" style={{ width: `${((counts.total - empty.length) / counts.total) * 100}%` }} />
          </div>
          <span className="text-[12px] tabular-nums text-slate-500">
            {counts.total - empty.length}/{counts.total} filled
          </span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {!called && (
          <div className="mx-6 mt-4 rounded-lg bg-blue-50 px-3 py-2 text-[13px] text-blue-800">
            <Mic size={13} className="mr-1 inline" /> {counts.call} fields fill automatically when the call is completed.
          </div>
        )}
        {sections.map((sec) => (
          <div key={sec} className="px-6 pt-5">
            <div className="mb-1 text-[13px] font-semibold text-slate-900">{sec}</div>
            <div className="divide-y divide-slate-100">
              {fields
                .filter((f) => f.section === sec)
                .map((f) => (
                  <FieldRow key={f.field} f={f} memberId={id} flashOnMount={flashCall} />
                ))}
            </div>
          </div>
        ))}

        {suggestions.length > 0 && <CarePlanChips id={id} />}
        <div className="h-4" />
      </div>

      <footer className="border-t border-slate-100 bg-white px-6 py-4">
        {!canSign && !s.submitted[id] && (
          <div className="mb-2 space-y-0.5 text-[12px]">
            {safety.map((c) => (
              <div key={c.id} className="flex items-center gap-1 font-medium text-red-700">
                <ShieldAlert size={12} /> Safety conflict open: {c.entity} ({c.id}). Resolve it in the Trust panel.
              </div>
            ))}
            {empty.length > 0 && (
              <div className="text-slate-600">
                {empty.length} field{empty.length > 1 ? 's' : ''} empty: {empty.slice(0, 4).map((f) => f.field).join(', ')}
                {empty.length > 4 && '…'}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="meta">Signing writes to the assessment, care plan, call note and audit log at once.</span>
          <button className="btn-primary px-4 py-2" disabled={!canSign} onClick={() => d({ type: 'SUBMIT', member: id })} data-testid="sign-submit">
            <FileSignature size={15} /> {s.submitted[id] ? 'Signed' : 'Sign and submit'}
          </button>
        </div>
      </footer>
    </aside>
  )
}

function FieldRow({ f, memberId, flashOnMount }: { f: FieldView; memberId: string; flashOnMount?: boolean }) {
  const { s, d } = useApp()
  const prevEmpty = useRef(!f.value)
  const [flash, setFlash] = useState(!!flashOnMount && f.status === 'call' && !!f.value)
  useEffect(() => {
    if (f.status === 'call' && prevEmpty.current && f.value) setFlash(true)
    prevEmpty.current = !f.value
  }, [f.value])
  const cites = f.source ? parseCites(f.source, memberId) : []
  const locked = !!s.submitted[memberId]
  const set = (value: string, edited: boolean) => d({ type: 'SET_FIELD', member: memberId, field: f.field, value, edited })

  return (
    <div className={cx('grid grid-cols-[160px_1fr_130px] items-start gap-3 py-2', flash && 'animate-flash')} data-testid={`field-${f.status}`}>
      <label className="pt-1.5 text-[12px] leading-tight text-slate-500">{f.field}</label>
      <div className="min-w-0">
        <input
          className={cx('input', !f.value && f.status === 'maria' && 'border-amber-300 bg-amber-50/40', !f.value && f.status === 'call' && 'border-dashed bg-slate-50')}
          value={f.value}
          disabled={locked}
          placeholder={f.status === 'call' ? 'Fills from call' : f.status === 'maria' ? 'Your assessment' : ''}
          onChange={(e) => set(e.target.value, f.status !== 'maria' && e.target.value !== f.original)}
        />
        {f.edited && (
          <div className="mt-0.5 text-[11px] font-medium text-navy-600">
            <PenLine size={10} className="mr-0.5 inline" /> Edited by Maria · original kept in audit log
            <span className="ml-1 font-normal text-slate-400">("{f.original}")</span>
          </div>
        )}
        {f.status === 'maria' && !f.value && f.suggestion && !locked && (
          <button className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline" onClick={() => set(f.suggestion!, false)} data-testid="use-suggested">
            <Wand2 size={10} /> Use suggested: "{f.suggestion}"
          </button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1 pt-1">
        {f.status === 'prefilled' && (
          <span className="chip bg-slate-100 text-[11px] text-slate-600">
            <Check size={10} /> Pre-filled
          </span>
        )}
        {f.status === 'call' && (
          <span className={cx('chip text-[11px]', f.value ? 'bg-blue-50 text-blue-700' : 'bg-slate-50 text-slate-400')}>
            <Mic size={10} /> From call
          </span>
        )}
        {f.status === 'maria' && (
          <span className={cx('chip text-[11px]', f.value ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800')}>
            <PenLine size={10} /> {f.value ? 'By Maria' : 'Needs Maria'}
          </span>
        )}
        {cites.length > 0
          ? cites.map((c) => <RecordLink key={c} id={c} memberId={memberId} />)
          : f.source && f.status === 'prefilled' && <span className="text-[11px] text-slate-400">{f.source}</span>}
      </div>
    </div>
  )
}

function CarePlanChips({ id }: { id: string }) {
  const { s, d } = useApp()
  const sug = personas[id].care_plan_suggestions ?? []
  const [ready, setReady] = useState(Object.keys(s.carePlan[id] ?? {}).length > 0)
  useEffect(() => {
    if (ready) return
    const t = setTimeout(() => setReady(true), scripted.animation_ms.care_plan)
    return () => clearTimeout(t)
  }, [])
  const locked = !!s.submitted[id]
  return (
    <div className="mx-6 mt-6 ai-block overflow-hidden" data-testid="care-plan-suggestions">
      <div className="flex items-center justify-between px-4 pt-3.5">
        <span className="card-t flex items-center gap-2">
          <Sparkles size={14} className="text-blue-600" /> Care plan updates
        </span>
        <span className="meta">accept per line</span>
      </div>
      <div className="space-y-1.5 p-3">
        {!ready ? (
          <>
            <Analyzing label="Drafting care plan changes…" />
            <Shimmer lines={3} />
          </>
        ) : (
          sug.map((c, i) => {
            const on = !!s.carePlan[id]?.[i]
            return (
              <button
                key={i}
                disabled={locked}
                onClick={() => d({ type: 'CARE_PLAN', member: id, idx: i, accepted: !on })}
                className={cx('flex w-full items-start gap-2 rounded border px-2.5 py-1.5 text-left text-[13px] animate-fadeUp', on ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-navy-300')}
                data-testid="care-plan-chip"
              >
                <span className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border', on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300')}>{on && <Check size={11} />}</span>
                <span>
                  <b className="text-navy-700">{c.kind}:</b> {c.text}
                </span>
              </button>
            )
          })
        )}
      </div>
      <AiFooter>
        <span className="flex items-center gap-1 text-slate-500">
          Sources: call transcript
          {records('D05', id).map((r, i) => (
            <span key={r.doc_id} className="flex items-center gap-1">
              <Cite id={r.doc_id} n={i + 1} memberId={id} /> {r.doc_type.toLowerCase()}
            </span>
          ))}
        </span>
      </AiFooter>
    </div>
  )
}
