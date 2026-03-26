const { MongoClient } = require('mongodb');
let client = null, db = null;

async function connect() {
  client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017', { maxPoolSize: 10 });
  await client.connect();
  db = client.db(process.env.DB_NAME || 'collab_editor');
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('rooms').createIndex({ roomId: 1 }, { unique: true });
  await db.collection('rooms').createIndex({ 'members.email': 1 });
  await db.collection('files').createIndex({ roomId: 1, path: 1 }, { unique: true });
  console.log('[DB] Connected to MongoDB');
  return db;
}

async function disconnect() {
  if (client) { await client.close(); client = null; db = null; }
}

function getDb() {
  if (!db) throw new Error('DB not connected');
  return db;
}

module.exports = { connect, disconnect, getDb };
