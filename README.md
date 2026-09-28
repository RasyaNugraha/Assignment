# Fabulari

**Name:** I Wayan Rasya Nugraha Kusuma
**Student Number:** s5445871

Multi-user text-and-image chat application built with the MEAN stack (MongoDB, Express, Angular, Node.js)
and Socket.IO for 3813ICT Full Stack Development.

## Status

Phase 2 — fully working app: MongoDB persistence (incl. sessions), real-time chat over Socket.IO
(text + images, last-5 history, delete own messages, join/leave popups, who's online, "is typing…"), live
notifications, group search + pagination, and automated tests (Mocha/Chai/Sinon on the server,
Vitest on the Angular client, Playwright end-to-end).

## Quick start

Needs Node.js 20+ and MongoDB (`mongod`) running on `mongodb://127.0.0.1:27017`.

```bash
cd server && npm install && npm start      # http://localhost:3000
cd client && npm install && npm start      # http://localhost:4200
```

Tests: `cd server && npm test` (integration tests need mongod) · `cd client && npm test` ·
E2E: `cd client && npx playwright install chromium` (once) then `npm run e2e`.
First time with Phase 1 data: `cd server && npm run import-json`.

## Docs

- **[Phase 2 documentation](Phase2.md)** — requirements, REST + Socket.IO API, Angular architecture, design, testing
- [Phase 1 documentation](Phase1.md)
- [Requirements Specification](docs/REQUIREMENTS.md)
- [Screen Planning / Wireframe Notes](docs/WIREFRAME.md)
- [Code Walkthrough (talking points)](docs/CODE_WALKTHROUGH.md)
- [Git Repository & Version Control Approach](docs/GIT_WORKFLOW.md)
- [Data Structures](docs/DATA_STRUCTURES.md)
- [REST API Reference (Phase 1)](docs/REST_API.md) — superseded by Phase2.md §5–6
- [Angular Architecture (Phase 1)](docs/ANGULAR_ARCHITECTURE.md) — superseded by Phase2.md §7

## Phases

- **Phase 1** (Week 7 demo): user registration/login, group & room creation requests, admin approval flows, JSON-file storage.
- **Phase 2** (Week 12 demo): real-time chat via Socket.IO, MongoDB persistence, automated testing.
