from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
DB_PATH = DATA / "nigraani.db"
EVIDENCE = DATA / "evidence"

# Load CLIP model for open-vocabulary retrieval
CLIP_MODEL = SentenceTransformer('clip-ViT-B-32')

app = FastAPI(title="Nigaaani AI local video evidence review API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    return db


def initialize_db() -> None:
    with connect() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS events (
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
            );
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                happened_at TEXT NOT NULL,
                action TEXT NOT NULL,
                query_text TEXT,
                result_count INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS alerts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_label TEXT NOT NULL,
                location TEXT,
                time_after TEXT,
                description TEXT NOT NULL,
                is_active INTEGER DEFAULT 1
            );
            """
        )
        columns = {row[1] for row in db.execute("PRAGMA table_info(events)")}
        if "track_id" not in columns:
            db.execute("ALTER TABLE events ADD COLUMN track_id INTEGER")
        if "embedding" not in columns:
            db.execute("ALTER TABLE events ADD COLUMN embedding TEXT")


@app.on_event("startup")
def startup() -> None:
    initialize_db()


class SearchRequest(BaseModel):
    query: str

class AlertRequest(BaseModel):
    object_label: str
    location: str | None = None
    time_after: str | None = None
    description: str

def format_timestamp(seconds: float) -> str:
    whole = max(0, int(seconds))
    return f"{whole // 3600:02d}:{(whole % 3600) // 60:02d}:{whole % 60:02d}"


def log_action(action: str, query: str | None, count: int = 0) -> None:
    with connect() as db:
        db.execute(
            "INSERT INTO audit_log(happened_at, action, query_text, result_count) VALUES (?, ?, ?, ?)",
            (datetime.now(timezone.utc).isoformat(), action, query, count),
        )


@app.get("/api/health")
def health() -> dict[str, str]:
    with connect() as db:
        count = db.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    return {"status": "ready", "indexed_events": str(count)}


@app.get("/api/cameras")
def cameras() -> list[dict[str, str]]:
    with connect() as db:
        rows = db.execute(
            "SELECT camera, camera_id, video_name, COUNT(*) AS event_count FROM events GROUP BY camera, camera_id, video_name ORDER by camera_id"
        ).fetchall()
    return [dict(row) for row in rows]


@app.post("/api/search")
def search(body: SearchRequest) -> dict[str, Any]:
    query = body.query.strip()
    if not query:
        raise HTTPException(400, "Enter a search query.")
    
    q = query.casefold()
    # Handle the counting queries separately as they are structural, not semantic
    count_question = any(term in q for term in [
        "how many people", "number of people", "total people", "people are there",
        "how many persons", "எத்தனை பேர்", "எத்தனை நபர்", "कितने लोग", "कितने व्यक्ति",
    ])
    
    if count_question:
        with connect() as db:
            totals = db.execute(
                """SELECT video_name, camera, camera_id, COUNT(DISTINCT track_id) AS people
                FROM events WHERE object_label = 'person' AND track_id IS NOT NULL
                GROUP BY video_name, camera, camera_id ORDER BY camera_id"""
            ).fetchall()
            per_second = db.execute(
                """SELECT video_name, camera, camera_id, timestamp_seconds,
                COUNT(DISTINCT track_id) AS people
                FROM events WHERE object_label = 'person' AND track_id IS NOT NULL
                GROUP BY video_name, camera, camera_id, timestamp_seconds
                ORDER BY video_name, timestamp_seconds"""
            ).fetchall()
        log_action("person_count", query, sum(row["people"] for row in totals))
        details = [
            {"video_name": row["video_name"], "camera": row["camera"], "camera_id": row["camera_id"], "people": row["people"]}
            for row in totals
        ]
        answer = "No person tracks were indexed yet." if not details else "; ".join(
            f"{row['people']} unique person track(s) in {row['camera']} ({row['video_name']})" for row in details
        )
        return {
            "query": query,
            "answer": answer,
            "count_method": "distinct tracker IDs within each recording",
            "recording_counts": details,
            "per_second_counts": [
                {"video_name": row["video_name"], "camera": row["camera"], "camera_id": row["camera_id"],
                 "time": format_timestamp(row["timestamp_seconds"]), "people": row["people"]}
                for row in per_second
            ],
            "message": "Counts are estimates from video tracking. Track IDs can split or switch; totals are per recording and are not deduplicated across cameras.",
            "results": [],
        }

    # --- OPEN VOCABULARY SEARCH IMPLEMENTATION ---
    
    # 1. Embed the user's text query
    query_embedding = CLIP_MODEL.encode(query, normalize_embeddings=True)
    
    with connect() as db:
        # 2. Fetch all events that have embeddings
        rows = db.execute("SELECT * FROM events WHERE embedding IS NOT NULL").fetchall()
    
    if not rows:
        log_action("search_no_embeddings", query)
        return {"query": query, "results": [], "message": "No indexed moments with embeddings found. Please run the video indexer first."}

    # 3. Compute cosine similarity for all indexed moments
    scored_results = []
    for row in rows:
        # Decode the embedding string back to a numpy array
        event_embedding = np.array(json.loads(row["embedding"]), dtype=float)
        norm = np.linalg.norm(event_embedding)
        if norm == 0:
            continue
        event_embedding = event_embedding / norm
        
        # Cosine Similarity = (A . B) / (||A|| * ||B||)
        # Since CLIP embeddings are normalized, similarity is just the dot product
        similarity = np.dot(query_embedding, event_embedding)
        
        scored_results.append({
            "row": row,
            "similarity": similarity
        })

    # 4. Sort by similarity and take the top matches (e.g., top 20)
    scored_results.sort(key=lambda x: x["similarity"], reverse=True)
    top_matches = scored_results[:20]
    
    # 5. Format the results for the frontend
    results = []
    for match in top_matches:
        row = match["row"]
        confidence = float(match["similarity"])
        
        # Only include matches with a reasonable similarity threshold (e.g., > 0.2)
        if confidence < 0.2:
            continue

        reasons = [
            f"CLIP similarity score: {round(confidence * 100)}%",
            f"Located in {row['camera']}",
            f"Timestamp: {format_timestamp(row['timestamp_seconds'])}",
        ]
        
        # Add specific labels if they exist to help the user
        if row["object_label"] == "person":
            reasons.append("Person detected in frame")
        if row["clothing_color"]:
            reasons.append(f"{row['clothing_color'].capitalize()} clothing detected")

        results.append({
            "id": row["id"], "camera": row["camera"], "camera_id": row["camera_id"],
            "video_name": row["video_name"], "video_url": f"/api/video/{row['video_name']}",
            "seconds": row["timestamp_seconds"],
            "time": format_timestamp(row["timestamp_seconds"]),
            "detail": f"{row['clothing_color'] or 'Colour unclear'} clothing · {row['object_label']} detected",
            "reasons": reasons,
            "similarity_score": round(confidence * 100),
            "score_type": "CLIP cosine similarity (not calibrated confidence)", "evidence_url": f"/api/evidence/{row['evidence_name']}",
            "evidence_sha256": row["evidence_sha256"], "source_sha256": row["source_sha256"],
        })
    
    log_action("semantic_search", query, len(results))
    
    return {
        "query": query, 
        "results": results, 
        "message": None if results else "No moments matched the visual description. Try describing colors or objects differently."
    }


@app.get("/api/audit")
def audit() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute("SELECT happened_at, action, query_text, result_count FROM audit_log ORDER BY id DESC LIMIT 50").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/evidence/{name}")
def evidence(name: str) -> FileResponse:
    if Path(name).name != name:
        raise HTTPException(400, "Invalid evidence name")
    target = EVIDENCE / name
    if not target.is_file():
        raise HTTPException(404, "Evidence image not found")
    return FileResponse(target, media_type="image/jpeg")


@app.get("/api/video/{name}")
def video(name: str) -> FileResponse:
    if Path(name).name != name:
        raise HTTPException(404, "Video file not found")
    candidates = [DATA / "videos" / name, ROOT / "frontend" / "public" / name]
    target = next((path for path in candidates if path.is_file()), None)
    if target is None:
        raise HTTPException(404, "Video file not found")
    return FileResponse(target, media_type="video/mp4")


@app.get("/api/integrity/{event_id}")
def integrity(event_id: int) -> dict[str, Any]:
    with connect() as db:
        row = db.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    if row is None:
        raise HTTPException(404, "Event not found")
    evidence_path = EVIDENCE / row["evidence_name"]
    current = hashlib.sha256(evidence_path.read_bytes()).hexdigest() if evidence_path.is_file() else None
    valid = current == row["evidence_sha256"]
    log_action("integrity_check", f"event:{event_id}", int(valid))
    return {"event_id": event_id, "evidence_hash_matches": valid, "sha256": current}


@app.post("/api/alerts")
def create_alert(alert: AlertRequest) -> dict[str, Any]:
    with connect() as db:
        cursor = db.execute(
            "INSERT INTO alerts(object_label, location, time_after, description) VALUES (?, ?, ?, ?)",
            (alert.object_label, alert.location, alert.time_after, alert.description),
        )
        db.commit()
    return {"status": "Alert created successfully", "id": cursor.lastrowid}


@app.get("/api/alerts")
def list_alerts() -> list[dict[str, Any]]:
    with connect() as db:
        rows = db.execute("SELECT * FROM alerts WHERE is_active = 1").fetchall()
    return [dict(row) for row in rows]


@app.get("/api/check_alerts")
def check_alerts() -> list[dict[str, Any]]:
    with connect() as db:
        alerts = db.execute("SELECT * FROM alerts WHERE is_active = 1").fetchall()
        triggered = []
        for alert in alerts:
            sql = "SELECT * FROM events WHERE object_label = ?"
            args = [alert["object_label"]]
            if alert["location"]:
                sql += " AND camera = ?"
                args.append(alert["location"])
            if alert["time_after"]:
                h, m = map(int, alert["time_after"].split(":"))
                seconds = h * 3600 + m * 60
                sql += " AND timestamp_seconds > ?"
                args.append(seconds)
            
            row = db.execute(sql, args).fetchone()
            if row:
                triggered.append({
                    "alert_id": alert["id"],
                    "description": alert["description"],
                    "camera": row["camera"],
                    "camera_id": row["camera_id"],
                    "time": format_timestamp(row["timestamp_seconds"]),
                    "evidence_url": f"/api/evidence/{row['evidence_name']}",
                    "video_url": f"/api/video/{row['video_name']}",
                    "seconds": row["timestamp_seconds"]
                })
    return triggered

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
