// Delete the whole database (bootstrap screen shows again).
const config = require('../config');
const db = require('../services/dbService');

// Drop the database.
async function main() {
  const database = await db.connect(config.mongoUri, config.dbName);
  await database.dropDatabase();
  console.log(`Dropped database "${config.dbName}". Restart the server to recreate indexes.`);
}

main()
  .catch((err) => {
    console.error('Reset failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
