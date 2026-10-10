import { useState, useRef } from 'react';
import { UploadCloud, FileText, Loader2, X, Sparkles } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';

export default function ManifestTextUploader({ onExtracted }) {
  const [file, setFile] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const { toast } = useToast();

  const reset = () => {
    setFile(null);
    setText('');
    setStage('');
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onPick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setStage('قراءة الملف...');
    const reader = new FileReader();
    reader.onload = () => {
      setText((reader.result || '').toString());
      setStage('');
    };
    reader.onerror = () => {
      toast({ title: 'تعذّر قراءة الملف', variant: 'destructive' });
      setStage('');
    };
    reader.readAsText(f);
  };

  const handleExtract = async () => {
    const content = text.trim();
    if (!content) {
      toast({ title: 'أدخل نصاً أو ارفع ملفاً أولاً', variant: 'destructive' });
      return;
    }
    setBusy(true);
    setStage('استخراج الحقول التحقيقية بالذكاء الاصطناعي...');
    try {
      const res = await localClient.functions.invoke('extractManifestFromText', {
        text: content,
        filename: file?.name || ''
      });
      const r = res.data || res;
      setResult(r);
      toast({
        title: 'تم استخراج البيان وفحصه',
        description: `الركاب: ${r.passengers_extracted || 0} • الشحن: ${r.cargo_extracted || 0}${r.screening?.passengers_flagged ? ' • علم: ' + r.screening.passengers_flagged : ''}`
      });
      onExtracted && onExtracted(r);
    } catch (err) {
      toast({ title: 'فشل الاستخراج', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
      setStage('');
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <h3 className="font-heading font-semibold">استيراد من نص/ملف نصي</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            ارفع ملفاً نصياً (.txt) أو الصق سرداً عن شخص/رحلة، فيستخرج المحرك تلقائياً الحقول التحقيقية (الاسم، الجواز، الجنسية، الناقل، الرحلة) ويفحصها.
          </p>
        </div>
      </div>

      {!file ? (
        <label
          className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-lg py-8 cursor-pointer hover:border-primary/50 hover:bg-accent/40 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f) {
              setFile(f);
              const reader = new FileReader();
              reader.onload = () => setText((reader.result || '').toString());
              reader.readAsText(f);
            }
          }}
        >
          <FileText className="w-7 h-7 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">اسحب ملف .txt هنا أو انقر للاختيار</span>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,text/plain"
            className="hidden"
            onChange={onPick}
          />
        </label>
      ) : (
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
      )}

      <div>
        <label className="text-xs text-muted-foreground mb-1 block">أو الصق النص مباشرة</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
          rows={5}
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          placeholder="مثال: الراكب سامي حسن، يحمل جواز سفر رقم P998877، الجنسية لبنانية، موعده على متن الرحلة XY123 التابعة للخطوط الجوية من دمشق إلى بيروت يوم 20 أغسطس 2026..."
        />
      </div>

      {busy && stage && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          {stage}
        </div>
      )}

      {result && (
        <div className="rounded-lg bg-emerald-50/60 border border-emerald-200/60 p-3 text-sm space-y-1">
          <div className="font-medium text-emerald-800">تم إنشاء البيان {result.voyage_number} ({result.carrier})</div>
          <div className="text-xs text-emerald-700">
            النوع: {result.manifest_type === 'cargo' ? 'شحن' : 'ركاب'} • الركاب: {result.passengers_extracted || 0} • الشحن: {result.cargo_extracted || 0}
            {result.screening?.status === 'flagged' && ' • الحالة: معلّم'}
            {result.screening?.status === 'cleared' && ' • الحالة: مُخلى'}
          </div>
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
          onClick={handleExtract}
          disabled={busy || !text.trim()}
          className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
          {busy ? 'جارٍ الاستخراج...' : 'استخراج وفحص'}
        </button>
      </div>
    </div>
  );
}