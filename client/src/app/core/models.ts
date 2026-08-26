// Shared frontend contracts mirroring the backend entities.

export interface Group {
  id: string;
  title: string; // max 30 chars (R13)
  description: string; // max 250 chars (R13)
  minAge: number;
  backgroundColor: string | null;
  adminIds: string[];
  memberIds: string[];
  createdAt: string;
  // Viewer-relative flags, computed server-side per request.
  isMember?: boolean;
  isAdmin?: boolean;
  hasPendingJoinRequest?: boolean;
}

export interface GroupDetail extends Group {
  rooms: Room[];
  // Attached by the server only when the viewer isAdmin (R9).
  members?: MemberSummary[];
}

export interface MemberSummary {
  id: string;
  displayName: string;
  isAdmin: boolean;
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
  // Display-friendly fields the server attaches for the queue UI.
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
