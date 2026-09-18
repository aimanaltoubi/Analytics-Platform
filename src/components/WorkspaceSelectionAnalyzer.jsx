import { useState, useMemo } from 'react';
import { Share2, FileText, Users, Search, Play, X, Check, RotateCcw } from 'lucide-react';
import NetworkGraph from '@/components/NetworkGraph';
import { useToast } from '@/components/ui/use-toast';

export default function WorkspaceSelectionAnalyzer({ entities, documents, connections }) {
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [selectedEnts, setSelectedEnts] = useState(new Set());
  const [entFilter, setEntFilter] = useState('');
  const [analyzed, setAnalyzed] = useState(null);
  const { toast } = useToast();

  const toggleDoc = (id) =>
    setSelectedDocs((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const toggleEnt = (id) =>
    setSelectedEnts((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const clearAll = () => {
    setSelectedDocs(new Set());
    setSelectedEnts(new Set());
    setAnalyzed(null);
  };

  const filteredEnts = useMemo(() => {
    const q = entFilter.trim().toLowerCase();
    return q ? entities.filter((e) => (e.name || '').toLowerCase().includes(q)) : entities;
  }, [entities, entFilter]);

  const hasSelection = selectedDocs.size > 0 || selectedEnts.size > 0;

  const runAnalysis = () => {
    // كيانات المستندات المحددة: من حقل document_ids على الكيان + من روابط المستندات
    const docEntityIds = new Set();
    entities.forEach((e) => {
      (e.document_ids || []).forEach((did) => {
        if (selectedDocs.has(did)) docEntityIds.add(e.id);
      });
    });
    connections.forEach((c) => {
      if (selectedDocs.has(c.document_id)) {
        docEntityIds.add(c.source_entity_id);
        docEntityIds.add(c.target_entity_id);
      }
    });

    const entitySet = new Set([...selectedEnts, ...docEntityIds]);
    const subEntities = entities.filter((e) => entitySet.has(e.id));
    const subConnections = connections.filter(
      (c) => entitySet.has(c.source_entity_id) && entitySet.has(c.target_entity_id)
    );

    if (subEntities.length === 0) {
      toast({ title: 'لا توجد كيانات في التحديد', description: 'اختر مستندات أو كيانات أولاً', variant: 'destructive' });
      return;
    }

    setAnalyzed({
      entities: subEntities,
      connections: subConnections,
      fromDocs: selectedDocs.size,
      fromEntities: selectedEnts.size,
    });
  };

  const DocCheck = ({ id }) => (
    <button
      onClick={() => toggleDoc(id)}
      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
        selectedDocs.has(id) ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'
      }`}
    >
      {selectedDocs.has(id) && <Check className="w-3.5 h-3.5" />}
    </button>
  );

  const EntCheck = ({ id }) => (
    <button
      onClick={() => toggleEnt(id)}
      className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
        selectedEnts.has(id) ? 'bg-primary border-primary text-primary-foreground' : 'border-border bg-background hover:border-primary/50'
      }`}
    >
      {selectedEnts.has(id) && <Check className="w-3.5 h-3.5" />}
    </button>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" /> محلل التحديد المرن
        </h3>
        <p className="text-xs text-muted-foreground">حدد مستندات معينة أو كيانات محددة — أو كليهما — ثم ابدأ تحليل الروابط على هذا التحديد فقط.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* اختيار المستندات */}
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><FileText className="w-4 h-4 text-primary" /> المستندات</div>
            <span className="text-xs text-muted-foreground">{selectedDocs.size}/{documents.length}</span>
          </div>
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">لا توجد مستندات في مساحة العمل.</p>
          ) : (
            <div className="space-y-1 max-h-56 overflow-auto">
              {documents.map((d) => (
                <label key={d.id} className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-accent/50 cursor-pointer">
                  <DocCheck id={d.id} />
                  <span className="text-sm truncate flex-1">{d.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{d.entity_count || 0} كيان</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* اختيار الكيانات */}
        <div className="rounded-lg border border-border bg-background p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium"><Users className="w-4 h-4 text-primary" /> الكيانات</div>
            <span className="text-xs text-muted-foreground">{selectedEnts.size}/{entities.length}</span>
          </div>
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              value={entFilter}
              onChange={(e) => setEntFilter(e.target.value)}
              placeholder="تصفية الكيانات..."
              className="w-full pr-8 pl-2.5 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {entities.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 text-center">لا توجد كيانات في مساحة العمل.</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-auto">
              {filteredEnts.map((e) => (
                <label key={e.id} className="flex items-center gap-2.5 p-1.5 rounded-md hover:bg-accent/50 cursor-pointer">
                  <EntCheck id={e.id} />
                  <span className="text-sm truncate flex-1">{e.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{e.mention_count || 0} ذكر</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={runAnalysis}
          disabled={!hasSelection}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          <Play className="w-4 h-4" /> بدء تحليل الروابط على التحديد
        </button>
        {hasSelection && (
          <button onClick={clearAll} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-border hover:bg-accent">
            <RotateCcw className="w-3.5 h-3.5" /> مسح التحديد
          </button>
        )}
      </div>

      {analyzed && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Share2 className="w-4 h-4 text-primary" /> نتيجة التحليل
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{analyzed.entities.length} كيان</span>
              <span>•</span>
              <span>{analyzed.connections.length} رابط</span>
              <button onClick={() => setAnalyzed(null)} className="text-muted-foreground hover:text-destructive mr-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {analyzed.connections.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">لا توجد روابط بين الكيانات المحددة. جرّب إضافة كيانات أخرى أو مستندات إضافية.</p>
          ) : (
            <NetworkGraph entities={analyzed.entities} connections={analyzed.connections} height={420} />
          )}
        </div>
      )}
    </div>
  );
}