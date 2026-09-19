import { Link } from 'react-router-dom';
import { Users, Share2, ChevronLeft } from 'lucide-react';

// رسم بياني تفاعلي لأعلى الكيانات ذكراً وارتباطاً — كل صف رابط لملف الكيان.
export default function TopEntitiesChart({ items }) {
  const max = Math.max(...(items || []).flatMap((i) => [i.mention, i.connections]), 1);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> ذكر</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> روابط</span>
      </div>
      <div className="divide-y divide-border/40">
        {items.map((it) => (
          <Link
            key={it.id}
            to={`/entities/${it.id}`}
            className="block group py-2.5 hover:bg-accent/40 -mx-2 px-2 rounded-lg transition-colors"
            title={`عرض ملف ${it.name}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-sm font-medium truncate group-hover:text-primary transition-colors">{it.name}</span>
              <div className="flex items-center gap-1 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0">
                <span className="text-[10px]">الملف</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] w-9 text-muted-foreground shrink-0 inline-flex items-center gap-1"><Users className="w-3 h-3" />ذكر</span>
                <div className="flex-1 h-2.5 rounded-full bg-accent overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500/80 group-hover:bg-blue-500 transition-all" style={{ width: `${Math.max((it.mention / max) * 100, 2)}%` }} />
                </div>
                <span className="text-[11px] w-8 text-left shrink-0 tabular-nums font-medium">{it.mention}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] w-9 text-muted-foreground shrink-0 inline-flex items-center gap-1"><Share2 className="w-3 h-3" />روابط</span>
                <div className="flex-1 h-2.5 rounded-full bg-accent overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500/80 group-hover:bg-emerald-500 transition-all" style={{ width: `${Math.max((it.connections / max) * 100, 2)}%` }} />
                </div>
                <span className="text-[11px] w-8 text-left shrink-0 tabular-nums font-medium">{it.connections}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}