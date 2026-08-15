import { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileText, Loader2, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const TYPE_LABELS = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير استخباراتي',
  other: 'أخرى'
};

export default function DocumentUploader({ onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('intelligence_report');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
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

  const handleUpload = async () => {
    if (!file) {
      toast({ title: 'اختر ملف PDF أولاً', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setStage('رفع الملف...');
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

      toast({
        title: 'تمت المعالجة بنجاح',
        description: `الكيانات: ${result.entity_count || 0} • الروابط: ${result.connection_count || 0}`
      });
      reset();
      if (inputRef.current) inputRef.current.value = '';
      onUploaded && onUploaded();
    } catch (err) {
      toast({ title: 'فشلت المعالجة', description: err.message, variant: 'destructive' });
      setStage('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <UploadCloud className="w-5 h-5 text-primary" />
        <h3 className="font-heading font-semibold">رفع مستند جديد</h3>
      </div>

      {!file ? (
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) {
              setFile(f);
              if (!title) setTitle(f.name.replace(/\.pdf$/i, ''));
            }
          }}
        >
          <FileText className="w-8 h-8 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">اسحب ملف PDF هنا أو انقر للاختيار</span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={onPick}
          />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
            <FileText className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{file.name}</div>
              <div className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} ك.ب</div>
            </div>
            {!busy && (
              <button onClick={reset} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">عنوان المستند</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="عنوان تمهيدي"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">نوع المستند</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                disabled={busy}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {busy && stage && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {stage}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              onClick={reset}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              onClick={handleUpload}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              {busy ? 'جارٍ المعالجة...' : 'رفع وتحليل'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}