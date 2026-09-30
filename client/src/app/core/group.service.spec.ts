import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { GroupService } from './group.service';

describe('GroupService', () => {
  let service: GroupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    service = TestBed.inject(GroupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getAll() GETs /api/groups', async () => {
    const promise = service.getAll();
    http.expectOne({ method: 'GET', url: '/api/groups' }).flush([{ id: 'g1', title: 'One' }]);
    const groups = await promise;
    expect(groups.length).toBe(1);
  });

  it('requestToJoin() POSTs to the join endpoint', async () => {
    const promise = service.requestToJoin('g1');
    http.expectOne({ method: 'POST', url: '/api/groups/g1/join' }).flush({ id: 'req1', status: 'pending' });
    expect((await promise).status).toBe('pending');
  });

  it('removeRoom() sends DELETE for that room', async () => {
    const promise = service.removeRoom('g1', 'r1');
    http.expectOne({ method: 'DELETE', url: '/api/groups/g1/rooms/r1' }).flush(null, { status: 204, statusText: 'No Content' });
    await promise;
  });

  it('requestBan() sends the member and reason', async () => {
    const promise = service.requestBan('g1', 'u2', 'spam');
    const req = http.expectOne({ method: 'POST', url: '/api/groups/g1/ban-requests' });
    expect(req.request.body).toEqual({ userId: 'u2', reason: 'spam' });
    req.flush({ id: 'req2', type: 'ban_request' });
    expect((await promise).type).toBe('ban_request');
  });

  it('passes server errors (e.g. age-blocked join) through to the caller', async () => {
    const promise = service.requestToJoin('g1');
    http
      .expectOne('/api/groups/g1/join')
      .flush({ error: 'You must be at least 18 to join this group.', minAge: 18 }, { status: 403, statusText: 'Forbidden' });
    await expect(promise).rejects.toMatchObject({ status: 403 });
  });
});

describe('GroupService search + extras', () => {
  let service: GroupService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    service = TestBed.inject(GroupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getPage() sends search, maxAge and paging', async () => {
    const promise = service.getPage({ search: ' chess ', maxAge: 16, page: 2, pageSize: 9 });
    const req = http.expectOne((r) => r.url === '/api/groups');
    expect(req.request.params.get('search')).toBe('chess');
    expect(req.request.params.get('maxAge')).toBe('16');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ items: [], total: 0, page: 2, pageSize: 9, totalPages: 1 });
    expect((await promise).page).toBe(2);
  });

  it('getPage() skips empty search and maxAge', async () => {
    const promise = service.getPage({ search: '', maxAge: null });
    const req = http.expectOne((r) => r.url === '/api/groups');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('maxAge')).toBe(false);
    req.flush({ items: [], total: 0, page: 1, pageSize: 12, totalPages: 1 });
    await promise;
  });

  it('getMine() asks for my groups only', async () => {
    const promise = service.getMine();
    const req = http.expectOne((r) => r.url === '/api/groups');
    expect(req.request.params.get('mine')).toBe('true');
    req.flush([]);
    await promise;
  });

  it('getMembers() GETs the member list', async () => {
    const promise = service.getMembers('g1');
    http.expectOne({ method: 'GET', url: '/api/groups/g1/members' }).flush([{ id: 'u1', displayName: 'A', isAdmin: false }]);
    expect(await promise).toHaveLength(1);
  });

  it('appointAdmin() and banMember() send the user id', async () => {
    const p1 = service.appointAdmin('g1', 'u2');
    const appoint = http.expectOne('/api/groups/g1/admins');
    expect(appoint.request.body).toEqual({ userId: 'u2' });
    appoint.flush({});
    const p2 = service.banMember('g1', 'u3');
    const ban = http.expectOne('/api/groups/g1/ban');
    expect(ban.request.body).toEqual({ userId: 'u3' });
    ban.flush({});
    await Promise.all([p1, p2]);
  });

  it('removeAdmin() sends DELETE to the admin url', async () => {
    const p = service.removeAdmin('g1', 'u2');
    http.expectOne({ method: 'DELETE', url: '/api/groups/g1/admins/u2' }).flush({});
    await p;
  });
});
