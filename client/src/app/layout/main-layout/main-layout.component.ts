import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { NavbarComponent } from '../../shared/navbar/navbar.component';
import { ChatService } from '../../core/chat.service';
import { AuthService } from '../../core/auth.service';

// A popup shown in the corner.
interface Toast {
  id: number;
  text: string;
}

const TOAST_MS = 5000;

// Layout for logged-in pages: navbar, page content and notification popups.
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private chat = inject(ChatService);
  private auth = inject(AuthService);
  private sub?: Subscription;
  private nextId = 1;

  toasts = signal<Toast[]>([]);

  // Connect the socket and show notifications as popups.
  ngOnInit(): void {
    this.chat.connect();
    this.sub = this.chat.notifications$.subscribe((n) => {
      this.showToast(n.text);
      void this.auth.me().catch(() => undefined); // roles may have changed
    });
  }

  // Stop listening.
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Add a popup and remove it after a few seconds.
  showToast(text: string): void {
    const toast = { id: this.nextId++, text };
    this.toasts.update((list) => [...list, toast]);
    setTimeout(() => this.dismiss(toast.id), TOAST_MS);
  }

  // Close a popup.
  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
