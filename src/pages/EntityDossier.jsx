import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, FileText, Share2, Users, Flag, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import EntityTimeline from '@/components/EntityTimeline';
import InvestigationReport from '@/components/InvestigationReport';

const TYPE_LABELS = {
  person: 'فرد', organization: 'منظمة', company: 'شركة', phone: 'هاتف', email: 'بريد',
  location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى'
};

export default function EntityDossier() {
  const { id } = useParams();
  const [entity, setEntity] = useState(null);
  const [connections, setConnections] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [nameMap, setNameMap] = useState({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ent = await base44.entities.Entity.get(id);
        setEntity(ent);
        const [conns, ment, allEnts, allDocs] = await Promise.all([
          base44.entities.Connection.list('-created_date', 500),
          base44.entities.Mention.filter({ entity_id: id }, '-created_date', 100),
          base44.entities.Entity.list('-mention_count', 1000),
          base44.entities.Document.list('-created_date', 500)
        ]);
        const nm = {}; allEnts.forEach((e) => { nm[e.id] = e.name; });
        setNameMap(nm);
        setConnections(conns.filter((c) => c.source_entity_id === id || c.target_entity_id === id));
        setMentions(ment);
        const docIds = new Set(ent.document_ids || []);
        setDocuments(allDocs.filter((d) => docIds.has(d.id)));
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ تحميل الملف المركّز...</div>;
  if (!entity) return <div className="p-6 text-sm text-muted-foreground">الكيان غير موجود.</div>;

  const attrs = entity.attributes || {};
  const attrKeys = Object.keys(attrs);
  const riskColor = (entity.risk_score || 0) >= 70 ? 'text-red-600' : (entity.risk_score || 0) >= 40 ? 'text-amber-600' : 'text-emerald-600';

  const exportJson = () => {
    const bundle = { generated_at: new Date().toISOString(), entity, connections, mentions, documents };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `حزمة-${(entity.name || 'كيان').replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'تم تصدير حزمة الأدلة (JSON)' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to={`/entities/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowRight className="w-4 h-4" /> العودة للكيان
        </Link>
        <button
          onClick={exportJson}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border border-border bg-card hover:bg-accent transition-colors"
        >
          حزمة أدلة (JSON)
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          {entity.photo_url ? (
            <Image src={entity.photo_url} alt={entity.name} className="w-20 h-20 rounded-xl border border-border shrink-0" fittingType="fill" />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-accent text-muted-foreground text-2xl font-bold flex items-center justify-center shrink-0 border border-border">
              {entity.name?.charAt(0) || '؟'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-2xl font-bold">{entity.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground">{TYPE_LABELS[entity.type] || 'أخرى'}</span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-accent ${riskColor}`}>
                <AlertTriangle className="w-3 h-3" /> خطورة: {entity.risk_score || 0}
              </span>
              {entity.watchlist && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-800">
                  <Flag className="w-3 h-3" /> مُراقَب
                </span>
              )}
              <span className="text-xs text-muted-foreground">{entity.mention_count || 0} ذكر</span>
            </div>
          </div>
        </div>

        {entity.aliases?.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs text-muted-foreground mb-1">الأسماء البديلة</h3>
            <div className="flex flex-wrap gap-2">
              {entity.aliases.map((a, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-lg bg-accent">{a}</span>
              ))}
            </div>
          </div>
        )}

        {attrKeys.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs text-muted-foreground mb-2">السمات التفصيلية</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {attrKeys.map((k) => (
                <div key={k} className="rounded-lg bg-accent/40 p-2.5">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="text-sm font-medium break-words">{String(attrs[k])}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" /> شبكة العلاقات ({connections.length})
        </h3>
        {connections.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد روابط.</p>
        ) : (
          <div className="space-y-2">
            {connections.map((c) => {
              const isSource = c.source_entity_id === id;
              const otherId = isSource ? c.target_entity_id : c.source_entity_id;
              const otherName = isSource ? c.target_entity_name : c.source_entity_name;
              return (
                <Link key={c.id} to={`/entities/${otherId}`} className="block p-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                  <div className="text-sm flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.relationship_type}</span>
                    <span className="font-medium">{otherName || nameMap[otherId] || 'كيان محذوف'}</span>
                  </div>
                  {c.evidence && <div className="text-xs text-muted-foreground mt-1 italic">"{c.evidence}"</div>}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" /> المستندات المصدرية ({documents.length})
          </h3>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مستندات.</p>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => (
                <Link key={d.id} to={`/documents/${d.id}`} className="block p-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                  <div className="text-sm font-medium truncate">{d.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {d.entity_count || 0} كيان • {d.connection_count || 0} رابط{d.reference_date ? ` • ${d.reference_date}` : ''}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" /> الذكر في المستندات ({mentions.length})
          </h3>
          {mentions.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد إشارات.</p>
          ) : (
            <div className="space-y-2">
              {mentions.map((m) => (
                <Link key={m.id} to={`/documents/${m.document_id}`} className="block p-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors">
                  <div className="text-sm font-medium">{m.document_title}</div>
                  {m.role && <div className="text-xs text-muted-foreground mt-0.5">الدور: {m.role}</div>}
                  {m.context && <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.context}</div>}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <EntityTimeline entityId={id} />

      <div className="pt-2">
        <InvestigationReport title={entity.name} entities={[entity]} connections={connections} documents={documents} />
      </div>
    </div>
  );
}