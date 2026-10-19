from __future__ import annotations

import hashlib
import sqlite3
import json
from datetime import datetime, timezone
from pathlib import Path

import cv2
import numpy as np
from ultralytics import YOLO
from sentence_transformers import SentenceTransformer
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
DB_PATH = DATA / "nigraani.db"
EVIDENCE = DATA / "evidence"
VIDEO_DIRS = [DATA / "videos", ROOT / "frontend" / "public"]
SUPPORTED = {"person", "car", "motorcycle", "bus", "truck", "backpack", "handbag", "suitcase"}

# Load CLIP model for open-vocabulary embeddings
# clip-ViT-B-32 is a good balance of speed and accuracy
CLIP_MODEL = SentenceTransformer('clip-ViT-B-32')

def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def ensure_schema(db: sqlite3.Connection) -> None:
    db.execute(
        """CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            camera TEXT NOT NULL,
            camera_id TEXT NOT NULL,
            video_name TEXT NOT NULL,
            timestamp_seconds REAL NOT NULL,
            object_label TEXT NOT NULL,
            clothing_color TEXT,
            model_confidence REAL NOT NULL,
            evidence_name TEXT NOT NULL,
            evidence_sha256 TEXT NOT NULL,
            source_sha256 TEXT NOT NULL,
            indexed_at TEXT NOT NULL,
            track_id INTEGER,
            embedding TEXT
        )"""
    )
    columns = {row[1] for row in db.execute("PRAGMA table_info(events)")}
    if "track_id" not in columns:
        db.execute("ALTER TABLE events ADD COLUMN track_id INTEGER")
    if "embedding" not in columns:
        db.execute("ALTER TABLE events ADD COLUMN embedding TEXT")

def estimate_color(crop: np.ndarray) -> tuple[str, float]:
    if crop.size == 0:
        return "unknown", 0.0
    hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
    h, s, v = [float(x) for x in np.median(hsv.reshape(-1, 3), axis=0)]
    if v < 45:
        return "black", 0.62
    if s < 35:
        return ("white" if v > 180 else "unknown"), min(0.75, 0.45 + v / 600)
    if h < 10 or h >= 170:
        color = "red"
    elif h < 22:
        color = "orange"
    elif h < 35:
        color = "yellow"
    elif h < 85:
        color = "green"
    elif h < 132:
        color = "blue"
    else:
        color = "purple"
    return color, min(0.82, 0.50 + s / 500)

def camera_details(path: Path) -> tuple[str, str]:
    name = path.stem.casefold()
    if "gate" in name or "mixkit" in name:
        return "Main Gate", "CAM-01"
    stable_id = int(hashlib.sha1(path.name.encode()).hexdigest()[:4], 16) % 90 + 10
    return path.stem.replace("_", " ").replace("-", " ").title(), f"CAM-{stable_id:02d}"

def main() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    files = sorted({p.resolve() for folder in VIDEO_DIRS if folder.exists() for p in folder.glob("*.mp4")})
    if not files:
        print(f"No MP4 files found. Add footage to {DATA / 'videos'}")
        return

    print(f"Loading detector and CLIP model for {len(files)} video(s).")
    model = YOLO("yolo11n.pt")
    saved = 0
    with sqlite3.connect(DB_PATH) as db:
        ensure_schema(db)
        db.execute("DELETE FROM events")
        for path in files:
            camera, camera_id = camera_details(path)
            source_hash = sha256_file(path)
            capture = cv2.VideoCapture(str(path))
            fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
            frame_count = capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0
            duration = frame_count / fps if fps else 0
            stride = max(1, round(fps / 5))
            print(f"Tracking {path.name} ({duration:.1f}s)")
            frame_index = 0
            per_second: dict[tuple[int, int, str], dict] = {}
            while capture.isOpened():
                ok, frame = capture.read()
                if not ok:
                    break
                if frame_index % stride == 0:
                    second = frame_index / fps
                    result = model.track(
                        frame, persist=True, tracker="bytetrack.yaml", imgsz=640,
                        conf=0.15, verbose=False,
                    )[0]
                    boxes = result.boxes
                    if boxes is not None and boxes.id is not None:
                        track_ids = boxes.id.int().cpu().tolist()
                        for box, track_id in zip(boxes, track_ids):
                            label = model.names[int(box.cls.item())]
                            if label not in SUPPORTED:
                                continue
                            x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                            top = max(y1, 0)
                            left = max(x1, 0)
                            crop = frame[top:top + max(1, int((y2 - y1) * 0.48)), left:left + max(1, x2 - x1)]
                            
                            # CLIP Embedding for the crop
                            # Convert BGR to RGB and then to PIL Image
                            crop_rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)
                            pil_img = Image.fromarray(crop_rgb)
                            embedding = CLIP_MODEL.encode(pil_img, normalize_embeddings=True).tolist()
                            
                            color, color_quality = estimate_color(crop) if label == "person" else (None, 1.0)
                            detector_score = float(box.conf.item())
                            score = detector_score * color_quality if color else detector_score
                            second_bucket = int(second)
                            key = (second_bucket, int(track_id), label)
                            current = per_second.get(key)
                            if current is None or detector_score > current["detector_score"]:
                                per_second[key] = {
                                    "track_id": int(track_id), "timestamp": float(second_bucket),
                                    "label": label, "color": color, "score": score,
                                    "detector_score": detector_score, "frame": frame.copy(),
                                    "embedding": embedding,
                                }
                frame_index += 1
            capture.release()

            for (second_bucket, track_id, label), item in per_second.items():
                evidence_name = f"{source_hash[:10]}_{second_bucket}_{track_id}_{label}.jpg"
                evidence_path = EVIDENCE / evidence_name
                cv2.imwrite(str(evidence_path), item["frame"])
                evidence_hash = sha256_file(evidence_path)
                db.execute(
                    """INSERT INTO events(camera, camera_id, video_name, timestamp_seconds,
                    object_label, clothing_color, model_confidence, evidence_name,
                    evidence_sha256, source_sha256, indexed_at, track_id, embedding)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                    (camera, camera_id, path.name, item["timestamp"], label, item["color"],
                     item["score"], evidence_name, evidence_hash, source_hash,
                     datetime.now(timezone.utc).isoformat(), track_id, json.dumps(item["embedding"])),
                )
                saved += 1
            print(f"  Saved {len(per_second)} per-second tracked moments")
    print(f"Index complete. Saved {saved} moments to {DB_PATH}")

if __name__ == "__main__":
    main()
