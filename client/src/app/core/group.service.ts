import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ChatMessage, Group, GroupDetail, GroupRequest, MemberSummary, Page, Room } from './models';

export interface RequestGroupFields {
  title: string;
  description: string;
  minAge: number;
}

export interface GroupSearch {
  search?: string;
  maxAge?: number | null;
  page?: number;
  pageSize?: number;
}

export interface RequestRoomFields {
  name: string;
  minAge: number;
}

@Injectable({ providedIn: 'root' })
export class GroupService {
  private http = inject(HttpClient);

  // Turn the HttpClient Observable into a Promise so we can await it.
  private toPromise<T>(request$: Observable<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request$.subscribe({
        next: (value) => resolve(value),
        error: (err) => reject(err),
      });
    });
  }

  // Get all groups.
  getAll(): Promise<Group[]> {
    return this.toPromise(this.http.get<Group[]>('/api/groups'));
  }

  // Search groups, one page at a time.
  getPage(query: GroupSearch): Promise<Page<Group>> {
    let params = new HttpParams().set('page', query.page ?? 1).set('pageSize', query.pageSize ?? 12);
    if (query.search?.trim()) params = params.set('search', query.search.trim());
    if (query.maxAge !== null && query.maxAge !== undefined) params = params.set('maxAge', query.maxAge);
    return this.toPromise(this.http.get<Page<Group>>('/api/groups', { params }));
  }

  // Groups I'm a member of.
  getMine(): Promise<Group[]> {
    return this.toPromise(this.http.get<Group[]>('/api/groups', { params: { mine: 'true' } }));
  }

  // Get one group with its rooms.
  getById(id: string): Promise<GroupDetail> {
    return this.toPromise(this.http.get<GroupDetail>(`/api/groups/${id}`));
  }

  // Check if the user can enter the room.
  getRoom(groupId: string, roomId: string): Promise<Room> {
    return this.toPromise(this.http.get<Room>(`/api/groups/${groupId}/rooms/${roomId}`));
  }

  // Ask for a new group.
  requestNewGroup(fields: RequestGroupFields): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>('/api/groups/requests', fields));
  }

  // Ask to join a group.
  requestToJoin(groupId: string): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/groups/${groupId}/join`, {}));
  }

  // Ask for a new room.
  requestRoom(groupId: string, fields: RequestRoomFields): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/groups/${groupId}/rooms/requests`, fields));
  }

  // Leave a group.
  leave(groupId: string): Promise<Group> {
    return this.toPromise(this.http.post<Group>(`/api/groups/${groupId}/leave`, {}));
  }

  // Make a member a co-admin.
  appointAdmin(groupId: string, userId: string): Promise<GroupDetail> {
    return this.toPromise(this.http.post<GroupDetail>(`/api/groups/${groupId}/admins`, { userId }));
  }

  // Ban a member from this group.
  banMember(groupId: string, userId: string): Promise<GroupDetail> {
    return this.toPromise(this.http.post<GroupDetail>(`/api/groups/${groupId}/ban`, { userId }));
  }

  // Ask the Super Admin to delete a user.
  requestAccountDeletion(groupId: string, userId: string, reason: string): Promise<GroupRequest> {
    return this.toPromise(
      this.http.post<GroupRequest>(`/api/groups/${groupId}/members/${userId}/deletion-requests`, { reason }),
    );
  }

  // Get the last 5 messages of a room.
  getRoomMessages(groupId: string, roomId: string): Promise<ChatMessage[]> {
    return this.toPromise(this.http.get<ChatMessage[]>(`/api/groups/${groupId}/rooms/${roomId}/messages`));
  }

  // Remove a room.
  removeRoom(groupId: string, roomId: string): Promise<void> {
    return this.toPromise(this.http.delete<void>(`/api/groups/${groupId}/rooms/${roomId}`));
  }

  // Get the member list.
  getMembers(groupId: string): Promise<MemberSummary[]> {
    return this.toPromise(this.http.get<MemberSummary[]>(`/api/groups/${groupId}/members`));
  }

  // Report a member to the group admin.
  requestBan(groupId: string, userId: string, reason: string): Promise<GroupRequest> {
    return this.toPromise(this.http.post<GroupRequest>(`/api/groups/${groupId}/ban-requests`, { userId, reason }));
  }
}
