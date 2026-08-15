import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search as SearchIcon, Users, FileText, Share2, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

function ScoreBar({ score }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.9 ? 'bg-emerald-500' : score >= 0.75 ? 'bg-blue-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className="w-12 h-1.5 rounded-full bg-accent overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground w-8">{pct}%</span>
    </div>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [total, setTotal] = useState(0);

  const runSearch = async (q) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setTotal(0);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await base44.functions.invoke('fuzzySearch', { query: q, limit: 50 });
      setResults(res.data.results || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      setResults([]);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const grouped = {
    entity: results.filter((r) => r.type === 'entity'),
    document: results.filter((r) => r.type === 'document'),
    connection: results.filter((r) => r.type === 'connection')
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" /> محرك البحث الضبابي
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          بحث فوري يطابق الكلمات الجزئية والأسماء المُخطئة عبر الكيانات والمستندات والروابط — مع ترتيب النتائج حسب درجة التشابه.
        </p>
      </div>

      <div className="relative">
        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="اكتب اسماً جزئياً أو مُخطئاً أو نصاً من مستند..."
          className="w-full pr-11 pl-3 py-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">جارٍ البحث الضبابي...</div>
      ) : !searched ? null : results.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <SearchIcon className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد نتائج مطابقة.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-xs text-muted-foreground">{total} نتيجة مطابقة</div>

          {grouped.entity.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-600" /> الكيانات ({grouped.entity.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {grouped.entity.map((r) => (
                  <Link key={r.id} to={`/entities/${r.id}`} className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{r.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        تطابق: {r.field} {r.meta?.type ? `• ${TYPE_LABELS[r.meta.type] || r.meta.type}` : ''}
                      </div>
                    </div>
                    <ScoreBar score={r.score} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {grouped.document.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> المستندات ({grouped.document.length})
              </h3>
              <div className="space-y-2">
                {grouped.document.map((r) => (
                  <Link key={r.id} to={`/documents/${r.id}`} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-accent/50 transition-colors">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.label}</div>
                      {r.snippet && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.snippet}</div>}
                      <div className="text-[11px] text-muted-foreground mt-0.5">تطابق: {r.field}</div>
                    </div>
                    <ScoreBar score={r.score} />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {grouped.connection.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-600" /> الروابط ({grouped.connection.length})
              </h3>
              <div className="space-y-2">
                {grouped.connection.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-accent/30 text-sm">
                    <div className="min-w-0">
                      <div className="truncate">{r.label}</div>
                      <div className="text-[11px] text-muted-foreground">تطابق: {r.field}</div>
                    </div>
                    <ScoreBar score={r.score} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}