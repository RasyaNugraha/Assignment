// Integration tests: group listing/detail, join rules, rooms, admin actions.
const { expect, createApp, clearDb, buildWorld, db } = require('./helpers');

describe('Group routes', () => {
  const app = createApp();
  let world;

  before(async function () {
    this.timeout(10000);
    await clearDb();
    world = await buildWorld(app);
  });
  after(() => world.close());

  describe('GET /api/groups', () => {
    it('lists every group, even for visitors who are not logged in', async () => {
      const res = await require('./helpers').newAgent(app).get('/api/groups');
      expect(res).to.have.status(200);
      expect(res.body.map((g) => g.title)).to.include('Test Group');
    });

    it('adds viewer-specific flags (isMember / isAdmin)', async () => {
      const res = await world.agents.alice.get('/api/groups');
      const group = res.body.find((g) => g.id === world.group.id);
      expect(group.isMember).to.equal(true);
      expect(group.isAdmin).to.equal(true);
    });
  });

  describe('GET /api/groups/:id', () => {
    it('returns the rooms, and the member list only to a Group Admin', async () => {
      const asAdmin = await world.agents.alice.get(`/api/groups/${world.group.id}`);
      expect(asAdmin.body.rooms).to.have.length(2);
      expect(asAdmin.body.members).to.be.an('array').with.length(2);

      const asMember = await world.agents.bob.get(`/api/groups/${world.group.id}`);
      expect(asMember.body).to.not.have.property('members');
    });

    it('returns 404 for an unknown group', async () => {
      const res = await world.agents.alice.get('/api/groups/does-not-exist');
      expect(res).to.have.status(404);
    });
  });

  describe('POST /api/groups/requests', () => {
    it('files a group creation request for the Super Admin', async () => {
      const res = await world.agents.bob.post('/api/groups/requests').send({ title: 'Bob Club', minAge: 0 });
      expect(res).to.have.status(201);
      expect(res.body.type).to.equal('group_creation');
      expect(res.body.status).to.equal('pending');
    });

    it('rejects a title longer than 30 characters (R13)', async () => {
      const res = await world.agents.bob.post('/api/groups/requests').send({ title: 'x'.repeat(31) });
      expect(res).to.have.status(400);
    });
  });

  describe('POST /api/groups/:id/join', () => {
    it('rejects a user younger than the group minimum age immediately', async () => {
      await world.agents.alice.patch(`/api/groups/${world.group.id}`).send({ minAge: 15 });
      const res = await world.agents.carol.post(`/api/groups/${world.group.id}/join`);
      expect(res).to.have.status(403);
      expect(res.body.minAge).to.equal(15);
      await world.agents.alice.patch(`/api/groups/${world.group.id}`).send({ minAge: 0 });
    });

    it('rejects a second join request while one is pending', async () => {
      const first = await world.agents.carol.post(`/api/groups/${world.group.id}/join`);
      expect(first).to.have.status(201);
      const second = await world.agents.carol.post(`/api/groups/${world.group.id}/join`);
      expect(second).to.have.status(409);
    });

    it('rejects a join request from an existing member', async () => {
      const res = await world.agents.bob.post(`/api/groups/${world.group.id}/join`);
      expect(res).to.have.status(409);
    });
  });

  describe('GET /api/groups/:groupId/rooms/:roomId (room entry check)', () => {
    it('lets a member into an all-ages room', async () => {
      const res = await world.agents.bob.get(`/api/groups/${world.group.id}/rooms/${world.rooms.general.id}`);
      expect(res).to.have.status(200);
      expect(res.body.name).to.equal('general');
    });

    it('blocks the Super Admin (does not use chat)', async () => {
      const res = await world.agents.superAdmin.get(`/api/groups/${world.group.id}/rooms/${world.rooms.general.id}`);
      expect(res).to.have.status(403);
    });

    it('blocks a non-member', async () => {
      const res = await world.agents.carol.get(`/api/groups/${world.group.id}/rooms/${world.rooms.general.id}`);
      expect(res).to.have.status(403);
    });
  });

  describe('GET /api/groups/:groupId/rooms/:roomId/messages', () => {
    it('returns the stored messages (none yet) to a member', async () => {
      const res = await world.agents.bob.get(`/api/groups/${world.group.id}/rooms/${world.rooms.general.id}/messages`);
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal([]);
    });

    it('is forbidden to the Super Admin (no access to chat history)', async () => {
      const res = await world.agents.superAdmin.get(`/api/groups/${world.group.id}/rooms/${world.rooms.general.id}/messages`);
      expect(res).to.have.status(403);
    });
  });

  describe('POST /api/groups/:id/rooms/requests', () => {
    it('rejects a room request from a non-member', async () => {
      const res = await world.agents.carol.post(`/api/groups/${world.group.id}/rooms/requests`).send({ name: 'x' });
      expect(res).to.have.status(403);
    });

    it('rejects a room name longer than 30 characters', async () => {
      const res = await world.agents.bob.post(`/api/groups/${world.group.id}/rooms/requests`).send({ name: 'r'.repeat(31) });
      expect(res).to.have.status(400);
    });

    it('files a room_creation request for a member', async () => {
      const res = await world.agents.bob.post(`/api/groups/${world.group.id}/rooms/requests`).send({ name: 'random', minAge: 0 });
      expect(res).to.have.status(201);
      expect(res.body.type).to.equal('room_creation');
    });
  });

  describe('PATCH /api/groups/:id', () => {
    it('lets a Group Admin change the description', async () => {
      const res = await world.agents.alice.patch(`/api/groups/${world.group.id}`).send({ description: 'Updated' });
      expect(res).to.have.status(200);
      expect(res.body.description).to.equal('Updated');
    });

    it('refuses to rename the group', async () => {
      const res = await world.agents.alice.patch(`/api/groups/${world.group.id}`).send({ title: 'New name' });
      expect(res).to.have.status(400);
    });

    it('refuses edits from a non-admin member', async () => {
      const res = await world.agents.bob.patch(`/api/groups/${world.group.id}`).send({ description: 'hack' });
      expect(res).to.have.status(403);
    });
  });

  describe('GET /api/groups/:id/members', () => {
    it('lists members for any member of the group', async () => {
      const res = await world.agents.bob.get(`/api/groups/${world.group.id}/members`);
      expect(res).to.have.status(200);
      expect(res.body.map((m) => m.displayName)).to.include('alice Tester');
    });

    it('is forbidden to non-members', async () => {
      const res = await world.agents.carol.get(`/api/groups/${world.group.id}/members`);
      expect(res).to.have.status(403);
    });
  });

  describe('POST /api/groups/:id/admins', () => {
    it('only lets a Group Admin appoint', async () => {
      const res = await world.agents.bob.post(`/api/groups/${world.group.id}/admins`).send({ userId: world.users.bob.id });
      expect(res).to.have.status(403);
    });

    it('appoints a member as co-admin', async () => {
      const res = await world.agents.alice.post(`/api/groups/${world.group.id}/admins`).send({ userId: world.users.bob.id });
      expect(res).to.have.status(200);
      expect(res.body.adminIds).to.include(world.users.bob.id);
      const bob = await db.findById('users', world.users.bob.id);
      expect(bob.groupAdminOf).to.include(world.group.id);
    });
  });

  describe('POST /api/groups/:id/ban', () => {
    it('only lets a Group Admin ban', async () => {
      const res = await world.agents.carol.post(`/api/groups/${world.group.id}/ban`).send({ userId: world.users.bob.id });
      expect(res).to.have.status(403);
    });

    it('refuses to ban another Group Admin', async () => {
      const res = await world.agents.alice.post(`/api/groups/${world.group.id}/ban`).send({ userId: world.users.bob.id });
      expect(res).to.have.status(409);
    });

    it('refuses to let an admin ban themselves', async () => {
      const res = await world.agents.alice.post(`/api/groups/${world.group.id}/ban`).send({ userId: world.users.alice.id });
      expect(res).to.have.status(400);
    });
  });

  describe('POST /api/groups/:id/leave', () => {
    it('lets a co-admin leave now that there are two admins', async () => {
      const res = await world.agents.bob.post(`/api/groups/${world.group.id}/leave`);
      expect(res).to.have.status(200);
      expect(res.body.isMember).to.equal(false);
    });

    it('stops the sole admin from leaving', async () => {
      const res = await world.agents.alice.post(`/api/groups/${world.group.id}/leave`);
      expect(res).to.have.status(409);
    });
  });

  describe('POST /api/groups/:id/ban (successful ban)', () => {
    it('removes the member from this group only and blocks rejoining', async () => {
      // carol has a pending join request from earlier — approve it, then ban her.
      const pending = (await world.agents.alice.get('/api/requests')).body.find(
        (r) => r.type === 'group_join' && r.requesterId === world.users.carol.id,
      );
      await world.agents.alice.post(`/api/requests/${pending.id}/approve`);
      const res = await world.agents.alice.post(`/api/groups/${world.group.id}/ban`).send({ userId: world.users.carol.id });
      expect(res).to.have.status(200);
      expect(res.body.memberIds).to.not.include(world.users.carol.id);
      expect(res.body.bannedIds).to.include(world.users.carol.id);
      const carol = await db.findById('users', world.users.carol.id);
      expect(carol).to.not.equal(null); // still in the system (R8)
      const rejoin = await world.agents.carol.post(`/api/groups/${world.group.id}/join`);
      expect(rejoin).to.have.status(403);
    });
  });

  describe('DELETE /api/groups/:groupId/rooms/:roomId', () => {
    it('is forbidden to non-admins', async () => {
      const res = await world.agents.carol.delete(`/api/groups/${world.group.id}/rooms/${world.rooms.adults.id}`);
      expect(res).to.have.status(403);
    });

    it('lets the Group Admin remove a room and logs it', async () => {
      const res = await world.agents.alice.delete(`/api/groups/${world.group.id}/rooms/${world.rooms.adults.id}`);
      expect(res).to.have.status(204);
      expect(await db.findById('rooms', world.rooms.adults.id)).to.equal(null);
      expect(await db.findOne('adminLogs', { action: 'room_removed' })).to.not.equal(null);
    });
  });
});
