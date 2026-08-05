import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

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
export class RoomComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  roomId = signal(this.route.snapshot.paramMap.get('roomId') ?? '');
  groupId = signal(this.route.snapshot.paramMap.get('groupId') ?? '');
  messages = signal(MOCK_MESSAGES);

  onLeave() {
    this.router.navigate(['/groups', this.groupId()]);
  }
}
