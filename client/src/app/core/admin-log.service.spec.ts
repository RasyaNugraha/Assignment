import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AdminLogService } from './admin-log.service';

describe('AdminLogService', () => {
  let service: AdminLogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    service = TestBed.inject(AdminLogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getLogs() without a filter GETs all logs', async () => {
    const promise = service.getLogs();
    http.expectOne({ method: 'GET', url: '/api/admin/logs' }).flush([]);
    expect(await promise).toEqual([]);
  });

  it('getLogs() adds the action filter to the URL', async () => {
    const promise = service.getLogs('room_created');
    http.expectOne('/api/admin/logs?action=room_created').flush([]);
    await promise;
  });

  it('getPage() sends page, pageSize and action', async () => {
    const promise = service.getPage('user_created', 2, 20);
    const req = http.expectOne((r) => r.url === '/api/admin/logs');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.get('action')).toBe('user_created');
    req.flush({ items: [], total: 0, page: 2, pageSize: 20, totalPages: 1 });
    expect((await promise).page).toBe(2);
  });

  it('getPage() leaves out the action for "all"', async () => {
    const promise = service.getPage('all', 1);
    const req = http.expectOne((r) => r.url === '/api/admin/logs');
    expect(req.request.params.has('action')).toBe(false);
    req.flush({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    await promise;
  });

  it('getActions() GETs the action types', async () => {
    const promise = service.getActions();
    http.expectOne('/api/admin/logs/actions').flush(['group_created', 'user_created']);
    expect(await promise).toEqual(['group_created', 'user_created']);
  });
});
