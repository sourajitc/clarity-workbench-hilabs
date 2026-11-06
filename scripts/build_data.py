"""
Clarity Workbench - synthetic data generator (single source of truth).

Writes:
  data/datasets.json   - 20 datasets (D01-D20 + D05b) for the 5 personas
  data/queue.json      - Maria's 48-member caseload with score components
  data/imperfections.json - every planted data-quality problem
  data/meta.json       - fixed clock, weights, bands, freshness rules, feed health

All people, IDs, phone numbers and facilities are fictional.
Phone numbers use the reserved 555-01xx range. NPIs start with 99.
NDC values are illustrative NDC-format strings, not real product codes.
ICD-10 and LOINC codes are real public codes attached to fictional people.

Run:  python scripts/build_data.py
"""
import json, random, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data"
OUT.mkdir(exist_ok=True)

CLOCK = dt.datetime(2026, 11, 9, 8, 0)          # Mon 9 Nov 2026 08:00 ET (frozen)
TODAY = CLOCK.date()

WEIGHTS = {"R": 0.35, "D": 0.30, "S": 0.25, "E": 0.10}
BANDS = [("Urgent", 70), ("Today", 50), ("This week", 30), ("Monitor", 0)]


def d(s):
    return dt.date.fromisoformat(s)


def score(c):
    # half-up rounding to match Excel ROUND()
    from decimal import Decimal, ROUND_HALF_UP
    raw = sum(Decimal(str(WEIGHTS[k])) * Decimal(str(c[k])) for k in WEIGHTS)
    return float(raw.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))


def band(s):
    for name, lo in BANDS:
        if s >= lo:
            return name


def pdc(fills, start=None, end=TODAY):
    """Proportion of days covered from first fill of the year to `end`.
    fills = [(fill_date_str, days_supply)]; reversed claims must be excluded by caller."""
    fills = sorted((d(f), ds) for f, ds in fills)
    start = start or fills[0][0]
    covered = set()
    carry_from = None
    for fdate, ds in fills:
        s = max(fdate, carry_from) if carry_from else fdate   # early refills shift forward
        for i in range(ds):
            day = s + dt.timedelta(days=i)
            if start <= day <= end:
                covered.add(day)
        carry_from = s + dt.timedelta(days=ds)
    total = (end - start).days + 1
    return round(100 * len(covered) / total, 0), len(covered), total


# --------------------------------------------------------------------------
# Imperfection registry: every planted error gets an ID, referenced from records
# --------------------------------------------------------------------------
IMPS = []


def imp(iid, patient, dataset, record, field, ptype, what, truth, caught_by):
    IMPS.append(dict(imp_id=iid, patient=patient, dataset=dataset, record_id=record,
                     field=field, problem_type=ptype, what_is_wrong=what,
                     truth=truth, caught_by=caught_by))
    return iid


# --------------------------------------------------------------------------
# D01 Member & eligibility
# --------------------------------------------------------------------------
D01 = [
    dict(member_id="BW-10001", persona="P1", first_name="Harold", last_name="Brennan", dob="1948-03-14", sex="M",
         plan_product="MA-HMO", dual_status="Not dual", medicaid_id="", preferred_language="English",
         interpreter_needed="N", address="14 Elmwood Ct", city="Columbus", state="OH", zip="43214",
         pcp_npi="9900000142", program="TOC + DM-HF", enroll_start="2019-01-01", record_updated="2026-01-04"),
    dict(member_id="BW-10002", persona="P2", first_name="Devon", last_name="Mitchell", dob="1959-05-02", sex="M",
         plan_product="MA-HMO", dual_status="Not dual", medicaid_id="", preferred_language="English",
         interpreter_needed="N", address="3301 Maple Ridge Dr", city="Columbus", state="OH", zip="43224",
         pcp_npi="9900000145", program="DM-Diabetes", enroll_start="2024-06-01", record_updated="2026-06-01"),
    dict(member_id="BW-10003", persona="P3", first_name="Marcus", last_name="Reid", dob="1972-01-19", sex="M",
         plan_product="D-SNP", dual_status="Full dual (disability)", medicaid_id="MCD-77120458",
         preferred_language="English", interpreter_needed="N", address="902 E Livingston Ave, Rm 4",
         city="Columbus", state="OH", zip="43205", pcp_npi="9900000170", program="CCM",
         enroll_start="2022-03-01", record_updated="2025-11-20"),
    dict(member_id="BW-10004", persona="P4", first_name="Leah", last_name="Carter", dob="1992-07-08", sex="F",
         plan_product="D-SNP", dual_status="Full dual (disability)", medicaid_id="MCD-80233719",
         preferred_language="English", interpreter_needed="N", address="14 Linden Ave, Apt 3",
         city="Columbus", state="OH", zip="43211", pcp_npi="9900000160", program="CCM + BH coordination",
         enroll_start="2023-09-01", record_updated="2025-09-15",
         _flags={"address": "IMP-17"}),
    dict(member_id="BW-10005", persona="P5", first_name="Esperanza", last_name="Ruiz", dob="1944-06-11", sex="F",
         plan_product="D-SNP", dual_status="Full dual", medicaid_id="MCD-61092347",
         preferred_language="English", interpreter_needed="N", address="1770 Parsons Ave",
         city="Columbus", state="OH", zip="43207", pcp_npi="9900000178", program="CCM",
         enroll_start="2021-01-01", record_updated="2021-01-01",
         _flags={"preferred_language": "IMP-21", "interpreter_needed": "IMP-21"}),
]

# --------------------------------------------------------------------------
# D02 Contact points
# --------------------------------------------------------------------------
D02 = [
    # P1
    dict(contact_id="C-1001", member_id="BW-10001", value="614-555-0101", line_type="home", owner="member",
         owner_name="Harold Brennan", source="Enrollment file", last_verified="2019-06-03", consent_to_call="Y",
         sms_opt_in="N", status="failed", _flags={"status": "IMP-06", "last_verified": "IMP-06"}),
    dict(contact_id="C-1002", member_id="BW-10001", value="614-555-0133", line_type="mobile", owner="caregiver",
         owner_name="Karen Brennan (daughter)", source="HIE ADT next-of-kin + case notes", last_verified="2026-10-20",
         consent_to_call="Y", sms_opt_in="Y", status="active"),
    # P2
    dict(contact_id="C-2001", member_id="BW-10002", value="614-555-0111", line_type="mobile", owner="member",
         owner_name="Devon Mitchell", source="Outbound call", last_verified="2026-09-29", consent_to_call="Y",
         sms_opt_in="Y", status="active"),
    dict(contact_id="C-2002", member_id="BW-10002", value="614-555-0112", line_type="home", owner="member",
         owner_name="Devon Mitchell", source="Enrollment file", last_verified="2021-03-02", consent_to_call="Y",
         sms_opt_in="N", status="unknown"),
    # P3
    dict(contact_id="C-3001", member_id="BW-10003", value="614-555-0150", line_type="home", owner="member",
         owner_name="Marcus Reid", source="Enrollment file", last_verified="2023-02-11", consent_to_call="Y",
         sms_opt_in="N", status="unknown", _flags={"owner": "IMP-10", "owner_name": "IMP-10"}),
    dict(contact_id="C-3002", member_id="BW-10003", value="614-555-0158", line_type="mobile", owner="member",
         owner_name="Marcus Reid", source="Outbound call", last_verified="2026-07-22", consent_to_call="Y",
         sms_opt_in="Y", status="failed"),
    dict(contact_id="C-3004", member_id="BW-10003", value="614-555-0164", line_type="mobile", owner="other",
         owner_name="Denise Reid (sister)", source="ED registration next-of-kin (ADT NK1)", last_verified="2026-11-07",
         consent_to_call="N", sms_opt_in="N", status="active"),
    # P4
    dict(contact_id="C-4001", member_id="BW-10004", value="614-555-0122", line_type="mobile (prepaid)", owner="member",
         owner_name="Leah Carter", source="Outbound SMS reply", last_verified="2026-10-28", consent_to_call="Y",
         sms_opt_in="Y", status="active"),
    dict(contact_id="C-4002", member_id="BW-10004", value="614-555-0125", line_type="work", owner="other",
         owner_name="Harbor Light Shelter - case worker desk", source="Discharge summary social work note",
         last_verified="2026-11-05", consent_to_call="Y", sms_opt_in="N", status="unknown"),
    # P5
    dict(contact_id="C-5001", member_id="BW-10005", value="614-555-0190", line_type="home", owner="member",
         owner_name="Esperanza Ruiz", source="Enrollment file", last_verified="2026-10-15", consent_to_call="Y",
         sms_opt_in="N", status="active"),
    dict(contact_id="C-5002", member_id="BW-10005", value="614-555-0191", line_type="mobile", owner="caregiver",
         owner_name="Lucia Ruiz (daughter)", source="Caregiver form", last_verified="2026-10-15", consent_to_call="Y",
         sms_opt_in="Y", status="active"),
]

# --------------------------------------------------------------------------
# D03 Outreach & contact history
# --------------------------------------------------------------------------
D03 = [
    # P1
    dict(attempt_id="OA-1001", member_id="BW-10001", contact_id="C-1001", datetime="2026-08-18 10:05", channel="phone",
         outcome="connected", duration_min=14, language_used="English", staff_id="RN-MARIA", note="Monthly HF check-in"),
    dict(attempt_id="OA-1002", member_id="BW-10001", contact_id="C-1002", datetime="2026-09-14 12:20", channel="phone",
         outcome="connected", duration_min=16, language_used="English", staff_id="RN-MARIA", note="Spoke with Karen re: weights"),
    dict(attempt_id="OA-1003", member_id="BW-10001", contact_id="C-1002", datetime="2026-10-20 12:35", channel="phone",
         outcome="connected", duration_min=18, language_used="English", staff_id="RN-MARIA", note="Pre-admission check-in; mild ankle swelling reported"),
    dict(attempt_id="OA-1004", member_id="BW-10001", contact_id="C-1001", datetime="2026-11-07 11:02", channel="phone",
         outcome="disconnected", duration_min=0, language_used="", staff_id="RN-WKND", note="Weekend TOC attempt",
         _flags={"outcome": "IMP-06"}),
    dict(attempt_id="OA-1005", member_id="BW-10001", contact_id="C-1001", datetime="2026-11-07 15:30", channel="phone",
         outcome="disconnected", duration_min=0, language_used="", staff_id="RN-WKND", note="Weekend TOC attempt",
         _flags={"outcome": "IMP-06"}),
    # P2
    dict(attempt_id="OA-2001", member_id="BW-10002", contact_id="C-2001", datetime="2026-08-25 08:40", channel="phone",
         outcome="connected", duration_min=11, language_used="English", staff_id="RN-MARIA", note="DM check-in"),
    dict(attempt_id="OA-2002", member_id="BW-10002", contact_id="C-2001", datetime="2026-09-29 08:20", channel="phone",
         outcome="connected", duration_min=12, language_used="English", staff_id="RN-MARIA", note="Mentioned stomach upset on metformin"),
    dict(attempt_id="OA-2003", member_id="BW-10002", contact_id="C-2001", datetime="2026-10-27 14:00", channel="phone",
         outcome="voicemail", duration_min=1, language_used="", staff_id="RN-MARIA", note=""),
    dict(attempt_id="OA-2004", member_id="BW-10002", contact_id="C-2002", datetime="2026-11-03 15:10", channel="phone",
         outcome="no answer", duration_min=0, language_used="", staff_id="RN-MARIA", note=""),
    # P3
    dict(attempt_id="OA-3001", member_id="BW-10003", contact_id="C-3002", datetime="2026-07-22 18:40", channel="phone",
         outcome="connected", duration_min=9, language_used="English", staff_id="RN-MARIA", note="Last successful contact"),
    dict(attempt_id="OA-3002", member_id="BW-10003", contact_id="C-3001", datetime="2026-10-16 10:10", channel="phone",
         outcome="wrong person", duration_min=1, language_used="English", staff_id="RN-MARIA",
         note="Man answered, said Marcus moved out", _flags={"outcome": "IMP-10"}),
    dict(attempt_id="OA-3003", member_id="BW-10003", contact_id="C-3002", datetime="2026-10-22 11:15", channel="phone",
         outcome="disconnected", duration_min=0, language_used="", staff_id="RN-MARIA", note=""),
    dict(attempt_id="OA-3004", member_id="BW-10003", contact_id="C-3001", datetime="2026-10-27 10:30", channel="phone",
         outcome="wrong person", duration_min=1, language_used="English", staff_id="RN-MARIA", note="Same man; hung up",
         _flags={"outcome": "IMP-10"}),
    dict(attempt_id="OA-3005", member_id="BW-10003", contact_id="C-3002", datetime="2026-10-30 11:20", channel="phone",
         outcome="disconnected", duration_min=0, language_used="", staff_id="RN-MARIA", note=""),
    dict(attempt_id="OA-3006", member_id="BW-10003", contact_id="C-3001", datetime="2026-11-05 10:45", channel="phone",
         outcome="wrong person", duration_min=1, language_used="English", staff_id="RN-MARIA",
         note="3rd attempt; UTR letter queued", _flags={"outcome": "IMP-10"}),
    dict(attempt_id="OA-3007", member_id="BW-10003", contact_id="", datetime="2026-11-05 16:00", channel="letter",
         outcome="sent", duration_min=0, language_used="English", staff_id="SYSTEM",
         note="Unable-to-reach letter; case auto-closes 12 Nov"),
    # P4
    dict(attempt_id="OA-4001", member_id="BW-10004", contact_id="C-4001", datetime="2026-10-14 18:20", channel="SMS",
         outcome="replied", duration_min=0, language_used="English", staff_id="SW-JAMAL", note="Confirmed therapy appt by text"),
    dict(attempt_id="OA-4002", member_id="BW-10004", contact_id="C-4001", datetime="2026-10-28 19:05", channel="SMS",
         outcome="replied", duration_min=0, language_used="English", staff_id="RN-MARIA",
         note="Replied: 'please text, don't call'"),
    dict(attempt_id="OA-4003", member_id="BW-10004", contact_id="C-4001", datetime="2026-11-06 11:00", channel="phone",
         outcome="no answer", duration_min=0, language_used="", staff_id="RN-TOC", note="TOC call after discharge"),
    dict(attempt_id="OA-4004", member_id="BW-10004", contact_id="C-4001", datetime="2026-11-06 15:00", channel="phone",
         outcome="no answer", duration_min=0, language_used="", staff_id="RN-TOC", note="TOC call after discharge"),
    # P5
    dict(attempt_id="OA-5001", member_id="BW-10005", contact_id="C-5002", datetime="2026-09-10 19:40", channel="phone",
         outcome="connected", duration_min=28, language_used="Spanish (interpreter)", staff_id="RN-MARIA",
         note="Spoke with Lucia", _flags={"language_used": "IMP-21"}),
    dict(attempt_id="OA-5002", member_id="BW-10005", contact_id="C-5002", datetime="2026-10-15 19:20", channel="phone",
         outcome="connected", duration_min=34, language_used="Spanish (interpreter)", staff_id="RN-MARIA",
         note="Lucia exhausted; Zarit-4 = 12", _flags={"language_used": "IMP-21"}),
    dict(attempt_id="OA-5003", member_id="BW-10005", contact_id="C-5001", datetime="2026-11-02 11:00", channel="phone",
         outcome="no answer", duration_min=0, language_used="", staff_id="RN-MARIA", note="Called in English, daytime"),
]

# --------------------------------------------------------------------------
# D04 ADT alerts
# --------------------------------------------------------------------------
D04 = [
    dict(adt_id="ADT-1001", member_id="BW-10001", facility="St. Brigid Medical Center", event="A01 Admit",
         event_datetime="2026-11-03 21:05", received_datetime="2026-11-03 21:07", patient_class="Inpatient",
         dx_text="", attending="Dr. R. Okonjo (Cardiology)", discharge_disposition="", _flags={"dx_text": "IMP-04"}),
    dict(adt_id="ADT-1002", member_id="BW-10001", facility="St. Brigid Medical Center", event="A03 Discharge",
         event_datetime="2026-11-06 14:10", received_datetime="2026-11-07 09:15", patient_class="Inpatient",
         dx_text="CHF exacerbation", attending="Dr. R. Okonjo (Cardiology)", discharge_disposition="Home, self-care",
         _flags={"received_datetime": "IMP-05"}),
    dict(adt_id="ADT-1003", member_id="BW-10001", facility="St. Brigid Medical Center", event="A03 Discharge",
         event_datetime="2026-11-06 14:10", received_datetime="2026-11-07 09:16", patient_class="Inpatient",
         dx_text="CHF exacerbation", attending="Dr. R. Okonjo (Cardiology)", discharge_disposition="Home, self-care",
         _flags={"adt_id": "IMP-07"}),
    dict(adt_id="ADT-3001", member_id="BW-10003", facility="Eastside General Hospital", event="A04 ED registration",
         event_datetime="2026-10-19 21:55", received_datetime="2026-10-19 21:58", patient_class="Emergency",
         dx_text="Shortness of breath", attending="ED physician", discharge_disposition=""),
    dict(adt_id="ADT-3002", member_id="BW-10003", facility="Eastside General Hospital", event="A03 ED discharge",
         event_datetime="2026-10-20 02:30", received_datetime="2026-10-20 02:31", patient_class="Emergency",
         dx_text="Asthma exacerbation", attending="ED physician", discharge_disposition="Home"),
    dict(adt_id="ADT-3003", member_id="BW-10003", facility="Eastside General Hospital", event="A04 ED registration",
         event_datetime="2026-11-07 22:40", received_datetime="2026-11-07 22:44", patient_class="Emergency",
         dx_text="", attending="ED physician", discharge_disposition="", _flags={"dx_text": "IMP-12"}),
    dict(adt_id="ADT-3004", member_id="BW-10003", facility="Eastside General Hospital", event="A03 ED discharge",
         event_datetime="2026-11-08 03:10", received_datetime="2026-11-08 03:12", patient_class="Emergency",
         dx_text="", attending="ED physician", discharge_disposition="",
         _flags={"dx_text": "IMP-12", "discharge_disposition": "IMP-12"}),
    dict(adt_id="ADT-4001", member_id="BW-10004", facility="Riverside Behavioral Health", event="A01 Admit",
         event_datetime="2026-10-30 16:20", received_datetime="2026-10-30 16:25", patient_class="Inpatient psych",
         dx_text="", attending="Dr. P. Anand (Psychiatry)", discharge_disposition=""),
    dict(adt_id="ADT-4002", member_id="BW-10004", facility="Riverside Behavioral Health", event="A03 Discharge",
         event_datetime="2026-11-05 11:00", received_datetime="2026-11-05 11:04", patient_class="Inpatient psych",
         dx_text="Bipolar disorder", attending="Dr. P. Anand (Psychiatry)",
         discharge_disposition="Shelter - Harbor Light Shelter, 220 Pier St, Columbus OH 43215"),
    dict(adt_id="ADT-5001", member_id="BW-10005", facility="Mercy West Hospital", event="A04 ED registration",
         event_datetime="2026-10-24 10:15", received_datetime="2026-10-24 10:20", patient_class="Emergency",
         dx_text="Fall at home", attending="ED physician", discharge_disposition=""),
    dict(adt_id="ADT-5002", member_id="BW-10005", facility="Mercy West Hospital", event="A03 ED discharge",
         event_datetime="2026-10-24 16:40", received_datetime="2026-10-24 16:44", patient_class="Emergency",
         dx_text="Knee contusion", attending="ED physician", discharge_disposition="Home with family"),
]

# --------------------------------------------------------------------------
# D05 HIE clinical documents + D05b discharge medication lines
# --------------------------------------------------------------------------
D05 = [
    dict(doc_id="DOC-1001", member_id="BW-10001", facility="St. Brigid Medical Center", doc_type="Discharge summary",
         admit_date="2026-11-03", discharge_date="2026-11-06",
         primary_dx="I50.23 Acute on chronic systolic (congestive) heart failure",
         secondary_dx="E11.22 Type 2 diabetes with diabetic CKD; N18.31 CKD stage 3a",
         follow_up_instructions="PCP within 7 days; Cardiology 20 Nov; daily weights, call if +1 kg/day or +2 kg/week; BMP in 1 week; 2 g sodium diet",
         received_datetime="2026-11-07 11:40", format="PDF (extracted by MCheck Clinical)"),
    dict(doc_id="DOC-3001", member_id="BW-10003", facility="Eastside General Hospital", doc_type="ED visit note",
         admit_date="2026-10-19", discharge_date="2026-10-20",
         primary_dx="J45.901 Unspecified asthma with (acute) exacerbation", secondary_dx="E11.9 Type 2 diabetes",
         follow_up_instructions="Resume controller inhaler; PCP within 1 week", received_datetime="2026-10-21 08:10",
         format="CCD"),
    dict(doc_id="DOC-4001", member_id="BW-10004", facility="Riverside Behavioral Health", doc_type="Discharge summary",
         admit_date="2026-10-30", discharge_date="2026-11-05",
         primary_dx="F31.2 Bipolar disorder, current episode manic, severe, with psychotic features",
         secondary_dx="I10 Essential hypertension; Z59.01 Sheltered homelessness",
         follow_up_instructions="Outpatient psychiatry within 7 days; 7-day bridge supply given; social work: housing referral",
         received_datetime="2026-11-05 16:00", format="CCD"),
    dict(doc_id="DOC-4002", member_id="BW-10004", facility="Riverside Behavioral Health", doc_type="Discharge summary (amended)",
         admit_date="2026-10-30", discharge_date="2026-11-06",
         primary_dx="F31.2 Bipolar disorder, current episode manic, severe, with psychotic features",
         secondary_dx="I10 Essential hypertension; Z59.01 Sheltered homelessness",
         follow_up_instructions="Outpatient psychiatry within 7 days; 7-day bridge supply given; social work: housing referral",
         received_datetime="2026-11-06 09:30", format="CCD", _flags={"discharge_date": "IMP-18", "doc_id": "IMP-18"}),
    dict(doc_id="DOC-5001", member_id="BW-10005", facility="Mercy West Hospital", doc_type="ED visit note",
         admit_date="2026-10-24", discharge_date="2026-10-24",
         primary_dx="W19.XXXA Unspecified fall, initial encounter; S80.01XA Contusion of right knee",
         secondary_dx="G30.1 Alzheimer's disease with late onset; E11.22; N18.4 CKD stage 4",
         follow_up_instructions="PCP in 1-2 weeks; home PT evaluation; hospital bed recommended for safe transfers",
         received_datetime="2026-10-25 07:30", format="CCD"),
]
D05b = [
    dict(doc_id="DOC-1001", member_id="BW-10001", drug="Sacubitril/valsartan (Entresto)", dose="24/26 mg", frequency="BID",
         action="NEW", note="Start 36 h after last lisinopril dose"),
    dict(doc_id="DOC-1001", member_id="BW-10001", drug="Lisinopril", dose="20 mg", frequency="daily", action="STOP",
         note="Replaced by sacubitril/valsartan"),
    dict(doc_id="DOC-1001", member_id="BW-10001", drug="Furosemide", dose="40 mg", frequency="BID", action="CHANGE",
         note="Was 40 mg daily"),
    dict(doc_id="DOC-1001", member_id="BW-10001", drug="Metoprolol succinate", dose="50 mg", frequency="daily",
         action="CONTINUE", note=""),
    dict(doc_id="DOC-1001", member_id="BW-10001", drug="Metformin", dose="500 mg", frequency="BID", action="CONTINUE", note=""),
    dict(doc_id="DOC-1001", member_id="BW-10001", drug="Atorvastatin", dose="40 mg", frequency="nightly", action="CONTINUE", note=""),
    dict(doc_id="DOC-4001", member_id="BW-10004", drug="Aripiprazole", dose="10 mg", frequency="daily", action="NEW",
         note="7-day bridge supply dispensed at discharge"),
    dict(doc_id="DOC-4001", member_id="BW-10004", drug="Amlodipine", dose="5 mg", frequency="daily", action="CONTINUE", note=""),
]

# --------------------------------------------------------------------------
# D06 Medical claims
# --------------------------------------------------------------------------
D06 = [
    dict(claim_id="CL-1001", member_id="BW-10001", service_date="2026-08-11", paid_date="2026-08-30", claim_type="OP lab",
         provider_npi="9900000142", place_of_service="11 Office", icd10_codes="E11.22; N18.31", cpt_codes="80048; 83036",
         paid_amount=48.20, status="paid"),
    dict(claim_id="CL-1002", member_id="BW-10001", service_date="2026-09-22", paid_date="2026-10-05", claim_type="Professional",
         provider_npi="9900000142", place_of_service="11 Office", icd10_codes="I50.22; E11.22", cpt_codes="99214",
         paid_amount=132.50, status="paid", _flags={"service_date": "IMP-08"}),
    dict(claim_id="CL-2001", member_id="BW-10002", service_date="2026-03-12", paid_date="2026-03-28", claim_type="OP lab",
         provider_npi="9900000145", place_of_service="81 Lab", icd10_codes="E11.9", cpt_codes="83036",
         paid_amount=18.40, status="paid"),
    dict(claim_id="CL-2002", member_id="BW-10002", service_date="2026-04-03", paid_date="2026-04-19", claim_type="Professional",
         provider_npi="9900000145", place_of_service="11 Office", icd10_codes="E11.9; I10", cpt_codes="99213",
         paid_amount=96.10, status="paid", _flags={"service_date": "IMP-24"}),
    dict(claim_id="CL-3001", member_id="BW-10003", service_date="2026-04-02", paid_date="2026-04-20", claim_type="Professional",
         provider_npi="9900000170", place_of_service="11 Office", icd10_codes="J44.9; E11.9", cpt_codes="99213",
         paid_amount=96.10, status="paid"),
    dict(claim_id="CL-3002", member_id="BW-10003", service_date="2026-08-22", paid_date="2026-09-14", claim_type="ED",
         provider_npi="9900000301", place_of_service="23 ED", icd10_codes="J44.1", cpt_codes="99284",
         paid_amount=1180.00, status="paid", _flags={"icd10_codes": "IMP-13"}),
    dict(claim_id="CL-3003", member_id="BW-10003", service_date="2026-09-30", paid_date="2026-10-24", claim_type="ED",
         provider_npi="9900000301", place_of_service="23 ED", icd10_codes="J45.901", cpt_codes="99284",
         paid_amount=1180.00, status="paid", _flags={"icd10_codes": "IMP-13"}),
    dict(claim_id="CL-4001", member_id="BW-10004", service_date="2026-06-10", paid_date="2026-06-27", claim_type="Professional",
         provider_npi="9900000160", place_of_service="11 Office", icd10_codes="I10", cpt_codes="99213",
         paid_amount=96.10, status="paid"),
    dict(claim_id="CL-4002", member_id="BW-10004", service_date="2026-07-14", paid_date="2026-08-02", claim_type="Professional",
         provider_npi="9900000176", place_of_service="11 Office", icd10_codes="F31.9", cpt_codes="90837",
         paid_amount=145.00, status="paid", _flags={"icd10_codes": "IMP-19"}),
    dict(claim_id="CL-5001", member_id="BW-10005", service_date="2026-09-02", paid_date="2026-09-19", claim_type="Professional",
         provider_npi="9900000178", place_of_service="11 Office", icd10_codes="E11.9; M17.0", cpt_codes="99214",
         paid_amount=132.50, status="paid", _flags={"icd10_codes": "IMP-23", "service_date": "IMP-22"}),
]

# --------------------------------------------------------------------------
# D07 Pharmacy fills  (pdc computed below)
# --------------------------------------------------------------------------
D07 = [
    # P1
    dict(fill_id="RX-1001", member_id="BW-10001", ndc="11111-0201-30", drug_name="Lisinopril 20 mg tab", ingredient="lisinopril",
         strength="20 mg", qty=30, days_supply=30, fill_date="2026-10-08", pharmacy="CareFirst Pharmacy #114",
         prescriber_npi="9900000142", auto_refill="Y", claim_status="paid"),
    dict(fill_id="RX-1002", member_id="BW-10001", ndc="11111-0201-30", drug_name="Lisinopril 20 mg tab", ingredient="lisinopril",
         strength="20 mg", qty=30, days_supply=30, fill_date="2026-11-07", pharmacy="CareFirst Pharmacy #114",
         prescriber_npi="9900000142", auto_refill="Y", claim_status="paid", _flags={"fill_date": "IMP-02", "auto_refill": "IMP-02"}),
    dict(fill_id="RX-1003", member_id="BW-10001", ndc="22222-0124-60", drug_name="Sacubitril/valsartan 24/26 mg tab",
         ingredient="sacubitril/valsartan", strength="24/26 mg", qty=60, days_supply=30, fill_date="2026-11-06",
         pharmacy="CareFirst Pharmacy #114", prescriber_npi="9900000190", auto_refill="N",
         claim_status="rejected - 75 prior authorization required", _flags={"claim_status": "IMP-01"}),
    dict(fill_id="RX-1004", member_id="BW-10001", ndc="33333-0040-30", drug_name="Furosemide 40 mg tab", ingredient="furosemide",
         strength="40 mg", qty=30, days_supply=30, fill_date="2026-10-20", pharmacy="CareFirst Pharmacy #114",
         prescriber_npi="9900000142", auto_refill="Y", claim_status="paid", _flags={"qty": "IMP-03"}),
    dict(fill_id="RX-1005", member_id="BW-10001", ndc="44444-0050-30", drug_name="Metoprolol succinate ER 50 mg", ingredient="metoprolol",
         strength="50 mg", qty=30, days_supply=30, fill_date="2026-10-20", pharmacy="CareFirst Pharmacy #114",
         prescriber_npi="9900000142", auto_refill="Y", claim_status="paid"),
    dict(fill_id="RX-1006", member_id="BW-10001", ndc="55555-0500-60", drug_name="Metformin 500 mg tab", ingredient="metformin",
         strength="500 mg", qty=180, days_supply=90, fill_date="2026-10-15", pharmacy="CareFirst Pharmacy #114",
         prescriber_npi="9900000142", auto_refill="Y", claim_status="paid"),
    dict(fill_id="RX-1007", member_id="BW-10001", ndc="66666-0040-90", drug_name="Atorvastatin 40 mg tab", ingredient="atorvastatin",
         strength="40 mg", qty=90, days_supply=90, fill_date="2026-10-15", pharmacy="CareFirst Pharmacy #114",
         prescriber_npi="9900000142", auto_refill="Y", claim_status="paid"),
    # P2
    dict(fill_id="RX-2001", member_id="BW-10002", ndc="55555-1000-60", drug_name="Metformin 1000 mg tab", ingredient="metformin",
         strength="1000 mg", qty=180, days_supply=90, fill_date="2026-01-05", pharmacy="Main St Pharmacy",
         prescriber_npi="9900000145", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-2002", member_id="BW-10002", ndc="55555-1000-60", drug_name="Metformin 1000 mg tab", ingredient="metformin",
         strength="1000 mg", qty=60, days_supply=30, fill_date="2026-04-28", pharmacy="Main St Pharmacy",
         prescriber_npi="9900000145", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-2003", member_id="BW-10002", ndc="55555-1000-60", drug_name="Metformin 1000 mg tab", ingredient="metformin",
         strength="1000 mg", qty=180, days_supply=90, fill_date="2026-07-28", pharmacy="Main St Pharmacy",
         prescriber_npi="9900000145", auto_refill="N", claim_status="reversed", _flags={"claim_status": "IMP-25"}),
    dict(fill_id="RX-2004", member_id="BW-10002", ndc="55555-1000-60", drug_name="Metformin 1000 mg tab", ingredient="metformin",
         strength="1000 mg", qty=180, days_supply=90, fill_date="2026-07-28", pharmacy="Main St Pharmacy",
         prescriber_npi="9900000145", auto_refill="N", claim_status="paid", _flags={"fill_id": "IMP-25"}),
    dict(fill_id="RX-2005", member_id="BW-10002", ndc="77777-0010-90", drug_name="Lisinopril 10 mg tab", ingredient="lisinopril",
         strength="10 mg", qty=90, days_supply=90, fill_date="2026-01-12", pharmacy="Main St Pharmacy",
         prescriber_npi="9900000145", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-2006", member_id="BW-10002", ndc="77777-0010-90", drug_name="Lisinopril 10 mg tab", ingredient="lisinopril",
         strength="10 mg", qty=90, days_supply=90, fill_date="2026-07-30", pharmacy="Main St Pharmacy",
         prescriber_npi="9900000145", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-2007", member_id="BW-10002", ndc="88888-0005-30", drug_name="Glipizide 5 mg tab", ingredient="glipizide",
         strength="5 mg", qty=30, days_supply=30, fill_date="2026-09-01", pharmacy="Main St Pharmacy",
         prescriber_npi="9900000310", auto_refill="N", claim_status="paid", _flags={"prescriber_npi": "IMP-26"}),
    # P3
    dict(fill_id="RX-3001", member_id="BW-10003", ndc="12121-0090-01", drug_name="Albuterol HFA inhaler", ingredient="albuterol",
         strength="90 mcg/act", qty=1, days_supply=25, fill_date="2026-08-23", pharmacy="Eastside Discount Rx",
         prescriber_npi="9900000301", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-3002", member_id="BW-10003", ndc="12121-0090-01", drug_name="Albuterol HFA inhaler", ingredient="albuterol",
         strength="90 mcg/act", qty=1, days_supply=25, fill_date="2026-09-30", pharmacy="Eastside Discount Rx",
         prescriber_npi="9900000301", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-3003", member_id="BW-10003", ndc="12121-0090-01", drug_name="Albuterol HFA inhaler", ingredient="albuterol",
         strength="90 mcg/act", qty=1, days_supply=25, fill_date="2026-10-20", pharmacy="Eastside Discount Rx",
         prescriber_npi="9900000301", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-3004", member_id="BW-10003", ndc="12121-0090-01", drug_name="Albuterol HFA inhaler", ingredient="albuterol",
         strength="90 mcg/act", qty=1, days_supply=25, fill_date="2026-11-08", pharmacy="Eastside Discount Rx",
         prescriber_npi="9900000301", auto_refill="N", claim_status="paid"),
    dict(fill_id="RX-3005", member_id="BW-10003", ndc="13131-0250-01", drug_name="Fluticasone/salmeterol 250/50 inhaler",
         ingredient="fluticasone/salmeterol", strength="250/50 mcg", qty=1, days_supply=30, fill_date="2026-07-11",
         pharmacy="Eastside Discount Rx", prescriber_npi="9900000170", auto_refill="N", claim_status="paid",
         _flags={"fill_date": "IMP-11"}),
    dict(fill_id="RX-3006", member_id="BW-10003", ndc="55555-0500-60", drug_name="Metformin 500 mg tab", ingredient="metformin",
         strength="500 mg", qty=60, days_supply=30, fill_date="2026-10-14", pharmacy="Eastside Discount Rx",
         prescriber_npi="9900000170", auto_refill="N", claim_status="paid"),
    # P4
    dict(fill_id="RX-4001", member_id="BW-10004", ndc="14141-0010-07", drug_name="Aripiprazole 10 mg tab", ingredient="aripiprazole",
         strength="10 mg", qty=7, days_supply=7, fill_date="2026-11-05", pharmacy="Riverside BH Outpatient Pharmacy",
         prescriber_npi="9900000195", auto_refill="N", claim_status="paid", _flags={"days_supply": "IMP-20"}),
    dict(fill_id="RX-4002", member_id="BW-10004", ndc="15151-0005-30", drug_name="Amlodipine 5 mg tab", ingredient="amlodipine",
         strength="5 mg", qty=30, days_supply=30, fill_date="2026-08-06", pharmacy="Linden Ave Pharmacy",
         prescriber_npi="9900000160", auto_refill="N", claim_status="paid", _flags={"fill_date": "IMP-20"}),
    # P5
    dict(fill_id="RX-5001", member_id="BW-10005", ndc="55555-0500-60", drug_name="Metformin 500 mg tab", ingredient="metformin",
         strength="500 mg", qty=60, days_supply=30, fill_date="2026-10-28", pharmacy="Parsons Ave Pharmacy",
         prescriber_npi="9900000178", auto_refill="Y", claim_status="paid", _flags={"fill_date": "IMP-24b"}),
    dict(fill_id="RX-5002", member_id="BW-10005", ndc="16161-0010-30", drug_name="Donepezil 10 mg tab", ingredient="donepezil",
         strength="10 mg", qty=30, days_supply=30, fill_date="2026-10-28", pharmacy="Parsons Ave Pharmacy",
         prescriber_npi="9900000178", auto_refill="Y", claim_status="paid"),
    dict(fill_id="RX-5003", member_id="BW-10005", ndc="17171-0005-30", drug_name="Amlodipine 5 mg tab", ingredient="amlodipine",
         strength="5 mg", qty=30, days_supply=30, fill_date="2026-10-28", pharmacy="Parsons Ave Pharmacy",
         prescriber_npi="9900000178", auto_refill="Y", claim_status="paid"),
]

# compute PDC (year-to-date, from first fill) for Star-measure classes where it matters
def _pdc_for(member, ingredient):
    fills = [(r["fill_date"], r["days_supply"]) for r in D07
             if r["member_id"] == member and r["ingredient"] == ingredient and r["claim_status"] == "paid"]
    return pdc(fills)

PDC = {
    ("BW-10002", "metformin"): _pdc_for("BW-10002", "metformin"),
    ("BW-10002", "lisinopril"): _pdc_for("BW-10002", "lisinopril"),
}
for r in D07:
    key = (r["member_id"], r["ingredient"])
    r["pdc_ytd_pct"] = PDC[key][0] if key in PDC else ""

# --------------------------------------------------------------------------
# D08 EHR medication & problem list
# --------------------------------------------------------------------------
D08 = [
    dict(ehr_item_id="EHR-1001", member_id="BW-10001", item_type="med", name="Lisinopril", dose="20 mg daily", status="active",
         last_reconciled_date="2026-08-12", source_practice="Velasco Family Medicine", _flags={"status": "IMP-02"}),
    dict(ehr_item_id="EHR-1002", member_id="BW-10001", item_type="med", name="Furosemide", dose="40 mg daily", status="active",
         last_reconciled_date="2026-08-12", source_practice="Velasco Family Medicine", _flags={"dose": "IMP-03"}),
    dict(ehr_item_id="EHR-1003", member_id="BW-10001", item_type="med", name="Metoprolol succinate", dose="50 mg daily", status="active",
         last_reconciled_date="2026-08-12", source_practice="Velasco Family Medicine"),
    dict(ehr_item_id="EHR-1004", member_id="BW-10001", item_type="med", name="Metformin", dose="500 mg BID", status="active",
         last_reconciled_date="2026-08-12", source_practice="Velasco Family Medicine"),
    dict(ehr_item_id="EHR-1005", member_id="BW-10001", item_type="problem", name="I50.22 Chronic systolic heart failure", dose="",
         status="active", last_reconciled_date="2026-08-12", source_practice="Velasco Family Medicine"),
    dict(ehr_item_id="EHR-2001", member_id="BW-10002", item_type="med", name="Metformin", dose="1000 mg BID", status="active",
         last_reconciled_date="2026-04-03", source_practice="Liu Internal Medicine"),
    dict(ehr_item_id="EHR-2002", member_id="BW-10002", item_type="med", name="Lisinopril", dose="10 mg daily", status="active",
         last_reconciled_date="2026-04-03", source_practice="Liu Internal Medicine"),
    dict(ehr_item_id="EHR-2003", member_id="BW-10002", item_type="problem", name="E11.9 Type 2 diabetes without complications",
         dose="", status="active", last_reconciled_date="2026-04-03", source_practice="Liu Internal Medicine"),
    dict(ehr_item_id="EHR-3001", member_id="BW-10003", item_type="med", name="Fluticasone/salmeterol 250/50", dose="1 puff BID",
         status="active", last_reconciled_date="2026-04-02", source_practice="Northgate Family Health"),
    dict(ehr_item_id="EHR-3002", member_id="BW-10003", item_type="problem", name="J44.9 COPD, unspecified", dose="", status="active",
         last_reconciled_date="2026-04-02", source_practice="Northgate Family Health", _flags={"name": "IMP-13"}),
    dict(ehr_item_id="EHR-5001", member_id="BW-10005", item_type="problem", name="E11.22 Type 2 diabetes with diabetic CKD", dose="",
         status="active", last_reconciled_date="2026-03-18", source_practice="Ortega Primary Care"),
    dict(ehr_item_id="EHR-5002", member_id="BW-10005", item_type="problem", name="N18.32 CKD stage 3b", dose="", status="active",
         last_reconciled_date="2026-03-18", source_practice="Ortega Primary Care", _flags={"name": "IMP-23"}),
    dict(ehr_item_id="EHR-5003", member_id="BW-10005", item_type="problem", name="G30.1 Alzheimer's disease, late onset", dose="",
         status="active", last_reconciled_date="2026-03-18", source_practice="Ortega Primary Care"),
    dict(ehr_item_id="EHR-5004", member_id="BW-10005", item_type="med", name="Metformin", dose="500 mg BID", status="active",
         last_reconciled_date="2026-03-18", source_practice="Ortega Primary Care", _flags={"status": "IMP-24b"}),
]

# --------------------------------------------------------------------------
# D09 Labs
# --------------------------------------------------------------------------
D09 = [
    dict(lab_id="LAB-1001", member_id="BW-10001", loinc="30934-4", test_name="BNP", value=1240, unit="pg/mL", ref_range="<100",
         flag="H", collected_date="2026-11-03", source="St. Brigid lab"),
    dict(lab_id="LAB-1002", member_id="BW-10001", loinc="2823-3", test_name="Potassium", value=5.1, unit="mmol/L", ref_range="3.5-5.1",
         flag="high-normal", collected_date="2026-11-06", source="St. Brigid lab"),
    dict(lab_id="LAB-1003", member_id="BW-10001", loinc="2160-0", test_name="Creatinine", value=1.6, unit="mg/dL", ref_range="0.7-1.3",
         flag="H", collected_date="2026-11-06", source="St. Brigid lab"),
    dict(lab_id="LAB-1004", member_id="BW-10001", loinc="98979-8", test_name="eGFR (CKD-EPI 2021)", value=44, unit="mL/min/1.73m2",
         ref_range=">60", flag="L", collected_date="2026-11-06", source="St. Brigid lab"),
    dict(lab_id="LAB-2001", member_id="BW-10002", loinc="4548-4", test_name="Hemoglobin A1c", value=7.4, unit="%", ref_range="<7.0",
         flag="H", collected_date="2026-03-12", source="Liu Internal Medicine"),
    dict(lab_id="LAB-2002", member_id="BW-10002", loinc="4548-4", test_name="Hemoglobin A1c", value=9.1, unit="%", ref_range="<7.0",
         flag="H", collected_date="2026-10-21", source="QuestPoint Labs (outside lab)"),
    dict(lab_id="LAB-2003", member_id="BW-10002", loinc="14749-6", test_name="Glucose, fasting", value=10.8, unit="mmol/L",
         ref_range="3.9-5.5", flag="H", collected_date="2026-10-21", source="QuestPoint Labs (outside lab)",
         normalized_value="195 mg/dL", _flags={"unit": "IMP-27", "value": "IMP-27"}),
    dict(lab_id="LAB-3001", member_id="BW-10003", loinc="4548-4", test_name="Hemoglobin A1c", value=8.2, unit="%", ref_range="<7.0",
         flag="H", collected_date="2026-04-02", source="Northgate Family Health"),
    dict(lab_id="LAB-5001", member_id="BW-10005", loinc="98979-8", test_name="eGFR (CKD-EPI 2021)", value=24, unit="mL/min/1.73m2",
         ref_range=">60", flag="L", collected_date="2026-10-20", source="Ortega Primary Care", _flags={"value": "IMP-24b"}),
    dict(lab_id="LAB-5002", member_id="BW-10005", loinc="4548-4", test_name="Hemoglobin A1c", value=7.0, unit="%", ref_range="<7.0",
         flag="borderline", collected_date="2026-10-20", source="Ortega Primary Care"),
]

# --------------------------------------------------------------------------
# D10 Appointments
# --------------------------------------------------------------------------
D10 = [
    dict(appt_id="AP-1001", member_id="BW-10001", provider_npi="9900000190", appt_datetime="2026-11-20 10:30",
         visit_type="Cardiology follow-up", status="scheduled", source="St. Brigid scheduling feed", _flags={"appt_datetime": "IMP-09"}),
    dict(appt_id="AP-2001", member_id="BW-10002", provider_npi="9900000145", appt_datetime="2026-09-15 09:00",
         visit_type="PCP diabetes follow-up", status="no-show", source="Liu Internal Medicine feed"),
    dict(appt_id="AP-3001", member_id="BW-10003", provider_npi="9900000170", appt_datetime="2026-10-27 14:00",
         visit_type="PCP post-ED follow-up", status="no-show", source="Northgate scheduling feed"),
    dict(appt_id="AP-5001", member_id="BW-10005", provider_npi="9900000178", appt_datetime="2026-11-17 15:00",
         visit_type="PCP post-fall follow-up", status="scheduled", source="Ortega Primary Care feed"),
]

# --------------------------------------------------------------------------
# D11 Provider directory (HiLabs-verified)
# --------------------------------------------------------------------------
D11 = [
    dict(provider_npi="9900000142", name="Dr. Anita Velasco", specialty="Family Medicine", practice="Velasco Family Medicine",
         address="2200 N High St, Columbus OH 43201", phone="614-555-0142", directory_phone_on_plan_file="614-555-0119",
         accepting_new="Y", telehealth="Y", verified_date="2026-11-02", verification_confidence="High",
         language="English, Spanish", _flags={"directory_phone_on_plan_file": "IMP-09b"}),
    dict(provider_npi="9900000145", name="Dr. Kevin Liu", specialty="Internal Medicine", practice="Liu Internal Medicine",
         address="45 Morse Rd, Columbus OH 43229", phone="614-555-0145", directory_phone_on_plan_file="614-555-0145",
         accepting_new="Y", telehealth="Y", verified_date="2026-10-28", verification_confidence="High", language="English"),
    dict(provider_npi="9900000170", name="Dr. Grace Holloway", specialty="Family Medicine",
         practice="Northgate Family Health - 5th St", address="610 E 5th Ave, Columbus OH 43201", phone="614-555-0171",
         directory_phone_on_plan_file="614-555-0170 (Northgate - Cleveland Ave, CLOSED Aug 2026)", accepting_new="Y",
         telehealth="N", verified_date="2026-10-30", verification_confidence="High", language="English",
         _flags={"directory_phone_on_plan_file": "IMP-14"}),
    dict(provider_npi="9900000160", name="Dr. Ruth Abernathy", specialty="Family Medicine", practice="Linden Community Clinic",
         address="1100 Cleveland Ave, Columbus OH 43211", phone="614-555-0161", directory_phone_on_plan_file="614-555-0161",
         accepting_new="Y", telehealth="Y", verified_date="2026-10-25", verification_confidence="High", language="English"),
    dict(provider_npi="9900000176", name="Dr. Samuel Okafor", specialty="Psychiatry", practice="Riverside Outpatient Psychiatry",
         address="330 W Spring St, Columbus OH 43215", phone="614-555-0176", directory_phone_on_plan_file="614-555-0176",
         accepting_new="Y", telehealth="Y", verified_date="2026-11-04", verification_confidence="High", language="English"),
    dict(provider_npi="9900000178", name="Dr. Maribel Ortega", specialty="Internal Medicine", practice="Ortega Primary Care",
         address="1650 Parsons Ave, Columbus OH 43207", phone="614-555-0178", directory_phone_on_plan_file="614-555-0178",
         accepting_new="N", telehealth="Y", verified_date="2026-10-31", verification_confidence="High", language="Spanish, English"),
    dict(provider_npi="9900000190", name="Dr. Rachel Okonjo", specialty="Cardiology", practice="St. Brigid Heart Institute",
         address="500 Brigid Way, Columbus OH 43214", phone="614-555-0192", directory_phone_on_plan_file="614-555-0192",
         accepting_new="Y", telehealth="Y", verified_date="2026-11-01", verification_confidence="High", language="English"),
    dict(provider_npi="9900000310", name="QuickCare Urgent Care - Morse", specialty="Urgent Care", practice="QuickCare",
         address="88 Morse Rd, Columbus OH 43229", phone="614-555-0180", directory_phone_on_plan_file="614-555-0180",
         accepting_new="Y", telehealth="N", verified_date="2026-09-30", verification_confidence="Medium", language="English"),
]

# --------------------------------------------------------------------------
# D12 Prior authorizations
# --------------------------------------------------------------------------
D12 = [
    dict(auth_id="PA-5001", member_id="BW-10005", service="DME - semi-electric hospital bed", requested_date="2026-10-31",
         status="pending", decision_date="", reviewer="UM queue (unassigned)", days_pending=(TODAY - d("2026-10-31")).days,
         _flags={"status": "IMP-30"}),
    dict(auth_id="PA-5002", member_id="BW-10005", service="Home health PT evaluation", requested_date="2026-10-26",
         status="approved", decision_date="2026-10-28", reviewer="UM RN T. Fischer", days_pending=0),
    dict(auth_id="PA-1001", member_id="BW-10001", service="Pharmacy PA - sacubitril/valsartan", requested_date="",
         status="not submitted", decision_date="", reviewer="", days_pending="", _flags={"status": "IMP-01"}),
]

# --------------------------------------------------------------------------
# D13 Risk scores
# --------------------------------------------------------------------------
D13 = [
    dict(member_id="BW-10001", model="30-day readmission", score=0.41, percentile=92,
         top_drivers="HF admission; CKD; age >75; 2+ admits in 12 mo", run_date="2026-11-08"),
    dict(member_id="BW-10002", model="Rising risk (claims-based)", score=0.22, percentile=78,
         top_drivers="Diabetes; utilization stable; no recent admits", run_date="2026-11-01", _flags={"top_drivers": "IMP-28"}),
    dict(member_id="BW-10003", model="Total cost (12-mo)", score=0.37, percentile=88,
         top_drivers="ED frequency; COPD/asthma; diabetes; housing", run_date="2026-11-01"),
    dict(member_id="BW-10004", model="30-day readmission (BH)", score=0.33, percentile=85,
         top_drivers="Psych admission; housing instability; prior readmit", run_date="2026-11-06"),
    dict(member_id="BW-10005", model="Total cost (12-mo)", score=0.30, percentile=80,
         top_drivers="Dementia; CKD; falls; age >80", run_date="2026-11-01"),
]

# --------------------------------------------------------------------------
# D14 SDOH / HRA screens
# --------------------------------------------------------------------------
D14 = [
    dict(screen_id="SD-1001", member_id="BW-10001", screen_date="2026-02-14", tool="AHC-HRSN", housing="Stable", food="No",
         transport="Sometimes a problem", utilities="No", safety="No", social_isolation="Low", phone_access="Landline",
         self_reported="Y", _flags={"screen_date": "IMP-15", "phone_access": "IMP-06"}),
    dict(screen_id="SD-2001", member_id="BW-10002", screen_date="2026-01-08", tool="HRA (annual)", housing="Stable",
         food="Sometimes worried", transport="No", utilities="No", safety="No", social_isolation="Low", phone_access="Mobile",
         self_reported="Y", _flags={"screen_date": "IMP-15b"}),
    dict(screen_id="SD-3001", member_id="BW-10003", screen_date="2025-06-03", tool="AHC-HRSN", housing="Unstable - renting a room",
         food="Often worried", transport="No reliable transport", utilities="Yes - shutoff notice", safety="No",
         social_isolation="High", phone_access="Prepaid mobile", self_reported="Y", _flags={"screen_date": "IMP-16"}),
    dict(screen_id="SD-4001", member_id="BW-10004", screen_date="2025-09-12", tool="AHC-HRSN", housing="Stable",
         food="No", transport="No", utilities="No", safety="No", social_isolation="Moderate", phone_access="Prepaid mobile",
         self_reported="Y", _flags={"screen_date": "IMP-17", "housing": "IMP-17"}),
    dict(screen_id="SD-5001", member_id="BW-10005", screen_date="2026-04-09", tool="HRA (annual)", housing="Stable - lives with daughter",
         food="No", transport="Depends on daughter", utilities="No", safety="Fall risk at home", social_isolation="Moderate",
         phone_access="Landline + daughter's mobile", self_reported="Caregiver-reported", _flags={"screen_date": "IMP-15c"}),
]

# --------------------------------------------------------------------------
# D15 Caregiver / authorized representative
# --------------------------------------------------------------------------
D15 = [
    dict(caregiver_id="CG-1001", member_id="BW-10001", name="Karen Brennan", relationship="Daughter", contact_id="C-1002",
         hipaa_auth_on_file="Y", auth_expiry="2027-05-31", lives_with_member="N", strain_indicator="Low",
         language="English", best_window="12:00-13:00"),
    dict(caregiver_id="CG-1002", member_id="BW-10001", name="Joan Brennan", relationship="Spouse", contact_id="C-1001",
         hipaa_auth_on_file="Y", auth_expiry="2027-05-31", lives_with_member="Y", strain_indicator="Moderate",
         language="English", best_window=""),
    dict(caregiver_id="CG-3001", member_id="BW-10003", name="Denise Reid", relationship="Sister", contact_id="C-3004",
         hipaa_auth_on_file="N", auth_expiry="", lives_with_member="N", strain_indicator="Unknown",
         language="English", best_window="", _flags={"hipaa_auth_on_file": "IMP-29"}),
    dict(caregiver_id="CG-5001", member_id="BW-10005", name="Lucia Ruiz", relationship="Daughter", contact_id="C-5002",
         hipaa_auth_on_file="Y", auth_expiry="2026-09-30", lives_with_member="Y", strain_indicator="High (Zarit-4 = 12 on 15 Oct)",
         language="Spanish", best_window="19:00-20:00", _flags={"auth_expiry": "IMP-29b"}),
]

# --------------------------------------------------------------------------
# D16 Case record
# --------------------------------------------------------------------------
D16 = [
    dict(case_id="CASE-1001", member_id="BW-10001", program="TOC + DM-HF", opened="2024-02-10", status="Active", acuity="High",
         last_assessment_date="2026-05-12", next_reassessment_due="2027-05-12",
         goals="1) No HF readmission in 90 days; 2) Daily weights logged 6/7 days",
         barriers="Transport (sometimes); complex med regimen",
         interventions="Monthly calls; HF education; weight log review",
         open_tasks="TOC contact within 2 business days of discharge (due Tue 10 Nov) | Owner: Maria",
         last_note="20 Oct: Karen reports mild ankle swelling; advised to call PCP if weight up 2 kg.",
         advance_directive="On file (2024)"),
    dict(case_id="CASE-2001", member_id="BW-10002", program="DM-Diabetes", opened="2025-01-15", status="Active", acuity="Moderate",
         last_assessment_date="2026-01-15", next_reassessment_due="2027-01-15",
         goals="1) A1c < 7.5%; 2) PDC > 80% on all diabetes and BP meds", barriers="New retiree income; side effects",
         interventions="Quarterly calls; refill reminders", open_tasks="Quarterly check-in (overdue since 29 Oct)",
         last_note="29 Sep: Mentions stomach upset on metformin, 'thinking of taking it every other day'.",
         advance_directive="Not on file"),
    dict(case_id="CASE-3001", member_id="BW-10003", program="CCM", opened="2025-11-20", status="Unable to reach (UTR)",
         acuity="High", last_assessment_date="2025-11-20", next_reassessment_due="2026-11-20",
         goals="1) Reduce ED visits; 2) Controller inhaler daily", barriers="Housing; transport; phone access",
         interventions="Monthly calls; CHW referral (not completed)",
         open_tasks="Case auto-closure scheduled Thu 12 Nov (3 UTR attempts + letter) | Owner: system",
         last_note="22 Jul: Says he lost his inhaler spacer; out of minutes on phone often.",
         advance_directive="Not on file", _flags={"status": "IMP-31"}),
    dict(case_id="CASE-4001", member_id="BW-10004", program="CCM + BH coordination", opened="2024-10-02", status="Active",
         acuity="High", last_assessment_date="2025-10-02", next_reassessment_due="2026-10-02",
         goals="1) Attend therapy monthly; 2) Medication adherence; 3) Stable housing",
         barriers="Housing; distrust of phone calls", interventions="SMS check-ins; co-managed with SW Jamal Price",
         open_tasks="FUH 7-day follow-up after psych discharge (due Thu 12 Nov) | Annual reassessment OVERDUE since 2 Oct",
         last_note="28 Oct: Responds to text; prefers not to talk on the phone. Worried about eviction.",
         advance_directive="Not on file", _flags={"last_note": "IMP-32"}),
    dict(case_id="CASE-5001", member_id="BW-10005", program="CCM", opened="2021-02-01", status="Active", acuity="High",
         last_assessment_date="2025-11-12", next_reassessment_due="2026-11-12",
         goals="1) No falls with injury; 2) A1c 7-8% (no hypoglycemia); 3) Caregiver supported",
         barriers="Dementia; caregiver strain; language", interventions="Monthly calls with Lucia (Spanish); PT; DME",
         open_tasks="Annual CCM reassessment (40 fields) due Thu 12 Nov | Hospital bed PA follow-up",
         last_note="15 Oct: Lucia exhausted, works two jobs; asked about respite. Zarit-4 = 12.",
         advance_directive="On file (2022) - DNR/POLST"),
]

# --------------------------------------------------------------------------
# D17 Quality gaps
# --------------------------------------------------------------------------
D17 = [
    dict(gap_id="QG-1001", member_id="BW-10001", measure="TRC - Patient engagement after discharge", status="open",
         event_date="2026-11-06", due_date="2026-12-06"),
    dict(gap_id="QG-1002", member_id="BW-10001", measure="TRC - Medication reconciliation post-discharge", status="open",
         event_date="2026-11-06", due_date="2026-12-07"),
    dict(gap_id="QG-1003", member_id="BW-10001", measure="TRC - Receipt of discharge information", status="closed",
         event_date="2026-11-06", due_date="2026-11-08"),
    dict(gap_id="QG-2001", member_id="BW-10002", measure="Medication adherence - diabetes (PDC-DR, 3x Star)", status="at risk",
         event_date="", due_date="2026-12-31"),
    dict(gap_id="QG-2002", member_id="BW-10002", measure="Medication adherence - RAS antagonists (PDC-RASA, 3x Star)",
         status="at risk", event_date="", due_date="2026-12-31"),
    dict(gap_id="QG-3001", member_id="BW-10003", measure="Asthma medication ratio (AMR)", status="open", event_date="",
         due_date="2026-12-31"),
    dict(gap_id="QG-4001", member_id="BW-10004", measure="FUH - Follow-up after hospitalization for mental illness (7-day)",
         status="open", event_date="2026-11-05", due_date="2026-11-12"),
    dict(gap_id="QG-5001", member_id="BW-10005", measure="Medication adherence - diabetes (PDC-DR)", status="open - review",
         event_date="", due_date="2026-12-31", note="Metformin likely to be stopped (eGFR 24); gap must defer to clinical judgment",
         _flags={"status": "IMP-24b"}),
]

# --------------------------------------------------------------------------
# D18 Remote patient monitoring (Later)
# --------------------------------------------------------------------------
D18 = [
    dict(reading_id="RPM-1001", member_id="BW-10001", device="Bluetooth scale", metric="Weight", value=84.2, unit="kg",
         reading_datetime="2026-11-06 19:10"),
    dict(reading_id="RPM-1002", member_id="BW-10001", device="Bluetooth scale", metric="Weight", value=84.9, unit="kg",
         reading_datetime="2026-11-07 07:40"),
    dict(reading_id="RPM-1003", member_id="BW-10001", device="Bluetooth scale", metric="Weight", value=86.0, unit="kg",
         reading_datetime="2026-11-08 07:35"),
]

# --------------------------------------------------------------------------
# D19 Behavioral health encounters (consent-gated, Later)
# --------------------------------------------------------------------------
D19 = [
    dict(bh_id="BH-4001", member_id="BW-10004", encounter_date="2026-10-02", type="Outpatient therapy",
         provider="Riverside Outpatient Psychiatry", consent_flag="Coordination allowed (42 CFR Part 2 consent on file)"),
    dict(bh_id="BH-4002", member_id="BW-10004", encounter_date="2026-10-30", type="Inpatient psych admission",
         provider="Riverside Behavioral Health", consent_flag="Coordination allowed (42 CFR Part 2 consent on file)"),
]

# --------------------------------------------------------------------------
# D20 Member services call log (Later)
# --------------------------------------------------------------------------
D20 = [
    dict(ticket_id="MS-3001", member_id="BW-10003", datetime="2026-10-02 19:12", reason="Lost ID card - replacement mailed",
         new_contact_value="614-555-0187 (mobile, member)", resolved="Y", propagated_to_case_system="N",
         _flags={"new_contact_value": "IMP-10b", "propagated_to_case_system": "IMP-10b"}),
    dict(ticket_id="MS-5001", member_id="BW-10005", datetime="2026-11-05 18:40",
         reason="Daughter asked status of hospital bed request", new_contact_value="", resolved="N",
         propagated_to_case_system="N"),
]

DATASETS = {
    "D01": ("Member & eligibility", "Must", D01),
    "D02": ("Contact points", "Must", D02),
    "D03": ("Outreach & contact history", "Must", D03),
    "D04": ("ADT alerts", "Must", D04),
    "D05": ("HIE clinical documents", "Must", D05),
    "D05b": ("Discharge medication lines (from D05)", "Must", D05b),
    "D06": ("Medical claims", "Must", D06),
    "D07": ("Pharmacy fills", "Must", D07),
    "D08": ("EHR medication & problem list", "Should", D08),
    "D09": ("Lab results", "Should", D09),
    "D10": ("Appointments & scheduling", "Should", D10),
    "D11": ("Provider directory (HiLabs-verified)", "Must", D11),
    "D12": ("Prior authorizations", "Should", D12),
    "D13": ("Risk scores", "Must", D13),
    "D14": ("SDOH / HRA screens", "Should", D14),
    "D15": ("Caregiver / authorized representative", "Should", D15),
    "D16": ("Case record", "Must", D16),
    "D17": ("Quality gap list (HEDIS / Stars)", "Should", D17),
    "D18": ("Remote patient monitoring", "Later", D18),
    "D19": ("Behavioral health encounters (consent-gated)", "Later", D19),
    "D20": ("Member services call log", "Later", D20),
}

# --------------------------------------------------------------------------
# Imperfection log
# --------------------------------------------------------------------------
m_pdc, m_cov, m_tot = PDC[("BW-10002", "metformin")]
l_pdc, l_cov, l_tot = PDC[("BW-10002", "lisinopril")]

imp("IMP-01", "P1", "D07 / D12", "RX-1003, PA-1001", "claim_status", "New discharge med not filled",
    "Entresto claim rejected for prior authorization on 6 Nov; no PA was ever submitted", "Member has no Entresto at home",
    "Med reconciliation diff (New, not filled) + NBA 'Start PA with cardiologist'")
imp("IMP-02", "P1", "D07 / D08", "RX-1002, EHR-1001", "fill_date", "Stopped med still filling (safety)",
    "Lisinopril stopped at discharge but auto-refilled 7 Nov; PCP list still shows it active",
    "Lisinopril should be stopped; ACE inhibitor + ARNI together is contraindicated",
    "Med diff (Stopped, still filling) + safety flag + NBA 'Cancel auto-refill'")
imp("IMP-03", "P1", "D07 / D08", "RX-1004, EHR-1002", "qty / dose", "Dose changed, old dose on hand",
    "Furosemide raised to BID at discharge; pharmacy and EHR still show once daily (30 tabs/30 days)",
    "Member will run out of furosemide in ~half the time", "Med diff (Dose changed, old dose filled)")
imp("IMP-04", "P1", "D04", "ADT-1001", "dx_text", "ADT alert without context",
    "Admission alert carries no diagnosis", "Admitted for acute-on-chronic systolic HF (DOC-1001)",
    "'Admitted for ?' chip auto-linked to discharge summary")
imp("IMP-05", "P1", "D04", "ADT-1002", "received_datetime", "Late ADT",
    "Discharge at 14:10 Fri arrived 09:15 Sat (19 h late)", "Discharge Fri 6 Nov 14:10",
    "Timeline shows event time vs received time; deadlines run from event time")
imp("IMP-06", "P1", "D02 / D03 / D14", "C-1001", "status", "Wrong / disconnected phone",
    "Home landline on file since 2019; disconnected on both weekend attempts", "Reach via daughter Karen's mobile C-1002",
    "Contact intelligence demotes number; correction ticket")
imp("IMP-07", "P1", "D04", "ADT-1003", "adt_id", "Duplicate record",
    "Same A03 discharge message sent twice, 1 minute apart", "One discharge event",
    "Timeline de-duplication ('2 messages merged')")
imp("IMP-08", "P1", "D06", "CL-1002", "service_date", "Delayed claim hiding an event",
    "Latest claim is 22 Sep; the 3-6 Nov admission is not billed yet", "Admission happened (ADT + discharge summary)",
    "Freshness badge on claims; ADT shown above claims")
imp("IMP-09", "P1", "D10", "AP-1001", "appt_datetime", "Follow-up outside window",
    "Only cardiology on 20 Nov is booked (day 14); no PCP visit", "PCP visit needed by Fri 13 Nov (7 days)",
    "Deadline checklist + NBA 'Book PCP visit'")
imp("IMP-09b", "P1", "D11", "9900000142", "directory_phone_on_plan_file", "Wrong clinic phone on plan file",
    "Plan's own provider file lists 614-555-0119 for Dr. Velasco", "HiLabs-verified number is 614-555-0142",
    "Booking uses verified number with 'Verified by HiLabs' chip")
imp("IMP-10", "P3", "D02 / D03", "C-3001", "owner", "Number belongs to someone else",
    "Home line labelled 'member' is a former roommate; 3 'wrong person' outcomes", "Not Marcus's number",
    "Owner re-labelled; number demoted")
imp("IMP-10b", "P3", "D20", "MS-3001", "new_contact_value", "Data stuck in another system",
    "Member called member services on 2 Oct from new mobile 614-555-0187; never reached case system",
    "614-555-0187 is Marcus's current mobile", "Cross-system contact merge ranks it #1")
imp("IMP-11", "P3", "D07", "RX-3005", "fill_date", "Controller medication gap",
    "Controller inhaler last filled 11 Jul (~120 days); rescue inhaler filled 4 times", "Uncontrolled asthma driving ED visits",
    "Med diff + NBA 'Refill controller, add spacer'")
imp("IMP-12", "P3", "D04", "ADT-3003, ADT-3004", "dx_text / disposition", "ADT without diagnosis + missing summary",
    "7 Nov ED visit has no diagnosis, no disposition and no ED note >48 h later", "Likely asthma exacerbation (albuterol filled 8 Nov)",
    "'Flying blind' flag + auto CCD request")
imp("IMP-13", "P3", "D06 / D08", "CL-3002, CL-3003, EHR-3002", "icd10_codes", "Conflicting diagnoses",
    "COPD (J44.x) on claims and EHR vs asthma (J45.901) on later ED claim and ED note", "Asthma-COPD overlap; PCP to confirm",
    "Conflict card (Needs follow-up)")
imp("IMP-14", "P3", "D11", "9900000170", "directory_phone_on_plan_file", "Ghost provider location",
    "Plan file lists Northgate - Cleveland Ave (closed Aug 2026)", "Dr. Holloway now at Northgate - 5th St, 614-555-0171",
    "Booking uses verified location")
imp("IMP-15", "P1", "D14", "SD-1001", "screen_date", "Stale SDOH",
    "SDOH screen ~9 months old (amber)", "Transport status unknown now", "Age badge + re-screen prompt")
imp("IMP-15b", "P2", "D14", "SD-2001", "screen_date", "Stale SDOH",
    "SDOH screen 10 months old; food insecurity 'sometimes'", "May be worse after retirement", "Age badge + re-screen prompt")
imp("IMP-15c", "P5", "D14", "SD-5001", "screen_date", "Stale SDOH",
    "SDOH screen 7 months old", "Caregiver capacity has dropped", "Age badge + re-screen prompt")
imp("IMP-16", "P3", "D14", "SD-3001", "screen_date", "Stale SDOH",
    "SDOH screen 17 months old (red)", "Housing/transport likely changed", "Age badge + re-screen prompt")
imp("IMP-17", "P4", "D01 / D14", "BW-10004, SD-4001", "address / housing", "Stale address + stale SDOH",
    "Eligibility address and 'housing stable' are 14 months old; ADT says discharged to a shelter",
    "Currently at Harbor Light Shelter, 220 Pier St", "Conflict card (address) + SDOH red badge")
imp("IMP-18", "P4", "D05", "DOC-4002", "discharge_date", "Duplicate document with conflicting dates",
    "Amended summary says discharge 6 Nov; original and ADT say 5 Nov", "Discharge 5 Nov 11:00 (FUH due 12 Nov)",
    "De-duplication + conflict card; ADT event time wins")
imp("IMP-19", "P4", "D06", "CL-4002", "icd10_codes", "Less specific diagnosis",
    "Claim coded F31.9 (unspecified); discharge summary says F31.2", "F31.2 (most recent clinical document)",
    "Conflict card; clinical document preferred")
imp("IMP-20", "P4", "D07", "RX-4001, RX-4002", "days_supply", "Bridge supply running out + BP med gap",
    "Aripiprazole 7-day bridge ends 12 Nov; amlodipine last filled 6 Aug", "Needs 30-day fill near shelter",
    "Med diff + NBA 'Arrange 30-day fill'")
imp("IMP-21", "P5", "D01 / D03", "BW-10005", "preferred_language", "Wrong language default",
    "Eligibility says English, no interpreter; every connected call was in Spanish", "Spanish, interpreter needed",
    "Conflict card; last-call language wins for outreach")
imp("IMP-22", "P5", "D06", "CL-5001", "service_date", "Delayed claim hiding an event",
    "24 Oct ED visit for a fall not in claims", "Fall with knee contusion (ADT + ED note)", "Freshness badge; ADT above claims")
imp("IMP-23", "P5", "D06 / D08 / D09", "CL-5001, EHR-5002, LAB-5001", "icd10_codes", "Conflicting diagnoses",
    "Claims: E11.9 (no complications); EHR: CKD 3b; latest eGFR 24 = stage 4", "E11.22 with CKD stage 4 (N18.4)",
    "Conflict card; most recent lab-backed value suggested")
imp("IMP-24b", "P5", "D07 / D09 / D08", "RX-5001, LAB-5001", "fill_date", "Med-lab safety conflict",
    "Metformin auto-refilled 28 Oct while eGFR is 24 (below 30)", "Prescriber should review metformin",
    "Safety flag + NBA 'Flag to PCP'")
imp("IMP-29", "P3", "D15", "CG-3001", "hipaa_auth_on_file", "No caregiver authorization",
    "Sister is reachable but has no HIPAA authorization", "Can pass a message, not discuss PHI",
    "PHI warning before call")
imp("IMP-29b", "P5", "D15", "CG-5001", "auth_expiry", "Expired caregiver authorization",
    "Daughter's HIPAA authorization expired 30 Sep", "Must renew before discussing PHI", "PHI warning + NBA 'Renew authorization'")
imp("IMP-30", "P5", "D12", "PA-5001", "status", "Prior auth stuck",
    f"Hospital bed PA pending {(TODAY - d('2026-10-31')).days} days, unassigned", "Should be decided within plan SLA",
    "NBA 'Escalate to UM nurse'")
imp("IMP-24", "P2", "D06", "CL-2002", "service_date", "Claims-only view hides decline",
    "Latest claim 3 Apr; nothing looks wrong in claims", "Adherence and A1c are deteriorating",
    "Pharmacy + lab freshness surfaced above claims")
imp("IMP-25", "P2", "D07", "RX-2003, RX-2004", "claim_status", "Duplicate record (reversal)",
    "Metformin 28 Jul fill reversed and re-billed the same day", "One fill on 28 Jul", "Timeline de-duplication")
imp("IMP-26", "P2", "D07 / D08", "RX-2007", "prescriber_npi", "Med on no list (unknown prescriber)",
    "Glipizide filled 1 Sep, prescribed by an urgent care; not on PCP list", "PCP unaware of a second diabetes drug (hypoglycemia risk)",
    "Med diff (Filled but not on any list)")
imp("IMP-27", "P2", "D09", "LAB-2003", "unit", "Unit mismatch",
    "Outside lab reports fasting glucose 10.8 mmol/L; plan uses mg/dL", "195 mg/dL", "Normalized value shown, original kept")
imp("IMP-28", "P2", "D13", "BW-10002", "top_drivers", "Risk model blind spot",
    "Claims-based model says 'utilization stable'", f"Metformin PDC {m_pdc:.0f}%, lisinopril PDC {l_pdc:.0f}%, A1c 9.1%",
    "Queue new-signal (S) from pharmacy lifts him despite flat model")
imp("IMP-31", "P3", "D16", "CASE-3001", "status", "Case about to close on a reachable member",
    "UTR auto-closure on 12 Nov", "Member is reachable on 614-555-0187", "NBA 'Cancel closure'")
imp("IMP-32", "P4", "D16", "CASE-4001", "last_note", "Unused free-text preference",
    "Note says 'prefers text' but TOC team called twice", "Text first", "Contact intelligence ranks SMS first")

# --------------------------------------------------------------------------
# Queue: 5 personas + 43 filler members
# --------------------------------------------------------------------------
PERSONA_QUEUE = [
    dict(member_id="BW-10001", name="Harold Brennan", age=78, program="TOC + DM-HF", language="English",
         R=92, D=80, S=80, E=60, new_since_friday=True, due_today=True,
         reasons=["Discharged Fri (HF) - day 3 of 7, no PCP visit booked",
                  "New HF med not filled; stopped lisinopril refilled",
                  "Readmission risk 92nd percentile"],
         next_deadline="TOC contact due Tue 10 Nov", best_time="Now (safety) - Karen 12:00-13:00",
         derivation={"R": "D13 readmission percentile 92",
                     "D": "TOC contact due 10 Nov = 1 business day -> 80",
                     "S": "Discharge 6 Nov (80) > discharge med not filled (75)",
                     "E": "Last connect 20 Oct = 20 days -> 60"}),
    dict(member_id="BW-10003", name="Marcus Reid", age=54, program="CCM", language="English",
         R=88, D=50, S=90, E=100, new_since_friday=True, due_today=False,
         reasons=["ED visit Sat night - 4th in 90 days",
                  "No successful contact in 110 days; case closes Thu",
                  "Controller inhaler not filled since July"],
         next_deadline="Case auto-closes Thu 12 Nov", best_time="After 18:00",
         derivation={"R": "D13 cost percentile 88", "D": "Auto-closure 12 Nov = 3 days -> 50",
                     "S": "ED visit 7 Nov -> 90", "E": "Last connect 22 Jul = 110 days -> 100"}),
    dict(member_id="BW-10005", name="Esperanza Ruiz", age=82, program="CCM", language="Spanish",
         R=80, D=50, S=90, E=60, new_since_friday=False, due_today=False,
         reasons=["Annual reassessment due Thu",
                  "ED visit for fall 24 Oct (not in claims)",
                  "Metformin filled with eGFR 24"],
         next_deadline="Reassessment due Thu 12 Nov", best_time="19:00-20:00 (Lucia, Spanish)",
         derivation={"R": "D13 cost percentile 80", "D": "Reassessment due 12 Nov = 3 days -> 50",
                     "S": "ED visit 24 Oct after last contact -> 90", "E": "Last connect 15 Oct = 25 days -> 60"}),
    dict(member_id="BW-10004", name="Leah Carter", age=34, program="CCM + BH", language="English",
         R=85, D=50, S=80, E=30, new_since_friday=False, due_today=False,
         reasons=["Psych discharge Thu to a shelter",
                  "7-day follow-up and med bridge both end Thu",
                  "2 calls unanswered - prefers text"],
         next_deadline="FUH 7-day follow-up due Thu 12 Nov", best_time="Text first; evenings",
         derivation={"R": "D13 BH readmission percentile 85", "D": "FUH due 12 Nov = 3 days -> 50",
                     "S": "Discharge 5 Nov -> 80", "E": "Last reply 28 Oct = 12 days -> 30"}),
    dict(member_id="BW-10002", name="Devon Mitchell", age=67, program="DM-Diabetes", language="English",
         R=78, D=0, S=60, E=100, new_since_friday=False, due_today=False,
         reasons=[f"Metformin PDC {m_pdc:.0f}% / lisinopril PDC {l_pdc:.0f}% (3x Star measures)",
                  "A1c 7.4% -> 9.1% (outside lab)",
                  "No successful contact in 41 days"],
         next_deadline="No hard deadline", best_time="08:00-09:00 (before driving shift)",
         derivation={"R": "D13 rising-risk percentile 78", "D": "No open deadline <= 7 days -> 0",
                     "S": "Adherence PDC < 80% -> 60", "E": "Last connect 29 Sep = 41 days -> 100"}),
]

FIRST = ["James", "Mary", "Robert", "Patricia", "John", "Linda", "Michael", "Barbara", "William", "Elizabeth", "David",
         "Susan", "Richard", "Jessica", "Joseph", "Sarah", "Thomas", "Karen", "Charles", "Nancy", "Daniel", "Betty",
         "Matthew", "Sandra", "Anthony", "Ashley", "Donald", "Dorothy", "Paul", "Kimberly", "Steven", "Emily",
         "Andrew", "Donna", "Kenneth", "Michelle", "George", "Carol", "Edward", "Amanda", "Ronald", "Melissa", "Gloria"]
LAST = ["Alvarez", "Bishop", "Coleman", "Dawson", "Ellison", "Foster", "Garcia", "Hughes", "Ingram", "Jenkins",
        "Keller", "Lawson", "Morales", "Nguyen", "Owens", "Patel", "Quinn", "Ramirez", "Sullivan", "Turner", "Underwood",
        "Vaughn", "Walsh", "Xu", "Young", "Zimmerman", "Abbott", "Barnes", "Chen", "Duarte", "Erikson", "Fleming",
        "Gibbs", "Harper", "Iverson", "Jordan", "Kim", "Lopez", "Mendez", "Novak", "Ortiz", "Price", "Rivera"]
PROGRAMS = ["CCM", "TOC", "DM-HF", "DM-Diabetes", "CCM", "DM-COPD", "TOC", "CCM"]
FILLER_REASONS = {
    "discharge": "Discharged {day} - TOC call due",
    "adherence": "Refill gap on a Star-measure drug",
    "lab": "New abnormal lab result",
    "sdoh": "Reported food insecurity on HRA",
    "nocontact": "No successful contact in {n} days",
    "reassess": "Reassessment due {day}",
    "stable": "Routine monthly check-in",
    "wrongnum": "Number confirmed wrong",
}

rng = random.Random(42)
filler = []
discharge_slots = 4        # 6 discharge alerts total "new since Friday" (P1, P3 + 4 filler)
due_today_slots = 6        # 7 due today total (P1 + 6 filler)
for i in range(43):
    mid = f"BW-1{1000 + i:04d}"
    name = f"{FIRST[i]} {LAST[(i * 7) % len(LAST)]}"
    age = rng.randint(58, 91)
    prog = PROGRAMS[i % len(PROGRAMS)]
    lang = "Spanish" if i % 9 == 0 else ("Vietnamese" if i % 17 == 0 else "English")
    R = rng.randint(25, 85)
    kind = rng.choice(["adherence", "lab", "sdoh", "nocontact", "reassess", "stable", "stable", "wrongnum"])
    D = rng.choice([0, 0, 20, 20, 50])
    S = {"adherence": 60, "lab": 85, "sdoh": 50, "nocontact": 0, "reassess": 0, "stable": 0, "wrongnum": 40}[kind]
    days = rng.randint(3, 45)
    E = 100 if days > 30 else 60 if days >= 15 else 30 if days >= 8 else 0
    new_fri, due = False, False
    if discharge_slots and i % 7 == 2:
        kind, S, D, new_fri = "discharge", 80, 80, True
        R = rng.randint(30, 60)
        discharge_slots -= 1
    if due_today_slots and (D == 80 or i % 8 == 5):
        if D != 80:
            D = 100
            kind = "reassess"
        due = True
        due_today_slots -= 1
        R = min(R, 50)
    c = dict(R=R, D=D, S=S, E=E)
    # keep filler below persona P4 so the 5 personas read as the story
    while score(c) >= 66:
        c["R"] -= 5
    day_word = rng.choice(["Fri", "Sat", "Sun"]) if kind == "discharge" else rng.choice(["Tue", "Wed", "Thu", "Fri"])
    reason = FILLER_REASONS[kind].format(day=day_word if kind != "reassess" or not due else "today", n=days)
    reasons = [reason]
    if E >= 60 and kind != "nocontact":
        reasons.append(f"No successful contact in {days} days")
    reasons.append(f"Risk {c['R']}th percentile")
    filler.append(dict(member_id=mid, name=name, age=age, program=prog, language=lang, **c,
                       new_since_friday=new_fri, due_today=due, reasons=reasons[:3],
                       next_deadline=("Due today" if due else ("Within 3 days" if D == 50 else "")),
                       best_time=rng.choice(["09:00-11:00", "13:00-15:00", "After 17:00", "Any"]),
                       filler=True))

queue = []
for q in PERSONA_QUEUE + filler:
    q.setdefault("filler", False)
    q["score"] = score(q)
    q["band"] = band(q["score"])
    queue.append(q)
queue.sort(key=lambda r: -r["score"])
for rank, q in enumerate(queue, 1):
    q["rank"] = rank

# after-action state for the demo path (P1 completed)
AFTER = {"BW-10001": dict(R=92, D=20, S=0, E=0,
                          reasons=["PCP visit booked Wed 11 Nov", "BMP lab due within 7 days", "Pharmacy PA in progress"],
                          next_deadline="BMP lab by Fri 13 Nov"),
         # P3 / P5 after their demo paths (matches scripted wrap_up.queue_change)
         "BW-10003": dict(R=88, D=20, S=0, E=0,
                          reasons=["Contact restored - new mobile verified", "Auto-closure cancelled", "Controller inhaler refill in progress"],
                          next_deadline="PCP visit (Dr. Holloway) within 7 days"),
         "BW-10005": dict(R=80, D=20, S=0, E=0,
                          reasons=["Reassessment completed 9 Nov", "Metformin flagged to PCP", "Hospital bed PA escalated"],
                          next_deadline="Bed PA decision follow-up Fri 13 Nov")}
for k, v in AFTER.items():
    v["score"] = score(v)
    v["band"] = band(v["score"])

# --------------------------------------------------------------------------
# Meta
# --------------------------------------------------------------------------
META = dict(
    clock=CLOCK.isoformat(), clock_label="Mon 9 Nov 2026, 08:00 ET",
    plan="Brightwater Health (fictional) - Medicare Advantage HMO + D-SNP",
    user=dict(name="Maria Alvarez, RN, CCM", role="Complex case manager (telephonic)", caseload=len(queue)),
    weights=WEIGHTS, bands=[dict(name=n, min=m) for n, m in BANDS],
    deadline_points=[["Overdue or due today", 100], ["<= 1 business day", 80], ["<= 3 days", 50], ["<= 7 days", 20], ["Later", 0]],
    signal_points=[["Admission or ED visit", 90], ["Critical lab", 85], ["Discharge", 80], ["Discharge med not filled", 75],
                   ["Adherence PDC < 80%", 60], ["SDOH change", 50], ["Number confirmed wrong", 40]],
    engagement_points=[["> 30 days", 100], ["15-30 days", 60], ["8-14 days", 30], ["<= 7 days", 0]],
    freshness=[
        dict(source="ADT alerts", fresh="< 24 h", aging="1-3 days", stale="> 3 days", fresh_days=1, stale_days=3),
        dict(source="Pharmacy fills", fresh="< 3 days", aging="3-14 days", stale="> 14 days", fresh_days=3, stale_days=14),
        dict(source="HIE / discharge summary", fresh="< 48 h after discharge", aging="2-7 days", stale="missing > 7 days", fresh_days=2, stale_days=7),
        dict(source="Labs", fresh="< 7 days", aging="7-30 days", stale="> 30 days", fresh_days=7, stale_days=30),
        dict(source="Medical claims", fresh="< 30 days", aging="30-60 days", stale="> 60 days", fresh_days=30, stale_days=60),
        dict(source="SDOH / HRA screen", fresh="< 6 months", aging="6-12 months", stale="> 12 months", fresh_days=183, stale_days=365),
        dict(source="Phone number", fresh="verified < 90 days", aging="90-365 days", stale="failed or > 1 year", fresh_days=90, stale_days=365),
    ],
    feed_health=[
        dict(source="ADT (HIE)", last_refresh="2026-11-09 07:52", status="fresh"),
        dict(source="Pharmacy (PBM)", last_refresh="2026-11-09 06:00", status="fresh"),
        dict(source="HIE documents", last_refresh="2026-11-09 07:30", status="fresh"),
        dict(source="Labs", last_refresh="2026-11-09 07:10", status="fresh"),
        dict(source="Scheduling (partial coverage)", last_refresh="2026-11-09 06:30", status="aging"),
        dict(source="Provider directory (HiLabs)", last_refresh="2026-11-09 05:00", status="fresh"),
        dict(source="Medical claims", last_refresh="2026-11-01 02:00", status="aging"),
    ],
    pdc=dict(devon_metformin=dict(pct=m_pdc, covered=m_cov, days=m_tot),
             devon_lisinopril=dict(pct=l_pdc, covered=l_cov, days=l_tot)),
    after_action=AFTER,
    counts=dict(new_since_friday=sum(q["new_since_friday"] for q in queue),
                due_today=sum(q["due_today"] for q in queue)),
)


def strip(rows):
    return rows


json.dump({k: dict(name=v[0], priority=v[1], records=v[2]) for k, v in DATASETS.items()},
          open(OUT / "datasets.json", "w"), indent=2)
json.dump(queue, open(OUT / "queue.json", "w"), indent=2)
json.dump(IMPS, open(OUT / "imperfections.json", "w"), indent=2)
json.dump(META, open(OUT / "meta.json", "w"), indent=2)

print("records:", sum(len(v[2]) for v in DATASETS.values()), "| imperfections:", len(IMPS),
      "| queue:", len(queue), "| counts:", META["counts"])
print("PDC metformin", PDC[("BW-10002", "metformin")], "lisinopril", PDC[("BW-10002", "lisinopril")])
for q in queue[:10]:
    print(q["rank"], q["name"], q["score"], q["band"])
print("P2 rank:", next(q["rank"] for q in queue if q["member_id"] == "BW-10002"))
print("after P1:", AFTER["BW-10001"]["score"], AFTER["BW-10001"]["band"])
