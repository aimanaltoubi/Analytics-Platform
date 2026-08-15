import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Globe } from 'lucide-react';

export default function NationalityOverview({ entities }) {
  const counts = useMemo(() => {
    const m = {};
    entities.forEach((e) => {
      if (e.type !== 'person') return;
      const nat = e.attributes?.['الجنسية'];
      if (!nat || !String(nat).trim()) return;
      const k = String(nat).trim();
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [entities]);

  const max = Math.max(...counts.map((c) => c.count), 1);
  const totalPersons = entities.filter((e) => e.type === 'person').length;
  const withNat = counts.reduce((s, c) => s + c.count, 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5 hover:shadow-md transition-shadow">
      <h3 className="font-heading font-semibold mb-1 flex items-center gap-2">
        <Globe className="w-4 h-4" /> توزيع الجنسيات
      </h3>
      <p className="text-xs text-muted-foreground mb-4">اضغط على جنسية لعرض الأشخاص المنتمين إليها وتفاصيلهم.</p>
      {counts.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">لا توجد بيانات جنسيات. أضف سمة «الجنسية» للكيانات.</p>
      ) : (
        <div className="space-y-2.5">
          {counts.map((c) => (
            <Link key={c.name} to={`/nationalities/${encodeURIComponent(c.name)}`} className="block group">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium group-hover:text-primary transition-colors">{c.name}</span>
                <span className="text-xs text-muted-foreground">{c.count}</span>
              </div>
              <div className="h-2.5 rounded-full bg-accent overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary/70 group-hover:bg-primary transition-colors"
                  style={{ width: `${(c.count / max) * 100}%` }}
                />
              </div>
            </Link>
          ))}
          <div className="text-xs text-muted-foreground pt-2 border-t border-border/60">
            {withNat} من أصل {totalPersons} شخص لديهم جنسية محددة
          </div>
        </div>
      )}
    </div>
  );
}