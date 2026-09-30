// All database access goes through here (MongoDB driver).

const { MongoClient } = require('mongodb');
const { randomUUID } = require('crypto');

const DEFAULT_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
const DEFAULT_DB_NAME = process.env.DB_NAME || 'fabulari';

const COLLECTIONS = ['users', 'groups', 'rooms', 'requests', 'adminLogs', 'messages'];

// Hide Mongo's _id from results.
const PROJECTION = { projection: { _id: 0 } };

let client = null;
let db = null;

// Connect once when the server starts and reuse the connection.
async function connect(uri = DEFAULT_URI, dbName = DEFAULT_DB_NAME) {
  if (db) return db;
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  db = client.db(dbName);
  await ensureIndexes();
  return db;
}

// Use an already-connected db (for tests).
function useDb(database) {
  db = database;
  return db;
}

// Close the connection.
async function close() {
  if (client) await client.close();
  client = null;
  db = null;
}

// The MongoClient (used for the session store).
function getClient() {
  return client;
}

// Get the db (error if not connected).
function getDb() {
  if (!db) throw new Error('Database not connected — call dbService.connect() first.');
  return db;
}

// Get a collection.
function col(name) {
  return getDb().collection(name);
}

// Create indexes (unique id + unique email + common lookups).
async function ensureIndexes() {
  const database = getDb();
  await Promise.all(COLLECTIONS.map((name) => database.collection(name).createIndex({ id: 1 }, { unique: true })));
  await database.collection('users').createIndex({ email: 1 }, { unique: true });
  await database.collection('rooms').createIndex({ groupId: 1 });
  await database.collection('requests').createIndex({ status: 1, type: 1 });
  await database.collection('messages').createIndex({ roomId: 1, seq: -1 });
  await database.collection('adminLogs').createIndex({ timestamp: -1 });
}

// Get all docs.
async function getAll(collection) {
  return col(collection).find({}, PROJECTION).toArray();
}

// Count docs.
async function count(collection, filter = {}) {
  return col(collection).countDocuments(filter);
}

// Find one doc by id.
async function findById(collection, id) {
  if (!id) return null;
  return col(collection).findOne({ id }, PROJECTION);
}

// Find one doc by filter.
async function findOne(collection, filter) {
  return col(collection).findOne(filter, PROJECTION);
}

// Find many docs, with optional sort, skip and limit.
async function findMany(collection, filter = {}, options = {}) {
  let cursor = col(collection).find(filter, PROJECTION);
  if (options.sort) cursor = cursor.sort(options.sort);
  if (options.skip) cursor = cursor.skip(options.skip);
  if (options.limit) cursor = cursor.limit(options.limit);
  return cursor.toArray();
}

// One page of docs + the total count (pagination = skip + limit).
async function findPage(collection, filter, { sort, page = 1, pageSize = 10 }) {
  const [items, total] = await Promise.all([
    findMany(collection, filter, { sort, skip: (page - 1) * pageSize, limit: pageSize }),
    count(collection, filter),
  ]);
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

// All different values of one field.
async function distinct(collection, field) {
  return col(collection).distinct(field);
}

// Insert a doc.
async function insert(collection, item) {
  // Insert a copy so _id doesn't get added to our object.
  await col(collection).insertOne({ ...item });
  return item;
}

// Update some fields with $set and return the new doc.
async function update(collection, id, updates) {
  return col(collection).findOneAndUpdate({ id }, { $set: updates }, { returnDocument: 'after', ...PROJECTION });
}

// Update with any Mongo operator ($pull, $addToSet, ...).
async function updateWith(collection, id, mongoUpdate) {
  return col(collection).findOneAndUpdate({ id }, mongoUpdate, { returnDocument: 'after', ...PROJECTION });
}

// Update one doc only if it still matches the filter (null if it doesn't).
async function updateWhere(collection, filter, updates) {
  return col(collection).findOneAndUpdate(filter, { $set: updates }, { returnDocument: 'after', ...PROJECTION });
}

// Like updateWhere, but with any Mongo operator (null if nothing matched).
async function updateWhereWith(collection, filter, mongoUpdate) {
  return col(collection).findOneAndUpdate(filter, mongoUpdate, { returnDocument: 'after', ...PROJECTION });
}

// Update many docs.
async function updateManyWith(collection, filter, mongoUpdate) {
  const result = await col(collection).updateMany(filter, mongoUpdate);
  return result.modifiedCount;
}

// Delete one doc by id.
async function remove(collection, id) {
  const result = await col(collection).deleteOne({ id });
  return result.deletedCount > 0;
}

// Delete many docs.
async function removeMany(collection, filter) {
  const result = await col(collection).deleteMany(filter);
  return result.deletedCount;
}

// Save an admin action to the log (R31).
async function logAdminAction({ action, actorId, targetId = null, details }) {
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
  COLLECTIONS,
  connect,
  useDb,
  close,
  getDb,
  getClient,
  ensureIndexes,
  getAll,
  count,
  findById,
  findOne,
  findMany,
  findPage,
  distinct,
  insert,
  update,
  updateWith,
  updateWhere,
  updateWhereWith,
  updateManyWith,
  remove,
  removeMany,
  logAdminAction,
};
