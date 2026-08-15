import { useState, useEffect } from 'react';
import { Share2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NetworkGraph from '@/components/NetworkGraph';

export default function WorkspaceNetwork({ workspace }) {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!workspace) return;
      setLoading(true);
      try {
        const [allEnts, mentions, conns] = await Promise.all([
          base44.entities.Entity.list('-mention_count', 300),
          base44.entities.Mention.list('-created_date', 500),
          base44.entities.Connection.list('-created_date', 500)
        ]);
        const selectedIds = new Set(workspace.entity_ids || []);
        const docIds = new Set(workspace.document_ids || []);
        const docEntityIds = new Set(
          mentions.filter((m) => docIds.has(m.document_id)).map((m) => m.entity_id)
        );
        const allIds = new Set([...selectedIds, ...docEntityIds]);
        setEntities(allEnts.filter((e) => allIds.has(e.id)));
        setConnections(conns.filter(
          (c) => allIds.has(c.source_entity_id) && allIds.has(c.target_entity_id)
        ));
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [workspace?.id, (workspace?.entity_ids || []).length, (workspace?.document_ids || []).length]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">جارٍ تحميل الشبكة...</div>;

  if (entities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center py-12 text-muted-foreground">
        <Share2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">أضف كيانات أو حمّل مستندات لعرض شبكة التحليل.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Share2 className="w-4 h-4" /> شبكة التحليل
        </h3>
        <span className="text-xs text-muted-foreground">{entities.length} كيان • {connections.length} رابط</span>
      </div>
      <NetworkGraph entities={entities} connections={connections} height={520} />
    </div>
  );
}