import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowRight, Users, Share2, FileText, Flag, Save, GitMerge } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import EntityTimeline from '@/components/EntityTimeline';
import InvestigationReport from '@/components/InvestigationReport';
import EntityMergeDialog from '@/components/EntityMergeDialog';

const TYPE_LABELS = {
  person: 'شخص',
  organization: 'منظمة',
  company: 'شركة',
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
  const navigate = useNavigate();
  const [entity, setEntity] = useState(null);
  const [connections, setConnections] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [riskScore, setRiskScore] = useState(0);
  const [watchlist, setWatchlist] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [nameMap, setNameMap] = useState({});
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const ent = await base44.entities.Entity.get(id);
        setEntity(ent);
        setRiskScore(ent.risk_score || 0);
        setWatchlist(!!ent.watchlist);
        setNotes(ent.notes || '');
        const [conns, ment, allEnts] = await Promise.all([
          base44.entities.Connection.list('-created_date', 200),
          base44.entities.Mention.filter({ entity_id: id }, '-created_date', 50),
          base44.entities.Entity.list('-mention_count', 1000)
        ]);
        const nm = {};
        allEnts.forEach((e) => { nm[e.id] = e.name; });
        setNameMap(nm);
        setConnections(conns.filter((c) => c.source_entity_id === id || c.target_entity_id === id));
        setMentions(ment);
      } catch (e) {} finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (!entity) return <div className="p-6 text-sm text-muted-foreground">الكيان غير موجود.</div>;

  const saveFlags = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.Entity.update(id, { risk_score: riskScore, watchlist });
      setEntity(updated);
      toast({ title: 'تم حفظ التغييرات' });
    } catch (e) {
      toast({ title: 'فشل الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      const updated = await base44.entities.Entity.update(id, { notes });
      setEntity(updated);
      toast({ title: 'تم حفظ الملاحظات' });
    } catch (e) {
      toast({ title: 'فشل الحفظ', description: e.message, variant: 'destructive' });
    } finally { setSavingNotes(false); }
  };

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
          <div className="flex flex-col items-end gap-2">
            <div className="text-left">
              <div className="text-2xl font-bold font-heading">{entity.mention_count || 0}</div>
              <div className="text-xs text-muted-foreground">ذكر</div>
            </div>
            <button
              onClick={() => setShowMerge(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-border bg-card hover:bg-accent transition-colors"
            >
              <GitMerge className="w-3.5 h-3.5" /> دمج مع كيان آخر
            </button>
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

      {/* بطاقة الخطورة والمراقبة */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading font-semibold mb-4 flex items-center gap-2">
          <Flag className="w-4 h-4 text-amber-600" /> الخطورة والمراقبة
        </h3>
        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">درجة الخطورة</label>
              <span className={`text-sm font-bold ${
                riskScore >= 70 ? 'text-red-600' : riskScore >= 40 ? 'text-amber-600' : 'text-emerald-600'
              }`}>{riskScore}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={riskScore}
              onChange={(e) => setRiskScore(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
              <span>آمن</span><span>متوسط</span><span>خطير</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setWatchlist((w) => !w)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors ${
                watchlist
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'border-border hover:bg-accent'
              }`}
            >
              <Flag className="w-4 h-4" />
              {watchlist ? 'مُراقَب' : 'إضافة للمراقبة'}
            </button>
            <button
              onClick={saveFlags}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading font-semibold mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" /> ملاحظات المراجعة
        </h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="دوّن تفاصيل يدوية حول تاريخ الكيان أو درجة الخطورة..."
          rows={5}
          className="w-full rounded-lg border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
        />
        <div className="flex justify-end mt-3">
          <button
            onClick={saveNotes}
            disabled={savingNotes}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingNotes ? 'جارٍ الحفظ...' : 'حفظ الملاحظات'}
          </button>
        </div>
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
                    <div className="text-sm flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.relationship_type}</span>
                      <span className="font-medium">{otherName || nameMap[otherId] || 'كيان محذوف'}</span>
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

      <EntityTimeline entityId={id} />

      <InvestigationReport title={entity.name} entities={[entity]} connections={connections} />

      <EntityMergeDialog open={showMerge} onOpenChange={setShowMerge} primaryEntity={entity} onMerged={() => navigate('/entities')} />
    </div>
  );
}