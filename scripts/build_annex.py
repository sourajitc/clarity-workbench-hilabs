"""
Builds annex/Clarity_Data_Annex.xlsx from data/*.json.
Run after build_data.py:  python scripts/build_annex.py
"""
import json
from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.comments import Comment
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parent.parent
DS = json.load(open(ROOT / "data" / "datasets.json"))
Q = json.load(open(ROOT / "data" / "queue.json"))
IMPS = json.load(open(ROOT / "data" / "imperfections.json"))
META = json.load(open(ROOT / "data" / "meta.json"))
IMP_BY_ID = {i["imp_id"]: i for i in IMPS}

F = "Arial"
H_FILL = PatternFill("solid", fgColor="1F3A5F")
H_FONT = Font(name=F, bold=True, color="FFFFFF", size=10)
BODY = Font(name=F, size=10)
BOLD = Font(name=F, size=10, bold=True)
TITLE = Font(name=F, size=14, bold=True, color="1F3A5F")
ERR_FILL = PatternFill("solid", fgColor="F8D7DA")
INPUT_FONT = Font(name=F, size=10, color="0000FF")
YELLOW = PatternFill("solid", fgColor="FFF2CC")
THIN = Border(bottom=Side(style="thin", color="D9D9D9"))
WRAP = Alignment(wrap_text=True, vertical="top")

PERSONA = {"BW-10001": "P1", "BW-10002": "P2", "BW-10003": "P3", "BW-10004": "P4", "BW-10005": "P5"}

CATALOG = [
    ("D01", "Plan enrollment / CMS membership file", "Daily-monthly", "Who they are, plan, dual status, language, PCP -> routing and outreach language", "S2 identity strip"),
    ("D02", "Enrollment, HIE demographics, past calls, caregiver forms", "Varies; often years old", "Which number to dial and whose it is", "S3 outreach ranking"),
    ("D03", "Case management system call log", "Real time", "What already failed; best time to call", "S1 engagement gap; S3 best window"),
    ("D04", "Hospital HL7 ADT via HIE", "Minutes-hours", "Something just happened -> triage now", "S1 new signal; S2 timeline"),
    ("D05", "HIE (CCD/PDF) via MCheck Clinical extraction", "Hours-weeks, or never", "Why admitted; discharge meds; follow-up orders", "S2 brief; med diff"),
    ("D05b", "Derived from D05", "Same as D05", "Line-level discharge med actions (new/stop/change/continue)", "S2 med diff"),
    ("D06", "Claims adjudication", "30-90 day lag", "Utilization history, diagnoses, ED frequency", "S2 timeline (history)"),
    ("D07", "PBM point-of-sale adjudication", "Same day-daily", "Did they pick up the drug; adherence (PDC)", "S2 med diff; S1 signal"),
    ("D08", "PCP EHR via MCheck Clinical", "Weeks", "What the PCP thinks they take (3-way reconciliation)", "S2 med diff"),
    ("D09", "Labs / EHR (LOINC)", "Days", "Clinical trend (A1c, BNP, eGFR, K)", "S2 brief; timeline"),
    ("D10", "Partner-practice scheduling feeds", "Daily (partial)", "Is the 7-day visit booked? Missed visits?", "S2 deadlines; NBA"),
    ("D11", "HiLabs MCheck directory", "Continuous verification", "Right clinic phone to book follow-up", "S3 booking"),
    ("D12", "Utilization management system", "Daily", "Is DME / home health / drug approved or stuck?", "S2 timeline; NBA escalate"),
    ("D13", "Plan analytics (existing models)", "Monthly", "Baseline acuity -> queue weight R", "S1 score"),
    ("D14", "HRA, AHC-HRSN screener", "Months-years", "Housing, food, transport, phone access", "S2 SDOH card; NBA re-screen"),
    ("D15", "Case mgmt system, HIPAA authorization forms", "Ad hoc", "Who can speak for the member; strain", "S3 outreach; NBA support"),
    ("D16", "Existing case management system", "Real time", "Goals, barriers, tasks, due reassessments", "S2 care plan; S3 documentation"),
    ("D17", "Plan quality team", "Weekly-monthly", "Which HEDIS/Stars gaps this contact can close", "S2 deadline checklist"),
    ("D18", "Device vendor", "Daily", "Early decompensation (weight gain)", "S1 signal (Phase 2)"),
    ("D19", "BH carve-out vendor (consent-gated)", "Weeks", "BH engagement - only with consent", "S2 timeline (gated)"),
    ("D20", "Call center CRM", "Real time", "Member called in with new number / issue", "S3 contact update"),
]


def header(ws, row, cols, widths=None):
    for c, name in enumerate(cols, 1):
        cell = ws.cell(row=row, column=c, value=name)
        cell.font, cell.fill = H_FONT, H_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    ws.freeze_panes = ws.cell(row=row + 1, column=1)
    if widths:
        for i, w in enumerate(widths, 1):
            ws.column_dimensions[get_column_letter(i)].width = w


def body(cell, bold=False):
    cell.font = BOLD if bold else BODY
    cell.alignment = WRAP
    cell.border = THIN


wb = Workbook()

# ---------------------------------------------------------------- README
ws = wb.active
ws.title = "README"
ws.column_dimensions["A"].width = 30
ws.column_dimensions["B"].width = 110
rows = [
    ("Clarity Workbench - Synthetic Data Annex", None),
    ("", None),
    ("What this is", "Synthetic data for 5 patient personas across 21 dataset tabs, plus Maria's 48-member queue. Every value is fictional."),
    ("Frozen clock", META["clock_label"] + " - all deadlines, freshness badges and day counts are computed from this moment."),
    ("Plan", META["plan"]),
    ("User", META["user"]["name"] + " - " + META["user"]["role"]),
    ("Join key", "member_id (BW-1000x). Member IDs are unique; duplicates are planted at record level (repeat ADT messages, re-billed fills, amended documents)."),
    ("Red cells", "A pink cell holds a planted data-quality problem. Hover for the IMP id, then see Imperfection_Log for the truth and which Clarity feature catches it."),
    ("Blue numbers", "Queue tab: blue cells are scoring inputs (weights and component points) you can change; scores and bands recalculate."),
    ("Fake-data conventions", "Names invented; phones use reserved 555-01xx; NPIs start with 99; facilities fictional. ICD-10 and LOINC are real public codes. NDC values are illustrative NDC-format strings, not real products."),
    ("Tabs", "Patient_Index - one row per persona | Queue - 48 members with live score formula | Imperfection_Log - every planted error | Dataset_Catalog - what each dataset is for | D01-D20 - the data"),
    ("Scoring formula", "Priority = 0.35 x Risk (R) + 0.30 x Deadline pressure (D) + 0.25 x New signal (S) + 0.10 x Engagement gap (E). Bands: Urgent >= 70, Today 50-69, This week 30-49, Monitor < 30."),
    ("PDC", "Proportion of days covered, year-to-date from first fill to the frozen clock; reversed claims excluded; early refills carried forward (PQA method, simplified)."),
]
for r, (a, b) in enumerate(rows, 1):
    ws.cell(row=r, column=1, value=a).font = TITLE if r == 1 else BOLD
    if b:
        c = ws.cell(row=r, column=2, value=b)
        c.font, c.alignment = BODY, WRAP

# ---------------------------------------------------------------- Queue (formulas)
wq = wb.create_sheet("Queue")
wq["A1"] = "Maria's queue - Mon 9 Nov 2026 08:00"
wq["A1"].font = TITLE
wq["A2"], wq["B2"], wq["C2"], wq["D2"], wq["E2"] = "Weights", "R (risk)", "D (deadline)", "S (signal)", "E (engagement)"
for c in "ABCDE":
    wq[f"{c}2"].font = BOLD
wq["A3"] = "Value"
wq["A3"].font = BOLD
for c, k in zip("BCDE", "RDSE"):
    cell = wq[f"{c}3"]
    cell.value = META["weights"][k]
    cell.font, cell.fill, cell.number_format = INPUT_FONT, YELLOW, "0.00"
wq["F3"] = "=SUM(B3:E3)"
wq["F3"].font = BODY
wq["G3"] = "<- must equal 1.00"
wq["G3"].font = Font(name=F, size=9, italic=True)
cols = ["Rank (data)", "Member ID", "Persona", "Name", "Age", "Program", "Language", "R", "D", "S", "E",
        "Score", "Band", "Top reason 1", "Top reason 2", "Top reason 3", "Next deadline", "Best time", "New since Fri", "Due today"]
header(wq, 5, cols, [8, 11, 8, 20, 6, 14, 10, 6, 6, 6, 6, 8, 11, 44, 40, 34, 26, 26, 9, 9])
for i, q in enumerate(Q, 6):
    vals = [q["rank"], q["member_id"], PERSONA.get(q["member_id"], "filler"), q["name"], q["age"], q["program"], q["language"],
            q["R"], q["D"], q["S"], q["E"], None, None,
            *(q["reasons"] + ["", "", ""])[:3], q["next_deadline"], q["best_time"],
            "Y" if q["new_since_friday"] else "", "Y" if q["due_today"] else ""]
    for c, v in enumerate(vals, 1):
        cell = wq.cell(row=i, column=c, value=v)
        body(cell, bold=q["member_id"] in PERSONA)
        if 8 <= c <= 11:
            cell.font = Font(name=F, size=10, color="0000FF", bold=q["member_id"] in PERSONA)
    wq.cell(row=i, column=12, value=f"=ROUND($B$3*H{i}+$C$3*I{i}+$D$3*J{i}+$E$3*K{i},1)")
    wq.cell(row=i, column=13, value=f'=IF(L{i}>=70,"Urgent",IF(L{i}>=50,"Today",IF(L{i}>=30,"This week","Monitor")))')
    for c in (12, 13):
        body(wq.cell(row=i, column=c), bold=True)
last = 5 + len(Q)
wq.cell(row=last + 2, column=1, value="Counts").font = BOLD
for j, b in enumerate(["Urgent", "Today", "This week", "Monitor"]):
    wq.cell(row=last + 3 + j, column=1, value=b).font = BODY
    wq.cell(row=last + 3 + j, column=2, value=f'=COUNTIF($M$6:$M${last},"{b}")').font = BODY
wq.cell(row=last + 7, column=1, value="New since Fri").font = BODY
wq.cell(row=last + 7, column=2, value=f'=COUNTIF($S$6:$S${last},"Y")').font = BODY
wq.cell(row=last + 8, column=1, value="Due today").font = BODY
wq.cell(row=last + 8, column=2, value=f'=COUNTIF($T$6:$T${last},"Y")').font = BODY

# ---------------------------------------------------------------- Patient_Index
wp = wb.create_sheet("Patient_Index", 1)
LINES = {
    "P1": ("Fresh heart-failure discharge; medication chaos", "Med reconciliation diff, deadline ranking, safety flag",
           "Discharged Fri after HF. Entresto rejected for prior auth; stopped lisinopril auto-refilled Sat. Call daughter Karen now (home line dead), hold lisinopril, start PA, book PCP before Fri 13 Nov via verified number."),
    "P3": ("Unreachable frequent ED user about to be closed", "Contact intelligence, cross-system contact merge",
           "4th ED visit in 90 days on Sat; controller inhaler unfilled since Jul. Case auto-closes Thu, but member services has a new mobile from 2 Oct. Text/call after 18:00, cancel closure, refill controller, book PCP at verified new location, CHW for transport."),
    "P5": ("Dual-eligible senior with dementia; caregiver strain; reassessment due", "Write-once documentation, conflict cards, caregiver authorization",
           "Reassessment due Thu; 29/40 fields pre-filled. Metformin filled with eGFR 24; fall on 24 Oct not in claims; bed PA stuck 9 days; daughter's HIPAA auth expired. Renew auth, call in Spanish 19:00-20:00, flag PCP, escalate PA, offer respite."),
    "P4": ("Psychiatric discharge to a shelter; prefers text", "SDOH staleness, non-clinical NBA, channel choice",
           "Discharged Thu to a shelter (address only in ADT). FUH follow-up and aripiprazole bridge both end Thu. Text first, reach shelter case worker, book tele-psychiatry, 30-day fill near shelter, housing navigator, re-screen SDOH."),
    "P2": ("Rising-risk diabetic who quietly stopped refills", "Freshness (pharmacy + labs over claims), Stars gap linkage",
           f"No hospital event, claims look normal, but metformin PDC {META['pdc']['devon_metformin']['pct']:.0f}% and lisinopril {META['pdc']['devon_lisinopril']['pct']:.0f}%, A1c 7.4 -> 9.1%. Call 08:00-09:00, ask why (GI side effects, cost), ask about urgent-care glipizide, loop in PCP, 100-day supplies."),
}
wp["A1"] = "Patient index - the 5 personas"
wp["A1"].font = TITLE
cols = ["Persona", "Member ID", "Name", "Age", "Plan", "Story", "Feature stress-tested", "Datasets with records",
        "Planted problems", "Score (from Queue)", "Band", "8 am Monday - what Maria should see and do"]
header(wp, 3, cols, [8, 11, 18, 6, 9, 36, 34, 10, 10, 10, 10, 90])
members = {m["member_id"]: m for m in DS["D01"]["records"]}
order = ["BW-10001", "BW-10003", "BW-10005", "BW-10004", "BW-10002"]
for i, mid in enumerate(order, 4):
    p = PERSONA[mid]
    m = members[mid]
    n_ds = sum(1 for k, v in DS.items() if any(r.get("member_id") == mid for r in v["records"]) and k != "D05b")
    if mid in ("BW-10001",):
        pass
    n_imp = sum(1 for x in IMPS if x["patient"] == p)
    age = 2026 - int(m["dob"][:4]) - (1 if m["dob"][5:] > "11-09" else 0)
    vals = [p, mid, f'{m["first_name"]} {m["last_name"]}', age, m["plan_product"], LINES[p][0], LINES[p][1], n_ds, n_imp,
            f'=INDEX(Queue!$L:$L,MATCH("{mid}",Queue!$B:$B,0))', f'=INDEX(Queue!$M:$M,MATCH("{mid}",Queue!$B:$B,0))', LINES[p][2]]
    for c, v in enumerate(vals, 1):
        body(wp.cell(row=i, column=c, value=v), bold=(c <= 3))
    wp.row_dimensions[i].height = 64
wp.cell(row=10, column=1, value="Datasets with records counts D01-D20 tabs holding at least one row for that member (D05b counted with D05). Score and Band are live lookups into the Queue tab.").font = Font(name=F, size=9, italic=True)

# ---------------------------------------------------------------- Imperfection_Log
wi = wb.create_sheet("Imperfection_Log", 2)
wi["A1"] = "Imperfection log - every planted data-quality problem"
wi["A1"].font = TITLE
cols = ["IMP id", "Patient", "Dataset", "Record id", "Field", "Problem type", "What is wrong", "The truth", "Caught by (Clarity feature)"]
header(wi, 3, cols, [9, 8, 14, 20, 18, 30, 60, 44, 48])
for i, x in enumerate(sorted(IMPS, key=lambda r: (r["patient"], r["imp_id"])), 4):
    for c, k in enumerate(["imp_id", "patient", "dataset", "record_id", "field", "problem_type", "what_is_wrong", "truth", "caught_by"], 1):
        body(wi.cell(row=i, column=c, value=x[k]), bold=(c == 1))
end = 3 + len(IMPS)
wi.cell(row=end + 2, column=1, value="By patient").font = BOLD
for j, p in enumerate(["P1", "P2", "P3", "P4", "P5"]):
    wi.cell(row=end + 3 + j, column=1, value=p).font = BODY
    wi.cell(row=end + 3 + j, column=2, value=f'=COUNTIF($B$4:$B${end},"{p}")').font = BODY
wi.cell(row=end + 8, column=1, value="Total").font = BOLD
wi.cell(row=end + 8, column=2, value=f"=COUNTA($A$4:$A${end})").font = BOLD

# ---------------------------------------------------------------- Dataset_Catalog
wc = wb.create_sheet("Dataset_Catalog", 3)
wc["A1"] = "Dataset catalog - what each dataset is and what Maria does with it"
wc["A1"].font = TITLE
cols = ["ID", "Dataset", "Priority", "Source system", "Typical freshness", "Decision it enables", "Feeds screen", "Rows (live count)"]
header(wc, 3, cols, [7, 36, 9, 40, 20, 56, 30, 12])
for i, (did, src, fresh, dec, scr) in enumerate(CATALOG, 4):
    sheet = f"{did}"
    vals = [did, DS[did]["name"], DS[did]["priority"], src, fresh, dec, scr, f"=COUNTA('{sheet}'!A:A)-1"]
    for c, v in enumerate(vals, 1):
        body(wc.cell(row=i, column=c, value=v), bold=(c == 1))

# ---------------------------------------------------------------- dataset tabs
for did, spec in DS.items():
    recs = spec["records"]
    w = wb.create_sheet(did)
    cols = []
    for r in recs:
        for k in r:
            if k != "_flags" and k not in cols:
                cols.append(k)
    header(w, 1, cols)
    for i, r in enumerate(recs, 2):
        flags = r.get("_flags", {})
        for c, k in enumerate(cols, 1):
            v = r.get(k, "")
            cell = w.cell(row=i, column=c, value=v)
            body(cell)
            if k in flags:
                iid = flags[k]
                cell.fill = ERR_FILL
                info = IMP_BY_ID.get(iid, {})
                cell.comment = Comment(f"{iid}: {info.get('problem_type', '')}\n{info.get('what_is_wrong', '')}", "Clarity annex")
    for c, k in enumerate(cols, 1):
        longest = max([len(str(k))] + [len(str(r.get(k, ""))) for r in recs])
        w.column_dimensions[get_column_letter(c)].width = min(max(10, longest + 2), 60)
    w.sheet_properties.tabColor = {"Must": "1F3A5F", "Should": "4A90A4", "Later": "A0A0A0"}[spec["priority"]]

out = ROOT / "annex" / "Clarity_Data_Annex.xlsx"
wb.save(out)
print("saved", out, "sheets:", len(wb.sheetnames))
