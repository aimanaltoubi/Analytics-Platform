import { createClientFromRequest } from '../../client.js';
import { ensureDefaultProfiles } from '../../shared/alertEngine.js';

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);

    // ضمان وجود ملفات خطر افتراضية (منطق مشترك مع محرك التنبيهات الفوري)
    const profiles = await ensureDefaultProfiles(localClient);

    const entities = await localClient.asServiceRole.entities.Entity.list('-mention_count', 1000);
    const connections = await localClient.asServiceRole.entities.Connection.list('-created_date', 2000);

    const entById = Object.create(null);
    entities.forEach((e) => { entById[e.id] = e; });

    // درجة الارتباط لكل كيان
    const degree = Object.create(null);
    connections.forEach((c) => {
      degree[c.source_entity_id] = (degree[c.source_entity_id] || 0) + 1;
      degree[c.target_entity_id] = (degree[c.target_entity_id] || 0) + 1;
    });

    // التشارك في المستندات
    const docEntities = Object.create(null);
    entities.forEach((e) => {
      (e.document_ids || []).forEach((did) => {
        (docEntities[did] = docEntities[did] || new Set()).add(e.id);
      });
    });
    const pairCount = Object.create(null);
    Object.values(docEntities).forEach((set) => {
      const ids = [...set];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = ids[i] < ids[j] ? ids[i] + '|' + ids[j] : ids[j] + '|' + ids[i];
          pairCount[key] = (pairCount[key] || 0) + 1;
        }
      }
    });

    // العناقيد (union-find)
    const parent = Object.create(null);
    const find = (x) => { if (parent[x] === undefined) parent[x] = x; if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; };
    const union = (a, b) => { parent[find(a)] = find(b); };
    connections.forEach((c) => {
      if (c.source_entity_id && c.target_entity_id) union(c.source_entity_id, c.target_entity_id);
    });
    const clusters = Object.create(null);
    entities.forEach((e) => { const r = find(e.id); (clusters[r] = clusters[r] || []).push(e.id); });

    // التنبيهات الحالية غير المحلولة لمنع التكرار
    const existing = await localClient.asServiceRole.entities.Alert.filter({ status: { $ne: 'resolved' } }, '-created_date', 500);
    const existingKeys = new Set((existing || []).map((a) =>
      (a.rule_id || a.rule_name || '') + '|' + (a.details && a.details.signature ? a.details.signature : '')
    ));

    const now = new Date().toISOString();
    const toCreate = [];
    const addAlert = (profile, signature, title, description, entityIds, extra) => {
      const key = (profile.id || profile.name) + '|' + signature;
      if (existingKeys.has(key)) return;
      existingKeys.add(key);
      const ents = (entityIds || []).map((id) => entById[id]).filter(Boolean);
      toCreate.push({
        title,
        description,
        severity: profile.severity || 'medium',
        rule_id: profile.id || '',
        rule_name: profile.name,
        rule_type: profile.rule_type,
        entity_ids: entityIds || [],
        entity_names: ents.map((e) => e.name),
        status: 'new',
        triggered_at: now,
        details: Object.assign({ signature }, extra || {})
      });
    };

    let evaluated = 0;
    profiles.forEach((p) => {
      evaluated++;
      const cond = p.conditions || {};
      if (p.rule_type === 'risk_threshold') {
        const min = cond.min_risk_score || 0;
        entities.forEach((e) => {
          if ((e.risk_score || 0) >= min) {
            addAlert(p, 'risk:' + e.id, 'خطورة عالية: ' + e.name, 'درجة الخطورة ' + (e.risk_score || 0) + ' تتجاوز العتبة ' + min, [e.id], { risk_score: e.risk_score || 0 });
          }
        });
      } else if (p.rule_type === 'watchlist') {
        entities.forEach((e) => {
          if (e.watchlist) addAlert(p, 'watch:' + e.id, 'مراقبة: ' + e.name, 'الكيان مُدرج في قائمة المراقبة', [e.id]);
        });
      } else if (p.rule_type === 'hub') {
        const min = cond.min_degree || 5;
        entities.forEach((e) => {
          if ((degree[e.id] || 0) >= min) addAlert(p, 'hub:' + e.id, 'كيان محوري: ' + e.name, 'مرتبط بـ ' + (degree[e.id] || 0) + ' كيان', [e.id], { degree: degree[e.id] || 0 });
        });
      } else if (p.rule_type === 'co_occurrence') {
        const min = cond.min_shared_docs || 2;
        Object.entries(pairCount).forEach(([key, cnt]) => {
          if (cnt < min) return;
          const [a, b] = key.split('|');
          if (cond.require_high_risk) {
            const ea = entById[a], eb = entById[b];
            if (!((ea && (ea.risk_score || 0) >= 50) || (eb && (eb.risk_score || 0) >= 50))) return;
          }
          addAlert(p, 'cooc:' + key, 'تشارك مكثّف: ' + (entById[a] ? entById[a].name : '?') + ' ↔ ' + (entById[b] ? entById[b].name : '?'), 'ظهران معاً في ' + cnt + ' مستند', [a, b], { shared_docs: cnt });
        });
      } else if (p.rule_type === 'cluster_size') {
        const min = cond.min_size || 5;
        Object.values(clusters).forEach((members) => {
          if (members.length >= min) {
            addAlert(p, 'cluster:' + members.slice().sort().join(','), 'عنقود شبكي كبير (' + members.length + ' كيان)', 'شبكة مترابطة بحجم كبير', members, { size: members.length });
          }
        });
      }
    });

    let created = 0;
    if (toCreate.length > 0) {
      const res = await localClient.asServiceRole.entities.Alert.bulkCreate(toCreate);
      created = Array.isArray(res) ? res.length : toCreate.length;
    }

    return Response.json({
      evaluated,
      alerts_created: created,
      by_severity: toCreate.reduce((acc, a) => { acc[a.severity] = (acc[a.severity] || 0) + 1; return acc; }, {}),
      total_active: (existing ? existing.length : 0) + created
    });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}