import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

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
      this.roomId.set(params.get('roomId') ?? '');
      this.groupId.set(params.get('groupId') ?? '');
      // TODO: re-fetch this room's real last-5 messages from
      // /api/rooms/:id/messages here once that endpoint exists (Phase 2).
    });
  }

  ngOnDestroy() {
    this.paramSub?.unsubscribe();
  }

  onLeave() {
    this.router.navigate(['/groups', this.groupId()]);
  }
}
