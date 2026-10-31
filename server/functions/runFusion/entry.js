import { createClientFromRequest } from '../../client.js';

const norm = (s) => (s || '').toString().trim().toLowerCase()
  .replace(/[\u064B-\u0652]/g, '') // إزالة التشكيل
  .replace(/\s+/g, ' ');

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

// === محرك حلّ الكيانات (Entity Resolution) ===
// مطابقة حتمية عبر المعرّفات القوية + مطابقة احتمالية (Jaro-Winkler + تاريخ الميلاد + Soundex)
const STRONG_KEYS = [
  'رقم الجواز', 'الرقم الوطني / رقم الهوية', 'رقم الهاتف', 'البريد الإلكتروني',
  'رقم الحساب', 'البصمة', 'رقم رخصة القيادة'
];
const RES_THRESHOLD = 0.92;
const WEIGHTS = { name: 0.5, dob: 0.3, soundex: 0.2 };

const SOUNDEX_MAP = {
  b: '1', f: '1', v: '1', p: '1',
  c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
  d: '3', t: '3', l: '4', m: '5', n: '5', r: '6',
  'ب': '1', 'ف': '1', 'ث': '1', 'پ': '1',
  'ج': '2', 'ح': '2', 'خ': '2', 'ك': '2', 'ق': '2', 'گ': '2', 'س': '2', 'ز': '2', 'ش': '2', 'ص': '2',
  'د': '3', 'ت': '3', 'ط': '3', 'ظ': '3', 'ض': '3',
  'ل': '4', 'م': '5', 'ن': '5', 'ر': '6',
  'ع': '7', 'غ': '7', 'ه': '7', 'ء': '7', 'أ': '7', 'إ': '7', 'آ': '7', 'ؤ': '7', 'ئ': '7', 'ى': '7',
  'ا': '0', 'و': '0', 'ي': '0'
};

function jaro(a, b) {
  if (!a || !b) return 0;
  const md = Math.floor(Math.max(a.length, b.length) / 2) - 1;
  const am = new Array(a.length).fill(false);
  const bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++) {
    const st = Math.max(0, i - md);
    const en = Math.min(i + md + 1, b.length);
    for (let j = st; j < en; j++) {
      if (bm[j] || a[i] !== b[j]) continue;
      am[i] = bm[j] = true;
      m++;
      break;
    }
  }
  if (m === 0) return 0;
  let t = 0, k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!am[i]) continue;
    while (!bm[k]) k++;
    if (a[i] !== b[k]) t++;
    k++;
  }
  t = t / 2;
  return (m / a.length + m / b.length + (m - t) / m) / 3;
}

function jaroWinkler(a, b) {
  const j = jaro(a, b);
  let p = 0;
  for (let i = 0; i < Math.min(a.length, b.length, 4); i++) {
    if (a[i] === b[i]) p++;
    else break;
  }
  return j + p * 0.1 * (1 - j);
}

function soundex(s) {
  s = norm(s);
  if (!s) return '';
  let code = '';
  let last = SOUNDEX_MAP[s[0]] || '';
  for (let i = 1; i < s.length && code.length < 3; i++) {
    const c = SOUNDEX_MAP[s[i]];
    if (!c || c === '0') continue;
    if (c === last) continue;
    code += c;
    last = c;
  }
  while (code.length < 3) code += '0';
  return s[0] + code;
}

function matchProb(a, b) {
  const n1 = norm(a.name), n2 = norm(b.name);
  const jw = jaroWinkler(n1, n2);
  const sx = soundex(n1) === soundex(n2) ? 1 : 0;
  const da = norm((a.attributes || {})['تاريخ الميلاد']);
  const db = norm((b.attributes || {})['تاريخ الميلاد']);
  let dob;
  if (!da || !db) dob = 0.5;
  else dob = da === db ? 1 : 0;
  return WEIGHTS.name * jw + WEIGHTS.dob * dob + WEIGHTS.soundex * sx;
}

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);

    // تحميل كل بيانات المستخدم
    const [entities, connections, mentions, documents] = await Promise.all([
      localClient.entities.Entity.list('-mention_count', 1000),
      localClient.entities.Connection.list('-created_date', 2000),
      localClient.entities.Mention.list('-created_date', 2000),
      localClient.entities.Document.list('-created_date', 1000)
    ]);

    // عدد الروابط لكل كيان
    // 1) حلّ الكيانات: مطابقة حتمية + احتمالية (Entity Resolution)
    const reviewCandidates = new Map();
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));
    const addCandidate = (leftId, rightId, reason, probability) => {
      const [left, right] = [entityById.get(leftId), entityById.get(rightId)];
      if (!left || !right || left.type !== right.type || left.id === right.id) return;
      const [first, second] = [left, right].sort((a, b) => a.id.localeCompare(b.id));
      const pairKey = `${first.id}:${second.id}`;
      const current = reviewCandidates.get(pairKey);
      if (!current || probability > current.match_score) {
        reviewCandidates.set(pairKey, {
          left_id: first.id,
          right_id: second.id,
          left_name: first.name,
          right_name: second.name,
          entity_type: first.type,
          reason,
          match_score: probability,
          status: 'pending'
        });
      }
    };

    // (أ) المطابقات الحتمية تصبح اقتراحات للمراجعة، ولا تدمج السجلات تلقائياً.
    const byKey = Object.create(null);
    entities.forEach((e) => {
      const nk = 'name|' + (e.type || 'other') + '|' + norm(e.name);
      (byKey[nk] = byKey[nk] || []).push(e.id);
      STRONG_KEYS.forEach((sk) => {
        const v = norm((e.attributes || {})[sk]);
        if (!v) return;
        const kk = sk + '|' + v;
        (byKey[kk] = byKey[kk] || []).push(e.id);
      });
    });
    Object.values(byKey).forEach((ids) => {
      if (ids.length < 2) return;
      for (let i = 0; i < ids.length - 1; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          addCandidate(ids[i], ids[j], 'معرّف أو اسم موحّد متطابق', 1);
        }
      }
    });

    // (ب) المطابقات الاحتمالية تظهر للمراجعة ولا توحّد المعرّفات أو المراجع.
    const byType = Object.create(null);
    entities.forEach((e) => { (byType[e.type || 'other'] = byType[e.type || 'other'] || []).push(e); });
    const probMatches = [];
    Object.values(byType).forEach((arr) => {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const p = matchProb(arr[i], arr[j]);
          if (p >= RES_THRESHOLD) {
            const probability = +p.toFixed(3);
            probMatches.push({ a_id: arr[i].id, b_id: arr[j].id, a: arr[i].name, b: arr[j].name, probability });
            addCandidate(arr[i].id, arr[j].id, 'تشابه احتمالي في الاسم وبيانات الميلاد', probability);
          }
        }
      }
    });

    const suggestions = localClient.asServiceRole.transaction((db) => {
      const existing = new Set(db.list('DuplicateReview', {}, '-created_date', 10000)
        .map((review) => [review.left_id, review.right_id].sort().join(':')));
      let added = 0;
      for (const [pairKey, candidate] of reviewCandidates) {
        if (existing.has(pairKey)) continue;
        db.create('DuplicateReview', candidate);
        existing.add(pairKey);
        added++;
      }
      return { added, pending: db.list('DuplicateReview', { status: 'pending' }, '-created_date', 10000).length };
    });

    const canon = (id) => id;

    // 2) إعادة تمثيل الروابط بعد الدمج + تنظيف
    const remapped = connections
      .map((c) => ({
        ...c,
        source_entity_id: canon(c.source_entity_id),
        target_entity_id: canon(c.target_entity_id)
      }))
      .filter((c) => c.source_entity_id && c.target_entity_id);

    // Keep source relationships intact; only use endpoint pairs to avoid duplicate co-occurrence links.
    const seenPairs = new Set();
    remapped.forEach((c) => {
      if (c.source_entity_id === c.target_entity_id) return;
      const key = [c.source_entity_id, c.target_entity_id].sort().join('|');
      seenPairs.add(key);
    });

    // 3) روابط التشارك في المستندات (ارتباط تلقائي عبر المصادر)
    const docEntitySet = Object.create(null);
    mentions.forEach((m) => {
      const eid = canon(m.entity_id);
      if (!eid) return;
      (docEntitySet[m.document_id] = docEntitySet[m.document_id] || new Set()).add(eid);
    });

    const nameById = Object.create(null);
    entities.forEach((e) => { nameById[canon(e.id)] = e.name; });

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
            source_entity_name: nameById[arr[i]] || '',
            target_entity_name: nameById[arr[j]] || '',
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
      await localClient.entities.Connection.bulkCreate(newCooc.slice(0, coocCreated));
    }

    // 4) حساب الرؤى على السجلات الأصلية دون دمجها
    const entById = Object.create(null);
    entities.forEach((e) => { entById[e.id] = e; });
    const liveEntities = Object.values(entById);

    // العناقيد (Connected Components)
    const parent = Object.create(null);
    const find = (x) => { if (parent[x] === undefined) parent[x] = x; if (parent[x] !== x) parent[x] = find(parent[x]); return parent[x]; };
    const union = (a, b) => { parent[find(a)] = find(b); };
    liveEntities.forEach((e) => find(e.id));
    remapped.forEach((c) => { if (c.source_entity_id !== c.target_entity_id) union(c.source_entity_id, c.target_entity_id); });

    const clusters = Object.create(null);
    liveEntities.forEach((e) => {
      const r = find(e.id);
      (clusters[r] = clusters[r] || []).push(e);
    });
    const clusterList = Object.values(clusters).sort((a, b) => b.length - a.length);
    const largestClusters = clusterList.slice(0, 3).map((c) => ({
      size: c.length,
      members: c.slice(0, 5).map((e) => ({ id: e.id, name: e.name }))
    }));

    // الجسور (أعلى الكيانات درجةً)
    const degree = Object.create(null);
    remapped.forEach((c) => {
      if (c.source_entity_id === c.target_entity_id) return;
      degree[c.source_entity_id] = (degree[c.source_entity_id] || 0) + 1;
      degree[c.target_entity_id] = (degree[c.target_entity_id] || 0) + 1;
    });
    const bridgeEntities = liveEntities
      .map((e) => ({ id: e.id, name: e.name, type: TYPE_LABELS[e.type] || e.type, degree: degree[e.id] || 0, mentions: e.mention_count || 0 }))
      .filter((e) => e.degree > 0)
      .sort((a, b) => (b.degree + b.mentions * 0.5) - (a.degree + a.mentions * 0.5))
      .slice(0, 6);

    // الكيانات المعزولة
    const orphans = liveEntities.filter((e) => !degree[e.id]).slice(0, 8).map((e) => ({ id: e.id, name: e.name, type: TYPE_LABELS[e.type] || e.type }));
    const orphanCount = liveEntities.filter((e) => !degree[e.id]).length;

    // أعلى التشاركات (أزواج تتشارك في أكثر مستندات)
    const pairDocs = Object.create(null);
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
        return { a_id: a, b_id: b, a: entById[a]?.name || '—', b: entById[b]?.name || '—', shared_docs: docs.size };
      })
      .sort((x, y) => y.shared_docs - x.shared_docs)
      .slice(0, 6);

    // شبكة الخطورة
    const highRisk = liveEntities.filter((e) => (e.risk_score || 0) >= 70);
    const neighborMap = Object.create(null);
    remapped.forEach((c) => {
      if (c.source_entity_id === c.target_entity_id) return;
      (neighborMap[c.source_entity_id] = neighborMap[c.source_entity_id] || new Set()).add(c.target_entity_id);
      (neighborMap[c.target_entity_id] = neighborMap[c.target_entity_id] || new Set()).add(c.source_entity_id);
    });
    const riskNetwork = highRisk.map((e) => ({
      id: e.id,
      name: e.name,
      risk_score: e.risk_score,
      neighbors: (neighborMap[e.id] || new Set()).size
    }));

    // توزيع الأحداث حسب النوع
    const docTypeDist = Object.create(null);
    documents.forEach((d) => { const t = d.document_type || 'other'; docTypeDist[t] = (docTypeDist[t] || 0) + 1; });

    return Response.json({
      generated_at: new Date().toISOString(),
      correlation: {
        entities: liveEntities.length,
        connections: remapped.length + coocCreated,
        documents: documents.length,
        mentions: mentions.length,
        clusters: clusterList.length,
        cross_doc_links: coocCreated,
        duplicates_merged: 0,
        duplicate_suggestions_added: suggestions.added,
        duplicate_suggestions_pending: suggestions.pending
      },
      largest_clusters: largestClusters,
      bridge_entities: bridgeEntities,
      orphans: { count: orphanCount, sample: orphans },
      top_cooccurrence: topCooc,
      risk_network: riskNetwork,
      incidents_by_type: docTypeDist,
      merge_report: [],
      resolution: {
        threshold: RES_THRESHOLD,
        weights: WEIGHTS,
        probabilistic_merges: 0,
        probabilistic_suggestions: probMatches.length,
        probabilistic_sample: probMatches.slice(0, 12)
      }
    });
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}