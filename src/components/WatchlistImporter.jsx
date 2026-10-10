import { useState, useRef } from 'react';
import { UploadCloud, Flag, Loader2, X, ListChecks } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const header = lines[0].split(/[,;\t]/).map((h) => h.trim().toLowerCase());
  let nameIdx = header.findIndex((h) => /name|اسم|الاسم/.test(h));
  const start = nameIdx >= 0 ? 1 : 0;
  if (nameIdx < 0) nameIdx = 0;
  const names = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/);
    const v = (cols[nameIdx] || '').trim().replace(/^["']|["']$/g, '');
    if (v) names.push(v);
  }
  return names;
}

export default function WatchlistImporter() {
  const [names, setNames] = useState([]);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [risk, setRisk] = useState(80);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const r = new FileReader();
    r.onload = () => setNames(parseCsv(String(r.result)));
    r.readAsText(f);
  };

  const reset = () => {
    setNames([]);
    setFileName('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const submit = async () => {
    if (!names.length) {
      toast({ title: 'لا توجد أسماء في الملف', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const res = await localClient.functions.invoke('importWatchlist', { names, risk_score: risk });
      const r = res.data || {};
      toast({
        title: 'تم استيراد قائمة المراقبة',
        description: `مطابق لكيانات موجودة: ${r.matched || 0} • كيانات جديدة: ${r.created || 0}`
      });
      reset();
    } catch (err) {
      toast({ title: 'فشل الاستيراد', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">
          <Flag className="w-5 h-5 text-amber-500" /> استيراد قائمة مراقبة
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          ارفع ملف CSV بأسماء المشتبه بهم. تُطابَق الأسماء آلياً مع الكيانات الموجودة (بالتطبيع الصوتي) وتُعلَّم للمراقبة، أو تُنشأ ككيانات جديدة على قائمة المراقبة.
        </p>
      </div>

      {!fileName ? (
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-amber-400/60 hover:bg-amber-50/30 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) {
              setFileName(f.name);
              const r = new FileReader();
              r.onload = () => setNames(parseCsv(String(r.result)));
              r.readAsText(f);
            }
          }}
        >
          <UploadCloud className="w-7 h-7 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">اسحب ملف CSV بقائمة الأسماء هنا أو انقر للاختيار</span>
          <input ref={inputRef} type="file" accept=".csv,.txt" className="hidden" onChange={onPick} />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-accent/50 p-3">
            <ListChecks className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{fileName}</div>
              <div className="text-xs text-muted-foreground">{names.length} اسم مُكتشف</div>
            </div>
            {!busy && <button onClick={reset} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground shrink-0">درجة الخطورة الافتراضية</label>
            <input type="range" min={0} max={100} value={risk} onChange={(e) => setRisk(Number(e.target.value))} className="flex-1 accent-amber-500" />
            <span className="text-sm font-bold w-8 text-center">{risk}</span>
          </div>

          {names.length > 0 && (
            <div className="max-h-40 overflow-auto rounded-lg border border-border p-2">
              <div className="flex flex-wrap gap-1.5">
                {names.slice(0, 60).map((n, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">{n}</span>
                ))}
                {names.length > 60 && <span className="text-xs text-muted-foreground self-center">+{names.length - 60}</span>}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button onClick={reset} disabled={busy} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent transition-colors disabled:opacity-50">إلغاء</button>
            <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
              {busy ? 'جارٍ الاستيراد...' : 'استيراد وإضافة للمراقبة'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}