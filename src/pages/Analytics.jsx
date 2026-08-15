import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, CartesianGrid
} from 'recharts';
import { Users, Share2, FileText, TrendingUp } from 'lucide-react';
import { base44 } from '@/api/base44Client';

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

  // توزيع الكيانات حسب النوع
  const typeDistribution = Object.entries(
    entities.reduce((acc, e) => {
      const t = e.type || 'other';
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {})
  ).map(([k, v]) => ({ name: TYPE_LABELS[k] || k, value: v, key: k }))
    .sort((a, b) => b.value - a.value);

  // أعلى الكيانات ذكراً
  const topEntities = [...entities]
    .sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0))
    .slice(0, 10)
    .map((e) => ({
      name: e.name.length > 14 ? e.name.slice(0, 13) + '…' : e.name,
      ذكر: e.mention_count || 0,
      روابط: 0
    }));

  // حساب الروابط لكل كيان
  const connCountByEntity = {};
  connections.forEach((c) => {
    connCountByEntity[c.source_entity_id] = (connCountByEntity[c.source_entity_id] || 0) + 1;
    connCountByEntity[c.target_entity_id] = (connCountByEntity[c.target_entity_id] || 0) + 1;
  });
  topEntities.forEach((row) => {
    const ent = entities.find((e) => (e.name || '').startsWith(row.name.replace(/…$/, '')));
    if (ent) row.روابط = connCountByEntity[ent.id] || 0;
  });

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
    { label: 'إجمالي المستندات', value: documents.length, icon: FileText, color: 'bg-blue-500' },
    { label: 'متوسط الذكر لكل كيان', value: entities.length ? Math.round(connections.length / entities.length * 10) / 10 : 0, icon: TrendingUp, color: 'bg-amber-500' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">التحليلات</h1>
        <p className="text-sm text-muted-foreground mt-1">إحصاءات ورسوم بيانية عن الكيانات والروابط والمستندات</p>
      </div>

      {/* بطاقات ملخصة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((c) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* توزيع الكيانات حسب النوع */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-4">توزيع الكيانات حسب النوع</h3>
          {typeDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {typeDistribution.map((entry) => (
                    <Cell key={entry.key} fill={TYPE_COLORS[entry.key] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* أعلى الكيانات ذكراً */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-4">أعلى الكيانات ذكراً وارتباطاً</h3>
          {topEntities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topEntities} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Legend />
                <Bar dataKey="ذكر" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                <Bar dataKey="روابط" fill="#10b981" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* توزيع الروابط حسب النوع */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-4">توزيع الروابط حسب النوع</h3>
          {relDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={relDistribution} margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" name="عدد الروابط" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* المستندات حسب النوع */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-4">المستندات حسب النوع</h3>
          {docDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={docDistribution}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {docDistribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* جدول أكثر الكيانات ذكراً */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading font-semibold mb-3">أكثر الكيانات تكراراً</h3>
        <div className="space-y-1">
          {[...entities].sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0)).slice(0, 15).map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/40">
              <span className="w-6 h-6 rounded-full bg-accent text-xs flex items-center justify-center font-medium shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{e.name}</div>
                {e.aliases?.length > 0 && (
                  <div className="text-xs text-muted-foreground truncate">{e.aliases.join('، ')}</div>
                )}
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent">{TYPE_LABELS[e.type] || 'أخرى'}</span>
              <span className="text-xs text-muted-foreground w-16 text-left">{e.mention_count || 0} ذكر</span>
              <span className="text-xs text-muted-foreground w-16 text-left">{connCountByEntity[e.id] || 0} رابط</span>
            </div>
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
  intelligence_report: 'تقرير استخباراتي',
  other: 'أخرى'
};