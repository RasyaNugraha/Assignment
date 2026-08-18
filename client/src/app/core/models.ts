// Shared frontend contracts mirroring the backend entities in Phase1.md
// section 4 (§5.3: "one shared contract, no duplicate frontend-only shapes").
// GET /api/groups is live as of Week 5 (server/routes/groups.js); Room
// routes are still planned — RoomComponent still renders mock data for now.

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

export interface GroupRequest {
  id: string;
  type: 'group_creation' | 'group_join';
  requesterId: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  // group_creation only:
  title?: string;
  description?: string;
  minAge?: number;
  // group_join only:
  groupId?: string;
}

export interface Room {
  id: string;
  groupId: string;
  name: string;
  minAge: number; // can exceed the parent Group's minAge (R17)
  createdAt: string;
}
