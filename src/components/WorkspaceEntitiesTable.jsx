import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, ArrowUp, ArrowDown, Flag } from 'lucide-react';

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

export default function WorkspaceEntitiesTable({ entities }) {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  const attrKeys = useMemo(() => {
    const keys = new Set();
    entities.forEach((e) => {
      if (e.attributes && typeof e.attributes === 'object') {
        Object.keys(e.attributes).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [entities]);

  const getValue = (e, key) => {
    if (key === 'name') return e.name || '';
    if (key === 'type') return TYPE_LABELS[e.type] || e.type || '';
    if (key === 'aliases') return (e.aliases || []).join('، ');
    if (key === 'mention_count') return e.mention_count || 0;
    if (key === 'risk_score') return e.risk_score || 0;
    if (key === 'watchlist') return e.watchlist ? 'نعم' : 'لا';
    return e.attributes?.[key] ?? '';
  };

  const sorted = useMemo(() => {
    const arr = [...entities];
    arr.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      let cmp = 0;
      if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), 'ar');
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entities, sortKey, sortDir, attrKeys]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sortIcon = (colKey) => {
    if (sortKey !== colKey) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const columns = [
    { key: 'name', label: 'الاسم' },
    { key: 'type', label: 'النوع' },
    { key: 'aliases', label: 'الأسماء البديلة' },
    ...attrKeys.map((k) => ({ key: k, label: k })),
    { key: 'mention_count', label: 'عدد الذكر' },
    { key: 'risk_score', label: 'الخطورة' },
    { key: 'watchlist', label: 'المراقبة' }
  ];

  if (entities.length === 0) {
    return <p className="text-sm text-muted-foreground">لا توجد كيانات لعرضها في الجدول.</p>;
  }

  return (
    <div className="overflow-auto rounded-lg border border-border max-h-[480px]">
      <table className="w-full text-sm">
        <thead className="bg-accent/50 sticky top-0 z-10">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-right font-medium whitespace-nowrap">
                <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-primary">
                  {c.label}
                  {sortIcon(c.key)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((e) => (
            <tr key={e.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2">
                <Link to={`/entities/${e.id}`} className="font-medium hover:underline inline-flex items-center gap-1">
                  {e.watchlist && <Flag className="w-3 h-3 text-amber-500 shrink-0" />}
                  <span className="truncate max-w-[180px]">{e.name}</span>
                </Link>
              </td>
              <td className="px-3 py-2 text-muted-foreground">{TYPE_LABELS[e.type] || e.type}</td>
              <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={(e.aliases || []).join('، ')}>{(e.aliases || []).join('، ') || '—'}</td>
              {attrKeys.map((k) => (
                <td key={k} className="px-3 py-2 max-w-[180px] truncate" title={String(e.attributes?.[k] ?? '')}>{e.attributes?.[k] ?? '—'}</td>
              ))}
              <td className="px-3 py-2 text-muted-foreground">{e.mention_count || 0}</td>
              <td className="px-3 py-2">
                <span className={`text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ${(e.risk_score || 0) >= 70 ? 'bg-red-100 text-red-700' : (e.risk_score || 0) >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{e.risk_score || 0}</span>
              </td>
              <td className="px-3 py-2">{e.watchlist ? 'نعم' : 'لا'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}