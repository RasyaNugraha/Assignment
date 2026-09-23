// Root-level hooks: run once before/after the whole integration suite.
const { connectTestDb, db } = require('./helpers');

before(async function () {
  this.timeout(10000);
  await connectTestDb();
  await db.getDb().dropDatabase();
  await db.ensureIndexes();
});

after(async () => {
  await db.close();
});
