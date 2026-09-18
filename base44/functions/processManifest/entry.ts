import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runNer } from '../../shared/nerPipeline.ts';

// يبني نصاً غير مهيكل من بيان الركاب/الشحن ليمرّ عبر محرك NER
function buildNarrative(m) {
  const mode = m.mode === 'air' ? 'جوي' : 'بحري';
  const type = m.manifest_type === 'cargo' ? 'شحن' : 'ركاب';
  const lines = [];

  lines.push(`بيان ${type} ${mode}. الناقل: ${m.carrier}. رقم الرحلة/الرحلة: ${m.voyage_number}.`);
  if (m.departure_location || m.destination_location) {
    lines.push(`المغادرة: ${m.departure_location || 'غير محدد'}. الوجهة: ${m.destination_location || 'غير محدد'}.`);
  }
  if (m.departure_datetime) {
    lines.push(`وقت المغادرة: ${m.departure_datetime}.`);
  }

  if (m.manifest_type === 'passenger' && Array.isArray(m.passengers)) {
    lines.push('الركاب:');
    m.passengers.forEach((p, i) => {
      const parts = [`الراكب ${i + 1}: ${p.name || 'غير مسمّى'}`];
      if (p.passport_number) parts.push(`رقم جواز السفر: ${p.passport_number}`);
      if (p.nationality) parts.push(`الجنسية: ${p.nationality}`);
      if (p.dob) parts.push(`تاريخ الميلاد: ${p.dob}`);
      if (p.seat) parts.push(`المقعد: ${p.seat}`);
      lines.push(parts.join('، ') + '.');
    });
  }

  if (m.manifest_type === 'cargo' && Array.isArray(m.cargo)) {
    lines.push('الشحنات:');
    m.cargo.forEach((c, i) => {
      const parts = [`الشحنة ${i + 1}: ${c.description || 'غير موصوفة'}`];
      if (c.weight) parts.push(`الوزن: ${c.weight}`);
      if (c.consignee) parts.push(`المرسَل إليه: ${c.consignee}`);
      if (c.hazardous) parts.push('خطرة');
      lines.push(parts.join('، ') + '.');
    });
  }

  // نتائج الفحص (إن وُجدت) لتثبيت العلامات كسياق
  const sum = m.screening_summary;
  if (sum && Array.isArray(sum.flags) && sum.flags.length) {
    lines.push('نتائج الفحص الأمني: تم تعليم ما يلي:');
    sum.flags.forEach((f) => {
      const who = f.name || f.consignee || 'غير محدد';
      const reasons = (f.reasons || [f.reason]).filter(Boolean).join('؛ ');
      lines.push(`- ${who}: ${reasons}.`);
    });
  }

  return lines.join('\n');
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const { manifest_id } = body;
    if (!manifest_id) return Response.json({ error: 'manifest_id مطلوب' }, { status: 400 });

    const manifest = await base44.entities.Manifest.get(manifest_id);
    if (!manifest) {
      return Response.json({ error: 'البيان غير موجود' }, { status: 404 });
    }

    const narrative = buildNarrative(manifest);
    const title = `بيان ${manifest.manifest_type === 'cargo' ? 'شحن' : 'ركاب'}: ${manifest.carrier} ${manifest.voyage_number}`;

    // إعادة استخدام مستند NER المرتبط بالبيان إن وُجد (لإعادة المعالجة بدون تكرار)
    const sum = manifest.screening_summary || {};
    let docId = sum.ner_document_id;

    let doc;
    if (docId) {
      try { doc = await base44.entities.Document.get(docId); } catch (e) { doc = null; }
    }
    if (!doc) {
      doc = await base44.entities.Document.create({
        title,
        document_type: 'other',
        raw_text: narrative,
        status: 'processing'
      });
      docId = doc.id;
    } else {
      await base44.entities.Document.update(docId, { title, raw_text: narrative, status: 'processing', error_message: '' });
    }

    const result = await runNer(base44, doc, docId, narrative);

    // ربط المستند بالبيان
    await base44.entities.Manifest.update(manifest_id, {
      screening_summary: { ...sum, ner_document_id: docId, ner_status: result.status, ner_entities: result.entity_count, ner_connections: result.connection_count }
    });

    return Response.json({
      status: result.status,
      document_id: docId,
      entity_count: result.entity_count,
      connection_count: result.connection_count,
      summary: result.summary
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}