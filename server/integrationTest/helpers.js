// Shared setup for integration tests (uses the fabulari_test database).

const chai = require('chai');
const chaiHttp = require('chai-http');
const db = require('../services/dbService');
const { createApp } = require('../app');

chai.use(chaiHttp);

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const TEST_DB_NAME = process.env.TEST_DB_NAME || 'fabulari_test';

if (!TEST_DB_NAME.endsWith('_test')) {
  throw new Error('Refusing to run integration tests against a database not named *_test.');
}

const PASSWORD = 'Password1';

async function connectTestDb() {
  await db.connect(MONGO_URI, TEST_DB_NAME);
}

async function clearDb() {
  await Promise.all(db.COLLECTIONS.map((name) => db.getDb().collection(name).deleteMany({})));
}

function newAgent(app) {
  // Agent keeps the login cookie between requests.
  return chai.request.agent(app);
}

const adultDob = '1990-05-05';
const childDob = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 8);
  return d.toISOString().slice(0, 10);
};

function userFields(name, dateOfBirth = adultDob) {
  return {
    email: `${name}@test.com`,
    password: PASSWORD,
    firstName: name,
    lastName: 'Tester',
    dateOfBirth,
  };
}

// Test data: super admin, alice (group admin), bob (member), carol (8 y/o, not a member) and 2 rooms.
async function buildWorld(app) {
  const superAdmin = newAgent(app);
  const alice = newAgent(app);
  const bob = newAgent(app);
  const carol = newAgent(app);

  const sa = (await superAdmin.post('/api/bootstrap').send(userFields('super'))).body;
  const aliceUser = (await alice.post('/api/auth/register').send(userFields('alice'))).body;
  const bobUser = (await bob.post('/api/auth/register').send(userFields('bob'))).body;
  const carolUser = (await carol.post('/api/auth/register').send(userFields('carol', childDob()))).body;

  const groupReq = (await alice.post('/api/groups/requests').send({ title: 'Test Group', description: 'For tests', minAge: 0 })).body;
  await superAdmin.post(`/api/requests/${groupReq.id}/approve`);
  const group = (await alice.get('/api/groups')).body.find((g) => g.title === 'Test Group');

  const joinReq = (await bob.post(`/api/groups/${group.id}/join`)).body;
  await alice.post(`/api/requests/${joinReq.id}/approve`);

  const createRoom = async (name, minAge) => {
    const req = (await alice.post(`/api/groups/${group.id}/rooms/requests`).send({ name, minAge })).body;
    await alice.post(`/api/requests/${req.id}/approve`);
  };
  await createRoom('general', 0);
  await createRoom('adults', 18);
  const detail = (await alice.get(`/api/groups/${group.id}`)).body;
  const general = detail.rooms.find((r) => r.name === 'general');
  const adults = detail.rooms.find((r) => r.name === 'adults');

  return {
    agents: { superAdmin, alice, bob, carol },
    users: { superAdmin: sa, alice: aliceUser, bob: bobUser, carol: carolUser },
    group,
    rooms: { general, adults },
    close: () => [superAdmin, alice, bob, carol].forEach((a) => a.close()),
  };
}

module.exports = {
  chai,
  expect: chai.expect,
  db,
  createApp,
  connectTestDb,
  clearDb,
  newAgent,
  userFields,
  childDob,
  buildWorld,
  PASSWORD,
};
