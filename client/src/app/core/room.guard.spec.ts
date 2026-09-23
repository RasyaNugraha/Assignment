import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, convertToParamMap, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { roomAgeGuard } from './room.guard';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { makeGroupDetail, makeUser } from '../../testing/fakes';

describe('roomAgeGuard', () => {
  let getById: ReturnType<typeof vi.fn>;
  const route = (groupId: string, roomId: string) =>
    ({ paramMap: convertToParamMap({ groupId, roomId }) }) as unknown as ActivatedRouteSnapshot;
  const run = (r: ActivatedRouteSnapshot) =>
    TestBed.runInInjectionContext(() => roomAgeGuard(r, {} as RouterStateSnapshot)) as Promise<boolean | UrlTree>;
  const url = (tree: boolean | UrlTree) => TestBed.inject(Router).serializeUrl(tree as UrlTree);

  beforeEach(() => {
    getById = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: GroupService, useValue: { getById } }] });
    TestBed.inject(AuthService).currentUser.set(makeUser({ age: 16 }));
  });

  it('lets the user in when they are old enough', async () => {
    getById.mockResolvedValue(makeGroupDetail({ rooms: [{ id: 'r1', groupId: 'g1', name: 'general', minAge: 13, createdAt: '' }] }));
    expect(await run(route('g1', 'r1'))).toBe(true);
  });

  it('sends a too-young user back with the ageBlocked banner', async () => {
    getById.mockResolvedValue(makeGroupDetail({ rooms: [{ id: 'r1', groupId: 'g1', name: 'adults', minAge: 18, createdAt: '' }] }));
    expect(url(await run(route('g1', 'r1')))).toBe('/groups/g1?ageBlocked=18');
  });

  it('sends the user back to the group when the room does not exist', async () => {
    getById.mockResolvedValue(makeGroupDetail({ rooms: [] }));
    expect(url(await run(route('g1', 'nope')))).toBe('/groups/g1');
  });

  it('sends the user back when loading the group fails', async () => {
    getById.mockRejectedValue(new Error('offline'));
    expect(url(await run(route('g1', 'r1')))).toBe('/groups/g1');
  });

  it('goes to /groups when nobody is logged in', async () => {
    TestBed.inject(AuthService).currentUser.set(null);
    expect(url(await run(route('g1', 'r1')))).toBe('/groups');
  });
});
