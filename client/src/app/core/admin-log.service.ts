import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Page } from './models';

// Mirrors server's AdminLogEntry shape.
export interface AdminLogEntry {
  id: string;
  action: string;
  actorId: string;
  targetId: string | null;
  details: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class AdminLogService {
  private http = inject(HttpClient);

  // Turn the Observable into a Promise.
  private toPromise<T>(request$: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request$.subscribe({
        next: (value) => resolve(value),
        error: (err) => reject(err),
      });
    });
  }

  // Get admin logs, optionally filtered by action.
  getLogs(actionFilter?: string): Promise<AdminLogEntry[]> {
    const query = actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : '';
    return this.toPromise(this.http.get<AdminLogEntry[]>(`/api/admin/logs${query}`));
  }

  // One page of logs (newest first), optionally one action type.
  getPage(action: string, page: number, pageSize = 20): Promise<Page<AdminLogEntry>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (action && action !== 'all') params = params.set('action', action);
    return this.toPromise(this.http.get<Page<AdminLogEntry>>('/api/admin/logs', { params }));
  }

  // All action types (for the filter dropdown).
  getActions(): Promise<string[]> {
    return this.toPromise(this.http.get<string[]>('/api/admin/logs/actions'));
  }
}
