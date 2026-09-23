import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { Group } from '../../core/models';
import { GroupService } from '../../core/group.service';
import { ChatService } from '../../core/chat.service';

const PAGE_SIZE = 9;

// Group list page: my groups, search + pages of all groups, request a new group.
@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './group-list.component.html',
  styleUrl: './group-list.component.css',
})
export class GroupListComponent implements OnInit, OnDestroy {
  private groupService = inject(GroupService);
  private chat = inject(ChatService);
  private sub?: Subscription;

  groups = signal<Group[]>([]);
  myGroups = signal<Group[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  // Search + paging state.
  search = '';
  maxAge: number | null = null;
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  showRequestForm = signal(false);
  newGroupTitle = '';
  newGroupDescription = '';
  newGroupMinAge = 0;
  requestSent = signal(false);

  // Load groups on start and reload when I get a notification.
  ngOnInit(): void {
    void this.loadAll();
    this.sub = this.chat.notifications$.subscribe(() => void this.loadAll());
  }

  // Stop listening.
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Load my groups and the current page.
  async loadAll(): Promise<void> {
    await Promise.all([this.loadMine(), this.loadPage()]);
  }

  // Get the groups I'm in (sidebar).
  private async loadMine(): Promise<void> {
    try {
      this.myGroups.set(await this.groupService.getMine());
    } catch {
      this.myGroups.set([]);
    }
  }

  // Get one page of groups from the server.
  async loadPage(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.groupService.getPage({
        search: this.search,
        maxAge: this.maxAge,
        page: this.page(),
        pageSize: PAGE_SIZE,
      });
      this.groups.set(result.items);
      this.total.set(result.total);
      this.totalPages.set(result.totalPages);
      this.errorMessage.set('');
    } catch {
      this.errorMessage.set('Could not load groups. Try refreshing.');
    } finally {
      this.loading.set(false);
    }
  }

  // New search = back to page 1.
  onSearch(): void {
    this.page.set(1);
    void this.loadPage();
  }

  // Clear the search and filters.
  onClearSearch(): void {
    this.search = '';
    this.maxAge = null;
    this.onSearch();
  }

  // Go to another page.
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    void this.loadPage();
  }

  // Send a new group request.
  async onRequestGroup(): Promise<void> {
    if (!this.newGroupTitle.trim()) {
      this.errorMessage.set('A group title is required.');
      return;
    }
    if (!Number.isInteger(this.newGroupMinAge) || this.newGroupMinAge < 0) {
      this.errorMessage.set('Minimum age must be a whole number, 0 or more.');
      return;
    }
    try {
      await this.groupService.requestNewGroup({
        title: this.newGroupTitle,
        description: this.newGroupDescription,
        minAge: this.newGroupMinAge,
      });
      this.requestSent.set(true);
      this.showRequestForm.set(false);
      this.errorMessage.set('');
      this.newGroupTitle = '';
      this.newGroupDescription = '';
      this.newGroupMinAge = 0;
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not send the group request. Try again.');
    }
  }

  // Send a join request.
  async onJoinGroup(group: Group): Promise<void> {
    try {
      await this.groupService.requestToJoin(group.id);
      this.groups.update((groups) => groups.map((g) => (g.id === group.id ? { ...g, hasPendingJoinRequest: true } : g)));
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not send the join request. Try again.');
    }
  }
}
