import { useState, useEffect, useRef } from 'react';

const TYPE_COLORS = {
  person: '#8b5cf6', organization: '#3b82f6', phone: '#10b981', email: '#06b6d4',
  location: '#f59e0b', account: '#f43f5e', date: '#64748b', event: '#f97316', other: '#94a3b8'
};
const CLUSTER_PALETTE = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#f43f5e','#06b6d4','#ec4899','#84cc16','#6366f1','#f97316'];
const HEIGHT = 460;
const hashStr = (s) => { let h = 0; for (let i = 0; i < String(s).length; i++) { h = (h * 31 + String(s).charCodeAt(i)) | 0; } return h; };
const clusterColor = (id) => CLUSTER_PALETTE[Math.abs(hashStr(id)) % CLUSTER_PALETTE.length];

export default function GraphCanvas({ nodes, edges, focusId, onNodeClick, clusterMap, centralityMap, companyIds }) {
  const maxCentrality = centralityMap ? Math.max(1, ...nodes.map((n) => centralityMap[n.id] || 0)) : 1;
  const svgRef = useRef(null);
  const posRef = useRef({});
  const simRef = useRef({ idMap: {}, nodes: [] });
  const [, setRender] = useState(0);
  const [hover, setHover] = useState(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const width = svg.clientWidth || 800;
    const simNodes = nodes.map((n) => {
      const p = posRef.current[n.id];
      return {
        ...n,
        x: p ? p.x : width / 2 + (Math.random() - 0.5) * 260,
        y: p ? p.y : HEIGHT / 2 + (Math.random() - 0.5) * 260,
        vx: 0, vy: 0,
        fixed: !!p
      };
    });
    const idMap = {};
    simNodes.forEach((n) => { idMap[n.id] = n; });
    simRef.current = { idMap, nodes: simNodes };
    let frame = 0;
    let raf;
    const tick = () => {
      const N = simNodes;
      for (let i = 0; i < N.length; i++) {
        for (let j = i + 1; j < N.length; j++) {
          let dx = N[i].x - N[j].x;
          let dy = N[i].y - N[j].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          const d = Math.sqrt(d2);
          const f = 5000 / d2;
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          N[i].vx += fx; N[i].vy += fy;
          N[j].vx -= fx; N[j].vy -= fy;
        }
      }
      for (const e of edges) {
        const a = idMap[e.source];
        const b = idMap[e.target];
        if (!a || !b) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 130) * 0.015;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      for (const n of N) {
        n.vx += (width / 2 - n.x) * 0.004;
        n.vy += (HEIGHT / 2 - n.y) * 0.004;
        n.vx *= 0.82;
        n.vy *= 0.82;
        if (!n.fixed) { n.x += n.vx; n.y += n.vy; }
        n.x = Math.max(26, Math.min(width - 26, n.x));
        n.y = Math.max(26, Math.min(HEIGHT - 26, n.y));
        posRef.current[n.id] = { x: n.x, y: n.y };
      }
      frame++;
      setRender((r) => r + 1);
      if (frame < 200) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [nodes, edges]);

  const onPointerDown = (e, id) => {
    e.stopPropagation();
    const p = posRef.current[id];
    if (!p) return;
    dragRef.current = {
      id, startX: e.clientX, startY: e.clientY, moved: false,
      offsetX: e.clientX - p.x, offsetY: e.clientY - p.y
    };
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (Math.abs(e.clientX - d.startX) > 4 || Math.abs(e.clientY - d.startY) > 4) d.moved = true;
    const node = simRef.current.idMap[d.id];
    if (node) { node.x = x; node.y = y; node.fixed = true; }
    posRef.current[d.id] = { x, y };
    setRender((r) => r + 1);
  };
  const onPointerUp = () => {
    const d = dragRef.current;
    if (d && !d.moved) onNodeClick && onNodeClick(d.id);
    dragRef.current = null;
  };

  const radius = (n) => {
    if (centralityMap) return Math.min(22, 7 + ((centralityMap[n.id] || 0) / maxCentrality) * 15);
    const base = Math.min(20, 7 + (n.degree || 0) * 0.5);
    return (companyIds && companyIds.has(n.id)) ? base + 3 : base;
  };
  const isConnected = (id) => edges.some((e) =>
    (e.source === focusId && e.target === id) || (e.target === focusId && e.source === id));

  return (
    <div className="relative w-full rounded-lg border border-border bg-accent/20 overflow-hidden">
      <svg
        ref={svgRef}
        width="100%"
        height={HEIGHT}
        className="touch-none select-none"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {edges.map((e, i) => {
          const a = posRef.current[e.source];
          const b = posRef.current[e.target];
          if (!a || !b) return null;
          const active = focusId && (e.source === focusId || e.target === focusId);
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={active ? '#3b82f6' : '#cbd5e1'}
              strokeWidth={active ? 2 : 1}
              strokeOpacity={focusId && !active ? 0.25 : 0.7}
              onMouseEnter={() => setHover({ type: 'edge', data: e, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })}
              onMouseLeave={() => setHover(null)}
            />
          );
        })}
        {nodes.map((n) => {
          const p = posRef.current[n.id];
          if (!p) return null;
          const r = radius(n);
          const isFocus = n.id === focusId;
          const dim = focusId && !isFocus && !isConnected(n.id);
          return (
            <g
              key={n.id}
              transform={`translate(${p.x},${p.y})`}
              onPointerDown={(e) => onPointerDown(e, n.id)}
              onMouseEnter={() => setHover({ type: 'node', data: n, x: p.x, y: p.y - r })}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={r}
                fill={companyIds && companyIds.has(n.id) ? '#8b1a1a' : (clusterMap && clusterMap[n.id] != null ? clusterColor(clusterMap[n.id]) : (TYPE_COLORS[n.type] || '#94a3b8'))}
                stroke={isFocus ? '#1e293b' : (companyIds && companyIds.has(n.id) ? '#5b0f0f' : '#fff')}
                strokeWidth={isFocus ? 3 : (companyIds && companyIds.has(n.id) ? 2.5 : 1.5)}
                opacity={dim ? 0.35 : 1}
              />
              {r > 11 && (
                <text textAnchor="middle" y={4} fontSize={9} fill="#fff" className="pointer-events-none">
                  {n.degree || 0}
                </text>
              )}
              <text textAnchor="middle" y={r + 12} fontSize={10} fill="#475569" className="pointer-events-none">
                {(n.name || '').slice(0, 16)}
              </text>
            </g>
          );
        })}
        {hover && (
          <foreignObject x={hover.x - 80} y={hover.y - 44} width={160} height={44} className="pointer-events-none">
            <div className="bg-popover border border-border rounded-md px-2 py-1 text-[11px] shadow-md text-center">
              {hover.type === 'node' ? (
                <div>
                  <div className="font-medium truncate">{hover.data.name}</div>
                  <div className="text-muted-foreground">{hover.data.degree || 0} رابط</div>
                </div>
              ) : (
                <div className="font-medium truncate">{hover.data.rel || 'مرتبط'}</div>
              )}
            </div>
          </foreignObject>
        )}
      </svg>
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          لا توجد عقد. اختر كياناً من المستكشف بالأسفل لبدء التوسيع.
        </div>
      )}
    </div>
  );
}