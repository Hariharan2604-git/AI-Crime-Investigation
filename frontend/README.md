# Frontend

React + Vite dashboard for the Nigaaani AI local prototype.

## Run

From the repository root:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://localhost:5173`. Build a static production bundle with `npm run build`.

## Local video files

The seven demo camera tiles point to `/camera_01.mp4` through `/camera_07.mp4`, meaning files placed in `frontend/public/` with those names. These clips are intentionally not committed. If you add footage, ensure you are authorized to use it; root `.gitignore` excludes local MP4s.

The dashboard calls the API at `http://127.0.0.1:8000`. Start the backend separately using [the backend README](../backend/README.md).

## Important note

The dashboard is an investigation-support UI, not an identity-recognition or guilt-assessment tool. A displayed CLIP similarity score ranks text/image similarity; it is not a probability that the match is correct.
