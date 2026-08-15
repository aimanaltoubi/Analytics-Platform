import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Users, Share2, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';

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

export default function EntityDetail() {
  const { id } = useParams();
  const [entity, setEntity] = useState(null);
  const [connections, setConnections] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ent = await base44.entities.Entity.get(id);
        setEntity(ent);
        const [conns, ment] = await Promise.all([
          base44.entities.Connection.list('-created_date', 200),
          base44.entities.Mention.filter({ entity_id: id }, '-created_date', 50)
        ]);
        setConnections(conns.filter((c) => c.source_entity_id === id || c.target_entity_id === id));
        setMentions(ment);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (!entity) return <div className="p-6 text-sm text-muted-foreground">الكيان غير موجود.</div>;

  const attrs = entity.attributes || {};
  const attrKeys = Object.keys(attrs);

  return (
    <div className="p-6 space-y-6">
      <Link to="/entities" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> العودة للكيانات
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold">{entity.name}</h1>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground">
              {TYPE_LABELS[entity.type] || 'أخرى'}
            </span>
          </div>
          <div className="text-left">
            <div className="text-2xl font-bold font-heading">{entity.mention_count || 0}</div>
            <div className="text-xs text-muted-foreground">ذكر</div>
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
            <h3 className="text-xs text-muted-foreground mb-2">سمات إضافية</h3>
            <div className="grid grid-cols-2 gap-2">
              {attrKeys.map((k) => (
                <div key={k} className="rounded-lg bg-accent/40 p-2.5">
                  <div className="text-[11px] text-muted-foreground">{k}</div>
                  <div className="text-sm font-medium">{String(attrs[k])}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {entity.document_ids?.length > 0 && (
          <div className="mt-4">
            <h3 className="text-xs text-muted-foreground mb-2">المستندات المرتبطة</h3>
            <div className="flex flex-wrap gap-2">
              {entity.document_ids.map((did) => (
                <Link
                  key={did}
                  to={`/documents/${did}`}
                  className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  <FileText className="w-3.5 h-3.5" /> مستند
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <Share2 className="w-4 h-4" /> الروابط ({connections.length})
          </h3>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد روابط.</p>
          ) : (
            <div className="space-y-2">
              {connections.map((c) => {
                const isSource = c.source_entity_id === id;
                const otherName = isSource ? c.target_entity_name : c.source_entity_name;
                const otherId = isSource ? c.target_entity_id : c.source_entity_id;
                return (
                  <Link
                    key={c.id}
                    to={`/entities/${otherId}`}
                    className="block p-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                  >
                    <div className="text-sm">
                      <span className="text-muted-foreground">{isSource ? '→' : '←'} </span>
                      <span className="font-medium">{c.relationship_type}</span>
                      <span className="text-muted-foreground"> — </span>
                      <span className="font-medium">{otherName}</span>
                    </div>
                    {c.evidence && (
                      <div className="text-xs text-muted-foreground mt-1 italic">"{c.evidence}"</div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> الذكر في المستندات ({mentions.length})
          </h3>
          {mentions.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد إشارات.</p>
          ) : (
            <div className="space-y-2">
              {mentions.map((m) => (
                <Link
                  key={m.id}
                  to={`/documents/${m.document_id}`}
                  className="block p-2.5 rounded-lg bg-accent/30 hover:bg-accent/50 transition-colors"
                >
                  <div className="text-sm font-medium">{m.document_title}</div>
                  {m.role && <div className="text-xs text-muted-foreground mt-0.5">الدور: {m.role}</div>}
                  {m.context && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.context}</div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}