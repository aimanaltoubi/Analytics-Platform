import { useState, useEffect, useMemo } from 'react';
import { Share2, Calendar, Clock } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NetworkGraph from '@/components/NetworkGraph';

function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;
  const m = String(str).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let yy = m[3];
    if (yy.length === 2) yy = '20' + yy;
    const d2 = new Date(Number(yy), Number(m[2]) - 1, Number(m[1]));
    if (!isNaN(d2.getTime())) return d2;
  }
  return null;
}

export default function WorkspaceNetwork({ workspace }) {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [focusDate, setFocusDate] = useState('');

  useEffect(() => {
    (async () => {
      if (!workspace) return;
      setLoading(true);
      try {
        const [allEnts, mentions, conns, allDocs] = await Promise.all([
          base44.entities.Entity.list('-mention_count', 300),
          base44.entities.Mention.list('-created_date', 500),
          base44.entities.Connection.list('-created_date', 500),
          base44.entities.Document.list('-created_date', 100)
        ]);
        const selectedIds = new Set(workspace.entity_ids || []);
        const docIds = new Set(workspace.document_ids || []);
        const docEntityIds = new Set(
          mentions.filter((m) => docIds.has(m.document_id)).map((m) => m.entity_id)
        );
        const allIds = new Set([...selectedIds, ...docEntityIds]);
        setEntities(allEnts.filter((e) => allIds.has(e.id)));
        setConnections(conns.filter(
          (c) => allIds.has(c.source_entity_id) && allIds.has(c.target_entity_id)
        ));
        setDocuments(allDocs.filter((d) => docIds.has(d.id)));
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [workspace?.id, (workspace?.entity_ids || []).length, (workspace?.document_ids || []).length]);

  // خريطة تاريخ كل مستند: من كيان التاريخ المرتبط به، وإلا من تاريخ إنشائه
  const docDateMap = useMemo(() => {
    const map = {};
    const dateEnts = entities.filter((e) => e.type === 'date');
    documents.forEach((d) => {
      const dateEnt = dateEnts.find((e) => (e.document_ids || []).includes(d.id));
      const dt = parseDate(dateEnt?.name) || parseDate(d.created_date);
      if (dt) map[d.id] = dt;
    });
    return map;
  }, [entities, documents]);

  // تاريخ كل رابط
  const connDateMap = useMemo(() => {
    const map = {};
    connections.forEach((c) => {
      if (c.document_id && docDateMap[c.document_id]) {
        map[c.id] = docDateMap[c.document_id];
      }
    });
    return map;
  }, [connections, docDateMap]);

  const hasDateFilter = fromDate || toDate || focusDate;

  const filteredConnections = useMemo(() => {
    if (!hasDateFilter) return connections;
    return connections.filter((c) => {
      const dt = connDateMap[c.id];
      if (!dt) return false;
      if (fromDate && dt < new Date(fromDate)) return false;
      if (toDate && dt > new Date(toDate + 'T23:59:59')) return false;
      if (focusDate && (dt < new Date(focusDate) || dt > new Date(focusDate + 'T23:59:59'))) return false;
      return true;
    });
  }, [connections, connDateMap, hasDateFilter, fromDate, toDate, focusDate]);

  // عند تفعيل فلتر التاريخ، نُضيّق الكيانات إلى تلك المرتبطة بالروابط الباقية
  const visibleEntities = useMemo(() => {
    if (!hasDateFilter) return entities;
    const ids = new Set();
    filteredConnections.forEach((c) => { ids.add(c.source_entity_id); ids.add(c.target_entity_id); });
    return entities.filter((e) => ids.has(e.id));
  }, [entities, filteredConnections, hasDateFilter]);

  // مدرّج تكرار الأحداث
  const buckets = useMemo(() => {
    const dated = connections.map((c) => connDateMap[c.id]).filter(Boolean);
    if (dated.length === 0) return [];
    const times = dated.map((d) => d.getTime());
    const min = Math.min(...times), max = Math.max(...times);
    const span = Math.max(max - min, 1);
    const n = 40;
    const arr = Array(n).fill(0);
    filteredConnections.forEach((c) => {
      const dt = connDateMap[c.id];
      if (!dt) return;
      const idx = Math.min(n - 1, Math.floor(((dt.getTime() - min) / span) * n));
      arr[idx]++;
    });
    const maxCount = Math.max(...arr, 1);
    return arr.map((c) => c / maxCount);
  }, [connections, filteredConnections, connDateMap]);

  const reset = () => { setFromDate(''); setToDate(''); setFocusDate(''); };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">جارٍ تحميل الشبكة...</div>;

  if (entities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 text-center py-12 text-muted-foreground">
        <Share2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">أضف كيانات أو حمّل مستندات لعرض شبكة التحليل.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Share2 className="w-4 h-4" /> شبكة التحليل
        </h3>
        <span className="text-xs text-muted-foreground">
          {visibleEntities.length} كيان • {filteredConnections.length} رابط
          {hasDateFilter && ' (مُصفّى)'}
        </span>
      </div>

      {/* فلتر الخط الزمني */}
      <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-border/60">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Clock className="w-4 h-4" /> تصفية زمنية:
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <span className="text-xs text-muted-foreground">إلى</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">يوم:</span>
          <input type="date" value={focusDate} onChange={(e) => setFocusDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {hasDateFilter && (
          <button onClick={reset} className="text-xs text-primary hover:underline">إعادة ضبط</button>
        )}
      </div>

      {buckets.length > 0 && (
        <div className="flex items-end gap-px h-10 mb-4 px-1">
          {buckets.map((h, i) => (
            <div key={i} className="flex-1 bg-primary/40 rounded-t-sm" style={{ height: `${Math.max(h * 100, 3)}%` }} />
          ))}
        </div>
      )}

      {hasDateFilter && filteredConnections.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Calendar className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">لا توجد روابط مؤرخة ضمن النطاق المحدد.</p>
        </div>
      ) : (
        <NetworkGraph entities={visibleEntities} connections={filteredConnections} height={520} />
      )}
    </div>
  );
}