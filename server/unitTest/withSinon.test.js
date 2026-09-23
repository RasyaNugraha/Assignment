// Unit tests using Sinon stubs instead of the real database.
const assert = require('assert');
const sinon = require('sinon');
const db = require('../services/dbService');
const requireAuth = require('../middleware/requireAuth');
const { canResolve } = require('../routes/requests');
const { checkRoomAccess } = require('../services/roomAccess');

// Fake Express res object.
function fakeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

describe('Unit tests with Sinon stubs (no database)', () => {
  afterEach(() => sinon.restore()); // put the real dbService functions back

  describe('requireAuth middleware', () => {
    it('responds 401 and does not call next() when there is no session', async () => {
      const next = sinon.spy();
      const res = fakeRes();
      await requireAuth({ session: {} }, res, next);
      assert.equal(res.statusCode, 401);
      assert.equal(next.called, false);
    });

    it('responds 401 when the session points at a user that no longer exists', async () => {
      sinon.stub(db, 'findById').resolves(null);
      const next = sinon.spy();
      const res = fakeRes();
      await requireAuth({ session: { userId: 'gone' } }, res, next);
      assert.equal(res.statusCode, 401);
      assert.equal(next.called, false);
    });

    it('attaches the user as req.currentUser and calls next()', async () => {
      const user = { id: 'u1', displayName: 'Tester' };
      const findById = sinon.stub(db, 'findById').resolves(user);
      const next = sinon.spy();
      const req = { session: { userId: 'u1' } };
      await requireAuth(req, fakeRes(), next);
      assert.ok(findById.calledOnceWith('users', 'u1'));
      assert.deepStrictEqual(req.currentUser, user);
      assert.ok(next.calledOnce);
    });
  });

  describe('requests #canResolve()', () => {
    const superAdmin = { id: 'sa', isSuperAdmin: true };
    const groupAdmin = { id: 'ga', isSuperAdmin: false };

    it('lets only the Super Admin resolve group creation requests', async () => {
      assert.equal(await canResolve({ type: 'group_creation' }, superAdmin), true);
      assert.equal(await canResolve({ type: 'group_creation' }, groupAdmin), false);
    });

    it('lets only the Super Admin resolve account deletion requests (R4)', async () => {
      assert.equal(await canResolve({ type: 'account_deletion' }, superAdmin), true);
      assert.equal(await canResolve({ type: 'account_deletion' }, groupAdmin), false);
    });

    it("lets a Group Admin resolve join/room/ban requests for THEIR group only", async () => {
      const findById = sinon.stub(db, 'findById');
      findById.withArgs('groups', 'g1').resolves({ id: 'g1', adminIds: ['ga'] });
      findById.withArgs('groups', 'g2').resolves({ id: 'g2', adminIds: ['someone-else'] });

      for (const type of ['group_join', 'room_creation', 'ban_request']) {
        assert.equal(await canResolve({ type, groupId: 'g1' }, groupAdmin), true);
        assert.equal(await canResolve({ type, groupId: 'g2' }, groupAdmin), false);
      }
    });

    it('returns false for an unknown request type', async () => {
      assert.equal(await canResolve({ type: 'bogus' }, superAdmin), false);
    });
  });

  describe('roomAccess #checkRoomAccess()', () => {
    const member = { id: 'm1', isSuperAdmin: false, dateOfBirth: '2000-01-01' };
    const group = { id: 'g1', memberIds: ['m1'], adminIds: [] };

    it('blocks the Super Admin from chat entirely', async () => {
      const result = await checkRoomAccess({ id: 'sa', isSuperAdmin: true }, 'g1', 'r1');
      assert.equal(result.ok, false);
      assert.equal(result.status, 403);
    });

    it('blocks users who are not members of the group', async () => {
      sinon.stub(db, 'findById').resolves({ ...group, memberIds: [] });
      sinon.stub(db, 'findOne').resolves({ id: 'r1', groupId: 'g1', minAge: 0 });
      const result = await checkRoomAccess(member, 'g1', 'r1');
      assert.equal(result.ok, false);
      assert.equal(result.error, 'Join this group before entering its rooms.');
    });

    it("blocks members who are younger than the room's minimum age (R18)", async () => {
      sinon.stub(db, 'findById').resolves(group);
      sinon.stub(db, 'findOne').resolves({ id: 'r1', groupId: 'g1', minAge: 99 });
      const result = await checkRoomAccess(member, 'g1', 'r1');
      assert.equal(result.ok, false);
      assert.equal(result.minAge, 99);
    });

    it('allows an old-enough member in and returns the room', async () => {
      const room = { id: 'r1', groupId: 'g1', minAge: 18 };
      sinon.stub(db, 'findById').resolves(group);
      sinon.stub(db, 'findOne').resolves(room);
      const result = await checkRoomAccess(member, 'g1', 'r1');
      assert.equal(result.ok, true);
      assert.deepStrictEqual(result.room, room);
    });
  });
});

describe('requests #describeRequest()', () => {
  const { describeRequest } = require('../routes/requests');
  it('describes each request type for the popup', () => {
    assert.equal(describeRequest({ type: 'group_creation', title: 'Chess' }), 'your new group "Chess"');
    assert.equal(describeRequest({ type: 'group_join' }, 'Chess'), 'joining "Chess"');
    assert.equal(describeRequest({ type: 'room_creation', name: 'general' }, 'Chess'), 'the room "#general" in "Chess"');
    assert.equal(describeRequest({ type: 'other' }), 'your request');
  });
});

describe('sockets/notify', () => {
  const { notifyRequestsChanged, notifyUser } = require('../sockets/notify');

  it('broadcasts requests:changed through io', () => {
    const emit = sinon.spy();
    notifyRequestsChanged({ app: { get: () => ({ emit }) } });
    assert.ok(emit.calledOnceWith('requests:changed'));
  });

  it("sends a notification to the user's own channel", () => {
    const emit = sinon.spy();
    const to = sinon.stub().returns({ emit });
    notifyUser({ app: { get: () => ({ to }) } }, 'u1', 'Hi');
    assert.ok(to.calledOnceWith('user:u1'));
    assert.equal(emit.firstCall.args[0], 'notification');
    assert.equal(emit.firstCall.args[1].text, 'Hi');
  });

  it('does nothing when there is no io (REST-only tests)', () => {
    assert.doesNotThrow(() => notifyRequestsChanged({ app: { get: () => undefined } }));
  });
});
