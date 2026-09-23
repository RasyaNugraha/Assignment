import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

import { GroupRequest } from '../../core/models';
import { RequestService } from '../../core/request.service';
import { ChatService } from '../../core/chat.service';

// Super Admin queue: group creation and account deletion requests.
@Component({
  selector: 'app-admin-queue',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-queue.component.html',
  styleUrl: './admin-queue.component.css',
})
export class AdminQueueComponent implements OnInit, OnDestroy {
  private requestService = inject(RequestService);
  private chat = inject(ChatService);
  private sub?: Subscription;

  private allPending = signal<GroupRequest[]>([]);
  groupCreationRequests = computed(() => this.allPending().filter((r) => r.type === 'group_creation'));
  // Account deletion requests.
  accountDeletionRequests = computed(() => this.allPending().filter((r) => r.type === 'account_deletion'));

  loading = signal(true);
  errorMessage = signal('');

  // Load the queue on start and reload when it changes (live).
  ngOnInit(): void {
    void this.load();
    this.sub = this.chat.requestsChanged$.subscribe(() => void this.load());
  }

  // Stop listening.
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Load pending requests.
  async load(): Promise<void> {
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

  // Approve a request.
  async onApprove(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.approve(request.id);
      await this.load();
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not approve that request. Try again.');
    }
  }

  // Deny a request.
  async onDeny(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.deny(request.id);
      await this.load();
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not deny that request. Try again.');
    }
  }
}
