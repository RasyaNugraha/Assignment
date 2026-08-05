import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';

import { Group, Room } from '../../core/models';
import { AuthService } from '../../core/auth.service';

// WIREFRAME.md §5 "Group View Screen". Mock group/room data — real
// GroupService/RoomService + /api/groups/:id, /api/groups/:id/rooms land in
// Week 5-6 per TIMELINE.md.
const MOCK_GROUP: Group = {
  id: 'g1',
  title: 'Griffith Full Stack 3813ICT',
  description: 'Course chat for 3813ICT students.',
  minAge: 0,
  backgroundColor: '#4a9eff',
  adminIds: [],
  memberIds: [],
  createdAt: new Date().toISOString(),
};

const MOCK_ROOMS: Room[] = [
  { id: 'r1', groupId: 'g1', name: 'general', minAge: 0, createdAt: new Date().toISOString() },
  { id: 'r2', groupId: 'g1', name: 'assignment-help', minAge: 0, createdAt: new Date().toISOString() },
];

@Component({
  selector: 'app-group-view',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './group-view.component.html',
  styleUrl: './group-view.component.css',
})
export class GroupViewComponent implements OnInit, OnDestroy {
  // inject() rather than constructor params — these fields are read during
  // property initialization, which runs before a constructor body would.
  private route = inject(ActivatedRoute);
  public auth = inject(AuthService);

  // Per Week 4 lecture: route.snapshot.paramMap only reads the param once,
  // when the component is first created. Angular reuses this component
  // instance if you navigate from one /groups/:groupId to another without
  // it being destroyed (e.g. clicking a different group in a list rendered
  // by this same route), so a snapshot-only read would go stale. Subscribing
  // to paramMap keeps groupId in sync for as long as the component lives.
  groupId = signal('');
  private paramSub?: Subscription;

  group = signal<Group>(MOCK_GROUP);
  rooms = signal<Room[]>(MOCK_ROOMS);

  showRequestRoomForm = signal(false);
  newRoomName = '';
  newRoomMinAge = 0;

  // Placeholder — real check compares auth.currentUser().groupAdminOf against
  // groupId once membership/admin data comes from the server (R6).
  isGroupAdmin = computed(() => this.auth.currentUser()?.isSuperAdmin ?? false);

  ngOnInit() {
    this.paramSub = this.route.paramMap.subscribe((params) => {
      this.groupId.set(params.get('groupId') ?? '');
      // TODO: re-fetch this group's real data from /api/groups/:id here once
      // that endpoint exists (Week 5-6) — currently always shows MOCK_GROUP.
    });
  }

  ngOnDestroy() {
    this.paramSub?.unsubscribe();
  }

  // TODO: POST /api/requests/room-creation once the Request queue exists (Week 6).
  onRequestRoom() {
    this.showRequestRoomForm.set(false);
    this.newRoomName = '';
    this.newRoomMinAge = 0;
  }
}
