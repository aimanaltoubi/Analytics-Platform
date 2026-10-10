import { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Plane, Ship, Users, AlertTriangle, ShieldCheck, Ban } from 'lucide-react';
import { localClient } from '@/api/localClient';
import BarList from '@/components/BarList';

const STATUS_LABELS = {
  submitted: 'قُدّم',
  screening: 'قيد الفحص',
  cleared: 'مخلو',
  flagged: 'مُعلّم',
  intercepted: 'اعتراض'
};
const STATUS_COLORS = {
  submitted: '#3b82f6',
  screening: '#f59e0b',
  cleared: '#10b981',
  flagged: '#ef4444',
  intercepted: '#7f1d1d'
};
const PIE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#7f1d1d', '#8b5cf6', '#06b6d4', '#ec4899'];

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

const count = (arr, key) => arr.reduce((acc, x) => { const v = x[key]; if (v) acc[v] = (acc[v] || 0) + 1; return acc; }, {});

export default function TransitAnalytics() {
  const [manifests, setManifests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setManifests(await localClient.entities.Manifest.list('-created_date', 500)); }
      catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground text-center">جارٍ التحميل...</div>;
  if (manifests.length === 0) return <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground text-center">لا توجد بيانات مقدّمة بعد.</div>;

  // تجميع الركاب والشحنات من كل البيانات
  const allPassengers = manifests.flatMap((m) => (m.passengers || []).map((p) => ({ ...p, manifest_id: m.id, status: m.status })));
  const allCargo = manifests.flatMap((m) => (m.cargo || []).map((c) => ({ ...c, manifest_id: m.id, status: m.status })));

  const totalScreened = manifests.reduce((s, m) => s + ((m.screening_summary?.passengers_screened) ?? (m.passengers || []).length), 0);
  const totalFlagged = manifests.reduce((s, m) => s + (m.screening_summary?.passengers_flagged || 0), 0);
  const totalCargoFlagged = manifests.reduce((s, m) => s + (m.screening_summary?.cargo_flagged || 0), 0);
  const intercepted = manifests.filter((m) => m.status === 'intercepted').length;
  const cleared = manifests.filter((m) => m.status === 'cleared').length;

  const summary = [
    { label: 'إجمالي البيانات', value: manifests.length, icon: ShieldCheck, color: 'bg-blue-500' },
    { label: 'ركاب فُحصوا', value: totalScreened, icon: Users, color: 'bg-violet-500' },
    { label: 'راكب مُعلّم', value: totalFlagged, icon: AlertTriangle, color: 'bg-red-500' },
    { label: 'اعتراضات', value: intercepted, icon: Ban, color: 'bg-rose-700' }
  ];

  // توزيع الحالات
  const statusDist = Object.entries(count(manifests, 'status'))
    .map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v, key: k }))
    .sort((a, b) => b.value - a.value);

  // توزيع وسيلة النقل
  const modeDist = Object.entries(count(manifests, 'mode')).map(([k, v]) => ({
    name: k === 'air' ? 'جوي' : 'بحري', value: v
  }));

  // أعلى الناقلين
  const carrierDist = Object.entries(count(manifests, 'carrier'))
    .map(([k, v]) => ({ name: k, value: v })).sort((a, b) => b.value - a.value).slice(0, 8);

  // أعmost المسارات
  const routeDist = {};
  manifests.forEach((m) => {
    if (!m.departure_location || !m.destination_location) return;
    const r = `${m.departure_location} ← ${m.destination_location}`;
    routeDist[r] = (routeDist[r] || 0) + 1;
  });
  const topRoutes = Object.entries(routeDist).map(([k, v]) => ({ name: k, value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  // الجنسيات
  const natDist = count(allPassengers.filter((p) => p.nationality), 'nationality');
  const topNat = Object.entries(natDist).map(([k, v]) => ({ name: k, value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 8);

  // أسباب التعلّيم
  const reasonDist = {};
  manifests.forEach((m) => {
    const flags = (m.screening_summary?.flags || []).concat(m.screening_summary?.cargo_flags || []);
    flags.forEach((f) => {
      (f.reasons || [f.reason]).filter(Boolean).forEach((r) => {
        const key = r.split(':')[0].trim();
        reasonDist[key] = (reasonDist[key] || 0) + 1;
      });
    });
  });
  const reasonItems = Object.entries(reasonDist).map(([k, v]) => ({
    name: k, values: [{ label: '', value: v, color: '#ef4444' }]
  })).sort((a, b) => b.values[0].value - a.values[0].value).slice(0, 8);

  // شحنات خطرة
  const hazardousCargo = allCargo.filter((c) => c.hazardous).length;

  // الاتجاه الزمني (آخر 14 يوم)
  const byDay = {};
  manifests.forEach((m) => {
    if (!m.created_date) return;
    const d = new Date(m.created_date);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = byDay[key] || { manifests: 0, flagged: 0 };
    byDay[key].manifests += 1;
    if (m.status === 'flagged' || m.status === 'intercepted') byDay[key].flagged += 1;
  });
  const trend = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([d, v]) => ({
    name: d.slice(5), 'البيانات': v.manifests, 'مُعلّمة': v.flagged
  }));

  return (
    <div className="space-y-6">
      {/* بطاقات ملخصة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary.map((c) => {
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* توزيع الحالات */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">توزيع حالات البيانات</h3>
          {statusDist.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={52} outerRadius={86} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {statusDist.map((e) => <Cell key={e.key} fill={STATUS_COLORS[e.key] || '#94a3b8'} />)}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 700 }}>{manifests.length}</text>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" dy={16} className="fill-muted-foreground" style={{ fontSize: 10 }}>إجمالي</text>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12, lineHeight: '18px', paddingTop: 6 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* جوي vs بحري + شحنات خطرة */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">وسيلة النقل</h3>
          <div className="space-y-3 mb-4">
            {modeDist.map((m, i) => {
              const Icon = i === 0 ? Plane : Ship;
              const pct = Math.round((m.value / manifests.length) * 100);
              return (
                <div key={m.name} className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${m.name === 'جوي' ? 'bg-blue-50 text-blue-600' : 'bg-cyan-50 text-cyan-600'}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm"><span>{m.name}</span><span className="font-semibold">{m.value} ({pct}%)</span></div>
                    <div className="h-2 rounded-full bg-accent overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.name === 'جوي' ? '#3b82f6' : '#06b6d4' }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="rounded-lg bg-accent/40 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">شحنات خطرة</span>
              <span className="font-bold text-orange-600">{hazardousCargo}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">شحنات مُعلّمة</span>
              <span className="font-bold text-red-600">{totalCargoFlagged}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-muted-foreground">بيانات مخلوة</span>
              <span className="font-bold text-emerald-600">{cleared}</span>
            </div>
          </div>
        </div>

        {/* أسباب التعلّيم */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">أسباب التعلّيم</h3>
          {reasonItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد علامات</p>
          ) : (
            <BarList max={Math.max(...reasonItems.map((r) => r.values[0].value), 1)} items={reasonItems} />
          )}
        </div>

        {/* أعلى الناقلين */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">أعلى الناقلين</h3>
          {carrierDist.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <BarList max={Math.max(...carrierDist.map((c) => c.value), 1)}
              items={carrierDist.map((c) => ({ name: c.name, values: [{ label: '', value: c.value, color: '#3b82f6' }] }))} />
          )}
        </div>

        {/* أعmost المسارات */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">أكثر المسارات</h3>
          {topRoutes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <BarList max={Math.max(...topRoutes.map((r) => r.value), 1)}
              items={topRoutes.map((r) => ({ name: r.name, values: [{ label: '', value: r.value, color: '#8b5cf6' }] }))} />
          )}
        </div>

        {/* الجنسيات */}
        <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
          <h3 className="font-heading font-semibold mb-4">جنسيات الركاب</h3>
          {topNat.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={topNat} dataKey="value" nameKey="name" cx="50%" cy="46%" innerRadius={52} outerRadius={86} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {topNat.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                </Pie>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: 22, fontWeight: 700 }}>{allPassengers.length}</text>
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" dy={16} className="fill-muted-foreground" style={{ fontSize: 10 }}>ركاب</text>
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11, lineHeight: '16px', paddingTop: 6 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* الاتجاه الزمني */}
      <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
        <h3 className="font-heading font-semibold mb-4">اتجاه البيانات (آخر 14 يوم)</h3>
        {trend.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">لا توجد بيانات</p>
        ) : (
          <BarList
            max={Math.max(...trend.flatMap((t) => [t['البيانات'], t['مُعلّمة']]), 1)}
            items={trend.map((t) => ({
              name: t.name,
              values: [
                { label: 'بيانات', value: t['البيانات'], color: '#3b82f6' },
                { label: 'مُعلّمة', value: t['مُعلّمة'], color: '#ef4444' }
              ]
            }))}
          />
        )}
      </div>
    </div>
  );
}