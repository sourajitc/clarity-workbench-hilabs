# Acceptance checklist

## Data integrity
- [ ] No `fetch`, no external URLs, no API keys anywhere in `src/`.
- [ ] Every number, name, date and phone shown comes from `data/*.json` (grep for hard-coded "555-" in `src/` → none).
- [ ] Runtime `score()` reproduces every `queue.json` score exactly; a dev-mode console assert passes.
- [ ] The clock never moves; `new Date()` is used only for animation timing.

## Queue
- [ ] Order on load: Harold 82.2, Marcus 78.3, Esperanza 71.5, Leah 67.8 (Today), … Devon 52.3 (Today).
- [ ] Band counts on load: Urgent 3 · Today 15 · This week 18 · Monitor 12. Header shows 7 due today · 6 new since Fri.
- [ ] The score tooltip shows the four weighted components.
- [ ] An override needs a reason and is shown on the row.

## Member 360
- [ ] Every brief bullet has ≥1 citation, and each citation opens the right record.
- [ ] Flagged fields in the record drawer are highlighted with their IMP explanation.
- [ ] Conflict counts on open: P1 2, P2 2, P3 2, P4 2, P5 3.
- [ ] The timeline merges ADT-1002 + ADT-1003, RX-2003 + RX-2004 and DOC-4001 + DOC-4002, each labelled.
- [ ] SDOH age badges: P1 amber, P2 amber, P3 red, P4 red, P5 amber.

## Act & document
- [ ] "Sign and submit" stays disabled while a safety conflict is open or any field is empty.
- [ ] Field counts: P1 27 / 9 / 4, P5 29 / 8 / 3 (computed, not typed).
- [ ] A PHI warning appears for Denise (no auth) and Lucia (expired).
- [ ] The call simulator's "wrong number" path adds an attempt and demotes the number.

## Wrap-up & re-rank
- [ ] After P1 submits, Harold shows 38.2 / This week, Marcus is #1, and the counters update (1 conversation, 18 min saved).
- [ ] "Reset demo" restores the initial state exactly.

## Deliverables
- [ ] `npm install && npm run dev` works on a clean machine.
- [ ] `npm run screenshots` writes the PNGs for DEMO_SCRIPT steps 1–18 at 1440×900 @2x.
