import { getStore } from '@netlify/blobs';
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptP = promisify(scrypt);
const store = () => getStore({ name: 'taskboard', consistency: 'strong' });
const J = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
const err = (m, s = 400) => J({ error: m }, s);
const today = () => new Date().toISOString().slice(0, 10);
const hp = async (pw, salt) => (await scryptP(pw, salt, 64)).toString('hex');
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
const pub = u => ({ id: u.id, username: u.username, name: u.name, role: u.role, active: u.active, created: u.created, mustChange: !!u.mustChange });
const UN = /^[a-z0-9_.-]{3,30}$/;
const MAX_BOARD = 4e6, SESS_MS = 30 * 864e5, MAX_SESS = 15, FAIL_MAX = 10, FAIL_WINDOW = 15 * 60e3;
const TOKEN_RE = /^(u_[a-z0-9]{1,24})\.([a-f0-9]{48})$/;

async function getUsers(st) {
  let u = await st.get('users', { type: 'json' });
  if (!u || !u.length) { // first run: default admin
    const salt = randomBytes(16).toString('hex');
    u = [{ id: 'u_admin', username: 'admin', name: 'Administrator', role: 'admin', active: true, salt, hash: await hp('admin123', salt), mustChange: true, created: today() }];
    await st.setJSON('users', u);
  }
  return u;
}
const activeAdmins = us => us.filter(u => u.role === 'admin' && u.active).length;
const sessKey = (uid, rnd) => `sess:${uid}:${rnd}`;

// Sessions are stored as sess:<userId>:<random>, so all of a user's sessions can be revoked at once.
async function revoke(st, uid, exceptKey) {
  const { blobs } = await st.list({ prefix: `sess:${uid}:` });
  await Promise.all(blobs.filter(b => b.key !== exceptKey).map(b => st.delete(b.key)));
}
async function newSession(st, uid) {
  const rnd = randomBytes(24).toString('hex');
  await st.setJSON(sessKey(uid, rnd), { id: uid, exp: Date.now() + SESS_MS });
  // housekeeping: drop expired sessions and cap how many one account can hold
  const { blobs } = await st.list({ prefix: `sess:${uid}:` });
  const rows = (await Promise.all(blobs.map(async b => ({ key: b.key, s: await st.get(b.key, { type: 'json' }) })))).filter(r => r.key !== sessKey(uid, rnd));
  const dead = rows.filter(r => !r.s || r.s.exp < Date.now());
  const live = rows.filter(r => r.s && r.s.exp >= Date.now()).sort((a, b) => a.s.exp - b.s.exp);
  const over = live.slice(0, Math.max(0, live.length + 1 - MAX_SESS));
  await Promise.all([...dead, ...over].map(r => st.delete(r.key)));
  return `${uid}.${rnd}`;
}
const okUser = u => u && typeof u.id === 'string' && /^[\w-]{1,40}$/.test(u.id) && typeof u.username === 'string' && UN.test(u.username)
  && typeof u.hash === 'string' && typeof u.salt === 'string' && (u.role === 'admin' || u.role === 'user');

export default async (req, context) => {
  const st = store();
  const path = new URL(req.url).pathname.replace(/^\/api/, '').replace(/\/$/, '');
  const m = req.method;
  let body = {};
  if (m === 'POST' || m === 'PUT') {
    const raw = await req.text();
    if (raw.trim()) { try { body = JSON.parse(raw); } catch (e) { return err('Bad JSON'); } }
    if (!body || typeof body !== 'object') return err('Bad JSON');
  }

  if (path === '/login' && m === 'POST') {
    const ip = String(context?.ip || req.headers.get('x-nf-client-connection-ip') || '').replace(/[^a-z0-9]/gi, '_');
    const fk = ip ? 'fail:' + ip : null;
    let f = fk ? await st.get(fk, { type: 'json' }) : null;
    if (f && Date.now() - f.first > FAIL_WINDOW) f = null;
    if (f && f.n >= FAIL_MAX) return err('Too many failed attempts. Please wait a few minutes and try again.', 429);
    const us = await getUsers(st);
    const un = String(body.username || '').trim().toLowerCase();
    const u = us.find(x => x.username === un);
    const pw = String(body.password || '').slice(0, 200);
    const h = await hp(pw, u ? u.salt : 'x'.repeat(32)); // equal work whether or not the user exists
    if (!u || !u.active || !same(u.hash, h)) {
      if (fk) await st.setJSON(fk, { n: (f ? f.n : 0) + 1, first: f ? f.first : Date.now() });
      await new Promise(r => setTimeout(r, 500));
      return err('Wrong username or password, or account disabled.', 401);
    }
    if (fk && f) await st.delete(fk);
    return J({ token: await newSession(st, u.id), user: pub(u) });
  }

  // ---- everything below needs a valid session ----
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '');
  const tm = TOKEN_RE.exec(token);
  const skey = tm ? sessKey(tm[1], tm[2]) : null;
  const sess = skey ? await st.get(skey, { type: 'json' }) : null;
  if (!sess || sess.id !== tm[1] || sess.exp < Date.now()) return err('Not logged in', 401);
  const us = await getUsers(st);
  const me = us.find(x => x.id === sess.id && x.active);
  if (!me) return err('Not logged in', 401);

  if (path === '/logout' && m === 'POST') { await st.delete(skey); return J({ ok: 1 }); }
  if (path === '/me' && m === 'GET') {
    const board = await st.get('board:' + me.id, { type: 'json' });
    const rev = new URL(req.url).searchParams.get('rev');
    if (board && rev !== null && Number(rev) === (board._rev || 0)) return J({ user: pub(me), unchanged: true }); // cheap poll: skip the big payload
    return J({ user: pub(me), board });
  }

  if (path === '/board' && m === 'PUT') {
    if (!Array.isArray(body.tasks)) return err('Invalid board');
    if (JSON.stringify(body).length > MAX_BOARD) return err('Board is too large (about 4 MB max). Erase old completed or trashed tasks.', 413);
    const cur = await st.get('board:' + me.id, { type: 'json' });
    if (cur && (cur._rev || 0) !== (body._rev || 0)) return J({ error: 'This board was changed on another device.', board: cur }, 409);
    const rev = ((cur && cur._rev) || 0) + 1;
    body._rev = rev;
    await st.setJSON('board:' + me.id, body);
    return J({ ok: 1, rev });
  }

  if (path === '/password' && m === 'POST') {
    const cur = String(body.current || ''), nw = String(body.password || '');
    if (!same(me.hash, await hp(cur, me.salt))) return err('Current password is wrong.', 403);
    if (nw.length < 6 || nw.length > 200) return err('New password must be 6–200 characters.');
    if (nw === cur) return err('Choose a password different from the current one.');
    const u = us.find(x => x.id === me.id);
    u.salt = randomBytes(16).toString('hex'); u.hash = await hp(nw, u.salt); delete u.mustChange;
    await st.setJSON('users', us);
    await revoke(st, me.id, skey); // sign out every other device
    return J({ ok: 1 });
  }

  // ---- admin only ----
  if (me.role !== 'admin') return err('Admins only', 403);

  if (path === '/users' && m === 'GET') return J({ users: us.map(pub) });
  if (path === '/users' && m === 'POST') {
    const un = String(body.username || '').trim().toLowerCase();
    if (!UN.test(un)) return err('Username: 3–30 letters, numbers, . _ -');
    if (us.some(x => x.username === un)) return err('Username already exists.');
    const pw = String(body.password || '');
    if (pw.length < 6 || pw.length > 200) return err('Password must be 6–200 characters.');
    const salt = randomBytes(16).toString('hex');
    us.push({ id: 'u_' + randomBytes(6).toString('hex'), username: un, name: String(body.name || '').trim().slice(0, 60) || un, role: body.role === 'admin' ? 'admin' : 'user', active: body.active !== false, salt, hash: await hp(pw, salt), created: today() });
    await st.setJSON('users', us); return J({ ok: 1 });
  }
  const um = path.match(/^\/users\/([\w-]+)$/);
  if (um) {
    const u = us.find(x => x.id === um[1]);
    if (!u) return err('User not found', 404);
    if (m === 'PUT') {
      const role = body.role === 'admin' ? 'admin' : 'user', active = body.active !== false;
      if (u.role === 'admin' && u.active && (role !== 'admin' || !active) && activeAdmins(us) < 2) return err('Keep at least one active admin.');
      if (u.id === me.id && !active) return err("You can't disable your own account.");
      if (u.id === me.id && role !== 'admin') return err("You can't remove your own admin role.");
      u.name = String(body.name || '').trim().slice(0, 60) || u.username; u.role = role; u.active = active;
      let kill = !active;
      if (body.password) {
        const pw = String(body.password);
        if (pw.length < 6 || pw.length > 200) return err('Password must be 6–200 characters.');
        u.salt = randomBytes(16).toString('hex'); u.hash = await hp(pw, u.salt); delete u.mustChange; kill = true;
      }
      await st.setJSON('users', us);
      if (kill) await revoke(st, u.id, u.id === me.id ? skey : null);
      return J({ ok: 1 });
    }
    if (m === 'DELETE') {
      if (u.id === me.id) return err("You can't delete your own account.");
      if (u.role === 'admin' && u.active && activeAdmins(us) < 2) return err('Keep at least one active admin.');
      await st.setJSON('users', us.filter(x => x.id !== u.id)); await st.delete('board:' + u.id); await revoke(st, u.id, null);
      return J({ ok: 1 });
    }
  }
  if (path === '/backup' && m === 'GET') {
    const boards = {};
    await Promise.all(us.map(async u => { const b = await st.get('board:' + u.id, { type: 'json' }); if (b) boards[u.id] = b; }));
    return J({ version: 3, exportedAt: new Date().toISOString(), users: us, boards });
  }
  if (path === '/backup' && m === 'POST') {
    const nu = body.users;
    if (body.version !== 3 || !Array.isArray(nu) || !nu.every(okUser) || new Set(nu.map(u => u.id)).size !== nu.length
      || new Set(nu.map(u => u.username)).size !== nu.length || !nu.some(u => u.role === 'admin' && u.active !== false)) return err('Invalid backup file');
    const boards = body.boards && typeof body.boards === 'object' ? body.boards : {};
    for (const [id, b] of Object.entries(boards)) if (!nu.some(u => u.id === id) || !b || !Array.isArray(b.tasks)) return err('Invalid backup file (boards)');
    for (const u of us) await st.delete('board:' + u.id);
    await st.setJSON('users', nu.map(u => ({ ...u, active: u.active !== false })));
    for (const [id, b] of Object.entries(boards)) await st.setJSON('board:' + id, b);
    // sign out anyone who no longer exists
    const ids = new Set(nu.map(u => u.id));
    const { blobs } = await st.list({ prefix: 'sess:' });
    await Promise.all(blobs.filter(b => !ids.has(b.key.split(':')[1])).map(b => st.delete(b.key)));
    return J({ ok: 1 });
  }
  return err('Not found', 404);
};

export const config = { path: '/api/*' };
