export default function BarList({ items, max }) {
  const allVals = items.flatMap((i) => i.values.map((v) => v.value));
  const maxVal = max || Math.max(...allVals, 1);

  return (
    <div className="space-y-3.5">
      {items.map((it, i) => {
        const multi = it.values.length > 1;
        return (
          <div key={i}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-sm font-medium truncate" title={it.name}>{it.name}</span>
              {!multi && <span className="text-xs text-muted-foreground shrink-0">{it.values[0].value}</span>}
            </div>
            <div className={multi ? 'space-y-1.5' : ''}>
              {it.values.map((v, j) => (
                <div key={j} className="flex items-center gap-2">
                  {multi && <span className="text-[11px] w-9 text-muted-foreground shrink-0">{v.label}</span>}
                  <div className="flex-1 h-2.5 rounded-full bg-accent overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${Math.max((v.value / maxVal) * 100, 2)}%`, background: v.color }}
                      title={`${v.label || ''}: ${v.value}`}
                    />
                  </div>
                  {multi && <span className="text-[11px] w-7 text-left shrink-0">{v.value}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}