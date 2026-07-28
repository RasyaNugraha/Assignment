# Fabulari — Screen Planning / Wireframe Notes

Rough plan of the screens needed for Phase 1 (admin/user-management flows, no chat UI required yet
beyond a placeholder Room view).

## 1. Bootstrap Screen
- Shown only if the system has zero users.
- Form: email, first name, last name, age, password, confirm password.
- Submit creates the first user as Super Admin, then this screen is never shown again.

## 2. Login Screen
- Fields: email, password.
- Link/button to Register.
- On success, route based on role (Super Admin view vs General/Group Admin view).

## 3. Register Screen
- Fields: email, first name, last name, age, password, confirm password.
- Validates password rule (8+ chars, 1 uppercase) and email uniqueness.
- On success, logs in as General User with no group memberships yet.

## 4. Main / Group List Screen (General User & Group Admin)
- Top nav: app logo, profile icon/avatar (links to Profile), logout.
- Sidebar or list: "My Groups" (groups the user has joined) — ordered by most recent interaction.
- Main panel: "All Groups" — full list of every group in the system with a "Request to Join" button
  (disabled/hidden if already a member or already requested).
- Button: "Request New Group" — opens a small form (group name, description, age limit) that sends a
  creation request to the Super Admin queue.

## 5. Group View Screen
- Header: group title, description, age limit, background color.
- List of Rooms in the group, each with a "Enter Room" button (age-gated).
- Button: "Request New Room" (visible to members) — form: room name, age limit — sent to Group Admin.
- If current user is Group Admin of this group: extra controls — edit description/age limit, view
  pending join requests (approve/deny), view members list, ban member.

## 6. Room Screen (placeholder for Phase 1)
- Header: room name, age limit, member count.
- Message list area — Phase 1 can show static/placeholder content since chat isn't required yet.
- Leave Room button.

## 7. Profile Screen
- Avatar upload/change.
- Display name (editable), email (read-only).
- Change password form (old, new, confirm).
- UI preference toggles (dark/light mode, font size) — optional/nice-to-have.

## 8. Super Admin Queue Screen
- Tab 1 — "Group Requests": list of pending group-creation requests (requester, proposed name/desc),
  Approve / Deny buttons.
- Tab 2 — "Account Deletion Requests": list of escalated ban/delete requests from Group Admins
  (target user, requesting admin, reason), Approve / Deny buttons.
- Access restricted to Super Admin only.

## 9. Admin Log Screen
- Table of administrative actions: timestamp, action type, actor, target, details.
- Filter dropdown by action type (user created, user deleted, group created, member added/removed,
  room created/removed, etc.)
- Visible to Super Admin (all logs) and Group Admin (logs scoped to their group, optional stretch).

## Navigation Flow (Phase 1)

```
Bootstrap (first run only)
   |
   v
Login <----> Register
   |
   v
Group List (My Groups | All Groups)
   |            |
   v            v
Group View   Request New Group -> Super Admin Queue
   |
   +--> Room (placeholder)
   +--> Request New Room -> Group Admin approval
   +--> (if Group Admin) Manage Join Requests / Members

Profile screen accessible from top nav at any time.
Super Admin Queue + Admin Log accessible from top nav for Super Admin only.
```

## Notes for Phase 1 build order

1. Login / Register / Bootstrap (auth flow, JSON file storage)
2. Group List + Request New Group + Super Admin approval queue
3. Group View + Request New Room + Group Admin approval
4. Join request approve/deny flow
5. Profile screen (avatar, password change)
6. Admin log screen
7. Room screen as a placeholder (real chat comes in Phase 2)
