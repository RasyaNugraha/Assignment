import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

// Only logged-in users can open these pages.
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

// Only the Super Admin can open these pages.
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.currentUser()?.isSuperAdmin ? true : router.parseUrl('/groups');
};
