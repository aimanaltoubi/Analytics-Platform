import { useState, useRef, useCallback } from 'react';
import { Pencil, Link2, Trash2, Eraser } from 'lucide-react';

const PALETTE = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const TYPE_COLORS = {
  person: '#3b82f6', organization: '#8b5cf6', phone: '#f59e0b', email: '#10b981',
  location: '#ef4444', account: '#06b6d4', date: '#64748b', event: '#ec4899', other: '#94a3b8'
};
let _id = 0;
const uid = () => `m${Date.now()}_${_id++}`;

export default function ManualNetworkCanvas({ entities = [], height = 540 }) {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [mode, setMode] = useState('select'); // select | connect | delete
  const [dragId, setDragId] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [hover, setHover] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [customLabel, setCustomLabel] = useState('');

  const toLocal = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const placedIds = new Set(nodes.filter((n) => n.entity_id).map((n) => n.entity_id));
  const availableEntities = entities.filter((e) => !placedIds.has(e.id));

  const addEntityNode = (ent, x, y) => {
    const w = svgRef.current?.clientWidth || 800;
    const px = x ?? (w / 2 + (Math.random() - 0.5) * 120);
    const py = y ?? (height / 2 + (Math.random() - 0.5) * 120);
    setNodes((prev) => [
      ...prev,
      { id: uid(), entity_id: ent.id, label: ent.name, x: px, y: py, color: TYPE_COLORS[ent.type] || TYPE_COLORS.other }
    ]);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const eid = e.dataTransfer.getData('text/entity');
    if (!eid) return;
    const ent = entities.find((x) => x.id === eid);
    if (!ent || placedIds.has(ent.id)) return;
    const { x, y } = toLocal(e);
    addEntityNode(ent, x, y);
  };

  const addCustomNode = () => {
    const label = (customLabel || '').trim();
    if (!label) return;
    const w = svgRef.current?.clientWidth || 800;
    setNodes((prev) => [
      ...prev,
      {
        id: uid(),
        label,
        x: w / 2 + (Math.random() - 0.5) * 120,
        y: height / 2 + (Math.random() - 0.5) * 120,
        color: PALETTE[prev.length % PALETTE.length]
      }
    ]);
    setCustomLabel('');
  };

  const onCanvasClick = (e) => {
    if (e.target !== svgRef.current) return;
    if (mode === 'connect') setConnectFrom(null);
  };

  const onNodePointerDown = (e, n) => {
    e.stopPropagation();
    if (mode === 'delete') {
      setNodes((prev) => prev.filter((x) => x.id !== n.id));
      setEdges((prev) => prev.filter((ed) => ed.from !== n.id && ed.to !== n.id));
      return;
    }
    if (mode === 'connect') {
      if (!connectFrom) {
        setConnectFrom(n.id);
      } else if (connectFrom !== n.id) {
        const label = window.prompt('نوع العلاقة (اختياري):') || '';
        setEdges((prev) => [...prev, { id: uid(), from: connectFrom, to: n.id, label: label.trim() }]);
        setConnectFrom(null);
      } else {
        setConnectFrom(null);
      }
      return;
    }
    setDragId(n.id);
  };

  const onPointerMove = (e) => {
    if (!dragId) return;
    const { x, y } = toLocal(e);
    setNodes((prev) => prev.map((n) => (n.id === dragId ? { ...n, x, y } : n)));
  };

  const onPointerUp = () => setDragId(null);

  const onEdgeClick = (e, ed) => {
    e.stopPropagation();
    if (mode === 'delete') setEdges((prev) => prev.filter((x) => x.id !== ed.id));
  };

  const onNodeDouble = (n) => {
    const label = window.prompt('تعديل الاسم:', n.label);
    if (label && label.trim()) setNodes((prev) => prev.map((x) => (x.id === n.id ? { ...x, label: label.trim() } : x)));
  };

  const clearAll = () => {
    if (window.confirm('مسح كل العقد والروابط؟')) { setNodes([]); setEdges([]); setConnectFrom(null); }
  };

  const nodeById = useCallback((id) => nodes.find((n) => n.id === id), [nodes]);

  const modeBtn = (m, icon, label) => {
    const Icon = icon;
    const active = mode === m;
    return (
      <button
        onClick={() => { setMode(m); setConnectFrom(null); }}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
          active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:bg-accent'
        }`}
      >
        <Icon className="w-3.5 h-3.5" /> {label}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Pencil className="w-4 h-4" /> لوحة رسم حرّة
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {modeBtn('select', Pencil, 'تحريك')}
          {modeBtn('connect', Link2, 'ربط')}
          {modeBtn('delete', Trash2, 'حذف')}
          <button onClick={clearAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-background text-foreground border border-border hover:bg-accent">
            <Eraser className="w-3.5 h-3.5" /> مسح الكل
          </button>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground mb-2">
        {mode === 'select' && 'اسحب الكيانات من القائمة إلى اللوحة، ثم حرّك العقد أو ارسم الروابط. انقر مزدوجاً لتعديل الاسم.'}
        {mode === 'connect' && (connectFrom ? 'اختر العقدة الثانية لإنشاء الرابط.' : 'اختر العقدة الأولى.' )}
        {mode === 'delete' && 'انقر على عقدة أو رابط لحذفه.'}
      </div>

      <div className="flex gap-4">
        <div className="w-56 shrink-0 rounded-lg border border-border bg-background p-2.5 flex flex-col">
          <div className="text-[11px] font-medium text-muted-foreground mb-2 px-1">اسحب الكيانات إلى اللوحة</div>
          <div className="space-y-1.5 flex-1 overflow-auto max-h-[460px]">
            {availableEntities.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-3 text-center">كل الكيانات موضوعة على اللوحة.</p>
            ) : (
              availableEntities.map((e) => (
                <div
                  key={e.id}
                  draggable
                  onDragStart={(ev) => { ev.dataTransfer.setData('text/entity', e.id); ev.dataTransfer.effectAllowed = 'copy'; }}
                  className="flex items-center gap-2 rounded-md bg-card border border-border px-2.5 py-2 text-sm cursor-grab hover:border-primary/60 hover:bg-accent/40"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[e.type] || TYPE_COLORS.other }} />
                  <span className="truncate">{e.name}</span>
                </div>
              ))
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border flex gap-1.5">
            <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="عقدة مخصصة" className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={addCustomNode} disabled={!customLabel.trim()} className="shrink-0 rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs disabled:opacity-50">إضافة</button>
          </div>
        </div>

        <div className="flex-1 min-w-0">
        <svg
        ref={svgRef}
        width="100%"
        height={height}
        className={`rounded-lg border-2 bg-white cursor-default select-none ${dragOver ? 'border-primary border-dashed' : 'border-border'}`}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={onCanvasClick}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <defs>
          <marker id="manualArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
          </marker>
        </defs>

        {edges.map((ed) => {
          const a = nodeById(ed.from);
          const b = nodeById(ed.to);
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          return (
            <g key={ed.id} style={{ cursor: mode === 'delete' ? 'pointer' : 'default' }} onClick={(e) => onEdgeClick(e, ed)}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#94a3b8" strokeWidth={1.6} markerEnd="url(#manualArrow)" />
              {ed.label && (
                <g pointerEvents="none">
                  <rect x={mx - (ed.label.length * 3.2)} y={my - 9} width={ed.label.length * 6.4} height={18} rx={9} fill="#fff" stroke="#cbd5e1" />
                  <text x={mx} y={my + 4} textAnchor="middle" style={{ fontSize: 10, fontWeight: 600 }} fill="#475569">{ed.label}</text>
                </g>
              )}
            </g>
          );
        })}

        {nodes.map((n) => {
          const isFrom = connectFrom === n.id;
          const w = Math.max(n.label.length * 7 + 24, 56);
          return (
            <g
              key={n.id}
              transform={`translate(${n.x},${n.y})`}
              style={{ cursor: mode === 'select' ? 'grab' : 'pointer' }}
              onPointerDown={(e) => onNodePointerDown(e, n)}
              onDoubleClick={() => onNodeDouble(n)}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover(null)}
            >
              {isFrom && <circle r={26} fill={n.color} opacity={0.18} />}
              <rect x={-w / 2} y={-15} width={w} height={30} rx={15} fill={n.color} stroke="#fff" strokeWidth={2} opacity={hover === n.id ? 1 : 0.92} />
              <text textAnchor="middle" y={5} style={{ fontSize: 12, fontWeight: 600, paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeOpacity: 0.6 }} fill="#fff">
                {n.label.length > 22 ? n.label.slice(0, 21) + '…' : n.label}
              </text>
            </g>
          );
        })}
      </svg>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">
        {nodes.length} عقدة • {edges.length} رابط
      </div>
    </div>
  );
}