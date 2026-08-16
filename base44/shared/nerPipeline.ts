import { evaluateImmediateAlerts } from './alertEngine.ts';

// محرك استخراج الكيانات والعلاقات المشترك — يستخدمه processDocument و processManifest

// تطبيع عربي شامل: تجريد التشكيل وتوحيد الألف والياء والتاء المربوطة،
// ثم تجريد جزيئات النسبة والتعريف (أل/بن/أبو/al-/bin-) لعزل الجذر الصوتي للمطابقة
function stripParticles(s) {
  let r = s;
  r = r.replace(/\b(al|el|bin|ibn|abu|ben|bint|abdul)[\-\s]?/g, ' ');
  r = r.replace(/\b(al|el|bin|ibn|abu|ben|bint|abdul)\b/g, ' ');
  r = r.replace(/(?:^|\s)ال/g, ' ');
  for (const p of ['ابن', 'بن', 'أبو', 'ابو', 'أبي']) {
    r = r.replace(new RegExp('(?:^|\\s)' + p + '(?:\\s|$)', 'g'), ' ');
  }
  return r.replace(/\s+/g, ' ').trim();
}

const normalize = (s) => stripParticles(
  (s || '').toString()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
);

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
          attributes: { type: 'object', description: 'سمات إضافية مثل الجنسية، الرتبة، البريد، رقم الهاتف، التاريخ، رقم الجواز' },
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
          type: { type: 'string', description: 'نوع العلاقة بالعربية مثل: شارك في، تواصل مع، زار، تبادل بريد، معاملة مالية، مرتبط بـ، مسافر على، مرسَل إلى' },
          evidence: { type: 'string', description: 'النص الدال على العلاقة من المستند' }
        },
        required: ['source', 'target', 'type']
      }
    }
  },
  required: ['summary', 'entities', 'relationships']
};

const ANALYSIS_PROMPT = `أنت محلل روابط خبير. سيعرض عليك نص مستند (قد يكون تقرير تحليلي، سجل مكالمات هاتفية، معاملة مالية، تقرير شرطة، أو بيان ركاب/شحن لمعبر حدودي). مهمتك:

1. استخرج كل الكيانات: الأشخاص، المنظمات، أرقام الهواتف، البريد الإلكتروني، الأماكن، الحسابات، التواريخ، الأحداث، أرقام الجوازات، الناقلين.
2. لكل كيان، سجّل الاسم كما ورد بالعربية، وكل الأسماء البديلة والصيغ اللاتينية المذكورة، وأي سمات إضافية (الجنسية، رقم الجواز، رقم الهاتف، البريد، المقعد).
3. استخرج كل العلاقات بين الكيانات مع نوع العلاقة بالعربية ونص الدليل المباشر من المستند.
4. اكتب ملخصاً موجزاً.

كن دقيقاً وموضوعياً. لا تخترع معلومات غير موجودة في النص. تعامل مع الأسماء العربية واللاتينية للشخص نفسه ككيان واحد بأسماء بديلة.

قواعد إضافية إلزامية:
5. لهجات وأمزجة: قد يكون النص بالفصحى أو بلهجة عامية (شامية، خليجية، مصرية، مغاربية) أو محادثة غير رسمية. استخرج الأسماء والأماكن والأنواع كما هي مهما كانت اللهجة.
6. توحيد المنظمات: وحّد كل الصيغ الدالة على التنظيم نفسه ضمن كيان منظمة واحد، وضع كل الصيغ كأسماء بديلة. أمثلة: داعش / ISIL / ISIS / تنظيم الدولة / الدولة الإسلامية / IS ← كيان واحد. كذلك الأسماء المختصرة والألقاب التنظيمية.
7. التوطين اللاتيني: لكل اسم عربي لشخص أو منظمة، أضف صيغة لاتينية موحّدة كاسم بديل (عمر→Omar، محمد→Mohamed، عبد الله→Abdullah) وفق خط أساس صوتي موحد، لتطابق قوائم المراقبة الدولية مهما كانت طريقة كتابة الاسم.
8. تجريد جزيئات النسبة: عند ذكر أسماء مثل «طارق المصري» و«طارق المصري» و«Tariq Al-Masri» اعتبرها الشخص نفسه (أل التعريف و بن/أبو تُجرد آلياً لاحقاً في المطابقة).

نص المستند:
"""${'__TEXT__'}"""`;

/**
 * يشغّل تحليل NER على نص كامل ويُنشئ/يُحدّث الكيانات والروابط والذكر للمستند المعطى.
 * @param base44 عميل base44 (مع صلاحية asServiceRole للعمليات الداخلية)
 * @param doc سجل المستند (يستخدم title)
 * @param document_id معرّف المستند
 * @param fullText النص الكامل المراد تحليله
 */
export async function runNer(base44, doc, document_id, fullText) {
  if (!fullText || !fullText.trim()) {
    await base44.entities.Document.update(document_id, {
      status: 'failed',
      error_message: 'تعذّر استخراج النص من المستند'
    });
    return { status: 'failed', error: 'no text' };
  }

  // تنظيف الذكر والروابط القديمة لهذا المستند
  await base44.asServiceRole.entities.Mention.deleteMany({ document_id });
  await base44.asServiceRole.entities.Connection.deleteMany({ document_id });

  const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: ANALYSIS_PROMPT.replace('__TEXT__', fullText.slice(0, 12000)),
    response_json_schema: ANALYSIS_SCHEMA
  });

  const summary = llmResult.summary || '';
  const entities = Array.isArray(llmResult.entities) ? llmResult.entities : [];
  const relationships = Array.isArray(llmResult.relationships) ? llmResult.relationships : [];

  // حلّ الكيانات
  const existing = await base44.entities.Entity.filter({});
  const byKey = {};
  for (const e of existing) {
    byKey[normalize(e.name)] = e;
    for (const a of (e.aliases || [])) byKey[normalize(a)] = e;
  }

  const resolved = {};
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
    await base44.entities.Mention.create({
      entity_id: rec.id,
      entity_name: rec.name,
      document_id,
      document_title: doc.title,
      context: fullText.slice(0, 600),
      role: ent.role || ''
    });
  }

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
      document_id,
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

  // تنبيه فوري: مطابقة الكيانات المستخرجة مقابل قوائم المراقبة وملفات الخطر
  const resolvedEntities = Object.values(resolved);
  let alertsResult = { alerts_created: 0 };
  try {
    alertsResult = await evaluateImmediateAlerts(base44, resolvedEntities, { document_id, document_title: doc.title });
  } catch (e) {
    // لا تفشل المعالجة بسبب التنبيه
  }

  // تنبيه داخل التطبيق للكيانات عالية الخطورة المكتشفة في هذا المستند
  try {
    const highAlerts = (alertsResult.alerts || []).filter(
      (a) => a.severity === 'high' || a.severity === 'critical'
    );
    if (highAlerts.length > 0) {
      await base44.entities.Notification.bulkCreate(
        highAlerts.map((a) => ({
          title: a.title,
          message: a.description || '',
          type: a.rule_type === 'watchlist' ? 'watchlist_match' : 'high_risk_entity',
          entity_id: (a.entity_ids || [])[0] || '',
          entity_name: (a.entity_names || [])[0] || '',
          document_id: (a.details && a.details.document_id) || document_id,
          document_title: (a.details && a.details.document_title) || doc.title,
          severity: a.severity,
          read: false
        }))
      );
    }
  } catch (e) {
    // لا تفشل المعالجة بسبب التنبيه الداخلي
  }

  return { status: 'processed', entity_count: entities.length, connection_count: connectionCount, summary, alerts: alertsResult };
}