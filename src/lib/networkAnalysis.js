// أدوات تحليل الشبكات: مجاورة، مركزية، كشف مجتمعات، شبكة إيغو، شبكة فرعية للشركات

export function buildAdjacency(entities, connections) {
  const idMap = new Map();
  (entities || []).forEach((e) => idMap.set(e.id, e));
  const adj = new Map();
  (entities || []).forEach((e) => adj.set(e.id, new Set()));
  const edges = [];
  const seen = new Set();
  (connections || []).forEach((c) => {
    const a = c.source_entity_id, b = c.target_entity_id;
    if (!a || !b || a === b) return;
    if (!adj.has(a) || !adj.has(b)) return;
    adj.get(a).add(b);
    adj.get(b).add(a);
    const key = [a, b].sort().join('|');
    if (!seen.has(key)) { seen.add(key); edges.push({ source: a, target: b, rel: c.relationship_type }); }
  });
  return { idMap, adj, edges };
}

export function buildAdjacencyFromEdges(nodes, edges) {
  const adj = new Map();
  (nodes || []).forEach((n) => adj.set(n.id, new Set()));
  (edges || []).forEach((e) => {
    const a = e.source, b = e.target;
    if (!adj.has(a) || !adj.has(b) || a === b) return;
    adj.get(a).add(b);
    adj.get(b).add(a);
  });
  return { adj };
}

export function degreeCentrality(adj) {
  const m = new Map();
  adj.forEach((set, id) => m.set(id, set.size));
  return m;
}

function sampleEvenly(arr, n) {
  const step = arr.length / n;
  const out = [];
  for (let i = 0; i < n; i++) out.push(arr[Math.floor(i * step)]);
  return out;
}

// خوارزمية Brandes لوساطة الوساطة (Betweenness) — مع تقليص عدد العقد المصدرية للأداء
export function betweennessCentrality(adj, cap = 60) {
  const nodes = [...adj.keys()];
  const bc = new Map();
  nodes.forEach((n) => bc.set(n, 0));
  if (nodes.length < 2) return bc;
  const sources = nodes.length > cap ? sampleEvenly(nodes, cap) : nodes;
  sources.forEach((s) => {
    const S = [];
    const P = new Map(); nodes.forEach((n) => P.set(n, []));
    const sigma = new Map(); nodes.forEach((n) => sigma.set(n, 0)); sigma.set(s, 1);
    const dist = new Map(); nodes.forEach((n) => dist.set(n, -1)); dist.set(s, 0);
    const Q = [s];
    while (Q.length) {
      const v = Q.shift();
      S.push(v);
      adj.get(v).forEach((w) => {
        if (dist.get(w) < 0) { dist.set(w, dist.get(v) + 1); Q.push(w); }
        if (dist.get(w) === dist.get(v) + 1) { sigma.set(w, sigma.get(w) + sigma.get(v)); P.get(w).push(v); }
      });
    }
    const delta = new Map(); nodes.forEach((n) => delta.set(n, 0));
    while (S.length) {
      const w = S.pop();
      P.get(w).forEach((v) => {
        delta.set(v, delta.get(v) + (sigma.get(w) / sigma.get(v)) * (1 + delta.get(w)));
      });
      if (w !== s) bc.set(w, bc.get(w) + delta.get(w));
    }
  });
  const factor = sources.length / nodes.length;
  bc.forEach((v, k) => bc.set(k, v * factor));
  return bc;
}

// انتشار الوسوم (Label Propagation) لكشف المجتمعات
export function labelPropagation(adj, iterations = 8) {
  const nodes = [...adj.keys()];
  const label = new Map();
  nodes.forEach((n) => label.set(n, n));
  for (let it = 0; it < iterations; it++) {
    let changed = false;
    nodes.forEach((n) => {
      const counts = new Map();
      adj.get(n).forEach((nb) => { const l = label.get(nb); counts.set(l, (counts.get(l) || 0) + 1); });
      let best = label.get(n), bestCount = 0;
      counts.forEach((c, l) => { if (c > bestCount || (c === bestCount && String(l) < String(best))) { best = l; bestCount = c; } });
      if (best !== label.get(n)) { label.set(n, best); changed = true; }
    });
    if (!changed) break;
  }
  return label;
}

export function communities(labelMap) {
  const groups = new Map();
  labelMap.forEach((l, id) => { if (!groups.has(l)) groups.set(l, []); groups.get(l).push(id); });
  return [...groups.values()];
}

export function egoNetwork(adj, centerId, radius = 1) {
  const result = new Set([centerId]);
  let frontier = [centerId];
  for (let r = 0; r < radius; r++) {
    const next = [];
    frontier.forEach((v) => adj.get(v).forEach((w) => { if (!result.has(w)) { result.add(w); next.push(w); } }));
    frontier = next;
  }
  return result;
}

// شبكة فرعية للشركات: تُربط الشركات عبر الجيران المشتركين (موظفون/هواتف/بريد/حسابات) والروابط المباشرة
export function companySubgraph(entities, connections) {
  const companies = (entities || []).filter((e) => e.type === 'company' || e.type === 'organization');
  const { adj } = buildAdjacency(entities, connections);
  const companyIds = new Set(companies.map((c) => c.id));
  const edges = [];
  const seen = new Set();
  const addEdge = (a, b, w, rel) => {
    const key = [a, b].sort().join('|');
    if (seen.has(key)) return;
    seen.add(key); edges.push({ source: a, target: b, weight: w, rel });
  };
  // روابط مباشرة بين شركتين
  companies.forEach((c) => {
    adj.get(c.id).forEach((nb) => {
      if (companyIds.has(nb)) addEdge(c.id, nb, 1, 'رابط مباشر');
    });
  });
  // روابط عبر جيران مشتركين
  for (let i = 0; i < companies.length; i++) {
    for (let j = i + 1; j < companies.length; j++) {
      const a = companies[i].id, b = companies[j].id;
      const na = adj.get(a), nb = adj.get(b);
      let shared = 0;
      na.forEach((x) => { if (nb.has(x)) shared++; });
      if (shared > 0) addEdge(a, b, shared, `تشارك ${shared}`);
    }
  }
  return { companies, edges };
}