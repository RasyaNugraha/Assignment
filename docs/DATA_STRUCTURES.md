# Data Structures

Phase 1 persists all data in a single JSON file, `server/data/db.json`,
shaped as one object with six top-level arrays (collections). All reads and
writes go through `server/services/dbService.js` (`getAll`, `findById`,
`findOne`, `findMany`, `insert`, `update`, `remove`, `logAdminAction`) — no
route handler touches the file directly. This is deliberate: Phase 2 only
needs to rewrite `dbService.js` to use MongoDB/Mongoose, without touching any
route file.

## `users`

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | Primary key |
| `email` | string | Unique, lowercased, immutable after registration |
| `passwordHash` | string | bcrypt hash — never sent to the client (stripped in `toPublicUser()`) |
| `firstName`, `lastName` | string | |
| `displayName` | string | Editable via `PUT /api/users/me` |
| `dateOfBirth` | string (ISO date) | Source of truth for age — never a raw stored `age` number, so it can't go stale |
| `isSuperAdmin` | boolean | Exactly one user has this `true`, set once at bootstrap |
| `groupAdminOf` | string[] | Group IDs this user administers |
| `groupMemberships` | string[] | Group IDs this user is a member of |
| `avatarUrl` | string \| null | Either `null` or a `data:image/...;base64,...` URL |
| `preferences` | `{ theme, fontSize }` | Personal UI prefs, `theme: 'light'\|'dark'`, `fontSize: 'small'\|'medium'\|'large'` |
| `createdAt` | string (ISO datetime) | |

`age` is **not** stored — it's computed on every response by `computeAge(dateOfBirth)`
and attached to the object the client receives.

## `groups`

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `title` | string | Max 30 chars, immutable once created |
| `description` | string | Max 250 chars, editable by a Group Admin |
| `minAge` | number | Group-level age floor |
| `backgroundColor` | string \| null | Reserved for future theming |
| `adminIds` | string[] | Always ≥ 1 (enforced by the leave/appoint-admin routes) |
| `memberIds` | string[] | Includes admins — every admin is also a member |
| `createdAt` | string (ISO datetime) | |

Viewer-relative flags (`isMember`, `isAdmin`, `hasPendingJoinRequest`) and,
for admin viewers, a `members` summary list, are computed per-request in
`toPublicGroup()`/`toMemberSummaries()` — not stored on the record itself.

## `rooms`

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `groupId` | string | Parent group |
| `name` | string | Max 30 chars |
| `minAge` | number | Room-level age floor — can be higher than the parent Group's |
| `createdAt` | string (ISO datetime) | |

## `requests`

A single unified queue for every kind of "ask an admin" action, distinguished
by `type`.

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `type` | `'group_creation' \| 'group_join' \| 'room_creation'` | |
| `requesterId` | string | |
| `status` | `'pending' \| 'approved' \| 'denied'` | |
| `createdAt` | string | |
| `resolvedAt` | string \| null | |
| `resolvedBy` | string \| null | User ID of whoever approved/denied it |
| `title`, `description` | string | `group_creation` only |
| `groupId` | string | `group_join` / `room_creation` only |
| `name` | string | `room_creation` only (room name) |
| `minAge` | number | `group_creation` / `room_creation` only |

Who can resolve a request depends on `type`: `group_creation` → the Super
Admin; `group_join`/`room_creation` → any admin of the target group
(`canResolve()` in `server/routes/requests.js`).

## `adminLogs`

| Field | Type | Notes |
|---|---|---|
| `id` | string (UUID) | |
| `action` | string | e.g. `user_created`, `group_created`, `group_admin_appointed`, `group_left`, `room_created`, `group_join_approved`, `<type>_denied` |
| `actorId` | string | Who performed the action |
| `targetId` | string \| null | What it was performed on (user/group/room ID) |
| `details` | string | Human-readable summary, pre-rendered server-side |
| `timestamp` | string (ISO datetime) | |

Written via `db.logAdminAction(...)` at the point of every administrative
action, so the log is always in sync with what actually happened. Readable
only by the Super Admin (`GET /api/admin/logs`), with optional `action`/
`from`/`to` filters.

## `messages`

Empty array, reserved for Phase 2 (real-time chat via Socket.IO). Not used
by any Phase 1 route.
