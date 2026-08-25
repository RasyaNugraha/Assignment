import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Group, GroupDetail, GroupRequest } from './models';

export interface RequestGroupFields {
  title: string;
  description: string;
  minAge: number;
}

export interface RequestRoomFields {
  name: string;
  minAge: number;
}

@Injectable({ providedIn: 'root' })
export class GroupService {
  private http = inject(HttpClient);

  // Same toPromise() approach as AuthService — HttpClient returns an
  // Observable, this wraps the .subscribe() call into a Promise once so
  // components can `await` it instead of nesting callbacks.
  private toPromise<T>(request$: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request$.subscribe({
        next: (value) => resolve(value),
        error: (err) => reject(err),
      });
    });
  }

  getAll(): Promise<Group[]> {
    return this.toPromise(this.http.get<Group[]>('/api/groups'));
  }

  getById(id: string): Promise<GroupDetail> {
    return this.toPromise(this.http.get<GroupDetail>(`/api/groups/${id}`));
  }

  requestNewGroup(fields: RequestGroupFields): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>('/api/groups/requests', fields));
  }

  requestToJoin(groupId: string): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/groups/${groupId}/join`, {}));
  }

  requestRoom(groupId: string, fields: RequestRoomFields): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/groups/${groupId}/rooms/requests`, fields));
  }

  leave(groupId: string): Promise<Group> {
    return this.toPromise(this.http.post<Group>(`/api/groups/${groupId}/leave`, {}));
  }
}
