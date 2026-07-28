// DbService — small abstraction around the Phase 1 JSON-file data store.
// Route handlers never touch the filesystem directly; they go through this
// module. This is the swap point for Phase 2, when it gets replaced by
// Mongoose models without route/controller code needing to change.
// See Phase1.md section 4.7 for the db.json shape.

const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

const EMPTY_DB = {
  users: [],
  groups: [],
  rooms: [],
  requests: [],
  adminLogs: [],
  messages: [],
};

function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(EMPTY_DB, null, 2));
    return structuredClone(EMPTY_DB);
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return raw.trim() ? JSON.parse(raw) : structuredClone(EMPTY_DB);
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Generic collection helpers -------------------------------------------------

function getAll(collection) {
  const db = readDb();
  return db[collection] || [];
}

function findById(collection, id) {
  return getAll(collection).find((item) => item.id === id) || null;
}

function findOne(collection, predicate) {
  return getAll(collection).find(predicate) || null;
}

function findMany(collection, predicate) {
  const all = getAll(collection);
  return predicate ? all.filter(predicate) : all;
}

function insert(collection, item) {
  const db = readDb();
  db[collection].push(item);
  writeDb(db);
  return item;
}

function update(collection, id, updates) {
  const db = readDb();
  const idx = db[collection].findIndex((item) => item.id === id);
  if (idx === -1) return null;
  db[collection][idx] = { ...db[collection][idx], ...updates };
  writeDb(db);
  return db[collection][idx];
}

function remove(collection, id) {
  const db = readDb();
  const before = db[collection].length;
  db[collection] = db[collection].filter((item) => item.id !== id);
  writeDb(db);
  return db[collection].length < before;
}

// Admin log convenience helper (R31 — every administrative action is logged)
function logAdminAction({ action, actorId, targetId = null, details }) {
  const { randomUUID } = require('crypto');
  return insert('adminLogs', {
    id: randomUUID(),
    action,
    actorId,
    targetId,
    details,
    timestamp: new Date().toISOString(),
  });
}

module.exports = {
  getAll,
  findById,
  findOne,
  findMany,
  insert,
  update,
  remove,
  logAdminAction,
};
