import { useState } from 'react';
import { Presentation, Download, Loader2 } from 'lucide-react';
import { buildPresentation } from '@/lib/buildPresentation';
import { useToast } from '@/components/ui/use-toast';

export default function PresentationPage() {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setBusy(true);
    try {
      await buildPresentation();
      toast({ title: 'تم إنشاء العرض التقديمي', description: 'تحقق من مجلد التنزيلات' });
    } catch (err) {
      toast({ title: 'تعذّر إنشاء العرض', description: err.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Presentation className="w-6 h-6 text-primary" /> العرض التقديمي للنظام
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          أنشئ عرضاً تقديمياً (PowerPoint) شاملاً يغطي جميع وحدات النظام الـ١٧ بمزاياها وتخطيط شاشاتها — جاهز للعرض مباشرة.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> شريحة غلاف ومحتويات ومقدمة</div>
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> شريحة لكل وحدة (١٧ وحدة) بالمزايا والمسار</div>
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> شريحة ختامية</div>
          <div className="flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary" /> تنسيق عربي يميني (RTL) بألوان النظام الموحّدة</div>
        </div>
        <button
          onClick={handleDownload}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {busy ? 'جارٍ إنشاء العرض...' : 'تحميل العرض التقديمي (PPTX)'}
        </button>
      </div>

      <div className="rounded-lg bg-accent/40 border border-border p-4 text-xs text-muted-foreground leading-relaxed">
        ملاحظة: الشرائح تحتوي على وصف المزايا ومخطط تخطيطي لكل شاشة — لا لقطات حيّة فعلية، لأن التقاط شاشات التطبيق الجاري غير متاح آلياً. يمكنك لاحقاً إدراج لقطات يدوية في الشرائح إن لزم.
      </div>
    </div>
  );
}