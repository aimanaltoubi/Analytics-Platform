import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, FileSpreadsheet, Loader2, X } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';
import WatchlistImporter from '@/components/WatchlistImporter';

const TYPE_LABELS = {
  phone_log: 'سجل مكالمات',
  financial_transaction: 'معاملة مالية',
  police_report: 'تقرير شرطة',
  intelligence_report: 'تقرير تحليلي',
  other: 'أخرى'
};

export default function Import() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState('other');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const inputRef = useRef(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setTitle('');
    setDocType('other');
    setStage('');
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      if (!title) setTitle(f.name.replace(/\.(csv|xlsx?)$/i, ''));
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast({ title: 'اختر ملف CSV أولاً', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setStage('رفع الملف...');
    try {
      const { file_url } = await localClient.integrations.Core.UploadFile({ file });
      setStage('استخراج الصفوف وإنشاء الكيانات...');
      const res = await localClient.functions.invoke('importCsv', {
        file_url,
        title: title || file.name,
        document_type: docType
      });
      const result = res.data || {};
      toast({
        title: 'تم الاستيراد بنجاح',
        description: `الكيانات: ${result.entity_count || 0} • الروابط: ${result.connection_count || 0}`
      });
      reset();
      if (inputRef.current) inputRef.current.value = '';
      navigate(`/documents/${result.document_id}`);
    } catch (err) {
      toast({ title: 'فشل الاستيراد', description: err.message, variant: 'destructive' });
      setStage('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="font-heading text-2xl font-bold">استيراد بيانات CSV</h1>
        <p className="text-sm text-muted-foreground mt-1">
          ارفع ملف CSV لإنشاء كيانات مباشرة. يُكتشف عمود الاسم تلقائياً، وباقي الأعمدة تُخزّن كسمات.
          إن وُجدت أعمدة «مصدر» و«هدف» تُنشأ روابط بين الكيانات.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        {!file ? (
          <label
            className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-10 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) {
                setFile(f);
                if (!title) setTitle(f.name.replace(/\.(csv|xlsx?)$/i, ''));
              }
            }}
          >
            <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">اسحب ملف CSV هنا أو انقر للاختيار</span>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={onPick}
            />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
              <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
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
                <label className="text-xs text-muted-foreground mb-1 block">عنوان البيانات</label>
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
                onClick={handleImport}
                disabled={busy}
                className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                {busy ? 'جارٍ الاستيراد...' : 'استيراد'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-accent/30 p-4 text-xs text-muted-foreground leading-relaxed space-y-3">
        <div>
          <div className="font-medium text-foreground mb-1.5">تنسيق ملف CSV المطلوب</div>
          <p className="mb-2">ارفع ملف CSV يحتوي صفوفاً لكل كيان (شخص أو شركة). يُكتشف عمود الاسم تلقائياً (عربي/إنجليزي)، وباقي الأعمدة تُخزّن كسمات للكيان.</p>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-foreground">
                <tr>
                  <th className="text-right font-medium px-3 py-1.5">العمود</th>
                  <th className="text-right font-medium px-3 py-1.5">مطلوب</th>
                  <th className="text-right font-medium px-3 py-1.5">الوصف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="px-3 py-1.5 font-mono">name / الاسم</td><td className="px-3 py-1.5">نعم</td><td className="px-3 py-1.5">اسم الكيان</td></tr>
                <tr><td className="px-3 py-1.5 font-mono">type / النوع</td><td className="px-3 py-1.5">اختياري</td><td className="px-3 py-1.5">person · company · organization · phone · email · location</td></tr>
                <tr><td className="px-3 py-1.5 font-mono">source / مصدر</td><td className="px-3 py-1.5">اختياري</td><td className="px-3 py-1.5">اسم الكيان المصدر لإنشاء رابط</td></tr>
                <tr><td className="px-3 py-1.5 font-mono">target / هدف</td><td className="px-3 py-1.5">اختياري</td><td className="px-3 py-1.5">اسم الكيان الهدف لإنشاء رابط</td></tr>
                <tr><td className="px-3 py-1.5 font-mono">relationship / العلاقة</td><td className="px-3 py-1.5">اختياري</td><td className="px-3 py-1.5">نوع العلاقة (يعمل لدى، يملك...)</td></tr>
                <tr><td className="px-3 py-1.5 font-mono">أي أعمدة أخرى</td><td className="px-3 py-1.5">اختياري</td><td className="px-3 py-1.5">تُخزّن كسمات (passport, phone, nationality, dob...)</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="font-medium text-foreground mb-1.5">أمثلة</div>
          <div className="font-mono text-[11px] bg-card border border-border rounded-md p-2.5 overflow-x-auto" dir="ltr">
            <div className="text-muted-foreground"># أشخاص محل اهتمام</div>
            <div>name,type,passport,nationality,phone</div>
            <div>Ahmad Abdullah,person,A1234567,Syrian,+963991234567</div>
            <div className="mt-2 text-muted-foreground"># شركات</div>
            <div>name,type,registration,phone</div>
            <div>United Transport Co,company,REG-991,+963114445566</div>
            <div className="mt-2 text-muted-foreground"># روابط بين الكيانات</div>
            <div>source,target,relationship</div>
            <div>Ahmad Abdullah,United Transport Co,works at</div>
          </div>
        </div>
        <p className="text-muted-foreground">الكيانات المكررة تُوحَّد تلقائياً مع الموجود بالاسم أو الأسماء البديلة.</p>
      </div>

      <WatchlistImporter />
    </div>
  );
}