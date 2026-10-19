# Nigaaani AI — AI-Assisted Video Evidence Review

**Nigaaani AI** is a local-first, full-stack prototype for indexing authorized video clips, retrieving candidate evidence frames from text descriptions, and organizing results for human review.

This repository contains the React dashboard and Python API/indexing code. It is an academic/hackathon prototype, **not a production forensic system**.

## What the code currently does

- **Video indexing:** scans local MP4 files and samples frames during indexing.
- **Object detection and tracking:** uses Ultralytics YOLO to detect supported objects and track detections within a clip.
- **Text-to-frame retrieval:** creates CLIP embeddings and ranks indexed frames by cosine similarity to a text query.
- **Visual cues:** estimates coarse clothing colour from image pixels; lighting and video quality can affect the estimate.
- **Event store and audit trail:** records indexed observations and local search/integrity activity in SQLite.
- **Evidence integrity check:** stores SHA-256 hashes for saved evidence images and can detect later changes to those images.
- **Rule-based alerts:** filters indexed observations by object label, camera label, and elapsed time.
- **Local dashboard:** a React + Vite interface for reviewing candidate frames, available clips, query results, alerts, and activity.

## Important scope boundaries

This prototype **does not** establish a person's identity, prove guilt, or reliably reconstruct movement across independent cameras. Camera clips are not synchronized to a shared real-world clock. The CLIP score is a retrieval similarity signal, not a calibrated probability. Tamil/Hindi handling is limited keyword matching—not general translation or speech understanding. SHA-256 checks alone do not provide authenticated operators, encrypted evidence storage, or a production chain of custody.

## Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React, JavaScript, Vite, CSS |
| API | Python, FastAPI, Uvicorn, Pydantic |
| Video and vision | OpenCV, Ultralytics YOLO, Pillow |
| Text/image retrieval | SentenceTransformers CLIP model, NumPy |
| Local storage | SQLite, SHA-256 hashing |
| Quality checks | Python syntax compilation, Vite production build via GitHub Actions |

## Repository layout

```text
.
├── backend/
│   ├── app/
│   │   ├── index_videos.py
│   │   └── main.py
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── index.css
│   │   └── main.jsx
│   ├── package.json
│   └── README.md
├── docs/
│   ├── ARCHITECTURE.md
│   ├── RESPONSIBLE_USE.md
│   └── ROADMAP.md
├── CONTRIBUTING.md
└── SECURITY.md
```

## Run locally

### Requirements
- Python 3.11 recommended
- Node.js 22 recommended
- npm
- Internet access on first model run to download model weights

### 1. Install Python dependencies

From the repository root:

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r backend/requirements.txt
mkdir -p data/videos data/evidence
```

On Windows, activate the environment with `.venv\\Scripts\\activate` instead of `source`.

### 2. Add authorized local footage and index it

Place MP4 files you are authorized to process into `data/videos/`. The indexer also scans MP4 files in `frontend/public/`. Video footage, database files, evidence frames, and model weights are intentionally excluded from version control.

```bash
python backend/app/index_videos.py
```

The first run may download YOLO and CLIP model weights and can take time. The indexer creates a local SQLite database and evidence-frame images under `data/`.

The dashboard's seven camera tiles refer to local files `camera_01.mp4` through `camera_07.mp4` in `frontend/public/`. Those files are not bundled; add matching local clips if you want those tiles to play videos. Clips in `data/videos/` can still be indexed and served by the API for result review.

### 3. Start the API

In a second terminal, from the repository root:

```bash
source .venv/bin/activate
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

The interactive API docs are available at [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs), and the health endpoint is [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health).

### 4. Start the frontend

In a third terminal:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open [http://localhost:5173](http://localhost:5173).

### Quality checks

```bash
python -m compileall -q backend
cd frontend
npm ci
npm run build
```

GitHub Actions runs these lightweight checks for pushes and pull requests.

## Documentation
- [Architecture and data flow](docs/ARCHITECTURE.md)
- [Responsible use and limitations](docs/RESPONSIBLE_USE.md)
- [Development roadmap](docs/ROADMAP.md)
- [Contribution guidelines](CONTRIBUTING.md)
- [Security notes](SECURITY.md)

## Privacy and safe use

Run the API on loopback only. Do not expose it to a public network: this prototype does not implement user authentication or production access control. Use only footage you are authorized to process, keep case data off Git, and review every candidate against the original source material.
