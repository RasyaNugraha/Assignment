import { Routes } from '@angular/router';

// Only the auth flow (Bootstrap / Login / Register) is built so far.
// Group/Room/Profile/Admin routes land here once those components exist —
// see Phase1.md section 5.4 for the full planned routing table.
export const routes: Routes = [
  { path: 'bootstrap', loadComponent: () => import('./pages/bootstrap/bootstrap.component').then((m) => m.BootstrapComponent) },
  { path: 'login', loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/register/register.component').then((m) => m.RegisterComponent) },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
