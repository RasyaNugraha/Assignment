import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminLogEntry, AdminLogService } from '../../core/admin-log.service';

// Admin log page (Super Admin): filter by type, 20 per page.
@Component({
  selector: 'app-admin-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-log.component.html',
  styleUrl: './admin-log.component.css',
})
export class AdminLogComponent implements OnInit {
  private adminLogService = inject(AdminLogService);

  logs = signal<AdminLogEntry[]>([]);
  actionTypes = signal<string[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  actionFilter = signal('all');
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  // Load the filter options and the first page.
  ngOnInit(): void {
    void this.loadActions();
    void this.load();
  }

  // Get the list of action types.
  private async loadActions(): Promise<void> {
    try {
      this.actionTypes.set(await this.adminLogService.getActions());
    } catch {
      this.actionTypes.set([]);
    }
  }

  // Load one page of logs from the server.
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.adminLogService.getPage(this.actionFilter(), this.page());
      this.logs.set(result.items);
      this.total.set(result.total);
      this.totalPages.set(result.totalPages);
      this.errorMessage.set('');
    } catch {
      this.errorMessage.set('Could not load the admin log. Try refreshing.');
    } finally {
      this.loading.set(false);
    }
  }

  // New filter = back to page 1.
  onFilterChange(value: string): void {
    this.actionFilter.set(value);
    this.page.set(1);
    void this.load();
  }

  // Go to another page.
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page.set(page);
    void this.load();
  }
}
