import { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, X, Link2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير تحليلي',
  other: 'أخرى'
};

export default function WorkspacePdfLoader({ workspace, onLoaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('intelligence_report');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setTitle('');
    setDocType('intelligence_report');
    setStage('');
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
    }
  };

  const handleLoad = async () => {
    if (!file) {
      toast({ title: 'اختر ملف PDF أولاً', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setStage('رفع الملف...');
    setAnalysis(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setStage('إنشاء سجل المستند...');
      const doc = await base44.entities.Document.create({
        title: title || file.name,
        document_type: docType,
        file_url,
        status: 'pending'
      });

      setStage('استخراج النص وتحليل الكيانات...');
      const res = await base44.functions.invoke('processDocument', { document_id: doc.id });
      const result = res.data || {};

      const previousDocIds = (workspace.document_ids || []).filter((id) => id !== doc.id);
      await base44.entities.Workspace.update(workspace.id, {
        document_ids: [...previousDocIds, doc.id]
      });

      setStage('فحص الروابط المشتركة مع المستندات السابقة...');
      const allMentions = await base44.entities.Mention.list('-created_date', 500);
      const newDocMentions = allMentions.filter((m) => m.document_id === doc.id);
      const previousMentions = allMentions.filter((m) => previousDocIds.includes(m.document_id));

      const newEntityIds = new Set(newDocMentions.map((m) => m.entity_id));
      const previousEntityMap = {};
      for (const m of previousMentions) {
        if (!previousEntityMap[m.entity_id]) previousEntityMap[m.entity_id] = [];
        if (!previousEntityMap[m.entity_id].includes(m.document_title || m.document_id)) {
          previousEntityMap[m.entity_id].push(m.document_title || m.document_id);
        }
      }
      const previousEntityIds = new Set(Object.keys(previousEntityMap));
      const matchedEntityIds = [...newEntityIds].filter((id) => previousEntityIds.has(id));

      const matchedEntities = [];
      for (const id of matchedEntityIds) {
        try {
          const ent = await base44.entities.Entity.get(id);
          matchedEntities.push({ ...ent, previousDocs: previousEntityMap[id] });
        } catch (e) {}
      }

      const allConnections = await base44.entities.Connection.list('-created_date', 500);
      const crossConnections = allConnections.filter(
        (c) => c.document_id === doc.id &&
          (previousEntityIds.has(c.source_entity_id) || previousEntityIds.has(c.target_entity_id))
      );

      setAnalysis({
        newEntityCount: newEntityIds.size,
        matchedEntities,
        crossConnections,
        previousDocCount: previousDocIds.length
      });

      toast({
        title: 'تم تحميل المستند وتحليله',
        description: `الكيانات: ${result.entity_count || 0} • الروابط: ${result.connection_count || 0} • المشتركة: ${matchedEntityIds.length}`
      });
      reset();
      if (inputRef.current) inputRef.current.value = '';
      onLoaded && onLoaded();
    } catch (err) {
      toast({ title: 'فشل تحميل المستند', description: err.message, variant: 'destructive' });
      setStage('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <UploadCloud className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold">تحميل PDF وفحص الروابط المشتركة</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        بعد التحليل، يُفحص ما إذا كانت كيانات المستند الجديد ترتبط بكيانات ذُكرت في مستندات سابقة داخل نفس مساحة العمل.
      </p>

      {!file ? (
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { setFile(f); if (!title) setTitle(f.name.replace(/\.pdf$/i, '')); } }}
        >
          <FileText className="w-7 h-7 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">اسحب ملف PDF هنا أو انقر للاختيار</span>
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={onPick} />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{file.name}</div>
              <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} ك.ب</div>
            </div>
            {!busy && <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">عنوان المستند</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="عنوان تمهيدي" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">نوع المستند</label>
              <select value={docType} onChange={(e) => setDocType(e.target.value)} disabled={busy} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                {Object.entries(TYPE_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
              </select>
            </div>
          </div>
          {busy && stage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> {stage}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={reset} disabled={busy} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent transition-colors disabled:opacity-50">إلغاء</button>
            <button onClick={handleLoad} disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />} {busy ? 'جارٍ التحليل...' : 'تحميل وفحص'}
            </button>
          </div>
        </div>
      )}

      {analysis && (
        <div className="border-t border-border pt-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
            <CheckCircle2 className="w-4 h-4" /> اكتمل الفحص — {analysis.newEntityCount} كيان في المستند الجديد
          </div>
          {analysis.previousDocCount === 0 ? (
            <p className="text-sm text-muted-foreground">هذا أول مستند في مساحة العمل — لا توجد مستندات سابقة للمقارنة. حمّل مستنداً آخر لاحقاً لإجراء الفحص.</p>
          ) : (
            <>
              <div>
                <h4 className="text-sm font-semibold mb-2">الكيانات المشتركة مع مستندات سابقة ({analysis.matchedEntities.length})</h4>
                {analysis.matchedEntities.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد كيانات مشتركة بين هذا المستند والمستندات السابقة في مساحة العمل.</p>
                ) : (
                  <div className="space-y-2">
                    {analysis.matchedEntities.map((ent) => (
                      <div key={ent.id} className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                        <div className="text-sm font-medium">{ent.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">ظهر سابقاً في: {ent.previousDocs.join('، ')}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> روابط جديدة مع كيانات سابقة ({analysis.crossConnections.length})</h4>
                {analysis.crossConnections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">لا توجد روابط مباشرة بين كيانات المستند الجديد والكيانات السابقة.</p>
                ) : (
                  <div className="space-y-2">
                    {analysis.crossConnections.map((c) => (
                      <div key={c.id} className="rounded-lg bg-accent/30 p-3 text-sm">
                        <span className="font-medium">{c.source_entity_name}</span>
                        <span className="text-muted-foreground mx-1">—{c.relationship_type}→</span>
                        <span className="font-medium">{c.target_entity_name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}