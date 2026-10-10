import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, Flag, Eye, AlertTriangle } from 'lucide-react';
import { localClient } from '@/api/localClient';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

const TIERS = [
  { key: 'critical', label: 'حرجة', min: 70, badge: 'bg-red-100 text-red-800 border-red-300', dot: 'bg-red-700', card: 'border-2 border-red-800 bg-red-50/40' },
  { key: 'high', label: 'عالية', min: 40, badge: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-red-600', card: 'border-2 border-red-700 bg-red-50/30' },
  { key: 'medium', label: 'متوسطة', min: 10, badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', card: 'border border-border border-r-4 border-r-amber-400' },
  { key: 'low', label: 'منخفضة', min: 1, badge: 'bg-lime-100 text-lime-700 border-lime-200', dot: 'bg-lime-500', card: 'border border-border border-r-4 border-r-lime-400' }
];

function tierOf(score) {
  for (const t of TIERS) if (score >= t.min) return t;
  return null;
}

export default function SecurityWatchPanel() {
  const [entities, setEntities] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [all, profs] = await Promise.all([
          localClient.entities.Entity.list('-risk_score', 300),
          localClient.entities.RiskProfile.list('-created_date', 100)
        ]);
        setEntities((all || []).filter((e) => e.watchlist || (e.risk_score || 0) > 0));
        setProfiles((profs || []).filter((p) => p.enabled));
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const matched = entities.map((e) => {
    const score = e.risk_score || 0;
    const tier = tierOf(score);
    const reasons = [];
    if (e.watchlist) reasons.push('قائمة المراقبة');
    if (tier) reasons.push('خطورة ' + tier.label);
    return { ...e, score, tier, reasons };
  });

  const counts = { critical: 0, high: 0, medium: 0, low: 0, watch: 0 };
  matched.forEach((e) => {
    if (e.tier) counts[e.tier.key]++;
    if (e.watchlist) counts.watch++;
  });

  const filtered = tierFilter === 'all' ? matched : matched.filter((e) => e.tier && e.tier.key === tierFilter);
  const sorted = [...filtered].sort((a, b) => {
    const pa = (a.watchlist ? 1000 : 0) + a.score;
    const pb = (b.watchlist ? 1000 : 0) + b.score;
    return pb - pa;
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-red-500" /> لوحة مراقبة الكيانات الخطرة
        </h3>
        <span className="text-xs text-muted-foreground">{matched.length} كيان مطابق</span>
      </div>

      {/* ملخص قوائم المخاطر المُعرّفة */}
      {profiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4 pb-4 border-b border-border">
          <span className="text-xs text-muted-foreground self-center">قوائم المخاطر المفعّلة:</span>
          {profiles.map((p) => (
            <span key={p.id} className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
              {p.name}
            </span>
          ))}
        </div>
      )}

      {/* بطاقات مستويات الخطورة */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <button
          onClick={() => setTierFilter('all')}
          className={`rounded-lg border p-3 text-right transition-colors ${tierFilter === 'all' ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40'}`}
        >
          <div className="text-xs text-muted-foreground">إجمالي المطابق</div>
          <div className="text-xl font-bold mt-0.5">{matched.length}</div>
        </button>
        {TIERS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTierFilter(tierFilter === t.key ? 'all' : t.key)}
            className={`rounded-lg border p-3 text-right transition-colors ${tierFilter === t.key ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40'}`}
          >
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${t.dot}`} />
              <div className="text-xs text-muted-foreground">خطورة {t.label}</div>
            </div>
            <div className="text-xl font-bold mt-0.5">{counts[t.key]}</div>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">جارٍ التحميل...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">لا توجد كيانات مطابقة لقوائم المخاطر.</p>
      ) : (
        <div className="space-y-2 max-h-[520px] overflow-auto pe-1">
          {sorted.map((e) => {
            const tier = e.tier || TIERS[3];
            return (
              <Link
                key={e.id}
                to={`/entities/${e.id}`}
                className={`flex items-start gap-3 p-3 rounded-lg ${tier.card} hover:bg-accent/40 transition-colors`}
              >
                <span className={`w-2.5 h-2.5 rounded-full ${tier.dot} mt-1.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {e.watchlist && <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    <span className="text-sm font-medium truncate">{e.name}</span>
                    <span className="text-[11px] text-muted-foreground">{TYPE_LABELS[e.type] || e.type}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${tier.badge}`}>خطورة {tier.label} • {e.score}</span>
                  </div>
                  {e.aliases && e.aliases.length > 0 && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{e.aliases.slice(0, 3).join('، ')}</div>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {e.reasons.map((r, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-accent text-accent-foreground flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5" /> {r}
                      </span>
                    ))}
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground flex items-center gap-1">
                      <Eye className="w-2.5 h-2.5" /> {e.mention_count || 0} ذكر
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}