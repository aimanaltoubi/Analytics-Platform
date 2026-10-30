import { createClientFromRequest } from '../../client.js';

const REVIEWABLE_TYPES = new Set(['person', 'company', 'organization']);
const MAX_NEW_CANDIDATES = 5000;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);
    const entities = await localClient.entities.Entity.list('-updated_date', 10000);
    const groups = new Map();
    for (const entity of entities) {
      if (!REVIEWABLE_TYPES.has(entity.type)) continue;
      const values = new Set([entity.name, ...(entity.aliases || [])].map(normalize).filter((value) => value.length >= 3));
      for (const value of values) {
        const key = `${entity.type}\u0000${value}`;
        if (!groups.has(key)) groups.set(key, new Map());
        groups.get(key).set(entity.id, entity);
      }
    }

    const candidates = new Map();
    for (const [key, group] of groups) {
      const members = [...group.values()];
      if (members.length < 2) continue;
      const matchedValue = key.slice(key.indexOf('\u0000') + 1);
      for (let leftIndex = 0; leftIndex < members.length - 1 && candidates.size < MAX_NEW_CANDIDATES; leftIndex++) {
        for (let rightIndex = leftIndex + 1; rightIndex < members.length && candidates.size < MAX_NEW_CANDIDATES; rightIndex++) {
          const [left, right] = [members[leftIndex], members[rightIndex]].sort((a, b) => a.id.localeCompare(b.id));
          const pairKey = `${left.id}:${right.id}`;
          const reason = normalize(left.name) === normalize(right.name) ? 'نفس الاسم بعد توحيد الكتابة' : `اسم بديل مشترك: ${matchedValue}`;
          const current = candidates.get(pairKey);
          if (!current || (reason.startsWith('نفس الاسم') && !current.reason.startsWith('نفس الاسم'))) {
            candidates.set(pairKey, {
              left_id: left.id,
              right_id: right.id,
              left_name: left.name,
              right_name: right.name,
              entity_type: left.type,
              reason,
              status: 'pending'
            });
          }
        }
      }
      if (candidates.size >= MAX_NEW_CANDIDATES) break;
    }

    const result = localClient.asServiceRole.transaction((db) => {
      const existing = new Set(db.list('DuplicateReview', {}, '-created_date', 10000)
        .map((review) => `${review.left_id}:${review.right_id}`));
      let added = 0;
      for (const [pairKey, candidate] of candidates) {
        if (existing.has(pairKey)) continue;
        db.create('DuplicateReview', candidate);
        existing.add(pairKey);
        added++;
      }
      const pending = db.list('DuplicateReview', { status: 'pending' }, '-created_date', 10000).length;
      return { added, pending, scanned_entities: entities.length, candidates_checked: candidates.size };
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}