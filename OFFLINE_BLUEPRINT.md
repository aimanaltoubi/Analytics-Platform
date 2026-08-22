# Offline (Air-Gapped) Rebuild Blueprint — "محلّل الكيانات" / Strategic Data Fusion

A complete, buildable specification for a **fully offline, air-gapped** port of the current link-analysis system. Nothing in this blueprint requires internet at runtime — no cloud DB, no cloud LLM, no cloud storage, no online map tiles.

This document is self-contained: a developer can follow it end-to-end without referring back to the Base44-hosted app.

---

## 1. Constraints & Design Principles

| Principle | Decision |
|---|---|
| **No network egress** | Every dependency is installed from a transfer medium (USB) while the build machine is *online*, then the target machine is air-gapped. Runtime = `localhost` only. |
| **Local AI** | All entity extraction runs on a local LLM via **Ollama**. No OpenAI/Google/Anthropic calls. |
| **Local DB** | **SQLite** (single-file, zero-admin) for the database. |
| **Local files** | Uploaded PDFs/text stored on the local filesystem under a data directory. |
| **Local maps** | Pre-downloaded **OpenStreetMap raster tiles** served by a local tile server. |
| **Local auth** | Single-user (or multi-user) accounts stored in the local DB; bcrypt-hashed passwords. No external identity provider. |
| **Same data model** | Entity schemas are ported 1:1 from the current Base44 entities so logic transfers with minimal change. |
| **Same UI** | The React + Tailwind frontend is reused almost verbatim; only the API client is swapped. |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  AIR-GAPPED PC (no internet)                                │
│                                                             │
│  ┌──────────────┐    HTTP (localhost:5173)   ┌────────────┐  │
│  │  React UI    │ ◄────────────────────────► │  Vite dev  │  │
│  │ (Tailwind)   │                            │  /static   │  │
│  └──────┬───────┘                            └─────┬──────┘  │
│         │ fetch /api/*                             │        │
│         ▼                                           │        │
│  ┌──────────────────────────────────────────────┐  │        │
│  │  Node.js + Express API  (localhost:3001)      │  │        │
│  │  ┌───────────┐ ┌──────────┐ ┌─────────────┐  │  │        │
│  │  │ Documents │ │ Entities │ │  Alerts/    │  │  │        │
│  │  │ processor │ │ resolver │ │  Notif.     │  │  │        │
│  │  └─────┬─────┘ └──────────┘ └─────────────┘  │  │        │
│  │        │                                     │  │        │
│  │  ┌─────▼──────────────────────────────────┐  │  │        │
│  │  │  NER Pipeline (port of nerPipeline.ts) │  │  │        │
│  │  │  → calls Ollama (localhost:11434)       │  │  │        │
│  │  └─────┬──────────────────────────────────┘  │  │        │
│  │        │                                     │  │        │
│  │  ┌─────▼─────┐  ┌───────────┐  ┌──────────┐  │  │        │
│  │  │  SQLite   │  │ /data/pdf │  │  Ollama  │  │  │        │
│  │  │  (file)   │  │  (disk)   │  │  (LLM)   │  │  │        │
│  │  └───────────┘  └───────────┘  └──────────┘  │  │        │
│  └──────────────────────────────────────────────┘  │        │
│                                                   │        │
│  ┌──────────────────────────────────────────────┐ │        │
│  │  Local Tile Server (tileserver-gl)           │ │        │
│  │  serves OSM .mbtiles → Leaflet               │ │        │
│  └──────────────────────────────────────────────┘ │        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Choice | Why |
|---|---|---|
| **Runtime** | Node.js 20 LTS | Same language as the current backend functions; shared logic ports directly. |
| **Web framework** | Express 4 | Minimal, well-understood. |
| **Database** | SQLite via `better-sqlite3` | Single file, zero config, fast, perfect for a single workstation. |
| **ORM/queries** | `better-sqlite3` directly (synchronous, simple) | No ORM needed; small schema. |
| **Local LLM runtime** | **Ollama** | Runs GGUF models locally, exposes a localhost HTTP API identical in shape to OpenAI's. |
| **LLM model** | **`llama3.1:8b-instruct-q4_K_M`** (4-bit quantized, ~5 GB on disk) | Best quality/size ratio for Arabic + structured extraction on a single GPU. Falls back to CPU if no GPU. |
| **PDF text extraction** | `pdf-parse` (Node) | Pure-JS, no native deps, works offline. Fallback: `pdfjs-dist`. |
| **File storage** | Local filesystem (`./data/uploads/`) | No cloud. |
| **Maps** | `tileserver-gl` + pre-downloaded **OpenStreetMap `.mbtiles`** | Serves raster tiles on `localhost:8080`. |
| **Frontend** | React 18 + Vite + Tailwind CSS | Reused from current app. |
| **Map UI** | `react-leaflet` (pointed at local tile server) | Reused from current app. |
| **Auth** | `bcrypt` + JWT in localStorage | Single-machine, local-only. |
| **Process manager** | `pm2` | Keeps API + tile server running. |
| **OS** | Ubuntu 22.04 LTS (or Windows 11 with WSL2) | Best Ollama/GPU support. |

---

## 4. Folder Structure

```
entity-analyzer-offline/
├── package.json
├── .env                          # local config (ports, paths, JWT secret)
├── data/
│   ├── analyzer.db                # SQLite database (auto-created)
│   ├── uploads/                   # uploaded PDFs/text files
│   └── tiles/                     # *.mbtiles (OSM raster pack)
├── server/
│   ├── index.js                   # Express app entry
│   ├── db.js                      # better-sqlite3 connection + schema init
│   ├── schema.sql                  # table definitions (mirrors entities)
│   ├── auth.js                    # bcrypt + JWT middleware
│   ├── routes/
│   │   ├── documents.js
│   │   ├── entities.js
│   │   ├── connections.js
│   │   ├── mentions.js
│   │   ├── alerts.js
│   │   ├── notifications.js
│   │   ├── workspaces.js
│   │   └── manifests.js
│   ├── services/
│   │   ├── nerPipeline.js         # PORT of base44/shared/nerPipeline.ts
│   │   ├── alertEngine.js         # PORT of base44/shared/alertEngine.ts
│   │   ├── entityResolution.js   # PORT of base44/shared/entityResolution.ts
│   │   ├── pdfExtract.js          # local PDF → text
│   │   └── ollama.js              # localhost LLM client
│   └── utils/
│       └── normalize.js           # Arabic normalization (from nerPipeline)
└── client/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx                # router (reused, minus Base44 wrappers)
    │   ├── api/
    │   │   └── client.js          # fetch wrapper → localhost:3001
    │   ├── components/            # reused from current app
    │   ├── pages/                  # reused from current app
    │   └── lib/
    │       └── auth.js            # local JWT auth context
    └── tailwind.config.js
```

---

## 5. Data Models (ported 1:1 from current entities)

The current Base44 entities map directly to SQLite tables. Built-in fields (`id`, `created_date`, `updated_date`, `created_by_id`) become real columns.

### `schema.sql`

```sql
-- Users (local auth; replaces Base44's built-in User entity)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'user',
  created_date TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT DEFAULT 'other',
  file_url TEXT,                 -- local path under data/uploads/
  raw_text TEXT,
  summary TEXT,
  status TEXT DEFAULT 'pending',
  entity_count INTEGER DEFAULT 0,
  connection_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_date TEXT DEFAULT (datetime('now')),
  updated_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'person',
  aliases TEXT,                  -- JSON array
  attributes TEXT,                -- JSON object
  notes TEXT,
  photo_url TEXT,
  latitude REAL,
  longitude REAL,
  mention_count INTEGER DEFAULT 1,
  risk_score REAL DEFAULT 0,
  watchlist INTEGER DEFAULT 0,   -- boolean as 0/1
  document_ids TEXT,             -- JSON array
  created_date TEXT DEFAULT (datetime('now')),
  updated_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY,
  source_entity_id TEXT NOT NULL,
  target_entity_id TEXT NOT NULL,
  source_entity_name TEXT,
  target_entity_name TEXT,
  relationship_type TEXT NOT NULL,
  document_id TEXT,
  evidence TEXT,
  strength REAL DEFAULT 1,
  created_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS mentions (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_name TEXT,
  document_id TEXT NOT NULL,
  document_title TEXT,
  context TEXT,
  role TEXT,
  created_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT DEFAULT 'medium',
  rule_id TEXT,
  rule_name TEXT,
  rule_type TEXT,
  entity_ids TEXT,                -- JSON array
  entity_names TEXT,              -- JSON array
  status TEXT DEFAULT 'new',
  triggered_at TEXT,
  details TEXT,                   -- JSON object
  created_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS risk_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL,
  conditions TEXT,                -- JSON object
  severity TEXT DEFAULT 'medium',
  enabled INTEGER DEFAULT 1,
  created_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  entity_id TEXT,
  entity_name TEXT,
  document_id TEXT,
  document_title TEXT,
  severity TEXT DEFAULT 'medium',
  read INTEGER DEFAULT 0,
  created_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  entity_ids TEXT,                -- JSON array
  document_ids TEXT,             -- JSON array
  created_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

CREATE TABLE IF NOT EXISTS manifests (
  id TEXT PRIMARY KEY,
  manifest_type TEXT DEFAULT 'passenger',
  mode TEXT DEFAULT 'air',
  carrier TEXT,
  voyage_number TEXT,
  departure_location TEXT,
  destination_location TEXT,
  departure_datetime TEXT,
  status TEXT DEFAULT 'submitted',
  passengers TEXT,                -- JSON array
  cargo TEXT,                     -- JSON array
  screening_summary TEXT,
  submitted_by TEXT,
  created_date TEXT DEFAULT (datetime('now')),
  created_by_id TEXT
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_connections_source ON connections(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_connections_target ON connections(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_connections_doc ON connections(document_id);
CREATE INDEX IF NOT EXISTS idx_mentions_entity ON mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_mentions_doc ON mentions(document_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, created_date);
```

> JSON columns (`aliases`, `attributes`, `entity_ids`, etc.) are stored as TEXT and parsed with `JSON.parse()` in the service layer. SQLite has native JSON functions if you want to query into them later.

---

## 6. Local LLM Setup (Ollama)

### 6.1 Model choice

| Model | Size on disk | VRAM (GPU) | RAM (CPU fallback) | Arabic quality | Recommendation |
|---|---|---|---|---|---|
| `llama3.1:8b-instruct-q4_K_M` | ~5 GB | ~6 GB | 16 GB | Good | **Default — best balance** |
| `qwen2.5:7b-instruct-q4_K_M` | ~5 GB | ~6 GB | 16 GB | Very good (strong multilingual) | Alternative if Arabic extraction underperforms |
| `llama3.1:70b` | ~40 GB | 2× 24 GB GPUs | 64 GB | Excellent | Only if you have the hardware |
| `phi3:mini` (3.8B) | ~2.5 GB | ~4 GB | 8 GB | Fair | Last resort for low-spec machines |

**Recommended: `llama3.1:8b` for the build, test with `qwen2.5:7b` if Arabic NER quality is insufficient.**

### 6.2 Install (on the ONLINE build machine, before air-gapping)

```bash
# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model while online
ollama pull llama3.1:8b-instruct-q4_K_M

# (Optional) pull the alternative too
ollama pull qwen2.5:7b-instruct-q4_K_M

# Verify it runs
ollama run llama3.1:8b-instruct-q4_K_M "Say hello in Arabic"

# The model files are stored in:
#   Linux:   ~/.ollama/models/
#   Windows: C:\Users\<you>\.ollama\models\
```

### 6.3 Ollama HTTP API (used by the backend)

Ollama exposes an OpenAI-compatible endpoint on `http://localhost:11434`:

```
POST /v1/chat/completions
{
  "model": "llama3.1:8b-instruct-q4_K_M",
  "messages": [{ "role": "user", "content": "<prompt>" }],
  "format": "json",          // forces JSON output — replaces response_json_schema
  "temperature": 0.1,        // low temp for deterministic extraction
  "stream": false
}
```

> **Key difference from the cloud version:** Ollama doesn't enforce a JSON *schema* — it only guarantees JSON *shape* via `"format": "json"`. You must validate the returned JSON in your code and retry once if a required field is missing. The NER prompt already specifies the structure; keep it.

---

## 7. NER Pipeline — Port of `nerPipeline.ts`

The current pipeline (`base44/shared/nerPipeline.ts`) is plain TypeScript and ports almost directly. The **only** change is the LLM call. Below is the ported Node module.

### `server/services/ollama.js`

```js
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.LLM_MODEL || 'llama3.1:8b-instruct-q4_K_M';

export async function invokeLLM({ prompt, expectJson = true }) {
  const body = {
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: false,
    temperature: 0.1,
    ...(expectJson ? { format: 'json' } : {})
  };

  const res = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Ollama error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';

  if (expectJson) {
    // Ollama returns a JSON string; parse and validate
    try {
      return JSON.parse(content);
    } catch (e) {
      // Retry once: ask the model to fix the JSON
      const fix = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'user', content: prompt },
            { role: 'assistant', content },
            { role: 'user', content: 'The previous response was not valid JSON. Return ONLY valid JSON matching the schema, nothing else.' }
          ],
          stream: false, temperature: 0, format: 'json'
        })
      });
      const fixData = await fix.json();
      return JSON.parse(fixData.choices?.[0]?.message?.content || '{}');
    }
  }
  return content;
}
```

### `server/services/nerPipeline.js` (port — LLM call swapped, logic unchanged)

```js
import { invokeLLM } from './ollama.js';
import { norm } from './entityResolution.js';
import { evaluateImmediateAlerts } from './alertEngine.js';
import { db, now } from '../db.js';
import { randomUUID } from 'crypto';

// ── ANALYSIS SCHEMA (identical to current app) ──────────────────────
const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: ['person','organization','phone','email','location','account','date','event','other'] },
          aliases: { type: 'array', items: { type: 'string' } },
          attributes: { type: 'object' },
          role: { type: 'string' }
        },
        required: ['name','type']
      }
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          target: { type: 'string' },
          type: { type: 'string' },
          evidence: { type: 'string' }
        },
        required: ['source','target','type']
      }
    }
  },
  required: ['summary','entities','relationships']
};

// ── ANALYSIS PROMPT (identical to current app) ─────────────────────
const ANALYSIS_PROMPT = `أنت محلل روابط خبير. سيعرض عليك نص مستند (قد يكون تقرير تحليلي، سجل مكالمات هاتفية، معاملة مالية، تقرير شرطة، أو بيان ركاب/شحن لمعبر حدودي). مهمتك:

1. استخرج كل الكيانات: الأشخاص، المنظمات، أرقام الهواتف، البريد الإلكتروني، الأماكن، الحسابات، التواريخ، الأحداث، أرقام الجوازات، الناقلين.
2. لكل كيان، سجّل الاسم كما ورد بالعربية، وكل الأسماء البديلة والصيغ اللاتينية المذكورة، وأي سمات إضافية (الجنسية، رقم الجواز، رقم الهاتف، البريد، المقعد).
3. استخرج كل العلاقات بين الكيانات مع نوع العلاقة بالعربية ونص الدليل المباشر من المستند.
4. اكتب ملخصاً موجزاً.

كن دقيقاً وموضوعياً. لا تخترع معلومات غير موجودة في النص. تعامل مع الأسماء العربية واللاتينية للشخص نفسه ككيان واحد بأسماء بديلة.

قواعد إضافية إلزامية:
5. لهجات وأمزجة: قد يكون النص بالفصحى أو بلهجة عامية (شامية، خليجية، مصرية، مغاربية) أو محادثة غير رسمية. استخرج الأسماء والأماكن والأنواع كما هي مهما كانت اللهجة.
6. توحيد المنظمات: وحّد كل الصيغ الدالة على التنظيم نفسه ضمن كيان منظمة واحدة، وضع كل الصيغ كأسماء بديلة. أمثلة: داعش / ISIL / ISIS / تنظيم الدولة / الدولة الإسلامية / IS ← كيان واحد.
7. التوطين اللاتيني: لكل اسم عربي لشخص أو منظمة، أضف صيغة لاتينية موحّدة كاسم بديل (عمر→Omar، محمد→Mohamed، عبد الله→Abdullah).
8. تجريد جزيئات النسبة: عند ذكر أسماء مثل «طارق المصري» و«Tariq Al-Masri» اعتبرها الشخص نفسه.

أعد الإجابة بصيغة JSON مطابقة تماماً لهذا المخطط:
${JSON.stringify(ANALYSIS_SCHEMA, null, 2)}

نص المستند:
"""${'__TEXT__'}"""`;

export async function runNer({ document_id, userId }) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(document_id);
  if (!doc) return { status: 'failed', error: 'document not found' };

  db.prepare('UPDATE documents SET status = ? WHERE id = ?').run('processing', document_id);

  // 1) Get text: use raw_text if present, else extract from local PDF
  let fullText = doc.raw_text;
  if (!fullText?.trim() && doc.file_url) {
    fullText = await extractPdfText(doc.file_url);
  }
  if (!fullText?.trim()) {
    db.prepare('UPDATE documents SET status=?, error_message=? WHERE id=?')
      .run('failed', 'تعذّر استخراج النص من المستند', document_id);
    return { status: 'failed', error: 'no text' };
  }

  // 2) Clean old mentions/connections for this document
  db.prepare('DELETE FROM mentions WHERE document_id = ?').run(document_id);
  db.prepare('DELETE FROM connections WHERE document_id = ?').run(document_id);

  // 3) Run local LLM (replaces cloud InvokeLLM)
  const llmResult = await invokeLLM({
    prompt: ANALYSIS_PROMPT.replace('__TEXT__', fullText.slice(0, 12000)),
    expectJson: true
  });

  const summary = llmResult.summary || '';
  const entities = Array.isArray(llmResult.entities) ? llmResult.entities : [];
  const relationships = Array.isArray(llmResult.relationships) ? llmResult.relationships : [];

  // 4) Resolve entities (same logic as current app)
  const existing = db.prepare('SELECT * FROM entities').all();
  const byKey = {};
  for (const e of existing) {
    e.aliases = JSON.parse(e.aliases || '[]');
    e.attributes = JSON.parse(e.attributes || '{}');
    e.document_ids = JSON.parse(e.document_ids || '[]');
    byKey[norm(e.name)] = e;
    for (const a of e.aliases) byKey[norm(a)] = e;
  }

  const resolved = {};
  const ensureEntity = (ent) => {
    const key = norm(ent.name);
    if (resolved[key]) return resolved[key];
    let match = byKey[key];
    if (!match && ent.aliases) {
      for (const a of ent.aliases) { if (byKey[norm(a)]) { match = byKey[norm(a)]; break; } }
    }
    if (match) {
      const aliases = [...new Set([...(match.aliases||[]), ...(ent.aliases||[]), ent.name].filter(Boolean))];
      const documentIds = [...new Set([...(match.document_ids||[]), document_id])];
      const attributes = { ...(match.attributes||{}), ...(ent.attributes||{}) };
      db.prepare(`UPDATE entities SET aliases=?, attributes=?, document_ids=?, mention_count=?, updated_date=? WHERE id=?`)
        .run(JSON.stringify(aliases), JSON.stringify(attributes), JSON.stringify(documentIds),
             (match.mention_count||1)+1, now(), match.id);
      const updated = { ...match, aliases, attributes, document_ids: documentIds, mention_count: (match.mention_count||1)+1 };
      byKey[norm(updated.name)] = updated;
      for (const a of updated.aliases) byKey[norm(a)] = updated;
      resolved[norm(updated.name)] = updated; resolved[key] = updated;
      return updated;
    }
    const created = {
      id: randomUUID(), name: ent.name, type: ent.type || 'other',
      aliases: JSON.stringify(ent.aliases || []),
      attributes: JSON.stringify(ent.attributes || {}),
      mention_count: 1, risk_score: 0, watchlist: 0,
      document_ids: JSON.stringify([document_id]), created_by_id: userId
    };
    db.prepare(`INSERT INTO entities (id,name,type,aliases,attributes,mention_count,risk_score,watchlist,document_ids,created_by_id)
               VALUES (@id,@name,@type,@aliases,@attributes,@mention_count,@risk_score,@watchlist,@document_ids,@created_by_id)`)
      .run(created);
    const rec = { ...created, aliases: ent.aliases||[], attributes: ent.attributes||{}, document_ids: [document_id] };
    byKey[norm(rec.name)] = rec; resolved[norm(rec.name)] = rec; resolved[key] = rec;
    return rec;
  };

  for (const ent of entities) {
    if (!ent.name) continue;
    const rec = ensureEntity(ent);
    db.prepare(`INSERT INTO mentions (id,entity_id,entity_name,document_id,document_title,context,role,created_by_id)
               VALUES (?,?,?,?,?,?,?,?)`)
      .run(randomUUID(), rec.id, rec.name, document_id, doc.title, fullText.slice(0,600), ent.role||'', userId);
  }

  // 5) Create connections
  let connectionCount = 0;
  const seenLinks = new Set();
  for (const rel of relationships) {
    const src = resolved[norm(rel.source)];
    const tgt = resolved[norm(rel.target)];
    if (!src || !tgt || src.id === tgt.id) continue;
    const linkKey = [src.id,tgt.id].sort().join('|') + '|' + norm(rel.type);
    if (seenLinks.has(linkKey)) continue;
    seenLinks.add(linkKey);
    db.prepare(`INSERT INTO connections (id,source_entity_id,target_entity_id,source_entity_name,target_entity_name,relationship_type,document_id,evidence,strength,created_by_id)
               VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(randomUUID(), src.id, tgt.id, src.name, tgt.name, rel.type, document_id, rel.evidence||'', 1, userId);
    connectionCount++;
  }

  // 6) Update document
  db.prepare('UPDATE documents SET status=?, raw_text=?, summary=?, entity_count=?, connection_count=?, updated_date=? WHERE id=?')
    .run('processed', fullText, summary, entities.length, connectionCount, now(), document_id);

  // 7) Immediate alerts + in-app notifications (same as current app)
  const resolvedEntities = Object.values(resolved);
  let alertsResult = { alerts_created: 0, alerts: [] };
  try {
    alertsResult = await evaluateImmediateAlerts(resolvedEntities, { document_id, document_title: doc.title }, userId);
  } catch (e) { /* don't fail processing on alert error */ }

  try {
    const highAlerts = (alertsResult.alerts || []).filter(a => a.severity === 'high' || a.severity === 'critical');
    if (highAlerts.length > 0) {
      const stmt = db.prepare(`INSERT INTO notifications (id,title,message,type,entity_id,entity_name,document_id,document_title,severity,read,created_by_id)
                              VALUES (?,?,?,?,?,?,?,?,?,0,?)`);
      const tx = db.transaction((rows) => rows.forEach(r => stmt.run(randomUUID(), ...r)));
      tx(highAlerts.map(a => [
        a.title, a.description||'',
        a.rule_type === 'watchlist' ? 'watchlist_match' : 'high_risk_entity',
        (a.entity_ids||[])[0]||'', (a.entity_names||[])[0]||'',
        (a.details?.document_id)||document_id, (a.details?.document_title)||doc.title,
        a.severity, userId
      ]));
    }
  } catch (e) { /* don't fail on notification error */ }

  return { status: 'processed', entity_count: entities.length, connection_count: connectionCount, summary, alerts: alertsResult };
}

import { extractPdfText } from './pdfExtract.js';
```

### `server/services/pdfExtract.js`

```js
import fs from 'fs';
import pdfParse from 'pdf-parse';

export async function extractPdfText(filePath) {
  const buffer = fs.readFileSync(filePath);
  const data = await pdfParse(buffer);
  return data.text || '';
}
```

---

## 8. Entity Resolution — Port of `entityResolution.ts`

This file is **pure functions with zero platform dependencies** — it ports verbatim. Copy `base44/shared/entityResolution.ts` to `server/services/entityResolution.js` and change only:

```diff
- export function norm(s) { ... }
+ export function norm(s) { ... }   // unchanged
```

**No other changes needed.** The functions `norm`, `arabicToLatin`, `isArabic`, `jaroWinkler`, `soundex`, `nameSimilarity` all work identically in Node.

---

## 9. Alert Engine — Port of `alertEngine.ts`

The alert engine ports with two changes: (1) DB calls become SQLite, (2) `created_by_id` is passed explicitly.

### `server/services/alertEngine.js` (port)

```js
import { db, now } from '../db.js';
import { randomUUID } from 'crypto';

const DEFAULT_PROFILES = [
  { name: 'كيان عالي الخطورة', rule_type: 'risk_threshold', conditions: { min_risk_score: 70 }, severity: 'high', enabled: 1 },
  { name: 'كيان في قائمة المراقبة', rule_type: 'watchlist', conditions: {}, severity: 'critical', enabled: 1 },
  { name: 'كيان محوري', rule_type: 'hub', conditions: { min_degree: 10 }, severity: 'medium', enabled: 1 },
  { name: 'تشارك مكثّف', rule_type: 'co_occurrence', conditions: { min_shared_docs: 2 }, severity: 'medium', enabled: 1 },
  { name: 'عنقود شبكي كبير', rule_type: 'cluster_size', conditions: { min_size: 8 }, severity: 'high', enabled: 1 }
];

export async function ensureDefaultProfiles(userId) {
  let profiles = db.prepare('SELECT * FROM risk_profiles WHERE enabled = 1').all();
  if (profiles.length === 0) {
    const stmt = db.prepare('INSERT INTO risk_profiles (id,name,description,rule_type,conditions,severity,enabled,created_by_id) VALUES (?,?,?,?,?,?,?,?)');
    const tx = db.transaction((rows) => rows.forEach(r => stmt.run(randomUUID(), ...r)));
    tx(DEFAULT_PROFILES.map(p => [p.name, '', p.rule_type, JSON.stringify(p.conditions), p.severity, 1, userId]));
    profiles = db.prepare('SELECT * FROM risk_profiles WHERE enabled = 1').all();
  }
  return profiles.map(p => ({ ...p, conditions: JSON.parse(p.conditions||'{}') }));
}

export async function evaluateImmediateAlerts(entities, context, userId) {
  const profiles = await ensureDefaultProfiles(userId);
  const entById = {}; entities.forEach(e => { entById[e.id] = e; });

  const existing = db.prepare("SELECT * FROM alerts WHERE status != 'resolved'").all();
  const existingKeys = new Set(existing.map(a => {
    const d = JSON.parse(a.details||'{}');
    return (a.rule_id||a.rule_name||'') + '|' + (d.signature||'');
  }));

  const toCreate = [];
  const addAlert = (profile, signature, title, description, entityIds, extra) => {
    const key = (profile.id||profile.name) + '|' + signature;
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    const ents = (entityIds||[]).map(id => entById[id]).filter(Boolean);
    toCreate.push({
      title, description, severity: profile.severity || 'medium',
      rule_id: profile.id||'', rule_name: profile.name, rule_type: profile.rule_type,
      entity_ids: entityIds||[], entity_names: ents.map(e=>e.name), status: 'new',
      triggered_at: now(),
      details: { signature, source: 'document', document_id: context.document_id||'', document_title: context.document_title||'', ...(extra||{}) }
    });
  };

  const docSuffix = context.document_title ? ' — المستند: ' + context.document_title : '';
  for (const p of profiles) {
    const cond = p.conditions || {};
    if (p.rule_type === 'risk_threshold') {
      const min = cond.min_risk_score || 0;
      for (const e of entities) {
        if ((e.risk_score||0) >= min) {
          addAlert(p, 'risk:'+e.id, 'خطورة عالية: '+e.name, 'درجة الخطورة '+(e.risk_score||0)+' تتجاوز العتبة '+min+docSuffix, [e.id], { risk_score: e.risk_score||0 });
        }
      }
    } else if (p.rule_type === 'watchlist') {
      for (const e of entities) {
        if (e.watchlist) addAlert(p, 'watch:'+e.id, 'مطابقة قائمة مراقبة: '+e.name, 'الكيان مُدرج في قائمة المراقبة'+docSuffix, [e.id]);
      }
    }
  }

  let created = 0;
  if (toCreate.length > 0) {
    const stmt = db.prepare(`INSERT INTO alerts (id,title,description,severity,rule_id,rule_name,rule_type,entity_ids,entity_names,status,triggered_at,details,created_by_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const tx = db.transaction((rows) => rows.forEach(r => stmt.run(randomUUID(), r.title, r.description, r.severity, r.rule_id, r.rule_name, r.rule_type, JSON.stringify(r.entity_ids), JSON.stringify(r.entity_names), r.status, r.triggered_at, JSON.stringify(r.details), userId)));
    tx(toCreate);
    created = toCreate.length;
  }
  return { alerts_created: created, alerts: toCreate };
}
```

---

## 10. Offline Maps

### 10.1 Download tiles (on the ONLINE build machine)

Download an OSM extract for your region of interest from [Geofabrik](https://download.geofabrik.de/) (free), then convert to `.mbtiles`:

```bash
# Install tilemaker (converts .osm.pbf → .mbtiles)
sudo apt install tilemaker

# Download a region (e.g., Middle East)
wget https://download.geofabrik.de/asia/middle-east-latest.osm.pbf

# Generate raster .mbtiles (zoom 0-14 is a good range)
tilemaker --input middle-east-latest.osm.pbf \
          --output data/tiles/middle-east.mbtiles \
          --process /usr/share/tilemaker/process.lua \
          --config /usr/share/tilemaker/config-openmaptiles.json
```

> For a global tileset, use [OpenMapTiles](https://openmaptiles.org/) pre-built `.mbtiles` (download while online).

### 10.2 Serve tiles locally

```bash
# Install tileserver-gl
npm install -g tileserver-gl

# Run it against your .mbtiles (on the air-gapped machine)
tileserver-gl --port 8080 --mbtiles data/tiles/middle-east.mbtiles
```

### 10.3 Point Leaflet at the local server

In the frontend, change the `TileLayer` URLs in `GeoTemporalMap.jsx`:

```diff
  url={mapStyle === 'satellite'
-   ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
-   : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'}
+   ? 'http://localhost:8080/data/satellite/{z}/{x}/{y}.png'   // if you have satellite .mbtiles
+   : 'http://localhost:8080/data/middle-east/{z}/{x}/{y}.png'}
```

> Satellite imagery offline requires a commercial/pre-downloaded imagery tileset. For a purely offline build, the **street/OSM** layer is the realistic option; drop the satellite toggle or pre-stage an imagery `.mbtiles` if available.

---

## 11. Local Auth

### `server/auth.js`

```js
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from './db.js';
import { randomUUID } from 'crypto';

const SECRET = process.env.JWT_SECRET || 'change-this-in-production';

export async function register(email, password, fullName) {
  const hash = await bcrypt.hash(password, 10);
  const id = randomUUID();
  db.prepare('INSERT INTO users (id,email,full_name,password_hash,role) VALUES (?,?,?,?,?)')
    .run(id, email, fullName||'', hash, 'admin');  // first user = admin
  return sign({ id, email });
}

export async function login(email, password) {
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) throw new Error('invalid credentials');
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('invalid credentials');
  return sign({ id: user.id, email: user.email });
}

function sign(payload) { return jwt.sign(payload, SECRET, { expiresIn: '30d' }); }

export function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    req.user = jwt.verify(token, SECRET);
    req.user.id = req.user.id;  // available as req.user.id in routes
    next();
  } catch { res.status(401).json({ error: 'invalid token' }); }
}
```

> **First-run bootstrap:** create an admin account on first launch via a CLI script (`node server/cli/create-user.js admin@local <password>`), or auto-create one if the `users` table is empty.

---

## 12. Frontend Port

The React frontend reuses **~90%** of the current code. Changes:

1. **Replace `@/api/base44Client`** with a local fetch wrapper:

### `client/src/api/client.js`

```js
const API = process.env.VITE_API_URL || 'http://localhost:3001/api';
const TOKEN_KEY = 'analyzer_token';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }

async function request(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {})
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (!res.ok) throw new Error((await res.json())?.error || res.statusText);
  return res.json();
}

// Entity-style API mirroring base44.entities.Entity.method()
function makeEntity(name) {
  return {
    list: (sort, limit) => request(`/${name}?sort=${sort||''}&limit=${limit||100}`),
    get: (id) => request(`/${name}/${id}`),
    filter: (q, sort, limit) => request(`/${name}?filter=${encodeURIComponent(JSON.stringify(q))}&sort=${sort||''}&limit=${limit||100}`),
    create: (data) => request(`/${name}`, { method: 'POST', body: data }),
    update: (id, data) => request(`/${name}/${id}`, { method: 'PUT', body: data }),
    delete: (id) => request(`/${name}/${id}`, { method: 'DELETE' }),
    bulkCreate: (rows) => request(`/${name}/bulk`, { method: 'POST', body: rows }),
    bulkUpdate: (rows) => request(`/${name}/bulk`, { method: 'PUT', body: rows }),
    updateMany: (q, op) => request(`/${name}/updateMany`, { method: 'POST', body: { query: q, op } }),
    deleteMany: (q) => request(`/${name}/deleteMany`, { method: 'POST', body: q }),
    subscribe: (cb) => { /* see §13 — WebSocket or polling */ return () => {}; }
  };
}

export const api = {
  auth: {
    me: () => request('/auth/me'),
    login: (email, pw) => request('/auth/login', { method: 'POST', body: { email, password: pw } }),
    register: (email, pw, name) => request('/auth/register', { method: 'POST', body: { email, password: pw, fullName: name } }),
    logout: () => clearToken()
  },
  entities: {
    Document: makeEntity('documents'),
    Entity: makeEntity('entities'),
    Connection: makeEntity('connections'),
    Mention: makeEntity('mentions'),
    Alert: makeEntity('alerts'),
    RiskProfile: makeEntity('risk-profiles'),
    Notification: makeEntity('notifications'),
    Workspace: makeEntity('workspaces'),
    Manifest: makeEntity('manifests')
  },
  functions: {
    invoke: (name, payload) => request(`/functions/${name}`, { method: 'POST', body: payload })
  }
};
```

2. **Find-and-replace** across the frontend:
   - `from '@/api/base44Client'` → `from '@/api/client'`
   - `base44.entities.X` → `api.entities.X`
   - `base44.auth.me()` → `api.auth.me()`
   - `base44.auth.logout()` → `api.auth.logout()`
   - `base44.integrations.Core.UploadFile({file})` → upload to `POST /api/upload` (returns `{ file_url }` = local path)
   - Remove `ProtectedRoute`, `AuthProvider` cloud wrappers → replace with local JWT check.

3. **Realtime subscriptions** — the current app uses `base44.entities.X.subscribe()`. Offline, replace with either:
   - **Polling** (simplest): `setInterval` every 5s on the notifications list.
   - **WebSocket** (better): add `ws` on the Express server, emit on DB writes.

---

## 13. Realtime Notifications (offline)

Since there's no cloud realtime, use **polling** (simplest, reliable):

```js
// In NotificationsBell.jsx, replace subscribe() with:
useEffect(() => {
  let active = true;
  const poll = async () => {
    try {
      const list = await api.entities.Notification.list('-created_date', 30);
      if (!active) return;
      // detect new ones not in seenIds → toast
      list.forEach(n => {
        if (!seenIds.current.has(n.id)) {
          seenIds.current.add(n.id);
          toast({ title: n.title, description: n.message,
                  variant: n.severity==='critical'||n.severity==='high' ? 'destructive' : 'default' });
        }
      });
      setNotifications(list);
    } catch (e) {}
  };
  poll();
  const t = setInterval(poll, 5000);
  return () => { active = false; clearInterval(t); };
}, []);
```

---

## 14. Hardware Specification

### Minimum (CPU-only, slow but functional)

| Component | Spec |
|---|---|
| CPU | Intel i5 / Ryzen 5, 8 threads |
| RAM | **16 GB** |
| GPU | None (Ollama runs on CPU) |
| Storage | 256 GB SSD |
| OS | Ubuntu 22.04 LTS |

> ⚠️ CPU-only LLM inference: a single document (~12k chars) will take **30–90 seconds** to process. Usable for low volume, painful for batch.

### Recommended (GPU-accelerated, production-grade)

| Component | Spec |
|---|---|
| CPU | Intel i7 / Ryzen 7, 8+ cores |
| RAM | **32 GB** |
| GPU | **NVIDIA RTX 3060 12GB** or RTX 4060 12GB (best value) |
| Storage | 512 GB NVMe SSD |
| OS | Ubuntu 22.04 LTS (best CUDA support) |

> GPU inference: ~3–8 seconds per document. Comfortable for real use.

### High-volume (batch processing)

| Component | Spec |
|---|---|
| CPU | Intel i9 / Ryzen 9 |
| RAM | **64 GB** |
| GPU | **NVIDIA RTX 4090 24GB** (or 2× RTX 3090) |
| Storage | 1 TB NVMe SSD |

> Allows running `llama3.1:70b` for maximum extraction quality, or parallel processing of multiple documents.

### VRAM → Model reference

| VRAM | Max model | Notes |
|---|---|---|
| 4 GB | `phi3:mini` (3.8B q4) | Low quality, emergency only |
| 6 GB | `llama3.1:8b` (q4) | **Sweet spot** |
| 8 GB | `qwen2.5:7b` (q5) or `llama3.1:8b` (q6) | Better Arabic |
| 12 GB | `qwen2.5:14b` (q4) | Significantly better |
| 24 GB | `llama3.1:70b` (q2/q3) | Excellent quality |
| 48 GB+ | `llama3.1:70b` (q4/q5) | Best available locally |

---

## 15. Step-by-Step Build & Deploy

### Phase A — Build machine (ONLINE)

```bash
# 1. Install Node 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install Ollama + pull model
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:8b-instruct-q4_K_M

# 3. Install tileserver-gl + tilemaker (for offline maps)
npm install -g tileserver-gl
sudo apt install -y tilemaker

# 4. Download OSM data and generate .mbtiles
wget https://download.geofabrik.de/asia/middle-east-latest.osm.pbf
tilemaker --input middle-east-latest.osm.pbf --output data/tiles/region.mbtiles \
          --process /usr/share/tilemaker/process.lua \
          --config /usr/share/tilemaker/config-openmaptiles.json

# 5. Scaffold the project
mkdir entity-analyzer-offline && cd entity-analyzer-offline
npm init -y
npm install express better-sqlite3 bcrypt jsonwebtoken pdf-parse cors dotenv
npm install -D nodemon

# 6. Create the folder structure from §4
# 7. Copy shared logic:
#    base44/shared/entityResolution.ts → server/services/entityResolution.js
#    base44/shared/nerPipeline.ts      → server/services/nerPipeline.js (per §7)
#    base44/shared/alertEngine.ts      → server/services/alertEngine.js (per §9)
# 8. Copy frontend from current app's src/ → client/src/, apply §12 changes
# 9. Test end-to-end while online:
cd server && npm run dev        # API on :3001
cd ../client && npm install && npm run dev   # UI on :5173
ollama serve                   # LLM on :11434
tileserver-gl --port 8080 --mbtiles data/tiles/region.mbtiles
```

### Phase B — Transfer to air-gapped machine

```bash
# On the build machine, bundle everything:
tar czf analyzer-bundle.tar.gz entity-analyzer-offline/
# Also bundle the Ollama model files:
tar czf ollama-models.tar.gz ~/.ollama/models/
# Copy both to a USB drive, then to the air-gapped machine.
```

### Phase C — Air-gapped machine (OFFLINE)

```bash
# 1. Install Node + Ollama (copy installers via USB, run offline)
sudo dpkg -i nodejs_20.*.deb
sudo dpkg -i ollama_*.deb

# 2. Restore the model
mkdir -p ~/.ollama/models
tar xzf ollama-models.tar.gz -C ~/.ollama/

# 3. Restore the app
tar xzf analyzer-bundle.tar.gz
cd entity-analyzer-offline
npm install --offline     # node_modules can be bundled too

# 4. Start services
ollama serve &                                   # LLM
node server/cli/create-user.js admin@local <pw>  # create admin
node server/index.js &                            # API
tileserver-gl --port 8080 --mbtiles data/tiles/region.mbtiles &  # maps
cd client && npm run build && npx serve dist &    # UI (or run dev)

# 5. Open browser → http://localhost:5173
```

### Phase D — Migrate existing data (optional)

If you want to bring your current cloud data offline:

1. In the current app, export each entity as JSON (build a small export route or use the API).
2. Convert to SQL `INSERT` statements (or a JSON importer script).
3. Run against the offline SQLite DB:
   ```bash
   sqlite3 data/analyzer.db < migrations/import.sql
   ```

---

## 16. What Does NOT Port (and alternatives)

| Current feature | Cloud dependency | Offline alternative |
|---|---|---|
| `InvokeLLM` (cloud) | OpenAI/Google/Anthropic | **Ollama** local LLM (§6–7) |
| `ExtractDataFromUploadedFile` (cloud PDF extraction) | Cloud service | **`pdf-parse`** local (§7) |
| `UploadFile` (cloud storage) | Cloud storage | Local filesystem `data/uploads/` |
| `CreateFileSignedUrl` (private files) | Cloud signed URLs | Serve from local Express route |
| `GenerateImage` (entity photos) | Cloud image AI | Pre-load photos, or use initials avatars |
| `SendEmail` (notifications) | Cloud email | In-app notifications only (already built) |
| `base44.entities.X.subscribe()` (realtime) | Cloud websocket | **Polling** (§13) or local WebSocket |
| Cloud auth (Google OAuth, OTP) | Cloud identity | **Local bcrypt + JWT** (§11) |
| Satellite map tiles | Esri online | Drop satellite, or pre-stage imagery `.mbtiles` |
| `TranscribeAudio` | Cloud Whisper | Local `whisper.cpp` (if needed) |
| `runCepAlerts` scheduled workflow | Cloud scheduler | **`node-cron`** in the Express server |

---

## 17. Maintenance & Updates (offline)

- **Updating the LLM model:** download a new `.gguf` on an online machine, transfer via USB, `ollama create` from the file.
- **Updating OSM tiles:** re-run the Geofabrik download + tilemaker on an online machine, transfer the new `.mbtiles`.
- **Updating the app code:** develop on an online machine, transfer the changed files via USB.
- **Backups:** `data/analyzer.db` is a single file — copy it to USB regularly.

---

## 18. Security Notes for Air-Gapped Deployment

- Since there's no network egress, the JWT secret can be a simple random string (rotate it if the machine is ever briefly online).
- Store the SQLite DB on an **encrypted volume** (LUKS on Linux, BitLocker on Windows) for at-rest protection.
- The local LLM processes document text in-process — no data leaves the machine. This is the primary security benefit of the air-gapped design.
- Physical security of the machine is now your only perimeter — disk encryption + screen lock + BIOS password matter.

---

## 19. Summary Checklist

- [ ] Ubuntu 22.04 machine with 32 GB RAM + RTX 3060 12GB (recommended)
- [ ] Ollama + `llama3.1:8b-instruct-q4_K_M` installed
- [ ] Node 20 + project scaffolded per §4
- [ ] SQLite schema applied (`schema.sql`)
- [ ] `entityResolution.js` copied verbatim
- [ ] `nerPipeline.js` ported (LLM call → Ollama)
- [ ] `alertEngine.js` ported (DB → SQLite)
- [ ] `pdfExtract.js` working on sample PDFs
- [ ] Express routes wired for all entities
- [ ] Local auth (bcrypt + JWT) + admin user created
- [ ] Frontend ported (`base44` → `api` client)
- [ ] Leaflet pointed at local tile server
- [ ] OSM `.mbtiles` downloaded + `tileserver-gl` running
- [ ] Notifications polling working
- [ ] End-to-end test: upload PDF → entities extracted → alert fires → toast appears
- [ ] Machine air-gapped; all services start on boot (pm2 or systemd)

---

*This blueprint is a faithful port of the current Base44-hosted "محلّل الكيانات" system. The entity schemas, NER prompt, entity-resolution algorithms, and alert-engine rules are preserved exactly; only the runtime substrate (cloud → local) changes.*