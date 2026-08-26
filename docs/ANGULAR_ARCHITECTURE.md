# Angular Architecture

Angular 20+, standalone components throughout (no `NgModule`), functional
route guards (`CanActivateFn`), `inject()` for DI, and Angular `signal`/
`computed` for reactive state instead of manual change detection.

## Routing (`client/src/app/app.routes.ts`)

| Path | Component | Guard |
|---|---|---|
| `/bootstrap` | `BootstrapComponent` | — |
| `/login` | `LoginComponent` | — |
| `/register` | `RegisterComponent` | — |
| `/groups` | `GroupListComponent` | `authGuard` (parent) |
| `/groups/:groupId` | `GroupViewComponent` | `authGuard` (parent) |
| `/groups/:groupId/rooms/:roomId` | `RoomComponent` | `authGuard` (parent) + `roomAgeGuard` |
| `/profile` | `ProfileComponent` | `authGuard` (parent) |
| `/admin/queue` | `AdminQueueComponent` | `authGuard` (parent) + `superAdminGuard` |
| `/admin/logs` | `AdminLogComponent` | `authGuard` (parent) + `superAdminGuard` |

All authenticated routes are children of a layout route running
`MainLayoutComponent`, guarded once by `authGuard` at the parent level.

## Components

| Component | Path | Role |
|---|---|---|
| `BootstrapComponent` | `pages/bootstrap` | First-run form to create the initial Super Admin |
| `LoginComponent` | `pages/login` | Email/password login |
| `RegisterComponent` | `pages/register` | General User self-registration |
| `MainLayoutComponent` | `layout/main-layout` | Shell for authenticated routes: navbar + `<router-outlet>` |
| `NavbarComponent` | `shared/navbar` | Top nav, shown only once logged in; handles logout |
| `GroupListComponent` | `pages/group-list` | "My Groups" / "All Groups", request-new-group form |
| `GroupViewComponent` | `pages/group-view` | One group's rooms + (if admin) an admin panel: join/room requests, members list with "Make Admin" |
| `RoomComponent` | `pages/room` | Room shell; Phase 1 shows static mock messages only, real-time chat is Phase 2 |
| `ProfileComponent` | `pages/profile` | Display name, password change, UI preferences, avatar upload |
| `AdminQueueComponent` | `pages/admin-queue` | Super Admin's queue of pending group-creation requests |
| `AdminLogComponent` | `pages/admin-log` | Super Admin's filterable view of the admin action log |

## Services (`client/src/app/core/`)

| Service | Backs | Key methods |
|---|---|---|
| `AuthService` | `/api/bootstrap*`, `/api/auth/*` | `bootstrap`, `register`, `login`, `logout`, `me`; holds the shared `currentUser` signal, mirrored to `localStorage` |
| `UserService` | `/api/users/me*` | `updateDisplayName`, `changePassword`, `updatePreferences`, `updateAvatar` |
| `GroupService` | `/api/groups*` | `getAll`, `getById`, `requestNewGroup`, `requestToJoin`, `requestRoom`, `appointAdmin`, `leave` |
| `RequestService` | `/api/requests*` | `getPending`, `approve`, `deny` |
| `AdminLogService` | `/api/admin/logs` | `getLogs` |

Every service follows the same pattern: `HttpClient` methods return an
Observable, wrapped once by a private `toPromise()` helper so the rest of
the app can `await` calls instead of nesting `.subscribe()`.

## Guards (`client/src/app/core/`)

| Guard | Type | Purpose |
|---|---|---|
| `authGuard` | `CanActivateFn` | Requires a logged-in user; re-validates against the server session (`AuthService.me()`) rather than trusting only the in-memory/localStorage signal |
| `superAdminGuard` | `CanActivateFn` | Restricts a route to the Super Admin (assumes `authGuard` already ran) |
| `roomAgeGuard` | `CanActivateFn` | Blocks entry to a Room whose `minAge` exceeds the current user's age; redirects back to the Group View with an `?ageBlocked=<minAge>` query param for an error banner |

## Models (`client/src/app/core/models.ts`, `auth.service.ts`)

| Model | Shape | Notes |
|---|---|---|
| `User` | id, email, firstName, lastName, displayName, dateOfBirth, age, isSuperAdmin, groupAdminOf[], groupMemberships[], avatarUrl, preferences | Mirrors the server's `toPublicUser()`, never includes `passwordHash` |
| `Group` | id, title, description, minAge, backgroundColor, adminIds[], memberIds[], createdAt, plus viewer flags (`isMember`, `isAdmin`, `hasPendingJoinRequest`) | |
| `GroupDetail` | `Group` + `rooms: Room[]` + optional `members: MemberSummary[]` | `members` only present for admin viewers |
| `MemberSummary` | id, displayName, isAdmin | Powers the "appoint co-admin" UI |
| `Room` | id, groupId, name, minAge, createdAt | |
| `GroupRequest` | id, type, requesterId, status, createdAt, plus type-specific fields, plus display-friendly `requesterDisplayName`/`groupTitle` | Covers all three request types in one shape |
| `AdminLogEntry` | id, action, actorId, targetId, details, timestamp | Mirrors server's admin log shape |

## State management approach

No NgRx/global store — state lives in each service as a `signal` (e.g.
`AuthService.currentUser`) or is fetched per-component into local signals
(e.g. `GroupViewComponent.group`). Components read/derive with `computed()`
(e.g. `isGroupAdmin = computed(() => this.group().isAdmin ?? false)`) so
UI stays in sync with the underlying signal without manual subscriptions,
while route params are read via `route.paramMap.subscribe(...)` (not
`snapshot`) so param changes are picked up even when Angular reuses a
component instance across navigations to the same route.
