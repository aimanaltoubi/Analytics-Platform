import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Plus, X, Users, FileText, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import WorkspaceDocumentPicker from '@/components/WorkspaceDocumentPicker';
import WorkspaceSelectionAnalyzer from '@/components/WorkspaceSelectionAnalyzer';
import WorkspacePdfLoader from '@/components/WorkspacePdfLoader';
import WorkspaceCsvExport from '@/components/WorkspaceCsvExport';
import WorkspaceNetwork from '@/components/WorkspaceNetwork';
import ManualNetworkCanvas from '@/components/ManualNetworkCanvas';
import WorkspaceTimelineExplorer from '@/components/WorkspaceTimelineExplorer';
import WorkspaceEntitiesTable from '@/components/WorkspaceEntitiesTable';
import GeoTemporalMap from '@/components/GeoTemporalMap';
import { matchesEntityQuery } from '@/lib/entitySearch';
import InvestigationReport from '@/components/InvestigationReport';

export default function WorkspaceDetail() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [entities, setEntities] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [connections, setConnections] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadAll = async () => {
    setLoading(true);
    try {
      const ws = await base44.entities.Workspace.get(id);
      setWorkspace(ws);
      const [allEnts, allDocs, allConns] = await Promise.all([
        base44.entities.Entity.list('-mention_count', 300),
        base44.entities.Document.list('-created_date', 100),
        base44.entities.Connection.list('-created_date', 500)
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
    await base44.entities.Workspace.update(id, { entity_ids: updated });
    setWorkspace({ ...workspace, entity_ids: updated });
    setEntities((prev) => [...prev, allEntities.find((e) => e.id === entityId)]);
  };

  const removeEntity = async (entityId) => {
    const updated = (workspace.entity_ids || []).filter((eid) => eid !== entityId);
    await base44.entities.Workspace.update(id, { entity_ids: updated });
    setWorkspace({ ...workspace, entity_ids: updated });
    setEntities((prev) => prev.filter((e) => e.id !== entityId));
  };

  const [showPicker, setShowPicker] = useState(false);
  const availableEntities = allEntities.filter((e) => !(workspace.entity_ids || []).includes(e.id));
  const searchResults = search
    ? availableEntities.filter((e) => matchesEntityQuery(e, search)).slice(0, 50)
    : availableEntities.slice(0, 50);

  if (loading) return <div className="p-6 text-sm text-muted-foreground">جارٍ التحميل...</div>;
  if (!workspace) return <div className="p-6 text-sm text-muted-foreground">مساحة العمل غير موجودة.</div>;

  return (
    <div className="p-6 space-y-6">
      <Link to="/workspaces" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="w-4 h-4" /> العودة لمساحات العمل
      </Link>

      <div>
        <h1 className="font-heading text-2xl font-bold">{workspace.name}</h1>
        {workspace.description && <p className="text-sm text-muted-foreground mt-1">{workspace.description}</p>}
      </div>

      <WorkspaceNetwork workspace={workspace} />

      <WorkspaceSelectionAnalyzer entities={entities} documents={documents} connections={connections} />

      <ManualNetworkCanvas entities={entities} />

      <WorkspaceTimelineExplorer entities={entities} allEntities={allEntities} connections={connections} documents={documents} />

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-heading font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> الخريطة الزمنية الجغرافية</h3>
        <p className="text-xs text-muted-foreground">اعرض مواقع الكيانات ومسارات الحركة عبر الزمن داخل مساحة العمل. فعّل «رسم المواقع» لإنشاء مواقع جديدة أو تحديد إحداثياتها بالنقر على الخريطة.</p>
        <GeoTemporalMap entities={entities} connections={connections} documents={documents} onLocationsChanged={loadAll} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> الكيانات المختارة ({entities.length})</h3>
          <div className="relative mb-3">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setShowPicker(true); }}
              onFocus={() => setShowPicker(true)}
              onBlur={() => setTimeout(() => setShowPicker(false), 150)}
              placeholder="ابحث عن كيان أو اضغط لاستعراض كل الكيانات المسجّلة..."
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {showPicker && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-72 overflow-auto">
                {searchResults.map((e) => (
                  <button key={e.id} onMouseDown={(ev) => { ev.preventDefault(); addEntity(e.id); setSearch(''); }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 text-right border-b border-border/40 last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{e.name}</div>
                      <div className="text-[10px] text-muted-foreground">{e.type === 'person' ? 'فرد' : e.type === 'company' ? 'شركة' : e.type === 'organization' ? 'منظمة' : e.type}</div>
                    </div>
                    <Plus className="w-4 h-4 text-primary shrink-0" />
                  </button>
                ))}
              </div>
            )}
            {showPicker && searchResults.length === 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-sm text-muted-foreground">
                {search ? 'لا توجد نتائج مطابقة' : 'لا توجد كيانات أخرى متاحة للإضافة'}
              </div>
            )}
          </div>
          {entities.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم تُختر كيانات بعد. ابحث وأضف كيانات لتحليلها.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-auto">
              {entities.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg bg-accent/40 p-2.5">
                  <Link to={`/entities/${e.id}`} className="text-sm font-medium hover:underline">{e.name}</Link>
                  <button onClick={() => removeEntity(e.id)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <WorkspaceDocumentPicker workspace={workspace} allDocuments={allDocuments} selectedDocuments={documents} onChange={loadAll} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> جدول الكيانات والسمات</h3>
        <WorkspaceEntitiesTable entities={entities} />
      </div>

      <WorkspaceCsvExport workspace={workspace} entities={entities} />

      <InvestigationReport title={workspace.name} entities={entities} connections={connections} documents={documents} />

      <WorkspacePdfLoader workspace={workspace} onLoaded={loadAll} />
    </div>
  );
}