import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Users, Share2, FileText } from 'lucide-react';
import { Image } from '@/components/ui/image';
import { localClient } from '@/api/localClient';
import { docsInYear, yearDocIdSet, connectionsForDocs, entitiesForDocs } from '@/lib/yearFilter';
import TimelineAnalysis from '@/components/TimelineAnalysis';
import FusionInsights from '@/components/FusionInsights';
import BarList from '@/components/BarList';
import TopEntitiesChart from '@/components/TopEntitiesChart';
import NationalityOverview from '@/components/NationalityOverview';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

const TYPE_COLORS = {
  person: '#3b82f6', organization: '#8b5cf6', company: '#10b981', phone: '#f59e0b', email: '#10b981',
  location: '#ef4444', account: '#06b6d4', date: '#64748b', event: '#ec4899', other: '#94a3b8'
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#64748b', '#ec4899', '#94a3b8'];

const TYPE_LABELS_DOC = {
  phone_log: 'سجل مكالمات', financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة', intelligence_report: 'تقرير تحليلي', other: 'أخرى'
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg text-xs max-w-[220px]">
      {label && <div className="font-medium mb-1 truncate">{label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function DashboardAnalytics({ year }) {
  const [allEntities, setAllEntities] = useState([]);
  const [allConnections, setAllConnections] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    try {
      const [ents, conns, docs] = await Promise.all([
        localClient.entities.Entity.list('-mention_count', 500),
        localClient.entities.Connection.list('-created_date', 500),
        localClient.entities.Document.list('-created_date', 500)
      ]);
      setAllEntities(ents);
      setAllConnections(conns);
      setAllDocuments(docs);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const yearDocIds = useMemo(() => yearDocIdSet(allDocuments, year), [allDocuments, year]);
  const documents = useMemo(() => docsInYear(allDocuments, year), [allDocuments, year]);
  const connections = useMemo(() => connectionsForDocs(allConnections, yearDocIds), [allConnections, yearDocIds]);
  const entities = useMemo(() => entitiesForDocs(allEntities, yearDocIds), [allEntities, yearDocIds]);

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">جارٍ تحميل التحليلات...</div>;

  const connCountByEntity = {};
  connections.forEach((c) => {
    connCountByEntity[c.source_entity_id] = (connCountByEntity[c.source_entity_id] || 0) + 1;
    connCountByEntity[c.target_entity_id] = (connCountByEntity[c.target_entity_id] || 0) + 1;
  });

  const typeDistribution = Object.entries(
    entities.reduce((acc, e) => { const t = e.type || 'other'; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, value: v, key: k })).sort((a, b) => b.value - a.value);

  const topEntities = [...entities]
    .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
    .slice(0, 10)
    .map((e) => ({ id: e.id, name: e.name, ذكر: e.mention_count || 0, روابط: connCountByEntity[e.id] || 0 }));

  const relDistribution = Object.entries(
    connections.reduce((acc, c) => { const t = c.relationship_type || 'غير محدد'; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);

  const docDistribution = Object.entries(
    documents.reduce((acc, d) => { const t = d.document_type || 'other'; acc[t] = (acc[t] || 0) + 1; return acc; }, {})
  ).map(([k, v]) => ({ name: TYPE_LABELS_DOC[k] || k, value: v }));

  const summaryCards = [
    { label: 'إجمالي الكيانات', value: entities.length, icon: Users, color: 'bg-violet-500', to: '/entities' },
    { label: 'إجمالي الروابط', value: connections.length, icon: Share2, color: 'bg-emerald-500', to: '/graph' },
    { label: 'إجمالي المستندات', value: documents.length, icon: FileText, color: 'bg-blue-500', to: '/documents' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pt-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">التحليلات</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to} className="block rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg ${c.color} text-white flex items-center justify-center shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold font-heading">{c.value}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{c.label}</div>
            </Link>
          );
        })}
      </div>

      <FusionInsights />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">توزيع الكيانات حسب النوع</h3>
          {typeDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={56} outerRadius={92} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {typeDistribution.map((entry) => (
                    <Cell key={entry.key} fill={TYPE_COLORS[entry.key] || '#94a3b8'} className="cursor-pointer" />
                  ))}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 24, fontWeight: 700 }}>{entities.length}</text>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" dy={18} className="fill-muted-foreground" style={{ fontSize: 11 }}>إجمالي</text>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, lineHeight: '20px', paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">أعلى الكيانات ذكراً وارتباطاً</h3>
          {topEntities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <TopEntitiesChart
              items={topEntities.map((e) => ({ id: e.id, name: e.name, mention: e.ذكر, connections: e.روابط }))}
            />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">توزيع الروابط حسب النوع</h3>
          {relDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <BarList
              max={Math.max(...relDistribution.map((r) => r.value), 1)}
              items={relDistribution.map((r) => ({ name: r.name, values: [{ label: '', value: r.value, color: '#8b5cf6' }] }))}
            />
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">المستندات حسب النوع</h3>
          {docDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={docDistribution} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={56} outerRadius={92} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {docDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} className="cursor-pointer" />
                  ))}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 24, fontWeight: 700 }}>{documents.length}</text>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" dy={18} className="fill-muted-foreground" style={{ fontSize: 11 }}>إجمالي</text>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, lineHeight: '20px', paddingTop: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <NationalityOverview entities={entities} />

      <TimelineAnalysis entities={entities} connections={connections} documents={documents} />

      <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
        <h3 className="font-heading font-semibold mb-3">أكثر الكيانات تكراراً</h3>
        <div className="space-y-1">
          {[...entities].sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0)).slice(0, 15).map((e, i) => (
            <Link key={e.id} to={`/entities/${e.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/60 transition-colors">
              <span className="w-6 h-6 rounded-full bg-accent text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
              {e.photo_url ? (
                <Image src={e.photo_url} alt={e.name} className="w-8 h-8 rounded-full shrink-0 border border-border" fittingType="fill" />
              ) : (
                <span className="w-8 h-8 rounded-full bg-accent text-muted-foreground text-xs font-bold flex items-center justify-center shrink-0 border border-border">{e.name?.charAt(0) || '؟'}</span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.name}</div>
                {e.aliases?.length > 0 && (
                  <div className="text-xs text-muted-foreground truncate">{e.aliases.join('، ')}</div>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent shrink-0">{TYPE_LABELS[e.type] || 'أخرى'}</span>
              <span className="text-xs text-muted-foreground w-16 text-left shrink-0">{e.mention_count || 0} ذكر</span>
              <span className="text-xs text-muted-foreground w-16 text-left shrink-0">{connCountByEntity[e.id] || 0} رابط</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}