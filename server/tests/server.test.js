import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer, request as httpRequest } from 'node:http';
import { mkdirSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { startServer } from '../index.js';
import { parseCsv } from '../integrations.js';
import { Store } from '../store.js';

async function fixture(t, options = {}) {
  const dataDir = resolve(`.server-test-${randomUUID()}`);
  mkdirSync(dataDir, { mode: 0o700 });
  let server = await startServer({ dataDir, aiBaseUrl: 'http://127.0.0.1:1', ...options });
  t.after(async () => { await server.close(); rmSync(dataDir, { recursive: true, force: true }); });
  const request = async (path, { method = 'GET', body, token, headers = {}, ...other } = {}) => {
    const response = await fetch(server.url + path, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...other
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: response.status, data, headers: response.headers };
  };
  const register = await request('/api/auth/register', { method: 'POST', body: { email: 'admin@example.test', password: 'correct-password', full_name: 'Admin' } });
  assert.equal(register.status, 201, JSON.stringify(register.data));
  const token = register.data.access_token;
  return {
    dataDir, request, token, register: register.data, cookie: register.headers.get('set-cookie').split(';')[0],
    get server() { return server; },
    restart: async () => { await server.close(); server = await startServer({ dataDir, aiBaseUrl: 'http://127.0.0.1:1', ...options }); },
    call: (name, body = {}, authToken = token) => request(`/api/functions/${name}`, { method: 'POST', body, token: authToken }),
    create: async (name, body) => {
      const response = await request(`/api/entities/${name}`, { method: 'POST', body, token });
      assert.equal(response.status, 201, JSON.stringify(response.data));
      return response.data;
    },
    upload: async (name, data) => {
      const form = new FormData();
      form.append('file', new Blob([data]), name);
      const response = await fetch(server.url + '/api/files', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      assert.equal(response.status, 201, await response.clone().text());
      return response.json();
    }
  };
}

test('health and setup are minimal; all data and functions require authentication', async (t) => {
  const app = await fixture(t);
  assert.deepEqual((await app.request('/api/health')).data, { ok: true });
  assert.deepEqual((await app.request('/api/auth/setup')).data, { needs_setup: false });
  for (const path of ['/api/auth/me', '/api/entities/Entity', '/api/status', '/api/backup']) {
    assert.equal((await app.request(path)).status, 401);
  }
  for (const name of app.server.functionNames) {
    assert.equal((await app.request(`/api/functions/${name}`, { method: 'POST', body: {} })).status, 401);
  }
  assert.equal(app.server.functionNames.length, 17);
  assert.equal((await app.request('/api/functions/notRegistered', { method: 'POST', body: {}, token: app.token })).status, 404);
});

test('scrypt credentials stay private; bearer/cookie sessions persist and logout is isolated', async (t) => {
  const app = await fixture(t);
  assert.equal(app.register.user.role, 'admin');
  assert.equal(typeof app.register.recovery_key, 'string');
  assert.match(app.cookie, /^local_session=/);
  const me = await app.request('/api/auth/me', { token: app.token });
  assert.equal(me.data.email, 'admin@example.test');
  assert.equal(Object.hasOwn(me.data, 'password_hash'), false);
  const login = await app.request('/api/auth/login', { method: 'POST', body: { email: 'ADMIN@example.test', password: 'correct-password' } });
  assert.equal(login.status, 200);
  assert.notEqual(login.data.access_token, app.token);
  await app.restart();
  assert.equal((await app.request('/api/auth/me', { token: app.token })).status, 200);
  assert.equal((await app.request('/api/auth/me', { headers: { Cookie: app.cookie } })).status, 200);
  await app.request('/api/auth/logout', { method: 'POST', token: app.token });
  assert.equal((await app.request('/api/auth/me', { token: app.token })).status, 401);
  assert.equal((await app.request('/api/auth/me', { token: login.data.access_token })).status, 200);
  assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'incorrect' } })).status, 401);
  const bytes = readFileSync(join(app.dataDir, 'analytics.sqlite')).toString('latin1');
  assert.equal(bytes.includes('correct-password'), false);
  assert.equal(bytes.includes(app.token), false);
});

test('only first account registration is public; users cannot escalate or access another user', async (t) => {
  const app = await fixture(t);
  const body = { email: 'user@example.test', password: 'another-password' };
  assert.equal((await app.request('/api/auth/register', { method: 'POST', body })).status, 401);
  const user = await app.request('/api/auth/register', { method: 'POST', body, token: app.token });
  assert.equal(user.status, 201);
  assert.equal(user.data.user.role, 'user');
  const token = user.data.access_token;
  assert.equal((await app.request('/api/auth/register', { method: 'POST', token, body: { ...body, email: 'third@example.test' } })).status, 403);
  assert.equal((await app.request(`/api/entities/User/${app.register.user.id}`, { token })).status, 403);
  assert.equal((await app.request('/api/entities/User', { token })).data.length, 1);
  assert.equal((await app.request(`/api/entities/User/${user.data.user.id}`, { method: 'PUT', token, body: { role: 'admin' } })).status, 403);
  assert.equal((await app.request('/api/entities/User', { method: 'POST', token: app.token, body: { email: 'forged@example.test', role: 'admin' } })).status, 403);
  assert.equal((await app.request('/api/backup', { token })).status, 403);
  assert.equal((await app.request('/api/backup', { method: 'POST', body: {}, token })).status, 403);
});

test('password changes and recovery reset revoke all sessions without exposing credentials', async (t) => {
  const app = await fixture(t);
  const second = await app.request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'correct-password' } });
  assert.equal((await app.request('/api/auth/change-password', { method: 'POST', token: app.token, body: { currentPassword: 'bad-password', newPassword: 'new-password' } })).status, 401);
  assert.equal((await app.request('/api/auth/change-password', { method: 'POST', token: app.token, body: { currentPassword: 'correct-password', newPassword: 'new-password' } })).status, 200);
  assert.equal((await app.request('/api/auth/me', { token: second.data.access_token })).status, 401);
  assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'correct-password' } })).status, 401);
  assert.equal((await app.request('/api/auth/reset-password', { method: 'POST', body: { email: 'admin@example.test', recovery_key: 'bad', newPassword: 'recovered-password' } })).status, 401);
  assert.equal((await app.request('/api/auth/reset-password', { method: 'POST', body: { email: 'admin@example.test', recovery_key: app.register.recovery_key, newPassword: 'recovered-password' } })).status, 200);
  assert.equal((await app.request('/api/auth/login', { method: 'POST', body: { email: 'admin@example.test', password: 'recovered-password' } })).status, 200);
});

test('CRUD persists schema defaults, immutable metadata, filter operators, sorting and batches', async (t) => {
  const app = await fixture(t);
  const first = await app.create('Entity', { name: 'Alpha', type: 'person', mention_count: 2, aliases: ['A'] });
  const second = await app.create('Entity', { name: 'Beta', type: 'organization', mention_count: 5 });
  assert.equal(first.created_by, 'admin@example.test');
  assert.equal(first.watchlist, false);
  const path = '/api/entities/Entity?filter=' + encodeURIComponent(JSON.stringify({ $and: [{ mention_count: { $gte: 2 } }, { name: { $ne: 'Nobody' } }] })) + '&sort=-mention_count&limit=1';
  assert.equal((await app.request(path, { token: app.token })).data[0].id, second.id);
  assert.equal((await app.request('/api/entities/Entity?filter=' + encodeURIComponent(JSON.stringify({ aliases: { $contains: 'A' } })), { token: app.token })).data[0].id, first.id);
  assert.equal((await app.request('/api/entities/Entity?filter=' + encodeURIComponent(JSON.stringify({ id: { $in: [first.id] } })), { token: app.token })).data.length, 1);
  const update = await app.request(`/api/entities/Entity/${first.id}`, { method: 'PUT', token: app.token, body: { risk_score: 90, id: second.id, created_by: 'forged', created_date: '2000-01-01' } });
  assert.equal(update.data.id, first.id);
  assert.equal(update.data.created_by, first.created_by);
  assert.equal(update.data.created_date, first.created_date);
  const bulk = await app.request('/api/entities/Entity/bulk', { method: 'POST', token: app.token, body: [{ name: 'Gamma', type: 'person' }, { name: 'Delta', type: 'person' }] });
  assert.equal(bulk.status, 201);
  const changed = await app.request('/api/entities/Entity/bulk-update', { method: 'POST', token: app.token, body: bulk.data.map((r) => ({ id: r.id, risk_score: 50 })) });
  assert.equal(changed.status, 200);
  assert.ok(changed.data.every((r) => r.risk_score === 50));
  const invalid = await app.request('/api/entities/Entity/bulk', { method: 'POST', token: app.token, body: [{ name: 'Should roll back', type: 'person' }, { name: 'Bad', type: 'not-a-type' }] });
  assert.equal(invalid.status, 422);
  assert.equal((await app.request('/api/entities/Entity', { token: app.token })).data.length, 4);
  await app.restart();
  assert.equal((await app.request(`/api/entities/Entity/${first.id}`, { token: app.token })).data.risk_score, 90);
  assert.equal((await app.request(`/api/entities/Entity/${first.id}`, { method: 'DELETE', token: app.token })).status, 200);
  assert.equal((await app.request(`/api/entities/Entity/${first.id}`, { token: app.token })).status, 404);
});

test('allowlists, origin checks, IDs, schema and request limits reject unsafe requests', async (t) => {
  const app = await fixture(t);
  assert.equal((await app.request('/api/entities/NotAnEntity', { token: app.token })).status, 404);
  assert.equal((await app.request('/api/entities/Entity', { method: 'POST', token: app.token, body: { name: 'No', type: 'person' }, headers: { Origin: 'https://untrusted.example' } })).status, 403);
  assert.equal((await app.request('/api/entities/Entity', { method: 'POST', token: app.token, body: { name: 'Yes', type: 'person' }, headers: { Origin: app.server.url } })).status, 201);
  assert.equal((await app.request('/api/entities/Entity/a%2Fb', { token: app.token })).status, 400);
  assert.equal((await app.request('/api/entities/Entity?filter=' + encodeURIComponent(JSON.stringify({ name: { $regex: '.*' } })), { token: app.token })).status, 400);
  assert.equal((await app.request('/api/entities/Entity?limit=10001', { token: app.token })).status, 400);
  assert.equal((await app.request('/api/entities/Entity', { method: 'POST', token: app.token, body: { type: 'person' } })).status, 422);
  assert.equal((await app.request('/api/entities/Entity', { method: 'POST', token: app.token, body: { name: 'Huge', type: 'person', extra: 'a'.repeat(2 * 1024 * 1024) } })).status, 413);
  const hostStatus = await new Promise((done, reject) => {
    const req = httpRequest(app.server.url + '/api/health', { headers: { Host: 'evil.example' } }, (res) => {
      res.resume();
      res.on('end', () => done(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
  assert.equal(hostStatus, 403);
});

test('files are private, stable, cookie-accessible and cannot reach arbitrary disk or outbound URLs', async (t) => {
  const app = await fixture(t);
  const file = await app.upload('notes.txt', 'Local notes');
  assert.match(file.file_url, /^\/files\/[a-f0-9-]+\.txt$/);
  assert.equal(file.file_url.includes('token='), false);
  assert.equal((await app.request(file.file_url)).status, 401);
  assert.equal((await app.request(file.file_url, { token: app.token })).data, 'Local notes');
  assert.equal((await app.request(file.file_url, { headers: { Cookie: app.cookie } })).status, 200);
  assert.equal((await app.request(file.file_url + '?token=' + app.token)).status, 200);
  await app.restart();
  assert.equal((await app.request(file.file_url, { headers: { Cookie: app.cookie } })).data, 'Local notes');
  assert.equal((await app.request('/files/analytics.sqlite', { token: app.token })).status, 400);
  const remote = await app.request('/api/integrations/Core/ExtractDataFromUploadedFile', { method: 'POST', token: app.token, body: { file_url: 'https://example.com/data.pdf' } });
  assert.equal(remote.status, 400);
  assert.equal((await app.request('/api/integrations/Core/SendEmail', { method: 'POST', token: app.token, body: { to: 'external@example.com' } })).status, 501);
});

test('local CSV handles BOM, quotes and newlines, imports entities and relationships without AI', async (t) => {
  assert.deepEqual(parseCsv('\uFEFFname,note\r\n"Alpha","a,b"\r\n"Beta","a\nb"\r\n'), [{ name: 'Alpha', note: 'a,b' }, { name: 'Beta', note: 'a\nb' }]);
  assert.throws(() => parseCsv('name,note\n"oops,x'), /Unclosed/);
  const app = await fixture(t);
  const file = await app.upload('entities.csv', 'name,type,source,target,relationship\nAlpha,person,Alpha,Beta,knows\nBeta,person,Alpha,Beta,knows\n');
  const result = await app.call('importCsv', { file_url: file.file_url, title: 'CSV import' });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.entity_count, 2);
  assert.equal(result.data.connection_count, 2);
  const doc = (await app.request(`/api/entities/Document/${result.data.document_id}`, { token: app.token })).data;
  assert.equal(doc.status, 'processed');
  const txt = await app.upload('raw.txt', 'Plain text offline');
  const extracted = await app.request('/api/integrations/Core/ExtractDataFromUploadedFile', { method: 'POST', token: app.token, body: { file_url: txt.file_url, json_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } });
  assert.equal(extracted.data.output.text, 'Plain text offline');
});

test('AI failure is explicit, has no cloud fallback and preserves previously extracted records', async (t) => {
  const app = await fixture(t);
  const status = await app.request('/api/status', { token: app.token });
  assert.equal(status.data.ai.state, 'unavailable');
  const llm = await app.request('/api/integrations/Core/InvokeLLM', { method: 'POST', token: app.token, body: { prompt: 'test' } });
  assert.equal(llm.status, 503);
  assert.equal(llm.data.code, 'AI_UNAVAILABLE');
  const doc = await app.create('Document', { title: 'Prior result', raw_text: 'Some text', status: 'processed' });
  await app.create('Mention', { entity_id: 'prior-entity', entity_name: 'Prior', document_id: doc.id });
  const result = await app.call('processDocument', { document_id: doc.id });
  assert.equal(result.status, 503);
  assert.equal((await app.request(`/api/entities/Document/${doc.id}`, { token: app.token })).data.status, 'failed');
  assert.equal((await app.request('/api/entities/Mention', { token: app.token })).data.length, 1);
  assert.equal((await app.call('crossLingualSearch', { query: 'Alpha' })).status, 503);
  assert.equal((await app.call('extractManifestFromText', { text: 'test manifest' })).status, 503);
  await app.create('Entity', { name: 'London', type: 'location' });
  assert.equal((await app.call('geocodeLocations')).status, 503);
});

function sample(schema) {
  if (schema.enum) return schema.enum[0];
  if (schema.type === 'object') return Object.fromEntries(Object.entries(schema.properties || {}).map(([name, child]) => [name, sample(child)]));
  if (schema.type === 'array') return [];
  if (schema.type === 'number' || schema.type === 'integer') return 1;
  if (schema.type === 'boolean') return false;
  return 'Local result';
}

async function fakeAI(t, completion = (schema) => sample(schema), { delayMs = 0, loadingHealthChecks = 0, connectionFailures = 0 } = {}) {
  let healthChecks = 0;
  const server = createServer(async (req, res) => {
    if (req.url === '/health') {
      const currentCheck = healthChecks++;
      if (currentCheck < connectionFailures) {
        req.socket.destroy();
        return;
      }
      const loading = currentCheck < connectionFailures + loadingHealthChecks;
      res.writeHead(loading ? 503 : 200);
      res.end(JSON.stringify({ status: loading ? 'loading' : 'ok' }));
      return;
    }
    assert.equal(req.url, '/v1/chat/completions');
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const content = completion(body.response_format?.json_schema?.schema, body);
    if (delayMs) await new Promise((done) => setTimeout(done, delayMs));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }] }));
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  t.after(() => new Promise((done) => server.close(done)));
  return `http://127.0.0.1:${server.address().port}`;
}

test('every ported function executes against local SQLite and local compatible AI', async (t) => {
  const aiBaseUrl = await fakeAI(t);
  const app = await fixture(t, { aiBaseUrl });
  const alpha = await app.create('Entity', { name: 'Alpha', type: 'person', mention_count: 2 });
  const beta = await app.create('Entity', { name: 'Beta', type: 'person', mention_count: 1 });
  await app.create('Connection', { source_entity_id: alpha.id, target_entity_id: beta.id, relationship_type: 'knows' });
  const doc = await app.create('Document', { title: 'Alpha report', raw_text: 'Alpha met Beta in 2024.', status: 'pending' });
  const manifest = await app.create('Manifest', { carrier: 'Local carrier', voyage_number: 'L1', passengers: [{ name: 'Alpha' }] });
  for (let i = 0; i < 100 && (await app.request('/api/status', { token: app.token })).data.workflows.pending; i++) await new Promise((done) => setTimeout(done, 10));
  const csv = await app.upload('sample.csv', 'name,type\nCsvPerson,person\n');
  const payloads = {
    buildGraphIndex: {}, crossLingualSearch: { query: 'Alpha' }, extractManifestFromText: { text: 'Passenger manifest Local carrier L1.' },
    findEntityPath: { source_id: alpha.id, target_id: beta.id }, fuzzySearch: { query: 'Alpha' },
    geocodeLocations: {}, importCsv: { file_url: csv.file_url }, importWatchlist: { names: ['Alpha'] },
    mergeEntities: { primary_id: alpha.id, duplicate_id: beta.id }, processDocument: { document_id: doc.id },
    processManifest: { manifest_id: manifest.id }, runCepAlerts: {}, runFusion: {}, screenManifest: { manifest_id: manifest.id }
  };
  for (const [name, body] of Object.entries(payloads)) {
    const response = await app.call(name, body);
    assert.equal(response.status, 200, `${name}: ${JSON.stringify(response.data)}`);
  }
  assert.equal((await app.request('/api/status', { token: app.token })).data.ai.available, true);
  const notifications = (await app.request('/api/entities/Notification', { token: app.token })).data;
  assert.ok(notifications.length > 0);
  const screening = await app.call('screenManifest', { manifest_id: manifest.id });
  assert.equal(screening.data.email_sent, 0);
  assert.equal(screening.data.notifications_sent, 0);
});

test('duplicate review scans matching aliases and merge undo restores IDs and references', async (t) => {
  const app = await fixture(t);
  const primary = await app.create('Entity', { name: 'Nora Hassan', type: 'person', aliases: ['Nora H.'], mention_count: 2 });
  const duplicate = await app.create('Entity', { name: 'N. Hassan', type: 'person', aliases: ['Nora H.'], mention_count: 1 });
  const other = await app.create('Entity', { name: 'Harbor Group', type: 'organization' });
  const doc = await app.create('Document', { title: 'Source note' });
  const connection = await app.create('Connection', {
    source_entity_id: duplicate.id, target_entity_id: other.id,
    source_entity_name: duplicate.name, target_entity_name: other.name,
    relationship_type: 'met', document_id: doc.id
  });
  const mention = await app.create('Mention', {
    entity_id: duplicate.id, entity_name: duplicate.name, document_id: doc.id, document_title: doc.title, context: 'Nora H.'
  });
  const workspace = await app.create('Workspace', { name: 'Review workspace', entity_ids: [duplicate.id] });
  const alert = await app.create('Alert', { title: 'Review alert', severity: 'high', entity_ids: [duplicate.id], entity_names: [duplicate.name] });
  const notification = await app.create('Notification', { title: 'Review notification', entity_id: duplicate.id, entity_name: duplicate.name });

  const scan = await app.call('scanDuplicates');
  assert.equal(scan.status, 200, JSON.stringify(scan.data));
  assert.equal(scan.data.added, 1);
  const review = (await app.request('/api/entities/DuplicateReview', { token: app.token })).data[0];
  assert.deepEqual(new Set([review.left_id, review.right_id]), new Set([primary.id, duplicate.id]));

  const merged = await app.call('mergeEntities', {
    primary_id: primary.id, duplicate_id: duplicate.id, review_id: review.id
  });
  assert.equal(merged.status, 200, JSON.stringify(merged.data));
  assert.equal((await app.request(`/api/entities/Entity/${duplicate.id}`, { token: app.token })).status, 404);
  assert.equal((await app.request(`/api/entities/DuplicateReview/${review.id}`, { token: app.token })).data.status, 'merged');
  assert.deepEqual((await app.request(`/api/entities/Workspace/${workspace.id}`, { token: app.token })).data.entity_ids, [primary.id]);
  assert.deepEqual((await app.request(`/api/entities/Alert/${alert.id}`, { token: app.token })).data.entity_ids, [primary.id]);
  assert.equal((await app.request(`/api/entities/Notification/${notification.id}`, { token: app.token })).data.entity_id, primary.id);

  const undone = await app.call('undoMerge', { merge_history_id: merged.data.merge_history_id });
  assert.equal(undone.status, 200, JSON.stringify(undone.data));
  assert.equal((await app.request(`/api/entities/Entity/${duplicate.id}`, { token: app.token })).data.name, duplicate.name);
  assert.equal((await app.request(`/api/entities/Connection/${connection.id}`, { token: app.token })).data.source_entity_id, duplicate.id);
  assert.equal((await app.request(`/api/entities/Mention/${mention.id}`, { token: app.token })).data.entity_id, duplicate.id);
  assert.deepEqual((await app.request(`/api/entities/Workspace/${workspace.id}`, { token: app.token })).data.entity_ids, [duplicate.id]);
  assert.deepEqual((await app.request(`/api/entities/Alert/${alert.id}`, { token: app.token })).data.entity_ids, [duplicate.id]);
  assert.equal((await app.request(`/api/entities/Notification/${notification.id}`, { token: app.token })).data.entity_id, duplicate.id);
  assert.equal((await app.request(`/api/entities/DuplicateReview/${review.id}`, { token: app.token })).data.status, 'pending');
});

test('merge undo refuses to overwrite a primary entity changed after merge', async (t) => {
  const app = await fixture(t);
  const primary = await app.create('Entity', { name: 'Same Person', type: 'person' });
  const duplicate = await app.create('Entity', { name: 'Same Person Alias', type: 'person' });
  const merged = await app.call('mergeEntities', { primary_id: primary.id, duplicate_id: duplicate.id });
  assert.equal(merged.status, 200, JSON.stringify(merged.data));
  await app.request(`/api/entities/Entity/${primary.id}`, { method: 'PUT', token: app.token, body: { notes: 'Reviewed after merge' } });
  const undone = await app.call('undoMerge', { merge_history_id: merged.data.merge_history_id });
  assert.equal(undone.status, 409);
  assert.equal((await app.request(`/api/entities/Entity/${duplicate.id}`, { token: app.token })).status, 404);
});

test('LLM requests wait while the local model server reports loading', async (t) => {
  const aiBaseUrl = await fakeAI(t, () => ({ ready: true }), { loadingHealthChecks: 2 });
  const app = await fixture(t, { aiBaseUrl });
  const starting = await app.request('/api/status', { token: app.token });
  assert.equal(starting.data.ai.state, 'loading');
  assert.equal(starting.data.ai.available, false);
  const result = await app.request('/api/integrations/Core/InvokeLLM', {
    method: 'POST', token: app.token, body: {
      prompt: 'Wait for local model startup',
      response_json_schema: { type: 'object', properties: { ready: { type: 'boolean' } }, required: ['ready'] }
    }
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.deepEqual(result.data, { ready: true });
  assert.equal((await app.request('/api/status', { token: app.token })).data.ai.state, 'ready');
});

test('LLM requests retry connection failures while the local model server starts', async (t) => {
  const aiBaseUrl = await fakeAI(t, () => ({ ready: true }), { connectionFailures: 2 });
  const app = await fixture(t, { aiBaseUrl, aiRuntime: { state: 'starting', error: '', detail: '', startedAt: Date.now() } });
  const result = await app.request('/api/integrations/Core/InvokeLLM', {
    method: 'POST', token: app.token, body: {
      prompt: 'Wait for local model startup',
      response_json_schema: { type: 'object', properties: { ready: { type: 'boolean' } }, required: ['ready'] }
    }
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.deepEqual(result.data, { ready: true });
});

test('local evidence answers cite stored passages and reject fabricated quotations', async (t) => {
  const aiBaseUrl = await fakeAI(t, (_schema, body) => {
    const marker = 'مصادر الأدلة المحلية:\n';
    const sourceStart = body.messages[0].content.lastIndexOf(marker) + marker.length;
    const sources = JSON.parse(body.messages[0].content.slice(sourceStart));
    const unsupportedCitation = body.messages[0].content.includes('unsupported citation');
    const unsupportedClaim = body.messages[0].content.includes('unsupported statement');
    const quote = unsupportedCitation ? 'This invented text is not in the source' : 'passport number is A123456';
    return {
      claims: [{
        text: unsupportedClaim ? 'Nora works for Blue Harbor Group.' : 'The passport number is A123456.',
        citations: [{ source_id: sources[0].id, quote }]
      }]
    };
  });
  const app = await fixture(t, { aiBaseUrl });
  await app.create('Document', {
    title: 'Passport report', status: 'processed',
    raw_text: 'Name Nora. passport number is A123456.',
    pages: ['Name Nora. passport number is A123456.']
  });

  const grounded = await app.call('askEvidence', { question: 'What passport number is listed for Nora?' });
  assert.equal(grounded.status, 200, JSON.stringify(grounded.data));
  assert.equal(grounded.data.abstained, false);
  assert.equal(grounded.data.claims[0].citations[0].source.page, 1);
  assert.equal(grounded.data.claims[0].citations[0].quote, 'passport number is A123456');

  const unsupported = await app.call('askEvidence', { question: 'unsupported citation for the passport number' });
  assert.equal(unsupported.status, 200, JSON.stringify(unsupported.data));
  assert.equal(unsupported.data.abstained, true);
  assert.equal(unsupported.data.claims.length, 0);

  const mismatchedClaim = await app.call('askEvidence', { question: 'unsupported statement about Nora' });
  assert.equal(mismatchedClaim.status, 200, JSON.stringify(mismatchedClaim.data));
  assert.equal(mismatchedClaim.data.abstained, true);
  assert.equal(mismatchedClaim.data.claims.length, 0);
});

test('LLM structured output is validated locally, not accepted on trust', async (t) => {
  const aiBaseUrl = await fakeAI(t, () => ({ count: 'not-a-number' }));
  const app = await fixture(t, { aiBaseUrl });
  const result = await app.request('/api/integrations/Core/InvokeLLM', { method: 'POST', token: app.token, body: { prompt: 'Count', response_json_schema: { type: 'object', properties: { count: { type: 'number' } }, required: ['count'], additionalProperties: false } } });
  assert.equal(result.status, 502);
  assert.equal(result.data.code, 'AI_INVALID_RESPONSE');
});

test('slow local AI requests use the configured timeout and return a clear timeout error', async (t) => {
  const aiBaseUrl = await fakeAI(t, () => 'slow response', { delayMs: 100 });
  const app = await fixture(t, { aiBaseUrl, aiRequestTimeoutMs: 10 });
  const result = await app.request('/api/integrations/Core/InvokeLLM', {
    method: 'POST', token: app.token, body: { prompt: 'A slow local request' }
  });
  assert.equal(result.status, 503);
  assert.equal(result.data.error, 'Local AI unavailable: request timed out after 1 minute');
  assert.equal(result.data.code, 'AI_UNAVAILABLE');
});

test('shared NER resolves local entities, links, dossiers and high-risk in-app notifications', async (t) => {
  const aiBaseUrl = await fakeAI(t, (schema) => {
    if (schema.properties?.entities) return {
      summary: 'Local evidence summary',
      entities: [
        { name: 'Known person', type: 'person', aliases: ['Alias'], attributes: { nationality: 'Local' } },
        { name: '__proto__', type: 'organization', aliases: [], attributes: {} },
        { name: 'organization', type: 'organization', aliases: [], attributes: {} },
        { name: '2024-01-02', type: 'date' }
      ],
      relationships: [{ source: 'Known person', target: 'organization', type: 'met', evidence: 'Known person met an organization' }]
    };
    return sample(schema);
  });
  const app = await fixture(t, { aiBaseUrl });
  const known = await app.create('Entity', { name: 'Known person', type: 'person', risk_score: 90, watchlist: true, mention_count: 1 });
  const doc = await app.create('Document', { title: 'Evidence from 2024', raw_text: 'Known person met an organization on 2024-01-02.' });
  const result = await app.call('processDocument', { document_id: doc.id });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.entity_count, 3);
  assert.equal(result.data.connection_count, 1);
  const extracted = (await app.request('/api/entities/Entity', { token: app.token })).data;
  assert.equal(extracted.some((row) => row.name === '__proto__'), false);
  const knownResult = (await app.request(`/api/entities/Entity/${known.id}`, { token: app.token })).data;
  assert.deepEqual(knownResult.document_ids, [doc.id]);
  assert.equal(knownResult.mention_count, 2);
  assert.deepEqual(knownResult.aliases, ['Alias']);
  const workspaces = (await app.request('/api/entities/Workspace', { token: app.token })).data;
  assert.equal(workspaces.length, 1);
  assert.deepEqual(workspaces[0].document_ids, [doc.id]);
  const notifications = (await app.request('/api/entities/Notification', { token: app.token })).data;
  assert.ok(notifications.some((row) => row.type === 'watchlist_match'));
  const rerun = await app.call('processDocument', { document_id: doc.id });
  assert.equal(rerun.status, 200);
  assert.equal((await app.request('/api/entities/Mention', { token: app.token })).data.length, 3);
  assert.equal((await app.request('/api/entities/Connection', { token: app.token })).data.length, 1);
  assert.equal((await app.request('/api/entities/Workspace', { token: app.token })).data.length, 1);
});

test('extracted fields retain source page quotes and reprocessing preserves manual edits', async (t) => {
  const aiBaseUrl = await fakeAI(t, (schema) => schema.properties?.entities ? ({
    summary: 'A source-backed person record.',
    entities: [{ name: 'Nora Hassan', type: 'person', attributes: { 'رقم الجواز': 'A123456', 'العمر': '42' } }],
    relationships: []
  }) : sample(schema));
  const app = await fixture(t, { aiBaseUrl });
  const doc = await app.create('Document', {
    title: 'Passport source', status: 'pending',
    raw_text: 'Nora Hassan passport number A123456 age 42.',
    pages: ['Nora Hassan passport number A123456 age 42.']
  });
  const processed = await app.call('processDocument', { document_id: doc.id });
  assert.equal(processed.status, 200, JSON.stringify(processed.data));
  let entity = (await app.request('/api/entities/Entity', { token: app.token })).data.find((row) => row.name === 'Nora Hassan');
  assert.equal(entity.field_sources.__name.document_id, doc.id);
  assert.equal(entity.field_sources.__name.page, 1);
  assert.match(entity.field_sources['رقم الجواز'].quote, /A123456/);
  assert.equal(entity.field_sources['رقم الجواز'].page, 1);

  const manualSources = {
    ...entity.field_sources,
    'رقم الجواز': { kind: 'manual', entered_at: new Date().toISOString() }
  };
  await app.request(`/api/entities/Entity/${entity.id}`, {
    method: 'PUT', token: app.token,
    body: { attributes: { ...entity.attributes, 'رقم الجواز': 'MANUAL-9' }, field_sources: manualSources }
  });
  const reprocessed = await app.call('processDocument', { document_id: doc.id });
  assert.equal(reprocessed.status, 200, JSON.stringify(reprocessed.data));
  entity = (await app.request(`/api/entities/Entity/${entity.id}`, { token: app.token })).data;
  assert.equal(entity.attributes['رقم الجواز'], 'MANUAL-9');
  assert.equal(entity.field_sources['رقم الجواز'].kind, 'manual');
});

test('local fusion awaits reference remapping and reports failures rather than suppressing writes', async (t) => {
  const app = await fixture(t);
  const primary = await app.create('Entity', { name: 'Same Person', type: 'person', mention_count: 5 });
  const duplicate = await app.create('Entity', { name: 'Same Person', type: 'person', mention_count: 2 });
  const other = await app.create('Entity', { name: 'Other Organization', type: 'organization' });
  const doc = await app.create('Document', { title: 'Reference' });
  await app.create('Connection', { source_entity_id: duplicate.id, target_entity_id: other.id, relationship_type: 'knows', document_id: doc.id });
  await app.create('Mention', { entity_id: duplicate.id, entity_name: duplicate.name, document_id: doc.id });
  const result = await app.call('runFusion');
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal((await app.request(`/api/entities/Entity/${duplicate.id}`, { token: app.token })).status, 404);
  assert.equal((await app.request(`/api/entities/Entity/${primary.id}`, { token: app.token })).data.mention_count, 7);
  assert.equal((await app.request('/api/entities/Connection', { token: app.token })).data[0].source_entity_id, primary.id);
  assert.equal((await app.request('/api/entities/Mention', { token: app.token })).data[0].entity_id, primary.id);
});

test('the configured AI URL cannot target a cloud endpoint or arbitrary path', async () => {
  const dataDir = resolve(`.server-test-${randomUUID()}`);
  try {
    await assert.rejects(startServer({ dataDir, aiBaseUrl: 'https://api.example.com' }), /loopback/);
    await assert.rejects(startServer({ dataDir, aiBaseUrl: 'http://127.0.0.1:8081/arbitrary' }), /endpoint path/);
  } finally { rmSync(dataDir, { recursive: true, force: true }); }
});

function textPdf(text) {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return pdf;
}

test('local PDF extracts text without cloud or AI', async (t) => {
  const app = await fixture(t);
  const file = await app.upload('report.pdf', textPdf('Offline PDF evidence'));
  const nativeDOMMatrix = globalThis.DOMMatrix;
  try {
    delete globalThis.DOMMatrix;
    const result = await app.request('/api/integrations/Core/ExtractDataFromUploadedFile', { method: 'POST', token: app.token, body: { file_url: file.file_url, json_schema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } });
    assert.equal(result.status, 200, JSON.stringify(result.data));
    assert.match(result.data.output.text, /Offline PDF evidence/);
    assert.equal(result.data.output.pages.length, 1);
    assert.equal(typeof globalThis.DOMMatrix, 'function');
  } finally {
    if (nativeDOMMatrix === undefined) delete globalThis.DOMMatrix;
    else globalThis.DOMMatrix = nativeDOMMatrix;
  }
});

test('backup roundtrip preserves IDs, references and files but never exports credentials or sessions', async (t) => {
  const app = await fixture(t);
  const file = await app.upload('evidence.txt', 'Backed up evidence');
  const doc = await app.create('Document', { title: 'Evidence', file_url: file.file_url });
  const entity = await app.create('Entity', { name: 'Referenced person', type: 'person', document_ids: [doc.id] });
  const exported = await app.request('/api/backup', { token: app.token });
  assert.equal(exported.status, 200);
  const serialized = JSON.stringify(exported.data);
  for (const secret of ['password_hash', 'recovery_hash', 'token_hash', app.token, app.register.recovery_key, 'correct-password']) assert.equal(serialized.includes(secret), false);
  assert.equal(exported.data.files[0].data, Buffer.from('Backed up evidence').toString('base64'));
  await app.request(`/api/entities/Entity/${entity.id}`, { method: 'DELETE', token: app.token });
  const imported = await app.request('/api/backup', { method: 'POST', token: app.token, body: exported.data });
  assert.equal(imported.status, 200, JSON.stringify(imported.data));
  assert.equal((await app.request(`/api/entities/Entity/${entity.id}`, { token: app.token })).data.document_ids[0], doc.id);
  assert.equal((await app.request(file.file_url, { headers: { Cookie: app.cookie } })).data, 'Backed up evidence');
  assert.equal((await app.request('/api/auth/me', { token: app.token })).data.role, 'admin');
  const broken = structuredClone(exported.data);
  broken.files[0].name = '../../outside.txt';
  assert.equal((await app.request('/api/backup', { method: 'POST', token: app.token, body: broken })).status, 400);
  assert.equal((await app.request(`/api/entities/Entity/${entity.id}`, { token: app.token })).status, 200);
  const invalid = structuredClone(exported.data);
  invalid.records.Entity[0].type = 'invalid';
  assert.equal((await app.request('/api/backup', { method: 'POST', token: app.token, body: invalid })).status, 422);
  assert.equal((await app.request(file.file_url, { token: app.token })).status, 200);
  assert.equal(readdirSync(app.dataDir).some((name) => name.startsWith('.import-') || name.startsWith('.previous-')), false);
  await app.restart();
  assert.equal((await app.request(`/api/entities/Entity/${entity.id}`, { token: app.token })).status, 200);
});

test('SQLite batch rollback leaves no partial mutations', () => {
  const dataDir = resolve(`.server-test-${randomUUID()}`);
  const store = new Store(dataDir);
  try {
    assert.throws(() => store.transaction(() => {
      store.create('Entity', { name: 'Before error', type: 'person' }, { email: 'local@example.test' });
      throw new Error('Rollback');
    }), /Rollback/);
    assert.equal(store.list('Entity').length, 0);
  } finally { store.close(); rmSync(dataDir, { recursive: true, force: true }); }
});
