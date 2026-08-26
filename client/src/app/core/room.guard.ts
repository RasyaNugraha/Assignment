import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { GroupService } from './group.service';

// R17/R18 — a Room can set its own minAge, which may exceed its parent
// Group's (models.ts), so entry has to be checked per-Room, not just at the
// Group level. Runs after authGuard (parent route), so currentUser is
// already populated — matches the same CanActivateFn pattern from
// auth.guard.ts (Week 4 lecture: functional guards via inject(), not class
// guards).
//
// This is the fast, client-side half of R18's age check — it saves a
// round-trip when the answer is already obvious from data the client has.
// It is NOT the authority: GroupService.getRoom() hits GET
// /api/groups/:groupId/rooms/:roomId, which re-checks the same limit
// server-side (server/routes/groups.js), because nothing stops a request
// straight to the Room URL — or a tampered client — from skipping this
// guard entirely. RoomComponent calls that endpoint on init and redirects
// the same way if the server says no.
export const roomAgeGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const groupService = inject(GroupService);
  const router = inject(Router);

  const groupId = route.paramMap.get('groupId');
  const roomId = route.paramMap.get('roomId');
  const user = auth.currentUser();
  if (!groupId || !roomId || !user) return router.parseUrl('/groups');

  try {
    // GroupDetail includes this Group's rooms (models.ts), each with its own
    // minAge, so one fetch is enough to check the specific Room being entered.
    const group = await groupService.getById(groupId);
    const room = group.rooms.find((r) => r.id === roomId);
    if (!room) return router.parseUrl(`/groups/${groupId}`);

    if (user.age < room.minAge) {
      return router.createUrlTree(['/groups', groupId], { queryParams: { ageBlocked: room.minAge } });
    }
    return true;
  } catch {
    return router.parseUrl(`/groups/${groupId}`);
  }
};
