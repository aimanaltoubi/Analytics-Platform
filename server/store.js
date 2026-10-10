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
    `);
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

  exportRecords() {
    return Object.fromEntries(Object.keys(this.schemas).map((name) => [name,
      this.db.prepare('SELECT data FROM records WHERE entity = ?').all(name).map((row) => JSON.parse(row.data))
    ]));
  }

  close() { this.db.close(); }
}
