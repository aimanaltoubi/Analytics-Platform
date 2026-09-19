import { useState, useRef, useMemo } from 'react';
import { Pencil, Link2, Trash2, Eraser, Search, Plus } from 'lucide-react';

const PALETTE = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#ec4899', '#64748b'];
const TYPE_COLORS = {
  person: '#3b82f6', organization: '#8b5cf6', company: '#0ea5e9', phone: '#f59e0b', email: '#10b981',
  location: '#ef4444', account: '#06b6d4', date: '#64748b', event: '#ec4899', other: '#94a3b8'
};
const TYPE_LABELS = {
  person: 'فرد', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};
let _id = 0;
const uid = () => `m${Date.now()}_${_id++}`;

export default function ManualNetworkCanvas({ entities = [], allEntities = [], onAddToWorkspace, height = 560 }) {
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [mode, setMode] = useState('select');
  const [dragId, setDragId] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [hover, setHover] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [paletteSearch, setPaletteSearch] = useState('');

  const toLocal = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const placedEntityIds = new Set(nodes.filter((n) => n.entity_id).map((n) => n.entity_id));
  const workspaceIds = new Set(entities.map((e) => e.id));

  // سجل النظام الكامل متاح للسحب — ما عدا الموضع على اللوحة بالفعل
  const registry = useMemo(() => {
    const base = (allEntities.length ? allEntities : entities);
    const q = paletteSearch.trim().toLowerCase();
    return base
      .filter((e) => !placedEntityIds.has(e.id))
      .filter((e) => !q || (e.name || '').toLowerCase().includes(q) || (e.aliases || []).some((a) => (a || '').toLowerCase().includes(q)))
      .slice(0, 120);
  }, [allEntities, entities, paletteSearch, placedEntityIds]);

  const resolveEntity = (eid) => (allEntities.length ? allEntities : entities).find((x) => x.id === eid);

  const placeNode = (ent, x, y) => {
    const w = svgRef.current?.clientWidth || 800;
    const px = x ?? (w / 2 + (Math.random() - 0.5) * 140);
    const py = y ?? (height / 2 + (Math.random() - 0.5) * 140);
    setNodes((prev) => [
      ...prev,
      { id: uid(), entity_id: ent.id, label: ent.name, x: px, y: py, color: TYPE_COLORS[ent.type] || TYPE_COLORS.other, type: ent.type }
    ]);
  };

  const onDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);
    const eid = e.dataTransfer.getData('text/entity');
    if (!eid) return;
    const ent = resolveEntity(eid);
    if (!ent || placedEntityIds.has(ent.id)) return;
    const { x, y } = toLocal(e);
    // أضف إلى مساحة العمل إن لم يكن موجوداً
    if (!workspaceIds.has(ent.id) && onAddToWorkspace) {
      await onAddToWorkspace(ent.id);
    }
    placeNode(ent, x, y);
  };

  const addByClick = async (ent) => {
    if (placedEntityIds.has(ent.id)) return;
    if (!workspaceIds.has(ent.id) && onAddToWorkspace) {
      await onAddToWorkspace(ent.id);
    }
    placeNode(ent);
  };

  const addCustomNode = () => {
    const label = (customLabel || '').trim();
    if (!label) return;
    const w = svgRef.current?.clientWidth || 800;
    setNodes((prev) => [
      ...prev,
      { id: uid(), label, x: w / 2 + (Math.random() - 0.5) * 120, y: height / 2 + (Math.random() - 0.5) * 120, color: PALETTE[prev.length % PALETTE.length] }
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
      if (!connectFrom) setConnectFrom(n.id);
      else if (connectFrom !== n.id) {
        const label = window.prompt('نوع العلاقة (اختياري):') || '';
        setEdges((prev) => [...prev, { id: uid(), from: connectFrom, to: n.id, label: label.trim() }]);
        setConnectFrom(null);
      } else setConnectFrom(null);
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
    if (window.confirm('مسح كل العقد والروابط من اللوحة؟')) { setNodes([]); setEdges([]); setConnectFrom(null); }
  };

  const nodeById = (id) => nodes.find((n) => n.id === id);

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
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <Pencil className="w-4 h-4" /> لوحة بناء الشبكة
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">اسحب الكيانات من سجل النظام إلى اللوحة — تُضاف تلقائياً إلى مساحة العمل.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {modeBtn('select', Pencil, 'تحريك')}
          {modeBtn('connect', Link2, 'ربط')}
          {modeBtn('delete', Trash2, 'حذف')}
          <button onClick={clearAll} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-background text-foreground border border-border hover:bg-accent">
            <Eraser className="w-3.5 h-3.5" /> مسح اللوحة
          </button>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground mb-2">
        {mode === 'select' && 'اسحب من السجل إلى اللوحة. حرّك العقد بالسحب. انقر مزدوجاً لتعديل الاسم.'}
        {mode === 'connect' && (connectFrom ? 'اختر العقدة الثانية لإنشاء الرابط.' : 'اختر العقدة الأولى.' )}
        {mode === 'delete' && 'انقر على عقدة أو رابط لحذفه من اللوحة.'}
      </div>

      <div className="flex gap-4">
        {/* سجل الكيانات */}
        <div className="w-60 shrink-0 rounded-lg border border-border bg-background p-2.5 flex flex-col">
          <div className="flex items-center justify-between px-1 mb-2">
            <span className="text-[11px] font-semibold text-muted-foreground">سجل الكيانات</span>
            <span className="text-[10px] text-muted-foreground">{registry.length}</span>
          </div>
          <div className="relative mb-2">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              placeholder="بحث في السجل..."
              className="w-full pr-7 pl-2 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="space-y-1.5 flex-1 overflow-auto" style={{ maxHeight: 420 }}>
            {registry.length === 0 ? (
              <p className="text-xs text-muted-foreground px-1 py-4 text-center">{paletteSearch ? 'لا توجد نتائج' : 'كل الكيانات موضوعة على اللوحة'}</p>
            ) : (
              registry.map((e) => (
                <div
                  key={e.id}
                  draggable
                  onDragStart={(ev) => { ev.dataTransfer.setData('text/entity', e.id); ev.dataTransfer.effectAllowed = 'copy'; }}
                  onDoubleClick={() => addByClick(e)}
                  className="group flex items-center gap-2 rounded-md bg-card border border-border px-2.5 py-2 text-sm cursor-grab hover:border-primary/60 hover:bg-accent/40 active:cursor-grabbing"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TYPE_COLORS[e.type] || TYPE_COLORS.other }} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium leading-tight">{e.name}</div>
                    <div className="text-[10px] text-muted-foreground">{TYPE_LABELS[e.type] || e.type} • {e.mention_count || 0} ذكر</div>
                  </div>
                  <Plus className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                </div>
              ))
            )}
          </div>
          <div className="mt-2 pt-2 border-t border-border flex gap-1.5">
            <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="عقدة مخصصة" className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={addCustomNode} disabled={!customLabel.trim()} className="shrink-0 rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs disabled:opacity-50">إضافة</button>
          </div>
        </div>

        {/* اللوحة */}
        <div className="flex-1 min-w-0">
          <svg
            ref={svgRef}
            width="100%"
            height={height}
            className={`rounded-lg border-2 bg-white cursor-default select-none transition-colors ${dragOver ? 'border-primary border-dashed bg-primary/5' : 'border-border'}`}
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

            {nodes.length === 0 && (
              <text x="50%" y="50%" textAnchor="middle" style={{ fontSize: 13, fill: '#94a3b8' }}>
                اسحب الكيانات هنا لبناء الشبكة
              </text>
            )}
          </svg>
        </div>
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">
        {nodes.length} عقدة • {edges.length} رابط • {entities.length} في مساحة العمل
      </div>
    </div>
  );
}