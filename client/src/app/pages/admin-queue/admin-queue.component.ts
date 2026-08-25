import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { GroupRequest } from '../../core/models';
import { RequestService } from '../../core/request.service';

// Phase1.md §5.1 "SuperAdminQueueComponent". GET /api/requests is already
// scoped server-side to what the current user may resolve (routes/requests.js
// canResolve()) — for the Super Admin that's exactly the pending
// group_creation requests, so this component just needs to render + approve/deny.
@Component({
  selector: 'app-admin-queue',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-queue.component.html',
  styleUrl: './admin-queue.component.css',
})
export class AdminQueueComponent implements OnInit {
  private requestService = inject(RequestService);

  private allPending = signal<GroupRequest[]>([]);
  groupCreationRequests = computed(() => this.allPending().filter((r) => r.type === 'group_creation'));

  loading = signal(true);
  errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.allPending.set(await this.requestService.getPending());
      this.errorMessage.set('');
    } catch {
      this.errorMessage.set('Could not load the request queue. Try refreshing.');
    } finally {
      this.loading.set(false);
    }
  }

  async onApprove(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.approve(request.id);
      await this.load();
    } catch {
      this.errorMessage.set('Could not approve that request. Try again.');
    }
  }

  async onDeny(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.deny(request.id);
      await this.load();
    } catch {
      this.errorMessage.set('Could not deny that request. Try again.');
    }
  }
}
