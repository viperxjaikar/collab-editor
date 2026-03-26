require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const db = require('./db');
const auth = require('./auth');
const rooms = require('./rooms');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;
const ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
const io = new Server(server, { cors: { origin: ORIGIN, methods: ['GET', 'POST'] } });

// REST API
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.post('/api/signup', async (req, res) => { try { res.json(await auth.signup(req.body.name, req.body.email, req.body.password)); } catch (e) { res.status(400).json({ error: e.message }); } });
app.post('/api/signin', async (req, res) => { try { res.json(await auth.signin(req.body.email, req.body.password)); } catch (e) { res.status(401).json({ error: e.message }); } });
app.get('/api/me', auth.mw, (req, res) => res.json({ user: req.user }));
app.put('/api/me', auth.mw, async (req, res) => { try { res.json(await auth.updateProfile(req.user.email, req.body)); } catch (e) { res.status(400).json({ error: e.message }); } });
app.post('/api/rooms', auth.mw, async (req, res) => { try { res.json(await rooms.create(req.body.name, req.body.password, req.user)); } catch (e) { res.status(400).json({ error: e.message }); } });
app.get('/api/rooms', auth.mw, async (req, res) => { try { res.json(await rooms.listByUser(req.user.email)); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/rooms/:id/join', auth.mw, async (req, res) => { try { res.json(await rooms.join(req.params.id, req.body.password, req.user)); } catch (e) { res.status(400).json({ error: e.message }); } });
app.get('/api/rooms/:id/files', auth.mw, async (req, res) => { try { res.json(await rooms.getFiles(req.params.id)); } catch (e) { res.status(500).json({ error: e.message }); } });
app.post('/api/rooms/:id/files', auth.mw, async (req, res) => { try { await rooms.saveFile(req.params.id, req.body.path, req.body.content); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); } });
app.post('/api/rooms/:id/files/create', auth.mw, async (req, res) => { try { await rooms.createFile(req.params.id, req.body.path, req.body.isFolder); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); } });

// Delete file endpoint
app.delete('/api/rooms/:id/files', auth.mw, async (req, res) => { 
  try { 
    await rooms.deleteFile(req.params.id, req.body.path); 
    res.json({ ok: true }); 
  } catch (e) { 
    res.status(400).json({ error: e.message }); 
  } 
});

// Socket.IO
io.use(async (socket, next) => {
  try { const t = socket.handshake.auth.token; if (!t) return next(new Error('No token')); socket.user = auth.verify(t); next(); }
  catch (e) { next(new Error('Auth failed')); }
});

io.on('connection', (socket) => {
  console.log('[WS] ' + socket.user.name + ' connected');
  let room = null;

  socket.on('join-room', async ({ roomId }) => {
    room = roomId;
    socket.join(roomId);
    const files = await rooms.getFiles(roomId);
    const sockets = await io.in(roomId).fetchSockets();
    const users = sockets.map(s => ({ id: s.id, name: s.user.name, email: s.user.email, color: s.user.color }));
    socket.emit('room-state', { files, users });
    socket.to(roomId).emit('user-joined', { id: socket.id, name: socket.user.name, color: socket.user.color });
  });

  socket.on('doc-edit', (d) => { if (room) socket.to(room).emit('remote-edit', { userId: socket.id, userName: socket.user.name, ...d }); });
  socket.on('save-file', async (d) => { if (room) { await rooms.saveFile(room, d.path, d.content); socket.emit('save-ack', { path: d.path }); } });
  socket.on('create-file', async (d) => { if (room) { await rooms.createFile(room, d.path, d.isFolder); io.in(room).emit('file-created', { path: d.path, by: socket.user.name }); } });
  
  // Delete file handler
  socket.on('delete-file', async ({ path }) => { 
    if (room) { 
      await rooms.deleteFile(room, path); 
      io.in(room).emit('file-deleted', { path, by: socket.user.name }); 
    } 
  });
  
  socket.on('cursor-update', (d) => { if (room) socket.to(room).emit('remote-cursor', { userId: socket.id, userName: socket.user.name, color: socket.user.color, ...d }); });
  socket.on('typing', (d) => { if (room) socket.to(room).emit('user-typing', { userId: socket.id, userName: socket.user.name, ...d }); });

  // Voice signaling
  socket.on('voice-join', () => { if (room) socket.to(room).emit('voice-join', { userId: socket.id, userName: socket.user.name }); });
  socket.on('voice-leave', () => { if (room) socket.to(room).emit('voice-leave', { userId: socket.id }); });
  socket.on('voice-offer', (d) => io.to(d.to).emit('voice-offer', { ...d, from: socket.id }));
  socket.on('voice-answer', (d) => io.to(d.to).emit('voice-answer', { ...d, from: socket.id }));
  socket.on('voice-ice', (d) => io.to(d.to).emit('voice-ice', { ...d, from: socket.id }));
  socket.on('voice-mute', (d) => { if (room) socket.to(room).emit('voice-mute', { userId: socket.id, muted: d.muted }); });

  socket.on('disconnect', () => {
    if (room) socket.to(room).emit('user-left', { id: socket.id, name: socket.user.name });
    console.log('[WS] ' + socket.user.name + ' disconnected');
  });
});

// Start
(async () => {
  await db.connect();
  server.listen(PORT, () => console.log('\n  CollabEditor Server running on :' + PORT + '\n'));
})();
process.on('SIGINT', async () => { await db.disconnect(); process.exit(0); });