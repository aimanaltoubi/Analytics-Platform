import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { localClient } from '@/api/localClient';

const stages = {
  evidence: 'جمع الأدلة', entities: 'مراجعة الكيانات', relationships: 'مراجعة الروابط',
  review: 'مراجعة الثغرات', summary: 'تلخيص الأدلة', completed: 'اكتمل', stopped: 'توقف', interrupted: 'انقطع'
};
const statuses = { running: 'جارٍ التنفيذ', completed: 'مكتمل', failed: 'فشل', cancelled: 'ملغي', interrupted: 'انقطع' };
const workers = { evidence: 'الأدلة', entity: 'الكيانات', relationship: 'الروابط', review: 'المراجعة', summary: 'الملخص' };
const reviews = { pending: 'بانتظار المراجعة', accepted: 'مقبول', rejected: 'مرفوض' };

export default function InvestigationBlackboard({ workspace }) {
  const [entities, setEntities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [entityIds, setEntityIds] = useState([]);
  const [documentIds, setDocumentIds] = useState([]);
  const [question, setQuestion] = useState('');
  const [boards, setBoards] = useState([]);
  const [board, setBoard] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      Promise.all((workspace.entity_ids || []).map((id) => localClient.entities.Entity.get(id))),
      Promise.all((workspace.document_ids || []).map((id) => localClient.entities.Document.get(id))),
      localClient.entities.Investigation.filter({ workspace_id: workspace.id }, '-created_date', 100)
    ]).then(([nextEntities, nextDocuments, nextBoards]) => {
      if (!active) return;
      setEntities(nextEntities);
      setDocuments(nextDocuments);
      setBoards(nextBoards);
      setBoard((current) => current || nextBoards[0] || null);
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [workspace.id, workspace.entity_ids, workspace.document_ids]);

  useEffect(() => {
    if (!board || board.status !== 'running') return undefined;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const updated = await localClient.entities.Investigation.get(board.id);
        if (active) setBoard(updated);
      } catch (err) {
        if (active) setError(err.message);
      }
    }, 2000);
    return () => { active = false; clearInterval(timer); };
  }, [board?.id, board?.status]);

  const toggle = (id, setter) => setter((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const start = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const created = await localClient.blackboard.start({ workspace_id: workspace.id, question, entity_ids: entityIds, document_ids: documentIds });
      setBoard(created);
      setBoards((current) => [created, ...current]);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { setBoard(await localClient.blackboard.cancel(board.id)); setError(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const review = async (item, decision) => {
    setBusy(true);
    try { setBoard(await localClient.blackboard.review(board.id, item.id, decision)); setError(''); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={start} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading font-semibold">لوحة التحقيق المشتركة · Investigation Blackboard</h3>
        <p className="text-sm text-muted-foreground">اختر ٢–١٠ كيانات و١–١٠ مستندات معالجة من مساحة العمل. تعمل الأدوار محلياً؛ لا تُعدّل السجلات تلقائياً.</p>
        <label className="block text-sm">سؤال التحقيق
          <textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1500} rows={2} className="mt-1 w-full rounded-md border border-input bg-background p-2" required />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="max-h-48 space-y-1 overflow-auto rounded-md border border-border p-3">
            <legend className="text-sm font-medium">الكيانات ({entityIds.length}/10)</legend>
            {entities.map((entity) => <label key={entity.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={entityIds.includes(entity.id)} onChange={() => toggle(entity.id, setEntityIds)} /> {entity.name} ({entity.type})</label>)}
            {!entities.length && <p className="text-sm text-muted-foreground">أضف كيانات إلى مساحة العمل.</p>}
          </fieldset>
          <fieldset className="max-h-48 space-y-1 overflow-auto rounded-md border border-border p-3">
            <legend className="text-sm font-medium">المستندات ({documentIds.length}/10)</legend>
            {documents.map((doc) => <label key={doc.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={doc.status !== 'processed'} checked={documentIds.includes(doc.id)} onChange={() => toggle(doc.id, setDocumentIds)} /> {doc.title} {doc.status !== 'processed' && '(غير معالج)'}</label>)}
            {!documents.length && <p className="text-sm text-muted-foreground">أضف مستندات إلى مساحة العمل.</p>}
          </fieldset>
        </div>
        <button disabled={busy || board?.status === 'running' || entityIds.length < 2 || entityIds.length > 10 || documentIds.length < 1 || documentIds.length > 10 || !question.trim()} className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">بدء التحقيق</button>
      </form>

      {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{error}</p>}
      {boards.length > 0 && <label className="block text-sm">التحقيقات السابقة
        <select value={board?.id || ''} onChange={async (event) => {
          try { setBoard(await localClient.entities.Investigation.get(event.target.value)); setError(''); } catch (err) { setError(err.message); }
        }} className="mr-2 rounded-md border border-input bg-background p-2">
          {boards.map((item) => <option key={item.id} value={item.id}>{item.question} — {new Date(item.created_date).toLocaleString()}</option>)}
        </select>
      </label>}
      {board && <section className="space-y-4 rounded-xl border border-border bg-card p-5" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-semibold">{board.question}</h3><p className="text-sm text-muted-foreground">{statuses[board.status]} · {stages[board.stage] || board.stage}</p></div>
          {board.status === 'running' && <button type="button" disabled={busy} onClick={cancel} className="rounded-md border border-border px-3 py-1 text-sm">إلغاء التحقيق</button>}
        </div>
        {board.error && <p className="text-sm text-destructive">{board.error}</p>}
        <p className="text-xs text-muted-foreground">النتائج اقتراحات وليست حقائق مؤكدة. طابق الاقتباس مع السياق الحالي؛ قد يتغير المصدر بعد التحقيق. راجع التناقضات يدوياً.</p>
        {board.findings.map((item) => <article key={item.id} className="space-y-2 rounded-md border border-border p-3">
          <div className="text-xs text-muted-foreground">{workers[item.worker] || item.worker} · {reviews[item.review] || item.review}</div>
          <p className="text-sm whitespace-pre-wrap">{item.text}</p>
          {item.source && <Link className="block border-r-2 border-emerald-500 bg-emerald-50/60 p-2 text-sm text-emerald-950" to={`/documents/${item.source.document_id}${item.source.page ? `#page-${item.source.page}` : '#document-source'}`}>
            {item.source.title}{item.source.page ? ` · صفحة ${item.source.page}` : ''}<span className="mt-1 block whitespace-pre-wrap">“{item.source.text}”</span>
          </Link>}
          <div className="flex gap-2">
            {['accepted', 'rejected', 'pending'].map((decision) => <button key={decision} type="button" disabled={busy || item.review === decision} onClick={() => review(item, decision)} className="rounded border border-border px-2 py-1 text-xs disabled:opacity-50">{reviews[decision]}</button>)}
          </div>
        </article>)}
        {!board.findings.length && <p className="text-sm text-muted-foreground">لا توجد نتائج بعد.</p>}
        {board.review_history.length > 0 && <details><summary className="cursor-pointer text-sm">سجل المراجعة ({board.review_history.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{board.review_history.map((entry, index) => <li key={`${entry.finding_id}-${index}`}>{entry.actor} · {reviews[entry.decision]} · {new Date(entry.date).toLocaleString()} · {board.findings.find((item) => item.id === entry.finding_id)?.text}</li>)}</ul>
        </details>}
      </section>}
    </div>
  );
}
