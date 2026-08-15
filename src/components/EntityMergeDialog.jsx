import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Search, GitMerge, AlertTriangle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { matchesEntityQuery } from '@/lib/entitySearch';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

export default function EntityMergeDialog({ open, onOpenChange, primaryEntity, onMerged }) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [duplicate, setDuplicate] = useState(null);
  const [merging, setMerging] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !primaryEntity) return;
    setDuplicate(null);
    setQuery('');
    (async () => {
      setLoading(true);
      try {
        const list = await base44.entities.Entity.list('-mention_count', 1000);
        setAll(list.filter((e) => e.id !== primaryEntity.id));
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [open, primaryEntity]);

  const results = query.trim()
    ? all.filter((e) => matchesEntityQuery(e, query)).slice(0, 30)
    : all.slice(0, 30);

  const handleMerge = async () => {
    if (!duplicate) return;
    setMerging(true);
    try {
      const res = await base44.functions.invoke('mergeEntities', { primary_id: primaryEntity.id, duplicate_id: duplicate.id });
      const d = res.data || res;
      toast({ title: 'تم الدمج بنجاح', description: `إعادة توجيه ${d.repointed_connections || 0} رابط • ${d.merged_documents || 0} مستند` });
      onMerged && onMerged(primaryEntity.id);
    } catch (e) {
      toast({ variant: 'destructive', title: 'فشل الدمج', description: e.message });
    } finally { setMerging(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-primary" /> دمج الكيانات
          </DialogTitle>
          <DialogDescription>
            ادمج كياناً مكرراً داخل <span className="font-medium text-foreground">{primaryEntity?.name}</span>. سيتم نقل الروابط والذكر والأسماء البديلة والسمات والمستندات، ثم حذف الكيان المكرر نهائياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ابحث عن الكيان المكرر..."
              className="w-full pr-10 pl-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">جارٍ التحميل...</div>
            ) : results.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">لا توجد نتائج.</div>
            ) : results.map((e) => (
              <button
                key={e.id}
                onClick={() => setDuplicate(e)}
                className={`w-full text-right p-3 flex items-center justify-between gap-2 transition-colors ${duplicate?.id === e.id ? 'bg-primary/10' : 'hover:bg-accent'}`}
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{e.name}</div>
                  {e.aliases?.length > 0 && <div className="text-xs text-muted-foreground truncate">{e.aliases.join('، ')}</div>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-accent">{TYPE_LABELS[e.type] || 'أخرى'}</span>
                  <span className="text-xs text-muted-foreground">{e.mention_count || 0} ذكر</span>
                </div>
              </button>
            ))}
          </div>

          {duplicate && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                سيتم دمج <span className="font-medium">{duplicate.name}</span> داخل <span className="font-medium">{primaryEntity?.name}</span> وحذف المكرر نهائياً. لا يمكن التراجع.
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <button onClick={() => onOpenChange(false)} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent">إلغاء</button>
          <button
            onClick={handleMerge}
            disabled={!duplicate || merging}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
            {merging ? 'جارٍ الدمج...' : 'تأكيد الدمج'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}