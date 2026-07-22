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

Phase 1 persists data as a single server-side JSON file (`db.json`) acting as
a set of collections, structured so the shape maps directly onto future
MongoDB collections in Phase 2 (satisfies R36 — swapping the storage layer
later shouldn't require reshaping the data). All entities use a server-generated
UUID `id` string as their primary key.

### 4.1 `User`

```ts
interface User {
  id: string;
  email: string;              // unique, immutable (R21)
  passwordHash: string;       // bcrypt hash, never plain text (R22)
  firstName: string;
  lastName: string;
  displayName: string;        // editable; defaults to "First Last" (R21)
  age: number;                // self-reported (R25)
  isSuperAdmin: boolean;      // true for exactly one user (R1)
  groupAdminOf: string[];     // Group IDs this user administers (R6)
  groupMemberships: string[]; // Group IDs this user has joined
  avatarUrl: string | null;
  preferences: {
    theme: 'light' | 'dark';
    fontSize: 'small' | 'medium' | 'large';
  };
  createdAt: string;          // ISO 8601
}
```

Note: Group Admin is **not** a separate role enum — it's derived from
`groupAdminOf.length > 0` for a given group, per R6 (a Group Admin is just a
regular user with a scoped extra permission).

### 4.2 `Group`

```ts
interface Group {
  id: string;
  title: string;              // max 30 chars (R13)
  description: string;        // max 250 chars (R13)
  minAge: number;
  backgroundColor: string | null; // hex, optional theme (R13/R34)
  adminIds: string[];         // ≥1 at all times (R9)
  memberIds: string[];
  createdAt: string;
}
```

### 4.3 `Room`

```ts
interface Room {
  id: string;
  groupId: string;            // parent Group (R17)
  name: string;
  minAge: number;             // can exceed the parent Group's minAge (R17)
  createdAt: string;
}
```

### 4.4 `Message` (modelled now, implemented in Phase 2)

```ts
interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderDisplayName: string;  // denormalized for fast render (R uses profile pic + name per message)
  senderAvatarUrl: string | null;
  type: 'text' | 'image';
  content: string;            // text body, or image URL/path
  sentAt: string;
}
```

Only the **5 most recent** `Message` records per `roomId` are retained
server-side (R27) — enforced in the data-access layer (trim-on-insert), not
left to the client.

### 4.5 `Request` (unified admin/approval queue)

The transcript describes several distinct "message queues" (group creation,
group join, room creation, group ban, account deletion escalation). These are
modelled as one collection with a `type` discriminator rather than five
separate tables, since they all share the same request → approve/deny →
resolve lifecycle:

```ts
type RequestType =
  | 'group_creation'   // user -> Super Admin (R3)
  | 'group_join'       // user -> Group Admin (R7, R11)
  | 'room_creation'    // user -> Group Admin (R12)
  | 'group_ban'        // user -> Group Admin, needs reason (R8)
  | 'account_deletion'; // Group Admin -> Super Admin, needs reason (R4)

interface Request {
  id: string;
  type: RequestType;
  requesterId: string;
  targetGroupId: string | null;  // relevant Group, if any
  targetUserId: string | null;   // relevant User being banned/deleted, if any
  payload: Record<string, unknown> | null; // e.g. { title, description, minAge } for group_creation
  reason: string | null;         // required for group_ban / account_deletion
  status: 'pending' | 'approved' | 'denied';
  resolvedBy: string | null;     // admin User id
  createdAt: string;
  resolvedAt: string | null;
}
```

### 4.6 `AdminLogEntry`

```ts
type AdminAction =
  | 'user_created' | 'user_deleted'
  | 'group_created' | 'group_updated'
  | 'group_member_added' | 'group_member_removed' | 'group_member_banned'
  | 'room_created' | 'room_removed';

interface AdminLogEntry {
  id: string;
  action: AdminAction;
  actorId: string;            // who performed it
  targetId: string | null;    // affected User/Group/Room id
  details: string;            // human-readable summary for the log table
  timestamp: string;
}
```

Every administrative action is logged (R31); regular chat messages are
explicitly excluded from this log.

### 4.7 `db.json` top-level shape

```json
{
  "users": [],
  "groups": [],
  "rooms": [],
  "requests": [],
  "adminLogs": [],
  "messages": []
}
```

A small data-access module (`DbService` on the backend) wraps read/write
access to this file so route handlers never touch the filesystem directly —
this is the abstraction point that gets swapped for Mongoose models in Phase 2
without touching controller logic.

## 5. Angular Architecture

Angular 20+ with standalone components (no `NgModule` boilerplate), the
functional router, and `inject()`-based DI throughout. State is kept simple —
component/service `signal`s, no NgRx — appropriate for an app this size.

### 5.1 Component tree

```
AppComponent
├── NavbarComponent            (shown once logged in; hidden on /bootstrap, /login, /register)
├── BootstrapComponent         /bootstrap
├── LoginComponent             /login
├── RegisterComponent          /register
├── GroupListComponent         /groups
│   ├── GroupCardComponent     (repeated: "My Groups" + "All Groups" lists)
│   └── RequestGroupFormComponent  (modal/inline form -> POST group request)
├── GroupViewComponent         /groups/:groupId
│   ├── RoomListItemComponent  (repeated per Room, age-gated "Enter" button)
│   ├── RequestRoomFormComponent
│   └── GroupAdminPanelComponent   (*ngIf isGroupAdmin: join requests, members, edit desc/age)
├── RoomComponent              /groups/:groupId/rooms/:roomId  (placeholder view, Phase 1)
├── ProfileComponent           /profile
│   ├── AvatarUploadComponent
│   └── ChangePasswordFormComponent
├── SuperAdminQueueComponent   /admin/queue        (Super Admin only)
│   ├── GroupRequestsTabComponent
│   └── AccountDeletionRequestsTabComponent
└── AdminLogComponent          /admin/logs         (Super Admin only)
```

Shared/dumb components used across the tree: `ConfirmDialogComponent`,
`ToastComponent` (approve/deny/error feedback), `LoadingSpinnerComponent`.

### 5.2 Services

| Service | Responsibility |
|---|---|
| `AuthService` | Login, register, logout, bootstrap-check, holds current-user `signal`, exposes `isSuperAdmin()` / `isGroupAdminOf(groupId)` helpers. |
| `UserService` | Fetch/update own profile, upload avatar, (Super Admin) list/delete users. |
| `GroupService` | List groups, request creation, join a group (request), leave a group, (Group Admin) update description/age, appoint co-admin. |
| `RoomService` | List rooms for a group, request room creation, (Group Admin) remove room. |
| `RequestQueueService` | Fetch pending `Request` items by type/scope, approve/deny — backs both the Super Admin queue screens and the Group Admin's join/ban request views. |
| `AdminLogService` | Fetch admin log entries, filter by action type. |
| `AuthInterceptor` (HTTP interceptor, not a service) | Attaches session credentials to outgoing requests; redirects to `/login` on 401. |

### 5.3 Models

The `interfaces/` folder mirrors the backend entities defined in
[Section 4](#4-data-structures) directly (`User`, `Group`, `Room`, `Request`,
`RequestType`, `AdminLogEntry`, `AdminAction`) — one shared contract, no
duplicate frontend-only shapes, to avoid drift between what the API returns
and what components expect.

### 5.4 Routing & guards

| Path | Component | Guard |
|---|---|---|
| `/bootstrap` | `BootstrapComponent` | `noUsersGuard` — redirects to `/login` if a Super Admin already exists |
| `/login` | `LoginComponent` | `bootstrapRequiredGuard` — redirects to `/bootstrap` if zero users exist |
| `/register` | `RegisterComponent` | same as above |
| `/groups` | `GroupListComponent` | `authGuard` |
| `/groups/:groupId` | `GroupViewComponent` | `authGuard` |
| `/groups/:groupId/rooms/:roomId` | `RoomComponent` | `authGuard` + `roomAgeGuard` (blocks entry, shows reason, per R18) |
| `/profile` | `ProfileComponent` | `authGuard` |
| `/admin/queue` | `SuperAdminQueueComponent` | `authGuard` + `superAdminGuard` |
| `/admin/logs` | `AdminLogComponent` | `authGuard` + `superAdminGuard` |
| `/**` | redirect | → `/groups` if logged in, else `/login` |

All guards are functional (`CanActivateFn`), injecting `AuthService` to check
session/role state before the route resolves.

## 6. Proposed Server Endpoints

REST API under `/api`, JSON request/response bodies. **Phase** column marks
what's implemented in the Phase 1 prototype vs. deferred to Phase 2 — per the
brief, Phase 2-only endpoints don't need implementing yet, just defining.
Auth uses a simple server-side session (cookie), not JWT (per R20).

### 6.1 Bootstrap & Auth

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| GET | `/api/bootstrap/status` | Whether the system has zero users (drives `/bootstrap` vs `/login` redirect). | 1 |
| POST | `/api/bootstrap` | Create the first user as Super Admin. Rejected if a user already exists. | 1 |
| POST | `/api/auth/register` | Register a new General User. | 1 |
| POST | `/api/auth/login` | Authenticate, start session. | 1 |
| POST | `/api/auth/logout` | End session. | 1 |
| GET | `/api/auth/me` | Current logged-in user + role info. | 1 |

### 6.2 Users

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| GET | `/api/users` | List all users (Super Admin — e.g. to pick a target for deletion). | 1 |
| PUT | `/api/users/me` | Update own display name / avatar. | 1 |
| PUT | `/api/users/me/password` | Change own password (old + new + confirm). | 1 |
| PUT | `/api/users/me/preferences` | Update theme/font-size preferences. | 1 |
| DELETE | `/api/users/:id` | Super Admin permanently deletes a user (only reachable after an approved `account_deletion` request). | 1 |

### 6.3 Groups

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| GET | `/api/groups` | List all groups (visible to everyone, R14). | 1 |
| GET | `/api/groups/:id` | Group details + room list. | 1 |
| PUT | `/api/groups/:id` | Group Admin edits description / min age (not title, R30). | 1 |
| POST | `/api/groups/:id/admins` | Group Admin appoints a co-admin (needed before they can step down, R9). | 1 |
| DELETE | `/api/groups/:id/members/:userId` | Leave a group (self) or Group Admin removes a member post-ban-approval. | 1 |
| POST | `/api/requests/group-creation` | User requests a new Group be created. | 1 |
| POST | `/api/requests/group-join` | User requests to join a Group. | 1 |
| POST | `/api/requests/group-ban` | User requests another member be banned from a Group (with reason). | 1 |
| POST | `/api/requests/account-deletion` | Group Admin escalates a full account-deletion request to Super Admin (with reason). | 1 |
| GET | `/api/requests?type=&status=` | List requests, filterable — backs both the Super Admin queue and Group Admin's pending-requests view. | 1 |
| PUT | `/api/requests/:id/approve` | Approve a pending request (creates the Group/membership/ban/deletion as a side effect). | 1 |
| PUT | `/api/requests/:id/deny` | Deny a pending request. | 1 |

### 6.4 Rooms

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| GET | `/api/groups/:groupId/rooms` | List rooms in a group. | 1 |
| POST | `/api/requests/room-creation` | User requests a new Room in a Group. | 1 |
| DELETE | `/api/rooms/:id` | Group Admin removes a room. | 1 |

### 6.5 Messaging (Phase 2)

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| GET | `/api/rooms/:id/messages` | Last 5 persisted messages for a room (initial load on join, R27). | 2 |
| POST | `/api/rooms/:id/messages/image` | Upload an image attachment (PNG/GIF/JPEG, ≤2MB, R26). | 2 |
| *socket* `join_room` | Join a room's socket channel; broadcasts `user_joined` to others (R30). | 2 |
| *socket* `leave_room` | Leave a room's socket channel; broadcasts `user_left`. | 2 |
| *socket* `send_message` | Broadcast a new text/image message to the room. | 2 |
| *socket* `delete_message` | Broadcast a message-id removal so all connected clients drop it locally (R28). | 2 |

### 6.6 Admin Logging

| Method | Endpoint | Description | Phase |
|---|---|---|---|
| GET | `/api/admin/logs?action=&from=&to=` | Filtered administrative action log (R31, R32). | 1 |

All mutating routes (`POST`/`PUT`/`DELETE`) that represent an administrative
action write an `AdminLogEntry` server-side as part of the same request —
logging is not a separate client-triggered call.

## 7. Design Documents

These storyboards formalize the screen list already scoped in
[docs/WIREFRAME.md](docs/WIREFRAME.md), each shown at the **desktop**
(primary target) and **tablet ~768px** (bonus responsive target, R33)
breakpoints. Two-column desktop layouts collapse to a single stacked column
on tablet — the standard responsive pattern used throughout.

### 7.1 Group List — desktop vs tablet

```
Desktop (≥1024px)                          Tablet (~768px)
┌─────────────────────────────────┐        ┌───────────────────┐
│ Logo   Fabulari      [Avatar ▾] │        │ Logo  Fabulari [≡] │
├───────────┬───────────────────--┤        ├───────────────────┤
│ My Groups │ All Groups          │        │ [My Groups|All ▾] │
│ • Group A │ ┌─────────────────┐ │        │ ┌───────────────┐ │
│ • Group B │ │ Group C   [Join]│ │        │ │ Group A       │ │
│           │ ├─────────────────┤ │        │ ├───────────────┤ │
│ [+Request │ │ Group D   [Join]│ │        │ │ Group B       │ │
│  Group]   │ └─────────────────┘ │        │ └───────────────┘ │
└───────────┴─────────────────────┘        │ [+ Request Group] │
                                            └───────────────────┘
```
Sidebar ("My Groups") becomes a top tab-switcher on tablet instead of a
persistent side column, to preserve width for the list itself.

### 7.2 Group View — desktop vs tablet

```
Desktop                                     Tablet
┌─────────────────────────────────┐        ┌───────────────────┐
│ ← Group A   "General discussion" │        │ ← Group A         │
│ Age limit: 13+                   │        │ Age 13+           │
├───────────────┬───────────────---┤        ├───────────────────┤
│ Rooms         │ Admin panel       │        │ Rooms             │
│ • #general [Enter]                │        │ • #general [Enter]│
│ • #random  [Enter]  (if admin)   │        │ • #random  [Enter]│
│ [+Request Room]│ Pending: 2 [Mngr]│        │ [+ Request Room]  │
└───────────────┴───────────────---┘        │ [Admin panel ▾]   │
                                            └───────────────────┘
```
The admin-only panel (join-request approvals, member/ban management) sits as
a second desktop column but collapses into an expandable section on tablet
rather than disappearing, since a Group Admin still needs it on a tablet.

### 7.3 Room (Phase 1 placeholder) & Profile

```
Room (both breakpoints — single column always, chat is inherently a stream)
┌─────────────────────────────────┐
│ ← #general   👥 3 in room        │
├───────────────────────────────---┤
│ [avatar] Name  12:04   message   │
│ [avatar] Name  12:05   message   │
│  ...(placeholder/mock content    │
│   for Phase 1 — real-time chat   │
│   is Phase 2)                    │
├───────────────────────────────---┤
│ [ type a message...        ][>] │  <- disabled/mock in Phase 1
└─────────────────────────────────┘

Profile (desktop 2-col -> tablet stacked)
Desktop: [Avatar upload] | [Name, email(ro), password form, prefs]
Tablet:  [Avatar upload]
         [Name, email(ro), password form, prefs]  (stacked below)
```

### 7.4 Auth screens (Bootstrap / Login / Register)

Single centered card, identical structure at both breakpoints (card width
caps at ~400px so it never needs a distinct tablet layout):

```
┌───────────────────────┐
│        Fabulari logo  │
│  [ email            ] │
│  [ password         ] │
│      [ Log in ]       │
│   No account? Register│
└───────────────────────┘
```

### 7.5 Super Admin Queue & Admin Log

Both are table-driven screens; on tablet, table rows collapse into stacked
key/value cards (a common responsive-table pattern) rather than horizontal
scrolling, so the primary action (Approve/Deny) stays reachable with one tap.

### 7.6 Navigation flow

See [docs/WIREFRAME.md §"Navigation Flow"](docs/WIREFRAME.md) for the full
screen-to-screen flow diagram — reproduced here as authoritative for Phase 1
scope (Bootstrap → Login/Register → Group List → Group View → Room
placeholder, with Profile and, for Super Admin, the Queue/Log screens
reachable from the nav bar at any time).

### 7.7 Note on fidelity

These are structural/low-fidelity wireframes sufficient to drive Phase 1
component layout decisions. Higher-fidelity mockups (exact spacing, the
provided logo, and brand colors applied) will be produced as the Angular
components are actually built in Weeks 3–4, rather than up front in a
separate design tool — consistent with the client's guidance that layout is
the student's choice with no mandated design tool.
