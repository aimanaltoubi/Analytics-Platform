import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Unlink, FileQuestion, Link2Off, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TYPE_LABELS = {
  person: 'فرد', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

export default function IntelligenceGaps() {
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [ents, conns, docs] = await Promise.all([
          base44.entities.Entity.list('-mention_count', 1000),
          base44.entities.Connection.list('-created_date', 1000),
          base44.entities.Document.list('-created_date', 500)
        ]);
        setEntities(ents); setConnections(conns); setDocuments(docs);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, []);

  const degree = useMemo(() => {
    const m = {};
    connections.forEach((c) => {
      m[c.source_entity_id] = (m[c.source_entity_id] || 0) + 1;
      m[c.target_entity_id] = (m[c.target_entity_id] || 0) + 1;
    });
    return m;
  }, [connections]);

  const singleMention = useMemo(() => entities.filter((e) => (e.mention_count || 0) <= 1), [entities]);
  const isolated = useMemo(() => entities.filter((e) => !degree[e.id]), [entities, degree]);
  const singleSource = useMemo(() => entities.filter((e) => (e.document_ids || []).length <= 1), [entities]);
  const docsNoEntities = useMemo(() => documents.filter((d) => !d.entity_count), [documents]);
  const weakEvidence = useMemo(() => connections.filter((c) => !c.evidence), [connections]);

  const cards = [
    { label: 'كيانات مذكورة مرة واحدة', value: singleMention.length, icon: AlertCircle, hint: 'تغطية ضعيفة — تحتاج مصادر إضافية', items: singleMention, tint: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'كيانات معزولة (بلا روابط)', value: isolated.length, icon: Unlink, hint: 'لا تربطها علاقة بأي كيان آخر', items: isolated, tint: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'كيانات بمصدر واحد', value: singleSource.length, icon: FileQuestion, hint: 'مذكورة في مستند واحد فقط', items: singleSource, tint: 'text-rose-600', bg: 'bg-rose-50' },
    { label: 'مستندات بلا كيانات مستخرجة', value: docsNoEntities.length, icon: FileQuestion, hint: 'فشل الاستخراج أو مستند فارغ', items: docsNoEntities, tint: 'text-red-600', bg: 'bg-red-50' },
    { label: 'روابط بلا دليل', value: weakEvidence.length, icon: Link2Off, hint: 'علاقات دون نص داعم', items: weakEvidence, tint: 'text-violet-600', bg: 'bg-violet-50' }
  ];

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ تحليل الفجوات...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" /> الفجوات التحليلية
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          نقاط الضعف في التغطية: كيانات ضعيفة الذكر، علاقات بلا أدلة، مستندات غير مستخرَجة — لتحديد أولويات الاستيعاب.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border border-border bg-card p-4">
              <div className={`w-9 h-9 rounded-md ${c.bg} ${c.tint} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="font-mono text-2xl font-bold tabular-nums">{c.value}</div>
              <div className="text-[11px] text-muted-foreground mt-1 leading-tight">{c.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {cards.filter((c) => c.items && c.items.length > 0).slice(0, 4).map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-heading font-semibold mb-1">{c.label}</h3>
            <p className="text-[11px] text-muted-foreground mb-3">{c.hint}</p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {c.items.slice(0, 40).map((it) => (
                <Link
                  key={it.id}
                  to={it.title ? `/documents/${it.id}` : `/entities/${it.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {it.title ? (
                    <>
                      <FileQuestion className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate flex-1">{it.title}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent shrink-0">{TYPE_LABELS[it.type] || 'أخرى'}</span>
                      <span className="text-sm font-medium truncate flex-1">{it.name}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{it.mention_count || 0} ذكر</span>
                    </>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}