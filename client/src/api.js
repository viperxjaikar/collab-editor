// client/src/api.js
const B = import.meta.env.VITE_API_URL + '/api';

function tok() { 
  return localStorage.getItem('ce_token'); 
}

export function setTok(t) { 
  localStorage.setItem('ce_token', t); 
}

export function clearTok() { 
  localStorage.removeItem('ce_token'); 
}

export function hasTok() { 
  return !!tok(); 
}

export function hasToken() { 
  return hasTok(); 
}

export function getTok() { 
  return tok(); 
}

export function getToken() { 
  return tok(); 
}

export function logout() { 
  clearTok(); 
}

async function req(m, p, body) {
  const h = { 'Content-Type': 'application/json' };
  const t = tok(); 
  if (t) h['Authorization'] = 'Bearer ' + t;
  
  const r = await fetch(B + p, { 
    method: m, 
    headers: h, 
    body: body ? JSON.stringify(body) : undefined 
  });
  
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Failed');
  return d;
}

export async function signup(n, e, p) { 
  const d = await req('POST', '/signup', { name: n, email: e, password: p }); 
  setTok(d.token); 
  return d; 
}

export async function signin(e, p) { 
  const d = await req('POST', '/signin', { email: e, password: p }); 
  setTok(d.token); 
  return d; 
}

export async function getMe() { 
  return req('GET', '/me'); 
}

export async function updateMe(u) { 
  return req('PUT', '/me', u); 
}

export async function createRoom(n, p) { 
  return req('POST', '/rooms', { name: n, password: p }); 
}

export async function listRooms() { 
  return req('GET', '/rooms'); 
}

export async function joinRoom(id, p) { 
  return req('POST', '/rooms/' + id + '/join', { password: p }); 
}

export async function getFiles(id) { 
  return req('GET', '/rooms/' + id + '/files'); 
}

export async function saveFile(id, p, c) { 
  return req('POST', '/rooms/' + id + '/files', { path: p, content: c }); 
}

export async function createFileApi(id, p, f) { 
  return req('POST', '/rooms/' + id + '/files/create', { path: p, isFolder: f }); 
}

export async function deleteFileApi(id, p) { 
  return req('DELETE', '/rooms/' + id + '/files', { path: p }); 
}