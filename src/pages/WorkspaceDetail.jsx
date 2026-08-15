import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowRight, Plus, X, Users, FileText, MapPin } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import WorkspacePdfLoader from '@/components/WorkspacePdfLoader';
import WorkspaceCsvExport from '@/components/WorkspaceCsvExport';
import WorkspaceNetwork from '@/components/WorkspaceNetwork';
import ManualNetworkCanvas from '@/components/ManualNetworkCanvas';
import WorkspaceTimelineExplorer from '@/components/WorkspaceTimelineExplorer';
import WorkspaceEntitiesTable from '@/components/WorkspaceEntitiesTable';
import GeoTemporalMap from '@/components/GeoTemporalMap';
import { matchesEntityQuery } from '@/lib/entitySearch';

export default function WorkspaceDetail() {
  const { id } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [entities, setEntities] = useState([]);
  const [allEntities, setAllEntities] = useState([]);
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

  const searchResults = search
    ? allEntities.filter((e) => !(workspace.entity_ids || []).includes(e.id) && matchesEntityQuery(e, search)).slice(0, 8)
    : [];

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
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن كيان لإضافته..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-60 overflow-auto">
                {searchResults.map((e) => (
                  <button key={e.id} onClick={() => { addEntity(e.id); setSearch(''); }} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-accent/50 text-right">
                    <span>{e.name}</span>
                    <Plus className="w-4 h-4 text-primary" />
                  </button>
                ))}
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

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> المستندات المحمّلة ({documents.length})</h3>
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا توجد مستندات بعد. استخدم أداة التحميل أدناه.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-auto">
              {documents.map((d) => (
                <Link key={d.id} to={`/documents/${d.id}`} className="flex items-center justify-between rounded-lg bg-accent/40 p-2.5 hover:bg-accent/60">
                  <div>
                    <div className="text-sm font-medium">{d.title}</div>
                    <div className="text-xs text-muted-foreground">{d.entity_count || 0} كيان • {d.connection_count || 0} رابط</div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${d.status === 'processed' ? 'bg-emerald-100 text-emerald-700' : d.status === 'processing' ? 'bg-amber-100 text-amber-700' : d.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>{d.status}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-heading font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> جدول الكيانات والسمات</h3>
        <WorkspaceEntitiesTable entities={entities} />
      </div>

      <WorkspaceCsvExport workspace={workspace} entities={entities} />

      <WorkspacePdfLoader workspace={workspace} onLoaded={loadAll} />
    </div>
  );
}