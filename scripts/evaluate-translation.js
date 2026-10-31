import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir, totalmem, cpus } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { startServer } from '../server/index.js';
import { TRANSLATION_TARGETS } from '../server/functions/translateDocument/entry.js';

const args = process.argv.slice(2);
const mock = args.includes('--mock');
const value = (flag) => args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined;
const aiUrl = value('--ai-url');
const output = value('--output');
assert(mock !== Boolean(aiUrl), 'Choose exactly one mode: --mock or --ai-url http://127.0.0.1:8081');
assert(!args.includes('--output') || (output && !output.startsWith('--')), '--output requires a file path');

const targets = TRANSLATION_TARGETS;
const protectedPattern = /(?:[A-Z]{1,8}[-/]?\d{2,}[A-Z0-9/-]*|\d{4}-\d{2}-\d{2}|\+?\d[\d ()-]{5,}\d|[\w.+-]+@[\w.-]+\.[A-Z]{2,})/gi;
const sourceFixtures = [
  {
    id: 'english-source', sourceLanguage: 'English', target: 'ar',
    text: 'Maya Chen transferred invoice AC-4938-102 for 1250 USD on 2025-03-14. Contact maya@example.com.'
  },
  {
    id: 'russian-source-to-arabic', sourceLanguage: 'Russian', target: 'ar',
    text: 'Майя Чэнь передала счёт AC-4938-102 на сумму 1250 USD 2025-03-14. Контакт maya@example.com.'
  },
  {
    id: 'chinese-source-to-arabic', sourceLanguage: 'Chinese', target: 'ar',
    text: 'Maya Chen 于 2025-03-14 转交了编号为 AC-4938-102 的发票，金额为 1250 USD。邮箱 maya@example.com。'
  }
];

const englishSource = 'Maya Chen transferred invoice AC-4938-102 for 1250 USD on 2025-03-14. Contact maya@example.com.';
const mockTranslations = {
  ar: 'نقلت مايا تشين الفاتورة AC-4938-102 بمبلغ 1250 USD بتاريخ 2025-03-14. البريد maya@example.com.',
  en: 'Maya Chen transferred invoice AC-4938-102 for 1250 USD on 2025-03-14. Contact maya@example.com.',
  zh: 'Maya Chen 于 2025-03-14 转交发票 AC-4938-102，金额为 1250 USD。邮箱 maya@example.com。',
  ru: 'Майя Чэнь передала счёт AC-4938-102 на сумму 1250 USD 2025-03-14. Контакт maya@example.com.',
  es: 'Maya Chen transfirió la factura AC-4938-102 por 1250 USD el 2025-03-14. Contacto maya@example.com.',
  fr: 'Maya Chen a transféré la facture AC-4938-102 de 1250 USD le 2025-03-14. Contact : maya@example.com.',
  de: 'Maya Chen übermittelte die Rechnung AC-4938-102 über 1250 USD am 2025-03-14. Kontakt: maya@example.com.',
  pt: 'Maya Chen transferiu a fatura AC-4938-102 de 1250 USD em 2025-03-14. Contato: maya@example.com.',
  it: 'Maya Chen ha trasferito la fattura AC-4938-102 di 1250 USD il 2025-03-14. Contatto: maya@example.com.',
  ja: 'Maya Chenは2025-03-14に1250 USDの請求書AC-4938-102を転送しました。連絡先: maya@example.com。'
};

const expectedScript = {
  ar: /\p{Script=Arabic}/u,
  zh: /\p{Script=Han}/u,
  ru: /\p{Script=Cyrillic}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  en: /\p{Script=Latin}/u,
  es: /\p{Script=Latin}/u,
  fr: /\p{Script=Latin}/u,
  de: /\p{Script=Latin}/u,
  pt: /\p{Script=Latin}/u,
  it: /\p{Script=Latin}/u
};

let aiServer;
if (mock) {
  aiServer = createServer(async (req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"ok"}');
      return;
    }
    const bodyChunks = [];
    for await (const chunk of req) bodyChunks.push(chunk);
    const body = JSON.parse(Buffer.concat(bodyChunks).toString('utf8'));
    const prompt = body.messages?.[0]?.content || '';
    const target = Object.entries(targets).find(([, name]) => prompt.includes(`into ${name}.`))?.[0];
    const source = prompt.split('Source text:\n').at(-1);
    const text = source.includes('ZX-99999') ? 'تمت معالجة الفاتورة.' : mockTranslations[target];
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text }) }, finish_reason: 'stop' }] }));
  });
  await new Promise((resolve) => aiServer.listen(0, '127.0.0.1', resolve));
}

const dataDir = mkdtempSync(join(tmpdir(), 'strategic-translation-evaluation-'));
const endpoint = mock ? `http://127.0.0.1:${aiServer.address().port}` : aiUrl;
let app;
let token;
const report = {
  startedAt: new Date().toISOString(),
  mode: mock ? 'mock-pipeline' : 'real-local-model',
  model: mock ? 'deterministic fixture' : 'configured local model',
  hardware: { memoryGiB: totalmem() / 1024 ** 3, logicalCpus: cpus().length },
  limitations: [
    ...(mock ? ['Mock mode checks application plumbing and invariants only; it does not measure translation quality.'] : []),
    'Protected-token and script checks are sanity checks, not semantic-accuracy metrics.',
    'Review every translation with a qualified bilingual reviewer before relying on legal, identity, financial, or operational content.',
    'A live score requires human-reviewed references and representative domain-specific documents.'
  ],
  results: [],
  checks: []
};

async function request(path, body) {
  const response = await fetch(app.url + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(600000)
  });
  return { status: response.status, data: await response.json() };
}

async function createDocument(title, text, pages) {
  const result = await request('/api/entities/Document', {
    title, document_type: 'other', status: 'processed', raw_text: text, pages
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data;
}

function letterRatio(text, pattern) {
  const letters = [...String(text || '').replace(protectedPattern, '').matchAll(/\p{L}/gu)].length;
  const targetLetters = [...String(text || '').replace(protectedPattern, '').matchAll(new RegExp(pattern.source, 'gu'))].length;
  return letters ? targetLetters / letters : 0;
}

function charNgramCounts(text, size) {
  const clean = [...String(text || '').toLocaleLowerCase().replace(/\s+/g, ' ').trim()];
  const counts = new Map();
  for (let index = 0; index <= clean.length - size; index++) {
    const gram = clean.slice(index, index + size).join('');
    counts.set(gram, (counts.get(gram) || 0) + 1);
  }
  return counts;
}

function chrf(hypothesis, reference) {
  const scores = [];
  for (let size = 1; size <= 6; size++) {
    const hyp = charNgramCounts(hypothesis, size);
    const ref = charNgramCounts(reference, size);
    const hypTotal = [...hyp.values()].reduce((sum, count) => sum + count, 0);
    const refTotal = [...ref.values()].reduce((sum, count) => sum + count, 0);
    const overlap = [...hyp].reduce((sum, [gram, count]) => sum + Math.min(count, ref.get(gram) || 0), 0);
    const precision = hypTotal ? overlap / hypTotal : 0;
    const recall = refTotal ? overlap / refTotal : 0;
    scores.push(precision + recall ? 5 * precision * recall / (4 * precision + recall) : 0);
  }
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function checkResult(result, target) {
  const translation = result.data.text;
  const missingTokens = [...new Set(result.source.match(protectedPattern) || [])]
    .filter((token) => !translation.toLocaleLowerCase().includes(token.toLocaleLowerCase()));
  const scriptRatio = letterRatio(translation, expectedScript[target]);
  return {
    passed: result.status === 200 && result.data.segments.length === result.expectedPages
      && missingTokens.length === 0 && scriptRatio >= 0.15,
    missingTokens,
    scriptRatio,
    chrfAgainstReference: chrf(translation, result.expected),
    segments: result.data.segments.length,
    expectedPages: result.expectedPages
  };
}

try {
  app = await startServer({ dataDir, aiBaseUrl: endpoint });
  const registration = await request('/api/auth/register', { email: 'translation-evaluation@example.test', password: 'synthetic-evaluation-password', full_name: 'Translation Evaluator' });
  assert.equal(registration.status, 201, JSON.stringify(registration.data));
  token = registration.data.access_token;

  const cases = sourceFixtures.map((fixture) => ({
    id: fixture.id,
    target: fixture.target,
    source: fixture.text,
    pages: [fixture.text],
    expected: mockTranslations[fixture.target]
  }));
  for (const [target, name] of Object.entries(targets)) {
    cases.push({ id: `english-to-${target}`, target, source: englishSource, pages: [englishSource], expected: mockTranslations[target], targetName: name });
  }

  for (const item of cases) {
    const document = await createDocument(item.id, item.source, item.pages);
    const started = performance.now();
    const response = await request('/api/functions/translateDocument', { document_id: document.id, target_language: item.target });
    const durationMs = performance.now() - started;
    const result = { ...item, expectedPages: item.pages.length, status: response.status, data: response.data, source: item.source };
    const checks = response.status === 200 ? checkResult(result, item.target) : { passed: false, error: response.data.error };
    report.results.push({ id: item.id, target: item.target, status: response.status, durationMs, checks, translation: response.data.text });
    if (!checks.passed) report.checks.push({ name: item.id, passed: false, detail: checks });
  }

  const invalidDoc = await createDocument('protected-token-probe', 'Invoice ZX-99999 total 50.', ['Invoice ZX-99999 total 50.']);
  const invalid = await request('/api/functions/translateDocument', { document_id: invalidDoc.id, target_language: 'ar' });
  report.checks.push({ name: 'Rejects translation that drops protected identifiers', passed: invalid.status === 422 && invalid.data.code === 'TRANSLATION_IDENTIFIER_MISMATCH', status: invalid.status, error: invalid.data.error });

  const invalidTarget = await request('/api/functions/translateDocument', { document_id: invalidDoc.id, target_language: 'xx' });
  report.checks.push({ name: 'Rejects unsupported target language', passed: invalidTarget.status === 400, status: invalidTarget.status });

  report.targetLanguages = Object.keys(targets);
  report.completedAt = new Date().toISOString();
} finally {
  if (app) await app.close();
  if (aiServer) await new Promise((resolve) => aiServer.close(resolve));
  rmSync(dataDir, { recursive: true, force: true });
}

const json = JSON.stringify(report, null, 2);
if (output) writeFileSync(output, `${json}\n`, { flag: 'wx' });
console.log(json);
if (report.results.some((row) => row.status !== 200 || !row.checks.passed) || report.checks.some((check) => !check.passed)) process.exitCode = 1;