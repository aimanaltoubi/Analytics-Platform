import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const norm = (s) => (s || '').toString().trim().toLowerCase()
  .replace(/[\u064B-\u0652]/g, '') // إزالة التشكيل
  .replace(/\s+/g, ' ');

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // تحميل كل بيانات المستخدم
    const [entities, connections, mentions, documents] = await Promise.all([
      base44.entities.Entity.list('-mention_count', 1000),
      base44.entities.Connection.list('-created_date', 2000),
      base44.entities.Mention.list('-created_date', 2000),
      base44.entities.Document.list('-created_date', 1000)
    ]);

    // عدد الروابط لكل كيان
    const connCount = {};
    connections.forEach((c) => {
      connCount[c.source_entity_id] = (connCount[c.source_entity_id] || 0) + 1;
      connCount[c.target_entity_id] = (connCount[c.target_entity_id] || 0) + 1;
    });

    // 1) تحليل الكيانات: دمج المكررات حسب (النوع + الاسم المؤسس)
    const groups = {};
    entities.forEach((e) => {
      const key = (e.type || 'other') + '|' + norm(e.name);
      (groups[key] = groups[key] || []).push(e);
    });

    const canonMap = {};      // dupId -> canonicalId
    const mergedGroups = [];  // للإبلاغ
    let duplicatesMerged = 0;

    Object.values(groups).forEach((grp) => {
      if (grp.length < 2) return;
      // اختيار الكيان المرجعي (أعلى ذكر ثم أكثر روابط)
      const canonical = grp.slice().sort((a, b) =>
        ((b.mention_count || 0) - (a.mention_count || 0)) ||
        ((connCount[b.id] || 0) - (connCount[a.id] || 0))
      )[0];
      const dups = grp.filter((e) => e.id !== canonical.id);
      if (dups.length === 0) return;

      // دمج الحقول
      const aliases = new Set(canonical.aliases || []);
      const attributes = { ...(canonical.attributes || {}) };
      const document_ids = new Set(canonical.document_ids || []);
      let mentionSum = canonical.mention_count || 0;
      let maxRisk = canonical.risk_score || 0;
      let watchlist = canonical.watchlist || false;
      let photo = canonical.photo_url;

      dups.forEach((d) => {
        canonMap[d.id] = canonical.id;
        (d.aliases || []).forEach((a) => { if (a && a !== canonical.name) aliases.add(a); });
        Object.entries(d.attributes || {}).forEach(([k, v]) => {
          if (attributes[k] === undefined && v !== undefined && v !== '') attributes[k] = v;
        });
        (d.document_ids || []).forEach((id) => document_ids.add(id));
        mentionSum += d.mention_count || 0;
        if ((d.risk_score || 0) > maxRisk) maxRisk = d.risk_score || 0;
        if (d.watchlist) watchlist = true;
        if (!photo && d.photo_url) photo = d.photo_url;
      });
      if (canonical.name) aliases.delete(canonical.name);

      mergedGroups.push({
        canonical: canonical.name,
        type: TYPE_LABELS[canonical.type] || canonical.type,
        merged_count: dups.length,
        duplicates: dups.map((d) => d.name)
      });
      duplicatesMerged += dups.length;

      // تحديث الكيان المرجعي
      base44.entities.Entity.update(canonical.id, {
        mention_count: mentionSum,
        aliases: [...aliases],
        attributes,
        document_ids: [...document_ids],
        risk_score: maxRisk,
        watchlist,
        photo_url: photo
      }).catch(() => {});

      dups.forEach((d) => {
        base44.entities.Connection.updateMany(
          { source_entity_id: d.id },
          { $set: { source_entity_id: canonical.id } }
        ).catch(() => {});
        base44.entities.Connection.updateMany(
          { target_entity_id: d.id },
          { $set: { target_entity_id: canonical.id } }
        ).catch(() => {});
        base44.entities.Mention.updateMany(
          { entity_id: d.id },
          { $set: { entity_id: canonical.id } }
        ).catch(() => {});
        base44.entities.Entity.delete(d.id).catch(() => {});
      });
    });

    const canon = (id) => canonMap[id] || id;

    // 2) إعادة تمثيل الروابط بعد الدمج + تنظيف
    const remapped = connections
      .map((c) => ({
        ...c,
        source_entity_id: canon(c.source_entity_id),
        target_entity_id: canon(c.target_entity_id)
      }))
      .filter((c) => c.source_entity_id && c.target_entity_id);

    // حذف الروابط الذاتية (نفس الكيان) والروابط المكررة
    const seenPairs = new Set();
    const dupConnIds = [];
    remapped.forEach((c) => {
      if (c.source_entity_id === c.target_entity_id) {
        dupConnIds.push(c.id);
        return;
      }
      const key = [c.source_entity_id, c.target_entity_id].sort().join('|');
      if (seenPairs.has(key)) dupConnIds.push(c.id);
      else seenPairs.add(key);
    });
    if (dupConnIds.length > 0) {
      base44.entities.Connection.deleteMany({ id: { $in: dupConnIds } }).catch(() => {});
    }

    // 3) روابط التشارك في المستندات (ارتباط تلقائي عبر المصادر)
    const docEntitySet = {};
    mentions.forEach((m) => {
      const eid = canon(m.entity_id);
      if (!eid) return;
      (docEntitySet[m.document_id] = docEntitySet[m.document_id] || new Set()).add(eid);
    });

    const newCooc = [];
    const newPairKeys = new Set();
    Object.entries(docEntitySet).forEach(([docId, set]) => {
      const arr = [...set];
      const doc = documents.find((d) => d.id === docId);
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = [arr[i], arr[j]].sort().join('|');
          if (seenPairs.has(key) || newPairKeys.has(key)) continue;
          newPairKeys.add(key);
          newCooc.push({
            source_entity_id: arr[i],
            target_entity_id: arr[j],
            relationship_type: 'ذُكر معاً',
            document_id: docId,
            evidence: doc ? `تشارك في: ${doc.title}` : 'تشارك في مستند',
            strength: 1
          });
        }
      }
    });
    const coocCreated = Math.min(newCooc.length, 400);
    if (coocCreated > 0) {
      base44.entities.Connection.bulkCreate(newCooc.slice(0, coocCreated)).catch(() => {});
    }

    // 4) حساب الرؤى على البيانات بعد الدمج
    const entById = {};
    entities.forEach((e) => { entById[canon(e.id)] = { ...e, id: canon(e.id) }; });
    const liveEntities = Object.values(entById);

    // العناقيد (Connected Components)
    const parent = {};
    const find = (x) => { if (parent[x] === undefined) parent[x] = x; if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; };
    const union = (a, b) => { parent[find(a)] = find(b); };
    liveEntities.forEach((e) => find(e.id));
    remapped.forEach((c) => { if (c.source_entity_id !== c.target_entity_id) union(c.source_entity_id, c.target_entity_id); });

    const clusters = {};
    liveEntities.forEach((e) => {
      const r = find(e.id);
      (clusters[r] = clusters[r] || []).push(e);
    });
    const clusterList = Object.values(clusters).sort((a, b) => b.length - a.length);
    const largestClusters = clusterList.slice(0, 3).map((c) => ({
      size: c.length,
      members: c.slice(0, 5).map((e) => e.name)
    }));

    // الجسور (أعلى الكيانات درجةً)
    const degree = {};
    remapped.forEach((c) => {
      if (c.source_entity_id === c.target_entity_id) return;
      degree[c.source_entity_id] = (degree[c.source_entity_id] || 0) + 1;
      degree[c.target_entity_id] = (degree[c.target_entity_id] || 0) + 1;
    });
    const bridgeEntities = liveEntities
      .map((e) => ({ name: e.name, type: TYPE_LABELS[e.type] || e.type, degree: degree[e.id] || 0, mentions: e.mention_count || 0 }))
      .filter((e) => e.degree > 0)
      .sort((a, b) => (b.degree + b.mentions * 0.5) - (a.degree + a.mentions * 0.5))
      .slice(0, 6);

    // الكيانات المعزولة
    const orphans = liveEntities.filter((e) => !degree[e.id]).slice(0, 8).map((e) => ({ name: e.name, type: TYPE_LABELS[e.type] || e.type }));
    const orphanCount = liveEntities.filter((e) => !degree[e.id]).length;

    // أعلى التشاركات (أزواج تتشارك في أكثر مستندات)
    const pairDocs = {};
    Object.entries(docEntitySet).forEach(([docId, set]) => {
      const arr = [...set];
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = [arr[i], arr[j]].sort().join('|');
          (pairDocs[key] = pairDocs[key] || new Set()).add(docId);
        }
      }
    });
    const topCooc = Object.entries(pairDocs)
      .map(([key, docs]) => {
        const [a, b] = key.split('|');
        return { a: entById[a]?.name || '—', b: entById[b]?.name || '—', shared_docs: docs.size };
      })
      .sort((x, y) => y.shared_docs - x.shared_docs)
      .slice(0, 6);

    // شبكة الخطورة
    const highRisk = liveEntities.filter((e) => (e.risk_score || 0) >= 70);
    const neighborMap = {};
    remapped.forEach((c) => {
      if (c.source_entity_id === c.target_entity_id) return;
      (neighborMap[c.source_entity_id] = neighborMap[c.source_entity_id] || new Set()).add(c.target_entity_id);
      (neighborMap[c.target_entity_id] = neighborMap[c.target_entity_id] || new Set()).add(c.source_entity_id);
    });
    const riskNetwork = highRisk.map((e) => ({
      name: e.name,
      risk_score: e.risk_score,
      neighbors: (neighborMap[e.id] || new Set()).size
    }));

    // توزيع الأحداث حسب النوع
    const docTypeDist = {};
    documents.forEach((d) => { const t = d.document_type || 'other'; docTypeDist[t] = (docTypeDist[t] || 0) + 1; });

    return Response.json({
      generated_at: new Date().toISOString(),
      correlation: {
        entities: liveEntities.length,
        connections: remapped.length - dupConnIds.length + coocCreated,
        documents: documents.length,
        mentions: mentions.length,
        clusters: clusterList.length,
        cross_doc_links: coocCreated,
        duplicates_merged: duplicatesMerged
      },
      largest_clusters: largestClusters,
      bridge_entities: bridgeEntities,
      orphans: { count: orphanCount, sample: orphans },
      top_cooccurrence: topCooc,
      risk_network: riskNetwork,
      incidents_by_type: docTypeDist,
      merge_report: mergedGroups
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}