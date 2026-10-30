import { createClientFromRequest } from '../../client.js';

const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const mutableFields = (record) => Object.fromEntries(Object.entries(record).filter(([key]) => !['id', 'created_by', 'created_date'].includes(key)));

export default async function(req) {
  try {
    const localClient = createClientFromRequest(req);
    const body = await req.json();
    if (!body.merge_history_id) return Response.json({ error: 'merge_history_id required' }, { status: 400 });

    const result = localClient.asServiceRole.transaction((db) => {
      const history = db.get('MergeHistory', body.merge_history_id);
      if (!history) return { error: 'Merge history not found', status: 404 };
      if (history.status !== 'active') return { error: 'This merge has already been undone', status: 409 };
      if (db.get('Entity', history.duplicate_id)) return { error: 'The original duplicate ID is already in use', status: 409 };

      const currentPrimary = db.get('Entity', history.primary_id);
      if (!currentPrimary || !same(currentPrimary, history.primary_after)) {
        return { error: 'Cannot undo safely: the primary entity changed after this merge', status: 409 };
      }
      for (const expected of history.connections_after) {
        if (!same(db.get('Connection', expected.id), expected)) {
          return { error: 'Cannot undo safely: a relationship changed after this merge', status: 409 };
        }
      }
      for (const id of history.deleted_connection_ids) {
        if (db.get('Connection', id)) return { error: 'Cannot undo safely: a removed relationship ID is in use', status: 409 };
      }
      for (const expected of history.mentions_after) {
        if (!same(db.get('Mention', expected.id), expected)) {
          return { error: 'Cannot undo safely: a mention changed after this merge', status: 409 };
        }
      }
      for (const [collection, records] of [
        ['Workspace', history.workspaces_after],
        ['Alert', history.alerts_after],
        ['Notification', history.notifications_after]
      ]) {
        for (const expected of records) {
          if (!same(db.get(collection, expected.id), expected)) {
            return { error: `Cannot undo safely: a ${collection.toLowerCase()} changed after this merge`, status: 409 };
          }
        }
      }

      db.update('Entity', history.primary_id, mutableFields(history.primary_before));
      db.restore('Entity', history.duplicate_before);
      for (const connection of history.connections_before) {
        if (db.get('Connection', connection.id)) db.update('Connection', connection.id, mutableFields(connection));
        else db.restore('Connection', connection);
      }
      for (const mention of history.mentions_before) db.update('Mention', mention.id, mutableFields(mention));
      for (const workspace of history.workspaces_before) db.update('Workspace', workspace.id, mutableFields(workspace));
      for (const alert of history.alerts_before) db.update('Alert', alert.id, mutableFields(alert));
      for (const notification of history.notifications_before) db.update('Notification', notification.id, mutableFields(notification));
      db.update('MergeHistory', history.id, { status: 'undone', undone_at: new Date().toISOString() });
      if (history.review_id) {
        const review = db.get('DuplicateReview', history.review_id);
        if (review) db.update('DuplicateReview', history.review_id, { status: 'pending' });
      }
      return { ok: true, merge_history_id: history.id, restored_entity_id: history.duplicate_id };
    });
    if (result.error) return Response.json({ error: result.error }, { status: result.status });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status || 500 });
  }
}