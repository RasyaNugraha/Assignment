import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GroupListComponent } from './group-list.component';
import { GroupService } from '../../core/group.service';
import { ChatService } from '../../core/chat.service';
import { ChatServiceMock, makeGroup, settle } from '../../../testing/fakes';
import { Group } from '../../core/models';

// Fake page of results.
const page = (items: Group[], extra = {}) => ({ items, total: items.length, page: 1, pageSize: 9, totalPages: 1, ...extra });

describe('GroupListComponent', () => {
  let fixture: ComponentFixture<GroupListComponent>;
  let component: GroupListComponent;
  let groups: Record<string, ReturnType<typeof vi.fn>>;
  let chat: ChatServiceMock;
  let el: HTMLElement;

  beforeEach(async () => {
    chat = new ChatServiceMock();
    groups = {
      getPage: vi.fn().mockResolvedValue(page([makeGroup({ id: 'g1', title: 'Chess Club' }), makeGroup({ id: 'g2', title: 'Music', isMember: true })])),
      getMine: vi.fn().mockResolvedValue([makeGroup({ id: 'g2', title: 'Music', isMember: true })]),
      requestNewGroup: vi.fn().mockResolvedValue({}),
      requestToJoin: vi.fn().mockResolvedValue({}),
    };
    TestBed.configureTestingModule({
      imports: [GroupListComponent],
      providers: [
        { provide: GroupService, useValue: groups },
        { provide: ChatService, useValue: chat },
      ],
    });
    fixture = TestBed.createComponent(GroupListComponent);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await settle(fixture);
  });

  it('shows all groups and my groups', () => {
    expect(el.querySelectorAll('.group-card')).toHaveLength(2);
    expect(el.querySelector('.sidebar__list')?.textContent).toContain('Music');
  });

  it('shows Open for my groups and Request to Join for the others', () => {
    const cards = el.querySelectorAll('.group-card');
    expect(cards[0].textContent).toContain('Request to Join');
    expect(cards[1].textContent).toContain('Open');
  });

  it('searches from page 1 with the typed text and age', async () => {
    component.page.set(3);
    component.search = 'chess';
    component.maxAge = 16;
    component.onSearch();
    expect(groups['getPage']).toHaveBeenLastCalledWith({ search: 'chess', maxAge: 16, page: 1, pageSize: 9 });
  });

  it('shows the pager and moves to the next page', async () => {
    groups['getPage'].mockResolvedValue(page([makeGroup()], { total: 20, totalPages: 3 }));
    await component.loadPage();
    fixture.detectChanges();
    expect(el.querySelector('.pager__info')?.textContent).toContain('Page 1 of 3');
    component.goToPage(2);
    expect(groups['getPage']).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    component.goToPage(99); // out of range = ignored
    expect(component.page()).toBe(2);
  });

  it('marks a group as pending after asking to join', async () => {
    await component.onJoinGroup(component.groups()[0]);
    fixture.detectChanges();
    expect(el.querySelectorAll('.group-card')[0].textContent).toContain('Request Pending');
  });

  it('shows the server reason when joining fails (e.g. too young)', async () => {
    groups['requestToJoin'].mockRejectedValue({ error: { error: 'You must be at least 18 to join this group.' } });
    await component.onJoinGroup(component.groups()[0]);
    fixture.detectChanges();
    expect(el.querySelector('.main-panel__error')?.textContent).toContain('at least 18');
  });

  it('checks the new group form before sending', async () => {
    component.newGroupTitle = '';
    await component.onRequestGroup();
    expect(groups['requestNewGroup']).not.toHaveBeenCalled();
    component.newGroupTitle = 'Books';
    component.newGroupMinAge = -1;
    await component.onRequestGroup();
    expect(groups['requestNewGroup']).not.toHaveBeenCalled();
    component.newGroupMinAge = 0;
    await component.onRequestGroup();
    expect(groups['requestNewGroup']).toHaveBeenCalledWith({ title: 'Books', description: '', minAge: 0 });
    expect(component.requestSent()).toBe(true);
  });

  it('reloads when a notification arrives', async () => {
    groups['getMine'].mockClear();
    chat.notifications$.next({ text: 'approved', at: '' });
    expect(groups['getMine']).toHaveBeenCalled();
  });
});
