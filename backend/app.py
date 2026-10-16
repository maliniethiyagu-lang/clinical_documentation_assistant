from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import sqlite3, os, re, io
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "clinical.db")
app = Flask(__name__)
CORS(app)

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with db() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            age INTEGER, sex TEXT, phone TEXT, created_at TEXT NOT NULL)""")
        con.execute("""CREATE TABLE IF NOT EXISTS notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL, visit_date TEXT NOT NULL,
            transcript TEXT, chief_complaint TEXT, symptoms TEXT,
            assessment TEXT, plan TEXT, created_at TEXT NOT NULL,
            FOREIGN KEY(patient_id) REFERENCES patients(id))""")
        count = con.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
        if count == 0:
            demo = [
                ("PT-1001","Aarav Kumar",34,"Male","9000000001"),
                ("PT-1002","Meera S",28,"Female","9000000002"),
                ("PT-1003","Ravi Prakash",52,"Male","9000000003")
            ]
            for code,name,age,sex,phone in demo:
                con.execute("INSERT INTO patients(patient_code,name,age,sex,phone,created_at) VALUES(?,?,?,?,?,?)",
                            (code,name,age,sex,phone,datetime.now().isoformat(timespec="seconds")))

@app.get("/api/health")
def health():
    return jsonify({"status":"ok","mode":"rule-based demo","message":"Do not use demo output as medical advice."})

@app.get("/api/patients")
def get_patients():
    q = request.args.get("q","").strip()
    with db() as con:
        rows = con.execute("""SELECT p.*, (SELECT COUNT(*) FROM notes n WHERE n.patient_id=p.id) note_count
                              FROM patients p WHERE name LIKE ? OR patient_code LIKE ? ORDER BY name""",
                           (f"%{q}%",f"%{q}%")).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/patients")
def add_patient():
    data = request.get_json(force=True)
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error":"Patient name is required"}), 400
    with db() as con:
        code = (data.get("patient_code") or f"PT-{int(datetime.now().timestamp())}").strip()
        try:
            cur = con.execute("INSERT INTO patients(patient_code,name,age,sex,phone,created_at) VALUES(?,?,?,?,?,?)",
                (code,name,data.get("age") or None,data.get("sex") or "",data.get("phone") or "",datetime.now().isoformat(timespec="seconds")))
            row = con.execute("SELECT * FROM patients WHERE id=?",(cur.lastrowid,)).fetchone()
            return jsonify(dict(row)), 201
        except sqlite3.IntegrityError:
            return jsonify({"error":"Patient ID already exists"}), 409

def sentence_matches(text, patterns):
    found = []
    for sentence in re.split(r'(?<=[.!?])\s+|\n+', text):
        if any(re.search(p, sentence, re.I) for p in patterns) and sentence.strip():
            found.append(sentence.strip())
    return " ".join(dict.fromkeys(found))

def process_transcript(text):
    text = (text or "").strip()
    if not text:
        return {"chief_complaint":"","symptoms":"","assessment":"","plan":"",
                "notice":"Enter or record a conversation first."}
    complaint = sentence_matches(text, [r'\bchief complaint\b', r'\bcomplain(?:s|ed|ing)? of\b', r'\bhere for\b', r'\bpain\b'])
    symptoms = sentence_matches(text, [r'\bfever\b',r'\bcough\b',r'\bpain\b',r'\bnausea\b',r'\bvomit',r'\bheadache\b',r'\bdizz',r'\bfatigue\b',r'\bshortness of breath\b',r'\bsymptom'])
    assessment = sentence_matches(text, [r'\bassessment\b',r'\bpossible\b',r'\bsuspect(?:ed)?\b',r'\blikely\b',r'\bdiagnos'])
    plan = sentence_matches(text, [r'\bplan\b',r'\bprescrib',r'\bmedication\b',r'\bfollow.?up\b',r'\breturn\b',r'\border\b',r'\btest\b',r'\bdrink\b',r'\brest\b'])
    if not complaint:
        complaint = text.split(".")[0][:240]
    if not symptoms:
        symptoms = "Review transcript and confirm symptoms with the patient."
    if not assessment:
        assessment = "Clinician review required; no diagnosis inferred by demo mode."
    if not plan:
        plan = "Clinician to enter and confirm the care plan."
    return {"chief_complaint":complaint,"symptoms":symptoms,"assessment":assessment,"plan":plan,
            "notice":"Draft generated with rule-based demo processing. Review and edit every field before use."}

@app.post("/api/process")
def process():
    return jsonify(process_transcript((request.get_json(force=True) or {}).get("transcript","")))

@app.get("/api/patients/<int:patient_id>/notes")
def patient_notes(patient_id):
    with db() as con:
        rows = con.execute("SELECT * FROM notes WHERE patient_id=? ORDER BY visit_date DESC,id DESC",(patient_id,)).fetchall()
    return jsonify([dict(r) for r in rows])

@app.post("/api/notes")
def save_note():
    data = request.get_json(force=True)
    try: patient_id = int(data.get("patient_id"))
    except (TypeError, ValueError): return jsonify({"error":"Select a patient"}), 400
    with db() as con:
        if not con.execute("SELECT id FROM patients WHERE id=?",(patient_id,)).fetchone():
            return jsonify({"error":"Patient not found"}), 404
        cur = con.execute("""INSERT INTO notes(patient_id,visit_date,transcript,chief_complaint,symptoms,assessment,plan,created_at)
            VALUES(?,?,?,?,?,?,?,?)""",
            (patient_id,data.get("visit_date") or datetime.now().strftime("%Y-%m-%d"),
             data.get("transcript",""),data.get("chief_complaint",""),data.get("symptoms",""),
             data.get("assessment",""),data.get("plan",""),datetime.now().isoformat(timespec="seconds")))
        row = con.execute("SELECT * FROM notes WHERE id=?",(cur.lastrowid,)).fetchone()
    return jsonify(dict(row)), 201

@app.get("/api/notes/<int:note_id>/pdf")
def note_pdf(note_id):
    with db() as con:
        row = con.execute("""SELECT n.*,p.name,p.patient_code,p.age,p.sex FROM notes n
                             JOIN patients p ON p.id=n.patient_id WHERE n.id=?""",(note_id,)).fetchone()
    if not row: return jsonify({"error":"Note not found"}),404
    buffer = io.BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 55
    c.setFont("Helvetica-Bold", 17); c.drawString(48,y,"Clinical Documentation Note"); y -= 28
    c.setFont("Helvetica",10)
    lines = [
        f"Patient: {row['name']} ({row['patient_code']})",
        f"Age / Sex: {row['age'] or '—'} / {row['sex'] or '—'}",
        f"Visit date: {row['visit_date']}",
        "", "CHIEF COMPLAINT", row["chief_complaint"] or "—", "",
        "SYMPTOMS / HISTORY", row["symptoms"] or "—", "",
        "ASSESSMENT (CLINICIAN REVIEW REQUIRED)", row["assessment"] or "—", "",
        "PLAN", row["plan"] or "—", "",
        "SOURCE CONVERSATION", row["transcript"] or "—", "",
        "Draft only. Verify all information and clinical decisions before use."
    ]
    for line in lines:
        if y < 55:
            c.showPage(); y = height - 55; c.setFont("Helvetica",10)
        # basic wrap
        chunks = [line[i:i+95] for i in range(0, max(len(line),1), 95)]
        for chunk in chunks:
            c.drawString(48,y,chunk); y -= 15
    c.save(); buffer.seek(0)
    return send_file(buffer, mimetype="application/pdf", as_attachment=True,
                     download_name=f"clinical-note-{note_id}.pdf")

init_db()
if __name__ == "__main__":
    app.run(debug=True, port=5000)
