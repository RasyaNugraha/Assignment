// Copy the old data/db.json into MongoDB (use --force to overwrite).

const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../services/dbService');

const SOURCE = path.join(__dirname, '..', 'data', 'db.json');

// Import each collection.
async function main() {
  const force = process.argv.includes('--force');
  if (!fs.existsSync(SOURCE)) {
    console.log('No data/db.json found — nothing to import.');
    return;
  }
  const data = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));
  const database = await db.connect(config.mongoUri, config.dbName);

  for (const name of db.COLLECTIONS) {
    const docs = Array.isArray(data[name]) ? data[name] : [];
    const collection = database.collection(name);
    const existing = await collection.countDocuments();
    if (existing > 0 && !force) {
      console.log(`- ${name}: already has ${existing} document(s), skipped (use --force to replace)`);
      continue;
    }
    if (force) await collection.deleteMany({});
    if (docs.length) await collection.insertMany(docs.map((d) => ({ ...d })));
    console.log(`- ${name}: imported ${docs.length} document(s)`);
  }
  console.log(`Done — database "${config.dbName}".`);
}

main()
  .catch((err) => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.close());
