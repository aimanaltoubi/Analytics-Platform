import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Check, GitMerge, Loader2, RotateCcw, ScanSearch, X } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const TYPE_LABELS = { person: 'فرد', company: 'شركة', organization: 'منظمة' };
const TABS = [
  { key: 'pending', label: 'قيد المراجعة' },
  { key: 'dismissed', label: 'مستبعدة' },
  { key: 'merged', label: 'مدمجة' }
];

export default function DuplicateReview() {
  const [reviews, setReviews] = useState([]);
  const [entities, setEntities] = useState([]);
  const [history, setHistory] = useState([]);
  const [tab, setTab] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [mergePlan, setMergePlan] = useState(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const [nextReviews, nextEntities, nextHistory] = await Promise.all([
        localClient.entities.DuplicateReview.list('-created_date', 1000),
        localClient.entities.Entity.list('-updated_date', 10000),
        localClient.entities.MergeHistory.filter({ status: 'active' }, '-created_date', 1000)
      ]);
      setReviews(nextReviews);
      setEntities(nextEntities);
      setHistory(nextHistory);
    } catch (error) {
      toast({ title: 'تعذر تحميل قائمة المراجعة', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const entityById = useMemo(() => new Map(entities.map((entity) => [entity.id, entity])), [entities]);
  const visibleReviews = reviews.filter((review) => review.status === tab);
  const counts = Object.fromEntries(TABS.map(({ key }) => [key, reviews.filter((review) => review.status === key).length]));

  const scan = async () => {
    setScanning(true);
    try {
      const result = await localClient.functions.invoke('scanDuplicates', {});
      toast({ title: 'اكتمل فحص الأسماء', description: `اقتراحات جديدة: ${result.data.added} · قيد المراجعة: ${result.data.pending}` });
      await load();
    } catch (error) {
      toast({ title: 'تعذر فحص التكرارات', description: error.message, variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const dismiss = async (review) => {
    setBusyId(review.id);
    try {
      await localClient.entities.DuplicateReview.update(review.id, { status: 'dismissed' });
      await load();
    } catch (error) {
      toast({ title: 'تعذر استبعاد الاقتراح', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const reopen = async (review) => {
    setBusyId(review.id);
    try {
      await localClient.entities.DuplicateReview.update(review.id, { status: 'pending' });
      await load();
    } catch (error) {
      toast({ title: 'تعذر إعادة فتح الاقتراح', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const merge = async () => {
    if (!mergePlan) return;
    setBusyId(mergePlan.review.id);
    try {
      const result = await localClient.functions.invoke('mergeEntities', {
        primary_id: mergePlan.primary.id,
        duplicate_id: mergePlan.duplicate.id,
        review_id: mergePlan.review.id
      });
      toast({ title: 'تم الدمج', description: 'يمكن التراجع من سجل عمليات الدمج ما دامت السجلات لم تتغير.' });
      setMergePlan(null);
      await load();
      return result.data;
    } catch (error) {
      toast({ title: 'تعذر الدمج', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const undo = async (mergeId) => {
    setBusyId(mergeId);
    try {
      await localClient.functions.invoke('undoMerge', { merge_history_id: mergeId });
      toast({ title: 'تم التراجع عن الدمج', description: 'أُعيد الكيان المكرر وروابطه وذكره إلى حالتها السابقة.' });
      await load();
    } catch (error) {
      toast({ title: 'تعذر التراجع بأمان', description: error.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const openMergePlan = (review, primaryId, duplicateId) => {
    const primary = entityById.get(primaryId);
    const duplicate = entityById.get(duplicateId);
    if (!primary || !duplicate) {
      toast({ title: 'تعذر العثور على أحد الكيانين', description: 'حدّث القائمة وأعد فحص التكرارات.', variant: 'destructive' });
      return;
    }
    setMergePlan({ review, primary, duplicate });
  };

  const typeLabel = (review) => TYPE_LABELS[review.entity_type] || review.entity_type;
  const mergeNames = (item) => `${item.duplicate_before?.name || 'كيان'} ← ${item.primary_before?.name || 'كيان'}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-5 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><GitMerge className="h-4 w-4" /> جودة البيانات</div>
          <h1 className="font-heading text-2xl font-bold">مراجعة الكيانات المكررة</h1>
          <p className="mt-1 text-sm text-muted-foreground">تُعرض تطابقات الاسم الدقيق أو الاسم البديل للمراجعة فقط؛ لا يحدث دمج تلقائي.</p>
        </div>
        <button onClick={scan} disabled={scanning || loading} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
          {scanning ? 'جارٍ الفحص...' : 'فحص التكرارات'}
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border">
        {TABS.map((item) => (
          <button key={item.key} onClick={() => setTab(item.key)} className={`border-b-2 px-3 py-2 text-sm ${tab === item.key ? 'border-primary font-semibold text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {item.label}<span className="mr-2 font-mono text-xs">{counts[item.key]}</span>
          </button>
        ))}
      </div>

      {loading ? <p className="py-10 text-center text-sm text-muted-foreground">جارٍ تحميل السجلات...</p> : visibleReviews.length === 0 ? (
        <div className="border-y border-border py-12 text-center text-sm text-muted-foreground">
          {tab === 'pending' ? 'لا توجد اقتراحات قيد المراجعة. شغّل فحص التكرارات للبحث عن تطابقات جديدة.' : 'لا توجد سجلات في هذا القسم.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visibleReviews.map((review) => {
            const left = entityById.get(review.left_id);
            const right = entityById.get(review.right_id);
            const historyRecord = history.find((item) => item.id === review.merge_history_id);
            return (
              <article key={review.id} className="border-y border-border py-4">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{typeLabel(review)}</span><span>·</span><span>{review.reason}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {[{ entity: left, name: review.left_name, id: review.left_id }, { entity: right, name: review.right_name, id: review.right_id }].map((side) => (
                    <div key={side.id} className="min-w-0 border border-border bg-card p-3">
                      <Link to={`/entities/${side.id}`} className="text-sm font-semibold hover:underline">{side.entity?.name || side.name}</Link>
                      {side.entity ? (
                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                          <div>الاسم البديل: {(side.entity.aliases || []).join('، ') || '—'}</div>
                          <div>المستندات: {(side.entity.document_ids || []).length} · مرات الذكر: {side.entity.mention_count || 0}</div>
                          {Object.entries(side.entity.attributes || {}).slice(0, 3).map(([key, value]) => <div key={key}>{key}: {String(value)}</div>)}
                        </div>
                      ) : <p className="mt-2 text-xs text-muted-foreground">لم يعد هذا السجل موجوداً.</p>}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {review.status === 'pending' && left && right && (
                    <>
                      <button onClick={() => openMergePlan(review, left.id, right.id)} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-primary-foreground hover:bg-primary/90">
                        <GitMerge className="h-3.5 w-3.5" /> دمج «{right.name}» داخل «{left.name}»
                      </button>
                      <button onClick={() => openMergePlan(review, right.id, left.id)} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent">
                        دمج «{left.name}» داخل «{right.name}»
                      </button>
                      <button onClick={() => dismiss(review)} disabled={busyId === review.id} className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50">
                        <X className="h-3.5 w-3.5" /> ليسا مكررين
                      </button>
                    </>
                  )}
                  {review.status === 'dismissed' && (
                    <button onClick={() => reopen(review)} disabled={busyId === review.id} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
                      <RotateCcw className="h-3.5 w-3.5" /> إعادة للمراجعة
                    </button>
                  )}
                  {review.status === 'merged' && historyRecord && (
                    <button onClick={() => undo(historyRecord.id)} disabled={busyId === historyRecord.id} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
                      {busyId === historyRecord.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} تراجع عن الدمج
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="border-t border-border pt-5">
        <h2 className="mb-2 flex items-center gap-2 font-heading text-base font-semibold"><RotateCcw className="h-4 w-4" /> سجل الدمج القابل للتراجع</h2>
        {history.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد عمليات دمج نشطة.</p> : (
          <div className="divide-y divide-border">
            {history.map((item) => (
              <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{mergeNames(item)}</span>
                  <span className="mr-2 text-xs text-muted-foreground">{new Date(item.created_date).toLocaleString()}</span>
                </div>
                <button onClick={() => undo(item.id)} disabled={busyId === item.id} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent disabled:opacity-50">
                  {busyId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} تراجع
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <Dialog open={Boolean(mergePlan)} onOpenChange={(open) => { if (!open) setMergePlan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> تأكيد دمج كيانين</DialogTitle>
            <DialogDescription>
              سيتم دمج <span className="font-semibold text-foreground">{mergePlan?.duplicate.name}</span> داخل <span className="font-semibold text-foreground">{mergePlan?.primary.name}</span>. تُحفظ نسخة قابلة للتراجع؛ إذا عُدّل الكيان الأساسي بعد الدمج، سيُمنع التراجع كي لا تُفقد التعديلات.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setMergePlan(null)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent">إلغاء</button>
            <button onClick={merge} disabled={busyId === mergePlan?.review.id} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {busyId === mergePlan?.review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} تأكيد الدمج
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}