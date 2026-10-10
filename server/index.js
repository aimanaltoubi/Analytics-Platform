import { createServer } from 'node:http';
import { createReadStream, lstatSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, join, extname, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Store } from './store.js';
import { Auth } from './auth.js';
import { Integrations, MAX_FILE_SIZE } from './integrations.js';
import { createLocalClient, bindRequest } from './client.js';
import { exportBackup, importBackup } from './backup.js';
import { assert, HttpError } from './errors.js';
import { object } from './validation.js';

const JSON_LIMIT = 2 * 1024 * 1024;
const BACKUP_LIMIT = 128 * 1024 * 1024;
const staticTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json' };
const staticCSP = "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'";

async function readBody(req, limit) {
  const length = Number(req.headers['content-length'] || 0);
  assert(Number.isFinite(length) && length >= 0 && length <= limit, 413, 'Request exceeds size limit');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    assert(size <= limit, 413, 'Request exceeds size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function jsonBody(req, limit = JSON_LIMIT) {
  assert((req.headers['content-type'] || '').split(';')[0] === 'application/json', 415, 'Content-Type must be application/json');
  const bytes = await readBody(req, limit);
  let data;
  try { data = JSON.parse(bytes.toString('utf8')); } catch { throw new HttpError(400, 'Invalid JSON body'); }
  return data;
}

function json(res, status, value, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders });
  res.end(JSON.stringify(value));
}

function queryJSON(url, key, fallback) {
  const value = url.searchParams.get(key);
  if (value === null) return fallback;
  try { return JSON.parse(value); } catch { throw new HttpError(400, `Invalid ${key} query`); }
}

export async function startServer({ dataDir = '.local-data', staticDir, port = 0, aiBaseUrl = 'http://127.0.0.1:8081', allowedOrigin } = {}) {
  assert(Number.isInteger(port) && port >= 0 && port <= 65535, 400, 'Invalid port');
  let devOrigin;
  if (allowedOrigin) {
    devOrigin = new URL(allowedOrigin);
    assert(devOrigin.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(devOrigin.hostname) && !devOrigin.username && !devOrigin.password && devOrigin.pathname === '/' && !devOrigin.search && !devOrigin.hash, 400, 'Development origin must be an explicit HTTP loopback origin');
    allowedOrigin = devOrigin.origin;
  }
  dataDir = resolve(dataDir);
  staticDir = staticDir ? realpathSync(resolve(staticDir)) : undefined;
  const store = new Store(dataDir);
  let integrations;
  try { integrations = new Integrations({ store, dataDir, aiBaseUrl }); } catch (error) { store.close(); throw error; }
  const auth = new Auth(store);
  const functionNames = readdirSync(new URL('./functions/', import.meta.url), { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  let functions;
  try {
    functions = Object.fromEntries(await Promise.all(functionNames.map(async (name) => [name, (await import(`./functions/${name}/entry.js`)).default])));
  } catch (error) { store.close(); throw error; }
  let baseUrl, closing = false, importing = false, activeMutations = 0, activeFunctions = 0;
  const jobs = new Set(), workflowErrors = [];

  const invoke = async (name, body, user, depth = 0) => {
    assert(Object.hasOwn(functions, name), 404, 'Unknown function');
    assert(depth < 8, 400, 'Function invocation depth exceeded');
    assert(!importing, 409, 'A backup import is in progress');
    object(body);
    const request = new Request(`${baseUrl}/api/functions/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    const client = createLocalClient({
      store, user, integrations: integrations.core(),
      invoke: async (nestedName, nestedBody) => ({ data: await invoke(nestedName, nestedBody, user, depth + 1) })
    });
    bindRequest(request, client);
    activeFunctions++;
    try {
      const response = await functions[name](request);
      assert(response instanceof Response, 500, 'Invalid function response');
      const data = await response.json();
      assert(response.ok, response.status, data.error || 'Function failed', data.code);
      return data;
    } finally { activeFunctions--; }
  };

  const runJob = (name, body, user) => {
    if (closing || importing) return;
    const job = invoke(name, body, user).catch((error) => {
      const detail = { function: name, code: error.code || 'WORKFLOW_FAILED', message: error.message, date: new Date().toISOString() };
      workflowErrors.push(detail);
      if (workflowErrors.length > 20) workflowErrors.shift();
      console.error(`Local workflow ${name} failed: ${error.message}`);
    }).finally(() => jobs.delete(job));
    jobs.add(job);
  };

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    let mutation = false, importingHere = false;
    try {
      assert(!closing, 503, 'Server is closing');
      if (!['GET', 'HEAD'].includes(req.method)) {
        assert(!importing, 409, 'A backup import is in progress');
        mutation = true;
        activeMutations++;
      }
      const authority = new URL(baseUrl).host;
      const localhost = `localhost:${server.address().port}`;
      assert(req.headers.host === authority || req.headers.host === localhost || req.headers.host === devOrigin?.host, 403, 'Invalid Host header');
      const origin = `http://${req.headers.host}`;
      const url = new URL(req.url, origin);
      assert(url.origin === origin, 400, 'Invalid request target');
      assert(req.url.length <= 10000 && !/%2f|%5c/i.test(url.pathname) && !req.url.includes('\\'), 400, 'Invalid request path');
      if (allowedOrigin && req.headers.origin === allowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Vary', 'Origin');
        if (req.method === 'OPTIONS') {
          assert(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'].includes(req.headers['access-control-request-method']), 405, 'Invalid preflight method');
          const headers = (req.headers['access-control-request-headers'] || '').split(',').map((header) => header.trim().toLowerCase()).filter(Boolean);
          assert(headers.every((header) => ['authorization', 'content-type'].includes(header)), 403, 'Invalid preflight headers');
          res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '600' });
          return res.end();
        }
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        assert(!req.headers.origin || req.headers.origin === origin || req.headers.origin === allowedOrigin, 403, 'Cross-origin mutations are forbidden');
        assert(!req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']) || (allowedOrigin && req.headers.origin === allowedOrigin), 403, 'Cross-site mutations are forbidden');
      }
      const parts = url.pathname.split('/').filter(Boolean);
      const token = auth.token(req, url, parts[0] === 'files');
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { ok: true });
      if (req.method === 'GET' && url.pathname === '/api/auth/setup') return json(res, 200, { needs_setup: auth.needsSetup() });
      if (req.method === 'POST' && parts[0] === 'api' && parts[1] === 'auth') {
        const action = parts[2];
        assert(parts.length === 3, 404, 'Not found');
        if (['register', 'login', 'reset-password'].includes(action)) auth.throttle(req.socket.remoteAddress);
        const body = action === 'logout' && !req.headers['content-type'] ? {} : await jsonBody(req);
        if (action === 'register') {
          const result = await auth.register(body, auth.current(token));
          return json(res, 201, result, { 'Set-Cookie': auth.cookie(result.access_token) });
        }
        if (action === 'login') {
          const result = await auth.login(body);
          return json(res, 200, result, { 'Set-Cookie': auth.cookie(result.access_token) });
        }
        if (action === 'reset-password') return json(res, 200, await auth.reset(body), { 'Set-Cookie': auth.cookie('') });
        const user = auth.require(token);
        if (action === 'logout') return json(res, 200, auth.logout(token), { 'Set-Cookie': auth.cookie('') });
        if (action === 'change-password') return json(res, 200, await auth.change(body, user), { 'Set-Cookie': auth.cookie('') });
        throw new HttpError(404, 'Unknown authentication route');
      }
      if (parts[0] === 'api') {
        const user = auth.require(token);
        if (req.method === 'GET' && url.pathname === '/api/auth/me') return json(res, 200, user);
        if (req.method === 'GET' && url.pathname === '/api/status') return json(res, 200, { ...await integrations.status(), workflows: { pending: jobs.size, errors: workflowErrors } });
        const client = createLocalClient({ store, user, integrations: integrations.core(), invoke: async (name, body) => ({ data: await invoke(name, body, user) }) });
        if (parts[1] === 'entities') {
          assert(parts.length >= 3 && parts.length <= 4, 404, 'Not found');
          const name = parts[2], id = parts[3];
          store.schema(name);
          const entity = client.entities[name];
          if (!id && req.method === 'GET') return json(res, 200, await entity.filter(queryJSON(url, 'filter', {}), url.searchParams.get('sort') || '-created_date', Number(url.searchParams.get('limit') ?? 10000), Number(url.searchParams.get('skip') || 0)));
          if (id && req.method === 'GET') {
            const row = await entity.get(id);
            assert(row, 404, 'Record not found');
            return json(res, 200, row);
          }
          if (!id && req.method === 'POST') {
            const row = await entity.create(await jsonBody(req));
            if (name === 'Manifest') {
              const job = (async () => {
                await invoke('screenManifest', { manifest_id: row.id }, user);
                await invoke('processManifest', { manifest_id: row.id }, user);
              })().catch((error) => {
                workflowErrors.push({ function: 'manifestScreening', message: error.message, code: error.code || 'WORKFLOW_FAILED', date: new Date().toISOString() });
                if (workflowErrors.length > 20) workflowErrors.shift();
                console.error(`Local manifest workflow failed: ${error.message}`);
              }).finally(() => jobs.delete(job));
              jobs.add(job);
            }
            return json(res, 201, row);
          }
          if (id === 'bulk' && req.method === 'POST') return json(res, 201, await entity.bulkCreate(await jsonBody(req)));
          if (id === 'bulk-update' && req.method === 'POST') return json(res, 200, await entity.bulkUpdate(await jsonBody(req)));
          if (id && ['PUT', 'PATCH'].includes(req.method)) return json(res, 200, await entity.update(id, await jsonBody(req)));
          if (id && req.method === 'DELETE') return json(res, 200, await entity.delete(id));
          throw new HttpError(405, 'Method not allowed');
        }
        if (parts[1] === 'functions' && parts.length === 3 && req.method === 'POST') return json(res, 200, await invoke(parts[2], await jsonBody(req), user));
        if (url.pathname === '/api/files' && req.method === 'POST') {
          assert((req.headers['content-type'] || '').startsWith('multipart/form-data;'), 415, 'Multipart FormData required');
          const body = await readBody(req, MAX_FILE_SIZE + 1024 * 1024);
          let form;
          try { form = await new Request(baseUrl, { method: 'POST', headers: { 'Content-Type': req.headers['content-type'] }, body }).formData(); } catch { throw new HttpError(400, 'Malformed multipart body'); }
          assert(form.getAll('file').length === 1, 400, 'Exactly one file is required');
          return json(res, 201, await integrations.UploadFile({ file: form.get('file') }));
        }
        if (parts[1] === 'integrations' && parts[2] === 'Core' && parts.length === 4 && req.method === 'POST') {
          assert(['InvokeLLM', 'ExtractDataFromUploadedFile', 'SendEmail'].includes(parts[3]), 404, 'Unknown local integration');
          return json(res, 200, await integrations[parts[3]](await jsonBody(req)));
        }
        if (url.pathname === '/api/backup') {
          assert(user.role === 'admin', 403, 'Administrator required');
          if (req.method === 'GET') return json(res, 200, exportBackup(store, integrations));
          if (req.method === 'POST') {
            assert(jobs.size === 0 && activeFunctions === 0 && activeMutations === 1, 409, 'Wait for active mutations and workflows before importing a backup');
            importing = true;
            importingHere = true;
            return json(res, 200, importBackup(await jsonBody(req, BACKUP_LIMIT), store, integrations, dataDir));
          }
        }
        throw new HttpError(404, 'Not found');
      }
      if (parts[0] === 'files') {
        auth.require(token);
        assert(req.method === 'GET' || req.method === 'HEAD', 405, 'Method not allowed');
        const { path, metadata } = integrations.file(`${baseUrl}${url.pathname}`);
        res.writeHead(200, { 'Content-Type': metadata.mime, 'Content-Length': metadata.size, 'Cache-Control': 'private, no-store', 'Content-Disposition': 'inline', 'Content-Security-Policy': "default-src 'none'; sandbox" });
        if (req.method === 'HEAD') return res.end();
        return createReadStream(path).on('error', () => res.destroy()).pipe(res);
      }
      assert(staticDir && ['GET', 'HEAD'].includes(req.method), 404, 'Not found');
      let requested;
      try { requested = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, 'Invalid URL encoding'); }
      const candidate = resolve(staticDir, '.' + requested);
      assert(candidate === staticDir || candidate.startsWith(staticDir + sep), 400, 'Invalid static path');
      let path = candidate;
      try {
        const stat = lstatSync(path);
        if (stat.isDirectory()) path = join(path, 'index.html');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        assert(!extname(requested), 404, 'Not found');
        path = join(staticDir, 'index.html');
      }
      const real = realpathSync(path);
      assert(real.startsWith(staticDir + sep), 403, 'Invalid static path');
      const stat = lstatSync(real);
      assert(stat.isFile(), 404, 'Not found');
      res.setHeader('Content-Security-Policy', staticCSP);
      res.writeHead(200, { 'Content-Type': staticTypes[extname(real)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': extname(real) === '.html' ? 'no-cache' : 'public, max-age=3600' });
      if (req.method === 'HEAD') return res.end();
      createReadStream(real).on('error', () => res.destroy()).pipe(res);
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      const status = error.status || (error.code === 'ENOENT' ? 404 : 500);
      if (status >= 500 && !(error instanceof HttpError)) console.error('Local server request failed:', error);
      json(res, status, { error: status === 500 && !(error instanceof HttpError) ? 'Internal server error' : error.message, ...(error.code && error instanceof HttpError ? { code: error.code } : {}) });
    } finally {
      if (mutation) activeMutations--;
      if (importingHere) importing = false;
    }
  });
  server.requestTimeout = 180000;
  server.headersTimeout = 15000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 100;
  try {
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', done);
    });
  } catch (error) { store.close(); throw error; }
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  integrations.url = baseUrl;
  const scheduled = setInterval(() => {
    const admin = store.list('User', { role: 'admin' }, '-created_date', 1)[0];
    if (admin && !jobs.size && !activeFunctions && !importing) runJob('runCepAlerts', {}, admin);
  }, 30 * 60 * 1000);
  scheduled.unref();
  let closePromise;
  const close = () => closePromise ||= (async () => {
    closing = true;
    clearInterval(scheduled);
    await new Promise((done, reject) => server.close((error) => error ? reject(error) : done()));
    await Promise.allSettled(jobs);
    store.close();
  })();
  return { url: baseUrl, port: server.address().port, close, dataDir, functionNames };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await startServer({ dataDir: process.env.LOCAL_DATA_DIR || '.local-data', staticDir: process.env.LOCAL_STATIC_DIR || undefined, port: Number(process.env.PORT || 3001), aiBaseUrl: process.env.LOCAL_AI_BASE_URL || 'http://127.0.0.1:8081', allowedOrigin: process.env.LOCAL_ALLOWED_ORIGIN || undefined });
  console.log(`Local analytics server listening at ${server.url}`);
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await server.close();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
