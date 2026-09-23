import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { GroupDetail, GroupRequest, MemberSummary } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { GroupService } from '../../core/group.service';
import { RequestService } from '../../core/request.service';
import { ChatService } from '../../core/chat.service';

// Group page: rooms, requests and admin panel.
const EMPTY_GROUP: GroupDetail = {
  id: '',
  title: '',
  description: '',
  minAge: 0,
  backgroundColor: null,
  adminIds: [],
  memberIds: [],
  createdAt: '',
  rooms: [],
};

@Component({
  selector: 'app-group-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './group-view.component.html',
  styleUrl: './group-view.component.css',
})
export class GroupViewComponent implements OnInit, OnDestroy {
  // Services.
  private route = inject(ActivatedRoute);
  private groupService = inject(GroupService);
  private requestService = inject(RequestService);
  public auth = inject(AuthService);
  private chat = inject(ChatService);
  private liveSubs: Subscription[] = [];

  // Subscribe to params so switching groups works.
  groupId = signal('');
  private paramSub?: Subscription;

  group = signal<GroupDetail>(EMPTY_GROUP);
  loading = signal(true);
  errorMessage = signal('');

  // Set when we got sent back from a room for being too young.
  ageBlockedMinAge = signal<number | null>(null);

  showRequestRoomForm = signal(false);
  newRoomName = '';
  newRoomMinAge = 0;
  roomRequestSent = signal(false);

  // True if the current user is admin of this group.
  isGroupAdmin = computed(() => this.group().isAdmin ?? false);

  pendingRequests = signal<GroupRequest[]>([]);
  pendingJoinRequests = computed(() =>
    this.pendingRequests().filter((r) => r.type === 'group_join' && r.groupId === this.groupId()),
  );
  pendingRoomRequests = computed(() =>
    this.pendingRequests().filter((r) => r.type === 'room_creation' && r.groupId === this.groupId()),
  );
  // Ban reports from members.
  pendingBanRequests = computed(() =>
    this.pendingRequests().filter((r) => r.type === 'ban_request' && r.groupId === this.groupId()),
  );

  // Members (only sent to admins).
  members = computed(() => this.group().members ?? []);

  // Request removal form.
  removalTargetId = signal<string | null>(null);
  removalReason = '';
  removalRequestSent = signal(false);

  // Messages after getting sent back from a room.
  roomBlockedMessage = signal<string | null>(null);
  roomRemovedNotice = signal(false);

  // Room waiting for a second click to confirm removal.
  confirmRemoveRoomId = signal<string | null>(null);

  // Report a member form.
  showReportForm = signal(false);
  reportableMembers = signal<MemberSummary[]>([]);
  reportTargetId = '';
  reportReason = '';
  reportSent = signal(false);

  // Read query params and load the group.
  ngOnInit() {
    const ageBlocked = this.route.snapshot.queryParamMap.get('ageBlocked');
    if (ageBlocked !== null) this.ageBlockedMinAge.set(Number(ageBlocked));
    this.roomBlockedMessage.set(this.route.snapshot.queryParamMap.get('roomBlocked'));
    this.roomRemovedNotice.set(this.route.snapshot.queryParamMap.has('roomRemoved'));

    this.paramSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('groupId') ?? '';
      this.groupId.set(id);
      if (id) this.loadGroup(id);
    });
    // Live updates: new requests for admins, and my own request results.
    this.liveSubs.push(
      this.chat.requestsChanged$.subscribe(() => {
        if (this.isGroupAdmin()) void this.loadPendingRequests();
      }),
      this.chat.notifications$.subscribe(() => {
        if (this.groupId()) void this.loadGroup(this.groupId());
      }),
    );
  }

  // Stop listening to params.
  ngOnDestroy() {
    this.paramSub?.unsubscribe();
    this.liveSubs.forEach((s) => s.unsubscribe());
  }

  // Load the group (and requests if admin).
  private async loadGroup(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const group = await this.groupService.getById(id);
      this.group.set(group);
      this.errorMessage.set('');
      if (group.isAdmin) await this.loadPendingRequests();
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not load this group. Try refreshing.');
    } finally {
      this.loading.set(false);
    }
  }

  // Load pending requests for the admin panel.
  private async loadPendingRequests(): Promise<void> {
    try {
      this.pendingRequests.set(await this.requestService.getPending());
    } catch {
      // Not a big deal, the group still loaded.
    }
  }

  // Send a new room request.
  async onRequestRoom(): Promise<void> {
    if (!this.newRoomName.trim()) {
      this.errorMessage.set('A room name is required.');
      return;
    }
    if (!Number.isInteger(this.newRoomMinAge) || this.newRoomMinAge < 0) {
      this.errorMessage.set('Minimum age must be a whole number, 0 or more.');
      return;
    }
    try {
      await this.groupService.requestRoom(this.groupId(), {
        name: this.newRoomName,
        minAge: this.newRoomMinAge,
      });
      this.roomRequestSent.set(true);
      this.showRequestRoomForm.set(false);
      this.newRoomName = '';
      this.newRoomMinAge = 0;
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not send the room request. Try again.');
    }
  }

  // Approve a request.
  async onApprove(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.approve(request.id);
      await this.loadGroup(this.groupId());
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not approve that request. Try again.');
    }
  }

  // Deny a request.
  async onDeny(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.deny(request.id);
      await this.loadPendingRequests();
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not deny that request. Try again.');
    }
  }

  // Make a member a co-admin.
  async onAppointAdmin(member: MemberSummary): Promise<void> {
    try {
      await this.groupService.appointAdmin(this.groupId(), member.id);
      await this.loadGroup(this.groupId());
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not appoint that member as admin. Try again.');
    }
  }

  // Ban a member.
  async onBanMember(member: MemberSummary): Promise<void> {
    try {
      await this.groupService.banMember(this.groupId(), member.id);
      await this.loadGroup(this.groupId());
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not ban that member. Try again.');
    }
  }

  // Open the removal form for a member.
  onOpenRemovalForm(member: MemberSummary): void {
    this.removalTargetId.set(member.id);
    this.removalReason = '';
  }

  // Close the removal form.
  onCancelRemovalForm(): void {
    this.removalTargetId.set(null);
    this.removalReason = '';
  }

  // Send the removal request to the Super Admin.
  async onSubmitRemoval(): Promise<void> {
    const targetId = this.removalTargetId();
    if (!targetId || !this.removalReason.trim()) return;
    try {
      await this.groupService.requestAccountDeletion(this.groupId(), targetId, this.removalReason);
      this.removalRequestSent.set(true);
      this.removalTargetId.set(null);
      this.removalReason = '';
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not send the removal request. Try again.');
    }
  }

  // Remove a room (click twice to confirm).
  async onRemoveRoom(roomId: string): Promise<void> {
    if (this.confirmRemoveRoomId() !== roomId) {
      this.confirmRemoveRoomId.set(roomId);
      return;
    }
    try {
      await this.groupService.removeRoom(this.groupId(), roomId);
      this.confirmRemoveRoomId.set(null);
      await this.loadGroup(this.groupId());
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not remove that room. Try again.');
    }
  }

  // Open the report form and load members.
  async onOpenReportForm(): Promise<void> {
    this.showReportForm.set(!this.showReportForm());
    this.reportSent.set(false);
    if (!this.showReportForm()) return;
    try {
      const members = await this.groupService.getMembers(this.groupId());
      const me = this.auth.currentUser()?.id;
      this.reportableMembers.set(members.filter((m) => m.id !== me && !m.isAdmin));
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not load the member list.');
    }
  }

  // Send the report.
  async onSubmitReport(): Promise<void> {
    if (!this.reportTargetId || !this.reportReason.trim()) return;
    try {
      await this.groupService.requestBan(this.groupId(), this.reportTargetId, this.reportReason);
      this.reportSent.set(true);
      this.showReportForm.set(false);
      this.reportTargetId = '';
      this.reportReason = '';
    } catch (err: any) {
      this.errorMessage.set(err?.error?.error ?? 'Could not send the report. Try again.');
    }
  }
}
