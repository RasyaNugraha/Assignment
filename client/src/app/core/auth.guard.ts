import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

// Protects everything under the main layout (Phase1.md §5.4). Re-checks the
// session with the server on every navigation (not just the in-memory
// signal) so a hard refresh doesn't wrongly bounce a logged-in user, and a
// logged-out one can't reach a protected route by URL.
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.currentUser()) return true;

  try {
    await auth.me();
    return true;
  } catch {
    return router.parseUrl('/login');
  }
};

// Restricts Super-Admin-only screens (queue, admin log — Phase1.md §5.4).
// Assumes authGuard already ran and populated currentUser.
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.currentUser()?.isSuperAdmin ? true : router.parseUrl('/groups');
};
