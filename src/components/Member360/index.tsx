import { useState } from 'react'
import { ArrowLeft, ArrowRight, CalendarClock, ClipboardList, Home, Lock, Phone, Pill, Scale, ShieldCheck, ShieldAlert } from 'lucide-react'
import { personas, records } from '../../data'
import { fmtDay } from '../../lib/clock'
import { deadlines } from '../../lib/member'
import { useApp } from '../../state/reducer'
import { contactsView, openConflicts, openSafety } from '../../state/selectors'
import { cx, Section, Stat } from '../ui'
import Brief from './Brief'
import CarePlan, { carePlanSummary } from './CarePlan'
import Deadlines, { gapSummary } from './Deadlines'
import IdentityStrip from './IdentityStrip'
import MedDiff, { medSummary } from './MedDiff'
import SdohCard, { Bh, Rpm, rpmSummary, SdohSummary } from './SdohCard'
import Timeline, { timelineCount } from './Timeline'
import TrustPanel from './TrustPanel'

export default function Member360({ id }: { id: string }) {
  const { s, d } = useApp()
  const [tab, setTab] = useState<'meds' | 'timeline'>('meds')
  const p = personas[id]
  const safety = openSafety(s, id)
  const open = openConflicts(s, id)
  const all = deadlines(id)
  const dl = all.find((x) => x.window) ?? all[0]
  const meds = medSummary(id)
  const contact = contactsView(s, id).find((c) => !c.removed)
  const hasRpm = records('D18', id).length > 0
  const bh = records('D19', id)

  return (
    <main className="mx-auto max-w-[1360px] px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <button className="btn-ghost btn-sm -ml-2.5" onClick={() => d({ type: 'NAV', screen: { name: 'queue' } })}>
          <ArrowLeft size={14} /> Today queue
        </button>
        <button className="btn-primary" onClick={() => d({ type: 'NAV', screen: { name: 'act', id } })} data-testid="act">
          Act &amp; document <ArrowRight size={14} />
        </button>
      </div>

      <IdentityStrip id={id} />

      {/* At a glance: the four things Maria needs before anything else */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat
          label="Conflicts to resolve"
          icon={open.length ? <ShieldAlert size={17} /> : <ShieldCheck size={17} />}
          tone={safety.length ? 'red' : open.length ? 'amber' : 'green'}
          value={open.length ? `${open.length} open` : 'All resolved'}
          sub={safety.length ? `${safety.length} safety: resolve before signing` : open.length ? 'No safety issues' : 'Sources reconciled'}
        />
        <Stat
          label="Next deadline"
          icon={<CalendarClock size={17} />}
          tone={dl && dl.daysLeft <= 3 ? 'amber' : 'blue'}
          value={dl ? (dl.window ? `Day ${dl.window.day} of ${dl.window.of}` : dl.daysLeft <= 0 ? 'Due today' : `${dl.daysLeft} day${dl.daysLeft === 1 ? '' : 's'} left`) : 'None soon'}
          sub={dl ? `${dl.label} by ${fmtDay(dl.due)}` : 'No hard deadline in 30 days'}
        />
        <Stat label="Medications" icon={<Pill size={17} />} tone={meds.tone} value={meds.value} sub={meds.sub} />
        <Stat
          label="Best contact"
          icon={<Phone size={17} />}
          tone={contact?.confidence === 'High' ? 'green' : 'amber'}
          value={contact?.label.split(' - ')[0] ?? '—'}
          sub={contact ? `${contact.confidence} confidence · ${contact.best_window}` : ''}
        />
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,62fr)_minmax(0,38fr)] gap-4">
        <div className="min-w-0 space-y-4">
          <Brief id={id} />
          <section className="card overflow-hidden">
            <div className="flex gap-6 border-b border-slate-100 px-5 pt-3">
              <button className={cx('tab', tab === 'meds' && 'tab-on')} onClick={() => setTab('meds')} data-testid="tab-meds">
                {p.med_diff ? 'Medication reconciliation' : 'Medications on hand'}
              </button>
              <button className={cx('tab', tab === 'timeline' && 'tab-on')} onClick={() => setTab('timeline')} data-testid="tab-timeline">
                Timeline <span className="ml-1 text-[12px] text-slate-400">{timelineCount(id, !!s.claimsOnly[id])}</span>
              </button>
            </div>
            {tab === 'meds' ? <MedDiff id={id} /> : <Timeline id={id} />}
          </section>
        </div>

        <div className="min-w-0 space-y-4">
          <TrustPanel id={id} />
          <section className="card overflow-hidden">
            <Section title="Deadlines & quality" icon={<CalendarClock size={15} />} summary={gapSummary(id)} defaultOpen>
              <Deadlines id={id} />
            </Section>
            {hasRpm && (
              <Section title="Daily weights" icon={<Scale size={15} />} summary={rpmSummary(id)}>
                <Rpm id={id} />
              </Section>
            )}
            <Section title="Care plan" icon={<ClipboardList size={15} />} summary={carePlanSummary(id)}>
              <CarePlan id={id} />
            </Section>
            <Section title="Social needs" icon={<Home size={15} />} summary={<SdohSummary id={id} />}>
              <SdohCard id={id} />
            </Section>
            {bh.length > 0 && (
              <Section title="Behavioral health" icon={<Lock size={15} />} summary={`Consent on file · ${bh.length} encounters`}>
                <Bh id={id} />
              </Section>
            )}
          </section>
        </div>
      </div>
      <div className="h-8" />
    </main>
  )
}

