# Fabulari — Phase 1 Documentation

**Name:** I Wayan Rasya Nugraha Kusuma
**Student Number:** s5445871
**Workshop Time:** Wednesday 13:00–15:00

---

## 1. Overview

Fabulari ("to chat" / "to talk" in Latin) is a multi-user, text-and-image chat
application built on the MEAN stack (MongoDB, Express, Angular, Node.js) for
3813ICT Full Stack Development. The application is structured around **Groups**
(broad topic communities) that contain multiple **Rooms** (individual channels
where chatting actually happens). Users self-register, request to join Groups,
and — once accepted — can chat in real time within that Group's Rooms, subject
to per-Room minimum age limits.

The system has three permission levels:

- **Super Admin** — a single, real person created via a one-time bootstrap
  process on first run. Creates Groups on request and has the final say on
  permanently deleting/banning a user from the whole system. Does not chat.
- **Group Admin** — a regular user granted elevated permissions over the
  specific Group(s) they were appointed to (automatically, when their group
  creation request is approved). Approves join requests, manages Rooms, and
  can ban members from their own Group.
- **General User** — registers an account, browses all existing Groups, and
  requests to join them. Can chat once accepted into a Group's Rooms.

Requirements were elicited from a live client Q&A session in the Week 2
lecture (Allan Browning acting as client), recorded and used as the primary
source of truth alongside this specification document. Full detail is in
[docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) and screen planning in
[docs/WIREFRAME.md](docs/WIREFRAME.md).

**Phase 1 scope** (this submission): requirements elicitation, UI/UX design,
Angular architecture planning, and a working prototype covering user
registration/login, the bootstrap process, and group/room creation & join
request flows — persisted to a JSON file on the server. No live chat/socket
functionality is required until Phase 2.

**Phase 2 scope** (future): full real-time chat via Socket.IO, MongoDB
persistence, and all remaining messaging features.

---

## 2. Git Strategy

The project is version-controlled with Git, hosted on GitHub at
[github.com/RasyaNugraha/Assignment](https://github.com/RasyaNugraha/Assignment).
Commits are made under my Griffith student email so authorship is
unambiguous for marking.

### Branching model

A lightweight trunk-based approach, appropriate for a solo assignment where
the goal is to demonstrate meaningful, frequent, traceable commits rather
than coordinate multiple contributors:

- **`main`** — always in a working/demoable state. Every commit here should
  build and run. Tagged at each phase submission (e.g. `phase1-submission`).
- **Feature branches** (`feature/<short-name>`), one per unit of work, e.g.:
  - `feature/bootstrap-flow`
  - `feature/auth-login-register`
  - `feature/group-list-ui`
  - `feature/group-request-approval`
  - `feature/room-crud`
  - `feature/profile-page`
- Work happens on the feature branch, then is merged back into `main` via a
  pull request (self-reviewed, since solo) once that piece works end-to-end.
  This keeps `main`'s history readable and each feature's development
  traceable as its own line of commits.
- **`docs/<short-name>`** branches for larger documentation passes (e.g.
  `docs/phase1-requirements`) when they represent a distinct chunk of work,
  otherwise documentation tweaks are committed straight to the current
  feature branch alongside the code they describe.

### Commit conventions

- Small, frequent commits scoped to one logical change each — not one giant
  commit per session. This is both good practice and satisfies the
  assignment's requirement to show incremental progress over time.
- Conventional prefixes for readability: `feat:`, `fix:`, `docs:`,
  `refactor:`, `chore:`.
- No force-pushes to `main`; history stays intact so progress over the term
  is visible to the marker.

### Why this approach

Given the assignment is individual and marked partly on **git history
demonstrating steady progress** (not just the final code), the priority is:
commit early and often, keep `main` stable, and use branches to keep
in-progress/experimental work from cluttering `main`'s history — rather than
optimizing for a team-scale workflow (no need for strict PR review gates,
CI-gated merges, etc. at this scale).

---

## 3. Specifications & Assumptions

*(Next installment — will convert [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
into the table-layout functional requirements list required here.)*

## 4. Data Structures

*(Next installment.)*

## 5. Angular Architecture

*(Next installment.)*

## 6. Proposed Server Endpoints

*(Next installment.)*

## 7. Design Documents

*(Next installment — will formalize [docs/WIREFRAME.md](docs/WIREFRAME.md)
into storyboards with a responsive design pass.)*
