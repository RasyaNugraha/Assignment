import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { ChatService } from '../../core/chat.service';
import { ChatMessage, PresenceNotice, Room } from '../../core/models';
import { readFileAsDataUrl, validateChatImage } from '../../core/image-file';

// Popup message (join / leave).
interface Toast {
  id: number;
  text: string;
}

const TOAST_MS = 4000;

@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private chat = inject(ChatService);
  public auth = inject(AuthService);

  @ViewChild('messageList') private messageList?: ElementRef<HTMLElement>;

  roomId = signal('');
  groupId = signal('');
  room = signal<Room | null>(null);
  loading = signal(true);
  errorMessage = signal('');

  // Messages shown in this visit (last 5 + new ones).
  messages = signal<ChatMessage[]>([]);
  toasts = signal<Toast[]>([]);
  // Who is in the room right now.
  onlineMembers = signal<{ id: string; displayName: string }[]>([]);

  draftText = '';
  draftImage = signal<string | null>(null);
  sending = signal(false);

  // Can send if there's text or an image.
  canSend(): boolean {
    return !this.sending() && (this.draftImage() !== null || this.draftText.trim().length > 0);
  }

  private subs: Subscription[] = [];
  private nextToastId = 1;

  // Join the room and listen for chat events.
  ngOnInit() {
    // Subscribe to params so switching rooms works.
    this.subs.push(
      this.route.paramMap.subscribe((params) => {
        const groupId = params.get('groupId') ?? '';
        const roomId = params.get('roomId') ?? '';
        void this.switchRoom(groupId, roomId);
      }),
    );

    // Listen for events from the server.
    this.subs.push(
      this.chat.messages$.subscribe((m) => {
        if (m.roomId !== this.roomId()) return;
        // Skip if we already have it.
        if (this.messages().some((existing) => existing.id === m.id)) return;
        this.messages.update((list) => [...list, m]);
        this.scrollToBottom();
      }),
      this.chat.messageDeleted$.subscribe((e) => {
        if (e.roomId !== this.roomId()) return;
        this.messages.update((list) => list.filter((m) => m.id !== e.messageId));
      }),
      this.chat.roomMembers$.subscribe((e) => {
        if (e.roomId === this.roomId()) this.onlineMembers.set(e.members);
      }),
      this.chat.userJoined$.subscribe((n) => this.onPresence(n, 'joined')),
      this.chat.userLeft$.subscribe((n) => this.onPresence(n, 'left')),
      this.chat.roomRemoved$.subscribe((e) => {
        if (e.roomId !== this.roomId()) return;
        this.router.navigate(['/groups', e.groupId], { queryParams: { roomRemoved: 1 } });
      }),
    );
  }

  // Stop listening and leave the room.
  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.roomId()) void this.chat.leaveRoom(this.roomId());
  }

  // Leave the old room, join the new one and load its messages.
  private async switchRoom(groupId: string, roomId: string): Promise<void> {
    const previous = this.roomId();
    if (previous && previous !== roomId) await this.chat.leaveRoom(previous);

    this.groupId.set(groupId);
    this.roomId.set(roomId);
    this.messages.set([]);
    this.onlineMembers.set([]);
    this.room.set(null);
    this.errorMessage.set('');
    this.loading.set(true);
    if (!groupId || !roomId) return;

    // Server checks membership and age here.
    const ack = await this.chat.joinRoom(groupId, roomId);
    this.loading.set(false);
    if (!ack.ok) {
      const queryParams = ack.minAge !== undefined ? { ageBlocked: ack.minAge } : { roomBlocked: ack.error };
      this.router.navigate(['/groups', groupId], { queryParams });
      return;
    }
    this.room.set(ack.room ?? null);
    this.messages.set(ack.messages ?? []);
    this.scrollToBottom();
  }

  // Show a popup when someone joins / leaves.
  private onPresence(notice: PresenceNotice, verb: 'joined' | 'left'): void {
    if (notice.roomId !== this.roomId()) return;
    if (notice.user.id === this.auth.currentUser()?.id) return;
    const toast: Toast = { id: this.nextToastId++, text: `${notice.user.displayName} ${verb} the room` };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismissToast(toast.id), TOAST_MS);
  }

  // Close a popup.
  dismissToast(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  // True if I sent this message.
  isMine(message: ChatMessage): boolean {
    return message.senderId === this.auth.currentUser()?.id;
  }

  // Sender's avatar url, or null.
  avatarUrl(message: ChatMessage): string | null {
    return message.senderHasAvatar ? `/api/users/${message.senderId}/avatar` : null;
  }

  // Check the picked image and show a preview.
  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-picking the same file later
    if (!file) return;

    const problem = validateChatImage(file);
    if (problem) {
      this.errorMessage.set(problem);
      return;
    }
    this.errorMessage.set('');
    this.draftImage.set(await readFileAsDataUrl(file));
  }

  // Remove the picked image.
  clearImage(): void {
    this.draftImage.set(null);
  }

  // Send the message.
  async onSend(): Promise<void> {
    if (!this.canSend()) return;
    this.sending.set(true);
    const ack = await this.chat.sendMessage(this.roomId(), this.draftText, this.draftImage());
    this.sending.set(false);

    if (!ack.ok) {
      this.errorMessage.set(ack.error ?? 'Message not sent. Try again.');
      return;
    }
    this.errorMessage.set('');
    this.draftText = '';
    this.draftImage.set(null);
    if (ack.message && !this.messages().some((m) => m.id === ack.message!.id)) {
      this.messages.update((list) => [...list, ack.message!]);
      this.scrollToBottom();
    }
  }

  // Enter = send, Shift+Enter = new line.
  onComposerKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.onSend();
    }
  }

  // Delete my message.
  async onDelete(message: ChatMessage): Promise<void> {
    const ack = await this.chat.deleteMessage(this.roomId(), message.id);
    if (!ack.ok) this.errorMessage.set(ack.error ?? 'Could not delete that message.');
  }

  // Go back to the group.
  onLeave() {
    this.router.navigate(['/groups', this.groupId()]);
  }

  // Scroll to the newest message.
  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messageList?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }
}
