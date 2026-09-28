# Fabulari — Phase 2 Documentation

**Name:** I Wayan Rasya Nugraha Kusuma
**Student Number:** s5445871
**Workshop Time:** Wednesday 13:00–15:00
**Repository:** [github.com/RasyaNugraha/Assignment](https://github.com/RasyaNugraha/Assignment)

---

## Contents

1. [Overview & what changed since Phase 1](#1-overview--what-changed-since-phase-1)
2. [Running the application](#2-running-the-application)
3. [Specifications / Requirements](#3-specifications--requirements)
4. [Server architecture & data (MongoDB)](#4-server-architecture--data-mongodb)
5. [API documentation — REST](#5-api-documentation--rest)
6. [API documentation — Socket.IO (real-time chat)](#6-api-documentation--socketio-real-time-chat)
7. [Angular architecture — components, services, models, routes](#7-angular-architecture--components-services-models-routes)
8. [Design documents (updated)](#8-design-documents-updated)
9. [Testing — tools, methodology and automated test list](#9-testing--tools-methodology-and-automated-test-list)
10. [Git usage in Phase 2](#10-git-usage-in-phase-2)
11. [Known limitations](#11-known-limitations)

---

## 1. Overview & what changed since Phase 1

Fabulari is a multi-user, text-and-image chat application built on the MEAN
stack (MongoDB, Express, Angular 20, Node.js) with Socket.IO for real-time
communication. Users belong to **Groups**; each Group contains **Rooms**
(channels) where the chat happens. There are three permission levels — Super
Admin, Group Admin and General User — described in §3.

Phase 1 delivered the requirements, design, and a prototype whose data lived
in a JSON file on the server, with a placeholder chat screen. Phase 2 turns
that prototype into a fully working application:

| Area | Phase 1 | Phase 2 |
|------|---------|---------|
| Persistence | `server/data/db.json` (read/write the whole file) | **MongoDB** (`fabulari` database, official `mongodb` Node driver), indexed collections, atomic updates |
| Chat | Static mock messages, disabled input | **Real-time chat over Socket.IO**: text + images, last-5 history, delete-own-message broadcast, join/leave popups |
| Room management | Rooms could be created (via request) | Group Admin can also **remove** a Room (anyone inside is notified and moved out) |
| Moderation | Group Admin ban, account-deletion escalation | + **members can report another member** to the Group Admin (ban request with reason) |
| Code structure | `server.js` built and started the app; helpers duplicated per route file | `app.js` (builds app) / `server.js` (starts it), shared `services/` modules — testable in isolation |
| Sessions | In server memory (lost on restart) | **Stored in MongoDB** (`sessions` collection via `connect-mongo`) — a restart doesn't log anyone out |
| Large data sets | Every group shown at once | **Search + filter + pagination** for the group list and the admin log (MongoDB `skip`/`limit`) |
| Other real-time features | — | **Who's online** list in each room, **live notifications** ("your request was approved"), **live pending-request badge** and admin queues that refresh themselves |
| UI polish | Static | Angular `animate.enter` animations (messages, cards, popups), skip link, visible focus, reduced-motion support |
| Testing | None | **318 automated tests**: Mocha + assert + Sinon (server unit), Mocha + Chai + chai-http + socket.io-client against a test MongoDB (server integration), Vitest + TestBed (Angular, every component and service), **Playwright E2E** |

The data-access module (`services/dbService.js`) kept the **same function
names** as Phase 1 (`getAll`, `findById`, `findOne`, `findMany`, `insert`,
`update`, `remove`, `logAdminAction`) — exactly the abstraction Phase 1
planned for (R36). Moving to MongoDB therefore meant making each function an
`async` MongoDB query and adding `await` in the routes, rather than rewriting
the route logic.

---

## 2. Running the application

**Prerequisites:** Node.js 20+ and MongoDB Community Server with `mongod`
running on `mongodb://127.0.0.1:27017` (MongoDB Compass optional, for viewing
the data).

```bash
# 1. Server (port 3000)
cd server
npm install
npm run import-json   # optional, one-off: copies Phase 1 data from data/db.json into MongoDB
npm start             # "Connected to MongoDB: fabulari" + "Fabulari server listening..."

# 2. Client (port 4200) — in a second terminal
cd client
npm install
npm start             # ng serve, proxies /api and /socket.io to :3000

# 3. Tests
cd server && npm test        # unit + integration (integration needs mongod running)
cd client && npm test        # Angular unit tests (Vitest)

# 4. End-to-end tests (Playwright) — needs mongod; starts its own server + client
cd client
npx playwright install chromium   # one time only, downloads the test browser
npm run e2e
```

Useful extras: `npm run reset-db` (server) drops the `fabulari` database, so
the app shows the bootstrap (create Super Admin) screen again.

Configuration can be overridden with environment variables (`server/config.js`):
`PORT`, `MONGO_URI`, `DB_NAME`, `SESSION_SECRET`, `MESSAGE_SECRET`, `CLIENT_ORIGIN`.

---

## 3. Specifications / Requirements

Requirements were elicited from the Week 2 client session (Allan Browning as
client) and documented in Phase 1 (full narrative: `docs/REQUIREMENTS.md`).
The table below repeats every requirement with its **Phase 2 status** and
where it is implemented. "Server" means the rule is enforced server-side (the
client may also check it for fast feedback, but the server is the authority).

### 3.1 Roles & permissions

| ID | Requirement | Status | Implementation |
|----|-------------|--------|----------------|
| R1 | Exactly one Super Admin exists. | ✅ | Created only by bootstrap; no endpoint can grant `isSuperAdmin`. |
| R2 | Super Admin is created by a one-time bootstrap that only runs when there are zero users. | ✅ Server | `POST /api/bootstrap` counts users in MongoDB (`409` once any exist); `LoginComponent` redirects to `/bootstrap` when `needsBootstrap`. |
| R3 | Super Admin creates Groups on request and appoints the requester as Group Admin. | ✅ Server | `group_creation` request → Super Admin approves in Admin Queue → group created with requester in `adminIds`. |
| R4 | Super Admin permanently deletes a user only on escalation from a Group Admin. | ✅ Server | `account_deletion` request (Group Admin, with reason) → Super Admin approves → user removed from every Group (`updateMany` + `$pull`) and deleted. |
| R5 | Super Admin does not chat and has no access to chat history. | ✅ Server | `checkRoomAccess()` rejects the Super Admin for room entry, history and every socket event; "Enter" buttons hidden for the Super Admin. |
| R6 | Group Admin is a normal user with scoped permissions; can admin several Groups. | ✅ | `groupAdminOf[]` on the user, `adminIds[]` on the group. |
| R7 | Group Admin approves/denies join requests for their Group. | ✅ Server | `canResolve()` only lets admins of *that* group resolve `group_join`. |
| R8 | Group Admin can ban a user from their Group only. | ✅ Server | `POST /groups/:id/ban` (direct) or approving a member's `ban_request`; user added to `bannedIds`, cannot request to rejoin. |
| R9 | A Group must always have ≥1 admin; an admin can appoint co-admins. | ✅ Server | `POST /groups/:id/admins`; sole admin gets `409` on leave. |
| R10 | A General User sees nothing until accepted into a Group. | ✅ | Group list shows only join actions; rooms need membership (`checkRoomAccess`). |
| R11 | Users request to join for themselves only. | ✅ | Join endpoint always uses the logged-in user. |
| R12 | Members can request a Room; Group Admin creates it. | ✅ Server | `room_creation` request → Group Admin approves. |
| R12a | *(Phase 2)* A member can request another member be banned, with a reason, sent to the Group Admin. | ✅ Server | `POST /groups/:id/ban-requests` → `ban_request` in the Group Admin's queue ("Ban reports from members"). |

### 3.2 Groups & Rooms

| ID | Requirement | Status | Implementation |
|----|-------------|--------|----------------|
| R13 | Group: title ≤30 chars, description ≤250 chars, minimum age. | ✅ Server | Validated on request + `PATCH`; the title can never be changed (`400`). |
| R14 | All Groups are public. | ✅ | `GET /api/groups` needs no login. |
| R15 | Unlimited Group memberships. | ✅ | No cap. |
| R16 | Leaving a Group removes the membership entirely. | ✅ Server | `$pull` from `memberIds`/`adminIds` and the user's lists. |
| R17 | A Room belongs to one Group and has its own minimum age. | ✅ | `rooms.groupId`, `rooms.minAge`. |
| R18 | Users below a Room's age limit are blocked with an explanation. | ✅ Server | `checkRoomAccess()` (REST + socket `room:join`); client redirects with "You must be at least N…" banner. |
| R19 | No member limits. | ✅ | — |
| R19a | *(Phase 2)* Group Admin can remove a Room. | ✅ Server | `DELETE /groups/:gid/rooms/:rid` deletes the room + its stored messages, logs it, emits `room:removed`. |

### 3.3 Authentication & accounts

| ID | Requirement | Status | Implementation |
|----|-------------|--------|----------------|
| R20 | Simple username/password, no OAuth/JWT. | ✅ | `express-session` cookie; the same session authenticates Socket.IO connections. |
| R21 | Email is the unique, unchangeable identifier; display name editable. | ✅ Server | Unique MongoDB index on `users.email`; only `displayName` is editable. |
| R22 | Passwords hashed. | ✅ | bcrypt (`bcryptjs`, cost 10); hash never leaves the server (`toPublicUser`). |
| R23 | Password ≥8 chars with an uppercase letter. | ✅ Server | `isValidPassword()` (unit tested). |
| R24 | No password reset. | ✅ | Not implemented, by design. |
| R25 | Registration needs email, first/last name, date of birth, password; age derived from DOB. | ✅ Server | `validateRegistrationFields()`, `computeAge()`; age computed per response, never stored. |

### 3.4 Messaging (implemented in Phase 2)

| ID | Requirement | Status | Implementation |
|----|-------------|--------|----------------|
| R26 | Text (no length limit) and images (PNG/GIF/JPEG, ≤2MB) only. | ✅ Server | `validateMessagePayload()` checks type + decoded size server-side; the client checks the same rules before sending (`validateChatImage`). |
| R27 | Server keeps only the last 5 messages per Room; the rest of the session scrollback lives in the browser. | ✅ Server | After every insert, `trimRoomMessages()` deletes all but the newest 5 (ordered by a strictly increasing `seq`). `RoomComponent` keeps everything seen during the visit. |
| R28 | Users delete only their own messages — even ones no longer on the server — via a socket broadcast. | ✅ Server | Message ids are signed with the sender's id (HMAC), so ownership can be verified without the message still existing; `message:deleted` is broadcast to the room. |
| R29 | No editing, threads, typing indicators, read receipts or link rendering. | ✅ | Text is rendered as plain text (Angular interpolation), never as HTML/links. |
| R30 | Everyone in a Room is notified when someone enters or leaves. | ✅ | `room:user-joined` / `room:user-left` (also on tab close/disconnect) → popup toast. |
| R30a | Each message shows the sender's profile picture and timestamp. | ✅ | `GET /api/users/:id/avatar` image (browser-cached) + `sentAt` = when "Send" was pressed. |

### 3.5 Administration & logging

| ID | Requirement | Status | Implementation |
|----|-------------|--------|----------------|
| R31 | All administrative actions are logged (not chat messages). | ✅ Server | `logAdminAction()` for user created/deleted, group created/updated/left, join approved, admin appointed, bans, room created/removed, denials. |
| R32 | Super Admin can view and filter logs by type. | ✅ Server | `GET /api/admin/logs?action=&from=&to=` — filtered and sorted inside MongoDB. |

### 3.6 UI/UX & non-functional

| ID | Requirement | Status | Implementation |
|----|-------------|--------|----------------|
| R33 | Desktop first; responsive down to ~768px (bonus). | ✅ | Two-column layouts collapse at 768px; chat screen fills the viewport height. |
| R34 | Design freedom; brand colours from the provided logo. | ✅ | CSS custom properties (`--color-navy/blue/yellow/coral`). |
| R35 | English only. | ✅ | — |
| R36 | Phase 2 persistence in MongoDB behind an abstraction. | ✅ | `services/dbService.js`. |
| R37 | Runs locally, no deployment. | ✅ | — |
| R38 | *(Phase 2)* Usability & accessibility. | ✅ | Labels on every input, `aria-live` regions for new messages, online list and popups, `role="alert"` on errors, skip-to-content link, visible keyboard focus, `prefers-reduced-motion` turns animations off, Enter-to-send / Shift+Enter new line, alt text on images, no browser `confirm()` popups (two-step "Remove → Confirm remove?" instead). |
| R39 | *(Phase 2)* Works with large data sets. | ✅ Server | Group list: search (title/description), max-age filter, "my groups" and pages of 9 (`skip`/`limit`, regex input escaped). Admin log: pages of 20, action types from `distinct`. |
| R40 | *(Phase 2)* Real-time updates beyond chat. | ✅ | Socket events `room:members` (who's online), `notification` (request approved/denied → popup), `requests:changed` (badge + admin queues refresh). |
| R41 | *(Phase 2)* Fault tolerant input. | ✅ Server + client | Every field type-checked on the server (a number/array/object where text is expected → `400`, never a crash); broken JSON → `400`; client checks the same rules first and shows the server's message when it still fails; approving twice at the same time only applies once. |
| R42 | *(Phase 2)* Show when someone is typing in a room. | ✅ | Socket event `room:typing`; the Room page shows "Bob is typing…" / "Bob and Carol are typing…" above the message box. |

---

## 4. Server architecture & data (MongoDB)

### 4.1 File structure

```
server/
├── server.js              entry point: connect MongoDB → createServer() → listen
├── app.js                 createApp(): Express app (middleware + routes + error handler), no listen()
├── config.js              port, Mongo URI/db name, secrets (env-overridable)
├── middleware/
│   └── requireAuth.js     401 unless logged in; loads req.currentUser from MongoDB
├── routes/                REST endpoints (§5)
│   ├── auth.js            bootstrap, register, login, logout, me
│   ├── users.js           profile self-service + avatar image
│   ├── groups.js          groups, rooms, membership, bans, room removal, message history
│   ├── requests.js        unified approval queue
│   └── adminLogs.js       admin log (Super Admin)
├── sockets/
│   ├── chat.js            Socket.IO chat handlers (§6)
│   └── notify.js          helpers so REST routes can push live updates
├── services/
│   ├── dbService.js       MongoDB connection + data-access functions + indexes
│   ├── userUtils.js       computeAge, toPublicUser, password/registration validation (pure)
│   ├── messageUtils.js    message validation, timestamps, signed message ids (pure)
│   ├── roomAccess.js      checkRoomAccess(): one rule for REST and sockets
│   └── paging.js          parsePaging, escapeRegex, buildGroupFilter (search + pages)
├── scripts/
│   ├── import-json.js     one-off Phase 1 db.json → MongoDB migration
│   └── reset-db.js        drop the database (re-triggers bootstrap)
├── unitTest/              Mocha unit tests (§9)
└── integrationTest/       Mocha + Chai integration tests (§9)
```

**Why `app.js` and `server.js` are separate:** `createApp()` builds the
Express app without starting it, and `createServer()` wires Express and
Socket.IO onto one HTTP server. The integration tests import these directly
and run them against a test database — the Week 10 "testable code" principle
of separating *building* the app from *running* it.

**Connection handling:** `dbService.connect()` is called once at start-up and
the driver's connection pool is reused for every request (opening a client per
request would be slow). If MongoDB is not running, the server prints a clear
message and exits instead of starting in a broken state.

**Errors:** Express 5 forwards errors thrown in `async` handlers to the error
middleware in `app.js`, which returns JSON (`500 {"error": "..."}`); socket
handlers are wrapped so an error becomes `{ ok: false, error }` in the
acknowledgement rather than crashing the server.

### 4.2 Collections

Database: **`fabulari`** (tests use a separate **`fabulari_test`**). Every
document keeps the app-level string **`id`** (UUID) from Phase 1 as its
primary key — sessions, Angular routes and all cross-references
(`memberIds`, `groupId`, …) use it. MongoDB's own `_id` still exists but is
projected out of every query result so API responses have the same shape as
Phase 1.

```ts
// users
{ id, email /*unique*/, passwordHash, firstName, lastName, displayName,
  dateOfBirth /* ISO date — age is computed, never stored */,
  isSuperAdmin, groupAdminOf: string[], groupMemberships: string[],
  avatarUrl: string|null /* base64 data URL, ≤2MB */,
  preferences: { theme: 'light'|'dark', fontSize: 'small'|'medium'|'large' },
  createdAt }

// groups
{ id, title /*≤30*/, description /*≤250*/, minAge, backgroundColor,
  adminIds: string[] /*≥1*/, memberIds: string[], bannedIds: string[], createdAt }

// rooms
{ id, groupId, name /*≤30*/, minAge, createdAt }

// messages  — at most 5 per room
{ id /* "<uuid>.<hmac of sender>" */, roomId, groupId, senderId,
  senderDisplayName, senderHasAvatar, text, imageUrl: string|null,
  sentAt /* when Send was pressed */, seq /* strictly increasing order key */ }

// requests  — one queue, discriminated by `type`
{ id, type: 'group_creation'|'group_join'|'room_creation'|'ban_request'|'account_deletion',
  requesterId, status: 'pending'|'approved'|'denied',
  groupId?, targetUserId?, title?, description?, name?, minAge?, reason?,
  createdAt, resolvedAt, resolvedBy }

// adminLogs
{ id, action, actorId, targetId, details, timestamp }

// sessions  — managed by connect-mongo (login sessions, auto-expire after 1 day)
{ _id: <session id>, expires, session: { cookie, userId } }
```

### 4.3 Indexes (`dbService.ensureIndexes()`, created at start-up)

| Collection | Index | Purpose |
|------------|-------|---------|
| all | `{ id: 1 }` unique | Primary-key lookups (`findById`) |
| users | `{ email: 1 }` unique | R21 — the database itself rejects a duplicate email, even if two registrations race each other |
| rooms | `{ groupId: 1 }` | Rooms of a group |
| requests | `{ status: 1, type: 1 }` | Pending queue |
| messages | `{ roomId: 1, seq: -1 }` | Newest-5 query + trimming |
| adminLogs | `{ timestamp: -1 }` | Newest-first log |

### 4.4 Design decisions

- **Atomic updates.** Membership changes use MongoDB operators (`$addToSet`,
  `$pull`, `updateMany`) instead of reading an array, editing it in
  JavaScript and writing it back — so two admins acting at the same moment
  cannot overwrite each other.
- **Images in documents.** Chat images and avatars are ≤2MB, well inside
  MongoDB's 16MB document limit, so they are stored as base64 data URLs
  without GridFS. Avatars are served as real images by
  `GET /api/users/:id/avatar`, so a message only carries a
  `senderHasAvatar` flag and the browser caches each picture once.
- **Last 5 messages.** Messages are ordered by `seq`, a strictly increasing
  number (never two equal values even within the same millisecond), so
  "keep the newest 5" is always well-defined.
- **Deleting messages that are no longer stored (R28).** The message id is
  `<uuid>.<HMAC(uuid:senderId)>`. To delete, the server recomputes the HMAC
  for the requesting user; only the real sender produces a match. This
  proves ownership of *any* message id without keeping old messages on the
  server, which the spec says not to do.
- **One access rule.** `checkRoomAccess()` (not Super Admin → group exists →
  room exists → is a member → old enough) is shared by the REST routes and the
  socket handlers, so HTTP and real-time can never disagree.
- **Sessions in MongoDB.** `connect-mongo` stores login sessions in the `sessions`
  collection, so restarting the server doesn't log everyone out. The same
  session middleware is used by Socket.IO.
- **Pagination.** `findPage()` runs `find().sort().skip().limit()` and
  `countDocuments()` together (Week 8), so a page of 9 groups never loads the
  whole collection. Search text is regex-escaped so input like `.*` is treated
  as plain text.
- **No double approve.** Approving/denying first flips the request from
  `pending` in one atomic `findOneAndUpdate({ id, status: 'pending' })`; a
  second click at the same moment gets `409` instead of adding the user twice.
- **Migration.** `npm run import-json` copies the Phase 1 `db.json` into
  MongoDB (skips non-empty collections unless `--force`).

---

## 5. API documentation — REST

Base URL `http://localhost:3000/api` (the Angular dev server proxies `/api`).
Bodies are JSON. Authentication is the `connect.sid` session cookie set by
bootstrap/register/login. Errors are JSON: `{ "error": "message" }` (bootstrap
and register validation return `{ "errors": ["...", ...] }`).
Wrong data types (e.g. a number where text is expected) and broken JSON give `400`. Common statuses: `400` invalid input, `401` not logged in, `403` not allowed,
`404` not found, `409` conflict (duplicate / already done), `500` server error.

"PublicUser" = the user document without `passwordHash`, plus a computed `age`.
"PublicGroup" = group + viewer flags `isMember`, `isAdmin`, `hasPendingJoinRequest`.

### 5.1 Bootstrap & authentication (`routes/auth.js`)

| Method & path | Auth | Request | Success | Errors |
|---------------|------|---------|---------|--------|
| `GET /bootstrap/status` | — | — | `200 { needsBootstrap: boolean }` | — |
| `POST /bootstrap` | — | `{ email, password, firstName, lastName, dateOfBirth }` | `201 PublicUser` (Super Admin), logged in | `400 { errors }`, `409` already bootstrapped |
| `POST /auth/register` | — | same as bootstrap | `201 PublicUser`, logged in | `400 { errors }`, `409` email taken / not bootstrapped |
| `POST /auth/login` | — | `{ email, password }` | `200 PublicUser` | `400` missing fields, `401` wrong credentials |
| `POST /auth/logout` | cookie | — | `204` (session destroyed) | — |
| `GET /auth/me` | cookie | — | `200 PublicUser` | `401` |

### 5.2 Users (`routes/users.js`) — all require login

| Method & path | Request | Success | Errors |
|---------------|---------|---------|--------|
| `PUT /users/me` | `{ displayName }` | `200 PublicUser` | `400` empty |
| `PUT /users/me/password` | `{ oldPassword, newPassword, confirmNewPassword }` | `204` | `400` mismatch / weak, `401` wrong current password |
| `PUT /users/me/preferences` | `{ theme?: 'light'\|'dark', fontSize?: 'small'\|'medium'\|'large' }` | `200 PublicUser` (invalid values ignored) | — |
| `PUT /users/me/avatar` | `{ avatarUrl: "data:image/(png\|jpeg\|gif\|webp);base64,..." }` ≤2MB | `200 PublicUser` | `400` not an image / too big |
| `GET /users/:id/avatar` | — | `200` image bytes (`Content-Type: image/*`) | `404` no avatar |

### 5.3 Groups & rooms (`routes/groups.js`)

| Method & path | Auth / who | Request | Success | Errors |
|---------------|-----------|---------|---------|--------|
| `GET /groups` | anyone | query (all optional): `search`, `maxAge`, `mine=true`, `page`, `pageSize` (max 50) | `200 PublicGroup[]`; with `page` → `200 { items, total, page, pageSize, totalPages }` | — |
| `GET /groups/:id` | anyone | — | `200 PublicGroup + rooms: Room[]` (+ `members: {id, displayName, isAdmin}[]` if viewer is a Group Admin) | `404` |
| `PATCH /groups/:id` | Group Admin | `{ description?, minAge? }` | `200 PublicGroup` (logged `group_updated`) | `400` invalid / rename attempt, `403`, `404` |
| `POST /groups/requests` | login | `{ title, description?, minAge? }` | `201 Request` (`group_creation`) | `400` |
| `POST /groups/:id/join` | login | — | `201 Request` (`group_join`) | `403` banned / under age (`{ minAge }`), `409` member / already pending, `404` |
| `POST /groups/:id/leave` | member | — | `200 PublicGroup` | `409` not a member / sole admin |
| `POST /groups/:id/admins` | Group Admin | `{ userId }` | `200` group detail | `400` not a member, `403`, `409` already admin |
| `POST /groups/:id/ban` | Group Admin | `{ userId }` | `200` group detail | `400` self / not a member, `403`, `409` target is admin |
| `GET /groups/:id/members` | member | — | `200 {id, displayName, isAdmin}[]` | `403` |
| `POST /groups/:id/ban-requests` | member | `{ userId, reason }` | `201 Request` (`ban_request`) | `400` no reason / self / admin, `403`, `409` duplicate |
| `POST /groups/:gid/members/:uid/deletion-requests` | Group Admin | `{ reason }` | `201 Request` (`account_deletion`) | `400`, `403`, `409` already pending |
| `POST /groups/:id/rooms/requests` | member | `{ name, minAge? }` | `201 Request` (`room_creation`) | `400`, `403` |
| `GET /groups/:gid/rooms/:rid` | member, old enough, not Super Admin | — | `200 Room` | `403` (`{ minAge }` if under age), `404` |
| `GET /groups/:gid/rooms/:rid/messages` | same as above | — | `200 ChatMessage[]` (≤5, oldest first) | `403`, `404` |
| `DELETE /groups/:gid/rooms/:rid` | Group Admin | — | `204`; room + its messages deleted, `room:removed` emitted, logged `room_removed` | `403`, `404` |

### 5.4 Request queue (`routes/requests.js`) — all require login

| Method & path | Who | Success | Errors |
|---------------|-----|---------|--------|
| `GET /requests` | anyone logged in | `200` pending requests *this user may resolve*, with `requesterDisplayName`, `groupTitle`, `targetDisplayName` | — |
| `POST /requests/:id/approve` | resolver | `200` resolved request; requester gets a `notification`, everyone gets `requests:changed` | `403` not allowed, `404`, `409` already resolved (also when two approves race) |
| `POST /requests/:id/deny` | resolver | `200` resolved request (logged `<type>_denied`) | `403`, `404`, `409` |

Who resolves what, and what "approve" does:

| Type | Resolved by | Approve effect |
|------|-------------|----------------|
| `group_creation` | Super Admin | Creates the group; requester becomes member + Group Admin |
| `group_join` | Admins of that group | Adds requester to the group |
| `room_creation` | Admins of that group | Creates the room |
| `ban_request` | Admins of that group | Bans the target from that group (same as `POST /groups/:id/ban`) |
| `account_deletion` | Super Admin | Removes the user from every group and deletes the account |

### 5.5 Admin log (`routes/adminLogs.js`)

| Method & path | Who | Query | Success | Errors |
|---------------|-----|-------|---------|--------|
| `GET /admin/logs` | Super Admin | `action?`, `from?`, `to?` (dates), `page?`, `pageSize?` | `200 AdminLogEntry[]` newest first; with `page` → `{ items, total, page, pageSize, totalPages }` | `403` |
| `GET /admin/logs/actions` | Super Admin | — | `200 string[]` (all action types, for the filter) | `403` |

### 5.6 Misc

| Method & path | Success |
|---------------|---------|
| `GET /status` | `200 { ok: true, app: "fabulari-server", phase: 2 }` |

---

## 6. API documentation — Socket.IO (real-time chat)

Implemented in `server/sockets/chat.js`; client side in
`client/src/app/core/chat.service.ts`.

**Connection & authentication.** The client connects to the same origin
(`ng serve` proxies `/socket.io` to port 3000 with WebSocket support). The
server runs the *same* `express-session` middleware on the Socket.IO
handshake, so the login cookie identifies the user; connections without a
logged-in session are refused with `connect_error: "Not logged in."`. The
user is re-read from MongoDB on every event, so a ban or deletion takes
effect immediately.

**Rooms.** Each chat Room is a Socket.IO room named `room:<roomId>`. Every
socket also joins `user:<userId>` (its own channel) for personal notifications.
The Angular app connects once after login (`MainLayoutComponent`).

**Acknowledgements.** Every client → server event takes a callback that
receives `{ ok: true, ... }` or `{ ok: false, error }`.

### 6.1 Client → server

| Event | Payload | Ack (success) | Rules / failures |
|-------|---------|---------------|------------------|
| `room:join` | `{ groupId, roomId }` | `{ ok, room, messages: ChatMessage[] /* last ≤5, oldest first */ }` | `checkRoomAccess()`: not Super Admin, member, old enough (`minAge` returned when under age). Others in the room receive `room:user-joined`. |
| `room:leave` | `{ roomId }` | `{ ok }` | Others receive `room:user-left`. |
| `message:send` | `{ roomId, text?, imageUrl?, clientSentAt }` | `{ ok, message: ChatMessage }` | Must have joined; access re-checked; text and/or PNG/GIF/JPEG ≤2MB; stored, trimmed to last 5, broadcast as `message:new`. |
| `message:delete` | `{ roomId, messageId }` | `{ ok }` | Only the sender (signed id check); removed from MongoDB if still stored; `message:deleted` broadcast. |
| `room:typing` | `{ roomId, typing: boolean }` | — (no ack) | Only from a socket that joined the room. Passed on to the others in the room; no database access. The client sends `true` on the first key press and `false` after 2s idle or on send. |

### 6.2 Server → client

| Event | Payload | Sent to |
|-------|---------|---------|
| `message:new` | `ChatMessage` | everyone in the room (incl. sender) |
| `message:deleted` | `{ roomId, messageId }` | everyone in the room |
| `room:user-joined` | `{ roomId, user: { id, displayName }, at }` | everyone else in the room |
| `room:user-left` | same | everyone else in the room (also sent on disconnect) |
| `room:removed` | `{ roomId, groupId }` | everyone in the room (from `DELETE /groups/:gid/rooms/:rid`) |
| `room:members` | `{ roomId, members: { id, displayName }[] }` | everyone in the room, after every join / leave / disconnect (who's online) |
| `room:typing` | `{ roomId, user: { id, displayName }, typing }` | everyone else in the room ("Bob is typing…"; the client hides it after 5s without news) |
| `notification` | `{ text, at }` | one user (`user:<id>`) — e.g. "Request approved: joining "Chess"." |
| `requests:changed` | — | every connected client, whenever a request is created or resolved (badge + admin queues reload) |

Transport limit: `maxHttpBufferSize` is raised to 4MB because a 2MB image is
about 2.7MB once base64-encoded.

---

## 7. Angular architecture — components, services, models, routes

Angular 20, standalone components, signals / `computed()` for component state, `animate.enter` for enter animations,
`inject()` for dependency injection, functional route guards, lazy-loaded
routes. HTTP services wrap `HttpClient` Observables in Promises
(`toPromise()` helper using `.subscribe()`) so components can `await` them;
push-style data (chat events) is exposed as RxJS **Observables**.

### 7.1 Components

| Component | Route | Purpose |
|-----------|-------|---------|
| `AppComponent` | — | Root `<router-outlet>` |
| `MainLayoutComponent` | parent of logged-in routes | Navbar + content outlet, skip link, opens the socket after login, shows **notification popups** |
| `NavbarComponent` | — | Brand, nav links (Admin Queue/Log for Super Admin), **live pending-request badge** for admins, avatar, logout (also closes the socket) |
| `BootstrapComponent` | `/bootstrap` | One-time Super Admin creation form |
| `LoginComponent` | `/login` | Login form; redirects to `/bootstrap` if no users exist |
| `RegisterComponent` | `/register` | Registration form (client-side password/confirm checks) |
| `GroupListComponent` | `/groups` | "My Groups" sidebar, **search + max-age filter + pages** of all groups, join requests, request a new group (checked client-side), reloads on notifications |
| `GroupViewComponent` | `/groups/:groupId` | Rooms (Enter / **Remove** for admins), request room, **Report a member**; admin panel: join requests, room requests, **ban reports**, members (make admin, ban, request removal); banners for age-blocked / blocked / removed-room redirects |
| `RoomComponent` | `/groups/:groupId/rooms/:roomId` | **Real-time chat** — one component reused for every room (route params, re-joins on param change): history + live messages, avatars + timestamps, image attach with preview, delete own messages, join/leave toasts, **who's online** list, `animate.enter` animations, auto-scroll, Enter to send |
| `ProfileComponent` | `/profile` | Avatar upload, display name, change password, preferences |
| `AdminQueueComponent` | `/admin/queue` | Super Admin: group creation + account deletion requests; refreshes itself live |
| `AdminLogComponent` | `/admin/logs` | Super Admin: admin log, filter by type (types from the server), 20 per page |

### 7.2 Services (`src/app/core`)

| Service | Responsibility |
|---------|----------------|
| `AuthService` | Bootstrap/register/login/logout/me; `currentUser` signal; caches the *public* profile in Local Storage for fast reloads (no password or token — the session cookie is the real authentication) |
| `GroupService` | Groups (`getPage()` search/paging, `getMine()`), rooms, membership, admins, bans, ban reports, deletion escalation, room removal, room history |
| `RequestService` | Pending queue, approve, deny |
| `UserService` | Display name, password, preferences, avatar |
| `AdminLogService` | Admin log pages (`getPage()`) and action types (`getActions()`) |
| **`ChatService`** *(new)* | Owns the Socket.IO connection. Methods `joinRoom`, `leaveRoom`, `sendMessage`, `deleteMessage` return Promises of the server's acknowledgement; Observables `messages$`, `messageDeleted$`, `userJoined$`, `userLeft$`, `roomRemoved$` carry server pushes. Also `roomMembers$`, `notifications$`, `requestsChanged$`; `connect()` after login; `disconnect()` on logout. The socket is created through the `SOCKET_FACTORY` injection token so tests can inject a fake socket. |
| `image-file.ts` *(new, helper functions)* | `validateChatImage()` (PNG/GIF/JPEG ≤2MB) and `readFileAsDataUrl()` |
| `form-checks.ts` *(new, helper function)* | `checkRegistration()` — names, email, date of birth not in the future, password rule, passwords match (used by Register + Bootstrap) |

### 7.3 Models (`core/models.ts`, `auth.service.ts`)

`User`, `RegistrationFields`, `Group`, `GroupDetail` (+`rooms`, `members?`),
`MemberSummary`, `Room`, `GroupRequest` (`RequestType` now includes
`ban_request`), and new in Phase 2: **`ChatMessage`**, **`PresenceNotice`**
(join/leave popup data) and **`SocketAck`** (the acknowledgement shape).

### 7.4 Routes & guards

| Path | Guard | Component |
|------|-------|-----------|
| `/bootstrap`, `/login`, `/register` | — | auth screens |
| `/` (layout) | `authGuard` — re-validates the session with `GET /auth/me` | `MainLayoutComponent` |
| `/groups` | ↑ | `GroupListComponent` |
| `/groups/:groupId` | ↑ | `GroupViewComponent` |
| `/groups/:groupId/rooms/:roomId` | ↑ + `roomAgeGuard` (fast client-side age check; the server re-checks) | `RoomComponent` |
| `/profile` | ↑ | `ProfileComponent` |
| `/admin/queue`, `/admin/logs` | ↑ + `superAdminGuard` | admin screens |
| `**` | — | redirect to `/login` |

Proxy (`proxy.conf.json`): `/api` → `http://localhost:3000`, `/socket.io` →
`http://localhost:3000` with `ws: true`.

---

## 8. Design documents (updated)

The Phase 1 storyboards (Phase1.md §7, `docs/WIREFRAME.md`) still apply for
the auth screens, group list, profile and admin screens. The screens that
changed in Phase 2 are below; all are responsive (breakpoint 768px).

### 8.1 Room (real-time chat) — desktop & tablet

```
┌───────────────────────────────────────────────┐
│ ←  #general                         All ages   │
├───────────────────────────────────────────────┤     ┌──────────────────────────┐
│ (a) You  23 Sep, 10:04              [Delete]   │     │ bob joined the room   ×  │  ← toast (top right,
│     Hi everyone!                               │     └──────────────────────────┘    auto-hides after 4s)
│ (b) bob  23 Sep, 10:05                         │
│     ┌────────┐                                 │
│     │ image  │                                 │
│     └────────┘                                 │
│   … scrollable; newest at the bottom …         │
│ bob is typing…                                 │  ← room:typing (italic, grey)
├───────────────────────────────────────────────┤
│ [📎] [ Type a message…                ] [Send] │  ← Enter = send, Shift+Enter = new line
│ [Leave Room]                                   │
└───────────────────────────────────────────────┘
```
Single column at every width; the message list fills the remaining viewport
height and scrolls independently, so the composer is always visible. "Delete"
appears only on your own messages. The "is typing…" line keeps its height
even when empty, so the page doesn't jump when it shows up. Avatars are the user's profile picture, or
their initial in a coloured circle if they have none (your own messages use
the coral colour).

### 8.2 Group View — additions

```
Desktop                                             Tablet (≤768px: stacked)
┌──────────────────────────┬──────────────────────┐ ┌──────────────────────┐
│ Rooms                    │ Admin Panel          │ │ Rooms                │
│ #general        [Enter][Remove]                 │ │ #general [Enter]     │
│ #adults 18+     [Enter][Remove]                 │ │ [+ Request New Room] │
│ [+ Request New Room]     │ Join requests        │ │ [Report a member]    │
│ [Report a member] (members only)                │ ├──────────────────────┤
│   Member [▼]  Reason [    ]  [Send report]      │ │ Admin Panel          │
│                          │ Room requests        │ │ …                    │
│                          │ Ban reports from     │ └──────────────────────┘
│                          │   members [Ban][Dismiss]
│                          │ Members [Make Admin][Ban][Request Removal]
└──────────────────────────┴──────────────────────┘
```
"Remove" becomes "Confirm remove?" on the first click (two-step instead of a
blocking browser dialog). Banners at the top explain why the user was sent
back from a room: under age, blocked, or "That room was removed by a Group
Admin."

### 8.3 Group List — search and pages (desktop & tablet)

```
Desktop                                              Tablet (≤768px: stacked)
┌──────────────┬──────────────────────────────────┐ ┌──────────────────────┐
│ My Groups    │ All Groups (23)                  │ │ My Groups            │
│ • Music      │ [Search.......] [Max age] [Search] [Clear] │ • Music        │
│ • Chess      │ ┌────────┐┌────────┐┌─────────┐  │ │ [+ Request Group]    │
│              │ │ Card   ││ Card   ││ Card    │  │ ├──────────────────────┤
│ [+ Request   │ │ [Open] ││ [Join] ││[Pending]│  │ │ All Groups (23)      │
│   New Group] │ └────────┘└────────┘└─────────┘  │ │ [Search....] [Search]│
│              │   … 9 per page …                 │ │ Card / Card / Card   │
│              │ [Previous] Page 1 of 3 [Next]    │ │ [Prev] 1 of 3 [Next] │
└──────────────┴──────────────────────────────────┘ └──────────────────────┘
```
The navbar shows a coral badge with the number of pending requests for admins,
and popups appear bottom-right when one of your requests is approved/denied.
The room screen (8.1) now has an "● Online (3): You, bob, carol" line under
the title.

### 8.4 Navigation flow (Phase 2)

```
Bootstrap (only if 0 users) → Login ⇄ Register
Login → Group List → Group View → Room (socket join) ─┐
                         ↑   (under age / not member / room removed)
                         └────────────────────────────┘
Navbar (any page): Groups · Profile · [Super Admin: Admin Queue · Admin Log] · Log out
```

---

## 9. Testing — tools, methodology and automated test list

### 9.1 Tools

| Layer | Tools | Why |
|-------|-------|-----|
| Server unit tests | **Mocha** (runner), Node **`assert`**, **Sinon** (stubs/spies) | As taught in lectures 10.2/10.5: Mocha + the built-in assert library for unit tests; Sinon to replace the database so a test checks only our logic |
| Server integration tests | **Mocha**, **Chai** (`expect`), **chai-http**, **socket.io-client**, a real **MongoDB** test database | Lecture 10.2: Chai + chai-http for route testing; socket.io-client to test the chat events the same way the browser uses them |
| Angular unit tests | **Vitest** via the Angular CLI `@angular/build:unit-test` builder, **TestBed**, jsdom, `HttpTestingController`, `vi.fn()` mocks, shared fakes in `src/testing/fakes.ts` | Lecture 10.3: Vitest + TestBed with a global `providersFile` (`src/test-providers.ts`) |
| End-to-end | **Playwright** (`client/e2e/`, `playwright.config.ts`) | Week 10 lecture: Playwright for Angular E2E — drives real browsers against the real app |

### 9.2 Methodology

- **Testable code first (lecture 10.4).** Logic that used to sit inside route
  handlers was pulled into small **pure functions** (`userUtils`,
  `messageUtils`, `buildLogFilter`) and one shared rule (`checkRoomAccess`),
  and the Express app is built separately from being started (`app.js` vs
  `server.js`). That made each piece testable on its own.
- **Unit tests** (`server/unitTest/`) test one function at a time with no
  database, network or clock dependency (`computeAge` takes an injectable
  "today"). Where code depends on MongoDB (`requireAuth`, `canResolve`,
  `checkRoomAccess`) the `dbService` functions are **stubbed with Sinon** and
  restored after each test (`sinon.restore()` in `afterEach`).
- **Integration tests** (`server/integrationTest/`) send real HTTP requests to
  the real Express app, and real Socket.IO events to the real server, backed by
  a real MongoDB database called **`fabulari_test`** (the helper refuses to
  run against a database not ending in `_test`, so real data is never
  touched). A root `before()` hook drops the test database; every `describe`
  block clears the collections in its own `before()` and builds the data it
  needs (`buildWorld()`), so no test depends on another file's leftovers.
  `chai.request.agent()` keeps the session cookie between requests like a
  browser. **Every route has at least two tests** (success + failure/permission
  case), as required by Workshop 10.
- **Coverage target (from the Week 10 lecture).** Server: every REST endpoint
  and every socket event has tests. Angular: **every component and every
  service has its own spec with 4–14 tests** (not just the default "should
  create").
- **Angular tests** (`client/src/**/*.spec.ts`) use TestBed: services are
  tested with `HttpTestingController` (a fake backend that also verifies no
  unexpected requests were made); `RoomComponent` and `LoginComponent` are
  tested with **mock services** (`ChatServiceMock`, a mocked `AuthService`), a
  stub `ActivatedRoute`, and assertions on the rendered DOM; `ChatService` is
  tested with a **fake socket** injected through `SOCKET_FACTORY`.
- **E2E tests** (`client/e2e/`, Playwright) start their own server on port
  3100 with a fresh `fabulari_e2e` database and `ng serve` on port 4300, then
  drive real Chromium windows: login errors, register validation, **three
  users chatting in one room where one leaves and must stop receiving
  messages**, re-join gets the last messages, delete broadcast, the age gate,
  and group search.

Run: `cd server && npm run unitTest`, `npm run integrationTest` (needs
`mongod`), `npm test` (both); `cd client && npm test`; `cd client && npm run e2e`.

**Totals: 55 server unit + 110 server integration + 148 Angular + 5 E2E = 318 automated tests.**

### 9.3 Server unit tests — `npm run unitTest`

| # | File | Suite | Test | Result |
|---|------|-------|------|--------|
| 1 | `adminLogFilter.test.js` | adminLogs #buildLogFilter() | returns an empty filter (match everything) when no query is given | ✅ Pass |
| 2 | `adminLogFilter.test.js` | adminLogs #buildLogFilter() | filters by action type | ✅ Pass |
| 3 | `adminLogFilter.test.js` | adminLogs #buildLogFilter() | builds a timestamp range from/to as ISO strings | ✅ Pass |
| 4 | `adminLogFilter.test.js` | adminLogs #buildLogFilter() | ignores invalid dates instead of failing | ✅ Pass |
| 5 | `messageUtils.test.js` | messageUtils #dataUrlByteSize() | computes the decoded size of a base64 data URL | ✅ Pass |
| 6 | `messageUtils.test.js` | messageUtils #validateMessagePayload() | accepts a plain text message and trims it | ✅ Pass |
| 7 | `messageUtils.test.js` | messageUtils #validateMessagePayload() | accepts an image-only message (PNG/GIF/JPEG) | ✅ Pass |
| 8 | `messageUtils.test.js` | messageUtils #validateMessagePayload() | rejects an empty message | ✅ Pass |
| 9 | `messageUtils.test.js` | messageUtils #validateMessagePayload() | rejects image types other than PNG/GIF/JPEG | ✅ Pass |
| 10 | `messageUtils.test.js` | messageUtils #validateMessagePayload() | accepts an image of exactly 2MB but rejects anything bigger | ✅ Pass |
| 11 | `messageUtils.test.js` | messageUtils #resolveSentAt() | keeps the client "send pressed" time when it is close to the server clock | ✅ Pass |
| 12 | `messageUtils.test.js` | messageUtils #resolveSentAt() | falls back to the server time when the client clock is far off | ✅ Pass |
| 13 | `messageUtils.test.js` | messageUtils #resolveSentAt() | falls back to the server time when no time is given | ✅ Pass |
| 14 | `messageUtils.test.js` | messageUtils #signMessageId() / #isMessageOwnedBy() | recognises the sender as the owner of their message id | ✅ Pass |
| 15 | `messageUtils.test.js` | messageUtils #signMessageId() / #isMessageOwnedBy() | rejects anyone else as the owner | ✅ Pass |
| 16 | `messageUtils.test.js` | messageUtils #signMessageId() / #isMessageOwnedBy() | rejects a tampered or malformed id | ✅ Pass |
| 17 | `messageUtils.test.js` | messageUtils #nextSequence() | never returns the same number twice, even within one millisecond | ✅ Pass |
| 18 | `messageUtils.test.js` | messageUtils #nextSequence() | follows the clock when time moves forward | ✅ Pass |
| 19 | `paging.test.js` | paging helpers #parsePaging() | returns null when no page is asked for | ✅ Pass |
| 20 | `paging.test.js` | paging helpers #parsePaging() | reads page and pageSize | ✅ Pass |
| 21 | `paging.test.js` | paging helpers #parsePaging() | uses the default size and fixes bad numbers | ✅ Pass |
| 22 | `paging.test.js` | paging helpers #parsePaging() | caps the page size | ✅ Pass |
| 23 | `paging.test.js` | paging helpers #escapeRegex() | escapes regex characters | ✅ Pass |
| 24 | `paging.test.js` | paging helpers #buildGroupFilter() | returns an empty filter by default | ✅ Pass |
| 25 | `paging.test.js` | paging helpers #buildGroupFilter() | searches title and description, case-insensitive | ✅ Pass |
| 26 | `paging.test.js` | paging helpers #buildGroupFilter() | filters by max age | ✅ Pass |
| 27 | `paging.test.js` | paging helpers #buildGroupFilter() | filters to my groups | ✅ Pass |
| 28 | `userUtils.test.js` | userUtils #computeAge() | returns the full age when the birthday has already passed this year | ✅ Pass |
| 29 | `userUtils.test.js` | userUtils #computeAge() | subtracts one when the birthday has not happened yet this year | ✅ Pass |
| 30 | `userUtils.test.js` | userUtils #computeAge() | counts the birthday itself as already had | ✅ Pass |
| 31 | `userUtils.test.js` | userUtils #computeAge() | returns NaN for an invalid date | ✅ Pass |
| 32 | `userUtils.test.js` | userUtils #toPublicUser() | removes the password hash and Mongo _id, and adds a computed age | ✅ Pass |
| 33 | `userUtils.test.js` | userUtils #toPublicUser() | returns null for a missing user | ✅ Pass |
| 34 | `userUtils.test.js` | userUtils #isValidPassword() | accepts 8+ characters with an uppercase letter | ✅ Pass |
| 35 | `userUtils.test.js` | userUtils #isValidPassword() | rejects a password without an uppercase letter | ✅ Pass |
| 36 | `userUtils.test.js` | userUtils #isValidPassword() | rejects a password shorter than 8 characters | ✅ Pass |
| 37 | `userUtils.test.js` | userUtils #validateRegistrationFields() | returns no errors for valid fields | ✅ Pass |
| 38 | `userUtils.test.js` | userUtils #validateRegistrationFields() | reports a bad email | ✅ Pass |
| 39 | `userUtils.test.js` | userUtils #validateRegistrationFields() | reports a date of birth in the future | ✅ Pass |
| 40 | `userUtils.test.js` | userUtils #validateRegistrationFields() | reports every missing field at once | ✅ Pass |
| 41 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) requireAuth middleware | responds 401 and does not call next() when there is no session | ✅ Pass |
| 42 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) requireAuth middleware | responds 401 when the session points at a user that no longer exists | ✅ Pass |
| 43 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) requireAuth middleware | attaches the user as req.currentUser and calls next() | ✅ Pass |
| 44 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) requests #canResolve() | lets only the Super Admin resolve group creation requests | ✅ Pass |
| 45 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) requests #canResolve() | lets only the Super Admin resolve account deletion requests (R4) | ✅ Pass |
| 46 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) requests #canResolve() | lets a Group Admin resolve join/room/ban requests for THEIR group only | ✅ Pass |
| 47 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) requests #canResolve() | returns false for an unknown request type | ✅ Pass |
| 48 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) roomAccess #checkRoomAccess() | blocks the Super Admin from chat entirely | ✅ Pass |
| 49 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) roomAccess #checkRoomAccess() | blocks users who are not members of the group | ✅ Pass |
| 50 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) roomAccess #checkRoomAccess() | blocks members who are younger than the room's minimum age (R18) | ✅ Pass |
| 51 | `withSinon.test.js` | Unit tests with Sinon stubs (no database) roomAccess #checkRoomAccess() | allows an old-enough member in and returns the room | ✅ Pass |
| 52 | `withSinon.test.js` | requests #describeRequest() | describes each request type for the popup | ✅ Pass |
| 53 | `withSinon.test.js` | sockets/notify | broadcasts requests:changed through io | ✅ Pass |
| 54 | `withSinon.test.js` | sockets/notify | sends a notification to the user's own channel | ✅ Pass |
| 55 | `withSinon.test.js` | sockets/notify | does nothing when there is no io (REST-only tests) | ✅ Pass |

### 9.4 Server integration tests — `npm run integrationTest`

| # | File | Suite | Test | Result |
|---|------|-------|------|--------|
| 1 | `auth.test.js` | Auth & bootstrap routes GET /api/status | reports the server is up and on Phase 2 | ✅ Pass |
| 2 | `auth.test.js` | Auth & bootstrap routes GET /api/status | returns a JSON 404 for an unknown API route | ✅ Pass |
| 3 | `auth.test.js` | Auth & bootstrap routes GET /api/bootstrap/status | reports needsBootstrap: true when there are no users | ✅ Pass |
| 4 | `auth.test.js` | Auth & bootstrap routes GET /api/bootstrap/status | refuses registration before the system is bootstrapped | ✅ Pass |
| 5 | `auth.test.js` | Auth & bootstrap routes POST /api/bootstrap | rejects invalid fields with a list of errors | ✅ Pass |
| 6 | `auth.test.js` | Auth & bootstrap routes POST /api/bootstrap | creates the first user as Super Admin, stored in MongoDB with a hashed password | ✅ Pass |
| 7 | `auth.test.js` | Auth & bootstrap routes POST /api/bootstrap | can only run once (409 afterwards) | ✅ Pass |
| 8 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/register | registers a General User and logs them in | ✅ Pass |
| 9 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/register | rejects a duplicate email (case-insensitive) | ✅ Pass |
| 10 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/register | rejects a weak password (R23) | ✅ Pass |
| 11 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/login + GET /api/auth/me + POST /api/auth/logout | logs in with the right password and returns the public user | ✅ Pass |
| 12 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/login + GET /api/auth/me + POST /api/auth/logout | rejects a wrong password with 401 | ✅ Pass |
| 13 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/login + GET /api/auth/me + POST /api/auth/logout | GET /api/auth/me is 401 when not logged in | ✅ Pass |
| 14 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/login + GET /api/auth/me + POST /api/auth/logout | logout is harmless when not logged in | ✅ Pass |
| 15 | `auth.test.js` | Auth & bootstrap routes POST /api/auth/login + GET /api/auth/me + POST /api/auth/logout | logout ends the session | ✅ Pass |
| 16 | `chat.test.js` | Real-time chat (Socket.IO) connecting | refuses a socket without a logged-in session | ✅ Pass |
| 17 | `chat.test.js` | Real-time chat (Socket.IO) connecting | accepts a socket with a valid session cookie | ✅ Pass |
| 18 | `chat.test.js` | Real-time chat (Socket.IO) room:join | lets a member join and returns the room history | ✅ Pass |
| 19 | `chat.test.js` | Real-time chat (Socket.IO) room:join | refuses a user who is not a member of the group | ✅ Pass |
| 20 | `chat.test.js` | Real-time chat (Socket.IO) room:join | refuses the Super Admin | ✅ Pass |
| 21 | `chat.test.js` | Real-time chat (Socket.IO) room:join | notifies people already in the room when someone joins and leaves | ✅ Pass |
| 22 | `chat.test.js` | Real-time chat (Socket.IO) room:members (who is online) | sends the online list to the room when someone joins and leaves | ✅ Pass |
| 23 | `chat.test.js` | Real-time chat (Socket.IO) room:members (who is online) | a user who left the room no longer gets its messages | ✅ Pass |
| 24 | `chat.test.js` | Real-time chat (Socket.IO) room:typing | tells the others in the room who is typing, but not the typer | ✅ Pass |
| 25 | `chat.test.js` | Real-time chat (Socket.IO) room:typing | ignores typing from a socket that has not joined the room | ✅ Pass |
| 26 | `chat.test.js` | Real-time chat (Socket.IO) notifications | tells the requester when their join request is approved | ✅ Pass |
| 27 | `chat.test.js` | Real-time chat (Socket.IO) notifications | tells every client when the request queue changes | ✅ Pass |
| 28 | `chat.test.js` | Real-time chat (Socket.IO) message:send | broadcasts a text message to everyone in the room, with sender + timestamp | ✅ Pass |
| 29 | `chat.test.js` | Real-time chat (Socket.IO) message:send | sends an image message | ✅ Pass |
| 30 | `chat.test.js` | Real-time chat (Socket.IO) message:send | rejects an empty message and an unsupported image type | ✅ Pass |
| 31 | `chat.test.js` | Real-time chat (Socket.IO) message:send | keeps only the last 5 messages of a room in MongoDB | ✅ Pass |
| 32 | `chat.test.js` | Real-time chat (Socket.IO) message:delete | lets the sender delete their own message and tells everyone in the room | ✅ Pass |
| 33 | `chat.test.js` | Real-time chat (Socket.IO) message:delete | refuses to delete someone else's message | ✅ Pass |
| 34 | `chat.test.js` | Real-time chat (Socket.IO) message:delete | still lets the sender delete a message that is no longer stored on the server | ✅ Pass |
| 35 | `extras.test.js` | Search, pagination and validation GET /api/groups?page= | returns one page plus the totals | ✅ Pass |
| 36 | `extras.test.js` | Search, pagination and validation GET /api/groups?page= | returns the last, shorter page | ✅ Pass |
| 37 | `extras.test.js` | Search, pagination and validation GET /api/groups?page= | still returns a plain array without ?page (old behaviour) | ✅ Pass |
| 38 | `extras.test.js` | Search, pagination and validation GET /api/groups?search= / maxAge / mine | searches title and description (case-insensitive) | ✅ Pass |
| 39 | `extras.test.js` | Search, pagination and validation GET /api/groups?search= / maxAge / mine | treats regex characters as plain text | ✅ Pass |
| 40 | `extras.test.js` | Search, pagination and validation GET /api/groups?search= / maxAge / mine | filters by maximum age | ✅ Pass |
| 41 | `extras.test.js` | Search, pagination and validation GET /api/groups?search= / maxAge / mine | lists only my groups with ?mine=true | ✅ Pass |
| 42 | `extras.test.js` | Search, pagination and validation GET /api/admin/logs?page= and /api/admin/logs/actions | pages the admin log | ✅ Pass |
| 43 | `extras.test.js` | Search, pagination and validation GET /api/admin/logs?page= and /api/admin/logs/actions | lists the action types | ✅ Pass |
| 44 | `extras.test.js` | Search, pagination and validation GET /api/admin/logs?page= and /api/admin/logs/actions | is Super Admin only | ✅ Pass |
| 45 | `extras.test.js` | Search, pagination and validation Wrong data types get a 400, not a crash | group title as a number | ✅ Pass |
| 46 | `extras.test.js` | Search, pagination and validation Wrong data types get a 400, not a crash | minAge as text | ✅ Pass |
| 47 | `extras.test.js` | Search, pagination and validation Wrong data types get a 400, not a crash | room name as an object | ✅ Pass |
| 48 | `extras.test.js` | Search, pagination and validation Wrong data types get a 400, not a crash | login with a number password | ✅ Pass |
| 49 | `extras.test.js` | Search, pagination and validation Wrong data types get a 400, not a crash | register with an array as the name | ✅ Pass |
| 50 | `extras.test.js` | Search, pagination and validation Wrong data types get a 400, not a crash | display name as a number | ✅ Pass |
| 51 | `extras.test.js` | Search, pagination and validation Wrong data types get a 400, not a crash | broken JSON body | ✅ Pass |
| 52 | `extras.test.js` | Search, pagination and validation Double approve | two approve clicks at the same time only apply once | ✅ Pass |
| 53 | `groups.test.js` | Group routes GET /api/groups | lists every group, even for visitors who are not logged in | ✅ Pass |
| 54 | `groups.test.js` | Group routes GET /api/groups | adds viewer-specific flags (isMember / isAdmin) | ✅ Pass |
| 55 | `groups.test.js` | Group routes GET /api/groups/:id | returns the rooms, and the member list only to a Group Admin | ✅ Pass |
| 56 | `groups.test.js` | Group routes GET /api/groups/:id | returns 404 for an unknown group | ✅ Pass |
| 57 | `groups.test.js` | Group routes POST /api/groups/requests | files a group creation request for the Super Admin | ✅ Pass |
| 58 | `groups.test.js` | Group routes POST /api/groups/requests | rejects a title longer than 30 characters (R13) | ✅ Pass |
| 59 | `groups.test.js` | Group routes POST /api/groups/:id/join | rejects a user younger than the group minimum age immediately | ✅ Pass |
| 60 | `groups.test.js` | Group routes POST /api/groups/:id/join | rejects a second join request while one is pending | ✅ Pass |
| 61 | `groups.test.js` | Group routes POST /api/groups/:id/join | rejects a join request from an existing member | ✅ Pass |
| 62 | `groups.test.js` | Group routes GET /api/groups/:groupId/rooms/:roomId (room entry check) | lets a member into an all-ages room | ✅ Pass |
| 63 | `groups.test.js` | Group routes GET /api/groups/:groupId/rooms/:roomId (room entry check) | blocks the Super Admin (does not use chat) | ✅ Pass |
| 64 | `groups.test.js` | Group routes GET /api/groups/:groupId/rooms/:roomId (room entry check) | blocks a non-member | ✅ Pass |
| 65 | `groups.test.js` | Group routes GET /api/groups/:groupId/rooms/:roomId/messages | returns the stored messages (none yet) to a member | ✅ Pass |
| 66 | `groups.test.js` | Group routes GET /api/groups/:groupId/rooms/:roomId/messages | is forbidden to the Super Admin (no access to chat history) | ✅ Pass |
| 67 | `groups.test.js` | Group routes POST /api/groups/:id/rooms/requests | rejects a room request from a non-member | ✅ Pass |
| 68 | `groups.test.js` | Group routes POST /api/groups/:id/rooms/requests | rejects a room name longer than 30 characters | ✅ Pass |
| 69 | `groups.test.js` | Group routes POST /api/groups/:id/rooms/requests | files a room_creation request for a member | ✅ Pass |
| 70 | `groups.test.js` | Group routes PATCH /api/groups/:id | lets a Group Admin change the description | ✅ Pass |
| 71 | `groups.test.js` | Group routes PATCH /api/groups/:id | refuses to rename the group | ✅ Pass |
| 72 | `groups.test.js` | Group routes PATCH /api/groups/:id | refuses edits from a non-admin member | ✅ Pass |
| 73 | `groups.test.js` | Group routes GET /api/groups/:id/members | lists members for any member of the group | ✅ Pass |
| 74 | `groups.test.js` | Group routes GET /api/groups/:id/members | is forbidden to non-members | ✅ Pass |
| 75 | `groups.test.js` | Group routes POST /api/groups/:id/admins | only lets a Group Admin appoint | ✅ Pass |
| 76 | `groups.test.js` | Group routes POST /api/groups/:id/admins | appoints a member as co-admin | ✅ Pass |
| 77 | `groups.test.js` | Group routes POST /api/groups/:id/ban | only lets a Group Admin ban | ✅ Pass |
| 78 | `groups.test.js` | Group routes POST /api/groups/:id/ban | refuses to ban another Group Admin | ✅ Pass |
| 79 | `groups.test.js` | Group routes POST /api/groups/:id/ban | refuses to let an admin ban themselves | ✅ Pass |
| 80 | `groups.test.js` | Group routes POST /api/groups/:id/leave | lets a co-admin leave now that there are two admins | ✅ Pass |
| 81 | `groups.test.js` | Group routes POST /api/groups/:id/leave | stops the sole admin from leaving | ✅ Pass |
| 82 | `groups.test.js` | Group routes POST /api/groups/:id/ban (successful ban) | removes the member from this group only and blocks rejoining | ✅ Pass |
| 83 | `groups.test.js` | Group routes DELETE /api/groups/:groupId/rooms/:roomId | is forbidden to non-admins | ✅ Pass |
| 84 | `groups.test.js` | Group routes DELETE /api/groups/:groupId/rooms/:roomId | lets the Group Admin remove a room and logs it | ✅ Pass |
| 85 | `requests.test.js` | Request queue routes GET /api/requests | shows a Group Admin only the requests for their own group | ✅ Pass |
| 86 | `requests.test.js` | Request queue routes GET /api/requests | shows a regular member nothing to approve | ✅ Pass |
| 87 | `requests.test.js` | Request queue routes GET /api/requests | requires login | ✅ Pass |
| 88 | `requests.test.js` | Request queue routes POST /api/requests/:id/approve | approving a group creation creates the group with the requester as admin | ✅ Pass |
| 89 | `requests.test.js` | Request queue routes POST /api/requests/:id/approve | a Group Admin cannot approve a group creation request | ✅ Pass |
| 90 | `requests.test.js` | Request queue routes POST /api/requests/:id/approve | cannot approve the same request twice | ✅ Pass |
| 91 | `requests.test.js` | Request queue routes POST /api/requests/:id/deny | marks the request denied without changing anything else | ✅ Pass |
| 92 | `requests.test.js` | Request queue routes POST /api/requests/:id/deny | returns 404 for an unknown request | ✅ Pass |
| 93 | `requests.test.js` | Request queue routes Ban requests (member reports another member) | a member reports someone; the Group Admin approves and they are banned | ✅ Pass |
| 94 | `requests.test.js` | Request queue routes Ban requests (member reports another member) | a banned user cannot request to rejoin (R8) | ✅ Pass |
| 95 | `requests.test.js` | Request queue routes Ban requests (member reports another member) | a report needs a reason | ✅ Pass |
| 96 | `requests.test.js` | Request queue routes Account deletion (R4 escalation) | Group Admin escalates, Super Admin approves, user is removed everywhere | ✅ Pass |
| 97 | `requests.test.js` | Request queue routes Account deletion (R4 escalation) | requires a reason | ✅ Pass |
| 98 | `users.test.js` | User & admin log routes PUT /api/users/me | changes the display name | ✅ Pass |
| 99 | `users.test.js` | User & admin log routes PUT /api/users/me | rejects an empty display name | ✅ Pass |
| 100 | `users.test.js` | User & admin log routes PUT /api/users/me/password | rejects a wrong current password | ✅ Pass |
| 101 | `users.test.js` | User & admin log routes PUT /api/users/me/password | rejects a mismatched confirmation | ✅ Pass |
| 102 | `users.test.js` | User & admin log routes PUT /api/users/me/password | changes the password so the new one works for login | ✅ Pass |
| 103 | `users.test.js` | User & admin log routes PUT /api/users/me/preferences | saves valid preferences | ✅ Pass |
| 104 | `users.test.js` | User & admin log routes PUT /api/users/me/preferences | ignores invalid values | ✅ Pass |
| 105 | `users.test.js` | User & admin log routes PUT /api/users/me/avatar + GET /api/users/:id/avatar | rejects something that is not an image | ✅ Pass |
| 106 | `users.test.js` | User & admin log routes PUT /api/users/me/avatar + GET /api/users/:id/avatar | stores the avatar and serves it back as an image | ✅ Pass |
| 107 | `users.test.js` | User & admin log routes PUT /api/users/me/avatar + GET /api/users/:id/avatar | returns 404 for a user without an avatar | ✅ Pass |
| 108 | `users.test.js` | User & admin log routes GET /api/admin/logs | is only available to the Super Admin | ✅ Pass |
| 109 | `users.test.js` | User & admin log routes GET /api/admin/logs | returns logged admin actions, newest first | ✅ Pass |
| 110 | `users.test.js` | User & admin log routes GET /api/admin/logs | filters by action type | ✅ Pass |

### 9.5 Angular unit tests (Vitest) — `npm test` in `client/`

| # | File | Suite | Test | Result |
|---|------|-------|------|--------|
| 1 | `app.component.spec.ts` | AppComponent | is created | ✅ Pass |
| 2 | `app.component.spec.ts` | AppComponent | only renders a router outlet | ✅ Pass |
| 3 | `app.component.spec.ts` | AppComponent | shows the routed page inside the outlet | ✅ Pass |
| 4 | `app.component.spec.ts` | AppComponent | has routes for every page | ✅ Pass |
| 5 | `app.component.spec.ts` | AppComponent | protects the logged-in pages and admin pages with guards | ✅ Pass |
| 6 | `admin-log.service.spec.ts` | AdminLogService | getLogs() without a filter GETs all logs | ✅ Pass |
| 7 | `admin-log.service.spec.ts` | AdminLogService | getLogs() adds the action filter to the URL | ✅ Pass |
| 8 | `admin-log.service.spec.ts` | AdminLogService | getPage() sends page, pageSize and action | ✅ Pass |
| 9 | `admin-log.service.spec.ts` | AdminLogService | getPage() leaves out the action for "all" | ✅ Pass |
| 10 | `admin-log.service.spec.ts` | AdminLogService | getActions() GETs the action types | ✅ Pass |
| 11 | `auth.guard.spec.ts` | superAdminGuard | lets the Super Admin through | ✅ Pass |
| 12 | `auth.guard.spec.ts` | superAdminGuard | sends everyone else back to /groups | ✅ Pass |
| 13 | `auth.guard.spec.ts` | authGuard | lets a logged-in user through straight away | ✅ Pass |
| 14 | `auth.guard.spec.ts` | authGuard | checks the session with the server after a refresh | ✅ Pass |
| 15 | `auth.guard.spec.ts` | authGuard | sends the user to /login when the session has expired | ✅ Pass |
| 16 | `auth.service.spec.ts` | AuthService | starts with no current user | ✅ Pass |
| 17 | `auth.service.spec.ts` | AuthService | login() posts the credentials and stores the returned user | ✅ Pass |
| 18 | `auth.service.spec.ts` | AuthService | login() rejects on 401 and keeps currentUser empty | ✅ Pass |
| 19 | `auth.service.spec.ts` | AuthService | needsBootstrap() unwraps the server flag | ✅ Pass |
| 20 | `auth.service.spec.ts` | AuthService | me() clears a stale user when the session has expired | ✅ Pass |
| 21 | `auth.service.spec.ts` | AuthService | logout() clears the current user | ✅ Pass |
| 22 | `auth.service.spec.ts` | AuthService register/bootstrap | register() posts the fields and stores the new user | ✅ Pass |
| 23 | `auth.service.spec.ts` | AuthService register/bootstrap | bootstrap() posts to /api/bootstrap | ✅ Pass |
| 24 | `chat.service.spec.ts` | ChatService | does not open a connection until it is first needed | ✅ Pass |
| 25 | `chat.service.spec.ts` | ChatService | joinRoom() connects once and emits room:join with the ids | ✅ Pass |
| 26 | `chat.service.spec.ts` | ChatService | sendMessage() includes the time "send" was pressed | ✅ Pass |
| 27 | `chat.service.spec.ts` | ChatService | deleteMessage() emits message:delete | ✅ Pass |
| 28 | `chat.service.spec.ts` | ChatService | turns server pushes into Observable values | ✅ Pass |
| 29 | `chat.service.spec.ts` | ChatService | leaveRoom() before connecting resolves without opening a socket | ✅ Pass |
| 30 | `chat.service.spec.ts` | ChatService | disconnect() closes the socket so the next use opens a fresh one | ✅ Pass |
| 31 | `chat.service.spec.ts` | ChatService live updates | connect() opens the socket straight away | ✅ Pass |
| 32 | `chat.service.spec.ts` | ChatService live updates | turns notification events into notifications$ | ✅ Pass |
| 33 | `chat.service.spec.ts` | ChatService live updates | turns room:members into roomMembers$ | ✅ Pass |
| 34 | `chat.service.spec.ts` | ChatService live updates | turns requests:changed into requestsChanged$ | ✅ Pass |
| 35 | `chat.service.spec.ts` | ChatService live updates | sendTyping() emits room:typing once connected, and does nothing before | ✅ Pass |
| 36 | `chat.service.spec.ts` | ChatService live updates | turns room:typing into typing$ | ✅ Pass |
| 37 | `chat.service.spec.ts` | ChatService live updates | returns a friendly error when the server does not answer | ✅ Pass |
| 38 | `form-checks.spec.ts` | checkRegistration() | returns null for a valid form | ✅ Pass |
| 39 | `form-checks.spec.ts` | checkRegistration() | needs first and last name | ✅ Pass |
| 40 | `form-checks.spec.ts` | checkRegistration() | checks the email | ✅ Pass |
| 41 | `form-checks.spec.ts` | checkRegistration() | rejects a date of birth in the future | ✅ Pass |
| 42 | `form-checks.spec.ts` | checkRegistration() | checks password strength and that both passwords match | ✅ Pass |
| 43 | `group.service.spec.ts` | GroupService | getAll() GETs /api/groups | ✅ Pass |
| 44 | `group.service.spec.ts` | GroupService | requestToJoin() POSTs to the join endpoint | ✅ Pass |
| 45 | `group.service.spec.ts` | GroupService | removeRoom() sends DELETE for that room | ✅ Pass |
| 46 | `group.service.spec.ts` | GroupService | requestBan() sends the member and reason | ✅ Pass |
| 47 | `group.service.spec.ts` | GroupService | passes server errors (e.g. age-blocked join) through to the caller | ✅ Pass |
| 48 | `group.service.spec.ts` | GroupService search + extras | getPage() sends search, maxAge and paging | ✅ Pass |
| 49 | `group.service.spec.ts` | GroupService search + extras | getPage() skips empty search and maxAge | ✅ Pass |
| 50 | `group.service.spec.ts` | GroupService search + extras | getMine() asks for my groups only | ✅ Pass |
| 51 | `group.service.spec.ts` | GroupService search + extras | getMembers() GETs the member list | ✅ Pass |
| 52 | `group.service.spec.ts` | GroupService search + extras | appointAdmin() and banMember() send the user id | ✅ Pass |
| 53 | `image-file.spec.ts` | image-file helpers validateChatImage() | accepts PNG, GIF and JPEG images | ✅ Pass |
| 54 | `image-file.spec.ts` | image-file helpers validateChatImage() | rejects other file types | ✅ Pass |
| 55 | `image-file.spec.ts` | image-file helpers validateChatImage() | accepts exactly 2MB and rejects anything larger | ✅ Pass |
| 56 | `image-file.spec.ts` | image-file helpers readFileAsDataUrl() | reads a file into a base64 data URL | ✅ Pass |
| 57 | `image-file.spec.ts` | image-file helpers | rejects a GIF that is too big | ✅ Pass |
| 58 | `request.service.spec.ts` | RequestService | is created | ✅ Pass |
| 59 | `request.service.spec.ts` | RequestService | getPending() GETs /api/requests | ✅ Pass |
| 60 | `request.service.spec.ts` | RequestService | approve() POSTs to the approve endpoint | ✅ Pass |
| 61 | `request.service.spec.ts` | RequestService | deny() POSTs to the deny endpoint | ✅ Pass |
| 62 | `request.service.spec.ts` | RequestService | passes a 409 (already resolved) back to the caller | ✅ Pass |
| 63 | `room.guard.spec.ts` | roomAgeGuard | lets the user in when they are old enough | ✅ Pass |
| 64 | `room.guard.spec.ts` | roomAgeGuard | sends a too-young user back with the ageBlocked banner | ✅ Pass |
| 65 | `room.guard.spec.ts` | roomAgeGuard | sends the user back to the group when the room does not exist | ✅ Pass |
| 66 | `room.guard.spec.ts` | roomAgeGuard | sends the user back when loading the group fails | ✅ Pass |
| 67 | `room.guard.spec.ts` | roomAgeGuard | goes to /groups when nobody is logged in | ✅ Pass |
| 68 | `user.service.spec.ts` | UserService | updateDisplayName() PUTs the new name | ✅ Pass |
| 69 | `user.service.spec.ts` | UserService | changePassword() sends old, new and confirm | ✅ Pass |
| 70 | `user.service.spec.ts` | UserService | changePassword() rejects when the old password is wrong | ✅ Pass |
| 71 | `user.service.spec.ts` | UserService | updatePreferences() PUTs theme and font size | ✅ Pass |
| 72 | `user.service.spec.ts` | UserService | updateAvatar() PUTs the base64 image | ✅ Pass |
| 73 | `main-layout.component.spec.ts` | MainLayoutComponent | connects the socket when the layout opens | ✅ Pass |
| 74 | `main-layout.component.spec.ts` | MainLayoutComponent | shows the navbar and a skip link | ✅ Pass |
| 75 | `main-layout.component.spec.ts` | MainLayoutComponent | shows a popup when a notification arrives and refreshes the user | ✅ Pass |
| 76 | `main-layout.component.spec.ts` | MainLayoutComponent | hides the popup after a few seconds | ✅ Pass |
| 77 | `main-layout.component.spec.ts` | MainLayoutComponent | closes a popup with the × button | ✅ Pass |
| 78 | `admin-log.component.spec.ts` | AdminLogComponent | shows the log entries and the total | ✅ Pass |
| 79 | `admin-log.component.spec.ts` | AdminLogComponent | fills the filter with the action types from the server | ✅ Pass |
| 80 | `admin-log.component.spec.ts` | AdminLogComponent | changing the filter reloads page 1 with that action | ✅ Pass |
| 81 | `admin-log.component.spec.ts` | AdminLogComponent | pages forward and backward | ✅ Pass |
| 82 | `admin-log.component.spec.ts` | AdminLogComponent | shows an error when the log cannot load | ✅ Pass |
| 83 | `admin-queue.component.spec.ts` | AdminQueueComponent | splits requests into group creation and account deletion | ✅ Pass |
| 84 | `admin-queue.component.spec.ts` | AdminQueueComponent | approves a request and reloads the queue | ✅ Pass |
| 85 | `admin-queue.component.spec.ts` | AdminQueueComponent | denies a request | ✅ Pass |
| 86 | `admin-queue.component.spec.ts` | AdminQueueComponent | shows the server error when approving fails | ✅ Pass |
| 87 | `admin-queue.component.spec.ts` | AdminQueueComponent | reloads by itself when the queue changes (socket) | ✅ Pass |
| 88 | `bootstrap.component.spec.ts` | BootstrapComponent | stays on the page while the system has no users | ✅ Pass |
| 89 | `bootstrap.component.spec.ts` | BootstrapComponent | goes to /login when bootstrap is already done | ✅ Pass |
| 90 | `bootstrap.component.spec.ts` | BootstrapComponent | does not submit a weak password | ✅ Pass |
| 91 | `bootstrap.component.spec.ts` | BootstrapComponent | creates the Super Admin and goes to /groups | ✅ Pass |
| 92 | `bootstrap.component.spec.ts` | BootstrapComponent | shows the server errors in the page | ✅ Pass |
| 93 | `group-list.component.spec.ts` | GroupListComponent | shows all groups and my groups | ✅ Pass |
| 94 | `group-list.component.spec.ts` | GroupListComponent | shows Open for my groups and Request to Join for the others | ✅ Pass |
| 95 | `group-list.component.spec.ts` | GroupListComponent | searches from page 1 with the typed text and age | ✅ Pass |
| 96 | `group-list.component.spec.ts` | GroupListComponent | shows the pager and moves to the next page | ✅ Pass |
| 97 | `group-list.component.spec.ts` | GroupListComponent | marks a group as pending after asking to join | ✅ Pass |
| 98 | `group-list.component.spec.ts` | GroupListComponent | shows the server reason when joining fails (e.g. too young) | ✅ Pass |
| 99 | `group-list.component.spec.ts` | GroupListComponent | checks the new group form before sending | ✅ Pass |
| 100 | `group-list.component.spec.ts` | GroupListComponent | reloads when a notification arrives | ✅ Pass |
| 101 | `group-view.component.spec.ts` | GroupViewComponent | shows the group and its rooms with Enter buttons for members | ✅ Pass |
| 102 | `group-view.component.spec.ts` | GroupViewComponent | shows the age banner after being sent back from a room | ✅ Pass |
| 103 | `group-view.component.spec.ts` | GroupViewComponent | shows the admin panel with join requests and ban reports for a Group Admin | ✅ Pass |
| 104 | `group-view.component.spec.ts` | GroupViewComponent | removes a room only after a second (confirm) click | ✅ Pass |
| 105 | `group-view.component.spec.ts` | GroupViewComponent | checks the room request form before sending | ✅ Pass |
| 106 | `group-view.component.spec.ts` | GroupViewComponent | lets a member report someone (not themselves) | ✅ Pass |
| 107 | `group-view.component.spec.ts` | GroupViewComponent | reloads pending requests live when the queue changes (admins) | ✅ Pass |
| 108 | `login.component.spec.ts` | LoginComponent | redirects to /bootstrap when the system has no users yet (R2) | ✅ Pass |
| 109 | `login.component.spec.ts` | LoginComponent | logs in with the typed credentials and goes to /groups | ✅ Pass |
| 110 | `login.component.spec.ts` | LoginComponent | shows the server's error message when login fails | ✅ Pass |
| 111 | `login.component.spec.ts` | LoginComponent extra | has a link to the register page | ✅ Pass |
| 112 | `login.component.spec.ts` | LoginComponent extra | shows a general message when the server gives no reason | ✅ Pass |
| 113 | `profile.component.spec.ts` | ProfileComponent | fills the form from the logged-in user, email is read-only | ✅ Pass |
| 114 | `profile.component.spec.ts` | ProfileComponent | saves the display name and updates the user | ✅ Pass |
| 115 | `profile.component.spec.ts` | ProfileComponent | does not save an empty display name | ✅ Pass |
| 116 | `profile.component.spec.ts` | ProfileComponent | checks the new passwords match and shows server errors | ✅ Pass |
| 117 | `profile.component.spec.ts` | ProfileComponent | saves preferences | ✅ Pass |
| 118 | `profile.component.spec.ts` | ProfileComponent | rejects a non-image or too-big avatar before uploading | ✅ Pass |
| 119 | `register.component.spec.ts` | RegisterComponent | is created with an empty form | ✅ Pass |
| 120 | `register.component.spec.ts` | RegisterComponent | does not submit when the passwords do not match | ✅ Pass |
| 121 | `register.component.spec.ts` | RegisterComponent | does not submit a date of birth in the future | ✅ Pass |
| 122 | `register.component.spec.ts` | RegisterComponent | does not submit a weak password | ✅ Pass |
| 123 | `register.component.spec.ts` | RegisterComponent | registers and goes to /groups | ✅ Pass |
| 124 | `register.component.spec.ts` | RegisterComponent | shows the server errors in the page | ✅ Pass |
| 125 | `room.component.spec.ts` | RoomComponent | joins the room from the route params and shows its name | ✅ Pass |
| 126 | `room.component.spec.ts` | RoomComponent | renders the stored history (last 5) returned on join | ✅ Pass |
| 127 | `room.component.spec.ts` | RoomComponent | adds messages pushed live by the server | ✅ Pass |
| 128 | `room.component.spec.ts` | RoomComponent | ignores messages for a different room | ✅ Pass |
| 129 | `room.component.spec.ts` | RoomComponent | shows a Delete button only on my own messages | ✅ Pass |
| 130 | `room.component.spec.ts` | RoomComponent | removes a message when the server broadcasts its deletion | ✅ Pass |
| 131 | `room.component.spec.ts` | RoomComponent | shows a popup when another user joins | ✅ Pass |
| 132 | `room.component.spec.ts` | RoomComponent | sends the typed text through the ChatService and clears the box | ✅ Pass |
| 133 | `room.component.spec.ts` | RoomComponent | disables Send while the message box is empty | ✅ Pass |
| 134 | `room.component.spec.ts` | RoomComponent | redirects back to the group with the age banner when the server blocks entry | ✅ Pass |
| 135 | `room.component.spec.ts` | RoomComponent | shows who is online in the room | ✅ Pass |
| 136 | `room.component.spec.ts` | RoomComponent | shows the error from the server when a message is not sent | ✅ Pass |
| 137 | `room.component.spec.ts` | RoomComponent | goes back to the group when the room is removed | ✅ Pass |
| 138 | `room.component.spec.ts` | RoomComponent | shows who is typing and hides it when they stop | ✅ Pass |
| 139 | `room.component.spec.ts` | RoomComponent | ignores typing from other rooms and from myself | ✅ Pass |
| 140 | `room.component.spec.ts` | RoomComponent | stops showing someone as typing once their message arrives | ✅ Pass |
| 141 | `room.component.spec.ts` | RoomComponent | sends typing once while I type, then stops after 2s idle | ✅ Pass |
| 142 | `room.component.spec.ts` | RoomComponent | stops typing when the message is sent | ✅ Pass |
| 143 | `room.component.spec.ts` | RoomComponent | leaves the room when the component is destroyed | ✅ Pass |
| 144 | `navbar.component.spec.ts` | NavbarComponent | shows the admin links only to the Super Admin | ✅ Pass |
| 145 | `navbar.component.spec.ts` | NavbarComponent | hides the admin links from normal users and skips the badge | ✅ Pass |
| 146 | `navbar.component.spec.ts` | NavbarComponent | shows the pending request count for a Group Admin | ✅ Pass |
| 147 | `navbar.component.spec.ts` | NavbarComponent | reloads the badge when the request queue changes | ✅ Pass |
| 148 | `navbar.component.spec.ts` | NavbarComponent | logs out, closes the socket and goes to /login | ✅ Pass |

### 9.6 End-to-end tests (Playwright) — `npm run e2e` in `client/`

| # | File | Suite | Test | Result |
|---|------|-------|------|--------|
| 1 | `fabulari.spec.ts` |  | login form: wrong password shows an error, right password opens the groups page | ✅ Pass |
| 2 | `fabulari.spec.ts` |  | register form checks the password before sending it | ✅ Pass |
| 3 | `fabulari.spec.ts` |  | three users chat live (with "is typing…"); the one who leaves stops getting messages | ✅ Pass |
| 4 | `fabulari.spec.ts` |  | a user who is too young is blocked from joining the group | ✅ Pass |
| 5 | `fabulari.spec.ts` |  | group search finds groups by title | ✅ Pass |

---

## 10. Git usage in Phase 2

The same approach as Phase 1 (see Phase1.md §2 and `docs/GIT_WORKFLOW.md`):
small commits with conventional prefixes (`feat:`, `fix:`, `test:`, `docs:`,
`chore:`, `refactor:`) on short-lived branches merged into `main` with merge
commits, so the history shows what was built together. Phase 2 branches:

| Branch | Work |
|--------|------|
| `feature/mongodb-persistence` | MongoDB data layer, async routes, shared services, import/reset scripts |
| `feature/socket-chat` | Socket.IO server handlers, `ChatService`, real `RoomComponent`, live notifications, online list, pending badge |
| `feature/search-and-validation` | Group search + pagination, admin log pages, room removal, ban reports, client form checks, error messages |
| `test/phase2-automated-tests` | Mocha/Chai/Sinon server tests, Vitest Angular tests, Playwright E2E |
| `docs/phase2` | This document, README update |
| `docs/known-limitations` | Updated known limitations after the Phase 2 features |
| `feature/typing-indicator` | "X is typing…" in rooms: `room:typing` socket event, `ChatService.sendTyping()` / `typing$`, Room page, tests |

`server/data/db.json` (the Phase 1 store) is kept only as the input for
`npm run import-json`; `node_modules/`, build output and the test database are
not committed.

---

## 11. Known limitations

- **No separate "demote admin" action.** An admin can only step down by
  leaving the group, and only if another admin is left (R9).
- **Search is simple.** Group search is a case-insensitive text match on the
  title and description (with a max-age filter). There is no full-text index
  or ranking; that's fine for the expected number of groups.
- **Only the last 5 messages are kept per room** (by design, §3.4). Older
  messages are deleted, so there is no long chat history to scroll back through.
- **One server only.** "Who's online" uses the Socket.IO rooms of this one
  server. Running several servers would need the Socket.IO Redis/Mongo adapter.
- The Angular CLI marks the Vitest `unit-test` builder as *experimental* in
  Angular 20 (it becomes the default in Angular 21). It works as documented.
