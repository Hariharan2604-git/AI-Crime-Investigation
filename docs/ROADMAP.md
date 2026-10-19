# Roadmap

The roadmap distinguishes planned improvements from capabilities currently present in code.

## Foundation and reproducibility
- [x] Provide a React + Vite dashboard and FastAPI backend.
- [x] Index local MP4 files and write event metadata to SQLite.
- [x] Store hashes for selected evidence images and expose integrity checks.
- [x] Document local setup, architecture, and responsible-use boundaries.
- [ ] Add automated unit and API-level tests.
- [ ] Pin and audit dependency versions after testing on supported platforms.

## Retrieval quality
- [x] Generate CLIP image embeddings for text-to-frame retrieval.
- [x] Normalize query and image vectors before cosine comparison.
- [ ] Evaluate search quality on a consented, labelled sample set.
- [ ] Record precision/recall and error analysis with a reproducible evaluation protocol.
- [ ] Make score thresholds configurable and document their selection.

## Timeline and camera handling
- [ ] Parse and retain video metadata consistently.
- [ ] Support explicit per-camera timestamp metadata and report when synchronization is unknown.
- [ ] Keep cross-camera grouping as a human-reviewed hypothesis, not automated identity attribution.
- [ ] Add tests for track-ID switches, duplicate detections, and timestamp edge cases.

## Security and usability
- [ ] Add authentication and authorization before any multi-user or network deployment.
- [ ] Improve evidence access controls and audit-log integrity.
- [ ] Add clear empty states when camera clips are not present.
- [ ] Improve accessibility and responsive layout coverage.
- [ ] Add screenshots and a reproducible demo with appropriately licensed/authorized sample clips.

No performance target should be marked complete until it is measured and its evaluation method is documented.
