import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RequestService } from './request.service';

describe('RequestService', () => {
  let service: RequestService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClientTesting()] });
    service = TestBed.inject(RequestService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('is created', () => {
    expect(service).toBeTruthy();
  });

  it('getPending() GETs /api/requests', async () => {
    const promise = service.getPending();
    http.expectOne({ method: 'GET', url: '/api/requests' }).flush([{ id: 'r1', type: 'group_join' }]);
    expect(await promise).toHaveLength(1);
  });

  it('approve() POSTs to the approve endpoint', async () => {
    const promise = service.approve('r1');
    http.expectOne({ method: 'POST', url: '/api/requests/r1/approve' }).flush({ id: 'r1', status: 'approved' });
    expect((await promise).status).toBe('approved');
  });

  it('deny() POSTs to the deny endpoint', async () => {
    const promise = service.deny('r1');
    http.expectOne({ method: 'POST', url: '/api/requests/r1/deny' }).flush({ id: 'r1', status: 'denied' });
    expect((await promise).status).toBe('denied');
  });

  it('passes a 409 (already resolved) back to the caller', async () => {
    const promise = service.approve('r1');
    http.expectOne('/api/requests/r1/approve').flush({ error: 'Request has already been resolved.' }, { status: 409, statusText: 'Conflict' });
    await expect(promise).rejects.toMatchObject({ status: 409 });
  });
});
