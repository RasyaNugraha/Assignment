import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Group, GroupDetail, GroupRequest, Room } from './models';

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

  // R18 — server-side re-validation of a Room's age limit, called by
  // RoomComponent on entry. roomAgeGuard already checked this client-side,
  // but this hits the real authority (server/routes/groups.js), which
  // rejects with 403 if the current user is under the Room's minAge.
  getRoom(groupId: string, roomId: string): Promise<Room> {
    return this.toPromise(this.http.get<Room>(`/api/groups/${groupId}/rooms/${roomId}`));
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

  // R9 — Group Admin appoints another member as co-admin.
  appointAdmin(groupId: string, userId: string): Promise<GroupDetail> {
    return this.toPromise(this.http.post<GroupDetail>(`/api/groups/${groupId}/admins`, { userId }));
  }

  // R8 — Group Admin bans a member from this Group only (immediate, no
  // Super Admin approval needed — see server/routes/groups.js for why this
  // is direct while account deletion below isn't).
  banMember(groupId: string, userId: string): Promise<GroupDetail> {
    return this.toPromise(this.http.post<GroupDetail>(`/api/groups/${groupId}/ban`, { userId }));
  }

  // R4 — Group Admin escalates a member for full account deletion; only
  // files the request, the Super Admin queue (AdminQueueComponent) resolves it.
  requestAccountDeletion(groupId: string, userId: string, reason: string): Promise<GroupRequest> {
    return this.toPromise(
      this.http.post<GroupRequest>(`/api/groups/${groupId}/members/${userId}/deletion-requests`, { reason }),
    );
  }
}
