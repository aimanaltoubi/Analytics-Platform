import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';
import { Image } from '@/components/ui/image';

const SUGGESTED_ATTRS = {
  person: [
    'الجنسية', 'تاريخ الميلاد', 'مكان الميلاد', 'الجنس', 'الرقم الوطني / رقم الهوية',
    'رقم الجواز', 'المهنة', 'الجهة العاملة', 'العنوان', 'رقم الهاتف', 'البريد الإلكتروني',
    'الحالة الاجتماعية', 'اللغات', 'الوصف الجسدي', 'رقم رخصة القيادة', 'آخر معروف'
  ],
  organization: [
    'الاسم القانوني', 'رقم التسجيل', 'الرقم الضريبي', 'دولة التأسيس', 'تاريخ التأسيس',
    'الشكل القانوني', 'القطاع / المجال', 'العنوان', 'رقم الهاتف', 'البريد الإلكتروني',
    'الموقع الإلكتروني', 'رقم الترخيص', 'المسؤولون', 'المالك المستفيد', 'عدد الموظفين'
  ],
  phone: ['المالك', 'المشغل', 'المنطقة', 'نوع الخدمة'],
  email: ['المالك', 'المزود', 'الاستخدام'],
  location: ['الدولة', 'المدينة', 'الإحداثيات', 'النوع'],
  account: ['البنك', 'العملة', 'المالك', 'رقم الحساب', 'تاريخ الفتح'],
  other: ['ملاحظة', 'المصدر', 'التاريخ']
};

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

function relColor(type) {
  if (!type) return '#94a3b8';
  let h = 0;
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 55%)`;
}

export default function NetworkGraph({ entities = [], connections = [], height = 560, onEntityUpdated }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const svgRef = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [hoverEdge, setHoverEdge] = useState(null);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldInputs, setFieldInputs] = useState({});
  const [uploading, setUploading] = useState(false);
  const dims = useRef({ w: 800, h: height });

  // درجة كل كيان (عدد الروابط)
  const degreeMap = useMemo(() => {
    const m = {};
    connections.forEach((c) => {
      m[c.source_entity_id] = (m[c.source_entity_id] || 0) + 1;
      m[c.target_entity_id] = (m[c.target_entity_id] || 0) + 1;
    });
    return m;
  }, [connections]);

  // أنواع العلاقات الموجودة
  const relTypes = useMemo(() => {
    const set = new Set();
    connections.forEach((c) => set.add(c.relationship_type || 'غير محدد'));
    return Array.from(set);
  }, [connections]);

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
        vy: 0
      };
    });
    setNodes(Object.values(byId));
  }, [entities, height]);

  const edges = useMemo(() => {
    return connections
      .map((c) => ({
        source: c.source_entity_id,
        target: c.target_entity_id,
        type: c.relationship_type,
        evidence: c.evidence
      }))
      .filter((e) => e.source && e.target);
  }, [connections]);

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
        for (const e of edges) {
          const a = map[e.source] || arr.find((n) => n.id === e.source);
          const b = map[e.target] || arr.find((n) => n.id === e.target);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 130) * 0.04;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          const na = arr.find((n) => n.id === a.id);
          const nb = arr.find((n) => n.id === b.id);
          if (na) { na.vx += fx; na.vy += fy; }
          if (nb) { nb.vx -= fx; nb.vy -= fy; }
        }
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
    setTimeout(() => cancelAnimationFrame(raf), 2500);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line
  }, [nodes.length, edges.length]);

  const nodeById = useMemo(() => {
    const m = {};
    nodes.forEach((n) => (m[n.id] = n));
    return m;
  }, [nodes]);

  const entityById = useMemo(() => {
    const m = {};
    entities.forEach((e) => (m[e.id] = e));
    return m;
  }, [entities]);

  const handlePointerDown = (e, id) => { setDragId(id); };
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

  const saveAttr = async (key, val) => {
    const k = (key || '').trim(), v = (val || '').trim();
    if (!k || !v || !selectedEntity) return;
    setSaving(true);
    const attrs = { ...(selectedEntity.attributes || {}) };
    attrs[k] = v;
    try {
      await localClient.entities.Entity.update(selectedEntity.id, { attributes: attrs });
      const merged = { ...selectedEntity, attributes: attrs };
      if (onEntityUpdated) onEntityUpdated(selectedEntity.id, merged);
      toast({ title: 'تم حفظ المعلومة' });
    } catch (e) {
      toast({ title: 'تعذّر الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const suggestedFields = selectedEntity ? (SUGGESTED_ATTRS[selectedEntity.type] || SUGGESTED_ATTRS.other) : [];
  const extraAttrs = selectedEntity?.attributes ? Object.entries(selectedEntity.attributes).filter(([k]) => !suggestedFields.includes(k)) : [];

  const deleteAttr = async (k) => {
    if (!selectedEntity) return;
    const attrs = { ...(selectedEntity.attributes || {}) };
    delete attrs[k];
    try {
      await localClient.entities.Entity.update(selectedEntity.id, { attributes: attrs });
      if (onEntityUpdated) onEntityUpdated(selectedEntity.id, { ...selectedEntity, attributes: attrs });
      toast({ title: 'تم حذف المعلومة' });
    } catch (e) {
      toast({ title: 'تعذّر الحذف', description: e.message, variant: 'destructive' });
    }
  };

  const onPhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedEntity) return;
    setUploading(true);
    try {
      const { file_url } = await localClient.integrations.Core.UploadFile({ file });
      await localClient.entities.Entity.update(selectedEntity.id, { photo_url: file_url });
      const merged = { ...selectedEntity, photo_url: file_url };
      if (onEntityUpdated) onEntityUpdated(selectedEntity.id, merged);
      toast({ title: 'تم حفظ الصورة' });
    } catch (err) {
      toast({ title: 'تعذّر رفع الصورة', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const nodeRadius = (id) => {
    const deg = degreeMap[id] || 0;
    return 7 + Math.min(deg * 1.6, 10);
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        className="rounded-xl border border-border bg-[radial-gradient(circle_at_30%_20%,#eff6ff,#f8fafc_55%,#eef2f7)]"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={(e) => { if (e.target === svgRef.current) { setSelectedEdge(null); setSelected(null); } }}
      >
        <defs>
          <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {relTypes.map((t) => (
            <marker
              key={t}
              id={`arrow-${t}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={relColor(t)} />
            </marker>
          ))}
        </defs>

        {/* الحواف */}
        {edges.map((e, i) => {
          const a = nodeById[e.source];
          const b = nodeById[e.target];
          if (!a || !b) return null;
          const active = selected && (e.source === selected || e.target === selected);
          const isEdgeSel = selectedEdge && selectedEdge.source === e.source && selectedEdge.target === e.target && selectedEdge.type === e.type;
          const isEdgeHover = hoverEdge && hoverEdge.source === e.source && hoverEdge.target === e.target;
          const color = relColor(e.type);
          const hit = isEdgeSel || isEdgeHover;
          return (
            <line
              key={i}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={hit ? color : active ? color : '#cbd5e1'}
              strokeWidth={hit ? 2.8 : active ? 2.2 : 1.2}
              strokeOpacity={hit ? 1 : active ? 0.9 : 0.5}
              markerEnd={`url(#arrow-${e.type})`}
              style={{ cursor: 'pointer' }}
              onClick={(ev) => { ev.stopPropagation(); setSelectedEdge(e); }}
              onMouseEnter={() => setHoverEdge(e)}
              onMouseLeave={() => setHoverEdge(null)}
            />
          );
        })}

        {/* تسمية العلاقة عند النقر أو التحويم */}
        {(() => {
          const shown = selectedEdge || hoverEdge;
          if (!shown) return null;
          const a = nodeById[shown.source];
          const b = nodeById[shown.target];
          if (!a || !b) return null;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const isSel = !!selectedEdge;
          const color = relColor(shown.type);
          return (
            <g pointerEvents="none">
              <rect x={mx - 32} y={my - 11} width="64" height="20" rx="10" fill="#fff" stroke={color} strokeWidth={isSel ? 1.5 : 1} />
              <text x={mx} y={my + 4} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700 }} fill={color}>
                {(shown.type || 'رابط').length > 16 ? (shown.type || 'رابط').slice(0, 15) + '…' : (shown.type || 'رابط')}
              </text>
            </g>
          );
        })()}

        {/* العقد */}
        {nodes.map((n) => {
          const color = TYPE_COLORS[n.type] || TYPE_COLORS.other;
          const isSel = selected === n.id;
          const isHover = hover === n.id;
          const r = nodeRadius(n.id);
          const dispR = isSel || isHover ? r + 3 : r;
          const photo = entityById[n.id]?.photo_url;
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
              <circle r={dispR + 6} fill={color} opacity={isSel ? 0.22 : isHover ? 0.14 : 0.08} />
              {photo ? (
                <>
                  <clipPath id={`clip-${n.id}`}><circle r={dispR} /></clipPath>
                  <image
                    href={photo}
                    x={-dispR}
                    y={-dispR}
                    width={dispR * 2}
                    height={dispR * 2}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#clip-${n.id})`}
                  />
                  <circle r={dispR} fill="none" stroke="#fff" strokeWidth={2} filter={isSel || isHover ? 'url(#nodeGlow)' : undefined} />
                </>
              ) : (
                <>
                  <circle
                    r={dispR}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={2}
                    filter={isSel || isHover ? 'url(#nodeGlow)' : undefined}
                  />
                  <circle r={dispR - 3} fill="#fff" opacity={0.25} />
                </>
              )}
              <text
                y={dispR + 14}
                textAnchor="middle"
                className="fill-foreground"
                style={{ fontSize: 11, fontWeight: 600, paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3, strokeOpacity: 0.7 }}
              >
                {n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* مفتاح أنواع الكيانات */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[55%]">
        {Object.entries(TYPE_COLORS).map(([k, c]) => (
          <span key={k} className="inline-flex items-center gap-1 bg-background/85 backdrop-blur px-2 py-1 rounded-md text-[11px] border border-border">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
            {TYPE_LABELS[k]}
          </span>
        ))}
      </div>

      {/* مفتاح أنواع العلاقات */}
      {relTypes.length > 0 && (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-1.5 max-w-[60%]">
          {relTypes.slice(0, 6).map((t) => (
            <span key={t} className="inline-flex items-center gap-1 bg-background/85 backdrop-blur px-2 py-1 rounded-md text-[11px] border border-border">
              <span className="w-3 h-0.5 rounded-full" style={{ background: relColor(t) }} />
              {t}
            </span>
          ))}
        </div>
      )}

      {/* لوحة التفاصيل */}
      {selectedNode && selectedEntity && (
        <div className="absolute top-3 right-3 w-72 bg-card border border-border rounded-xl shadow-lg p-4 max-h-[calc(100%-1.5rem)] overflow-auto">
          <div className="flex items-start justify-between mb-2">
            <div className="min-w-0">
              <div className="font-heading font-semibold text-sm truncate">{selectedEntity.name}</div>
              <span
                className="inline-block mt-1 px-2 py-0.5 rounded-full text-[11px] text-white"
                style={{ background: TYPE_COLORS[selectedEntity.type] || TYPE_COLORS.other }}
              >
                {TYPE_LABELS[selectedEntity.type] || 'أخرى'}
              </span>
            </div>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
          </div>

          <div className="flex items-center gap-3 mb-3">
            {selectedEntity.photo_url ? (
              <Image
                src={selectedEntity.photo_url}
                alt={selectedEntity.name}
                className="w-14 h-14 rounded-full border-2 border-border shrink-0"
                fittingType="fill"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center text-muted-foreground text-xl font-bold border-2 border-border shrink-0">
                {selectedEntity.name?.charAt(0) || '؟'}
              </div>
            )}
            <label className={`inline-block cursor-pointer text-xs px-2.5 py-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
              {uploading ? 'جارٍ الرفع...' : selectedEntity.photo_url ? 'تغيير الصورة' : 'إضافة صورة'}
              <input type="file" accept="image/*" className="hidden" onChange={onPhotoChange} disabled={uploading} />
            </label>
          </div>
          {selectedEntity.aliases?.length > 0 && (
            <div className="text-xs text-muted-foreground mb-2">
              أسماء بديلة: {selectedEntity.aliases.join('، ')}
            </div>
          )}
          <div className="text-xs text-muted-foreground mb-2">
            ذُكر {selectedEntity.mention_count || 0} مرة • {selectedEdges.length} رابط • درجة {degreeMap[selectedEntity.id] || 0}
          </div>

          <div className="mb-3 rounded-lg bg-accent/40 p-2.5">
            <div className="text-[11px] font-medium text-muted-foreground mb-1.5">المعلومات</div>
            <div className="space-y-1.5 mb-2 max-h-48 overflow-auto">
              {suggestedFields.map((field) => {
                const val = selectedEntity.attributes?.[field];
                if (val !== undefined && val !== '') {
                  return (
                    <div key={field} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-muted-foreground">{field}: </span>
                        <span className="font-medium break-all">{String(val)}</span>
                      </div>
                      <button onClick={() => deleteAttr(field)} className="text-muted-foreground hover:text-destructive shrink-0 leading-none">×</button>
                    </div>
                  );
                }
                return (
                  <div key={field} className="text-xs">
                    <div className="text-muted-foreground mb-1 flex items-center gap-1.5">
                      {field} <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">غير متوفر</span>
                    </div>
                    <div className="flex gap-1">
                      <input
                        value={fieldInputs[field] || ''}
                        onChange={(e) => setFieldInputs((p) => ({ ...p, [field]: e.target.value }))}
                        placeholder={`أضف ${field}`}
                        className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <button
                        onClick={() => { saveAttr(field, fieldInputs[field] || ''); setFieldInputs((p) => ({ ...p, [field]: '' })); }}
                        disabled={saving || !(fieldInputs[field] || '').trim()}
                        className="shrink-0 rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs disabled:opacity-50"
                      >
                        {saving ? '...' : 'إضافة'}
                      </button>
                    </div>
                  </div>
                );
              })}
              {extraAttrs.map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-muted-foreground">{k}: </span>
                    <span className="font-medium break-all">{String(v)}</span>
                  </div>
                  <button onClick={() => deleteAttr(k)} className="text-muted-foreground hover:text-destructive shrink-0 leading-none">×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-1.5 pt-2 border-t border-border/50">
              <input
                list="attr-suggestions"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="حقل مخصص"
                className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="القيمة"
                className="flex-1 min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <button
                onClick={() => { saveAttr(newKey, newValue); setNewKey(''); setNewValue(''); }}
                disabled={saving || !newKey.trim() || !newValue.trim()}
                className="shrink-0 rounded-md bg-primary text-primary-foreground px-2 py-1 text-xs disabled:opacity-50"
              >
                {saving ? '...' : 'إضافة'}
              </button>
            </div>
            <datalist id="attr-suggestions">
              {suggestedFields.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </div>

          {selectedEdges.length > 0 && (
            <div className="space-y-1 mb-3">
              <div className="text-[11px] font-medium text-muted-foreground">الروابط</div>
              {selectedEdges.slice(0, 6).map((e, i) => {
                const other = e.source === selected ? e.target : e.source;
                const otherEnt = entities.find((x) => x.id === other);
                return (
                  <div key={i} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: relColor(e.type) }} />
                    <span className="text-foreground font-medium">{e.type}</span>
                    <span className="text-muted-foreground">←</span>
                    <span className="text-muted-foreground truncate">{otherEnt?.name || '...'}</span>
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