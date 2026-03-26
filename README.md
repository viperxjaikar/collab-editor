# CollabEditor

A real-time collaborative code editor with live synchronization, voice communication, and AI-assisted coding — built to handle multi-user concurrency in browser-based environments.

---

## 🚀 What This Actually Solves

Most "collaborative editors" fail at:
- Handling simultaneous edits correctly
- Managing real-time state across users
- Avoiding data loss during conflicts

This project implements a working real-time system with:
- WebSocket-based sync
- Conflict handling strategy
- Persistent storage
- Multi-user session management

---

## ⚙️ Core Features

### Real-Time Collaboration
- Multiple users edit the same file simultaneously
- Live cursor tracking and typing indicators
- Instant updates via Socket.IO events

### Conflict Handling
- Handles concurrent edits using controlled update flow
- Prevents overwrite issues (basic OT / last-write-wins hybrid)

### Code Editor
- Monaco Editor (VS Code-like experience)
- Syntax highlighting for multiple languages
- Tab-based file navigation

### Voice Communication
- Built-in WebRTC voice chat
- No external tools required

### File System
- Create, delete, and manage files/folders
- Persistent storage using MongoDB
- Auto-save mechanism

### Authentication & Security
- JWT-based authentication
- Password hashing using bcrypt
- Protected rooms with optional passwords

---

## 🏗️ Architecture

Frontend → Backend → Database → Sync Layer

- React handles UI + editor
- Express handles API + auth
- Socket.IO handles real-time communication
- MongoDB stores users, rooms, files

### Key Real-Time Events
- join-room
- room-state
- doc-edit
- remote-edit
- cursor-update
- disconnect

---

## 📁 Project Structure

collab-editor/
├── server/
│   ├── index.js        # API + WebSocket server
│   ├── db.js           # MongoDB connection
│   ├── auth.js         # JWT logic
│   └── rooms.js        # Room + file logic
│
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── api.js
│
└── package.json

---

## 🛠️ Tech Stack

Frontend:
- React
- Monaco Editor
- Socket.IO Client
- Vite

Backend:
- Node.js
- Express
- Socket.IO

Database:
- MongoDB

---

## 🚀 Setup

git clone https://github.com/viperxjaikar/collab-editor.git  
cd collab-editor  

npm install  

cd server && npm install && cd ..  
cd client && npm install && cd ..  

# Start MongoDB  
mongod  

# Run app  
npm run dev  

Open: http://localhost:5173

---

## 🧪 How to Test Properly

1. Open two browser windows  
2. Login with different users  
3. Join same room  
4. Edit simultaneously  

Expected:
- No overwrite issues  
- Edits sync instantly  
- No crashes  

---

## ⚠️ Limitations

- No full CRDT/OT implementation yet  
- Not horizontally scalable (single server)  
- Voice chat may fail in restrictive networks  

---

## 💡 Future Improvements

- Implement CRDT for real conflict resolution  
- Add Docker + cloud deployment  
- Add persistent cursor positions  
- Add code execution sandbox  
- Optimize WebSocket event batching  

---

## 📌 Why This Project Matters

This is not a CRUD app.

It demonstrates:
- Real-time system design  
- Concurrency handling  
- WebSocket architecture  
- Multi-user state synchronization  

---

## 👤 Author

Jaikar Ramu  
https://github.com/viperxjaikar  

---

## ⭐ Star if useful
