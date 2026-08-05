import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';

// Phase1.md section 5.4 routing table. Admin queue/log routes aren't built
// yet (Week 6 per TIMELINE.md) — auth.guard.ts already exports
// superAdminGuard, ready to attach to those routes when they land.
export const routes: Routes = [
  { path: 'bootstrap', loadComponent: () => import('./pages/bootstrap/bootstrap.component').then((m) => m.BootstrapComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: 'groups', loadComponent: () => import('./pages/group-list/group-list.component').then((m) => m.GroupListComponent) },
      { path: 'groups/:groupId', loadComponent: () => import('./pages/group-view/group-view.component').then((m) => m.GroupViewComponent) },
      { path: 'groups/:groupId/rooms/:roomId', loadComponent: () => import('./pages/room/room.component').then((m) => m.RoomComponent) },
      { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then((m) => m.ProfileComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'groups' },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
