import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Search, Flag, Calendar } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { matchesEntityQuery } from '@/lib/entitySearch';
import { getNationality, hasPassport, hasPhone, hasEmail, hasCoordinates, riskTier } from '@/lib/entityClassify';

const TYPE_LABELS = {
  person: 'شخص',
  organization: 'منظمة',
  company: 'شركة',
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
  company: 'bg-emerald-100 text-emerald-700',
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
  const [sort, setSort] = useState('mentions');
  const [nationality, setNationality] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [attrFilters, setAttrFilters] = useState({ passport: false, phone: false, email: false, coords: false });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await localClient.entities.Entity.list('-mention_count', 300);
        setEntities(list);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const types = ['all', ...new Set(entities.map((e) => e.type))];
  const nationalities = [...new Set(entities.map(getNationality).filter(Boolean))].sort();
  const typeCounts = {};
  entities.forEach((e) => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });

  const filtered = entities.filter((e) => {
    if (query && !matchesEntityQuery(e, query)) return false;
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (watchOnly && !e.watchlist) return false;
    if (nationality !== 'all' && getNationality(e) !== nationality) return false;
    if (attrFilters.passport && !hasPassport(e)) return false;
    if (attrFilters.phone && !hasPhone(e)) return false;
    if (attrFilters.email && !hasEmail(e)) return false;
    if (attrFilters.coords && !hasCoordinates(e)) return false;
    if (riskFilter !== 'all' && riskTier(e) !== riskFilter) return false;
    if (dateFrom || dateTo) {
      const d = new Date(e.created_date || 0);
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo && d > new Date(dateTo + 'T23:59:59')) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'risk') return (b.risk_score || 0) - (a.risk_score || 0);
    if (sort === 'recent') return new Date(b.created_date || 0) - new Date(a.created_date || 0);
    if (sort === 'name') return (a.name || '').localeCompare(b.name || '', 'ar');
    return (b.mention_count || 0) - (a.mention_count || 0);
  });

  const hasActiveFilters = nationality !== 'all' || riskFilter !== 'all' || Object.values(attrFilters).some(Boolean) || !!dateFrom || !!dateTo;
  const resetFilters = () => { setNationality('all'); setRiskFilter('all'); setAttrFilters({ passport: false, phone: false, email: false, coords: false }); setDateFrom(''); setDateTo(''); };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">الكيانات</h1>
        <p className="text-sm text-muted-foreground mt-1">جميع الكيانات المحلولة عبر المستندات</p>
      </div>

      <div className="space-y-3">
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
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="mentions">الأكثر ذكراً</option>
            <option value="risk">الأعلى خطورة</option>
            <option value="recent">الأحدث</option>
            <option value="name">الاسم</option>
          </select>
          <button
            onClick={() => setWatchOnly((w) => !w)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border transition-colors ${
              watchOnly ? 'bg-amber-100 text-amber-800 border-amber-300' : 'border-border hover:bg-accent'
            }`}
          >
            <Flag className="w-4 h-4" /> المراقبة
          </button>
        </div>

        {/* شرائح النوع — تصنيف تلقائي بعدّاد */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              typeFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-accent'
            }`}
          >
            الكل ({entities.length})
          </button>
          {types.filter((t) => t !== 'all').map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? 'all' : t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                typeFilter === t ? 'bg-primary text-primary-foreground border-primary' : `${TYPE_COLORS[t] || TYPE_COLORS.other} border-transparent hover:opacity-80`
              }`}
            >
              {TYPE_LABELS[t] || t} ({typeCounts[t] || 0})
            </button>
          ))}
        </div>

        {/* مرشحات السمات المكتشفة */}
        <div className="flex flex-wrap items-center gap-2">
          <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">كل الجنسيات</option>
            {nationalities.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="rounded-lg border border-input bg-background px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="all">كل مستويات الخطورة</option>
            <option value="high">خطورة عالية</option>
            <option value="medium">خطورة متوسطة</option>
            <option value="low">خطورة منخفضة</option>
            <option value="none">بدون خطورة</option>
          </select>
          {[
            { key: 'passport', label: 'جواز سفر' },
            { key: 'phone', label: 'هاتف' },
            { key: 'email', label: 'بريد' },
            { key: 'coords', label: 'إحداثيات' }
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setAttrFilters((p) => ({ ...p, [f.key]: !p[f.key] }))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                attrFilters[f.key] ? 'bg-primary text-primary-foreground border-primary' : 'bg-card border-border hover:bg-accent'
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-card">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">من</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="bg-transparent text-xs focus:outline-none" />
            <span className="text-xs text-muted-foreground">إلى</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="bg-transparent text-xs focus:outline-none" />
          </div>
          {hasActiveFilters && (
            <button onClick={resetFilters} className="px-3 py-1.5 rounded-full text-xs text-muted-foreground hover:text-foreground">إعادة ضبط</button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">جارٍ التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد كيانات.</p>
        </div>
      ) : (
        <>
        <div className="text-xs text-muted-foreground">{sorted.length} كيان</div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sorted.map((e) => (
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
        </>
      )}
    </div>
  );
}