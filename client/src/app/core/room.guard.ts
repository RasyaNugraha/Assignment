import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { GroupService } from './group.service';

// Blocks the room page if the user is too young (the server checks again).
export const roomAgeGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const groupService = inject(GroupService);
  const router = inject(Router);

  const groupId = route.paramMap.get('groupId');
  const roomId = route.paramMap.get('roomId');
  const user = auth.currentUser();
  if (!groupId || !roomId || !user) return router.parseUrl('/groups');

  try {
    // Get the group to find the room's min age.
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
