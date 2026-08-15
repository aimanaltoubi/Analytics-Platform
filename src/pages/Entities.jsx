import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Flag } from 'lucide-react';
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
  person: 'bg-blue-100 text-blue-700',
  organization: 'bg-violet-100 text-violet-700',
  phone: 'bg-amber-100 text-amber-700',
  email: 'bg-emerald-100 text-emerald-700',
  location: 'bg-red-100 text-red-700',
  account: 'bg-cyan-100 text-cyan-700',
  date: 'bg-slate-100 text-slate-700',
  event: 'bg-pink-100 text-pink-700',
  other: 'bg-gray-100 text-gray-700'
};

export default function Entities() {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [watchOnly, setWatchOnly] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await base44.entities.Entity.list('-mention_count', 300);
        setEntities(list);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const types = ['all', ...new Set(entities.map((e) => e.type))];
  const filtered = entities.filter((e) => {
    const matchQuery = !query || e.name?.toLowerCase().includes(query.toLowerCase()) ||
      (e.aliases || []).some((a) => a.toLowerCase().includes(query.toLowerCase()));
    const matchType = typeFilter === 'all' || e.type === typeFilter;
    const matchWatch = !watchOnly || e.watchlist;
    return matchQuery && matchType && matchWatch;
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">الكيانات</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع الكيانات المحلولة عبر المستندات</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث بالاسم أو الاسم البديل..."
            className="w-full pr-10 pl-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {types.map((t) => (
            <option key={t} value={t}>{t === 'all' ? 'كل الأنواع' : TYPE_LABELS[t] || t}</option>
          ))}
        </select>
        <button
          onClick={() => setWatchOnly((w) => !w)}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
            watchOnly ? 'bg-amber-100 text-amber-800 border-amber-300' : 'border-border hover:bg-accent'
          }`}
        >
          <Flag className="w-4 h-4" />
          المراقبة
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد كيانات.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((e) => (
            <Link
              key={e.id}
              to={`/entities/${e.id}`}
              className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {e.watchlist && <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    <div className="font-medium text-sm truncate">{e.name}</div>
                  </div>
                  {e.aliases?.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{e.aliases.join('، ')}</div>
                  )}
                </div>
                <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[e.type] || TYPE_COLORS.other}`}>
                  {TYPE_LABELS[e.type] || 'أخرى'}
                </span>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  ذُكر {e.mention_count || 0} مرة • {e.document_ids?.length || 0} مستند
                </span>
                {(e.risk_score > 0 || e.watchlist) && (
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                    (e.risk_score || 0) >= 70 ? 'bg-red-100 text-red-700' :
                    (e.risk_score || 0) >= 40 ? 'bg-amber-100 text-amber-700' :
                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    خطورة {e.risk_score || 0}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}