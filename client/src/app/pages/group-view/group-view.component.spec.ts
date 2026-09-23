import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { GroupViewComponent } from './group-view.component';
import { GroupService } from '../../core/group.service';
import { RequestService } from '../../core/request.service';
import { ChatService } from '../../core/chat.service';
import { AuthService } from '../../core/auth.service';
import { ChatServiceMock, makeGroupDetail, makeUser, settle } from '../../../testing/fakes';
import { GroupDetail } from '../../core/models';

const rooms = [
  { id: 'r1', groupId: 'g1', name: 'general', minAge: 0, createdAt: '' },
  { id: 'r2', groupId: 'g1', name: 'adults', minAge: 18, createdAt: '' },
];

describe('GroupViewComponent', () => {
  let fixture: ComponentFixture<GroupViewComponent>;
  let component: GroupViewComponent;
  let groups: Record<string, ReturnType<typeof vi.fn>>;
  let requests: Record<string, ReturnType<typeof vi.fn>>;
  let chat: ChatServiceMock;
  let el: HTMLElement;
  let query: Record<string, string>;

  async function render(group: GroupDetail) {
    groups['getById'].mockResolvedValue(group);
    TestBed.configureTestingModule({
      imports: [GroupViewComponent],
      providers: [
        { provide: GroupService, useValue: groups },
        { provide: RequestService, useValue: requests },
        { provide: ChatService, useValue: chat },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: new BehaviorSubject(convertToParamMap({ groupId: 'g1' })), snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    });
    TestBed.inject(AuthService).currentUser.set(makeUser());
    fixture = TestBed.createComponent(GroupViewComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await settle(fixture);
  }

  beforeEach(() => {
    chat = new ChatServiceMock();
    query = {};
    groups = {
      getById: vi.fn(),
      requestRoom: vi.fn().mockResolvedValue({}),
      removeRoom: vi.fn().mockResolvedValue(undefined),
      getMembers: vi.fn().mockResolvedValue([{ id: 'me', displayName: 'Me', isAdmin: false }, { id: 'b', displayName: 'Bob', isAdmin: false }]),
      requestBan: vi.fn().mockResolvedValue({}),
    };
    requests = {
      getPending: vi.fn().mockResolvedValue([
        { id: 'q1', type: 'group_join', groupId: 'g1', requesterDisplayName: 'Carol' },
        { id: 'q2', type: 'ban_request', groupId: 'g1', requesterDisplayName: 'Bob', targetDisplayName: 'Dan', reason: 'spam' },
      ]),
      approve: vi.fn().mockResolvedValue({}),
      deny: vi.fn().mockResolvedValue({}),
    };
  });

  it('shows the group and its rooms with Enter buttons for members', async () => {
    await render(makeGroupDetail({ isMember: true, rooms }));
    expect(el.querySelector('.group-header__title')?.textContent).toContain('Chess Club');
    expect(el.querySelectorAll('.room-list__item')).toHaveLength(2);
    expect(el.textContent).toContain('Enter');
    expect(el.querySelector('.admin-panel')).toBeNull();
  });

  it('shows the age banner after being sent back from a room', async () => {
    query = { ageBlocked: '18' };
    await render(makeGroupDetail({ isMember: true, rooms }));
    expect(el.textContent).toContain('You must be at least 18 to enter that room.');
  });

  it('shows the admin panel with join requests and ban reports for a Group Admin', async () => {
    await render(makeGroupDetail({ isMember: true, isAdmin: true, rooms, members: [] }));
    expect(el.querySelector('.admin-panel')).not.toBeNull();
    expect(el.textContent).toContain('Carol wants to join');
    expect(el.textContent).toContain('reported');
    await component.onApprove(component.pendingJoinRequests()[0]);
    expect(requests['approve']).toHaveBeenCalledWith('q1');
  });

  it('removes a room only after a second (confirm) click', async () => {
    await render(makeGroupDetail({ isMember: true, isAdmin: true, rooms, members: [] }));
    await component.onRemoveRoom('r1');
    expect(groups['removeRoom']).not.toHaveBeenCalled();
    expect(component.confirmRemoveRoomId()).toBe('r1');
    await component.onRemoveRoom('r1');
    expect(groups['removeRoom']).toHaveBeenCalledWith('g1', 'r1');
  });

  it('checks the room request form before sending', async () => {
    await render(makeGroupDetail({ isMember: true, rooms }));
    component.newRoomName = '';
    await component.onRequestRoom();
    expect(component.errorMessage()).toBe('A room name is required.');
    component.newRoomName = 'random';
    component.newRoomMinAge = 1.5;
    await component.onRequestRoom();
    expect(groups['requestRoom']).not.toHaveBeenCalled();
    component.newRoomMinAge = 0;
    await component.onRequestRoom();
    expect(groups['requestRoom']).toHaveBeenCalledWith('g1', { name: 'random', minAge: 0 });
  });

  it('lets a member report someone (not themselves)', async () => {
    await render(makeGroupDetail({ isMember: true, rooms }));
    await component.onOpenReportForm();
    expect(component.reportableMembers().map((m) => m.id)).toEqual(['b']);
    component.reportTargetId = 'b';
    component.reportReason = 'spam';
    await component.onSubmitReport();
    expect(groups['requestBan']).toHaveBeenCalledWith('g1', 'b', 'spam');
    expect(component.reportSent()).toBe(true);
  });

  it('reloads pending requests live when the queue changes (admins)', async () => {
    await render(makeGroupDetail({ isMember: true, isAdmin: true, rooms, members: [] }));
    requests['getPending'].mockClear();
    chat.requestsChanged$.next();
    expect(requests['getPending']).toHaveBeenCalled();
  });
});
