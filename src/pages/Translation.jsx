import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRightLeft, FileText, Languages, Loader2, RotateCcw } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';

const TARGETS = [
  { code: 'ar', label: 'العربية', native: 'Arabic' },
  { code: 'en', label: 'الإنجليزية', native: 'English' },
  { code: 'zh', label: 'الصينية المبسطة', native: 'Simplified Chinese' },
  { code: 'ru', label: 'الروسية', native: 'Russian' },
  { code: 'es', label: 'الإسبانية', native: 'Spanish' },
  { code: 'fr', label: 'الفرنسية', native: 'French' },
  { code: 'de', label: 'الألمانية', native: 'German' },
  { code: 'pt', label: 'البرتغالية', native: 'Portuguese' },
  { code: 'it', label: 'الإيطالية', native: 'Italian' },
  { code: 'ja', label: 'اليابانية', native: 'Japanese' }
];

export default function Translation() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedDocumentId = searchParams.get('document_id') || '';
  const [documents, setDocuments] = useState([]);
  const [translations, setTranslations] = useState([]);
  const [selectedId, setSelectedId] = useState(requestedDocumentId);
  const [targetLanguage, setTargetLanguage] = useState('ar');
  const [loading, setLoading] = useState(true);
  const [translating, setTranslating] = useState(false);
  const [query, setQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const all = await localClient.entities.Document.list('-created_date', 1000);
        const processed = all.filter((doc) => doc.status === 'processed' && (doc.pages?.length || doc.raw_text));
        setDocuments(processed);
        if (!selectedId && processed.length) setSelectedId(processed[0].id);
      } catch (error) {
        toast({ title: 'تعذر تحميل المستندات', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setTranslations([]);
      return;
    }
    setSearchParams({ document_id: selectedId }, { replace: true });
    localClient.entities.Translation.filter({ document_id: selectedId }, '-created_date', 20)
      .then(setTranslations)
      .catch((error) => toast({ title: 'تعذر تحميل الترجمات', description: error.message, variant: 'destructive' }));
  }, [selectedId, setSearchParams]);

  const selectedDocument = documents.find((doc) => doc.id === selectedId) || null;
  const visibleDocuments = useMemo(() => documents.filter((doc) =>
    !query || doc.title?.toLocaleLowerCase().includes(query.toLocaleLowerCase())
  ), [documents, query]);
  const selectedTranslation = translations.find((item) => item.target_language === targetLanguage) || null;
  const selectedTarget = TARGETS.find((item) => item.code === targetLanguage);

  const translate = async () => {
    if (!selectedDocument || translating) return;
    setTranslating(true);
    try {
      const result = await localClient.functions.invoke('translateDocument', {
        document_id: selectedDocument.id,
        target_language: targetLanguage
      });
      setTranslations((current) => [result.data, ...current.filter((item) => item.target_language !== targetLanguage)]);
      toast({ title: `تمت الترجمة إلى ${selectedTarget.label}`, description: `المقاطع: ${result.data.segments.length}` });
    } catch (error) {
      toast({ title: 'تعذرت الترجمة', description: error.message, variant: 'destructive' });
    } finally {
      setTranslating(false);
    }
  };

  const reset = () => {
    setQuery('');
    setSelectedId('');
    setTranslations([]);
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 p-5 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground"><Languages className="h-4 w-4" /> أدوات المستندات</div>
          <h1 className="font-heading text-2xl font-bold">ترجمة المستندات <span className="text-base font-medium text-muted-foreground">· Local translation</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">ترجمة محلية للمستندات المعالجة مع الحفاظ على تقسيم الصفحات والأرقام والمعرّفات.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedDocument && <Link to={`/documents/${selectedDocument.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs hover:bg-accent"><FileText className="h-3.5 w-3.5" /> فتح المصدر</Link>}
          <button onClick={reset} disabled={!selectedId} title="اختيار مستند آخر" aria-label="اختيار مستند آخر" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent disabled:opacity-50"><RotateCcw className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <aside className="border-y border-border py-3">
          <label htmlFor="translation-search" className="mb-2 block text-xs font-medium text-muted-foreground">المستندات المعالجة</label>
          <input id="translation-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن مستند..." className="mb-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm" />
          {loading ? <p className="py-6 text-center text-xs text-muted-foreground">جارٍ تحميل القائمة...</p> : visibleDocuments.length ? (
            <div className="max-h-[65vh] space-y-1 overflow-y-auto">
              {visibleDocuments.map((doc) => (
                <button key={doc.id} onClick={() => setSelectedId(doc.id)} className={`w-full rounded-md px-3 py-2 text-right ${selectedId === doc.id ? 'bg-primary/10 text-primary' : 'hover:bg-accent/50'}`}>
                  <span className="block truncate text-sm font-medium">{doc.title}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{doc.pages?.length ? `${doc.pages.length} صفحة` : 'نص مستخرج'}</span>
                </button>
              ))}
            </div>
          ) : <p className="py-6 text-center text-xs text-muted-foreground">لا توجد مستندات معالجة تحتوي نصاً.</p>}
        </aside>

        <section className="min-w-0 space-y-4">
          {!selectedDocument ? <div className="border-y border-border py-16 text-center text-sm text-muted-foreground">اختر مستنداً لبدء الترجمة.</div> : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                <div className="min-w-0">
                  <h2 className="truncate font-heading text-lg font-semibold">{selectedDocument.title}</h2>
                  <p className="text-xs text-muted-foreground">المصدر محفوظ كما هو؛ ستُحفظ كل ترجمة منفصلة حسب اللغة.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="translation-target" className="sr-only">لغة الترجمة</label>
                  <select id="translation-target" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} className="rounded-md border border-input bg-card px-3 py-2 text-sm">
                    {TARGETS.map((target) => <option key={target.code} value={target.code}>{target.label} · {target.native}</option>)}
                  </select>
                  <button onClick={translate} disabled={translating} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                    {translating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
                    {translating ? 'جارٍ الترجمة...' : selectedTranslation ? 'إعادة الترجمة' : 'ترجمة محلية'}
                  </button>
                </div>
              </div>

              {selectedTranslation ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-border pb-2 text-xs text-muted-foreground">
                    <span>الترجمة إلى {selectedTarget.label}</span>
                    <span>{new Date(selectedTranslation.updated_date || selectedTranslation.created_date).toLocaleString()}</span>
                  </div>
                  {selectedTranslation.segments.map((segment, index) => (
                    <article key={`${segment.page}-${segment.part}-${index}`} className="grid gap-3 border-b border-border pb-4 md:grid-cols-2">
                      <div className="min-w-0">
                        <div className="mb-1 text-[11px] text-muted-foreground">النص الأصلي{segment.page ? ` · صفحة ${segment.page}` : ''}</div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{segment.source_text}</p>
                      </div>
                      <div className="min-w-0 border-r-2 border-primary/40 pr-3" dir={targetLanguage === 'ar' ? 'rtl' : 'auto'}>
                        <div className="mb-1 text-[11px] text-muted-foreground">{selectedTarget.native}</div>
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{segment.translated_text}</p>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="min-w-0 border-y border-border py-4">
                    <h3 className="mb-2 text-xs font-semibold text-muted-foreground">النص الأصلي</h3>
                    <p className="line-clamp-[20] whitespace-pre-wrap text-sm leading-relaxed">{selectedDocument.raw_text}</p>
                  </div>
                  <div className="flex min-h-48 items-center justify-center border-y border-border py-4 text-center text-sm text-muted-foreground">
                    <span>اختر اللغة واضغط «ترجمة محلية» لإنشاء نسخة مرتبطة بالمصدر.</span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}