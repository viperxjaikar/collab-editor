import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import Editor from '@monaco-editor/react';
import * as api from './api';

const TH = {
  dark:{b0:'#06080f',b1:'#0c1017',b2:'#111827',b3:'#1a2236',bd:'#1e293b',ac:'#6366f1',t0:'#f1f5f9',t1:'#94a3b8',t2:'#475569',ed:'#080c14',nm:'Midnight'},
  ocean:{b0:'#0a1628',b1:'#0f1d32',b2:'#142540',b3:'#1a3050',bd:'#1e3a5f',ac:'#22d3ee',t0:'#e0f2fe',t1:'#7dd3fc',t2:'#38bdf8',ed:'#081420',nm:'Ocean'},
  forest:{b0:'#071209',b1:'#0c1a10',b2:'#111f15',b3:'#1a2f20',bd:'#1e3a25',ac:'#34d399',t0:'#ecfdf5',t1:'#6ee7b7',t2:'#34d399',ed:'#060e08',nm:'Forest'},
  light:{b0:'#fff',b1:'#f8fafc',b2:'#f1f5f9',b3:'#e2e8f0',bd:'#cbd5e1',ac:'#6366f1',t0:'#0f172a',t1:'#475569',t2:'#94a3b8',ed:'#fff',nm:'Light'},
};
const PALS = ['#818cf8','#f87171','#34d399','#fbbf24','#c084fc','#fb923c','#22d3ee','#f472b6'];
function gL(p) { const e=(p||'').split('.').pop(); return {js:'javascript',jsx:'javascript',ts:'typescript',css:'css',html:'html',json:'json',md:'markdown',py:'python'}[e]||'plaintext'; }
function copyTxt(t) { try { navigator.clipboard.writeText(t); } catch(e) { const a=document.createElement('textarea'); a.value=t; a.style.position='fixed'; a.style.left='-9999px'; document.body.appendChild(a); a.select(); document.execCommand('copy'); document.body.removeChild(a); } }

export default function App() {
  const [pg, setPg] = useState('loading');
  const [user, setUser] = useState(null);
  const [tn, setTn] = useState('dark');
  const [err, setErr] = useState(null);
  const [aName, setAName] = useState('');
  const [aEmail, setAEmail] = useState('');
  const [aPass, setAPass] = useState('');
  const [rooms, setRooms] = useState([]);
  const [modal, setModal] = useState(null);
  const [nName, setNName] = useState('');
  const [nPass, setNPass] = useState('');
  const [jId, setJId] = useState('');
  const [jPass, setJPass] = useState('');
  const [search, setSearch] = useState('');
  const [dtab, setDtab] = useState('my');
  const [rid, setRid] = useState('');
  const [rname, setRname] = useState('');
  const [files, setFiles] = useState([]);
  const [aFile, setAFile] = useState(null);
  const [tabs, setTabs] = useState([]);
  const [contents, setContents] = useState({});
  const [users, setUsers] = useState([]);
  const [typing, setTyping] = useState([]);
  const [sock, setSock] = useState(null);
  // AI
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMsgs, setAiMsgs] = useState([]);
  const [aiIn, setAiIn] = useState('');
  const [aiLoad, setAiLoad] = useState(false);
  // Voice
  const [inVoice, setInVoice] = useState(false);
  const [vMuted, setVMuted] = useState(false);
  const [vPeers, setVPeers] = useState([]);
  // New file/folder
  const [nfPath, setNfPath] = useState('');
  const [nfName, setNfName] = useState('');
  const [isFolder, setIsFolder] = useState(false);
  const [sidePanel, setSidePanel] = useState('files');
  const [showConnected, setShowConnected] = useState(true);
  // Explorer state - track expanded folders
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  // File browser modal state
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [fileBrowserPath, setFileBrowserPath] = useState('');
  
  const aiScroll = useRef(null);
  const micRef = useRef(null);

  const T = TH[tn] || TH.dark;
  const iS = { width:'100%', padding:'10px 12px', background:T.b1, border:'1px solid '+T.bd, borderRadius:8, color:T.t0, fontSize:14, outline:'none' };
  const lS = { display:'block', fontSize:12, fontWeight:600, color:T.t1, marginBottom:5 };

  // Auto-login on mount
  useEffect(() => {
    if (api.hasTok()) {
      api.getMe().then(d => {
        setUser(d.user); setTn(d.user.theme || 'dark');
        api.listRooms().then(setRooms); setPg('dashboard');
      }).catch(() => { api.clearTok(); setPg('landing'); });
    } else setPg('landing');
  }, []);

  useEffect(() => { if (aiScroll.current) aiScroll.current.scrollTop = aiScroll.current.scrollHeight; }, [aiMsgs]);

  // ── Auth ──
  async function doSignup() { try { setErr(null); const d = await api.signup(aName, aEmail, aPass); setUser(d.user); setPg('dashboard'); } catch(e) { setErr(e.message); } }
  async function doSignin() { try { setErr(null); const d = await api.signin(aEmail, aPass); setUser(d.user); api.listRooms().then(setRooms); setPg('dashboard'); } catch(e) { setErr(e.message); } }
  function doLogout() { api.clearTok(); if (sock) sock.disconnect(); setUser(null); setSock(null); setPg('landing'); }

  // ── Rooms ──
  async function doCreate() { try { const r = await api.createRoom(nName, nPass); setModal(null); setNName(''); setNPass(''); enter(r.roomId, r.name); } catch(e) { setErr(e.message); } }
  async function doJoin() { try { const r = await api.joinRoom(jId, jPass); setModal(null); setJId(''); setJPass(''); enter(r.roomId, r.name); } catch(e) { setErr(e.message); } }

  function enter(id, name) {
    setRid(id); setRname(name); setAiMsgs([]); setInVoice(false); setVPeers([]); setShowConnected(true);
    const s = io(window.location.origin, { auth: { token: api.getTok() } });
    s.on('connect', () => s.emit('join-room', { roomId: id }));
    s.on('room-state', d => {
      setFiles(d.files);
      const c = {}; d.files.forEach(f => c[f.path] = f.content); setContents(c);
      setUsers(d.users);
    });
    s.on('user-joined', u => setUsers(p => p.find(x => x.id === u.id) ? p : [...p, u]));
    s.on('user-left', u => setUsers(p => p.filter(x => x.id !== u.id)));
    s.on('remote-edit', d => setContents(p => ({ ...p, [d.path]: d.content })));
    s.on('user-typing', d => { setTyping(p => p.includes(d.userName) ? p : [...p, d.userName]); setTimeout(() => setTyping(p => p.filter(n => n !== d.userName)), 2000); });
    s.on('file-created', () => api.getFiles(id).then(f => { setFiles(f); const c2 = {}; f.forEach(fi => c2[fi.path] = fi.content); setContents(p => ({ ...p, ...c2 })); }));
    s.on('file-deleted', ({ path }) => {
      setFiles(prev => prev.filter(f => f.path !== path && !f.path.startsWith(path + '/')));
      setContents(prev => { const newC = {...prev}; delete newC[path]; return newC; });
      if (aFile === path || (aFile && aFile.startsWith(path + '/'))) {
        setTabs(prev => prev.filter(t => t !== path && !t.startsWith(path + '/')));
        setAFile(null);
      }
    });
    s.on('voice-join', d => setVPeers(p => [...p, { id: d.userId, name: d.userName, muted: false }]));
    s.on('voice-leave', d => setVPeers(p => p.filter(x => x.id !== d.userId)));
    s.on('voice-mute', d => setVPeers(p => p.map(x => x.id === d.userId ? { ...x, muted: d.muted } : x)));
    setSock(s); setPg('editor');
  }

  function openFile(p) { 
    setTabs(t => t.includes(p) ? t : [...t, p]); 
    setAFile(p); 
  }
  
  function closeTab(p) { 
    setTabs(t => { 
      const n = t.filter(x => x !== p); 
      if (aFile === p) setAFile(n.length ? n[n.length - 1] : null); 
      return n; 
    }); 
  }
  
  function onEdit(val) {
    if (!aFile || !sock) return;
    setContents(p => ({ ...p, [aFile]: val }));
    sock.emit('doc-edit', { path: aFile, content: val });
    sock.emit('typing', { file: aFile });
    clearTimeout(window._st); 
    window._st = setTimeout(() => api.saveFile(rid, aFile, val), 2000);
  }
  
  function doLeave() { 
    if (sock) sock.disconnect(); 
    setSock(null); 
    setAFile(null); 
    setTabs([]); 
    setFiles([]); 
    setUsers([]); 
    setAiOpen(false); 
    leaveVoice(); 
    api.listRooms().then(setRooms); 
    setPg('dashboard'); 
  }

  // ── Delete file ──
  async function deleteFile(path) {
    if (!confirm(`Delete "${path}"? This cannot be undone.`)) return;
    if (sock) sock.emit('delete-file', { path });
  }

  // ── Voice ──
  function joinVoice() {
    setInVoice(true); setVMuted(false);
    try { navigator.mediaDevices.getUserMedia({ audio: true }).then(s => { micRef.current = s; }).catch(() => {}); } catch(e) {}
    if (sock) sock.emit('voice-join');
  }
  function leaveVoice() {
    if (micRef.current) { micRef.current.getTracks().forEach(t => t.stop()); micRef.current = null; }
    setInVoice(false); setVMuted(false); setVPeers([]);
    if (sock) sock.emit('voice-leave');
  }
  function toggleMute() {
    if (micRef.current) micRef.current.getAudioTracks().forEach(t => { t.enabled = vMuted; });
    setVMuted(!vMuted);
    if (sock) sock.emit('voice-mute', { muted: !vMuted });
  }

  // ── AI ──
  function askAI(msg, sys) {
    if (aiLoad) return;
    const code = aFile && contents[aFile] ? contents[aFile] : '';
    setAiMsgs(p => [...p, { id: Date.now(), r: 'u', t: msg }]);
    setAiIn(''); setAiLoad(true);
    setTimeout(() => {
      const resp = localAI(msg, sys, code, aFile);
      setAiMsgs(p => [...p, { id: Date.now() + 1, r: 'a', t: resp }]);
      setAiLoad(false);
    }, 500 + Math.random() * 800);
  }

  function localAI(msg, sys, code, file) {
    const lines = code.split('\n');
    const lineCount = lines.length;
    const lang = gL(file || '');
    const lower = (sys || msg).toLowerCase();
    const fname = (file || '').split('/').pop();

    if (lower.includes('explain')) {
      const funcs = code.match(/function\s+(\w+)/g) || [];
      const imports = code.match(/import .+/g) || [];
      let r = `**File: ${fname}** (${lineCount} lines, ${lang})\n\n`;
      if (imports.length) r += `**Imports:** ${imports.length} module(s)\n`;
      if (funcs.length) r += `**Functions:** ${funcs.map(f => '`' + f.replace('function ', '') + '()`').join(', ')}\n`;
      if (code.includes('useState')) r += '\nUses React `useState` for state management.\n';
      if (code.includes('useEffect')) r += 'Uses `useEffect` for side effects.\n';
      return r;
    }
    if (lower.includes('bug')) {
      let issues = [];
      lines.forEach((line, i) => {
        if (line.includes('==') && !line.includes('===')) issues.push(`Line ${i+1}: Use \`===\` instead of \`==\``);
        if (line.includes('var ')) issues.push(`Line ${i+1}: Use \`let\` or \`const\` instead of \`var\``);
        if (line.match(/console\.(log|error|warn)/)) issues.push(`Line ${i+1}: Remove console.log`);
        if (line.match(/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/)) issues.push(`Line ${i+1}: Empty catch block`);
      });
      if (issues.length === 0) return '✅ No obvious bugs found!';
      return `**Found ${issues.length} issue(s):**\n\n${issues.map(i => '• ' + i).join('\n')}`;
    }
    if (lower.includes('optim')) {
      let tips = [];
      if (code.includes('.forEach')) tips.push('Consider using `for...of` loops for better performance');
      if (code.match(/\.filter\(.*\)\.map\(/)) tips.push('Replace `.filter().map()` with `.reduce()`');
      if (lineCount > 100) tips.push(`File is ${lineCount} lines — consider splitting into smaller modules`);
      if (tips.length === 0) tips.push('Code looks reasonably optimized!');
      return `**Optimization suggestions:**\n\n${tips.map(t => '• ' + t).join('\n')}`;
    }
    if (lower.includes('test')) {
      return `\`\`\`javascript\n// Test template for ${fname}\ndescribe('${fname}', () => {\n  test('should work correctly', () => {\n    // Add your test here\n    expect(true).toBe(true);\n  });\n});\n\`\`\``;
    }
    return `I analyzed **${fname}** (${lineCount} lines).\n\nUse the quick actions above:\n• **Explain** — understand the code\n• **Bugs** — find issues\n• **Optimize** — performance tips\n• **Tests** — generate test templates`;
  }

  function renderAi(t) {
    return t.split(/(```[\s\S]*?```)/g).map((p, i) => {
      if (p.startsWith('```')) {
        const code = p.replace(/^```\w*\n?/, '').replace(/```$/, '').trim();
        return (<div key={i} style={{ position: 'relative', margin: '6px 0' }}>
          <pre style={{ background: T.b0, border: '1px solid ' + T.bd, borderRadius: 6, padding: '8px 8px 28px', fontSize: 11, fontFamily: 'Menlo,monospace', color: T.t0, whiteSpace: 'pre-wrap', overflowX: 'auto' }}>{code}</pre>
          <div style={{ position: 'absolute', bottom: 4, right: 4, display: 'flex', gap: 3 }}>
            <button onClick={() => copyTxt(code)} style={{ padding: '2px 8px', background: T.b3, border: '1px solid ' + T.bd, borderRadius: 4, color: T.t1, fontSize: 9, cursor: 'pointer' }}>Copy</button>
            <button onClick={() => { if (aFile && sock) { setContents(p => ({ ...p, [aFile]: code })); sock.emit('doc-edit', { path: aFile, content: code }); } }} style={{ padding: '2px 8px', background: '#10b981', border: 'none', borderRadius: 4, color: '#fff', fontSize: 9, fontWeight: 600, cursor: 'pointer' }}>Insert</button>
          </div>
        </div>);
      }
      return <span key={i}>{p}</span>;
    });
  }

  // ── Create file/folder ──
  async function doCreateItem() {
    if (!nfName.trim() || !sock) return;
    const path = nfPath ? nfPath + '/' + nfName.trim() : nfName.trim();
    sock.emit('create-file', { path, isFolder });
    setModal(null); 
    setNfName('');
    setIsFolder(false);
    setFileBrowserPath('');
    if (!isFolder) setTimeout(() => openFile(path), 500);
  }

  // ── Get folder structure for file browser ──
  function getFolderStructure(fileList) {
    const folders = new Set();
    folders.add('');
    fileList.forEach(file => {
      const parts = file.path.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath += (currentPath ? '/' : '') + parts[i];
        folders.add(currentPath);
      }
    });
    return Array.from(folders).sort();
  }

  // ── VS Code-like file tree with expand/collapse ──
  function buildTree(fl) {
    const tree = {};
    fl.forEach(f => { 
      const p = f.path.split('/'); 
      let c = tree; 
      p.forEach((part, i) => { 
        if (i === p.length - 1) {
          c[part] = { type: 'file', path: f.path, fullPath: f.path };
        } else { 
          if (!c[part]) c[part] = { type: 'folder', children: {}, path: p.slice(0, i + 1).join('/') }; 
          c = c[part].children; 
        } 
      }); 
    });
    return tree;
  }

  function toggleFolder(folderPath) {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  }

  function renderTree(tree, depth = 0) {
    return Object.keys(tree).sort((a, b) => { 
      const af = tree[a].type === 'folder' ? 0 : 1; 
      const bf = tree[b].type === 'folder' ? 0 : 1; 
      return af !== bf ? af - bf : a.localeCompare(b); 
    }).map(k => {
      const n = tree[k];
      const paddingLeft = depth * 16 + 8;
      
      if (n.type === 'folder') {
        const isExpanded = expandedFolders.has(n.path);
        return (
          <div key={k}>
            <div 
              onClick={() => toggleFolder(n.path)} 
              style={{ 
                padding: `4px 0 4px ${paddingLeft}px`, 
                fontSize: 12, 
                color: T.t1, 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 4,
                userSelect: 'none'
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (confirm(`Delete folder "${k}" and all contents?`)) {
                  files.forEach(f => {
                    if (f.path.startsWith(n.path + '/')) {
                      deleteFile(f.path);
                    }
                  });
                }
              }}
            >
              <span style={{ fontSize: 12 }}>{isExpanded ? '📂' : '📁'}</span>
              <span style={{ flex: 1 }}>{k}</span>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setNfPath(n.path); 
                  setNfName(''); 
                  setIsFolder(false);
                  setModal('newitem'); 
                }} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: T.t2, 
                  cursor: 'pointer', 
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3
                }}
                title="New file in folder"
              >
                📄+
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  setNfPath(n.path); 
                  setNfName(''); 
                  setIsFolder(true);
                  setModal('newitem'); 
                }} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  color: T.t2, 
                  cursor: 'pointer', 
                  fontSize: 12,
                  padding: '2px 6px',
                  borderRadius: 3
                }}
                title="New folder"
              >
                📁+
              </button>
            </div>
            {isExpanded && renderTree(n.children, depth + 1)}
          </div>
        );
      }
      
      return (
        <div 
          key={k} 
          onClick={() => openFile(n.path)} 
          style={{ 
            padding: `4px 0 4px ${paddingLeft + 20}px`, 
            fontSize: 12, 
            color: aFile === n.path ? T.ac : T.t1, 
            background: aFile === n.path ? T.ac + '18' : 'transparent',
            cursor: 'pointer', 
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            margin: '0 4px'
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            if (confirm(`Delete file "${k}"?`)) {
              deleteFile(n.path);
            }
          }}
        >
          <span style={{ fontSize: 12 }}>📄</span>
          <span style={{ flex: 1 }}>{k}</span>
          <button 
            onClick={(e) => { 
              e.stopPropagation(); 
              deleteFile(n.path);
            }} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: T.t2, 
              cursor: 'pointer', 
              fontSize: 12,
              padding: '2px 6px',
              borderRadius: 3
            }}
          >
            ×
          </button>
        </div>
      );
    });
  }

  // ═══════════════════════════════════════════════════
  // PAGES
  // ═══════════════════════════════════════════════════

  if (pg === 'loading') return <div style={{ minHeight: '100vh', background: '#06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Loading...</div>;

  // ── LANDING ──
  if (pg === 'landing') return (
    <div style={{ minHeight: '100vh', background: '#06080f' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14 }}>*</div><span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>CollabEditor</span></div>
        <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setPg('signin')} style={{ padding: '8px 18px', background: 'transparent', border: '1px solid #1e293b', borderRadius: 8, color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Sign In</button><button onClick={() => setPg('signup')} style={{ padding: '8px 18px', background: '#6366f1', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Get Started</button></div>
      </div>
      <div style={{ textAlign: 'center', padding: '80px 24px', maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, color: '#f1f5f9', margin: '0 0 16px' }}>Code Together,<br /><span style={{ background: 'linear-gradient(135deg,#6366f1,#22d3ee)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Build Faster.</span></h1>
        <p style={{ fontSize: 16, color: '#94a3b8', lineHeight: 1.6, marginBottom: 32 }}>Real-time collaborative editor with voice chat, AI copilot, and VS Code interface.</p>
        <button onClick={() => setPg('signup')} style={{ padding: '14px 32px', background: '#6366f1', border: 'none', borderRadius: 10, color: '#fff', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>Start Coding Free</button>
      </div>
    </div>
  );

  // ── AUTH ──
  if (pg === 'signup' || pg === 'signin') { const isUp = pg === 'signup'; return (
    <div style={{ minHeight: '100vh', background: '#06080f', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 400, background: T.b2, borderRadius: 14, border: '1px solid ' + T.bd, padding: '36px 28px' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}><div style={{ width: 48, height: 48, margin: '0 auto 12px', borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 18 }}>*</div><h1 style={{ fontSize: 22, fontWeight: 700, color: T.t0 }}>CollabEditor</h1><p style={{ fontSize: 13, color: T.t2, marginTop: 6 }}>{isUp ? 'Create account' : 'Welcome back'}</p></div>
        {err && <div style={{ padding: '8px 12px', background: '#7f1d1d22', border: '1px solid #7f1d1d', borderRadius: 8, color: '#fca5a5', fontSize: 12, marginBottom: 14 }}>{err}</div>}
        {isUp && <div style={{ marginBottom: 14 }}><label style={lS}>Full Name</label><input value={aName} onChange={e => { setAName(e.target.value); setErr(null); }} placeholder="John Doe" style={iS} /></div>}
        <div style={{ marginBottom: 14 }}><label style={lS}>Email</label><input type="email" value={aEmail} onChange={e => { setAEmail(e.target.value); setErr(null); }} placeholder="you@email.com" style={iS} /></div>
        <div style={{ marginBottom: 20 }}><label style={lS}>Password</label><input type="password" value={aPass} onChange={e => { setAPass(e.target.value); setErr(null); }} placeholder={isUp ? 'Min 4 characters' : 'Enter password'} style={iS} /></div>
        <button onClick={isUp ? doSignup : doSignin} style={{ width: '100%', padding: 13, background: T.ac, border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{isUp ? 'Sign Up' : 'Sign In'}</button>
        <p style={{ textAlign: 'center', fontSize: 13, color: T.t2, marginTop: 16 }}>{isUp ? 'Have account? ' : 'No account? '}<span onClick={() => { setPg(isUp ? 'signin' : 'signup'); setErr(null); }} style={{ color: T.ac, cursor: 'pointer', fontWeight: 600 }}>{isUp ? 'Sign In' : 'Sign Up'}</span></p>
        <p style={{ textAlign: 'center', marginTop: 8 }}><span onClick={() => setPg('landing')} style={{ fontSize: 12, color: T.t2, cursor: 'pointer' }}>← Home</span></p>
      </div>
    </div>
  ); }

  // ── DASHBOARD ──
  if (pg === 'dashboard') {
    const filt = rooms.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.roomId.toLowerCase().includes(search.toLowerCase()));
    return (
      <div style={{ minHeight: '100vh', background: T.b0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: T.b1, borderBottom: '1px solid ' + T.bd }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#6366f1,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12 }}>*</div><span style={{ fontSize: 16, fontWeight: 700, color: T.t0 }}>CollabEditor</span></div>
          {user && <div onClick={() => setModal('settings')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', background: T.b3, border: '1px solid ' + T.bd, borderRadius: 20, cursor: 'pointer' }}><div style={{ width: 30, height: 30, borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 700 }}>{user.avatar}</div><span style={{ fontSize: 13, color: T.t0 }}>{user.name}</span><span style={{ fontSize: 10, color: T.t2 }}>▾</span></div>}
        </div>
        <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><h1 style={{ fontSize: 22, fontWeight: 700, color: T.t0 }}>Projects</h1><div style={{ display: 'flex', gap: 8 }}><button onClick={() => setModal('join')} style={{ padding: '8px 16px', background: T.b3, border: '1px solid ' + T.bd, borderRadius: 8, color: T.t0, fontSize: 12, cursor: 'pointer' }}>Join Room</button><button onClick={() => setModal('create')} style={{ padding: '8px 16px', background: T.ac, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+ New Project</button></div></div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects..." style={{ ...iS, marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid ' + T.bd }}>{['my', 'shared'].map(tab => <button key={tab} onClick={() => setDtab(tab)} style={{ padding: '8px 16px', background: 'transparent', border: 'none', borderBottom: dtab === tab ? '2px solid ' + T.ac : '2px solid transparent', color: dtab === tab ? T.t0 : T.t2, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{tab === 'my' ? `My Projects (${rooms.length})` : 'Shared with me'}</button>)}</div>
          {dtab === 'my' && filt.map(r => <div key={r.roomId} onClick={() => enter(r.roomId, r.name)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: T.b2, border: '1px solid ' + T.bd, borderRadius: 10, marginBottom: 8, cursor: 'pointer' }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 38, height: 38, borderRadius: 8, background: T.ac + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: T.ac }}>{r.name[0]}</div><div><div style={{ fontSize: 14, fontWeight: 600, color: T.t0 }}>{r.name}</div><div style={{ fontSize: 11, color: T.t2 }}>{r.roomId} {r.hasPassword && '🔒'} · {r.memberCount} members</div></div></div><div style={{ padding: '5px 12px', background: T.ac + '14', borderRadius: 6, color: T.ac, fontSize: 11, fontWeight: 600 }}>Open</div></div>)}
          {dtab === 'shared' && <div style={{ textAlign: 'center', padding: '40px', color: T.t2 }}>Projects shared with you appear here</div>}
          {dtab === 'my' && filt.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: T.t2 }}>{rooms.length === 0 ? 'No projects yet' : `No results for "${search}"`}</div>}
        </div>

        {/* Create modal */}
        {modal === 'create' && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModal(null)}><div onClick={e => e.stopPropagation()} style={{ width: 400, background: T.b2, border: '1px solid ' + T.bd, borderRadius: 12, padding: 24 }}><h3 style={{ fontSize: 16, fontWeight: 700, color: T.t0, marginBottom: 16 }}>New Project</h3><div style={{ marginBottom: 12 }}><label style={lS}>Name</label><input value={nName} onChange={e => setNName(e.target.value)} placeholder="My project" style={iS} /></div><div style={{ marginBottom: 16 }}><label style={lS}>Password (optional)</label><input type="password" value={nPass} onChange={e => setNPass(e.target.value)} style={iS} /></div><button onClick={doCreate} style={{ width: '100%', padding: 12, background: T.ac, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Create</button></div></div>}
        {/* Join modal */}
        {modal === 'join' && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModal(null)}><div onClick={e => e.stopPropagation()} style={{ width: 400, background: T.b2, border: '1px solid ' + T.bd, borderRadius: 12, padding: 24 }}><h3 style={{ fontSize: 16, fontWeight: 700, color: T.t0, marginBottom: 16 }}>Join Room</h3>{err && <div style={{ padding: 8, background: '#7f1d1d22', borderRadius: 8, color: '#fca5a5', fontSize: 12, marginBottom: 12 }}>{err}</div>}<div style={{ marginBottom: 12 }}><label style={lS}>Room ID</label><input value={jId} onChange={e => setJId(e.target.value.toUpperCase())} placeholder="A1B2C3D4" maxLength={8} style={{ ...iS, fontFamily: 'monospace', letterSpacing: 2 }} /></div><div style={{ marginBottom: 16 }}><label style={lS}>Password</label><input type="password" value={jPass} onChange={e => setJPass(e.target.value)} style={iS} /></div><button onClick={doJoin} style={{ width: '100%', padding: 12, background: T.ac, border: 'none', borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Join</button></div></div>}
        {/* Settings modal */}
        {modal === 'settings' && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModal(null)}><div onClick={e => e.stopPropagation()} style={{ width: 460, background: T.b2, border: '1px solid ' + T.bd, borderRadius: 12, padding: 24, maxHeight: '80vh', overflowY: 'auto' }}>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: T.t0, marginBottom: 20 }}>⚙️ Settings</h3>
          {user && <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, background: T.b3, borderRadius: 10, marginBottom: 16 }}><div style={{ width: 48, height: 48, borderRadius: '50%', background: user.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18, fontWeight: 700 }}>{user.avatar}</div><div><div style={{ fontSize: 15, fontWeight: 600, color: T.t0 }}>{user.name}</div><div style={{ fontSize: 12, color: T.t2 }}>{user.email}</div></div></div>}
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: T.t1, marginBottom: 8 }}>AVATAR COLOR</div><div style={{ display: 'flex', gap: 6 }}>{PALS.map(c => <div key={c} onClick={async () => { const u = await api.updateMe({ color: c }); setUser(u); }} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', border: user && user.color === c ? '3px solid #fff' : '3px solid transparent' }} />)}</div></div>
          <div style={{ marginBottom: 16 }}><div style={{ fontSize: 12, fontWeight: 700, color: T.t1, marginBottom: 8 }}>THEME</div><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>{Object.keys(TH).map(k => <button key={k} onClick={async () => { setTn(k); await api.updateMe({ theme: k }); }} style={{ padding: 12, background: TH[k].b2, border: '2px solid ' + (tn === k ? TH[k].ac : TH[k].bd), borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ display: 'flex', gap: 3 }}>{[TH[k].ac, TH[k].t0, TH[k].b0].map((c, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: c, border: '1px solid ' + TH[k].bd }} />)}</div><span style={{ fontSize: 12, fontWeight: 600, color: TH[k].t0 }}>{TH[k].nm}</span></button>)}</div></div>
          <button onClick={() => { setModal(null); doLogout(); }} style={{ width: '100%', padding: 10, background: '#ef444418', border: '1px solid #ef444444', borderRadius: 8, color: '#ef4444', fontSize: 12, fontWeight: 600, cursor: 'pointer', marginBottom: 8 }}>Logout</button>
          <button onClick={() => setModal(null)} style={{ width: '100%', padding: 10, background: T.b3, border: '1px solid ' + T.bd, borderRadius: 8, color: T.t1, fontSize: 12, cursor: 'pointer' }}>Close</button>
        </div></div>}
      </div>
    );
  }

  // ── EDITOR ──
  if (pg === 'editor') {
    const tree = buildTree(files);
    const curContent = aFile ? (contents[aFile] || '') : '';
    const vCount = inVoice ? 1 + vPeers.length : 0;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: T.b0, color: T.t0 }}>
        {/* Topbar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px', background: T.b1, borderBottom: '1px solid ' + T.bd, height: 40, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg,#6366f1,#22d3ee)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 800 }}>*</div>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{rname}</span>
            <span style={{ padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,.1)', fontSize: 10, color: '#10b981', fontWeight: 600 }}>Live</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ display: 'flex' }}>{users.slice(0, 5).map((u, i) => <div key={u.id} title={u.name} style={{ width: 24, height: 24, borderRadius: '50%', background: u.color || '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 9, fontWeight: 700, border: '2px solid ' + T.b1, marginLeft: i ? -6 : 0, zIndex: 10 - i }}>{(u.name || '?')[0]}</div>)}</div>
            <button onClick={inVoice ? leaveVoice : joinVoice} style={{ padding: '4px 10px', background: inVoice ? '#10b981' : '#374151', border: '1px solid ' + (inVoice ? '#10b981' : '#4b5563'), borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{inVoice ? '🎙 Voice ' + vCount : '🎙 Voice'}</button>
            {inVoice && <button onClick={toggleMute} style={{ padding: '4px 8px', background: vMuted ? '#ef444422' : '#10b98122', border: '1px solid ' + (vMuted ? '#ef4444' : '#10b981'), borderRadius: 6, color: vMuted ? '#ef4444' : '#10b981', fontSize: 10, cursor: 'pointer' }}>{vMuted ? 'Unmute' : 'Mute'}</button>}
            <button onClick={() => setAiOpen(!aiOpen)} style={{ padding: '4px 10px', background: aiOpen ? '#8b5cf6' : '#374151', border: '1px solid ' + (aiOpen ? '#8b5cf6' : '#4b5563'), borderRadius: 6, color: aiOpen ? '#fff' : '#d1d5db', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>AI</button>
            <button onClick={() => setModal('share')} style={{ padding: '4px 10px', background: T.ac, border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Share</button>
            <button onClick={doLeave} style={{ padding: '4px 10px', background: 'transparent', border: '1px solid ' + T.bd, borderRadius: 6, color: T.t1, fontSize: 11, cursor: 'pointer' }}>Exit</button>
          </div>
        </div>

        {/* Connected notification */}
        {showConnected && <div style={{ position: 'absolute', top: 44, right: 12, zIndex: 50, padding: '6px 14px', background: T.b2, border: '1px solid ' + T.bd, borderRadius: 8, fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 16px rgba(0,0,0,.4)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
          Connected to {rid}
          <span onClick={() => setShowConnected(false)} style={{ marginLeft: 6, cursor: 'pointer', color: T.t2 }}>×</span>
        </div>}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Activity bar */}
          <div style={{ width: 40, background: T.b1, borderRight: '1px solid ' + T.bd, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 6, gap: 4, flexShrink: 0 }}>
            {[{ id: 'files', icon: '📁' }, { id: 'people', icon: '👥' }, { id: 'activity', icon: '⚡' }].map(item => (
              <button key={item.id} onClick={() => setSidePanel(sidePanel === item.id ? null : item.id)} title={item.id} style={{ width: 32, height: 32, borderRadius: 6, background: sidePanel === item.id ? T.ac + '22' : 'transparent', border: sidePanel === item.id ? '1px solid ' + T.ac + '44' : '1px solid transparent', color: sidePanel === item.id ? T.t0 : T.t2, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</button>
            ))}
          </div>

          {/* Side panel */}
          {sidePanel && <div style={{ width: 260, background: T.b1, borderRight: '1px solid ' + T.bd, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid ' + T.bd, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: T.t2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{sidePanel === 'files' ? 'EXPLORER' : sidePanel === 'people' ? 'USERS' : 'ACTIVITY'}</span>
              {sidePanel === 'files' && (
                <button onClick={() => { setNfPath(''); setNfName(''); setIsFolder(false); setModal('newitem'); }} style={{ background: 'transparent', border: 'none', color: T.t2, cursor: 'pointer', fontSize: 14 }}>📄+</button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: sidePanel === 'files' ? '4px 0' : 6 }}>
              {sidePanel === 'files' && (
                <>
                  {renderTree(tree)}
                  {files.length === 0 && (
                    <div style={{ padding: '30px 12px', textAlign: 'center', color: T.t2, fontSize: 11 }}>
                      📂 Empty workspace<br />
                      <button onClick={() => { setNfPath(''); setNfName(''); setIsFolder(false); setModal('newitem'); }} style={{ marginTop: 8, padding: '4px 12px', background: T.ac, border: 'none', borderRadius: 4, color: '#fff', fontSize: 10, cursor: 'pointer' }}>Create File</button>
                    </div>
                  )}
                </>
              )}
              {sidePanel === 'people' && (
                <>
                  {inVoice && <div style={{ margin: '4px 2px', padding: '8px 10px', background: '#10b98115', border: '1px solid #10b98133', borderRadius: 6, marginBottom: 8 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#10b981', marginBottom: 6 }}>🎙 Voice ({vCount})</div>
                    <div style={{ fontSize: 11, color: T.t0, marginBottom: 4 }}>{user?.name} {vMuted ? '🔇' : '🎤'}</div>
                    {vPeers.map(p => <div key={p.id} style={{ fontSize: 11, color: T.t0 }}>{p.name} {p.muted ? '🔇' : '🎤'}</div>)}
                  </div>}
                  {users.map(u => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px' }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: u.color || '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700 }}>{(u.name || '?')[0].toUpperCase()}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: T.t0 }}>{u.name}</div>
                        {typing.includes(u.name) && <div style={{ fontSize: 9, color: T.ac, fontStyle: 'italic' }}>typing...</div>}
                      </div>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                    </div>
                  ))}
                </>
              )}
              {sidePanel === 'activity' && (
                <div style={{ fontSize: 11, color: T.t2, padding: 8 }}>
                  <div style={{ marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid ' + T.bd }}>📁 Room created</div>
                  {users.map(u => <div key={u.id} style={{ marginBottom: 4 }}>👤 {u.name} joined</div>)}
                  {typing.map(t => <div key={t} style={{ color: T.ac, marginBottom: 2 }}>✏️ {t} is editing...</div>)}
                </div>
              )}
            </div>
          </div>}

          {/* Editor area */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Menu bar */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', background: T.b1, borderBottom: '1px solid ' + T.bd, height: 26, flexShrink: 0 }}>
                {['File', 'Edit', 'View', 'Help'].map(menu => (
                  <button key={menu} onClick={() => { if (menu === 'File') setModal('filemenu'); }} style={{ padding: '3px 10px', background: 'transparent', border: 'none', color: T.t1, fontSize: 12, cursor: 'pointer' }}>{menu}</button>
                ))}
              </div>
              {/* Tabs */}
              <div style={{ display: 'flex', background: T.b1, borderBottom: '1px solid ' + T.bd, height: 32, overflowX: 'auto', flexShrink: 0 }}>
                {tabs.map(p => <div key={p} onClick={() => setAFile(p)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', height: '100%', borderRight: '1px solid ' + T.bd, background: aFile === p ? T.ed : T.b1, color: aFile === p ? T.t0 : T.t2, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>{p.split('/').pop()}<span onClick={e => { e.stopPropagation(); closeTab(p); }} style={{ marginLeft: 4, fontSize: 10, color: T.t2, cursor: 'pointer' }}>×</span></div>)}
              </div>
              {/* Monaco */}
              {aFile ? (
                <Editor 
                  height="100%" 
                  language={gL(aFile)} 
                  value={curContent} 
                  onChange={onEdit} 
                  theme={tn === 'light' ? 'light' : 'vs-dark'} 
                  options={{ 
                    fontSize: 14, 
                    minimap: { enabled: false }, 
                    lineNumbers: 'on', 
                    scrollBeyondLastLine: false, 
                    wordWrap: 'on', 
                    tabSize: 2, 
                    padding: { top: 12 }, 
                    fontFamily: 'Menlo, Consolas, monospace',
                    renderWhitespace: 'selection'
                  }} 
                />
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.t2, fontSize: 13 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
                    <div>No file open</div>
                    <button onClick={() => { setNfPath(''); setNfName(''); setIsFolder(false); setModal('newitem'); }} style={{ marginTop: 12, padding: '6px 14px', background: T.ac, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>Create New File</button>
                  </div>
                </div>
              )}
              {typing.length > 0 && <div style={{ padding: '4px 12px', background: T.b1, borderTop: '1px solid ' + T.bd, fontSize: 11, color: T.t2, fontStyle: 'italic' }}>{typing.join(', ')} typing...</div>}
            </div>

            {/* AI Panel */}
            {aiOpen && <div style={{ width: 300, background: T.b1, borderLeft: '1px solid ' + T.bd, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid ' + T.bd, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 20, height: 20, borderRadius: 5, background: 'linear-gradient(135deg,#8b5cf6,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8, fontWeight: 700 }}>AI</div><span style={{ fontSize: 12, fontWeight: 600, color: T.t0 }}>Copilot</span></div>
                <div style={{ display: 'flex', gap: 4 }}>{aiMsgs.length > 0 && <button onClick={() => setAiMsgs([])} style={{ background: 'transparent', border: 'none', color: T.t2, fontSize: 9, cursor: 'pointer' }}>Clear</button>}<button onClick={() => setAiOpen(false)} style={{ background: 'transparent', border: 'none', color: T.t2, cursor: 'pointer', fontSize: 14 }}>×</button></div>
              </div>
              <div style={{ padding: '6px 8px', borderBottom: '1px solid ' + T.bd, display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {[{ l: 'Explain', p: 'Explain' }, { l: 'Bugs', p: 'Find bugs' }, { l: 'Optimize', p: 'Optimize' }, { l: 'Tests', p: 'Write tests' }].map(a => <button key={a.l} onClick={() => askAI(a.l, a.p)} disabled={aiLoad} style={{ padding: '4px 8px', background: T.b3, border: '1px solid ' + T.bd, borderRadius: 6, color: T.t1, fontSize: 10, cursor: 'pointer' }}>{a.l}</button>)}
              </div>
              <div ref={aiScroll} style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
                {aiMsgs.length === 0 && <div style={{ textAlign: 'center', padding: '24px 12px', color: T.t2, fontSize: 11 }}>Ask about your code.</div>}
                {aiMsgs.map(m => <div key={m.id} style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', alignItems: m.r === 'u' ? 'flex-end' : 'flex-start' }}><div style={{ fontSize: 9, color: T.t2, marginBottom: 2 }}>{m.r === 'u' ? 'You' : 'AI'}</div><div style={{ maxWidth: '92%', padding: '7px 10px', borderRadius: 10, background: m.r === 'u' ? T.ac + '18' : T.b2, border: '1px solid ' + (m.r === 'u' ? T.ac + '30' : T.bd), fontSize: 11, color: T.t0, lineHeight: '1.5', wordBreak: 'break-word' }}>{renderAi(m.t)}</div></div>)}
                {aiLoad && <div style={{ fontSize: 10, color: T.t2, padding: 4 }}>Thinking...</div>}
              </div>
              <div style={{ padding: 8, borderTop: '1px solid ' + T.bd }}><div style={{ display: 'flex', gap: 4, background: T.b0, border: '1px solid ' + T.bd, borderRadius: 8, padding: 4 }}><input value={aiIn} onChange={e => setAiIn(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (aiIn.trim()) askAI(aiIn.trim(), null); } }} placeholder="Ask Copilot..." disabled={aiLoad} style={{ flex: 1, padding: '6px 8px', background: 'transparent', border: 'none', color: T.t0, fontSize: 12, outline: 'none' }} /><button onClick={() => { if (aiIn.trim()) askAI(aiIn.trim(), null); }} disabled={aiLoad || !aiIn.trim()} style={{ padding: '6px 12px', background: aiLoad || !aiIn.trim() ? T.b3 : '#8b5cf6', border: 'none', borderRadius: 6, color: aiLoad || !aiIn.trim() ? T.t2 : '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Send</button></div></div>
            </div>}
          </div>
        </div>

        {/* File menu dropdown */}
        {modal === 'filemenu' && <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={() => setModal(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 66, left: 46, width: 220, background: T.b2, border: '1px solid ' + T.bd, borderRadius: 8, padding: '4px 0', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}>
            {[{ l: 'New File...', fn: () => { setModal(null); setNfPath(''); setNfName(''); setIsFolder(false); setModal('newitem'); } },
              { l: 'New Folder...', fn: () => { setModal(null); setNfPath(''); setNfName(''); setIsFolder(true); setModal('newitem'); } },
              { l: 'sep' },
              { l: 'Save', k: 'Ctrl+S', fn: () => { setModal(null); if (aFile) api.saveFile(rid, aFile, contents[aFile] || ''); } },
              { l: 'sep' },
              { l: 'Share Room...', fn: () => { setModal('share'); } },
              { l: 'Exit', fn: () => { setModal(null); doLeave(); } }
            ].map((item, i) => item.l === 'sep' ? <div key={i} style={{ height: 1, background: T.bd, margin: '4px 0' }} /> :
              <button key={i} onClick={item.fn} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '7px 14px', background: 'transparent', border: 'none', color: T.t0, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}><span>{item.l}</span>{item.k && <span style={{ color: T.t2, fontSize: 10 }}>{item.k}</span>}</button>
            )}
          </div>
        </div>}

        {/* New file/folder modal with file browser */}
        {modal === 'newitem' && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModal(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width: 500, background: T.b2, border: '1px solid ' + T.bd, borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: T.t0, marginBottom: 16 }}>
                {isFolder ? 'Create New Folder' : 'Create New File'}
              </h3>
              
              {/* Location selector with file browser */}
              <div style={{ marginBottom: 16 }}>
                <label style={lS}>Location</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input 
                    readOnly 
                    value={nfPath ? '/' + nfPath + '/' : ' / '} 
                    style={{ ...iS, background: T.b3, cursor: 'pointer', flex: 1 }} 
                    onClick={() => setFileBrowserOpen(true)}
                  />
                  <button 
                    onClick={() => setFileBrowserOpen(true)} 
                    style={{ padding: '10px 16px', background: T.b3, border: '1px solid ' + T.bd, borderRadius: 8, color: T.t0, fontSize: 12, cursor: 'pointer' }}
                  >
                    Browse 📁
                  </button>
                </div>
              </div>
              
              {/* File name input */}
              <div style={{ marginBottom: 20 }}>
                <label style={lS}>{isFolder ? 'Folder Name' : 'File Name'}</label>
                <input 
                  value={nfName} 
                  onChange={e => setNfName(e.target.value)} 
                  placeholder={isFolder ? "folder-name" : "filename.js"} 
                  autoFocus 
                  onKeyDown={e => { if (e.key === 'Enter') doCreateItem(); }} 
                  style={iS} 
                />
                {!isFolder && (
                  <div style={{ fontSize: 10, color: T.t2, marginTop: 4 }}>
                    Examples: index.html, src/App.jsx, style.css, README.md
                  </div>
                )}
              </div>
              
              {/* Quick location buttons */}
              <div style={{ marginBottom: 16, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['src', 'public', 'components', 'utils', 'styles'].map(folder => (
                  <button 
                    key={folder}
                    onClick={() => setNfPath(folder)}
                    style={{ padding: '4px 10px', background: nfPath === folder ? T.ac : T.b3, border: '1px solid ' + T.bd, borderRadius: 6, color: nfPath === folder ? '#fff' : T.t1, fontSize: 11, cursor: 'pointer' }}
                  >
                    📁 {folder}/
                  </button>
                ))}
                <button onClick={() => setNfPath('')} style={{ padding: '4px 10px', background: T.b3, border: '1px solid ' + T.bd, borderRadius: 6, color: T.t1, fontSize: 11, cursor: 'pointer' }}>Root</button>
              </div>
              
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setModal(null)} style={{ flex: 1, padding: 10, background: T.b3, border: '1px solid ' + T.bd, borderRadius: 8, color: T.t1, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button onClick={doCreateItem} style={{ flex: 1, padding: 10, background: T.ac, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create</button>
              </div>
            </div>
          </div>
        )}

        {/* File Browser Modal */}
        {fileBrowserOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setFileBrowserOpen(false)}>
            <div onClick={e => e.stopPropagation()} style={{ width: 450, background: T.b2, border: '1px solid ' + T.bd, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + T.bd, background: T.b1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: T.t0, margin: 0 }}>Select Location</h3>
                <p style={{ fontSize: 12, color: T.t2, marginTop: 4 }}>Choose where to create your {isFolder ? 'folder' : 'file'}</p>
              </div>
              
              {/* Folder browser */}
              <div style={{ padding: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                <div style={{ marginBottom: 12, padding: '8px', background: T.b3, borderRadius: 8 }}>
                  <div style={{ fontSize: 11, color: T.t2, marginBottom: 4 }}>Current location:</div>
                  <div style={{ fontSize: 13, color: T.t0, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {fileBrowserPath ? '/' + fileBrowserPath + '/' : ' / (root)'}
                  </div>
                </div>
                
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Folders</div>
                  <div style={{ border: '1px solid ' + T.bd, borderRadius: 8, padding: '4px 0', background: T.b3 }}>
                    {getFolderStructure(files).length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', color: T.t2, fontSize: 12 }}>
                        No folders yet. Create one!
                      </div>
                    ) : (
                      getFolderStructure(files).map(folder => (
                        <div 
                          key={folder}
                          onClick={() => setFileBrowserPath(folder)}
                          style={{ 
                            padding: '8px 12px',
                            cursor: 'pointer',
                            background: fileBrowserPath === folder ? T.ac + '22' : 'transparent',
                            color: fileBrowserPath === folder ? T.ac : T.t0,
                            borderBottom: '1px solid ' + T.bd,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}
                        >
                          <span>📁</span>
                          <span style={{ flex: 1 }}>{folder === '' ? 'Root' : folder}</span>
                          {fileBrowserPath === folder && <span style={{ fontSize: 12 }}>✓</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                
                {/* Current folder contents preview */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Files in this folder</div>
                  <div style={{ border: '1px solid ' + T.bd, borderRadius: 8, padding: '4px 0', background: T.b3, maxHeight: '150px', overflowY: 'auto' }}>
                    {files.filter(f => {
                      const folderPath = fileBrowserPath ? fileBrowserPath + '/' : '';
                      return f.path.startsWith(folderPath) && !f.path.substring(folderPath.length).includes('/');
                    }).length === 0 ? (
                      <div style={{ padding: '15px', textAlign: 'center', color: T.t2, fontSize: 11 }}>No files in this folder</div>
                    ) : (
                      files.filter(f => {
                        const folderPath = fileBrowserPath ? fileBrowserPath + '/' : '';
                        return f.path.startsWith(folderPath) && !f.path.substring(folderPath.length).includes('/');
                      }).map(f => (
                        <div key={f.path} style={{ padding: '6px 12px', borderBottom: '1px solid ' + T.bd, fontSize: 12, color: T.t1 }}>
                          📄 {f.path.split('/').pop()}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              
              {/* Footer buttons */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid ' + T.bd, display: 'flex', gap: 8, background: T.b1 }}>
                <button onClick={() => setFileBrowserOpen(false)} style={{ flex: 1, padding: 10, background: T.b3, border: '1px solid ' + T.bd, borderRadius: 8, color: T.t1, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                <button 
                  onClick={() => {
                    setNfPath(fileBrowserPath);
                    setFileBrowserOpen(false);
                  }} 
                  style={{ flex: 1, padding: 10, background: T.ac, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  Select This Location
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Share modal */}
        {modal === 'share' && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModal(null)}><div onClick={e => e.stopPropagation()} style={{ width: 420, background: T.b2, border: '1px solid ' + T.bd, borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: T.t0, marginBottom: 16 }}>Share Room</h3>
          <div style={{ marginBottom: 12 }}><label style={lS}>Room ID</label><div style={{ display: 'flex', gap: 8 }}><input readOnly value={rid} onClick={e => e.target.select()} style={{ ...iS, fontFamily: 'monospace', letterSpacing: 2 }} /><button onClick={() => copyTxt(rid)} style={{ padding: '10px 16px', background: T.ac, border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>Copy</button></div></div>
          <div style={{ marginBottom: 14 }}><label style={lS}>Invite Link</label><input readOnly value={window.location.origin + '/room/' + rid} onClick={e => e.target.select()} style={{ ...iS, fontSize: 12 }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <button onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent('Join CollabEditor: ' + rid + '\n' + window.location.origin + '/room/' + rid), '_blank')} style={{ padding: 10, background: '#25D366', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>WhatsApp</button>
            <button onClick={() => window.open('https://t.me/share/url?url=' + encodeURIComponent(window.location.origin + '/room/' + rid), '_blank')} style={{ padding: 10, background: '#0088cc', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Telegram</button>
          </div>
          <button onClick={() => setModal(null)} style={{ width: '100%', padding: 10, background: T.b3, border: '1px solid ' + T.bd, borderRadius: 8, color: T.t1, fontSize: 12, cursor: 'pointer' }}>Close</button>
        </div></div>}

        {/* Status bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 12px', background: T.ac, height: 22, alignItems: 'center', fontSize: 11, color: '#fff', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <span>👥 {users.length} users</span>
            {inVoice && <span>🎙 {vCount}</span>}
            <span>📄 {aFile ? aFile.split('/').pop() : 'No file'}</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <span>🔤 {gL(aFile || '')}</span>
            <span>🎨 {T.nm}</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}