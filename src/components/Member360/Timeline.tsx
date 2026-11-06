import { useMemo, useState } from 'react'
import { GitMerge } from 'lucide-react'
import { fmtDateTime, toMs } from '../../lib/clock'
import { timeline } from '../../lib/member'
import { SOURCE_SHORT } from '../../lib/records'
import { useApp } from '../../state/reducer'
import { CLAIMS_VISIBLE } from './Brief'
import { cx, FreshBadge, Tag } from '../ui'

export const timelineCount = (id: string, claimsOnly: boolean) => {
  const items = timeline(id)
  return claimsOnly ? items.filter((i) => CLAIMS_VISIBLE.has(i.ds)).length : items.length
}

export default function Timeline({ id }: { id: string }) {
  const { s, d } = useApp()
  const items = useMemo(() => timeline(id), [id])
  const [all, setAll] = useState(false)
  const claimsOnly = !!s.claimsOnly[id]
  const visible = claimsOnly ? items.filter((i) => CLAIMS_VISIBLE.has(i.ds)) : items
  const list = all ? visible : visible.slice(0, 8)

  return (
    <div data-testid="timeline">
      <ol className="px-5 py-2">
        {list.map((it, i) => {
          const lateH = it.received ? Math.round((toMs(it.received) - toMs(it.ts)) / 3_600_000) : 0
          return (
            <li key={it.key} className="relative grid grid-cols-[104px_16px_1fr] gap-3" data-testid={it.merged ? 'merged' : undefined}>
              <div className="pt-2.5 text-right text-[12px] tabular-nums text-slate-400">{fmtDateTime(it.ts)}</div>
              <div className="relative flex justify-center">
                {i < list.length - 1 && <span className="absolute bottom-0 top-5 w-px bg-slate-200" />}
                <span className={cx('relative mt-3 h-2.5 w-2.5 rounded-full ring-4 ring-white', it.alert ? 'bg-amber-500' : 'bg-slate-300')} />
              </div>
              <button
                className="min-w-0 rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                onClick={() => d({ type: 'OPEN_RECORD', cite: it.id, memberId: id })}
                title={`Open ${it.ids.join(' + ')}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-slate-900">{it.title}</span>
                  {it.merged && (
                    <Tag tone="blue" icon={<GitMerge size={10} />}>
                      {it.merged}
                    </Tag>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[12px] text-slate-500">
                  <span className="font-medium text-slate-500">{SOURCE_SHORT[it.ds]}</span>
                  <span className="truncate">{it.detail}</span>
                  <FreshBadge f={it.fresh} asOf={it.asOf} />
                  {it.received && (
                    <span className={cx(lateH >= 1 && 'text-amber-700')}>
                      received {fmtDateTime(it.received)}
                      {lateH >= 1 && ` (+${lateH} h)`}
                    </span>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ol>
      {visible.length > 8 && (
        <button className="w-full border-t border-slate-100 py-2.5 text-[13px] font-medium text-navy-600 hover:bg-slate-50" onClick={() => setAll(!all)}>
          {all ? 'Show fewer' : `Show all ${visible.length} events`}
        </button>
      )}
    </div>
  )
}
