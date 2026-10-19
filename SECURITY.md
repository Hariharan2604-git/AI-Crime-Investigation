# Security Notes

This project is an early local prototype and is **not hardened for network deployment**.

## Safe operation
- Keep the API bound to `127.0.0.1`.
- Do not forward port 8000 or expose the server to a public network.
- Use only footage you have permission to access and process.
- Keep videos, case data, generated evidence images, SQLite databases, and model weights out of Git.
- Do not include sensitive clip details in public issue reports.

## Known gaps

The API does not implement user authentication, authorization roles, rate limiting, encrypted evidence storage, or a production-grade chain of custody. Do not rely on the application as a standalone security or forensic control.

For a code-related issue, report a minimal reproduction without sensitive footage or personal information.
