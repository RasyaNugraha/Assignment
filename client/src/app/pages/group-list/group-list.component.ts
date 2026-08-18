import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Group } from '../../core/models';
import { GroupService } from '../../core/group.service';

// WIREFRAME.md §4 "Main / Group List Screen". GET /api/groups is live as of
// Week 5 — allGroups() holds the real list, myGroups() is derived from it
// via the isMember flag the server attaches per-viewer.
@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './group-list.component.html',
  styleUrl: './group-list.component.css',
})
export class GroupListComponent implements OnInit {
  private groupService = inject(GroupService);

  allGroups = signal<Group[]>([]);
  myGroups = computed(() => this.allGroups().filter((g) => g.isMember));
  loading = signal(true);
  errorMessage = signal('');

  showRequestForm = signal(false);
  newGroupTitle = '';
  newGroupDescription = '';
  newGroupMinAge = 0;
  requestSent = signal(false);

  ngOnInit(): void {
    this.loadGroups();
  }

  private async loadGroups(): Promise<void> {
    this.loading.set(true);
    try {
      const groups = await this.groupService.getAll();
      this.allGroups.set(groups);
      this.errorMessage.set('');
    } catch {
      this.errorMessage.set('Could not load groups. Try refreshing.');
    } finally {
      this.loading.set(false);
    }
  }

  isMember(group: Group): boolean {
    return !!group.isMember;
  }

  async onRequestGroup(): Promise<void> {
    if (!this.newGroupTitle.trim()) return;
    try {
      await this.groupService.requestNewGroup({
        title: this.newGroupTitle,
        description: this.newGroupDescription,
        minAge: this.newGroupMinAge,
      });
      this.requestSent.set(true);
      this.showRequestForm.set(false);
      this.newGroupTitle = '';
      this.newGroupDescription = '';
      this.newGroupMinAge = 0;
    } catch {
      this.errorMessage.set('Could not send the group request. Try again.');
    }
  }

  async onJoinGroup(group: Group): Promise<void> {
    try {
      await this.groupService.requestToJoin(group.id);
      // Reflect the pending state immediately without a full reload.
      this.allGroups.update((groups) =>
        groups.map((g) => (g.id === group.id ? { ...g, hasPendingJoinRequest: true } : g)),
      );
    } catch {
      this.errorMessage.set('Could not send the join request. Try again.');
    }
  }
}
