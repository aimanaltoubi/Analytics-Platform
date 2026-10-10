import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Plus, X, Users, FileText, Network as NetworkIcon, Clock, Table2, Share2, FileBarChart2 } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import WorkspaceDocumentPicker from '@/components/WorkspaceDocumentPicker';
import WorkspaceSelectionAnalyzer from '@/components/WorkspaceSelectionAnalyzer';
import WorkspacePdfLoader from '@/components/WorkspacePdfLoader';
import WorkspaceCsvExport from '@/components/WorkspaceCsvExport';
import NetworkTab from '@/components/NetworkTab';
import WorkspaceTimelineExplorer from '@/components/WorkspaceTimelineExplorer';
import WorkspaceEntitiesTable from '@/components/WorkspaceEntitiesTable';
import { matchesEntityQuery } from '@/lib/entitySearch';
import InvestigationReport from '@/components/InvestigationReport';

const TYPE_LABELS = { person: 'فرد', company: 'شركة', organization: 'منظمة', phone: 'هاتف', email: 'بريد', location: 'موقع', account: 'حساب', date: 'تاريخ', event: 'حدث', other: 'أخرى' };

export default function WorkspaceDetail() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [entities, setEntities] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [connections, setConnections] = useState([]);
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadAll = async () => {
    setLoading(true);
    try {
      const ws = await localClient.entities.Workspace.get(id);
      setWorkspace(ws);
      const [allEnts, allDocs, allConns] = await Promise.all([
        localClient.entities.Entity.list('-mention_count', 300),
        localClient.entities.Document.list('-created_date', 100),
        localClient.entities.Connection.list('-created_date', 500)
      ]);
      setAllEntities(allEnts);
      setAllDocuments(allDocs);
      setEntities(allEnts.filter((e) => (ws.entity_ids || []).includes(e.id)));
      setDocuments(allDocs.filter((d) => (ws.document_ids || []).includes(d.id)));
      const entIds = new Set(ws.entity_ids || []);
      const docIds = new Set(ws.document_ids || []);
      setConnections(allConns.filter((c) =>
        entIds.has(c.source_entity_id) || entIds.has(c.target_entity_id) || docIds.has(c.document_id)
      ));
    } catch (e) {
      toast({ title: 'تعذّر تحميل مساحة العمل', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const addEntity = async (entityId) => {
    const current = workspace.entity_ids || [];
    if (current.includes(entityId)) return;
    const updated = [...current, entityId];
    await localClient.entities.Workspace.update(id, { entity_ids: updated });
    setWorkspace({ ...workspace, entity_ids: updated });
    setEntities((prev) => [...prev, allEntities.find((e) => e.id === entityId)]);
  };

  const removeEntity = async (entityId) => {
    const updated = (workspace.entity_ids || []).filter((eid) => eid !== entityId);
    await localClient.entities.Workspace.update(id, { entity_ids: updated });
    setWorkspace({ ...workspace, entity_ids: updated });
    setEntities((prev) => prev.filter((e) => e.id !== entityId));
  };

  const availableEntities = allEntities.filter((e) => !(workspace?.entity_ids || []).includes(e.id));
  const searchResults = search
    ? availableEntities.filter((e) => matchesEntityQuery(e, search)).slice(0, 50)
    : availableEntities.slice(0, 50);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (!workspace) return <div className="p-6 text-sm text-muted-foreground">مساحة العمل غير موجودة.</div>;

  const Tab = ({ value, icon: Icon, label }) => (
    <TabsTrigger value={value} className="gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {label}
    </TabsTrigger>
  );

  return (
    <div className="p-6 space-y-5">
      {/* الرأس */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/workspaces" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
            <ArrowRight className="w-3.5 h-3.5" /> مساحات العمل
          </Link>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
            <NetworkIcon className="w-6 h-6 text-primary" /> {workspace.name}
          </h1>
          {workspace.description && <p className="text-sm text-muted-foreground mt-1">{workspace.description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium"><Users className="w-3.5 h-3.5 text-primary" /> {entities.length} كيان</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium"><FileText className="w-3.5 h-3.5 text-primary" /> {documents.length} مستند</span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium"><NetworkIcon className="w-3.5 h-3.5 text-primary" /> {connections.length} رابط</span>
        </div>
      </div>

      {/* لوحة الكيانات السريعة */}
      <div className="rounded-xl border border-border bg-card p-3 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowPicker(true); }}
            onFocus={() => setShowPicker(true)}
            onBlur={() => setTimeout(() => setShowPicker(false), 150)}
            placeholder="أضف كياناً من السجل إلى مساحة العمل..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {showPicker && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-72 overflow-auto">
              {searchResults.length > 0 ? (
                searchResults.map((e) => (
                  <button key={e.id} onMouseDown={(ev) => { ev.preventDefault(); addEntity(e.id); setSearch(''); }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 text-right border-b border-border/40 last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.name}</div>
                      <div className="text-[10px] text-muted-foreground">{TYPE_LABELS[e.type] || e.type}</div>
                    </div>
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">{search ? 'لا توجد نتائج مطابقة' : 'لا توجد كيانات أخرى متاحة'}</div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap max-h-20 overflow-auto">
          {entities.length === 0 ? (
            <span className="text-xs text-muted-foreground">لم تُختر كيانات بعد — أضف من السجل أو اسحبها في شبكة التحليل.</span>
          ) : (
            entities.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1.5 rounded-full bg-accent/50 border border-border px-2.5 py-1 text-xs">
                <Link to={`/entities/${e.id}`} className="font-medium hover:underline">{e.name}</Link>
                <button onClick={() => removeEntity(e.id)} className="text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* التبويبات */}
      <Tabs defaultValue="network" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto">
          <Tab value="network" icon={NetworkIcon} label="شبكة التحليل" />
          <Tab value="timeline" icon={Clock} label="الجدول الزمني" />
          <Tab value="selection" icon={Share2} label="تحليل التحديد" />
          <Tab value="data" icon={Table2} label="البيانات والمستندات" />
          <Tab value="reports" icon={FileBarChart2} label="التقارير والتصدير" />
        </TabsList>

        <TabsContent value="network" className="mt-4">
          <NetworkTab
            entities={entities}
            connections={connections}
            documents={documents}
            allEntities={allEntities}
            onAddToWorkspace={addEntity}
            onEntityUpdated={loadAll}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <WorkspaceTimelineExplorer entities={entities} allEntities={allEntities} connections={connections} documents={documents} />
        </TabsContent>

        <TabsContent value="selection" className="mt-4">
          <WorkspaceSelectionAnalyzer entities={entities} documents={documents} connections={connections} />
        </TabsContent>

        <TabsContent value="data" className="mt-4 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><Table2 className="w-4 h-4" /> جدول الكيانات والسمات</h3>
            <WorkspaceEntitiesTable entities={entities} />
          </div>
          <WorkspaceDocumentPicker workspace={workspace} allDocuments={allDocuments} selectedDocuments={documents} onChange={loadAll} />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-6">
          <InvestigationReport title={workspace.name} entities={entities} connections={connections} documents={documents} />
          <WorkspaceCsvExport workspace={workspace} entities={entities} />
          <WorkspacePdfLoader workspace={workspace} onLoaded={loadAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}