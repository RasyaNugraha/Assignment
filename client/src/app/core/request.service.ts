import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GroupRequest } from './models';

// Backs both the Super Admin queue (group_creation requests) and a Group
// Admin's own pending-requests view (group_join, room_creation for their
// group) — GET /api/requests is already scoped server-side to whatever the
// current user is allowed to resolve (routes/requests.js canResolve()), so
// this service doesn't need to know the difference itself.
@Injectable({ providedIn: 'root' })
export class RequestService {
  private http = inject(HttpClient);

  private toPromise<T>(request$: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request$.subscribe({
        next: (value) => resolve(value),
        error: (err) => reject(err),
      });
    });
  }

  getPending(): Promise<GroupRequest[]> {
    return this.toPromise(this.http.get<GroupRequest[]>('/api/requests'));
  }

  approve(id: string): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/requests/${id}/approve`, {}));
  }

  deny(id: string): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/requests/${id}/deny`, {}));
  }
}
