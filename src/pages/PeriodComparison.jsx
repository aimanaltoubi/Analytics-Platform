import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { GitCompare, FileText, Users, Share2, Bell, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { availableYears, docsInYear, yearDocIdSet, connectionsForDocs, entitiesForDocs } from '@/lib/yearFilter';

const TYPE_LABELS = {
  person: 'فرد', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

function kpisFor(year, allDocs, allEnts, allConns, allAlerts) {
  const docIds = yearDocIdSet(allDocs, year);
  const docs = docsInYear(allDocs, year);
  const conns = connectionsForDocs(allConns, docIds);
  const ents = entitiesForDocs(allEnts, docIds);
  const alerts = allAlerts.filter((a) => a.triggered_at && String(a.triggered_at).slice(0, 4) === year);
  return { docs: docs.length, entities: ents.length, connections: conns.length, alerts: alerts.length, ents, conns };
}

function Delta({ a, b }) {
  const d = a - b;
  if (d === 0) return <span className="inline-flex items-center gap-0.5 text-muted-foreground text-xs"><Minus className="w-3 h-3" /> 0</span>;
  const up = d > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? 'text-emerald-600' : 'text-red-600'}`}>
      {up ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />} {Math.abs(d)}
    </span>
  );
}

export default function PeriodComparison() {
  const [allDocs, setAllDocs] = useState([]);
  const [allEnts, setAllEnts] = useState([]);
  const [allConns, setAllConns] = useState([]);
  const [allAlerts, setAllAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [docs, ents, conns, alerts] = await Promise.all([
          base44.entities.Document.list('-created_date', 500),
          base44.entities.Entity.list('-mention_count', 500),
          base44.entities.Connection.list('-created_date', 500),
          base44.entities.Alert.list('-created_date', 500)
        ]);
        setAllDocs(docs); setAllEnts(ents); setAllConns(conns); setAllAlerts(alerts);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const years = useMemo(() => availableYears(allDocs), [allDocs]);
  const [yearA, setYearA] = useState('');
  const [yearB, setYearB] = useState('');

  useEffect(() => {
    if (years.length > 0) {
      setYearA(years[0]);
      if (years.length > 1) setYearB(years[1]);
    }
  }, [years]);

  const a = useMemo(() => (yearA ? kpisFor(yearA, allDocs, allEnts, allConns, allAlerts) : null), [yearA, allDocs, allEnts, allConns, allAlerts]);
  const b = useMemo(() => (yearB ? kpisFor(yearB, allDocs, allEnts, allConns, allAlerts) : null), [yearB, allDocs, allEnts, allConns, allAlerts]);

  const sel = 'rounded-md border border-border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer';

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;

  const rows = a && b ? [
    { label: 'المستندات', icon: FileText, a: a.docs, b: b.docs, to: '/documents' },
    { label: 'الكيانات', icon: Users, a: a.entities, b: b.entities, to: '/entities' },
    { label: 'الروابط', icon: Share2, a: a.connections, b: b.connections, to: '/graph' },
    { label: 'التنبيهات', icon: Bell, a: a.alerts, b: b.alerts, to: '/alerts' }
  ] : [];

  const topA = a ? [...a.ents].sort((x, y) => (y.mention_count || 0) - (x.mention_count || 0)).slice(0, 8) : [];
  const topB = b ? [...b.ents].sort((x, y) => (y.mention_count || 0) - (x.mention_count || 0)).slice(0, 8) : [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-primary" /> مقارنة الفترات
        </h1>
        <p className="text-sm text-muted-foreground mt-1">مقارنة مؤشرات عامين لقياس التطور في الاستيعاب والشبكة والتنبيهات.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">الفترة أ:</span>
          <select value={yearA} onChange={(e) => setYearA(e.target.value)} className={sel}>
            <option value="">—</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <span className="text-muted-foreground">↔</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">الفترة ب:</span>
          <select value={yearB} onChange={(e) => setYearB(e.target.value)} className={sel}>
            <option value="">—</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {a && b ? (
        <>
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] text-muted-foreground border-b border-border bg-muted/20">
                  <th className="text-right font-medium px-4 py-2.5">المؤشر</th>
                  <th className="text-center font-medium px-4 py-2.5">عام {yearA}</th>
                  <th className="text-center font-medium px-4 py-2.5">عام {yearB}</th>
                  <th className="text-center font-medium px-4 py-2.5">الفرق</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const Icon = r.icon;
                  return (
                    <tr key={r.label} className="border-b border-border/50 last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-2.5">
                        <Link to={r.to} className="inline-flex items-center gap-2 hover:text-primary">
                          <Icon className="w-4 h-4 text-muted-foreground" /> {r.label}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums">{r.a}</td>
                      <td className="px-4 py-2.5 text-center font-mono tabular-nums">{r.b}</td>
                      <td className="px-4 py-2.5 text-center"><Delta a={r.a} b={r.b} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3">أبرز الكيانات — عام {yearA}</h3>
              <div className="space-y-1.5">
                {topA.map((e, i) => (
                  <Link key={e.id} to={`/entities/${e.id}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50">
                    <span className="text-[11px] text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium truncate flex-1">{e.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent shrink-0">{TYPE_LABELS[e.type] || 'أخرى'}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{e.mention_count || 0} ذكر</span>
                  </Link>
                ))}
                {topA.length === 0 && <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>}
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3">أبرز الكيانات — عام {yearB}</h3>
              <div className="space-y-1.5">
                {topB.map((e, i) => (
                  <Link key={e.id} to={`/entities/${e.id}`} className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50">
                    <span className="text-[11px] text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium truncate flex-1">{e.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent shrink-0">{TYPE_LABELS[e.type] || 'أخرى'}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{e.mention_count || 0} ذكر</span>
                  </Link>
                ))}
                {topB.length === 0 && <p className="text-sm text-muted-foreground">لا توجد بيانات.</p>}
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">اختر عامين للمقارنة.</p>
      )}
    </div>
  );
}