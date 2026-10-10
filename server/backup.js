import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from './errors.js';
import { object } from './validation.js';
import { fileTypes, MAX_FILE_SIZE, validFileName } from './integrations.js';
import { extname } from 'node:path';

const MAX_BACKUP_BYTES = 128 * 1024 * 1024;

export function exportBackup(store, integrations) {
  const records = Object.fromEntries(Object.keys(store.schemas).map((name) => [name,
    store.db.prepare('SELECT data FROM records WHERE entity = ?').all(name).map((row) => JSON.parse(row.data))
  ]));
  let total = 0;
  const files = store.db.prepare('SELECT * FROM files').all().map((metadata) => {
    const { path } = integrations.file(`/files/${metadata.name}`);
    const bytes = readFileSync(path);
    total += bytes.length;
    assert(total <= MAX_BACKUP_BYTES / 1.4, 413, 'Backup files exceed the 128 MiB export limit');
    return { ...metadata, data: bytes.toString('base64') };
  });
  const backup = { version: 1, exported_at: new Date().toISOString(), records, files };
  assert(Buffer.byteLength(JSON.stringify(backup)) <= MAX_BACKUP_BYTES, 413, 'Backup exceeds 128 MiB');
  return backup;
}

export function importBackup(body, store, integrations, dataDir) {
  object(body, 'backup');
  assert(body.version === 1, 400, 'Unsupported backup version');
  object(body.records, 'records');
  assert(Array.isArray(body.files) && body.files.length <= 10000, 400, 'Invalid backup files');
  const records = [], seen = new Set();
  for (const [name, rows] of Object.entries(body.records)) {
    store.schema(name);
    assert(Array.isArray(rows), 400, 'Invalid backup records');
    assert(rows.length <= 100000 && records.length + rows.length <= 250000, 413, 'Backup contains too many records');
    for (const row of rows) {
      store.validateRecord(name, row);
      const key = `${name}:${row.id}`;
      assert(!seen.has(key), 400, 'Duplicate backup record ID');
      seen.add(key);
      records.push({ name, row });
    }
  }
  const files = [], names = new Set();
  let total = 0;
  for (const file of body.files) {
    object(file, 'file');
    assert(validFileName(file.name) && !names.has(file.name), 400, 'Invalid or duplicate backup file name');
    names.add(file.name);
    assert(typeof file.data === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(file.data) && file.data.length % 4 === 0, 400, 'Invalid base64 file');
    assert(file.data.length <= Math.ceil(MAX_FILE_SIZE / 3) * 4, 413, 'Backup file exceeds 32 MiB');
    const bytes = Buffer.from(file.data, 'base64');
    assert(bytes.toString('base64') === file.data && bytes.length > 0 && bytes.length <= MAX_FILE_SIZE && file.size === bytes.length, 400, 'Invalid backup file size');
    assert(typeof file.original_name === 'string' && file.original_name.length <= 200, 400, 'Invalid original file name');
    const mime = fileTypes[extname(file.name)];
    assert(file.mime === mime, 400, 'Invalid backup file content type');
    total += bytes.length;
    assert(total <= MAX_BACKUP_BYTES, 413, 'Backup files exceed limit');
    files.push({ ...file, bytes });
  }
  const checkReferences = (value, key) => {
    if (typeof value === 'string' && ['file_url', 'photo_url', 'url'].includes(key) && value.startsWith('/files/')) {
      assert(validFileName(value.slice(7)) && names.has(value.slice(7)), 422, 'Backup references a missing or invalid file');
    } else if (value && typeof value === 'object') {
      for (const [field, item] of Object.entries(value)) checkReferences(item, field);
    }
  };
  records.forEach(({ row }) => checkReferences(row));
  const staging = join(dataDir, `.import-${randomUUID()}`);
  const previous = join(dataDir, `.previous-${randomUUID()}`);
  mkdirSync(staging, { mode: 0o700 });
  let swapped = false;
  try {
    for (const file of files) writeFileSync(join(staging, file.name), file.bytes, { flag: 'wx', mode: 0o600 });
    store.transaction(() => {
      const credentialUsers = new Set(store.db.prepare('SELECT user_id FROM credentials').all().map((row) => row.user_id));
      const localUsers = store.db.prepare("SELECT data FROM records WHERE entity = 'User'").all().map((row) => JSON.parse(row.data)).filter((row) => credentialUsers.has(row.id));
      store.db.exec('DELETE FROM records; DELETE FROM files;');
      const insert = store.db.prepare('INSERT INTO records(entity,id,data) VALUES (?,?,?)');
      for (const { name, row } of records) {
        if (name !== 'User' || !credentialUsers.has(row.id)) insert.run(name, row.id, JSON.stringify(row));
      }
      for (const row of localUsers) insert.run('User', row.id, JSON.stringify(row));
      const insertFile = store.db.prepare('INSERT INTO files(name,mime,size,original_name) VALUES (?,?,?,?)');
      for (const file of files) insertFile.run(file.name, file.mime, file.size, file.original_name);
      renameSync(integrations.filesDir, previous);
      try { renameSync(staging, integrations.filesDir); } catch (error) {
        renameSync(previous, integrations.filesDir);
        throw error;
      }
      swapped = true;
    });
  } catch (error) {
    if (swapped) {
      rmSync(integrations.filesDir, { recursive: true, force: true });
      renameSync(previous, integrations.filesDir);
    }
    throw error;
  } finally { rmSync(staging, { recursive: true, force: true }); }
  rmSync(previous, { recursive: true, force: true });
  return { ok: true, records_imported: records.length, files_imported: files.length, accounts_preserved: true };
}
