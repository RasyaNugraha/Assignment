import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { GroupService } from '../../core/group.service';

// WIREFRAME.md §6 "Room Screen (placeholder for Phase 1)". No chat/socket
// functionality required yet (REQUIREMENTS.md §12) — static mock messages
// only, real-time messaging arrives in Phase 2 via Socket.IO.
interface MockMessage {
  senderName: string;
  sentAt: string;
  text: string;
}

const MOCK_MESSAGES: MockMessage[] = [
  { senderName: 'Allan Browning', sentAt: '12:04', text: 'Welcome to the room!' },
  { senderName: 'Rasya', sentAt: '12:05', text: 'This is a placeholder — real chat lands in Phase 2.' },
];

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private groupService = inject(GroupService);

  // Subscribed rather than snapshot-read (Week 4 lecture) — jumping straight
  // from one Room to another reuses this component instance, so a
  // snapshot-only read of the route params would never update after the
  // first load.
  roomId = signal('');
  groupId = signal('');
  private paramSub?: Subscription;

  messages = signal(MOCK_MESSAGES);

  ngOnInit() {
    this.paramSub = this.route.paramMap.subscribe((params) => {
      const roomId = params.get('roomId') ?? '';
      const groupId = params.get('groupId') ?? '';
      this.roomId.set(roomId);
      this.groupId.set(groupId);
      if (roomId && groupId) this.checkRoomAccess(groupId, roomId);
      // TODO: re-fetch this room's real last-5 messages from
      // /api/rooms/:id/messages here once that endpoint exists (Phase 2).
    });
  }

  // R18 — roomAgeGuard already ran before this component was even created,
  // but that's a client-side check only (room.guard.ts's own comment
  // explains why it isn't the authority). This calls the same GET
  // /api/groups/:groupId/rooms/:roomId endpoint the guard uses, which
  // re-checks the Room's minAge server-side; a 403 here means either the
  // guard was bypassed (direct navigation, tampered client state) or the
  // user's age changed since the guard ran. Either way, bounce back to the
  // Group View with the same ?ageBlocked= banner the guard shows, so the
  // user sees one consistent message regardless of which check caught them.
  private async checkRoomAccess(groupId: string, roomId: string): Promise<void> {
    try {
      await this.groupService.getRoom(groupId, roomId);
    } catch (err: any) {
      const minAge = err?.error?.minAge;
      this.router.navigate(['/groups', groupId], {
        queryParams: minAge !== undefined ? { ageBlocked: minAge } : {},
      });
    }
  }

  ngOnDestroy() {
    this.paramSub?.unsubscribe();
  }

  onLeave() {
    this.router.navigate(['/groups', this.groupId()]);
  }
}
