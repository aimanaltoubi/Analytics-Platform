import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const sourceId = String(body.source_id || '');
    const targetId = String(body.target_id || '');
    if (!sourceId || !targetId) return Response.json({ error: 'source_id و target_id مطلوبان' }, { status: 400 });

    const [ents, conns] = await Promise.all([
      base44.entities.Entity.list('-mention_count', 3000),
      base44.entities.Connection.list('-created_date', 5000)
    ]);
    const entById = {};
    ents.forEach((e) => { entById[e.id] = e; });
    if (!entById[sourceId] || !entById[targetId]) return Response.json({ error: 'كيان غير موجود' }, { status: 404 });

    const adj = {};
    conns.forEach((c) => {
      const s = c.source_entity_id, t = c.target_entity_id;
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push({ id: t, rel: c.relationship_type, name: c.target_entity_name || (entById[t] && entById[t].name) });
      adj[t].push({ id: s, rel: c.relationship_type, name: c.source_entity_name || (entById[s] && entById[s].name) });
    });

    // BFS لأقصر مسار
    const queue = [[sourceId]];
    const visited = new Set([sourceId]);
    let path = null;
    while (queue.length) {
      const cur = queue.shift();
      const last = cur[cur.length - 1];
      if (last === targetId) { path = cur; break; }
      for (const nb of (adj[last] || [])) {
        if (!visited.has(nb.id)) {
          visited.add(nb.id);
          queue.push([...cur, nb.id]);
        }
      }
    }

    const pathDetails = (path || []).map((id) => {
      const e = entById[id];
      return { id, name: e && e.name, type: e && e.type };
    });

    // المشتركون: كيانات متصلة بكلا الطرفين
    const ns = new Set((adj[sourceId] || []).map((n) => n.id));
    const common = (adj[targetId] || [])
      .filter((n) => ns.has(n.id))
      .map((n) => { const e = entById[n.id]; return { id: n.id, name: e && e.name, type: e && e.type }; });

    return Response.json({
      source: { id: sourceId, name: entById[sourceId].name },
      target: { id: targetId, name: entById[targetId].name },
      path: pathDetails,
      path_length: pathDetails.length,
      connected: !!path,
      common_neighbors: common
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}