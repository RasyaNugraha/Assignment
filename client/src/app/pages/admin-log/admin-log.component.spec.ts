import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminLogComponent } from './admin-log.component';
import { AdminLogService } from '../../core/admin-log.service';
import { settle } from '../../../testing/fakes';

const entry = (id: string, action: string) => ({ id, action, actorId: 'a', targetId: null, details: `did ${action}`, timestamp: '2026-09-23T10:00:00.000Z' });

describe('AdminLogComponent', () => {
  let fixture: ComponentFixture<AdminLogComponent>;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let el: HTMLElement;

  beforeEach(async () => {
    service = {
      getPage: vi.fn().mockResolvedValue({ items: [entry('1', 'user_created'), entry('2', 'group_created')], total: 45, page: 1, pageSize: 20, totalPages: 3 }),
      getActions: vi.fn().mockResolvedValue(['group_created', 'user_created']),
    };
    TestBed.configureTestingModule({ imports: [AdminLogComponent], providers: [{ provide: AdminLogService, useValue: service }] });
    fixture = TestBed.createComponent(AdminLogComponent);
    el = fixture.nativeElement;
    await settle(fixture);
  });

  it('shows the log entries and the total', () => {
    expect(el.querySelectorAll('.log-list__item')).toHaveLength(2);
    expect(el.textContent).toContain('45 entries');
  });

  it('fills the filter with the action types from the server', () => {
    const options = Array.from(el.querySelectorAll('option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['All actions', 'group_created', 'user_created']);
  });

  it('changing the filter reloads page 1 with that action', () => {
    fixture.componentInstance.page.set(2);
    fixture.componentInstance.onFilterChange('user_created');
    expect(service['getPage']).toHaveBeenLastCalledWith('user_created', 1);
  });

  it('pages forward and backward', () => {
    fixture.componentInstance.goToPage(2);
    expect(service['getPage']).toHaveBeenLastCalledWith('all', 2);
    expect(el.querySelector('.pager__info')?.textContent).toContain('of 3');
  });

  it('shows an error when the log cannot load', async () => {
    service['getPage'].mockRejectedValue(new Error('down'));
    await fixture.componentInstance.load();
    fixture.detectChanges();
    expect(el.querySelector('.admin-log__error')?.textContent).toContain('Could not load');
  });
});
