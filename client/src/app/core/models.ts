// Shared frontend contracts mirroring the backend entities in Phase1.md
// section 4 (§5.3: "one shared contract, no duplicate frontend-only shapes").
// GET /api/groups is live as of Week 5 (server/routes/groups.js); room
// requests + the request queue (approve/deny) are wired up as of Week 5
// too — RoomComponent (the actual chat view) still renders a placeholder,
// since live chat is Phase 2.

export interface Group {
  id: string;
  title: string; // max 30 chars (R13)
  description: string; // max 250 chars (R13)
  minAge: number;
  backgroundColor: string | null;
  adminIds: string[];
  memberIds: string[];
  createdAt: string;
  // Viewer-relative flags — computed server-side per request in
  // server/routes/groups.js's toPublicGroup(), so the client never has to
  // cross-reference groups against a separate membership list itself.
  isMember?: boolean;
  isAdmin?: boolean;
  hasPendingJoinRequest?: boolean;
}

export interface GroupDetail extends Group {
  rooms: Room[];
}

export type RequestType = 'group_creation' | 'group_join' | 'room_creation';

export interface GroupRequest {
  id: string;
  type: RequestType;
  requesterId: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  // group_creation only:
  title?: string;
  description?: string;
  // group_join / room_creation:
  groupId?: string;
  // room_creation only:
  name?: string;
  minAge?: number;
  // Display-friendly fields the server attaches (routes/requests.js
  // toPublicRequest()) so the queue UI doesn't have to look users/groups up
  // itself.
  requesterDisplayName?: string;
  groupTitle?: string | null;
}

export interface Room {
  id: string;
  groupId: string;
  name: string;
  minAge: number; // can exceed the parent Group's minAge (R17)
  createdAt: string;
}
