// Integration tests: search + pagination, input type checks, double approve.
const { expect, createApp, clearDb, buildWorld, newAgent } = require('./helpers');

describe('Search, pagination and validation', () => {
  const app = createApp();
  let world;

  before(async function () {
    this.timeout(15000);
    await clearDb();
    world = await buildWorld(app);
    // 12 more groups so there is something to page through.
    for (let i = 1; i <= 12; i += 1) {
      const req = (await world.agents.bob.post('/api/groups/requests').send({ title: `Club ${i}`, description: i % 2 ? 'chess' : 'music', minAge: i })).body;
      await world.agents.superAdmin.post(`/api/requests/${req.id}/approve`);
    }
  });
  after(() => world.close());

  describe('GET /api/groups?page=', () => {
    it('returns one page plus the totals', async () => {
      const res = await newAgent(app).get('/api/groups?page=1&pageSize=5');
      expect(res).to.have.status(200);
      expect(res.body.items).to.have.length(5);
      expect(res.body.total).to.equal(13);
      expect(res.body.totalPages).to.equal(3);
    });

    it('returns the last, shorter page', async () => {
      const res = await newAgent(app).get('/api/groups?page=3&pageSize=5');
      expect(res.body.items).to.have.length(3);
    });

    it('still returns a plain array without ?page (old behaviour)', async () => {
      const res = await newAgent(app).get('/api/groups');
      expect(res.body).to.be.an('array').with.length(13);
    });
  });

  describe('GET /api/groups?search= / maxAge / mine', () => {
    it('searches title and description (case-insensitive)', async () => {
      const res = await newAgent(app).get('/api/groups?search=CHESS');
      expect(res.body).to.have.length(6);
    });

    it('treats regex characters as plain text', async () => {
      const res = await newAgent(app).get('/api/groups?search=.*');
      expect(res.body).to.have.length(0);
    });

    it('filters by maximum age', async () => {
      const res = await newAgent(app).get('/api/groups?maxAge=3');
      expect(res.body.map((g) => g.minAge).every((a) => a <= 3)).to.equal(true);
    });

    it('lists only my groups with ?mine=true', async () => {
      const res = await world.agents.alice.get('/api/groups?mine=true');
      expect(res.body.map((g) => g.title)).to.deep.equal(['Test Group']);
    });
  });

  describe('GET /api/admin/logs?page= and /api/admin/logs/actions', () => {
    it('pages the admin log', async () => {
      const res = await world.agents.superAdmin.get('/api/admin/logs?page=1&pageSize=4');
      expect(res.body.items).to.have.length(4);
      expect(res.body.total).to.be.greaterThan(4);
    });

    it('lists the action types', async () => {
      const res = await world.agents.superAdmin.get('/api/admin/logs/actions');
      expect(res.body).to.include.members(['group_created', 'user_created']);
    });

    it('is Super Admin only', async () => {
      const res = await world.agents.bob.get('/api/admin/logs/actions');
      expect(res).to.have.status(403);
    });
  });

  describe('Wrong data types get a 400, not a crash', () => {
    it('group title as a number', async () => {
      const res = await world.agents.bob.post('/api/groups/requests').send({ title: 123 });
      expect(res).to.have.status(400);
    });

    it('minAge as text', async () => {
      const res = await world.agents.bob.post('/api/groups/requests').send({ title: 'x', minAge: 'ten' });
      expect(res).to.have.status(400);
    });

    it('room name as an object', async () => {
      const res = await world.agents.bob.post(`/api/groups/${world.group.id}/rooms/requests`).send({ name: { a: 1 } });
      expect(res).to.have.status(400);
    });

    it('login with a number password', async () => {
      const res = await newAgent(app).post('/api/auth/login').send({ email: 'bob@test.com', password: 12345678 });
      expect(res).to.have.status(400);
    });

    it('register with an array as the name', async () => {
      const res = await newAgent(app)
        .post('/api/auth/register')
        .send({ email: 'x@test.com', password: 'Password1', firstName: ['a'], lastName: 'b', dateOfBirth: '2000-01-01' });
      expect(res).to.have.status(400);
    });

    it('display name as a number', async () => {
      const res = await world.agents.bob.put('/api/users/me').send({ displayName: 42 });
      expect(res).to.have.status(400);
    });

    it('broken JSON body', async () => {
      const res = await world.agents.bob
        .post('/api/groups/requests')
        .set('Content-Type', 'application/json')
        .send('{"title": ');
      expect(res).to.have.status(400);
      expect(res.body.error).to.equal('Malformed JSON body.');
    });
  });

  describe('Double approve', () => {
    it('two approve clicks at the same time only apply once', async () => {
      const join = (await world.agents.carol.post(`/api/groups/${world.group.id}/join`)).body;
      const [a, b] = await Promise.all([
        world.agents.alice.post(`/api/requests/${join.id}/approve`),
        world.agents.alice.post(`/api/requests/${join.id}/approve`),
      ]);
      expect([a.status, b.status].sort()).to.deep.equal([200, 409]);
      const logs = await world.agents.superAdmin.get('/api/admin/logs?action=group_join_approved');
      expect(logs.body.filter((l) => l.details.includes('carol'))).to.have.length(1);
    });
  });
});
