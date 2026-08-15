import { useState } from 'react';
import { Link } from 'react-router-dom';
import { GitFork, ArrowLeft, Users, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

export default function PathAnalysis({ entities }) {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (!source || !target || source === target) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('findEntityPath', { source_id: source, target_id: target });
      setResult(res.data);
    } catch (e) {} finally { setLoading(false); }
  };

  const sel = 'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <h3 className="font-heading font-semibold flex items-center gap-2">
        <GitFork className="w-4 h-4 text-primary" /> تحليل المسار بين كيانين
      </h3>
      <p className="text-xs text-muted-foreground">
        اختر كيانين لإيجاد أقصر مسار بينهما في شبكة العلاقات، والكيانات المشتركة التي تربطهما.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الكيان المصدر</label>
          <select value={source} onChange={(e) => setSource(e.target.value)} className={sel}>
            <option value="">— اختر —</option>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">الكيان الهدف</label>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className={sel}>
            <option value="">— اختر —</option>
            {entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <button
          onClick={run}
          disabled={loading || !source || !target || source === target}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitFork className="w-4 h-4" />}
          {loading ? 'جارٍ التحليل...' : 'تحليل المسار'}
        </button>
      </div>

      {result && (
        <div className="space-y-4 pt-2 border-t border-border">
          {result.connected ? (
            <div>
              <div className="text-sm font-medium mb-2">أقصر مسار ({result.path_length} كيان):</div>
              <div className="flex items-center gap-1 flex-wrap">
                {result.path.map((p, i) => (
                  <span key={p.id} className="flex items-center gap-1">
                    <Link to={`/entities/${p.id}`} className="px-2.5 py-1 rounded-lg bg-accent hover:bg-accent/60 text-sm font-medium">
                      {p.name}
                    </Link>
                    {i < result.path.length - 1 && <ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" />}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">لا يوجد مسار يربط الكيانين في الشبكة الحالية.</div>
          )}

          {result.common_neighbors && result.common_neighbors.length > 0 && (
            <div>
              <div className="text-sm font-medium mb-2 flex items-center gap-1">
                <Users className="w-4 h-4 text-amber-500" /> الكيانات المشتركة ({result.common_neighbors.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {result.common_neighbors.map((c) => (
                  <Link key={c.id} to={`/entities/${c.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                    {c.name} {TYPE_LABELS[c.type] ? `· ${TYPE_LABELS[c.type]}` : ''}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}