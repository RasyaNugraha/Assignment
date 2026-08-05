// Shared frontend contracts mirroring the backend entities in Phase1.md
// section 4 (§5.3: "one shared contract, no duplicate frontend-only shapes").
// Group/Room API routes don't exist yet (planned for Week 5-6 per
// TIMELINE.md), so pages using these interfaces currently render mock data
// — see the MOCK_* comments in group-list / group-view / room components.

export interface Group {
  id: string;
  title: string; // max 30 chars (R13)
  description: string; // max 250 chars (R13)
  minAge: number;
  backgroundColor: string | null;
  adminIds: string[];
  memberIds: string[];
  createdAt: string;
}

export interface Room {
  id: string;
  groupId: string;
  name: string;
  minAge: number; // can exceed the parent Group's minAge (R17)
  createdAt: string;
}
