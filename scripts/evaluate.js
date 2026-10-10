import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, totalmem, cpus } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { startServer } from '../server/index.js';

const args = process.argv.slice(2);
const mock = args.includes('--mock');
const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const aiUrl = value('--ai-url');
const output = value('--output');
assert(mock !== Boolean(aiUrl), 'Choose exactly one mode: --mock or --ai-url http://127.0.0.1:8081');
assert(!args.includes('--output') || (output && !output.startsWith('--')), '--output requires a file path');

const entity = (name, type, aliases = []) => ({ name, type, aliases });
const relationship = (source, target, type, evidence) => ({ source, target, type, evidence });
const cases = [
  {
    id: 'english-employment',
    text: 'Maya Chen works for Cedar Analytics.',
    entities: [entity('Maya Chen', 'person'), entity('Cedar Analytics', 'organization')],
    relationships: [relationship('Maya Chen', 'Cedar Analytics', 'يعمل لدى', 'Maya Chen works for Cedar Analytics.')],
    relationLabels: ['يعمل لدى', 'تعمل لدى', 'موظف في', 'works for', 'employed by']
  },
  {
    id: 'arabic-employment',
    text: 'تعمل ليلى منصور لدى شركة الأفق.',
    entities: [entity('ليلى منصور', 'person'), entity('شركة الأفق', 'organization', ['الأفق'])],
    relationships: [relationship('ليلى منصور', 'شركة الأفق', 'يعمل لدى', 'تعمل ليلى منصور لدى شركة الأفق.')],
    relationLabels: ['يعمل لدى', 'تعمل لدى', 'موظف في', 'works for', 'employed by']
  },
  {
    id: 'bilingual-alias',
    text: 'سارة نادر (Sara Nader) تعمل لدى شركة مدار (Madar Company).',
    entities: [entity('سارة نادر', 'person', ['Sara Nader']), entity('شركة مدار', 'organization', ['Madar Company', 'مدار'])],
    relationships: [relationship('سارة نادر', 'شركة مدار', 'يعمل لدى', 'سارة نادر (Sara Nader) تعمل لدى شركة مدار (Madar Company).')],
    relationLabels: ['يعمل لدى', 'تعمل لدى', 'موظف في', 'works for', 'employed by']
  },
  {
    id: 'contact-identifiers',
    text: 'Contact Priya Shah at priya.shah@example.test or +1-202-555-0147.',
    entities: [entity('Priya Shah', 'person'), entity('priya.shah@example.test', 'email'), entity('+1-202-555-0147', 'phone')],
    relationships: [
      relationship('Priya Shah', 'priya.shah@example.test', 'بريد إلكتروني', 'Contact Priya Shah at priya.shah@example.test'),
      relationship('Priya Shah', '+1-202-555-0147', 'رقم هاتف', 'Contact Priya Shah at priya.shah@example.test or +1-202-555-0147.')
    ],
    relationLabels: ['بريد إلكتروني', 'البريد الإلكتروني', 'email', 'has email', 'رقم هاتف', 'هاتف', 'phone', 'has phone']
  },
  {
    id: 'negated-employment',
    text: 'Nora Vale does not work for Quartz Logistics. There is no employment relationship between them.',
    entities: [entity('Nora Vale', 'person'), entity('Quartz Logistics', 'organization')],
    relationships: [],
    relationLabels: []
  },
  {
    id: 'no-entities',
    text: 'This is a blank administrative template. No names, organizations, contacts, dates, or events are provided.',
    entities: [],
    relationships: [],
    relationLabels: []
  }
];

// Evaluation matching intentionally does not reuse the application's fuzzy matcher.
const normalize = (text) => String(text).normalize('NFKC').toLowerCase()
  .replace(/[\u064B-\u0652\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/\s+/g, ' ').trim();
const names = (item) => [item.name, ...(item.aliases || [])].map(normalize);
const contactLabels = {
  'بريد إلكتروني': ['بريد إلكتروني', 'البريد الإلكتروني', 'email', 'has email'],
  'رقم هاتف': ['رقم هاتف', 'هاتف', 'phone', 'has phone']
};
const metrics = (tp, predicted, expected) => {
  const precision = predicted ? tp / predicted : expected ? 0 : 1;
  const recall = expected ? tp / expected : 1;
  return { tp, predicted, expected, precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
};
function score(sample, predictedEntities, predictedRelationships) {
  const used = new Set();
  const mapping = new Map();
  for (const prediction of predictedEntities) {
    const index = sample.entities.findIndex((gold, i) =>
      !used.has(i) && gold.type === prediction.type && names(gold).some((name) => names(prediction).includes(name)));
    if (index >= 0) {
      used.add(index);
      mapping.set(prediction.id, sample.entities[index].name);
    }
  }
  const usedRelationships = new Set();
  for (const prediction of predictedRelationships) {
    const index = sample.relationships.findIndex((gold, i) => !usedRelationships.has(i)
      && mapping.get(prediction.source_entity_id) === gold.source
      && mapping.get(prediction.target_entity_id) === gold.target
      && (contactLabels[gold.type] || sample.relationLabels).map(normalize).includes(normalize(prediction.relationship_type)));
    if (index >= 0) usedRelationships.add(index);
  }
  const grounded = predictedRelationships.filter((row) => row.evidence?.trim()
    && normalize(sample.text).includes(normalize(row.evidence))).length;
  return {
    entities: metrics(used.size, predictedEntities.length, sample.entities.length),
    relationships: metrics(usedRelationships.size, predictedRelationships.length, sample.relationships.length),
    evidence: { grounded, total: predictedRelationships.length },
    unmatchedEntities: predictedEntities.filter((row) => !mapping.has(row.id)).map((row) => ({ name: row.name, type: row.type }))
  };
}
assert.equal(metrics(1, 2, 2).f1, 0.5);
assert.equal(score(cases[0], [{ id: 'x', name: 'Invented', type: 'person' }], []).entities.tp, 0);

let aiServer;
let fault;
let aiCalls = 0;
let lastPrompt = '';
if (mock) {
  aiServer = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"ok"}');
      return;
    }
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    lastPrompt = body.messages[0].content;
    aiCalls++;
    const sample = cases.find((row) => body.messages[0].content.includes(row.text));
    if (!sample && !fault) {
      res.writeHead(400);
      res.end('Unrecognized evaluation fixture');
      return;
    }
    const content = fault === 'long-document' ? { summary: 'Synthetic long-document response', entities: [], relationships: [] }
      : fault === 'type-collision' ? { summary: 'Two distinct typed entities', entities: [entity('Jordan', 'person'), entity('Jordan', 'location')], relationships: [] }
      : fault === 'invalid-schema' ? { summary: 42 } : fault === 'hallucination'
      ? { summary: 'Invented response', entities: [entity('Invented Person', 'person')], relationships: [] }
      : { summary: 'Synthetic fixture summary', entities: sample.entities, relationships: sample.relationships };
    res.writeHead(fault === 'unavailable' ? 503 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: fault === 'truncated' ? 'length' : 'stop' }] }));
  });
  await new Promise((resolve) => aiServer.listen(0, '127.0.0.1', resolve));
}

const dataDir = mkdtempSync(join(tmpdir(), 'strategic-evaluation-'));
const endpoint = mock ? `http://127.0.0.1:${aiServer.address().port}` : aiUrl;
let app;
let token;
const report = {
  startedAt: new Date().toISOString(),
  mode: mock ? 'mock-pipeline' : 'real-local-model',
  hardware: { memoryGiB: totalmem() / 1024 ** 3, logicalCpus: cpus().length },
  limitations: [
    ...(mock ? ['Model responses are supplied ground truth; accuracy measures pipeline preservation, NOT LLM accuracy.'] : []),
    'Six synthetic short documents are a smoke benchmark, not representative production validation.',
    'Entity scoring uses exact normalized names or explicitly listed aliases and requires correct type.',
    'Relationship scoring requires directed endpoints and one of the listed labels; other paraphrases need human review.',
    'Summary factuality and completeness require human review; generated summaries are retained below.',
    'No native Windows GUI, installer, OCR, or real workload scalability evaluation is performed by this runner.'
  ],
  cases: [],
  checks: []
};
async function request(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(app.url + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(150000)
  });
  return { status: response.status, data: await response.json() };
}
async function create(type, body) {
  const result = await request(`/api/entities/${type}`, body);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
}
async function list(type) {
  const result = await request(`/api/entities/${type}?limit=1000`);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  return result.data;
}
async function check(name, run) {
  const started = performance.now();
  try {
    const detail = await run();
    report.checks.push({ name, passed: true, durationMs: performance.now() - started, detail });
  } catch (error) {
    report.checks.push({ name, passed: false, durationMs: performance.now() - started, error: error.message });
  } finally {
    fault = undefined;
  }
}

try {
  app = await startServer({ dataDir, aiBaseUrl: endpoint });
  const registration = await request('/api/auth/register', { email: 'evaluation@example.test', password: 'synthetic-evaluation-password', full_name: 'Synthetic Evaluator' });
  assert.equal(registration.status, 201);
  token = registration.data.access_token;
  let firstDoc;
  for (const sample of cases) {
    const doc = await create('Document', { title: sample.id, raw_text: sample.text });
    firstDoc ||= doc;
    const started = performance.now();
    const processed = await request('/api/functions/processDocument', { document_id: doc.id });
    const durationMs = performance.now() - started;
    const entities = (await list('Entity')).filter((row) => row.document_ids?.includes(doc.id));
    const relationships = (await list('Connection')).filter((row) => row.document_id === doc.id);
    report.cases.push({
      id: sample.id, input: sample.text, status: processed.status, durationMs,
      summary: processed.data.summary, error: processed.data.error,
      ...score(sample, entities, relationships),
      predictedEntities: entities.map(({ id, name, type, aliases }) => ({ id, name, type, aliases })),
      predictedRelationships: relationships.map(({ source_entity_name, target_entity_name, relationship_type, evidence }) =>
        ({ source_entity_name, target_entity_name, relationship_type, evidence }))
    });
  }
  await check('Search ranks the exact known name first among entities', async () => {
    const result = await request('/api/functions/fuzzySearch', { query: 'Maya Chen' });
    assert.equal(result.status, 200);
    assert.equal(result.data.results.filter((row) => row.type === 'entity')[0]?.label, 'Maya Chen');
  });
  await check('Shortest path preserves the known one-edge relationship', async () => {
    const entities = await list('Entity');
    const source = entities.find((row) => row.name === 'Maya Chen');
    const target = entities.find((row) => row.name === 'Cedar Analytics');
    assert(source && target, 'Expected extracted endpoints missing');
    const result = await request('/api/functions/findEntityPath', { source_id: source.id, target_id: target.id });
    assert.equal(result.status, 200);
    assert.equal(result.data.connected, true);
    assert.equal(result.data.path_length, 2);
  });
  await check('Reprocessing does not duplicate mentions or connections', async () => {
    const before = { mentions: (await list('Mention')).length, connections: (await list('Connection')).length };
    assert.equal((await request('/api/functions/processDocument', { document_id: firstDoc.id })).status, 200);
    assert.equal((await list('Mention')).length, before.mentions);
    assert.equal((await list('Connection')).length, before.connections);
  });
  await check('Reprocessing preserves entity mention counts', async () => {
    const before = (await list('Entity')).find((row) => row.name === 'Maya Chen');
    assert(before, 'Expected extracted person missing');
    assert.equal((await request('/api/functions/processDocument', { document_id: firstDoc.id })).status, 200);
    const after = (await list('Entity')).find((row) => row.id === before.id);
    assert.equal(after.mention_count, before.mention_count, 'Repeated analysis increased mention_count for the same document');
  });
  await check('Session and records survive API restart', async () => {
    const before = (await list('Entity')).map((row) => row.id).sort();
    await app.close();
    app = await startServer({ dataDir, aiBaseUrl: endpoint });
    assert.deepEqual((await list('Entity')).map((row) => row.id).sort(), before);
    assert.equal((await request('/api/auth/me')).status, 200);
  });
  await check('Backup restores record IDs without exporting credentials', async () => {
    const backup = await request('/api/backup');
    assert.equal(backup.status, 200);
    assert(!JSON.stringify(backup.data).includes('synthetic-evaluation-password'));
    assert(!JSON.stringify(backup.data).includes(token));
    const before = (await list('Entity')).map((row) => row.id).sort();
    assert.equal((await request('/api/backup', backup.data)).status, 200);
    assert.deepEqual((await list('Entity')).map((row) => row.id).sort(), before);
  });
  if (mock) {
    for (const scenario of ['invalid-schema', 'truncated', 'unavailable']) {
      await check(`Rejects ${scenario} AI response and preserves existing records`, async () => {
        const before = (await list('Entity')).map((row) => row.id).sort();
        fault = scenario;
        const result = await request('/api/functions/processDocument', { document_id: firstDoc.id });
        fault = undefined;
        assert.equal(result.status, scenario === 'unavailable' ? 503 : 502);
        assert.deepEqual((await list('Entity')).map((row) => row.id).sort(), before);
      });
    }
    await check('Rejects structurally valid but invented entities', async () => {
      fault = 'hallucination';
      const doc = await create('Document', { title: 'hallucination-probe', raw_text: cases[5].text });
      const result = await request('/api/functions/processDocument', { document_id: doc.id });
      fault = undefined;
      const invented = (await list('Entity')).find((row) => row.name === 'Invented Person');
      assert(!invented, `Schema-valid invented entity was persisted (HTTP ${result.status}); schema validation is not factual grounding.`);
    });
    await check('Same-name person and location remain distinct entities', async () => {
      fault = 'type-collision';
      const doc = await create('Document', { title: 'type-collision', raw_text: 'Jordan is a person who visited the country Jordan.' });
      const result = await request('/api/functions/processDocument', { document_id: doc.id });
      assert.equal(result.status, 200);
      const resolved = (await list('Entity')).filter((row) => row.document_ids.includes(doc.id));
      assert.deepEqual(resolved.map((row) => row.type).sort(), ['location', 'person'], 'Same-name entities of different types were collapsed');
    });
    await check('Document content after 12000 characters reaches the model', async () => {
      fault = 'long-document';
      const sentinel = 'TAIL_MARKER_RAVEN_927';
      const doc = await create('Document', { title: 'long-document', raw_text: `${'Routine text. '.repeat(1000)}${sentinel}` });
      assert.equal((await request('/api/functions/processDocument', { document_id: doc.id })).status, 200);
      assert(lastPrompt.includes(sentinel), 'Document tail silently omitted from the model prompt');
    });
  }
  await check('Bulk CRUD stores and retrieves 1000 synthetic records', async () => {
    const rows = Array.from({ length: 1000 }, (_, i) => ({ name: `Load Fixture ${i}`, type: 'other', mention_count: 10 }));
    const inserted = await request('/api/entities/Entity/bulk', rows);
    assert.equal(inserted.status, 201, JSON.stringify(inserted.data));
    assert.equal(inserted.data.length, 1000);
    const result = await request('/api/entities/Entity?limit=10000');
    assert.equal(result.status, 200);
    assert.equal(result.data.filter((row) => row.name.startsWith('Load Fixture ')).length, 1000);
  });
  await check('Search finds a known record beyond the first 1000 ranked entities', async () => {
    const marker = await create('Entity', { name: 'ZXQ927RareMarker', type: 'other', mention_count: 0 });
    const result = await request('/api/functions/fuzzySearch', { query: marker.name });
    assert.equal(result.status, 200);
    assert(result.data.results.some((row) => row.id === marker.id), 'Exact known record excluded by the search candidate limit');
  });
  const aggregate = (key) => metrics(
    report.cases.reduce((sum, row) => sum + row[key].tp, 0),
    report.cases.reduce((sum, row) => sum + row[key].predicted, 0),
    report.cases.reduce((sum, row) => sum + row[key].expected, 0)
  );
  report.aggregate = { entities: aggregate('entities'), relationships: aggregate('relationships') };
  report.aiRequests = mock ? aiCalls : undefined;
  report.completedAt = new Date().toISOString();
  report.readiness = mock ? 'NOT ESTABLISHED: real-model accuracy and native Windows behavior remain unverified.'
    : 'Requires review of metrics, summaries, domain-specific acceptance thresholds, and native Windows testing.';
} finally {
  if (app) await app.close();
  if (aiServer) await new Promise((resolve) => aiServer.close(resolve));
  rmSync(dataDir, { recursive: true, force: true });
}
const json = JSON.stringify(report, null, 2);
if (output) writeFileSync(output, `${json}\n`, { flag: 'wx' });
console.log(json);
if (report.cases.some((row) => row.status !== 200 || row.entities.f1 < 1 || row.relationships.f1 < 1)
  || report.checks.some((row) => !row.passed)) process.exitCode = 1;
