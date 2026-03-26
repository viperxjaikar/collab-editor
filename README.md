# CollabEditor - Real-time Collaborative Code Editor

## QUICK START (4 steps)

### Step 1: Install MongoDB
```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```
(Or install MongoDB locally from https://www.mongodb.com/try/download/community)

### Step 2: Install Dependencies
```bash
npm install
cd client && npm install && cd ..
```

### Step 3: Start
```bash
npm run dev
```

### Step 4: Open Browser
```
http://localhost:5173
```

Sign up → Create project → Share room ID → Collaborate!

---

## What's Inside

### Server (Node.js + Express + Socket.IO + MongoDB)
| File | What it does |
|------|-------------|
| server/index.js | HTTP server + WebSocket + all API routes + voice signaling |
| server/db.js | MongoDB connection + auto-indexing |
| server/auth.js | Sign up/in with bcrypt password hashing + JWT tokens |
| server/rooms.js | Room CRUD + file management + room passwords |

### Client (React + Vite + Monaco Editor)
| File | What it does |
|------|-------------|
| client/src/App.jsx | Complete app — Landing, Auth, Dashboard, Editor |
| client/src/api.js | API client with auto JWT token handling |
| client/src/main.jsx | React entry point |

### Database (MongoDB — 3 collections)
| Collection | Stores |
|-----------|--------|
| users | name, email, bcrypt password, avatar, color, theme |
| rooms | roomId, name, bcrypt room password, owner, members[] |
| files | roomId, file path, content, timestamps |

## All Features
- Landing page with hero
- Sign up / Sign in (bcrypt + JWT, persists across refreshes)
- Dashboard with search, tabs (My Projects / Shared)
- Profile settings (avatar color, theme selection)
- 4 themes: Midnight, Ocean, Forest, Light
- Room creation with optional passwords
- Join room by ID + password
- VS Code-style file explorer with folders
- File tabs (open multiple, close)
- Create new files from explorer
- Monaco code editor with syntax highlighting
- Real-time collaboration via Socket.IO
- Auto-save to MongoDB every 2 seconds
- Typing indicators
- Voice chat (WebRTC mic + mute)
- AI Copilot sidebar (Claude API — Explain, Bugs, Optimize, Tests)
- Share modal (WhatsApp, Telegram, copy link)
- Status bar (users, file, language, theme)
- User avatars in topbar

## Test with 2 Users
1. Open http://localhost:5173 in Chrome → Sign up as User 1
2. Create a project → note the Room ID
3. Open http://localhost:5173 in Incognito → Sign up as User 2
4. Click "Join Room" → enter the Room ID
5. Both users can edit the same files in real-time!
