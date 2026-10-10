import { randomBytes, scrypt as deriveKey, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { assert } from './errors.js';
import { object } from './validation.js';

const scrypt = promisify(deriveKey);
const digest = (text) => createHash('sha256').update(text).digest('hex');
const sessionLifetime = 30 * 24 * 60 * 60 * 1000;

async function hash(secret) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(secret, salt, 64);
  return `${salt}:${key.toString('hex')}`;
}

async function verify(secret, encoded) {
  if (typeof secret !== 'string' || secret.length > 1024 || !encoded) return false;
  const [salt, saved] = encoded.split(':');
  const key = await scrypt(secret, salt, 64);
  const expected = Buffer.from(saved, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

function password(value) {
  assert(typeof value === 'string' && value.length >= 8 && value.length <= 1024, 400, 'Password must be 8–1024 characters');
  return value;
}

function email(value) {
  assert(typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()), 400, 'Invalid email');
  return value.trim().toLowerCase();
}

export class Auth {
  constructor(store) { this.store = store; this.attempts = new Map(); }

  needsSetup() {
    return this.store.db.prepare('SELECT COUNT(*) AS count FROM credentials').get().count === 0;
  }

  token(req, url, allowQuery = false) {
    const authorization = req.headers.authorization;
    if (authorization) {
      assert(/^Bearer [a-zA-Z0-9_-]+$/.test(authorization), 401, 'Invalid authorization');
      return authorization.slice(7);
    }
    const cookies = (req.headers.cookie || '').split(';').map((part) => part.trim());
    const session = cookies.find((part) => part.startsWith('local_session='));
    if (session) return session.slice('local_session='.length);
    return allowQuery ? url.searchParams.get('token') : null;
  }

  current(token) {
    if (!token || token.length > 256) return null;
    const session = this.store.db.prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?').get(digest(token));
    if (!session || session.expires_at <= Date.now()) return null;
    return this.store.get('User', session.user_id);
  }

  require(token) {
    const user = this.current(token);
    assert(user, 401, 'Authentication required', 'AUTH_REQUIRED');
    return user;
  }

  session(user) {
    const access_token = randomBytes(32).toString('base64url');
    this.store.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    this.store.db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(digest(access_token), user.id, Date.now() + sessionLifetime);
    return { user, access_token };
  }

  cookie(token) {
    return `local_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? sessionLifetime / 1000 : 0}`;
  }

  throttle(key) {
    const now = Date.now();
    const entry = this.attempts.get(key);
    if (!entry || entry.until < now) this.attempts.set(key, { count: 1, until: now + 60_000 });
    else { assert(entry.count < 10, 429, 'Too many authentication attempts; try again shortly'); entry.count++; }
    if (this.attempts.size > 1000) for (const [k, v] of this.attempts) if (v.until < now) this.attempts.delete(k);
  }

  async register(body, requester) {
    object(body);
    assert(this.needsSetup() || requester?.role === 'admin', requester ? 403 : 401, 'Only an administrator can register additional users');
    const address = email(body.email);
    const encoded = await hash(password(body.password));
    const recovery_key = randomBytes(32).toString('base64url');
    const recoveryHash = await hash(recovery_key);
    const user = this.store.transaction(() => {
      const first = this.needsSetup();
      assert(first || requester?.role === 'admin', 403, 'Only an administrator can register additional users');
      assert(!this.store.db.prepare('SELECT user_id FROM credentials WHERE email = ?').get(address), 409, 'Account already exists');
      const role = first ? 'admin' : body.role || 'user';
      assert(['admin', 'user'].includes(role), 400, 'Invalid role');
      assert(body.full_name === undefined || (typeof body.full_name === 'string' && body.full_name.length <= 200), 400, 'Invalid full name');
      const created = this.store.create('User', { email: address, full_name: body.full_name || address.split('@')[0], role }, requester || { email: address });
      this.store.db.prepare('INSERT INTO credentials(user_id,email,password_hash,recovery_hash) VALUES (?,?,?,?)').run(created.id, address, encoded, recoveryHash);
      return created;
    });
    return { ...this.session(user), recovery_key };
  }

  async login(body) {
    object(body);
    const address = email(body.email);
    const row = this.store.db.prepare('SELECT user_id,password_hash FROM credentials WHERE email = ?').get(address);
    const valid = await verify(body.password, row?.password_hash || '00000000000000000000000000000000:' + '00'.repeat(64));
    assert(row && valid, 401, 'Invalid email or password');
    const user = this.store.get('User', row.user_id);
    assert(user, 401, 'Invalid email or password');
    return this.session(user);
  }

  logout(token) {
    if (token) this.store.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(digest(token));
    return { ok: true };
  }

  async reset(body) {
    object(body);
    const address = email(body.email);
    password(body.newPassword ?? body.new_password);
    const row = this.store.db.prepare('SELECT user_id,recovery_hash FROM credentials WHERE email = ?').get(address);
    const valid = await verify(body.recovery_key, row?.recovery_hash || '00000000000000000000000000000000:' + '00'.repeat(64));
    assert(row && valid, 401, 'Invalid email or recovery key');
    const encoded = await hash(body.newPassword ?? body.new_password);
    this.store.transaction(() => {
      this.store.db.prepare('UPDATE credentials SET password_hash = ? WHERE user_id = ?').run(encoded, row.user_id);
      this.store.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id);
    });
    return { ok: true };
  }

  async change(body, user) {
    object(body);
    password(body.newPassword ?? body.new_password);
    const row = this.store.db.prepare('SELECT password_hash FROM credentials WHERE user_id = ?').get(user.id);
    assert(row && await verify(body.currentPassword ?? body.current_password, row.password_hash), 401, 'Invalid current password');
    const encoded = await hash(body.newPassword ?? body.new_password);
    this.store.transaction(() => {
      this.store.db.prepare('UPDATE credentials SET password_hash = ? WHERE user_id = ?').run(encoded, user.id);
      this.store.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    });
    return { ok: true };
  }
}
