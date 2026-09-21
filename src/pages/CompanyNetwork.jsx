import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Network, Building2, RefreshCw, Share2, Users, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import GraphCanvas from '@/components/GraphCanvas';
import { buildAdjacencyFromEdges, degreeCentrality, betweennessCentrality, labelPropagation, communities, companySubgraph } from '@/lib/networkAnalysis';

export default function CompanyNetwork() {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [egoId, setEgoId] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [ents, conns] = await Promise.all([
        base44.entities.Entity.list('-mention_count', 2000),
        base44.entities.Connection.list('-created_date', 2000)
      ]);
      setEntities(ents);
      setConnections(conns);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const graph = useMemo(() => {
    const sub = companySubgraph(entities, connections);
    const nodes = sub.companies.map((c) => ({ id: c.id, name: c.name, type: c.type, degree: 0 }));
    const edges = sub.edges.map((e) => ({ source: e.source, target: e.target, rel: e.rel, weight: e.weight }));
    const { adj } = buildAdjacencyFromEdges(nodes, edges);
    const deg = degreeCentrality(adj);
    nodes.forEach((n) => { n.degree = deg.get(n.id) || 0; });
    const bc = betweennessCentrality(adj, 60);
    const centralityMap = {};
    nodes.forEach((n) => { centralityMap[n.id] = (bc.get(n.id) || 0) + (deg.get(n.id) || 0) * 0.5; });
    const label = labelPropagation(adj, 8);
    const clusterMap = {};
    label.forEach((l, id) => { clusterMap[id] = l; });
    const comms = communities(label);
    const communitiesList = comms.map((ids, i) => {
      const members = ids.map((id) => sub.companies.find((c) => c.id === id)).filter(Boolean);
      return { index: i, ids, members };
    }).sort((a, b) => b.ids.length - a.ids.length);
    const centralityRanked = nodes.map((n) => ({ ...n, c: centralityMap[n.id] || 0 })).sort((a, b) => b.c - a.c);
    return { nodes, edges, clusterMap, centralityMap, communitiesList, centralityRanked, adj, companyIds: new Set(nodes.map((n) => n.id)) };
  }, [entities, connections]);

  const ego = useMemo(() => {
    if (!egoId) return null;
    const center = graph.nodes.find((n) => n.id === egoId);
    if (!center) return null;
    const neighbors = [...(graph.adj.get(egoId) || [])].map((id) => graph.nodes.find((n) => n.id === id)).filter(Boolean);
    return { center, neighbors };
  }, [egoId, graph]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ بناء شبكة الشركات...</div>;

  const topHub = graph.centralityRanked.find((n) => n.degree > 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> شبكة الشركات والمنظمات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            شبكة مخصصة للشركات والمنظمات، تُربط عبر الموظفين المشتركين، الهواتف/البريد المشترك، والتشارك في المستندات والمعاملات المالية.
          </p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90">
          <RefreshCw className="w-4 h-4" /> تحديث
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'شركة/منظمة', value: graph.nodes.length, icon: Building2, color: 'bg-primary' },
          { label: 'روابط بينية', value: graph.edges.length, icon: Share2, color: 'bg-emerald-500' },
          { label: 'مجتمعات', value: graph.communitiesList.length, icon: Network, color: 'bg-blue-500' },
          { label: 'أبرز محور', value: topHub ? topHub.name : '—', icon: Users, color: 'bg-amber-500', text: true }
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg ${c.color} text-white flex items-center justify-center`}><Icon className="w-5 h-5" /></div>
                <span className={`font-bold font-heading ${c.text ? 'text-sm truncate max-w-[140px]' : 'text-2xl'}`}>{c.value}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-heading font-semibold flex items-center gap-2"><Network className="w-4 h-4 text-primary" /> خريطة شبكة الشركات</h3>
        <p className="text-xs text-muted-foreground">الشركات مُبرزة بالأحمر الداكن وحجمها حسب المركزية. الألوان تميّز المجتمعات (العناقيد). انقر على شركة لاستكشافها.</p>
        <GraphCanvas nodes={graph.nodes} edges={graph.edges} clusterMap={graph.clusterMap} centralityMap={graph.centralityMap} companyIds={graph.companyIds} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><Share2 className="w-4 h-4 text-primary" /> ترتيب الشركات بالمركزية</h3>
          <p className="text-xs text-muted-foreground mb-3">الوساطة + الدرجة — الأعلى أكثر أهمية في الشبكة.</p>
          {graph.centralityRanked.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">لا توجد شركات.</p>
          ) : (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {graph.centralityRanked.map((n, i) => (
                <Link key={n.id} to={`/entities/${n.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/60 transition-colors">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.name}</div>
                    <div className="text-xs text-muted-foreground">{n.degree} رابط</div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">{n.c.toFixed(1)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><Network className="w-4 h-4 text-primary" /> مجتمعات الشركات</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {graph.communitiesList.map((c) => (
              <div key={c.index} className="rounded-lg bg-accent/40 p-2.5">
                <button onClick={() => setExpanded(expanded === c.index ? null : c.index)} className="w-full flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium">مجتمع {c.index + 1}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.ids.length} شركة</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded === c.index ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                <div className="flex flex-wrap gap-1">
                  {c.members.slice(0, expanded === c.index ? 50 : 6).map((m) => (
                    <Link key={m.id} to={`/entities/${m.id}`} className="text-xs px-2 py-0.5 rounded-md bg-card border border-border hover:border-primary/40 hover:text-primary transition-colors">{m.name}</Link>
                  ))}
                  {c.members.length > 6 && expanded !== c.index && <span className="text-xs text-muted-foreground px-2 py-0.5">+{c.members.length - 6}</span>}
                </div>
              </div>
            ))}
            {graph.communitiesList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">لا توجد مجتمعات.</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-heading font-semibold flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> شبكة الإيغو (Ego Network)</h3>
        <p className="text-xs text-muted-foreground">اختر شركة لعرض شبكتها المحلية المباشرة (الجيران من الدرجة الأولى).</p>
        <select value={egoId} onChange={(e) => setEgoId(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-w-md">
          <option value="">— اختر شركة —</option>
          {graph.nodes.map((n) => (<option key={n.id} value={n.id}>{n.name}</option>))}
        </select>
        {!ego ? (
          <p className="text-sm text-muted-foreground py-4 text-center">اختر شركة لعرض شبكة إيغو.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-primary/10 border border-primary/30 p-3">
              <div className="text-sm font-bold">{ego.center.name}</div>
              <div className="text-xs text-muted-foreground">{ego.center.degree} رابط مباشر</div>
            </div>
            {ego.neighbors.length === 0 ? (
              <p className="text-xs text-muted-foreground">لا توجد روابط مباشرة لهذه الشركة.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ego.neighbors.map((n) => (
                  <Link key={n.id} to={`/entities/${n.id}`} className="flex items-center gap-2 p-2 rounded-lg bg-accent/40 hover:bg-accent transition-colors">
                    <Building2 className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{n.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{n.degree} رابط</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}