import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './errors.js';
import { defaults, object, validId, validateJSON } from './validation.js';

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const operators = new Set(['$eq', '$ne', '$in', '$nin', '$gt', '$gte', '$lt', '$lte', '$exists', '$contains', '$all']);

export function validateFilter(filter, depth = 0) {
  assert(depth <= 32, 400, 'Filter nesting exceeds 32 levels');
  object(filter, 'filter');
  for (const [key, value] of Object.entries(filter)) {
    assert(!key.split('.').some((part) => ['__proto__', 'constructor', 'prototype'].includes(part)), 400, 'Unsafe filter');
    if (key === '$and' || key === '$or') {
      assert(Array.isArray(value) && value.length <= 100, 400, 'Invalid logical filter');
      value.forEach((part) => validateFilter(part, depth + 1));
    } else {
      assert(!key.startsWith('$'), 400, `Unsupported filter ${key}`);
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [op, operand] of Object.entries(value)) {
          if (!op.startsWith('$')) continue;
          assert(operators.has(op), 400, `Unsupported operator ${op}`);
          if (['$in', '$nin', '$all'].includes(op)) assert(Array.isArray(operand), 400, `${op} requires an array`);
        }
      }
    }
  }
}

export function matches(record, filter) {
  return Object.entries(filter).every(([key, wanted]) => {
    if (key === '$and') return wanted.every((part) => matches(record, part));
    if (key === '$or') return wanted.some((part) => matches(record, part));
    const actual = key.split('.').reduce((value, field) => value?.[field], record);
    if (!wanted || typeof wanted !== 'object' || Array.isArray(wanted) || !Object.keys(wanted).some((k) => k.startsWith('$'))) {
      return same(actual, wanted) || (Array.isArray(actual) && actual.some((item) => same(item, wanted)));
    }
    return Object.entries(wanted).every(([op, value]) => {
      const equal = same(actual, value) || (Array.isArray(actual) && actual.some((item) => same(item, value)));
      switch (op) {
        case '$eq': return equal;
        case '$ne': return !equal;
        case '$in': return value.some((v) => same(actual, v) || (Array.isArray(actual) && actual.some((item) => same(item, v))));
        case '$nin': return !value.some((v) => same(actual, v) || (Array.isArray(actual) && actual.some((item) => same(item, v))));
        case '$gt': return actual > value;
        case '$gte': return actual >= value;
        case '$lt': return actual < value;
        case '$lte': return actual <= value;
        case '$exists': return value ? actual !== undefined && actual !== null : actual === undefined || actual === null;
        case '$contains': return typeof actual === 'string' ? actual.includes(String(value)) : Array.isArray(actual) && actual.some((v) => same(v, value));
        case '$all': return Array.isArray(actual) && value.every((v) => actual.some((item) => same(v, item)));
        default: return false;
      }
    });
  });
}

export class Store {
  constructor(dataDir) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    chmodSync(dataDir, 0o700);
    this.schemas = Object.fromEntries(readdirSync(new URL('./schemas/', import.meta.url)).filter((f) => f.endsWith('.json')).map((f) => {
      const schema = JSON.parse(readFileSync(new URL(`./schemas/${f}`, import.meta.url), 'utf8'));
      return [f.slice(0, -5), schema];
    }));
    const databasePath = join(dataDir, 'analytics.sqlite');
    this.db = new DatabaseSync(databasePath);
    chmodSync(databasePath, 0o600);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS records (entity TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(entity,id));
      CREATE TABLE IF NOT EXISTS credentials (user_id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, recovery_hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS files (name TEXT PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL, original_name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS index_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE VIRTUAL TABLE IF NOT EXISTS document_search USING fts5(document_id UNINDEXED, title, page UNINDEXED, content, tokenize='unicode61 remove_diacritics 2');
      CREATE TRIGGER IF NOT EXISTS index_document_after_insert AFTER INSERT ON records WHEN NEW.entity = 'Document' BEGIN
        DELETE FROM document_search WHERE document_id = NEW.id;
        INSERT INTO document_search
          SELECT NEW.id, json_extract(NEW.data, '$.title'), CAST(page.key AS INTEGER) + 1, page.value
          FROM json_each(NEW.data, '$.pages') AS page
          WHERE json_type(NEW.data, '$.pages') = 'array' AND typeof(page.value) = 'text' AND length(trim(page.value)) > 0;
        INSERT INTO document_search
          SELECT NEW.id, json_extract(NEW.data, '$.title'), '', json_extract(NEW.data, '$.raw_text')
          WHERE COALESCE(json_array_length(NEW.data, '$.pages'), 0) = 0 AND length(COALESCE(json_extract(NEW.data, '$.raw_text'), '')) > 0;
      END;
      CREATE TRIGGER IF NOT EXISTS index_document_after_update AFTER UPDATE ON records WHEN NEW.entity = 'Document' BEGIN
        DELETE FROM document_search WHERE document_id = NEW.id;
        INSERT INTO document_search
          SELECT NEW.id, json_extract(NEW.data, '$.title'), CAST(page.key AS INTEGER) + 1, page.value
          FROM json_each(NEW.data, '$.pages') AS page
          WHERE json_type(NEW.data, '$.pages') = 'array' AND typeof(page.value) = 'text' AND length(trim(page.value)) > 0;
        INSERT INTO document_search
          SELECT NEW.id, json_extract(NEW.data, '$.title'), '', json_extract(NEW.data, '$.raw_text')
          WHERE COALESCE(json_array_length(NEW.data, '$.pages'), 0) = 0 AND length(COALESCE(json_extract(NEW.data, '$.raw_text'), '')) > 0;
      END;
      CREATE TRIGGER IF NOT EXISTS remove_document_after_delete AFTER DELETE ON records WHEN OLD.entity = 'Document' BEGIN
        DELETE FROM document_search WHERE document_id = OLD.id;
      END;
    `);
    const indexVersion = this.db.prepare('SELECT value FROM index_metadata WHERE key = ?').get('document_search_version')?.value;
    if (indexVersion !== '1') {
      this.transaction(() => {
        this.db.prepare("UPDATE records SET data = data WHERE entity = 'Document'").run();
        this.db.prepare('INSERT OR REPLACE INTO index_metadata(key, value) VALUES (?, ?)').run('document_search_version', '1');
      });
    }
  }

  schema(name) {
    assert(Object.hasOwn(this.schemas, name), 404, 'Unknown entity');
    return this.schemas[name];
  }

  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  list(name, filter = {}, sort = '-created_date', limit = 10000, skip = 0) {
    this.schema(name);
    validateFilter(filter);
    assert(Number.isInteger(limit) && limit >= 0 && limit <= 10000, 400, 'limit must be between 0 and 10000');
    assert(Number.isInteger(skip) && skip >= 0 && skip <= 1000000, 400, 'Invalid skip');
    assert(typeof sort === 'string' && sort.length <= 200, 400, 'Invalid sort');
    const rows = this.db.prepare('SELECT data FROM records WHERE entity = ?').all(name).map((r) => JSON.parse(r.data)).filter((r) => matches(r, filter));
    const fields = sort.split(',').map((s) => s.trim()).filter(Boolean);
    rows.sort((a, b) => {
      for (const spec of fields) {
        const direction = spec.startsWith('-') ? -1 : 1;
        const field = spec.replace(/^[+-]/, '');
        const av = a[field], bv = b[field];
        if (same(av, bv)) continue;
        if (av == null) return -direction;
        if (bv == null) return direction;
        return (av < bv ? -1 : 1) * direction;
      }
      return a.id.localeCompare(b.id);
    });
    return rows.slice(skip, skip + limit);
  }

  get(name, id) {
    this.schema(name);
    assert(validId(id), 400, 'Invalid record ID');
    const row = this.db.prepare('SELECT data FROM records WHERE entity = ? AND id = ?').get(name, id);
    return row ? JSON.parse(row.data) : null;
  }

  validateRecord(name, data) {
    object(data);
    validateJSON(data, this.schema(name));
    assert(validId(data.id), 422, 'Invalid record ID');
    assert(typeof data.created_by === 'string', 422, 'Invalid created_by');
    for (const field of ['created_date', 'updated_date']) assert(typeof data[field] === 'string' && Number.isFinite(Date.parse(data[field])), 422, `Invalid ${field}`);
    if (name === 'User') {
      const allowed = new Set(['id', 'created_date', 'updated_date', 'created_by', 'email', 'full_name', 'role']);
      assert(Object.keys(data).every((field) => allowed.has(field)), 422, 'Invalid user field');
      assert(typeof data.email === 'string' && data.email.length <= 254, 422, 'Invalid user email');
    }
    return data;
  }

  create(name, data, user) {
    object(data);
    const now = new Date().toISOString();
    const record = defaults(JSON.parse(JSON.stringify({ ...data, id: randomUUID(), created_date: now, updated_date: now, created_by: user.email })), this.schema(name));
    this.validateRecord(name, record);
    this.db.prepare('INSERT INTO records(entity,id,data) VALUES (?,?,?)').run(name, record.id, JSON.stringify(record));
    return record;
  }

  update(name, id, data) {
    object(data);
    const current = this.get(name, id);
    assert(current, 404, 'Record not found');
    const patch = data.$set ? object(data.$set, '$set') : data;
    const record = JSON.parse(JSON.stringify({ ...current, ...patch, id: current.id, created_by: current.created_by, created_date: current.created_date, updated_date: new Date().toISOString() }));
    this.validateRecord(name, record);
    this.db.prepare('UPDATE records SET data = ? WHERE entity = ? AND id = ?').run(JSON.stringify(record), name, id);
    return record;
  }

  delete(name, id) {
    assert(this.get(name, id), 404, 'Record not found');
    this.db.prepare('DELETE FROM records WHERE entity = ? AND id = ?').run(name, id);
    return { id, deleted: true };
  }

  searchDocuments(query, limit = 80) {
    assert(typeof query === 'string' && query.length <= 5000, 400, 'Invalid document search query');
    assert(Number.isInteger(limit) && limit >= 1 && limit <= 200, 400, 'Invalid document search limit');
    const rawTokens = [...new Set(query.normalize('NFD')
      .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu) || [])].filter((token) => token.length > 1);
    const tokenSet = new Set();
    for (const token of rawTokens) {
      const folded = token.replace(/[أإآٱ]/g, 'ا').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ى/g, 'ي');
      const baseVariants = new Set([token, folded, folded.replace(/ة/g, 'ه'), folded.replace(/ه/g, 'ة')]);
      for (const variant of baseVariants) {
        if (variant.length < 2) continue;
        tokenSet.add(variant);
        if (variant.startsWith('ال') && variant.length > 4) tokenSet.add(variant.slice(2));
        else if (!variant.startsWith('ال') && variant.length > 3) tokenSet.add(`ال${variant}`);
      }
    }
    const tokens = [...tokenSet];
    if (!tokens.length) return [];
    const match = tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' OR ');
    return this.db.prepare(`
      SELECT document_search.document_id, document_search.title, document_search.page,
        document_search.content, bm25(document_search) AS rank
      FROM document_search
      JOIN records ON records.entity = 'Document' AND records.id = document_search.document_id
      WHERE document_search MATCH ? AND json_extract(records.data, '$.status') = 'processed'
      ORDER BY rank
      LIMIT ?
    `).all(match, limit).map((row) => ({
      document_id: row.document_id,
      title: row.title,
      page: row.page ? Number(row.page) : null,
      text: row.content,
      rank: row.rank
    }));
  }

  countRecords(name, filters = {}) {
    this.schema(name);
    object(filters, 'count filters');
    const allowed = name === 'Entity' ? new Set(['type'])
      : name === 'Document' || name === 'Alert' ? new Set(['status'])
        : new Set();
    assert(Object.keys(filters).every((key) => allowed.has(key)), 400, 'Unsupported count filter');
    const clauses = ['entity = ?'];
    const values = [name];
    for (const [key, value] of Object.entries(filters)) {
      assert(typeof value === 'string', 400, 'Invalid count filter value');
      clauses.push(`json_extract(data, '$.${key}') = ?`);
      values.push(value);
    }
    return this.db.prepare(`SELECT COUNT(*) AS count FROM records WHERE ${clauses.join(' AND ')}`).get(...values).count;
  }

  restore(name, record) {
    this.validateRecord(name, record);
    assert(!this.get(name, record.id), 409, 'Record already exists');
    this.db.prepare('INSERT INTO records(entity,id,data) VALUES (?,?,?)').run(name, record.id, JSON.stringify(record));
    return record;
  }

  exportRecords() {
    return Object.fromEntries(Object.keys(this.schemas).map((name) => [name,
      this.db.prepare('SELECT data FROM records WHERE entity = ?').all(name).map((row) => JSON.parse(row.data))
    ]));
  }

  close() { this.db.close(); }
}
