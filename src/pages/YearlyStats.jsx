import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, Users, Share2, Bell, ShieldAlert, Flag, Calendar, BarChart3,
  GitBranch, AlertTriangle, Boxes, Link2, Unlink,
  TrendingUp, Activity, Gauge, RefreshCw
} from 'lucide-react';
import { localClient } from '@/api/localClient';
import { availableYears, docsInYear, yearDocIdSet, connectionsForDocs, entitiesForDocs } from '@/lib/yearFilter';
import TopEntitiesChart from '@/components/TopEntitiesChart';
import BarList from '@/components/BarList';

const TYPE_LABELS = {
  person: 'فرد', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};
const SEVERITY_LABELS = { low: 'منخفضة', medium: 'متوسطة', high: 'عالية', critical: 'حرجة' };
const SEVERITY_COLORS = { low: '#94a3b8', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// حساب إحصاءات الشبكة من بيانات العام (مكونات متصلة، كيانات محورية، روابط متقاطعة، معزول)
function computeNetwork(entities, connections) {
  const idSet = new Set(entities.map((e) => e.id));
  const degree = {};
  const docPairs = {};
  const parent = {};
  const find = (x) => (parent[x] === undefined ? (parent[x] = x) : parent[x] === x ? x : (parent[x] = find(parent[x])));
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  entities.forEach((e) => { parent[e.id] = e.id; });
  connections.forEach((c) => {
    const a = c.source_entity_id, b = c.target_entity_id;
    if (!idSet.has(a) || !idSet.has(b)) return;
    degree[a] = (degree[a] || 0) + 1;
    degree[b] = (degree[b] || 0) + 1;
    union(a, b);
    const key = [a, b].sort().join('|');
    docPairs[key] = docPairs[key] || new Set();
    if (c.document_id) docPairs[key].add(c.document_id);
  });
  const compSize = {};
  entities.forEach((e) => { const r = find(e.id); compSize[r] = (compSize[r] || 0) + 1; });
  const sizes = Object.values(compSize).sort((x, y) => y - x);
  return {
    clusters: sizes.filter((s) => s > 1).length,
    largestCluster: sizes[0] || 0,
    crossDocLinks: Object.values(docPairs).filter((s) => s.size >= 2).length,
    orphans: entities.filter((e) => !degree[e.id]).length,
    bridge: entities
      .map((e) => ({ id: e.id, name: e.name, type: TYPE_LABELS[e.type] || 'أخرى', degree: degree[e.id] || 0 }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8)
  };
}

function SectionCard({ icon: Icon, title, to, children, accent = 'text-primary' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Icon className={`w-4 h-4 ${accent}`} /> {title}
        </h3>
        {to && <Link to={to} className="text-[11px] text-primary hover:underline">عرض الكل</Link>}
      </div>
      {children}
    </div>
  );
}

function StatTile({ icon: Icon, label, value, to, tint, bg }) {
  return (
    <Link to={to} className="group relative rounded-lg border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden">
      <div className="flex items-center justify-between mb-2.5">
        <div className={`w-8 h-8 rounded-md ${bg} ${tint} flex items-center justify-center`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="font-mono text-2xl font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1.5">{label}</div>
    </Link>
  );
}

export default function YearlyStats() {
  const [allDocs, setAllDocs] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
  const [allConns, setAllConns] = useState([]);
  const [allAlerts, setAllAlerts] = useState([]);
  const [allManifests, setAllManifests] = useState([]);
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [docs, ents, conns, alerts, manifests] = await Promise.all([
        localClient.entities.Document.list('-created_date', 500),
        localClient.entities.Entity.list('-mention_count', 500),
        localClient.entities.Connection.list('-created_date', 500),
        localClient.entities.Alert.list('-created_date', 500),
        localClient.entities.Manifest.list('-created_date', 200)
      ]);
      setAllDocs(docs); setAllEntities(ents); setAllConns(conns); setAllAlerts(alerts); setAllManifests(manifests);
    } catch (e) { /* ignore */ } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, []);

  const years = useMemo(() => availableYears(allDocs), [allDocs]);
  const yearDocIds = useMemo(() => yearDocIdSet(allDocs, year), [allDocs, year]);
  const docs = useMemo(() => docsInYear(allDocs, year), [allDocs, year]);
  const conns = useMemo(() => connectionsForDocs(allConns, yearDocIds), [allConns, yearDocIds]);
  const entities = useMemo(() => entitiesForDocs(allEntities, yearDocIds), [allEntities, yearDocIds]);
  const alerts = useMemo(
    () => (year ? allAlerts.filter((a) => a.triggered_at && String(a.triggered_at).slice(0, 4) === year) : allAlerts),
    [allAlerts, year]
  );
  const manifests = useMemo(
    () => (year ? allManifests.filter((m) => m.created_date && String(m.created_date).slice(0, 4) === year) : allManifests),
    [allManifests, year]
  );

  const net = useMemo(() => computeNetwork(entities, conns), [entities, conns]);

  const connCount = useMemo(() => {
    const m = {};
    conns.forEach((c) => { m[c.source_entity_id] = (m[c.source_entity_id] || 0) + 1; m[c.target_entity_id] = (m[c.target_entity_id] || 0) + 1; });
    return m;
  }, [conns]);

  const topEntities = useMemo(() => [...entities]
    .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
    .slice(0, 10)
    .map((e) => ({ id: e.id, name: e.name, mention: e.mention_count || 0, connections: connCount[e.id] || 0 })), [entities, connCount]);

  const typeDist = useMemo(() => Object.entries(
    entities.reduce((acc, e) => { const t = e.type || 'other'; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, values: [{ label: '', value: v, color: '#8b5cf6' }] }))
    .sort((a, b) => b.values[0].value - a.values[0].value).slice(0, 8), [entities]);

  const relDist = useMemo(() => Object.entries(
    conns.reduce((acc, c) => { const t = c.relationship_type || 'غير محدد'; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => ({ name: k, values: [{ label: '', value: v, color: '#10b981' }] }))
    .sort((a, b) => b.values[0].value - a.values[0].value).slice(0, 8), [conns]);

  const alertBySeverity = useMemo(() => Object.entries(
    alerts.reduce((acc, a) => { const s = a.severity || 'medium'; acc[s] = (acc[s] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => ({ name: SEVERITY_LABELS[k] || k, values: [{ label: '', value: v, color: SEVERITY_COLORS[k] || '#94a3b8' }] }))
    .sort((a, b) => b.values[0].value - a.values[0].value), [alerts]);

  const alertByRule = useMemo(() => Object.entries(
    alerts.reduce((acc, a) => { const r = a.rule_name || 'غير مصنف'; acc[r] = (acc[r] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => ({ name: k, values: [{ label: '', value: v, color: '#ef4444' }] }))
    .sort((a, b) => b.values[0].value - a.values[0].value).slice(0, 6), [alerts]);

  const monthlyRef = useMemo(() => {
    const m = new Array(12).fill(0);
    docs.forEach((d) => { if (d.reference_date) { const mo = Number(String(d.reference_date).slice(5, 7)) - 1; if (mo >= 0 && mo < 12) m[mo]++; } });
    return m.map((v, i) => ({ name: MONTHS[i], values: [{ label: '', value: v, color: '#3b82f6' }] }));
  }, [docs]);

  const processingStats = useMemo(() => ({
    processed: docs.filter((d) => d.status === 'processed').length,
    failed: docs.filter((d) => d.status === 'failed').length,
    pending: docs.filter((d) => d.status === 'pending' || d.status === 'processing').length,
    successRate: docs.length ? Math.round((docs.filter((d) => d.status === 'processed').length / docs.length) * 100) : 0
  }), [docs]);

  const highRisk = entities.filter((e) => (e.risk_score || 0) >= 70).length;
  const watchlist = entities.filter((e) => e.watchlist).length;
  const docsNoEntities = docs.filter((d) => !d.entity_count).length;

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ تحميل الإحصاءات التنفيذية...</div>;

  return (
    <div className="min-h-full">
      {/* الرأس */}
      <div className="px-6 pt-5 pb-4 border-b border-border bg-card/40">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Executive Yearly Stats</div>
            <h1 className="font-heading text-2xl font-bold leading-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" /> الإحصاءات التنفيذية السنوية
            </h1>
            <p className="text-sm text-muted-foreground mt-1">مؤشرات ومقاييس قابلة للاستخدام في إعداد التقرير السنوي · مرتبة حسب العام المرجعي</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
              <select value={year} onChange={(e) => setYear(e.target.value)}
                className="appearance-none rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-xs hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer">
                <option value="">كل السنوات</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={() => { setRefreshing(true); load(); }} disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-xs hover:bg-accent transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> تحديث
            </button>
          </div>
        </div>
        {year && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-primary bg-primary/5 border border-primary/20 rounded-full px-2.5 py-0.5">
            <Calendar className="w-3 h-3" /> إحصاءات عام {year}
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* 1. مؤشرات الأداء التنفيذية */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="w-4 h-4 text-primary" />
            <h2 className="font-heading font-semibold text-sm">مؤشرات الأداء التنفيذية</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
            <StatTile icon={FileText} label="المستندات" value={docs.length} to="/documents" tint="text-blue-600" bg="bg-blue-50" />
            <StatTile icon={Users} label="الكيانات المذكورة" value={entities.length} to="/entities" tint="text-violet-600" bg="bg-violet-50" />
            <StatTile icon={Share2} label="الروابط" value={conns.length} to="/graph" tint="text-emerald-600" bg="bg-emerald-50" />
            <StatTile icon={Bell} label="التنبيهات" value={alerts.length} to="/alerts" tint="text-red-600" bg="bg-red-50" />
            <StatTile icon={ShieldAlert} label="البيانات المُفرغة" value={manifests.length} to="/transit" tint="text-amber-600" bg="bg-amber-50" />
            <StatTile icon={AlertTriangle} label="كيانات عالية المخاطر" value={highRisk} to="/entities" tint="text-orange-600" bg="bg-orange-50" />
            <StatTile icon={Flag} label="قائمة المراقبة" value={watchlist} to="/entities" tint="text-rose-600" bg="bg-rose-50" />
          </div>
        </div>

        {/* 2. جودة الاستيعاب */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <SectionCard icon={Activity} title="جودة الاستيعاب والمعالجة">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5">
                  <div className="font-mono text-xl font-bold text-emerald-700">{processingStats.processed}</div>
                  <div className="text-[10px] text-emerald-700/70">معالَج</div>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                  <div className="font-mono text-xl font-bold text-amber-700">{processingStats.pending}</div>
                  <div className="text-[10px] text-amber-700/70">معلّق</div>
                </div>
                <div className="rounded-lg bg-red-50 border border-red-200 p-2.5">
                  <div className="font-mono text-xl font-bold text-red-700">{processingStats.failed}</div>
                  <div className="text-[10px] text-red-700/70">فشل</div>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">نسبة نجاح المعالجة</span>
                  <span className="font-semibold">{processingStats.successRate}%</span>
                </div>
                <div className="h-2 rounded-full bg-accent overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${processingStats.successRate}%` }} />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Boxes} title="بنية الشبكة">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg bg-accent/40 p-3">
                <div className="font-mono text-xl font-bold">{net.clusters}</div>
                <div className="text-[10px] text-muted-foreground">مجموعات مترابطة</div>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <div className="font-mono text-xl font-bold">{net.largestCluster}</div>
                <div className="text-[10px] text-muted-foreground">أكبر مجموعة</div>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <div className="font-mono text-xl font-bold">{net.crossDocLinks}</div>
                <div className="text-[10px] text-muted-foreground">روابط متقاطعة المستندات</div>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <div className="font-mono text-xl font-bold">{net.orphans}</div>
                <div className="text-[10px] text-muted-foreground">كيانات معزولة</div>
              </div>
            </div>
          </SectionCard>

          <SectionCard icon={Unlink} title="جودة البيانات والتغطية">
            <div className="space-y-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">مستندات بلا كيانات مستخرجة</span>
                <span className="font-mono font-semibold">{docsNoEntities}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">كيانات بلا روابط</span>
                <span className="font-mono font-semibold">{net.orphans}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">معدل فشل المعالجة</span>
                <span className="font-mono font-semibold">{docs.length ? Math.round((processingStats.failed / docs.length) * 100) : 0}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">متوسط الكيانات لكل مستند</span>
                <span className="font-mono font-semibold">{docs.length ? (entities.length / docs.length).toFixed(1) : '0'}</span>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* 3. ذكاء الكيانات */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard icon={TrendingUp} title="أعلى الكيانات ذكراً وارتباطاً" to="/entities">
            {topEntities.length ? <TopEntitiesChart items={topEntities} /> : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>}
          </SectionCard>
          <SectionCard icon={Users} title="توزيع الكيانات حسب النوع" to="/entities">
            {typeDist.length ? <BarList items={typeDist} /> : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>}
          </SectionCard>
        </div>

        {/* 4. تحليل الشبكة */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard icon={GitBranch} title="الكيانات المحورية (أكثر ارتباطاً)" to="/graph" accent="text-amber-500">
            {net.bridge.length ? (
              <div className="divide-y divide-border/40">
                {net.bridge.map((b, i) => (
                  <Link key={b.id} to={`/entities/${b.id}`} className="flex items-center gap-3 py-2 hover:bg-accent/40 -mx-2 px-2 rounded-lg transition-colors group">
                    <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{b.name}</div>
                      <div className="text-[11px] text-muted-foreground">{b.type}</div>
                    </div>
                    <div className="text-left shrink-0">
                      <div className="text-sm font-semibold">{b.degree}</div>
                      <div className="text-[10px] text-muted-foreground">رابط</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد روابط</p>}
          </SectionCard>
          <SectionCard icon={Link2} title="توزيع الروابط حسب النوع" to="/graph">
            {relDist.length ? <BarList items={relDist} /> : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد روابط</p>}
          </SectionCard>
        </div>

        {/* 5. المخاطر والتنبيهات */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard icon={AlertTriangle} title="التنبيهات حسب الخطورة" to="/alerts" accent="text-red-500">
            {alertBySeverity.length ? <BarList items={alertBySeverity} /> : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد تنبيهات</p>}
          </SectionCard>
          <SectionCard icon={ShieldAlert} title="أكثر القواعد المُفعّلة" to="/alerts" accent="text-red-500">
            {alertByRule.length ? <BarList items={alertByRule} /> : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد قواعد مُفعّلة</p>}
          </SectionCard>
        </div>

        {/* 6. الاتجاهات الزمنية */}
        <SectionCard icon={Calendar} title="توزيع المستندات حسب شهر المرجع">
          {monthlyRef.some((m) => m.values[0].value > 0) ? <BarList items={monthlyRef} /> : <p className="text-sm text-muted-foreground py-8 text-center">لا توجد تواريخ مرجعية</p>}
        </SectionCard>
      </div>
    </div>
  );
}