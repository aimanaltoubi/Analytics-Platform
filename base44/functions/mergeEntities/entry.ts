import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const primaryId = body.primary_id;
    const duplicateId = body.duplicate_id;
    if (!primaryId || !duplicateId) return Response.json({ error: 'primary_id and duplicate_id required' }, { status: 400 });
    if (primaryId === duplicateId) return Response.json({ error: 'cannot merge an entity with itself' }, { status: 400 });

    const primary = await base44.entities.Entity.get(primaryId);
    const duplicate = await base44.entities.Entity.get(duplicateId);
    if (!primary || !duplicate) return Response.json({ error: 'entity not found' }, { status: 404 });

    // 1) إعادة توجيه الروابط التي تشير إلى الكيان المكرر
    const [srcConns, tgtConns] = await Promise.all([
      base44.asServiceRole.entities.Connection.filter({ source_entity_id: duplicateId }, '-created_date', 3000),
      base44.asServiceRole.entities.Connection.filter({ target_entity_id: duplicateId }, '-created_date', 3000)
    ]);
    const seen = new Set();
    const patches = [];
    const selfLoopIds = [];
    for (const c of [...srcConns, ...tgtConns]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      const patch = { id: c.id };
      let newSrc = c.source_entity_id;
      let newTgt = c.target_entity_id;
      if (c.source_entity_id === duplicateId) { patch.source_entity_id = primaryId; patch.source_entity_name = primary.name; newSrc = primaryId; }
      if (c.target_entity_id === duplicateId) { patch.target_entity_id = primaryId; patch.target_entity_name = primary.name; newTgt = primaryId; }
      if (newSrc === newTgt) { selfLoopIds.push(c.id); continue; }
      patches.push(patch);
    }
    if (patches.length > 0) await base44.asServiceRole.entities.Connection.bulkUpdate(patches);
    if (selfLoopIds.length > 0) await base44.asServiceRole.entities.Connection.deleteMany({ id: { $in: selfLoopIds } });

    // 2) إعادة توجيه الذكر إلى الكيان الأساسي
    await base44.asServiceRole.entities.Mention.updateMany(
      { entity_id: duplicateId },
      { $set: { entity_id: primaryId, entity_name: primary.name } }
    );

    // 3) دمج الحقول على الكيان الأساسي
    const mergedAliases = Array.from(new Set([
      ...(primary.aliases || []),
      duplicate.name,
      ...(duplicate.aliases || [])
    ].filter(Boolean))).filter((a) => a && a !== primary.name);

    const mergedAttrs = Object.assign({}, duplicate.attributes || {}, primary.attributes || {});
    const mergedDocIds = Array.from(new Set([
      ...(primary.document_ids || []),
      ...(duplicate.document_ids || [])
    ]));
    const patch = {
      aliases: mergedAliases,
      attributes: mergedAttrs,
      document_ids: mergedDocIds,
      risk_score: Math.max(primary.risk_score || 0, duplicate.risk_score || 0),
      watchlist: !!(primary.watchlist || duplicate.watchlist),
      mention_count: (primary.mention_count || 0) + (duplicate.mention_count || 0)
    };
    if (primary.latitude == null && duplicate.latitude != null) {
      patch.latitude = duplicate.latitude;
      patch.longitude = duplicate.longitude;
    }
    if (!primary.photo_url && duplicate.photo_url) patch.photo_url = duplicate.photo_url;

    await base44.entities.Entity.update(primaryId, patch);

    // 4) حذف الكيان المكرر
    await base44.entities.Entity.delete(duplicateId);

    return Response.json({
      ok: true,
      primary_id: primaryId,
      repointed_connections: patches.length,
      removed_self_loops: selfLoopIds.length,
      merged_aliases: mergedAliases.length,
      merged_documents: mergedDocIds.length,
      mention_count: patch.mention_count
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}