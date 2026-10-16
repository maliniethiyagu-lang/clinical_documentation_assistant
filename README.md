# ClinNote AI — Clinical Documentation Assistant

A full-stack hackathon demonstration that turns a doctor–patient conversation transcript into an editable, structured clinical-note draft.

## Features
- React + Vite responsive dashboard
- Flask REST API
- SQLite patient and note storage
- Patient search and patient creation
- Rule-based transcript processing (no API key required)
- Web Speech API speech-to-text where browser-supported
- Save structured notes and view patient note history
- Download saved notes as PDF
- Demo seed patients on first run

## Project structure
```text
clinical_documentation_assistant/
  backend/
    app.py
    requirements.txt
  frontend/
    index.html
    package.json
    src/
      main.jsx
      style.css
```

## Run locally

### 1. Start the backend
Python 3.10+ recommended.

```bash
cd backend
python -m venv .venv
```

Windows:
```powershell
.venv\\Scripts\\activate
```

macOS/Linux:
```bash
source .venv/bin/activate
```

Install and run:
```bash
pip install -r requirements.txt
python app.py
```

API runs at `http://127.0.0.1:5000`. SQLite database is created automatically at `backend/clinical.db`.

### 2. Start the frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the local URL printed by Vite (usually `http://localhost:5173`).

## Demo flow
1. Select a seeded patient or add a fictional patient.
2. Open **Documentation**.
3. Enter a sample conversation or use **Record voice** in a supported browser with microphone permission.
4. Select **Generate structured draft**.
5. Review and edit the generated fields.
6. Save the note, then download it from Saved notes as a PDF.

## API endpoints
- `GET /api/health`
- `GET /api/patients?q=search`
- `POST /api/patients`
- `POST /api/process`
- `GET /api/patients/<patient_id>/notes`
- `POST /api/notes`
- `GET /api/notes/<note_id>/pdf`

## Safety and limitations
- This project uses rule-based demo processing, not a medical-grade LLM.
- Generated content is a draft, can be incomplete or incorrect, and must be checked by a qualified clinician.
- It does not diagnose, prescribe, or replace professional judgement.
- Use fictional/sample data only for a college demonstration. Do not enter identifiable real patient information.
- The demo has no authentication, authorization, audit logging, encryption-at-rest, or production-grade privacy controls. Do not deploy it for real clinical use.
- Browser speech recognition support varies; Chrome-based browsers are generally the best demo target.
- The app is configured for local development. For deployment, configure the API base URL, CORS, authentication, and security controls.
