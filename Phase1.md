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

Requirements below are drawn directly from the Week 2 client Q&A recording
(Allan Browning as client). Where the client's answer implied a design
decision rather than stating it outright, that is captured as an
**Assumption**. Full narrative version: [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md).

### 3.1 Roles & Permissions

| ID | Requirement | Assumption / Notes |
|----|-------------|---------------------|
| R1 | Exactly one Super Admin exists at any time. | Created once via bootstrap; role cannot be duplicated or self-assigned later. |
| R2 | Super Admin is created by a one-time bootstrap process that only runs if the system has zero users. | Bootstrap route/screen must check user count server-side before allowing access, not just hide the UI. |
| R3 | Super Admin creates Groups on request and appoints the requester as that Group's Group Admin. | The "request" is an internal message-queue item, not an open form any user can submit and have auto-approved. |
| R4 | Super Admin can permanently delete a user from the entire system, only on escalation from a Group Admin. | Super Admin cannot ban directly without a Group Admin's request — normal users have no direct line to Super Admin for bans. |
| R5 | Super Admin does not participate in chat and has no access to chat history. | UI must not expose any chat/room views for the Super Admin role. |
| R6 | Group Admin is a normal user with extra permissions scoped to Group(s) they administer; can admin multiple Groups. | Same `User` record/schema as a General User, just with a `groupAdminOf: [groupId]` relationship rather than a separate account type. |
| R7 | Group Admin approves/denies join requests for their Group. | — |
| R8 | Group Admin can ban a user from their own Group only; the user remains in the system and other Groups. | — |
| R9 | Group Admin cannot step down unless another admin is appointed first — a Group must always have ≥1 admin. | UI should disable/hide the "leave admin role" action until a successor is selected. |
| R10 | General User sees nothing until accepted into at least one Group. | On first login post-registration, the only visible content is the full Group list + "request to join" actions. |
| R11 | General User can request to join any Group but not request another user be added. | Only self-service join requests — no "invite someone else" flow. |
| R12 | General User can request a Room be created within a Group they belong to. | Group Admin still performs the actual creation. |

### 3.2 Groups & Rooms

| ID | Requirement | Assumption / Notes |
|----|-------------|---------------------|
| R13 | A Group has: title (max 30 chars), description (max 250 chars), minimum age limit. | Enforced with both client-side form validation and server-side checks. |
| R14 | All Groups are publicly visible in the Group list — no private groups. | No "hidden" or invite-only groups in Phase 1 or 2. |
| R15 | A user can belong to unlimited Groups; no cap on Group membership count. | — |
| R16 | Leaving a Group removes all record of that membership — no "left the group" history kept. | — |
| R17 | A Room belongs to exactly one Group and has its own minimum age limit, set at creation by the Group Admin. | A user meeting the Group's bar may still be blocked from a specific Room if that Room's limit is higher. |
| R18 | Users below a Room's age limit are blocked from entering, with an explanatory notification. | Age check happens server-side (or at minimum re-validated), not just hidden client-side. |
| R19 | No maximum number of members per Group or per Room. | — |

### 3.3 Authentication & Accounts

| ID | Requirement | Assumption / Notes |
|----|-------------|---------------------|
| R20 | Simple username/password auth — explicitly no OAuth, no JWT required. | A basic session/cookie or comparable simple mechanism is sufficient for Phase 1. |
| R21 | Email is the unique identifier for an account; email cannot be changed after registration. | Display name can be changed freely. |
| R22 | Passwords are hashed before storage (e.g. bcrypt) — never stored in plain text. | Applies even in the Phase 1 JSON-file persistence layer, not just once Mongo is introduced. |
| R23 | Password rule: minimum 8 characters, at least 1 uppercase letter. | Enforced client-side for UX and re-validated server-side. |
| R24 | No forgot-password/reset flow — if a password is forgotten, the user creates a new account. | Explicitly ruled out by the client after discussing the complexity of out-of-band recovery. |
| R25 | Required profile fields at registration: email, first name, last name, age, password. | Age is self-reported and unverified — used only for Room age-gating. |

### 3.4 Messaging (Phase 2, documented now for architecture planning)

| ID | Requirement | Assumption / Notes |
|----|-------------|---------------------|
| R26 | Messages support text (no length limit) and images only (PNG, GIF, JPEG, max 2MB) — no voice/video. | File type + size validated server-side on upload, not just via `accept=` on the file input. |
| R27 | Server persists only the last 5 messages per Room; older messages are not retained server-side. | Full scrollback for the current session lives only in-browser memory and is lost on refresh. |
| R28 | Users can delete only their own messages, via a socket broadcast telling connected clients to drop it locally by message ID. | Even messages already outside the server's "last 5" window must still be removable from everyone's live view. |
| R29 | No message editing, threading/replies, typing indicators, read receipts, or hyperlink rendering. | A detected URL is displayed as plain text, not an active link. |
| R30 | Join/leave notifications: every user currently in a Room is notified when someone enters or exits. | Needed because a user can be present ("lurking") without sending any message. |

### 3.5 Administration & Logging

| ID | Requirement | Assumption / Notes |
|----|-------------|---------------------|
| R31 | All administrative actions are logged: user created/deleted, added/removed from a group, group/room created/removed, bans, etc. | Regular chat messages are explicitly excluded from logging. |
| R32 | Super Admin can view and filter logs by type. | Group Admin visibility into logs is not specified by the client — treated as Super-Admin-only unless clarified otherwise. |

### 3.6 UI/UX & Non-functional

| ID | Requirement | Assumption / Notes |
|----|-------------|---------------------|
| R33 | Primary target is desktop; responsive support down to ~tablet width (~768px) earns bonus marks. | Mobile phone widths are not a hard requirement. |
| R34 | No mandated layout, color palette (beyond the provided logo/brand), or CSS framework — Bootstrap is acceptable. | Design freedom left to the student. |
| R35 | English only — no i18n/translation support. | — |
| R36 | Phase 1 persistence is a server-side JSON file; MongoDB is introduced in Phase 2. | Data-access code should be written behind a small abstraction so swapping JSON → Mongo in Phase 2 doesn't require rewriting controllers. |
| R37 | No production deployment expected; app runs locally during development for both phases. | — |

---

## 4. Data Structures

*(Next installment.)*

## 5. Angular Architecture

*(Next installment.)*

## 6. Proposed Server Endpoints

*(Next installment.)*

## 7. Design Documents

*(Next installment — will formalize [docs/WIREFRAME.md](docs/WIREFRAME.md)
into storyboards with a responsive design pass.)*
