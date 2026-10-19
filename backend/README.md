# Backend

The backend provides a local FastAPI API and a video indexer for locally stored MP4 files.

## Index video files

From the repository root, place authorized MP4 clips in `data/videos/` and run:

```bash
source .venv/bin/activate
python backend/app/index_videos.py
```

The indexer also scans `frontend/public/`. It uses Ultralytics YOLO for object detection/tracking, estimates coarse colour cues, creates CLIP embeddings for sampled images, saves selected evidence frames, and stores event records in `data/nigraani.db`. The database filename is retained for compatibility with existing local data.

The first run may download model weights. Processing speed and model results depend on video resolution, available hardware, and library versions.

## Start the API

From the repository root:

```bash
source .venv/bin/activate
uvicorn app.main:app --app-dir backend --reload --host 127.0.0.1 --port 8000
```

Useful local endpoints include `/api/health`, `/api/cameras`, `/api/search`, `/api/alerts`, `/api/audit`, and `/api/integrity/{event_id}`.

## Limitations

- Text-to-frame scores are CLIP cosine similarity, not calibrated confidence probabilities.
- Object-tracking IDs are local to a clip and can split or switch.
- Timestamps are elapsed within a file; separate camera recordings are not synchronized.
- Approximate colour and detector outputs can be wrong.
- Tamil/Hindi query handling is limited keyword logic.
- The API has no authentication. Keep it on `127.0.0.1` and use only authorized footage.
- Hash verification detects changes to stored evidence images; it is not a complete chain-of-custody system.
