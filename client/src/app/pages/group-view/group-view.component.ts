import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { GroupDetail, GroupRequest, MemberSummary } from '../../core/models';
import { AuthService } from '../../core/auth.service';
import { GroupService } from '../../core/group.service';
import { RequestService } from '../../core/request.service';

// WIREFRAME.md §5 "Group View Screen". GET /api/groups/:id (live as of
// Week 5) supplies the real group + its rooms; the admin panel's pending
// join/room requests come from GET /api/requests, which the server already
// scopes to what this Group Admin is allowed to resolve.
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
  // inject() rather than constructor params — these fields are read during
  // property initialization, which runs before a constructor body would.
  private route = inject(ActivatedRoute);
  private groupService = inject(GroupService);
  private requestService = inject(RequestService);
  public auth = inject(AuthService);

  // Per Week 4 lecture: route.snapshot.paramMap only reads the param once,
  // when the component is first created. Angular reuses this component
  // instance if you navigate from one /groups/:groupId to another without
  // it being destroyed (e.g. clicking a different group in a list rendered
  // by this same route), so a snapshot-only read would go stale. Subscribing
  // to paramMap keeps groupId in sync — and re-fetches this group's data —
  // for as long as the component lives.
  groupId = signal('');
  private paramSub?: Subscription;

  group = signal<GroupDetail>(EMPTY_GROUP);
  loading = signal(true);
  errorMessage = signal('');

  // R18 — set when we've been redirected here after roomAgeGuard (or the
  // server's own re-check in RoomComponent) blocked entry to a Room, via the
  // ?ageBlocked=<minAge> query param both checks use. Read once on load
  // rather than kept subscribed: it only matters for the redirect that just
  // happened, not for any later navigation within this same component
  // instance (e.g. switching Groups without a full reload).
  ageBlockedMinAge = signal<number | null>(null);

  showRequestRoomForm = signal(false);
  newRoomName = '';
  newRoomMinAge = 0;
  roomRequestSent = signal(false);

  // Server computes this per-viewer in toPublicGroup() (routes/groups.js),
  // so it's always in sync with the real adminIds list — no need to
  // re-derive it from auth.currentUser().groupAdminOf here.
  isGroupAdmin = computed(() => this.group().isAdmin ?? false);

  pendingRequests = signal<GroupRequest[]>([]);
  pendingJoinRequests = computed(() =>
    this.pendingRequests().filter((r) => r.type === 'group_join' && r.groupId === this.groupId()),
  );
  pendingRoomRequests = computed(() =>
    this.pendingRequests().filter((r) => r.type === 'room_creation' && r.groupId === this.groupId()),
  );

  // R8/R9 — member list is only present on the server response when the
  // viewer isAdmin (routes/groups.js's toMemberSummaries()), so this just
  // falls back to empty rather than needing its own loading state.
  members = computed(() => this.group().members ?? []);

  // R4 — inline "request removal" form, keyed to which member it's open for
  // rather than a single boolean, so opening one member's form doesn't have
  // to fight over shared state with another's.
  removalTargetId = signal<string | null>(null);
  removalReason = '';
  removalRequestSent = signal(false);

  ngOnInit() {
    const ageBlocked = this.route.snapshot.queryParamMap.get('ageBlocked');
    if (ageBlocked !== null) this.ageBlockedMinAge.set(Number(ageBlocked));

    this.paramSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('groupId') ?? '';
      this.groupId.set(id);
      if (id) this.loadGroup(id);
    });
  }

  ngOnDestroy() {
    this.paramSub?.unsubscribe();
  }

  private async loadGroup(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const group = await this.groupService.getById(id);
      this.group.set(group);
      this.errorMessage.set('');
      if (group.isAdmin) await this.loadPendingRequests();
    } catch {
      this.errorMessage.set('Could not load this group. Try refreshing.');
    } finally {
      this.loading.set(false);
    }
  }

  private async loadPendingRequests(): Promise<void> {
    try {
      this.pendingRequests.set(await this.requestService.getPending());
    } catch {
      // Non-fatal — the group itself already loaded; the admin panel just
      // shows nothing pending until the next successful refresh.
    }
  }

  async onRequestRoom(): Promise<void> {
    if (!this.newRoomName.trim()) return;
    try {
      await this.groupService.requestRoom(this.groupId(), {
        name: this.newRoomName,
        minAge: this.newRoomMinAge,
      });
      this.roomRequestSent.set(true);
      this.showRequestRoomForm.set(false);
      this.newRoomName = '';
      this.newRoomMinAge = 0;
    } catch {
      this.errorMessage.set('Could not send the room request. Try again.');
    }
  }

  async onApprove(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.approve(request.id);
      await this.loadGroup(this.groupId());
    } catch {
      this.errorMessage.set('Could not approve that request. Try again.');
    }
  }

  async onDeny(request: GroupRequest): Promise<void> {
    try {
      await this.requestService.deny(request.id);
      await this.loadPendingRequests();
    } catch {
      this.errorMessage.set('Could not deny that request. Try again.');
    }
  }

  // R9
  async onAppointAdmin(member: MemberSummary): Promise<void> {
    try {
      await this.groupService.appointAdmin(this.groupId(), member.id);
      await this.loadGroup(this.groupId());
    } catch {
      this.errorMessage.set('Could not appoint that member as admin. Try again.');
    }
  }

  // R8 — direct action, no approval step (see GroupService.banMember()).
  async onBanMember(member: MemberSummary): Promise<void> {
    try {
      await this.groupService.banMember(this.groupId(), member.id);
      await this.loadGroup(this.groupId());
    } catch {
      this.errorMessage.set('Could not ban that member. Try again.');
    }
  }

  onOpenRemovalForm(member: MemberSummary): void {
    this.removalTargetId.set(member.id);
    this.removalReason = '';
  }

  onCancelRemovalForm(): void {
    this.removalTargetId.set(null);
    this.removalReason = '';
  }

  // R4 — this only files the escalation; the Super Admin queue
  // (AdminQueueComponent) is what actually approves/denies it.
  async onSubmitRemoval(): Promise<void> {
    const targetId = this.removalTargetId();
    if (!targetId || !this.removalReason.trim()) return;
    try {
      await this.groupService.requestAccountDeletion(this.groupId(), targetId, this.removalReason);
      this.removalRequestSent.set(true);
      this.removalTargetId.set(null);
      this.removalReason = '';
    } catch {
      this.errorMessage.set('Could not send the removal request. Try again.');
    }
  }
}
