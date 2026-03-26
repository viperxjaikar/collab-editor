const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('./db');
const SECRET = process.env.JWT_SECRET || 'fallback-secret';
const COLORS = ['#818cf8','#f87171','#34d399','#fbbf24','#c084fc','#fb923c','#22d3ee','#f472b6'];

function makeAvatar(name) {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

async function signup(name, email, password) {
  if (!name || !email || !password) throw new Error('All fields required');
  if (!email.includes('@')) throw new Error('Invalid email');
  if (password.length < 4) throw new Error('Password must be 4+ characters');
  const db = getDb();
  if (await db.collection('users').findOne({ email })) throw new Error('Email already registered');
  const count = await db.collection('users').countDocuments();
  const user = {
    name, email,
    password: await bcrypt.hash(password, 10),
    avatar: makeAvatar(name),
    color: COLORS[count % COLORS.length],
    theme: 'dark',
    createdAt: new Date()
  };
  await db.collection('users').insertOne(user);
  const token = jwt.sign({ name, email, avatar: user.avatar, color: user.color }, SECRET, { expiresIn: '7d' });
  return { token, user: { name, email, avatar: user.avatar, color: user.color, theme: 'dark' } };
}

async function signin(email, password) {
  if (!email || !password) throw new Error('Email and password required');
  const db = getDb();
  const user = await db.collection('users').findOne({ email });
  if (!user) throw new Error('No account found');
  if (!(await bcrypt.compare(password, user.password))) throw new Error('Wrong password');
  const token = jwt.sign({ name: user.name, email, avatar: user.avatar, color: user.color }, SECRET, { expiresIn: '7d' });
  return { token, user: { name: user.name, email, avatar: user.avatar, color: user.color, theme: user.theme || 'dark' } };
}

async function updateProfile(email, updates) {
  const db = getDb();
  const set = {};
  if (updates.color) set.color = updates.color;
  if (updates.theme) set.theme = updates.theme;
  if (updates.name) { set.name = updates.name; set.avatar = makeAvatar(updates.name); }
  await db.collection('users').updateOne({ email }, { $set: set });
  const u = await db.collection('users').findOne({ email });
  return { name: u.name, email, avatar: u.avatar, color: u.color, theme: u.theme };
}

function verify(token) { return jwt.verify(token, SECRET); }

function mw(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'No token' });
  try { req.user = verify(h.split(' ')[1]); next(); }
  catch (e) { res.status(401).json({ error: 'Invalid token' }); }
}

module.exports = { signup, signin, updateProfile, verify, mw };
