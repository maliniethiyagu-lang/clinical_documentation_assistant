import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Search, Users, FileText, Plus, Mic, Sparkles, Download, Save, LayoutDashboard, Settings, Stethoscope, Clock3, CheckCircle2, AlertCircle, Menu, X, ChevronRight, ClipboardList } from "lucide-react";
import "./style.css";

const API = "http://127.0.0.1:5000/api";
const blank = { visit_date: new Date().toISOString().slice(0,10), transcript:"", chief_complaint:"", symptoms:"", assessment:"", plan:"" };

function App(){
  const [patients,setPatients] = useState([]);
  const [query,setQuery] = useState("");
  const [selected,setSelected] = useState(null);
  const [notes,setNotes] = useState([]);
  const [note,setNote] = useState(blank);
  const [active,setActive] = useState("Overview");
  const [busy,setBusy] = useState(false);
  const [toast,setToast] = useState("");
  const [showAdd,setShowAdd] = useState(false);
  const [newPatient,setNewPatient] = useState({name:"",patient_code:"",age:"",sex:"",phone:""});
  const [mobileNav,setMobileNav] = useState(false);
  const [apiStatus,setApiStatus] = useState("checking");

  async function loadPatients(q=query){
    try { const r=await fetch(`${API}/patients?q=${encodeURIComponent(q)}`); const d=await r.json(); setPatients(d); setApiStatus("online"); }
    catch { setApiStatus("offline"); setToast("Backend not connected. Start the Flask API."); }
  }
  useEffect(()=>{loadPatients(""); fetch(`${API}/health`).then(r=>r.json()).then(()=>setApiStatus("online")).catch(()=>setApiStatus("offline"));},[]);
  useEffect(()=>{ const t=setTimeout(()=>loadPatients(query),250); return ()=>clearTimeout(t); },[query]);
  useEffect(()=>{ if(selected){fetch(`${API}/patients/${selected.id}/notes`).then(r=>r.json()).then(setNotes).catch(()=>setNotes([]));}},[selected]);
  const stats = useMemo(()=>({patients:patients.length,notes:patients.reduce((n,p)=>n+(p.note_count||0),0),today:patients.filter(p=>p.created_at?.slice(0,10)===new Date().toISOString().slice(0,10)).length}),[patients]);

  function notify(msg){setToast(msg);setTimeout(()=>setToast(""),3200);}
  function update(k,v){setNote(n=>({...n,[k]:v}));}
  async function analyze(){
    if(!note.transcript.trim()){notify("Enter or record the conversation first.");return;}
    setBusy(true);
    try{const r=await fetch(`${API}/process`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transcript:note.transcript})});const d=await r.json();setNote(n=>({...n,...d}));notify("Draft created — review every field.");}
    catch{notify("Could not reach the API. Check that the backend is running.");}
    finally{setBusy(false);}
  }
  async function saveNote(){
    if(!selected){notify("Select a patient before saving.");return;}
    setBusy(true);
    try{const r=await fetch(`${API}/notes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...note,patient_id:selected.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Save failed");setNotes(n=>[d,...n]);setNote(blank);loadPatients(query);notify("Clinical note saved successfully.");}
    catch(e){notify(e.message||"Unable to save note.");}
    finally{setBusy(false);}
  }
  async function addPatient(e){
    e.preventDefault();
    try{const r=await fetch(`${API}/patients`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(newPatient)});const d=await r.json();if(!r.ok)throw new Error(d.error);setShowAdd(false);setNewPatient({name:"",patient_code:"",age:"",sex:"",phone:""});await loadPatients("");setSelected(d);setActive("Documentation");notify("Patient added.");}
    catch(e){notify(e.message||"Could not add patient.");}
  }
  function startRecording(){
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){notify("Speech recognition is not supported in this browser. Try Chrome.");return;}
    const rec=new SR();rec.lang="en-IN";rec.continuous=true;rec.interimResults=true;
    rec.onresult=(event)=>{let text="";for(let i=0;i<event.results.length;i++)text+=event.results[i][0].transcript+" ";setNote(n=>({...n,transcript:text.trim()}));};
    rec.onerror=()=>notify("Microphone access or speech recognition failed.");
    rec.onend=()=>setBusy(false);
    try{rec.start();setBusy(true);notify("Listening… click the microphone again to stop if supported.");}catch{notify("Recording could not start.");}
    window.currentRecognition=rec;
  }
  function toggleMic(){if(window.currentRecognition && busy){window.currentRecognition.stop();window.currentRecognition=null;setBusy(false);}else startRecording();}
  async function downloadPdf(id){
    try{const r=await fetch(`${API}/notes/${id}/pdf`);if(!r.ok)throw new Error();const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`clinical-note-${id}.pdf`;a.click();URL.revokeObjectURL(url);}
    catch{notify("PDF export failed. Check the backend.");}
  }
  const nav=[["Overview",LayoutDashboard],["Patients",Users],["Documentation",FileText]];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav?"mobile-open":""}`}>
      <div className="brand"><div className="brand-icon"><Stethoscope size={22}/></div><div><b>ClinNote<span> AI</span></b><small>Clinical workspace</small></div><button className="close-nav" onClick={()=>setMobileNav(false)}><X/></button></div>
      <div className="nav-label">WORKSPACE</div>
      {nav.map(([label,Icon])=><button key={label} className={`nav-item ${active===label?"selected":""}`} onClick={()=>{setActive(label);setMobileNav(false)}}><Icon size={18}/><span>{label}</span>{label==="Patients"&&<span className="nav-count">{patients.length}</span>}</button>)}
      <div className="sidebar-bottom"><div className="help-card"><div className="help-icon"><Sparkles size={17}/></div><b>AI documentation</b><p>Turn conversations into structured drafts.</p><span className="mode-pill"><span className="status-dot"></span> Demo processing mode</span></div><button className="nav-item" onClick={()=>notify("Settings are not configured in this demo.")}><Settings size={18}/> Settings</button><div className="profile"><div className="avatar">DR</div><div><b>Demo Clinician</b><small>Clinical team</small></div><span className={`connection ${apiStatus}`} title={`API ${apiStatus}`}></span></div></div>
    </aside>
    {mobileNav&&<div className="scrim" onClick={()=>setMobileNav(false)}></div>}
    <main className="main">
      <header className="topbar"><button className="mobile-menu" onClick={()=>setMobileNav(true)}><Menu/></button><div className="crumb">Workspace <ChevronRight size={14}/> <b>{active}</b></div><div className="top-right"><span className="today-label"><Clock3 size={15}/>{new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}</span><div className="avatar small-avatar">DR</div></div></header>
      <div className="page">
        {active==="Overview"&&<><div className="welcome-row"><div><div className="eyebrow">CLINICAL WORKSPACE</div><h1>Good day, Doctor <span className="wave">✦</span></h1><p className="subheading">Your patient records and documentation, all in one place.</p></div><button className="primary-btn" onClick={()=>{setActive("Documentation");setSelected(null);setNote(blank)}}><Plus size={17}/> New clinical note</button></div>
          <div className="stats-grid"><Stat icon={Users} label="Patients in workspace" value={stats.patients} note="Available patient records" tone="blue"/><Stat icon={FileText} label="Clinical notes" value={stats.notes} note="Saved documentation" tone="purple"/><Stat icon={CheckCircle2} label="New patients today" value={stats.today} note="Created today" tone="green"/></div>
          <div className="content-grid"><section className="panel patient-panel"><div className="panel-heading"><div><h2>Patient directory</h2><p>Search and open a patient record</p></div><button className="text-btn" onClick={()=>setActive("Patients")}>View all <ChevronRight size={15}/></button></div><SearchBox query={query} setQuery={setQuery}/><PatientList patients={patients.slice(0,5)} selected={selected} choose={p=>{setSelected(p);setActive("Documentation");setNote(blank)}}/></section>
          <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Start your next task</p></div><div className="quick-spark"><Sparkles size={18}/></div></div><button className="quick-action" onClick={()=>{setActive("Documentation");setNote(blank)}}><div className="qa-icon blue-bg"><FileText/></div><div><b>Create clinical note</b><small>Structure a patient conversation</small></div><ChevronRight size={18}/></button><button className="quick-action" onClick={()=>setShowAdd(true)}><div className="qa-icon green-bg"><Plus/></div><div><b>Add a patient</b><small>Create a new patient profile</small></div><ChevronRight size={18}/></button><div className="privacy-note"><AlertCircle size={16}/><span>Demo only: use fictional data. This app is not a certified medical record system.</span></div></section></div>
          <section className="panel bottom-panel"><div className="panel-heading"><div><h2>Recent patient records</h2><p>Choose a patient to begin documentation</p></div><span className="soft-tag"><Activity size={14}/> Live workspace</span></div><PatientTable patients={patients.slice(0,6)} choose={p=>{setSelected(p);setActive("Documentation");setNote(blank)}}/></section>
        </>}
        {active==="Patients"&&<><div className="welcome-row"><div><div className="eyebrow">PATIENT MANAGEMENT</div><h1>Patient directory</h1><p className="subheading">Search records or add a patient to the workspace.</p></div><button className="primary-btn" onClick={()=>setShowAdd(true)}><Plus size={17}/> Add patient</button></div><section className="panel"><div className="panel-heading"><div><h2>All patients</h2><p>{patients.length} records available</p></div></div><SearchBox query={query} setQuery={setQuery}/><PatientTable patients={patients} choose={p=>{setSelected(p);setActive("Documentation");setNote(blank)}}/></section></>}
        {active==="Documentation"&&<><div className="welcome-row"><div><div className="eyebrow">SMART DOCUMENTATION</div><h1>Clinical note builder</h1><p className="subheading">Capture the conversation, generate a draft, then review and save.</p></div><span className="soft-tag"><Sparkles size={14}/> AI-assisted demo</span></div>
          <div className="documentation-grid"><div className="left-stack"><section className="panel"><div className="panel-heading"><div><h2>1. Select patient</h2><p>Patient details are linked to saved notes</p></div><button className="icon-btn" title="Add patient" onClick={()=>setShowAdd(true)}><Plus size={18}/></button></div><SearchBox query={query} setQuery={setQuery}/><div className="compact-patients">{patients.slice(0,5).map(p=><button key={p.id} className={`compact-patient ${selected?.id===p.id?"active":""}`} onClick={()=>setSelected(p)}><div className="avatar patient-avatar">{p.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div><b>{p.name}</b><small>{p.patient_code} · {p.age||"Age —"} · {p.sex||"—"}</small></div><span className="select-indicator">{selected?.id===p.id?"✓":""}</span></button>)}</div>{selected&&<div className="selected-patient"><CheckCircle2 size={16}/><span>Selected: <b>{selected.name}</b></span></div>}</section>
          <section className="panel history-panel"><div className="panel-heading"><div><h2>Saved notes</h2><p>{selected?`History for ${selected.name}`:"Select a patient to view notes"}</p></div><ClipboardList size={19} className="muted-icon"/></div>{!selected?<div className="empty-state">Choose a patient to load their notes.</div>:notes.length===0?<div className="empty-state">No saved notes yet for this patient.</div>:notes.slice(0,5).map(n=><div className="history-row" key={n.id}><div className="history-file"><FileText size={17}/></div><div className="history-info"><b>{n.chief_complaint||"Clinical note"}</b><small>{n.visit_date}</small></div><button className="icon-btn" onClick={()=>downloadPdf(n.id)} title="Download PDF"><Download size={16}/></button></div>)}</section></div>
          <div className="right-stack"><section className="panel conversation-panel"><div className="panel-heading"><div><h2>2. Patient conversation</h2><p>Paste a transcript or use speech-to-text</p></div><span className="step-badge">INPUT</span></div><div className="transcript-toolbar"><span><span className="record-dot"></span> Conversation transcript</span><button className="mic-btn" onClick={toggleMic}><Mic size={15}/>{busy?"Stop listening":"Record voice"}</button></div><textarea className="transcript-area" value={note.transcript} onChange={e=>update("transcript",e.target.value)} placeholder={"Example: Patient reports headache for two days and mild fever since yesterday. No known allergies reported. Clinician recommends reviewing symptoms, checking temperature, and arranging follow-up if symptoms persist."}/><div className="transcript-foot"><span>{note.transcript.trim()?note.transcript.trim().split(/\s+/).length:0} words</span><button className="clear-btn" onClick={()=>update("transcript","")}>Clear transcript</button></div><button className="ai-btn" onClick={analyze} disabled={busy}><Sparkles size={17}/>{busy?"Processing…":"Generate structured draft"}<ChevronRight size={17}/></button><p className="demo-notice"><AlertCircle size={15}/> Rule-based demo mode. It does not diagnose or replace clinical judgement.</p></section>
          <section className="panel note-panel"><div className="panel-heading"><div><h2>3. Structured clinical note</h2><p>Review and edit every generated field</p></div><span className="step-badge">DRAFT</span></div><label>Visit date<input type="date" value={note.visit_date} onChange={e=>update("visit_date",e.target.value)}/></label><label>Chief complaint<textarea rows="2" value={note.chief_complaint} onChange={e=>update("chief_complaint",e.target.value)} placeholder="Main reason for the visit"/></label><label>Symptoms / history<textarea rows="3" value={note.symptoms} onChange={e=>update("symptoms",e.target.value)} placeholder="Symptoms and relevant history"/></label><label>Assessment<textarea rows="2" value={note.assessment} onChange={e=>update("assessment",e.target.value)} placeholder="Clinician-reviewed assessment"/></label><label>Plan<textarea rows="2" value={note.plan} onChange={e=>update("plan",e.target.value)} placeholder="Next steps and follow-up"/></label><div className="form-actions"><button className="secondary-btn" onClick={()=>setNote(blank)}><X size={16}/> Reset</button><button className="primary-btn" disabled={busy} onClick={saveNote}><Save size={16}/> Save clinical note</button></div><p className="form-disclaimer">Please verify accuracy, completeness, and clinical appropriateness before saving.</p></section></div></div></>}
        <footer className="footer"><span>ClinNote AI <span className="footer-dot">•</span> Hackathon demonstration</span><span>Privacy-first demo · Fictional records only</span></footer>
      </div>
    </main>
    {showAdd&&<div className="modal-backdrop" onClick={()=>setShowAdd(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="modal-heading"><div><h2>Add patient</h2><p>Create a local demo patient record</p></div><button className="icon-btn" onClick={()=>setShowAdd(false)}><X/></button></div><form onSubmit={addPatient}><label>Full name *<input required value={newPatient.name} onChange={e=>setNewPatient({...newPatient,name:e.target.value})} placeholder="Patient name"/></label><div className="form-two"><label>Patient ID<input value={newPatient.patient_code} onChange={e=>setNewPatient({...newPatient,patient_code:e.target.value})} placeholder="Auto-generated if blank"/></label><label>Age<input type="number" min="0" max="120" value={newPatient.age} onChange={e=>setNewPatient({...newPatient,age:e.target.value})} placeholder="Age"/></label></div><div className="form-two"><label>Sex<select value={newPatient.sex} onChange={e=>setNewPatient({...newPatient,sex:e.target.value})}><option value="">Select</option><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></label><label>Phone<input value={newPatient.phone} onChange={e=>setNewPatient({...newPatient,phone:e.target.value})} placeholder="Phone (optional)"/></label></div><div className="form-actions"><button type="button" className="secondary-btn" onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary-btn" type="submit"><Plus size={16}/> Save patient</button></div></form></div></div>}
    {toast&&<div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}
function Stat({icon:Icon,label,value,note,tone}){return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>}
function SearchBox({query,setQuery}){return <div className="search-box"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search by patient name or ID…"/>{query&&<button onClick={()=>setQuery("")}><X size={15}/></button>}</div>}
function PatientList({patients,selected,choose}){if(!patients.length)return <div className="empty-state">No patients found. Try another search.</div>;return <div className="patient-list">{patients.map(p=><button key={p.id} className={`patient-row ${selected?.id===p.id?"active":""}`} onClick={()=>choose(p)}><div className="avatar patient-avatar">{p.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><div className="patient-info"><b>{p.name}</b><small>{p.patient_code} · {p.age||"—"} years · {p.sex||"—"}</small></div><span className="note-count">{p.note_count||0} notes</span><ChevronRight size={16} className="row-chevron"/></button>)}</div>}
function PatientTable({patients,choose}){if(!patients.length)return <div className="empty-state">No patient records found.</div>;return <div className="table-wrap"><table><thead><tr><th>Patient</th><th>Patient ID</th><th>Age / Sex</th><th>Notes</th><th></th></tr></thead><tbody>{patients.map(p=><tr key={p.id} onClick={()=>choose(p)}><td><div className="table-person"><div className="avatar patient-avatar">{p.name.split(" ").map(x=>x[0]).slice(0,2).join("")}</div><b>{p.name}</b></div></td><td><span className="id-tag">{p.patient_code}</span></td><td>{p.age||"—"} / {p.sex||"—"}</td><td>{p.note_count||0}</td><td><button className="open-link" onClick={e=>{e.stopPropagation();choose(p)}}>Open <ChevronRight size={14}/></button></td></tr>)}</tbody></table></div>}
createRoot(document.getElementById("root")).render(<App/>);
