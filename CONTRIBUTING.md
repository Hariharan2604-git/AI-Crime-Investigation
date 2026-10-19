# Contributing

Thanks for helping improve Nigaaani AI. This is an early-stage local prototype; please keep contributions small, testable, and explicit about limitations.

## Before opening a change
1. Explain the problem and intended behavior.
2. Avoid committing CCTV footage, generated evidence frames, local databases, model weights, secrets, or personal data.
3. Keep similarity scores clearly distinguished from calibrated probabilities.
4. Do not claim cross-camera identity matching or benchmark performance unless implemented and reproducibly evaluated.

## Local checks

```bash
python -m compileall -q backend
cd frontend
npm ci
npm run build
```

## Pull request checklist
- [ ] The change includes clear context and a focused scope.
- [ ] Setup or API documentation is updated where needed.
- [ ] Privacy, misuse, and model limitations are considered.
- [ ] Validation results are described accurately.
