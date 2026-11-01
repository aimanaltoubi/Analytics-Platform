import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, Brain, CheckCircle2, ChevronLeft, Clock3, CopyCheck,
  FileQuestion, FileText, Flag, RefreshCw, ShieldAlert, Upload, Workflow, XCircle, Zap
} from 'lucide-react';
import { localClient } from '@/api/localClient';
import { getNationality } from '@/lib/entityClassify';

const VISIT_KEY = 'sdf-dashboard-last-visit';

const STATUS_LABELS = {
  pending: 'بانتظار المعالجة',
  processing: 'قيد المعالجة',
  processed: 'تمت المعالجة',
  failed: 'فشلت المعالجة'
};

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700',
  processing: 'bg-blue-50 text-blue-700',
  processed: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700'
};

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'وقت غير محدد';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `قبل ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `قبل ${hours} س`;
  return new Date(value).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' });
}

export default function Home() {
  const [documents, setDocuments] = useState([]);
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [duplicateReviews, setDuplicateReviews] = useState([]);
  const [ai, setAi] = useState({ state: 'unknown', available: false, error: '', detail: '' });
  const [lastVisitAt, setLastVisitAt] = useState(null);
  const [hasPreviousVisit, setHasPreviousVisit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const load = async () => {
    try {
      const [docs, people, links, alertItems, duplicateItems] = await Promise.all([
        localClient.entities.Document.list('-created_date', 1000),
        localClient.entities.Entity.list('-created_date', 1000),
        localClient.entities.Connection.list('-created_date', 1000),
        localClient.entities.Alert.list('-created_date', 200),
        localClient.entities.DuplicateReview.filter({ status: 'pending' }, '-created_date', 200)
      ]);
      setDocuments(docs);
      setEntities(people);
      setConnections(links);
      setAlerts(alertItems);
      setDuplicateReviews(duplicateItems);
      setLoadError('');
    } catch (error) {
      setLoadError(error.message || 'تعذّر تحميل بيانات لوحة العمليات.');
    }

    try {
      const status = await localClient.status();
      setAi(status.ai || { state: 'unknown', available: false, error: '', detail: '' });
    } catch (error) {
      setAi({ state: 'unavailable', available: false, error: error.message, detail: '' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    try {
      const previousVisit = Number(window.localStorage.getItem(VISIT_KEY));
      if (Number.isFinite(previousVisit) && previousVisit > 0) {
        setLastVisitAt(previousVisit);
        setHasPreviousVisit(true);
      }
      window.localStorage.setItem(VISIT_KEY, String(Date.now()));
    } catch {
      setHasPreviousVisit(false);
    }
    load();
  }, []);

  const failedDocuments = documents.filter((document) => document.status === 'failed');
  const processingDocuments = documents.filter((document) => ['pending', 'processing'].includes(document.status));
  const newAlerts = alerts.filter((alert) => alert.status === 'new');
  const processedWithoutEntities = documents.filter((document) => document.status === 'processed' && !(document.entity_count || 0));
  const missingNationality = entities.filter((entity) => entity.type === 'person' && !getNationality(entity));
  const connectionsWithoutEvidence = connections.filter((connection) => !String(connection.evidence || '').trim());
  const repeatedTitles = useMemo(() => documents.reduce((counts, document) => {
    const title = String(document.title || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    if (title) counts[title] = (counts[title] || 0) + 1;
    return counts;
  }, {}), [documents]);

  const activity = useMemo(() => {
    const items = [
      ...documents.map((document) => ({
        id: `document-${document.id}`,
        timestamp: document.updated_date || document.created_date,
        title: document.title || 'مستند بلا عنوان',
        detail: STATUS_LABELS[document.status] || 'تمت إضافة مستند',
        status: document.status,
        repeated: (repeatedTitles[String(document.title || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase()] || 0) > 1,
        icon: FileText,
        to: `/documents/${document.id}`
      })),
      ...entities.map((entity) => ({
        id: `entity-${entity.id}`,
        timestamp: entity.updated_date || entity.created_date,
        title: entity.name || 'كيان جديد',
        detail: 'إضافة كيان إلى قاعدة البيانات',
        icon: Activity,
        to: `/entities/${entity.id}`
      })),
      ...connections.map((connection) => ({
        id: `connection-${connection.id}`,
        timestamp: connection.updated_date || connection.created_date,
        title: `${connection.source_entity_name || 'كيان'} · ${connection.target_entity_name || 'كيان'}`,
        detail: String(connection.evidence || '').trim() ? 'تشارك مرصود مع دليل نصي مسجل' : 'تشارك مرصود، دون نص دليل مسجل',
        icon: Workflow,
        to: connection.document_id ? `/documents/${connection.document_id}` : `/entities/${connection.source_entity_id}`
      })),
      ...newAlerts.map((alert) => ({
        id: `alert-${alert.id}`,
        timestamp: alert.updated_date || alert.created_date || alert.triggered_at,
        title: alert.title || 'تنبيه جديد',
        detail: `تنبيه ${alert.severity === 'critical' ? 'حرج' : alert.severity === 'high' ? 'عالٍ' : alert.severity === 'medium' ? 'متوسط' : 'منخفض'}`,
        icon: ShieldAlert,
        to: '/alerts'
      }))
    ].filter((item) => {
      const timestamp = new Date(item.timestamp).getTime();
      return Number.isFinite(timestamp) && (!lastVisitAt || timestamp > lastVisitAt);
    });
    return items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);
  }, [documents, entities, connections, newAlerts, lastVisitAt, repeatedTitles]);

  const queueItems = [
    { label: 'مستندات فشلت معالجتها', value: failedDocuments.length, detail: 'راجع الخطأ أو أعد التحليل', to: '/documents?status=failed', icon: XCircle, color: 'text-red-600 bg-red-50' },
    { label: 'اقتراحات تكرار معلّقة', value: duplicateReviews.length, detail: 'الدمج لا يتم تلقائياً', to: '/duplicates', icon: CopyCheck, color: 'text-amber-700 bg-amber-50' },
    { label: 'تنبيهات جديدة', value: newAlerts.length, detail: 'افتح التنبيهات لمراجعتها', to: '/alerts', icon: AlertTriangle, color: 'text-orange-700 bg-orange-50' }
  ];

  const reviewItems = [
    { label: 'مستندات معالجة بلا كيانات', value: processedWithoutEntities.length, detail: 'قد تحتاج مراجعة النص أو إعادة الاستخراج', to: '/documents?status=processed&no_entities=1', icon: FileQuestion },
    { label: 'أشخاص بلا جنسية مسجلة', value: missingNationality.length, detail: 'فجوة بيانات، وليست جنسية غير معروفة', to: '/entities?type=person&missing_nationality=1', icon: Flag },
    { label: 'روابط بلا نص دليل', value: connectionsWithoutEvidence.length, detail: 'تحقق من المستند المصدر قبل الاستنتاج', to: '/gaps', icon: Workflow }
  ];

  const aiLabel = ai.state === 'ready' ? 'التحليل المحلي جاهز'
    : ai.state === 'loading' ? 'جارٍ تحميل النموذج'
      : ai.state === 'starting' ? 'جارٍ تشغيل النموذج'
        : ai.state === 'unavailable' ? 'التحليل المحلي غير متاح'
          : 'حالة النموذج غير معروفة';
  const aiDetail = [ai.error, ai.detail].filter(Boolean).join('\n');

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <div className="min-h-full">
      <header className="px-6 pt-5 pb-4 border-b border-border bg-card/40">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Strategic Data Fusion</div>
            <h1 className="font-heading text-2xl font-bold leading-tight">لوحة العمليات</h1>
            <p className="text-sm text-muted-foreground mt-1">المهام المفتوحة، النشاط الأخير، وجودة البيانات</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/documents" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors">
              <Upload className="w-3.5 h-3.5" /> إضافة مستند
            </Link>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="تحديث لوحة العمليات"
              title="تحديث"
              className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-border bg-background hover:bg-accent transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div className="p-6 space-y-6">
        {loadError && <p role="alert" className="text-sm text-red-700 border-r-2 border-red-500 pr-3">{loadError}</p>}

        <section aria-labelledby="action-queue-heading" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="action-queue-heading" className="font-heading text-base font-semibold">يتطلب إجراء</h2>
              <p className="text-xs text-muted-foreground mt-0.5">المهام التي ما زالت بحاجة إلى مراجعة</p>
            </div>
            <span className="font-mono text-sm tabular-nums text-muted-foreground">{loading ? '—' : queueItems.reduce((sum, item) => sum + item.value, 0)}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {queueItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.to} className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3.5 hover:border-primary/40 transition-colors">
                  <span className={`flex items-center justify-center w-9 h-9 rounded-md shrink-0 ${item.color}`}><Icon className="w-4 h-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{item.label}</span>
                      <span className="font-mono text-lg font-semibold tabular-nums">{loading ? '—' : item.value}</span>
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">{item.detail}</span>
                  </span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.85fr)] gap-5">
          <section aria-labelledby="activity-heading" className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
              <div>
                <h2 id="activity-heading" className="font-heading text-sm font-semibold">{hasPreviousVisit ? 'منذ زيارتك الأخيرة' : 'أحدث النشاط'}</h2>
                <p className="text-[11px] text-muted-foreground mt-0.5">إضافات جديدة للمستندات والكيانات والروابط والتنبيهات</p>
              </div>
              <Link to="/documents" className="text-[11px] text-primary hover:underline shrink-0">المستندات</Link>
            </div>
            {loading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل النشاط...</div>
            ) : activity.length === 0 ? (
              <div className="py-10 px-4 text-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا يوجد نشاط جديد منذ زيارتك الأخيرة.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/70">
                {activity.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.id} to={item.to} className="flex items-start gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                      <Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium truncate max-w-full">{item.title}</span>
                          {item.status && <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_STYLES[item.status] || 'bg-muted text-muted-foreground'}`}>{STATUS_LABELS[item.status] || item.status}</span>}
                          {item.repeated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">عنوان متكرر</span>}
                        </span>
                        <span className="block text-[11px] text-muted-foreground mt-1">{item.detail}</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{relativeTime(item.timestamp)}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section aria-labelledby="readiness-heading" className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 id="readiness-heading" className="font-heading text-sm font-semibold">جاهزية المعالجة المحلية</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">حالة النموذج وطابور المستندات</p>
            </div>
            <div className="divide-y divide-border/70">
              <div className="flex items-center gap-3 px-4 py-3" title={aiDetail || undefined}>
                <Brain className={`w-4 h-4 shrink-0 ${ai.state === 'ready' ? 'text-emerald-600' : ai.state === 'unavailable' ? 'text-red-600' : 'text-amber-600'}`} />
                <span className="min-w-0 flex-1 text-sm">الذكاء الاصطناعي المحلي</span>
                <span className="text-xs text-muted-foreground">{loading ? 'جارٍ التحقق' : aiLabel}</span>
              </div>
              <Link to="/documents?status=processing" className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                <Clock3 className={`w-4 h-4 shrink-0 ${processingDocuments.length ? 'text-amber-600' : 'text-muted-foreground'}`} />
                <span className="min-w-0 flex-1 text-sm">بانتظار المعالجة أو قيدها</span>
                <span className="font-mono text-sm font-semibold tabular-nums">{loading ? '—' : processingDocuments.length}</span>
              </Link>
              <Link to="/documents" className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                <Zap className="w-4 h-4 text-primary shrink-0" />
                <span className="min-w-0 flex-1 text-sm">المعالجة تعمل محلياً</span>
                <span className="text-[11px] text-muted-foreground">على هذا الجهاز</span>
              </Link>
            </div>
          </section>
        </div>

        <section aria-labelledby="quality-heading" className="space-y-3">
          <div>
            <h2 id="quality-heading" className="font-heading text-base font-semibold">مراجعة الأدلة وجودة البيانات</h2>
            <p className="text-xs text-muted-foreground mt-0.5">إشارات للمراجعة، وليست استنتاجات مؤكدة</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {reviewItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.label} to={item.to} className="group flex items-start gap-3 border-r-2 border-amber-400 bg-card px-3.5 py-3 hover:bg-accent/40 transition-colors">
                  <Icon className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="font-mono text-sm font-semibold tabular-nums">{loading ? '—' : item.value}</span>
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-1">{item.detail}</span>
                  </span>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary mt-0.5 shrink-0" />
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}