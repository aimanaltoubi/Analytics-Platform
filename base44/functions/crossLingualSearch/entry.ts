import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const norm = (s) =>
  (s || '')
    .toString()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export default async function crossLingualSearch(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const query = (body.query || '').toString().trim();
    if (!query) return Response.json({ error: 'query is required' }, { status: 400 });

    // 1) ترجمة الاستعلام إلى العربية والإنجليزية (خط أساس للبحث عبر اللغات)
    const tr = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt:
        'You are a cross-lingual search translator for an intelligence analysis system. Given a user search query in ANY language, produce: (1) an Arabic translation optimized for searching Arabic documents, (2) an English translation, and (3) the detected source language code (ISO 639-1). Preserve names of people, organizations, and places exactly. Return JSON only.\nQuery: """' +
        query +
        '"""',
      response_json_schema: {
        type: 'object',
        properties: {
          arabic_query: { type: 'string' },
          english_query: { type: 'string' },
          source_language: { type: 'string' }
        },
        required: ['arabic_query', 'english_query']
      }
    });

    const arabicQuery = tr.arabic_query || query;
    const englishQuery = tr.english_query || '';
    const sourceLanguage = tr.source_language || '';

    // 2) البحث في الوثائق (النص الخام + الملخص + العنوان)
    const docs = await base44.entities.Document.list('-created_date', 100);
    const aqNorm = norm(arabicQuery);
    const qNorm = norm(query);
    const matched = [];
    for (const d of docs) {
      const hay = norm((d.raw_text || '') + ' ' + (d.summary || '') + ' ' + (d.title || ''));
      let score = 0;
      if (aqNorm && hay.includes(aqNorm)) score += 3;
      if (qNorm && qNorm !== aqNorm && hay.includes(qNorm)) score += 2;
      const words = (aqNorm || qNorm).split(' ').filter((w) => w.length >= 3);
      let wHits = 0;
      for (const w of words) if (hay.includes(w)) wHits++;
      if (wHits > 0 && score === 0) score = 1 + wHits * 0.5;
      if (score > 0) matched.push({ id: d.id, title: d.title, status: d.status, summary: d.summary, raw_text: d.raw_text, _score: score });
    }
    matched.sort((a, b) => b._score - a._score);
    const top = matched.slice(0, 8);

    // الكيانات المشبوهة (خطورة عالية أو على قائمة المراقبة) للإبراز
    const entities = await base44.entities.Entity.list('-mention_count', 200);
    const suspiciousNames = entities
      .filter((e) => (e.risk_score || 0) >= 50 || e.watchlist)
      .map((e) => norm(e.name))
      .filter(Boolean);

    // 3) ترجمة مقتطفات الوثائق المطابقة للإنجليزية + استخراج الكيانات المشبوهة
    let enriched = [];
    if (top.length > 0) {
      const payload = top.map((d) => ({
        id: d.id,
        title: d.title,
        arabic_text: (d.summary || (d.raw_text || '').slice(0, 800) || '').slice(0, 800)
      }));
      const llm2 = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt:
          'You are a cross-lingual intelligence assistant. For each Arabic document below, produce: (1) a concise English translation of the arabic_text, (2) a list of suspicious entity names mentioned (people/orgs/places of concern). Return JSON only. Output an object with a "results" array, one object per document with fields: id, english_translation, suspicious_entities (array of strings).\nDocuments:\n' +
          JSON.stringify(payload),
        response_json_schema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  english_translation: { type: 'string' },
                  suspicious_entities: { type: 'array', items: { type: 'string' } }
                },
                required: ['id', 'english_translation']
              }
            }
          },
          required: ['results']
        }
      });
      const byId = {};
      (llm2.results || []).forEach((r) => (byId[r.id] = r));
      enriched = top.map((d) => {
        const r = byId[d.id] || {};
        const snippet = (d.summary || d.raw_text || '').slice(0, 400);
        const flagged = (r.suspicious_entities || []).filter((n) => n);
        return {
          id: d.id,
          title: d.title,
          status: d.status,
          score: d._score,
          arabic_snippet: snippet,
          english_translation: r.english_translation || '',
          suspicious_entities: flagged
        };
      });
    }

    return Response.json({
      query: { original: query, arabic: arabicQuery, english: englishQuery, source_language: sourceLanguage },
      documents: enriched,
      total_matches: matched.length,
      suspicious_known: suspiciousNames
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}