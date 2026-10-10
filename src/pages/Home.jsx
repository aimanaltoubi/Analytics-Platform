import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Users, Share2, AlertTriangle, RefreshCw, Bell, TrendingUp, Flag, ChevronLeft, Calendar } from 'lucide-react';
import { localClient } from '@/api/localClient';
import DashboardAnalytics from '@/components/DashboardAnalytics';
import DemographicsOverview from '@/components/DemographicsOverview';
import { availableYears, docsInYear, yearDocIdSet, connectionsForDocs, entitiesForDocs } from '@/lib/yearFilter';

const TYPE_LABELS = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير تحليلي',
  other: 'أخرى'
};

const STATUS_LABELS = {
  pending: 'بانتظار',
  processing: 'قيد المعالجة',
  processed: 'تمت المعالجة',
  failed: 'فشل'
};

const STATUS_STYLE = {
  processed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  processing: 'bg-blue-50 text-blue-700 border-blue-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-red-50 text-red-700 border-red-200'
};

const ENTITY_TYPE_LABELS = {
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

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `قبل ${m} د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} س`;
  const d = Math.floor(h / 24);
  return `قبل ${d} ي`;
}

export default function Home() {
  const [allDocs, setAllDocs] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
  const [allConns, setAllConns] = useState([]);
  const [allAlerts, setAllAlerts] = useState([]);
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [docs, ents, conns, alerts] = await Promise.all([
        localClient.entities.Document.list('-created_date', 500),
        localClient.entities.Entity.list('-mention_count', 500),
        localClient.entities.Connection.list('-created_date', 500),
        localClient.entities.Alert.filter({ status: 'new' }, '-created_date', 50)
      ]);
      setAllDocs(docs);
      setAllEntities(ents);
      setAllConns(conns);
      setAllAlerts(alerts);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const years = useMemo(() => availableYears(allDocs), [allDocs]);

  const yearDocIds = useMemo(() => yearDocIdSet(allDocs, year), [allDocs, year]);
  const yearDocs = useMemo(() => docsInYear(allDocs, year), [allDocs, year]);
  const yearConns = useMemo(() => connectionsForDocs(allConns, yearDocIds), [allConns, yearDocIds]);
  const yearEntities = useMemo(() => entitiesForDocs(allEntities, yearDocIds), [allEntities, yearDocIds]);
  const yearAlerts = useMemo(
    () => (year ? allAlerts.filter((a) => a.triggered_at && String(a.triggered_at).slice(0, 4) === year) : allAlerts),
    [allAlerts, year]
  );

  const stats = useMemo(() => ({
    documents: yearDocs.length,
    entities: yearEntities.length,
    connections: yearConns.length,
    processing: yearDocs.filter((d) => d.status === 'processing' || d.status === 'pending').length,
    newAlerts: yearAlerts.length
  }), [yearDocs, yearEntities, yearConns, yearAlerts]);

  const recent = yearDocs.slice(0, 7);
  const topEntities = [...yearEntities].sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0)).slice(0, 8);

  const kpis = [
    { label: 'المستندات', value: stats.documents, icon: FileText, to: '/documents', tint: 'text-blue-600', bg: 'bg-blue-50', bar: 'bg-blue-500' },
    { label: 'الكيانات', value: stats.entities, icon: Users, to: '/entities', tint: 'text-violet-600', bg: 'bg-violet-50', bar: 'bg-violet-500' },
    { label: 'الروابط', value: stats.connections, icon: Share2, to: '/graph', tint: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
    { label: 'قيد المعالجة', value: stats.processing, icon: AlertTriangle, to: '/documents', tint: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500' },
    { label: 'تنبيهات جديدة', value: stats.newAlerts, icon: Bell, to: '/alerts', tint: 'text-red-600', bg: 'bg-red-50', bar: 'bg-red-500' }
  ];

  return (
    <div className="min-h-full">
      {/* رأسية العمليات */}
      <div className="px-6 pt-5 pb-4 border-b border-border bg-card/40">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Strategic Analytics</div>
            <h1 className="font-heading text-2xl font-bold leading-tight">التحليلات الاستراتيجية</h1>
            <p className="text-sm text-muted-foreground mt-1">استيعاب المستندات · استخراج الكيانات · كشف الروابط الخفية · التنبيهات اللحظية</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 pointer-events-none" />
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="appearance-none rounded-md border border-border bg-background pl-3 pr-8 py-1.5 text-xs hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
              >
                <option value="">كل السنوات</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background text-xs hover:bg-accent transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              تحديث
            </button>
          </div>
        </div>
        {year && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-primary bg-primary/5 border border-primary/20 rounded-full px-2.5 py-0.5">
            <Calendar className="w-3 h-3" />
            عرض بيانات عام {year}
          </div>
        )}
      </div>

      <div className="p-6 space-y-5">
        {/* مؤشرات الأداء */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Link key={k.label} to={k.to} className="group relative rounded-lg border border-border bg-card p-3.5 hover:border-primary/40 hover:shadow-sm transition-all overflow-hidden">
                <span className={`absolute top-0 right-0 left-0 h-0.5 ${k.bar} opacity-70 group-hover:opacity-100 transition-opacity`} />
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`w-8 h-8 rounded-md ${k.bg} ${k.tint} flex items-center justify-center`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                </div>
                <div className="font-mono text-2xl font-bold tabular-nums leading-none">{k.value}</div>
                <div className="text-[11px] text-muted-foreground mt-1.5">{k.label}</div>
              </Link>
            );
          })}
        </div>

        {/* التركيبة السكانية والجغرافية */}
        <DemographicsOverview year={year} />

        {/* الصف الرئيسي */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* أحدث المستندات */}
          <div className="lg:col-span-2 rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
              <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                أحدث المستندات
              </h3>
              <Link to="/documents" className="text-[11px] text-primary hover:underline">عرض الكل</Link>
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground py-12 text-center">جارٍ التحميل...</div>
            ) : recent.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">{year ? `لا توجد مستندات في عام ${year}.` : 'لا توجد مستندات بعد. ارفع أول مستند للبدء.'}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground border-b border-border bg-muted/20">
                      <th className="text-right font-medium px-4 py-2">العنوان</th>
                      <th className="text-right font-medium px-3 py-2 hidden sm:table-cell">النوع</th>
                      <th className="text-center font-medium px-3 py-2">كيانات</th>
                      <th className="text-center font-medium px-3 py-2 hidden md:table-cell">روابط</th>
                      <th className="text-center font-medium px-3 py-2">الحالة</th>
                      <th className="text-right font-medium px-3 py-2 hidden lg:table-cell">الوقت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((d) => (
                      <tr key={d.id} className="border-b border-border/50 last:border-0 hover:bg-accent/50 transition-colors">
                        <td className="px-4 py-2.5">
                          <Link to={`/documents/${d.id}`} className="font-medium hover:text-primary line-clamp-1">{d.title}</Link>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">{TYPE_LABELS[d.document_type] || 'أخرى'}</td>
                        <td className="px-3 py-2.5 text-center font-mono tabular-nums text-xs">{d.entity_count || 0}</td>
                        <td className="px-3 py-2.5 text-center font-mono tabular-nums text-xs hidden md:table-cell">{d.connection_count || 0}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-block text-[10px] px-2 py-0.5 rounded border ${STATUS_STYLE[d.status] || STATUS_STYLE.pending}`}>
                            {STATUS_LABELS[d.status] || d.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">{timeAgo(d.created_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* أبرز الكيانات */}
          <div className="rounded-lg border border-border bg-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
              <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                أبرز الكيانات
              </h3>
              <Link to="/entities" className="text-[11px] text-primary hover:underline">الكل</Link>
            </div>
            {loading ? (
              <div className="text-sm text-muted-foreground py-12 text-center">جارٍ التحميل...</div>
            ) : topEntities.length === 0 ? (
              <div className="text-sm text-muted-foreground py-12 text-center">{year ? `لا توجد كيانات في عام ${year}.` : 'لا توجد كيانات بعد.'}</div>
            ) : (
              <div className="divide-y divide-border/50">
                {topEntities.map((e, i) => (
                  <Link key={e.id} to={`/entities/${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent/50 transition-colors">
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground w-5">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate flex items-center gap-1.5">
                        {e.name}
                        {e.watchlist && <Flag className="w-3 h-3 text-amber-500 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{ENTITY_TYPE_LABELS[e.type] || 'أخرى'}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-mono text-xs font-semibold tabular-nums">{e.mention_count || 0}</div>
                      <div className="text-[9px] text-muted-foreground">ذكر</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* التحليلات */}
        <DashboardAnalytics year={year} />
      </div>
    </div>
  );
}