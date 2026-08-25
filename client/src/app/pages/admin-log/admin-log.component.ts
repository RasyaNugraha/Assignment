import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { AdminLogEntry, AdminLogService } from '../../core/admin-log.service';

// Phase1.md §5.1 "AdminLogComponent" / §6.6. R31/R32 — every administrative
// action is logged server-side; this just renders + filters that log.
@Component({
  selector: 'app-admin-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-log.component.html',
  styleUrl: './admin-log.component.css',
})
export class AdminLogComponent implements OnInit {
  private adminLogService = inject(AdminLogService);

  private logs = signal<AdminLogEntry[]>([]);
  loading = signal(true);
  errorMessage = signal('');

  actionFilter = signal('all');
  actionTypes = computed(() => Array.from(new Set(this.logs().map((entry) => entry.action))).sort());
  filteredLogs = computed(() => {
    const filter = this.actionFilter();
    return filter === 'all' ? this.logs() : this.logs().filter((entry) => entry.action === filter);
  });

  ngOnInit(): void {
    this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.logs.set(await this.adminLogService.getLogs());
      this.errorMessage.set('');
    } catch {
      this.errorMessage.set('Could not load the admin log. Try refreshing.');
    } finally {
      this.loading.set(false);
    }
  }

  onFilterChange(value: string): void {
    this.actionFilter.set(value);
  }
}
