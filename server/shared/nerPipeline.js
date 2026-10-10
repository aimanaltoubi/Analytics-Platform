import { evaluateImmediateAlerts } from './alertEngine.js';

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

const entityKey = (name, type = 'other') => `${String(type || 'other')}::${normalize(name)}`;

const hasGroundedName = (fullText, name, aliases = []) => {
  const hay = normalize(fullText || '');
  const variants = [name, ...aliases].map((value) => normalize(value)).filter(Boolean);
  return variants.some((variant) => variant && hay.includes(variant));
};

const sanitizeExtractedData = (entities, relationships, fullText) => {
  const groundedEntities = (Array.isArray(entities) ? entities : []).filter((ent) => {
    if (!ent || !ent.name) return false;
    return hasGroundedName(fullText, ent.name, ent.aliases || []);
  });

  const groundedRelationships = (Array.isArray(relationships) ? relationships : []).filter((rel) => {
    if (!rel || !rel.source || !rel.target) return false;
    const sourceGrounded = groundedEntities.some((ent) => normalize(ent.name) === normalize(rel.source) || (ent.aliases || []).some((alias) => normalize(alias) === normalize(rel.source)));
    const targetGrounded = groundedEntities.some((ent) => normalize(ent.name) === normalize(rel.target) || (ent.aliases || []).some((alias) => normalize(alias) === normalize(rel.target)));
    if (!sourceGrounded || !targetGrounded) return false;
    const evidenceText = rel.evidence || '';
    return evidenceText.trim().length > 0 || Boolean(rel.type);
  });

  return { entities: groundedEntities, relationships: groundedRelationships };
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

// يستخرج التاريخ المرجعي للمستند من كيانات التاريخ التي استخرجها النموذج،
// مع التراجع إلى التاريخ المهيمن في النص. يُرجع سلسلة ISO (YYYY-MM-DD) أو فارغ.
function extractReferenceDate(entities, fullText) {
  const dateEntities = (entities || []).filter((e) => e.type === 'date' && e.name);
  // 1) تاريخ ISO كامل من كيان تاريخ صريح
  for (const d of dateEntities) {
    const m = String(d.name).match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  }
  // 2) العام المهيمن من كيانات التاريخ، ثم من النص كردي أخير
  const yearCounts = Object.create(null);
  const addYears = (s) => {
    const ms = String(s || '').match(/\b(19|20)\d{2}\b/g);
    if (ms) for (const y of ms) yearCounts[y] = (yearCounts[y] || 0) + 1;
  };
  dateEntities.forEach((d) => addYears(d.name));
  if (Object.keys(yearCounts).length === 0) addYears((fullText || '').slice(0, 4000));
  let bestYear = null, bestCount = 0;
  for (const [y, c] of Object.entries(yearCounts)) {
    if (c > bestCount) { bestYear = y; bestCount = c; }
  }
  return bestYear ? `${bestYear}-01-01` : '';
}

// يُودع المستند تلقائياً في ملف تحليلات العام المرجعي (Workspace)،
// ويُنشئ الملف إن لم يكن موجوداً. يُضيف المستند والكيانات المستخرجة إليه.
async function fileIntoYearDossier(localClient, document_id, referenceDate, resolvedEntities) {
  if (!referenceDate) return;
  const year = referenceDate.slice(0, 4);
  const wsName = `تحليلات ${year}`;
    const existing = await localClient.entities.Workspace.filter({ name: wsName });
    let ws = existing[0];
    const entityIds = (resolvedEntities || []).map((e) => e.id).filter(Boolean);
    if (!ws) {
      ws = await localClient.entities.Workspace.create({
        name: wsName,
        description: `ملف تحليلات عام ${year} — يُجمّع تلقائياً المستندات والكيانات المستخرجة من ذلك العام.`,
        document_ids: [document_id],
        entity_ids: entityIds
      });
    } else {
      const docIds = new Set(ws.document_ids || []);
      docIds.add(document_id);
      const entIds = new Set(ws.entity_ids || []);
      entityIds.forEach((id) => entIds.add(id));
      await localClient.entities.Workspace.update(ws.id, {
        document_ids: Array.from(docIds),
        entity_ids: Array.from(entIds)
      });
    }
}

/**
 * يشغّل تحليل NER على نص كامل ويُنشئ/يُحدّث الكيانات والروابط والذكر للمستند المعطى.
 * @param localClient عميل localClient (مع صلاحية asServiceRole للعمليات الداخلية)
 * @param doc سجل المستند (يستخدم title)
 * @param document_id معرّف المستند
 * @param fullText النص الكامل المراد تحليله
 */
export async function runNer(localClient, doc, document_id, fullText) {
  if (!fullText || !fullText.trim()) {
    await localClient.entities.Document.update(document_id, {
      status: 'failed',
      error_message: 'تعذّر استخراج النص من المستند'
    });
    return { status: 'failed', error: 'no text' };
  }

  let llmResult;
  try {
    llmResult = await localClient.asServiceRole.integrations.Core.InvokeLLM({
      prompt: ANALYSIS_PROMPT.replace('__TEXT__', fullText),
      response_json_schema: ANALYSIS_SCHEMA
    });
  } catch (error) {
    await localClient.entities.Document.update(document_id, { status: 'failed', error_message: error.message });
    throw error;
  }

  await localClient.asServiceRole.entities.Mention.deleteMany({ document_id });
  await localClient.asServiceRole.entities.Connection.deleteMany({ document_id });

  const summary = llmResult.summary || '';
  const { entities, relationships } = sanitizeExtractedData(
    Array.isArray(llmResult.entities) ? llmResult.entities : [],
    Array.isArray(llmResult.relationships) ? llmResult.relationships : [],
    fullText
  );

  // حلّ الكيانات
  const existing = await localClient.entities.Entity.filter({});
  const byKey = Object.create(null);
  const registerEntityIndex = (entity) => {
    if (!entity || !entity.name) return;
    byKey[entityKey(entity.name, entity.type || 'other')] = entity;
    for (const alias of (entity.aliases || [])) {
      byKey[entityKey(alias, entity.type || 'other')] = entity;
    }
  };
  for (const e of existing) registerEntityIndex(e);

  const resolved = Object.create(null);
  const resolveEntityHandle = (name, fallbackType = 'other') => {
    if (!name) return undefined;
    const direct = resolved[entityKey(name, fallbackType)] || resolved[entityKey(name, 'other')];
    if (direct) return direct;
    const normalized = normalize(name);
    const matches = Object.values(resolved).filter((candidate) =>
      candidate && (
        normalize(candidate.name) === normalized ||
        (candidate.aliases || []).some((alias) => normalize(alias) === normalized)
      )
    );
    return matches[0];
  };
  const ensureEntity = async (ent) => {
    if (!ent || !ent.name) return null;
    const targetType = ent.type || 'other';
    const primaryKey = entityKey(ent.name, targetType);
    if (resolved[primaryKey]) return resolved[primaryKey];

    let match = byKey[primaryKey];
    if (!match && Array.isArray(ent.aliases)) {
      for (const alias of ent.aliases) {
        match = byKey[entityKey(alias, targetType)];
        if (match) break;
      }
    }

    if (match) {
      const aliases = new Set(match.aliases || []);
      if (ent.aliases) ent.aliases.forEach((a) => aliases.add(a));
      if (ent.name && ent.name !== match.name) aliases.add(ent.name);
      const documentIds = new Set(match.document_ids || []);
      const alreadySeen = documentIds.has(document_id);
      documentIds.add(document_id);
      const attrs = { ...(match.attributes || {}), ...(ent.attributes || {}) };
      const updated = await localClient.entities.Entity.update(match.id, {
        aliases: Array.from(aliases),
        document_ids: Array.from(documentIds),
        attributes: attrs,
        mention_count: alreadySeen ? (match.mention_count || 1) : (match.mention_count || 1) + 1
      });
      registerEntityIndex(updated);
      resolved[primaryKey] = updated;
      resolved[entityKey(updated.name, updated.type || 'other')] = updated;
      return updated;
    }

    const created = await localClient.entities.Entity.create({
      name: ent.name,
      type: targetType,
      aliases: ent.aliases || [],
      attributes: ent.attributes || {},
      mention_count: 1,
      risk_score: 0,
      document_ids: [document_id]
    });
    registerEntityIndex(created);
    resolved[primaryKey] = created;
    resolved[entityKey(created.name, created.type || 'other')] = created;
    return created;
  };

  for (const ent of entities) {
    if (!ent.name) continue;
    const rec = await ensureEntity(ent);
    if (!rec) continue;
    await localClient.entities.Mention.create({
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
    const src = resolveEntityHandle(rel.source, 'other');
    const tgt = resolveEntityHandle(rel.target, 'other');
    if (!src || !tgt || src.id === tgt.id) continue;
    const linkKey = [src.id, tgt.id].sort().join('|') + '|' + normalize(rel.type);
    if (seenLinks.has(linkKey)) continue;
    seenLinks.add(linkKey);
    await localClient.entities.Connection.create({
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

  const referenceDate = doc.reference_date || extractReferenceDate(entities, fullText);
  await localClient.entities.Document.update(document_id, {
    status: 'processed',
    raw_text: fullText,
    summary,
    reference_date: referenceDate,
    entity_count: entities.length,
    connection_count: connectionCount
  });

  // التصنيف الزمني: إيداع المستند في ملف تحليلات العام المرجعي
  await fileIntoYearDossier(localClient, document_id, referenceDate, Object.values(resolved));

  // تنبيه فوري: مطابقة الكيانات المستخرجة مقابل قوائم المراقبة وملفات الخطر
  const resolvedEntities = Object.values(resolved);
  const alertsResult = await evaluateImmediateAlerts(localClient, resolvedEntities, { document_id, document_title: doc.title });

  // تنبيه داخل التطبيق للكيانات عالية الخطورة المكتشفة في هذا المستند
    const highAlerts = (alertsResult.alerts || []).filter(
      (a) => a.severity === 'high' || a.severity === 'critical'
    );
    if (highAlerts.length > 0) {
      await localClient.entities.Notification.bulkCreate(
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

  return { status: 'processed', entity_count: entities.length, connection_count: connectionCount, summary, alerts: alertsResult };
}