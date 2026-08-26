# REST API Reference

Base URL: `http://localhost:3000/api`. Auth is session/cookie-based
(`express-session`) — routes marked **Auth required** need a valid session
cookie (set on login/register/bootstrap), returning `401` otherwise. Routes
marked **Super Admin only** or **Group Admin only** additionally check the
current user's role, returning `403` if not authorised.

## Bootstrap & Auth (`server/routes/auth.js`)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/bootstrap/status` | — | — | `{ needsBootstrap: boolean }` |
| POST | `/bootstrap` | — (blocked once any user exists) | `{ email, password, firstName, lastName, dateOfBirth }` | Created user (Super Admin), starts session |
| POST | `/auth/register` | — | `{ email, password, firstName, lastName, dateOfBirth }` | Created user (General User), starts session |
| POST | `/auth/login` | — | `{ email, password }` | Logged-in user, starts session |
| POST | `/auth/logout` | Auth required | — | `204 No Content`, destroys session |
| GET | `/auth/me` | Auth required | — | Current user (used to re-sync session on app load) |

All user responses use `toPublicUser()`: strips `passwordHash`, adds a
freshly computed `age` from `dateOfBirth`.

## Groups & Rooms (`server/routes/groups.js`)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/groups` | — | — | All groups, with viewer-relative flags |
| GET | `/groups/:id` | — | — | Group + its `rooms`; admins also get a `members` list |
| POST | `/groups/requests` | Auth required | `{ title, description, minAge }` | New pending `group_creation` request |
| POST | `/groups/:id/join` | Auth required | — | New pending `group_join` request |
| POST | `/groups/:id/rooms/requests` | Auth required, must be a member | `{ name, minAge }` | New pending `room_creation` request |
| POST | `/groups/:id/admins` | Group Admin only | `{ userId }` | Updated group; appoints `userId` as co-admin |
| POST | `/groups/:id/leave` | Auth required, must be a member | — | Updated group; blocked if requester is the sole admin |
| PATCH | `/groups/:id` | Group Admin only | `{ description?, minAge? }` | Updated group (title can't be changed) |

## Requests queue (`server/routes/requests.js`)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/requests` | Auth required | — | Pending requests this user is allowed to resolve |
| POST | `/requests/:id/approve` | Auth required, must be allowed to resolve | — | Resolved request; also creates the Group/Room/membership it was for |
| POST | `/requests/:id/deny` | Auth required, must be allowed to resolve | — | Resolved request, marked `denied` |

## User self-service (`server/routes/users.js`)

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| PUT | `/users/me` | Auth required | `{ displayName }` | Updated user |
| PUT | `/users/me/password` | Auth required | `{ oldPassword, newPassword, confirmNewPassword }` | `204 No Content` |
| PUT | `/users/me/preferences` | Auth required | `{ theme?, fontSize? }` | Updated user |
| PUT | `/users/me/avatar` | Auth required | `{ avatarUrl }` (base64 `data:image/...` URL, up to 2MB decoded) | Updated user |

## Admin log (`server/routes/adminLogs.js`)

| Method | Path | Auth | Query params | Returns |
|---|---|---|---|---|
| GET | `/admin/logs` | Super Admin only | `action?`, `from?`, `to?` (ISO date filters) | Matching log entries, newest first |

## Misc

| Method | Path | Returns |
|---|---|---|
| GET | `/status` | `{ ok: true, app: 'fabulari-server', phase: 1 }` — basic health check |

## Error shape

Every error response is `{ error: "message" }` (or `{ errors: ["message", ...] }`
for multi-field validation on registration/bootstrap), with an appropriate
HTTP status: `400` validation, `401` not logged in / wrong credentials, `403`
not authorised for this action, `404` not found, `409` conflict (e.g.
already a member, request already resolved).
