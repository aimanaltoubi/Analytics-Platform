import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const TYPE_COLORS = {
  person: '#3b82f6',
  organization: '#8b5cf6',
  phone: '#f59e0b',
  email: '#10b981',
  location: '#ef4444',
  account: '#06b6d4',
  date: '#64748b',
  event: '#ec4899',
  other: '#94a3b8'
};

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

export default function NetworkGraph({ entities = [], connections = [], height = 560 }) {
  const navigate = useNavigate();
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [dragId, setDragId] = useState(null);
  const dims = useRef({ w: 800, h: height });

  // بناء العقد
  useEffect(() => {
    const w = svgRef.current?.clientWidth || 800;
    dims.current.w = w;
    dims.current.h = height;
    const cx = w / 2;
    const cy = height / 2;
    const byId = {};
    entities.forEach((e, i) => {
      const angle = (i / Math.max(entities.length, 1)) * Math.PI * 2;
      const r = Math.min(w, height) * 0.32;
      byId[e.id] = {
        id: e.id,
        name: e.name,
        type: e.type,
        x: cx + Math.cos(angle) * r + (Math.random() - 0.5) * 20,
        y: cy + Math.sin(angle) * r + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0,
        degree: 0
      };
    });
    setNodes(Object.values(byId));
  }, [entities, height]);

  const edges = useMemo(() => {
    return connections
      .map((c) => ({ source: c.source_entity_id, target: c.target_entity_id, type: c.relationship_type, evidence: c.evidence }))
      .filter((e) => e.source && e.target);
  }, [connections]);

  // محاكاة القوى
  useEffect(() => {
    if (!nodes.length) return;
    let raf;
    const run = () => {
      const w = dims.current.w;
      const h = dims.current.h;
      setNodes((prev) => {
        if (!prev.length) return prev;
        const map = {};
        prev.forEach((n) => (map[n.id] = { ...n }));
        const arr = prev.map((n) => ({ ...n, vx: 0, vy: 0 }));

        // التنافر
        for (let i = 0; i < arr.length; i++) {
          for (let j = i + 1; j < arr.length; j++) {
            const dx = arr[i].x - arr[j].x;
            const dy = arr[i].y - arr[j].y;
            let dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 2600 / (dist * dist);
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            arr[i].vx += fx;
            arr[i].vy += fy;
            arr[j].vx -= fx;
            arr[j].vy -= fy;
          }
        }
        // التجاذب على الحواف
        for (const e of edges) {
          const a = map[e.source] || arr.find((n) => n.id === e.source);
          const b = map[e.target] || arr.find((n) => n.id === e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 120) * 0.04;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const na = arr.find((n) => n.id === a.id);
          const nb = arr.find((n) => n.id === b.id);
          if (na) { na.vx += fx; na.vy += fy; }
          if (nb) { nb.vx -= fx; nb.vy -= fy; }
        }
        // المركز
        for (const n of arr) {
          n.vx += (w / 2 - n.x) * 0.01;
          n.vy += (h / 2 - n.y) * 0.01;
          n.x += Math.max(-12, Math.min(12, n.vx));
          n.y += Math.max(-12, Math.min(12, n.vy));
          n.x = Math.max(30, Math.min(w - 30, n.x));
          n.y = Math.max(30, Math.min(h - 30, n.y));
          map[n.id] = n;
        }
        return arr;
      });
      raf = requestAnimationFrame(run);
    };
    raf = requestAnimationFrame(run);
    let stopped = false;
    setTimeout(() => { stopped = true; cancelAnimationFrame(raf); }, 2500);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [nodes.length, edges.length]);

  const nodeById = useMemo(() => {
    const m = {};
    nodes.forEach((n) => (m[n.id] = n));
    return m;
  }, [nodes]);

  const handlePointerDown = (e, id) => {
    setDragId(id);
  };
  const handlePointerMove = (e) => {
    if (!dragId) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setNodes((prev) => prev.map((n) => (n.id === dragId ? { ...n, x, y, vx: 0, vy: 0 } : n)));
  };
  const handlePointerUp = () => setDragId(null);

  const selectedNode = selected ? nodeById[selected] : null;
  const selectedEntity = selected ? entities.find((e) => e.id === selected) : null;
  const selectedEdges = selected
    ? edges.filter((e) => e.source === selected || e.target === selected)
    : [];

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        className="rounded-xl border border-border bg-[radial-gradient(circle_at_center,#f8fafc,#f1f5f9)]"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* الحواف */}
        {edges.map((e, i) => {
          const a = nodeById[e.source];
          const b = nodeById[e.target];
          if (!a || !b) return null;
          const active = selected && (e.source === selected || e.target === selected);
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? '#0ea5e9' : '#cbd5e1'}
              strokeWidth={active ? 2 : 1}
              strokeOpacity={active ? 0.9 : 0.5}
            />
          );
        })}

        {/* العقد */}
        {nodes.map((n) => {
          const color = TYPE_COLORS[n.type] || TYPE_COLORS.other;
          const isSel = selected === n.id;
          const isHover = hover === n.id;
          const r = isSel || isHover ? 11 : 8;
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              style={{ cursor: 'pointer' }}
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, n.id); }}
              onClick={() => setSelected(n.id)}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
            >
              <circle r={r + 4} fill={color} opacity={isSel ? 0.18 : 0} />
              <circle r={r} fill={color} stroke="#fff" strokeWidth={2} />
              <text
                y={r + 14}
                textAnchor="middle"
                className="fill-foreground"
                style={{ fontSize: 11, fontWeight: 500 }}
              >
                {n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* مفتاح الأنواع */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-2 max-w-[60%]">
        {Object.entries(TYPE_COLORS).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1.5 bg-background/80 backdrop-blur px-2 py-1 rounded-md text-[11px] border border-border">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            {TYPE_LABELS[k]}
          </span>
        ))}
      </div>

      {/* لوحة التفاصيل */}
      {selectedNode && selectedEntity && (
        <div className="absolute top-3 right-3 w-64 bg-card border border-border rounded-xl shadow-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="font-heading font-semibold text-sm">{selectedEntity.name}</div>
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] text-white"
                style={{ background: TYPE_COLORS[selectedEntity.type] || TYPE_COLORS.other }}
              >
                {TYPE_LABELS[selectedEntity.type] || 'أخرى'}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>
          {selectedEntity.aliases?.length > 0 && (
            <div className="text-xs text-muted-foreground mb-2">
              أسماء بديلة: {selectedEntity.aliases.join('، ')}
            </div>
          )}
          <div className="text-xs text-muted-foreground mb-3">
            ذُكر {selectedEntity.mention_count || 0} مرة • {selectedEdges.length} رابط
          </div>
          {selectedEdges.length > 0 && (
            <div className="space-y-1 mb-3 max-h-32 overflow-auto">
              {selectedEdges.slice(0, 5).map((e, i) => {
                const other = e.source === selected ? e.target : e.source;
                const otherEnt = entities.find((x) => x.id === other);
                return (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    <span className="text-foreground font-medium">{e.type}</span> — {otherEnt?.name || '...'}
                  </div>
                );
              })}
            </div>
          )}
          <button
            onClick={() => navigate(`/entities/${selectedEntity.id}`)}
            className="w-full text-xs py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          >
            عرض التفاصيل الكاملة
          </button>
        </div>
      )}
    </div>
  );
}