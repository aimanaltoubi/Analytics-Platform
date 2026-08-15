import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, ArrowLeft, Clock } from 'lucide-react';

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

function formatDate(key) {
  const d = new Date(key);
  if (isNaN(d.getTime())) return key;
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function TimelineAnalysis({ entities, connections, documents }) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [focusDate, setFocusDate] = useState('');

  const docById = useMemo(() => {
    const m = {};
    documents.forEach((d) => (m[d.id] = d));
    return m;
  }, [documents]);

  const events = useMemo(() => {
    const list = [];
    connections.forEach((c) => {
      const doc = c.document_id ? docById[c.document_id] : null;
      const dateEnt = c.document_id
        ? entities.find((e) => e.type === 'date' && (e.document_ids || []).includes(c.document_id))
        : null;
      const locEnt = c.document_id
        ? entities.find((e) => e.type === 'location' && (e.document_ids || []).includes(c.document_id))
        : null;
      const date = parseDate(dateEnt?.name) || (doc ? parseDate(doc.created_date) : null);
      if (!date) return;
      list.push({
        id: c.id,
        date,
        sourceName: c.source_entity_name,
        targetName: c.target_entity_name,
        rel: c.relationship_type,
        sourceId: c.source_entity_id,
        targetId: c.target_entity_id,
        location: locEnt?.name || null,
        documentTitle: doc?.title || null,
        documentId: c.document_id
      });
    });
    return list.sort((a, b) => a.date - b.date);
  }, [entities, connections, docById]);

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (fromDate && e.date < new Date(fromDate)) return false;
      if (toDate && e.date > new Date(toDate + 'T23:59:59')) return false;
      if (focusDate) {
        if (e.date < new Date(focusDate) || e.date > new Date(focusDate + 'T23:59:59')) return false;
      }
      return true;
    });
  }, [events, fromDate, toDate, focusDate]);

  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((e) => {
      const key = e.date.toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return Array.from(map.entries()).sort((a, b) => new Date(a[0]) - new Date(b[0]));
  }, [filtered]);

  const minMax = useMemo(() => {
    if (!events.length) return null;
    const times = events.map((e) => e.date.getTime());
    return { min: Math.min(...times), max: Math.max(...times) };
  }, [events]);

  const buckets = useMemo(() => {
    if (!minMax || filtered.length === 0) return [];
    const span = Math.max(minMax.max - minMax.min, 1);
    const n = 48;
    const arr = Array(n).fill(0);
    filtered.forEach((e) => {
      const idx = Math.min(n - 1, Math.floor(((e.date.getTime() - minMax.min) / span) * n));
      arr[idx]++;
    });
    const maxCount = Math.max(...arr, 1);
    return arr.map((c) => c / maxCount);
  }, [filtered, minMax]);

  const hasFilters = fromDate || toDate || focusDate;
  const reset = () => { setFromDate(''); setToDate(''); setFocusDate(''); };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading font-semibold mb-1 flex items-center gap-2">
        <Clock className="w-4 h-4" /> الخط الزمني للأحداث
      </h3>
      <p className="text-xs text-muted-foreground mb-4">
        تتبّع اللقاءات والروابط عبر الزمن — يُشتق التاريخ من كيانات التاريخ المرتبطة بالمستندات، مع الموقع إن وُجد.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          <span className="text-xs text-muted-foreground">إلى</span>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">تركيز على يوم:</span>
          <input type="date" value={focusDate} onChange={(e) => setFocusDate(e.target.value)} className="rounded-lg border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {hasFilters && (
          <button onClick={reset} className="text-xs text-primary hover:underline">إعادة ضبط</button>
        )}
        <span className="text-xs text-muted-foreground ms-auto">{filtered.length} حدث</span>
      </div>

      {buckets.length > 0 && (
        <div className="flex items-end gap-px h-14 mb-4 px-1">
          {buckets.map((h, i) => (
            <div key={i} className="flex-1 bg-primary/40 rounded-t-sm" style={{ height: `${Math.max(h * 100, 3)}%` }} />
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {events.length === 0
            ? 'لا توجد أحداث مؤرخة. تأكد من وجود كيانات من نوع "تاريخ" مرتبطة بالمستندات، أو أن المستندات مؤرخة.'
            : 'لا توجد أحداث ضمن النطاق المحدد.'}
        </p>
      ) : (
        <div className="space-y-4 max-h-[460px] overflow-auto pe-1">
          {grouped.map(([dateKey, evts]) => (
            <div key={dateKey}>
              <div className="sticky top-0 bg-card py-1 text-xs font-medium text-primary mb-1 border-b border-border/60">
                {formatDate(dateKey)}
              </div>
              <div className="space-y-2">
                {evts.map((e) => (
                  <div key={e.id} className="flex items-start gap-2 rounded-lg bg-accent/30 p-2.5">
                    <ArrowLeft className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">
                        <Link to={`/entities/${e.sourceId}`} className="font-medium hover:underline">{e.sourceName}</Link>
                        <span className="text-muted-foreground mx-1">—{e.rel}→</span>
                        <Link to={`/entities/${e.targetId}`} className="font-medium hover:underline">{e.targetName}</Link>
                      </div>
                      {e.location && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <MapPin className="w-3 h-3" /> {e.location}
                        </div>
                      )}
                      {e.documentTitle && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          المصدر: <Link to={`/documents/${e.documentId}`} className="hover:underline">{e.documentTitle}</Link>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}