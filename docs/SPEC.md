# Clarity Workbench — prototype specification

**Product in one line:** Clarity is a trust-and-triage layer on top of a health plan's existing case
management system. It tells Maria who needs her today, shows her what is true (and what is uncertain)
about each member, and turns one conversation into finished documentation.

**Prototype frame:** Brightwater Health (fictional MA HMO + D-SNP), user Maria Alvarez RN, 48-member
caseload, frozen clock **Mon 9 Nov 2026 08:00 ET**. All data is in `data/`.

---

## 1. Data files

| File | Contents | Used by |
|---|---|---|
| `data/meta.json` | clock, weights, bands, point tables, freshness thresholds, feed health, PDC results, after-action states | Shell, rules |
| `data/queue.json` | 48 queue rows: `R D S E`, `score`, `band`, `reasons[3]`, `next_deadline`, `best_time`, flags. `filler:true` rows have no 360 view | S1 Queue |
| `data/datasets.json` | `D01`–`D20` + `D05b`, each `{name, priority, records[]}`. Records may carry `_flags {field: IMP-id}` | S2, citations, record drawer |
| `data/imperfections.json` | 38 planted data problems with truth and the feature that catches them | Trust panel badges, record drawer |
| `data/scripted.json` | per persona: `headline, brief[], conflicts[], med_diff[], nbas[], contacts[], call{transcript, note_draft}, care_plan_suggestions[], documentation{fields[], maria_answers}, wrap_up{}` | S2, S3, S4 |

Citations in `scripted.json` are record ids (`RX-1002`, `DOC-1001`…). `D11:<npi>` means a provider row in
D11, and `D01` / `D13` alone means that member's row in that dataset. Clicking a citation opens the
**Record drawer** with the raw record. Any `_flags` field is highlighted, along with its IMP explanation.

---

## 2. Screens

### S0 Shell (always visible)
- Left: product name "Clarity" + plan name. Centre: frozen clock "Mon 9 Nov 2026 · 08:00 ET".
  Right: Maria's name, "Reset demo".
- **Capacity meter:** "48 cases · 7 due today · 6 new since Fri · conversations today: N · prep time saved: M min".
  N and M update from workflow state; wrap-up adds `time_saved_min`.
- **Feed health bar** (from `meta.feed_health`): one chip per source with last refresh, e.g. "Claims · 1 Nov · aging".
  A tooltip explains why claims are 8 days behind and why ADT is fresh.

### S1 Today Queue
- Bands as collapsible groups: Urgent (≥70), Today (50–69), This week (30–49), Monitor (<30).
- Each row shows:
  - rank
  - name, age, program, language
  - a **score pill** (number + band colour)
  - up to 3 **reason chips**
  - next deadline
  - best time to call
  - "New since Fri" badge
- Hovering the score shows the breakdown: `0.35×R + 0.30×D + 0.25×S + 0.10×E`. The values come from `queue[i]`.
  Persona rows also show `derivation` text per component.
- Filters: band, program, language, "new since Fri", "due today".
- **Override:** a drag handle or "Move up" menu, with the reason chosen from: clinical judgment / member
  request / already handled / data wrong. Show "Overridden by Maria · reason" on the row.
- Persona rows are clickable. Filler rows open a small "No detailed record in this prototype" toast.
- After a persona is completed:
  - apply `meta.after_action[member_id]` (P1), or the `wrap_up.queue_change` text (P3, P5);
  - re-sort with an animated move;
  - show a "Completed today" check.

### S2 Member 360 (personas only)
Layout: a left column (≈62%) and a right column (≈38%).

- **Identity strip** (top, full width): name, age, plan, dual status, language (with a conflict warning if one
  is unresolved), PCP (with a "Verified by HiLabs" chip), caregiver with HIPAA status (valid / expired / none),
  risk percentile, programme.
- **AI pre-call brief** (left, first): the headline plus bullets with [n] citations.
  - Reveal it with a 1.2 s shimmer, then the bullets fade in one by one.
  - Footer: "Drafted by Clarity · review required · Flag inaccurate".
- **Trust panel** (right, first): an "N open conflicts" counter, then **conflict cards**. Each card has:
  - entity and severity badge (safety red / clinical amber / data grey);
  - a one-line explanation;
  - each source value with its source, date and freshness badge;
  - the suggested resolution;
  - the option buttons.
  Resolving a card collapses it to a one-line "Resolved by Maria · 08:14 · result". The counter decrements.
  **Safety conflicts must be resolved before the Act screen enables "Sign and submit".**
- **Medication reconciliation diff** (left): a table with columns Drug | Discharge | Pharmacy | PCP list | Category | Severity.
  - Categories come from SPEC §4.4. Rows are sorted safety → high → medium → ok.
- **Timeline** (left): merged events from D04, D05, D06, D07, D09, D03, D20, newest first.
  - Each item shows a source chip and a freshness badge.
  - **Duplicates are merged** ("2 messages merged": ADT-1002 + ADT-1003, RX-2003 reversal + RX-2004).
  - ADT shows both event time and received time.
- **Deadlines & quality** (right): the next-deadline countdown ("Day 3 of 7 · PCP visit due by Fri 13 Nov")
  and a TRC / FUH / PDC checklist from D17.
- **Care plan** (right): goals, barriers and open tasks from D16.
- **SDOH card** (right): fields from D14 with an **age badge** (fresh <6 mo, amber 6–12, red >12) and a
  "Re-screen during call" toggle.
- Primary button: **"Act & document →"**.

### S3 Act & Document
Three panels: NBA list (left), Outreach (centre), Documentation drawer (right, slides over).

- **Next best actions:** cards ranked by `rank`. Each shows the title, a "why" line, the rule name
  ("Rule: stopped med still being filled") and who confirms it. Buttons: Accept / Snooze / Dismiss
  (dismiss asks for a reason). Accepted NBAs become tasks in the wrap-up.
- **Outreach panel:**
  - ranked contacts from `contacts[]`, with confidence badge, why, best window and language;
  - a PHI warning when the contact is a caregiver with expired or missing authorization (P3, P5);
  - a **Call** button opens the call simulator: dialling animation, then outcome buttons
    (Connected / Voicemail / No answer / Wrong number). The scripted outcome is pre-highlighted.
  - On Connected, the transcript lines appear one by one (fast, ~250 ms each).
  - Then the **call note draft** (SOAP) generates (1.5 s) in an editable textarea.
  - Wrong number / no answer adds an outreach attempt and demotes the number (real state change).
  - For P4, show **Send SMS** with `sms_template` and a simulated reply instead of a call first.
- **Documentation drawer** (P1 and P5 have full templates):
  - header: template name + counts "27 pre-filled · 9 from call · 4 need you" (computed from `fields[].status`);
  - fields grouped by section, each with its value and a **provenance chip**: Pre-filled (source id) / From
    call / Needs Maria;
  - "call" fields stay empty until the call is completed, then fill with a highlight;
  - "maria" fields are empty inputs; a "Use suggested" link fills `maria_answers[field]`;
  - editing any pre-filled value shows "Edited by Maria · original kept in audit log";
  - care plan suggestions appear as accept-per-line chips;
  - **Sign and submit** is enabled only when every field is filled and no safety conflict is open.
- P2, P3 and P4 have no documentation template. Their Act screen ends with "Log contact & close" after
  the NBA and outreach steps, then opens the wrap-up.

### S4 Wrap-up modal
Lists `wrap_up` content:
- "Written once to: …"
- deadlines ticked
- tasks created (from accepted NBAs + `tasks_created`)
- booked visit
- data-correction tickets
- the queue change

Buttons: "Back to queue" (re-rank animation) and "Next member →" (opens the new #1).

---

## 3. Personas (what each one must demonstrate)

| Persona | Member | Must demonstrate | Path |
|---|---|---|---|
| P1 Harold Brennan | BW-10001 | safety conflict, med diff (new not filled / stopped still filling / old dose), 7-day deadline, caregiver call, verified PCP booking, full 40-field documentation, re-rank | **Full end-to-end** |
| P3 Marcus Reid | BW-10003 | contact merge from member services (D20), wrong-owner number, no-HIPAA sister, ghost provider location, cancel auto-closure | Contact path |
| P5 Esperanza Ruiz | BW-10005 | wrong language default, diagnosis conflict, metformin–eGFR safety flag, expired caregiver auth, stuck prior auth, 40-field reassessment | Documentation path |
| P2 Devon Mitchell | BW-10002 | pharmacy + lab freshness beating claims, PDC on 3× Star measures, unknown-prescriber drug, unit normalization; toggle "claims-only view" showing he would score 37.3 | 360 view |
| P4 Leah Carter | BW-10004 | address from ADT vs stale eligibility, duplicate discharge summary, SMS-first channel, bridge supply, consent-gated BH data | 360 view + SMS |

---

## 4. Rules (implement in `src/lib/rules.ts`)

### 4.1 Priority score
`score = round_half_up(0.35·R + 0.30·D + 0.25·S + 0.10·E, 1)`. Weights live in `meta.weights`.
Bands: Urgent ≥70, Today ≥50, This week ≥30, else Monitor.
The component points (`meta.deadline_points`, `signal_points`, `engagement_points`) are shown in the score tooltip.
R, D, S and E are stored per row in `queue.json`; recompute `score` and `band` from them at runtime, and
assert that the result matches the stored `score`.

### 4.2 Freshness badge
`freshness(source, timestamp)` returns fresh / aging / stale from `meta.freshness`, measured against the clock.
Phone numbers use `last_verified` and `status` (a failed number is always stale).

### 4.3 Confidence
- **High:** an authoritative source, or two or more sources agree.
- **Medium:** a single non-authoritative source.
- **Low:** sources conflict, or the value failed before.

The scripted `contacts[].confidence` values follow this rule.

### 4.4 Medication diff categories
Continued and filled · New and filled · New, not filled · Stopped, still filling · Dose changed, old dose
filled · Filled but not on any list · Prescribed, not filled · Safety: lab contraindication.

### 4.5 Next-best-action rules
These are listed in `scripted.json` (`rule` field). Show the rule text on each card, so the panel can see
that nothing is a black box.

---

## 5. Out of scope
- real LLM calls
- telephony and ambient recording
- authentication and roles
- supervisor view
- member-facing apps
- writing to real systems
- mobile layout
