import { useState, useEffect, useRef } from 'react';
import { FileDown, Loader2, Users, Share2, FileText, Flag, AlertTriangle, Network as NetworkIcon, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  person: 'شخص', organization: 'منظمة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

const th = { border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 600 };
const td = { border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' };

export default function Report() {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const [ents, conns, docs] = await Promise.all([
          base44.entities.Entity.list('-mention_count', 1000),
          base44.entities.Connection.list('-created_date', 5000),
          base44.entities.Document.list('-created_date', 500)
        ]);
        setEntities(ents);
        setConnections(conns);
        setDocuments(docs);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const highRisk = entities.filter((e) => (e.risk_score || 0) >= 70).length;
  const watchlistCount = entities.filter((e) => e.watchlist).length;
  const typeCounts = {};
  entities.forEach((e) => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
  const relCounts = {};
  connections.forEach((c) => { relCounts[c.relationship_type] = (relCounts[c.relationship_type] || 0) + 1; });
  const topMentioned = [...entities].sort((a, b) => (b.mention_count || 0) - (a.mention_count || 0)).slice(0, 10);
  const topRisk = [...entities].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 10);

  const deg = {};
  connections.forEach((c) => {
    deg[c.source_entity_id] = (deg[c.source_entity_id] || 0) + 1;
    deg[c.target_entity_id] = (deg[c.target_entity_id] || 0) + 1;
  });
  // أعلى 40 كياناً مركزية + كل جيرانها المباشرين = عقد الشبكة الفعلية
  const topIds = new Set(
    entities.map((e) => ({ id: e.id, deg: deg[e.id] || 0 }))
      .sort((a, b) => b.deg - a.deg)
      .slice(0, 40)
      .map((e) => e.id)
  );
  const nodeIds = new Set(topIds);
  connections.forEach((c) => {
    if (topIds.has(c.source_entity_id)) nodeIds.add(c.target_entity_id);
    if (topIds.has(c.target_entity_id)) nodeIds.add(c.source_entity_id);
  });
  const netNodes = entities.filter((e) => nodeIds.has(e.id)).map((e) => ({ ...e, deg: deg[e.id] || 0 }));
  const netEdges = connections.filter((c) => nodeIds.has(c.source_entity_id) && nodeIds.has(c.target_entity_id));

  const nodeColor = (e) => (e.risk_score || 0) >= 70 ? '#dc2626' : (e.risk_score || 0) >= 40 ? '#f59e0b' : '#2563eb';
  const nodeR = (e) => 6 + Math.min(14, (e.mention_count || 0) / 2);

  // محاكاة قوى ديناميكية (غير حتمية): المواقع تُشتق من طوبولوجيا الروابط الفعلية
  const [positions, setPositions] = useState({});
  const [runId, setRunId] = useState(0);
  useEffect(() => {
    if (netNodes.length === 0) return;
    const W = 600, H = 600, cx = W / 2, cy = H / 2;
    const nodes = netNodes.map((e) => ({
      id: e.id,
      x: cx + (Math.random() - 0.5) * 300,
      y: cy + (Math.random() - 0.5) * 300,
      vx: 0, vy: 0
    }));
    const idToNode = {};
    nodes.forEach((n) => { idToNode[n.id] = n; });
    const edges = netEdges
      .map((c) => ({ s: c.source_entity_id, t: c.target_entity_id }))
      .filter((e) => idToNode[e.s] && idToNode[e.t]);
    let raf, still = 0;
    const tick = () => {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const d = Math.sqrt(d2);
          const f = 1400 / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
        }
      }
      edges.forEach((e) => {
        const a = idToNode[e.s], b = idToNode[e.t];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 70) * 0.03;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        a.vx += fx; a.vy += fy; b.vx -= fx; b.vy -= fy;
      });
      let energy = 0;
      nodes.forEach((n) => {
        n.vx = (n.vx + (cx - n.x) * 0.01) * 0.82;
        n.vy = (n.vy + (cy - n.y) * 0.01) * 0.82;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(24, Math.min(W - 24, n.x));
        n.y = Math.max(24, Math.min(H - 24, n.y));
        energy += Math.abs(n.vx) + Math.abs(n.vy);
      });
      const pos = {};
      nodes.forEach((n) => { pos[n.id] = { x: n.x, y: n.y }; });
      setPositions(pos);
      if (energy < 0.6) { still++; if (still > 25) { cancelAnimationFrame(raf); return; } } else still = 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runId, netNodes.length, netEdges.length]);

  const renderNetwork = (size = 600) => {
    const scale = size / 600;
    return (
      <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
        {netEdges.map((c) => {
          const a = positions[c.source_entity_id], b = positions[c.target_entity_id];
          if (!a || !b) return null;
          return <line key={c.id} x1={a.x * scale} y1={a.y * scale} x2={b.x * scale} y2={b.y * scale} stroke="#cbd5e1" strokeWidth={1} />;
        })}
        {netNodes.map((e) => {
          const p = positions[e.id];
          if (!p) return null;
          const isTop = topIds.has(e.id);
          const r = isTop ? nodeR(e) : 4;
          return (
            <g key={e.id}>
              <circle cx={p.x * scale} cy={p.y * scale} r={r} fill={nodeColor(e)} opacity={isTop ? 1 : 0.45} stroke="#fff" strokeWidth={1.5} />
              {isTop && (
                <text x={p.x * scale} y={p.y * scale - r - 3} fontSize={9} textAnchor="middle" fill="#334155">
                  {e.name.length > 16 ? e.name.slice(0, 16) + '…' : e.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  const generate = async () => {
    setBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(ref.current, { scale: 2, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(img, 'PNG', 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position = heightLeft - imgH;
        pdf.addPage();
        pdf.addImage(img, 'PNG', 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      pdf.save('تقرير-تحليلي-شامل.pdf');
      toast({ title: 'تم تصدير التقرير التحليلي' });
    } catch (e) {
      toast({ title: 'فشل التصدير', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;

  const statCards = [
    { label: 'الكيانات', value: entities.length, icon: Users, color: 'text-blue-600' },
    { label: 'الروابط', value: connections.length, icon: Share2, color: 'text-violet-600' },
    { label: 'المستندات', value: documents.length, icon: FileText, color: 'text-emerald-600' },
    { label: 'خطورة عالية', value: highRisk, icon: AlertTriangle, color: 'text-red-600' },
    { label: 'مراقَبة', value: watchlistCount, icon: Flag, color: 'text-amber-600' }
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold">التقرير التحليلي الشامل</h1>
          <p className="text-sm text-muted-foreground mt-1">ملخص البيانات والشبكة المرتبطة بها، قابل للتصدير بصيغة PDF</p>
        </div>
        <button
          onClick={generate}
          disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
          {busy ? 'جارٍ التصدير...' : 'تصدير التقرير (PDF)'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Icon className={`w-4 h-4 ${s.color}`} /> {s.label}
              </div>
              <div className="text-2xl font-bold font-heading mt-1">{s.value}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <h3 className="font-heading font-semibold flex items-center gap-2">
              <NetworkIcon className="w-4 h-4 text-primary" /> الشبكة الفعلية ({netNodes.length} كيان • {netEdges.length} رابط)
            </h3>
            <button
              onClick={() => setRunId((r) => r + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border bg-card hover:bg-accent transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> إعادة ترتيب
            </button>
          </div>
          <div className="flex justify-center">{renderNetwork(520)}</div>
          <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-600" /> خطورة عالية</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> متوسطة</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600" /> منخفضة</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 opacity-45" /> جار مباشر</span>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-2">تُشتق مواقع العقد ديناميكياً من طوبولوجيا الروابط الفعلية (محاكاة قوى) — كل ترتيب مختلف.</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div>
            <h3 className="font-heading font-semibold mb-2">توزيع الأنواع</h3>
            <div className="space-y-1.5">
              {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                <div key={t} className="flex items-center gap-2 text-sm">
                  <span className="w-20 text-muted-foreground">{TYPE_LABELS[t] || t}</span>
                  <div className="flex-1 h-2 rounded-full bg-accent overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (c / entities.length) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-left">{c}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="font-heading font-semibold mb-2">أنواع العلاقات</h3>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(relCounts).sort((a, b) => b[1] - a[1]).map(([r, c]) => (
                <span key={r} className="text-xs px-2.5 py-1 rounded-full bg-accent">{r} ({c})</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">الأكثر ذكراً</h3>
          <div className="space-y-2">
            {topMentioned.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{e.name}</span>
                <span className="text-xs text-muted-foreground">{e.mention_count || 0} ذكر</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">الأعلى خطورة</h3>
          <div className="space-y-2">
            {topRisk.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{e.name}</span>
                <span className={`text-xs font-medium ${(e.risk_score || 0) >= 70 ? 'text-red-600' : (e.risk_score || 0) >= 40 ? 'text-amber-600' : 'text-emerald-600'}`}>{e.risk_score || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* قالب التصدير المخفي */}
      <div ref={ref} dir="rtl" style={{ position: 'fixed', left: '-9999px', top: 0, width: '794px', padding: '36px', background: '#ffffff', fontFamily: 'Cairo, sans-serif', color: '#0f172a' }}>
        <div style={{ borderBottom: '3px solid #1d4ed8', paddingBottom: '14px', marginBottom: '22px' }}>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>التقرير التحليلي الشامل</div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            تاريخ التقرير: {new Date().toLocaleDateString('ar-EG')} • الكيانات: {entities.length} • الروابط: {connections.length} • المستندات: {documents.length}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '22px' }}>
          {[
            { l: 'الكيانات', v: entities.length }, { l: 'الروابط', v: connections.length },
            { l: 'المستندات', v: documents.length }, { l: 'خطورة عالية', v: highRisk }, { l: 'مراقَبة', v: watchlistCount }
          ].map((s) => (
            <div key={s.l} style={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#64748b' }}>{s.l}</div>
              <div style={{ fontSize: '20px', fontWeight: 700 }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: '16px', fontWeight: 700, margin: '14px 0 10px' }}>الشبكة الفعلية ({netNodes.length} كيان • {netEdges.length} رابط)</div>
        {renderNetwork(560)}

        <div style={{ fontSize: '16px', fontWeight: 700, margin: '20px 0 10px' }}>أبرز الكيانات</div>
        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ background: '#e2e8f0' }}>
              <th style={th}>الاسم</th><th style={th}>النوع</th><th style={th}>الخطورة</th><th style={th}>الذكر</th><th style={th}>المراقبة</th>
            </tr>
          </thead>
          <tbody>
            {topMentioned.concat(topRisk).slice(0, 30).map((e) => (
              <tr key={e.id}>
                <td style={td}>{e.name}</td>
                <td style={td}>{TYPE_LABELS[e.type] || 'أخرى'}</td>
                <td style={td}>{e.risk_score || 0}</td>
                <td style={td}>{e.mention_count || 0}</td>
                <td style={td}>{e.watchlist ? 'نعم' : 'لا'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ fontSize: '16px', fontWeight: 700, margin: '14px 0 10px' }}>أبرز الروابط في الشبكة ({netEdges.length})</div>
        <div style={{ fontSize: '11px', lineHeight: 1.9 }}>
          {netEdges.slice(0, 150).map((c) => (
            <div key={c.id}>• {c.source_entity_name || '—'} <span style={{ color: '#1d4ed8', fontWeight: 600 }}>[{c.relationship_type}]</span> {c.target_entity_name || '—'}</div>
          ))}
        </div>

        <div style={{ marginTop: '28px', paddingTop: '10px', borderTop: '1px solid #cbd5e1', fontSize: '10px', color: '#94a3b8', textAlign: 'center' }}>
          وثيقة تحليلية — محلّل الكيانات
        </div>
      </div>
    </div>
  );
}