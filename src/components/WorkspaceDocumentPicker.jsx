import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X, FileText, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function WorkspaceDocumentPicker({ workspace, allDocuments, selectedDocuments, onChange }) {
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const { toast } = useToast();

  const wsDocIds = new Set(workspace.document_ids || []);
  const results = search
    ? allDocuments.filter((d) => !wsDocIds.has(d.id) && (d.title || '').toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  const addDocument = async (docId) => {
    const updated = [...(workspace.document_ids || []), docId];
    await base44.entities.Workspace.update(workspace.id, { document_ids: updated });
    setSearch('');
    onChange();
  };

  const removeDocument = async (docId) => {
    const updated = (workspace.document_ids || []).filter((id) => id !== docId);
    await base44.entities.Workspace.update(workspace.id, { document_ids: updated });
    onChange();
  };

  const addEntitiesFromDoc = async (docId) => {
    setBusy(docId);
    try {
      const mentions = await base44.entities.Mention.filter({ document_id: docId }, '-created_date', 500);
      const entityIds = [...new Set(mentions.map((m) => m.entity_id).filter(Boolean))];
      const current = new Set(workspace.entity_ids || []);
      const toAdd = entityIds.filter((id) => !current.has(id));
      if (toAdd.length === 0) {
        toast({ title: 'جميع كيانات هذا المستند موجودة مسبقاً' });
        return;
      }
      const updated = [...(workspace.entity_ids || []), ...toAdd];
      await base44.entities.Workspace.update(workspace.id, { entity_ids: updated });
      toast({ title: `تمت إضافة ${toAdd.length} كيان من المستند` });
      onChange();
    } catch (e) {
      toast({ title: 'تعذّر إضافة الكيانات', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> المستندات ({selectedDocuments.length})</h3>
      <div className="relative mb-3">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن مستند لإضافته..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-auto">
            {results.map((d) => (
              <button key={d.id} onClick={() => addDocument(d.id)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 text-right">
                <span className="truncate">{d.title}</span>
                <Plus className="w-4 h-4 text-primary shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedDocuments.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد مستندات بعد. ابحث وأضف مستندات لتحليلها، ثم استورد كيانات كل مستند بنقرة واحدة.</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-auto">
          {selectedDocuments.map((d) => (
            <div key={d.id} className="rounded-lg bg-accent/40 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <Link to={`/documents/${d.id}`} className="text-sm font-medium hover:underline truncate">{d.title}</Link>
                <button onClick={() => removeDocument(d.id)} className="text-muted-foreground hover:text-destructive shrink-0"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex items-center justify-between mt-1.5 gap-2">
                <span className="text-xs text-muted-foreground">{d.entity_count || 0} كيان • {d.connection_count || 0} رابط</span>
                <button onClick={() => addEntitiesFromDoc(d.id)} disabled={busy === d.id} className="inline-flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50 shrink-0">
                  <Users className="w-3.5 h-3.5" />
                  {busy === d.id ? 'جارٍ...' : 'إضافة كل كيانات المستند'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}