import { createClientFromRequest } from '../../client.js';

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);
    const body = await req.json();
    const focusId = String(body.focus_id || '');

    const [ents, conns] = await Promise.all([
      localClient.entities.Entity.list('-mention_count', 2000),
      localClient.entities.Connection.list('-created_date', 5000)
    ]);

    const entById = Object.create(null);
    ents.forEach((e) => { entById[e.id] = e; });

    const adj = Object.create(null);
    const relTypes = Object.create(null);
    ents.forEach((e) => { adj[e.id] = { id: e.id, name: e.name, type: e.type, degree: 0, neighbors: [] }; });

    conns.forEach((c) => {
      const s = c.source_entity_id, t = c.target_entity_id;
      if (!adj[s] || !adj[t]) return;
      adj[s].degree++; adj[t].degree++;
      adj[s].neighbors.push({ id: t, name: c.target_entity_name || (entById[t] && entById[t].name), type: entById[t] && entById[t].type, rel: c.relationship_type, direction: 'out', strength: c.strength || 1 });
      adj[t].neighbors.push({ id: s, name: c.source_entity_name || (entById[s] && entById[s].name), type: entById[s] && entById[s].type, rel: c.relationship_type, direction: 'in', strength: c.strength || 1 });
      const r = c.relationship_type || 'غير محدد';
      relTypes[r] = (relTypes[r] || 0) + 1;
    });

    const nodes = ents.length;
    const edges = conns.length;
    const isolated = ents.filter((e) => adj[e.id].degree === 0).length;
    const density = nodes > 1 ? (2 * edges) / (nodes * (nodes - 1)) : 0;

    const hubs = Object.values(adj)
      .filter((a) => a.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 30)
      .map((a) => ({ id: a.id, name: a.name, type: a.type, degree: a.degree }));

    const relTypeList = Object.entries(relTypes)
      .map(([k, v]) => ({ name: k, value: v }))
      .sort((a, b) => b.value - a.value);

    const connectedAdj = Object.create(null);
    Object.values(adj).forEach((a) => { if (a.degree > 0) connectedAdj[a.id] = a; });

    // جوار مركّز لكيان محدد (درجتان) إن طُلب
    let focus = null;
    if (focusId && adj[focusId]) {
      const focusNode = adj[focusId];
      const hop1 = focusNode.neighbors.map((n) => ({ ...n, hop: 1 }));
      const hop2Ids = new Set([focusId]);
      hop1.forEach((h) => hop2Ids.add(h.id));
      const hop2 = [];
      hop1.forEach((h) => {
        (adj[h.id] && adj[h.id].neighbors || []).forEach((n2) => {
          if (n2.id === focusId || hop2Ids.has(n2.id)) return;
          hop2Ids.add(n2.id);
          hop2.push({ ...n2, via: h.name, hop: 2 });
        });
      });
      focus = { node: { id: focusNode.id, name: focusNode.name, type: focusNode.type, degree: focusNode.degree }, hop1, hop2 };
    }

    return Response.json({
      stats: { nodes, edges, isolated, density, connected: nodes - isolated, relTypeCount: relTypeList.length },
      hubs,
      relTypes: relTypeList,
      adjacency: connectedAdj,
      focus
    });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}