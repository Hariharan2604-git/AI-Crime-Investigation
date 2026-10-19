# Responsible Use

Nigaaani AI is a learning/hackathon prototype for reviewing authorized video clips. It must not be used as an autonomous forensic decision-maker.

## Human review is mandatory
- Treat detections and retrieval results as candidate leads, not facts.
- Review the original clip, surrounding frames, and independent context before recording findings.
- Do not use similarity scores as probabilities of identity, guilt, or wrongdoing.
- Do not assume a track ID corresponds to a stable identity, especially across separate camera files.
- Do not infer a real-world route from elapsed timestamps across unsynchronized recordings.

## Data privacy and security
- Process only footage you are legally authorized to access.
- Keep the application bound to loopback and do not expose the API to public networks.
- Keep source video, case identifiers, and generated evidence frames out of Git.
- Restrict access to the local machine and secure backups according to applicable policy.
- The prototype has no authentication, role-based access control, encryption-at-rest, or complete evidentiary chain-of-custody process.

## Model limitations

YOLO detection/tracking and CLIP similarity can be affected by occlusion, low resolution, compression, lighting, camera angle, and differences between the footage and model training data. The colour estimator is a coarse image-pixel heuristic. Language support is limited keyword logic, not general translation.

## Appropriate use

Use the application for controlled demonstrations, learning, and supervised exploration. Do not treat its output as proof, use it to make automated decisions about people, or present unvalidated performance claims.
