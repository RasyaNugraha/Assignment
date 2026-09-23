import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthService } from '../../core/auth.service';
import { ChatService } from '../../core/chat.service';
import { RequestService } from '../../core/request.service';

// Top bar: links, pending-request badge, avatar and logout.
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css',
})
export class NavbarComponent implements OnInit, OnDestroy {
  public auth = inject(AuthService);
  private router = inject(Router);
  private chat = inject(ChatService);
  private requests = inject(RequestService);
  private sub?: Subscription;

  pendingCount = signal(0);
  // Only admins have requests to handle.
  isAnyAdmin = computed(() => {
    const user = this.auth.currentUser();
    return !!user && (user.isSuperAdmin || user.groupAdminOf.length > 0);
  });

  // Load the badge and reload it when the queue changes.
  ngOnInit(): void {
    void this.loadPending();
    this.sub = this.chat.requestsChanged$.subscribe(() => void this.loadPending());
  }

  // Stop listening.
  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  // Count the requests I can approve.
  async loadPending(): Promise<void> {
    if (!this.isAnyAdmin()) return;
    try {
      this.pendingCount.set((await this.requests.getPending()).length);
    } catch {
      this.pendingCount.set(0);
    }
  }

  // Log out and go to the login page.
  async onLogout() {
    await this.auth.logout();
    this.chat.disconnect(); // close the socket tied to the old session
    this.router.navigateByUrl('/login');
  }
}
