// Integration tests: profile self-service + admin log.
const { expect, createApp, clearDb, buildWorld, PASSWORD } = require('./helpers');

const tinyPng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('User & admin log routes', () => {
  const app = createApp();
  let world;

  before(async function () {
    this.timeout(10000);
    await clearDb();
    world = await buildWorld(app);
  });
  after(() => world.close());

  describe('PUT /api/users/me', () => {
    it('changes the display name', async () => {
      const res = await world.agents.bob.put('/api/users/me').send({ displayName: 'Bobby' });
      expect(res).to.have.status(200);
      expect(res.body.displayName).to.equal('Bobby');
    });

    it('rejects an empty display name', async () => {
      const res = await world.agents.bob.put('/api/users/me').send({ displayName: '  ' });
      expect(res).to.have.status(400);
    });
  });

  describe('PUT /api/users/me/password', () => {
    it('rejects a wrong current password', async () => {
      const res = await world.agents.bob
        .put('/api/users/me/password')
        .send({ oldPassword: 'Wrong1234', newPassword: 'NewPassword1', confirmNewPassword: 'NewPassword1' });
      expect(res).to.have.status(401);
    });

    it('rejects a mismatched confirmation', async () => {
      const res = await world.agents.bob
        .put('/api/users/me/password')
        .send({ oldPassword: PASSWORD, newPassword: 'NewPassword1', confirmNewPassword: 'Different1' });
      expect(res).to.have.status(400);
    });

    it('changes the password so the new one works for login', async () => {
      const res = await world.agents.bob
        .put('/api/users/me/password')
        .send({ oldPassword: PASSWORD, newPassword: 'NewPassword1', confirmNewPassword: 'NewPassword1' });
      expect(res).to.have.status(204);
      const login = await require('./helpers')
        .newAgent(app)
        .post('/api/auth/login')
        .send({ email: 'bob@test.com', password: 'NewPassword1' });
      expect(login).to.have.status(200);
    });
  });

  describe('PUT /api/users/me/preferences', () => {
    it('saves valid preferences', async () => {
      const res = await world.agents.bob.put('/api/users/me/preferences').send({ theme: 'dark', fontSize: 'large' });
      expect(res.body.preferences).to.deep.equal({ theme: 'dark', fontSize: 'large' });
    });

    it('ignores invalid values', async () => {
      const res = await world.agents.bob.put('/api/users/me/preferences').send({ theme: 'purple' });
      expect(res.body.preferences.theme).to.equal('dark');
    });
  });

  describe('PUT /api/users/me/avatar + GET /api/users/:id/avatar', () => {
    it('rejects something that is not an image', async () => {
      const res = await world.agents.bob.put('/api/users/me/avatar').send({ avatarUrl: 'hello' });
      expect(res).to.have.status(400);
    });

    it('stores the avatar and serves it back as an image', async () => {
      const put = await world.agents.bob.put('/api/users/me/avatar').send({ avatarUrl: tinyPng });
      expect(put).to.have.status(200);
      const img = await world.agents.alice.get(`/api/users/${world.users.bob.id}/avatar`);
      expect(img).to.have.status(200);
      expect(img).to.have.header('content-type', /image\/png/);
    });

    it('returns 404 for a user without an avatar', async () => {
      const res = await world.agents.bob.get(`/api/users/${world.users.alice.id}/avatar`);
      expect(res).to.have.status(404);
    });
  });

  describe('GET /api/admin/logs', () => {
    it('is only available to the Super Admin', async () => {
      const res = await world.agents.alice.get('/api/admin/logs');
      expect(res).to.have.status(403);
    });

    it('returns logged admin actions, newest first', async () => {
      const res = await world.agents.superAdmin.get('/api/admin/logs');
      expect(res).to.have.status(200);
      expect(res.body.length).to.be.greaterThan(3);
      const times = res.body.map((l) => l.timestamp);
      expect(times).to.deep.equal([...times].sort().reverse());
    });

    it('filters by action type', async () => {
      const res = await world.agents.superAdmin.get('/api/admin/logs?action=room_created');
      expect(res.body).to.have.length(2);
      expect(res.body.every((l) => l.action === 'room_created')).to.equal(true);
    });
  });
});
