const bcrypt = require('bcryptjs');
const { getDb } = require('./db');

function gid() {
  let s = '';
  for (let i = 0; i < 8; i++) s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.random() * 36 | 0];
  return s;
}

function defaultFiles(name) {
  return []; // No default files - start with empty workspace!
}

async function create(name, password, owner) {
  const db = getDb();
  const roomId = gid();
  const room = {
    roomId,
    name: name || 'Untitled',
    passwordHash: password ? await bcrypt.hash(password, 10) : null,
    hasPassword: !!password,
    owner: owner.email,
    members: [{ email: owner.email, name: owner.name, role: 'owner', joinedAt: new Date() }],
    createdAt: new Date(),
    lastActive: new Date()
  };
  await db.collection('rooms').insertOne(room);
  
  // No default files - start empty!
  // Users will create their own files and folders
  
  return { roomId, name: room.name, hasPassword: room.hasPassword };
}

async function join(roomId, password, user) {
  const db = getDb();
  const room = await db.collection('rooms').findOne({ roomId });
  if (!room) throw new Error('Room not found');
  if (room.passwordHash) {
    if (!password) throw new Error('Password required');
    if (!(await bcrypt.compare(password, room.passwordHash))) throw new Error('Wrong password');
  }
  if (!room.members.some(m => m.email === user.email)) {
    await db.collection('rooms').updateOne({ roomId }, {
      $push: { members: { email: user.email, name: user.name, role: 'editor', joinedAt: new Date() } }
    });
  }
  await db.collection('rooms').updateOne({ roomId }, { $set: { lastActive: new Date() } });
  return { roomId, name: room.name, hasPassword: room.hasPassword };
}

async function listByUser(email) {
  const db = getDb();
  const rooms = await db.collection('rooms').find({ 'members.email': email }).sort({ lastActive: -1 }).limit(20).toArray();
  return rooms.map(r => ({
    roomId: r.roomId, name: r.name, hasPassword: r.hasPassword,
    isOwner: r.owner === email, memberCount: r.members.length,
    createdAt: r.createdAt, lastActive: r.lastActive
  }));
}

async function getFiles(roomId) {
  return (await getDb().collection('files').find({ roomId }).sort({ path: 1 }).toArray())
    .map(f => ({ path: f.path, content: f.content }));
}

async function saveFile(roomId, path, content) {
  await getDb().collection('files').updateOne(
    { roomId, path }, 
    { $set: { content, updatedAt: new Date() } }, 
    { upsert: true }
  );
}

async function createFile(roomId, path, isFolder) {
  const db = getDb();
  
  if (isFolder) {
    // Create a folder by adding a .gitkeep file to represent the folder
    const folderKeepPath = path.endsWith('/') ? path + '.gitkeep' : path + '/.gitkeep';
    await db.collection('files').insertOne({ 
      roomId, 
      path: folderKeepPath, 
      content: '', 
      updatedAt: new Date(),
      isFolder: true 
    });
  } else {
    // Create a file with empty content
    await db.collection('files').insertOne({ 
      roomId, 
      path, 
      content: '', // Start with empty file
      updatedAt: new Date(),
      isFolder: false 
    });
  }
}

// Delete file function
async function deleteFile(roomId, path) {
  const db = getDb();
  
  // Delete the file itself
  await db.collection('files').deleteOne({ roomId, path });
  
  // Delete all files inside a folder if it's a folder deletion
  const filesToDelete = await db.collection('files').find({ 
    roomId, 
    path: { $regex: '^' + path + '/' } 
  }).toArray();
  
  for (const file of filesToDelete) {
    await db.collection('files').deleteOne({ roomId, path: file.path });
  }
}

module.exports = { create, join, listByUser, getFiles, saveFile, createFile, deleteFile };