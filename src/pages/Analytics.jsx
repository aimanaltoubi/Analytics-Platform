import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid
} from 'recharts';
import { Users, Share2, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Image } from '@/components/ui/image';
import { base44 } from '@/api/base44Client';
import TimelineAnalysis from '@/components/TimelineAnalysis';
import FusionInsights from '@/components/FusionInsights';

const TYPE_LABELS = {
  person: 'شخص',
  organization: 'منظمة',
  phone: 'هاتف',
  email: 'بريد',
  location: 'موقع',
  account: 'حساب',
  date: 'تاريخ',
  event: 'حدث',
  other: 'أخرى'
};

const TYPE_COLORS = {
  person: '#3b82f6',
  organization: '#8b5cf6',
  phone: '#f59e0b',
  email: '#10b981',
  location: '#ef4444',
  account: '#06b6d4',
  date: '#64748b',
  event: '#ec4899',
  other: '#94a3b8'
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#64748b', '#ec4899', '#94a3b8'];

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

export default function Analytics() {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [ents, conns, docs] = await Promise.all([
          base44.entities.Entity.list('-mention_count', 500),
          base44.entities.Connection.list('-created_date', 500),
          base44.entities.Document.list('-created_date', 500)
        ]);
        setEntities(ents);
        setConnections(conns);
        setDocuments(docs);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;

  // عدد الروابط لكل كيان
  const connCountByEntity = {};
  connections.forEach((c) => {
    connCountByEntity[c.source_entity_id] = (connCountByEntity[c.source_entity_id] || 0) + 1;
    connCountByEntity[c.target_entity_id] = (connCountByEntity[c.target_entity_id] || 0) + 1;
  });

  // توزيع الكيانات حسب النوع
  const typeDistribution = Object.entries(
    entities.reduce((acc, e) => {
      const t = e.type || 'other';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, value: v, key: k }))
    .sort((a, b) => b.value - a.value);

  // أعلى الكيانات ذكراً وارتباطاً
  const topEntities = [...entities]
    .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
    .slice(0, 10)
    .map((e) => ({
      id: e.id,
      name: e.name,
      ذكر: e.mention_count || 0,
      روابط: connCountByEntity[e.id] || 0
    }));

  // توزيع الروابط حسب النوع
  const relDistribution = Object.entries(
    connections.reduce((acc, c) => {
      const t = c.relationship_type || 'غير محدد';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({ name: k, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // المستندات حسب النوع
  const docDistribution = Object.entries(
    documents.reduce((acc, d) => {
      const t = d.document_type || 'other';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({ name: TYPE_LABELS_DOC[k] || k, value: v }));

  // الكيانات ذات أعلى خطورة
  const topRisk = [...entities]
    .filter((e) => (e.risk_score || 0) > 0)
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 5);

  const summaryCards = [
    { label: 'إجمالي الكيانات', value: entities.length, icon: Users, color: 'bg-violet-500' },
    { label: 'إجمالي الروابط', value: connections.length, icon: Share2, color: 'bg-emerald-500' },
    { label: 'إجمالي المستندات', value: documents.length, icon: FileText, color: 'bg-blue-500' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">التحليلات</h1>
        <p className="text-sm text-muted-foreground mt-1">إحصاءات ورسوم بيانية عن الكيانات والروابط والمستندات</p>
      </div>

      {/* بطاقات ملخصة */}
      <div className="grid grid-cols-3 gap-4">
        {summaryCards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-lg ${c.color} text-white flex items-center justify-center shadow-sm`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-2xl font-bold font-heading">{c.value}</span>
              </div>
              <div className="text-sm text-muted-foreground mt-2">{c.label}</div>
            </div>
          );
        })}
      </div>

      <FusionInsights />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* توزيع الكيانات حسب النوع */}
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

        {/* أعلى الكيانات ذكراً */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">أعلى الكيانات ذكراً وارتباطاً</h3>
          {topEntities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(340, topEntities.length * 42)}>
              <BarChart data={topEntities} layout="vertical" margin={{ left: 24, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} interval={0} tickLine={false} axisLine={false} tickFormatter={(v) => (v && v.length > 12 ? v.slice(0, 11) + '…' : v)} stroke="#94a3b8" />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="ذكر" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={11} />
                <Bar dataKey="روابط" fill="#10b981" radius={[0, 4, 4, 0]} barSize={11} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* توزيع الروابط حسب النوع */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">توزيع الروابط حسب النوع</h3>
          {relDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(320, relDistribution.length * 40)}>
              <BarChart data={relDistribution} layout="vertical" margin={{ left: 24, right: 24, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={150} interval={0} tickLine={false} axisLine={false} tickFormatter={(v) => (v && v.length > 18 ? v.slice(0, 17) + '…' : v)} stroke="#94a3b8" />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                <Bar dataKey="value" name="عدد الروابط" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* المستندات حسب النوع */}
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

      <TimelineAnalysis entities={entities} connections={connections} documents={documents} />

      {/* جدول أكثر الكيانات ذكراً */}
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

const TYPE_LABELS_DOC = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير تحليلي',
  other: 'أخرى'
};