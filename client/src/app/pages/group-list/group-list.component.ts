import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { Group } from '../../core/models';

// WIREFRAME.md §4 "Main / Group List Screen". Dummy/mock data for now —
// GroupService + /api/groups and /api/requests/group-creation land in
// Week 5-6 per TIMELINE.md; this screen just proves out the layout and
// interaction shape per the Phase 1 "prototype in Angular" brief.
const MOCK_MY_GROUPS: Group[] = [
  {
    id: 'g1',
    title: 'Griffith Full Stack 3813ICT',
    description: 'Course chat for 3813ICT students.',
    minAge: 0,
    backgroundColor: '#4a9eff',
    adminIds: [],
    memberIds: [],
    createdAt: new Date().toISOString(),
  },
];

const MOCK_ALL_GROUPS: Group[] = [
  ...MOCK_MY_GROUPS,
  {
    id: 'g2',
    title: 'Board Game Nights',
    description: 'Weekly board game meetups and chat.',
    minAge: 13,
    backgroundColor: '#f6c358',
    adminIds: [],
    memberIds: [],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'g3',
    title: 'Late Night Coders',
    description: 'For people who ship at 2am.',
    minAge: 0,
    backgroundColor: '#f0605c',
    adminIds: [],
    memberIds: [],
    createdAt: new Date().toISOString(),
  },
];

@Component({
  selector: 'app-group-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './group-list.component.html',
  styleUrl: './group-list.component.css',
})
export class GroupListComponent {
  myGroups = signal<Group[]>(MOCK_MY_GROUPS);
  allGroups = signal<Group[]>(MOCK_ALL_GROUPS);

  showRequestForm = signal(false);
  newGroupTitle = '';
  newGroupDescription = '';
  newGroupMinAge = 0;

  isMember(group: Group): boolean {
    return this.myGroups().some((g) => g.id === group.id);
  }

  // TODO: POST /api/requests/group-creation once the Request queue exists (Week 6).
  onRequestGroup() {
    this.showRequestForm.set(false);
    this.newGroupTitle = '';
    this.newGroupDescription = '';
    this.newGroupMinAge = 0;
  }

  // TODO: POST /api/requests/group-join once the Request queue exists (Week 6).
  onJoinGroup(_group: Group) {}
}
