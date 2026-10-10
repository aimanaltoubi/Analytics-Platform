import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Languages, Search, Loader2, AlertTriangle, FileText, ArrowLeftRight } from 'lucide-react';
import { localClient } from '@/api/localClient';

export default function CrossLingualSearch() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const run = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await localClient.functions.invoke('crossLingualSearch', { query: query.trim() });
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'فشل البحث');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <Languages className="w-6 h-6 text-primary" /> البحث عبر اللغات (CLIR)
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ابحث بأي لغة — يُترجَم استعلامك آلياً إلى العربية للبحث في الوثائق، وتُعرَض النتائج مع ترجمة إنجليزية وكيانات مشبوهة مُبرَزة.
        </p>
      </div>

      <form onSubmit={run} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute top-1/2 -translate-y-1/2 right-3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="مثال: fertilizer purchase — أو أي استعلام بلغتك"
            className="w-full rounded-lg border border-input bg-background pr-10 pl-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          بحث
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm px-4 py-3">
          {error}
        </div>
      )}

      {result && (
        <>
          {/* ترجمات الاستعلام */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-3">
              <ArrowLeftRight className="w-4 h-4" /> ترجمات الاستعلام
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg bg-accent/40 p-3">
                <div className="text-[11px] text-muted-foreground">الأصلي ({result.query.source_language || '—'})</div>
                <div className="text-sm font-medium mt-1" dir="auto">{result.query.original}</div>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <div className="text-[11px] text-muted-foreground">العربية</div>
                <div className="text-sm font-medium mt-1" dir="rtl">{result.query.arabic}</div>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <div className="text-[11px] text-muted-foreground">English</div>
                <div className="text-sm font-medium mt-1" dir="ltr">{result.query.english}</div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-3">
              إجمالي المطابقات: {result.total_matches || 0}
            </div>
          </div>

          {/* النتائج */}
          {result.documents && result.documents.length > 0 ? (
            <div className="space-y-3">
              {result.documents.map((d) => (
                <div key={d.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/documents/${d.id}`} className="flex items-center gap-2 text-sm font-semibold hover:underline">
                      <FileText className="w-4 h-4 text-primary" /> {d.title}
                    </Link>
                    <span className="text-[11px] text-muted-foreground">ملاءمة: {d.score?.toFixed(1)}</span>
                  </div>

                  {d.suspicious_entities && d.suspicious_entities.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      {d.suspicious_entities.map((n, i) => (
                        <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700" dir="auto">
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  {d.arabic_snippet && (
                    <div className="rounded-lg bg-accent/30 p-3 text-sm leading-relaxed" dir="rtl">
                      {d.arabic_snippet}
                    </div>
                  )}

                  {d.english_translation && (
                    <div className="rounded-lg bg-muted/40 p-3 text-sm leading-relaxed border-s-2 border-primary/40" dir="ltr">
                      <div className="text-[11px] text-muted-foreground mb-1">English translation</div>
                      {d.english_translation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              لا توجد وثائق مطابقة للاستعلام.
            </div>
          )}
        </>
      )}
    </div>
  );
}