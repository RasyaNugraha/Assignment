// Integration tests for auth routes.
const { expect, createApp, clearDb, newAgent, userFields, db } = require('./helpers');

describe('Auth & bootstrap routes', () => {
  const app = createApp();
  before(clearDb);

  describe('GET /api/status', () => {
    it('reports the server is up and on Phase 2', async () => {
      const res = await newAgent(app).get('/api/status');
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({ ok: true, app: 'fabulari-server', phase: 2 });
    });

    it('returns a JSON 404 for an unknown API route', async () => {
      const res = await newAgent(app).get('/api/does-not-exist');
      expect(res).to.have.status(404);
      expect(res.body.error).to.equal('Not found.');
    });
  });

  describe('GET /api/bootstrap/status', () => {
    it('reports needsBootstrap: true when there are no users', async () => {
      const res = await newAgent(app).get('/api/bootstrap/status');
      expect(res).to.have.status(200);
      expect(res.body).to.deep.equal({ needsBootstrap: true });
    });

    it('refuses registration before the system is bootstrapped', async () => {
      const res = await newAgent(app).post('/api/auth/register').send(userFields('early'));
      expect(res).to.have.status(409);
    });
  });

  describe('POST /api/bootstrap', () => {
    it('rejects invalid fields with a list of errors', async () => {
      const res = await newAgent(app).post('/api/bootstrap').send({ email: 'bad' });
      expect(res).to.have.status(400);
      expect(res.body.errors).to.be.an('array').that.is.not.empty;
    });

    it('creates the first user as Super Admin, stored in MongoDB with a hashed password', async () => {
      const res = await newAgent(app).post('/api/bootstrap').send(userFields('boss'));
      expect(res).to.have.status(201);
      expect(res.body.isSuperAdmin).to.equal(true);
      expect(res.body).to.not.have.property('passwordHash');
      expect(res.body).to.not.have.property('_id');

      const stored = await db.getDb().collection('users').findOne({ email: 'boss@test.com' });
      expect(stored.passwordHash).to.be.a('string').and.not.equal('Password1');
    });

    it('can only run once (409 afterwards)', async () => {
      const res = await newAgent(app).post('/api/bootstrap').send(userFields('second'));
      expect(res).to.have.status(409);
      const status = await newAgent(app).get('/api/bootstrap/status');
      expect(status.body.needsBootstrap).to.equal(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('registers a General User and logs them in', async () => {
      const agent = newAgent(app);
      const res = await agent.post('/api/auth/register').send(userFields('newbie'));
      expect(res).to.have.status(201);
      expect(res.body.isSuperAdmin).to.equal(false);
      expect(res.body.age).to.be.a('number');
      const me = await agent.get('/api/auth/me');
      expect(me.body.email).to.equal('newbie@test.com');
    });

    it('rejects a duplicate email (case-insensitive)', async () => {
      const res = await newAgent(app)
        .post('/api/auth/register')
        .send({ ...userFields('newbie'), email: 'NEWBIE@test.com' });
      expect(res).to.have.status(409);
    });

    it('rejects a weak password (R23)', async () => {
      const res = await newAgent(app).post('/api/auth/register').send({ ...userFields('weak'), password: 'weak' });
      expect(res).to.have.status(400);
    });
  });

  describe('POST /api/auth/login + GET /api/auth/me + POST /api/auth/logout', () => {
    it('logs in with the right password and returns the public user', async () => {
      const agent = newAgent(app);
      const res = await agent.post('/api/auth/login').send({ email: 'newbie@test.com', password: 'Password1' });
      expect(res).to.have.status(200);
      expect(res.body.email).to.equal('newbie@test.com');
      expect(res.body).to.not.have.property('passwordHash');
    });

    it('rejects a wrong password with 401', async () => {
      const res = await newAgent(app).post('/api/auth/login').send({ email: 'newbie@test.com', password: 'Wrong1234' });
      expect(res).to.have.status(401);
    });

    it('GET /api/auth/me is 401 when not logged in', async () => {
      const res = await newAgent(app).get('/api/auth/me');
      expect(res).to.have.status(401);
    });

    it('logout is harmless when not logged in', async () => {
      const res = await newAgent(app).post('/api/auth/logout');
      expect(res).to.have.status(204);
    });

    it('logout ends the session', async () => {
      const agent = newAgent(app);
      await agent.post('/api/auth/login').send({ email: 'newbie@test.com', password: 'Password1' });
      const out = await agent.post('/api/auth/logout');
      expect(out).to.have.status(204);
      const me = await agent.get('/api/auth/me');
      expect(me).to.have.status(401);
    });
  });
});
