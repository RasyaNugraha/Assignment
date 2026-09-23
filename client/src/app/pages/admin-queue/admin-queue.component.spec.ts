import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminQueueComponent } from './admin-queue.component';
import { RequestService } from '../../core/request.service';
import { ChatService } from '../../core/chat.service';
import { ChatServiceMock, settle } from '../../../testing/fakes';
import { GroupRequest } from '../../core/models';

const creation = { id: 'r1', type: 'group_creation', title: 'Chess', requesterDisplayName: 'Bob', status: 'pending' } as GroupRequest;
const deletion = { id: 'r2', type: 'account_deletion', targetDisplayName: 'Carol', reason: 'Spam', status: 'pending' } as GroupRequest;

describe('AdminQueueComponent', () => {
  let fixture: ComponentFixture<AdminQueueComponent>;
  let requests: Record<string, ReturnType<typeof vi.fn>>;
  let chat: ChatServiceMock;
  let el: HTMLElement;

  beforeEach(async () => {
    chat = new ChatServiceMock();
    requests = {
      getPending: vi.fn().mockResolvedValue([creation, deletion]),
      approve: vi.fn().mockResolvedValue({}),
      deny: vi.fn().mockResolvedValue({}),
    };
    TestBed.configureTestingModule({
      imports: [AdminQueueComponent],
      providers: [
        { provide: RequestService, useValue: requests },
        { provide: ChatService, useValue: chat },
      ],
    });
    fixture = TestBed.createComponent(AdminQueueComponent);
    el = fixture.nativeElement;
    await settle(fixture);
  });

  it('splits requests into group creation and account deletion', () => {
    expect(fixture.componentInstance.groupCreationRequests()).toEqual([creation]);
    expect(fixture.componentInstance.accountDeletionRequests()).toEqual([deletion]);
    expect(el.textContent).toContain('Chess');
    expect(el.textContent).toContain('Carol');
  });

  it('approves a request and reloads the queue', async () => {
    await fixture.componentInstance.onApprove(creation);
    expect(requests['approve']).toHaveBeenCalledWith('r1');
    expect(requests['getPending']).toHaveBeenCalledTimes(2);
  });

  it('denies a request', async () => {
    await fixture.componentInstance.onDeny(deletion);
    expect(requests['deny']).toHaveBeenCalledWith('r2');
  });

  it('shows the server error when approving fails', async () => {
    requests['approve'].mockRejectedValue({ error: { error: 'Request has already been resolved.' } });
    await fixture.componentInstance.onApprove(creation);
    fixture.detectChanges();
    expect(el.textContent).toContain('Request has already been resolved.');
  });

  it('reloads by itself when the queue changes (socket)', () => {
    chat.requestsChanged$.next();
    expect(requests['getPending']).toHaveBeenCalledTimes(2);
  });
});
