import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Users, Share2, FileText, Bell, Calendar } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TYPE_LABELS = {
  person: 'فرد', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

export default function ChangeTracking() {
  const [baseline, setBaseline] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [allEnts, setAllEnts] = useState([]);
  const [allConns, setAllConns] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [allAlerts, setAllAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ents, conns, docs, alerts] = await Promise.all([
          base44.entities.Entity.list('-created_date', 500),
          base44.entities.Connection.list('-created_date', 500),
          base44.entities.Document.list('-created_date', 500),
          base44.entities.Alert.list('-created_date', 200)
        ]);
        setAllEnts(ents); setAllConns(conns); setAllDocs(docs); setAllAlerts(alerts);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const since = useMemo(() => new Date(baseline).getTime(), [baseline]);

  const newEntities = useMemo(() => allEnts.filter((e) => new Date(e.created_date).getTime() >= since), [allEnts, since]);
  const newConns = useMemo(() => allConns.filter((c) => new Date(c.created_date).getTime() >= since), [allConns, since]);
  const newDocs = useMemo(() => allDocs.filter((d) => new Date(d.created_date).getTime() >= since), [allDocs, since]);
  const newAlerts = useMemo(() => allAlerts.filter((a) => new Date(a.triggered_at || a.created_date).getTime() >= since), [allAlerts, since]);

  const kpis = [
    { label: 'كيانات جديدة', value: newEntities.length, icon: Users, to: '/entities', tint: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'روابط جديدة', value: newConns.length, icon: Share2, to: '/graph', tint: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'مستندات جديدة', value: newDocs.length, icon: FileText, to: '/documents', tint: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'تنبيهات جديدة', value: newAlerts.length, icon: Bell, to: '/alerts', tint: 'text-red-600', bg: 'bg-red-50' }
  ];

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" /> تتبع التغيّرات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">الكيانات والروابط والمستندات والتنبيهات الجديدة منذ تاريخ أساسي.</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground">منذ</label>
          <input
            type="date"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Link key={k.label} to={k.to} className="rounded-lg border border-border bg-card p-4 hover:border-primary/40 hover:shadow-sm transition-all">
              <div className={`w-9 h-9 rounded-md ${k.bg} ${k.tint} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="font-mono text-2xl font-bold tabular-nums">{k.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1">{k.label}</div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">كيانات جديدة ({newEntities.length})</h3>
          {newEntities.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد كيانات جديدة.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {newEntities.slice(0, 50).map((e) => (
                <Link key={e.id} to={`/entities/${e.id}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent shrink-0">{TYPE_LABELS[e.type] || 'أخرى'}</span>
                  <span className="text-sm font-medium truncate flex-1">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{new Date(e.created_date).toLocaleDateString('ar-EG')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">تنبيهات جديدة ({newAlerts.length})</h3>
          {newAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد تنبيهات جديدة.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {newAlerts.slice(0, 50).map((a) => (
                <Link key={a.id} to="/alerts" className="block p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">{a.rule_name || a.rule_type || ''} • {a.severity}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">مستندات جديدة ({newDocs.length})</h3>
          {newDocs.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مستندات جديدة.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {newDocs.slice(0, 50).map((d) => (
                <Link key={d.id} to={`/documents/${d.id}`} className="block p-2 rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  <div className="text-[11px] text-muted-foreground">{d.entity_count || 0} كيان • {d.status}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">روابط جديدة ({newConns.length})</h3>
          {newConns.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد روابط جديدة.</p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {newConns.slice(0, 50).map((c) => (
                <div key={c.id} className="text-sm p-2 rounded-lg bg-accent/30">
                  <span className="font-medium">{c.source_entity_name || '—'}</span>
                  <span className="text-muted-foreground"> [{c.relationship_type}] </span>
                  <span className="font-medium">{c.target_entity_name || '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}