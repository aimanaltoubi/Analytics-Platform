import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, FileText, Users, Share2, AlertCircle, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير تحليلي',
  other: 'أخرى'
};

export default function DocumentDetail() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);
  const [entities, setEntities] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reprocessing, setReprocessing] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const d = await base44.entities.Document.get(id);
      setDoc(d);
      const [ents, conns] = await Promise.all([
        base44.entities.Entity.filter({ document_ids: id }, '-mention_count', 50),
        base44.entities.Connection.filter({ document_id: id }, '-created_date', 100)
      ]);
      setEntities(ents);
      setConnections(conns);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleReprocess = async () => {
    setReprocessing(true);
    try {
      const res = await base44.functions.invoke('processDocument', { document_id: id });
      const result = res.data || {};
      toast({
        title: 'تمت إعادة التحليل',
        description: `الكيانات: ${result.entity_count || 0} • الروابط: ${result.connection_count || 0}`
      });
      await load();
    } catch (err) {
      toast({ title: 'فشلت إعادة التحليل', description: err.message, variant: 'destructive' });
    } finally {
      setReprocessing(false);
    }
  };

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (!doc) return <div className="p-6 text-sm text-muted-foreground">المستند غير موجود.</div>;

  return (
    <div className="p-6 space-y-6">
      <Link to="/documents" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> العودة للمستندات
      </Link>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <FileText className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-xl font-bold">{doc.title}</h1>
            <div className="text-sm text-muted-foreground mt-1">{TYPE_LABELS[doc.document_type] || 'أخرى'}</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-3 py-1 rounded-full ${
              doc.status === 'processed' ? 'bg-emerald-100 text-emerald-700' :
              doc.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {doc.status === 'processed' ? 'تمت المعالجة' : doc.status === 'failed' ? 'فشل' : doc.status === 'processing' ? 'قيد المعالجة' : 'بانتظار'}
            </span>
            <button
              onClick={handleReprocess}
              disabled={reprocessing}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reprocessing ? 'animate-spin' : ''}`} />
              {reprocessing ? 'جارٍ إعادة التحليل...' : 'إعادة التحليل'}
            </button>
          </div>
        </div>

        {doc.status === 'failed' && doc.error_message && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="w-4 h-4" /> {doc.error_message}
          </div>
        )}

        {doc.summary && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-1">الملخص</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{doc.summary}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="flex items-center gap-2 rounded-lg bg-accent/40 p-3">
            <Users className="w-4 h-4 text-violet-600" />
            <span className="text-sm">{entities.length} كيان</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-accent/40 p-3">
            <Share2 className="w-4 h-4 text-emerald-600" />
            <span className="text-sm">{connections.length} رابط</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">الكيانات المستخرجة</h3>
          {entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد كيانات.</p>
          ) : (
            <div className="space-y-2">
              {entities.map((e) => (
                <Link
                  key={e.id}
                  to={`/entities/${e.id}`}
                  className="flex items-center justify-between p-2.5 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div>
                    <div className="text-sm font-medium">{e.name}</div>
                    {e.aliases?.length > 0 && (
                      <div className="text-xs text-muted-foreground">{e.aliases.join('، ')}</div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">{e.type}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">الروابط المستخرجة</h3>
          {connections.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد روابط.</p>
          ) : (
            <div className="space-y-2">
              {connections.map((c) => (
                <div key={c.id} className="p-2.5 rounded-lg bg-accent/30">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="font-medium">{c.source_entity_name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{c.relationship_type}</span>
                    <span className="font-medium">{c.target_entity_name}</span>
                  </div>
                  {c.evidence && (
                    <div className="text-xs text-muted-foreground mt-1 italic">"{c.evidence}"</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {doc.raw_text && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3">النص المستخرج</h3>
          <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-body leading-relaxed max-h-96 overflow-auto">
            {doc.raw_text}
          </pre>
        </div>
      )}
    </div>
  );
}