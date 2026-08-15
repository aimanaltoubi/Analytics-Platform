import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    pages: { type: 'array', items: { type: 'string' } }
  },
  required: ['text']
};

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string', description: 'ملخص موجز بالعربية للمستند وأبرز ما فيه' },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'الاسم الأساسي للكيان كما ورد' },
          type: { type: 'string', enum: ['person', 'organization', 'phone', 'email', 'location', 'account', 'date', 'event', 'other'] },
          aliases: { type: 'array', items: { type: 'string' }, description: 'كل الأسماء البديلة والصيغ اللاتينية إن وُجدت' },
          attributes: { type: 'object', description: 'سمات إضافية مثل الجنسية، الرتبة، البريد، رقم الهاتف، التاريخ' },
          role: { type: 'string', description: 'دور الكيان في المستند' }
        },
        required: ['name', 'type']
      }
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source: { type: 'string', description: 'اسم الكيان المصدر (يطابق name)' },
          target: { type: 'string', description: 'اسم الكيان الهدف (يطابق name)' },
          type: { type: 'string', description: 'نوع العلاقة بالعربية مثل: شارك في، تواصل مع، زار، تبادل بريد، معاملة مالية، مرتبط بـ' },
          evidence: { type: 'string', description: 'النص الدال على العلاقة من المستند' }
        },
        required: ['source', 'target', 'type']
      }
    }
  },
  required: ['summary', 'entities', 'relationships']
};

const ANALYSIS_PROMPT = `أنت محلل استخباراتي خبير. سيعرض عليك نص مستند (قد يكون تقرير استخباراتي، سجل مكالمات هاتفية، معاملة مالية، أو تقرير شرطة). مهمتك:

1. استخرج كل الكيانات: الأشخاص، المنظمات، أرقام الهواتف، البريد الإلكتروني، الأماكن، الحسابات، التواريخ، الأحداث.
2. لكل كيان، سجّل الاسم كما ورد بالعربية، وكل الأسماء البديلة والصيغ اللاتينية المذكورة (مثل "Ziad Barakat" لـ "زياد بركات")، وأي سمات إضافية (الجنسية، الرتبة، البريد، الهاتف).
3. استخرج كل العلاقات بين الكيانات مع نوع العلاقة بالعربية ونص الدليل المباشر من المستند.
4. اكتب ملخصاً موجزاً.

كن دقيقاً وموضوعياً. لا تخترع معلومات غير موجودة في النص. تعامل مع الأسماء العربية واللاتينية للشخص نفسه ككيان واحد بأسماء بديلة.

نص المستند:
"""${'__TEXT__'}"""`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { document_id } = body;
    if (!document_id) return Response.json({ error: 'document_id مطلوب' }, { status: 400 });

    const doc = await base44.entities.Document.get(document_id);
    if (!doc || doc.created_by_id !== user.id) {
      return Response.json({ error: 'المستند غير موجود' }, { status: 404 });
    }

    await base44.entities.Document.update(document_id, { status: 'processing', error_message: '' });

    // 0) تنظيف الذكر والروابط القديمة لهذا المستند (لإعادة المعالجة بدون تكرار)
    await base44.asServiceRole.entities.Mention.deleteMany({ document_id });
    await base44.asServiceRole.entities.Connection.deleteMany({ document_id });

    // 1) استخراج النص من ملف PDF
    const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: doc.file_url,
      json_schema: EXTRACTION_SCHEMA
    });

    const output = extraction && extraction.output;
    let fullText = '';
    if (output) {
      if (typeof output.text === 'string' && output.text.trim()) {
        fullText = output.text;
      } else if (Array.isArray(output.pages)) {
        fullText = output.pages.join('\n\n');
      } else if (typeof output === 'string') {
        fullText = output;
      }
    }

    if (!fullText.trim()) {
      await base44.entities.Document.update(document_id, {
        status: 'failed',
        error_message: 'تعذّر استخراج النص من المستند'
      });
      return Response.json({ error: 'تعذّر استخراج النص من المستند' }, { status: 422 });
    }

    // 2) تحليل بالنموذج اللغوي لاستخراج الكيانات والعلاقات
    const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: ANALYSIS_PROMPT.replace('__TEXT__', fullText.slice(0, 12000)),
      response_json_schema: ANALYSIS_SCHEMA
    });

    const summary = llmResult.summary || '';
    const entities = Array.isArray(llmResult.entities) ? llmResult.entities : [];
    const relationships = Array.isArray(llmResult.relationships) ? llmResult.relationships : [];

    // 3) حلّ الكيانات: مطابقة مع الكيانات الموجودة بالاسم أو الأسماء البديلة
    const existing = await base44.entities.Entity.filter({});
    const byKey = {};
    for (const e of existing) {
      byKey[normalize(e.name)] = e;
      for (const a of (e.aliases || [])) {
        byKey[normalize(a)] = e;
      }
    }

    const resolved = {}; // normalized name -> entity record
    const ensureEntity = async (ent) => {
      const key = normalize(ent.name);
      if (resolved[key]) return resolved[key];
      let match = byKey[key];
      if (!match && ent.aliases) {
        for (const a of ent.aliases) {
          if (byKey[normalize(a)]) { match = byKey[normalize(a)]; break; }
        }
      }
      if (match) {
        const aliases = new Set(match.aliases || []);
        if (ent.aliases) ent.aliases.forEach((a) => aliases.add(a));
        if (ent.name && ent.name !== match.name) aliases.add(ent.name);
        const documentIds = new Set(match.document_ids || []);
        documentIds.add(document_id);
        const attrs = { ...(match.attributes || {}), ...(ent.attributes || {}) };
        const updated = await base44.entities.Entity.update(match.id, {
          aliases: Array.from(aliases),
          document_ids: Array.from(documentIds),
          attributes: attrs,
          mention_count: (match.mention_count || 1) + 1
        });
        byKey[normalize(updated.name)] = updated;
        for (const a of updated.aliases || []) byKey[normalize(a)] = updated;
        resolved[normalize(updated.name)] = updated;
        resolved[key] = updated;
        return updated;
      }
      const created = await base44.entities.Entity.create({
        name: ent.name,
        type: ent.type || 'other',
        aliases: ent.aliases || [],
        attributes: ent.attributes || {},
        mention_count: 1,
        risk_score: 0,
        document_ids: [document_id]
      });
      byKey[normalize(created.name)] = created;
      resolved[normalize(created.name)] = created;
      resolved[key] = created;
      return created;
    };

    for (const ent of entities) {
      if (!ent.name) continue;
      const rec = await ensureEntity(ent);
      // سجّل ذكراً للكيان في هذا المستند
      await base44.entities.Mention.create({
        entity_id: rec.id,
        entity_name: rec.name,
        document_id: document_id,
        document_title: doc.title,
        context: fullText.slice(0, 600),
        role: ent.role || ''
      });
    }

    // 4) إنشاء الروابط
    let connectionCount = 0;
    const seenLinks = new Set();
    for (const rel of relationships) {
      const src = resolved[normalize(rel.source)];
      const tgt = resolved[normalize(rel.target)];
      if (!src || !tgt || src.id === tgt.id) continue;
      const linkKey = [src.id, tgt.id].sort().join('|') + '|' + normalize(rel.type);
      if (seenLinks.has(linkKey)) continue;
      seenLinks.add(linkKey);
      await base44.entities.Connection.create({
        source_entity_id: src.id,
        target_entity_id: tgt.id,
        source_entity_name: src.name,
        target_entity_name: tgt.name,
        relationship_type: rel.type,
        document_id: document_id,
        evidence: rel.evidence || '',
        strength: 1
      });
      connectionCount++;
    }

    await base44.entities.Document.update(document_id, {
      status: 'processed',
      raw_text: fullText,
      summary,
      entity_count: entities.length,
      connection_count: connectionCount
    });

    return Response.json({
      status: 'processed',
      entity_count: entities.length,
      connection_count: connectionCount,
      summary
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}