# CLAUDE.md — build brief for the Clarity Workbench prototype

You are building a **hard-coded, clickable desktop prototype** for a product case (HiLabs APM caselet:
"reimagine the Case Management Workbench"). It will be demoed live and screenshotted for a slide deck.
Read this file, then `docs/SPEC.md`, `docs/DEMO_SCRIPT.md` and `docs/ACCEPTANCE.md` before writing code.

## Non-negotiables

1. **No network calls. No LLM/API calls.** Every "AI" output is pre-written in `data/scripted.json`
   and revealed after a short fake "analyzing…" animation (durations in `scripted.json → animation_ms`).
2. **Data comes only from `data/*.json`.** Do not invent patients, numbers, dates or phone numbers in
   components. If you need a value that isn't there, add it to the Python generator in `scripts/`
   and re-run it, so the annex spreadsheet and the app never disagree.
3. **Frozen clock:** `meta.json → clock` (Mon 9 Nov 2026 08:00 ET). Never use `new Date()` for
   business logic. All "day 3 of 7", ages and freshness badges are computed from the frozen clock.
4. **Real but simple logic** for: the priority score and band (formula in SPEC §4.1), freshness
   badges (SPEC §4.2), re-ranking after an action, and field-status counts. Everything else is scripted.
5. **Every AI block** shows the label `Drafted by Clarity · review required`, numbered source
   citations that open the cited record, and needs a clinician click to take effect.
6. **Desktop first:** design for 1440×900. It must not break at 1280 wide. Mobile is out of scope.
7. Fictional data only. Keep the 555-01xx numbers and the `BW-` IDs exactly as given.

## Stack (recommended)

- Vite + React + TypeScript, Tailwind CSS, `lucide-react` icons. No backend, no router library
  needed (a small state machine for screens is fine; hash routes are fine too).
- State: `useReducer` holding UI and workflow state (resolved conflicts, accepted NBAs, call state,
  field values, completed members). A **Reset demo** button in the header clears it.
- Import JSON directly (`import queue from '../data/queue.json'`). Copy or symlink `data/` into `src/` if
  the bundler needs it, but keep `data/` as the source of truth.
- `npm run dev` must work immediately after `npm install`.
- Add `scripts/screenshots.ts` (Playwright, already preinstalled in many environments) that walks the
  demo path and saves PNGs at 1440×900, deviceScaleFactor 2, into `screenshots/`. Name the files by
  step, e.g. `01-queue.png`, `02-member360-brief.png`.

## Suggested source layout

```
src/
  main.tsx, App.tsx
  lib/clock.ts          frozen clock helpers (daysBetween, businessDays, "day N of 7")
  lib/rules.ts          score(), band(), freshness(), reasonChips()
  lib/records.ts        lookup any record by id across datasets.json (for citations)
  state/reducer.ts      workflow state + actions (RESOLVE_CONFLICT, ACCEPT_NBA, CALL, SET_FIELD, SUBMIT, RESET)
  components/Shell.tsx  header: clock, Maria, capacity meter, feed-health bar, Reset
  components/Queue.tsx
  components/Member360/ (IdentityStrip, Brief, TrustPanel, ConflictCard, MedDiff, Timeline, Deadlines, CarePlan, SdohCard)
  components/Act/       (NbaList, OutreachPanel, CallSimulator, DocDrawer, WrapUpModal)
  components/RecordDrawer.tsx  side drawer showing a cited source record (raw JSON shown nicely)
```

## Visual direction

A calm clinical tool, not a marketing site. Use a light theme with one deep navy accent (#1F3A5F) and
semantic colours only for meaning:
- green = fresh / ok
- amber = aging / attention
- red = stale / safety
- violet = AI-drafted content

Use dense but readable type (14px body, 12px meta), real tables and clear hierarchy. Badges always pair a
colour with a word, never colour alone. Show source and "as of" on every fact.

## Definition of done

Everything in `docs/ACCEPTANCE.md` passes, the demo script in `docs/DEMO_SCRIPT.md` runs end-to-end
without a reload, and `npm run screenshots` produces the PNG set.

## Regenerating data

```
python scripts/build_data.py && python scripts/build_scripted.py && python scripts/build_annex.py
```
