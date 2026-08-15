import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Clock, FileText, Share2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

function fmt(s) {
  if (!s) return '';
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('ar-EG', { dateStyle: 'medium' });
}

export default function EntityTimeline({ entityId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [conns, ment, docs] = await Promise.all([
          base44.entities.Connection.list('-created_date', 500),
          base44.entities.Mention.filter({ entity_id: entityId }, '-created_date', 100),
          base44.entities.Document.list('-created_date', 200)
        ]);
        const docDate = {};
        docs.forEach((d) => { docDate[d.id] = d.created_date; });
        const evs = [];
        ment.forEach((m) => {
          evs.push({
            type: 'mention',
            date: docDate[m.document_id] || m.created_date,
            doc_id: m.document_id,
            title: m.document_title,
            role: m.role,
            context: m.context
          });
        });
        conns.forEach((c) => {
          if (c.source_entity_id !== entityId && c.target_entity_id !== entityId) return;
          const otherId = c.source_entity_id === entityId ? c.target_entity_id : c.source_entity_id;
          const otherName = c.source_entity_id === entityId ? c.target_entity_name : c.source_entity_name;
          evs.push({
            type: 'connection',
            date: docDate[c.document_id] || c.created_date,
            rel: c.relationship_type,
            otherId,
            otherName,
            evidence: c.evidence
          });
        });
        evs.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        setEvents(evs);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [entityId]);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" /> المسار الزمني للكيان
      </h3>
      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">جارٍ التحميل...</p>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">لا توجد أحداث مسجّلة.</p>
      ) : (
        <div className="relative space-y-4 pr-4">
          <div className="absolute right-1.5 top-1.5 bottom-1.5 w-px bg-border" />
          {events.map((ev, i) => (
            <div key={i} className="relative pr-5">
              <span className="absolute right-0 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-card" />
              <div className="text-[11px] text-muted-foreground">{fmt(ev.date) || 'تاريخ غير محدد'}</div>
              {ev.type === 'mention' ? (
                <Link to={`/documents/${ev.doc_id}`} className="block mt-0.5 hover:bg-accent/40 -mx-1 px-1 py-0.5 rounded">
                  <div className="text-sm font-medium flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-blue-500" /> {ev.title}
                  </div>
                  {ev.role && <div className="text-xs text-muted-foreground">الدور: {ev.role}</div>}
                  {ev.context && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{ev.context}</div>}
                </Link>
              ) : (
                <Link to={`/entities/${ev.otherId}`} className="block mt-0.5 hover:bg-accent/40 -mx-1 px-1 py-0.5 rounded">
                  <div className="text-sm flex items-center gap-1.5 flex-wrap">
                    <Share2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{ev.rel}</span>
                    <span className="font-medium">{ev.otherName}</span>
                  </div>
                  {ev.evidence && <div className="text-xs text-muted-foreground italic mt-0.5">"{ev.evidence}"</div>}
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}