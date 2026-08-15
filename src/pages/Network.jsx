import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NetworkGraph from '@/components/NetworkGraph';

export default function Network() {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [minRisk, setMinRisk] = useState(0);
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [hiddenRels, setHiddenRels] = useState(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ents, conns, ment, wss] = await Promise.all([
          base44.entities.Entity.list('-mention_count', 200),
          base44.entities.Connection.list('-created_date', 300),
          base44.entities.Mention.list('-created_date', 500),
          base44.entities.Workspace.list('-created_date', 100)
        ]);
        setEntities(ents);
        setConnections(conns);
        setMentions(ment);
        setWorkspaces(wss);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const workspaceEntityIds = (() => {
    if (workspaceFilter === 'all') return null;
    const ws = workspaces.find((w) => w.id === workspaceFilter);
    if (!ws) return null;
    const ids = new Set(ws.entity_ids || []);
    const docIds = new Set(ws.document_ids || []);
    for (const m of mentions) {
      if (docIds.has(m.document_id)) ids.add(m.entity_id);
    }
    return ids;
  })();

  const types = ['all', ...new Set(entities.map((e) => e.type))];
  const filteredEntities = entities.filter((e) => {
    const matchWorkspace = !workspaceEntityIds || workspaceEntityIds.has(e.id);
    const matchType = filter === 'all' || e.type === filter;
    const matchRisk = (e.risk_score || 0) >= minRisk;
    return matchWorkspace && matchType && matchRisk;
  });
  const filteredIds = new Set(filteredEntities.map((e) => e.id));
  const filteredConnections = connections.filter(
    (c) => filteredIds.has(c.source_entity_id) && filteredIds.has(c.target_entity_id)
  );

  const relTypes = Array.from(new Set(connections.map((c) => c.relationship_type).filter(Boolean)));
  const visibleConnections = filteredConnections.filter((c) => !hiddenRels.has(c.relationship_type));

  const toggleRel = (type) => {
    setHiddenRels((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">شبكة العلاقات</h1>
          <p className="text-sm text-muted-foreground mt-1">خريطة الكيانات والروابط بينها — اسحب العقد لإعادة الترتيب</p>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">مساحة العمل:</span>
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">الكل</option>
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">النوع:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {types.map((t) => (
              <option key={t} value={t}>{t === 'all' ? 'الكل' : t}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">أدنى خطورة: {minRisk}</span>
          <input
            type="range"
            min={0}
            max={100}
            value={minRisk}
            onChange={(e) => setMinRisk(Number(e.target.value))}
            className="w-28 accent-primary"
          />
        </div>
        </div>
      </div>

      {relTypes.length > 0 && !loading && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">إظهار العلاقات:</span>
          {relTypes.map((t) => {
            const hidden = hiddenRels.has(t);
            return (
              <button
                key={t}
                onClick={() => toggleRel(t)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  hidden ? 'text-muted-foreground border-border line-through opacity-60' : 'bg-primary/10 text-primary border-primary/30'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${hidden ? 'bg-muted-foreground' : 'bg-primary'}`} />
                {t}
              </button>
            );
          })}
          {hiddenRels.size > 0 && (
            <button onClick={() => setHiddenRels(new Set())} className="text-xs text-primary hover:underline">إظهار الكل</button>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">جارٍ تحميل الشبكة...</div>
      ) : filteredEntities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Share2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد بيانات بعد. ارفع مستندات لإنشاء الشبكة.</p>
        </div>
      ) : (
        <NetworkGraph entities={filteredEntities} connections={visibleConnections} height={580} />
      )}

      {!loading && filteredEntities.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> الكيانات الأبرز
            </h3>
            <div className="space-y-2">
              {filteredEntities.slice(0, 10).map((e) => (
                <Link
                  key={e.id}
                  to={`/entities/${e.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">{e.type}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{e.mention_count || 0} ذكر</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
              <Share2 className="w-4 h-4" /> أحدث الروابط
            </h3>
            <div className="space-y-2">
              {visibleConnections.slice(0, 10).map((c) => (
                <div key={c.id} className="p-2.5 rounded-lg bg-accent/30 text-sm">
                  <span className="font-medium">{c.source_entity_name}</span>
                  <span className="text-muted-foreground mx-1">—{c.relationship_type}→</span>
                  <span className="font-medium">{c.target_entity_name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}