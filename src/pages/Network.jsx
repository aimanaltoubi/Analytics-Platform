import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Share2, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NetworkGraph from '@/components/NetworkGraph';

export default function Network() {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ents, conns] = await Promise.all([
          base44.entities.Entity.list('-mention_count', 200),
          base44.entities.Connection.list('-created_date', 300)
        ]);
        setEntities(ents);
        setConnections(conns);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const types = ['all', ...new Set(entities.map((e) => e.type))];
  const filteredEntities = filter === 'all' ? entities : entities.filter((e) => e.type === filter);
  const filteredIds = new Set(filteredEntities.map((e) => e.id));
  const filteredConnections = connections.filter(
    (c) => filteredIds.has(c.source_entity_id) && filteredIds.has(c.target_entity_id)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">شبكة العلاقات</h1>
          <p className="text-sm text-muted-foreground mt-1">خريطة الكيانات والروابط بينها — اسحب العقد لإعادة الترتيب</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">تصفية حسب النوع:</span>
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
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">جارٍ تحميل الشبكة...</div>
      ) : filteredEntities.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Share2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد بيانات بعد. ارفع مستندات لإنشاء الشبكة.</p>
        </div>
      ) : (
        <NetworkGraph entities={filteredEntities} connections={filteredConnections} height={580} />
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
              {filteredConnections.slice(0, 10).map((c) => (
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