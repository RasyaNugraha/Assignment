// Data types, same shape as the server sends.

export interface Group {
  id: string;
  title: string; // max 30 chars (R13)
  description: string; // max 250 chars (R13)
  minAge: number;
  backgroundColor: string | null;
  adminIds: string[];
  memberIds: string[];
  bannedIds?: string[]; // R8 — members banned from this specific Group only
  createdAt: string;
  // Set by the server for the current user.
  isMember?: boolean;
  isAdmin?: boolean;
  hasPendingJoinRequest?: boolean;
}

export interface GroupDetail extends Group {
  rooms: Room[];
  // Only sent to group admins.
  members?: MemberSummary[];
}

export interface MemberSummary {
  id: string;
  displayName: string;
  isAdmin: boolean;
}

export type RequestType = 'group_creation' | 'group_join' | 'room_creation' | 'account_deletion' | 'ban_request';

export interface GroupRequest {
  id: string;
  type: RequestType;
  requesterId: string;
  status: 'pending' | 'approved' | 'denied';
  createdAt: string;
  // group_creation only:
  title?: string;
  description?: string;
  // group_join / room_creation / account_deletion / ban_request:
  groupId?: string;
  // room_creation only:
  name?: string;
  minAge?: number;
  // account_deletion / ban_request:
  targetUserId?: string;
  reason?: string;
  // Names added by the server for the UI.
  requesterDisplayName?: string;
  groupTitle?: string | null;
  targetDisplayName?: string;
}

export interface Room {
  id: string;
  groupId: string;
  name: string;
  minAge: number; // can exceed the parent Group's minAge (R17)
  createdAt: string;
}

// A chat message.
export interface ChatMessage {
  id: string;
  roomId: string;
  groupId: string;
  senderId: string;
  senderDisplayName: string;
  senderHasAvatar: boolean;
  text: string;
  imageUrl: string | null; // base64 data URL (PNG/GIF/JPEG, ≤2MB)
  sentAt: string; // ISO time "send" was pressed
  seq: number; // server ordering key
}

// Someone joined / left the room.
export interface PresenceNotice {
  roomId: string;
  user: { id: string; displayName: string };
  at: string;
}

// Reply from a socket event.
export interface SocketAck<T = unknown> {
  ok: boolean;
  error?: string;
  minAge?: number;
  room?: Room;
  messages?: ChatMessage[];
  message?: ChatMessage;
  data?: T;
}

// One page of results from the server.
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Who is in a room right now.
export interface RoomMembersEvent {
  roomId: string;
  members: { id: string; displayName: string }[];
}

// Popup sent to one user (e.g. "your request was approved").
export interface AppNotification {
  text: string;
  at: string;
}
