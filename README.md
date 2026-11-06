# Clarity Workbench — prototype project

Hard-coded prototype and synthetic data for the HiLabs APM caselet (Case Management Workbench).

| Path | What it is |
|---|---|
| `CLAUDE.md` | Build brief. Open this folder in Claude Code and say: *"Build the prototype described in CLAUDE.md."* |
| `docs/SPEC.md` | Screen-by-screen specification and rules |
| `docs/DEMO_SCRIPT.md` | The 18-step click path (also the screenshot list for the deck) |
| `docs/ACCEPTANCE.md` | Checks the build must pass |
| `data/` | Source of truth: datasets, queue, imperfections, scripted AI content, meta |
| `annex/Clarity_Data_Annex.xlsx` | Data annex for submission (generated from `data/`) |
| `scripts/` | Python generators. Re-run them to change any data |

Regenerate everything:

```
python scripts/build_data.py && python scripts/build_scripted.py && python scripts/build_annex.py
```

All people, phone numbers (555-01xx), NPIs (99…) and facilities are fictional.

## Run the prototype

```
npm install
npm run dev            # http://localhost:5173
npm run screenshots    # walks DEMO_SCRIPT.md, asserts ACCEPTANCE.md numbers, writes screenshots/*.png (1440x900 @2x)
```

`npm run screenshots` needs a Playwright Chromium (`npx playwright install chromium` once).
Source: `src/` (Vite + React + TS + Tailwind). Real logic lives in `src/lib/rules.ts` (score, band,
freshness), `src/lib/member.ts` (deadlines, timeline merge) and `src/state/` (workflow reducer, re-rank).
