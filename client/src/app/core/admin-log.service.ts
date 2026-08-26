import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

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

  private toPromise<T>(request$: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request$.subscribe({
        next: (value) => resolve(value),
        error: (err) => reject(err),
      });
    });
  }

  getLogs(actionFilter?: string): Promise<AdminLogEntry[]> {
    const query = actionFilter ? `?action=${encodeURIComponent(actionFilter)}` : '';
    return this.toPromise(this.http.get<AdminLogEntry[]>(`/api/admin/logs${query}`));
  }
}
