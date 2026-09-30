// Integration tests: removing a Group Admin (demote / step down).
const { expect, createApp, clearDb, buildWorld, db } = require('./helpers');

describe('DELETE /api/groups/:id/admins/:userId', () => {
  const app = createApp();
  let world;
  let url;

  before(async function () {
    this.timeout(10000);
    await clearDb();
    world = await buildWorld(app);
    url = (userId) => `/api/groups/${world.group.id}/admins/${userId}`;
  });
  after(() => world.close());

  const appointBob = () =>
    world.agents.alice.post(`/api/groups/${world.group.id}/admins`).send({ userId: world.users.bob.id });

  it('is forbidden to members who are not admins', async () => {
    const res = await world.agents.bob.delete(url(world.users.alice.id));
    expect(res).to.have.status(403);
  });

  it('does not let the only admin step down', async () => {
    const res = await world.agents.alice.delete(url(world.users.alice.id));
    expect(res).to.have.status(409);
    expect(res.body.error).to.match(/at least one admin/);
  });

  it('returns 400 for someone who is not an admin', async () => {
    const res = await world.agents.alice.delete(url(world.users.carol.id));
    expect(res).to.have.status(400);
  });

  it('does not let a co-admin remove the group creator', async () => {
    await appointBob();
    const res = await world.agents.bob.delete(url(world.users.alice.id));
    expect(res).to.have.status(403);
    const group = await db.findById('groups', world.group.id);
    expect(group.adminIds).to.include(world.users.alice.id);
  });

  it('lets the creator remove a co-admin, who stays a member, and logs it', async () => {
    const res = await world.agents.alice.delete(url(world.users.bob.id));
    expect(res).to.have.status(200);
    expect(res.body.adminIds).to.not.include(world.users.bob.id);
    expect(res.body.memberIds).to.include(world.users.bob.id);
    const bob = await db.findById('users', world.users.bob.id);
    expect(bob.groupAdminOf).to.not.include(world.group.id);
    const log = await db.findOne('adminLogs', { action: 'group_admin_removed', targetId: world.users.bob.id });
    expect(log.details).to.match(/removed bob Tester as a Group Admin/);
  });

  it('lets a co-admin step down themselves', async () => {
    await appointBob();
    const res = await world.agents.bob.delete(url(world.users.bob.id));
    expect(res).to.have.status(200);
    expect(res.body.isAdmin).to.equal(false);
    expect(await db.findOne('adminLogs', { details: { $regex: 'stepped down' } })).to.not.equal(null);
  });

  it('lets the creator step down once there is another admin', async () => {
    await appointBob();
    const res = await world.agents.alice.delete(url(world.users.alice.id));
    expect(res).to.have.status(200);
    const group = await db.findById('groups', world.group.id);
    expect(group.adminIds).to.deep.equal([world.users.bob.id]);
  });
});
