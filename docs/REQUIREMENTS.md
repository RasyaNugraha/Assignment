# Fabulari — Requirements Specification

Multi-user, text-and-image chat application. MEAN stack (MongoDB, Express, Angular, Node.js).
Requirements gathered from the client Q&A session in Week 2 lecture (Allan Browning acting as client).

## 1. Core Concept

- Multi-user chat app sending **text and images** only (no voice, no video).
- Structure: **Groups** contain multiple **Rooms** (a Room = a channel).
- A user can be a member of many Groups, no membership limit.
- Being a Group member grants access to all Rooms in that Group (subject to each Room's age limit).
- All Groups are public/visible to everyone — no private groups.
- Not a friend-network app (no friend system, no DMs outside of rooms).

## 2. Roles

### Super Admin
- Exactly one at any time; created via a one-time **bootstrap process** the very first time the app runs (only if there are zero users in the system).
- Does not use chat at all. No access to chat history.
- Creates Groups on request, and appoints the requesting user as that Group's Group Admin.
- Approves/denies Group Admin escalations to permanently delete/ban a user from the entire system.
- Sees the same app, but with a different (admin) view based on permission level — not a separate dashboard.

### Group Admin
- A regular user with extra permissions scoped to their Group(s). Can admin multiple Groups.
- Appointed automatically when their group-creation request is approved.
- Approves/denies user requests to join their Group.
- Can ban a user from their Group only (not system-wide).
- Can escalate a request to Super Admin to delete a user's account entirely (with reason).
- Can edit Group description and minimum age limit (cannot rename the Group).
- Can create/remove Rooms within their Group(s).
- Cannot leave admin role unless another admin is appointed first (a Group must always have ≥1 admin).

### General User
- Registers an account; sees nothing until joining a Group.
- Can see the full list of all Groups (to request joining).
- Can request to join a Group (goes to Group Admin for approval).
- Cannot request another user be added to a group — only self-requests.
- Can request a Room be created (Group Admin creates it).
- Can request another user be banned from a Group (with reason, goes to Group Admin).
- Can delete only their own sent messages.
- No message reply/threading.

## 3. Authentication

- Simple username/password only — no OAuth, no JWT.
- Unique identifier: user's email.
- Password hashed (e.g. BCrypt), never stored in plain text.
- Password rules: minimum 8 characters, at least 1 uppercase letter.
- No forced password expiry.
- Change-password flow: old password + new password + confirm, validated server-side.
- **No forgot-password / reset feature** — if forgotten, user creates a new account.
- HTTPS recommended for client-server communication in the final build.

## 4. Bootstrap Process

- Runs only if the system currently has zero users.
- Collects: email, first name, last name, date of birth, password.
- Created user becomes Super Admin.
- Process is disabled permanently afterward.

## 5. User Profile

- Required fields: email, first name, last name, date of birth (self-reported, unverified — age is derived from it, not stored directly), password.
- Profile page: upload/change profile picture, display name can be changed (email/username cannot).
- Profile pages are private (not viewable by other users).
- Optional personal UI preferences (e.g. dark/light mode, font size).
- Profile picture + timestamp shown on every chat message.

## 6. Groups

- Fields: title (max 30 chars), description (max 250 chars), minimum age limit.
- Created only by Super Admin on request; requester becomes Group Admin.
- Optional background color theme (no custom images).
- No private groups — all visible in the group list.
- Leaving a group removes the user from it entirely (no lingering record).

## 7. Rooms / Channels

- Belong to exactly one Group.
- Have their own minimum age limit, set by the Group Admin at creation.
- Users below a Room's age limit are blocked from entry with a notification explaining why.
- Created/removed by Group Admin, typically on user request.
- Single flat message stream per Room — no threads.

## 8. Messaging

- Text (no length limit) and images (PNG, GIF, JPEG only, **max 2MB**).
- No voice, video, hyperlink rendering, @mentions, rich text, search, or offline delivery.
- No content moderation / profanity filtering.
- Message includes timestamp (time "send" was pressed) and sender's profile picture.
- On joining a Room, user sees the **last 5 messages** (server-persisted).
- Server persists only the last 5 messages per Room. Full scrollback for the current live session exists only in-browser (not persisted).
- Users can delete only their own messages, even ones no longer server-side — done via a socket broadcast (by message ID) telling connected clients to remove it locally.
- No message editing.
- No typing indicators, no read receipts/seen ticks.
- Join/leave notifications: when a user enters or leaves a Room, everyone currently in that Room gets a popup notification.

## 9. Administrative Logging

- All administrative actions must be logged: users added/removed from groups, accounts created/deleted, group/room created/removed, etc.
- Regular chat messages are NOT logged.
- Admins/Super Admin can view and filter these logs by type.

## 10. UI/UX

- Target platform: desktop first. Bonus marks for responsive design (down to ~tablet width, ~768px).
- No mandated layout — student's design choice.
- Use provided logo/brand colors/font (from course website) as inspiration.
- English only, no i18n.
- Bootstrap or another CSS framework is fine.

## 11. Data & Tech

- **Phase 1**: data persistence via a JSON file written on the server (Mongo not taught until Week 6).
- **Phase 2**: migrate to MongoDB; add Socket.IO for real-time chat.
- No production deployment expected — runs locally during development.

## 12. Assignment Phasing

### Phase 1 (Assignment 1) — demo Week 7
Planning + design + prototype in Angular. Functional scope:
- Bootstrap / Super Admin creation
- User registration & login
- Group creation requests, join requests, approvals
- Room creation requests, approvals
- **No actual chat/messaging functionality required yet**

### Phase 2 (Assignment 2) — demo Week 12
- Full real-time chat via Socket.IO
- Migrate persistence to MongoDB
- All messaging features from Section 8

## 13. Open Question / Follow-up

There's a minor inconsistency in the transcript: an early comment suggested chat history is stored "forever," but later, repeated and more detailed clarification states only the **last 5 messages per Room** are persisted server-side. Treating the "last 5" rule as authoritative since it was explained in more implementation detail — but worth a follow-up email to the lecturer before end of Week 3 if we want to be 100% sure.
