import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Network, RefreshCw, Users, Share2, GitFork, Unlink, Search, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BarList from '@/components/BarList';
import GraphCanvas from '@/components/GraphCanvas';
import PathAnalysis from '@/components/PathAnalysis';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

export default function GraphIndex() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entities, setEntities] = useState([]);
  const [focusId, setFocusId] = useState('');
  const [focus, setFocus] = useState(null);
  const [focusLoading, setFocusLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [res, ents] = await Promise.all([
        base44.functions.invoke('buildGraphIndex', {}),
        base44.entities.Entity.list('-mention_count', 2000)
      ]);
      setData(res.data);
      setEntities(ents);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const [gNodes, setGNodes] = useState([]);
  const [gEdges, setGEdges] = useState([]);

  const buildInitialGraph = (d) => {
    const nodes = new Map();
    const edges = [];
    const seen = new Set();
    const addNode = (n) => { if (!nodes.has(n.id)) nodes.set(n.id, { id: n.id, name: n.name, type: n.type, degree: n.degree || 0 }); };
    (d.hubs || []).slice(0, 8).forEach((h) => {
      addNode(h);
      const adj = d.adjacency && d.adjacency[h.id];
      (adj && adj.neighbors || []).slice(0, 6).forEach((nb) => {
        addNode({ id: nb.id, name: nb.name, type: nb.type, degree: 0 });
        const key = [h.id, nb.id].sort().join('|');
        if (!seen.has(key)) { seen.add(key); edges.push({ source: h.id, target: nb.id, rel: nb.rel }); }
      });
    });
    setGNodes([...nodes.values()]);
    setGEdges(edges);
  };

  const expandNode = async (id) => {
    setFocusId(id);
    if (!id) { setFocus(null); return; }
    setFocusLoading(true);
    try {
      const res = await base44.functions.invoke('buildGraphIndex', { focus_id: id });
      const f = res.data.focus;
      setFocus(f);
      setGNodes((prev) => {
        const map = new Map(prev.map((n) => [n.id, n]));
        (f.hop1 || []).forEach((nb) => { if (!map.has(nb.id)) map.set(nb.id, { id: nb.id, name: nb.name, type: nb.type, degree: 0 }); });
        return [...map.values()];
      });
      setGEdges((prev) => {
        const set = new Set(prev.map((e) => [e.source, e.target].sort().join('|')));
        const next = [...prev];
        (f.hop1 || []).forEach((nb) => {
          const key = [id, nb.id].sort().join('|');
          if (!set.has(key)) { set.add(key); next.push({ source: id, target: nb.id, rel: nb.rel }); }
        });
        return next;
      });
    } catch (e) {} finally { setFocusLoading(false); }
  };

  useEffect(() => { if (data) buildInitialGraph(data); }, [data]);

  const filteredEntities = useMemo(() => {
    const ql = filter.trim().toLowerCase();
    const base = ql ? entities.filter((e) => e.name.toLowerCase().includes(ql)) : entities;
    return base.slice(0, 300);
  }, [entities, filter]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ بناء فهرس العلاقات...</div>;
  if (!data) return <div className="p-6 text-sm text-muted-foreground">تعذّر تحميل الفهرس.</div>;

  const stats = data.stats || {};
  const statCards = [
    { label: 'العقد (الكيانات)', value: stats.nodes ?? 0, icon: Users, color: 'bg-violet-500' },
    { label: 'الروابط', value: stats.edges ?? 0, icon: Share2, color: 'bg-emerald-500' },
    { label: 'كيانات متصلة', value: stats.connected ?? 0, icon: GitFork, color: 'bg-blue-500' },
    { label: 'كيانات معزولة', value: stats.isolated ?? 0, icon: Unlink, color: 'bg-amber-500' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Network className="w-6 h-6 text-primary" /> فهرس العلاقات (قاعدة بيانات الرسم البياني)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            محرّك تخزين يربط نقاط البيانات كشبكة علاقات: المشتبه أ [يتصل بـ] المشتبه ب، المشتبه ب [يقود] المركبة ج — مع استكشاف الجوار متعدد الدرجة.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> إعادة بناء الفهرس
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg ${c.color} text-white flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold font-heading">{c.value}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* توزيع أنواع العلاقات */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-4">توزيع أنواع العلاقات</h3>
          {(data.relTypes || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد روابط</p>
          ) : (
            <BarList
              max={Math.max(...data.relTypes.map((r) => r.value), 1)}
              items={data.relTypes.map((r) => ({ name: r.name, values: [{ label: '', value: r.value, color: '#8b5cf6' }] }))}
            />
          )}
          <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground flex justify-between">
            <span>كثافة الشبكة</span>
            <span className="font-medium">{((stats.density ?? 0) * 100).toFixed(2)}%</span>
          </div>
        </div>

        {/* أعلى المحاور */}
        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="font-heading font-semibold mb-3">أعلى المحاور (الأكثر ارتباطاً)</h3>
          {(data.hubs || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">لا توجد محاور</p>
          ) : (
            <div className="space-y-1">
              {data.hubs.map((h, i) => (
                <Link key={h.id} to={`/entities/${h.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/60 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-accent text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{h.name}</div>
                    <div className="text-xs text-muted-foreground">{TYPE_LABELS[h.type] || 'أخرى'}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">{h.degree} رابط</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* خريطة الروابط التفاعلية */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Network className="w-4 h-4 text-primary" /> خريطة الروابط التفاعلية (Graph Canvas)
        </h3>
        <p className="text-xs text-muted-foreground">
          انقر على أي عقدة لتوسيع شبكة علاقاتها، واسحب العقد لإعادة ترتيبها. العقدة المحددة وعلاقاتها تُبرز باللون الأزرق.
        </p>
        <GraphCanvas nodes={gNodes} edges={gEdges} focusId={focusId} onNodeClick={expandNode} />
      </div>

      {/* مستكشف الشبكة */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <GitFork className="w-4 h-4 text-primary" /> مستكشف شبكة العلاقات
        </h3>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="ابحث عن كيان لاستكشاف شبكة علاقاته..."
              className="w-full pr-10 pl-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <select
            value={focusId}
            onChange={(e) => expandNode(e.target.value)}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-[260px]"
          >
            <option value="">— اختر كياناً —</option>
            {filteredEntities.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </div>

        {focusLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">جارٍ استكشاف الجوار...</div>
        ) : !focus ? (
          <div className="text-sm text-muted-foreground py-8 text-center">اختر كياناً لعرض شبكة علاقاته (درجتان).</div>
        ) : (
          <div className="space-y-4">
            {/* العقدة المركزية */}
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-bold">{focus.node.name}</div>
                <div className="text-xs text-muted-foreground">{TYPE_LABELS[focus.node.type] || 'أخرى'} • {focus.node.degree} رابط</div>
              </div>
              <Link to={`/entities/${focus.node.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                عرض الكيان <ArrowRight className="w-3 h-3 rotate-180" />
              </Link>
            </div>

            {/* الدرجة الأولى */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">الجوار المباشر (درجة 1) — {focus.hop1.length}</div>
              {focus.hop1.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد روابط مباشرة.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {focus.hop1.map((n, i) => (
                    <Link key={i} to={`/entities/${n.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-accent/40 hover:bg-accent transition-colors">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/15 text-primary shrink-0 font-medium">{n.rel || 'مرتبط'}</span>
                      <span className="text-sm truncate flex-1">{n.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{TYPE_LABELS[n.type] || ''}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* الدرجة الثانية */}
            {focus.hop2.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">الجوار غير المباشر (درجة 2) — {focus.hop2.length}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {focus.hop2.slice(0, 20).map((n, i) => (
                    <Link key={i} to={`/entities/${n.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-accent/20 hover:bg-accent/60 transition-colors">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{n.rel || 'مرتبط'}</span>
                      <span className="text-sm truncate flex-1">{n.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0 truncate">عبر: {n.via}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <PathAnalysis entities={entities} />
    </div>
  );
}