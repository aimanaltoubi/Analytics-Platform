import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FolderOpen, Plus, Trash2, Loader2 } from 'lucide-react';
import { localClient } from '@/api/localClient';
import { useToast } from '@/components/ui/use-toast';

export default function Workspaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const list = await localClient.entities.Workspace.list('-created_date', 100);
      setWorkspaces(list);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) { toast({ title: 'أدخل اسماً', variant: 'destructive' }); return; }
    setBusy(true);
    try {
      await localClient.entities.Workspace.create({ name: name.trim(), description: description.trim(), entity_ids: [], document_ids: [] });
      setName(''); setDescription(''); setShowCreate(false);
      load();
      toast({ title: 'تم إنشاء مساحة العمل' });
    } catch (e) {
      toast({ title: 'فشل الإنشاء', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!confirm('حذف مساحة العمل؟')) return;
    try {
      await localClient.entities.Workspace.delete(id);
      load();
    } catch (e) { toast({ title: 'فشل الحذف', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">مساحات العمل</h1>
          <p className="text-sm text-muted-foreground mt-1">مجموعات مختارة يدوياً من الكيانات لتحليل روابط مخصص</p>
        </div>
        <button onClick={() => setShowCreate((s) => !s)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> مساحة جديدة
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الاسم</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="مثال: قضية التهريب البحري" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">الوصف</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="وصف موجز" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm border border-border hover:bg-accent">إلغاء</button>
            <button onClick={create} disabled={busy} className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} إنشاء
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">جارٍ التحميل...</div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لا توجد مساحات عمل. أنشئ واحدة للبدء.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <div key={ws.id} className="rounded-xl border border-border bg-card p-4 hover:shadow-md transition-shadow">
              <Link to={`/workspaces/${ws.id}`} className="block">
                <div className="flex items-center gap-2 mb-2">
                  <FolderOpen className="w-5 h-5 text-primary" />
                  <div className="font-medium text-sm">{ws.name}</div>
                </div>
                {ws.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{ws.description}</p>}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{(ws.entity_ids || []).length} كيان</span>
                  <span>{(ws.document_ids || []).length} مستند</span>
                </div>
              </Link>
              <button onClick={() => remove(ws.id)} className="mt-3 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1">
                <Trash2 className="w-3.5 h-3.5" /> حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}