import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, BookOpen, Loader2, MessageCircle, RotateCcw } from 'lucide-react';
import { localClient } from '@/api/localClient';

function ChatSources({ citations }) {
  return (
    <div className="mt-3 space-y-2">
      {citations.map((citation, index) => {
        const source = citation.source;
        const pageAnchor = source.kind === 'document' && source.page ? `#page-${source.page}` : '#document-source';
        const target = source.kind === 'document' ? `/documents/${source.document_id}${pageAnchor}` : `/entities/${source.entity_id}`;
        const location = source.kind === 'document' && source.page ? ` · صفحة ${source.page}` : '';
        return (
          <Link key={`${citation.source_id}-${index}`} to={target} className="block border-r-2 border-emerald-500 bg-emerald-50/60 px-3 py-2 text-right hover:bg-emerald-50">
            <span className="text-xs font-medium text-emerald-900">{source.title}{location}</span>
            <span className="mt-1 block text-xs leading-relaxed text-emerald-950">“{citation.quote}”</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function EvidenceChat() {
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  const ask = async (event) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || busy) return;
    const history = messages.map((message) => ({
      role: message.role,
      content: message.role === 'assistant'
        ? message.claims?.map((claim) => claim.text).join('\n') || message.reason || ''
        : message.content
    }));
    setMessages((current) => [...current, { role: 'user', content: text }]);
    setQuestion('');
    setBusy(true);
    try {
      const response = await localClient.functions.invoke('askEvidence', { question: text, history });
      setMessages((current) => [...current, { role: 'assistant', ...response.data }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'error', content: error.message }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 sm:px-6">
      <header className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" /> مصادر النظام المحلية
          </div>
          <h1 className="font-heading text-2xl font-bold">مساعد الأدلة</h1>
          <p className="mt-1 text-sm text-muted-foreground">تُعرض الإجابات مع اقتباسات قابلة للتحقق من المستندات أو ملفات الكيانات.</p>
        </div>
        {messages.length > 0 && (
          <button onClick={() => setMessages([])} title="محادثة جديدة" aria-label="محادثة جديدة" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent">
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="flex-1 space-y-5 pb-6" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center text-center text-muted-foreground">
            <MessageCircle className="mb-3 h-9 w-9 opacity-50" />
            <p className="text-sm">اسأل عن معلومة في المستندات أو ملفات الأفراد والشركات والمنظمات.</p>
          </div>
        ) : messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-3xl ${message.role === 'user' ? 'mr-auto' : 'ml-auto'} ${message.role === 'error' ? 'text-destructive' : ''}`}>
            {message.role === 'user' ? (
              <div className="rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">{message.content}</div>
            ) : message.role === 'error' ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">تعذر إكمال السؤال: {message.content}</div>
            ) : message.abstained ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">{message.reason}</div>
            ) : (
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="space-y-4">
                  {message.claims.map((claim, claimIndex) => (
                    <div key={`${claim.text}-${claimIndex}`}>
                      <p className="text-sm leading-relaxed">{claim.text}</p>
                      <ChatSources citations={claim.citations} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="ml-auto flex max-w-3xl items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> يبحث في المصادر المحلية ويحلل الأدلة...
          </div>
        )}
      </div>

      <form onSubmit={ask} className="sticky bottom-0 border-t border-border bg-background/95 py-4 backdrop-blur">
        <label htmlFor="evidence-question" className="sr-only">سؤالك</label>
        <div className="flex items-end gap-2">
          <textarea
            id="evidence-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            rows={2}
            maxLength={1500}
            placeholder="اكتب سؤالاً عن سجلات النظام..."
            className="min-h-12 flex-1 resize-y rounded-md border border-input bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" disabled={busy || !question.trim()} title="إرسال السؤال" aria-label="إرسال السؤال" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}