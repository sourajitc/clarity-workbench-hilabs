import { useCallback, useEffect, useReducer, useState } from 'react'
import { Info, X } from 'lucide-react'
import Act from './components/Act'
import WrapUpModal from './components/Act/WrapUpModal'
import Member360 from './components/Member360'
import Queue from './components/Queue'
import RecordDrawer from './components/RecordDrawer'
import Shell from './components/Shell'
import { assertScores } from './lib/rules'
import { Ctx, initialState, reducer, useApp, type Action } from './state/reducer'

if (import.meta.env.DEV) {
  const errors = assertScores()
  console.assert(errors.length === 0, 'Score assert failed', errors)
  if (errors.length === 0) console.info('[clarity] score() reproduces all queue.json / after_action / claims-only scores ✓')
}

export default function App() {
  const [s, raw] = useReducer(reducer, initialState)
  const [epoch, setEpoch] = useState(0)
  const d = useCallback((a: Action) => {
    if (a.type === 'RESET') setEpoch((e) => e + 1)
    raw(a)
  }, [])

  const screenKey = s.screen.name === 'queue' ? 'queue' : `${s.screen.name}-${s.screen.id}`
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [screenKey, epoch])

  return (
    <Ctx.Provider value={{ s, d }}>
      <div key={epoch} className="contents">
        <Shell>
          {s.screen.name === 'queue' && <Queue />}
          {s.screen.name === 'member' && <Member360 key={screenKey} id={s.screen.id} />}
          {s.screen.name === 'act' && <Act key={screenKey} id={s.screen.id} />}
        </Shell>
        <RecordDrawer />
        {s.wrapUp && <WrapUpModal id={s.wrapUp} />}
        <Toast />
      </div>
    </Ctx.Provider>
  )
}

function Toast() {
  const { s, d } = useApp()
  useEffect(() => {
    if (!s.toast) return
    const t = setTimeout(() => d({ type: 'CLEAR_TOAST' }), 3500)
    return () => clearTimeout(t)
  }, [s.toast?.n])
  if (!s.toast) return null
  return (
    <div className="fixed bottom-5 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-md bg-navy-800 px-4 py-2.5 text-[13px] text-white shadow-xl animate-fadeUp" data-testid="toast">
      <Info size={15} className="shrink-0 text-navy-200" />
      {s.toast.text}
      <button className="ml-2 text-navy-200 hover:text-white" onClick={() => d({ type: 'CLEAR_TOAST' })} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  )
}
