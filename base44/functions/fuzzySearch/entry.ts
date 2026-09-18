import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { norm, jaroWinkler, nameSimilarity } from '../../shared/entityResolution.ts';

function fuzzyScore(query, text) {
  const nq = norm(query);
  const nt = norm(text);
  if (!nq || !nt) return 0;
  if (nt.includes(nq)) return 0.95 + Math.min(nq.length / Math.max(nt.length, 1), 1) * 0.05;
  const qt = nq.split(/\s+/).filter(Boolean);
  const ct = nt.split(/\s+/).filter(Boolean);
  let tokenAvg = 0;
  if (qt.length && ct.length) {
    let sum = 0;
    for (const q of qt) {
      let best = 0;
      for (const c of ct) {
        const s = jaroWinkler(q, c);
        if (s > best) best = s;
      }
      sum += best;
    }
    tokenAvg = sum / qt.length;
  }
  const whole = jaroWinkler(nq, nt);
  return Math.max(tokenAvg, whole * 0.9);
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const query = String(body.query || '').trim();
    const limit = Math.min(Number(body.limit) || 30, 100);
    if (!query) return Response.json({ results: [], total: 0 });

    const [ents, docs, conns] = await Promise.all([
      base44.entities.Entity.list('-mention_count', 1000),
      base44.entities.Document.list('-created_date', 500),
      base44.entities.Connection.list('-created_date', 2000)
    ]);

    const results = [];
    const THRESH = 0.55;

    for (const e of ents) {
      let best = 0; let field = '';
      const sName = nameSimilarity(query, e.name);
      if (sName > best) { best = sName; field = 'الاسم'; }
      for (const a of (e.aliases || [])) {
        const s = nameSimilarity(query, a);
        if (s > best) { best = s; field = 'اسم بديل'; }
      }
      if (e.attributes && typeof e.attributes === 'object') {
        for (const [k, v] of Object.entries(e.attributes)) {
          if (v == null) continue;
          const s = fuzzyScore(query, String(v));
          if (s > best) { best = s; field = k; }
        }
      }
      if (best >= THRESH) results.push({ type: 'entity', id: e.id, label: e.name, score: best, field, meta: { type: e.type, mention_count: e.mention_count || 0 } });
    }

    for (const d of docs) {
      let best = 0; let field = ''; let snippet = '';
      const sTitle = fuzzyScore(query, d.title || '');
      if (sTitle > best) { best = sTitle; field = 'العنوان'; }
      const sSum = fuzzyScore(query, d.summary || '');
      if (sSum > best) { best = sSum; field = 'الملخص'; }
      const raw = d.raw_text || '';
      if (raw) {
        const nq = norm(query);
        const nr = norm(raw);
        const pos = nr.indexOf(nq);
        if (pos >= 0) {
          if (best < 0.96) { best = 0.96; field = 'النص'; }
          const start = Math.max(0, pos - 40);
          snippet = '...' + raw.substr(start, 140) + '...';
        } else {
          const sRaw = fuzzyScore(query, raw);
          if (sRaw > best) { best = sRaw; field = 'النص'; }
        }
      }
      if (best >= THRESH) results.push({ type: 'document', id: d.id, label: d.title, score: best, field, snippet, meta: { document_type: d.document_type } });
    }

    for (const c of conns) {
      let best = 0; let field = '';
      const sS = nameSimilarity(query, c.source_entity_name || '');
      if (sS > best) { best = sS; field = 'المصدر'; }
      const sT = nameSimilarity(query, c.target_entity_name || '');
      if (sT > best) { best = sT; field = 'الهدف'; }
      const sR = fuzzyScore(query, c.relationship_type || '');
      if (sR > best) { best = sR; field = 'العلاقة'; }
      if (best >= THRESH) results.push({
        type: 'connection', id: c.id,
        label: (c.source_entity_name || '') + ' — ' + (c.relationship_type || '') + ' — ' + (c.target_entity_name || ''),
        score: best, field,
        meta: { source_id: c.source_entity_id, target_id: c.target_entity_id }
      });
    }

    results.sort((a, b) => b.score - a.score);
    return Response.json({ results: results.slice(0, limit), total: results.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}