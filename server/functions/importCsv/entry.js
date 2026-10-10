import { createClientFromRequest } from '../../client.js';

const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const ROW_SCHEMA = {
  type: 'object',
  properties: {
    rows: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true
      }
    }
  },
  required: ['rows']
};

const NAME_KEYS = ['name', 'الاسم', 'اسم', 'full_name', 'title', 'العنوان'];
const TYPE_KEYS = ['type', 'النوع', 'نوع', 'category', 'الفئة'];
const SOURCE_KEYS = ['source', 'المصدر', 'from', 'من'];
const TARGET_KEYS = ['target', 'الهدف', 'to', 'إلى'];
const REL_KEYS = ['relationship', 'العلاقة', 'relation', 'rel'];

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);

    const body = await req.json();
    const { file_url, title, document_type } = body;
    if (!file_url) return Response.json({ error: 'file_url مطلوب' }, { status: 400 });

    const doc = await localClient.entities.Document.create({
      title: title || 'استيراد CSV',
      document_type: document_type || 'other',
      file_url,
      status: 'processing'
    });

    let extraction;
    try {
      extraction = await localClient.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: ROW_SCHEMA
      });
    } catch (error) {
      await localClient.entities.Document.update(doc.id, { status: 'failed', error_message: error.message });
      throw error;
    }

    const output = extraction && extraction.output;
    const rows = Array.isArray(output) ? output : (output && Array.isArray(output.rows) ? output.rows : []);
    if (!rows.length) {
      await localClient.entities.Document.update(doc.id, { status: 'failed', error_message: 'لا توجد صفوف صالحة في الملف' });
      return Response.json({ error: 'لا توجد صفوف صالحة في الملف' }, { status: 422 });
    }

    const keys = Object.keys(rows[0] || {});
    const findKey = (candidates) => keys.find((k) => candidates.includes(normalize(k)));
    const nameKey = findKey(NAME_KEYS) || keys[0];
    const typeKey = findKey(TYPE_KEYS);
    const sourceKey = findKey(SOURCE_KEYS);
    const targetKey = findKey(TARGET_KEYS);
    const relKey = findKey(REL_KEYS);

    const existing = await localClient.entities.Entity.filter({});
    const byKey = Object.create(null);
    for (const e of existing) {
      byKey[normalize(e.name)] = e;
      for (const a of (e.aliases || [])) byKey[normalize(a)] = e;
    }

    const resolved = Object.create(null);
    const ensureEntity = async (name, type, attributes) => {
      const key = normalize(name);
      if (resolved[key]) return resolved[key];
      const match = byKey[key];
      if (match) {
        const attrs = { ...(match.attributes || {}), ...attributes };
        const documentIds = new Set(match.document_ids || []);
        documentIds.add(doc.id);
        const updated = await localClient.entities.Entity.update(match.id, {
          attributes: attrs,
          document_ids: Array.from(documentIds),
          mention_count: (match.mention_count || 1) + 1
        });
        byKey[normalize(updated.name)] = updated;
        resolved[key] = updated;
        return updated;
      }
      const created = await localClient.entities.Entity.create({
        name, type: type || 'other', attributes: attributes || {},
        mention_count: 1, risk_score: 0, document_ids: [doc.id]
      });
      byKey[normalize(created.name)] = created;
      resolved[key] = created;
      return created;
    };

    let entityCount = 0;
    for (const row of rows) {
      const name = row[nameKey];
      if (name == null || name === '') continue;
      const type = typeKey ? row[typeKey] : 'other';
      const attributes = Object.create(null);
      for (const k of keys) {
        if (k === nameKey || k === typeKey || k === sourceKey || k === targetKey || k === relKey) continue;
        if (row[k] != null && row[k] !== '') attributes[k] = row[k];
      }
      await ensureEntity(String(name), type, attributes);
      entityCount++;
    }

    let connectionCount = 0;
    if (sourceKey && targetKey) {
      for (const row of rows) {
        const srcName = row[sourceKey];
        const tgtName = row[targetKey];
        if (!srcName || !tgtName) continue;
        const src = resolved[normalize(srcName)] || byKey[normalize(srcName)];
        const tgt = resolved[normalize(tgtName)] || byKey[normalize(tgtName)];
        if (!src || !tgt || src.id === tgt.id) continue;
        await localClient.entities.Connection.create({
          source_entity_id: src.id, target_entity_id: tgt.id,
          source_entity_name: src.name, target_entity_name: tgt.name,
          relationship_type: (relKey ? row[relKey] : '') || 'مرتبط بـ',
          document_id: doc.id, evidence: '', strength: 1
        });
        connectionCount++;
      }
    }

    await localClient.entities.Document.update(doc.id, {
      status: 'processed',
      entity_count: entityCount,
      connection_count: connectionCount
    });

    return Response.json({
      status: 'processed',
      entity_count: entityCount,
      connection_count: connectionCount,
      document_id: doc.id,
      columns: keys
    });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}