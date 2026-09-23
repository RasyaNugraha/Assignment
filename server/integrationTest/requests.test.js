// Integration tests: the unified approval queue (join / room / ban / delete).
const { expect, createApp, clearDb, buildWorld, db } = require('./helpers');

describe('Request queue routes', () => {
  const app = createApp();
  let world;

  before(async function () {
    this.timeout(10000);
    await clearDb();
    world = await buildWorld(app);
  });
  after(() => world.close());

  describe('GET /api/requests', () => {
    it('shows a Group Admin only the requests for their own group', async () => {
      const carolJoin = await world.agents.carol.post(`/api/groups/${world.group.id}/join`);
      expect(carolJoin).to.have.status(201);
      const res = await world.agents.alice.get('/api/requests');
      expect(res).to.have.status(200);
      expect(res.body.map((r) => r.type)).to.deep.equal(['group_join']);
      expect(res.body[0].requesterDisplayName).to.equal('carol Tester');
    });

    it('shows a regular member nothing to approve', async () => {
      const res = await world.agents.bob.get('/api/requests');
      expect(res.body).to.deep.equal([]);
    });

    it('requires login', async () => {
      const res = await require('./helpers').newAgent(app).get('/api/requests');
      expect(res).to.have.status(401);
    });
  });

  describe('POST /api/requests/:id/approve', () => {
    it('approving a group creation creates the group with the requester as admin', async () => {
      const req = (await world.agents.bob.post('/api/groups/requests').send({ title: 'Bob Club' })).body;
      const res = await world.agents.superAdmin.post(`/api/requests/${req.id}/approve`);
      expect(res).to.have.status(200);
      expect(res.body.status).to.equal('approved');
      const group = await db.findOne('groups', { title: 'Bob Club' });
      expect(group.adminIds).to.deep.equal([world.users.bob.id]);
    });

    it('a Group Admin cannot approve a group creation request', async () => {
      const req = (await world.agents.bob.post('/api/groups/requests').send({ title: 'Nope' })).body;
      const res = await world.agents.alice.post(`/api/requests/${req.id}/approve`);
      expect(res).to.have.status(403);
    });

    it('cannot approve the same request twice', async () => {
      const req = (await world.agents.bob.post('/api/groups/requests').send({ title: 'Twice' })).body;
      await world.agents.superAdmin.post(`/api/requests/${req.id}/approve`);
      const again = await world.agents.superAdmin.post(`/api/requests/${req.id}/approve`);
      expect(again).to.have.status(409);
    });
  });

  describe('POST /api/requests/:id/deny', () => {
    it('marks the request denied without changing anything else', async () => {
      const pending = (await world.agents.alice.get('/api/requests')).body.find((r) => r.type === 'group_join');
      const res = await world.agents.alice.post(`/api/requests/${pending.id}/deny`);
      expect(res).to.have.status(200);
      expect(res.body.status).to.equal('denied');
      const group = await db.findById('groups', world.group.id);
      expect(group.memberIds).to.not.include(world.users.carol.id);
    });

    it('returns 404 for an unknown request', async () => {
      const res = await world.agents.alice.post('/api/requests/nope/deny');
      expect(res).to.have.status(404);
    });
  });

  describe('Ban requests (member reports another member)', () => {
    it('a member reports someone; the Group Admin approves and they are banned', async () => {
      // Make carol a member first.
      const join = (await world.agents.carol.post(`/api/groups/${world.group.id}/join`)).body;
      await world.agents.alice.post(`/api/requests/${join.id}/approve`);

      const report = await world.agents.bob
        .post(`/api/groups/${world.group.id}/ban-requests`)
        .send({ userId: world.users.carol.id, reason: 'Spamming' });
      expect(report).to.have.status(201);

      const approve = await world.agents.alice.post(`/api/requests/${report.body.id}/approve`);
      expect(approve).to.have.status(200);
      const group = await db.findById('groups', world.group.id);
      expect(group.memberIds).to.not.include(world.users.carol.id);
      expect(group.bannedIds).to.include(world.users.carol.id);
    });

    it('a banned user cannot request to rejoin (R8)', async () => {
      const res = await world.agents.carol.post(`/api/groups/${world.group.id}/join`);
      expect(res).to.have.status(403);
    });

    it('a report needs a reason', async () => {
      const res = await world.agents.bob
        .post(`/api/groups/${world.group.id}/ban-requests`)
        .send({ userId: world.users.alice.id, reason: '' });
      expect(res).to.have.status(400);
    });
  });

  describe('Account deletion (R4 escalation)', () => {
    it('Group Admin escalates, Super Admin approves, user is removed everywhere', async () => {
      const esc = await world.agents.alice
        .post(`/api/groups/${world.group.id}/members/${world.users.bob.id}/deletion-requests`)
        .send({ reason: 'Abusive' });
      expect(esc).to.have.status(201);

      // Group Admin cannot approve their own escalation.
      const byAdmin = await world.agents.alice.post(`/api/requests/${esc.body.id}/approve`);
      expect(byAdmin).to.have.status(403);

      const res = await world.agents.superAdmin.post(`/api/requests/${esc.body.id}/approve`);
      expect(res).to.have.status(200);
      expect(await db.findById('users', world.users.bob.id)).to.equal(null);
      const groupsWithBob = await db.findMany('groups', { memberIds: world.users.bob.id });
      expect(groupsWithBob).to.have.length(0);
    });

    it('requires a reason', async () => {
      const res = await world.agents.alice
        .post(`/api/groups/${world.group.id}/members/${world.users.alice.id}/deletion-requests`)
        .send({});
      expect(res).to.have.status(400);
    });
  });
});
