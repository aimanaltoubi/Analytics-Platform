import { createClientFromRequest } from '../../client.js';

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);
    const body = await req.json();
    const { primary_id: primaryId, duplicate_id: duplicateId } = body;
    if (!primaryId || !duplicateId) return Response.json({ error: 'primary_id and duplicate_id required' }, { status: 400 });
    if (primaryId === duplicateId) return Response.json({ error: 'cannot merge an entity with itself' }, { status: 400 });

    const result = localClient.asServiceRole.transaction((db) => {
      const primary = db.get('Entity', primaryId);
      const duplicate = db.get('Entity', duplicateId);
      if (!primary || !duplicate) return { error: 'entity not found', status: 404 };
      if (primary.type !== duplicate.type) return { error: 'Entities must have the same type to merge', status: 422 };

      const connectionsBefore = db.list('Connection', {
        $or: [{ source_entity_id: duplicateId }, { target_entity_id: duplicateId }]
      });
      const mentionsBefore = db.list('Mention', { entity_id: duplicateId });
      const workspacesBefore = db.list('Workspace', { entity_ids: duplicateId });
      const alertsBefore = db.list('Alert', { entity_ids: duplicateId });
      const notificationsBefore = db.list('Notification', { entity_id: duplicateId });
      const connectionsAfter = [];
      const deletedConnectionIds = [];

      for (const connection of connectionsBefore) {
        const sourceId = connection.source_entity_id === duplicateId ? primaryId : connection.source_entity_id;
        const targetId = connection.target_entity_id === duplicateId ? primaryId : connection.target_entity_id;
        if (sourceId === targetId) {
          db.delete('Connection', connection.id);
          deletedConnectionIds.push(connection.id);
          continue;
        }
        connectionsAfter.push(db.update('Connection', connection.id, {
          source_entity_id: sourceId,
          target_entity_id: targetId,
          source_entity_name: sourceId === primaryId ? primary.name : connection.source_entity_name,
          target_entity_name: targetId === primaryId ? primary.name : connection.target_entity_name
        }));
      }

      const mentionsAfter = mentionsBefore.map((mention) => db.update('Mention', mention.id, {
        entity_id: primaryId,
        entity_name: primary.name
      }));
      const workspacesAfter = workspacesBefore.map((workspace) => db.update('Workspace', workspace.id, {
        entity_ids: [...new Set((workspace.entity_ids || []).map((id) => id === duplicateId ? primaryId : id))]
      }));
      const alertsAfter = alertsBefore.map((alert) => db.update('Alert', alert.id, {
        entity_ids: [...new Set((alert.entity_ids || []).map((id) => id === duplicateId ? primaryId : id))],
        entity_names: [...new Set((alert.entity_names || []).map((name) => name === duplicate.name ? primary.name : name))]
      }));
      const notificationsAfter = notificationsBefore.map((notification) => db.update('Notification', notification.id, {
        entity_id: primaryId,
        entity_name: primary.name
      }));
      const mergedAliases = Array.from(new Set([...(primary.aliases || []), duplicate.name, ...(duplicate.aliases || [])]
        .filter((alias) => alias && alias !== primary.name)));
      const mergedDocIds = Array.from(new Set([...(primary.document_ids || []), ...(duplicate.document_ids || [])]));
      const primaryAfter = db.update('Entity', primaryId, {
        aliases: mergedAliases,
        attributes: { ...(duplicate.attributes || {}), ...(primary.attributes || {}) },
        document_ids: mergedDocIds,
        risk_score: Math.max(primary.risk_score || 0, duplicate.risk_score || 0),
        watchlist: !!(primary.watchlist || duplicate.watchlist),
        mention_count: (primary.mention_count || 0) + (duplicate.mention_count || 0),
        ...(primary.latitude == null && duplicate.latitude != null ? { latitude: duplicate.latitude, longitude: duplicate.longitude } : {}),
        ...(!primary.photo_url && duplicate.photo_url ? { photo_url: duplicate.photo_url } : {})
      });
      db.delete('Entity', duplicateId);

      const history = db.create('MergeHistory', {
        primary_id: primaryId,
        duplicate_id: duplicateId,
        ...(body.review_id ? { review_id: body.review_id } : {}),
        status: 'active',
        primary_before: primary,
        primary_after: primaryAfter,
        duplicate_before: duplicate,
        connections_before: connectionsBefore,
        connections_after: connectionsAfter,
        deleted_connection_ids: deletedConnectionIds,
        mentions_before: mentionsBefore,
        mentions_after: mentionsAfter,
        workspaces_before: workspacesBefore,
        workspaces_after: workspacesAfter,
        alerts_before: alertsBefore,
        alerts_after: alertsAfter,
        notifications_before: notificationsBefore,
        notifications_after: notificationsAfter
      });

      if (body.review_id) {
        const review = db.get('DuplicateReview', body.review_id);
        if (!review || review.status !== 'pending' || ![review.left_id, review.right_id].includes(primaryId) || ![review.left_id, review.right_id].includes(duplicateId)) {
          throw Object.assign(new Error('Duplicate review is no longer pending'), { status: 409 });
        }
        db.update('DuplicateReview', body.review_id, { status: 'merged', merge_history_id: history.id });
      }

      return {
        ok: true,
        merge_history_id: history.id,
        primary_id: primaryId,
        repointed_connections: connectionsAfter.length,
        removed_self_loops: deletedConnectionIds.length,
        merged_documents: mergedDocIds.length,
        mention_count: primaryAfter.mention_count
      };
    });
    if (result.error) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}