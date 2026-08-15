import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { nameSimilarity } from '../../shared/entityResolution.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const names = Array.isArray(body.names) ? body.names.map((n) => String(n).trim()).filter(Boolean) : [];
    const riskScore = Number(body.risk_score ?? 80);
    if (!names.length) return Response.json({ error: 'لا توجد أسماء' }, { status: 400 });

    const ents = await base44.entities.Entity.list('-mention_count', 3000);

    let matched = 0, created = 0;
    for (const name of names) {
      let best = null, bestScore = 0;
      for (const e of ents) {
        const score = nameSimilarity(name, e.name);
        if (score > bestScore) { bestScore = score; best = e; }
        if (e.aliases) {
          for (const a of e.aliases) {
            const s = nameSimilarity(name, a);
            if (s > bestScore) { bestScore = s; best = e; }
          }
        }
      }
      if (best && bestScore >= 0.85) {
        if (!best.watchlist || (best.risk_score || 0) < riskScore) {
          await base44.entities.Entity.update(best.id, {
            watchlist: true,
            risk_score: Math.max(best.risk_score || 0, riskScore)
          });
        }
        matched++;
      } else {
        await base44.entities.Entity.create({
          name,
          type: 'person',
          watchlist: true,
          risk_score: riskScore,
          mention_count: 0,
          document_ids: []
        });
        created++;
      }
    }

    return Response.json({ total: names.length, matched, created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}