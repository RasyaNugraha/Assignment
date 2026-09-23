import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { GroupRequest } from './models';

// Backs both the Super Admin queue and a Group Admin's pending-requests view.
@Injectable({ providedIn: 'root' })
export class RequestService {
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

  // Get pending requests.
  getPending(): Promise<GroupRequest[]> {
    return this.toPromise(this.http.get<GroupRequest[]>('/api/requests'));
  }

  // Approve a request.
  approve(id: string): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/requests/${id}/approve`, {}));
  }

  // Deny a request.
  deny(id: string): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/requests/${id}/deny`, {}));
  }
}
