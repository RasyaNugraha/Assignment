import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

// Protects routes under the main layout; re-checks session with server.
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

// Restricts Super-Admin-only screens. Assumes authGuard already ran.
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.currentUser()?.isSuperAdmin ? true : router.parseUrl('/groups');
};
