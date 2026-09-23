import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Component } from '@angular/core';
import { AppComponent } from './app.component';
import { routes } from './app.routes';

@Component({ standalone: true, template: '<p class="stub">stub page</p>' })
class StubPage {}

describe('AppComponent', () => {
  it('is created', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('only renders a router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
  });

  it('shows the routed page inside the outlet', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'x', component: StubPage }])] });
    const fixture = TestBed.createComponent(AppComponent);
    await TestBed.inject(Router).navigateByUrl('/x');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('stub page');
  });

  it('has routes for every page', () => {
    const paths = routes.flatMap((r) => [r.path, ...(r.children ?? []).map((c) => c.path)]);
    for (const p of ['bootstrap', 'login', 'register', 'groups', 'groups/:groupId', 'groups/:groupId/rooms/:roomId', 'profile', 'admin/queue', 'admin/logs']) {
      expect(paths).toContain(p);
    }
  });

  it('protects the logged-in pages and admin pages with guards', () => {
    const layout = routes.find((r) => r.children)!;
    expect(layout.canActivate?.length).toBe(1);
    const admin = layout.children!.filter((c) => c.path?.startsWith('admin/'));
    expect(admin.every((c) => c.canActivate?.length === 1)).toBe(true);
    const room = layout.children!.find((c) => c.path === 'groups/:groupId/rooms/:roomId')!;
    expect(room.canActivate?.length).toBe(1);
  });
});
